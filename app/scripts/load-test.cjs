// Aufruf: npm run test:load (braucht SB_URL, SB_PUB, SB_SECRET wie test:live). Legt Betrieb "lasttest" an und löscht ihn wieder.
// Lasttest: 40 Personen, eine Woche voll besetzt. Misst die teuren Abfragen so, wie die App sie stellt.
const { createClient } = require('@supabase/supabase-js');
const { URL: U, PUB, SECRET } = { URL: process.env.SB_URL, PUB: process.env.SB_PUB, SECRET: process.env.SB_SECRET };
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(U, SECRET, opts);
const ms = async (label, fn, runs = 3) => {
  const t = [];
  let out;
  for (let i = 0; i < runs; i++) { const s = performance.now(); out = await fn(); t.push(performance.now() - s); }
  t.sort((a, b) => a - b);
  console.log(`${label.padEnd(52)} median ${Math.round(t[Math.floor(runs / 2)])} ms  (min ${Math.round(t[0])}, max ${Math.round(t[runs - 1])})`);
  return out;
};
(async () => {
  const email = 'last-chef@example.com', pw = 'Last-' + Math.random().toString(36).slice(2) + '!1';
  let uid;
  try {
    const pre = await admin.auth.admin.listUsers();
    for (const u of pre.data?.users ?? []) if (u.email === email) await admin.auth.admin.deleteUser(u.id);
    for (const t of (await admin.from('tenants').select('id').eq('slug', 'lasttest')).data ?? []) await admin.from('tenants').delete().eq('id', t.id);
    uid = (await admin.auth.admin.createUser({ email, password: pw, email_confirm: true })).data.user.id;
    const A = createClient(U, PUB, opts);
    await A.auth.signInWithPassword({ email, password: pw });
    const tenant = (await A.rpc('create_tenant', { p_slug: 'lasttest', p_name: 'Lasttest', p_display_name: 'Chef', p_initials: 'CH' })).data;
    const rows = Array.from({ length: 39 }, (_, i) => ({ tenant_id: tenant, display_name: `Person ${i + 1}`, initials: `P${i + 1}`, status: 'invited',
      employment_type: i % 3 === 0 ? 'aushilfe' : 'vollzeit', monthly_hours_limit: i % 3 === 0 ? 40 : null }));
    const members = (await A.from('members').insert(rows).select('id')).data.map((m) => m.id);
    const types = (await A.from('shift_types').insert([
      { tenant_id: tenant, name: 'Früh', start_time: '06:00', end_time: '14:00', weekdays: [1,2,3,4,5,6,7], min_staff: 6, sort: 0 },
      { tenant_id: tenant, name: 'Spät', start_time: '14:00', end_time: '22:00', weekdays: [1,2,3,4,5,6,7], min_staff: 6, sort: 1 },
      { tenant_id: tenant, name: 'Nacht', start_time: '22:00', end_time: '06:00', weekdays: [1,2,3,4,5,6,7], min_staff: 4, sort: 2 },
    ]).select('id')).data.map((t) => t.id);
    // 4 Wochen voll besetzt: je Tag 6 + 6 + 4 Personen, rotierend
    let k = 0, n = 0;
    for (let d = 0; d < 28; d++) {
      const date = new Date(Date.UTC(2026, 10, 16 + d)).toISOString().slice(0, 10);
      for (const [ti, staff] of [[0, 6], [1, 6], [2, 4]]) {
        const sid = (await A.rpc('ensure_shift', { p_shift_type_id: types[ti], p_date: date })).data;
        const batch = [];
        for (let s = 0; s < staff; s++) batch.push({ tenant_id: tenant, shift_id: sid, member_id: members[(k++) % members.length] });
        const r = await A.from('assignments').insert(batch);
        if (!r.error) n += batch.length;
        else for (const b of batch) { if (!(await A.from('assignments').insert(b)).error) n++; }
      }
    }
    console.log(`Testbetrieb: 40 Personen, 3 Schichttypen, ${n} Zuweisungen in 4 Wochen`);

    const week = ['2026-11-16', '2026-11-22'];
    await ms('Plan einer Woche (S03, 3 parallele Abfragen)', () => Promise.all([
      A.from('tenants').select('timezone').eq('id', tenant).single(),
      A.from('shift_types').select('*, shift_type_qualifications(qualification_id)').eq('tenant_id', tenant),
      A.from('shifts').select('*, assignments(*)').eq('tenant_id', tenant).gte('date', week[0]).lte('date', week[1]),
    ]));
    await ms('Mitarbeiterliste (S07)', () => A.from('members').select('*, member_qualifications(qualification_id)').eq('tenant_id', tenant));
    const sid = (await A.rpc('ensure_shift', { p_shift_type_id: types[0], p_date: '2026-11-18' })).data;
    await ms('Zuweisen-Liste (S05): 40× check_assignment parallel', () => Promise.all(members.map((m) => A.rpc('check_assignment', { p_shift_id: sid, p_member_id: m }))));
    const batch = await ms('Zuweisen-Liste (S05) NEU: 1× check_assignments', () => A.rpc('check_assignments', { p_shift_id: sid }));
    console.log('  Zeilen:', batch.data?.length, 'Fehler:', batch.error?.message ?? 'keiner');
    const one = await A.rpc('check_assignment', { p_shift_id: sid, p_member_id: batch.data[0].member_id });
    console.log('  gleiches Ergebnis wie Einzelaufruf:', JSON.stringify(one.data) === JSON.stringify(batch.data[0].warnings));
    await ms('Monatsstatistik (S11, stats_month)', () => A.rpc('stats_month', { p_tenant: tenant, p_month: '2026-11-01' }));
    await ms('Mitteilungen (S25)', () => A.from('notifications').select('*').eq('member_id', members[0]).limit(100));
  } catch (e) { console.log('FEHLER', e.message); }
  finally {
    for (const t of (await admin.from('tenants').select('id').eq('slug', 'lasttest')).data ?? []) await admin.from('tenants').delete().eq('id', t.id);
    if (uid) await admin.auth.admin.deleteUser(uid);
    console.log('aufgeräumt:', ((await admin.from('tenants').select('id')).data ?? []).length, 'Betriebe,', ((await admin.auth.admin.listUsers()).data?.users ?? []).length, 'Nutzer');
  }
})();
