/// <reference types="node" />
// Ausführen: npm run test:domain
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_SETTINGS as S, cellFor, dayCounters, holidayOf, indexEntries, isWork, parseCode, rhythmIndex, yearStats, type Staff,
} from './model.ts';
import { SwapError, planRing, planSwap } from './swap.ts';

const rhythm: string[] = Array.from({ length: 112 }, (_, i) => (i % 7 < 3 ? 'F' : i % 7 < 5 ? 'S/N' : ''));
const person = (id: string, r = rhythm): Staff => ({
  id, short: id, firstName: '', lastName: id, nr: '1', sort: 1, inPlan: true, isLead: false, teamLeadId: null,
  rhythm: r, quals: {}, phonePrivate: '', phoneMobile: '', persNr: '', whatsapp: '',
});

test('Rhythmus: Tag 1 ist der Rhythmusbeginn, Wiederholung nach 112 Tagen, auch rückwärts', () => {
  assert.equal(rhythmIndex('2027-01-04', S), 0);
  assert.equal(rhythmIndex('2027-04-26', S), 0); // + 112 Tage
  assert.equal(rhythmIndex('2027-01-03', S), 111);
  assert.equal(rhythmIndex('2027-03-28', S), 83); // Zeitumstellung verschiebt nichts
});

test('Feiertage Bayern 2027 mit Kürzeln wie in der Tabelle', () => {
  assert.equal(holidayOf('2027-01-06'), 'Hl. 3 K.');
  assert.equal(holidayOf('2027-03-26'), 'Karfr.');
  assert.equal(holidayOf('2027-05-27'), 'Fronl.');
  assert.equal(holidayOf('2027-08-15'), 'Mariä H.');
  assert.equal(holidayOf('2027-01-07'), null);
});

test('Kürzel: Arbeitsplatz/Schicht, Status, reine Grundschicht', () => {
  assert.deepEqual(parseCode('T1/F', S), { workplace: 'T1', shift: 'F', status: null });
  assert.equal(parseCode('U', S).status?.label, 'Urlaub');
  assert.equal(parseCode('S/N', S).workplace, null);
  assert.ok(isWork('AN/S', S) && isWork('S/N', S) && !isWork('K', S) && !isWork('', S) && !isWork('DT', S));
});

test('Feinplan-Eintrag schlägt Rhythmus, leerer Eintrag fällt auf Rhythmus zurück', () => {
  const p = person('a');
  const e = indexEntries([{ staffId: 'a', date: '2027-01-04', code: 'T2/F', flex: true }, { staffId: 'a', date: '2027-01-05', code: '', flex: false }]);
  assert.deepEqual([cellFor(p, '2027-01-04', e, S).code, cellFor(p, '2027-01-04', e, S).flex], ['T2/F', true]);
  assert.equal(cellFor(p, '2027-01-05', e, S).code, 'F');
  assert.equal(cellFor(p, '2027-01-04', e, S, 'rhythmus').code, 'F');
});

test('Zähler: Arbeitsplätze, Verfügbar ohne Arbeitsplatz, Status und FLEX', () => {
  const day = '2027-01-04';
  const e = indexEntries([
    { staffId: 'a', date: day, code: 'T1/F', flex: false },
    { staffId: 'b', date: day, code: 'U', flex: false },
    { staffId: 'c', date: day, code: 'T1/F', flex: true },
  ]);
  const c = dayCounters(day, [person('a'), person('b'), person('c'), person('d')], e, S);
  assert.equal(c['T1/F'], 2);
  assert.equal(c.U, 1);
  assert.equal(c.FLEX, 1);
  assert.equal(c['Verfügbar'], 1); // d nur laut Rhythmus
  assert.equal(c['Schichtstärke'], 2);
});

test('Jahresübersicht zählt Dienste, Sonntage, Nächte und Urlaub', () => {
  const r = Array.from({ length: 112 }, (_, i) => (i % 7 === 6 ? 'N' : ''));
  const st = yearStats(person('a', r), 2027, indexEntries([{ staffId: 'a', date: '2027-01-10', code: 'U', flex: false }]), S);
  assert.equal(st.urlaub, 1);
  assert.equal(st.dienste, 51); // 52 Sonntage 2027, einer davon Urlaub
  assert.equal(st.sonntag, 51);
  assert.equal(st.nacht, 51);
});

test('Tausch: Übernahme setzt DT beim Anbieter, Gegendienst tauscht zurück, Doppelbelegung wird abgelehnt', () => {
  const a = person('a');
  const b = person('b', Array.from({ length: 112 }, (_, i) => (i % 7 === 5 ? 'M' : '')));
  const offer = { id: 'o', staffId: 'a', date: '2027-01-04', code: 'F', note: '', status: 'open' as const, requests: [], acceptedRequestId: null, createdAt: '', decidedBy: null };
  const ch = planSwap(offer, { staffId: 'b', returnDate: '2027-01-09' }, [a, b], [], S);
  assert.deepEqual(ch.map((x) => `${x.staffId}:${x.date}:${x.code}`).sort(), ['a:2027-01-04:DT', 'a:2027-01-09:M', 'b:2027-01-04:F', 'b:2027-01-09:DT']);
  assert.throws(() => planSwap(offer, { staffId: 'a2', returnDate: null }, [a, b], [], S), SwapError);
  const busy = person('c');
  assert.throws(() => planSwap(offer, { staffId: 'c', returnDate: null }, [a, busy], [], S), (e: SwapError) => e.code === 'no_double_booking');
});

test('Tausch am selben Tag 1:1 und Dreieckstausch', () => {
  const day = '2027-01-04';
  const e = [
    { staffId: 'a', date: day, code: 'T1/F', flex: false },
    { staffId: 'b', date: day, code: 'T2/S', flex: false },
    { staffId: 'c', date: day, code: 'PA/M', flex: false },
  ];
  const ppl = [person('a'), person('b'), person('c')];
  const one = planRing([{ staffId: 'a', date: day, code: '' }, { staffId: 'b', date: day, code: '' }], ppl, e, S);
  assert.deepEqual(one.map((x) => `${x.staffId}:${x.code}`).sort(), ['a:T2/S', 'b:T1/F']);
  const tri = planRing([{ staffId: 'a', date: day, code: '' }, { staffId: 'b', date: day, code: '' }, { staffId: 'c', date: day, code: '' }], ppl, e, S);
  assert.deepEqual(tri.map((x) => `${x.staffId}:${x.code}`).sort(), ['a:PA/M', 'b:T1/F', 'c:T2/S']);
  // b gibt nichts ab, hat aber am Tag Dienst: geht nicht
  assert.throws(() => planRing([{ staffId: 'a', date: day, code: '' }, { staffId: 'b', date: null, code: '' }], ppl, e, S), (x: SwapError) => x.code === 'no_double_booking');
  assert.throws(() => planRing([{ staffId: 'a', date: day, code: '' }, { staffId: 'a', date: day, code: '' }], ppl, e, S), (x: SwapError) => x.code === 'invalid_entry');
});

test('Vorübergehender Turnus: wie Kolleg:in, verschoben, ohne; zählt bei Ausbildung nicht zur Besetzung', () => {
  const trainer = person('t');
  const azubi: Staff = { ...person('z'), overrides: [
    { id: '1', from: '2027-01-04', to: '2027-01-10', kind: 'follow', followId: 't' },
    { id: '2', from: '2027-01-11', to: '2027-01-11', kind: 'shift', weeks: 0 },
    { id: '3', from: '2027-01-12', to: '2027-01-12', kind: 'none' },
  ] };
  const e = indexEntries([{ staffId: 't', date: '2027-01-04', code: 'T1/F', flex: false }]);
  const byId = new Map([['t', trainer], ['z', azubi]]);
  const c1 = cellFor(azubi, '2027-01-04', e, S, 'fein', byId);
  assert.deepEqual([c1.code, c1.source], ['T1/F', 'temp']);
  // Im vorübergehenden Turnus keine grauen Kürzel ohne Arbeitsplatz, die Grundschicht bleibt als base erhalten
  assert.deepEqual([cellFor(azubi, '2027-01-11', e, S, 'fein', byId).code, cellFor(azubi, '2027-01-11', e, S, 'fein', byId).base], ['', 'F']);
  assert.equal(cellFor(azubi, '2027-01-12', e, S, 'fein', byId).code, '');
  assert.equal(cellFor(azubi, '2027-01-13', e, S, 'fein', byId).source, 'rhythm');
  const cnt = dayCounters('2027-01-04', [trainer, azubi], e, S);
  assert.equal(cnt['T1/F'], 1);
  assert.equal(cnt['Verfügbar'], 0);
});

test('Autodisposition: Mindestbesetzung nach Qualifikation, Sperren, Vorlieben; Einträge bleiben', async () => {
  const { autoDispo } = await import('./dispo.ts');
  const day = '2027-01-04'; // Tag 0: alle mit F laut Rhythmus
  const q = (t1: string, t2: string) => ({ T1: t1, T2: t2, Ankunft: 'X' });
  const a = { ...person('a'), quals: q('X', 'X') };
  const b = { ...person('b'), quals: q('', 'X') };
  const c = { ...person('c'), quals: q('X', ''), rules: { noGroups: [], noWorkplaces: [], prefer: ['AN'], avoid: [], healthNote: '' } };
  const d = { ...person('d'), quals: q('X', 'X'), rules: { noGroups: ['F' as const], noWorkplaces: [], prefer: [], avoid: [], healthNote: 'kein Früh' } };
  const fixed = { ...person('e'), quals: q('X', 'X') };
  const s = { ...S, minStaffing: { 'T1/F': 1, 'T2/F': 1, 'AN/F': 1 }, dispo: { ...S.dispo, distributeSurplus: false } };
  const r = autoDispo([a, b, c, d, fixed], [{ staffId: 'e', date: day, code: 'U', flex: false }], s, day, day);
  const got = Object.fromEntries(r.changes.map((x) => [x.staffId, x.code]));
  assert.equal(got.b, 'T2/F'); // nur b und a können T2, b kann nur T2
  assert.equal(got.c, 'AN/F'); // Vorliebe
  assert.equal(got.a, 'T1/F');
  assert.equal(got.d, undefined); // Früh gesperrt
  assert.equal(got.e, undefined); // Urlaub bleibt
  assert.ok(r.notes.some((n) => n.staffId === 'd'));
  assert.equal(r.gaps.length, 0);
  const r2 = autoDispo([b], [], s, day, day);
  assert.deepEqual(r2.gaps.map((g) => g.key).sort(), ['AN/F', 'T1/F']);
});
