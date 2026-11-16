import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ApiError } from '../../data/api';
import { useRegister } from '../../data/session';
import { AuthFrame } from '../../features/AuthFrame';
import { Banner, Button, Checkbox, Text, TextField } from '../../ui';

const slugify = (s: string) =>
  s.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).map((w) => w[0]!.toUpperCase()).join('').slice(0, 3);

/** S01 Registrierung: Konto + Firma in einem Schritt, 14 Tage Testzeit. */
export default function RegisterScreen() {
  const [company, setCompany] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [touched, setTouched] = useState(false);
  const register = useRegister();

  const effSlug = slugEdited ? slug : slugify(company);
  const errors = {
    company: company.trim().length < 2 ? 'Bitte den Namen deines Betriebs eingeben.' : undefined,
    slug: !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(effSlug) ? '3 bis 40 Zeichen: Kleinbuchstaben, Ziffern, Bindestrich.' : undefined,
    name: name.trim().length < 2 ? 'Bitte deinen Namen eingeben.' : undefined,
    email: !/^\S+@\S+\.\S+$/.test(email) ? 'Bitte eine gültige E-Mail-Adresse eingeben.' : undefined,
    password: password.length < 8 ? 'Mindestens 8 Zeichen.' : undefined,
    terms: !terms ? 'Bitte AGB und Datenschutz bestätigen.' : undefined,
  };
  const show = (k: keyof typeof errors) => (touched ? errors[k] : undefined);

  const submit = () => {
    setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    register.mutate({ email, password, company: company.trim(), slug: effSlug, name: name.trim(), initials: initialsOf(name) || 'CH' });
  };
  const err = register.error instanceof ApiError ? register.error.code : register.error ? 'network' : null;
  const failure =
    err === 'weak_password' ? 'Das Passwort ist zu schwach. Bitte ein längeres oder weniger übliches wählen.'
    : err === 'rate_limited' ? 'Zu viele Versuche. Bitte in ein paar Minuten noch einmal.'
    : err === 'email_taken' ? 'Mit dieser E-Mail gibt es schon ein Konto. Bitte anmelden.'
      : err === 'slug_taken' ? 'Diese Firmenadresse ist vergeben. Bitte eine andere wählen.'
        : err ? 'Registrierung gerade nicht möglich. Bitte gleich noch einmal versuchen.' : null;

  if (register.data?.status === 'confirm_email') {
    return (
      <AuthFrame eyebrow="Fast geschafft" title="Bitte E-Mail bestätigen"
        intro={`Wir haben einen Link an ${register.data.email} geschickt. Nach dem Klick meldest du dich an, und dein Betrieb wird angelegt.`}>
        <Text variant="sm" color="textMuted">Keine Mail da? Schau im Spam-Ordner nach. Der Link ist 24 Stunden gültig.</Text>
        <Link href="/login" asChild><Button label="Zur Anmeldung" fullWidth size="lg" /></Link>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame eyebrow="14 Tage kostenlos testen" title="Betrieb anlegen" intro="Du wirst Chef deines Betriebs und kannst danach dein Team einladen.">
      {failure ? <Banner tone="danger" title={failure} /> : null}
      <TextField label="Name des Betriebs" value={company} onChangeText={setCompany} error={show('company')} autoComplete="organization" />
      <TextField
        label="Firmenadresse"
        value={effSlug}
        onChangeText={(v) => { setSlugEdited(true); setSlug(v.toLowerCase()); }}
        hint={effSlug ? `Dein Team meldet sich unter „${effSlug}“ an.` : 'Wird aus dem Namen erzeugt.'}
        error={show('slug')}
        autoCapitalize="none"
      />
      <TextField label="Dein Name" value={name} onChangeText={setName} error={show('name')} autoComplete="name" />
      <TextField label="E-Mail" value={email} onChangeText={setEmail} error={show('email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <TextField label="Passwort" value={password} onChangeText={setPassword} error={show('password')} secureTextEntry autoComplete="new-password" hint="Mindestens 8 Zeichen." />
      <View>
        <Checkbox label="Ich akzeptiere AGB und Datenschutzerklärung." checked={terms} onChange={setTerms} />
        {show('terms') ? <Text variant="xs" color="danger">{show('terms')}</Text> : null}
      </View>
      <Button label="Betrieb anlegen" onPress={submit} loading={register.isPending} fullWidth size="lg" />
      <View style={styles.row}>
        <Text variant="sm" color="textMuted">Schon registriert?</Text>
        <Link href="/login" accessibilityRole="link"><Text variant="sm" style={styles.link}>Anmelden</Text></Link>
      </View>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', minHeight: 44 },
  link: { fontFamily: 'Inter_600SemiBold', textDecorationLine: 'underline' },
});
