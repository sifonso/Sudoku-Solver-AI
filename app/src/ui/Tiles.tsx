import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { tokens, useTheme, type ColorRole } from '../theme';
import { Pattern, type PatternKind } from './Pattern';
import { Text } from './Text';

export type TilePair = 'lavender' | 'orange' | 'burgundy' | 'moos';
/** Zweifarb-Paare aus der Vorlage: Fläche + Muster + Schrift. */
const pairs: Record<TilePair, { bg: ColorRole; fg: ColorRole; pattern: ColorRole }> = {
  lavender: { bg: 'accentSoft', fg: 'onAccentSoft', pattern: 'onAccentSoft' },
  orange: { bg: 'highlightSoft', fg: 'onHighlightSoft', pattern: 'highlight' },
  burgundy: { bg: 'dangerSoft', fg: 'onDangerSoft', pattern: 'onDangerSoft' },
  moos: { bg: 'successSoft', fg: 'onSuccessSoft', pattern: 'onSuccessSoft' },
};

/**
 * Schnellaktion oder Ordner. Große Trefferfläche (Tablet im Betrieb, Handschuhe).
 * Das Muster läuft als schmales Band oben, damit der Text auf ruhiger Fläche steht.
 */
export function ActionTile({ title, subtitle, icon: Icon, pair, pattern, due, onPress }: {
  title: string; subtitle: string; icon: LucideIcon; pair: TilePair; pattern: PatternKind;
  due?: boolean; onPress?: () => void;
}) {
  const { c } = useTheme();
  const p = pairs[pair];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}${due ? ', fällig' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { backgroundColor: c[p.bg], opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.band}>
        <Pattern kind={pattern} fg={c[p.pattern]} bg={c[p.bg]} tile={14} />
      </View>
      <View style={[styles.icon, { backgroundColor: c.surfaceRaised }]}>
        <Icon size={24} color={c[p.fg]} />
      </View>
      <Text variant="lg" color={p.fg}>{title}</Text>
      <Text variant="sm" color={p.fg}>{subtitle}</Text>
      {due ? (
        <View style={[styles.due, { backgroundColor: c.highlight }]}>
          <Text variant="label" color="onHighlight">Fällig</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: tokens.radius.lg, padding: 16, paddingTop: 28, gap: 4, minHeight: 148, overflow: 'hidden', flex: 1, minWidth: 150 },
  band: { position: 'absolute', top: 0, left: 0, right: 0, height: 14, overflow: 'hidden' },
  icon: { width: 44, height: 44, borderRadius: tokens.radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  due: { position: 'absolute', top: 24, right: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: tokens.radius.sm },
});
