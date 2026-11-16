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
  plan: 'internal' | 'trial' | 'basic' | 'professional' | 'enterprise'; // 'internal': teamintern, ohne Bezahlung
  trialEndsAt: string | null;
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

export type SwapStatus = 'open' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled' | 'expired';

/** Tauschangebot mit allem, was die Ansicht braucht (Schicht, Bewerber). */
export interface SwapView {
  id: string;
  tenantId: string;
  status: SwapStatus;
  offeredBy: string;
  chosenMemberId: string | null;
  applicantIds: string[];
  assignment: Assignment;
  shift: Shift;
  shiftType: ShiftType | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface Task {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  kind: 'standard' | 'special';
  assignmentId: string | null; // nur Sonderaufgabe
  shiftTypeIds: string[]; // nur Standardaufgabe
  weekdays: number[] | null; // null = jeden Tag der Schicht
  priority: 0 | 1 | 2;
  deletedAt: string | null;
  completionCount: number;
}

export interface TaskCompletion {
  id: string;
  taskId: string;
  shiftId: string;
  memberId: string;
  completedAt: string;
}

export type QuickFieldType = 'number' | 'text' | 'check';
export interface QuickField {
  key: string;
  label: string;
  type: QuickFieldType;
  unit?: string;
  min?: number;
  max?: number;
  required?: boolean;
}
export type QuickPair = 'lavender' | 'orange' | 'burgundy' | 'moos';
export type QuickIcon = 'thermometer' | 'package' | 'sparkles' | 'clipboard' | 'coffee' | 'droplets' | 'truck' | 'shield';

export interface QuickFolder {
  id: string;
  tenantId: string;
  name: string;
  pair: QuickPair;
  sort: number;
}

export interface QuickAction {
  id: string;
  tenantId: string;
  folderId: string | null;
  name: string;
  icon: QuickIcon;
  pair: QuickPair;
  fields: QuickField[];
  reminderTimes: string[]; // 'HH:MM' lokal
  sort: number;
  archivedAt: string | null;
}

export interface QuickEntry {
  id: string;
  quickActionId: string;
  memberId: string;
  values: Record<string, string>;
  outOfRange: boolean;
  recordedAt: string;
}

export interface StatRow {
  memberId: string;
  displayName: string;
  initials: string;
  employmentType: Employment;
  shifts: number;
  hours: number;
  sickDays: number;
  vacationDays: number;
}
