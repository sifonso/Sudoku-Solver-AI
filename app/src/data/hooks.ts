import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { useActive } from './session';

export function useMembers() {
  const { tenant } = useActive();
  return useQuery({ queryKey: ['members', tenant.id], queryFn: () => api.listMembers(tenant.id) });
}

export function useShiftTypes() {
  const { tenant } = useActive();
  return useQuery({ queryKey: ['shiftTypes', tenant.id], queryFn: () => api.listShiftTypes(tenant.id) });
}

export function usePlan(from: string, to: string) {
  const { tenant } = useActive();
  return useQuery({ queryKey: ['plan', tenant.id, from, to], queryFn: () => api.listPlan(tenant.id, from, to) });
}

export function useMyShifts(from: string, to: string) {
  const { tenant, member } = useActive();
  return useQuery({
    queryKey: ['myShifts', tenant.id, member.id, from, to],
    queryFn: () => api.listMyShifts(tenant.id, from, to),
  });
}

/** Warnungen pro Mitarbeiter für eine Schicht (S05). Legt die Schicht bei Bedarf an. */
export function useCandidates(shiftTypeId: string, date: string) {
  const { tenant } = useActive();
  return useQuery({
    queryKey: ['candidates', tenant.id, shiftTypeId, date],
    queryFn: async () => {
      const shift = await api.ensureShift(shiftTypeId, date);
      const [members, plan] = await Promise.all([api.listMembers(tenant.id), api.listPlan(tenant.id, date, date)]);
      const assignedIds = new Set(plan.find((s) => s.shiftType.id === shiftTypeId)?.assignments.map((a) => a.memberId));
      const rows = await Promise.all(
        members.filter((m) => m.status === 'active' || m.status === 'invited').map(async (member) => ({
          member,
          assigned: assignedIds.has(member.id),
          warnings: assignedIds.has(member.id) ? [] : await api.checkAssignment(shift.id, member.id),
        })),
      );
      // Freie ohne Warnung zuerst, dann nach Anzahl Warnungen, bereits Eingeteilte ans Ende
      rows.sort((a, b) =>
        Number(a.assigned) - Number(b.assigned) ||
        a.warnings.length - b.warnings.length ||
        a.member.displayName.localeCompare(b.member.displayName, 'de'));
      return { shift, rows };
    },
  });
}

function useInvalidatePlan() {
  const qc = useQueryClient();
  return () => {
    for (const k of ['plan', 'candidates', 'myShifts', 'notifications']) qc.invalidateQueries({ queryKey: [k] });
  };
}

export function useAssign() {
  const { tenant } = useActive();
  const invalidate = useInvalidatePlan();
  return useMutation({
    mutationFn: ({ shiftId, memberId }: { shiftId: string; memberId: string }) => api.assign(tenant.id, shiftId, memberId),
    onSettled: invalidate,
  });
}

export function useUnassign() {
  const invalidate = useInvalidatePlan();
  return useMutation({ mutationFn: (assignmentId: string) => api.unassign(assignmentId), onSettled: invalidate });
}

export function useNotifications() {
  const { tenant, member } = useActive();
  return useQuery({
    queryKey: ['notifications', tenant.id, member.id],
    queryFn: () => api.listNotifications(tenant.id),
    refetchInterval: 15_000, // bis Realtime da ist
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.markNotificationsRead(ids),
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMember(memberId: string) {
  const members = useMembers();
  return { ...members, data: members.data?.find((m) => m.id === memberId) };
}

export function useMemberContact(memberId: string) {
  return useQuery({ queryKey: ['memberContact', memberId], queryFn: () => api.getMemberContact(memberId) });
}

function useInvalidateTeam() {
  const qc = useQueryClient();
  return () => {
    for (const k of ['members', 'memberships', 'memberContact', 'plan', 'candidates']) qc.invalidateQueries({ queryKey: [k] });
  };
}

export function useUpdateMember() {
  const invalidate = useInvalidateTeam();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: import('./api').MemberPatch }) => api.updateMember(id, patch),
    onSettled: invalidate,
  });
}

export function useInviteMember() {
  const invalidate = useInvalidateTeam();
  return useMutation({
    mutationFn: (input: import('./api').InviteInput) => api.inviteMember(input),
    onSettled: invalidate,
  });
}

export function useAbsences(from: string, to: string) {
  const { tenant } = useActive();
  return useQuery({ queryKey: ['absences', tenant.id, from, to], queryFn: () => api.listAbsences(tenant.id, from, to) });
}

export function useVacationBlocks() {
  const { tenant } = useActive();
  return useQuery({ queryKey: ['vacationBlocks', tenant.id], queryFn: () => api.listVacationBlocks(tenant.id) });
}

function useInvalidateAbsences() {
  const qc = useQueryClient();
  return () => {
    for (const k of ['absences', 'vacationBlocks', 'candidates', 'notifications', 'plan']) qc.invalidateQueries({ queryKey: [k] });
  };
}

export function useRequestVacation() {
  const { tenant } = useActive();
  const inv = useInvalidateAbsences();
  return useMutation({
    mutationFn: (i: { start: string; end: string; comment: string | null }) => api.requestVacation(tenant.id, i.start, i.end, i.comment),
    onSettled: inv,
  });
}

export function useReportSick() {
  const { tenant } = useActive();
  const inv = useInvalidateAbsences();
  return useMutation({ mutationFn: (i: { start: string; end: string }) => api.reportSick(tenant.id, i.start, i.end), onSettled: inv });
}

export function useDecideAbsence() {
  const inv = useInvalidateAbsences();
  return useMutation({ mutationFn: (i: { id: string; approve: boolean }) => api.decideAbsence(i.id, i.approve), onSettled: inv });
}

export function useCancelAbsence() {
  const inv = useInvalidateAbsences();
  return useMutation({ mutationFn: (id: string) => api.cancelAbsence(id), onSettled: inv });
}

export function useVacationBlockMutations() {
  const { tenant } = useActive();
  const inv = useInvalidateAbsences();
  return {
    add: useMutation({ mutationFn: (i: { start: string; end: string; reason: string | null }) => api.addVacationBlock(tenant.id, i.start, i.end, i.reason), onSettled: inv }),
    remove: useMutation({ mutationFn: (id: string) => api.removeVacationBlock(id), onSettled: inv }),
  };
}

export function useSwaps() {
  const { tenant } = useActive();
  return useQuery({ queryKey: ['swaps', tenant.id], queryFn: () => api.listSwaps(tenant.id) });
}

function useInvalidateSwaps() {
  const qc = useQueryClient();
  return () => {
    for (const k of ['swaps', 'plan', 'myShifts', 'candidates', 'notifications']) qc.invalidateQueries({ queryKey: [k] });
  };
}

export function useSwapMutations() {
  const inv = useInvalidateSwaps();
  return {
    offer: useMutation({ mutationFn: (assignmentId: string) => api.offerSwap(assignmentId), onSettled: inv }),
    apply: useMutation({ mutationFn: (swapId: string) => api.applySwap(swapId), onSettled: inv }),
    decide: useMutation({
      mutationFn: (i: { swapId: string; memberId: string; approve: boolean }) => api.decideSwap(i.swapId, i.memberId, i.approve),
      onSettled: inv,
    }),
  };
}

/** Warnungen für den gewählten Bewerber (nur Planer dürfen check_assignment aufrufen). */
export function useSwapWarnings(shiftId: string | null, memberId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['swapWarnings', shiftId, memberId],
    queryFn: () => api.checkAssignment(shiftId!, memberId!),
    enabled: enabled && !!shiftId && !!memberId,
  });
}

export function useTasks() {
  const { tenant } = useActive();
  return useQuery({ queryKey: ['tasks', tenant.id], queryFn: () => api.listTasks(tenant.id) });
}

export function useCompletions(shiftIds: string[]) {
  const { tenant } = useActive();
  return useQuery({
    queryKey: ['completions', tenant.id, [...shiftIds].sort().join(',')],
    queryFn: () => api.listCompletions(tenant.id, shiftIds),
    enabled: shiftIds.length > 0,
  });
}

function useInvalidateTasks() {
  const qc = useQueryClient();
  return () => {
    for (const k of ['tasks', 'completions', 'notifications']) qc.invalidateQueries({ queryKey: [k] });
  };
}

export function useTaskMutations() {
  const inv = useInvalidateTasks();
  return {
    save: useMutation({ mutationFn: (i: import('./api').TaskInput) => api.saveTask(i), onSettled: inv }),
    setDeleted: useMutation({ mutationFn: (i: { id: string; deleted: boolean }) => api.setTaskDeleted(i.id, i.deleted), onSettled: inv }),
    complete: useMutation({ mutationFn: (i: { taskId: string; shiftId: string }) => api.completeTask(i.taskId, i.shiftId), onSettled: inv }),
    uncomplete: useMutation({ mutationFn: (completionId: string) => api.uncompleteTask(completionId), onSettled: inv }),
  };
}
