// Fake-Datenschicht im Speicher. Gleiche Regeln wie das Schema:
// RLS-ähnliche Rechteprüfung, Doppelbuchung als harter Fehler, Warnungen über domain/rules.
// Wird durch die Supabase-Umsetzung ersetzt (/replica-backend).
import { checkAssignment as runCheck } from '../domain/rules';
import { checkEntry } from '../domain/quick';
import { addDays, formatDate, isoWeekday, localTime, overlaps, shiftBounds, weekdayShort } from '../domain/time';
import type { Absence } from '../domain/types';
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
  const contacts = new Map<string, { email: string | null; phone: string | null }>(
    db.users.flatMap((u) => db.members.filter((m) => m.userId === u.id).map((m) => [m.id, { email: u.email, phone: null }] as const)),
  );

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
  // Exclusion-Constraint no_overlapping_absence
  const checkAbsenceOverlap = (memberId: string, start: string, end: string) => {
    if (db.absences.some((a) => a.memberId === memberId && (a.status === 'requested' || a.status === 'approved') && a.startDate <= end && a.endDate >= start)) {
      throw new ApiError('absence_overlap');
    }
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
        minRestHours: 11, swapRequiresApproval: true, employeesSeeFullPlan: true, workdays: [1, 2, 3, 4, 5],
      });
      db.members.push({
        id: uid(), tenantId: id, userId: s.userId, displayName, initials: initials.toUpperCase(), role: 'chef',
        employmentType: 'vollzeit', status: 'active', monthlyHoursLimit: null, vacationDaysPerYear: null, qualificationIds: [],
      });
      return id;
    },

    async listMembers(tenantId) {
      await wait();
      me(tenantId);
      // Archivierte gehören dazu: ihre vergangenen Schichten stehen weiter im Plan.
      return db.members.filter((m) => m.tenantId === tenantId);
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
        role: input.role, employmentType: input.employmentType, status: 'invited', monthlyHoursLimit: null, vacationDaysPerYear: null, qualificationIds: [],
      });
      contacts.set(id, { email: input.email.trim().toLowerCase(), phone: null });
      return { memberId: id };
    },
    async updateMember(memberId, patch) {
      await wait();
      const m = db.members.find((x) => x.id === memberId);
      if (!m) throw new ApiError('not_found');
      const actor = me(m.tenantId);
      if (actor.role !== 'chef') throw new ApiError('forbidden');
      const next = { ...m, ...patch, initials: (patch.initials ?? m.initials).toUpperCase() };
      // Trigger keep_one_chef
      const leavesChef = m.role === 'chef' && m.status === 'active' && (next.role !== 'chef' || next.status !== 'active');
      if (leavesChef && !db.members.some((o) => o.tenantId === m.tenantId && o.id !== m.id && o.role === 'chef' && o.status === 'active')) {
        throw new ApiError('last_chef');
      }
      // Unique-Index members_initials_unique
      if (next.status !== 'archived' && db.members.some((o) => o.tenantId === m.tenantId && o.id !== m.id && o.status !== 'archived' && o.initials === next.initials)) {
        throw new ApiError('initials_taken');
      }
      Object.assign(m, next);
      return { ...m };
    },
    async getMemberContact(memberId) {
      await wait();
      const m = db.members.find((x) => x.id === memberId);
      if (!m) return null;
      const actor = me(m.tenantId);
      if (!canPlan(actor.role) && actor.id !== m.id) return null;
      return contacts.get(memberId) ?? { email: null, phone: null };
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
    async listAbsences(tenantId, from, to) {
      await wait();
      const m = me(tenantId);
      return db.absences
        .filter((a) => a.tenantId === tenantId && a.endDate >= from && a.startDate <= to)
        .filter((a) => canPlan(m.role) || a.memberId === m.id) // RLS absences_select
        .map((a) => ({ ...a }));
    },
    async requestVacation(tenantId, start, end, comment) {
      await wait();
      const m = me(tenantId);
      if (end < start) throw new ApiError('not_found', 'invalid_range');
      if (db.vacationBlocks.some((b) => b.tenantId === tenantId && b.startDate <= end && b.endDate >= start)) throw new ApiError('vacation_blocked');
      checkAbsenceOverlap(m.id, start, end);
      const a: Absence = { id: uid(), tenantId, memberId: m.id, kind: 'vacation', startDate: start, endDate: end, status: 'requested', comment, createdAt: new Date().toISOString() };
      db.absences.push(a);
      for (const p of db.members.filter((x) => x.tenantId === tenantId && x.status === 'active' && canPlan(x.role) && x.id !== m.id)) {
        notify(tenantId, p.id, 'absence_requested', 'Neuer Urlaubsantrag', `${m.displayName}, ${formatDate(start)}–${formatDate(end)}`, { absence_id: a.id });
      }
      return a.id;
    },
    async reportSick(tenantId, start, end) {
      await wait();
      const m = me(tenantId);
      checkAbsenceOverlap(m.id, start, end);
      const a: Absence = { id: uid(), tenantId, memberId: m.id, kind: 'sick', startDate: start, endDate: end, status: 'approved', comment: null, createdAt: new Date().toISOString() };
      db.absences.push(a);
      for (const p of db.members.filter((x) => x.tenantId === tenantId && x.status === 'active' && canPlan(x.role) && x.id !== m.id)) {
        notify(tenantId, p.id, 'absence_new', 'Neue Abwesenheit', 'Bitte den Plan prüfen.', { absence_id: a.id });
      }
      return a.id;
    },
    async decideAbsence(absenceId, approve) {
      await wait();
      const a = db.absences.find((x) => x.id === absenceId);
      if (!a) throw new ApiError('not_found');
      requirePlanner(a.tenantId);
      if (a.status !== 'requested') throw new ApiError('already_decided');
      a.status = approve ? 'approved' : 'rejected';
      notify(a.tenantId, a.memberId, approve ? 'absence_approved' : 'absence_rejected', approve ? 'Urlaub genehmigt' : 'Urlaub abgelehnt',
        `${formatDate(a.startDate)}–${formatDate(a.endDate)}`, { absence_id: a.id });
    },
    async cancelAbsence(absenceId) {
      await wait();
      const a = db.absences.find((x) => x.id === absenceId);
      if (!a || a.memberId !== me(a.tenantId).id) throw new ApiError('forbidden');
      if (a.status !== 'requested') throw new ApiError('already_decided');
      a.status = 'cancelled';
    },
    async listVacationBlocks(tenantId) {
      await wait();
      me(tenantId);
      return db.vacationBlocks.filter((b) => b.tenantId === tenantId).sort((a, b) => a.startDate.localeCompare(b.startDate));
    },
    async addVacationBlock(tenantId, start, end, reason) {
      await wait();
      if (me(tenantId).role !== 'chef') throw new ApiError('forbidden');
      db.vacationBlocks.push({ id: uid(), tenantId, startDate: start, endDate: end, reason });
    },
    async removeVacationBlock(id) {
      await wait();
      const b = db.vacationBlocks.find((x) => x.id === id);
      if (!b || me(b.tenantId).role !== 'chef') throw new ApiError('forbidden');
      db.vacationBlocks = db.vacationBlocks.filter((x) => x.id !== id);
    },
    async listSwaps(tenantId) {
      await wait();
      me(tenantId);
      return db.swaps.filter((w) => w.tenantId === tenantId).flatMap((w) => {
        const assignment = db.assignments.find((a) => a.id === w.assignmentId);
        const shift = assignment && db.shifts.find((x) => x.id === assignment.shiftId);
        if (!assignment || !shift) return [];
        return [{
          id: w.id, tenantId, status: w.status, offeredBy: w.offeredBy, chosenMemberId: w.chosenMemberId,
          applicantIds: [...w.applicantIds], assignment: { ...assignment }, shift: { ...shift },
          shiftType: db.shiftTypes.find((t) => t.id === shift.shiftTypeId) ?? null, expiresAt: w.expiresAt, createdAt: w.createdAt,
        }];
      });
    },
    async offerSwap(assignmentId) {
      await wait();
      const a = db.assignments.find((x) => x.id === assignmentId);
      if (!a || a.memberId !== me(a.tenantId).id) throw new ApiError('forbidden');
      // unique swap_one_active_per_assignment
      if (db.swaps.some((w) => w.assignmentId === assignmentId && (w.status === 'open' || w.status === 'pending_approval'))) throw new ApiError('swap_not_open');
      const id = uid();
      db.swaps.push({ id, tenantId: a.tenantId, assignmentId, offeredBy: a.memberId, status: 'open', chosenMemberId: null, applicantIds: [], expiresAt: a.startAt, createdAt: new Date().toISOString() });
      return id;
    },
    async applySwap(swapId) {
      await wait();
      const w = db.swaps.find((x) => x.id === swapId);
      if (!w) throw new ApiError('not_found');
      const m = me(w.tenantId);
      if (m.id === w.offeredBy) throw new ApiError('forbidden');
      if (w.status !== 'open') throw new ApiError('swap_not_open');
      if (!w.applicantIds.includes(m.id)) w.applicantIds.push(m.id);
      notify(w.tenantId, w.offeredBy, 'swap_application', 'Bewerbung auf deinen Tausch', `${m.displayName} würde übernehmen.`, { swap_id: w.id });
    },
    async decideSwap(swapId, memberId, approve) {
      await wait();
      const w = db.swaps.find((x) => x.id === swapId);
      if (!w) throw new ApiError('not_found');
      const actor = me(w.tenantId);
      const tenant = tenantOf(w.tenantId);
      const planner = canPlan(actor.role);
      const a = db.assignments.find((x) => x.id === w.assignmentId)!;
      const finish = () => {
        const chosen = w.chosenMemberId!;
        const shift = db.shifts.find((x) => x.id === a.shiftId)!;
        if (db.assignments.some((x) => x.id !== a.id && x.memberId === chosen && overlaps(x.startAt, x.endAt, a.startAt, a.endAt))) {
          throw new ApiError('no_double_booking');
        }
        a.memberId = chosen;
        w.status = 'approved';
        for (const id of [w.offeredBy, chosen]) notify(w.tenantId, id, 'swap_approved', 'Schichttausch bestätigt', `${formatDate(shift.date)}`, { swap_id: w.id });
        return 'approved' as const;
      };
      if (w.status === 'open' && actor.id === w.offeredBy) {
        if (!w.applicantIds.includes(memberId)) throw new ApiError('not_an_applicant');
        w.chosenMemberId = memberId;
        if (tenant.swapRequiresApproval) {
          w.status = 'pending_approval';
          for (const p of db.members.filter((x) => x.tenantId === w.tenantId && x.status === 'active' && canPlan(x.role))) {
            notify(w.tenantId, p.id, 'swap_pending', 'Schichttausch wartet auf Freigabe', '', { swap_id: w.id });
          }
          return 'pending_approval';
        }
        return finish();
      }
      if (w.status === 'pending_approval' && planner) {
        if (!approve) {
          w.status = 'rejected';
          for (const id of [w.offeredBy, w.chosenMemberId!]) notify(w.tenantId, id, 'swap_rejected', 'Schichttausch abgelehnt', '', { swap_id: w.id });
          return 'rejected';
        }
        return finish();
      }
      if (w.status !== 'open' && w.status !== 'pending_approval') throw new ApiError('already_decided');
      throw new ApiError('forbidden');
    },
    async listTasks(tenantId) {
      await wait();
      me(tenantId);
      return db.tasks.filter((t) => t.tenantId === tenantId)
        .map((t) => ({ ...t, completionCount: db.completions.filter((c) => c.taskId === t.id).length }));
    },
    async saveTask(input) {
      await wait();
      const m = me(input.tenantId);
      if (!(canPlan(m.role) || m.role === 'aufgaben_manager')) throw new ApiError('forbidden');
      const existing = input.id ? db.tasks.find((t) => t.id === input.id) : undefined;
      const t = { ...(existing ?? { deletedAt: null, completionCount: 0 }), ...input, id: input.id ?? uid() } as import('../domain/types').Task;
      if (existing) Object.assign(existing, t); else db.tasks.push(t);
      if (!existing && input.kind === 'special' && input.assignmentId) {
        const a = db.assignments.find((x) => x.id === input.assignmentId);
        if (a && a.memberId !== m.id) notify(input.tenantId, a.memberId, 'task_new', 'Neue Aufgabe', input.title, { task_id: t.id });
      }
      return { ...t };
    },
    async setTaskDeleted(taskId, deleted) {
      await wait();
      const t = db.tasks.find((x) => x.id === taskId);
      if (!t) throw new ApiError('not_found');
      const m = me(t.tenantId);
      if (!(canPlan(m.role) || m.role === 'aufgaben_manager')) throw new ApiError('forbidden');
      t.deletedAt = deleted ? new Date().toISOString() : null;
    },
    async listCompletions(tenantId, shiftIds) {
      await wait();
      me(tenantId);
      return db.completions.filter((c) => shiftIds.includes(c.shiftId)).map((c) => ({ ...c }));
    },
    async completeTask(taskId, shiftId) {
      await wait();
      const shift = db.shifts.find((x) => x.id === shiftId);
      if (!shift) throw new ApiError('not_found');
      const m = me(shift.tenantId);
      const onShift = db.assignments.some((a) => a.shiftId === shiftId && a.memberId === m.id);
      if (!onShift && !(canPlan(m.role) || m.role === 'aufgaben_manager')) throw new ApiError('forbidden');
      // unique (task_id, shift_id): zweites Abhaken ist wirkungslos
      if (!db.completions.some((c) => c.taskId === taskId && c.shiftId === shiftId)) {
        db.completions.push({ id: uid(), taskId, shiftId, memberId: m.id, completedAt: new Date().toISOString() });
      }
    },
    async uncompleteTask(completionId) {
      await wait();
      const c = db.completions.find((x) => x.id === completionId);
      if (!c) return;
      const shift = db.shifts.find((x) => x.id === c.shiftId)!;
      if (c.memberId !== me(shift.tenantId).id) throw new ApiError('forbidden');
      db.completions = db.completions.filter((x) => x.id !== completionId);
    },
    async listQuickActions(tenantId) {
      await wait();
      me(tenantId);
      return {
        folders: db.quickFolders.filter((f) => f.tenantId === tenantId).map((f) => ({ ...f })),
        actions: db.quickActions.filter((a) => a.tenantId === tenantId).map((a) => ({ ...a, fields: a.fields.map((f) => ({ ...f })) })),
      };
    },
    async saveQuickAction(input) {
      await wait();
      const m = me(input.tenantId);
      if (m.role !== 'chef' && m.role !== 'aufgaben_manager') throw new ApiError('forbidden');
      const existing = input.id ? db.quickActions.find((a) => a.id === input.id) : undefined;
      const a = { ...(existing ?? { archivedAt: null }), ...input, id: input.id ?? uid() } as import('../domain/types').QuickAction;
      if (existing) Object.assign(existing, a); else db.quickActions.push(a);
      return { ...a };
    },
    async archiveQuickAction(id) {
      await wait();
      const a = db.quickActions.find((x) => x.id === id);
      if (!a) throw new ApiError('not_found');
      const m = me(a.tenantId);
      if (m.role !== 'chef' && m.role !== 'aufgaben_manager') throw new ApiError('forbidden');
      a.archivedAt = new Date().toISOString();
    },
    async saveFolder(input) {
      await wait();
      const m = me(input.tenantId);
      if (m.role !== 'chef' && m.role !== 'aufgaben_manager') throw new ApiError('forbidden');
      const existing = input.id ? db.quickFolders.find((f) => f.id === input.id) : undefined;
      const f = { ...input, id: input.id ?? uid() };
      if (existing) Object.assign(existing, f); else db.quickFolders.push(f);
      return { ...f };
    },
    async listEntries(tenantId, since, quickActionId) {
      await wait();
      me(tenantId);
      const ids = new Set(db.quickActions.filter((a) => a.tenantId === tenantId).map((a) => a.id));
      return db.quickEntries
        .filter((e) => ids.has(e.quickActionId) && e.recordedAt >= since && (!quickActionId || e.quickActionId === quickActionId))
        .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    },
    async addEntry(tenantId, quickActionId, values) {
      await wait();
      const m = me(tenantId);
      const a = db.quickActions.find((x) => x.id === quickActionId && x.tenantId === tenantId);
      if (!a || a.archivedAt) throw new ApiError('not_found');
      // Trigger quick_entry_check
      const r = checkEntry(a.fields, values);
      if (!r.ok) throw new ApiError('invalid_entry');
      const e = { id: uid(), quickActionId, memberId: m.id, values: { ...values }, outOfRange: r.outOfRange.length > 0, recordedAt: new Date().toISOString() };
      db.quickEntries.push(e);
      return { ...e };
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
