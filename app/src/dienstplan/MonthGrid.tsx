// Monatsplan wie im Excel-Blatt: Zeilen = Personen, Spalten = Tage, darunter die Besetzungszähler.
import { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { Text } from '../ui';
import {
  COUNTER_ROWS, DAY_COLORS, WEEKDAYS, cellColors, cellFor, dayCounters, holidayOf, iso, weekday,
  type Cell, type DpSettings, type Entry, type Staff,
} from './model';

const NAME_W = 118;
const CELL_W = 46;
const ROW_H = 32;

type Props = {
  days: string[];
  staff: Staff[];
  entries: Map<string, Entry>;
  settings: DpSettings;
  mode: 'fein' | 'rhythmus';
  meId: string | null;
  onCell: (s: Staff, date: string, cell: Cell) => void;
};

export function MonthGrid({ days, staff, entries, settings, mode, meId, onCell }: Props) {
  const { c, scheme } = useTheme();
  const today = iso(new Date());
  const rows = staff.filter((s) => s.inPlan);
  const counters = useMemo(() => days.map((d) => dayCounters(d, rows, entries, settings)), [days, rows, entries, settings]);
  const minKeys = Object.keys(settings.minStaffing);
  const counterKeys = [...minKeys, 'Schichtstärke', ...COUNTER_ROWS];
  const dayBg = (d: string) => (holidayOf(d) ? DAY_COLORS.holiday : weekday(d) === 0 ? DAY_COLORS.sunday : null);
  const dark = scheme === 'dark';

  const header = (
    <>
      <View style={styles.row}>
        {days.map((d) => {
          const sat = weekday(d) === 6;
          const bg = d === today ? DAY_COLORS.today : sat ? DAY_COLORS.saturdayHead.bg : dayBg(d) ?? c.surface;
          const fg = d === today || sat ? '#FFFFFF' : bg === c.surface ? c.text : '#404040';
          return (
            <View key={d} style={[styles.head, { backgroundColor: bg, borderColor: c.border }]}>
              <Text variant="xs" style={{ color: fg }}>{WEEKDAYS[weekday(d)]}</Text>
              <Text variant="sm" style={[styles.bold, { color: fg }]}>{Number(d.slice(8))}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.row}>
        {days.map((d) => (
          <View key={d} style={[styles.hol, { backgroundColor: dayBg(d) ?? c.surface, borderColor: c.border }]}>
            <Text variant="xs" numberOfLines={1} style={[styles.tiny, { color: dayBg(d) ? '#404040' : c.textMuted }]}>{holidayOf(d) ?? ''}</Text>
          </View>
        ))}
      </View>
    </>
  );

  return (
    <View style={[styles.wrap, { borderColor: c.border }]}>
      <View style={{ width: NAME_W }}>
        <View style={[styles.nameHead, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text variant="label" color="textMuted">Nr. · Name</Text>
        </View>
        <View style={[styles.nameHol, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text variant="xs" color="textMuted">Feiertag</Text>
        </View>
        {rows.map((s) => (
          <View key={s.id} style={[styles.name, { borderColor: c.border, backgroundColor: s.id === meId ? c.highlightSoft : c.bg }]}>
            <Text variant="xs" color="textMuted" style={styles.nr}>{s.nr}</Text>
            <Text variant="sm" numberOfLines={1} style={[{ flex: 1 }, s.id === meId && styles.bold, { color: s.id === meId ? c.onHighlightSoft : c.text }]}>{s.short}</Text>
          </View>
        ))}
        <View style={[styles.sep, { backgroundColor: c.surface, borderColor: c.border }]}><Text variant="label" color="textMuted">Besetzung</Text></View>
        {counterKeys.map((k) => (
          <View key={k} style={[styles.name, styles.counterName, { borderColor: c.border, backgroundColor: k === 'Schichtstärke' ? c.accentSoft : c.surface }]}>
            <Text variant="xs" numberOfLines={1} style={[styles.bold, { color: k === 'Schichtstärke' ? c.onAccentSoft : c.text }]}>{k}</Text>
          </View>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator style={{ flex: 1 }}>
        <View>
          {header}
          {rows.map((s) => (
            <View key={s.id} style={styles.row}>
              {days.map((d) => (
                <GridCell key={d} staff={s} date={d} entries={entries} settings={settings} mode={mode}
                  colBg={dayBg(d)} today={d === today} border={c.border} text={c.text} muted={c.textMuted} dark={dark} onCell={onCell} />
              ))}
            </View>
          ))}
          <View style={[styles.row, styles.sepRow, { backgroundColor: c.surface, borderColor: c.border }]} />
          {counterKeys.map((k) => (
            <View key={k} style={styles.row}>
              {days.map((d, i) => {
                const v = counters[i]?.[k] ?? 0;
                const min = settings.minStaffing[k];
                const under = k === 'Verfügbar' ? v > (min ?? 0) : min != null && v < min;
                const counted = COUNTER_ROWS.includes(k) && v > 0;
                const st = under ? DAY_COLORS.under : counted ? DAY_COLORS.counted : null;
                return (
                  <View key={d} style={[styles.count, { borderColor: c.border, backgroundColor: st?.bg ?? (k === 'Schichtstärke' ? c.accentSoft : c.bg) }]}
                    accessibilityLabel={`${k} am ${Number(d.slice(8))}.: ${v}${under ? ', zu wenig' : ''}`}>
                    <Text variant="xs" style={[st && styles.bold, { color: st?.fg ?? (v === 0 ? c.textMuted : c.text) }]}>{v}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const GridCell = memo(function GridCell({ staff, date, entries, settings, mode, colBg, today, border, text, muted, dark, onCell }: {
  staff: Staff; date: string; entries: Map<string, Entry>; settings: DpSettings; mode: 'fein' | 'rhythmus';
  colBg: string | null; today: boolean; border: string; text: string; muted: string; dark: boolean;
  onCell: Props['onCell'];
}) {
  const cell = cellFor(staff, date, entries, settings, mode);
  const col = cell.code ? cellColors(cell.code, settings) : null;
  const ghost = cell.fromRhythm && mode === 'fein';
  const bg = col?.bg ?? (colBg && !dark ? colBg : 'transparent');
  const fg = cell.flex ? DAY_COLORS.flexText : col?.fg ?? (ghost ? muted : colBg && !dark ? '#262626' : text);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${staff.short}, ${Number(date.slice(8))}.: ${cell.code || 'frei'}${ghost && cell.code ? ' laut Rhythmus' : ''}${cell.flex ? ', FLEX' : ''}`}
      onPress={() => onCell(staff, date, cell)}
      style={({ pressed }) => [styles.cell, { borderColor: border, backgroundColor: bg, opacity: pressed ? 0.6 : 1 },
        today && styles.todayCell]}
    >
      <Text variant="xs" numberOfLines={1} style={[styles.code, { color: fg }, ghost && styles.ghost, cell.flex && styles.bold]}>
        {cell.code}
      </Text>
      {cell.flex ? <View style={styles.flex} /> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, overflow: 'hidden' },
  row: { flexDirection: 'row' },
  head: { width: CELL_W, height: 40, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  hol: { width: CELL_W, height: 20, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 1 },
  nameHead: { height: 40, justifyContent: 'center', paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth },
  nameHol: { height: 20, justifyContent: 'center', paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth },
  name: { height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth },
  counterName: { height: 24 },
  nr: { width: 22, textAlign: 'right' },
  sep: { height: 26, justifyContent: 'center', paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth },
  sepRow: { height: 26, borderBottomWidth: StyleSheet.hairlineWidth },
  cell: { width: CELL_W, height: ROW_H, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  todayCell: { borderLeftWidth: 2, borderRightWidth: 2, borderLeftColor: DAY_COLORS.today, borderRightColor: DAY_COLORS.today },
  count: { width: CELL_W, height: 24, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  code: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  ghost: { fontFamily: 'Inter_400Regular' },
  bold: { fontFamily: 'Inter_700Bold' },
  tiny: { fontSize: 9 },
  flex: { position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: 3, backgroundColor: DAY_COLORS.flexText },
});
