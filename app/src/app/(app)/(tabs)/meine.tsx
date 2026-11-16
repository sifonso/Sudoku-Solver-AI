import { router } from 'expo-router';
import { CalendarCheck, Thermometer } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useMyShifts, useNotifications } from '../../../data/hooks';
import { useActive } from '../../../data/session';
import { addDays, formatDate, hoursBetween, localTime, today, weekdayLong } from '../../../domain/time';
import { AppScreen } from '../../../features/AppScreen';
import { Badge, Banner, Button, Card, EmptyState, Skeleton, Text } from '../../../ui';

const RANGE_DAYS = 14;

/** S21 Meine Schichten: die nächsten 14 Tage, Kollegen pro Schicht. */
export default function MyShiftsScreen() {
  const { tenant, member } = useActive();
  const tz = tenant.timezone;
  const from = today(tz);
  const to = addDays(from, RANGE_DAYS - 1);
  const shifts = useMyShifts(from, to);
  const notifications = useNotifications();
  const unread = notifications.data?.filter((n) => !n.readAt) ?? [];
  const hours = (shifts.data ?? []).reduce((s, x) => s + hoursBetween(x.assignment.startAt, x.assignment.endAt), 0);

  return (
    <AppScreen
      title={`Hallo ${member.displayName.split(' ')[0]}`}
      eyebrow={tenant.name}
      onRefresh={() => shifts.refetch()}
      refreshing={shifts.isRefetching}
    >
      {unread.length > 0 ? (
        <Banner tone="info" title={unread.length === 1 ? unread[0]!.title : `${unread.length} neue Mitteilungen`}
          body={unread.length === 1 ? unread[0]!.body ?? undefined : 'Zum Beispiel neue oder geänderte Schichten.'}
          action={<Button label="Ansehen" size="sm" variant="secondary" onPress={() => router.push('/benachrichtigungen')} />} />
      ) : null}

      <View style={styles.head}>
        <Text variant="label" color="textMuted">Nächste {RANGE_DAYS} Tage</Text>
        {shifts.data ? <Text variant="sm" color="textMuted">{shifts.data.length} Schichten · {Math.round(hours * 10) / 10} h</Text> : null}
      </View>

      {shifts.isLoading ? (
        <View style={styles.list}>{[0, 1, 2].map((i) => <Skeleton key={i} height={96} radius={12} />)}</View>
      ) : shifts.isError ? (
        <Banner tone="danger" title="Schichten konnten nicht geladen werden"
          action={<Button label="Erneut" size="sm" variant="secondary" onPress={() => shifts.refetch()} />} />
      ) : shifts.data!.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarCheck} title="Keine Schichten geplant"
            body="Sobald du eingeteilt wirst, erscheint die Schicht hier und du bekommst eine Mitteilung." />
        </Card>
      ) : (
        <View style={styles.list}>
          {shifts.data!.map(({ assignment, shift, shiftType, colleagues }) => {
            const isToday = shift.date === from;
            return (
              <Card key={assignment.id} style={styles.item} accessible
                accessibilityLabel={`${weekdayLong(shift.date)} ${formatDate(shift.date)}, ${shiftType?.name ?? shift.name}, ${localTime(assignment.startAt, tz)} bis ${localTime(assignment.endAt, tz)}`}>
                <View style={styles.itemHead}>
                  <View style={{ flex: 1 }}>
                    <Text variant="label" color={isToday ? 'onHighlightSoft' : 'textMuted'}>
                      {isToday ? 'Heute' : weekdayLong(shift.date)} · {formatDate(shift.date)}
                    </Text>
                    <Text variant="lg">{shiftType?.name ?? shift.name}</Text>
                  </View>
                  {isToday ? <Badge label="Heute" tone="highlight" /> : null}
                </View>
                <Text variant="base">{localTime(assignment.startAt, tz)} – {localTime(assignment.endAt, tz)} · {Math.round(hoursBetween(assignment.startAt, assignment.endAt) * 10) / 10} h</Text>
                {colleagues.length ? (
                  <Text variant="sm" color="textMuted">Mit {colleagues.map((m) => m.displayName).join(', ')}</Text>
                ) : (
                  <Text variant="sm" color="textMuted">Allein eingeteilt</Text>
                )}
              </Card>
            );
          })}
        </View>
      )}

      <Button label="Schnellaktionen öffnen" variant="secondary" icon={Thermometer} onPress={() => router.push('/schnell')} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  list: { gap: 12 },
  item: { gap: 6 },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
