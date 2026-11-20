/// <reference types="node" />
// Ausführen: npm run test:domain
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_SETTINGS as S, cellFor, dayCounters, holidayOf, indexEntries, isWork, parseCode, rhythmIndex, yearStats, type Staff,
} from './model.ts';
import { SwapError, planSwap } from './swap.ts';

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
  assert.deepEqual(ch.map((x) => `${x.staffId}:${x.date}:${x.code}`), ['b:2027-01-04:F', 'a:2027-01-04:DT', 'a:2027-01-09:M', 'b:2027-01-09:DT']);
  assert.throws(() => planSwap(offer, { staffId: 'a2', returnDate: null }, [a, b], [], S), SwapError);
  const busy = person('c');
  assert.throws(() => planSwap(offer, { staffId: 'c', returnDate: null }, [a, busy], [], S), (e: SwapError) => e.code === 'no_double_booking');
});
