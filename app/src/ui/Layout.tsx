import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import { shadow, tokens, useTheme } from '../theme';
import { Text } from './Text';

export function Card({ style, children, ...rest }: ViewProps & { children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: c.surfaceRaised, borderColor: c.border }, shadow('card'), style]}
      {...rest}
    >
      {children}
    </View>
  );
}

/** Seitenkopf: Label über Titel, optional Aktion rechts. */
export function PageHeader({ eyebrow, title, subtitle, action }: {
  eyebrow?: string; title: string; subtitle?: string; action?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {eyebrow ? <Text variant="label" color="onHighlightSoft">{eyebrow}</Text> : null}
        <Text variant="xl" accessibilityRole="header">{title}</Text>
        {subtitle ? <Text variant="sm" color="textMuted">{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <View style={styles.section}>
      <Text variant="label" color="textMuted" accessibilityRole="header">
        {title}{count != null ? ` · ${count}` : ''}
      </Text>
    </View>
  );
}

export function ListRow({ title, subtitle, leading, trailing, onPress }: {
  title: string; subtitle?: string; leading?: ReactNode; trailing?: ReactNode; onPress?: () => void;
}) {
  const { c } = useTheme();
  const content = (
    <>
      {leading}
      <View style={styles.rowText}>
        <Text variant="base" style={styles.semibold}>{title}</Text>
        {subtitle ? <Text variant="sm" color="textMuted">{subtitle}</Text> : null}
      </View>
      {trailing}
    </>
  );
  // Ohne Aktion eine einfache Zeile: ein deaktivierter Pressable würde aria-disabled an Knöpfe im trailing vererben.
  if (!onPress) {
    return <View style={[styles.row, { borderBottomColor: c.border }]}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderBottomColor: c.border, backgroundColor: pressed ? c.surface : 'transparent' }]}
    >
      {content}
    </Pressable>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: {
  icon: LucideIcon; title: string; body: string; action?: ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: c.accentSoft }]}>
        <Icon size={28} color={c.onAccentSoft} />
      </View>
      <Text variant="lg" style={styles.center}>{title}</Text>
      <Text variant="sm" color="textMuted" style={styles.center}>{body}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: tokens.radius.lg, borderWidth: 1, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
  headerText: { gap: 4, flexShrink: 1 },
  section: { paddingTop: 24, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 64, borderBottomWidth: StyleSheet.hairlineWidth },
  rowText: { flex: 1, gap: 2 },
  semibold: { fontFamily: 'Inter_600SemiBold' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: 24 },
  emptyIcon: { width: 56, height: 56, borderRadius: tokens.radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  center: { textAlign: 'center' },
  emptyAction: { alignSelf: 'center', marginTop: 8 },
});
