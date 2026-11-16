import { CheckCircle2, CircleAlert, Info, WifiOff, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { shadow, tokens, useTheme, type ColorRole } from '../theme';
import { Text } from './Text';

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'offline';
const tones: Record<Tone, { bg: ColorRole; fg: ColorRole; icon: LucideIcon }> = {
  info: { bg: 'accentSoft', fg: 'onAccentSoft', icon: Info },
  success: { bg: 'successSoft', fg: 'onSuccessSoft', icon: CheckCircle2 },
  warning: { bg: 'highlightSoft', fg: 'onHighlightSoft', icon: CircleAlert },
  danger: { bg: 'dangerSoft', fg: 'onDangerSoft', icon: CircleAlert },
  offline: { bg: 'surface', fg: 'text', icon: WifiOff },
};

/** Hinweisleiste (auch als Toast). Wird per accessibilityLiveRegion angesagt. */
export function Banner({ tone = 'info', title, body, action }: {
  tone?: Tone; title: string; body?: string; action?: ReactNode;
}) {
  const { c } = useTheme();
  const t = tones[tone];
  const Icon = t.icon;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: c[t.bg], borderColor: tone === 'offline' ? c.border : 'transparent' }]}
    >
      <Icon size={20} color={c[t.fg]} />
      <View style={styles.bannerText}>
        <Text variant="sm" color={t.fg} style={styles.semibold}>{title}</Text>
        {body ? <Text variant="sm" color={t.fg}>{body}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export type MenuItem = { label: string; icon: LucideIcon; destructive?: boolean; onPress: () => void };

/** Aktionsmenü einer Zuweisung (S04). Auf dem Telefon als Bottom Sheet. */
export function ActionSheet({ visible, title, items, onClose }: {
  visible: boolean; title: string; items: MenuItem[]; onClose: () => void;
}) {
  const { c } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Menü schließen" style={styles.scrim} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.surfaceRaised }, shadow('pop')]}>
        <SheetContent title={title} items={items} onClose={onClose} />
      </View>
    </Modal>
  );
}

/** Inhalt ohne Modal, damit die Design-Seite ihn statisch zeigen kann. */
export function SheetContent({ title, items, onClose }: { title: string; items: MenuItem[]; onClose?: () => void }) {
  const { c } = useTheme();
  return (
    <View>
      <View style={[styles.grabber, { backgroundColor: c.border }]} />
      <Text variant="label" color="textMuted" style={styles.sheetTitle}>{title}</Text>
      {items.map((it) => {
        const Icon = it.icon;
        const fg: ColorRole = it.destructive ? 'danger' : 'text';
        return (
          <Pressable
            key={it.label}
            accessibilityRole="button"
            onPress={() => { it.onPress(); onClose?.(); }}
            style={({ pressed }) => [styles.item, { backgroundColor: pressed ? c.surface : 'transparent' }]}
          >
            <View style={[styles.itemIcon, { backgroundColor: it.destructive ? c.dangerSoft : c.surface }]}>
              <Icon size={18} color={c[fg]} />
            </View>
            <Text variant="base" color={fg}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: tokens.radius.md, borderWidth: 1 },
  bannerText: { flex: 1, gap: 2 },
  semibold: { fontFamily: 'Inter_600SemiBold' },
  scrim: { flex: 1, backgroundColor: 'rgba(26,29,46,0.4)' },
  sheet: { borderTopLeftRadius: tokens.radius.lg, borderTopRightRadius: tokens.radius.lg, paddingBottom: 32 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: 8, marginBottom: 4 },
  sheetTitle: { paddingHorizontal: 20, paddingVertical: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, minHeight: 56 },
  itemIcon: { width: 36, height: 36, borderRadius: tokens.radius.md, alignItems: 'center', justifyContent: 'center' },
});
