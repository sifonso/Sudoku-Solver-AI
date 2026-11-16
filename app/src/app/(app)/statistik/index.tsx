import { Redirect, router } from 'expo-router';
import { BarChart3, ChevronLeft, ChevronRight, Download } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { canPlan } from '../../../data/api';
import { useStatsMonth } from '../../../data/hooks';
import { useActive } from '../../../data/session';
import { statsCsv } from '../../../domain/stats';
import { today } from '../../../domain/time';
import { AppScreen } from '../../../features/AppScreen';
import { exportText } from '../../../features/exportFile';
import { monthLabel, shiftMonth } from '../../../features/month';
import { useTheme } from '../../../theme';
import { Avatar, Banner, Button, Card, EmptyState, IconButton, ListRow, Skeleton, Text, employmentLabel } from '../../../ui';

const fmtH = (h: number) => `${String(Math.round(h * 10) / 10).replace('.', ',')} h`;

/** S11 Statistik: Schichten, Stunden, Krank- und Urlaubstage pro Person und Monat, CSV-Export. */
export default function StatsScreen() {
  const { member } = useActive();
  if (!canPlan(member.role)) return <Redirect href="/meine" />;
  return <Stats />;
}

function Stats() {
  const { tenant } = useActive();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 768;
  const [month, setMonth] = useState(`${today(tenant.timezone).slice(0, 7)}-01`);
  const stats = useStatsMonth(month);
  const [exported, setExported] = useState<string | null>(null);
  const rows = stats.data ?? [];
  const total = rows.reduce((t, r) => ({ shifts: t.shifts + r.shifts, hours: t.hours + r.hours }), { shifts: 0, hours: 0 });

  const doExport = async () => {
    const r = await exportText(`schichten-${month.slice(0, 7)}.csv`, statsCsv(rows, monthLabel(month)));
    setExported(r === 'dismissed' ? null : r === 'downloaded' ? 'CSV-Datei heruntergeladen.' : 'Geteilt.');
  };

  return (
    <AppScreen title="Statistik" eyebrow="Team" back onRefresh={() => stats.refetch()} refreshing={stats.isRefetching}>
      <View style={styles.nav}>
        <IconButton icon={ChevronLeft} label="Voriger Monat" tone="soft" onPress={() => { setExported(null); setMonth(shiftMonth(month, -1)); }} />
        <Text variant="lg" accessibilityRole="header" style={styles.month}>{monthLabel(month)}</Text>
        <IconButton icon={ChevronRight} label="Nächster Monat" tone="soft" onPress={() => { setExported(null); setMonth(shiftMonth(month, 1)); }} />
      </View>
      {exported ? <Banner tone="success" title={exported} /> : null}

      {stats.isLoading ? <Skeleton height={200} /> : stats.isError ? (
        <Banner tone="danger" title="Statistik konnte nicht geladen werden"
          action={<Button label="Erneut" size="sm" variant="secondary" onPress={() => stats.refetch()} />} />
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={BarChart3} title="Keine Daten" body="Für diesen Monat gibt es noch kein Team." /></Card>
      ) : (
        <>
          <Card style={styles.summary}>
            <View style={{ flex: 1 }}>
              <Text variant="label" color="textMuted">Summe</Text>
              <Text variant="xl">{total.shifts} Schichten · {fmtH(total.hours)}</Text>
            </View>
            <Button label="Export (CSV)" icon={Download} variant="highlight" onPress={() => { doExport().catch(() => setExported(null)); }} />
          </Card>
          <Card style={styles.list}>
            {wide ? (
              <View style={[styles.th, { borderBottomColor: c.border }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {['Mitarbeiter', 'Schichten', 'Stunden', 'Krank', 'Urlaub'].map((h, i) => (
                  <Text key={h} variant="label" color="textMuted" style={i === 0 ? styles.c0 : styles.cn}>{h}</Text>
                ))}
              </View>
            ) : null}
            {rows.map((r) => (
              wide ? (
                <View key={r.memberId} style={[styles.tr, { borderBottomColor: c.border }]}>
                  <View style={[styles.c0, styles.who]}>
                    <Avatar initials={r.initials} employment={r.employmentType} size={32} />
                    <Button label={r.displayName} variant="ghost" size="sm"
                      onPress={() => router.push({ pathname: '/statistik/[id]', params: { id: r.memberId, month } })} />
                  </View>
                  <Text variant="base" style={styles.cn}>{r.shifts}</Text>
                  <Text variant="base" style={styles.cn}>{fmtH(r.hours)}</Text>
                  <Text variant="base" style={styles.cn}>{r.sickDays ? `${r.sickDays} T` : '–'}</Text>
                  <Text variant="base" style={styles.cn}>{r.vacationDays ? `${r.vacationDays} T` : '–'}</Text>
                </View>
              ) : (
                <ListRow key={r.memberId} title={r.displayName}
                  subtitle={[`${r.shifts} Schichten`, fmtH(r.hours), r.sickDays ? `${r.sickDays} T krank` : null, r.vacationDays ? `${r.vacationDays} T Urlaub` : null, employmentLabel[r.employmentType]].filter(Boolean).join(' · ')}
                  leading={<Avatar initials={r.initials} employment={r.employmentType} />}
                  onPress={() => router.push({ pathname: '/statistik/[id]', params: { id: r.memberId, month } })} />
              )
            ))}
          </Card>
          <Text variant="xs" color="textMuted">
            Stunden aus den eingeteilten Zeiten (Beginn im Monat). Krank: Kalendertage. Urlaub: Arbeitstage, nur genehmigt. Feiertage sind noch nicht abgezogen.
          </Text>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  month: { flex: 1, textAlign: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  list: { paddingVertical: 0 },
  th: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  c0: { flex: 3 },
  cn: { flex: 1, textAlign: 'right' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
