// Live-Test gegen das Supabase-Projekt: RLS, RPCs, Trigger, Edge Functions.
// Läuft nur mit SB_URL, SB_PUB, SB_SECRET (siehe npm run test:live). Legt Testkonten (@example.com,
// bestätigt, ohne Mail) an und löscht sie samt Betrieb am Ende wieder.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

const URL = process.env.SB_URL, PUB = process.env.SB_PUB, SECRET = process.env.SB_SECRET;
test.skip(!URL || !PUB || !SECRET, 'SB_URL/SB_PUB/SB_SECRET nicht gesetzt');
test.describe.configure({ mode: 'serial' });

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const SLUG = 'livetest-cafe';
const PW = 'Test-' + Math.random().toString(36).slice(2) + '!9';
let admin: SupabaseClient;
const u: Record<'A' | 'B' | 'C', { id: string; email: string; c: SupabaseClient }> = {} as never;
let tenantId = '';
let memberB = '';

async function cleanup() {
  const list = await admin.auth.admin.listUsers();
  for (const x of list.data?.users ?? []) if (x.email?.endsWith('-livetest@example.com')) await admin.auth.admin.deleteUser(x.id);
  const t = await admin.from('tenants').select('id').eq('slug', SLUG);
  for (const r of t.data ?? []) await admin.from('tenants').delete().eq('id', r.id);
}

test.beforeAll(async () => {
  admin = createClient(URL!, SECRET!, opts);
  await cleanup();
  for (const [k, email, meta] of [
    ['A', 'chef-livetest@example.com', {}],
    ['B', 'mitarbeiterin-livetest@example.com', {}],
    ['C', 'fremd-livetest@example.com', {}],
  ] as const) {
    const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true, user_metadata: meta });
    if (error) throw error;
    const c = createClient(URL!, PUB!, opts);
    const s = await c.auth.signInWithPassword({ email, password: PW });
    if (s.error) throw s.error;
    u[k] = { id: data.user.id, email, c };
  }
});

test.afterAll(async () => {
  await cleanup();
  const t = await admin.from('tenants').select('id').eq('slug', SLUG);
  expect(t.data ?? []).toHaveLength(0);
});

test('LIVE-01 Gast: nur slug_available', async () => {
  const anon = createClient(URL!, PUB!, opts);
  expect((await anon.rpc('slug_available', { p_slug: SLUG })).data).toBe(true);
  const r = await anon.rpc('create_tenant', { p_slug: 'x-y-z', p_name: 'X', p_display_name: 'Y', p_initials: 'XY' });
  expect(r.error?.code).toBe('42501');
});

test('LIVE-02 Chef legt Betrieb an', async () => {
  expect((await u.A.c.rpc('claim_invitations')).data).toBe(0);
  const t = await u.A.c.rpc('create_tenant', { p_slug: SLUG, p_name: 'Livetest Café', p_display_name: 'Chef Live', p_initials: 'CL' });
  expect(t.error).toBeNull();
  tenantId = t.data as string;
  const anon = createClient(URL!, PUB!, opts);
  expect((await anon.rpc('slug_available', { p_slug: SLUG })).data).toBe(false);
});

test('LIVE-03 Einladung über Edge Function und Einlösen', async () => {
  const inv = await u.A.c.functions.invoke('invite-member', {
    body: { tenant_id: tenantId, display_name: 'Mia Live', initials: 'ML', email: u.B.email, employment_type: 'aushilfe' },
  });
  expect(inv.error).toBeNull();
  expect(inv.data.existing_account).toBe(true);
  const notChef = await u.B.c.functions.invoke('invite-member', {
    body: { tenant_id: tenantId, display_name: 'X', initials: 'XX', email: 'x@example.com' },
  });
  expect((notChef.error as { context?: Response })?.context?.status).toBe(403);
  expect((await u.B.c.rpc('claim_invitations')).data).toBe(1);
  expect((await u.B.c.rpc('claim_invitations')).data).toBe(0);
  const m = await u.B.c.from('members').select('id, status').eq('user_id', u.B.id).single();
  expect(m.data?.status).toBe('active');
  memberB = m.data!.id;
});

test('LIVE-04 Zeitumstellung, Zuweisung, Mitteilung, Doppelbuchung', async () => {
  const night = await u.A.c.from('shift_types').insert({ tenant_id: tenantId, name: 'Nachtschicht', start_time: '22:00', end_time: '06:00', weekdays: [6], sort: 1 }).select().single();
  const early = await u.A.c.from('shift_types').insert({ tenant_id: tenantId, name: 'Frühschicht', start_time: '06:00', end_time: '14:00', weekdays: [1, 2, 3], sort: 0 }).select().single();
  const midday = await u.A.c.from('shift_types').insert({ tenant_id: tenantId, name: 'Mittag', start_time: '11:00', end_time: '15:00', weekdays: [3], sort: 2 }).select().single();
  expect(night.error ?? early.error ?? midday.error).toBeNull();

  const n = await u.A.c.rpc('ensure_shift', { p_shift_type_id: night.data.id, p_date: '2027-03-27' });
  const ns = await u.A.c.from('shifts').select('start_at, end_at').eq('id', n.data).single();
  expect((Date.parse(ns.data!.end_at) - Date.parse(ns.data!.start_at)) / 36e5).toBe(7);

  const e = await u.A.c.rpc('ensure_shift', { p_shift_type_id: early.data.id, p_date: '2026-11-18' });
  const ins = await u.A.c.from('assignments').insert({ tenant_id: tenantId, shift_id: e.data, member_id: memberB });
  expect(ins.error).toBeNull();
  const again = await u.A.c.from('assignments').insert({ tenant_id: tenantId, shift_id: e.data, member_id: memberB });
  expect(again.error?.code).toBe('23505');

  // Überschneidung mit anderer Schicht: Exclusion-Constraint
  const mid = await u.A.c.rpc('ensure_shift', { p_shift_type_id: midday.data.id, p_date: '2026-11-18' });
  const warn = await u.A.c.rpc('check_assignment', { p_shift_id: mid.data, p_member_id: memberB });
  expect((warn.data as { code: string }[]).map((w) => w.code)).toContain('overlap');
  const overlap = await u.A.c.from('assignments').insert({ tenant_id: tenantId, shift_id: mid.data, member_id: memberB });
  expect(overlap.error?.code).toBe('23P01');

  const notes = await u.B.c.from('notifications').select('title, body');
  expect(notes.data?.map((x) => x.title)).toContain('Neue Schicht');
});

test('LIVE-05 Mitarbeiterin: keine Planerrechte, keine fremden Kontakte', async () => {
  const shift = await u.B.c.from('shifts').select('id').eq('tenant_id', tenantId).limit(1).single();
  const ins = await u.B.c.from('assignments').insert({ tenant_id: tenantId, shift_id: shift.data!.id, member_id: memberB });
  expect(ins.error?.code).toBe('42501');
  const ren = await u.B.c.from('tenants').update({ name: 'gehackt' }).eq('id', tenantId).select();
  expect(ren.data).toEqual([]);
  expect((await u.B.c.from('tenants').update({ plan: 'enterprise' }).eq('id', tenantId)).error?.code).toBe('42501');
  expect((await u.A.c.from('tenants').update({ plan: 'enterprise' }).eq('id', tenantId)).error?.code).toBe('42501');
  const contacts = await u.B.c.from('member_contacts').select('member_id');
  expect(contacts.data?.every((x) => x.member_id === memberB)).toBe(true);
});

test('LIVE-05b Team ändern: nur Chef, letzter Chef bleibt Chef', async () => {
  const lim = await u.A.c.from('members').update({ monthly_hours_limit: 40 }).eq('id', memberB).select('monthly_hours_limit');
  expect(lim.data?.[0]?.monthly_hours_limit).toBe(40);
  const byB = await u.B.c.from('members').update({ role: 'chef' }).eq('id', memberB).select();
  expect(byB.data).toEqual([]);
  const chef = await u.A.c.from('members').select('id').eq('user_id', u.A.id).single();
  const demote = await u.A.c.from('members').update({ role: 'planer' }).eq('id', chef.data!.id);
  expect(demote.error?.message).toContain('last_chef');
  const lock = await u.A.c.from('members').update({ status: 'locked' }).eq('id', chef.data!.id);
  expect(lock.error?.message).toContain('last_chef');
});

test('LIVE-05c Abwesenheiten: neutrale Mitteilung, Entscheiden, Sperre, Zurückziehen', async () => {
  const sick = await u.B.c.rpc('report_sick', { p_tenant: tenantId, p_start: '2026-11-20', p_end: '2026-11-21' });
  expect(sick.error).toBeNull();
  const dup = await u.B.c.rpc('report_sick', { p_tenant: tenantId, p_start: '2026-11-21' });
  expect(dup.error?.message).toContain('no_overlapping_absence');
  const note = await u.A.c.from('notifications').select('title, body').eq('type', 'absence_new');
  expect(note.data).toEqual([{ title: 'Neue Abwesenheit', body: 'Bitte den Plan prüfen.' }]);
  const seen = await u.A.c.from('absences').select('kind').eq('id', sick.data as string);
  expect(seen.data).toEqual([{ kind: 'sick' }]);

  const v = await u.B.c.rpc('request_vacation', { p_tenant: tenantId, p_start: '2027-03-01', p_end: '2027-03-05', p_comment: 'Test' });
  expect(v.error).toBeNull();
  expect((await u.B.c.rpc('decide_absence', { p_absence_id: v.data, p_approve: true })).error?.code).toBe('42501');
  expect((await u.A.c.rpc('decide_absence', { p_absence_id: v.data, p_approve: true })).error).toBeNull();
  expect((await u.B.c.rpc('cancel_absence', { p_absence_id: v.data })).error?.message).toContain('already_decided');

  expect((await u.A.c.from('vacation_blocks').insert({ tenant_id: tenantId, start_date: '2027-07-01', end_date: '2027-07-15', reason: 'Test' })).error).toBeNull();
  expect((await u.B.c.from('vacation_blocks').insert({ tenant_id: tenantId, start_date: '2027-08-01', end_date: '2027-08-02' })).error?.code).toBe('42501');
  const blocked = await u.B.c.rpc('request_vacation', { p_tenant: tenantId, p_start: '2027-07-10', p_end: '2027-07-12', p_comment: null });
  expect(blocked.error?.message).toContain('vacation_blocked');

  const w = await u.B.c.rpc('request_vacation', { p_tenant: tenantId, p_start: '2027-05-03', p_end: '2027-05-07', p_comment: null });
  expect((await u.A.c.rpc('cancel_absence', { p_absence_id: w.data })).error?.code).toBe('42501');
  expect((await u.B.c.rpc('cancel_absence', { p_absence_id: w.data })).error).toBeNull();
});

test('LIVE-06 Fremde Person sieht nichts', async () => {
  for (const tb of ['tenants', 'members', 'shifts', 'assignments', 'notifications', 'invitations', 'member_contacts', 'absences']) {
    const r = await u.C.c.from(tb).select('*');
    expect(r.data, tb).toEqual([]);
  }
});

test('LIVE-07 Konto löschen: Mitarbeiterin archiviert, einziger Chef nur mit Bestätigung', async () => {
  const b = await u.B.c.functions.invoke('delete-account', { body: { confirm: true } });
  expect(b.data?.deleted).toBe(true);
  const after = await u.A.c.from('members').select('status, user_id').eq('id', memberB).single();
  expect(after.data).toEqual({ status: 'archived', user_id: null });
  const a1 = await u.A.c.functions.invoke('delete-account', { body: { confirm: true } });
  if ((a1.error as { context?: Response })?.context?.status !== 409) console.log('A1', JSON.stringify(a1.data), await (a1.error as { context?: Response })?.context?.text?.());
  expect((a1.error as { context?: Response })?.context?.status).toBe(409);
  const a2 = await u.A.c.functions.invoke('delete-account', { body: { confirm: true, delete_tenants: true } });
  expect(a2.data?.tenants_deleted).toBe(1);
});
