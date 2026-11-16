import { useLocalSearchParams } from 'expo-router';
import {
  CalendarDays, ClipboardCheck, Folder, Inbox, Pencil, Plus, Thermometer, Trash2, Users, X,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeProvider, tokens, useTheme, type Scheme } from '../theme';
import {
  ActionTile, Avatar, Badge, Banner, Button, Card, Checkbox, DayCard, EmployeeChip, EmptyState,
  ListRow, PageHeader, Pattern, SectionHeader, SegmentedControl, SheetContent, ShiftBlock, Tabs, Text, TextField,
} from '../ui';

/** Alle Bausteine isoliert, hell und dunkel. Route: /design (Dunkel erzwingen: /design?scheme=dark). */
export default function DesignScreen() {
  const { scheme } = useLocalSearchParams<{ scheme?: Scheme }>();
  return (
    <ThemeProvider scheme={scheme === 'dark' || scheme === 'light' ? scheme : undefined}>
      <Gallery />
    </ThemeProvider>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.block}>
      <SectionHeader title={title} />
      {children}
    </View>
  );
}

function Gallery() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= tokens.layout.tabletMin;
  const [view, setView] = useState<'woche' | 'monat'>('woche');
  const [tab, setTab] = useState<'uebersicht' | 'krank' | 'urlaub' | 'statistik'>('uebersicht');
  const [done, setDone] = useState(true);
  const noop = () => {};

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={[styles.page, { maxWidth: tokens.layout.contentMax }]}>
        <View style={styles.hero}>
          <Pattern kind="zacken" fg={c.accentSoft} bg={c.accent} tile={28} />
          <View style={[styles.heroCard, { backgroundColor: c.surfaceRaised }]}>
            <Text variant="label" color="onHighlightSoft">Designsystem</Text>
            <Text variant="xl">Bausteine</Text>
            <Text variant="sm" color="textMuted">Alle Komponenten isoliert. Farben, Schrift und Abstände kommen aus tokens.json.</Text>
          </View>
        </View>

        <Block title="Farbpaare">
          <View style={styles.swatches}>
            {([
              ['Dark Blue', 'Lavender', tokens.palette.darkBlue, tokens.palette.lavender],
              ['Orange', 'Beige', tokens.palette.orange, tokens.palette.beige],
              ['Burgundy', 'Rose', tokens.palette.burgundy, tokens.palette.rose],
              ['Moos', 'Mint', tokens.palette.moos, tokens.palette.mint],
            ] as const).map(([a, b, ha, hb]) => (
              <View key={a} style={styles.swatchPair}>
                <View style={[styles.swatch, { backgroundColor: ha }]}><Text variant="label" style={{ color: hb }}>{a}</Text></View>
                <View style={[styles.swatch, { backgroundColor: hb }]}><Text variant="label" style={{ color: ha }}>{b}</Text></View>
              </View>
            ))}
          </View>
        </Block>

        <Block title="Muster">
          <View style={styles.swatches}>
            {(['zacken', 'streifen', 'pfeile'] as const).map((k, i) => {
              const pals: [string, string][] = [[tokens.palette.darkBlue, tokens.palette.lavender], [tokens.palette.orange, tokens.palette.beige], [tokens.palette.moos, tokens.palette.mint]];
              const pal = pals[i]!;
              return (
                <View key={k} style={styles.patternBox}>
                  <Pattern kind={k} fg={pal[0]} bg={pal[1]} tile={22} />
                  <View style={[styles.patternLabel, { backgroundColor: c.surfaceRaised }]}><Text variant="label">{k}</Text></View>
                </View>
              );
            })}
          </View>
        </Block>

        <Block title="Typografie">
          <Text variant="display">Display 40</Text>
          <Text variant="xl">Titel 28 · Schichtplan</Text>
          <Text variant="lg">Untertitel 20 · Frühschicht</Text>
          <Text variant="base">Fließtext 16. Mitarbeiter sehen ihre Schichten sofort auf dem Telefon.</Text>
          <Text variant="sm" color="textMuted">Klein 14, gedämpft · 06:00 – 14:00</Text>
          <Text variant="label" color="textMuted">Label 12 · Versalien</Text>
        </Block>

        <Block title="Buttons">
          <View style={styles.wrap}>
            <Button label="Speichern" />
            <Button label="Abbrechen" variant="secondary" />
            <Button label="Später" variant="ghost" />
            <Button label="Heute" variant="highlight" icon={CalendarDays} />
            <Button label="Entfernen" variant="danger" icon={Trash2} />
            <Button label="Lädt" loading />
            <Button label="Gesperrt" disabled />
            <Button label="Neuer Mitarbeiter" icon={Plus} size="sm" />
          </View>
        </Block>

        <Block title="Eingaben">
          <View style={[styles.cols, wide && styles.colsWide]}>
            <View style={wide ? styles.col : undefined}><TextField label="Name" placeholder="Vor- und Nachname" hint="So erscheint der Name im Plan." /></View>
            <View style={wide ? styles.col : undefined}><TextField label="Kürzel" value="AB12C" error="Höchstens 4 Zeichen." onChangeText={noop} /></View>
          </View>
          <Checkbox label="Gelöschte anzeigen" checked={done} onChange={setDone} />
        </Block>

        <Block title="Umschalter und Reiter">
          <SegmentedControl label="Ansicht" value={view} onChange={setView}
            options={[{ value: 'woche', label: 'Woche' }, { value: 'monat', label: 'Monat' }]} />
          <Tabs value={tab} onChange={setTab} options={[
            { value: 'uebersicht', label: 'Übersicht' }, { value: 'krank', label: 'Krank', count: 1 },
            { value: 'urlaub', label: 'Urlaub', count: 3 }, { value: 'statistik', label: 'Statistik' },
          ]} />
        </Block>

        <Block title="Badges und Avatare">
          <View style={styles.wrap}>
            <Badge label="Admin" tone="accent" />
            <Badge label="Standard" />
            <Badge label="Offen" tone="highlight" />
            <Badge label="Abgelehnt" tone="danger" />
            <Badge label="Genehmigt" tone="success" />
            <Avatar initials="LK" employment="vollzeit" />
            <Avatar initials="TS" employment="teilzeit" />
            <Avatar initials="MO" employment="aushilfe" />
          </View>
        </Block>

        <Block title="Plan: Tageskarten">
          <View style={[styles.cols, wide && styles.colsWide]}>
            <View style={wide ? styles.col : undefined}>
              <DayCard day={14} weekday="Sa" date="14.11.2026" weekend onPrint={noop}>
                <ShiftBlock name="Frühschicht" time="06:00 – 14:00" staffed={1} needed={2} onAdd={noop}>
                  <EmployeeChip name="Mira Okafor" initials="MO" employment="aushilfe" />
                </ShiftBlock>
              </DayCard>
            </View>
            <View style={wide ? styles.col : undefined}>
              <DayCard day={16} weekday="Mo" date="16.11.2026" today onPrint={noop}>
                <ShiftBlock name="Spätschicht" time="14:00 – 22:00" staffed={2} needed={2}>
                  <EmployeeChip name="Lena Kraus" initials="LK" employment="vollzeit" />
                  <EmployeeChip name="Tom Sander" initials="TS" employment="teilzeit" warning="Ruhezeit unter 11 h" />
                </ShiftBlock>
                <ShiftBlock name="Nachtschicht" time="22:00 – 06:00" staffed={0} needed={1} onAdd={noop} />
              </DayCard>
            </View>
          </View>
        </Block>

        <Block title="Aktionsmenü einer Zuweisung">
          <Card style={styles.sheetCard}>
            <SheetContent title="Lena Kraus · Spätschicht" items={[
              { label: 'Sonderaufgabe', icon: Plus, onPress: noop },
              { label: 'Zeiten bearbeiten', icon: Pencil, onPress: noop },
              { label: 'Zuweisung löschen', icon: X, destructive: true, onPress: noop },
            ]} />
          </Card>
        </Block>

        <Block title="Schnellaktionen">
          <View style={styles.tiles}>
            <ActionTile title="Kühlung" subtitle="Temperatur eintragen" icon={Thermometer} pair="orange" pattern="zacken" due />
            <ActionTile title="Reinigung" subtitle="6 Aktionen" icon={Folder} pair="moos" pattern="streifen" />
            <ActionTile title="Heute" subtitle="Wer arbeitet heute?" icon={Users} pair="lavender" pattern="pfeile" />
            <ActionTile title="Aufgaben" subtitle="3 offen" icon={ClipboardCheck} pair="burgundy" pattern="zacken" />
          </View>
        </Block>

        <Block title="Listen">
          <Card>
            <ListRow title="Lena Kraus" subtitle="Vollzeit · Frühschicht fest" leading={<Avatar initials="LK" />} trailing={<Badge label="Admin" tone="accent" />} onPress={noop} />
            <ListRow title="Mira Okafor" subtitle="Aushilfe · 32 von 40 h im Monat" leading={<Avatar initials="MO" employment="aushilfe" />} onPress={noop} />
          </Card>
        </Block>

        <Block title="Hinweise">
          <Banner tone="offline" title="Offline" body="2 Einträge werden hochgeladen, sobald wieder Netz da ist." />
          <Banner tone="warning" title="Frühschicht unterbesetzt" body="Samstag fehlt eine Person." />
          <Banner tone="success" title="Urlaub genehmigt" />
          <Banner tone="danger" title="Speichern fehlgeschlagen" body="Tom Sander ist zu dieser Zeit schon eingeteilt." />
        </Block>

        <Block title="Leerer Zustand">
          <Card>
            <EmptyState icon={Inbox} title="Noch keine Urlaubsanträge"
              body="Anträge deines Teams erscheinen hier, sobald jemand Urlaub einreicht."
              action={<Button label="Urlaubssperre festlegen" variant="secondary" size="sm" />} />
          </Card>
        </Block>

        <Block title="Seitenkopf">
          <PageHeader eyebrow="Beispiel" title="Personal" subtitle="6 aktiv" action={<Button label="Neuer Mitarbeiter" icon={Plus} />} />
        </Block>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 8, width: '100%', alignSelf: 'center', paddingBottom: 48 },
  hero: { borderRadius: tokens.radius.lg, overflow: 'hidden', padding: 16, paddingTop: 56, minHeight: 180 },
  heroCard: { borderRadius: tokens.radius.md, padding: 16, gap: 4, maxWidth: 520 },
  block: { gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatchPair: { flexDirection: 'row', gap: 4 },
  swatch: { width: 84, height: 64, borderRadius: tokens.radius.sm, padding: 8, justifyContent: 'flex-end' },
  patternBox: { width: 160, height: 96, borderRadius: tokens.radius.md, overflow: 'hidden', justifyContent: 'flex-end', padding: 8 },
  patternLabel: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: tokens.radius.sm },
  cols: { gap: 12 },
  colsWide: { flexDirection: 'row' },
  col: { flex: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sheetCard: { padding: 0, paddingBottom: 8, maxWidth: 420 },
});
