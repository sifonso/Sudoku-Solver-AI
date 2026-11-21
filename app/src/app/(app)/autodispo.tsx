import { router } from 'expo-router';
import { Send, Wand2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useActive } from '../../data/session';
import { autoDispo, type DispoGap, type DispoNote } from '../../dienstplan/dispo';
import { EntryEditor } from '../../dienstplan/EntryEditor';
import { MonthGrid } from '../../dienstplan/MonthGrid';
import { dp as dpApi, useActor, useDp, useSetEntries } from '../../dienstplan/hooks';
import { MONTHS, WEEKDAYS, addDays, entryKey, indexEntries, iso, parseIso, type Cell, type Entry, type Staff } from '../../dienstplan/model';
import { CodeBadge } from '../../dienstplan/ui';
import { AppScreen } from '../../features/AppScreen';
import { errorText } from '../../features/errors';
import { Banner, Button, Card, SectionHeader, Text, TextField } from '../../ui';

const toDe = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const toIso = (de: string) => {
  const m = de.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return m ? `${m[3]}-${(m[2] ?? '').padStart(2, '0')}-${(m[1] ?? '').padStart(2, '0')}` : null;
};
const day = (d: string) => { const x = parseIso(d); return `${WEEKDAYS[x.getDay()]} ${x.getDate()}. ${(MONTHS[x.getMonth()] ?? '').slice(0, 3)}`; };
const EMPTY = new Map();

type Draft = { from: string; to: string; base: Entry[]; changes: Map<string, Entry>; proposed: Set<string>; gaps: DispoGap[]; notes: DispoNote[] };

/** Autodisposition: Vorschlag für einen Zeitraum berechnen, wie im Monatsplan ansehen, nachbearbeiten, veröffentlichen. Nur FK4/SL. */
export default function AutoDispoScreen() {
  const { tenant } = useActive();
  const actor = useActor();
  const dp = useDp();
  const publish = useSetEntries();
  const now = new Date();
  const nextFirst = iso(new Date(now.getFullYear(), now.getMonth() + 1, 1, 12));
  const nextLast = iso(new Date(now.getFullYear(), now.getMonth() + 2, 0, 12));
  const [from, setFrom] = useState(toDe(nextFirst));
  const [to, setTo] = useState(toDe(nextLast));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sel, setSel] = useState<{ staff: Staff; date: string; cell: Cell } | null>(null);
  const fi = toIso(from), ti = toIso(to);
  const valid = !!fi && !!ti && fi <= ti && addDays(fi, 92) >= ti;

  const merged = useMemo(() => {
    if (!draft) return EMPTY as Map<string, Entry>;
    const m = indexEntries(draft.base);
    for (const [k, e] of draft.changes) { if (e.code || e.flex) m.set(k, e); else m.delete(k); }
    return m;
  }, [draft]);
  const days = useMemo(() => {
    const out: string[] = [];
    if (draft) for (let d = draft.from; d <= draft.to; d = addDays(d, 1)) out.push(d);
    return out;
  }, [draft]);

  if (!actor.isLead) return <AppScreen title="Autodisposition" back><Banner tone="info" title="Nur FK4 / SL kann die Autodisposition starten." /></AppScreen>;

  const run = async () => {
    if (!dp.data || !fi || !ti) return;
    setBusy(true); setErr(null); setDraft(null); publish.reset();
    try {
      const base = await dpApi.entries(tenant.id, addDays(fi, -28), ti);
      const r = autoDispo(dp.data.staff, base, dp.data.settings, fi, ti, dp.data.carpools);
      setDraft({ from: fi, to: ti, base, changes: new Map(r.changes.map((e) => [entryKey(e.staffId, e.date), e])),
        proposed: new Set(r.changes.map((e) => entryKey(e.staffId, e.date))), gaps: r.gaps, notes: r.notes });
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const required = draft?.gaps.filter((g) => g.required) ?? [];
  const optional = draft?.gaps.filter((g) => !g.required) ?? [];

  return (
    <AppScreen wide title="Autodisposition" eyebrow="FK4 / SL" back>
      <Card style={styles.card}>
        <Text variant="sm" color="textMuted">
          Reihenfolge laut Regelwerk: Pflichtdienste, dann Zusatzdienste, dann Dienste ohne Arbeitsplatz. Vorhandene Einträge (von Hand, Urlaub, Krank, Tausch)
          bleiben. Der Vorschlag erscheint unten wie im Monatsplan; einzelne Tage lassen sich antippen und ändern. Erst „Veröffentlichen“ schreibt in den Plan.
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

      {draft && dp.data ? (
        <>
          <Card style={styles.card}>
            <Text variant="lg">Vorschlag {toDe(draft.from)} – {toDe(draft.to)}: {draft.changes.size} Einträge</Text>
            {required.length ? (
              <Banner tone="danger" title={`${required.length} Pflichtdienste nicht besetzbar`} body="Unten aufgelistet. Bitte von Hand lösen, z. B. Tausch oder Zusatzdienst." />
            ) : <Text variant="sm" color="textMuted">Alle Pflichtdienste besetzt.</Text>}
            {publish.isError ? <Banner tone="danger" title={errorText(publish.error)} /> : null}
            {publish.isSuccess ? <Banner tone="success" title="Veröffentlicht. Der Monatsplan zeigt die neuen Dienste." /> : (
              <View style={styles.row}>
                <Button label={`Veröffentlichen (${draft.changes.size})`} icon={Send} disabled={!draft.changes.size} loading={publish.isPending}
                  onPress={() => publish.mutate({ list: [...draft.changes.values()], source: 'autodispo' }, {
                    onSuccess: () => {
                      if (required.length) {
                        dpApi.alertLeads(tenant.id, `${required.length} Pflichtdienste unbesetzt`,
                          required.slice(0, 10).map((g) => `${g.key} am ${Number(g.date.slice(8))}.${Number(g.date.slice(5, 7))}.`).join(', ') + (required.length > 10 ? ' …' : '')).catch(() => undefined);
                      }
                    },
                  })} />
                <Button label="Verwerfen" variant="ghost" onPress={() => setDraft(null)} />
              </View>
            )}
          </Card>
          <Text variant="xs" color="textMuted">Orange gestrichelt: Vorschlag der Autodisposition. Antippen zum Ändern.</Text>
          <MonthGrid days={days} staff={dp.data.staff} entries={merged} comments={EMPTY} settings={dp.data.settings} mode="fein" meId={null}
            highlight={draft.proposed} onCell={(staff, date, cell) => setSel({ staff, date, cell })} />
          {required.length || optional.length ? (
            <>
              <SectionHeader title="Nicht besetzbar" count={required.length + optional.length} />
              <Card style={styles.list}>
                {[...required, ...optional].map((g) => (
                  <View key={`${g.date}${g.key}`} style={styles.line}>
                    <Text variant="sm" style={styles.date}>{day(g.date)}</Text>
                    <CodeBadge code={g.key} settings={dp.data!.settings} size="sm" />
                    <Text variant="sm" color={g.required ? 'onDangerSoft' : 'textMuted'}>{g.required ? 'Pflichtdienst' : 'Zusatzdienst'}: keine passende Person frei</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}
          {draft.notes.length ? (
            <>
              <SectionHeader title="Hinweise" count={draft.notes.length} />
              <Card style={styles.list}>
                {draft.notes.map((n, i) => <Text key={i} variant="sm"><Text variant="sm" style={styles.date}>{day(n.date)}</Text>  {n.text}</Text>)}
              </Card>
            </>
          ) : null}
          <EntryEditor open={!!sel} staff={sel?.staff ?? null} date={sel?.date ?? null} cell={sel?.cell ?? null} settings={dp.data.settings}
            canEdit isMe={false} comments={[]} onClose={() => setSel(null)}
            draftSave={(e) => setDraft((d) => (d ? { ...d, changes: new Map(d.changes).set(entryKey(e.staffId, e.date), e) } : d))} />
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
});
