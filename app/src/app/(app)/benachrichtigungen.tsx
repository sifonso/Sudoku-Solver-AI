import { BellOff } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMarkRead, useNotifications } from '../../data/hooks';
import { AppScreen } from '../../features/AppScreen';
import { Badge, Banner, Button, Card, EmptyState, Skeleton, Text } from '../../ui';
import { useTheme } from '../../theme';

const ago = (iso: string) => {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} h`;
  return `vor ${Math.round(h / 24)} Tagen`;
};

/** S25 Benachrichtigungen. Beim Öffnen gelten alle sichtbaren als gelesen. */
export default function NotificationsScreen() {
  const { c } = useTheme();
  const list = useNotifications();
  const markRead = useMarkRead();
  const unreadIds = (list.data ?? []).filter((n) => !n.readAt).map((n) => n.id);
  const key = unreadIds.join(',');

  useEffect(() => {
    if (unreadIds.length) {
      const t = setTimeout(() => markRead.mutate(unreadIds), 1500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <AppScreen title="Mitteilungen" back onRefresh={() => list.refetch()} refreshing={list.isRefetching}>
      {list.isLoading ? (
        <View style={styles.list}>{[0, 1, 2].map((i) => <Skeleton key={i} height={72} />)}</View>
      ) : list.isError ? (
        <Banner tone="danger" title="Mitteilungen konnten nicht geladen werden"
          action={<Button label="Erneut" size="sm" variant="secondary" onPress={() => list.refetch()} />} />
      ) : list.data!.length === 0 ? (
        <Card>
          <EmptyState icon={BellOff} title="Keine Mitteilungen"
            body="Hier landen neue Schichten, Änderungen und Antworten auf deine Anträge." />
        </Card>
      ) : (
        <Card style={styles.card}>
          {list.data!.map((n, i) => (
            <View key={n.id} style={[styles.row, i > 0 && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth }]}
              accessible accessibilityLabel={`${n.readAt ? '' : 'Neu: '}${n.title}. ${n.body ?? ''}. ${ago(n.createdAt)}`}>
              <View style={styles.rowHead}>
                <Text variant="base" style={styles.title}>{n.title}</Text>
                {!n.readAt ? <Badge label="Neu" tone="highlight" /> : null}
              </View>
              {n.body ? <Text variant="sm">{n.body}</Text> : null}
              <Text variant="xs" color="textMuted">{ago(n.createdAt)}</Text>
            </View>
          ))}
        </Card>
      )}
      <Text variant="xs" color="textMuted">
        Push auf das Telefon kommt mit dem Backend. Bis dahin erscheinen Mitteilungen hier und an der Glocke.
      </Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  card: { padding: 0 },
  row: { padding: 16, gap: 4 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontFamily: 'Inter_600SemiBold' },
});
