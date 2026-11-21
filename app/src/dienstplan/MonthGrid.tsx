// Monatsplan wie im Excel-Blatt: Zeilen = Personen, Spalten = Tage, darunter die Besetzungszähler.
// Die Spaltenbreite passt sich an, damit auf breiten Bildschirmen der ganze Monat sichtbar ist.
import { memo, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { Text } from '../ui';
import {
  COUNTER_ROWS, DAY_COLORS, WEEKDAYS, byIdOf, cellColors, cellFor, dayCounters, holidayOf, iso, weekday,
  type Cell, type DpComment, type DpSettings, type Entry, type Staff,
} from './model';

const NAME_W = 112;
const ROW_H = 32;

type Props = {
  days: string[];
  staff: Staff[];
  entries: Map<string, Entry>;
  comments: Map<string, DpComment[]>;
  settings: DpSettings;
  mode: 'fein' | 'rhythmus';
  meId: string | null;
  onCell: (s: Staff, date: string, cell: Cell) => void;
  /** Hervorgehobene Zellen „staffId|date“ (z. B. Vorschlag der Autodisposition) */
  highlight?: Set<string>;
};

export function MonthGrid({ days, staff, entries, comments, settings, mode, meId, onCell, highlight }: Props) {
  const { c, scheme } = useTheme();
  const [width, setWidth] = useState(0);
  const today = iso(new Date());
  const rows = useMemo(() => staff.filter((s) => s.inPlan), [staff]);
  const byId = useMemo(() => byIdOf(staff), [staff]);
  const counters = useMemo(() => days.map((d) => dayCounters(d, staff, entries, settings)), [days, staff, entries, settings]);
  const counterKeys = [...Object.keys(settings.minStaffing), 'Schichtstärke', ...COUNTER_ROWS];
  const dark = scheme === 'dark';
  // Ganzer Monat sichtbar, solange die Spalten mindestens 34 px breit bleiben; sonst seitlich wischen.
  const cellW = width ? Math.max(34, Math.min(48, Math.floor((width - NAME_W - 2) / days.length))) : 40;
  const scrolls = width > 0 && NAME_W + cellW * days.length > width;
  const dayBg = (d: string) => (holidayOf(d) ? (dark ? '#4A2A3A' : DAY_COLORS.holiday) : weekday(d) === 0 ? (dark ? '#2B3048' : DAY_COLORS.sunday) : null);

  const header = (
    <>
      <View style={styles.row}>
        {days.map((d) => {
          const sat = weekday(d) === 6;
          const hol = holidayOf(d);
          const bg = d === today ? DAY_COLORS.today : sat ? DAY_COLORS.saturdayHead.bg : dayBg(d) ?? c.surface;
          const fg = d === today || sat ? '#FFFFFF' : hol && !dark ? DAY_COLORS.holidayText : c.text;
          return (
            <View key={d} style={[styles.head, { width: cellW, backgroundColor: bg, borderColor: c.border }]}
              accessibilityLabel={`${WEEKDAYS[weekday(d)]} ${Number(d.slice(8))}.${hol ? `, Feiertag ${hol}` : ''}`}>
              <Text variant="xs" style={{ color: fg }}>{WEEKDAYS[weekday(d)]}</Text>
              <Text variant="sm" style={[styles.bold, { color: fg }]}>{Number(d.slice(8))}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.row}>
        {days.map((d) => (
          <View key={d} style={[styles.hol, { width: cellW, backgroundColor: dayBg(d) ?? c.surface, borderColor: c.border }]}>
            <Text numberOfLines={1} style={[styles.tiny, { color: holidayOf(d) && !dark ? DAY_COLORS.holidayText : c.textMuted }]}>{holidayOf(d) ?? ''}</Text>
          </View>
        ))}
      </View>
    </>
  );

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ gap: 6 }}>
      {scrolls ? <Text variant="xs" color="textMuted">Seitlich wischen für weitere Tage.</Text> : null}
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
                  <GridCell key={d} staff={s} date={d} entries={entries} byId={byId} settings={settings} mode={mode} w={cellW}
                    notes={comments.get(`${s.id}|${d}`)} colBg={dayBg(d)} today={d === today} proposed={highlight?.has(`${s.id}|${d}`) ?? false}
                    border={c.border} text={c.text} muted={c.textMuted} onCell={onCell} />
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
                    <View key={d} style={[styles.count, { width: cellW, borderColor: c.border, backgroundColor: st?.bg ?? (k === 'Schichtstärke' ? c.accentSoft : c.bg) }]}
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
    </View>
  );
}

const GridCell = memo(function GridCell({ staff, date, entries, byId, settings, mode, w, notes, colBg, today, proposed, border, text, muted, onCell }: {
  staff: Staff; date: string; entries: Map<string, Entry>; byId: Map<string, Staff>; settings: DpSettings; mode: 'fein' | 'rhythmus';
  w: number; notes: DpComment[] | undefined; colBg: string | null; today: boolean; proposed: boolean; border: string; text: string; muted: string;
  onCell: Props['onCell'];
}) {
  const cell = cellFor(staff, date, entries, settings, mode, byId);
  const col = cell.code ? cellColors(cell.code, settings) : null;
  const ghost = cell.source === 'rhythm' && mode === 'fein';
  const temp = cell.source === 'temp';
  const bg = col?.bg ?? colBg ?? 'transparent';
  const fg = cell.flex ? DAY_COLORS.flexText : col?.fg ?? (temp ? DAY_COLORS.temp : ghost ? muted : text);
  const mark = notes?.find((n) => n.mark)?.mark ?? (notes?.length ? muted : null);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${staff.short}, ${Number(date.slice(8))}.: ${cell.code || 'frei'}${proposed ? ' (Vorschlag)' : ''}${ghost && cell.code ? ' laut Rhythmus' : ''}${temp ? ' (vorübergehender Turnus)' : ''}${cell.flex ? ', FLEX' : ''}${notes?.length ? `, ${notes.length} Kommentar${notes.length > 1 ? 'e' : ''}` : ''}`}
      onPress={() => onCell(staff, date, cell)}
      style={({ pressed }) => [styles.cell, { width: w, borderColor: border, backgroundColor: bg, opacity: pressed ? 0.6 : 1 },
        today && styles.todayCell, temp && !col && styles.tempCell, proposed && styles.proposed]}
    >
      <Text numberOfLines={1} style={[styles.code, { color: fg, fontSize: w < 40 ? 10 : 11 }, ghost && styles.ghost, cell.flex && styles.bold]}>
        {cell.code}
      </Text>
      {cell.flex ? <View style={styles.flex} /> : null}
      {mark ? <View style={[styles.note, { borderTopColor: mark }]} /> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, overflow: 'hidden' },
  row: { flexDirection: 'row' },
  head: { height: 40, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  hol: { height: 20, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 1 },
  nameHead: { height: 40, justifyContent: 'center', paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth },
  nameHol: { height: 20, justifyContent: 'center', paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth },
  name: { height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth },
  counterName: { height: 24 },
  nr: { width: 22, textAlign: 'right' },
  sep: { height: 26, justifyContent: 'center', paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth },
  sepRow: { height: 26, borderBottomWidth: StyleSheet.hairlineWidth },
  cell: { height: ROW_H, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  todayCell: { borderLeftWidth: 2, borderRightWidth: 2, borderLeftColor: DAY_COLORS.today, borderRightColor: DAY_COLORS.today },
  proposed: { borderWidth: 2, borderColor: '#E6732C', borderStyle: 'dashed' },
  tempCell: { borderBottomWidth: 2, borderBottomColor: DAY_COLORS.temp },
  count: { height: 24, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  code: { fontFamily: 'Inter_600SemiBold' },
  ghost: { fontFamily: 'Inter_400Regular' },
  bold: { fontFamily: 'Inter_700Bold' },
  tiny: { fontSize: 9 },
  flex: { position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: 3, backgroundColor: DAY_COLORS.flexText },
  // Kommentar/Markierung: Ecke oben links
  note: { position: 'absolute', top: 0, left: 0, width: 0, height: 0, borderTopWidth: 9, borderRightWidth: 9, borderRightColor: 'transparent' },
});
