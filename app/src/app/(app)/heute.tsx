import { Sun } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMembers, usePlan } from '../../data/hooks';
import { useActive } from '../../data/session';
import { formatDate, localTime, today, weekdayLong } from '../../domain/time';
import { AppScreen } from '../../features/AppScreen';
import { Avatar, Card, EmptyState, Skeleton, Text } from '../../ui';

/** S20 Heute im Dienst: alle Schichten von heute mit Besetzung (sofern der Betrieb den Gesamtplan zeigt). */
export default function TodayScreen() {
  const { tenant } = useActive();
  const tz = tenant.timezone;
  const d = today(tz);
  const plan = usePlan(d, d);
  const members = useMembers();
  const byId = useMemo(() => new Map((members.data ?? []).map((m) => [m.id, m])), [members.data]);
  const slots = (plan.data ?? []).filter((s) => s.assignments.length > 0 || s.shift);

  return (
    <AppScreen title="Heute im Dienst" eyebrow={`${weekdayLong(d)}, ${formatDate(d)}`} back onRefresh={() => plan.refetch()} refreshing={plan.isRefetching}>
      {plan.isLoading || members.isLoading ? <Skeleton height={160} /> : slots.length === 0 ? (
        <Card><EmptyState icon={Sun} title="Heute ist niemand eingeplant" body="Sobald Schichten für heute besetzt sind, stehen sie hier." /></Card>
      ) : (
        slots.map((s) => (
          <Card key={s.shiftType.id} style={styles.card}>
            <Text variant="lg">{s.shiftType.name}</Text>
            <Text variant="sm" color="textMuted">{localTime(s.startAt, tz)} – {localTime(s.endAt, tz)}</Text>
            {s.assignments.length === 0 ? <Text variant="sm" color="textMuted">Noch niemand eingeteilt.</Text> : (
              <View style={styles.people}>
                {s.assignments.map((a) => {
                  const m = byId.get(a.memberId);
                  return m ? (
                    <View key={a.id} style={styles.person}>
                      <Avatar initials={m.initials} employment={m.employmentType} size={36} />
                      <Text variant="base">{m.displayName}</Text>
                    </View>
                  ) : null;
                })}
              </View>
            )}
          </Card>
        ))
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 6 },
  people: { gap: 8, paddingTop: 4 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
