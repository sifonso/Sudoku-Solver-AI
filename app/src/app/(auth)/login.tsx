import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ApiError } from '../../data/api';
import { DEMO_PASSWORD, DEMO_USERS } from '../../data/seed';
import { useSignIn } from '../../data/session';
import { AuthFrame } from '../../features/AuthFrame';
import { Banner, Button, Text, TextField } from '../../ui';

/** S02 Anmeldung */
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const signIn = useSignIn();

  const emailError = touched && !/^\S+@\S+\.\S+$/.test(email) ? 'Bitte eine gültige E-Mail-Adresse eingeben.' : undefined;
  const pwError = touched && password.length === 0 ? 'Bitte das Passwort eingeben.' : undefined;
  const submit = () => {
    setTouched(true);
    if (!/^\S+@\S+\.\S+$/.test(email) || !password) return;
    signIn.mutate({ email, password });
  };
  const failure =
    signIn.error instanceof ApiError && signIn.error.code === 'invalid_credentials'
      ? 'E-Mail oder Passwort stimmen nicht.'
      : signIn.error
        ? 'Anmeldung gerade nicht möglich. Bitte gleich noch einmal versuchen.'
        : null;

  return (
    <AuthFrame eyebrow="Anmelden" title="Willkommen zurück" intro="Melde dich mit deiner Arbeits-E-Mail an.">
      {failure ? <Banner tone="danger" title={failure} /> : null}
      <TextField
        label="E-Mail" value={email} onChangeText={setEmail} error={emailError}
        autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress"
        returnKeyType="next"
      />
      <TextField
        label="Passwort" value={password} onChangeText={setPassword} error={pwError}
        secureTextEntry autoComplete="current-password" textContentType="password"
        returnKeyType="go" onSubmitEditing={submit}
      />
      <Button label="Anmelden" onPress={submit} loading={signIn.isPending} fullWidth size="lg" />
      <View style={styles.row}>
        <Text variant="sm" color="textMuted">Neu hier?</Text>
        <Link href="/registrieren" accessibilityRole="link">
          <Text variant="sm" style={styles.link}>Firma registrieren</Text>
        </Link>
      </View>

      <View style={styles.demo}>
        <Text variant="label" color="textMuted">Demo-Zugänge (nur Testdaten)</Text>
        {DEMO_USERS.map((u) => (
          <Button
            key={u.id}
            label={u.label}
            variant="secondary"
            fullWidth
            onPress={() => {
              setEmail(u.email);
              setPassword(DEMO_PASSWORD);
              signIn.mutate({ email: u.email, password: DEMO_PASSWORD });
            }}
          />
        ))}
      </View>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', minHeight: 44 },
  link: { fontFamily: 'Inter_600SemiBold', textDecorationLine: 'underline' },
  demo: { gap: 8, marginTop: 8 },
});
