import { Pressable, StyleSheet, View } from 'react-native';
import { tokens, useTheme } from '../theme';
import { Text } from './Text';

type Option<T extends string> = { value: T; label: string };

/** Umschalter für 2–4 gleichrangige Ansichten (Monat/Woche, Standard/Sonder). */
export function SegmentedControl<T extends string>({ options, value, onChange, label }: {
  options: Option<T>[]; value: T; onChange: (v: T) => void; label: string;
}) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.seg, { backgroundColor: c.surface, borderColor: c.border }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, on && { backgroundColor: c.accent }]}
          >
            <Text variant="sm" color={on ? 'onAccent' : 'text'} style={styles.semibold}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Reiter mit Unterstrich (Personal: Übersicht / Krankmeldungen / Urlaub / Statistik). */
export function Tabs<T extends string>({ options, value, onChange }: {
  options: (Option<T> & { count?: number })[]; value: T; onChange: (v: T) => void;
}) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.tabs, { borderBottomColor: c.border }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.tab, { borderBottomColor: on ? c.highlight : 'transparent' }]}
          >
            <Text variant="sm" color={on ? 'text' : 'textMuted'} style={on ? styles.semibold : undefined}>
              {o.label}{o.count != null ? ` (${o.count})` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: 'row', borderRadius: tokens.radius.md, borderWidth: 1, padding: 3, alignSelf: 'flex-start' },
  segItem: { minHeight: 38, paddingHorizontal: 16, borderRadius: tokens.radius.sm, alignItems: 'center', justifyContent: 'center' },
  semibold: { fontFamily: 'Inter_600SemiBold' },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  tab: { minHeight: tokens.size.touchMin, paddingHorizontal: 12, justifyContent: 'center', borderBottomWidth: 3 },
});
