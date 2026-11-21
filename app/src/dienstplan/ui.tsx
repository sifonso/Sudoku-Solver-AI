// Bausteine des Dienstplans: Code-Zelle, Bottom-Sheet, Chips für Kürzel.
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { shadow, tokens, useTheme } from '../theme';
import { IconButton, Text } from '../ui';
import { X } from 'lucide-react-native';
import { cellColors, type DpSettings } from './model';

export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Fenster schließen" style={styles.scrim} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.surfaceRaised }, shadow('pop')]}>
        <View style={[styles.grabber, { backgroundColor: c.border }]} />
        <View style={styles.head}>
          <Text variant="lg" accessibilityRole="header" style={[styles.title, { flex: 1 }]}>{title}</Text>
          <IconButton icon={X} label="Schließen" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={styles.body}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

/** Kürzel als Fläche in der Farbe aus den Monatsblättern. */
export function CodeBadge({ code, settings, size = 'md' }: { code: string; settings: DpSettings; size?: 'sm' | 'md' }) {
  const { c } = useTheme();
  const col = cellColors(code, settings);
  return (
    <View style={[styles.badge, size === 'sm' && styles.badgeSm, { backgroundColor: col?.bg ?? c.surface, borderColor: col ? 'transparent' : c.border }]}>
      <Text variant={size === 'sm' ? 'xs' : 'sm'} style={[styles.badgeText, { color: col?.fg ?? c.text }]}>{code || 'frei'}</Text>
    </View>
  );
}

export function PickChips({ options, value, onChange, label, showLabel }: {
  options: { value: string; label: string; bg?: string; fg?: string }[]; value: string | null; onChange: (v: string) => void; label: string;
  /** Beschriftung statt Kürzel anzeigen (z. B. Personen) */
  showLabel?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" color="textMuted">{label}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.chips}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              aria-checked={on}
              accessibilityLabel={o.label}
              onPress={() => onChange(o.value)}
              style={[styles.chip, {
                backgroundColor: o.bg ?? (on ? c.accent : c.surface),
                borderColor: on ? c.highlight : o.bg ? 'transparent' : c.border,
                borderWidth: on ? 3 : 1,
              }]}
            >
              <Text variant="sm" style={[styles.badgeText, { color: o.fg ?? (on ? c.onAccent : c.text) }]}>{showLabel ? o.label : o.value}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%',
    borderTopLeftRadius: tokens.radius.lg, borderTopRightRadius: tokens.radius.lg, paddingBottom: 24,
    width: '100%', maxWidth: 720, alignSelf: 'center',
  },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 8 },
  title: { paddingHorizontal: 16, paddingTop: 12 },
  head: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  body: { padding: 16, gap: 16 },
  badge: { minWidth: 44, paddingHorizontal: 8, minHeight: 28, borderRadius: tokens.radius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  badgeSm: { minWidth: 36, minHeight: 22, paddingHorizontal: 4 },
  badgeText: { fontFamily: 'Inter_600SemiBold' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  personBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 12, borderRadius: tokens.radius.md, borderWidth: 1, alignSelf: 'flex-start' },
  chip: { minWidth: 48, minHeight: 44, paddingHorizontal: 10, borderRadius: tokens.radius.sm, alignItems: 'center', justifyContent: 'center' },
});

/** Personenwahl, eingeklappt bis zum Antippen (lange Listen auf dem Telefon). */
export function PersonPicker({ options, value, onChange, label = 'Person' }: { options: { value: string; label: string }[]; value: string | null; onChange: (v: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const { c } = useTheme();
  const current = options.find((o) => o.value === value);
  if (!open) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${current?.label ?? 'keine'}, ändern`} onPress={() => setOpen(true)}
        style={[styles.personBtn, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Text variant="label" color="textMuted">{label}</Text>
        <Text variant="base" style={styles.badgeText}>{current?.label ?? '–'}</Text>
        <Text variant="sm" color="textMuted">ändern</Text>
      </Pressable>
    );
  }
  return <PickChips label={label} showLabel value={value} options={options} onChange={(v) => { onChange(v); setOpen(false); }} />;
}
