import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens, useTheme } from '../theme';
import { Pattern, Text } from '../ui';

/** Rahmen für Anmeldung und Registrierung: Musterkopf, Karte mit Formular. */
export function AuthFrame({ eyebrow, title, intro, children }: {
  eyebrow: string; title: string; intro: string; children: ReactNode;
}) {
  const { c, scheme } = useTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.head}>
            <Pattern kind="streifen" fg={scheme === 'dark' ? c.accentSoft : c.accentSoft} bg={c.accent} tile={26} />
          </View>
          <View style={[styles.card, { backgroundColor: c.surfaceRaised, borderColor: c.border }]}>
            <Text variant="label" color="onHighlightSoft">{eyebrow}</Text>
            <Text variant="xl" accessibilityRole="header">{title}</Text>
            <Text variant="sm" color="textMuted">{intro}</Text>
            <View style={styles.form}>{children}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 32 },
  head: { height: 140, overflow: 'hidden' },
  card: {
    marginTop: -48, marginHorizontal: 16, padding: 20, gap: 6, borderRadius: tokens.radius.lg, borderWidth: 1,
    width: '100%', maxWidth: 480, alignSelf: 'center',
  },
  form: { gap: 16, marginTop: 16 },
});
