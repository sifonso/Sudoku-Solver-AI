import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';
import type { Member, Session, Tenant } from '../domain/types';
import { api } from './fake';

type Ctx = {
  session: Session | null;
  loading: boolean;
  tenant: Tenant | null;
  member: Member | null;
  /** Angemeldet, aber noch keine Firma (direkt nach der Registrierung). */
  needsTenant: boolean;
};
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
  const session = useQuery({ queryKey: ['session'], queryFn: () => api.getSession(), staleTime: Infinity });
  const userId = session.data?.userId;
  const memberships = useQuery({
    queryKey: ['memberships', userId],
    queryFn: () => api.myMemberships(),
    enabled: !!userId,
  });
  // Eine Firma pro Person im Durchstich; Firmenwechsler folgt (architecture.md: Mandanten).
  const active = memberships.data?.[0] ?? null;
  const value: Ctx = {
    session: session.data ?? null,
    loading: session.isLoading || (!!userId && memberships.isLoading),
    tenant: active?.tenant ?? null,
    member: active?.member ?? null,
    needsTenant: !!userId && memberships.isSuccess && memberships.data.length === 0,
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

/** Registrierung = Konto + Firma + Standard-Schichttypen in einem Ablauf (F01). */
export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: { email: string; password: string; company: string; slug: string; name: string; initials: string }) => {
      const s = await api.signUp(i.email, i.password);
      const tenantId = await api.createTenant({ slug: i.slug, name: i.company, displayName: i.name, initials: i.initials });
      const defaults = [
        { name: 'Frühschicht', startTime: '06:00', endTime: '14:00' },
        { name: 'Spätschicht', startTime: '14:00', endTime: '22:00' },
      ];
      for (const [sort, d] of defaults.entries()) {
        await api.createShiftType({ tenantId, ...d, weekdays: [1, 2, 3, 4, 5], minStaff: 1, qualificationIds: [], sort });
      }
      return s;
    },
    onSuccess: (s) => switchSession(qc, s),
  });
}
