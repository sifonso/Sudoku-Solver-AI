import { Check, ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { dp as dpApi, useActor, useDp, useDpAction, useMe, useVacations } from '../../dienstplan/hooks';
import { addDays, byIdOf, iso, parseIso, vacationWorkDays, type Staff, type VacationReq, type VacStatus } from '../../dienstplan/model';
import { canRelease } from '../../dienstplan/store';
import { PersonPicker, PickChips, Sheet } from '../../dienstplan/ui';
import { AppScreen } from '../../features/AppScreen';
import { errorText } from '../../features/errors';
import { useTheme } from '../../theme';
import { Badge, Banner, Button, Card, IconButton, SectionHeader, Skeleton, Text, TextField } from '../../ui';

const STATUS: Record<VacStatus, { label: string; tone: 'neutral' | 'highlight' | 'success' | 'danger' | 'accent'; bg: string; fg: string }> = {
  wunsch: { label: 'Wunsch', tone: 'highlight', bg: '#FAEBD4', fg: '#A84E12' },
  vorgemerkt: { label: 'Vorgemerkt (FK4/SL)', tone: 'accent', bg: '#92D050', fg: '#0F172A' },
  genehmigt: { label: 'Genehmigt', tone: 'success', bg: '#1E9E3E', fg: '#FFFFFF' },
  abgelehnt: { label: 'Abgelehnt', tone: 'danger', bg: '#F8E0E7', fg: '#5A253E' },
};
const RANK: Record<VacStatus, number> = { abgelehnt: 0, wunsch: 1, vorgemerkt: 2, genehmigt: 3 };
const toDe = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const short = (d: string) => `${Number(d.slice(8))}.${Number(d.slice(5, 7))}.`;
const toIso = (de: string) => {
  const m = de.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return m ? `${m[3]}-${(m[2] ?? '').padStart(2, '0')}-${(m[1] ?? '').padStart(2, '0')}` : null;
};

/** Kalenderwochen eines Jahres (Montag als Wochenbeginn, ISO-Woche 1 enthält den 4. Januar). */
function weeksOf(year: number): { kw: number; start: string; end: string }[] {
  const jan4 = parseIso(`${year}-01-04`);
  let start = iso(new Date(jan4.getFullYear(), 0, 4 - ((jan4.getDay() + 6) % 7), 12));
  const out: { kw: number; start: string; end: string }[] = [];
  for (let kw = 1; start <= `${year}-12-31`; kw++) {
    out.push({ kw, start, end: addDays(start, 6) });
    start = addDays(start, 7);
  }
  return out;
}

/** Jahresurlaubsplanung: Wünsche → FK4/SL merkt vor → FK3 gibt frei → U im Dienstplan. */
export default function VacationPlanScreen() {
  const { c } = useTheme();
  const actor = useActor();
  const dp = useDp();
  const me = useMe();
  const now = new Date();
  const [year, setYear] = useState(now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear());
  const vac = useVacations(year);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [prio, setPrio] = useState<'1' | '2'>('1');
  const [note, setNote] = useState('');
  const [forId, setForId] = useState<string | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<Staff | null>(null);
  const wish = useDpAction((t, v: { from: string; to: string; priority: 1 | 2; note: string; staffId?: string }, a) => dpApi.vacWish(t, v, a));
  const del = useDpAction((t, id: string, a) => dpApi.vacDelete(t, id, a));
  const review = useDpAction((t, v: { id: string; ok: boolean; reason: string }, a) => dpApi.vacReview(t, v.id, v.ok, v.reason, a));
  const release = useDpAction((t, v: { id: string; ok: boolean; reason: string }, a) => dpApi.vacRelease(t, v.id, v.ok, v.reason, a));
  const err = [wish, del, review, release].find((m) => m.isError)?.error;

  const settings = dp.data?.settings;
  const staff = useMemo(() => dp.data?.staff.filter((x) => x.inPlan) ?? [], [dp.data]);
  const byId = useMemo(() => byIdOf(dp.data?.staff ?? []), [dp.data]);
  const weeks = useMemo(() => weeksOf(year), [year]);
  const list = vac.data ?? [];
  const days = (v: Pick<VacationReq, 'staffId' | 'from' | 'to'>) => {
    const st = byId.get(v.staffId);
    return st && settings ? vacationWorkDays(st, v.from, v.to, settings, byId) : 0;
  };
  const overlap = (v: VacationReq) => list.filter((x) => x.id !== v.id && x.status !== 'abgelehnt' && x.from <= v.to && v.from <= x.to).length;

  if (!dp.data || !settings) return <AppScreen title="Urlaubsplanung" back><Skeleton height={300} /></AppScreen>;
  const fi = toIso(from), ti = toIso(to);
  const who = actor.isLead ? forId ?? me?.id ?? null : me?.id ?? null;
  const whoStaff = who ? byId.get(who) : undefined;
  const entitlement = (st: Staff) => st.vacationDays ?? settings.vacation.defaultDays;
  const sumFor = (st: Staff, statuses: VacStatus[]) => list.filter((v) => v.staffId === st.id && statuses.includes(v.status)).reduce((a, v) => a + days(v), 0);
  const release_ = canRelease(actor, settings);
  const toReview = list.filter((v) => v.status === 'wunsch');
  const toRelease = list.filter((v) => v.status === 'vorgemerkt');

  return (
    <AppScreen title={`Urlaubsplanung ${year}`} eyebrow="Jahresurlaub" back onRefresh={() => vac.refetch()} refreshing={vac.isRefetching}
      actions={<>
        <IconButton icon={ChevronLeft} label="Voriges Jahr" tone="soft" onPress={() => setYear(year - 1)} />
        <IconButton icon={ChevronRight} label="Nächstes Jahr" tone="soft" onPress={() => setYear(year + 1)} />
      </>}>
      <Text variant="sm" color="textMuted">
        {settings.vacation.approvers.length
          ? 'Ablauf: Wunsch eintragen → FK4 / SL merkt vor → FK3 gibt in der App frei → Urlaub steht als U im Dienstplan.'
          : 'Ablauf: Wunsch eintragen → FK4 / SL merkt vor → nach dem (mündlichen) OK der FK3 genehmigt FK4 / SL → Urlaub steht als U im Dienstplan.'}
        {settings.vacation.wishDeadline ? ` Wünsche bitte bis ${settings.vacation.wishDeadline}${year} eintragen.` : ''}
      </Text>
      {err ? <Banner tone="danger" title={errorText(err)} /> : null}

      {whoStaff || actor.isLead ? (
        <>
          <SectionHeader title={actor.isLead ? 'Urlaub eintragen' : 'Mein Urlaub'} />
          <Card style={styles.card}>
            {actor.isLead ? <PersonPicker value={who} onChange={setForId} options={staff.map((x) => ({ value: x.id, label: x.short }))} /> : null}
            {whoStaff ? (
              <Text variant="sm">
                {whoStaff.short}: Anspruch {entitlement(whoStaff)} Tage · genehmigt {sumFor(whoStaff, ['genehmigt'])} · vorgemerkt {sumFor(whoStaff, ['vorgemerkt'])} · Wünsche {sumFor(whoStaff, ['wunsch'])}
                {' '}· frei verplanbar {entitlement(whoStaff) - sumFor(whoStaff, ['genehmigt', 'vorgemerkt', 'wunsch'])}
              </Text>
            ) : null}
            <View style={styles.row}>
              <View style={styles.f}><TextField label="Von" value={from} onChangeText={setFrom} placeholder="TT.MM.JJJJ" /></View>
              <View style={styles.f}><TextField label="Bis" value={to} onChangeText={setTo} placeholder="TT.MM.JJJJ" error={fi && ti && ti < fi ? 'Bis liegt vor Von.' : undefined} /></View>
            </View>
            {fi && ti && whoStaff && ti >= fi ? <Text variant="xs" color="textMuted">{days({ staffId: whoStaff.id, from: fi, to: ti })} Diensttage laut Turnus</Text> : null}
            <PickChips label="Priorität" showLabel value={prio} onChange={(v) => setPrio(v as '1' | '2')}
              options={[{ value: '1', label: '1 · wichtig' }, { value: '2', label: '2 · Ausweichtermin' }]} />
            <TextField label="Notiz (optional)" value={note} onChangeText={setNote} maxLength={300} placeholder="z. B. Schulferien, Hochzeit" />
            <Button label="Wunsch eintragen" disabled={!fi || !ti || ti < fi || !whoStaff} loading={wish.isPending}
              onPress={() => fi && ti && wish.mutate({ from: fi, to: ti, priority: Number(prio) as 1 | 2, note, staffId: who ?? undefined },
                { onSuccess: () => { setFrom(''); setTo(''); setNote(''); } })} />
            {list.filter((v) => v.staffId === who).map((v) => (
              <VacRow key={v.id} v={v} days={days(v)} name={byId.get(v.staffId)?.short ?? ''}
                trailing={v.status !== 'genehmigt' || actor.isLead || actor.isFk3 ? <IconButton icon={Trash2} label="Urlaub löschen" onPress={() => del.mutate(v.id)} /> : null} />
            ))}
          </Card>
        </>
      ) : null}

      {actor.isLead ? (
        <>
          <SectionHeader title="Zu prüfen (FK4 / SL)" count={toReview.length} />
          {toReview.length === 0 ? <Text variant="sm" color="textMuted">Keine offenen Wünsche.</Text> : toReview.map((v) => (
            <Card key={v.id} style={styles.card}>
              <VacRow v={v} days={days(v)} name={byId.get(v.staffId)?.short ?? ''} />
              {overlap(v) >= settings.vacation.maxParallel ? (
                <Banner tone="warning" title={`In dieser Zeit sind schon ${overlap(v)} weitere eingetragen (Grenze ${settings.vacation.maxParallel}).`} />
              ) : <Text variant="xs" color="textMuted">Gleichzeitig eingetragen: {overlap(v)}</Text>}
              <TextField label="Begründung (bei Ablehnung)" value={reason[v.id] ?? ''} onChangeText={(t) => setReason({ ...reason, [v.id]: t })} />
              <View style={styles.row}>
                <Button label="Vormerken" icon={Check} size="sm" loading={review.isPending} onPress={() => review.mutate({ id: v.id, ok: true, reason: '' })} />
                <Button label="Ablehnen" icon={X} size="sm" variant="secondary" onPress={() => review.mutate({ id: v.id, ok: false, reason: reason[v.id] ?? '' })} />
              </View>
            </Card>
          ))}
        </>
      ) : null}

      {release_ ? (
        <>
          <SectionHeader title={actor.isFk3 ? 'Zur Freigabe (FK3)' : 'Genehmigen (nach OK der FK3)'} count={toRelease.length} />
          {toRelease.length > 1 ? (
            <Button label={actor.isFk3 ? `Alle ${toRelease.length} freigeben` : `Alle ${toRelease.length} genehmigen`} icon={Check} variant="secondary" loading={release.isPending}
              onPress={async () => { for (const v of toRelease) await release.mutateAsync({ id: v.id, ok: true, reason: '' }); }} />
          ) : null}
          {toRelease.length === 0 ? <Text variant="sm" color="textMuted">Nichts vorgemerkt.</Text> : toRelease.map((v) => (
            <Card key={v.id} style={styles.card}>
              <VacRow v={v} days={days(v)} name={byId.get(v.staffId)?.short ?? ''} />
              <View style={styles.row}>
                <Button label={actor.isFk3 ? 'Freigeben' : 'Genehmigen'} icon={Check} size="sm" loading={release.isPending} onPress={() => release.mutate({ id: v.id, ok: true, reason: '' })} />
                <Button label="Ablehnen" icon={X} size="sm" variant="secondary" onPress={() => release.mutate({ id: v.id, ok: false, reason: '' })} />
              </View>
            </Card>
          ))}
        </>
      ) : null}

      <SectionHeader title="Übersicht nach Kalenderwochen" />
      <View style={styles.legend}>
        {(['wunsch', 'vorgemerkt', 'genehmigt'] as const).map((k) => (
          <View key={k} style={styles.legendItem}><View style={[styles.box, { backgroundColor: STATUS[k].bg }]} /><Text variant="xs" color="textMuted">{STATUS[k].label}</Text></View>
        ))}
        <Text variant="xs" color="textMuted">Zahl unten: Personen pro Woche, rot ab {settings.vacation.maxParallel + 1}</Text>
      </View>
      {vac.isLoading ? <Skeleton height={300} /> : (
        <ScrollView horizontal>
          <View style={[styles.grid, { borderColor: c.border }]}>
            <View style={styles.gRow}>
              <Text variant="xs" style={[styles.gName, styles.bold]}>KW</Text>
              {weeks.map((w) => <Text key={w.kw} variant="xs" style={[styles.gCell, { color: c.textMuted }]}>{w.kw}</Text>)}
            </View>
            {staff.map((st) => (
              <View key={st.id} style={styles.gRow}>
                <Pressable onPress={() => setSel(st)} style={styles.gName}><Text variant="xs" numberOfLines={1} style={styles.bold}>{st.short}</Text></Pressable>
                {weeks.map((w) => {
                  const hits = list.filter((v) => v.staffId === st.id && v.status !== 'abgelehnt' && v.from <= w.end && w.start <= v.to);
                  const top = hits.sort((a, b) => RANK[b.status] - RANK[a.status])[0];
                  return (
                    <Pressable key={w.kw} onPress={() => setSel(st)} accessibilityRole="button" accessibilityLabel={`${st.short}, KW ${w.kw}: ${top ? STATUS[top.status].label : 'kein Urlaub'}`}
                      style={[styles.gCell, styles.gBox, { borderColor: c.border, backgroundColor: top ? STATUS[top.status].bg : 'transparent', opacity: top?.priority === 2 ? 0.6 : 1 }]} />
                  );
                })}
              </View>
            ))}
            <View style={styles.gRow}>
              <Text variant="xs" style={[styles.gName, styles.bold]}>Gesamt</Text>
              {weeks.map((w) => {
                const n = new Set(list.filter((v) => v.status !== 'abgelehnt' && v.from <= w.end && w.start <= v.to).map((v) => v.staffId)).size;
                const over = n > settings.vacation.maxParallel;
                return <Text key={w.kw} variant="xs" style={[styles.gCell, { color: over ? '#991B1B' : c.textMuted, backgroundColor: over ? '#FECACA' : 'transparent' }]}>{n || ''}</Text>;
              })}
            </View>
          </View>
        </ScrollView>
      )}

      <Sheet visible={!!sel} title={sel ? `${sel.short} · Urlaub ${year}` : ''} onClose={() => setSel(null)}>
        {sel ? (
          <>
            <Text variant="sm">Anspruch {entitlement(sel)} Tage · genehmigt {sumFor(sel, ['genehmigt'])} · vorgemerkt {sumFor(sel, ['vorgemerkt'])} · Wünsche {sumFor(sel, ['wunsch'])}</Text>
            {list.filter((v) => v.staffId === sel.id).length === 0 ? <Text variant="sm" color="textMuted">Nichts eingetragen.</Text> : null}
            {list.filter((v) => v.staffId === sel.id).map((v) => <VacRow key={v.id} v={v} days={days(v)} name={sel.short} />)}
          </>
        ) : null}
      </Sheet>
    </AppScreen>
  );
}

function VacRow({ v, days, name, trailing }: { v: VacationReq; days: number; name: string; trailing?: React.ReactNode }) {
  const st = STATUS[v.status];
  return (
    <View style={styles.vac}>
      <View style={{ flex: 1, minWidth: 180 }}>
        <Text variant="sm" style={styles.bold}>{name} · {short(v.from)}–{toDe(v.to)} · {days} Tage · Prio {v.priority}</Text>
        <Text variant="xs" color="textMuted">
          {[v.note && `„${v.note}“`, v.fk4Name && `vorgemerkt von ${v.fk4Name}`, v.fk3Name && `${v.status === 'genehmigt' ? 'genehmigt' : 'entschieden'} von ${v.fk3Name}`, v.reason && `Grund: ${v.reason}`].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Badge label={st.label} tone={st.tone} />
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' },
  f: { flexGrow: 1, flexBasis: 160 },
  bold: { fontFamily: 'Inter_600SemiBold' },
  vac: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  box: { width: 16, height: 16, borderRadius: 3 },
  grid: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 4 },
  gRow: { flexDirection: 'row', alignItems: 'center' },
  gName: { width: 96, paddingRight: 6 },
  gCell: { width: 20, textAlign: 'center', fontSize: 9 },
  gBox: { height: 20, borderWidth: StyleSheet.hairlineWidth },
});
