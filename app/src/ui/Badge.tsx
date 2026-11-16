import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import { tokens, useTheme, type ColorRole } from '../theme';
import { Text } from './Text';

export type Employment = 'vollzeit' | 'teilzeit' | 'aushilfe';
const cat: Record<Employment, { bg: ColorRole; fg: ColorRole }> = {
  vollzeit: { bg: 'catVollzeit', fg: 'onCatVollzeit' },
  teilzeit: { bg: 'catTeilzeit', fg: 'onCatTeilzeit' },
  aushilfe: { bg: 'catAushilfe', fg: 'onCatAushilfe' },
};
export const employmentLabel: Record<Employment, string> = {
  vollzeit: 'Vollzeit',
  teilzeit: 'Teilzeit',
  aushilfe: 'Aushilfe',
};

type Tone = 'neutral' | 'accent' | 'highlight' | 'danger' | 'success';
const tones: Record<Tone, { bg: ColorRole; fg: ColorRole }> = {
  neutral: { bg: 'surface', fg: 'textMuted' },
  accent: { bg: 'accentSoft', fg: 'onAccentSoft' },
  highlight: { bg: 'highlightSoft', fg: 'onHighlightSoft' },
  danger: { bg: 'dangerSoft', fg: 'onDangerSoft' },
  success: { bg: 'successSoft', fg: 'onSuccessSoft' },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const { c } = useTheme();
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c[t.bg] }]}>
      <Text variant="label" color={t.fg}>{label}</Text>
    </View>
  );
}

export function Avatar({ initials, employment = 'vollzeit', size = 40 }: {
  initials: string; employment?: Employment; size?: number;
}) {
  const { c } = useTheme();
  const t = cat[employment];
  return (
    <View
      accessible={false}
      style={[styles.avatar, { width: size, height: size, borderRadius: tokens.radius.md, backgroundColor: c[t.bg] }]}
    >
      <Text variant={size >= 40 ? 'lg' : 'label'} color={t.fg}>{initials}</Text>
    </View>
  );
}

type ChipProps = Omit<PressableProps, 'children'> & {
  name: string;
  initials: string;
  employment: Employment;
  warning?: string; // z. B. "Ruhezeit unter 11 h"
  selected?: boolean;
};

/** Mitarbeiter in einer Schicht. Die Beschäftigungsart steht als Text dabei, nicht nur als Farbe. */
export function EmployeeChip({ name, initials, employment, warning, selected, ...rest }: ChipProps) {
  const { c } = useTheme();
  const t = cat[employment];
  return (
    <Pressable
      accessibilityRole="button"
      // Kein eigenes Label: der Name kommt aus dem sichtbaren Text (Kürzel, Name, Art oder Warnung),
      // damit Sprachsteuerung "Lena Kraus" findet (WCAG 2.5.3, axe: label-content-name-mismatch).
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: c[t.bg],
          borderColor: selected ? c.focus : warning ? c.highlight : 'transparent',
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      {...rest}
    >
      <View style={[styles.chipAvatar, { backgroundColor: c.surfaceRaised }]}>
        <Text variant="label" color={t.fg}>{initials}</Text>
      </View>
      <View style={styles.chipText}>
        <Text variant="sm" color={t.fg} numberOfLines={1} style={styles.semibold}>{name}</Text>
        <Text variant="xs" color={t.fg} numberOfLines={1}>
          {warning ? `⚠ ${warning}` : employmentLabel[employment]}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: tokens.radius.sm },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: tokens.radius.md,
    borderWidth: 2,
    minHeight: 56,
  },
  chipAvatar: { width: 36, height: 36, borderRadius: tokens.radius.sm, alignItems: 'center', justifyContent: 'center' },
  chipText: { flex: 1 },
  semibold: { fontFamily: 'Inter_600SemiBold' },
});
