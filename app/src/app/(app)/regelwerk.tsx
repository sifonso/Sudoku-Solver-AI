import { ArrowUp, Plus, Trash2, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useActor, useDp, useSaveCarpools, useSaveSettings, useSaveStaff } from '../../dienstplan/hooks';
import { EMPTY_RULES, GROUP_NAMES, type Carpool, type DpSettings, type PersonRules, type ShiftGroup, type Staff } from '../../dienstplan/model';
import { PersonPicker } from '../../dienstplan/ui';
import { AppScreen } from '../../features/AppScreen';
import { errorText } from '../../features/errors';
import { useTheme } from '../../theme';
import { Banner, Button, Card, Checkbox, IconButton, SectionHeader, Skeleton, Text, TextField } from '../../ui';

const GROUPS: ShiftGroup[] = ['F', 'M', 'S', 'N'];
const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Regelwerk der Autodisposition: betriebsweit, Qualifikationen, Fahrgemeinschaften und Regeln je Person. Nur FK4/SL. */
export default function RulesScreen() {
  const actor = useActor();
  const dp = useDp();
  const saveSettings = useSaveSettings();
  const saveStaff = useSaveStaff();
  const saveCarpools = useSaveCarpools();
  const [s, setS] = useState<DpSettings | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [rules, setRules] = useState<PersonRules>(EMPTY_RULES);
  const [newQual, setNewQual] = useState('');
  const [rename, setRename] = useState<{ from: string; to: string } | null>(null);
  const [pool, setPool] = useState<Carpool[] | null>(null);
  const [cpA, setCpA] = useState<string | null>(null);
  const [cpB, setCpB] = useState<string | null>(null);
  useEffect(() => { if (dp.data && !s) setS(dp.data.settings); }, [dp.data, s]);
  useEffect(() => { if (dp.data && !pool) setPool(dp.data.carpools); }, [dp.data, pool]);
  const person = dp.data?.staff.find((x) => x.id === staffId);
  useEffect(() => { setRules({ ...EMPTY_RULES, ...(person?.rules ?? {}) }); saveStaff.reset(); }, [person?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!actor.isLead) return <AppScreen title="Regelwerk" back><Banner tone="info" title="Nur FK4 / SL kann das Regelwerk sehen und ändern." /></AppScreen>;
  if (!dp.data || !s || !pool) return <AppScreen title="Regelwerk" back><Skeleton height={300} /></AppScreen>;
  const d = s.dispo;
  const setD = (patch: Partial<DpSettings['dispo']>) => { setS({ ...s, dispo: { ...d, ...patch } }); saveSettings.reset(); };
  const wps = s.workplaces.map((w) => w.code);
  const combos = wps.flatMap((w) => GROUPS.map((g) => `${w}/${g}`));
  const planned = dp.data.staff.filter((x) => x.inPlan);
  const name = (id: string) => dp.data!.staff.find((x) => x.id === id)?.short ?? id;

  /** Qualifikation umbenennen: Spalte, Zuordnung je Arbeitsplatz und Werte aller Personen. */
  const renameQual = async (from: string, to: string) => {
    const t = to.trim();
    if (!t || t === from || s.qualColumns.includes(t)) return;
    const next: DpSettings = {
      ...s, qualColumns: s.qualColumns.map((q) => (q === from ? t : q)),
      dispo: { ...d, qualFor: Object.fromEntries(Object.entries(d.qualFor).map(([wp, qs]) => [wp, qs.map((q) => (q === from ? t : q))])) },
    };
    setS(next);
    await saveSettings.mutateAsync(next);
    for (const st of dp.data!.staff.filter((x) => from in (x.quals ?? {}))) {
      const { [from]: v, ...rest } = st.quals;
      await saveStaff.mutateAsync({ ...st, quals: { ...rest, [t]: v ?? '' } } as Staff);
    }
    setRename(null);
  };

  return (
    <AppScreen title="Regelwerk" eyebrow="Autodisposition · FK4 / SL" back>
      <SectionHeader title="Qualifikationen" />
      <Card style={styles.card}>
        <Text variant="xs" color="textMuted">Spalten der Qualifikationsübersicht. Umbenennen ändert auch alle Personen und Zuordnungen.</Text>
        {s.qualColumns.map((q) => (
          <View key={q} style={styles.row}>
            {rename?.from === q ? (
              <>
                <View style={{ flex: 1 }}><TextField label={`„${q}“ umbenennen`} value={rename.to} onChangeText={(v) => setRename({ from: q, to: v })} /></View>
                <Button label="Übernehmen" size="sm" onPress={() => renameQual(q, rename.to)} loading={saveSettings.isPending || saveStaff.isPending} />
                <IconButton icon={X} label="Abbrechen" onPress={() => setRename(null)} />
              </>
            ) : (
              <>
                <Text variant="sm" style={[styles.bold, { flex: 1 }]}>{q}</Text>
                <Button label="Umbenennen" size="sm" variant="ghost" onPress={() => setRename({ from: q, to: q })} />
                <IconButton icon={Trash2} label={`${q} entfernen`} onPress={() => setS({ ...s, qualColumns: s.qualColumns.filter((x) => x !== q),
                  dispo: { ...d, qualFor: Object.fromEntries(Object.entries(d.qualFor).map(([wp, qs]) => [wp, qs.filter((x) => x !== q)])) } })} />
              </>
            )}
          </View>
        ))}
        <View style={styles.row}>
          <View style={{ flex: 1 }}><TextField label="Neue Qualifikation" value={newQual} onChangeText={setNewQual} /></View>
          <Button label="Hinzufügen" icon={Plus} size="sm" variant="secondary" disabled={!newQual.trim() || s.qualColumns.includes(newQual.trim())}
            onPress={() => { setS({ ...s, qualColumns: [...s.qualColumns, newQual.trim()] }); setNewQual(''); }} />
        </View>
      </Card>

      <SectionHeader title="Qualifikation je Arbeitsplatz" />
      <Card style={styles.card}>
        <Text variant="xs" color="textMuted">Mehrfachauswahl möglich. Keine Auswahl = keine Prüfung.</Text>
        {wps.map((wp) => (
          <View key={wp} style={{ gap: 6 }}>
            <View style={styles.row}>
              <Text variant="sm" style={[styles.bold, { width: 44 }]}>{wp}</Text>
              <Chips values={d.qualFor[wp] ?? []} options={s.qualColumns.map((q) => ({ v: q, l: q }))} label={`Qualifikation ${wp}`}
                onChange={(v) => setD({ qualFor: { ...d.qualFor, [wp]: v } })} />
            </View>
            {(d.qualFor[wp] ?? []).length > 1 ? (
              <View style={{ paddingLeft: 52 }}>
                <Checkbox label="Alle gewählten nötig (sonst genügt eine)" checked={d.qualAll[wp] !== false} onChange={(v) => setD({ qualAll: { ...d.qualAll, [wp]: v } })} />
              </View>
            ) : null}
          </View>
        ))}
        <Checkbox label="„(X)“ (geplant bzw. in Ausbildung) gilt als qualifiziert" checked={d.allowPlanned} onChange={(v) => setD({ allowPlanned: v })} />
      </Card>

      <SectionHeader title="Reihenfolge der Besetzung" />
      <Card style={styles.card}>
        <Text variant="sm" style={styles.bold}>1. Zwingend erforderlich (je einmal pro Tag)</Text>
        <Text variant="xs" color="textMuted">Bleibt einer davon frei, zeigt der Monatsplan FK4 / SL einen Hinweis.</Text>
        <Chips values={d.required} options={combos.map((k) => ({ v: k, l: k }))} label="Pflichtdienste" onChange={(v) => setD({ required: v })} />
        <Text variant="sm" style={styles.bold}>2. Danach in dieser Reihenfolge</Text>
        {d.secondary.map((k, i) => (
          <View key={k} style={styles.row}>
            <Text variant="sm" style={{ width: 24 }}>{i + 1}.</Text>
            <Text variant="sm" style={[styles.bold, { flex: 1 }]}>{k}</Text>
            {i > 0 ? <IconButton icon={ArrowUp} label={`${k} nach oben`} onPress={() => { const n = [...d.secondary]; [n[i - 1], n[i]] = [n[i]!, n[i - 1]!]; setD({ secondary: n }); }} /> : null}
            <IconButton icon={Trash2} label={`${k} entfernen`} onPress={() => setD({ secondary: d.secondary.filter((x) => x !== k) })} />
          </View>
        ))}
        <Chips values={[]} options={combos.filter((k) => !d.secondary.includes(k)).map((k) => ({ v: k, l: `+ ${k}` }))} label="Zusatzdienst anhängen"
          onChange={(v) => setD({ secondary: [...d.secondary, ...v] })} />
        <Checkbox label="3. Alle Übrigen bekommen einen Dienst ohne Arbeitsplatz (F, M, S)" checked={d.nakedRest} onChange={(v) => setD({ nakedRest: v })} />
      </Card>

      <SectionHeader title="Verteilung" />
      <Card style={styles.card}>
        <Checkbox label="Vorlieben und Abneigungen berücksichtigen" checked={d.usePreferences} onChange={(v) => setD({ usePreferences: v })} />
        <Checkbox label="Arbeitsplätze gleichmäßig verteilen (letzte 4 Wochen zählen mit)" checked={d.balance} onChange={(v) => setD({ balance: v })} />
        <Checkbox label="Fahrgemeinschaften: gleiche Dienstzeiten bevorzugen" checked={d.carpools} onChange={(v) => setD({ carpools: v })} />
        {saveSettings.isError ? <Banner tone="danger" title={errorText(saveSettings.error)} /> : null}
        {saveSettings.isSuccess ? <Banner tone="success" title="Regelwerk gespeichert." /> : null}
        <Button label="Regelwerk speichern" loading={saveSettings.isPending} onPress={() => saveSettings.mutate(s)} />
      </Card>

      <SectionHeader title="Fahrgemeinschaften" />
      <Card style={styles.card}>
        {pool.length === 0 ? <Text variant="sm" color="textMuted">Keine eingetragen.</Text> : pool.map((cp, i) => (
          <View key={cp.name + i} style={styles.row}>
            <Text variant="sm" style={{ flex: 1 }}><Text variant="sm" style={styles.bold}>{cp.name}:</Text> {cp.members.map(name).join(', ')}</Text>
            <IconButton icon={Trash2} label={`${cp.name} entfernen`} onPress={() => setPool(pool.filter((_, j) => j !== i))} />
          </View>
        ))}
        <Text variant="label" color="textMuted">Neue Fahrgemeinschaft</Text>
        <PersonPicker label="Mitfahrer:in 1" value={cpA} onChange={setCpA} options={planned.map((x) => ({ value: x.id, label: x.short }))} />
        <PersonPicker label="Mitfahrer:in 2" value={cpB} onChange={setCpB} options={planned.filter((x) => x.id !== cpA).map((x) => ({ value: x.id, label: x.short }))} />
        <View style={styles.row}>
          <Button label="Hinzufügen" icon={Plus} size="sm" variant="secondary" disabled={!cpA || !cpB || cpA === cpB}
            onPress={() => { setPool([...pool, { name: `Fahrgemeinschaft ${pool.length + 1}`, members: [cpA!, cpB!] }]); setCpA(null); setCpB(null); }} />
          <Button label="Fahrgemeinschaften speichern" size="sm" loading={saveCarpools.isPending} onPress={() => saveCarpools.mutate(pool)} />
        </View>
        {saveCarpools.isSuccess ? <Banner tone="success" title="Fahrgemeinschaften gespeichert." /> : null}
        {saveCarpools.isError ? <Banner tone="danger" title={errorText(saveCarpools.error)} /> : null}
      </Card>

      <SectionHeader title="Regeln je Person" />
      <Card style={styles.card}>
        <Text variant="xs" color="textMuted">Gesundheitliche Einschränkungen und Vorlieben. Nur für FK4 / SL sichtbar.</Text>
        <PersonPicker value={staffId} onChange={setStaffId} options={planned.map((x) => ({ value: x.id, label: x.short }))} />
        {person ? (
          <>
            <Labeled label="Gesperrte Schichten"><Chips tone="danger" values={rules.noGroups} label="Gesperrte Schichten"
              options={GROUPS.map((g) => ({ v: g, l: `${g} · ${GROUP_NAMES[g]}` }))} onChange={(v) => setRules({ ...rules, noGroups: v as ShiftGroup[] })} /></Labeled>
            <Labeled label="Gesperrte Arbeitsplätze"><Chips tone="danger" values={rules.noWorkplaces} label="Gesperrte Arbeitsplätze"
              options={wps.map((w) => ({ v: w, l: w }))} onChange={(v) => setRules({ ...rules, noWorkplaces: v })} /></Labeled>
            <Labeled label="Bevorzugte Schichten"><Chips tone="success" values={rules.preferGroups} label="Bevorzugte Schichten"
              options={GROUPS.map((g) => ({ v: g, l: g }))} onChange={(v) => setRules({ ...rules, preferGroups: v as ShiftGroup[], avoidGroups: rules.avoidGroups.filter((x) => !v.includes(x)) })} /></Labeled>
            <Labeled label="Möglichst nicht diese Schichten"><Chips tone="danger" values={rules.avoidGroups} label="Möglichst nicht diese Schichten"
              options={GROUPS.map((g) => ({ v: g, l: g }))} onChange={(v) => setRules({ ...rules, avoidGroups: v as ShiftGroup[], preferGroups: rules.preferGroups.filter((x) => !v.includes(x)) })} /></Labeled>
            <Labeled label="Bevorzugte Arbeitsplätze"><Chips tone="success" values={rules.prefer} label="Bevorzugte Arbeitsplätze"
              options={wps.map((w) => ({ v: w, l: w }))} onChange={(v) => setRules({ ...rules, prefer: v, avoid: rules.avoid.filter((x) => !v.includes(x)) })} /></Labeled>
            <Labeled label="Möglichst nicht diese Arbeitsplätze"><Chips tone="danger" values={rules.avoid} label="Möglichst nicht diese Arbeitsplätze"
              options={wps.map((w) => ({ v: w, l: w }))} onChange={(v) => setRules({ ...rules, avoid: v, prefer: rules.prefer.filter((x) => !v.includes(x)) })} /></Labeled>
            <TextField label="Notiz (z. B. gesundheitliche Einschränkung, befristet bis …)" value={rules.healthNote} multiline maxLength={500}
              onChangeText={(v) => setRules({ ...rules, healthNote: v })} />
            {saveStaff.isError ? <Banner tone="danger" title={errorText(saveStaff.error)} /> : null}
            {saveStaff.isSuccess ? <Banner tone="success" title={`Regeln für ${person.short} gespeichert.`} /> : null}
            <Button label={`Regeln für ${person.short} speichern`} loading={saveStaff.isPending} onPress={() => saveStaff.mutate({ ...person, rules })} />
          </>
        ) : null}
        <View style={{ gap: 4 }}>
          <Text variant="label" color="textMuted">Personen mit Regeln</Text>
          {dp.data.staff.filter((x) => x.rules && Object.entries(x.rules).some(([k, v]) => k !== 'healthNote' && Array.isArray(v) && v.length)).map((x) => {
            const r = { ...EMPTY_RULES, ...x.rules };
            return (
              <Text key={x.id} variant="sm">
                {x.short}: {[r.noGroups.length ? `keine ${r.noGroups.join(', ')}` : '', r.noWorkplaces.length ? `nicht ${r.noWorkplaces.join(', ')}` : '',
                  r.preferGroups.length ? `gern ${r.preferGroups.join(', ')}` : '', r.avoidGroups.length ? `ungern ${r.avoidGroups.join(', ')}` : '',
                  r.prefer.length ? `bevorzugt ${r.prefer.join(', ')}` : '', r.avoid.length ? `möglichst nicht ${r.avoid.join(', ')}` : ''].filter(Boolean).join(' · ')}
              </Text>
            );
          })}
        </View>
      </Card>
    </AppScreen>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={{ gap: 6 }}><Text variant="label" color="textMuted">{label}</Text>{children}</View>;
}

function Chips({ values, options, onChange, label, tone = 'accent' }: {
  values: string[]; options: { v: string; l: string }[]; onChange: (v: string[]) => void; label: string; tone?: 'accent' | 'danger' | 'success';
}) {
  const { c } = useTheme();
  const on = (v: string) => values.includes(v);
  const bg = tone === 'danger' ? c.dangerSoft : tone === 'success' ? c.successSoft : c.accent;
  const fg = tone === 'danger' ? 'onDangerSoft' : tone === 'success' ? 'onSuccessSoft' : 'onAccent';
  return (
    <View style={styles.chips} accessibilityLabel={label}>
      {options.map((o) => (
        <Pressable key={o.v} accessibilityRole="checkbox" aria-checked={on(o.v)} accessibilityLabel={`${label}: ${o.l}`} onPress={() => onChange(toggle(values, o.v))}
          style={[styles.chip, { borderColor: on(o.v) ? 'transparent' : c.border, backgroundColor: on(o.v) ? bg : c.surface }]}>
          <Text variant="sm" color={on(o.v) ? (fg as 'onAccent') : 'text'} style={styles.bold}>{o.l}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 40, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bold: { fontFamily: 'Inter_600SemiBold' },
});
