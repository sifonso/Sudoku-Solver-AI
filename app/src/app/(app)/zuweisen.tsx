import { router, useLocalSearchParams } from 'expo-router';
import { Check, Users, X } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '../../data/api';
import { useAssign, useCandidates, useShiftTypes } from '../../data/hooks';
import { useActive } from '../../data/session';
import { warningText } from '../../domain/rules';
import { formatDate, localTime, weekdayLong } from '../../domain/time';
import { tokens, useTheme } from '../../theme';
import { Avatar, Badge, Banner, Button, EmptyState, IconButton, ListRow, Skeleton, Text, employmentLabel } from '../../ui';

/** S05 Mitarbeiter zuweisen. Sortiert: ohne Warnung zuerst. Warnungen blockieren nicht, Doppelbuchung schon. */
export default function AssignScreen() {
  const { type, date } = useLocalSearchParams<{ type: string; date: string }>();
  const { tenant } = useActive();
  const { c } = useTheme();
  const types = useShiftTypes();
  const cand = useCandidates(type ?? '', date ?? '');
  const assign = useAssign();
  const [pending, setPending] = useState<string | null>(null);
  const shiftType = types.data?.find((t) => t.id === type);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/plan'));

  const failure =
    assign.error instanceof ApiError && assign.error.code === 'no_double_booking'
      ? 'Diese Person ist zu der Zeit schon eingeteilt.'
      : assign.error ? 'Zuweisen fehlgeschlagen. Bitte noch einmal versuchen.' : null;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={[styles.bar, { borderBottomColor: c.border }]}>
        <View style={styles.titles}>
          <Text variant="label" color="onHighlightSoft">Zuweisen</Text>
          <Text variant="lg" accessibilityRole="header" numberOfLines={1}>
            {shiftType?.name ?? 'Schicht'} · {date ? `${weekdayLong(date)}, ${formatDate(date)}` : ''}
          </Text>
          {cand.data ? (
            <Text variant="sm" color="textMuted">
              {localTime(cand.data.shift.startAt, tenant.timezone)} – {localTime(cand.data.shift.endAt, tenant.timezone)}
            </Text>
          ) : null}
        </View>
        <IconButton icon={X} label="Schließen" onPress={close} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { maxWidth: 640 }]}>
        {failure ? <Banner tone="danger" title={failure} /> : null}
        {!type || !date ? (
          <EmptyState icon={Users} title="Keine Schicht gewählt" body="Öffne die Zuweisung über den Plan." />
        ) : cand.isLoading ? (
          <View style={{ gap: 12 }}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={64} />)}
          </View>
        ) : cand.isError ? (
          <Banner tone="danger" title="Liste konnte nicht geladen werden"
            action={<Button label="Erneut" size="sm" variant="secondary" onPress={() => cand.refetch()} />} />
        ) : cand.data && cand.data.rows.length === 0 ? (
          <EmptyState icon={Users} title="Noch kein Team" body="Lade zuerst Mitarbeiter ein, dann kannst du sie Schichten zuweisen." />
        ) : (
          cand.data?.rows.map(({ member, warnings, assigned }) => {
            const blocked = warnings.some((w) => w.code === 'overlap');
            return (
              <ListRow
                key={member.id}
                title={member.displayName}
                subtitle={assigned ? 'Schon in dieser Schicht' : warnings.length ? warnings.map(warningText).join(' · ') : `${employmentLabel[member.employmentType]} · passt`}
                leading={<Avatar initials={member.initials} employment={member.employmentType} />}
                trailing={
                  assigned ? (
                    <Badge label="eingeteilt" tone="accent" />
                  ) : pending === member.id ? (
                    <Button label="…" size="sm" loading />
                  ) : warnings.length ? (
                    <Badge label={blocked ? 'belegt' : `${warnings.length} Hinweis${warnings.length > 1 ? 'e' : ''}`} tone={blocked ? 'danger' : 'highlight'} />
                  ) : (
                    <Check size={20} color={c.success} accessibilityLabel="passt" />
                  )
                }
                onPress={assigned ? undefined : () => {
                  if (!cand.data || pending) return;
                  setPending(member.id);
                  assign.mutate(
                    { shiftId: cand.data.shift.id, memberId: member.id },
                    { onSuccess: close, onSettled: () => setPending(null) },
                  );
                }}
              />
            );
          })
        )}
        <Text variant="xs" color="textMuted">
          Hinweise halten dich nicht auf: Du kannst trotzdem zuweisen. Nur wer zur selben Zeit schon eingeteilt ist, geht nicht.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, paddingLeft: 16, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: tokens.size.header },
  titles: { flex: 1, gap: 2 },
  content: { padding: 16, gap: 8, width: '100%', alignSelf: 'center' },
});
