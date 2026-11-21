import { router } from 'expo-router';
import { Wand2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useActive } from '../../data/session';
import { autoDispo, type DispoResult } from '../../dienstplan/dispo';
import { dp as dpApi, useActor, useDp, useSetEntries } from '../../dienstplan/hooks';
import { MONTHS, WEEKDAYS, addDays, iso, parseIso } from '../../dienstplan/model';
import { CodeBadge } from '../../dienstplan/ui';
import { AppScreen } from '../../features/AppScreen';
import { errorText } from '../../features/errors';
import { useTheme } from '../../theme';
import { Banner, Button, Card, SectionHeader, Text, TextField } from '../../ui';

const toDe = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const toIso = (de: string) => {
  const m = de.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return m ? `${m[3]}-${(m[2] ?? '').padStart(2, '0')}-${(m[1] ?? '').padStart(2, '0')}` : null;
};
const day = (d: string) => { const x = parseIso(d); return `${WEEKDAYS[x.getDay()]} ${x.getDate()}. ${(MONTHS[x.getMonth()] ?? '').slice(0, 3)}`; };

/** Autodisposition: Arbeitsplätze für einen Zeitraum nach dem Regelwerk vorschlagen und übernehmen. Nur FK4/SL. */
export default function AutoDispoScreen() {
  const { tenant } = useActive();
  const actor = useActor();
  const dp = useDp();
  const apply = useSetEntries();
  const { c } = useTheme();
  const now = new Date();
  const nextFirst = iso(new Date(now.getFullYear(), now.getMonth() + 1, 1, 12));
  const nextLast = iso(new Date(now.getFullYear(), now.getMonth() + 2, 0, 12));
  const [from, setFrom] = useState(toDe(nextFirst));
  const [to, setTo] = useState(toDe(nextLast));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<(DispoResult & { from: string; to: string }) | null>(null);
  const fi = toIso(from), ti = toIso(to);
  const valid = !!fi && !!ti && fi <= ti && addDays(fi, 92) >= ti;

  if (!actor.isLead) return <AppScreen title="Autodisposition" back><Banner tone="info" title="Nur FK4 / SL kann die Autodisposition starten." /></AppScreen>;

  const run = async () => {
    if (!dp.data || !fi || !ti) return;
    setBusy(true); setErr(null); setRes(null); apply.reset();
    try {
      const entries = await dpApi.entries(tenant.id, addDays(fi, -28), ti);
      setRes({ ...autoDispo(dp.data.staff, entries, dp.data.settings, fi, ti), from: fi, to: ti });
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const byId = new Map((dp.data?.staff ?? []).map((x) => [x.id, x]));
  const days = res ? [...new Set(res.changes.map((x) => x.date))].sort() : [];

  return (
    <AppScreen title="Autodisposition" eyebrow="FK4 / SL" back>
      <Card style={styles.card}>
        <Text variant="sm" color="textMuted">
          Verteilt alle, die laut Turnus Dienst haben, aber noch keinen Arbeitsplatz, nach dem Regelwerk auf die Arbeitsplätze.
          Vorhandene Einträge (von Hand, Urlaub, Krank, Tausch) bleiben unverändert. Erst Vorschlag ansehen, dann übernehmen.
        </Text>
        <View style={styles.row}>
          <View style={styles.f}><TextField label="Von" value={from} onChangeText={setFrom} placeholder="TT.MM.JJJJ" /></View>
          <View style={styles.f}><TextField label="Bis" value={to} onChangeText={setTo} placeholder="TT.MM.JJJJ" error={fi && ti && !valid ? 'Zeitraum höchstens 3 Monate, Bis nach Von.' : undefined} /></View>
        </View>
        <View style={styles.row}>
          <Button label="Zeitraum: Rest dieses Monats" size="sm" variant="ghost" onPress={() => { setFrom(toDe(iso(now))); setTo(toDe(iso(new Date(now.getFullYear(), now.getMonth() + 1, 0, 12)))); }} />
          <Button label="Zeitraum: nächster Monat" size="sm" variant="ghost" onPress={() => { setFrom(toDe(nextFirst)); setTo(toDe(nextLast)); }} />
          <Button label="Regelwerk" size="sm" variant="ghost" onPress={() => router.push('/regelwerk')} />
        </View>
        <Button label="Vorschlag berechnen" icon={Wand2} disabled={!valid || !dp.data} loading={busy} onPress={run} />
        {err ? <Banner tone="danger" title={err} /> : null}
      </Card>

      {res ? (
        <>
          <Card style={styles.card}>
            <Text variant="lg">{res.changes.length} Zuweisungen vom {toDe(res.from)} bis {toDe(res.to)}</Text>
            <Text variant="sm" color={res.gaps.length ? 'onDangerSoft' : 'textMuted'}>
              {res.gaps.length ? `${res.gaps.reduce((a, g) => a + g.missing, 0)} Plätze unter Mindestbesetzung an ${new Set(res.gaps.map((g) => g.date)).size} Tagen` : 'Mindestbesetzung überall erreicht.'}
            </Text>
            {apply.isError ? <Banner tone="danger" title={errorText(apply.error)} /> : null}
            {apply.isSuccess ? <Banner tone="success" title="Übernommen. Der Monatsplan zeigt die neuen Arbeitsplätze." /> : (
              <Button label={`${res.changes.length} Zuweisungen übernehmen`} disabled={!res.changes.length} loading={apply.isPending} onPress={() => apply.mutate(res.changes)} />
            )}
          </Card>
          {res.gaps.length ? (
            <>
              <SectionHeader title="Nicht besetzbar" count={res.gaps.length} />
              <Card style={styles.list}>
                {res.gaps.map((g) => (
                  <View key={`${g.date}${g.key}`} style={styles.line}>
                    <Text variant="sm" style={styles.date}>{day(g.date)}</Text>
                    <CodeBadge code={g.key} settings={dp.data!.settings} size="sm" />
                    <Text variant="sm" color="textMuted">fehlt {g.missing}× (keine passende Person frei)</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}
          {res.notes.length ? (
            <>
              <SectionHeader title="Hinweise" count={res.notes.length} />
              <Card style={styles.list}>
                {res.notes.map((n, i) => <Text key={i} variant="sm"><Text variant="sm" style={styles.date}>{day(n.date)}</Text>  {n.text}</Text>)}
              </Card>
            </>
          ) : null}
          <SectionHeader title="Vorschlag je Tag" />
          {days.map((d) => (
            <Card key={d} style={styles.list}>
              <Text variant="sm" style={styles.bold}>{day(d)}</Text>
              <View style={styles.wrap}>
                {res.changes.filter((x) => x.date === d).sort((a, b) => a.code.localeCompare(b.code)).map((x) => (
                  <View key={x.staffId} style={[styles.pill, { borderColor: c.border }]}>
                    <CodeBadge code={x.code} settings={dp.data!.settings} size="sm" />
                    <Text variant="xs">{byId.get(x.staffId)?.short}</Text>
                  </View>
                ))}
              </View>
            </Card>
          ))}
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' },
  f: { flexGrow: 1, flexBasis: 180 },
  list: { gap: 6 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  date: { width: 96, fontFamily: 'Inter_600SemiBold' },
  bold: { fontFamily: 'Inter_600SemiBold' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 6, paddingRight: 6 },
});
