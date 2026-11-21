import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useActor, useAudit, useDp } from '../../dienstplan/hooks';
import { MONTHS, WEEKDAYS, parseIso, type AuditEntry } from '../../dienstplan/model';
import { CodeBadge, PersonPicker, PickChips } from '../../dienstplan/ui';
import { AppScreen } from '../../features/AppScreen';
import { Banner, Card, EmptyState, Skeleton, Text } from '../../ui';
import { History } from 'lucide-react-native';

const SOURCE: Record<string, string> = { plan: 'Plan', tausch: 'Tausch', autodispo: 'Autodisposition', person: 'Person/Turnus' };
const fmtDay = (d: string) => { const x = parseIso(d); return `${WEEKDAYS[x.getDay()]} ${x.getDate()}. ${(MONTHS[x.getMonth()] ?? '').slice(0, 3)} ${x.getFullYear()}`; };

/** Planungsprotokoll: wer (FK4/SL) hat wann was geändert. Nur FK4/SL. */
export default function AuditScreen() {
  const actor = useActor();
  const dp = useDp();
  const audit = useAudit(500);
  const [who, setWho] = useState<string | null>(null);
  const [src, setSrc] = useState('alle');
  const all = useMemo(() => [...(dp.data?.staff ?? []), ...(dp.data?.archived ?? [])], [dp.data]);
  const name = (id: string | null) => (id ? all.find((x) => x.id === id)?.short ?? id : '');
  const list = (audit.data ?? []).filter((a) => (!who || a.staffId === who) && (src === 'alle' || a.source === src));
  const byDay = useMemo(() => {
    const m = new Map<string, AuditEntry[]>();
    for (const a of list) { const k = a.at.slice(0, 10); m.set(k, [...(m.get(k) ?? []), a]); }
    return [...m.entries()];
  }, [list]);

  if (!actor.isLead) return <AppScreen title="Planungsprotokoll" back><Banner tone="info" title="Nur FK4 / SL kann das Planungsprotokoll sehen." /></AppScreen>;
  return (
    <AppScreen title="Planungsprotokoll" eyebrow="Wer hat wann was geändert" back onRefresh={() => audit.refetch()} refreshing={audit.isRefetching}>
      <PersonPicker value={who} onChange={(v) => setWho(v === who ? null : v)} options={all.map((x) => ({ value: x.id, label: x.short }))} />
      {who ? <Text variant="xs" color="textMuted" onPress={() => setWho(null)}>Filter: {name(who)} (antippen zum Aufheben)</Text> : null}
      <PickChips label="Art" showLabel value={src} onChange={setSrc} options={[{ value: 'alle', label: 'alle' }, ...Object.entries(SOURCE).map(([v, l]) => ({ value: v, label: l }))]} />
      {!audit.data || !dp.data ? <Skeleton height={200} /> : list.length === 0 ? (
        <EmptyState icon={History} title="Noch keine Änderungen" body="Jede Änderung am Plan, jeder Tausch und jede Autodisposition erscheint hier." />
      ) : byDay.map(([d, items]) => (
        <Card key={d} style={styles.card}>
          <Text variant="sm" style={styles.bold}>{fmtDay(d)}</Text>
          {items.map((a) => (
            <View key={a.id} style={styles.line}>
              <Text variant="xs" color="textMuted" style={{ width: 42 }}>{new Date(a.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</Text>
              <Text variant="sm" style={[styles.bold, { width: 110 }]} numberOfLines={1}>{a.actorName}</Text>
              <View style={{ flex: 1, minWidth: 200, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {a.text ? (
                  <Text variant="sm">{name(a.staffId)}{a.staffId ? ': ' : ''}{a.text}</Text>
                ) : (
                  <>
                    <Text variant="sm">{name(a.staffId)} am {a.date ? `${Number(a.date.slice(8))}.${Number(a.date.slice(5, 7))}.` : ''}</Text>
                    <CodeBadge code={a.oldCode ?? ''} settings={dp.data!.settings} size="sm" />
                    <Text variant="sm" color="textMuted">→</Text>
                    <CodeBadge code={a.newCode ?? ''} settings={dp.data!.settings} size="sm" />
                  </>
                )}
                <Text variant="xs" color="textMuted">{SOURCE[a.source] ?? a.source}</Text>
              </View>
            </View>
          ))}
        </Card>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 6 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  bold: { fontFamily: 'Inter_600SemiBold' },
});
