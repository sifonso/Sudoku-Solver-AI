import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { canLead, useDp, useDpEntries, useMe } from '../../../dienstplan/hooks';
import { DAY_COLORS, MONTHS, WEEKDAYS, cellColors, cellFor, holidayOf, iso, monthDays, weekday, yearStats, type DpSettings, type Entry, type Staff } from '../../../dienstplan/model';
import { useActive } from '../../../data/session';
import { AppScreen } from '../../../features/AppScreen';
import { useTheme } from '../../../theme';
import { Card, IconButton, Skeleton, Text } from '../../../ui';
import { PersonPicker } from '../../../dienstplan/ui';

/** Jahreskalender je Person wie im Blatt „Jahresübersicht“, mit Kennzahlen. */
export default function YearScreen() {
  const { member } = useActive();
  const [year, setYear] = useState(new Date().getFullYear());
  const dp = useDp();
  const entries = useDpEntries(`${year}-01-01`, `${year}-12-31`);
  const me = useMe();
  const planned = dp.data?.staff.filter((s) => s.inPlan) ?? [];
  const [staffId, setStaffId] = useState<string | null>(null);
  useEffect(() => { if (!staffId && planned.length) setStaffId((me?.inPlan ? me.id : null) ?? planned[0]?.id ?? null); }, [planned.length, me?.id, me?.inPlan, staffId]);
  const staff = planned.find((s) => s.id === staffId) ?? null;
  const settings = dp.data?.settings;
  const stats = useMemo(() => (staff && settings ? yearStats(staff, year, entries.map, settings) : null), [staff, year, entries.map, settings]);
  const { width } = useWindowDimensions();
  const cols = width >= 1100 ? 3 : width >= 720 ? 2 : 1;

  return (
    <AppScreen title={staff ? `${staff.short} · ${year}` : String(year)} eyebrow="Jahresübersicht"
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
          {staff && stats ? (
            <View style={[styles.grid]}>
              {MONTHS.map((name, m) => (
                <View key={name} style={{ width: `${100 / cols - 2}%`, minWidth: 280 }}>
                  <MiniMonth year={year} month={m} name={name} count={stats.perMonth[m] ?? 0} staff={staff} entries={entries.map} settings={settings} />
                </View>
              ))}
            </View>
          ) : null}
          <Text variant="xs" color="textMuted">
            Ohne Feinplan-Eintrag zählt die Schicht aus dem Grundrhythmus. Nachtdienste: N und S/N.
          </Text>
        </>
      )}
    </AppScreen>
  );
}

function MiniMonth({ year, month, name, count, staff, entries, settings }: {
  year: number; month: number; name: string; count: number; staff: Staff; entries: Map<string, Entry>; settings: DpSettings;
}) {
  const { c, scheme } = useTheme();
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
          <Text key={w} variant="xs" color="textMuted" style={[styles.wd, w === 6 && { color: c.text }]}>{WEEKDAYS[w]}</Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={styles.week}>
          {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
            if (!d) return <View key={i} style={styles.day} />;
            const cell = cellFor(staff, d, entries, settings);
            const col = cellColors(cell.code, settings);
            const work = !!cell.code && !col;
            const bg = col?.bg ?? (holidayOf(d) ? DAY_COLORS.holiday : work ? (scheme === 'dark' ? '#33406B' : '#DBEAFE') : weekday(d) === 0 ? DAY_COLORS.sunday : 'transparent');
            const fg = col?.fg ?? (bg === 'transparent' ? c.text : '#1F2937');
            return (
              <Pressable key={d} accessibilityLabel={`${Number(d.slice(8))}. ${name}: ${cell.code || 'frei'}${holidayOf(d) ? `, ${holidayOf(d)}` : ''}`}
                style={[styles.day, { backgroundColor: bg, borderColor: d === today ? DAY_COLORS.today : c.border, borderWidth: d === today ? 2 : StyleSheet.hairlineWidth }]}>
                <Text style={[styles.dnum, { color: fg }]}>{Number(d.slice(8))}</Text>
                <Text numberOfLines={1} style={[styles.dcode, { color: cell.flex ? DAY_COLORS.flexText : fg }]}>{cell.code}</Text>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  month: { gap: 4 },
  bold: { fontFamily: 'Inter_600SemiBold' },
  week: { flexDirection: 'row', gap: 2 },
  wd: { flex: 1, textAlign: 'center' },
  day: { flex: 1, height: 40, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  dnum: { fontSize: 9, fontFamily: 'Inter_400Regular' },
  dcode: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
});
