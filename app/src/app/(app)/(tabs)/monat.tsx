import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useActive } from '../../../data/session';
import { EntryEditor } from '../../../dienstplan/EntryEditor';
import { MonthGrid } from '../../../dienstplan/MonthGrid';
import { canLead, useDp, useDpEntries, useMe } from '../../../dienstplan/hooks';
import { DAY_COLORS, MONTHS, monthDays, type Cell, type Staff } from '../../../dienstplan/model';
import { CodeBadge } from '../../../dienstplan/ui';
import { AppScreen } from '../../../features/AppScreen';
import { Banner, IconButton, SegmentedControl, Skeleton, Text } from '../../../ui';

/** Hauptansicht: Monatsplan aller Personen mit Besetzung je Arbeitsplatz und Schicht. */
export default function MonthScreen() {
  const { member } = useActive();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [mode, setMode] = useState<'fein' | 'rhythmus'>('fein');
  const [sel, setSel] = useState<{ staff: Staff; date: string; cell: Cell } | null>(null);
  const days = useMemo(() => monthDays(ym.y, ym.m), [ym]);
  const dp = useDp();
  const entries = useDpEntries(days[0] ?? '', days[days.length - 1] ?? '');
  const me = useMe();
  const lead = canLead(member.role);
  const step = (n: number) => setYm(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));

  return (
    <AppScreen title={`${MONTHS[ym.m]} ${ym.y}`} eyebrow="Dienstplan"
      onRefresh={() => { dp.refetch(); entries.refetch(); }} refreshing={entries.isRefetching}
      actions={<>
        <IconButton icon={ChevronLeft} label="Voriger Monat" tone="soft" onPress={() => step(-1)} />
        <IconButton icon={ChevronRight} label="Nächster Monat" tone="soft" onPress={() => step(1)} />
      </>}>
      <View style={styles.bar}>
        <SegmentedControl label="Ansicht" value={mode} onChange={setMode}
          options={[{ value: 'fein', label: 'Feinplan' }, { value: 'rhythmus', label: 'Rhythmus' }]} />
        <Text variant="xs" color="textMuted" style={{ flex: 1, minWidth: 200 }}>
          {mode === 'fein'
            ? 'Graue Kürzel kommen aus dem Grundrhythmus und haben noch keinen Arbeitsplatz.'
            : 'Nur der 16-Wochen-Grundrhythmus, ohne Feinplanung.'}
        </Text>
      </View>
      {dp.isError || entries.isError ? <Banner tone="danger" title="Plan konnte nicht geladen werden" body="Zum Aktualisieren nach unten ziehen." /> : null}
      {!dp.data || entries.isLoading ? (
        <Skeleton height={420} />
      ) : (
        <MonthGrid days={days} staff={dp.data.staff} entries={entries.map} settings={dp.data.settings} mode={mode}
          meId={me?.id ?? null} onCell={(staff, date, cell) => setSel({ staff, date, cell })} />
      )}
      {dp.data ? (
        <View style={styles.legend}>
          {dp.data.settings.codes.map((k) => (
            <View key={k.code} style={styles.legendItem}>
              <CodeBadge code={k.code} settings={dp.data.settings} size="sm" />
              <Text variant="xs" color="textMuted">{k.label}</Text>
            </View>
          ))}
          <View style={styles.legendItem}>
            <View style={styles.dot} />
            <Text variant="xs" color="textMuted">FLEX</Text>
          </View>
        </View>
      ) : null}
      {dp.data ? (
        <EntryEditor open={!!sel} staff={sel?.staff ?? null} date={sel?.date ?? null} cell={sel?.cell ?? null}
          settings={dp.data.settings} canEdit={lead} isMe={!!me && sel?.staff.id === me.id} onClose={() => setSel(null)} />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: DAY_COLORS.flexText },
});
