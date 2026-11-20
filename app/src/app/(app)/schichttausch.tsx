import { Check, Hand, Repeat, X } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { canPlan } from '../../data/api';
import { useMembers, useMyShifts, useSwapMutations, useSwapWarnings, useSwaps } from '../../data/hooks';
import { useActive } from '../../data/session';
import { warningText } from '../../domain/rules';
import { addDays, formatDate, localTime, today, weekdayShort } from '../../domain/time';
import type { Member, SwapView } from '../../domain/types';
import { AppScreen } from '../../features/AppScreen';
import { errorText } from '../../features/errors';
import { Badge, Banner, Button, Card, EmptyState, SectionHeader, Skeleton, Text } from '../../ui';

const statusLabel: Record<SwapView['status'], { label: string; tone: 'neutral' | 'highlight' | 'success' | 'danger' | 'accent' }> = {
  open: { label: 'Offen', tone: 'highlight' },
  pending_approval: { label: 'Wartet auf Freigabe', tone: 'accent' },
  approved: { label: 'Getauscht', tone: 'success' },
  rejected: { label: 'Abgelehnt', tone: 'danger' },
  cancelled: { label: 'Zurückgezogen', tone: 'neutral' },
  expired: { label: 'Abgelaufen', tone: 'neutral' },
};

/** S24 Schichttausch: anbieten, übernehmen, Bewerber wählen, freigeben (Planer). */
export default function SwapScreen() {
  const { tenant, member: me } = useActive();
  const tz = tenant.timezone;
  const now = today(tz);
  const swaps = useSwaps();
  const members = useMembers();
  const mine = useMyShifts(now, addDays(now, 27));
  const ops = useSwapMutations();
  const byId = useMemo(() => new Map((members.data ?? []).map((m) => [m.id, m])), [members.data]);
  const planner = canPlan(me.role);

  const all = swaps.data ?? [];
  const active = (w: SwapView) => w.status === 'open' || w.status === 'pending_approval';
  const myOffers = all.filter((w) => w.offeredBy === me.id && (active(w) || w.shift.date >= now));
  const others = all.filter((w) => w.offeredBy !== me.id && w.status === 'open' && w.shift.date >= now && w.assignment.memberId !== me.id);
  const approvals = planner ? all.filter((w) => w.status === 'pending_approval') : [];
  const offeredAssignments = new Set(all.filter(active).map((w) => w.assignment.id));
  const offerable = (mine.data ?? []).filter((s) => !offeredAssignments.has(s.assignment.id));

  const when = (w: SwapView) =>
    `${w.shiftType?.name ?? w.shift.name ?? 'Schicht'} · ${weekdayShort(w.shift.date)} ${formatDate(w.shift.date)} · ${localTime(w.assignment.startAt, tz)}–${localTime(w.assignment.endAt, tz)}`;
  const name = (id: string | null) => (id ? byId.get(id)?.displayName ?? '?' : '');
  const error = ops.offer.error ?? ops.apply.error ?? ops.decide.error;

  return (
    <AppScreen back title="Schichttausch" eyebrow={tenant.name} onRefresh={() => swaps.refetch()} refreshing={swaps.isRefetching}>
      {error ? <Banner tone="danger" title={errorText(error)} /> : null}
      {ops.decide.data === 'pending_approval' ? (
        <Banner tone="info" title="Ausgewählt." body="Der Tausch wartet jetzt auf die Freigabe durch Chef oder Planer." />
      ) : ops.decide.data === 'approved' ? (
        <Banner tone="success" title="Getauscht." body="Der Plan ist aktualisiert, beide wurden benachrichtigt." />
      ) : null}

      {swaps.isLoading || members.isLoading ? (
        <Skeleton height={140} />
      ) : (
        <>
          {approvals.length ? (
            <>
              <SectionHeader title="Zur Freigabe" count={approvals.length} />
              {approvals.map((w) => (
                <Approval key={w.id} w={w} when={when(w)} from={byId.get(w.offeredBy)} to={byId.get(w.chosenMemberId ?? '')}
                  busy={ops.decide.isPending && ops.decide.variables?.swapId === w.id}
                  onDecide={(approve) => ops.decide.mutate({ swapId: w.id, memberId: w.chosenMemberId!, approve })} />
              ))}
            </>
          ) : null}

          <SectionHeader title="Angebote von Kollegen" count={others.length} />
          {others.length === 0 ? (
            <Text variant="sm" color="textMuted">Gerade bietet niemand eine Schicht an.</Text>
          ) : (
            others.map((w) => {
              const applied = w.applicantIds.includes(me.id);
              return (
                <Card key={w.id} style={styles.card}>
                  <Text variant="base" style={styles.bold}>{when(w)}</Text>
                  <Text variant="sm" color="textMuted">Angeboten von {name(w.offeredBy)}</Text>
                  {applied ? (
                    <Badge label="Du hast dich gemeldet" tone="accent" />
                  ) : (
                    <Button label="Ich übernehme" icon={Hand} size="sm"
                      loading={ops.apply.isPending && ops.apply.variables === w.id}
                      onPress={() => ops.apply.mutate(w.id)} />
                  )}
                </Card>
              );
            })
          )}

          <SectionHeader title="Meine Angebote" count={myOffers.length} />
          {myOffers.length === 0 ? (
            <Text variant="sm" color="textMuted">Du bietest gerade keine Schicht an.</Text>
          ) : (
            myOffers.map((w) => (
              <Card key={w.id} style={styles.card}>
                <View style={styles.row}>
                  <Text variant="base" style={[styles.bold, { flex: 1 }]}>{when(w)}</Text>
                  <Badge label={statusLabel[w.status].label} tone={statusLabel[w.status].tone} />
                </View>
                {w.status === 'open' ? (
                  w.applicantIds.length === 0 ? (
                    <Text variant="sm" color="textMuted">Noch keine Meldung. Kollegen sehen dein Angebot hier und bekommen es angezeigt.</Text>
                  ) : (
                    <View style={styles.applicants}>
                      <Text variant="label" color="textMuted">Wer übernimmt?</Text>
                      {w.applicantIds.map((id) => (
                        <Button key={id} label={`${name(id)} wählen`} variant="secondary" size="sm"
                          loading={ops.decide.isPending && ops.decide.variables?.memberId === id}
                          onPress={() => ops.decide.mutate({ swapId: w.id, memberId: id, approve: true })} />
                      ))}
                    </View>
                  )
                ) : w.status === 'pending_approval' ? (
                  <Text variant="sm" color="textMuted">An {name(w.chosenMemberId)}, wartet auf Freigabe.</Text>
                ) : w.status === 'approved' ? (
                  <Text variant="sm" color="textMuted">Übernommen von {name(w.chosenMemberId)}.</Text>
                ) : null}
              </Card>
            ))
          )}

          <SectionHeader title="Schicht anbieten" />
          {mine.isLoading ? (
            <Skeleton height={64} />
          ) : offerable.length === 0 ? (
            <Card><EmptyState icon={Repeat} title="Nichts zum Anbieten" body="Hier stehen deine Schichten der nächsten vier Wochen, die du abgeben kannst." /></Card>
          ) : (
            offerable.map((s) => (
              <Card key={s.assignment.id} style={styles.cardRow}>
                <Text variant="base" style={{ flex: 1 }}>
                  {s.shiftType?.name ?? s.shift.name} · {weekdayShort(s.shift.date)} {formatDate(s.shift.date)} · {localTime(s.assignment.startAt, tz)}–{localTime(s.assignment.endAt, tz)}
                </Text>
                <Button label="Anbieten" icon={Repeat} size="sm" variant="secondary"
                  loading={ops.offer.isPending && ops.offer.variables === s.assignment.id}
                  onPress={() => ops.offer.mutate(s.assignment.id)} />
              </Card>
            ))
          )}
          <Text variant="xs" color="textMuted">
            {tenant.swapRequiresApproval
              ? 'In deinem Betrieb gibt ein Chef oder Planer jeden Tausch frei.'
              : 'In deinem Betrieb gilt ein Tausch sofort, sobald du jemanden auswählst.'}
          </Text>
        </>
      )}
    </AppScreen>
  );
}

function Approval({ w, when, from, to, busy, onDecide }: {
  w: SwapView; when: string; from?: Member; to?: Member; busy: boolean; onDecide: (approve: boolean) => void;
}) {
  const warnings = useSwapWarnings(w.shift.id, w.chosenMemberId, true);
  return (
    <Card style={styles.card}>
      <Text variant="base" style={styles.bold}>{when}</Text>
      <Text variant="sm">{from?.displayName ?? '?'} → {to?.displayName ?? '?'}</Text>
      {warnings.data?.length ? (
        <Banner tone="warning" title={`Hinweise zu ${to?.displayName ?? ''}`}
          body={warnings.data.map(warningText).join(' · ')} />
      ) : warnings.isSuccess ? (
        <Text variant="sm" color="textMuted">Keine Hinweise: passt in den Plan.</Text>
      ) : null}
      <View style={styles.row}>
        <Button label="Ablehnen" icon={X} size="sm" variant="secondary" disabled={busy} onPress={() => onDecide(false)} />
        <Button label="Freigeben" icon={Check} size="sm" loading={busy} onPress={() => onDecide(true)} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  applicants: { gap: 6, alignItems: 'flex-start' },
  bold: { fontFamily: 'Inter_600SemiBold' },
});
