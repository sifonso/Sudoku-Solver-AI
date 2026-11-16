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
        members.filter((m) => m.status === 'active').map(async (member) => ({
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
