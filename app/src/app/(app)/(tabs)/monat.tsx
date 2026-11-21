import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Wand2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { EntryEditor } from '../../../dienstplan/EntryEditor';
import { MonthGrid } from '../../../dienstplan/MonthGrid';
import { useActor, useComments, useDp, useDpEntries, useMe } from '../../../dienstplan/hooks';
import { SwapComposer } from '../../../dienstplan/SwapComposer';
import { DAY_COLORS, MONTHS, byIdOf, cellFor, isWork, monthDays, type Cell, type Staff } from '../../../dienstplan/model';
import { CodeBadge } from '../../../dienstplan/ui';
import { ExportMenu } from '../../../dienstplan/ExportMenu';
import { monthSheet } from '../../../dienstplan/export';
import { AppScreen } from '../../../features/AppScreen';
import { Banner, Button, IconButton, SegmentedControl, Skeleton, Text } from '../../../ui';

/** Hauptansicht: Monatsplan aller Personen mit Besetzung je Arbeitsplatz und Schicht. */
export default function MonthScreen() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [mode, setMode] = useState<'fein' | 'rhythmus'>('fein');
  const [sel, setSel] = useState<{ staff: Staff; date: string; cell: Cell } | null>(null);
  const days = useMemo(() => monthDays(ym.y, ym.m), [ym]);
  const dp = useDp();
  const entries = useDpEntries(days[0] ?? '', days[days.length - 1] ?? '');
  const comments = useComments(days[0] ?? '', days[days.length - 1] ?? '');
  const [swap, setSwap] = useState<{ staffId: string | null; date: string | null }[] | null>(null);
  const me = useMe();
  const lead = useActor().isLead;
  const cellForMe = (st: Staff, date: string) => {
    if (!dp.data) return null;
    const code = cellFor(st, date, entries.map, dp.data.settings, 'fein', byIdOf(dp.data.staff)).code;
    return isWork(code, dp.data.settings) ? date : null;
  };
  const step = (n: number) => setYm(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));

  return (
    <AppScreen wide title={`${MONTHS[ym.m]} ${ym.y}`} eyebrow="Dienstplan"
      onRefresh={() => { dp.refetch(); entries.refetch(); comments.refetch(); }} refreshing={entries.isRefetching}
      actions={<>
        <IconButton icon={ChevronLeft} label="Voriger Monat" tone="soft" onPress={() => step(-1)} />
        <IconButton icon={ChevronRight} label="Nächster Monat" tone="soft" onPress={() => step(1)} />
        <ExportMenu label="Monat exportieren" fileBase={`Dienstplan_${ym.y}-${String(ym.m + 1).padStart(2, '0')}`}
          sheets={() => (dp.data ? [monthSheet(ym.y, ym.m, dp.data.staff, entries.map, dp.data.settings)] : null)} />
      </>}>
      {lead ? (
        <View style={styles.bar}>
          <Button label="Autodisposition" icon={Wand2} size="sm" variant="secondary" onPress={() => router.push('/autodispo')} />
          <Button label="Regelwerk" size="sm" variant="ghost" onPress={() => router.push('/regelwerk')} />
        </View>
      ) : null}
      <View style={styles.bar}>
        <SegmentedControl label="Ansicht" value={mode} onChange={setMode}
          options={[{ value: 'fein', label: 'Feinplan' }, { value: 'rhythmus', label: 'Rhythmus' }]} />
        <Text variant="xs" color="textMuted" style={{ flex: 1, minWidth: 200 }}>
          {mode === 'fein'
            ? 'Graue Kürzel: Grundturnus ohne Arbeitsplatz. Grün unterstrichen: vorübergehender Turnus. Ecke oben links: Kommentar.'
            : 'Nur der 16-Wochen-Grundrhythmus, ohne Feinplanung.'}
        </Text>
      </View>
      {dp.isError || entries.isError ? <Banner tone="danger" title="Plan konnte nicht geladen werden" body="Zum Aktualisieren nach unten ziehen." /> : null}
      {!dp.data || entries.isLoading ? (
        <Skeleton height={420} />
      ) : (
        <MonthGrid days={days} staff={dp.data.staff} entries={entries.map} comments={comments.map} settings={dp.data.settings} mode={mode}
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
          settings={dp.data.settings} canEdit={lead} isMe={!!me && sel?.staff.id === me.id}
          comments={sel ? comments.map.get(`${sel.staff.id}|${sel.date}`) ?? [] : []} onClose={() => setSel(null)}
          onSwap={sel && isWork(sel.cell.code, dp.data.settings) && (lead || me) ? () => {
            const s0 = sel;
            setSel(null);
            if (lead && !me?.inPlan) setSwap([{ staffId: s0.staff.id, date: s0.date }, { staffId: null, date: null }]);
            else if (me && s0.staff.id === me.id) setSwap([{ staffId: me.id, date: s0.date }, { staffId: null, date: null }]);
            else if (me) {
              // Eigener Dienst am selben Tag als Gegendienst vorschlagen, sonst nur Übernahme
              const mine = entries.map && dp.data ? cellForMe(me, s0.date) : null;
              setSwap([{ staffId: me.id, date: mine }, { staffId: s0.staff.id, date: s0.date }]);
            }
          } : undefined} />
      ) : null}
      {dp.data ? (
        <SwapComposer open={!!swap} initial={swap ?? []} onClose={() => setSwap(null)} />
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
