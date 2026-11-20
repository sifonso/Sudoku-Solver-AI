import { router, useLocalSearchParams } from 'expo-router';
import { Archive, Lock, Unlock, UserX } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { roleLabel } from '../../../data/api';
import { useMember, useMemberContact, useUpdateMember } from '../../../data/hooks';
import { useActive } from '../../../data/session';
import { AppScreen } from '../../../features/AppScreen';
import { errorText } from '../../../features/errors';
import { MemberFields, parseLimit, validateDraft, type MemberDraft } from '../../../features/MemberForm';
import { Avatar, Badge, Banner, Button, Card, EmptyState, SectionHeader, Skeleton, Text, employmentLabel } from '../../../ui';

/** S08 Mitarbeiter: Stammdaten, Rolle, Beschäftigung, Stundengrenze, Sperren, Archivieren. Ändern darf nur der Chef. */
export default function MemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { member: me } = useActive();
  const member = useMember(id ?? '');
  const contact = useMemberContact(id ?? '');
  const update = useUpdateMember();
  const [draft, setDraft] = useState<MemberDraft | null>(null);
  const [touched, setTouched] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const m = member.data;
  const isChef = me.role === 'chef';

  useEffect(() => {
    if (m && !draft) {
      setDraft({
        displayName: m.displayName, initials: m.initials, role: m.role, employmentType: m.employmentType,
        monthlyHoursLimit: m.monthlyHoursLimit == null ? '' : String(m.monthlyHoursLimit).replace('.', ','),
        vacationDays: m.vacationDaysPerYear == null ? '' : String(m.vacationDaysPerYear).replace('.', ','),
      });
    }
  }, [m, draft]);

  if (member.isLoading) {
    return <AppScreen title="Mitarbeiter" back><Skeleton height={80} /><Skeleton height={320} /></AppScreen>;
  }
  if (!m) {
    return (
      <AppScreen title="Mitarbeiter" back>
        <Card><EmptyState icon={UserX} title="Nicht gefunden" body="Diese Person ist nicht (mehr) im Team." /></Card>
      </AppScreen>
    );
  }

  const errors = draft ? validateDraft(draft) : null;
  const save = () => {
    if (!draft) return;
    setTouched(true);
    if (errors && Object.values(errors).some(Boolean)) return;
    update.mutate(
      {
        id: m.id,
        patch: {
          displayName: draft.displayName.trim(), initials: draft.initials.trim(), role: draft.role,
          employmentType: draft.employmentType, monthlyHoursLimit: parseLimit(draft.monthlyHoursLimit),
          vacationDaysPerYear: parseLimit(draft.vacationDays),
        },
      },
      { onSuccess: () => setNotice('Gespeichert.') },
    );
  };
  const setStatus = (status: 'active' | 'locked' | 'archived', msg: string) =>
    update.mutate({ id: m.id, patch: { status } }, {
      onSuccess: () => {
        setNotice(msg);
        if (status === 'archived') (router.canGoBack() ? router.back() : router.replace('/personal'));
      },
    });

  return (
    <AppScreen title={m.displayName} eyebrow="Mitarbeiter" back>
      <Card style={styles.head}>
        <Avatar initials={m.initials} employment={m.employmentType} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="lg">{m.displayName}</Text>
          <Text variant="sm" color="textMuted">{roleLabel[m.role]} · {employmentLabel[m.employmentType]}</Text>
          {contact.data?.email ? <Text variant="sm" color="textMuted">{contact.data.email}</Text> : null}
        </View>
        {m.status === 'invited' ? <Badge label="Eingeladen" tone="highlight" /> : null}
        {m.status === 'locked' ? <Badge label="Gesperrt" tone="danger" /> : null}
      </Card>

      {notice ? <Banner tone="success" title={notice} /> : null}
      {update.isError ? <Banner tone="danger" title={errorText(update.error)} /> : null}

      {!isChef ? (
        <Text variant="sm" color="textMuted">Nur FK4 / SL kann Angaben im Team ändern.</Text>
      ) : draft ? (
        <>
          <Card style={{ gap: 16 }}>
            <MemberFields draft={draft} onChange={(d) => { setDraft(d); setNotice(null); }} errors={touched ? errors : null} />
            <Button label="Speichern" onPress={save} loading={update.isPending} fullWidth />
          </Card>

          <SectionHeader title="Zugang" />
          <Card style={{ gap: 12 }}>
            {m.status === 'locked' ? (
              <>
                <Text variant="sm" color="textMuted">Gesperrt: kann sich nicht anmelden und wird nicht zur Planung vorgeschlagen.</Text>
                <Button label="Entsperren" icon={Unlock} variant="secondary" onPress={() => setStatus('active', 'Wieder aktiv.')} />
              </>
            ) : m.status === 'active' ? (
              <>
                <Text variant="sm" color="textMuted">Sperren nimmt den Zugang vorübergehend weg, alles andere bleibt.</Text>
                <Button label="Sperren" icon={Lock} variant="secondary" onPress={() => setStatus('locked', 'Gesperrt.')} />
              </>
            ) : null}
            {!confirmArchive ? (
              <Button label="Aus dem Team entfernen" icon={Archive} variant="ghost" onPress={() => setConfirmArchive(true)} />
            ) : (
              <View style={{ gap: 10 }}>
                <Text variant="sm">
                  {m.displayName} verschwindet aus dem Team und wird nicht mehr zur Planung vorgeschlagen. Vergangene Schichten bleiben für Statistik und Nachweise erhalten. Schon geplante künftige Schichten bleiben stehen; bitte neu besetzen.
                </Text>
                <View style={styles.row}>
                  <Button label="Abbrechen" variant="secondary" onPress={() => setConfirmArchive(false)} />
                  <Button label="Entfernen" variant="danger" icon={Archive} onPress={() => setStatus('archived', 'Entfernt.')} />
                </View>
              </View>
            )}
          </Card>
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
