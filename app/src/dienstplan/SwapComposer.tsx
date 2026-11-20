// Tausch zusammenstellen: Ring aus zwei oder mehr Personen. Der Dienst jeder Person geht an die nächste,
// der der letzten an die erste. Vorschau zeigt sofort, ob der Tausch aufgeht.
import { Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { errorText } from '../features/errors';
import { useTheme } from '../theme';
import { Banner, Button, IconButton, Text, TextField } from '../ui';
import { dp as dpApi, useActor, useDp, useDpEntries, useSwapAction } from './hooks';
import { MONTHS, WEEKDAYS, addDays, byIdOf, cellFor, iso, isWork, parseIso, type Staff, type SwapLeg } from './model';
import { SwapError, planRing } from './swap';
import { CodeBadge, PersonPicker, PickChips, Sheet } from './ui';

type Draft = { staffId: string | null; date: string | null };
export const fmtDay = (d: string) => { const x = parseIso(d); return `${WEEKDAYS[x.getDay()]}, ${x.getDate()}. ${(MONTHS[x.getMonth()] ?? '').slice(0, 3)}`; };

export function SwapComposer({ open, initial, onClose, onDone }: { open: boolean; initial: Draft[]; onClose: () => void; onDone?: () => void }) {
  const { c } = useTheme();
  const actor = useActor();
  const dp = useDp();
  const today = iso(new Date());
  const horizon = addDays(today, 120);
  const entries = useDpEntries(today, horizon);
  const [legs, setLegs] = useState<Draft[]>(initial);
  const [note, setNote] = useState('');
  const propose = useSwapAction((t, v: { legs: SwapLeg[]; note: string }, a) => dpApi.proposeSwap(t, v, a));
  useEffect(() => { if (open) { setLegs(initial); setNote(''); propose.reset(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const settings = dp.data?.settings;
  const staff = useMemo(() => dp.data?.staff ?? [], [dp.data]);
  const byId = useMemo(() => byIdOf(staff), [staff]);
  const planned = staff.filter((s) => s.inPlan);
  const workDays = (s: Staff | undefined) => {
    if (!s || !settings) return [];
    const out: { date: string; code: string }[] = [];
    for (let d = today; d <= horizon && out.length < 45; d = addDays(d, 1)) {
      const code = cellFor(s, d, entries.map, settings, 'fein', byId).code;
      if (isWork(code, settings)) out.push({ date: d, code });
    }
    return out;
  };

  const full: SwapLeg[] | null = settings && legs.every((l) => l.staffId)
    ? legs.map((l) => ({ staffId: l.staffId!, date: l.date, code: l.date ? cellFor(byId.get(l.staffId!)!, l.date, entries.map, settings, 'fein', byId).code : '' }))
    : null;
  let preview: { ok: true; lines: string[] } | { ok: false; msg: string } = { ok: false, msg: 'Bitte alle Personen wählen.' };
  if (full && settings) {
    try {
      const changes = planRing(full, staff, entries.data ?? [], settings);
      preview = { ok: true, lines: changes.sort((a, b) => a.date.localeCompare(b.date)).map((ch) => `${byId.get(ch.staffId)?.short}: ${fmtDay(ch.date)} → ${ch.code === 'DT' ? 'frei (DT)' : ch.code}`) };
    } catch (e) {
      preview = { ok: false, msg: e instanceof SwapError ? e.message : 'Tausch geht nicht auf.' };
    }
  }
  const fixedFirst = !actor.isLead && !!actor.staffId;
  const set = (i: number, patch: Partial<Draft>) => setLegs(legs.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <Sheet visible={open} title={legs.length > 2 ? 'Ringtausch vorschlagen' : 'Tausch vorschlagen'} onClose={onClose}>
      <Text variant="sm" color="textMuted">
        Jede Person gibt ihren Dienst an die nächste ab, die letzte an die erste. Auch Dienste am selben Tag lassen sich tauschen.
      </Text>
      {legs.map((leg, i) => {
        const s = leg.staffId ? byId.get(leg.staffId) : undefined;
        const days = workDays(s);
        if (leg.date && !days.some((d) => d.date === leg.date) && s && settings) {
          days.unshift({ date: leg.date, code: cellFor(s, leg.date, entries.map, settings, 'fein', byId).code });
        }
        const next = legs[(i + 1) % legs.length];
        const nextName = next?.staffId ? byId.get(next.staffId)?.short : 'nächste Person';
        return (
          <View key={i} style={[styles.leg, { borderColor: c.border }]}>
            <View style={styles.legHead}>
              <Text variant="label" color="textMuted" style={{ flex: 1 }}>Person {i + 1} gibt an {nextName}</Text>
              {legs.length > 2 ? <IconButton icon={Trash2} label={`Person ${i + 1} entfernen`} onPress={() => setLegs(legs.filter((_, j) => j !== i))} /> : null}
            </View>
            {i === 0 && fixedFirst ? (
              <Text variant="base" style={styles.bold}>{s?.short ?? 'Du'} (du)</Text>
            ) : (
              <PersonPicker value={leg.staffId} onChange={(v) => set(i, { staffId: v, date: null })}
                options={planned.filter((p) => p.id === leg.staffId || !legs.some((l) => l.staffId === p.id)).map((p) => ({ value: p.id, label: p.short }))} />
            )}
            {s ? (
              <PickChips label="Abgegebener Dienst" showLabel value={leg.date ?? 'none'} onChange={(v) => set(i, { date: v === 'none' ? null : v })}
                options={[{ value: 'none', label: 'gibt nichts ab' }, ...days.map((d) => ({ value: d.date, label: `${fmtDay(d.date)} · ${d.code}` }))]} />
            ) : null}
          </View>
        );
      })}
      <Button label="Weitere Person (Ringtausch)" icon={Plus} variant="secondary" size="sm" onPress={() => setLegs([...legs, { staffId: null, date: null }])} />
      <View style={[styles.preview, { backgroundColor: preview.ok ? c.successSoft : c.surface }]}>
        <Text variant="label" color={preview.ok ? 'onSuccessSoft' : 'textMuted'}>Ergebnis</Text>
        {preview.ok ? preview.lines.map((l) => <Text key={l} variant="sm" color="onSuccessSoft">{l}</Text>) : <Text variant="sm" color="textMuted">{preview.msg}</Text>}
      </View>
      {full ? (
        <View style={styles.badges}>
          {full.filter((l) => l.date).map((l) => <CodeBadge key={l.staffId} code={l.code} settings={settings!} size="sm" />)}
        </View>
      ) : null}
      <TextField label="Notiz (optional)" value={note} onChangeText={setNote} maxLength={300} />
      {propose.isError ? <Banner tone="danger" title={errorText(propose.error)} /> : null}
      <Button label={actor.isLead ? 'Tausch anlegen' : 'Vorschlag senden'} disabled={!preview.ok} loading={propose.isPending}
        onPress={() => full && propose.mutate({ legs: full, note }, { onSuccess: () => { onClose(); onDone?.(); } })} />
      <Text variant="xs" color="textMuted">
        {actor.isLead ? 'Alle Beteiligten müssen zustimmen, danach gilt der Tausch ohne weitere Genehmigung.'
          : settings?.swapApproval ? 'Alle Beteiligten müssen zustimmen, danach genehmigt FK4 / SL.' : 'Sobald alle zugestimmt haben, gilt der Tausch.'}
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  leg: { gap: 8, borderWidth: 1, borderRadius: 10, padding: 12 },
  legHead: { flexDirection: 'row', alignItems: 'center' },
  bold: { fontFamily: 'Inter_600SemiBold' },
  preview: { gap: 4, padding: 12, borderRadius: 10 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
