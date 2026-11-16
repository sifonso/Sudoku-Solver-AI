import { useLocalSearchParams } from 'expo-router';
import { FolderX } from 'lucide-react-native';
import { useQuickActions, useQuickEntries } from '../../../data/hooks';
import { useActive } from '../../../data/session';
import { today, zonedToUtc } from '../../../domain/time';
import { AppScreen } from '../../../features/AppScreen';
import { QuickGrid } from '../../../features/QuickGrid';
import { Card, EmptyState, Skeleton } from '../../../ui';

/** S18 Ordner mit Schnellaktionen. */
export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tenant } = useActive();
  const quick = useQuickActions();
  const entries = useQuickEntries(zonedToUtc(today(tenant.timezone), '00:00', tenant.timezone));
  const folder = quick.data?.folders.find((f) => f.id === id);
  const inside = (quick.data?.actions ?? []).filter((a) => a.folderId === id && !a.archivedAt);
  return (
    <AppScreen title={folder?.name ?? 'Ordner'} eyebrow="Schnellaktionen" back>
      {quick.isLoading ? <Skeleton height={148} /> : !folder || inside.length === 0 ? (
        <Card><EmptyState icon={FolderX} title="Ordner ist leer" body="In der Verwaltung kannst du Schnellaktionen diesem Ordner zuordnen." /></Card>
      ) : (
        <QuickGrid folders={[]} actions={inside} entries={entries.data ?? []} />
      )}
    </AppScreen>
  );
}
