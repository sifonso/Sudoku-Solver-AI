import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ApiError } from '../../data/api';
import { backend } from '../../data/client';
import { DEMO_PASSWORD, DEMO_USERS } from '../../data/seed';
import { useJoinWithCode, useSession, useSignIn, useSignOut } from '../../data/session';
import { errorText } from '../../features/errors';
import { AuthFrame } from '../../features/AuthFrame';
import { Banner, Button, Text, TextField } from '../../ui';

/** S02 Anmeldung */
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const signIn = useSignIn();
  const signOut = useSignOut();
  const { needsTenant, session } = useSession();
  const join = useJoinWithCode();
  const [joinCode, setJoinCode] = useState('');

  const emailError = touched && !/^\S+@\S+\.\S+$/.test(email) ? 'Bitte eine gültige E-Mail-Adresse eingeben.' : undefined;
  const pwError = touched && password.length === 0 ? 'Bitte das Passwort eingeben.' : undefined;
  const submit = () => {
    setTouched(true);
    if (!/^\S+@\S+\.\S+$/.test(email) || !password) return;
    signIn.mutate({ email, password });
  };
  const code = signIn.error instanceof ApiError ? signIn.error.code : null;
  const failure =
    code === 'invalid_credentials'
      ? 'E-Mail oder Passwort stimmen nicht, oder die E-Mail ist noch nicht bestätigt.'
      : code === 'rate_limited' ? 'Zu viele Versuche. Bitte in ein paar Minuten noch einmal.'
      : signIn.error
        ? 'Anmeldung gerade nicht möglich. Bitte gleich noch einmal versuchen.'
        : null;

  return (
    <AuthFrame eyebrow="Anmelden" title="Willkommen zurück" intro="Melde dich mit deiner Arbeits-E-Mail an.">
      {needsTenant ? (
        <View style={styles.join}>
          <Banner tone="warning" title={`${session?.email ?? 'Dieses Konto'} gehört noch zu keinem Betrieb.`}
            body="Gib den Einladungscode von deiner FK4 bzw. SL ein oder melde dich ab."
            action={<Button label="Abmelden" size="sm" variant="secondary" onPress={() => signOut.mutate()} />} />
          <TextField label="Einladungscode" value={joinCode} onChangeText={(v) => setJoinCode(v.toUpperCase())} autoCapitalize="characters"
            placeholder="K7MP-4QXA" maxLength={9} error={join.isError ? errorText(join.error) : undefined} />
          <Button label="Beitreten" onPress={() => join.mutate(joinCode)} loading={join.isPending} fullWidth />
        </View>
      ) : null}
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
          <Text variant="sm" style={styles.link}>{process.env.EXPO_PUBLIC_INVITE_ONLY === '1' ? 'Mit Einladungscode registrieren' : 'Firma registrieren'}</Text>
        </Link>
      </View>

      {backend === 'demo' ? (<View style={styles.demo}>
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
      </View>) : null}
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', minHeight: 44 },
  link: { fontFamily: 'Inter_600SemiBold', textDecorationLine: 'underline' },
  demo: { gap: 8, marginTop: 8 },
  join: { gap: 12 },
});
