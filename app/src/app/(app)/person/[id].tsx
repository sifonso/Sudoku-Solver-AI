import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useMembers } from '../../../data/hooks';
import { useActive } from '../../../data/session';
import { canLead, useDp, useSaveStaff } from '../../../dienstplan/hooks';
import { displayName, type Staff } from '../../../dienstplan/model';
import { PickChips } from '../../../dienstplan/ui';
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
    const found = dp.data.staff.find((x) => x.id === id);
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
          {lead ? <View style={styles.f}><TextField label="Personalnummer" value={s.persNr} onChangeText={(v) => set({ persNr: v })} hint="nur für FK4 / SL sichtbar" /></View> : null}
        </View>
      </Card>

      {lead ? (
        <>
          <SectionHeader title="Login" />
          <Card style={styles.card}>
            <Text variant="sm" color="textMuted">Wer mit diesem Login angemeldet ist, sieht seine Zeile hervorgehoben und kann eigene Dienste tauschen.</Text>
            <PickChips label="Verknüpft mit" showLabel value={s.memberId ?? ''} onChange={(v) => set({ memberId: v || null })}
              options={[{ value: '', label: 'kein Login' }, ...(members.data ?? []).filter((m) => !linked.has(m.id)).map((m) => ({ value: m.id, label: m.displayName }))]} />
          </Card>
          {save.isError ? <Banner tone="danger" title={errorText(save.error)} /> : null}
          {save.isSuccess ? <Banner tone="success" title="Gespeichert." /> : null}
          <Button label="Speichern" size="lg" disabled={!valid} loading={save.isPending}
            onPress={() => save.mutate({ ...s, short: s.short.trim() || s.lastName.trim() })} />
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
