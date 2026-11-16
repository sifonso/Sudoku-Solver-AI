import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import { tokens, useTheme, type ColorRole } from '../theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'highlight';
type Size = 'sm' | 'md' | 'lg';

const look: Record<Variant, { bg: ColorRole | null; fg: ColorRole; border: ColorRole | null }> = {
  primary: { bg: 'accent', fg: 'onAccent', border: null },
  secondary: { bg: 'surfaceRaised', fg: 'text', border: 'borderInput' },
  ghost: { bg: null, fg: 'text', border: null },
  danger: { bg: 'danger', fg: 'onDanger', border: null },
  highlight: { bg: 'highlight', fg: 'onHighlight', border: null },
};
const heights: Record<Size, number> = {
  sm: tokens.size.buttonSm,
  md: tokens.size.buttonMd,
  lg: tokens.size.buttonLg,
};

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
};

export function Button({ label, variant = 'primary', size = 'md', icon: Icon, loading, fullWidth, disabled, style, ...rest }: Props) {
  const { c } = useTheme();
  const v = look[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      hitSlop={size === 'sm' ? 4 : 0}
      style={(state) => {
        const focused = (state as { focused?: boolean }).focused;
        return [
          styles.base,
          {
            minHeight: heights[size],
            paddingHorizontal: size === 'sm' ? 12 : 16,
            backgroundColor: v.bg ? c[v.bg] : 'transparent',
            borderColor: focused ? c.focus : v.border ? c[v.border] : 'transparent',
            borderWidth: focused ? 2 : v.border ? 1 : 0,
            opacity: off ? 0.5 : state.pressed ? 0.85 : 1,
            alignSelf: fullWidth ? 'stretch' : 'flex-start',
          },
          typeof style === 'function' ? style(state) : style,
        ];
      }}
      {...rest}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator size="small" color={c[v.fg]} />
        ) : Icon ? (
          <Icon size={18} color={c[v.fg]} strokeWidth={2} />
        ) : null}
        <Text variant={size === 'sm' ? 'xs' : 'sm'} color={v.fg} style={styles.label}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

type IconButtonProps = Omit<PressableProps, 'children'> & {
  icon: LucideIcon;
  label: string; // Pflicht: Screenreader-Name
  tone?: 'plain' | 'soft' | 'onAccent';
  badge?: boolean;
};

export function IconButton({ icon: Icon, label, tone = 'plain', badge, style, ...rest }: IconButtonProps) {
  const { c } = useTheme();
  const bg = tone === 'soft' ? c.surface : tone === 'onAccent' ? 'rgba(255,255,255,0.18)' : 'transparent';
  const fg = tone === 'onAccent' ? c.onAccent : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={(state) => [
        styles.icon,
        { backgroundColor: bg, opacity: state.pressed ? 0.7 : 1 },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      <Icon size={20} color={fg} strokeWidth={2} />
      {badge ? <View style={[styles.dot, { backgroundColor: c.highlight, borderColor: c.bg }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: tokens.radius.md, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontFamily: 'Inter_600SemiBold' },
  icon: {
    width: tokens.size.touchMin,
    height: tokens.size.touchMin,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { position: 'absolute', top: 10, right: 10, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});
