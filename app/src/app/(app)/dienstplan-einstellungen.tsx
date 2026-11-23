import { Minus, Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useActive } from '../../data/session';
import { useMembers } from '../../data/hooks';
import { canLead, useDp, useSaveSettings } from '../../dienstplan/hooks';
import { DEFAULT_SETTINGS, type DpSettings, type ShiftGroup } from '../../dienstplan/model';
import { CodeBadge } from '../../dienstplan/ui';
import { AppScreen } from '../../features/AppScreen';
import { errorText } from '../../features/errors';
import { useTheme } from '../../theme';
import { Banner, Button, Card, Checkbox, IconButton, SectionHeader, Skeleton, Text, TextField } from '../../ui';

const PALETTE = ['#1E9E3E', '#92D050', '#E02424', '#FFEB3B', '#5DADE2', '#C6EFCE', '#B39DDB', '#BFBFBF', '#E2E8F0', '#F59E0B', '#FFFFFF', '#0F172A'];
const GROUPS: ShiftGroup[] = ['F', 'M', 'S', 'N'];
const toDe = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : iso);
const toIso = (de: string) => {
  const m = de.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return m ? `${m[3]}-${(m[2] ?? '').padStart(2, '0')}-${(m[1] ?? '').padStart(2, '0')}` : null;
};

/** Alle Einstellungen des Dienstplans, nur für FK4 / SL und Planer. */
export default function DpSettingsScreen() {
  const { member } = useActive();
  const lead = canLead(member.role);
  const dp = useDp();
  const members = useMembers();
  const save = useSaveSettings();
  const { c } = useTheme();
  const [s, setS] = useState<DpSettings | null>(null);
  const [start, setStart] = useState('');
  useEffect(() => { if (dp.data && !s) { setS(dp.data.settings); setStart(toDe(dp.data.settings.rhythmStart)); } }, [dp.data, s]);
  if (!lead) return <AppScreen title="Einstellungen Dienstplan" back><Banner tone="info" title="Nur FK4 / SL kann den Dienstplan einstellen." /></AppScreen>;
  if (!s) return <AppScreen title="Einstellungen Dienstplan" back><Skeleton height={300} /></AppScreen>;
  const set = (patch: Partial<DpSettings>) => { setS({ ...s, ...patch }); save.reset(); };
  const startIso = toIso(start);
  const combos = s.workplaces.flatMap((w) => GROUPS.map((g) => `${w.code}/${g}`));
  const minKeys = [...new Set([...Object.keys(s.minStaffing), ...combos])];

  return (
    <AppScreen title="Einstellungen Dienstplan" eyebrow="FK4 / SL" back>
      <SectionHeader title="Tauschbörse" />
      <Card style={styles.card}>
        <Checkbox label="Tausch braucht Genehmigung durch FK4 / SL" checked={s.swapApproval} onChange={(v) => set({ swapApproval: v })} />
        <Text variant="xs" color="textMuted">
          {s.swapApproval ? 'Einigen sich zwei Personen, wartet der Tausch auf deine Freigabe.' : 'Einigen sich zwei Personen, wird sofort getauscht. Du siehst es im Plan als DT.'}
        </Text>
      </Card>

      <SectionHeader title="Urlaubsplanung" />
      <Card style={styles.card}>
        <Text variant="xs" color="textMuted">Normalfall: Die FK3 gibt die Urlaubsplanung mündlich frei, danach genehmigt FK4 / SL in der App. Hier nur jemanden eintragen, wenn die FK3 selbst in der App freigeben soll (braucht ein Login als Mitarbeiter).</Text>
        <Text variant="label" color="textMuted">FK3 mit eigener Freigabe in der App (optional)</Text>
        <View style={styles.grid}>
          {(members.data ?? []).filter((m) => m.status === 'active' || m.status === 'invited').map((m) => {
            const on = s.vacation.approvers.includes(m.id);
            return (
              <Pressable key={m.id} accessibilityRole="checkbox" aria-checked={on} accessibilityLabel={`FK3: ${m.displayName}`}
                onPress={() => set({ vacation: { ...s.vacation, approvers: on ? s.vacation.approvers.filter((x) => x !== m.id) : [...s.vacation.approvers, m.id] } })}
                style={[styles.g, { width: undefined, paddingHorizontal: 12, borderColor: c.border, backgroundColor: on ? c.accent : c.surface }]}>
                <Text variant="sm" color={on ? 'onAccent' : 'text'} style={styles.bold}>{m.displayName}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.row}>
          <View style={styles.f}><TextField label="Höchstens gleichzeitig im Urlaub" value={String(s.vacation.maxParallel)} keyboardType="number-pad"
            onChangeText={(v) => { const n = Number(v); if (Number.isInteger(n) && n >= 0) set({ vacation: { ...s.vacation, maxParallel: n } }); }} /></View>
          <View style={styles.f}><TextField label="Urlaubsanspruch Vollzeit (Tage)" value={String(s.vacation.baseDays)} keyboardType="number-pad"
            onChangeText={(v) => { const n = Number(v); if (Number.isInteger(n) && n >= 0) set({ vacation: { ...s.vacation, baseDays: n } }); }} hint="Teilzeit anteilig" /></View>
          <View style={styles.f}><TextField label="Zusatzurlaub Wechselschicht F/S/N (Tage)" value={String(s.vacation.shiftBonusDays)} keyboardType="number-pad"
            onChangeText={(v) => { const n = Number(v); if (Number.isInteger(n) && n >= 0) set({ vacation: { ...s.vacation, shiftBonusDays: n } }); }} /></View>
          <View style={styles.f}><TextField label="Flextage selbst gewählt" value={String(s.vacation.flexOwn)} keyboardType="number-pad"
            onChangeText={(v) => { const n = Number(v); if (Number.isInteger(n) && n >= 0) set({ vacation: { ...s.vacation, flexOwn: n } }); }} /></View>
          <View style={styles.f}><TextField label="Flextage vom Arbeitgeber" value={String(s.vacation.flexEmployer)} keyboardType="number-pad"
            onChangeText={(v) => { const n = Number(v); if (Number.isInteger(n) && n >= 0) set({ vacation: { ...s.vacation, flexEmployer: n } }); }} /></View>
          <View style={styles.f}><TextField label="Rot bis Schichtstärke" value={String(s.vacation.redAt)} keyboardType="number-pad"
            onChangeText={(v) => { const n = Number(v); if (Number.isInteger(n) && n >= 0) set({ vacation: { ...s.vacation, redAt: n } }); }} /></View>
          <View style={styles.f}><TextField label="Gelb bis Schichtstärke" value={String(s.vacation.yellowAt)} keyboardType="number-pad"
            onChangeText={(v) => { const n = Number(v); if (Number.isInteger(n) && n >= 0) set({ vacation: { ...s.vacation, yellowAt: n } }); }} /></View>
        </View>
      </Card>

      <SectionHeader title="Grundrhythmus" />
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.f}><TextField label="Beginn (Woche 1, Tag 1)" value={start} onChangeText={(v) => { setStart(v); const i = toIso(v); if (i) set({ rhythmStart: i }); }}
            error={startIso ? undefined : 'Datum als TT.MM.JJJJ'} /></View>
          <View style={styles.f}><TextField label="Länge in Tagen" value={String(s.rhythmLength)} keyboardType="number-pad"
            onChangeText={(v) => { const n = Number(v); if (n > 0 && n <= 728) set({ rhythmLength: n }); }} hint="16 Wochen = 112" /></View>
        </View>
        <TextField label="Grundschichten (mit Komma getrennt)" value={s.baseShifts.join(', ')}
          onChangeText={(v) => set({ baseShifts: v.split(',').map((x) => x.trim()).filter(Boolean) })} />
      </Card>

      <SectionHeader title="Mindestbesetzung je Tag" />
      <Card style={styles.grid}>
        {minKeys.map((k) => {
          const v = s.minStaffing[k];
          const step = (d: number) => {
            const next = { ...s.minStaffing };
            const n = (v ?? 0) + d;
            if (n < 0) delete next[k]; else next[k] = n;
            set({ minStaffing: next });
          };
          return (
            <View key={k} style={[styles.minItem, { borderColor: c.border }]}>
              <Text variant="sm" style={[styles.bold, { flex: 1 }]}>{k}</Text>
              <IconButton icon={Minus} label={`${k} verringern`} onPress={() => step(-1)} />
              <Text variant="base" style={[styles.bold, { width: 28, textAlign: 'center' }]}>{v ?? '–'}</Text>
              <IconButton icon={Plus} label={`${k} erhöhen`} onPress={() => step(1)} />
            </View>
          );
        })}
        <Text variant="xs" color="textMuted">„–“ = kein Zähler. Unterschreitet die Besetzung den Wert, wird der Zähler im Monatsplan rot. „Verfügbar“ wird rot, sobald mehr Personen ohne Arbeitsplatz sind.</Text>
      </Card>

      <SectionHeader title="Schnellwahl im Änderungsfenster" />
      <Card style={styles.card}>
        <Text variant="xs" color="textMuted">Je Arbeitsplatz die Schichten, die beim Ändern eines Dienstes als Knopf erscheinen (z. B. T1/F). „ohne Arbeitsplatz“ mit F, M, S, N gibt es immer.</Text>
        {s.workplaces.map((w) => (
          <View key={w.code} style={styles.presetRow}>
            <Text variant="sm" style={[styles.bold, { width: 44 }]}>{w.code}</Text>
            {GROUPS.map((g) => {
              const on = (s.presets[w.code] ?? []).includes(g);
              return (
                <Pressable key={g} accessibilityRole="checkbox" aria-checked={on} accessibilityLabel={`${w.code}/${g}`}
                  onPress={() => set({ presets: { ...s.presets, [w.code]: on ? (s.presets[w.code] ?? []).filter((x) => x !== g) : GROUPS.filter((x) => x === g || (s.presets[w.code] ?? []).includes(x)) } })}
                  style={[styles.g, { borderColor: c.border, backgroundColor: on ? c.accent : c.surface }]}>
                  <Text variant="sm" color={on ? 'onAccent' : 'text'} style={styles.bold}>{g}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
        <Checkbox label="Feinschichten (F1, M1, M2, S1 …) zusätzlich anbieten" checked={s.detailShifts} onChange={(v) => set({ detailShifts: v })} />
      </Card>

      <SectionHeader title="Arbeitsplätze" />
      <Card style={styles.card}>
        {s.workplaces.map((w, i) => (
          <View key={i} style={styles.row}>
            <View style={{ width: 90 }}><TextField label="Kürzel" value={w.code} maxLength={4} autoCapitalize="characters"
              onChangeText={(v) => set({ workplaces: s.workplaces.map((x, j) => (j === i ? { ...x, code: v.toUpperCase() } : x)) })} /></View>
            <View style={styles.f}><TextField label="Bezeichnung" value={w.name}
              onChangeText={(v) => set({ workplaces: s.workplaces.map((x, j) => (j === i ? { ...x, name: v } : x)) })} /></View>
            <IconButton icon={Trash2} label={`${w.code} entfernen`} onPress={() => set({ workplaces: s.workplaces.filter((_, j) => j !== i) })} />
          </View>
        ))}
        <Button label="Arbeitsplatz hinzufügen" icon={Plus} variant="secondary" onPress={() => set({ workplaces: [...s.workplaces, { code: '', name: '' }] })} />
      </Card>

      <SectionHeader title="Schichtzeiten" />
      <Card style={styles.card}>
        <Text variant="xs" color="textMuted">Zeit je Arbeitsplatz wie in der Tabelle „Arbeitszeiten“. Leer = Schicht gibt es dort nicht.</Text>
        {s.shifts.map((sh, i) => (
          <View key={i} style={[styles.shift, { borderColor: c.border }]}>
            <View style={styles.row}>
              <View style={{ width: 90 }}><TextField label="Kürzel" value={sh.code} maxLength={4} autoCapitalize="characters"
                onChangeText={(v) => set({ shifts: s.shifts.map((x, j) => (j === i ? { ...x, code: v.toUpperCase() } : x)) })} /></View>
              <View style={styles.groups}>
                {GROUPS.map((g) => (
                  <Pressable key={g} accessibilityRole="radio" aria-checked={sh.group === g} accessibilityLabel={`Gruppe ${g}`}
                    onPress={() => set({ shifts: s.shifts.map((x, j) => (j === i ? { ...x, group: g } : x)) })}
                    style={[styles.g, { borderColor: c.border, backgroundColor: sh.group === g ? c.accent : c.surface }]}>
                    <Text variant="sm" color={sh.group === g ? 'onAccent' : 'text'} style={styles.bold}>{g}</Text>
                  </Pressable>
                ))}
              </View>
              <IconButton icon={Trash2} label={`Schicht ${sh.code} entfernen`} onPress={() => set({ shifts: s.shifts.filter((_, j) => j !== i) })} />
            </View>
            <View style={styles.row}>
              {s.workplaces.map((w) => (
                <View key={w.code} style={{ flexBasis: 170, flexGrow: 1 }}>
                  <TextField label={w.code} value={sh.times[w.code] ?? ''} placeholder="–"
                    onChangeText={(v) => set({ shifts: s.shifts.map((x, j) => (j === i ? { ...x, times: { ...x.times, [w.code]: v } } : x)) })} />
                </View>
              ))}
            </View>
          </View>
        ))}
        <Button label="Schicht hinzufügen" icon={Plus} variant="secondary" onPress={() => set({ shifts: [...s.shifts, { code: '', group: 'F', times: {} }] })} />
      </Card>

      <SectionHeader title="Kürzel und Farben" />
      <Card style={styles.card}>
        {s.codes.map((k, i) => {
          const upd = (patch: Partial<typeof k>) => set({ codes: s.codes.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
          return (
            <View key={i} style={[styles.shift, { borderColor: c.border }]}>
              <View style={styles.row}>
                <CodeBadge code={k.code} settings={s} />
                <View style={{ width: 90 }}><TextField label="Kürzel" value={k.code} maxLength={6} autoCapitalize="characters" onChangeText={(v) => upd({ code: v.toUpperCase() })} /></View>
                <View style={styles.f}><TextField label="Bedeutung" value={k.label} onChangeText={(v) => upd({ label: v })} /></View>
                <View style={{ width: 120 }}><TextField label="Zählerzeile" value={k.counter} onChangeText={(v) => upd({ counter: v })} /></View>
                <IconButton icon={Trash2} label={`${k.code} entfernen`} onPress={() => set({ codes: s.codes.filter((_, j) => j !== i) })} />
              </View>
              <View style={styles.row}>
                <Swatches label="Hintergrund" value={k.bg} onChange={(bg) => upd({ bg })} />
                <Swatches label="Schrift" value={k.fg} onChange={(fg) => upd({ fg })} />
              </View>
            </View>
          );
        })}
        <Button label="Kürzel hinzufügen" icon={Plus} variant="secondary" onPress={() => set({ codes: [...s.codes, { code: '', label: '', bg: '#E2E8F0', fg: '#0F172A', counter: '' }] })} />
      </Card>

      <SectionHeader title="Qualifikationen" />
      <Card style={styles.card}>
        <TextField label="Spalten (mit Komma getrennt)" value={s.qualColumns.join(', ')} multiline
          onChangeText={(v) => set({ qualColumns: v.split(',').map((x) => x.trim()).filter(Boolean) })} />
      </Card>

      {save.isError ? <Banner tone="danger" title={errorText(save.error)} /> : null}
      {save.isSuccess ? <Banner tone="success" title="Einstellungen gespeichert." /> : null}
      <View style={styles.row}>
        <Button label="Speichern" size="lg" loading={save.isPending} disabled={!startIso} onPress={() => save.mutate(s)} />
        <Button label="Werte aus der Excel-Vorlage" variant="ghost" onPress={() => { setS({ ...DEFAULT_SETTINGS, rhythmStart: s.rhythmStart, swapApproval: s.swapApproval }); setStart(toDe(s.rhythmStart)); }} />
      </View>
    </AppScreen>
  );
}

function Swatches({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text variant="label" color="textMuted">{label}</Text>
      <View style={styles.sw}>
        {PALETTE.map((p) => (
          <Pressable key={p} accessibilityRole="radio" aria-checked={p === value} accessibilityLabel={`${label} ${p}`} onPress={() => onChange(p)}
            style={[styles.swatch, { backgroundColor: p, borderColor: p === value ? c.highlight : c.border, borderWidth: p === value ? 3 : 1 }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' },
  f: { flexGrow: 1, flexBasis: 200 },
  bold: { fontFamily: 'Inter_600SemiBold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  minItem: { flexDirection: 'row', alignItems: 'center', flexBasis: 200, flexGrow: 1, borderWidth: 1, borderRadius: 8, paddingLeft: 10 },
  shift: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  groups: { flexDirection: 'row', gap: 6 },
  presetRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  g: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sw: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swatch: { width: 30, height: 30, borderRadius: 6 },
});
