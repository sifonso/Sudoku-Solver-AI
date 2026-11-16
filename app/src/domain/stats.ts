// Monatsstatistik. Gleiche Regeln wie stats_month() im Schema:
// Schichten/Stunden nach Beginn im Monat (Zeitzone des Betriebs), echte Dauer (Zeitumstellung),
// Krankheitstage = Kalendertage, Urlaubstage = Arbeitstage des Betriebs, jeweils nur genehmigte.
import { addDays, hoursBetween, isoWeekday, localDate } from './time.ts';
import type { Absence, Assignment, Member, StatRow, Tenant } from './types.ts';

export function monthStats(tenant: Pick<Tenant, 'timezone' | 'workdays'>, members: Member[], assignments: Assignment[], absences: Absence[], month: string): StatRow[] {
  const ym = month.slice(0, 7);
  const first = `${ym}-01`;
  const [y, mo] = ym.split('-').map(Number) as [number, number];
  const nextFirst = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`;
  const lastDay = addDays(nextFirst, -1);
  const daysIn = (a: Absence, onlyWorkdays: boolean) => {
    let n = 0;
    const s = a.startDate < first ? first : a.startDate;
    const e = a.endDate > lastDay ? lastDay : a.endDate;
    for (let d = s; d <= e; d = addDays(d, 1)) if (!onlyWorkdays || tenant.workdays.includes(isoWeekday(d))) n++;
    return n;
  };
  return members
    .filter((m) => m.status !== 'archived')
    .map((m) => {
      const mine = assignments.filter((a) => a.memberId === m.id && localDate(a.startAt, tenant.timezone).slice(0, 7) === ym);
      const ab = absences.filter((a) => a.memberId === m.id && a.status === 'approved');
      return {
        memberId: m.id, displayName: m.displayName, initials: m.initials, employmentType: m.employmentType,
        shifts: mine.length,
        hours: Math.round(mine.reduce((h, a) => h + hoursBetween(a.startAt, a.endAt), 0) * 100) / 100,
        sickDays: ab.filter((a) => a.kind === 'sick').reduce((n, a) => n + daysIn(a, false), 0),
        vacationDays: ab.filter((a) => a.kind === 'vacation').reduce((n, a) => n + daysIn(a, true), 0),
      };
    })
    .sort((a, b) => a.employmentType.localeCompare(b.employmentType) || a.displayName.localeCompare(b.displayName, 'de'));
}

/** CSV für Excel (deutsch): Semikolon, Dezimalkomma, BOM für Umlaute. */
export function statsCsv(rows: StatRow[], monthLabel: string): string {
  const esc = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const num = (n: number) => String(n).replace('.', ',');
  const head = ['Monat', 'Name', 'Kürzel', 'Beschäftigung', 'Schichten', 'Stunden', 'Krankheitstage', 'Urlaubstage'];
  const lines = rows.map((r) => [monthLabel, r.displayName, r.initials, r.employmentType, String(r.shifts), num(r.hours), String(r.sickDays), String(r.vacationDays)].map(esc).join(';'));
  return '\uFEFF' + [head.join(';'), ...lines].join('\r\n') + '\r\n';
}
