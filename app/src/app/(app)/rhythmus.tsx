import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useActive } from '../../data/session';
import { canLead, useDp, useMe, useSaveStaff } from '../../dienstplan/hooks';
import { WEEKDAYS, addDays, iso, parseIso, rhythmIndex, type Staff } from '../../dienstplan/model';
import { PersonPicker, PickChips, Sheet } from '../../dienstplan/ui';
import { AppScreen } from '../../features/AppScreen';
import { errorText } from '../../features/errors';
import { useTheme } from '../../theme';
import { Banner, Button, Skeleton, Text } from '../../ui';

const COLORS: Record<string, string> = { F: '#DBEAFE', M: '#FEF3C7', S: '#FDE68A', N: '#C7D2FE' };

/** 16-Wochen-Grundrhythmus je Person. Wiederholt sich fortlaufend ab dem Rhythmusbeginn. */
export default function RhythmScreen() {
  const params = useLocalSearchParams<{ staff?: string }>();
  const { member } = useActive();
  const lead = canLead(member.role);
  const dp = useDp();
  const me = useMe();
  const save = useSaveStaff();
  const { c, scheme } = useTheme();
  const planned = dp.data?.staff.filter((s) => s.inPlan) ?? [];
  const [staffId, setStaffId] = useState<string | null>(params.staff ?? null);
  useEffect(() => { if (!staffId && planned.length) setStaffId((me?.inPlan ? me.id : null) ?? planned[0]?.id ?? null); }, [planned.length, me?.id, me?.inPlan, staffId]);
  const [draft, setDraft] = useState<string[] | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const staff = planned.find((s) => s.id === staffId) ?? null;
  useEffect(() => { setDraft(null); save.reset(); }, [staffId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!dp.data) return <AppScreen title="Grundrhythmus" back><Skeleton height={300} /></AppScreen>;
  const s = dp.data.settings;
  const len = s.rhythmLength;
  const weeks = Math.ceil(len / 7);
  const rhythm = draft ?? (staff ? padded(staff, len) : []);
  const todayIdx = rhythmIndex(iso(new Date()), s);
  const startWd = parseIso(s.rhythmStart).getDay();
  const set = (i: number, v: string) => { const next = [...rhythm]; next[i] = v; setDraft(next); };

  return (
    <AppScreen title={staff ? `Grundrhythmus ${staff.short}` : 'Grundrhythmus'} eyebrow={`${weeks} Wochen, ab ${fmt(s.rhythmStart)} fortlaufend`} back>
      <PersonPicker value={staffId} onChange={setStaffId} options={planned.map((x) => ({ value: x.id, label: x.short }))} />
      <Text variant="sm" color="textMuted">
        Heute ist Tag {todayIdx + 1} von {len} (Woche {Math.floor(todayIdx / 7) + 1}). {lead ? 'Tag antippen zum Ändern; der Monatsplan übernimmt die Grundschicht überall, wo kein Feinplan-Eintrag steht.' : ''}
      </Text>
      {staff ? (
        <ScrollView horizontal>
          <View style={[styles.table, { borderColor: c.border }]}>
            <View style={[styles.tr, { backgroundColor: c.surface }]}>
              <Text variant="xs" style={[styles.wk, styles.bold]}>Woche</Text>
              {Array.from({ length: 7 }, (_, d) => <Text key={d} variant="xs" style={[styles.cell, styles.bold, { textAlign: 'center' }]}>{WEEKDAYS[(startWd + d) % 7]}</Text>)}
              <Text variant="xs" style={[styles.wk, styles.bold]}>Dienste</Text>
            </View>
            {Array.from({ length: weeks }, (_, w) => {
              const slice = rhythm.slice(w * 7, w * 7 + 7);
              return (
                <View key={w} style={[styles.tr, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
                  <Text variant="sm" style={[styles.wk, styles.bold]}>{w + 1}</Text>
                  {slice.map((v, d) => {
                    const i = w * 7 + d;
                    const bg = v ? (scheme === 'dark' ? c.accentSoft : COLORS[v.charAt(0)] ?? c.surface) : 'transparent';
                    return (
                      <Pressable key={d} disabled={!lead} onPress={() => setPick(i)}
                        accessibilityLabel={`Woche ${w + 1}, ${WEEKDAYS[(startWd + d) % 7]} (${fmt(addDays(s.rhythmStart, i))}): ${v || 'frei'}`}
                        style={[styles.cell, styles.box, { backgroundColor: bg, borderColor: i === todayIdx ? '#00B0F0' : c.border, borderWidth: i === todayIdx ? 2 : StyleSheet.hairlineWidth }]}>
                        <Text variant="sm" style={[styles.bold, { color: v && scheme !== 'dark' ? '#1F2937' : c.text }]}>{v}</Text>
                      </Pressable>
                    );
                  })}
                  <Text variant="sm" color="textMuted" style={[styles.wk, { textAlign: 'center' }]}>{slice.filter(Boolean).length}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      ) : null}
      {lead && draft ? (
        <View style={styles.actions}>
          {save.isError ? <Banner tone="danger" title={errorText(save.error)} /> : null}
          <Button label="Rhythmus speichern" loading={save.isPending}
            onPress={() => staff && save.mutate({ ...staff, rhythm: draft }, { onSuccess: () => setDraft(null) })} />
          <Button label="Verwerfen" variant="secondary" onPress={() => setDraft(null)} />
        </View>
      ) : null}
      {save.isSuccess && !draft ? <Banner tone="success" title="Grundrhythmus gespeichert." /> : null}
      <Sheet visible={pick !== null} title={pick !== null ? `Tag ${pick + 1}: ${fmt(addDays(s.rhythmStart, pick))} (Woche ${Math.floor(pick / 7) + 1})` : ''} onClose={() => setPick(null)}>
        <PickChips label="Grundschicht" value={pick !== null ? rhythm[pick] || '–' : null}
          onChange={(v) => { if (pick !== null) set(pick, v === '–' ? '' : v); setPick(null); }}
          options={[{ value: '–', label: 'frei' }, ...s.baseShifts.map((b) => ({ value: b, label: b }))]} />
      </Sheet>
    </AppScreen>
  );
}

function padded(st: Staff, len: number) {
  return Array.from({ length: len }, (_, i) => st.rhythm[i] ?? '');
}
const fmt = (d: string) => `${Number(d.slice(8))}.${Number(d.slice(5, 7))}.${d.slice(0, 4)}`;

const styles = StyleSheet.create({
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingHorizontal: 4 },
  wk: { width: 60, textAlign: 'center' },
  cell: { width: 52, marginHorizontal: 2 },
  box: { height: 34, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginVertical: 3 },
  bold: { fontFamily: 'Inter_600SemiBold' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
