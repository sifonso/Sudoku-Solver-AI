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
            aria-checked={on}
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
            aria-selected={on}
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
  tabs: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  tab: { minHeight: tokens.size.touchMin, paddingHorizontal: 12, justifyContent: 'center', borderBottomWidth: 3 },
});

/** Auswahl mit umbrechenden Chips (Rolle, Beschäftigungsart). Für mehr Optionen als SegmentedControl verträgt. */
export function ChoiceChips<T extends string>({ options, value, onChange, label }: {
  options: Option<T>[]; value: T; onChange: (v: T) => void; label: string;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" color="textMuted">{label}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={chipStyles.wrap}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              aria-checked={on}
              onPress={() => onChange(o.value)}
              style={[chipStyles.chip, { borderColor: on ? c.accent : c.borderInput, backgroundColor: on ? c.accent : c.surfaceRaised }]}
            >
              <Text variant="sm" color={on ? 'onAccent' : 'text'} style={{ fontFamily: 'Inter_600SemiBold' }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: tokens.size.touchMin, paddingHorizontal: 14, borderRadius: tokens.radius.pill, borderWidth: 1, justifyContent: 'center' },
});

/** Mehrfachauswahl als Chips (Schichttypen, Wochentage). Rolle checkbox, damit Screenreader „ausgewählt“ ansagen. */
export function MultiChips<T extends string | number>({ options, values, onChange, label, hint }: {
  options: { value: T; label: string }[]; values: T[]; onChange: (v: T[]) => void; label: string; hint?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" color="textMuted">{label}</Text>
      {/* role group: eine Liste dürfte nur listitems enthalten (axe aria-required-children, BUG-009) */}
      <View role="group" aria-label={label} style={chipStyles.wrap}>
        {options.map((o) => {
          const on = values.includes(o.value);
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              aria-checked={on}
              accessibilityLabel={o.label}
              onPress={() => onChange(on ? values.filter((v) => v !== o.value) : [...values, o.value])}
              style={[chipStyles.chip, { borderColor: on ? c.accent : c.borderInput, backgroundColor: on ? c.accent : c.surfaceRaised }]}
            >
              <Text variant="sm" color={on ? 'onAccent' : 'text'} style={{ fontFamily: 'Inter_600SemiBold' }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {hint ? <Text variant="xs" color="textMuted">{hint}</Text> : null}
    </View>
  );
}
