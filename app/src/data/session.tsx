import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Member, Session, Tenant } from '../domain/types';
import type { Membership } from './api';
import { api } from './client';

type Ctx = {
  session: Session | null;
  loading: boolean;
  tenant: Tenant | null;
  member: Member | null;
  /** Angemeldet, aber noch keine Firma (direkt nach der Registrierung). */
  needsTenant: boolean;
  /** Alle Abteilungen, in denen die Person Mitglied ist. */
  memberships: Membership[];
  /** Abteilung wechseln; die Auswahl bleibt auf dem Gerät gespeichert. */
  selectTenant: (tenantId: string) => void;
};
const ACTIVE_KEY = 'dp-active-tenant';
const SessionContext = createContext<Ctx | null>(null);

/**
 * Sitzung wechseln. Nicht qc.clear(): das trennt den laufenden Sitzungs-Hook von seiner
 * Abfrage, und die neue Sitzung käme nie an. Stattdessen Sitzung setzen und nur die
 * übrigen Daten entfernen, damit nichts vom vorigen Konto im Speicher bleibt.
 */
function switchSession(qc: QueryClient, s: Session | null) {
  qc.setQueryData(['session'], s);
  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const session = useQuery({ queryKey: ['session'], queryFn: () => api.getSession(), staleTime: Infinity });
  const userId = session.data?.userId;
  const memberships = useQuery({
    queryKey: ['memberships', userId],
    queryFn: () => api.myMemberships(),
    enabled: !!userId,
  });
  const noMembership = !!userId && memberships.isSuccess && memberships.data.length === 0;
  // Erste Anmeldung nach bestätigter E-Mail: Firma aus den Registrierungsdaten anlegen.
  const complete = useQuery({
    queryKey: ['completeSignup', userId],
    queryFn: async () => {
      const tenantId = await api.completeSignup();
      if (tenantId) await qc.invalidateQueries({ queryKey: ['memberships', userId] });
      return tenantId ?? '';
    },
    enabled: noMembership,
    staleTime: Infinity,
    retry: 1,
  });
  // Mehrere Abteilungen: zuletzt gewählte merken, sonst die erste.
  const [chosen, setChosen] = useState<string | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(ACTIVE_KEY).then((v) => v && setChosen((c) => c ?? v)).catch(() => {});
  }, []);
  const list = memberships.data ?? [];
  const active = list.find((m) => m.tenant.id === chosen) ?? list[0] ?? null;
  const selectTenant = (id: string) => {
    setChosen(id);
    AsyncStorage.setItem(ACTIVE_KEY, id).catch(() => {});
    qc.removeQueries({ predicate: (q) => !['session', 'memberships'].includes(String(q.queryKey[0])) });
  };
  const value: Ctx = {
    session: session.data ?? null,
    loading: session.isLoading || (!!userId && memberships.isLoading) || (noMembership && complete.isLoading),
    tenant: active?.tenant ?? null,
    member: active?.member ?? null,
    needsTenant: noMembership && !complete.isLoading,
    memberships: list,
    selectTenant,
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Ctx {
  const c = useContext(SessionContext);
  if (!c) throw new Error('useSession außerhalb von SessionProvider');
  return c;
}

/** Für Screens hinter dem Login: Firma und Mitglied sind garantiert gesetzt. */
export function useActive(): { tenant: Tenant; member: Member } {
  const { tenant, member } = useSession();
  if (!tenant || !member) throw new Error('useActive ohne aktive Firma');
  return { tenant, member };
}

export function useSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => api.signIn(email, password),
    onSuccess: (s) => switchSession(qc, s),
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.signOut(),
    onSuccess: () => switchSession(qc, null),
  });
}

export type RegisterResult = { status: 'signed_in' } | { status: 'confirm_email'; email: string };

/**
 * Registrierung (F01): Konto mit Firmendaten in den Metadaten. Mit E-Mail-Bestätigung kommt keine
 * Sitzung zurück; die Firma entsteht dann bei der ersten Anmeldung (SessionProvider -> completeSignup).
 */
export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: { email: string; password: string } & (
      { company: string; slug: string; name: string; initials: string; inviteCode?: undefined } | { inviteCode: string }
    )): Promise<RegisterResult> => {
      const pending = 'company' in i && i.company !== undefined
        ? { company: i.company, slug: i.slug, displayName: i.name, initials: i.initials }
        : { inviteCode: (i as { inviteCode: string }).inviteCode };
      const s = await api.signUp(i.email, i.password, pending);
      if (!s) return { status: 'confirm_email', email: i.email.trim() };
      switchSession(qc, s);
      return { status: 'signed_in' };
    },
  });
}

/** Konto löschen. Ergebnis 'sole_chef': der Betrieb würde mitgelöscht, die App fragt ein zweites Mal. */
export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deleteTenants: boolean) => api.deleteAccount({ deleteTenants }),
    onSuccess: (r) => {
      if (r === 'deleted') switchSession(qc, null);
    },
  });
}

/** Angemeldet, aber ohne Betrieb: mit Einladungscode beitreten. */
export function useJoinWithCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.joinWithCode(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['memberships'] }),
  });
}
