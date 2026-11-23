import { Bell, Check, ChevronLeft, ChevronRight, Pencil, Trash2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { dp as dpApi, useActor, useDp, useDpAction, useDpEntries, useFlex, useMe, useSaveSettings, useVacations } from '../../dienstplan/hooks';
import {
  MONTHS, WEEKDAYS, byIdOf, cellFor, entitlementOf, holidayOf, isWork, monthDays, planStrength, strengthColor, vacationWorkDays, weekday,
  type DpSettings, type FlexDay, type Staff, type VacationReq, type VacStatus,
} from '../../dienstplan/model';
import { canRelease } from '../../dienstplan/store';
import { PersonPicker, PickChips, Sheet } from '../../dienstplan/ui';
import { AppScreen } from '../../features/AppScreen';
import { errorText } from '../../features/errors';
import { useTheme } from '../../theme';
import { Badge, Banner, Button, Card, Checkbox, IconButton, SectionHeader, Skeleton, Text, TextField } from '../../ui';

const STATUS: Record<VacStatus, { label: string; tone: 'neutral' | 'highlight' | 'success' | 'danger' | 'accent'; bg: string; fg: string }> = {
  wunsch: { label: 'Wunsch', tone: 'highlight', bg: '#FAEBD4', fg: '#A84E12' },
  vorgemerkt: { label: 'Vorgemerkt', tone: 'accent', bg: '#92D050', fg: '#0F172A' },
  genehmigt: { label: 'Genehmigt', tone: 'success', bg: '#1E9E3E', fg: '#FFFFFF' },
  abgelehnt: { label: 'Abgelehnt', tone: 'danger', bg: '#F8E0E7', fg: '#5A253E' },
};
const FLEX_COLOR = { bg: '#8B5CF6', fg: '#FFFFFF' };
const RANK: Record<VacStatus, number> = { abgelehnt: 0, wunsch: 1, vorgemerkt: 2, genehmigt: 3 };
const toDe = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const short = (d: string) => `${Number(d.slice(8))}.${Number(d.slice(5, 7))}.`;
const toIso = (de: string) => {
  const m = de.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return m ? `${m[3]}-${(m[2] ?? '').padStart(2, '0')}-${(m[1] ?? '').padStart(2, '0')}` : null;
};
const groupLetter = (code: string) => (code === 'S/N' ? 'S/N' : code === 'MF' || code === 'M/S' || code === 'M/F' ? 'M' : code.charAt(0));

type Edit = { id: string; from: string; to: string; prio: '1' | '2'; note: string; mode: 'edit' | 'change' };

/** Jahresurlaub: Wünsche → FK4/SL merkt vor → nach (mündlichem) OK der FK3 genehmigt → U im Plan. Danach Flextage an kritischen Tagen. */
export default function VacationPlanScreen() {
  const { c } = useTheme();
  const actor = useActor();
  const dp = useDp();
  const me = useMe();
  const saveSettings = useSaveSettings();
  const now = new Date();
  const [year, setYear] = useState(now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear());
  const vac = useVacations(year);
  const flex = useFlex(year);
  const entries = useDpEntries(`${year}-01-01`, `${year}-12-31`);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [prio, setPrio] = useState<'1' | '2'>('1');
  const [note, setNote] = useState('');
  const [forId, setForId] = useState<string | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [edit, setEdit] = useState<Edit | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [deadline, setDeadline] = useState('');
  const [flexFor, setFlexFor] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const wish = useDpAction((t, v: { from: string; to: string; priority: 1 | 2; note: string; staffId?: string }, a) => dpApi.vacWish(t, v, a));
  const del = useDpAction((t, id: string, a) => dpApi.vacDelete(t, id, a));
  const update = useDpAction((t, v: { id: string; from: string; to: string; priority: 1 | 2; note: string }, a) => dpApi.vacUpdate(t, v.id, v, a));
  const change = useDpAction((t, v: { id: string; kind: 'storno' | 'aenderung'; from?: string; to?: string }, a) => dpApi.vacChangeRequest(t, v.id, v, a));
  const decideChange = useDpAction((t, v: { id: string; ok: boolean }, a) => dpApi.vacChangeDecide(t, v.id, v.ok, a));
  const review = useDpAction((t, v: { id: string; ok: boolean; reason: string }, a) => dpApi.vacReview(t, v.id, v.ok, v.reason, a));
  const release = useDpAction((t, v: { id: string; ok: boolean; reason: string }, a) => dpApi.vacRelease(t, v.id, v.ok, v.reason, a));
  const addFlex = useDpAction((t, v: { date: string; staffId?: string; byEmployer?: boolean }, a) => dpApi.flexAdd(t, v, a));
  const delFlex = useDpAction((t, id: string, a) => dpApi.flexDelete(t, id, a));
  const notifyAll = useDpAction((t, v: { title: string; body: string }) => dpApi.notifyAll(t, v.title, v.body));
  const err = [wish, del, update, change, decideChange, review, release, addFlex, delFlex, notifyAll, saveSettings].find((m) => m.isError)?.error;

  const settings = dp.data?.settings;
  const staff = useMemo(() => dp.data?.staff.filter((x) => x.inPlan) ?? [], [dp.data]);
  const byId = useMemo(() => byIdOf(dp.data?.staff ?? []), [dp.data]);
  const list = useMemo(() => vac.data ?? [], [vac.data]);
  const flexList = useMemo(() => flex.data ?? [], [flex.data]);
  const yearDays = useMemo(() => Array.from({ length: 12 }, (_, m) => monthDays(year, m)).flat(), [year]);
  const strength = useMemo(() => {
    const m = new Map<string, number>();
    if (!settings || !dp.data) return m;
    for (const d of yearDays) m.set(d, planStrength(d, dp.data.staff, list, flexList, entries.map, settings));
    return m;
  }, [yearDays, dp.data, settings, list, flexList, entries.map]);

  if (!dp.data || !settings) return <AppScreen title="Urlaubsplanung" back><Skeleton height={300} /></AppScreen>;
  const days = (v: Pick<VacationReq, 'staffId' | 'from' | 'to'>) => {
    const st = byId.get(v.staffId);
    return st ? vacationWorkDays(st, v.from, v.to, settings, byId) : 0;
  };
  const overlap = (v: VacationReq) => list.filter((x) => x.id !== v.id && x.status !== 'abgelehnt' && x.from <= v.to && v.from <= x.to).length;
  const fi = toIso(from), ti = toIso(to);
  const who = actor.isLead ? forId ?? (me?.inPlan ? me.id : null) : me?.id ?? null;
  const whoStaff = who ? byId.get(who) : undefined;
  const sumFor = (st: Staff, statuses: VacStatus[]) => list.filter((v) => v.staffId === st.id && statuses.includes(v.status)).reduce((a, v) => a + days(v), 0);
  const release_ = canRelease(actor, settings);
  const toReview = list.filter((v) => v.status === 'wunsch');
  const changes = list.filter((v) => v.changeKind);
  const toRelease = list.filter((v) => v.status === 'vorgemerkt');
  const flexOpen = settings.vacation.flexOpenYears.includes(year);
  const collecting = settings.vacation.wishYear === year && !!settings.vacation.wishDeadline;
  const setVac = (patch: Partial<DpSettings['vacation']>) => saveSettings.mutate({ ...settings, vacation: { ...settings.vacation, ...patch } });

  const Entitlement = ({ st }: { st: Staff }) => {
    const e = entitlementOf(st, settings);
    const used = sumFor(st, ['genehmigt', 'vorgemerkt', 'wunsch']);
    return (
      <Text variant="sm">
        {st.short}: Anspruch {e.total} Tage{e.manual ? ' (fest eingetragen)' : ` (${e.base}${st.partTimePct && st.partTimePct !== 100 ? ` bei ${st.partTimePct} %` : ''}${e.bonus ? ` + ${e.bonus} Wechselschicht` : ''})`}
        {' '}· genehmigt {sumFor(st, ['genehmigt'])} · vorgemerkt {sumFor(st, ['vorgemerkt'])} · Wünsche {sumFor(st, ['wunsch'])} · Rest {e.total - used}
      </Text>
    );
  };

  const actionsFor = (v: VacationReq) => {
    const mine = v.staffId === me?.id;
    const items: React.ReactNode[] = [];
    if (actor.isLead || (mine && v.status === 'wunsch')) {
      items.push(<IconButton key="e" icon={Pencil} label="Urlaub ändern" onPress={() => setEdit({ id: v.id, from: toDe(v.from), to: toDe(v.to), prio: String(v.priority) as '1' | '2', note: v.note, mode: 'edit' })} />);
    }
    if (actor.isLead || actor.isFk3 || (mine && (v.status === 'wunsch' || v.status === 'abgelehnt'))) {
      items.push(<IconButton key="d" icon={Trash2} label={v.status === 'genehmigt' ? 'Urlaub stornieren' : 'Urlaub löschen'} onPress={() => del.mutate(v.id)} />);
    }
    if (mine && !actor.isLead && (v.status === 'vorgemerkt' || v.status === 'genehmigt') && !v.changeKind) {
      items.push(<Button key="c" label="Ändern beantragen" size="sm" variant="ghost" onPress={() => setEdit({ id: v.id, from: toDe(v.from), to: toDe(v.to), prio: String(v.priority) as '1' | '2', note: v.note, mode: 'change' })} />);
      items.push(<Button key="s" label="Storno beantragen" size="sm" variant="ghost" onPress={() => change.mutate({ id: v.id, kind: 'storno' })} />);
    }
    return items;
  };

  // Flextage: eigene bzw. für die gewählte Person; Auswahl an kritischen Tagen, an denen sie laut Turnus frei ist
  const flexPerson = actor.isLead ? (flexFor ? byId.get(flexFor) : undefined) : me ?? undefined;
  const flexOf = (st: Staff | undefined) => flexList.filter((f) => f.staffId === st?.id);
  const criticalFree = (st: Staff | undefined) => {
    if (!st) return [];
    return yearDays.filter((d) => {
      const col = strengthColor(strength.get(d) ?? 99, settings);
      if (!col) return false;
      if (flexList.some((f) => f.staffId === st.id && f.date === d)) return false;
      if (list.some((v) => v.staffId === st.id && v.status !== 'abgelehnt' && v.from <= d && d <= v.to)) return false;
      return !isWork(cellFor(st, d, entries.map, settings, 'fein', byId).code, settings);
    });
  };

  return (
    <AppScreen title={`Urlaubsplanung ${year}`} eyebrow="Jahresurlaub und Flextage" back onRefresh={() => { vac.refetch(); flex.refetch(); }} refreshing={vac.isRefetching}
      actions={<>
        <IconButton icon={ChevronLeft} label="Voriges Jahr" tone="soft" onPress={() => { setYear(year - 1); setMonth(null); }} />
        <IconButton icon={ChevronRight} label="Nächstes Jahr" tone="soft" onPress={() => { setYear(year + 1); setMonth(null); }} />
      </>}>
      <Text variant="sm" color="textMuted">
        {settings.vacation.approvers.length
          ? 'Ablauf: Wunsch eintragen → FK4 / SL merkt vor → FK3 gibt in der App frei → Urlaub steht als U im Dienstplan → Flextage wählen.'
          : 'Ablauf: Wunsch eintragen → FK4 / SL merkt vor → nach dem (mündlichen) OK der FK3 genehmigt FK4 / SL → Urlaub steht als U im Dienstplan → Flextage wählen.'}
      </Text>
      {collecting ? <Banner tone="info" title={`Urlaubswünsche für ${year} bitte bis ${toDe(settings.vacation.wishDeadline)} eintragen.`} /> : null}
      {err ? <Banner tone="danger" title={errorText(err)} /> : null}

      {actor.isLead ? (
        <Card style={styles.card}>
          <Text variant="label" color="textMuted">FK4 / SL · Planungsjahr {year}</Text>
          <View style={styles.row}>
            <View style={styles.f}><TextField label="Abgabe der Wünsche bis" value={deadline || (settings.vacation.wishYear === year && settings.vacation.wishDeadline ? toDe(settings.vacation.wishDeadline) : '')}
              onChangeText={setDeadline} placeholder={`30.09.${year - 1}`} /></View>
            <Button label="Aufforderung an alle senden" icon={Bell} variant="secondary" disabled={!toIso(deadline)} loading={notifyAll.isPending || saveSettings.isPending}
              onPress={() => {
                const d = toIso(deadline);
                if (!d) return;
                setVac({ wishYear: year, wishDeadline: d });
                notifyAll.mutate({ title: `Urlaubswünsche ${year}`, body: `Bitte bis ${toDe(d)} in der App unter Urlaubsplanung eintragen.` });
              }} />
          </View>
          {notifyAll.isSuccess ? <Banner tone="success" title="Aufforderung verschickt." /> : null}
          <Checkbox label={`Flextage ${year} für Mitarbeitende freigeben (nach Abschluss der Urlaubsplanung)`} checked={flexOpen}
            onChange={(on) => {
              setVac({ flexOpenYears: on ? [...settings.vacation.flexOpenYears, year] : settings.vacation.flexOpenYears.filter((y) => y !== year) });
              if (on) notifyAll.mutate({ title: `Flextage ${year}`, body: `Ihr könnt jetzt bis zu ${settings.vacation.flexOwn} Flextage an den markierten Tagen wählen.` });
            }} />
        </Card>
      ) : null}

      {whoStaff || actor.isLead ? (
        <>
          <SectionHeader title={actor.isLead ? 'Urlaub eintragen' : 'Mein Urlaub'} />
          <Card style={styles.card}>
            {actor.isLead ? <PersonPicker value={who} onChange={setForId} options={staff.map((x) => ({ value: x.id, label: x.short }))} /> : null}
            {whoStaff ? <Entitlement st={whoStaff} /> : null}
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
              <VacRow key={v.id} v={v} days={days(v)} name={byId.get(v.staffId)?.short ?? ''} trailing={actionsFor(v)} />
            ))}
          </Card>
        </>
      ) : null}

      {actor.isLead ? (
        <>
          <SectionHeader title="Zu prüfen (FK4 / SL)" count={toReview.length + changes.length} />
          {toReview.length + changes.length === 0 ? <Text variant="sm" color="textMuted">Keine offenen Wünsche.</Text> : null}
          {changes.map((v) => (
            <Card key={`c${v.id}`} style={styles.card}>
              <VacRow v={v} days={days(v)} name={byId.get(v.staffId)?.short ?? ''} />
              <Text variant="sm" style={styles.bold}>
                {v.changeKind === 'storno' ? 'Wunsch: Urlaub stornieren' : `Wunsch: ändern auf ${short(v.changeFrom!)}–${toDe(v.changeTo!)}`}
              </Text>
              <View style={styles.row}>
                <Button label="Übernehmen" icon={Check} size="sm" loading={decideChange.isPending} onPress={() => decideChange.mutate({ id: v.id, ok: true })} />
                <Button label="Ablehnen" icon={X} size="sm" variant="secondary" onPress={() => decideChange.mutate({ id: v.id, ok: false })} />
              </View>
            </Card>
          ))}
          {toReview.map((v) => (
            <Card key={v.id} style={styles.card}>
              <VacRow v={v} days={days(v)} name={byId.get(v.staffId)?.short ?? ''} trailing={actionsFor(v)} />
              {overlap(v) >= settings.vacation.maxParallel ? (
                <Banner tone="warning" title={`In dieser Zeit sind schon ${overlap(v)} weitere eingetragen (Regel: ${settings.vacation.maxParallel}). Ausnahme möglich, Flextage gleichen aus.`} />
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
              <VacRow v={v} days={days(v)} name={byId.get(v.staffId)?.short ?? ''} trailing={actionsFor(v)} />
              <View style={styles.row}>
                <Button label={actor.isFk3 ? 'Freigeben' : 'Genehmigen'} icon={Check} size="sm" loading={release.isPending} onPress={() => release.mutate({ id: v.id, ok: true, reason: '' })} />
                <Button label="Ablehnen" icon={X} size="sm" variant="secondary" onPress={() => release.mutate({ id: v.id, ok: false, reason: '' })} />
              </View>
            </Card>
          ))}
        </>
      ) : null}

      <SectionHeader title={`Flextage ${year}`} />
      <Card style={styles.card}>
        <Text variant="xs" color="textMuted">
          Je Person {settings.vacation.flexOwn} selbst gewählte und bis zu {settings.vacation.flexEmployer} vom Arbeitgeber vergebene Flextage. Flextage liegen an Tagen, die laut Turnus frei sind, und gleichen dünn besetzte Tage aus.
          {flexOpen ? '' : ' Die eigene Auswahl ist erst nach Freigabe durch FK4 / SL möglich.'}
        </Text>
        {actor.isLead ? <PersonPicker label="Flextage für" value={flexFor} onChange={setFlexFor} options={staff.map((x) => ({ value: x.id, label: x.short }))} /> : null}
        {flexPerson ? (
          <>
            <Text variant="sm">
              {flexPerson.short}: selbst gewählt {flexOf(flexPerson).filter((f) => !f.byEmployer).length} von {settings.vacation.flexOwn} · vom Arbeitgeber {flexOf(flexPerson).filter((f) => f.byEmployer).length} von {settings.vacation.flexEmployer}
            </Text>
            {flexOf(flexPerson).sort((a, b) => a.date.localeCompare(b.date)).map((f) => (
              <View key={f.id} style={styles.vac}>
                <View style={[styles.box, { backgroundColor: FLEX_COLOR.bg }]} />
                <Text variant="sm" style={{ flex: 1 }}>{WEEKDAYS[weekday(f.date)]}, {toDe(f.date)}{f.byEmployer ? ' · vom Arbeitgeber' : ''}</Text>
                {actor.isLead || (!f.byEmployer && f.staffId === me?.id) ? <IconButton icon={Trash2} label="Flextag entfernen" onPress={() => delFlex.mutate(f.id)} /> : null}
              </View>
            ))}
            {flexOpen || actor.isLead ? (
              <>
                <Text variant="label" color="textMuted">Kritische Tage, an denen {flexPerson.short} frei ist (antippen zum Wählen)</Text>
                <View style={styles.chips}>
                  {criticalFree(flexPerson).slice(0, 60).map((d) => {
                    const n = strength.get(d) ?? 0;
                    const col = strengthColor(n, settings)!;
                    return (
                      <Pressable key={d} accessibilityRole="button" accessibilityLabel={`Flextag ${toDe(d)}, Schichtstärke ${n}`}
                        onPress={() => addFlex.mutate({ date: d, staffId: flexPerson.id, byEmployer: actor.isLead && flexPerson.id !== me?.id })}
                        style={[styles.flexChip, { backgroundColor: col.bg }]}>
                        <Text variant="xs" style={[styles.bold, { color: col.fg }]}>{WEEKDAYS[weekday(d)]} {short(d)}</Text>
                        <Text variant="xs" style={{ color: col.fg }}>Stärke {n}</Text>
                      </Pressable>
                    );
                  })}
                  {criticalFree(flexPerson).length === 0 ? <Text variant="sm" color="textMuted">Keine kritischen freien Tage.</Text> : null}
                </View>
                {actor.isLead && flexPerson.id !== me?.id ? <Text variant="xs" color="textMuted">Von FK4 / SL gewählte Flextage zählen als „vom Arbeitgeber vergeben“.</Text> : null}
              </>
            ) : null}
          </>
        ) : <Text variant="sm" color="textMuted">{actor.isLead ? 'Person wählen.' : 'Dein Login ist keiner Person im Plan zugeordnet.'}</Text>}
      </Card>

      <SectionHeader title="Übersicht: Grundturnus der Gruppe" />
      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.box, { backgroundColor: '#FECACA' }]} /><Text variant="xs" color="textMuted">Schichtstärke bis {settings.vacation.redAt}</Text></View>
        <View style={styles.legendItem}><View style={[styles.box, { backgroundColor: '#FEF3C7' }]} /><Text variant="xs" color="textMuted">{settings.vacation.redAt + 1}–{settings.vacation.yellowAt}</Text></View>
        <Text variant="xs" color="textMuted">ab {settings.vacation.yellowAt + 1} ohne Farbe · Monat antippen für Details</Text>
      </View>
      {vac.isLoading || entries.isLoading ? <Skeleton height={240} /> : (
        <ScrollView horizontal>
          <View style={[styles.grid, { borderColor: c.border }]}>
            <View style={styles.gRow}>
              <Text variant="xs" style={[styles.mName, styles.bold]}>Tag</Text>
              {Array.from({ length: 31 }, (_, i) => <Text key={i} style={[styles.yCell, { color: c.textMuted }]}>{i + 1}</Text>)}
            </View>
            {MONTHS.map((mName, m) => (
              <Pressable key={mName} onPress={() => setMonth(m === month ? null : m)} accessibilityRole="button" accessibilityLabel={`${mName} im Detail`}
                style={[styles.gRow, m === month && { backgroundColor: c.accentSoft }]}>
                <Text variant="xs" style={[styles.mName, styles.bold]}>{mName.slice(0, 3)}</Text>
                {monthDays(year, m).map((d) => {
                  const n = strength.get(d) ?? 0;
                  const col = strengthColor(n, settings);
                  return (
                    <View key={d} style={[styles.yCell, styles.yBox, { backgroundColor: col?.bg ?? (holidayOf(d) ? '#F8E0E7' : 'transparent'), borderColor: c.border }]}>
                      <Text style={[styles.yNum, { color: col?.fg ?? c.textMuted }]}>{n}</Text>
                    </View>
                  );
                })}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      {month !== null ? (
        <MonthDetail year={year} month={month} staff={staff} byId={byId} settings={settings} entries={entries.map}
          list={list} flex={flexList} strength={strength} onDay={setDay} />
      ) : null}

      <Sheet visible={!!day} title={day ? `${WEEKDAYS[weekday(day)]}, ${toDe(day)} · Stärke ${strength.get(day) ?? 0}` : ''} onClose={() => setDay(null)}>
        {day ? (
          <>
            <Text variant="label" color="textMuted">Urlaub</Text>
            {list.filter((v) => v.status !== 'abgelehnt' && v.from <= day && day <= v.to).map((v) => (
              <Text key={v.id} variant="sm">{byId.get(v.staffId)?.short} · {STATUS[v.status].label}</Text>
            ))}
            <Text variant="label" color="textMuted">Flextage</Text>
            {flexList.filter((f) => f.date === day).map((f) => <Text key={f.id} variant="sm">{byId.get(f.staffId)?.short}{f.byEmployer ? ' (Arbeitgeber)' : ''}</Text>)}
          </>
        ) : null}
      </Sheet>

      <Sheet visible={!!edit} title={edit?.mode === 'change' ? 'Änderung beantragen' : 'Urlaub ändern'} onClose={() => setEdit(null)}>
        {edit ? (
          <>
            <View style={styles.row}>
              <View style={styles.f}><TextField label="Von" value={edit.from} onChangeText={(v) => setEdit({ ...edit, from: v })} placeholder="TT.MM.JJJJ" /></View>
              <View style={styles.f}><TextField label="Bis" value={edit.to} onChangeText={(v) => setEdit({ ...edit, to: v })} placeholder="TT.MM.JJJJ" /></View>
            </View>
            {edit.mode === 'edit' ? (
              <>
                <PickChips label="Priorität" showLabel value={edit.prio} onChange={(v) => setEdit({ ...edit, prio: v as '1' | '2' })}
                  options={[{ value: '1', label: '1 · wichtig' }, { value: '2', label: '2 · Ausweichtermin' }]} />
                <TextField label="Notiz" value={edit.note} onChangeText={(v) => setEdit({ ...edit, note: v })} maxLength={300} />
              </>
            ) : <Text variant="xs" color="textMuted">FK4 / SL entscheidet über die Änderung. Bis dahin gilt der bisherige Zeitraum.</Text>}
            <Button label={edit.mode === 'change' ? 'Änderung beantragen' : 'Speichern'} loading={update.isPending || change.isPending}
              disabled={!toIso(edit.from) || !toIso(edit.to) || toIso(edit.to)! < toIso(edit.from)!}
              onPress={() => {
                const f = toIso(edit.from)!, t = toIso(edit.to)!;
                if (edit.mode === 'change') change.mutate({ id: edit.id, kind: 'aenderung', from: f, to: t }, { onSuccess: () => setEdit(null) });
                else update.mutate({ id: edit.id, from: f, to: t, priority: Number(edit.prio) as 1 | 2, note: edit.note }, { onSuccess: () => setEdit(null) });
              }} />
          </>
        ) : null}
      </Sheet>
    </AppScreen>
  );
}

/** Monat im Detail: Grundturnus je Person, darüber Urlaub (Farben) und Flextage, unten die Schichtstärke. */
function MonthDetail({ year, month, staff, byId, settings, entries, list, flex, strength, onDay }: {
  year: number; month: number; staff: Staff[]; byId: Map<string, Staff>; settings: DpSettings; entries: Map<string, import('../../dienstplan/model').Entry>;
  list: VacationReq[]; flex: FlexDay[]; strength: Map<string, number>; onDay: (d: string) => void;
}) {
  const { c } = useTheme();
  const days = monthDays(year, month);
  return (
    <Card style={{ gap: 6 }}>
      <Text variant="lg">{MONTHS[month]} {year}</Text>
      <Text variant="xs" color="textMuted">Buchstabe = Grundturnus (F, M, S, N). Farbe = Urlaub (Wunsch, vorgemerkt, genehmigt) bzw. Flextag (lila).</Text>
      <ScrollView horizontal>
        <View>
          <View style={styles.gRow}>
            <Text variant="xs" style={[styles.pName, styles.bold]}>Name</Text>
            {days.map((d) => (
              <Pressable key={d} onPress={() => onDay(d)} style={[styles.dCell, { backgroundColor: weekday(d) === 6 ? '#475569' : holidayOf(d) ? '#F8E0E7' : 'transparent' }]}>
                <Text style={[styles.dHead, { color: weekday(d) === 6 ? '#FFFFFF' : c.textMuted }]}>{WEEKDAYS[weekday(d)]}</Text>
                <Text style={[styles.dHead, styles.bold, { color: weekday(d) === 6 ? '#FFFFFF' : c.text }]}>{Number(d.slice(8))}</Text>
              </Pressable>
            ))}
          </View>
          {staff.map((st) => (
            <View key={st.id} style={styles.gRow}>
              <Text variant="xs" numberOfLines={1} style={[styles.pName, styles.bold]}>{st.short}</Text>
              {days.map((d) => {
                const base = cellFor(st, d, entries, settings, 'rhythmus', byId).base;
                const v = list.filter((x) => x.staffId === st.id && x.status !== 'abgelehnt' && x.from <= d && d <= x.to).sort((a, b) => RANK[b.status] - RANK[a.status])[0];
                const fx = flex.find((f) => f.staffId === st.id && f.date === d);
                const col = fx ? FLEX_COLOR : v ? STATUS[v.status] : null;
                return (
                  <View key={d} style={[styles.dCell, styles.dBox, { borderColor: c.border, backgroundColor: col?.bg ?? 'transparent' }]}
                    accessibilityLabel={`${st.short} ${Number(d.slice(8))}.: ${base || 'frei'}${v ? `, Urlaub ${STATUS[v.status].label}` : ''}${fx ? ', Flextag' : ''}`}>
                    <Text style={[styles.dCode, { color: col?.fg ?? (base ? c.text : c.textMuted) }]}>{fx ? 'FX' : v ? 'U' : base ? groupLetter(base) : ''}</Text>
                  </View>
                );
              })}
            </View>
          ))}
          <View style={styles.gRow}>
            <Text variant="xs" style={[styles.pName, styles.bold]}>Stärke</Text>
            {days.map((d) => {
              const n = strength.get(d) ?? 0;
              const col = strengthColor(n, settings);
              return (
                <View key={d} style={[styles.dCell, styles.dBox, { borderColor: c.border, backgroundColor: col?.bg ?? 'transparent' }]}>
                  <Text style={[styles.dCode, { color: col?.fg ?? c.text }]}>{n}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </Card>
  );
}

function VacRow({ v, days, name, trailing }: { v: VacationReq; days: number; name: string; trailing?: React.ReactNode }) {
  const st = STATUS[v.status];
  return (
    <View style={styles.vac}>
      <View style={{ flex: 1, minWidth: 180 }}>
        <Text variant="sm" style={styles.bold}>{name} · {short(v.from)}–{toDe(v.to)} · {days} Tage · Prio {v.priority}</Text>
        <Text variant="xs" color="textMuted">
          {[v.note && `„${v.note}“`, v.fk4Name && `vorgemerkt von ${v.fk4Name}`, v.fk3Name && `${v.status === 'genehmigt' ? 'genehmigt' : 'entschieden'} von ${v.fk3Name}`,
            v.reason && `Grund: ${v.reason}`, v.changeKind === 'storno' && 'Storno beantragt', v.changeKind === 'aenderung' && v.changeFrom && `Änderung beantragt: ${short(v.changeFrom)}–${toDe(v.changeTo!)}`]
            .filter(Boolean).join(' · ')}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flexChip: { minHeight: 44, paddingHorizontal: 8, borderRadius: 8, justifyContent: 'center' },
  grid: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 4 },
  gRow: { flexDirection: 'row', alignItems: 'center' },
  mName: { width: 36 },
  yCell: { width: 24, textAlign: 'center', fontSize: 9 },
  yBox: { height: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  yNum: { fontSize: 9, fontFamily: 'Inter_600SemiBold' },
  pName: { width: 92, paddingRight: 4 },
  dCell: { width: 26, alignItems: 'center' },
  dHead: { fontSize: 9 },
  dBox: { height: 22, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  dCode: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
});
