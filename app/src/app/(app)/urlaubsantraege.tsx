import { Redirect } from 'expo-router';
import { Ban, Check, Inbox, Trash2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { canPlan } from '../../data/api';
import { useAbsences, useDecideAbsence, useMembers, usePlan, useVacationBlockMutations, useVacationBlocks } from '../../data/hooks';
import { useActive } from '../../data/session';
import { addDays, formatRange, today } from '../../domain/time';
import type { Absence } from '../../domain/types';
import { AppScreen } from '../../features/AppScreen';
import { useTheme } from '../../theme';
import { DateField } from '../../features/DateField';
import { errorText } from '../../features/errors';
import { vacationBalance } from '../../features/vacation';
import { Avatar, Badge, Banner, Button, Card, EmptyState, ListRow, SectionHeader, Skeleton, Tabs, Text, TextField } from '../../ui';

type Tab = 'offen' | 'genehmigt' | 'sperren';

/** S10 Urlaub (Planer): Anträge entscheiden mit Blick auf betroffene Schichten, Urlaubssperren pflegen. */
export default function VacationAdminScreen() {
  const { member } = useActive();
  if (!canPlan(member.role)) return <Redirect href="/urlaub-beantragen" />;
  return <VacationAdmin />;
}

function VacationAdmin() {
  const { c } = useTheme();
  const { tenant, member: me } = useActive();
  const now = today(tenant.timezone);
  const year = now.slice(0, 4);
  const horizon = addDays(now, 400);
  const [tab, setTab] = useState<Tab>('offen');
  const absences = useAbsences(`${year}-01-01`, horizon);
  const members = useMembers();
  const plan = usePlan(now, addDays(now, 120));
  const decide = useDecideAbsence();
  const blocks = useVacationBlocks();
  const blockOps = useVacationBlockMutations();
  const [bStart, setBStart] = useState<string | null>(null);
  const [bEnd, setBEnd] = useState<string | null>(null);
  const [bReason, setBReason] = useState('');
  const [bTouched, setBTouched] = useState(false);
  const [bKey, setBKey] = useState(0);

  const byId = useMemo(() => new Map((members.data ?? []).map((m) => [m.id, m])), [members.data]);
  const vac = (absences.data ?? []).filter((a) => a.kind === 'vacation');
  const open = vac.filter((a) => a.status === 'requested').sort((a, b) => a.startDate.localeCompare(b.startDate));
  const approved = vac.filter((a) => a.status === 'approved' && a.endDate >= now).sort((a, b) => a.startDate.localeCompare(b.startDate));

  const affected = (a: Absence) =>
    (plan.data ?? []).filter((s) => s.date >= a.startDate && s.date <= a.endDate && s.assignments.some((x) => x.memberId === a.memberId)).length;

  const row = (a: Absence, actions: boolean) => {
    const m = byId.get(a.memberId);
    if (!m) return null;
    const bal = absences.data ? vacationBalance(m, tenant, absences.data, year) : null;
    const n = affected(a);
    return (
      <View key={a.id} style={styles.item}>
        <ListRow
          title={m.displayName}
          subtitle={[
            formatRange(a.startDate, a.endDate),
            bal ? `${bal.daysOf(a)} Tage` : null,
            bal?.remaining != null ? `Rest danach ${bal.remaining}` : null,
          ].filter(Boolean).join(' · ')}
          leading={<Avatar initials={m.initials} employment={m.employmentType} />}
          trailing={n ? <Badge label={`${n} Schicht${n > 1 ? 'en' : ''} betroffen`} tone="highlight" /> : null}
        />
        {a.comment ? <Text variant="sm" color="textMuted" style={styles.comment}>„{a.comment}“</Text> : null}
        {actions ? (
          <View style={styles.actions}>
            <Button label="Ablehnen" icon={X} variant="secondary" size="sm"
              loading={decide.isPending && decide.variables?.id === a.id && !decide.variables.approve}
              onPress={() => decide.mutate({ id: a.id, approve: false })} />
            <Button label="Genehmigen" icon={Check} size="sm"
              loading={decide.isPending && decide.variables?.id === a.id && decide.variables.approve}
              onPress={() => decide.mutate({ id: a.id, approve: true })} />
          </View>
        ) : null}
      </View>
    );
  };

  const addBlock = () => {
    setBTouched(true);
    if (!bStart || !bEnd || bEnd < bStart) return;
    blockOps.add.mutate({ start: bStart, end: bEnd, reason: bReason.trim() || null }, {
      onSuccess: () => { setBStart(null); setBEnd(null); setBReason(''); setBTouched(false); setBKey((k) => k + 1); },
    });
  };

  return (
    <AppScreen title="Urlaub" eyebrow="Team" back onRefresh={() => absences.refetch()} refreshing={absences.isRefetching}>
      <Tabs<Tab> value={tab} onChange={setTab} options={[
        { value: 'offen', label: 'Offen', count: open.length },
        { value: 'genehmigt', label: 'Genehmigt', count: approved.length },
        { value: 'sperren', label: 'Sperren', count: blocks.data?.length },
      ]} />
      {decide.isError ? <Banner tone="danger" title={errorText(decide.error)} /> : null}

      {absences.isLoading || members.isLoading ? (
        <Skeleton height={120} />
      ) : tab === 'offen' ? (
        open.length ? <Card style={styles.list}>{open.map((a) => row(a, true))}</Card> : (
          <Card><EmptyState icon={Inbox} title="Keine offenen Anträge" body="Neue Anträge erscheinen hier, und du bekommst eine Mitteilung." /></Card>
        )
      ) : tab === 'genehmigt' ? (
        approved.length ? <Card style={styles.list}>{approved.map((a) => row(a, false))}</Card> : (
          <Card><EmptyState icon={Inbox} title="Kein genehmigter Urlaub" body="Genehmigter Urlaub ab heute steht hier und im Plan." /></Card>
        )
      ) : (
        <>
          {(blocks.data ?? []).length ? (
            <Card style={styles.list}>
              {blocks.data!.map((b) => (
                <ListRow key={b.id} title={formatRange(b.startDate, b.endDate)} subtitle={b.reason ?? undefined}
                  leading={<Ban size={20} color={c.onHighlightSoft} accessibilityElementsHidden />}
                  trailing={me.role === 'chef' ? (
                    <Button label="Sperre aufheben" icon={Trash2} size="sm" variant="ghost" onPress={() => blockOps.remove.mutate(b.id)} />
                  ) : null} />
              ))}
            </Card>
          ) : <Text variant="sm" color="textMuted">Keine Urlaubssperren.</Text>}
          {me.role === 'chef' ? (
            <>
              <SectionHeader title="Neue Sperre" />
              <Card style={styles.form}>
                <DateField key={`bv-${bKey}`} label="Von" value={bStart} onChange={setBStart} error={bTouched && !bStart ? 'Bitte ein gültiges Datum eingeben.' : undefined} />
                <DateField key={`bb-${bKey}`} label="Bis" value={bEnd} onChange={setBEnd}
                  error={bTouched && (!bEnd ? 'Bitte ein gültiges Datum eingeben.' : bStart && bEnd < bStart ? 'Das Ende liegt vor dem Beginn.' : undefined) || undefined} />
                <TextField label="Grund (optional)" value={bReason} onChangeText={setBReason} placeholder="z. B. Inventur" maxLength={120} />
                {blockOps.add.isError ? <Banner tone="danger" title={errorText(blockOps.add.error)} /> : null}
                <Button label="Sperre anlegen" icon={Ban} onPress={addBlock} loading={blockOps.add.isPending} />
              </Card>
            </>
          ) : null}
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 0 },
  item: { paddingBottom: 8 },
  comment: { paddingLeft: 52, paddingBottom: 4 },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', paddingBottom: 8 },
  form: { gap: 16 },
});
