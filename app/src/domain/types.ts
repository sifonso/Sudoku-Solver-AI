// Domänentypen. Spiegeln replica/schema.sql (snake_case -> camelCase).
// Datumswerte: 'YYYY-MM-DD' (lokales Datum des Mandanten). Zeitpunkte: ISO-UTC-Strings.

export type Role = 'chef' | 'planer' | 'aufgaben_manager' | 'mitarbeiter';
export type Employment = 'vollzeit' | 'teilzeit' | 'aushilfe';
export type MemberStatus = 'invited' | 'active' | 'locked' | 'archived';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  plan: 'trial' | 'basic' | 'professional' | 'enterprise';
  trialEndsAt: string;
  minRestHours: number;
  swapRequiresApproval: boolean;
  employeesSeeFullPlan: boolean;
  workdays: number[]; // ISO 1 = Mo … 7 = So; für Urlaubstage
}

export interface Member {
  id: string;
  tenantId: string;
  userId: string | null;
  displayName: string;
  initials: string;
  role: Role;
  employmentType: Employment;
  status: MemberStatus;
  monthlyHoursLimit: number | null;
  vacationDaysPerYear: number | null;
  qualificationIds: string[];
}

export interface Qualification {
  id: string;
  tenantId: string;
  name: string;
}

export interface ShiftType {
  id: string;
  tenantId: string;
  name: string;
  startTime: string; // 'HH:MM'
  endTime: string; // 'HH:MM', <= startTime heißt Folgetag
  weekdays: number[]; // ISO 1 = Mo … 7 = So
  minStaff: number;
  qualificationIds: string[];
  sort: number;
}

export interface Shift {
  id: string;
  tenantId: string;
  shiftTypeId: string | null;
  date: string;
  name: string | null;
  startAt: string;
  endAt: string;
  minStaff: number;
}

export interface Assignment {
  id: string;
  tenantId: string;
  shiftId: string;
  memberId: string;
  startAt: string;
  endAt: string;
}

export interface Absence {
  id: string;
  tenantId: string;
  memberId: string;
  kind: 'vacation' | 'sick';
  startDate: string;
  endDate: string;
  status: 'requested' | 'approved' | 'rejected' | 'cancelled';
  comment: string | null;
  createdAt: string;
}

export interface VacationBlock {
  id: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}

export interface AppNotification {
  id: string;
  tenantId: string;
  memberId: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, string>;
  readAt: string | null;
  createdAt: string;
}

export type Warning =
  | { code: 'overlap' }
  | { code: 'rest_time'; minHours: number }
  | { code: 'absent' }
  | { code: 'missing_qualification' }
  | { code: 'monthly_hours_exceeded'; hours: number; limit: number };

/** Eine Zeile im Plan: Schichttyp an einem Tag, mit Schicht (falls schon angelegt) und Besetzung. */
export interface PlanSlot {
  date: string;
  shiftType: ShiftType;
  shift: Shift | null;
  startAt: string;
  endAt: string;
  assignments: Assignment[];
}

export interface Session {
  userId: string;
  email: string;
}
