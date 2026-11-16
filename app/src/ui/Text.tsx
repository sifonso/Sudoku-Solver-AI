import { Text as RNText, type TextProps } from 'react-native';
import { typeStyle, useTheme, type ColorRole, type TypeRole } from '../theme';

type Props = TextProps & { variant?: TypeRole; color?: ColorRole };

/** Jeder Text der App läuft hierüber: Typo-Rolle + Farbrolle, nie roher Hex-Wert. */
export function Text({ variant = 'base', color = 'text', style, ...rest }: Props) {
  const { c } = useTheme();
  return <RNText {...rest} style={[typeStyle(variant), { color: c[color] }, style]} />;
}
