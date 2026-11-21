// Offline lesen: Im Live-Betrieb werden die Dienstplan-Abfragen auf dem Gerät gespeichert (7 Tage)
// und ohne Netz aus dem Speicher gezeigt. In der Demo nicht, sonst passt der Speicher nicht zu den Demodaten.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useState, type ReactNode } from 'react';
import { backend } from './client';

const WEEK = 7 * 24 * 3600 * 1000;
const OFFLINE_KEYS = ['dp', 'dp-entries', 'dp-comments', 'dp-swaps', 'members'];

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 10_000, gcTime: backend === 'demo' ? 5 * 60_000 : WEEK, networkMode: 'offlineFirst' } },
  }));
  const [persister] = useState(() => createAsyncStoragePersister({ storage: AsyncStorage, key: 'schichtplaner-cache-v1', throttleTime: 2000 }));
  if (backend === 'demo') return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return (
    <PersistQueryClientProvider client={client} persistOptions={{
      persister, maxAge: WEEK, buster: 'dp-1',
      dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' && OFFLINE_KEYS.includes(String(q.queryKey[0])) },
    }}>
      {children}
    </PersistQueryClientProvider>
  );
}
