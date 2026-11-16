import { Clock, Plus, Printer } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { shadow, tokens, useTheme } from '../theme';
import { IconButton } from './Button';
import { Pattern } from './Pattern';
import { Text } from './Text';

/** Kopf eines Tages im Plan. Heute: dunkle Fläche mit Zackenmuster-Streifen. */
export function DayCard({ day, weekday, date, today, weekend, onPrint, children }: {
  day: number; weekday: string; date: string; today?: boolean; weekend?: boolean;
  onPrint?: () => void; children: ReactNode;
}) {
  const { c, scheme } = useTheme();
  const headBg = today ? c.accent : weekend ? c.highlightSoft : c.surface;
  const headFg = today ? 'onAccent' : 'text';
  const subFg = today ? 'onAccent' : 'textMuted';
  return (
    <View style={[styles.day, { backgroundColor: c.surfaceRaised, borderColor: c.border }, shadow('card')]}>
      <View style={[styles.dayHead, { backgroundColor: headBg }]}>
        {today ? (
          <View style={styles.dayStripe}>
            <Pattern kind="zacken" fg={scheme === 'dark' ? c.onAccentSoft : c.accentSoft} bg={c.accent} tile={12} />
          </View>
        ) : null}
        <Text variant="display" color={headFg}>{day}</Text>
        <View style={styles.dayMeta}>
          <Text variant="label" color={subFg}>{weekday}{today ? ' · Heute' : ''}</Text>
          <Text variant="sm" color={subFg}>{date}</Text>
        </View>
        {onPrint ? (
          <IconButton icon={Printer} label={`${weekday} ${date} drucken`} tone={today ? 'onAccent' : 'soft'} onPress={onPrint} />
        ) : null}
      </View>
      <View style={styles.dayBody}>{children}</View>
    </View>
  );
}

/** Eine Schicht mit Besetzung. Unterbesetzt wird als Text angezeigt, nicht nur farbig. */
export function ShiftBlock({ name, time, staffed, needed, onAdd, children }: {
  name: string; time: string; staffed: number; needed: number; onAdd?: () => void; children?: ReactNode;
}) {
  const { c } = useTheme();
  const under = staffed < needed;
  return (
    <View style={[styles.shift, { borderColor: under ? c.highlight : c.border }]}>
      <View style={styles.shiftHead}>
        <View style={styles.shiftTitle}>
          <Text variant="lg">{name}</Text>
          <View style={styles.time}>
            <Clock size={14} color={c.textMuted} />
            <Text variant="sm" color="textMuted">{time}</Text>
          </View>
        </View>
        <Text variant="label" color={under ? 'onHighlightSoft' : 'textMuted'}>
          {staffed}/{needed}{under ? ' · fehlt' : ''}
        </Text>
      </View>
      <View style={styles.shiftList}>{children}</View>
      {onAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Mitarbeiter zu ${name} hinzufügen`}
          onPress={onAdd}
          style={({ pressed }) => [styles.add, { borderColor: c.borderInput, opacity: pressed ? 0.7 : 1 }]}
        >
          <Plus size={18} color={c.text} />
          <Text variant="sm" style={styles.semibold}>Zuweisen</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  day: { borderRadius: tokens.radius.lg, borderWidth: 1, overflow: 'hidden' },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14 },
  dayStripe: { position: 'absolute', left: 0, right: 0, top: 0, height: 8, overflow: 'hidden' },
  dayMeta: { flex: 1 },
  dayBody: { padding: 12, gap: 12 },
  shift: { borderRadius: tokens.radius.md, borderWidth: 1, padding: 12, gap: 10 },
  shiftHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  shiftTitle: { gap: 2, flexShrink: 1 },
  time: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shiftList: { gap: 8 },
  add: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: tokens.size.touchMin, borderRadius: tokens.radius.md, borderWidth: 1, borderStyle: 'dashed',
  },
  semibold: { fontFamily: 'Inter_600SemiBold' },
});
