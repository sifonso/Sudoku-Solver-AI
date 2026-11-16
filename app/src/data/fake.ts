// Fake-Datenschicht im Speicher. Gleiche Regeln wie das Schema:
// RLS-ähnliche Rechteprüfung, Doppelbuchung als harter Fehler, Warnungen über domain/rules.
// Wird durch die Supabase-Umsetzung ersetzt (/replica-backend).
import { checkAssignment as runCheck } from '../domain/rules';
import { addDays, formatDate, isoWeekday, localTime, overlaps, shiftBounds, weekdayShort } from '../domain/time';
import type { Assignment, Member, PlanSlot, Session, Shift } from '../domain/types';
import { ApiError, canPlan, type Api, type Membership, type MyShift, type PendingSignup } from './api';
import { seed, type DB } from './seed';
import { DEFAULT_SHIFT_TYPES } from './defaults';

const LATENCY_MS = 180;
const wait = () => new Promise((r) => setTimeout(r, LATENCY_MS));
const uid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

export function createFakeApi(db: DB = seed()): Api & { _db: DB } {
  let session: Session | null = null;
  const pendingByUser = new Map<string, PendingSignup>();

  const requireSession = () => {
    if (!session) throw new ApiError('not_authenticated');
    return session;
  };
  const me = (tenantId: string): Member => {
    const s = requireSession();
    const m = db.members.find((x) => x.tenantId === tenantId && x.userId === s.userId && x.status === 'active');
    if (!m) throw new ApiError('forbidden');
    return m;
  };
  const requirePlanner = (tenantId: string) => {
    const m = me(tenantId);
    if (!canPlan(m.role)) throw new ApiError('forbidden');
    return m;
  };
  const tenantOf = (id: string) => {
    const t = db.tenants.find((x) => x.id === id);
    if (!t) throw new ApiError('not_found');
    return t;
  };
  const notify = (tenantId: string, memberId: string, type: string, title: string, body: string, data: Record<string, string>) => {
    db.notifications.unshift({ id: uid(), tenantId, memberId, type, title, body, data, readAt: null, createdAt: new Date().toISOString() });
  };

  return {
    _db: db,

    async getSession() {
      return session;
    },
    async signIn(email, password) {
      await wait();
      const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password);
      if (!u) throw new ApiError('invalid_credentials');
      session = { userId: u.id, email: u.email };
      return session;
    },
    async signUp(email, password, pending) {
      await wait();
      const e = email.trim().toLowerCase();
      if (db.users.some((x) => x.email === e)) throw new ApiError('email_taken');
      if (db.tenants.some((t) => t.slug === pending.slug)) throw new ApiError('slug_taken');
      const u = { id: uid(), email: e, password };
      db.users.push(u);
      pendingByUser.set(u.id, pending);
      // Fake: E-Mail gilt sofort als bestätigt.
      session = { userId: u.id, email: u.email };
      return session;
    },
    async completeSignup() {
      const s = requireSession();
      const p = pendingByUser.get(s.userId);
      if (!p || db.members.some((m) => m.userId === s.userId)) return null;
      const tenantId = await this.createTenant({ slug: p.slug, name: p.company, displayName: p.displayName, initials: p.initials });
      for (const [sort, d] of DEFAULT_SHIFT_TYPES.entries()) {
        await this.createShiftType({ tenantId, ...d, sort });
      }
      pendingByUser.delete(s.userId);
      return tenantId;
    },
    async signOut() {
      session = null;
    },

    async myMemberships() {
      await wait();
      const s = requireSession();
      return db.members
        .filter((m) => m.userId === s.userId && m.status === 'active')
        .map((member): Membership => ({ member, tenant: tenantOf(member.tenantId) }));
    },
    async createTenant({ slug, name, displayName, initials }) {
      await wait();
      const s = requireSession();
      if (db.tenants.some((t) => t.slug === slug)) throw new ApiError('slug_taken');
      const id = uid();
      db.tenants.push({
        id, slug, name, timezone: 'Europe/Berlin', plan: 'trial',
        trialEndsAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
        minRestHours: 11, swapRequiresApproval: true, employeesSeeFullPlan: true,
      });
      db.members.push({
        id: uid(), tenantId: id, userId: s.userId, displayName, initials: initials.toUpperCase(), role: 'chef',
        employmentType: 'vollzeit', status: 'active', monthlyHoursLimit: null, qualificationIds: [],
      });
      return id;
    },

    async listMembers(tenantId) {
      await wait();
      me(tenantId);
      return db.members.filter((m) => m.tenantId === tenantId && m.status !== 'archived');
    },
    async listShiftTypes(tenantId) {
      await wait();
      me(tenantId);
      return db.shiftTypes.filter((t) => t.tenantId === tenantId).sort((a, b) => a.sort - b.sort);
    },
    async createShiftType(input) {
      await wait();
      requirePlanner(input.tenantId);
      const t = { ...input, id: uid() };
      db.shiftTypes.push(t);
      return t;
    },

    async listPlan(tenantId, from, to) {
      await wait();
      const m = me(tenantId);
      const tz = tenantOf(tenantId).timezone;
      const types = db.shiftTypes.filter((t) => t.tenantId === tenantId).sort((a, b) => a.sort - b.sort);
      const seeAll = canPlan(m.role) || m.role === 'aufgaben_manager' || tenantOf(tenantId).employeesSeeFullPlan;
      const slots: PlanSlot[] = [];
      for (let d = from; d <= to; d = addDays(d, 1)) {
        for (const type of types) {
          const shift = db.shifts.find((s) => s.shiftTypeId === type.id && s.date === d) ?? null;
          if (!shift && !type.weekdays.includes(isoWeekday(d))) continue;
          const b = shift ?? shiftBounds(d, type.startTime, type.endTime, tz);
          const assignments = shift
            ? db.assignments.filter((a) => a.shiftId === shift.id && (seeAll || a.memberId === m.id))
            : [];
          slots.push({ date: d, shiftType: type, shift, startAt: b.startAt, endAt: b.endAt, assignments });
        }
      }
      return slots;
    },
    async ensureShift(shiftTypeId, date) {
      await wait();
      const type = db.shiftTypes.find((t) => t.id === shiftTypeId);
      if (!type) throw new ApiError('not_found');
      requirePlanner(type.tenantId);
      const existing = db.shifts.find((s) => s.shiftTypeId === shiftTypeId && s.date === date);
      if (existing) return existing;
      const b = shiftBounds(date, type.startTime, type.endTime, tenantOf(type.tenantId).timezone);
      const shift: Shift = { id: uid(), tenantId: type.tenantId, shiftTypeId, date, name: null, minStaff: type.minStaff, ...b };
      db.shifts.push(shift);
      return shift;
    },
    async checkAssignment(shiftId, memberId) {
      await wait();
      const shift = db.shifts.find((s) => s.id === shiftId);
      if (!shift) throw new ApiError('not_found');
      requirePlanner(shift.tenantId);
      const member = db.members.find((m) => m.id === memberId && m.tenantId === shift.tenantId);
      if (!member) throw new ApiError('not_found');
      return runCheck({
        tenant: tenantOf(shift.tenantId),
        member,
        shift,
        shiftType: db.shiftTypes.find((t) => t.id === shift.shiftTypeId) ?? null,
        memberAssignments: db.assignments.filter((a) => a.memberId === memberId),
        memberAbsences: db.absences.filter((a) => a.memberId === memberId),
      });
    },
    async assign(tenantId, shiftId, memberId) {
      await wait();
      const planner = requirePlanner(tenantId);
      const shift = db.shifts.find((s) => s.id === shiftId && s.tenantId === tenantId);
      const member = db.members.find((m) => m.id === memberId && m.tenantId === tenantId);
      if (!shift || !member) throw new ApiError('not_found');
      const dup = db.assignments.find((a) => a.shiftId === shiftId && a.memberId === memberId);
      if (dup) return dup;
      // Exclusion-Constraint no_double_booking
      if (db.assignments.some((a) => a.memberId === memberId && overlaps(a.startAt, a.endAt, shift.startAt, shift.endAt))) {
        throw new ApiError('no_double_booking');
      }
      const a: Assignment = { id: uid(), tenantId, shiftId, memberId, startAt: shift.startAt, endAt: shift.endAt };
      db.assignments.push(a);
      if (member.id !== planner.id) {
        const tz = tenantOf(tenantId).timezone;
        const type = db.shiftTypes.find((t) => t.id === shift.shiftTypeId);
        notify(tenantId, member.id, 'shift_assigned', 'Neue Schicht',
          `${type?.name ?? shift.name ?? 'Schicht'} am ${weekdayShort(shift.date)} ${formatDate(shift.date)}, ${localTime(shift.startAt, tz)}–${localTime(shift.endAt, tz)}`,
          { assignment_id: a.id, date: shift.date });
      }
      return a;
    },
    async unassign(assignmentId) {
      await wait();
      const a = db.assignments.find((x) => x.id === assignmentId);
      if (!a) return;
      const planner = requirePlanner(a.tenantId);
      db.assignments = db.assignments.filter((x) => x.id !== assignmentId);
      const shift = db.shifts.find((s) => s.id === a.shiftId);
      if (shift && a.memberId !== planner.id) {
        const type = db.shiftTypes.find((t) => t.id === shift.shiftTypeId);
        notify(a.tenantId, a.memberId, 'shift_removed', 'Schicht entfällt',
          `${type?.name ?? 'Schicht'} am ${weekdayShort(shift.date)} ${formatDate(shift.date)}`, { date: shift.date });
      }
    },

    async listMyShifts(tenantId, from, to) {
      await wait();
      const m = me(tenantId);
      const t = tenantOf(tenantId);
      return db.assignments
        .filter((a) => a.memberId === m.id)
        .map((assignment): MyShift | null => {
          const shift = db.shifts.find((s) => s.id === assignment.shiftId);
          if (!shift || shift.date < from || shift.date > to) return null;
          const colleagues = t.employeesSeeFullPlan
            ? db.assignments
                .filter((x) => x.shiftId === shift.id && x.memberId !== m.id)
                .map((x) => db.members.find((mm) => mm.id === x.memberId))
                .filter((x): x is Member => !!x)
            : [];
          return { assignment, shift, shiftType: db.shiftTypes.find((s) => s.id === shift.shiftTypeId) ?? null, colleagues };
        })
        .filter((x): x is MyShift => !!x)
        .sort((a, b) => a.assignment.startAt.localeCompare(b.assignment.startAt));
    },

    async listNotifications(tenantId) {
      await wait();
      const m = me(tenantId);
      return db.notifications.filter((n) => n.memberId === m.id);
    },
    async registerDeviceToken() {
      requireSession();
    },
    async inviteMember(input) {
      await wait();
      const m = me(input.tenantId);
      if (m.role !== 'chef') throw new ApiError('forbidden');
      const tenant = tenantOf(input.tenantId);
      const active = db.members.filter((x) => x.tenantId === input.tenantId && (x.status === 'active' || x.status === 'invited'));
      if (tenant.plan === 'trial' && active.length >= 10) throw new ApiError('member_limit_reached');
      if (active.some((x) => x.initials === input.initials.toUpperCase())) throw new ApiError('initials_taken');
      const id = uid();
      db.members.push({
        id, tenantId: input.tenantId, userId: null, displayName: input.displayName, initials: input.initials.toUpperCase(),
        role: input.role, employmentType: input.employmentType, status: 'invited', monthlyHoursLimit: null, qualificationIds: [],
      });
      return { memberId: id };
    },
    async deleteAccount({ deleteTenants }) {
      await wait();
      const s = requireSession();
      const mine = db.members.filter((m) => m.userId === s.userId);
      const soleChef = mine.filter((m) => m.role === 'chef' && m.status === 'active' &&
        !db.members.some((o) => o.tenantId === m.tenantId && o.id !== m.id && o.role === 'chef' && o.status === 'active'));
      if (soleChef.length && !deleteTenants) return 'sole_chef';
      const dropTenants = new Set(soleChef.map((m) => m.tenantId));
      db.tenants = db.tenants.filter((t) => !dropTenants.has(t.id));
      db.members = db.members.filter((m) => !dropTenants.has(m.tenantId));
      for (const m of db.members) if (m.userId === s.userId) { m.userId = null; m.status = 'archived'; }
      db.users = db.users.filter((u) => u.id !== s.userId);
      session = null;
      return 'deleted';
    },
    async markNotificationsRead(ids) {
      const s = requireSession();
      const mine = new Set(db.members.filter((m) => m.userId === s.userId).map((m) => m.id));
      const now = new Date().toISOString();
      for (const n of db.notifications) if (ids.includes(n.id) && mine.has(n.memberId) && !n.readAt) n.readAt = now;
    },
  };
}

export const api = createFakeApi();
