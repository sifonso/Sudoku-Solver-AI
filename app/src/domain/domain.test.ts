/// <reference types="node" />
// Ausführen: npm run test:domain
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkAssignment } from './rules.ts';
import { addDays, hoursBetween, isoWeekday, localDate, localTime, shiftBounds, startOfWeek, zonedToUtc } from './time.ts';
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
  swapRequiresApproval: true, employeesSeeFullPlan: true,
};
const member: Member = {
  id: 'm', tenantId: 't', userId: null, displayName: 'M', initials: 'M', role: 'mitarbeiter',
  employmentType: 'aushilfe', status: 'active', monthlyHoursLimit: 10, qualificationIds: [],
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
    memberAbsences: [{ id: 'ab', tenantId: 't', memberId: 'm', kind: 'sick', startDate: '2026-10-24', endDate: '2026-10-24', status: 'approved' }],
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
