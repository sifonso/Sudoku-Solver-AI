// Mitarbeiter einladen (F01, S08). Nur Chefs.
// Legt das Mitglied (status invited) + Einladung an und gibt einen Einladungscode zurück, den der Chef weitergibt.
// Eingelöst wird mit claim_invitation_code() nach der Registrierung. Eine Einladungs-Mail geht nur mit
// send_email: true raus (sinnvoll erst mit eigenem SMTP; der eingebaute Versand schafft 2 Mails pro Stunde).
import { admin, caller, cors, json } from '../_shared/auth.ts';

type Input = {
  tenant_id: string;
  display_name: string;
  initials: string;
  email: string;
  role?: 'chef' | 'planer' | 'aufgaben_manager' | 'mitarbeiter';
  employment_type?: 'vollzeit' | 'teilzeit' | 'aushilfe';
  send_email?: boolean;
};

// Ohne leicht verwechselbare Zeichen (0/O, 1/I/L)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

const ROLES = ['chef', 'planer', 'aufgaben_manager', 'mitarbeiter'];
const TYPES = ['vollzeit', 'teilzeit', 'aushilfe'];

function validate(b: Partial<Input>): Input | string {
  if (typeof b.tenant_id !== 'string' || !/^[0-9a-f-]{36}$/.test(b.tenant_id)) return 'tenant_id';
  if (typeof b.display_name !== 'string' || b.display_name.trim().length < 1 || b.display_name.length > 80) return 'display_name';
  if (typeof b.initials !== 'string' || b.initials.trim().length < 1 || b.initials.length > 4) return 'initials';
  if (typeof b.email !== 'string' || !/^\S+@\S+\.\S+$/.test(b.email) || b.email.length > 254) return 'email';
  if (b.role && !ROLES.includes(b.role)) return 'role';
  if (b.employment_type && !TYPES.includes(b.employment_type)) return 'employment_type';
  return {
    tenant_id: b.tenant_id, display_name: b.display_name.trim(), initials: b.initials.trim().toUpperCase(),
    email: b.email.trim().toLowerCase(), role: b.role ?? 'mitarbeiter', employment_type: b.employment_type ?? 'vollzeit',
    send_email: b.send_email === true,
  };
}

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const who = await caller(req);
  if (who instanceof Response) return who;

  const input = validate(await req.json().catch(() => ({})));
  if (typeof input === 'string') return json({ error: 'invalid_input', field: input }, 400);

  // Rechteprüfung im Namen des Aufrufers (gleiche Funktion wie in den RLS-Policies).
  const { data: isChef } = await who.db.rpc('has_role', { t: input.tenant_id, roles: ['chef'] });
  if (isChef !== true) return json({ error: 'forbidden' }, 403);

  const db = admin();
  const { data: member, error: mErr } = await db.from('members').insert({
    tenant_id: input.tenant_id, display_name: input.display_name, initials: input.initials,
    role: input.role, employment_type: input.employment_type, status: 'invited',
  }).select('id').single();
  if (mErr) {
    if (mErr.message.includes('member_limit_reached')) return json({ error: 'member_limit_reached' }, 409);
    if (mErr.code === '23505') return json({ error: 'initials_taken' }, 409);
    return json({ error: 'member_insert_failed' }, 500);
  }
  await db.from('member_contacts').insert({ member_id: member.id, tenant_id: input.tenant_id, email: input.email });
  const code = newCode();
  const { error: invErr } = await db.from('invitations').insert({
    tenant_id: input.tenant_id, member_id: member.id, email: input.email, token_hash: await sha256(code),
    expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
  });
  if (invErr) return json({ error: 'invitation_insert_failed' }, 500);

  let emailed = false;
  if (input.send_email) {
    const { error: mailErr } = await db.auth.admin.inviteUserByEmail(input.email, { data: { invited_to: input.tenant_id } });
    emailed = !mailErr;
  }
  return json({ member_id: member.id, code: `${code.slice(0, 4)}-${code.slice(4)}`, expires_in_days: 14, emailed });
});
