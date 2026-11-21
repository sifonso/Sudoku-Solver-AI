import { router } from 'expo-router';
import { ChevronRight, Phone, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useActive } from '../../../data/session';
import { canLead, useDp } from '../../../dienstplan/hooks';
import { displayName, type Staff } from '../../../dienstplan/model';
import { AppScreen } from '../../../features/AppScreen';
import { useTheme } from '../../../theme';
import { Badge, Button, Card, ListRow, Skeleton, Tabs, Text } from '../../../ui';

type View_ = 'zuordnung' | 'quali' | 'telefon' | 'fahr';

/** Mitarbeiterzuordnung, Qualifikationen, Telefonnummern und Fahrgemeinschaften. */
export default function TeamScreen() {
  const { member } = useActive();
  const lead = canLead(member.role);
  const [tab, setTab] = useState<View_>('zuordnung');
  const dp = useDp();
  const staff = dp.data?.staff ?? [];
  const open = (s: Staff) => router.push({ pathname: '/person/[id]', params: { id: s.id } });
  return (
    <AppScreen title="Team" eyebrow="Übersicht" onRefresh={() => dp.refetch()} refreshing={dp.isRefetching}
      actions={lead ? <Button label="Person" icon={Plus} size="sm" variant="secondary" onPress={() => router.push({ pathname: '/person/[id]', params: { id: 'neu' } })} /> : null}>
      <Tabs value={tab} onChange={setTab} options={[
        { value: 'zuordnung', label: 'Zuordnung' }, { value: 'quali', label: 'Qualifikationen' },
        { value: 'telefon', label: 'Telefon' }, { value: 'fahr', label: 'Fahrgemeinschaften' },
      ]} />
      {!dp.data ? <Skeleton height={300} /> : tab === 'zuordnung' ? (
        <>
          <Assignment staff={staff} onOpen={open} />
          {lead && dp.data.archived.length ? (
            <Card style={{ gap: 0, paddingVertical: 8 }}>
              <Text variant="lg">Aus dem Team entfernt</Text>
              {dp.data.archived.map((s) => <ListRow key={s.id} title={displayName(s)} subtitle="antippen zum Wiederaufnehmen oder Löschen" onPress={() => open(s)} />)}
            </Card>
          ) : null}
        </>
      ) : tab === 'quali' ? (
        <Qualifications staff={staff} columns={dp.data.settings.qualColumns} onOpen={lead ? open : undefined} />
      ) : tab === 'telefon' ? (
        <Phones staff={staff} showPersNr={lead} />
      ) : (
        <View style={{ gap: 12 }}>
          {dp.data.carpools.length === 0 ? <Text color="textMuted">Keine Fahrgemeinschaften angemeldet.</Text> : null}
          {dp.data.carpools.map((cp) => (
            <Card key={cp.name} style={{ gap: 4 }}>
              <Text variant="sm" style={styles.bold}>{cp.name}</Text>
              <Text variant="sm">{cp.members.map((id) => staff.find((s) => s.id === id)?.short ?? id).join(', ')}</Text>
            </Card>
          ))}
        </View>
      )}
    </AppScreen>
  );
}

function Assignment({ staff, onOpen }: { staff: Staff[]; onOpen: (s: Staff) => void }) {
  const { c } = useTheme();
  const leads = staff.filter((s) => s.isLead);
  const unassigned = staff.filter((s) => !s.isLead && !s.teamLeadId && s.inPlan);
  return (
    <View style={styles.cols}>
      {leads.map((l) => {
        const team = staff.filter((s) => s.teamLeadId === l.id).sort((a, b) => a.lastName.localeCompare(b.lastName));
        return (
          <Card key={l.id} style={styles.team}>
            <Pressable accessibilityRole="button" onPress={() => onOpen(l)} style={styles.teamHead}>
              <Text variant="lg" style={{ flex: 1 }}>{displayName(l)}</Text>
              <Badge label={`${team.length} Personen`} tone="accent" />
            </Pressable>
            {team.map((s) => (
              <ListRow key={s.id} title={displayName(s)} subtitle={s.nr ? `Nr. ${s.nr}` : 'nicht im Plan'} onPress={() => onOpen(s)}
                trailing={<ChevronRight size={18} color={c.textMuted} />} />
            ))}
          </Card>
        );
      })}
      {unassigned.length ? (
        <Card style={styles.team}>
          <Text variant="lg">Ohne Zuordnung</Text>
          {unassigned.map((s) => <ListRow key={s.id} title={displayName(s)} subtitle={`Nr. ${s.nr}`} onPress={() => onOpen(s)} />)}
        </Card>
      ) : null}
    </View>
  );
}

const QUAL_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  X: { bg: '#1E9E3E', fg: '#FFFFFF', label: 'vorhanden' },
  '(X)': { bg: '#FFEB3B', fg: '#0F172A', label: 'geplant bzw. in Ausbildung' },
  Y: { bg: '#BFBFBF', fg: '#0F172A', label: 'verfallen, wird nicht beplant' },
};

function Qualifications({ staff, columns, onOpen }: { staff: Staff[]; columns: string[]; onOpen?: (s: Staff) => void }) {
  const { c } = useTheme();
  const rows = staff.filter((s) => Object.keys(s.quals ?? {}).length || s.inPlan).sort((a, b) => a.lastName.localeCompare(b.lastName));
  const sums = columns.map((col) => rows.filter((s) => s.quals?.[col] === 'X').length);
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.legend}>
        {Object.entries(QUAL_STYLE).map(([k, v]) => (
          <View key={k} style={styles.legendItem}>
            <View style={[styles.q, { backgroundColor: v.bg }]}><Text style={[styles.qt, { color: v.fg }]}>{k}</Text></View>
            <Text variant="xs" color="textMuted">{v.label}</Text>
          </View>
        ))}
      </View>
      <ScrollView horizontal>
        <View style={[styles.table, { borderColor: c.border }]}>
          <View style={[styles.tr, { backgroundColor: c.surface }]}>
            <Text variant="xs" style={[styles.nameCol, styles.bold]}>Name</Text>
            {columns.map((col) => <Text key={col} variant="xs" style={[styles.qh, styles.bold]} numberOfLines={2}>{col}</Text>)}
          </View>
          {rows.map((s) => (
            <Pressable key={s.id} disabled={!onOpen} onPress={() => onOpen?.(s)} style={[styles.tr, { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <Text variant="sm" numberOfLines={1} style={styles.nameCol}>{s.lastName}, {s.firstName}</Text>
              {columns.map((col) => {
                const v = s.quals?.[col] ?? '';
                const st = QUAL_STYLE[v];
                return (
                  <View key={col} style={styles.qh}>
                    {st ? <View style={[styles.q, { backgroundColor: st.bg }]} accessibilityLabel={`${col}: ${st.label}`}><Text style={[styles.qt, { color: st.fg }]}>{v}</Text></View> : null}
                  </View>
                );
              })}
            </Pressable>
          ))}
          <View style={[styles.tr, { backgroundColor: c.surface }]}>
            <Text variant="xs" style={[styles.nameCol, styles.bold]}>Summe (X)</Text>
            {sums.map((n, i) => <Text key={i} variant="sm" style={[styles.qh, styles.bold, { textAlign: 'center' }]}>{n}</Text>)}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Phones({ staff, showPersNr }: { staff: Staff[]; showPersNr: boolean }) {
  const { c } = useTheme();
  const rows = staff.filter((s) => s.phoneMobile || s.phonePrivate).sort((a, b) => a.lastName.localeCompare(b.lastName));
  const call = (n: string) => Linking.openURL(`tel:${n.replace(/[^\d+]/g, '')}`).catch(() => undefined);
  return (
    <Card style={{ paddingVertical: 0 }}>
      {rows.map((s, i) => (
        <View key={s.id} style={[styles.phone, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
          <View style={{ flex: 1, minWidth: 160 }}>
            <Text variant="base" style={styles.bold}>{s.lastName}, {s.firstName}</Text>
            <Text variant="xs" color="textMuted">
              {[s.whatsapp ? `WhatsApp: ${s.whatsapp}` : null, showPersNr && s.persNr ? `Pers.-Nr. ${s.persNr}` : null].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {s.phoneMobile ? <PhoneButton label="Mobil" n={s.phoneMobile} onPress={call} /> : null}
          {s.phonePrivate ? <PhoneButton label="Privat" n={s.phonePrivate} onPress={call} /> : null}
        </View>
      ))}
    </Card>
  );
}

function PhoneButton({ label, n, onPress }: { label: string; n: string; onPress: (n: string) => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${label} anrufen: ${n}`} onPress={() => onPress(n)}
      style={[styles.call, { borderColor: c.border, backgroundColor: c.surface }]}>
      <Phone size={16} color={c.text} />
      <View>
        <Text variant="xs" color="textMuted">{label}</Text>
        <Text variant="sm" selectable>{n}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bold: { fontFamily: 'Inter_600SemiBold' },
  cols: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  team: { flexGrow: 1, flexBasis: 300, gap: 0, paddingVertical: 8 },
  teamHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingHorizontal: 8 },
  nameCol: { width: 170 },
  qh: { width: 78, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, textAlign: 'center' },
  q: { minWidth: 32, height: 24, borderRadius: 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  qt: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  phone: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingVertical: 10 },
  call: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 },
});
