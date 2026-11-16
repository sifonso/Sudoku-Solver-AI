import { router, type Href } from 'expo-router';
import { ChevronRight, LogOut } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { canPlan, roleLabel } from '../../../data/api';
import { useActive, useSignOut } from '../../../data/session';
import type { Role } from '../../../domain/types';
import { AppScreen } from '../../../features/AppScreen';
import { useTheme } from '../../../theme';
import { Avatar, Badge, Button, Card, ListRow, SectionHeader, Text } from '../../../ui';

type Item = { label: string; href: Href; id: string; roles: Role[] | 'all' };
const ITEMS: Item[] = [
  { id: 'S21', label: 'Meine Schichten', href: '/meine', roles: ['chef', 'planer'] },
  { id: 'S20', label: 'Heute im Dienst', href: '/heute', roles: 'all' },
  { id: 'S22', label: 'Urlaub beantragen', href: '/urlaub-beantragen', roles: 'all' },
  { id: 'S23', label: 'Krank melden', href: '/krankmelden', roles: 'all' },
  { id: 'S24', label: 'Schichttausch', href: '/tausch', roles: ['chef', 'planer', 'aufgaben_manager'] },
  { id: 'S16', label: 'Schnellaktionen', href: '/schnell', roles: ['chef'] },
  { id: 'S09', label: 'Krankmeldungen', href: '/krankmeldungen', roles: ['chef', 'planer'] },
  { id: 'S10', label: 'Urlaubsanträge', href: '/urlaubsantraege', roles: ['chef', 'planer'] },
  { id: 'S11', label: 'Statistik', href: '/statistik', roles: ['chef', 'planer'] },
  { id: 'S06', label: 'Schichttypen', href: '/schichttypen', roles: ['chef', 'planer'] },
  { id: 'S19', label: 'Schnellaktionen verwalten', href: '/schnellaktionen-verwalten', roles: ['chef', 'aufgaben_manager'] },
  { id: 'S15', label: 'Aufgaben-Log', href: '/aufgaben-log', roles: ['chef', 'planer', 'aufgaben_manager'] },
  { id: 'S27', label: 'Profil und Verfügbarkeit', href: '/profil', roles: 'all' },
  { id: 'S26', label: 'Einstellungen', href: '/einstellungen', roles: 'all' },
  { id: 'S28', label: 'Abo und Datenexport', href: '/abo', roles: ['chef'] },
];

/** Mehr: alles, was nicht in die Reiter passt. */
export default function MoreScreen() {
  const { c } = useTheme();
  const { tenant, member } = useActive();
  const signOut = useSignOut();
  const items = ITEMS.filter((i) => i.roles === 'all' || i.roles.includes(member.role));
  const trialDays = Math.max(0, Math.ceil((Date.parse(tenant.trialEndsAt) - Date.now()) / 86_400_000));
  return (
    <AppScreen title="Mehr" eyebrow={tenant.name}>
      <Card style={styles.me}>
        <Avatar initials={member.initials} employment={member.employmentType} size={48} />
        <View style={{ flex: 1 }}>
          <Text variant="lg">{member.displayName}</Text>
          <Text variant="sm" color="textMuted">{roleLabel[member.role]} · {tenant.name}</Text>
        </View>
        {tenant.plan === 'trial' && canPlan(member.role) ? <Badge label={`Test: ${trialDays} Tage`} tone="highlight" /> : null}
      </Card>
      <SectionHeader title="Bereiche" />
      <Card style={styles.list}>
        {items.map((i) => (
          <ListRow key={i.id} title={i.label} subtitle={i.id} onPress={() => router.push(i.href)}
            trailing={<ChevronRight size={20} color={c.textMuted} />} />
        ))}
      </Card>
      <Button label="Abmelden" variant="secondary" icon={LogOut} onPress={() => signOut.mutate()} loading={signOut.isPending} />
      <Button label="Designsystem ansehen" variant="ghost" onPress={() => router.push('/design')} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  me: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  list: { paddingVertical: 0 },
});
