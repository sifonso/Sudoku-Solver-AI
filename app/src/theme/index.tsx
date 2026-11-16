import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Platform, useColorScheme, type TextStyle, type ViewStyle } from 'react-native';
import { tokens, type ColorRole, type TypeRole } from './tokens';

export { tokens };
export type { ColorRole, TypeRole };

export type Scheme = 'light' | 'dark';
type Colors = Record<ColorRole, string>;

const fontFiles = {
  display: {
    600: 'BarlowSemiCondensed_600SemiBold',
    700: 'BarlowSemiCondensed_700Bold',
  },
  sans: {
    400: 'Inter_400Regular',
    500: 'Inter_500Medium',
    600: 'Inter_600SemiBold',
    700: 'Inter_700Bold',
  },
} as const;

/** Text-Stil für eine Typo-Rolle. Auf Android braucht jede Schriftstärke ihre eigene Datei. */
export function typeStyle(role: TypeRole): TextStyle {
  const t = tokens.type[role] as {
    size: number; line: number; weight: number; family: 'display' | 'sans';
    tracking?: number; case?: 'upper';
  };
  const files = fontFiles[t.family] as Record<number, string>;
  const fontFamily = files[t.weight] ?? files[600] ?? files[400];
  return {
    fontFamily,
    fontSize: t.size,
    lineHeight: t.line,
    letterSpacing: t.tracking ?? 0,
    textTransform: t.case === 'upper' ? 'uppercase' : 'none',
  };
}

export function shadow(kind: keyof typeof tokens.shadow): ViewStyle {
  const s = tokens.shadow[kind];
  if (Platform.OS === 'android') return { elevation: s.elevation };
  return {
    shadowColor: s.color,
    shadowOpacity: s.opacity,
    shadowRadius: s.radius,
    shadowOffset: { width: 0, height: s.offsetY },
  };
}

export const space = (step: number) => tokens.space[step] ?? step * 4;

type Theme = { scheme: Scheme; c: Colors };
const ThemeContext = createContext<Theme | null>(null);

/** Folgt dem System, außer `scheme` ist gesetzt (z. B. Design-Seite, Nutzereinstellung). */
export function ThemeProvider({ scheme, children }: { scheme?: Scheme; children: ReactNode }) {
  const system = useColorScheme();
  const active: Scheme = scheme ?? (system === 'dark' ? 'dark' : 'light');
  const value = useMemo(() => ({ scheme: active, c: tokens.color[active] as Colors }), [active]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme außerhalb von ThemeProvider');
  return t;
}
