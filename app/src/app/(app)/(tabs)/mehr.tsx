import { router, type Href } from 'expo-router';
import { ChevronRight, LogOut, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { roleLabel } from '../../../data/api';
import { backend } from '../../../data/client';
import { setDemoAs, useDemoAs, useDp } from '../../../dienstplan/hooks';
import { PickChips } from '../../../dienstplan/ui';
import { useActive, useDeleteAccount, useSignOut } from '../../../data/session';
import type { Role } from '../../../domain/types';
import { COMPANY } from '../../../domain/company';
import { AppScreen } from '../../../features/AppScreen';
import { useTheme } from '../../../theme';
import { Avatar, Banner, Button, Card, ListRow, SectionHeader, Text } from '../../../ui';

type Item = { label: string; href: Href; id: string; roles: Role[] | 'all' };
const ITEMS: Item[] = [
  { id: 'AB', label: 'Abteilung', href: '/abteilungen', roles: 'all' },
  { id: 'UP', label: 'Urlaubsplanung (Jahr)', href: '/urlaubsplanung', roles: 'all' },
  { id: 'DOC', label: 'Regeln und Betriebsvereinbarungen', href: '/dokumente', roles: 'all' },
  { id: 'DP1', label: 'Grundrhythmus (16 Wochen)', href: '/rhythmus', roles: 'all' },
  { id: 'DP3', label: 'Autodisposition', href: '/autodispo', roles: ['chef', 'planer'] },
  { id: 'DP4', label: 'Regelwerk', href: '/regelwerk', roles: ['chef', 'planer'] },
  { id: 'DP5', label: 'Planungsprotokoll', href: '/planungsprotokoll', roles: ['chef', 'planer'] },
  { id: 'DP2', label: 'Einstellungen Dienstplan', href: '/dienstplan-einstellungen', roles: ['chef', 'planer'] },
  { id: 'S22', label: 'Urlaub beantragen', href: '/urlaub-beantragen', roles: 'all' },
  { id: 'S23', label: 'Krank melden', href: '/krankmelden', roles: 'all' },
  { id: 'S09', label: 'Krankmeldungen', href: '/krankmeldungen', roles: ['chef', 'planer'] },
  { id: 'S10', label: 'Urlaubsanträge', href: '/urlaubsantraege', roles: ['chef', 'planer'] },
  { id: 'S07', label: 'Logins und Einladungen', href: '/personal', roles: ['chef'] },
  { id: 'S03', label: 'Wochenplan (Schichttypen)', href: '/plan', roles: ['chef', 'planer'] },
  { id: 'S21', label: 'Meine Schichten (Wochenplan)', href: '/meine', roles: 'all' },
  { id: 'S20', label: 'Heute im Dienst', href: '/heute', roles: 'all' },
  { id: 'S24', label: 'Schichttausch (Wochenplan)', href: '/schichttausch', roles: 'all' },
  { id: 'S13', label: 'Aufgaben', href: '/aufgaben', roles: 'all' },
  { id: 'S16', label: 'Schnellaktionen', href: '/schnell', roles: 'all' },
  { id: 'S11', label: 'Statistik', href: '/statistik', roles: ['chef', 'planer'] },
  { id: 'S06', label: 'Schichttypen', href: '/schichttypen', roles: ['chef', 'planer'] },
  { id: 'S19', label: 'Schnellaktionen verwalten', href: '/schnellaktionen-verwalten', roles: ['chef', 'aufgaben_manager'] },
  { id: 'S15', label: 'Aufgaben-Log', href: '/aufgaben-log', roles: ['chef', 'planer', 'aufgaben_manager'] },
  { id: 'S27', label: 'Profil und Verfügbarkeit', href: '/profil', roles: 'all' },
  { id: 'S26', label: 'Einstellungen', href: '/einstellungen', roles: 'all' },
  { id: 'S28', label: 'Datenexport', href: '/abo', roles: ['chef'] },
  { id: 'APP', label: 'Änderungen an der App', href: '/aenderungen', roles: 'all' },
];

/** Mehr: alles, was nicht in die Reiter passt. */
export default function MoreScreen() {
  const { c } = useTheme();
  const { tenant, member } = useActive();
  const signOut = useSignOut();
  const del = useDeleteAccount();
  const [step, setStep] = useState<'idle' | 'confirm' | 'tenant'>('idle');
  const dp = useDp();
  const demoAs = useDemoAs();
  const items = ITEMS.filter((i) => i.roles === 'all' || i.roles.includes(member.role));
  return (
    <AppScreen title="Mehr" eyebrow={`${COMPANY.short} · ${tenant.name}`}>
      <Card style={styles.me}>
        <Avatar initials={member.initials} employment={member.employmentType} size={48} />
        <View style={{ flex: 1 }}>
          <Text variant="lg">{member.displayName}</Text>
          <Text variant="sm" color="textMuted">{roleLabel[member.role]} · {tenant.name}</Text>
        </View>
      </Card>
      <SectionHeader title="Bereiche" />
      <Card style={styles.list}>
        {items.map((i) => (
          <ListRow key={i.id} title={i.label} subtitle={i.id} onPress={() => router.push(i.href)}
            trailing={<ChevronRight size={20} color={c.textMuted} />} />
        ))}
      </Card>
      {backend === 'demo' && dp.data ? (
        <Card style={{ gap: 8 }}>
          <Text variant="sm" style={{ fontFamily: 'Inter_600SemiBold' }}>Demo: im Plan handeln als</Text>
          <Text variant="xs" color="textMuted">Nur in der Demo. Damit lassen sich Tauschbörse und Anfragen zwischen zwei Personen ausprobieren.</Text>
          <PickChips label="Person" showLabel value={demoAs ?? ''} onChange={(v) => setDemoAs(v || null)}
            options={[{ value: '', label: 'mein Login' }, ...dp.data.staff.filter((x) => x.inPlan).map((x) => ({ value: x.id, label: x.short }))]} />
        </Card>
      ) : null}
      <Button label="Abmelden" variant="secondary" icon={LogOut} onPress={() => signOut.mutate()} loading={signOut.isPending} />
      <Button label="Designsystem ansehen" variant="ghost" onPress={() => router.push('/design')} />

      <SectionHeader title="Konto" />
      {step === 'idle' ? (
        <Button label="Konto löschen" variant="ghost" icon={Trash2} onPress={() => setStep('confirm')} />
      ) : (
        <Card style={styles.danger}>
          {step === 'confirm' ? (
            <>
              <Text variant="lg">Konto wirklich löschen?</Text>
              <Text variant="sm" color="textMuted">
                Dein Login wird gelöscht. Deine bisherigen Schichten bleiben beim Betrieb als Arbeitszeitnachweis, ohne Verbindung zu deinem Konto.
              </Text>
            </>
          ) : (
            <>
              <Text variant="lg">Damit wird auch {tenant.name} gelöscht</Text>
              <Text variant="sm" color="textMuted">
                Du bist die einzige FK4 / SL. Der ganze Betrieb mit Plan, Team, Aufgaben und Protokollen wird endgültig gelöscht. Wenn das Team weitermachen soll, ernenne vorher jemand anderen zur FK4 / SL.
              </Text>
            </>
          )}
          {del.isError ? <Banner tone="danger" title="Löschen fehlgeschlagen" body="Bitte noch einmal versuchen." /> : null}
          <View style={styles.dangerRow}>
            <Button label="Abbrechen" variant="secondary" onPress={() => { setStep('idle'); del.reset(); }} />
            <Button
              label={step === 'tenant' ? 'Konto und Betrieb löschen' : 'Endgültig löschen'}
              variant="danger" icon={Trash2} loading={del.isPending}
              onPress={() => del.mutate(step === 'tenant', { onSuccess: (r) => { if (r === 'sole_chef') setStep('tenant'); } })}
            />
          </View>
        </Card>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  me: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  list: { paddingVertical: 0 },
  danger: { gap: 10 },
  dangerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
