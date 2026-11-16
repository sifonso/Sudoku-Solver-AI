/// <reference types="node" />
// Ausführen: npm run test:domain
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkAssignment } from './rules.ts';
import { tasksForShift } from './tasks.ts';
import { addDays, formatRange, parseGermanDate, workdaysBetween, hoursBetween, isoWeekday, localDate, localTime, shiftBounds, startOfWeek, zonedToUtc } from './time.ts';
import type { Assignment, Member, Tenant } from './types.ts';

const TZ = 'Europe/Berlin';

test('Winterzeit: 06:00 Berlin = 05:00 UTC', () => {
  assert.equal(zonedToUtc('2026-11-16', '06:00', TZ), '2026-11-16T05:00:00.000Z');
});

test('Sommerzeit: 06:00 Berlin = 04:00 UTC', () => {
  assert.equal(zonedToUtc('2026-07-01', '06:00', TZ), '2026-07-01T04:00:00.000Z');
});

test('Nachtschicht über Zeitumstellung im Herbst dauert 9 h (wie im SQL-Test)', () => {
  const b = shiftBounds('2026-10-24', '22:00', '06:00', TZ);
  assert.equal(hoursBetween(b.startAt, b.endAt), 9);
});

test('Nachtschicht über Zeitumstellung im Frühjahr dauert 7 h', () => {
  const b = shiftBounds('2026-03-28', '22:00', '06:00', TZ);
  assert.equal(hoursBetween(b.startAt, b.endAt), 7);
});

test('Rückrechnung UTC -> lokal', () => {
  assert.equal(localDate('2026-11-16T23:30:00.000Z', TZ), '2026-11-17');
  assert.equal(localTime('2026-11-16T05:00:00.000Z', TZ), '06:00');
});

test('Wochenrechnung', () => {
  assert.equal(isoWeekday('2026-11-16'), 1);
  assert.equal(isoWeekday('2026-11-22'), 7);
  assert.equal(startOfWeek('2026-11-22'), '2026-11-16');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

const tenant: Tenant = {
  id: 't', slug: 't', name: 'T', timezone: TZ, plan: 'trial', trialEndsAt: '', minRestHours: 11,
  swapRequiresApproval: true, employeesSeeFullPlan: true, workdays: [1, 2, 3, 4, 5],
};
const member: Member = {
  id: 'm', tenantId: 't', userId: null, displayName: 'M', initials: 'M', role: 'mitarbeiter',
  employmentType: 'aushilfe', status: 'active', monthlyHoursLimit: 10, vacationDaysPerYear: null, qualificationIds: [],
};
const night = shiftBounds('2026-10-24', '22:00', '06:00', TZ);
const nightAssignment: Assignment = { id: 'a1', tenantId: 't', shiftId: 's-night', memberId: 'm', ...night };
const early = shiftBounds('2026-10-25', '06:00', '14:00', TZ);

test('Warnungen: Ruhezeit, Monatsgrenze und Qualifikation (wie im SQL-Test)', () => {
  const w = checkAssignment({
    tenant, member, shift: { id: 's-early', ...early }, shiftType: { qualificationIds: ['q1'] },
    memberAssignments: [nightAssignment], memberAbsences: [],
  });
  assert.deepEqual(w.map((x) => x.code).sort(), ['missing_qualification', 'monthly_hours_exceeded', 'rest_time']);
  const m = w.find((x) => x.code === 'monthly_hours_exceeded');
  assert.ok(m && m.code === 'monthly_hours_exceeded' && m.hours === 17);
});

test('Überschneidung und Abwesenheit', () => {
  const w = checkAssignment({
    tenant, member: { ...member, monthlyHoursLimit: null }, shift: { id: 'x', ...night }, shiftType: null,
    memberAssignments: [{ ...nightAssignment, shiftId: 'other' }],
    memberAbsences: [{ id: 'ab', tenantId: 't', memberId: 'm', kind: 'sick', startDate: '2026-10-24', endDate: '2026-10-24', status: 'approved', comment: null, createdAt: '' }],
  });
  assert.deepEqual(w.map((x) => x.code).sort(), ['absent', 'overlap']);
});

test('Keine Warnung bei passender Zuweisung', () => {
  const w = checkAssignment({
    tenant, member: { ...member, monthlyHoursLimit: null }, shift: { id: 'x', ...early }, shiftType: { qualificationIds: [] },
    memberAssignments: [], memberAbsences: [],
  });
  assert.deepEqual(w, []);
});

test('Arbeitstage, Datumseingabe, Zeitraum-Text', () => {
  assert.equal(workdaysBetween('2026-11-16', '2026-11-22', [1, 2, 3, 4, 5]), 5);
  assert.equal(workdaysBetween('2026-11-21', '2026-11-22', [1, 2, 3, 4, 5]), 0);
  assert.equal(parseGermanDate('1.12.26'), '2026-12-01');
  assert.equal(parseGermanDate('29.02.2027'), null);
  assert.equal(parseGermanDate('29.02.2028'), '2028-02-29');
  assert.equal(parseGermanDate('2026-12-01'), null);
  assert.equal(formatRange('2026-11-20', '2026-11-21'), '20.–21.11.2026');
  assert.equal(formatRange('2026-11-30', '2026-12-02'), '30.11.–02.12.2026');
});

test('Aufgaben pro Schicht: Typ, Wochentag, Sonderaufgabe, gelöscht, Reihenfolge', () => {
  const base = { tenantId: 't', description: null, deletedAt: null, completionCount: 0 };
  const tasks = [
    { ...base, id: 'a', title: 'Kasse zählen', kind: 'standard' as const, assignmentId: null, shiftTypeIds: ['frueh', 'spaet'], weekdays: null, priority: 1 as const },
    { ...base, id: 'b', title: 'Kühlung reinigen', kind: 'standard' as const, assignmentId: null, shiftTypeIds: ['spaet'], weekdays: [5], priority: 2 as const },
    { ...base, id: 'c', title: 'Lieferung annehmen', kind: 'special' as const, assignmentId: 'as1', shiftTypeIds: [], weekdays: null, priority: 1 as const },
    { ...base, id: 'd', title: 'Alt', kind: 'standard' as const, assignmentId: null, shiftTypeIds: ['spaet'], weekdays: null, priority: 1 as const, deletedAt: 'x' },
  ];
  const friday = { id: 's1', shiftTypeId: 'spaet', date: '2026-11-20' };
  const monday = { id: 's2', shiftTypeId: 'spaet', date: '2026-11-16' };
  assert.deepEqual(tasksForShift(tasks, friday, [{ id: 'as1', shiftId: 's1' }]).map((t) => t.id), ['b', 'a', 'c']);
  assert.deepEqual(tasksForShift(tasks, monday, [{ id: 'as9', shiftId: 's2' }]).map((t) => t.id), ['a']);
});
