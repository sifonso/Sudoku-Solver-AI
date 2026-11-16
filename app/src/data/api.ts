// Schnittstelle der Datenschicht. Die Fake-Umsetzung (fake.ts) und später die
// Supabase-Umsetzung erfüllen dieselbe Signatur, Screens merken den Tausch nicht.
// Namen folgen den RPCs/Tabellen aus replica/architecture.md.
import type {
  Absence, VacationBlock, SwapView, Task, TaskCompletion, QuickAction, QuickEntry, QuickFolder, AppNotification, Assignment, Member, PlanSlot, Role, Session, Shift, ShiftType, Tenant, Warning,
} from '../domain/types';

export class ApiError extends Error {
  constructor(public code: ApiErrorCode, message?: string) {
    super(message ?? code);
  }
}
export type ApiErrorCode =
  | 'invalid_credentials'
  | 'email_taken'
  | 'slug_taken'
  | 'not_authenticated'
  | 'forbidden'
  | 'no_double_booking'
  | 'not_found'
  | 'network'
  | 'weak_password'
  | 'rate_limited'
  | 'member_limit_reached'
  | 'initials_taken'
  | 'last_chef'
  | 'absence_overlap'
  | 'vacation_blocked'
  | 'already_decided'
  | 'swap_not_open'
  | 'not_an_applicant'
  | 'invalid_entry';

export interface Membership {
  tenant: Tenant;
  member: Member;
}

/** Firmendaten aus der Registrierung. Liegen in den Konto-Metadaten, bis die E-Mail bestätigt ist. */
export interface PendingSignup {
  company: string;
  slug: string;
  displayName: string;
  initials: string;
}

export interface MyShift {
  assignment: Assignment;
  shift: Shift;
  shiftType: ShiftType | null;
  colleagues: Member[];
}

export interface Api {
  // Auth (Supabase Auth)
  getSession(): Promise<Session | null>;
  signIn(email: string, password: string): Promise<Session>;
  /** null = Bestätigungs-Mail verschickt, Anmeldung erst nach Klick auf den Link. */
  signUp(email: string, password: string, pending: PendingSignup): Promise<Session | null>;
  /** Legt nach der ersten Anmeldung Firma + Standard-Schichttypen an, falls noch keine Mitgliedschaft. */
  completeSignup(): Promise<string | null>;
  signOut(): Promise<void>;

  // Mandant (rpc create_tenant, select members)
  myMemberships(): Promise<Membership[]>;
  createTenant(input: { slug: string; name: string; displayName: string; initials: string }): Promise<string>;

  // Stammdaten
  listMembers(tenantId: string): Promise<Member[]>;
  listShiftTypes(tenantId: string): Promise<ShiftType[]>;
  createShiftType(input: Omit<ShiftType, 'id'>): Promise<ShiftType>;

  // Plan (select shifts + assignments, rpc ensure_shift, rpc check_assignment)
  listPlan(tenantId: string, from: string, to: string): Promise<PlanSlot[]>;
  ensureShift(shiftTypeId: string, date: string): Promise<Shift>;
  checkAssignment(shiftId: string, memberId: string): Promise<Warning[]>;
  assign(tenantId: string, shiftId: string, memberId: string): Promise<Assignment>;
  unassign(assignmentId: string): Promise<void>;

  // Mitarbeiter-Sicht
  listMyShifts(tenantId: string, from: string, to: string): Promise<MyShift[]>;

  // Abwesenheiten (rpc request_vacation, report_sick, decide_absence, cancel_absence; RLS auf absences)
  listAbsences(tenantId: string, from: string, to: string): Promise<Absence[]>;
  requestVacation(tenantId: string, start: string, end: string, comment: string | null): Promise<string>;
  reportSick(tenantId: string, start: string, end: string): Promise<string>;
  decideAbsence(absenceId: string, approve: boolean): Promise<void>;
  cancelAbsence(absenceId: string): Promise<void>;
  listVacationBlocks(tenantId: string): Promise<VacationBlock[]>;
  addVacationBlock(tenantId: string, start: string, end: string, reason: string | null): Promise<void>;
  removeVacationBlock(id: string): Promise<void>;

  // Schichttausch (rpc offer_swap, apply_swap, decide_swap; alle Mitglieder sehen die Tauschbörse)
  listSwaps(tenantId: string): Promise<SwapView[]>;
  offerSwap(assignmentId: string): Promise<string>;
  applySwap(swapId: string): Promise<void>;
  /** Anbieter wählt Bewerber (approve egal) oder Planer gibt frei/lehnt ab. */
  decideSwap(swapId: string, memberId: string, approve: boolean): Promise<'approved' | 'pending_approval' | 'rejected'>;

  // Aufgaben (Tabellen tasks/task_shift_types, rpc complete_task)
  listTasks(tenantId: string): Promise<Task[]>;
  saveTask(input: TaskInput): Promise<Task>;
  setTaskDeleted(taskId: string, deleted: boolean): Promise<void>;
  listCompletions(tenantId: string, shiftIds: string[]): Promise<TaskCompletion[]>;
  completeTask(taskId: string, shiftId: string): Promise<void>;
  uncompleteTask(completionId: string): Promise<void>;

  // Schnellaktionen (Tabellen quick_action_folders, quick_actions, quick_action_entries; Prüfung per Trigger)
  listQuickActions(tenantId: string): Promise<{ folders: QuickFolder[]; actions: QuickAction[] }>;
  saveQuickAction(input: Omit<QuickAction, 'id' | 'archivedAt'> & { id?: string }): Promise<QuickAction>;
  archiveQuickAction(id: string): Promise<void>;
  saveFolder(input: Omit<QuickFolder, 'id'> & { id?: string }): Promise<QuickFolder>;
  listEntries(tenantId: string, since: string, quickActionId?: string): Promise<QuickEntry[]>;
  addEntry(tenantId: string, quickActionId: string, values: Record<string, string>): Promise<QuickEntry>;

  // Benachrichtigungen
  listNotifications(tenantId: string): Promise<AppNotification[]>;
  markNotificationsRead(ids: string[]): Promise<void>;
  registerDeviceToken(token: string, platform: 'ios' | 'android' | 'web'): Promise<void>;

  // Team (Edge Function invite-member; Änderungen nur Chef, RLS members_write)
  inviteMember(input: InviteInput): Promise<{ memberId: string }>;
  updateMember(memberId: string, patch: MemberPatch): Promise<Member>;
  getMemberContact(memberId: string): Promise<{ email: string | null; phone: string | null } | null>;

  // Konto (Edge Function delete-account). sole_chef = Betrieb würde mitgelöscht, zweite Bestätigung nötig.
  deleteAccount(opts: { deleteTenants: boolean }): Promise<'deleted' | 'sole_chef'>;
}

export type MemberPatch = Partial<Pick<Member,
  'displayName' | 'initials' | 'role' | 'employmentType' | 'status' | 'monthlyHoursLimit' | 'vacationDaysPerYear'>>;

export interface InviteInput {
  tenantId: string;
  displayName: string;
  initials: string;
  email: string;
  role: Role;
  employmentType: import('../domain/types').Employment;
}

export const roleLabel: Record<Role, string> = {
  chef: 'Chef',
  planer: 'Planer',
  aufgaben_manager: 'Aufgaben',
  mitarbeiter: 'Mitarbeiter',
};

export const canPlan = (r: Role) => r === 'chef' || r === 'planer';

export interface TaskInput {
  id?: string;
  tenantId: string;
  title: string;
  description: string | null;
  kind: 'standard' | 'special';
  assignmentId: string | null;
  shiftTypeIds: string[];
  weekdays: number[] | null;
  priority: 0 | 1 | 2;
}

/** Geräte-UUID für idempotente Uploads (task_completions.id). */
export const newId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

/** Farbpaar <-> gespeicherte Farbe (Spalte color, Hex aus der Palette). */
export const PAIR_HEX = { lavender: '#C0C3F0', orange: '#E6732C', burgundy: '#5A253E', moos: '#003332' } as const;
export const pairOfHex = (hex: string | null | undefined): import('../domain/types').QuickPair =>
  (Object.entries(PAIR_HEX).find(([, h]) => h.toLowerCase() === (hex ?? '').toLowerCase())?.[0] as import('../domain/types').QuickPair) ?? 'lavender';
