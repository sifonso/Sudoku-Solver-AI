import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Share2, UserPlus } from 'lucide-react-native';
import { Share, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { useInviteMember } from '../../../data/hooks';
import { useDp, useSaveStaff } from '../../../dienstplan/hooks';
import { useActive } from '../../../data/session';
import { AppScreen } from '../../../features/AppScreen';
import { errorText } from '../../../features/errors';
import { MemberFields, initialsOf, validateDraft, type MemberDraft } from '../../../features/MemberForm';
import { Banner, Button, Card, Text, TextField } from '../../../ui';

/** S08 (neu): Person einladen. Sie ist sofort einplanbar und wird nach dem ersten Login verknüpft. */
export default function InviteScreen() {
  const { tenant, member } = useActive();
  const invite = useInviteMember();
  // Aus der Personen-Seite: Name vorbelegen und die Person im Dienstplan nach dem Einladen verknüpfen
  const params = useLocalSearchParams<{ name?: string; staff?: string }>();
  const dp = useDp();
  const saveStaff = useSaveStaff();
  const [draft, setDraft] = useState<MemberDraft>({ displayName: params.name ?? '', initials: params.name ? initialsOf(params.name) : '', role: 'mitarbeiter', employmentType: 'vollzeit', monthlyHoursLimit: '', vacationDays: '' });
  const [initialsEdited, setInitialsEdited] = useState(false);
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState<{ name: string; code: string } | null>(null);

  if (member.role !== 'chef') return <Redirect href="/personal" />;

  const errors = validateDraft(draft);
  const emailError = !/^\S+@\S+\.\S+$/.test(email.trim()) ? 'Bitte eine gültige E-Mail-Adresse eingeben.' : undefined;
  const submit = () => {
    setTouched(true);
    if (Object.values(errors).some(Boolean) || emailError) return;
    invite.mutate(
      {
        tenantId: tenant.id, displayName: draft.displayName.trim(), initials: draft.initials.trim(), email: email.trim(),
        role: draft.role, employmentType: draft.employmentType,
      },
      {
        onSuccess: (r) => {
          const st = params.staff ? dp.data?.staff.find((x) => x.id === params.staff) : undefined;
          if (st) saveStaff.mutate({ ...st, memberId: r.memberId });
          setDone({ name: draft.displayName.trim(), code: r.code });
          setDraft({ displayName: '', initials: '', role: 'mitarbeiter', employmentType: 'vollzeit', monthlyHoursLimit: '', vacationDays: '' });
          setEmail('');
          setTouched(false);
          setInitialsEdited(false);
        },
      },
    );
  };

  return (
    <AppScreen title="Person einladen" back>
      {done ? (
        <Card style={styles.done}>
          <Text variant="label" color="onSuccessSoft">{done.name} ist eingeladen</Text>
          <Text variant="sm">Gib diesen Einladungscode weiter. {done.name.split(' ')[0]} registriert sich in der App mit „Mit Einladungscode“. Der Code gilt 14 Tage und nur einmal.</Text>
          <Text variant="display" selectable accessibilityLabel={`Einladungscode ${done.code.split('').join(' ')}`} style={styles.code}>{done.code}</Text>
          <View style={styles.row}>
            <Button label="Code teilen" icon={Share2} variant="secondary" size="sm"
              onPress={() => { Share.share({ message: `Dein Einladungscode für unseren Schichtplan: ${done.code} (in der App „Registrieren“ → „Mit Einladungscode“)` }).catch(() => {}); }} />
            <Button label="Zum Team" size="sm" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/personal'))} />
          </View>
          <Text variant="xs" color="textMuted">Du kannst {done.name.split(' ')[0]} schon jetzt einplanen.</Text>
        </Card>
      ) : null}
      {invite.isError ? <Banner tone="danger" title={errorText(invite.error)} /> : null}
      <Card style={{ gap: 16 }}>
        <MemberFields
          showLimit={false}
          draft={draft}
          errors={touched ? errors : null}
          onChange={(d) => { if (d.initials !== draft.initials) setInitialsEdited(true); setDraft(d); }}
          onNameChange={(name) => setDraft({ ...draft, displayName: name, initials: initialsEdited ? draft.initials : initialsOf(name) })}
        />
        <TextField label="E-Mail" value={email} onChangeText={setEmail} error={touched ? emailError : undefined}
          autoCapitalize="none" keyboardType="email-address" autoComplete="email"
          hint="Für Kontaktdaten im Team. Die Anmeldung läuft über den Einladungscode." />
        <Button label="Einladung senden" icon={UserPlus} onPress={submit} loading={invite.isPending} fullWidth size="lg" />
      </Card>
      <Text variant="xs" color="textMuted">
        Die Stundengrenze legst du nach dem Einladen im Profil der Person fest.
      </Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  done: { gap: 10 },
  code: { letterSpacing: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
