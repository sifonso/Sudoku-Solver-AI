import { Redirect, useLocalSearchParams } from 'expo-router';
import { CalendarX } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { canPlan } from '../../../data/api';
import { useAbsences, useMember, usePlan } from '../../../data/hooks';
import { useActive } from '../../../data/session';
import { addDays, formatDate, formatRange, hoursBetween, localTime, today, weekdayShort } from '../../../domain/time';
import { AppScreen } from '../../../features/AppScreen';
import { Avatar, Card, EmptyState, ListRow, SectionHeader, Skeleton, Text } from '../../../ui';
import { monthLabel, shiftMonth } from '../../../features/month';

/** S12 Statistik-Detail: Schichten und Abwesenheiten einer Person im Monat. */
export default function StatsDetailScreen() {
  const { member } = useActive();
  if (!canPlan(member.role)) return <Redirect href="/meine" />;
  return <StatsDetail />;
}

function StatsDetail() {
  const { id, month: monthParam } = useLocalSearchParams<{ id: string; month?: string }>();
  const { tenant } = useActive();
  const tz = tenant.timezone;
  const month = monthParam ?? `${today(tz).slice(0, 7)}-01`;
  const last = addDays(shiftMonth(month, 1), -1);
  const m = useMember(id ?? '');
  const plan = usePlan(month, last);
  const absences = useAbsences(month, last);
  const shifts = (plan.data ?? []).flatMap((s) => s.assignments.filter((a) => a.memberId === id).map((a) => ({ s, a })));
  const hours = shifts.reduce((h, x) => h + hoursBetween(x.a.startAt, x.a.endAt), 0);
  const mine = (absences.data ?? []).filter((a) => a.memberId === id && a.status === 'approved');

  return (
    <AppScreen title={m.data?.displayName ?? 'Statistik'} eyebrow={monthLabel(month)} back>
      {m.isLoading || plan.isLoading ? <Skeleton height={200} /> : (
        <>
          {m.data ? (
            <Card style={styles.head}>
              <Avatar initials={m.data.initials} employment={m.data.employmentType} size={48} />
              <View style={{ flex: 1 }}>
                <Text variant="xl">{shifts.length} Schichten · {String(Math.round(hours * 10) / 10).replace('.', ',')} h</Text>
                {m.data.monthlyHoursLimit != null ? (
                  <Text variant="sm" color={hours > m.data.monthlyHoursLimit ? 'onHighlightSoft' : 'textMuted'}>
                    Grenze {m.data.monthlyHoursLimit} h{hours > m.data.monthlyHoursLimit ? ' · überschritten' : ''}
                  </Text>
                ) : null}
              </View>
            </Card>
          ) : null}
          <SectionHeader title="Schichten" count={shifts.length} />
          {shifts.length === 0 ? (
            <Card><EmptyState icon={CalendarX} title="Keine Schichten" body="In diesem Monat war diese Person nicht eingeteilt." /></Card>
          ) : (
            <Card style={styles.list}>
              {shifts.map(({ s, a }) => (
                <ListRow key={a.id} title={`${weekdayShort(s.date)} ${formatDate(s.date)} · ${s.shiftType.name}`}
                  subtitle={`${localTime(a.startAt, tz)}–${localTime(a.endAt, tz)} · ${String(Math.round(hoursBetween(a.startAt, a.endAt) * 10) / 10).replace('.', ',')} h`} />
              ))}
            </Card>
          )}
          {mine.length ? (
            <>
              <SectionHeader title="Abwesenheiten" count={mine.length} />
              <Card style={styles.list}>
                {mine.map((a) => (
                  <ListRow key={a.id} title={a.kind === 'sick' ? 'Krank' : 'Urlaub'} subtitle={formatRange(a.startDate, a.endDate)} />
                ))}
              </Card>
            </>
          ) : null}
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  list: { paddingVertical: 0 },
});
