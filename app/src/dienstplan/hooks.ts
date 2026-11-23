import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useSyncExternalStore } from 'react';
import { backend } from '../data/client';
import { useActive } from '../data/session';
import { indexEntries, type Carpool, type DpSettings, type Entry, type Staff } from './model';
import { dpFake, type Actor, type DpApi } from './store';
import { dpSupabase } from './supabaseStore';

export const dp: DpApi = backend === 'demo' ? dpFake() : dpSupabase();

/** FK4/SL (Rolle chef) und Planer dürfen planen und alles einstellen. */
export const canLead = (role: string) => role === 'chef' || role === 'planer';

export function useDp() {
  const { tenant } = useActive();
  return useQuery({
    queryKey: ['dp', tenant.id], queryFn: () => dp.load(tenant.id),
    // Entfernte Personen aus allen Ansichten ausblenden, aber für Protokoll und Wiederaufnahme behalten
    select: (d) => ({ ...d, staff: d.staff.filter((x) => !x.archived), archived: d.staff.filter((x) => x.archived) }),
  });
}

export function useAudit(limit = 300) {
  const { tenant } = useActive();
  return useQuery({ queryKey: ['dp-audit', tenant.id, limit], queryFn: () => dp.audit(tenant.id, limit) });
}

export function useDpEntries(from: string, to: string) {
  const { tenant } = useActive();
  const q = useQuery({ queryKey: ['dp-entries', tenant.id, from, to], queryFn: () => dp.entries(tenant.id, from, to) });
  const map = useMemo(() => indexEntries(q.data ?? []), [q.data]);
  return { ...q, map };
}

// Nur Demo: als andere Person handeln, um Tausch zwischen zwei Personen auszuprobieren.
let demoAs: string | null = null;
const listeners = new Set<() => void>();
export function setDemoAs(id: string | null) { demoAs = id; listeners.forEach((l) => l()); }
export function useDemoAs() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => demoAs, () => demoAs);
}

/** Eigene Person im Dienstplan (über das Login verknüpft). */
export function useMe(): Staff | null {
  const { member } = useActive();
  const { data } = useDp();
  const as = useDemoAs();
  if (backend === 'demo' && as) return data?.staff.find((s) => s.id === as) ?? null;
  return data?.staff.find((s) => s.memberId === member.id) ?? null;
}

/** Wer handelt: Login, Rolle und verknüpfte Person im Plan. */
export function useActor(): Actor {
  const { member } = useActive();
  const me = useMe();
  const as = useDemoAs();
  // Demo: wer als Person aus dem Plan handelt, hat deren Rechte (keine FK4/SL-Rechte)
  const isLead = canLead(member.role) && !(backend === 'demo' && as);
  const { data } = useDp();
  const isFk3 = !!data?.settings.vacation.approvers.includes(member.id) && !(backend === 'demo' && as);
  return { memberId: member.id, name: member.displayName, isLead, staffId: me?.id ?? null, isFk3 };
}

export function useComments(from: string, to: string) {
  const { tenant } = useActive();
  const q = useQuery({ queryKey: ['dp-comments', tenant.id, from, to], queryFn: () => dp.comments(tenant.id, from, to) });
  const map = useMemo(() => {
    const m = new Map<string, NonNullable<typeof q.data>>();
    for (const c of q.data ?? []) {
      const k = `${c.staffId}|${c.date}`;
      m.set(k, [...(m.get(k) ?? []), c]);
    }
    return m;
  }, [q.data]);
  return { ...q, map };
}

export function useCommentAction<T>(fn: (tenantId: string, input: T, actor: Actor) => Promise<void>) {
  const { tenant } = useActive();
  const actor = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: T) => fn(tenant.id, input, actor),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dp-comments', tenant.id] }),
  });
}

export function useSetEntry() {
  const { tenant } = useActive();
  const actor = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (e: Entry) => dp.setEntry(tenant.id, e, actor),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dp-entries', tenant.id] }); qc.invalidateQueries({ queryKey: ['dp-audit', tenant.id] }); qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });
}

export function useSetEntries() {
  const { tenant } = useActive();
  const actor = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ list, source }: { list: Entry[]; source?: string }) => dp.setEntries(tenant.id, list, actor, source),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dp-entries', tenant.id] }); qc.invalidateQueries({ queryKey: ['dp-audit', tenant.id] }); qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });
}

export function useSaveSettings() {
  const { tenant } = useActive();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: DpSettings) => dp.saveSettings(tenant.id, s),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dp', tenant.id] }); qc.invalidateQueries({ queryKey: ['dp-audit', tenant.id] }); },
  });
}

export function useSaveStaff() {
  const { tenant } = useActive();
  const actor = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: Staff) => dp.saveStaff(tenant.id, s, actor),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dp', tenant.id] }); qc.invalidateQueries({ queryKey: ['dp-audit', tenant.id] }); },
  });
}

export function useSwapBoard() {
  const { tenant } = useActive();
  return useQuery({ queryKey: ['dp-swaps', tenant.id], queryFn: () => dp.swaps(tenant.id), refetchInterval: 15000 });
}

export function useSwapAction<T>(fn: (tenantId: string, input: T, actor: Actor) => Promise<void>) {
  const { tenant } = useActive();
  const actor = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: T) => fn(tenant.id, input, actor),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dp-swaps', tenant.id] });
      qc.invalidateQueries({ queryKey: ['dp-entries', tenant.id] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDeleteStaff() {
  const { tenant } = useActive();
  const actor = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dp.deleteStaff(tenant.id, id, actor),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dp', tenant.id] }); qc.invalidateQueries({ queryKey: ['dp-entries', tenant.id] }); },
  });
}

export function useSaveCarpools() {
  const { tenant } = useActive();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (list: Carpool[]) => dp.saveCarpools(tenant.id, list),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dp', tenant.id] }),
  });
}

export function useVacations(year: number) {
  const { tenant } = useActive();
  return useQuery({ queryKey: ['dp-vac', tenant.id, year], queryFn: () => dp.vacations(tenant.id, year) });
}

export function useFlex(year: number) {
  const { tenant } = useActive();
  return useQuery({ queryKey: ['dp-flex', tenant.id, year], queryFn: () => dp.flex(tenant.id, year) });
}

export function useDocs() {
  const { tenant } = useActive();
  return useQuery({ queryKey: ['dp-docs', tenant.id], queryFn: () => dp.docs(tenant.id) });
}

/** Aktion mit Actor; lädt Urlaub, Dokumente, Plan und Mitteilungen neu. */
export function useDpAction<T>(fn: (tenantId: string, input: T, actor: Actor) => Promise<void>) {
  const { tenant } = useActive();
  const actor = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: T) => fn(tenant.id, input, actor),
    onSuccess: () => {
      for (const k of ['dp-vac', 'dp-flex', 'dp-docs', 'dp-entries', 'dp-audit', 'notifications', 'dp']) qc.invalidateQueries({ queryKey: [k] });
    },
  });
}
