import { router, useLocalSearchParams } from 'expo-router';
import { Check, Plus, Repeat, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useActive } from '../../../data/session';
import { canLead, dp as dpApi, useDp, useDpEntries, useMe, useSwapAction, useSwapBoard } from '../../../dienstplan/hooks';
import { MONTHS, WEEKDAYS, addDays, cellFor, iso, isWork, parseIso, shiftTime, type DpSettings, type SwapOffer } from '../../../dienstplan/model';
import { CodeBadge, PickChips, Sheet } from '../../../dienstplan/ui';
import { AppScreen } from '../../../features/AppScreen';
import { errorText } from '../../../features/errors';
import { Badge, Banner, Button, Card, EmptyState, SectionHeader, Skeleton, Text, TextField } from '../../../ui';

const STATUS: Record<SwapOffer['status'], { label: string; tone: 'neutral' | 'highlight' | 'success' | 'danger' | 'accent' }> = {
  open: { label: 'Offen', tone: 'highlight' },
  pending: { label: 'Wartet auf Genehmigung', tone: 'accent' },
  done: { label: 'Getauscht', tone: 'success' },
  rejected: { label: 'Abgelehnt', tone: 'danger' },
  cancelled: { label: 'Zurückgezogen', tone: 'neutral' },
};
const fmt = (d: string) => { const x = parseIso(d); return `${WEEKDAYS[x.getDay()]}, ${x.getDate()}. ${(MONTHS[x.getMonth()] ?? '').slice(0, 3)}`; };

/** Tauschbörse: Dienste anbieten, unter Kolleg:innen anfragen, annehmen; FK4/SL genehmigt bei Bedarf. */
export default function SwapBoardScreen() {
  const params = useLocalSearchParams<{ offer?: string }>();
  const { member } = useActive();
  const lead = canLead(member.role);
  const dp = useDp();
  const board = useSwapBoard();
  const me = useMe();
  const today = iso(new Date());
  const horizon = addDays(today, 90);
  const entries = useDpEntries(today, horizon);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerDate, setOfferDate] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [ask, setAsk] = useState<SwapOffer | null>(null);
  const [ret, setRet] = useState<string>('none');

  const offer = useSwapAction((t, v: { staffId: string; date: string; note: string }) => dpApi.offerSwap(t, v));
  const request = useSwapAction((t, v: { id: string; staffId: string; returnDate: string | null }) => dpApi.requestSwap(t, v.id, v));
  const withdraw = useSwapAction((t, v: { id: string; staffId: string }) => dpApi.withdrawRequest(t, v.id, v.staffId));
  const accept = useSwapAction((t, v: { id: string; req: string }) => dpApi.acceptRequest(t, v.id, v.req));
  const decide = useSwapAction((t, v: { id: string; ok: boolean }) => dpApi.decideSwap(t, v.id, v.ok, me?.id ?? null));
  const cancel = useSwapAction((t, id: string) => dpApi.cancelSwap(t, id));
  const anyError = [offer, request, withdraw, accept, decide, cancel].find((m) => m.isError)?.error;

  useEffect(() => { if (params.offer) { setOfferDate(params.offer); setOfferOpen(true); } }, [params.offer]);

  const settings = dp.data?.settings;
  const staffById = useMemo(() => new Map((dp.data?.staff ?? []).map((s) => [s.id, s])), [dp.data]);
  const myWorkDays = useMemo(() => {
    if (!me || !settings) return [];
    const out: { date: string; code: string }[] = [];
    for (let d = addDays(today, 1); d <= horizon; d = addDays(d, 1)) {
      const cell = cellFor(me, d, entries.map, settings);
      if (isWork(cell.code, settings)) out.push({ date: d, code: cell.code });
    }
    return out;
  }, [me, settings, entries.map, today, horizon]);

  if (!dp.data || !settings || !board.data) return <AppScreen title="Tauschbörse"><Skeleton height={300} /></AppScreen>;
  const list = board.data;
  const open = list.filter((o) => o.status === 'open' && o.date >= today);
  const mine = open.filter((o) => o.staffId === me?.id);
  const others = open.filter((o) => o.staffId !== me?.id);
  const pending = list.filter((o) => o.status === 'pending');
  const history = list.filter((o) => !(o.status === 'open' && o.date >= today) && o.status !== 'pending').slice(0, 20);
  const name = (id: string) => staffById.get(id)?.short ?? 'Unbekannt';
  const busyOn = (date: string) => !!me && isWork(cellFor(me, date, entries.map, settings).code, settings);

  return (
    <AppScreen title="Tauschbörse" eyebrow={settings.swapApproval ? 'Mit Genehmigung durch FK4 / SL' : 'Ohne Genehmigung'}
      onRefresh={() => board.refetch()} refreshing={board.isRefetching}
      actions={me ? <Button label="Anbieten" icon={Plus} size="sm" onPress={() => { setOfferDate(null); setNote(''); setOfferOpen(true); offer.reset(); }} /> : null}>
      {!me ? (
        <Banner tone="info" title="Dein Login ist noch keiner Person im Dienstplan zugeordnet."
          body={lead ? 'Unter Team → Person → Login verknüpfen. Genehmigen kannst du trotzdem.' : 'Bitte FK4 / SL, dich zu verknüpfen.'} />
      ) : null}
      {anyError ? <Banner tone="danger" title={errorText(anyError)} /> : null}

      {lead || pending.some((o) => o.staffId === me?.id) ? (
        <>
          <SectionHeader title="Wartet auf Genehmigung" count={pending.length} />
          {pending.length === 0 ? <Text variant="sm" color="textMuted">Nichts offen.</Text> : pending.map((o) => {
            const r = o.requests.find((x) => x.id === o.acceptedRequestId);
            return (
              <Card key={o.id} style={styles.card}>
                <SwapLine o={o} settings={settings} who={name(o.staffId)} />
                <Text variant="sm">→ {r ? name(r.staffId) : '?'} übernimmt{r?.returnDate ? `, gibt dafür ${fmt(r.returnDate)} ab` : ''}</Text>
                {lead ? (
                  <View style={styles.row}>
                    <Button label="Genehmigen" icon={Check} size="sm" loading={decide.isPending} onPress={() => decide.mutate({ id: o.id, ok: true })} />
                    <Button label="Ablehnen" icon={X} size="sm" variant="secondary" onPress={() => decide.mutate({ id: o.id, ok: false })} />
                  </View>
                ) : <Badge label="Wartet auf FK4 / SL" tone="accent" />}
              </Card>
            );
          })}
        </>
      ) : null}

      <SectionHeader title="Meine Angebote" count={mine.length} />
      {mine.length === 0 ? <Text variant="sm" color="textMuted">Du bietest gerade nichts an. Im Monatsplan auf einen eigenen Dienst tippen oder oben „Anbieten“.</Text> : mine.map((o) => (
        <Card key={o.id} style={styles.card}>
          <SwapLine o={o} settings={settings} who="Du" />
          {o.requests.length === 0 ? <Text variant="sm" color="textMuted">Noch keine Anfragen.</Text> : o.requests.map((r) => (
            <View key={r.id} style={styles.req}>
              <Text variant="sm" style={{ flex: 1 }}>{name(r.staffId)} {r.returnDate ? `tauscht gegen ${fmt(r.returnDate)} (${cellFor(staffById.get(r.staffId)!, r.returnDate, entries.map, settings).code})` : 'übernimmt ohne Gegendienst'}</Text>
              <Button label="Annehmen" size="sm" loading={accept.isPending} onPress={() => accept.mutate({ id: o.id, req: r.id })} />
            </View>
          ))}
          <Button label="Angebot zurückziehen" size="sm" variant="ghost" onPress={() => cancel.mutate(o.id)} />
        </Card>
      ))}

      <SectionHeader title="Angebote der anderen" count={others.length} />
      {others.length === 0 ? (
        <EmptyState icon={Repeat} title="Keine offenen Angebote" body="Sobald jemand einen Dienst anbietet, steht er hier." />
      ) : others.map((o) => {
        const myReq = o.requests.find((r) => r.staffId === me?.id);
        const conflict = busyOn(o.date);
        return (
          <Card key={o.id} style={styles.card}>
            <SwapLine o={o} settings={settings} who={name(o.staffId)} />
            {o.note ? <Text variant="sm" color="textMuted">„{o.note}“</Text> : null}
            <Text variant="xs" color="textMuted">{o.requests.length} Anfrage{o.requests.length === 1 ? '' : 'n'}</Text>
            {me ? (myReq ? (
              <View style={styles.row}>
                <Badge label={myReq.returnDate ? `Angefragt, Gegendienst ${fmt(myReq.returnDate)}` : 'Angefragt'} tone="success" />
                <Button label="Zurückziehen" size="sm" variant="ghost" onPress={() => withdraw.mutate({ id: o.id, staffId: me.id })} />
              </View>
            ) : conflict ? (
              <Text variant="sm" color="textMuted">Du hast an dem Tag selbst Dienst.</Text>
            ) : (
              <Button label="Anfragen" size="sm" onPress={() => { setAsk(o); setRet('none'); request.reset(); }} />
            )) : null}
          </Card>
        );
      })}

      {history.length ? (
        <>
          <SectionHeader title="Verlauf" />
          {history.map((o) => (
            <Card key={o.id} style={styles.card}><SwapLine o={o} settings={settings} who={name(o.staffId)} /></Card>
          ))}
        </>
      ) : null}

      <Sheet visible={offerOpen} title="Dienst anbieten" onClose={() => setOfferOpen(false)}>
        {myWorkDays.length === 0 ? <Text color="textMuted">In den nächsten 90 Tagen hast du keine Dienste.</Text> : (
          <PickChips label="Welcher Dienst?" showLabel value={offerDate} onChange={setOfferDate}
            options={myWorkDays.map((d) => ({ value: d.date, label: `${fmt(d.date)} · ${d.code}` }))} />
        )}
        <TextField label="Notiz (optional)" value={note} onChangeText={setNote} maxLength={300} placeholder="z. B. Arzttermin, nehme gern einen Spätdienst" />
        {offer.isError ? <Banner tone="danger" title={errorText(offer.error)} /> : null}
        <Button label="Anbieten" disabled={!offerDate || !me} loading={offer.isPending}
          onPress={() => me && offerDate && offer.mutate({ staffId: me.id, date: offerDate, note }, { onSuccess: () => { setOfferOpen(false); router.setParams({ offer: undefined }); } })} />
      </Sheet>

      <Sheet visible={!!ask} title={ask ? `${name(ask.staffId)}: ${fmt(ask.date)} · ${ask.code}` : ''} onClose={() => setAsk(null)}>
        <Text variant="sm" color="textMuted">Übernimmst du nur, oder gibst du dafür einen eigenen Dienst ab?</Text>
        <PickChips label="Gegendienst" showLabel value={ret} onChange={setRet}
          options={[{ value: 'none', label: 'Nur übernehmen' },
            ...myWorkDays.filter((d) => ask && d.date !== ask.date && staffById.get(ask.staffId) && !isWork(cellFor(staffById.get(ask.staffId)!, d.date, entries.map, settings).code, settings))
              .map((d) => ({ value: d.date, label: `${fmt(d.date)} · ${d.code}` }))]} />
        {request.isError ? <Banner tone="danger" title={errorText(request.error)} /> : null}
        <Button label="Anfrage senden" loading={request.isPending}
          onPress={() => ask && me && request.mutate({ id: ask.id, staffId: me.id, returnDate: ret === 'none' ? null : ret }, { onSuccess: () => setAsk(null) })} />
      </Sheet>
    </AppScreen>
  );
}

function SwapLine({ o, settings, who }: { o: SwapOffer; settings: DpSettings; who: string }) {
  const st = STATUS[o.status];
  const time = shiftTime(o.code, settings);
  return (
    <View style={styles.line}>
      <CodeBadge code={o.code} settings={settings} />
      <View style={{ flex: 1 }}>
        <Text variant="base" style={styles.bold}>{who} · {fmt(o.date)}</Text>
        {time ? <Text variant="xs" color="textMuted">{time}</Text> : null}
      </View>
      <Badge label={st.label} tone={st.tone} />
    </View>
  );
}


const styles = StyleSheet.create({
  card: { gap: 8 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  req: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  bold: { fontFamily: 'Inter_600SemiBold' },
});
