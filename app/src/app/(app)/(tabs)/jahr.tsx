import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { EntryEditor } from '../../../dienstplan/EntryEditor';
import { useActor, useComments, useDp, useDpEntries, useMe } from '../../../dienstplan/hooks';
import {
  DAY_COLORS, MONTHS, WEEKDAYS, byIdOf, cellColors, cellFor, holidayOf, iso, monthDays, weekday, yearStats,
  type Cell, type DpComment, type DpSettings, type Entry, type Staff,
} from '../../../dienstplan/model';
import { PersonPicker } from '../../../dienstplan/ui';
import { AppScreen } from '../../../features/AppScreen';
import { useTheme } from '../../../theme';
import { Card, IconButton, Skeleton, Text } from '../../../ui';

/** Jahreskalender je Person wie im Blatt „Jahresübersicht“, mit Feinplan, Kennzahlen und Kommentaren. */
export default function YearScreen() {
  const lead = useActor().isLead;
  const [year, setYear] = useState(new Date().getFullYear());
  const dp = useDp();
  const entries = useDpEntries(`${year}-01-01`, `${year}-12-31`);
  const comments = useComments(`${year}-01-01`, `${year}-12-31`);
  const me = useMe();
  const planned = dp.data?.staff.filter((s) => s.inPlan) ?? [];
  const [staffId, setStaffId] = useState<string | null>(null);
  const [sel, setSel] = useState<{ date: string; cell: Cell } | null>(null);
  useEffect(() => { if (!staffId && planned.length) setStaffId((me?.inPlan ? me.id : null) ?? planned[0]?.id ?? null); }, [planned.length, me?.id, me?.inPlan, staffId]);
  const staff = planned.find((s) => s.id === staffId) ?? null;
  const settings = dp.data?.settings;
  const byId = useMemo(() => byIdOf(dp.data?.staff ?? []), [dp.data]);
  const stats = useMemo(() => (staff && settings ? yearStats(staff, year, entries.map, settings, byId) : null), [staff, year, entries.map, settings, byId]);
  const { width } = useWindowDimensions();
  const cols = width >= 1100 ? 3 : width >= 720 ? 2 : 1;

  return (
    <AppScreen title={staff ? `${staff.short} · ${year}` : String(year)} eyebrow="Jahresübersicht"
      onRefresh={() => { entries.refetch(); comments.refetch(); }} refreshing={entries.isRefetching}
      actions={<>
        <IconButton icon={ChevronLeft} label="Voriges Jahr" tone="soft" onPress={() => setYear(year - 1)} />
        <IconButton icon={ChevronRight} label="Nächstes Jahr" tone="soft" onPress={() => setYear(year + 1)} />
      </>}>
      {!dp.data || !settings ? <Skeleton height={300} /> : (
        <>
          <PersonPicker value={staffId} onChange={setStaffId} options={planned.map((s) => ({ value: s.id, label: s.short }))} />
          {stats ? (
            <View style={styles.stats}>
              {([['Dienste', stats.dienste], ['Sonntagsdienste', stats.sonntag], ['Feiertagsdienste', stats.feiertag],
                ['Nachtdienste', stats.nacht], ['Urlaub (U)', stats.urlaub], ['Z-Tage (Z)', stats.z]] as const).map(([l, v]) => (
                <Card key={l} style={styles.stat}>
                  <Text variant="xs" color="textMuted">{l}</Text>
                  <Text variant="xl" style={styles.num}>{v}</Text>
                </Card>
              ))}
            </View>
          ) : null}
          <Legend />
          {staff && stats ? (
            <View style={styles.grid}>
              {MONTHS.map((name, m) => (
                <View key={name} style={{ width: `${100 / cols - 2}%`, minWidth: 280 }}>
                  <MiniMonth year={year} month={m} name={name} count={stats.perMonth[m] ?? 0} staff={staff} entries={entries.map}
                    byId={byId} settings={settings} comments={comments.map} onDay={(date, cell) => setSel({ date, cell })} />
                </View>
              ))}
            </View>
          ) : null}
          <Text variant="xs" color="textMuted">
            Zeigt den Feinplan; ohne Eintrag gilt der (vorübergehende) Turnus. Nachtdienste: N und S/N. Tag antippen für Kommentar, Markierung und Tausch.
          </Text>
          <EntryEditor open={!!sel} staff={staff} date={sel?.date ?? null} cell={sel?.cell ?? null} settings={settings}
            canEdit={lead} isMe={!!me && staff?.id === me.id}
            comments={sel && staff ? comments.map.get(`${staff.id}|${sel.date}`) ?? [] : []} onClose={() => setSel(null)} />
        </>
      )}
    </AppScreen>
  );
}

function Legend() {
  const { c } = useTheme();
  const items: [string, string, string][] = [['Dienst', c.accent, c.onAccent], ['frei', c.bg, c.text], ['Feiertag', DAY_COLORS.holiday, DAY_COLORS.holidayText]];
  return (
    <View style={styles.legend}>
      {items.map(([l, bg, fg]) => (
        <View key={l} style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: bg, borderColor: c.border }]}><Text style={[styles.dcode, { color: fg }]}>12</Text></View>
          <Text variant="xs" color="textMuted">{l}</Text>
        </View>
      ))}
    </View>
  );
}

function MiniMonth({ year, month, name, count, staff, entries, byId, settings, comments, onDay }: {
  year: number; month: number; name: string; count: number; staff: Staff; entries: Map<string, Entry>; byId: Map<string, Staff>;
  settings: DpSettings; comments: Map<string, DpComment[]>; onDay: (date: string, cell: Cell) => void;
}) {
  const { c } = useTheme();
  const days = monthDays(year, month);
  const lead = (weekday(days[0] ?? `${year}-01-01`) + 6) % 7; // Montag zuerst
  const cells: (string | null)[] = [...Array(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const today = iso(new Date());
  return (
    <Card style={styles.month}>
      <Text variant="sm" style={styles.bold}>{name} · {count} Dienste</Text>
      <View style={styles.week}>
        {[1, 2, 3, 4, 5, 6, 0].map((w) => (
          <Text key={w} variant="xs" color="textMuted" style={styles.wd}>{WEEKDAYS[w]}</Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={styles.week}>
          {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
            if (!d) return <View key={i} style={styles.day} />;
            const cell = cellFor(staff, d, entries, settings, 'fein', byId);
            const status = cellColors(cell.code, settings);
            const work = !!cell.code && !status;
            const hol = holidayOf(d);
            // Dienst: dunkel mit heller Schrift; frei: hell mit dunkler Schrift; Kürzel wie im Monatsplan farbig
            const bg = status?.bg ?? (work ? (cell.source === 'temp' ? DAY_COLORS.temp : c.accent) : hol ? DAY_COLORS.holiday : weekday(d) === 0 ? c.surface : c.bg);
            const fg = status?.fg ?? (work ? c.onAccent : hol ? DAY_COLORS.holidayText : c.text);
            const notes = comments.get(`${staff.id}|${d}`);
            const mark = notes?.find((n) => n.mark)?.mark ?? (notes?.length ? c.textMuted : null);
            return (
              <Pressable key={d} onPress={() => onDay(d, cell)}
                accessibilityRole="button"
                accessibilityLabel={`${Number(d.slice(8))}. ${name}: ${cell.code || 'frei'}${hol ? `, ${hol}` : ''}${notes?.length ? ', mit Kommentar' : ''}`}
                style={[styles.day, { backgroundColor: bg, borderColor: d === today ? DAY_COLORS.today : hol && work ? DAY_COLORS.holiday : c.border,
                  borderWidth: d === today || (hol && work) ? 2 : StyleSheet.hairlineWidth }]}>
                <Text style={[styles.dnum, { color: fg }]}>{Number(d.slice(8))}</Text>
                {cell.code ? <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.dcode, { color: cell.flex ? DAY_COLORS.flexText : fg }]}>{cell.code}</Text> : null}
                {mark ? <View style={[styles.note, { borderTopColor: mark }]} /> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { minWidth: 120, flexGrow: 1, gap: 2, paddingVertical: 10 },
  num: { fontFamily: 'BarlowSemiCondensed_700Bold' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendBox: { width: 28, height: 22, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  month: { gap: 3 },
  bold: { fontFamily: 'Inter_600SemiBold' },
  week: { flexDirection: 'row', gap: 2 },
  wd: { flex: 1, textAlign: 'center' },
  day: { flex: 1, height: 38, borderRadius: 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 1 },
  dnum: { fontSize: 10, lineHeight: 11, fontFamily: 'Inter_500Medium' },
  dcode: { fontSize: 11, lineHeight: 13, fontFamily: 'Inter_700Bold' },
  note: { position: 'absolute', top: 0, left: 0, width: 0, height: 0, borderTopWidth: 8, borderRightWidth: 8, borderRightColor: 'transparent' },
});
