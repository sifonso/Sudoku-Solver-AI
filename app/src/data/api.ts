// Schnittstelle der Datenschicht. Die Fake-Umsetzung (fake.ts) und später die
// Supabase-Umsetzung erfüllen dieselbe Signatur, Screens merken den Tausch nicht.
// Namen folgen den RPCs/Tabellen aus replica/architecture.md.
import type {
  AppNotification, Assignment, Member, PlanSlot, Role, Session, Shift, ShiftType, Tenant, Warning,
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
  | 'last_chef';

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
  'displayName' | 'initials' | 'role' | 'employmentType' | 'status' | 'monthlyHoursLimit'>>;

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
