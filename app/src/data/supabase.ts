// Echte Datenschicht über Supabase (PostgREST + RPC + Auth). Gleiche Schnittstelle wie fake.ts.
// Zugriffsregeln setzt die Datenbank durch (RLS, siehe replica/schema.sql), nicht dieser Code.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock, type PostgrestError } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { addDays, isoWeekday, shiftBounds } from '../domain/time';
import type {
  Absence, VacationBlock, SwapView, AppNotification, Assignment, Member, PlanSlot, Session, Shift, ShiftType, Tenant, Warning,
} from '../domain/types';
import { ApiError, type Api, type Membership, type MyShift, type PendingSignup } from './api';
import { DEFAULT_SHIFT_TYPES } from './defaults';

type Row = Record<string, any>;

// ---- Zeilen -> Domänentypen -------------------------------------------------

const toTenant = (r: Row): Tenant => ({
  id: r.id, slug: r.slug, name: r.name, timezone: r.timezone, plan: r.plan, trialEndsAt: r.trial_ends_at,
  minRestHours: Number(r.min_rest_hours), swapRequiresApproval: r.swap_requires_approval,
  employeesSeeFullPlan: r.employees_see_full_plan, workdays: r.workdays ?? [1, 2, 3, 4, 5],
});
const toMember = (r: Row): Member => ({
  id: r.id, tenantId: r.tenant_id, userId: r.user_id, displayName: r.display_name, initials: r.initials,
  role: r.role, employmentType: r.employment_type, status: r.status,
  monthlyHoursLimit: r.monthly_hours_limit == null ? null : Number(r.monthly_hours_limit),
  vacationDaysPerYear: r.vacation_days_per_year == null ? null : Number(r.vacation_days_per_year),
  qualificationIds: (r.member_qualifications ?? []).map((q: Row) => q.qualification_id),
});
const hhmm = (t: string) => t.slice(0, 5);
const toShiftType = (r: Row): ShiftType => ({
  id: r.id, tenantId: r.tenant_id, name: r.name, startTime: hhmm(r.start_time), endTime: hhmm(r.end_time),
  weekdays: r.weekdays, minStaff: r.min_staff, sort: r.sort,
  qualificationIds: (r.shift_type_qualifications ?? []).map((q: Row) => q.qualification_id),
});
const toShift = (r: Row): Shift => ({
  id: r.id, tenantId: r.tenant_id, shiftTypeId: r.shift_type_id, date: r.date, name: r.name,
  startAt: new Date(r.start_at).toISOString(), endAt: new Date(r.end_at).toISOString(), minStaff: r.min_staff,
});
const toAssignment = (r: Row): Assignment => ({
  id: r.id, tenantId: r.tenant_id, shiftId: r.shift_id, memberId: r.member_id,
  startAt: new Date(r.start_at).toISOString(), endAt: new Date(r.end_at).toISOString(),
});
const toAbsence = (r: Row): Absence => ({
  id: r.id, tenantId: r.tenant_id, memberId: r.member_id, kind: r.kind, startDate: r.start_date, endDate: r.end_date,
  status: r.status, comment: r.comment ?? null, createdAt: r.created_at,
});
const toBlock = (r: Row): VacationBlock => ({ id: r.id, tenantId: r.tenant_id, startDate: r.start_date, endDate: r.end_date, reason: r.reason ?? null });
const toNotification = (r: Row): AppNotification => ({
  id: r.id, tenantId: r.tenant_id, memberId: r.member_id, type: r.type, title: r.title, body: r.body,
  data: r.data ?? {}, readAt: r.read_at, createdAt: r.created_at,
});
const toWarning = (w: Row): Warning => {
  switch (w.code) {
    case 'rest_time': return { code: 'rest_time', minHours: Number(w.min_hours) };
    case 'monthly_hours_exceeded': return { code: 'monthly_hours_exceeded', hours: Number(w.hours), limit: Number(w.limit) };
    default: return { code: w.code };
  }
};

// ---- Fehler -----------------------------------------------------------------

function fail(e: PostgrestError | { message?: string; code?: string; status?: number } | null): never {
  const code = (e as Row | null)?.code as string | undefined;
  const msg = ((e as Row | null)?.message as string | undefined) ?? '';
  if (msg.includes('no_overlapping_absence')) throw new ApiError('absence_overlap');
  if (code === '23P01' || msg.includes('no_double_booking')) throw new ApiError('no_double_booking');
  if (code === '42501' || msg.includes('forbidden') || msg.includes('row-level security')) throw new ApiError('forbidden');
  if (code === 'P0002' || code === 'PGRST116') throw new ApiError('not_found');
  if (code === '23505' && msg.includes('slug')) throw new ApiError('slug_taken');
  if (code === '23505' && msg.includes('initials')) throw new ApiError('initials_taken');
  if (msg.includes('last_chef')) throw new ApiError('last_chef');
  if (msg.includes('member_limit_reached')) throw new ApiError('member_limit_reached');
  if (msg.includes('no_overlapping_absence')) throw new ApiError('absence_overlap');
  if (msg.includes('vacation_blocked')) throw new ApiError('vacation_blocked');
  if (msg.includes('already_decided')) throw new ApiError('already_decided');
  if (msg.includes('swap_not_open') || (code === '23505' && msg.includes('swap_one_active'))) throw new ApiError('swap_not_open');
  if (msg.includes('not_an_applicant')) throw new ApiError('not_an_applicant');
  if (msg.includes('Failed to fetch') || msg.includes('Network request failed')) throw new ApiError('network');
  throw new ApiError('network', msg || code || 'unbekannter Fehler');
}
// Ohne generierte Datenbanktypen (supabase gen types) sind die Zeilen untypisiert;
// die to*-Funktionen oben sind die einzige Stelle, an der Spalten gelesen werden.
async function q(p: PromiseLike<{ data: unknown; error: PostgrestError | null }>): Promise<any> {
  const { data, error } = await p;
  if (error) fail(error);
  return data;
}

// ---- Client -----------------------------------------------------------------

export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb = createClient(url, anonKey, {
    auth: {
      ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      lock: processLock,
    },
  });
  // Token nur im Vordergrund auffrischen (empfohlenes Muster für React Native).
  if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (state) => {
      if (state === 'active') sb.auth.startAutoRefresh();
      else sb.auth.stopAutoRefresh();
    });
  }

  const uid = async () => {
    const { data } = await sb.auth.getSession();
    if (!data.session) throw new ApiError('not_authenticated');
    return data.session.user.id;
  };
  const myMember = async (tenantId: string) => {
    const userId = await uid();
    const r = await q(sb.from('members').select('id').eq('tenant_id', tenantId).eq('user_id', userId).eq('status', 'active').maybeSingle());
    if (!r) throw new ApiError('forbidden');
    return (r as Row).id as string;
  };

  const api: Api = {
    async getSession() {
      const { data } = await sb.auth.getSession();
      const s = data.session;
      return s ? { userId: s.user.id, email: s.user.email ?? '' } : null;
    },
    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        if (error.status === 429) throw new ApiError('rate_limited');
        if (error.status === 400) throw new ApiError('invalid_credentials');
        fail(error);
      }
      return { userId: data.user.id, email: data.user.email ?? '' };
    },
    async signUp(email, password, pending: PendingSignup) {
      const free = await q(sb.rpc('slug_available', { p_slug: pending.slug }));
      if (!free) throw new ApiError('slug_taken');
      const { data, error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { pending_signup: pending } },
      });
      if (error) {
        if (error.status === 429) throw new ApiError('rate_limited');
        if (error.code === 'weak_password') throw new ApiError('weak_password');
        if (error.code === 'user_already_exists') throw new ApiError('email_taken');
        fail(error);
      }
      // Bei aktivierter E-Mail-Bestätigung kommt keine Sitzung zurück.
      // Supabase meldet eine schon vergebene Adresse dann nicht (Schutz vor Konto-Ausspähung).
      if (!data.session || !data.user) return null;
      return { userId: data.user.id, email: data.user.email ?? '' };
    },
    async completeSignup() {
      const { data } = await sb.auth.getUser();
      if (!data.user) return null;
      // Eingeladen? Dann ist die Person nach dem Einlösen Mitglied und braucht keinen eigenen Betrieb.
      const claimed = (await q(sb.rpc('claim_invitations'))) as number;
      if (claimed > 0) return 'claimed';
      const pending = data.user.user_metadata?.pending_signup as PendingSignup | undefined;
      if (!pending) return null;
      const existing = await q(sb.from('members').select('id').eq('user_id', data.user.id).limit(1));
      if ((existing as Row[]).length) return null;
      const tenantId = (await q(sb.rpc('create_tenant', {
        p_slug: pending.slug, p_name: pending.company, p_display_name: pending.displayName, p_initials: pending.initials,
      }))) as string;
      for (const [sort, d] of DEFAULT_SHIFT_TYPES.entries()) {
        await q(sb.from('shift_types').insert({
          tenant_id: tenantId, name: d.name, start_time: d.startTime, end_time: d.endTime,
          weekdays: d.weekdays, min_staff: d.minStaff, sort,
        }));
      }
      await sb.auth.updateUser({ data: { pending_signup: null } });
      return tenantId;
    },
    async signOut() {
      await sb.auth.signOut();
    },

    async myMemberships() {
      const userId = await uid();
      const rows = await q(sb.from('members').select('*, member_qualifications(qualification_id), tenants(*)')
        .eq('user_id', userId).eq('status', 'active'));
      return (rows as Row[]).map((r): Membership => ({ member: toMember(r), tenant: toTenant(r.tenants) }));
    },
    async createTenant({ slug, name, displayName, initials }) {
      return (await q(sb.rpc('create_tenant', { p_slug: slug, p_name: name, p_display_name: displayName, p_initials: initials }))) as string;
    },

    async listMembers(tenantId) {
      const rows = await q(sb.from('members').select('*, member_qualifications(qualification_id)')
        .eq('tenant_id', tenantId).order('sort').order('display_name'));
      return (rows as Row[]).map(toMember);
    },
    async listShiftTypes(tenantId) {
      const rows = await q(sb.from('shift_types').select('*, shift_type_qualifications(qualification_id)')
        .eq('tenant_id', tenantId).is('archived_at', null).order('sort'));
      return (rows as Row[]).map(toShiftType);
    },
    async createShiftType(input) {
      const r = await q(sb.from('shift_types').insert({
        tenant_id: input.tenantId, name: input.name, start_time: input.startTime, end_time: input.endTime,
        weekdays: input.weekdays, min_staff: input.minStaff, sort: input.sort,
      }).select('*').single());
      if (input.qualificationIds.length) {
        await q(sb.from('shift_type_qualifications').insert(
          input.qualificationIds.map((qid) => ({ shift_type_id: (r as Row).id, qualification_id: qid, tenant_id: input.tenantId })),
        ));
      }
      return toShiftType({ ...(r as Row), shift_type_qualifications: input.qualificationIds.map((qualification_id) => ({ qualification_id })) });
    },

    async listPlan(tenantId, from, to) {
      const [tenantRow, typeRows, shiftRows] = await Promise.all([
        q(sb.from('tenants').select('timezone').eq('id', tenantId).single()),
        q(sb.from('shift_types').select('*, shift_type_qualifications(qualification_id)').eq('tenant_id', tenantId).is('archived_at', null).order('sort')),
        q(sb.from('shifts').select('*, assignments(*)').eq('tenant_id', tenantId).gte('date', from).lte('date', to)),
      ]);
      const tz = (tenantRow as Row).timezone as string;
      const types = (typeRows as Row[]).map(toShiftType);
      const shifts = shiftRows as Row[];
      const slots: PlanSlot[] = [];
      for (let d = from; d <= to; d = addDays(d, 1)) {
        for (const type of types) {
          const row = shifts.find((s) => s.shift_type_id === type.id && s.date === d);
          if (!row && !type.weekdays.includes(isoWeekday(d))) continue;
          const shift = row ? toShift(row) : null;
          const b = shift ?? shiftBounds(d, type.startTime, type.endTime, tz);
          slots.push({
            date: d, shiftType: type, shift, startAt: b.startAt, endAt: b.endAt,
            assignments: row ? (row.assignments as Row[]).map(toAssignment) : [],
          });
        }
      }
      return slots;
    },
    async ensureShift(shiftTypeId, date) {
      const id = (await q(sb.rpc('ensure_shift', { p_shift_type_id: shiftTypeId, p_date: date }))) as string;
      return toShift(await q(sb.from('shifts').select('*').eq('id', id).single()) as Row);
    },
    async checkAssignment(shiftId, memberId) {
      const w = await q(sb.rpc('check_assignment', { p_shift_id: shiftId, p_member_id: memberId }));
      return ((w ?? []) as Row[]).map(toWarning);
    },
    async assign(tenantId, shiftId, memberId) {
      // start_at/end_at setzt der Trigger assignment_defaults aus der Schicht.
      const r = await q(sb.from('assignments').insert({ tenant_id: tenantId, shift_id: shiftId, member_id: memberId } as Row).select('*').single());
      return toAssignment(r as Row);
    },
    async unassign(assignmentId) {
      await q(sb.from('assignments').delete().eq('id', assignmentId));
    },

    async listMyShifts(tenantId, from, to) {
      const meId = await myMember(tenantId);
      const rows = (await q(sb.from('assignments')
        .select('*, shifts!inner(*, shift_types(*, shift_type_qualifications(qualification_id)), assignments(member_id))')
        .eq('member_id', meId).gte('shifts.date', from).lte('shifts.date', to))) as Row[];
      const colleagueIds = [...new Set(rows.flatMap((r) => (r.shifts.assignments as Row[]).map((a) => a.member_id as string)).filter((id) => id !== meId))];
      const colleagues = colleagueIds.length
        ? ((await q(sb.from('members').select('*').in('id', colleagueIds))) as Row[]).map(toMember)
        : [];
      return rows
        .map((r): MyShift => ({
          assignment: toAssignment(r),
          shift: toShift(r.shifts),
          shiftType: r.shifts.shift_types ? toShiftType(r.shifts.shift_types) : null,
          colleagues: (r.shifts.assignments as Row[])
            .map((a) => colleagues.find((c) => c.id === a.member_id))
            .filter((m): m is Member => !!m),
        }))
        .sort((a, b) => a.assignment.startAt.localeCompare(b.assignment.startAt));
    },

    async listNotifications(tenantId) {
      const meId = await myMember(tenantId);
      const rows = await q(sb.from('notifications').select('*').eq('member_id', meId).order('created_at', { ascending: false }).limit(100));
      return (rows as Row[]).map(toNotification);
    },
    async registerDeviceToken(token, platform) {
      const userId = await uid();
      await q(sb.from('device_tokens').upsert(
        { user_id: userId, expo_push_token: token, platform, last_seen_at: new Date().toISOString() },
        { onConflict: 'expo_push_token' },
      ));
    },
    async inviteMember(input) {
      const { data, error } = await sb.functions.invoke('invite-member', {
        body: {
          tenant_id: input.tenantId, display_name: input.displayName, initials: input.initials,
          email: input.email, role: input.role, employment_type: input.employmentType,
        },
      });
      if (error) {
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
        const code = body?.error as string | undefined;
        if (code === 'member_limit_reached' || code === 'initials_taken' || code === 'forbidden') throw new ApiError(code);
        throw new ApiError('network', code ?? error.message);
      }
      return { memberId: (data as Row).member_id };
    },
    async updateMember(memberId, patch) {
      const row: Row = {};
      if (patch.displayName !== undefined) row.display_name = patch.displayName;
      if (patch.initials !== undefined) row.initials = patch.initials.toUpperCase();
      if (patch.role !== undefined) row.role = patch.role;
      if (patch.employmentType !== undefined) row.employment_type = patch.employmentType;
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.monthlyHoursLimit !== undefined) row.monthly_hours_limit = patch.monthlyHoursLimit;
      if (patch.vacationDaysPerYear !== undefined) row.vacation_days_per_year = patch.vacationDaysPerYear;
      const r = await q(sb.from('members').update(row).eq('id', memberId).select('*, member_qualifications(qualification_id)'));
      // RLS: Nicht-Chef bekommt 0 Zeilen statt Fehler
      if (!(r as Row[]).length) throw new ApiError('forbidden');
      return toMember((r as Row[])[0]!);
    },
    async getMemberContact(memberId) {
      const r = await q(sb.from('member_contacts').select('email, phone').eq('member_id', memberId).maybeSingle());
      return r ? { email: (r as Row).email ?? null, phone: (r as Row).phone ?? null } : null;
    },
    async deleteAccount({ deleteTenants }) {
      const { error } = await sb.functions.invoke('delete-account', { body: { confirm: true, delete_tenants: deleteTenants } });
      if (error) {
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
        if (body?.error === 'sole_chef') return 'sole_chef';
        throw new ApiError('network', body?.error ?? error.message);
      }
      await sb.auth.signOut({ scope: 'local' });
      return 'deleted';
    },
    async listAbsences(tenantId, from, to) {
      const rows = await q(sb.from('absences').select('*').eq('tenant_id', tenantId).gte('end_date', from).lte('start_date', to).order('start_date'));
      return (rows as Row[]).map(toAbsence);
    },
    async requestVacation(tenantId, start, end, comment) {
      return (await q(sb.rpc('request_vacation', { p_tenant: tenantId, p_start: start, p_end: end, p_comment: comment }))) as string;
    },
    async reportSick(tenantId, start, end) {
      return (await q(sb.rpc('report_sick', { p_tenant: tenantId, p_start: start, p_end: end }))) as string;
    },
    async decideAbsence(absenceId, approve) {
      await q(sb.rpc('decide_absence', { p_absence_id: absenceId, p_approve: approve }));
    },
    async cancelAbsence(absenceId) {
      await q(sb.rpc('cancel_absence', { p_absence_id: absenceId }));
    },
    async listVacationBlocks(tenantId) {
      const rows = await q(sb.from('vacation_blocks').select('*').eq('tenant_id', tenantId).order('start_date'));
      return (rows as Row[]).map(toBlock);
    },
    async addVacationBlock(tenantId, start, end, reason) {
      await q(sb.from('vacation_blocks').insert({ tenant_id: tenantId, start_date: start, end_date: end, reason }));
    },
    async removeVacationBlock(id) {
      const r = await q(sb.from('vacation_blocks').delete().eq('id', id).select('id'));
      if (!(r as Row[]).length) throw new ApiError('forbidden');
    },
    async listSwaps(tenantId) {
      const rows = await q(sb.from('swap_requests')
        .select('*, swap_applications(member_id), assignments(*, shifts(*, shift_types(*, shift_type_qualifications(qualification_id))))')
        .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200));
      // Zuweisungen anderer sind für Mitarbeiter evtl. per RLS unsichtbar (employees_see_full_plan = false): dann fehlt assignments.
      return (rows as Row[]).filter((r) => r.assignments?.shifts).map((r): SwapView => ({
        id: r.id, tenantId: r.tenant_id, status: r.status, offeredBy: r.offered_by, chosenMemberId: r.chosen_member_id,
        applicantIds: (r.swap_applications ?? []).map((x: Row) => x.member_id),
        assignment: toAssignment(r.assignments), shift: toShift(r.assignments.shifts),
        shiftType: r.assignments.shifts.shift_types ? toShiftType(r.assignments.shifts.shift_types) : null,
        expiresAt: r.expires_at, createdAt: r.created_at,
      }));
    },
    async offerSwap(assignmentId) {
      return (await q(sb.rpc('offer_swap', { p_assignment_id: assignmentId }))) as string;
    },
    async applySwap(swapId) {
      await q(sb.rpc('apply_swap', { p_swap_id: swapId }));
    },
    async decideSwap(swapId, memberId, approve) {
      return (await q(sb.rpc('decide_swap', { p_swap_id: swapId, p_member_id: memberId, p_approve: approve }))) as 'approved' | 'pending_approval' | 'rejected';
    },
    async markNotificationsRead(ids) {
      if (!ids.length) return;
      await q(sb.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids).is('read_at', null));
    },
  };
  return api;
}
