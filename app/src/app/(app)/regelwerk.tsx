import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useActor, useDp, useSaveSettings, useSaveStaff } from '../../dienstplan/hooks';
import { EMPTY_RULES, GROUP_NAMES, type DpSettings, type PersonRules, type ShiftGroup } from '../../dienstplan/model';
import { PersonPicker } from '../../dienstplan/ui';
import { AppScreen } from '../../features/AppScreen';
import { errorText } from '../../features/errors';
import { useTheme } from '../../theme';
import { Banner, Button, Card, Checkbox, SectionHeader, Skeleton, Text, TextField } from '../../ui';

const GROUPS: ShiftGroup[] = ['F', 'M', 'S', 'N'];

/** Regelwerk der Autodisposition: betriebsweite Regeln und Regeln je Person. Nur FK4/SL. */
export default function RulesScreen() {
  const actor = useActor();
  const dp = useDp();
  const saveSettings = useSaveSettings();
  const saveStaff = useSaveStaff();
  const { c } = useTheme();
  const [s, setS] = useState<DpSettings | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [rules, setRules] = useState<PersonRules>(EMPTY_RULES);
  useEffect(() => { if (dp.data && !s) setS(dp.data.settings); }, [dp.data, s]);
  const person = dp.data?.staff.find((x) => x.id === staffId);
  useEffect(() => { setRules({ ...EMPTY_RULES, ...(person?.rules ?? {}) }); saveStaff.reset(); }, [person?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!actor.isLead) return <AppScreen title="Regelwerk" back><Banner tone="info" title="Nur FK4 / SL kann das Regelwerk sehen und ändern." /></AppScreen>;
  if (!dp.data || !s) return <AppScreen title="Regelwerk" back><Skeleton height={300} /></AppScreen>;
  const d = s.dispo;
  const setD = (patch: Partial<DpSettings['dispo']>) => { setS({ ...s, dispo: { ...d, ...patch } }); saveSettings.reset(); };
  const wps = s.workplaces.map((w) => w.code);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const Toggles = ({ label, values, options, onChange, tone }: { label: string; values: string[]; options: { v: string; l: string }[]; onChange: (v: string[]) => void; tone: 'danger' | 'success' }) => (
    <View style={{ gap: 6 }}>
      <Text variant="label" color="textMuted">{label}</Text>
      <View style={styles.chips}>
        {options.map((o) => {
          const on = values.includes(o.v);
          return (
            <Pressable key={o.v} accessibilityRole="checkbox" aria-checked={on} accessibilityLabel={`${label}: ${o.l}`} onPress={() => onChange(toggle(values, o.v))}
              style={[styles.chip, { borderColor: on ? 'transparent' : c.border, backgroundColor: on ? (tone === 'danger' ? c.dangerSoft : c.successSoft) : c.surface }]}>
              <Text variant="sm" color={on ? (tone === 'danger' ? 'onDangerSoft' : 'onSuccessSoft') : 'text'} style={styles.bold}>{o.l}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <AppScreen title="Regelwerk" eyebrow="Autodisposition · FK4 / SL" back>
      <SectionHeader title="Qualifikation je Arbeitsplatz" />
      <Card style={styles.card}>
        <Text variant="xs" color="textMuted">Welche Spalte der Qualifikationsübersicht braucht man für den Arbeitsplatz? „keine“ = keine Prüfung.</Text>
        {wps.map((wp) => (
          <View key={wp} style={styles.row}>
            <Text variant="sm" style={[styles.bold, { width: 44 }]}>{wp}</Text>
            <View style={styles.chips}>
              {['', ...s.qualColumns].map((q) => {
                const on = (d.qualFor[wp] ?? '') === q;
                return (
                  <Pressable key={q || 'none'} accessibilityRole="radio" aria-checked={on} accessibilityLabel={`${wp}: ${q || 'keine'}`}
                    onPress={() => setD({ qualFor: { ...d.qualFor, [wp]: q } })}
                    style={[styles.chip, { borderColor: on ? c.highlight : c.border, borderWidth: on ? 2 : 1, backgroundColor: on ? c.accent : c.surface }]}>
                    <Text variant="xs" color={on ? 'onAccent' : 'text'}>{q || 'keine'}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        <Checkbox label="„(X)“ (geplant bzw. in Ausbildung) gilt als qualifiziert" checked={d.allowPlanned} onChange={(v) => setD({ allowPlanned: v })} />
      </Card>

      <SectionHeader title="Verteilung" />
      <Card style={styles.card}>
        <Checkbox label="Vorlieben und Abneigungen berücksichtigen" checked={d.usePreferences} onChange={(v) => setD({ usePreferences: v })} />
        <Checkbox label="Arbeitsplätze gleichmäßig verteilen (letzte 4 Wochen zählen mit)" checked={d.balance} onChange={(v) => setD({ balance: v })} />
        <Checkbox label="Personen über der Mindestbesetzung trotzdem einem Arbeitsplatz zuweisen" checked={d.distributeSurplus} onChange={(v) => setD({ distributeSurplus: v })} />
        <Text variant="xs" color="textMuted">Mindestbesetzung und erlaubte Schichten je Arbeitsplatz stehen unter „Einstellungen Dienstplan“.</Text>
        {saveSettings.isError ? <Banner tone="danger" title={errorText(saveSettings.error)} /> : null}
        {saveSettings.isSuccess ? <Banner tone="success" title="Regelwerk gespeichert." /> : null}
        <Button label="Regelwerk speichern" loading={saveSettings.isPending} onPress={() => saveSettings.mutate(s)} />
      </Card>

      <SectionHeader title="Regeln je Person" />
      <Card style={styles.card}>
        <Text variant="xs" color="textMuted">Gesundheitliche Einschränkungen und Vorlieben. Nur für FK4 / SL sichtbar.</Text>
        <PersonPicker value={staffId} onChange={setStaffId} options={dp.data.staff.filter((x) => x.inPlan).map((x) => ({ value: x.id, label: x.short }))} />
        {person ? (
          <>
            <Toggles label="Gesperrte Schichten" tone="danger" values={rules.noGroups} onChange={(v) => setRules({ ...rules, noGroups: v as ShiftGroup[] })}
              options={GROUPS.map((g) => ({ v: g, l: `${g} · ${GROUP_NAMES[g]}` }))} />
            <Toggles label="Gesperrte Arbeitsplätze" tone="danger" values={rules.noWorkplaces} onChange={(v) => setRules({ ...rules, noWorkplaces: v })}
              options={wps.map((w) => ({ v: w, l: w }))} />
            <Toggles label="Bevorzugt" tone="success" values={rules.prefer} onChange={(v) => setRules({ ...rules, prefer: v, avoid: rules.avoid.filter((x) => !v.includes(x)) })}
              options={wps.map((w) => ({ v: w, l: w }))} />
            <Toggles label="Möglichst nicht" tone="danger" values={rules.avoid} onChange={(v) => setRules({ ...rules, avoid: v, prefer: rules.prefer.filter((x) => !v.includes(x)) })}
              options={wps.map((w) => ({ v: w, l: w }))} />
            <TextField label="Notiz (z. B. gesundheitliche Einschränkung, befristet bis …)" value={rules.healthNote} multiline maxLength={500}
              onChangeText={(v) => setRules({ ...rules, healthNote: v })} />
            {saveStaff.isError ? <Banner tone="danger" title={errorText(saveStaff.error)} /> : null}
            {saveStaff.isSuccess ? <Banner tone="success" title={`Regeln für ${person.short} gespeichert.`} /> : null}
            <Button label={`Regeln für ${person.short} speichern`} loading={saveStaff.isPending} onPress={() => saveStaff.mutate({ ...person, rules })} />
          </>
        ) : null}
        <View style={{ gap: 4 }}>
          <Text variant="label" color="textMuted">Personen mit Regeln</Text>
          {dp.data.staff.filter((x) => x.rules && (x.rules.noGroups.length || x.rules.noWorkplaces.length || x.rules.prefer.length || x.rules.avoid.length)).map((x) => (
            <Text key={x.id} variant="sm">
              {x.short}: {[x.rules!.noGroups.length ? `keine ${x.rules!.noGroups.join(', ')}` : '', x.rules!.noWorkplaces.length ? `nicht ${x.rules!.noWorkplaces.join(', ')}` : '',
                x.rules!.prefer.length ? `bevorzugt ${x.rules!.prefer.join(', ')}` : '', x.rules!.avoid.length ? `möglichst nicht ${x.rules!.avoid.join(', ')}` : ''].filter(Boolean).join(' · ')}
            </Text>
          ))}
        </View>
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 40, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bold: { fontFamily: 'Inter_600SemiBold' },
});
