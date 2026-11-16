import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { tokens, typeStyle, useTheme } from '../theme';
import { Text } from './Text';

type FieldProps = TextInputProps & { label: string; hint?: string; error?: string };

/** Beschriftetes Eingabefeld. Fehler werden als Text und per Rahmen gezeigt, nicht nur per Farbe. */
export function TextField({ label, hint, error, editable = true, style, onFocus, onBlur, ...rest }: FieldProps) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? c.danger : focused ? c.focus : c.borderInput;
  return (
    <View style={styles.wrap}>
      <Text variant="label" color="textMuted">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        editable={editable}
        placeholderTextColor={c.textMuted}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        style={[
          typeStyle('base'),
          styles.input,
          {
            color: c.text,
            backgroundColor: editable ? c.surfaceRaised : c.surface,
            borderColor,
            borderWidth: focused || error ? 2 : 1,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="xs" color="danger">{error}</Text>
      ) : hint ? (
        <Text variant="xs" color="textMuted">{hint}</Text>
      ) : null}
    </View>
  );
}

export function Checkbox({ label, checked, onChange, disabled }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={[styles.check, { opacity: disabled ? 0.5 : 1 }]}
    >
      <View
        style={[
          styles.box,
          { borderColor: checked ? c.accent : c.borderInput, backgroundColor: checked ? c.accent : 'transparent' },
        ]}
      >
        {checked ? <Check size={16} color={c.onAccent} strokeWidth={3} /> : null}
      </View>
      <Text variant="base">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: { minHeight: tokens.size.input, borderRadius: tokens.radius.md, paddingHorizontal: 14 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: tokens.size.touchMin },
  box: { width: 24, height: 24, borderRadius: tokens.radius.sm, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
