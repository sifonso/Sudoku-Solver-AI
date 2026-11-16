import type { Absence, Member, Tenant } from '../domain/types';
import { workdaysBetween } from '../domain/time';

/** Urlaubstage im Kalenderjahr: genehmigte + offene Anträge, nur Arbeitstage des Betriebs. Feiertage noch nicht berücksichtigt. */
export function vacationBalance(member: Member, tenant: Tenant, absences: Absence[], year: string) {
  const days = (a: Absence) => {
    const s = a.startDate < `${year}-01-01` ? `${year}-01-01` : a.startDate;
    const e = a.endDate > `${year}-12-31` ? `${year}-12-31` : a.endDate;
    return s > e ? 0 : workdaysBetween(s, e, tenant.workdays);
  };
  const mine = absences.filter((a) => a.memberId === member.id && a.kind === 'vacation');
  const approved = mine.filter((a) => a.status === 'approved').reduce((n, a) => n + days(a), 0);
  const requested = mine.filter((a) => a.status === 'requested').reduce((n, a) => n + days(a), 0);
  const entitlement = member.vacationDaysPerYear;
  return {
    entitlement,
    approved,
    requested,
    remaining: entitlement == null ? null : entitlement - approved - requested,
    /** Arbeitstage des ganzen Antrags, unabhängig vom Jahr (Anzeige pro Antrag). */
    daysOf: (a: Absence) => workdaysBetween(a.startDate, a.endDate, tenant.workdays),
  };
}

export const absenceStatusLabel: Record<Absence['status'], string> = {
  requested: 'Offen',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
  cancelled: 'Zurückgezogen',
};
