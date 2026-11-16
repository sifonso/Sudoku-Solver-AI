import { Redirect, router } from 'expo-router';
import { HeartPulse, UserPlus } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { canPlan } from '../../data/api';
import { useAbsences, useMembers, usePlan } from '../../data/hooks';
import { useActive } from '../../data/session';
import { addDays, formatRange, localTime, today, weekdayShort } from '../../domain/time';
import { AppScreen } from '../../features/AppScreen';
import { Avatar, Button, Card, EmptyState, ListRow, Skeleton, Text } from '../../ui';

/** S09 Krankmeldungen (Planer): aktuelle und kommende, mit betroffenen Schichten und Ersatzsuche. */
export default function SickAdminScreen() {
  const { member } = useActive();
  if (!canPlan(member.role)) return <Redirect href="/krankmelden" />;
  return <SickAdmin />;
}

function SickAdmin() {
  const { tenant } = useActive();
  const now = today(tenant.timezone);
  const absences = useAbsences(now, addDays(now, 60));
  const members = useMembers();
  const plan = usePlan(now, addDays(now, 60));
  const byId = useMemo(() => new Map((members.data ?? []).map((m) => [m.id, m])), [members.data]);
  const sick = (absences.data ?? []).filter((a) => a.kind === 'sick' && a.status === 'approved')
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <AppScreen title="Krankmeldungen" eyebrow="Team" back onRefresh={() => absences.refetch()} refreshing={absences.isRefetching}>
      {absences.isLoading || members.isLoading || plan.isLoading ? (
        <Skeleton height={120} />
      ) : sick.length === 0 ? (
        <Card><EmptyState icon={HeartPulse} title="Niemand krank gemeldet" body="Krankmeldungen ab heute erscheinen hier mit den Schichten, die neu besetzt werden müssen." /></Card>
      ) : (
        sick.map((a) => {
          const m = byId.get(a.memberId);
          if (!m) return null;
          const hits = (plan.data ?? []).filter((s) => s.date >= a.startDate && s.date <= a.endDate && s.assignments.some((x) => x.memberId === a.memberId));
          return (
            <Card key={a.id} style={styles.card}>
              <ListRow title={m.displayName} subtitle={`Krank ${formatRange(a.startDate, a.endDate)}`}
                leading={<Avatar initials={m.initials} employment={m.employmentType} />} />
              {hits.length === 0 ? (
                <Text variant="sm" color="textMuted">Keine Schichten betroffen.</Text>
              ) : (
                hits.map((s) => (
                  <View key={`${s.shiftType.id}-${s.date}`} style={styles.hit}>
                    <View style={{ flex: 1 }}>
                      <Text variant="base">{s.shiftType.name} · {weekdayShort(s.date)} {s.date.slice(8)}.{s.date.slice(5, 7)}.</Text>
                      <Text variant="sm" color="textMuted">
                        {localTime(s.startAt, tenant.timezone)}–{localTime(s.endAt, tenant.timezone)} · {s.assignments.length - 1}/{s.shift?.minStaff ?? s.shiftType.minStaff} ohne {m.displayName.split(' ')[0]}
                      </Text>
                    </View>
                    <Button label="Ersatz finden" icon={UserPlus} size="sm" variant="secondary"
                      onPress={() => router.push({ pathname: '/zuweisen', params: { type: s.shiftType.id, date: s.date } })} />
                  </View>
                ))
              )}
              <Text variant="xs" color="textMuted">
                Die Zuweisung bleibt bestehen, bis du sie im Plan entfernst. Beim Zuweisen ist {m.displayName.split(' ')[0]} als abwesend markiert.
              </Text>
            </Card>
          );
        })
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  hit: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
});
