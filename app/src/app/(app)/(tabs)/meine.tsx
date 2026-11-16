import { router } from 'expo-router';
import { CalendarCheck, Palmtree, Stethoscope, Thermometer } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useCompletions, useMembers, useMyShifts, useNotifications, useTaskMutations, useTasks } from '../../../data/hooks';
import { tasksForShift } from '../../../domain/tasks';
import { useActive } from '../../../data/session';
import { addDays, formatDate, hoursBetween, localTime, today, weekdayLong } from '../../../domain/time';
import { AppScreen } from '../../../features/AppScreen';
import { Badge, Banner, Button, Card, Checkbox, EmptyState, Skeleton, Text } from '../../../ui';
import { errorText } from '../../../features/errors';

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
  const tasks = useTasks();
  const completions = useCompletions((shifts.data ?? []).map((x) => x.shift.id));
  const members = useMembers();
  const taskOps = useTaskMutations();
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

      {taskOps.complete.isError || taskOps.uncomplete.isError ? (
        <Banner tone="danger" title={errorText(taskOps.complete.error ?? taskOps.uncomplete.error)} />
      ) : null}
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
              <Card key={assignment.id} style={styles.item}>
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
                {(() => {
                  const list = tasksForShift(tasks.data ?? [], shift, [assignment]);
                  if (!list.length) return null;
                  const done = (completions.data ?? []).filter((c) => c.shiftId === shift.id);
                  return (
                    <View style={styles.tasks}>
                      <Text variant="label" color="textMuted">Aufgaben · {done.filter((c) => list.some((t) => t.id === c.taskId)).length}/{list.length}</Text>
                      {list.map((t) => {
                        const c = done.find((x) => x.taskId === t.id);
                        const byOther = c && c.memberId !== member.id;
                        const otherName = byOther ? members.data?.find((m) => m.id === c!.memberId)?.displayName : null;
                        return (
                          <View key={t.id}>
                            <Checkbox
                              label={t.kind === 'special' ? `${t.title} (nur für dich)` : t.title}
                              checked={!!c}
                              disabled={!!byOther || taskOps.complete.isPending || taskOps.uncomplete.isPending}
                              onChange={(v) => (v
                                ? taskOps.complete.mutate({ taskId: t.id, shiftId: shift.id })
                                : c && taskOps.uncomplete.mutate(c.id))}
                            />
                            {byOther ? <Text variant="xs" color="textMuted">Erledigt von {otherName ?? 'Kollegin/Kollege'}</Text> : null}
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}
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

      <View style={styles.quick}>
        <Button label="Krank melden" variant="secondary" icon={Stethoscope} onPress={() => router.push('/krankmelden')} />
        <Button label="Urlaub beantragen" variant="secondary" icon={Palmtree} onPress={() => router.push('/urlaub-beantragen')} />
        <Button label="Schnellaktionen" variant="secondary" icon={Thermometer} onPress={() => router.push('/schnell')} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  list: { gap: 12 },
  item: { gap: 6 },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tasks: { gap: 2, paddingTop: 4 },
});
