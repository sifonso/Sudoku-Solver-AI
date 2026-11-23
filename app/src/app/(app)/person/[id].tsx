import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useMembers } from '../../../data/hooks';
import { useActive } from '../../../data/session';
import { canLead, useDeleteStaff, useDp, useSaveStaff } from '../../../dienstplan/hooks';
import { displayName, entitlementOf, type Staff, type TempRhythm } from '../../../dienstplan/model';
import { PersonPicker, PickChips } from '../../../dienstplan/ui';
import { AppScreen } from '../../../features/AppScreen';
import { errorText } from '../../../features/errors';
import { useTheme } from '../../../theme';
import { Banner, Button, Card, Checkbox, SectionHeader, Skeleton, Text, TextField } from '../../../ui';

const QUAL_CYCLE = ['', 'X', '(X)', 'Y'];

/** Stammdaten einer Person: Name, Zuordnung, Qualifikationen, Telefon, Verknüpfung mit dem Login. */
export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { member } = useActive();
  const lead = canLead(member.role);
  const dp = useDp();
  const members = useMembers();
  const save = useSaveStaff();
  const { c } = useTheme();
  const [s, setS] = useState<Staff | null>(null);

  useEffect(() => {
    if (!dp.data || s) return;
    const found = dp.data.staff.find((x) => x.id === id) ?? dp.data.archived.find((x) => x.id === id);
    const len = dp.data.settings.rhythmLength;
    setS(found ?? {
      id: `p${Date.now().toString(36)}`, short: '', firstName: '', lastName: '', nr: '', sort: dp.data.staff.length + 1,
      inPlan: true, isLead: false, teamLeadId: null, rhythm: Array(len).fill(''), quals: {}, phonePrivate: '', phoneMobile: '',
      persNr: '', whatsapp: '', memberId: null,
    });
  }, [dp.data, id, s]);

  if (!dp.data || !s) return <AppScreen title="Person" back><Skeleton height={300} /></AppScreen>;
  const set = (patch: Partial<Staff>) => setS({ ...s, ...patch });
  const leads = dp.data.staff.filter((x) => x.isLead && x.id !== s.id);
  const linked = new Set(dp.data.staff.filter((x) => x.id !== s.id && x.memberId).map((x) => x.memberId));
  const valid = s.lastName.trim() && (s.short.trim() || s.lastName.trim());

  return (
    <AppScreen title={displayName(s) || 'Neue Person'} eyebrow="Team" back>
      {!lead ? <Banner tone="info" title="Nur FK4 / SL kann Angaben ändern." /> : null}
      <Card style={styles.card}>
        <View style={styles.row2}>
          <View style={styles.f}><TextField label="Vorname" value={s.firstName} editable={lead} onChangeText={(v) => set({ firstName: v })} /></View>
          <View style={styles.f}><TextField label="Nachname" value={s.lastName} editable={lead} onChangeText={(v) => set({ lastName: v })} /></View>
        </View>
        <View style={styles.row2}>
          <View style={styles.f}><TextField label="Kurzname im Plan" value={s.short} editable={lead} onChangeText={(v) => set({ short: v })} hint="z. B. „Andrik J.“" /></View>
          <View style={styles.f}><TextField label="Nr. im Plan" value={s.nr} editable={lead} onChangeText={(v) => set({ nr: v })} /></View>
        </View>
        <Checkbox label="Im Monatsplan" checked={s.inPlan} disabled={!lead} onChange={(v) => set({ inPlan: v })} />
        <Checkbox label="Leitet ein Team (FK4 / SL)" checked={s.isLead} disabled={!lead} onChange={(v) => set({ isLead: v, teamLeadId: v ? null : s.teamLeadId })} />
        {!s.isLead ? (
          <PickChips label="Team von" showLabel value={s.teamLeadId ?? ''} onChange={(v) => lead && set({ teamLeadId: v || null })}
            options={[{ value: '', label: 'ohne' }, ...leads.map((l) => ({ value: l.id, label: l.short }))]} />
        ) : null}
        {s.inPlan ? (
          <Button label="Grundrhythmus ansehen" variant="secondary" onPress={() => router.push({ pathname: '/rhythmus', params: { staff: s.id } })} />
        ) : null}
      </Card>

      {s.inPlan ? (
        <>
          <SectionHeader title="Vorübergehender Turnus" />
          <TempRhythmEditor staff={s} all={dp.data.staff} canEdit={lead} onChange={(overrides) => set({ overrides })} />
        </>
      ) : null}

      <SectionHeader title="Qualifikationen" />
      <Card style={styles.quals}>
        {dp.data.settings.qualColumns.map((q) => {
          const v = s.quals?.[q] ?? '';
          return (
            <Pressable key={q} disabled={!lead} accessibilityRole="button" accessibilityLabel={`${q}: ${v || 'keine'}${lead ? ', antippen zum Wechseln' : ''}`}
              onPress={() => set({ quals: { ...s.quals, [q]: QUAL_CYCLE[(QUAL_CYCLE.indexOf(v) + 1) % QUAL_CYCLE.length] ?? '' } })}
              style={[styles.qual, { borderColor: c.border, backgroundColor: v === 'X' ? c.successSoft : v ? c.highlightSoft : c.surface }]}>
              <Text variant="sm" style={{ flex: 1 }}>{q}</Text>
              <Text variant="sm" style={styles.bold}>{v || '–'}</Text>
            </Pressable>
          );
        })}
        <Text variant="xs" color="textMuted">X vorhanden · (X) geplant bzw. in Ausbildung · Y verfallen, wird nicht beplant</Text>
      </Card>

      <SectionHeader title="Kontakt" />
      <Card style={styles.card}>
        <View style={styles.row2}>
          <View style={styles.f}><TextField label="Mobil" value={s.phoneMobile} editable={lead} keyboardType="phone-pad" onChangeText={(v) => set({ phoneMobile: v })} /></View>
          <View style={styles.f}><TextField label="Privat" value={s.phonePrivate} editable={lead} keyboardType="phone-pad" onChangeText={(v) => set({ phonePrivate: v })} /></View>
        </View>
        <View style={styles.row2}>
          <View style={styles.f}><TextField label="WhatsApp" value={s.whatsapp} editable={lead} onChangeText={(v) => set({ whatsapp: v })} hint="ok / nok" /></View>
          {lead ? <View style={styles.f}><TextField label="Teilzeit (% von Vollzeit)" value={s.partTimePct == null ? '' : String(s.partTimePct)} keyboardType="number-pad"
            placeholder="100" onChangeText={(v) => { const n = Number(v); set({ partTimePct: v.trim() === '' ? null : Number.isFinite(n) && n > 0 && n <= 100 ? n : s.partTimePct }); }} /></View> : null}
          {lead ? <View style={styles.f}><TextField label="Urlaubsanspruch fest (Tage)" value={s.vacationDays == null ? '' : String(s.vacationDays)} keyboardType="number-pad"
            placeholder="automatisch" onChangeText={(v) => set({ vacationDays: v.trim() === '' ? null : Number.isInteger(Number(v)) ? Number(v) : s.vacationDays })} /></View> : null}
        </View>
        {lead && dp.data ? (
          <>
            <PickChips label="Zusatzurlaub Wechselschicht (F, S, N)" showLabel value={s.shiftBonus == null ? 'auto' : s.shiftBonus ? 'ja' : 'nein'}
              onChange={(v) => set({ shiftBonus: v === 'auto' ? null : v === 'ja' })}
              options={[{ value: 'auto', label: 'automatisch (Turnus)' }, { value: 'ja', label: 'ja' }, { value: 'nein', label: 'nein' }]} />
            {(() => { const e = entitlementOf(s, dp.data.settings); return (
              <Text variant="sm" color="textMuted">Urlaubsanspruch: {e.total} Tage{e.manual ? ' (fest eingetragen)' : ` = ${e.base} Grundurlaub${e.bonus ? ` + ${e.bonus} Wechselschicht` : ''}`}</Text>
            ); })()}
          </>
        ) : null}
        <View style={styles.row2}>
          {lead ? <View style={styles.f}><TextField label="Personalnummer" value={s.persNr} onChangeText={(v) => set({ persNr: v })} hint="nur für FK4 / SL sichtbar" /></View> : null}
        </View>
      </Card>

      {lead ? (
        <>
          <SectionHeader title="Login" />
          <Card style={styles.card}>
            <Text variant="sm" color="textMuted">Wer mit diesem Login angemeldet ist, sieht seine Zeile hervorgehoben und kann eigene Dienste tauschen.</Text>
            {!s.memberId ? (
              <Button label={`${s.firstName || s.short} einladen (Login anlegen)`} variant="secondary"
                onPress={() => router.push({ pathname: '/mitarbeiter/neu', params: { name: displayName(s), staff: s.id } })} />
            ) : null}
            <PickChips label="Verknüpft mit" showLabel value={s.memberId ?? ''} onChange={(v) => set({ memberId: v || null })}
              options={[{ value: '', label: 'kein Login' }, ...(members.data ?? []).filter((m) => !linked.has(m.id)).map((m) => ({ value: m.id, label: m.displayName }))]} />
          </Card>
          {save.isError ? <Banner tone="danger" title={errorText(save.error)} /> : null}
          {save.isSuccess ? <Banner tone="success" title="Gespeichert." /> : null}
          <Button label="Speichern" size="lg" disabled={!valid} loading={save.isPending}
            onPress={() => save.mutate({ ...s, short: s.short.trim() || s.lastName.trim() })} />
          {dp.data.staff.some((x) => x.id === s.id) || dp.data.archived.some((x) => x.id === s.id) ? (
            <Remove staff={s} onArchived={(a) => setS({ ...s, archived: a, inPlan: a ? false : s.inPlan })} />
          ) : null}
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  row2: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  f: { flexGrow: 1, flexBasis: 220 },
  quals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  qual: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, flexBasis: 220, flexGrow: 1 },
  bold: { fontFamily: 'Inter_700Bold' },
});

const toIso = (de: string) => {
  const m = de.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return m ? `${m[3]}-${(m[2] ?? '').padStart(2, '0')}-${(m[1] ?? '').padStart(2, '0')}` : null;
};
const toDe = (iso: string) => `${iso.slice(8)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const KIND_LABEL: Record<TempRhythm['kind'], string> = { follow: 'Wie Kolleg:in (z. B. Ausbildung beim Trainer)', shift: 'Eigener Turnus verschoben', none: 'Ohne Turnus' };

/** Zeitlich begrenzter Wechsel: In diesem Zeitraum wird der eigene Grundturnus nicht angezeigt. */
function TempRhythmEditor({ staff, all, canEdit, onChange }: { staff: Staff; all: Staff[]; canEdit: boolean; onChange: (o: TempRhythm[]) => void }) {
  const list = staff.overrides ?? [];
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [kind, setKind] = useState<TempRhythm['kind']>('follow');
  const [followId, setFollowId] = useState<string | null>(null);
  const [weeks, setWeeks] = useState('1');
  const [note, setNote] = useState('');
  const fi = toIso(from), ti = toIso(to);
  const overlap = !!fi && !!ti && list.some((o) => o.from <= ti && fi <= o.to);
  const valid = !!fi && !!ti && fi <= ti && !overlap && (kind !== 'follow' || !!followId) && (kind !== 'shift' || Number.isInteger(Number(weeks)));
  const name = (id?: string | null) => all.find((x) => x.id === id)?.short ?? '?';
  return (
    <Card style={{ gap: 10 }}>
      <Text variant="xs" color="textMuted">Für die Zeit gilt statt des Grundturnus der hier gewählte Turnus; graue Grundturnus-Kürzel werden nicht angezeigt. Feinplan-Einträge haben weiter Vorrang.</Text>
      {list.length === 0 ? <Text variant="sm" color="textMuted">Keiner eingetragen.</Text> : list.map((o) => (
        <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text variant="sm" style={{ fontFamily: 'Inter_600SemiBold' }}>{toDe(o.from)} – {toDe(o.to)}</Text>
            <Text variant="xs" color="textMuted">
              {o.kind === 'follow' ? `Wie ${name(o.followId)}` : o.kind === 'shift' ? `Verschoben um ${o.weeks} Woche(n)` : 'Ohne Turnus'}{o.note ? ` · ${o.note}` : ''}
            </Text>
          </View>
          {canEdit ? <Button label="Entfernen" size="sm" variant="ghost" onPress={() => onChange(list.filter((x) => x.id !== o.id))} /> : null}
        </View>
      ))}
      {canEdit ? (
        <>
          <View style={styles.row2}>
            <View style={styles.f}><TextField label="Von" value={from} onChangeText={setFrom} placeholder="TT.MM.JJJJ" /></View>
            <View style={styles.f}><TextField label="Bis" value={to} onChangeText={setTo} placeholder="TT.MM.JJJJ" error={overlap ? 'Überschneidet sich mit einem Eintrag.' : undefined} /></View>
          </View>
          <PickChips label="Art" showLabel value={kind} onChange={(v) => setKind(v as TempRhythm['kind'])}
            options={(['follow', 'shift', 'none'] as const).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
          {kind === 'follow' ? (
            <PersonPicker value={followId} onChange={setFollowId} options={all.filter((x) => x.inPlan && x.id !== staff.id).map((x) => ({ value: x.id, label: x.short }))} />
          ) : null}
          {kind === 'shift' ? <TextField label="Verschiebung in Wochen (auch negativ)" value={weeks} onChangeText={setWeeks} keyboardType="numbers-and-punctuation" /> : null}
          <TextField label="Notiz (optional)" value={note} onChangeText={setNote} placeholder="z. B. Einarbeitung T1" />
          <Button label="Zeitraum hinzufügen" variant="secondary" disabled={!valid} onPress={() => {
            onChange([...list, { id: `t${Date.now().toString(36)}`, from: fi!, to: ti!, kind, followId: kind === 'follow' ? followId : null, weeks: kind === 'shift' ? Number(weeks) : undefined, note: note.trim() }]
              .sort((a, b) => a.from.localeCompare(b.from)));
            setFrom(''); setTo(''); setNote('');
          }} />
          <Text variant="xs" color="textMuted">Wirksam nach „Speichern“ unten.</Text>
        </>
      ) : null}
    </Card>
  );
}

/** Aus dem Team entfernen (Plan-Historie bleibt) oder endgültig löschen. */
function Remove({ staff, onArchived }: { staff: Staff; onArchived: (a: boolean) => void }) {
  const save = useSaveStaff();
  const del = useDeleteStaff();
  const [confirm, setConfirm] = useState<'none' | 'archive' | 'delete'>('none');
  if (staff.archived) {
    return (
      <Card style={{ gap: 10 }}>
        <Text variant="sm">{staff.short} ist aus dem Team entfernt. Alte Dienste bleiben im Plan und im Protokoll.</Text>
        <Button label="Wieder ins Team aufnehmen" variant="secondary" loading={save.isPending}
          onPress={() => save.mutate({ ...staff, archived: false, inPlan: true }, { onSuccess: () => onArchived(false) })} />
        {confirm === 'delete' ? (
          <>
            <Banner tone="danger" title="Endgültig löschen?" body="Person, alle Dienste, Kommentare und Tausche dieser Person werden gelöscht. Das lässt sich nicht rückgängig machen." />
            <Button label="Endgültig löschen" variant="danger" loading={del.isPending} onPress={() => del.mutate(staff.id, { onSuccess: () => router.replace('/team') })} />
            <Button label="Abbrechen" variant="ghost" onPress={() => setConfirm('none')} />
          </>
        ) : <Button label="Endgültig löschen …" variant="ghost" onPress={() => setConfirm('delete')} />}
      </Card>
    );
  }
  return (
    <Card style={{ gap: 10 }}>
      {confirm === 'archive' ? (
        <>
          <Text variant="sm">{staff.short} wird aus Monatsplan, Team und Autodisposition entfernt. Bisherige Dienste bleiben erhalten.</Text>
          <Button label="Aus dem Team entfernen" variant="danger" loading={save.isPending}
            onPress={() => save.mutate({ ...staff, archived: true, inPlan: false }, { onSuccess: () => { onArchived(true); setConfirm('none'); } })} />
          <Button label="Abbrechen" variant="ghost" onPress={() => setConfirm('none')} />
        </>
      ) : <Button label="Aus dem Team entfernen …" variant="ghost" onPress={() => setConfirm('archive')} />}
      {save.isError ? <Banner tone="danger" title={errorText(save.error)} /> : null}
    </Card>
  );
}
