// Regelprüfung vor einer Zuweisung. Gleiche Regeln wie check_assignment() in replica/schema.sql,
// damit die Fake-Datenschicht und später der Server dieselben Warnungen liefern.
import { hoursBetween, localDate, overlaps } from './time.ts';
import type { Absence, Assignment, Member, Shift, ShiftType, Tenant, Warning } from './types.ts';

export interface CheckInput {
  tenant: Tenant;
  member: Member;
  shift: Pick<Shift, 'id' | 'startAt' | 'endAt'>;
  shiftType: Pick<ShiftType, 'qualificationIds'> | null;
  memberAssignments: Assignment[]; // alle Zuweisungen dieses Mitglieds
  memberAbsences: Absence[];
  startAt?: string;
  endAt?: string;
}

export function checkAssignment(i: CheckInput): Warning[] {
  const w: Warning[] = [];
  const start = i.startAt ?? i.shift.startAt;
  const end = i.endAt ?? i.shift.endAt;
  const others = i.memberAssignments.filter((a) => a.shiftId !== i.shift.id);
  const restMs = i.tenant.minRestHours * 3_600_000;
  const s = Date.parse(start);
  const e = Date.parse(end);

  if (others.some((a) => overlaps(a.startAt, a.endAt, start, end))) w.push({ code: 'overlap' });

  const restViolated = others.some((a) => {
    if (overlaps(a.startAt, a.endAt, start, end)) return false;
    const aEnd = Date.parse(a.endAt);
    const aStart = Date.parse(a.startAt);
    return (aEnd <= s && aEnd > s - restMs) || (aStart >= e && aStart < e + restMs);
  });
  if (restViolated) w.push({ code: 'rest_time', minHours: i.tenant.minRestHours });

  const day = localDate(start, i.tenant.timezone);
  if (i.memberAbsences.some((a) => (a.status === 'requested' || a.status === 'approved') && day >= a.startDate && day <= a.endDate)) {
    w.push({ code: 'absent' });
  }

  if (i.shiftType && i.shiftType.qualificationIds.some((q) => !i.member.qualificationIds.includes(q))) {
    w.push({ code: 'missing_qualification' });
  }

  if (i.member.monthlyHoursLimit != null) {
    const month = day.slice(0, 7);
    const hours =
      others
        .filter((a) => localDate(a.startAt, i.tenant.timezone).slice(0, 7) === month)
        .reduce((sum, a) => sum + hoursBetween(a.startAt, a.endAt), 0) + hoursBetween(start, end);
    if (hours > i.member.monthlyHoursLimit) {
      w.push({ code: 'monthly_hours_exceeded', hours: Math.round(hours * 100) / 100, limit: i.member.monthlyHoursLimit });
    }
  }
  return w;
}

/** Kurzer deutscher Text für eine Warnung (UI, Screenreader). */
export function warningText(w: Warning): string {
  switch (w.code) {
    case 'overlap': return 'Schon zu dieser Zeit eingeteilt';
    case 'rest_time': return `Ruhezeit unter ${w.minHours} h`;
    case 'absent': return 'Abwesend (Urlaub oder krank)';
    case 'missing_qualification': return 'Qualifikation fehlt';
    case 'monthly_hours_exceeded': return `${w.hours} von ${w.limit} h im Monat`;
  }
}
