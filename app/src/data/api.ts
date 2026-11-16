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
  | 'network';

export interface Membership {
  tenant: Tenant;
  member: Member;
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
  signUp(email: string, password: string): Promise<Session>;
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
}

export const roleLabel: Record<Role, string> = {
  chef: 'Chef',
  planer: 'Planer',
  aufgaben_manager: 'Aufgaben',
  mitarbeiter: 'Mitarbeiter',
};

export const canPlan = (r: Role) => r === 'chef' || r === 'planer';
