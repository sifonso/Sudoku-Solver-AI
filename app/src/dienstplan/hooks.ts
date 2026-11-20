import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useSyncExternalStore } from 'react';
import { backend } from '../data/client';
import { useActive } from '../data/session';
import { indexEntries, type DpSettings, type Entry, type Staff } from './model';
import { dpFake, type DpApi } from './store';
import { dpSupabase } from './supabaseStore';

export const dp: DpApi = backend === 'demo' ? dpFake() : dpSupabase();

/** FK4/SL (Rolle chef) und Planer dürfen planen und alles einstellen. */
export const canLead = (role: string) => role === 'chef' || role === 'planer';

export function useDp() {
  const { tenant } = useActive();
  return useQuery({ queryKey: ['dp', tenant.id], queryFn: () => dp.load(tenant.id) });
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

export function useSetEntry() {
  const { tenant } = useActive();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (e: Entry) => dp.setEntry(tenant.id, e),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dp-entries', tenant.id] }),
  });
}

export function useSaveSettings() {
  const { tenant } = useActive();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: DpSettings) => dp.saveSettings(tenant.id, s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dp', tenant.id] }),
  });
}

export function useSaveStaff() {
  const { tenant } = useActive();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: Staff) => dp.saveStaff(tenant.id, s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dp', tenant.id] }),
  });
}

export function useSwapBoard() {
  const { tenant } = useActive();
  return useQuery({ queryKey: ['dp-swaps', tenant.id], queryFn: () => dp.swaps(tenant.id), refetchInterval: 15000 });
}

export function useSwapAction<T>(fn: (tenantId: string, input: T) => Promise<void>) {
  const { tenant } = useActive();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: T) => fn(tenant.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dp-swaps', tenant.id] });
      qc.invalidateQueries({ queryKey: ['dp-entries', tenant.id] });
    },
  });
}
