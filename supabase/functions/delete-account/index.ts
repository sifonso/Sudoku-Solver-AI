// Konto löschen (Apple App Review 5.1.1(v) verlangt das in der App).
// Ablauf:
//  - Betriebe, in denen der Aufrufer einziger aktiver Chef ist, werden komplett gelöscht
//    (nur wenn der Aufrufer das mit delete_tenants: true ausdrücklich bestätigt).
//  - In allen anderen Betrieben wird das Mitglied archiviert und vom Konto getrennt;
//    die Einsatzhistorie bleibt beim Betrieb (Arbeitszeitnachweise).
//  - Danach wird das Auth-Konto gelöscht; device_tokens fallen per Cascade weg.
import { admin, caller, cors, json } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const who = await caller(req);
  if (who instanceof Response) return who;
  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== true) return json({ error: 'confirmation_required' }, 400);

  const db = admin();
  const { data: memberships, error } = await db
    .from('members').select('id, tenant_id, role, status').eq('user_id', who.user.id);
  if (error) return json({ error: 'lookup_failed' }, 500);

  const soleChefOf: string[] = [];
  for (const m of memberships ?? []) {
    if (m.role !== 'chef' || m.status !== 'active') continue;
    const { count } = await db.from('members').select('id', { count: 'exact', head: true })
      .eq('tenant_id', m.tenant_id).eq('role', 'chef').eq('status', 'active').neq('id', m.id);
    if (!count) soleChefOf.push(m.tenant_id);
  }
  if (soleChefOf.length && body?.delete_tenants !== true) {
    // Die App zeigt dann einen zweiten, deutlicheren Bestätigungsschritt.
    return json({ error: 'sole_chef', tenant_ids: soleChefOf }, 409);
  }

  for (const tenantId of soleChefOf) {
    const { error: e } = await db.from('tenants').delete().eq('id', tenantId);
    if (e) return json({ error: 'tenant_delete_failed' }, 500);
  }
  const keep = (memberships ?? []).filter((m) => !soleChefOf.includes(m.tenant_id)).map((m) => m.id);
  if (keep.length) {
    const { error: e } = await db.from('members').update({ status: 'archived', user_id: null }).in('id', keep);
    if (e) return json({ error: 'archive_failed' }, 500);
  }
  const { error: delErr } = await db.auth.admin.deleteUser(who.user.id);
  if (delErr) return json({ error: 'auth_delete_failed' }, 500);
  return json({ deleted: true, tenants_deleted: soleChefOf.length });
});
