import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Check, Plus, Repeat, Users, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { dp as dpApi, useActor, useDp, useDpEntries, useMe, useSwapAction, useSwapBoard } from '../../../dienstplan/hooks';
import { addDays, byIdOf, cellFor, iso, isWork, shiftTime, type DpSettings, type Staff, type SwapOffer } from '../../../dienstplan/model';
import { SwapComposer, fmtDay } from '../../../dienstplan/SwapComposer';
import { CodeBadge, PersonPicker, PickChips, Sheet } from '../../../dienstplan/ui';
import { AppScreen } from '../../../features/AppScreen';
import { errorText } from '../../../features/errors';
import { useTheme } from '../../../theme';
import { Badge, Banner, Button, Card, EmptyState, SectionHeader, Skeleton, Text, TextField } from '../../../ui';

const STATUS: Record<SwapOffer['status'], { label: string; tone: 'neutral' | 'highlight' | 'success' | 'danger' | 'accent' }> = {
  open: { label: 'Offen', tone: 'highlight' },
  pending: { label: 'Wartet auf Genehmigung', tone: 'accent' },
  done: { label: 'Getauscht', tone: 'success' },
  rejected: { label: 'Abgelehnt', tone: 'danger' },
  cancelled: { label: 'Zurückgezogen', tone: 'neutral' },
};

/** Tauschbörse: anbieten, anfragen, 1:1- und Ringtausch vorschlagen; FK4/SL genehmigt bei Bedarf und kann selbst anbieten. */
export default function SwapBoardScreen() {
  const params = useLocalSearchParams<{ offer?: string; for?: string }>();
  const lead = useActor().isLead;
  const actor = useActor();
  const dp = useDp();
  const board = useSwapBoard();
  const me = useMe();
  const today = iso(new Date());
  const horizon = addDays(today, 120);
  const entries = useDpEntries(today, horizon);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerFor, setOfferFor] = useState<string | null>(null);
  const [offerDate, setOfferDate] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [ask, setAsk] = useState<SwapOffer | null>(null);
  const [ret, setRet] = useState<string>('none');
  const [compose, setCompose] = useState(false);

  const offer = useSwapAction((t, v: { staffId: string; date: string; note: string }, a) => dpApi.offerSwap(t, v, a));
  const request = useSwapAction((t, v: { id: string; staffId: string; returnDate: string | null }) => dpApi.requestSwap(t, v.id, v));
  const withdraw = useSwapAction((t, v: { id: string; staffId: string }) => dpApi.withdrawRequest(t, v.id, v.staffId));
  const accept = useSwapAction((t, v: { id: string; req: string }, a) => dpApi.acceptRequest(t, v.id, v.req, a));
  const respond = useSwapAction((t, v: { id: string; staffId: string; agree: boolean }) => dpApi.respondProposal(t, v.id, v.staffId, v.agree));
  const decide = useSwapAction((t, v: { id: string; ok: boolean }, a) => dpApi.decideSwap(t, v.id, v.ok, a));
  const cancel = useSwapAction((t, id: string, a) => dpApi.cancelSwap(t, id, a));
  const anyError = [offer, request, withdraw, accept, respond, decide, cancel].find((m) => m.isError)?.error;

  useEffect(() => {
    if (params.offer) { setOfferFor(params.for ?? me?.id ?? null); setOfferDate(params.offer); setNote(''); setOfferOpen(true); }
  }, [params.offer, params.for, me?.id]);

  const settings = dp.data?.settings;
  const staff = useMemo(() => dp.data?.staff ?? [], [dp.data]);
  const byId = useMemo(() => byIdOf(staff), [staff]);
  const codeOf = (s: Staff | undefined, d: string) => (s && settings ? cellFor(s, d, entries.map, settings, 'fein', byId).code : '');
  const workDays = (s: Staff | undefined) => {
    const out: { date: string; code: string }[] = [];
    if (!s || !settings) return out;
    for (let d = addDays(today, 1); d <= horizon && out.length < 45; d = addDays(d, 1)) {
      const code = codeOf(s, d);
      if (isWork(code, settings)) out.push({ date: d, code });
    }
    return out;
  };

  if (!dp.data || !settings || !board.data) return <AppScreen title="Tauschbörse"><Skeleton height={300} /></AppScreen>;
  const list = board.data;
  const live = (o: SwapOffer) => o.status === 'open' && (!o.date || o.date >= today);
  const involved = (o: SwapOffer) => !!me && (o.staffId === me.id || o.legs.some((l) => l.staffId === me.id));
  const needMe = list.filter((o) => live(o) && o.kind === 'direct' && !!me && o.legs.some((l) => l.staffId === me.id) && !o.accepted.includes(me.id));
  const pending = list.filter((o) => o.status === 'pending' && (lead || involved(o)));
  const mine = list.filter((o) => live(o) && involved(o) && !needMe.includes(o));
  const othersOffers = list.filter((o) => live(o) && o.kind === 'offer' && !involved(o));
  const othersDirect = lead ? list.filter((o) => live(o) && o.kind === 'direct' && !involved(o)) : [];
  const history = list.filter((o) => !live(o) && o.status !== 'pending').slice(0, 20);
  const name = (id: string) => byId.get(id)?.short ?? 'Unbekannt';
  const offerStaff = offerFor ? byId.get(offerFor) : undefined;
  const planned = staff.filter((s) => s.inPlan);

  // Gegendienst-Optionen für eine Anfrage: eigener Dienst am selben Tag (Schichttausch) oder an einem Tag, an dem der Anbieter frei ist
  const returnOptions = (o: SwapOffer) => {
    if (!me || !settings) return [];
    const owner = byId.get(o.staffId);
    const opts: { value: string; label: string }[] = [];
    const meSame = codeOf(me, o.date);
    if (isWork(meSame, settings)) opts.push({ value: o.date, label: `Am selben Tag tauschen: mein ${meSame}` });
    else opts.push({ value: 'none', label: 'Nur übernehmen' });
    for (const d of workDays(me)) {
      if (d.date !== o.date && owner && !isWork(codeOf(owner, d.date), settings)) opts.push({ value: d.date, label: `${fmtDay(d.date)} · ${d.code}` });
    }
    return opts;
  };

  return (
    <AppScreen title="Tauschbörse" eyebrow={settings.swapApproval ? 'Mit Genehmigung durch FK4 / SL' : 'Ohne Genehmigung'}
      onRefresh={() => board.refetch()} refreshing={board.isRefetching}
      actions={me || lead ? <Button label="Anbieten" icon={Plus} size="sm" onPress={() => { setOfferFor(me?.inPlan ? me.id : null); setOfferDate(null); setNote(''); setOfferOpen(true); offer.reset(); }} /> : null}>
      {!me && !lead ? (
        <Banner tone="info" title="Dein Login ist noch keiner Person im Dienstplan zugeordnet." body="Bitte FK4 / SL, dich zu verknüpfen." />
      ) : null}
      {anyError ? <Banner tone="danger" title={errorText(anyError)} /> : null}
      <Button label={lead ? 'Tausch anlegen (1:1 oder Ring)' : 'Tausch vorschlagen (1:1 oder Ring)'} icon={Users} variant="secondary"
        onPress={() => setCompose(true)} disabled={!lead && !me?.inPlan} />

      {needMe.length ? (
        <>
          <SectionHeader title="Wartet auf deine Zustimmung" count={needMe.length} />
          {needMe.map((o) => (
            <Card key={o.id} style={styles.card}>
              <Ring o={o} settings={settings} name={name} />
              {o.note ? <Text variant="sm" color="textMuted">„{o.note}“</Text> : null}
              <Text variant="xs" color="textMuted">Vorschlag von {o.createdByName}{o.createdByLead ? ' (FK4 / SL)' : ''} · zugestimmt: {o.accepted.map(name).join(', ') || 'noch niemand'}</Text>
              <View style={styles.row}>
                <Button label="Zustimmen" icon={Check} size="sm" loading={respond.isPending} onPress={() => respond.mutate({ id: o.id, staffId: me!.id, agree: true })} />
                <Button label="Ablehnen" icon={X} size="sm" variant="secondary" onPress={() => respond.mutate({ id: o.id, staffId: me!.id, agree: false })} />
              </View>
            </Card>
          ))}
        </>
      ) : null}

      {pending.length || lead ? (
        <>
          <SectionHeader title="Wartet auf Genehmigung" count={pending.length} />
          {pending.length === 0 ? <Text variant="sm" color="textMuted">Nichts offen.</Text> : pending.map((o) => (
            <Card key={o.id} style={styles.card}>
              <Ring o={o} settings={settings} name={name} legsOverride={o.kind === 'offer' ? offerLegs(o) : undefined} />
              {lead ? (
                <View style={styles.row}>
                  <Button label="Genehmigen" icon={Check} size="sm" loading={decide.isPending} onPress={() => decide.mutate({ id: o.id, ok: true })} />
                  <Button label="Ablehnen" icon={X} size="sm" variant="secondary" onPress={() => decide.mutate({ id: o.id, ok: false })} />
                </View>
              ) : <Badge label="Wartet auf FK4 / SL" tone="accent" />}
            </Card>
          ))}
        </>
      ) : null}

      <SectionHeader title={lead ? 'Meine und angelegte Tausche' : 'Meine Angebote und Vorschläge'} count={mine.length + (lead ? list.filter((o) => live(o) && o.createdByLead && !involved(o)).length : 0)} />
      {[...mine, ...(lead ? list.filter((o) => live(o) && o.createdByLead && !involved(o) && !mine.includes(o)) : [])].length === 0 ? (
        <Text variant="sm" color="textMuted">Nichts offen. Im Monatsplan auf einen Dienst tippen oder oben „Anbieten“.</Text>
      ) : [...mine, ...(lead ? list.filter((o) => live(o) && o.createdByLead && !involved(o) && !mine.includes(o)) : [])].map((o) => (
        <Card key={o.id} style={styles.card}>
          <Ring o={o} settings={settings} name={name} />
          {o.kind === 'direct' ? <Text variant="xs" color="textMuted">Zugestimmt: {o.accepted.map(name).join(', ') || 'noch niemand'}</Text> : null}
          {o.kind === 'offer' ? (o.requests.length === 0 ? <Text variant="sm" color="textMuted">Noch keine Anfragen.</Text> : o.requests.map((r) => (
            <View key={r.id} style={styles.req}>
              <Text variant="sm" style={{ flex: 1 }}>
                {name(r.staffId)} {r.returnDate ? (r.returnDate === o.date ? `tauscht am selben Tag (${codeOf(byId.get(r.staffId), r.returnDate)})` : `gibt dafür ${fmtDay(r.returnDate)} (${codeOf(byId.get(r.staffId), r.returnDate)})`) : 'übernimmt ohne Gegendienst'}
              </Text>
              <Button label="Annehmen" size="sm" loading={accept.isPending} onPress={() => accept.mutate({ id: o.id, req: r.id })} />
            </View>
          ))) : null}
          <Button label="Zurückziehen" size="sm" variant="ghost" onPress={() => cancel.mutate(o.id)} />
        </Card>
      ))}

      <SectionHeader title="Angebote der anderen" count={othersOffers.length} />
      {othersOffers.length === 0 ? (
        <EmptyState icon={Repeat} title="Keine offenen Angebote" body="Sobald jemand einen Dienst anbietet, steht er hier." />
      ) : othersOffers.map((o) => {
        const myReq = o.requests.find((r) => r.staffId === me?.id);
        return (
          <Card key={o.id} style={styles.card}>
            <Ring o={o} settings={settings} name={name} />
            {o.note ? <Text variant="sm" color="textMuted">„{o.note}“</Text> : null}
            <Text variant="xs" color="textMuted">{o.requests.length} Anfrage{o.requests.length === 1 ? '' : 'n'}{o.createdByLead ? ` · angeboten von ${o.createdByName} (FK4 / SL)` : ''}</Text>
            {me?.inPlan ? (myReq ? (
              <View style={styles.row}>
                <Badge label={myReq.returnDate ? `Angefragt, Gegendienst ${fmtDay(myReq.returnDate)}` : 'Angefragt'} tone="success" />
                <Button label="Zurückziehen" size="sm" variant="ghost" onPress={() => withdraw.mutate({ id: o.id, staffId: me.id })} />
              </View>
            ) : (
              <Button label="Anfragen" size="sm" onPress={() => { setAsk(o); setRet(returnOptions(o)[0]?.value ?? 'none'); request.reset(); }} />
            )) : null}
            {lead && o.requests.length ? o.requests.map((r) => (
              <View key={r.id} style={styles.req}>
                <Text variant="sm" style={{ flex: 1 }}>{name(r.staffId)} {r.returnDate ? `gegen ${fmtDay(r.returnDate)}` : 'übernimmt'}</Text>
                <Button label="Annehmen" size="sm" variant="secondary" onPress={() => accept.mutate({ id: o.id, req: r.id })} />
              </View>
            )) : null}
          </Card>
        );
      })}

      {othersDirect.length ? (
        <>
          <SectionHeader title="Laufende Vorschläge im Team" count={othersDirect.length} />
          {othersDirect.map((o) => (
            <Card key={o.id} style={styles.card}>
              <Ring o={o} settings={settings} name={name} />
              <Text variant="xs" color="textMuted">Zugestimmt: {o.accepted.map(name).join(', ') || 'noch niemand'}</Text>
              <Button label="Abbrechen" size="sm" variant="ghost" onPress={() => cancel.mutate(o.id)} />
            </Card>
          ))}
        </>
      ) : null}

      {history.length ? (
        <>
          <SectionHeader title="Verlauf" />
          {history.map((o) => <Card key={o.id} style={styles.card}><Ring o={o} settings={settings} name={name} /></Card>)}
        </>
      ) : null}

      <Sheet visible={offerOpen} title="Dienst anbieten" onClose={() => setOfferOpen(false)}>
        {lead ? (
          <PersonPicker value={offerFor} onChange={(v) => { setOfferFor(v); setOfferDate(null); }} options={planned.map((s) => ({ value: s.id, label: s.short }))} />
        ) : null}
        {offerStaff ? (
          workDays(offerStaff).length === 0 && !offerDate ? <Text color="textMuted">In den nächsten 120 Tagen keine Dienste.</Text> : (
            <PickChips label="Welcher Dienst?" showLabel value={offerDate} onChange={setOfferDate}
              options={[...(offerDate && !workDays(offerStaff).some((d) => d.date === offerDate) ? [{ date: offerDate, code: codeOf(offerStaff, offerDate) }] : []), ...workDays(offerStaff)]
                .map((d) => ({ value: d.date, label: `${fmtDay(d.date)} · ${d.code}` }))} />
          )
        ) : <Text color="textMuted">Bitte eine Person wählen.</Text>}
        <TextField label="Notiz (optional)" value={note} onChangeText={setNote} maxLength={300} placeholder="z. B. Arzttermin, nehme gern einen Spätdienst" />
        {offer.isError ? <Banner tone="danger" title={errorText(offer.error)} /> : null}
        <Button label="Anbieten" disabled={!offerDate || !offerFor} loading={offer.isPending}
          onPress={() => offerFor && offerDate && offer.mutate({ staffId: offerFor, date: offerDate, note }, { onSuccess: () => { setOfferOpen(false); router.setParams({ offer: undefined, for: undefined }); } })} />
      </Sheet>

      <Sheet visible={!!ask} title={ask ? `${name(ask.staffId)}: ${fmtDay(ask.date)} · ${ask.code}` : ''} onClose={() => setAsk(null)}>
        <Text variant="sm" color="textMuted">Hast du an dem Tag selbst Dienst, tauscht ihr die Schichten. Sonst kannst du nur übernehmen oder einen eigenen Dienst abgeben.</Text>
        {ask ? <PickChips label="Gegendienst" showLabel value={ret} onChange={setRet} options={returnOptions(ask)} /> : null}
        {request.isError ? <Banner tone="danger" title={errorText(request.error)} /> : null}
        <Button label="Anfrage senden" loading={request.isPending}
          onPress={() => ask && me && request.mutate({ id: ask.id, staffId: me.id, returnDate: ret === 'none' ? null : ret }, { onSuccess: () => setAsk(null) })} />
      </Sheet>

      <SwapComposer open={compose} onClose={() => setCompose(false)}
        initial={lead && !me?.inPlan ? [{ staffId: null, date: null }, { staffId: null, date: null }] : [{ staffId: me?.id ?? null, date: null }, { staffId: null, date: null }]} />
    </AppScreen>
  );

  function offerLegs(o: SwapOffer) {
    const r = o.requests.find((x) => x.id === o.acceptedRequestId);
    return r ? [{ staffId: o.staffId, date: o.date, code: o.code }, { staffId: r.staffId, date: r.returnDate, code: r.returnDate ? codeOf(byId.get(r.staffId), r.returnDate) : '' }] : undefined;
  }
}

/** Ring als lesbare Kette: „Brunner gibt T1/F (Mo, 4. Jan) → Kaschel“. */
function Ring({ o, settings, name, legsOverride }: { o: SwapOffer; settings: DpSettings; name: (id: string) => string; legsOverride?: SwapOffer['legs'] }) {
  const { c } = useTheme();
  const st = STATUS[o.status];
  const legs = legsOverride ?? o.legs;
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.line}>
        <Text variant="label" color="textMuted" style={{ flex: 1 }}>{o.kind === 'offer' ? 'Angebot' : legs.length > 2 ? `Ringtausch · ${legs.length} Personen` : 'Tausch 1:1'}</Text>
        <Badge label={st.label} tone={st.tone} />
      </View>
      {legs.map((l, i) => {
        const to = legs.length > 1 ? legs[(i + 1) % legs.length]!.staffId : null;
        const time = l.code ? shiftTime(l.code, settings) : null;
        if (o.kind === 'offer' && legs.length === 1) {
          return (
            <View key={i} style={styles.line}>
              <CodeBadge code={l.code} settings={settings} size="sm" />
              <Text variant="base" style={[styles.bold, { flex: 1 }]}>{name(l.staffId)} · {fmtDay(l.date ?? '')}</Text>
              {time ? <Text variant="xs" color="textMuted">{time}</Text> : null}
            </View>
          );
        }
        return (
          <View key={i} style={styles.line}>
            {l.date ? <CodeBadge code={l.code} settings={settings} size="sm" /> : <View style={{ width: 36 }} />}
            <Text variant="sm" style={{ flex: 1 }}>
              <Text variant="sm" style={styles.bold}>{name(l.staffId)}</Text>
              {l.date ? ` gibt ${fmtDay(l.date)}` : ' gibt nichts ab'}
            </Text>
            {to && l.date ? <><ArrowRight size={14} color={c.textMuted} /><Text variant="sm" style={styles.bold}>{name(to)}</Text></> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  req: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  bold: { fontFamily: 'Inter_600SemiBold' },
});
