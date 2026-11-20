import { router, type Href } from 'expo-router';
import { BarChart3, ChevronRight, Palmtree, Stethoscope, UserPlus, Users } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { roleLabel } from '../../../data/api';
import { useMembers } from '../../../data/hooks';
import { useActive } from '../../../data/session';
import type { Member } from '../../../domain/types';
import { AppScreen } from '../../../features/AppScreen';
import { useTheme } from '../../../theme';
import { Avatar, Badge, Banner, Button, Card, EmptyState, ListRow, SectionHeader, Skeleton, Text, employmentLabel } from '../../../ui';

const GROUPS: { title: string; pick: (m: Member) => boolean }[] = [
  { title: 'Vollzeit', pick: (m) => m.status === 'active' && m.employmentType === 'vollzeit' },
  { title: 'Teilzeit', pick: (m) => m.status === 'active' && m.employmentType === 'teilzeit' },
  { title: 'Aushilfen', pick: (m) => m.status === 'active' && m.employmentType === 'aushilfe' },
  { title: 'Eingeladen', pick: (m) => m.status === 'invited' },
  { title: 'Gesperrt', pick: (m) => m.status === 'locked' },
];

const LINKS: { label: string; href: Href; icon: typeof Users }[] = [
  { label: 'Krankmeldungen', href: '/krankmeldungen', icon: Stethoscope },
  { label: 'Urlaub', href: '/urlaubsantraege', icon: Palmtree },
  { label: 'Statistik', href: '/statistik', icon: BarChart3 },
];

/** S07 Personal: Team nach Beschäftigungsart, Einladen, Sprung zu Abwesenheiten und Statistik. */
export default function PersonalScreen() {
  const { c } = useTheme();
  const { tenant, member: me } = useActive();
  const members = useMembers();
  const active = members.data?.filter((m) => m.status === 'active').length ?? 0;

  return (
    <AppScreen
      title="Personal"
      eyebrow={tenant.name}
      onRefresh={() => members.refetch()}
      refreshing={members.isRefetching}
    >
      <View style={styles.head}>
        <Text variant="sm" color="textMuted">{members.data ? `${active} aktiv` : ' '}</Text>
        <Button label="Einladen" icon={UserPlus} onPress={() => router.push('/mitarbeiter/neu')} />
      </View>

      <View style={styles.links}>
        {LINKS.map((l) => (
          <Button key={l.label} label={l.label} icon={l.icon} variant="secondary" size="sm" onPress={() => router.push(l.href)} />
        ))}
      </View>

      {members.isLoading ? (
        <View style={styles.list}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={64} />)}</View>
      ) : members.isError ? (
        <Banner tone="danger" title="Team konnte nicht geladen werden"
          action={<Button label="Erneut" size="sm" variant="secondary" onPress={() => members.refetch()} />} />
      ) : members.data!.filter((m) => m.status !== 'archived').length <= 1 ? (
        <Card>
          <EmptyState icon={Users} title="Noch allein im Betrieb"
            body="Lade dein Team per E-Mail ein. Wer eingeladen ist, kann schon eingeplant werden und sieht seine Schichten nach dem ersten Login."
            action={<Button label="Erste Person einladen" icon={UserPlus} onPress={() => router.push('/mitarbeiter/neu')} />} />
        </Card>
      ) : (
        GROUPS.map((g) => {
          const list = members.data!.filter(g.pick);
          if (!list.length) return null;
          return (
            <View key={g.title}>
              <SectionHeader title={g.title} count={list.length} />
              <Card style={styles.card}>
                {list.map((m) => (
                  <ListRow
                    key={m.id}
                    title={m.displayName + (m.id === me.id ? ' (du)' : '')}
                    subtitle={[
                      roleLabel[m.role],
                      employmentLabel[m.employmentType],
                      m.monthlyHoursLimit != null ? `max. ${m.monthlyHoursLimit} h/Monat` : null,
                    ].filter(Boolean).join(' · ')}
                    leading={<Avatar initials={m.initials} employment={m.employmentType} />}
                    trailing={
                      <View style={styles.trail}>
                        {m.role === 'chef' ? <Badge label="FK4 / SL" tone="accent" /> : null}
                        {m.status === 'invited' ? <Badge label="Eingeladen" tone="highlight" /> : null}
                        {m.status === 'locked' ? <Badge label="Gesperrt" tone="danger" /> : null}
                        <ChevronRight size={20} color={c.textMuted} />
                      </View>
                    }
                    onPress={() => router.push({ pathname: '/mitarbeiter/[id]', params: { id: m.id } })}
                  />
                ))}
              </Card>
            </View>
          );
        })
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { gap: 12 },
  card: { paddingVertical: 0 },
  trail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
