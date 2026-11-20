import { Tabs } from 'expo-router/tabs';
import { CalendarDays, CalendarCheck, CalendarRange, ClipboardCheck, LayoutGrid, Menu, Repeat, Users, type LucideIcon } from 'lucide-react-native';
import { useActive } from '../../../data/session';
import type { Role } from '../../../domain/types';
import { tokens, typeStyle, useTheme } from '../../../theme';

type TabDef = { name: string; title: string; icon: LucideIcon; roles: Role[] | 'all' };

// Höchstens 5 sichtbare Reiter pro Rolle.
const TABS: TabDef[] = [
  { name: 'monat', title: 'Monat', icon: CalendarDays, roles: 'all' },
  { name: 'jahr', title: 'Jahr', icon: CalendarRange, roles: 'all' },
  { name: 'tausch', title: 'Tausch', icon: Repeat, roles: 'all' },
  { name: 'team', title: 'Team', icon: Users, roles: 'all' },
  { name: 'mehr', title: 'Mehr', icon: Menu, roles: 'all' },
  // Ältere Bereiche, erreichbar über „Mehr“
  { name: 'plan', title: 'Plan', icon: CalendarDays, roles: [] },
  { name: 'meine', title: 'Schichten', icon: CalendarCheck, roles: [] },
  { name: 'personal', title: 'Personal', icon: Users, roles: [] },
  { name: 'aufgaben', title: 'Aufgaben', icon: ClipboardCheck, roles: [] },
  { name: 'schnell', title: 'Schnell', icon: LayoutGrid, roles: [] },
];

export default function TabsLayout() {
  const { c } = useTheme();
  const { member } = useActive();
  const visible = (t: TabDef) => t.roles === 'all' || t.roles.includes(member.role);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surfaceRaised, borderTopColor: c.border, minHeight: tokens.size.tabbar },
        tabBarLabelStyle: { ...typeStyle('xs') },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            // Nicht `href: null`: das macht die Route für diese Rolle unerreichbar (BUG-008).
            // Nur die Schaltfläche ausblenden, damit z. B. "Mehr → Schichttausch" für den Chef funktioniert.
            ...(visible(t) ? {} : { tabBarButton: () => null, tabBarItemStyle: { display: 'none' as const } }),
            tabBarIcon: ({ color, size }) => <t.icon color={color} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}

