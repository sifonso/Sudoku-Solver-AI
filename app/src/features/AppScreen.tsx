import { router } from 'expo-router';
import { Bell, ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNotifications } from '../data/hooks';
import { tokens, useTheme } from '../theme';
import { IconButton, Text } from '../ui';

/**
 * Rahmen für alle Screens hinter dem Login: Titelzeile mit Zurück/Glocke,
 * scrollender Inhalt mit Maximalbreite, Pull-to-refresh.
 */
export function AppScreen({ title, eyebrow, back, actions, children, onRefresh, refreshing = false, scroll = true }: {
  title: string;
  eyebrow?: string;
  back?: boolean;
  actions?: ReactNode;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  scroll?: boolean;
}) {
  const { c } = useTheme();
  const notifications = useNotifications();
  const unread = notifications.data?.filter((n) => !n.readAt).length ?? 0;
  const body = <View style={[styles.content, { maxWidth: tokens.layout.contentMax }]}>{children}</View>;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={[styles.bar, { borderBottomColor: c.border }]}>
        {back ? (
          <IconButton icon={ChevronLeft} label="Zurück" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        ) : null}
        <View style={styles.titles}>
          {eyebrow ? <Text variant="label" color="onHighlightSoft">{eyebrow}</Text> : null}
          <Text variant="lg" accessibilityRole="header" numberOfLines={1}>{title}</Text>
        </View>
        {actions}
        <IconButton
          icon={Bell}
          label={unread ? `Benachrichtigungen, ${unread} ungelesen` : 'Benachrichtigungen'}
          badge={unread > 0}
          onPress={() => router.push('/benachrichtigungen')}
        />
      </View>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8,
    minHeight: tokens.size.header, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titles: { flex: 1, paddingHorizontal: 8 },
  scroll: { paddingBottom: 48 },
  content: { width: '100%', alignSelf: 'center', padding: 16, gap: 16 },
});
