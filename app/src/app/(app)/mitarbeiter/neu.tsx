import { Redirect, router } from 'expo-router';
import { UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { useInviteMember } from '../../../data/hooks';
import { useActive } from '../../../data/session';
import { AppScreen } from '../../../features/AppScreen';
import { errorText } from '../../../features/errors';
import { MemberFields, initialsOf, validateDraft, type MemberDraft } from '../../../features/MemberForm';
import { Banner, Button, Card, Text, TextField } from '../../../ui';

/** S08 (neu): Person einladen. Sie ist sofort einplanbar und wird nach dem ersten Login verknüpft. */
export default function InviteScreen() {
  const { tenant, member } = useActive();
  const invite = useInviteMember();
  const [draft, setDraft] = useState<MemberDraft>({ displayName: '', initials: '', role: 'mitarbeiter', employmentType: 'vollzeit', monthlyHoursLimit: '', vacationDays: '' });
  const [initialsEdited, setInitialsEdited] = useState(false);
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState<string | null>(null);

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
        onSuccess: () => {
          setDone(draft.displayName.trim());
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
        <Banner tone="success" title={`${done} ist eingeladen.`}
          body="Die Einladung geht per E-Mail raus. Du kannst die Person schon jetzt einplanen."
          action={<Button label="Zum Team" size="sm" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/personal'))} />} />
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
          hint="An diese Adresse geht der Einladungslink." />
        <Button label="Einladung senden" icon={UserPlus} onPress={submit} loading={invite.isPending} fullWidth size="lg" />
      </Card>
      <Text variant="xs" color="textMuted">
        Die Stundengrenze legst du nach dem Einladen im Profil der Person fest.
      </Text>
    </AppScreen>
  );
}
