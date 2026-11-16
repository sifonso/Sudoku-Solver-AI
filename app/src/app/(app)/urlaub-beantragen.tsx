import { Palmtree } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAbsences, useCancelAbsence, useRequestVacation, useVacationBlocks } from '../../data/hooks';
import { useActive } from '../../data/session';
import { formatRange, today, workdaysBetween } from '../../domain/time';
import { AppScreen } from '../../features/AppScreen';
import { DateField } from '../../features/DateField';
import { errorText } from '../../features/errors';
import { absenceStatusLabel, vacationBalance } from '../../features/vacation';
import { Badge, Banner, Button, Card, ListRow, SectionHeader, Skeleton, Text, TextField } from '../../ui';

const tone = { requested: 'highlight', approved: 'success', rejected: 'danger', cancelled: 'neutral' } as const;

/** S22 Urlaub beantragen: Zeitraum, Kommentar, Resturlaub, eigene Anträge mit Zurückziehen. */
export default function VacationRequestScreen() {
  const { tenant, member } = useActive();
  const now = today(tenant.timezone);
  const year = now.slice(0, 4);
  const absences = useAbsences(`${year}-01-01`, `${Number(year) + 1}-12-31`);
  const blocks = useVacationBlocks();
  const request = useRequestVacation();
  const cancel = useCancelAbsence();
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const [formKey, setFormKey] = useState(0); // leert die Datumsfelder nach dem Absenden

  const errors = {
    start: !start ? 'Bitte ein gültiges Datum eingeben.' : start < now ? 'Der Urlaub muss in der Zukunft liegen.' : undefined,
    end: !end ? 'Bitte ein gültiges Datum eingeben.' : start && end < start ? 'Das Ende liegt vor dem Beginn.' : undefined,
  };
  const days = start && end && end >= start ? workdaysBetween(start, end, tenant.workdays) : null;
  const balance = absences.data ? vacationBalance(member, tenant, absences.data, year) : null;
  const blocked = start && end ? blocks.data?.find((b) => b.startDate <= end && b.endDate >= start) : undefined;
  const mine = (absences.data ?? []).filter((a) => a.memberId === member.id && a.kind === 'vacation')
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  const submit = () => {
    setTouched(true);
    setSent(false);
    if (errors.start || errors.end || !start || !end) return;
    request.mutate({ start, end, comment: comment.trim() || null }, {
      onSuccess: () => { setSent(true); setStart(null); setEnd(null); setComment(''); setTouched(false); setFormKey((k) => k + 1); },
    });
  };

  return (
    <AppScreen title="Urlaub" back onRefresh={() => absences.refetch()} refreshing={absences.isRefetching}>
      {balance && balance.entitlement != null ? (
        <Card style={styles.balance}>
          <View style={{ flex: 1 }}>
            <Text variant="label" color="textMuted">Resturlaub {year}</Text>
            <Text variant="xl">{balance.remaining} Tage</Text>
          </View>
          <Text variant="sm" color="textMuted">
            {balance.entitlement} Anspruch · {balance.approved} genehmigt · {balance.requested} offen
          </Text>
        </Card>
      ) : null}

      {sent ? <Banner tone="success" title="Antrag ist gestellt." body="Du bekommst eine Mitteilung, sobald entschieden ist." /> : null}
      {request.isError ? <Banner tone="danger" title={errorText(request.error)} /> : null}

      <Card style={styles.form}>
        <DateField key={`von-${formKey}`} label="Von" value={start} onChange={setStart} error={touched ? errors.start : undefined} />
        <DateField key={`bis-${formKey}`} label="Bis" value={end} onChange={setEnd} error={touched ? errors.end : undefined} />
        {days != null ? (
          <Text variant="sm">{days} Arbeitstag{days === 1 ? '' : 'e'}{balance?.remaining != null && days > balance.remaining ? ' · mehr als dein Resturlaub' : ''}</Text>
        ) : null}
        {blocked ? (
          <Banner tone="warning" title={`Urlaubssperre ${formatRange(blocked.startDate, blocked.endDate)}`}
            body={blocked.reason ?? 'In diesem Zeitraum kann kein Urlaub beantragt werden.'} />
        ) : null}
        <TextField label="Kommentar (optional)" value={comment} onChangeText={setComment} maxLength={300} multiline />
        <Button label="Urlaub beantragen" icon={Palmtree} fullWidth size="lg" loading={request.isPending} onPress={submit}
          disabled={!!blocked} />
      </Card>

      <SectionHeader title="Meine Anträge" count={mine.length} />
      {absences.isLoading ? (
        <Skeleton height={64} />
      ) : mine.length === 0 ? (
        <Text variant="sm" color="textMuted">Noch keine Anträge in {year}.</Text>
      ) : (
        <Card style={styles.list}>
          {mine.map((a) => (
            <ListRow
              key={a.id}
              title={formatRange(a.startDate, a.endDate)}
              subtitle={[`${balance?.daysOf(a) ?? '?'} Tage`, a.comment].filter(Boolean).join(' · ')}
              trailing={
                <View style={styles.trail}>
                  <Badge label={absenceStatusLabel[a.status]} tone={tone[a.status]} />
                  {a.status === 'requested' ? (
                    <Button label="Zurückziehen" size="sm" variant="ghost" loading={cancel.isPending && cancel.variables === a.id}
                      onPress={() => cancel.mutate(a.id)} />
                  ) : null}
                </View>
              }
            />
          ))}
        </Card>
      )}
      {cancel.isError ? <Banner tone="danger" title={errorText(cancel.error)} /> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  balance: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' },
  form: { gap: 16 },
  list: { paddingVertical: 0 },
  trail: { alignItems: 'flex-end', gap: 4 },
});
