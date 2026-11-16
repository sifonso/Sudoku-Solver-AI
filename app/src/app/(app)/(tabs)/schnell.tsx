import { router } from 'expo-router';
import { ClipboardCheck, LayoutGrid, Settings2, Users } from 'lucide-react-native';
import { View } from 'react-native';
import { useQuickActions, useQuickEntries } from '../../../data/hooks';
import { useActive } from '../../../data/session';
import { today, zonedToUtc } from '../../../domain/time';
import { AppScreen } from '../../../features/AppScreen';
import { QuickGrid } from '../../../features/QuickGrid';
import { ActionTile, Banner, Button, Card, EmptyState, IconButton, Skeleton } from '../../../ui';

/** S16 Schnellaktionen: Kacheln für Protokolle, Ordner, "Heute" und "Aufgaben". */
export default function QuickScreen() {
  const { tenant, member } = useActive();
  const quick = useQuickActions();
  const since = zonedToUtc(today(tenant.timezone), '00:00', tenant.timezone);
  const entries = useQuickEntries(since);
  const canManage = member.role === 'chef' || member.role === 'aufgaben_manager';
  const folders = quick.data?.folders ?? [];
  const empty = quick.isSuccess && quick.data.actions.filter((a) => !a.archivedAt).length === 0;

  return (
    <AppScreen title="Schnellaktionen" eyebrow={tenant.name} onRefresh={() => { quick.refetch(); entries.refetch(); }}
      refreshing={quick.isRefetching}
      actions={canManage ? <IconButton icon={Settings2} label="Schnellaktionen verwalten" onPress={() => router.push('/schnellaktionen-verwalten')} /> : undefined}>
      {quick.isLoading ? (
        <View style={{ flexDirection: 'row', gap: 12 }}><Skeleton height={148} width="48%" /><Skeleton height={148} width="48%" /></View>
      ) : quick.isError ? (
        <Banner tone="danger" title="Schnellaktionen konnten nicht geladen werden"
          action={<Button label="Erneut" size="sm" variant="secondary" onPress={() => quick.refetch()} />} />
      ) : empty ? (
        <Card>
          <EmptyState icon={LayoutGrid} title="Noch keine Schnellaktionen"
            body="Schnellaktionen sind wiederkehrende Protokolle, zum Beispiel Kühltemperaturen oder Reinigung. Ein Tipp, Werte eintragen, fertig."
            action={canManage ? <Button label="Erste Schnellaktion anlegen" onPress={() => router.push('/schnellaktionen-verwalten')} /> : undefined} />
        </Card>
      ) : (
        <QuickGrid folders={folders} actions={quick.data?.actions ?? []} entries={entries.data ?? []}
          extra={(basis) => (
            <>
              <View style={basis}>
                <ActionTile title="Heute" subtitle="Wer arbeitet heute?" icon={Users} pair="lavender" pattern="pfeile"
                  onPress={() => router.push('/heute')} />
              </View>
              <View style={basis}>
                <ActionTile title="Aufgaben" subtitle="Meine Schicht-Aufgaben" icon={ClipboardCheck} pair="burgundy" pattern="zacken"
                  onPress={() => router.push('/meine')} />
              </View>
            </>
          )} />
      )}
    </AppScreen>
  );
}
