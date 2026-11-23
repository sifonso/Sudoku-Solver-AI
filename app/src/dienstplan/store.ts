// Speicherung des Dienstplans. Demo: im Speicher, Startdaten aus `globalThis.__DP_SEED__`
// (vom Veröffentlichungsskript eingesetzt, nie im Repository) oder aus sample.ts.
import { ApiError } from '../data/api';
import {
  DEFAULT_SETTINGS, addDays as addDaysIso, byIdOf, cellFor, indexEntries, isWork,
  type AuditEntry, type Carpool, type DocItem, type FlexDay, type DpComment, type VacationReq, type DpSeed, type DpSettings, type Entry, type Staff, type SwapLeg, type SwapOffer,
} from './model.ts';
import { sampleSeed } from './sample';
import { api as fakeApi } from '../data/fake';
import { SwapError, legsOf, planRing } from './swap.ts';

export interface DpState { settings: DpSettings; staff: Staff[]; carpools: Carpool[] }

/** Wer gerade handelt. staffId = eigene Person im Plan (falls verknüpft). */
export interface Actor { memberId: string; name: string; isLead: boolean; staffId: string | null; isFk3?: boolean }

export interface DpApi {
  load(tenantId: string): Promise<DpState>;
  entries(tenantId: string, from: string, to: string): Promise<Entry[]>;
  /** code '' und flex false löscht den Eintrag (Rhythmus gilt wieder). */
  setEntry(tenantId: string, e: Entry, actor?: Actor): Promise<void>;
  /** Mehrere Einträge auf einmal (Autodisposition). Nur FK4/SL. */
  setEntries(tenantId: string, list: Entry[], actor?: Actor, source?: string): Promise<void>;
  saveSettings(tenantId: string, s: DpSettings): Promise<void>;
  saveStaff(tenantId: string, s: Staff, actor?: Actor): Promise<void>;
  /** Endgültig löschen, mit allen Einträgen. Sonst „archived“ setzen. */
  deleteStaff(tenantId: string, id: string, actor?: Actor): Promise<void>;
  saveCarpools(tenantId: string, list: Carpool[]): Promise<void>;
  /** Planungsprotokoll, neueste zuerst. Nur FK4/SL. */
  audit(tenantId: string, limit: number): Promise<AuditEntry[]>;
  /** Mitteilung an alle FK4/SL (z. B. unbesetzte Pflichtdienste). */
  alertLeads(tenantId: string, title: string, body: string): Promise<void>;

  vacations(tenantId: string, year: number): Promise<VacationReq[]>;
  vacWish(tenantId: string, input: { from: string; to: string; priority: 1 | 2; note: string; staffId?: string }, actor: Actor): Promise<void>;
  vacDelete(tenantId: string, id: string, actor: Actor): Promise<void>;
  /** FK4/SL: vormerken oder ablehnen */
  vacReview(tenantId: string, id: string, ok: boolean, reason: string, actor: Actor): Promise<void>;
  /** FK3 (ohne FK3: FK4/SL): freigeben, dann U an Diensttagen im Plan */
  vacRelease(tenantId: string, id: string, ok: boolean, reason: string, actor: Actor): Promise<void>;

  /** FK4/SL ändert Zeitraum/Priorität/Notiz; Person nur eigene Wünsche. Genehmigter Urlaub wird im Plan nachgezogen. */
  vacUpdate(tenantId: string, id: string, input: { from: string; to: string; priority: 1 | 2; note: string }, actor: Actor): Promise<void>;
  /** Person bittet um Storno oder Änderung eines vorgemerkten/genehmigten Urlaubs. */
  vacChangeRequest(tenantId: string, id: string, input: { kind: 'storno' | 'aenderung'; from?: string; to?: string }, actor: Actor): Promise<void>;
  vacChangeDecide(tenantId: string, id: string, ok: boolean, actor: Actor): Promise<void>;

  flex(tenantId: string, year: number): Promise<FlexDay[]>;
  flexAdd(tenantId: string, input: { date: string; staffId?: string; byEmployer?: boolean }, actor: Actor): Promise<void>;
  flexDelete(tenantId: string, id: string, actor: Actor): Promise<void>;
  /** Mitteilung an alle im Betrieb (z. B. Aufforderung zur Urlaubsabgabe). Nur FK4/SL. */
  notifyAll(tenantId: string, title: string, body: string): Promise<void>;

  docs(tenantId: string): Promise<DocItem[]>;
  addDoc(tenantId: string, input: { title: string; category: string; note: string; validFrom: string | null; file: { name: string; mime: string; size: number; base64: string } | null }, actor: Actor): Promise<void>;
  deleteDoc(tenantId: string, id: string, actor: Actor): Promise<void>;
  /** Adresse zum Öffnen (Demo: data:-URL, Live: befristeter Link) */
  docUrl(tenantId: string, doc: DocItem): Promise<string>;

  swaps(tenantId: string): Promise<SwapOffer[]>;
  /** Dienst in der Börse anbieten. FK4/SL darf für jede Person anbieten. */
  offerSwap(tenantId: string, input: { staffId: string; date: string; note: string }, actor: Actor): Promise<void>;
  /** Vollständiger Vorschlag (1:1, auch am selben Tag, oder Ringtausch). */
  proposeSwap(tenantId: string, input: { legs: SwapLeg[]; note: string }, actor: Actor): Promise<void>;
  /** Beteiligte Person stimmt einem Vorschlag zu bzw. lehnt ab. */
  respondProposal(tenantId: string, id: string, staffId: string, agree: boolean): Promise<void>;
  requestSwap(tenantId: string, offerId: string, input: { staffId: string; returnDate: string | null }): Promise<void>;
  withdrawRequest(tenantId: string, offerId: string, staffId: string): Promise<void>;
  /** Anbieter (oder FK4/SL) wählt eine Anfrage. */
  acceptRequest(tenantId: string, offerId: string, requestId: string, actor: Actor): Promise<void>;
  /** FK4/SL genehmigt oder lehnt ab. */
  decideSwap(tenantId: string, offerId: string, approve: boolean, actor: Actor): Promise<void>;
  cancelSwap(tenantId: string, offerId: string, actor: Actor): Promise<void>;

  comments(tenantId: string, from: string, to: string): Promise<DpComment[]>;
  addComment(tenantId: string, input: { staffId: string; date: string; text: string; mark: string }, actor: Actor): Promise<void>;
  /** Nur Verfasser:in; Einträge von FK4/SL dürfen alle FK4/SL ändern. */
  updateComment(tenantId: string, id: string, input: { text: string; mark: string }, actor: Actor): Promise<void>;
  deleteComment(tenantId: string, id: string, actor: Actor): Promise<void>;
}

/** Darf freigeben: FK3, oder FK4/SL wenn keine FK3 eingetragen sind. */
export const canRelease = (actor: Pick<Actor, 'isLead' | 'isFk3'>, s: DpSettings) => !!actor.isFk3 || (actor.isLead && s.vacation.approvers.length === 0);

export const canEditComment = (c: DpComment, actor: Pick<Actor, 'memberId' | 'isLead'>) =>
  c.authorMemberId === actor.memberId || (c.authorIsLead && actor.isLead);

const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
let n = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(n++).toString(36)}`;

export function mergeSettings(partial?: Partial<DpSettings>): DpSettings {
  return {
    ...DEFAULT_SETTINGS, ...(partial ?? {}),
    minStaffing: { ...DEFAULT_SETTINGS.minStaffing, ...(partial?.minStaffing ?? {}) },
    presets: { ...DEFAULT_SETTINGS.presets, ...(partial?.presets ?? {}) },
    dispo: mergeDispo(partial?.dispo),
    vacation: { ...DEFAULT_SETTINGS.vacation, ...(partial?.vacation ?? {}) },
  };
}

/** Ältere Stände (eine Qualifikation je Arbeitsplatz als Text) in das aktuelle Format bringen. */
function mergeDispo(d?: Partial<DpSettings['dispo']>): DpSettings['dispo'] {
  const base = DEFAULT_SETTINGS.dispo;
  const qualFor: Record<string, string[]> = { ...base.qualFor };
  for (const [wp, v] of Object.entries((d?.qualFor ?? {}) as Record<string, unknown>)) {
    qualFor[wp] = Array.isArray(v) ? (v as string[]) : typeof v === 'string' && v ? [v] : [];
  }
  return { ...base, ...(d ?? {}), qualFor, qualAll: { ...base.qualAll, ...(d?.qualAll ?? {}) } } as DpSettings['dispo'];
}

/** Fehler der Tauschregel als ApiError. */
export function asApi<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof SwapError) throw new ApiError(e.code, e.message);
    throw e;
  }
}

/** Darf ein Vorschlag ohne weitere Genehmigung vollzogen werden? */
export const needsApproval = (o: SwapOffer, s: DpSettings) => s.swapApproval && !o.createdByLead;

function fakeStore(seed?: DpSeed): DpApi {
  const raw = seed ?? (globalThis as { __DP_SEED__?: DpSeed }).__DP_SEED__ ?? sampleSeed();
  const db = {
    settings: mergeSettings(raw.settings),
    staff: clone(raw.staff),
    entries: clone(raw.entries),
    carpools: clone(raw.carpools),
    swaps: [] as SwapOffer[],
    comments: [] as DpComment[],
    audit: [] as AuditEntry[],
    vacations: [] as VacationReq[],
    flex: [] as FlexDay[],
    docs: [] as DocItem[],
  };
  const log = (a: Partial<AuditEntry> & { actorName?: string }) => {
    db.audit.unshift({ id: uid('log'), at: new Date().toISOString(), actorName: a.actorName ?? 'System', staffId: a.staffId ?? null, date: a.date ?? null,
      oldCode: a.oldCode ?? null, newCode: a.newCode ?? null, source: a.source ?? 'plan', text: a.text ?? '' });
  };
  // Demo-Konten: die Mitarbeiterin sieht den Plan der ersten Person im Plan, die FK4/SL die erste Teamleitung.
  const firstPlan = db.staff.find((x) => x.inPlan);
  if (firstPlan && !db.staff.some((x) => x.memberId === 'm-mira')) firstPlan.memberId = 'm-mira';
  const lead = db.staff.find((x) => x.isLead);
  if (lead && !db.staff.some((x) => x.memberId === 'm-jana')) lead.memberId = 'm-jana';

  const fmtCode = (e?: Entry) => (e ? `${e.code}${e.flex ? ' FLEX' : ''}` : null);
  const put = (e: Entry, actorName = 'System', source = 'plan') => {
    const old = db.entries.find((x) => x.staffId === e.staffId && x.date === e.date);
    db.entries = db.entries.filter((x) => !(x.staffId === e.staffId && x.date === e.date));
    if (e.code || e.flex) db.entries.push({ ...e });
    const next = e.code || e.flex ? e : undefined;
    if (fmtCode(old) !== fmtCode(next)) log({ actorName, staffId: e.staffId, date: e.date, oldCode: fmtCode(old), newCode: fmtCode(next), source });
  };
  let swapActor = 'System';
  // Mitteilungen landen in der Demo-Datenschicht (Glocke)
  type FakeNote = { id: string; tenantId: string; memberId: string; type: string; title: string; body: string; data: Record<string, string>; readAt: null; createdAt: string };
  const fdb = (fakeApi as unknown as { _db: { notifications: FakeNote[]; members: { id: string; tenantId: string; role: string; status: string }[] } })._db;
  const note = (tenantId: string, memberId: string, type: string, title: string, body: string) =>
    fdb.notifications.unshift({ id: uid('n'), tenantId, memberId, type, title, body, data: {}, readAt: null, createdAt: new Date().toISOString() });
  const notifyStaff = (tenantId: string, staffId: string, type: string, title: string, body: string, except?: string) => {
    const m = db.staff.find((x) => x.id === staffId)?.memberId;
    if (m && m !== except) note(tenantId, m, type, title, body);
  };
  const notifyLeads = (tenantId: string, type: string, title: string, body: string) => {
    for (const m of fdb.members) if (m.tenantId === tenantId && m.status === 'active' && (m.role === 'chef' || m.role === 'planer')) note(tenantId, m.id, type, title, body);
  };
  const dm = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}.`;
  const vacUnapply = (v: VacationReq, who: string) => {
    for (const e of db.entries.filter((x) => x.staffId === v.staffId && x.date >= v.from && x.date <= v.to && x.code === 'U')) put({ ...e, code: '', flex: e.flex }, who, 'urlaub');
  };
  const vacApply = (v: VacationReq, who: string) => {
    const st = db.staff.find((x) => x.id === v.staffId);
    if (!st) return;
    const byId = byIdOf(db.staff);
    for (let d = v.from; d <= v.to; d = addDaysIso(d, 1)) {
      if (isWork(cellFor(st, d, indexEntries(db.entries), db.settings, 'fein', byId).code, db.settings)) put({ staffId: st.id, date: d, code: 'U', flex: false }, who, 'urlaub');
    }
  };
  const find = (id: string) => {
    const o = db.swaps.find((x) => x.id === id);
    if (!o) throw new ApiError('not_found');
    return o;
  };
  const codeOf = (staffId: string, date: string) => {
    const st = db.staff.find((x) => x.id === staffId);
    if (!st) throw new ApiError('not_found');
    return cellFor(st, date, indexEntries(db.entries), db.settings, 'fein', byIdOf(db.staff)).code;
  };
  const execute = (o: SwapOffer, t = '') => {
    const legs = legsOf(o, db.staff, db.entries, db.settings);
    asApi(() => planRing(legs, db.staff, db.entries, db.settings)).forEach((e) => put(e, swapActor, 'tausch'));
    o.status = 'done';
    for (const l of legs) notifyStaff(t, l.staffId, 'dp_swap_done', 'Tausch gilt', 'Der Plan ist aktualisiert.');
  };
  const base = (actor: Actor, partial: Pick<SwapOffer, 'kind' | 'staffId' | 'date' | 'code' | 'note' | 'legs'>): SwapOffer => ({
    ...partial, id: uid('sw'), status: 'open', requests: [], acceptedRequestId: null, accepted: [],
    createdAt: new Date().toISOString(), decidedBy: null, createdByLead: actor.isLead, createdByName: actor.name,
  });

  return {
    async load() { await wait(); return clone({ settings: db.settings, staff: db.staff, carpools: db.carpools }); },
    async entries(_t, from, to) { await wait(); return clone(db.entries.filter((e) => e.date >= from && e.date <= to)); },
    async setEntry(t, e, actor) {
      await wait();
      const old = db.entries.find((x) => x.staffId === e.staffId && x.date === e.date)?.code;
      put(e, actor?.name, 'plan');
      if ((old ?? '') !== e.code) notifyStaff(t, e.staffId, 'dp_changed', 'Dienst geändert', `${dm(e.date)}: ${old || 'frei'} → ${e.code || 'laut Turnus'}`, actor?.memberId);
    },
    async setEntries(t, list, actor, source = 'plan') {
      await wait();
      list.forEach((e) => put(e, actor?.name, source));
      if (source === 'autodispo') {
        const by = new Map<string, string[]>();
        for (const e of list) by.set(e.staffId, [...(by.get(e.staffId) ?? []), e.date]);
        for (const [id, ds] of by) {
          ds.sort();
          notifyStaff(t, id, 'dp_published', 'Neuer Dienstplan veröffentlicht', `${ds.length} Dienste zwischen ${dm(ds[0]!)} und ${dm(ds[ds.length - 1]!)}`, actor?.memberId);
        }
      }
    },
    async alertLeads(t, title, body) { await wait(); notifyLeads(t, 'dp_required_gap', title, body); },

    async vacations(_t, year) { await wait(); return clone(db.vacations.filter((v) => v.year === year)); },
    async vacWish(t, { from, to, priority, note, staffId }, actor) {
      await wait();
      const who = staffId ?? actor.staffId;
      if (!who || (who !== actor.staffId && !actor.isLead)) throw new ApiError('forbidden');
      if (to < from) throw new ApiError('invalid_entry', 'Bis liegt vor Von.');
      db.vacations.push({ id: uid('v'), staffId: who, year: Number(from.slice(0, 4)), from, to, priority, note, status: 'wunsch', reason: '',
        changeKind: '', changeFrom: null, changeTo: null, fk4Name: null, fk4At: null, fk3Name: null, fk3At: null, createdAt: new Date().toISOString() });
      notifyLeads(t, 'vac_wish', 'Neuer Urlaubswunsch', `${db.staff.find((x) => x.id === who)?.short ?? ''}: ${dm(from)}–${dm(to)}`);
    },
    async vacDelete(_t, id, actor) {
      await wait();
      const v = db.vacations.find((x) => x.id === id);
      if (!v) throw new ApiError('not_found');
      if (actor.isLead || actor.isFk3) {
        if (v.status === 'genehmigt') vacUnapply(v, actor.name);
      } else if (!((v.status === 'wunsch' || v.status === 'abgelehnt') && v.staffId === actor.staffId)) throw new ApiError('forbidden');
      db.vacations = db.vacations.filter((x) => x.id !== id);
    },
    async vacUpdate(t, id, { from, to, priority, note }, actor) {
      await wait();
      const v = db.vacations.find((x) => x.id === id);
      if (!v) throw new ApiError('not_found');
      if (to < from) throw new ApiError('invalid_entry', 'Bis liegt vor Von.');
      if (!actor.isLead && !(v.status === 'wunsch' && v.staffId === actor.staffId)) throw new ApiError('forbidden');
      if (v.status === 'genehmigt') vacUnapply(v, actor.name);
      Object.assign(v, { from, to, priority, note, year: Number(from.slice(0, 4)), changeKind: '', changeFrom: null, changeTo: null });
      if (v.status === 'genehmigt') vacApply(v, actor.name);
      if (v.staffId !== actor.staffId) notifyStaff(t, v.staffId, 'vac_changed', 'Urlaub geändert', `${dm(from)}–${dm(to)}`);
    },
    async vacChangeRequest(t, id, { kind, from, to }, actor) {
      await wait();
      const v = db.vacations.find((x) => x.id === id);
      if (!v) throw new ApiError('not_found');
      if (v.staffId !== actor.staffId) throw new ApiError('forbidden');
      if (v.status !== 'vorgemerkt' && v.status !== 'genehmigt') throw new ApiError('invalid_entry');
      if (kind === 'aenderung' && (!from || !to || to < from)) throw new ApiError('invalid_entry', 'Bitte gültigen neuen Zeitraum angeben.');
      Object.assign(v, { changeKind: kind, changeFrom: from ?? null, changeTo: to ?? null });
      notifyLeads(t, 'vac_change', kind === 'storno' ? 'Urlaub: Stornierung gewünscht' : 'Urlaub: Änderung gewünscht', `${db.staff.find((x) => x.id === v.staffId)?.short ?? ''}: ${dm(v.from)}–${dm(v.to)}`);
    },
    async vacChangeDecide(t, id, ok, actor) {
      await wait();
      if (!actor.isLead) throw new ApiError('forbidden');
      const v = db.vacations.find((x) => x.id === id);
      if (!v || !v.changeKind) throw new ApiError('not_found');
      if (!ok) {
        Object.assign(v, { changeKind: '', changeFrom: null, changeTo: null });
        notifyStaff(t, v.staffId, 'vac_change', 'Änderungswunsch abgelehnt', 'Der Urlaub bleibt wie geplant.');
        return;
      }
      if (v.status === 'genehmigt') vacUnapply(v, actor.name);
      if (v.changeKind === 'storno') {
        db.vacations = db.vacations.filter((x) => x.id !== id);
        notifyStaff(t, v.staffId, 'vac_change', 'Urlaub storniert', `${dm(v.from)}–${dm(v.to)}`);
      } else {
        Object.assign(v, { from: v.changeFrom!, to: v.changeTo!, year: Number(v.changeFrom!.slice(0, 4)), changeKind: '', changeFrom: null, changeTo: null });
        if (v.status === 'genehmigt') vacApply(v, actor.name);
        notifyStaff(t, v.staffId, 'vac_change', 'Urlaub geändert', `${dm(v.from)}–${dm(v.to)}`);
      }
    },

    async flex(_t, year) { await wait(); return clone(db.flex.filter((f) => f.date.startsWith(String(year)))); },
    async flexAdd(t, { date, staffId, byEmployer = false }, actor) {
      await wait();
      const who = staffId ?? actor.staffId;
      if (!who || (who !== actor.staffId && !actor.isLead) || (byEmployer && !actor.isLead)) throw new ApiError('forbidden');
      const year = Number(date.slice(0, 4));
      if (!actor.isLead && !db.settings.vacation.flexOpenYears.includes(year)) throw new ApiError('flex_closed');
      const st = db.staff.find((x) => x.id === who)!;
      if (isWork(cellFor(st, date, indexEntries(db.entries), db.settings, 'fein', byIdOf(db.staff)).code, db.settings)) throw new ApiError('flex_not_free');
      const used = db.flex.filter((f) => f.staffId === who && f.date.startsWith(String(year)) && f.byEmployer === byEmployer).length;
      if (used >= (byEmployer ? db.settings.vacation.flexEmployer : db.settings.vacation.flexOwn)) throw new ApiError('flex_limit');
      if (db.flex.some((f) => f.staffId === who && f.date === date)) throw new ApiError('invalid_entry', 'An diesem Tag ist schon ein Flextag.');
      db.flex.push({ id: uid('fx'), staffId: who, date, byEmployer, createdBy: actor.name, createdAt: new Date().toISOString() });
      const e = db.entries.find((x) => x.staffId === who && x.date === date);
      put({ staffId: who, date, code: e?.code ?? '', flex: true }, actor.name, 'flex');
      if (byEmployer) notifyStaff(t, who, 'flex', 'Flextag vom Arbeitgeber', dm(date));
    },
    async flexDelete(_t, id, actor) {
      await wait();
      const f = db.flex.find((x) => x.id === id);
      if (!f) throw new ApiError('not_found');
      if (!actor.isLead && (f.byEmployer || f.staffId !== actor.staffId)) throw new ApiError('forbidden');
      db.flex = db.flex.filter((x) => x.id !== id);
      const e = db.entries.find((x) => x.staffId === f.staffId && x.date === f.date);
      put({ staffId: f.staffId, date: f.date, code: e?.code ?? '', flex: false }, actor.name, 'flex');
    },
    async notifyAll(t, title, body) {
      await wait();
      for (const m of fdb.members) if (m.tenantId === t && m.status === 'active') note(t, m.id, 'dp_notice', title, body);
    },

    async vacReview(t, id, ok, reason, actor) {
      await wait();
      if (!actor.isLead) throw new ApiError('forbidden');
      const v = db.vacations.find((x) => x.id === id);
      if (!v) throw new ApiError('not_found');
      if (v.status !== 'wunsch' && v.status !== 'vorgemerkt') throw new ApiError('already_decided');
      Object.assign(v, { status: ok ? 'vorgemerkt' : 'abgelehnt', reason, fk4Name: actor.name, fk4At: new Date().toISOString() });
      notifyStaff(t, v.staffId, 'vac_review', ok ? 'Urlaubswunsch vorgemerkt' : 'Urlaubswunsch abgelehnt', `${dm(v.from)}–${dm(v.to)}`);
      if (ok) for (const m of db.settings.vacation.approvers) note(t, m, 'vac_release', 'Urlaubsplanung zur Freigabe', 'Ein vorgemerkter Urlaub wartet auf dein OK.');
    },
    async vacRelease(t, id, ok, reason, actor) {
      await wait();
      if (!canRelease(actor, db.settings)) throw new ApiError('forbidden');
      const v = db.vacations.find((x) => x.id === id);
      if (!v) throw new ApiError('not_found');
      if (v.status !== 'vorgemerkt') throw new ApiError('already_decided');
      Object.assign(v, { status: ok ? 'genehmigt' : 'abgelehnt', reason, fk3Name: actor.name, fk3At: new Date().toISOString() });
      if (ok) vacApply(v, actor.name);
      notifyStaff(t, v.staffId, 'vac_release', ok ? 'Urlaub genehmigt' : 'Urlaub abgelehnt', `${dm(v.from)}–${dm(v.to)}`);
    },

    async docs() { await wait(); return clone(db.docs); },
    async addDoc(_t, { title, category, note, validFrom, file }, actor) {
      await wait();
      if (!actor.isLead && !actor.isFk3) throw new ApiError('forbidden');
      db.docs.unshift({ id: uid('d'), title, category, note, validFrom, fileName: file?.name ?? null, mime: file?.mime ?? null, size: file?.size ?? null,
        path: file ? `data:${file.mime};base64,${file.base64}` : null, uploadedName: actor.name, uploadedAt: new Date().toISOString() });
    },
    async deleteDoc(_t, id, actor) {
      await wait();
      if (!actor.isLead && !actor.isFk3) throw new ApiError('forbidden');
      db.docs = db.docs.filter((x) => x.id !== id);
    },
    async docUrl(_t, doc) { return doc.path ?? ''; },
    async saveSettings(_t, s) { await wait(); db.settings = clone(s); },
    async saveStaff(_t, s, actor) {
      await wait();
      const i = db.staff.findIndex((x) => x.id === s.id);
      const old = i >= 0 ? db.staff[i]! : null;
      const text = !old ? 'Person angelegt'
        : !!old.archived !== !!s.archived ? (s.archived ? 'Aus dem Team entfernt' : 'Wieder ins Team aufgenommen')
        : JSON.stringify(old.rhythm) !== JSON.stringify(s.rhythm) ? 'Grundturnus geändert'
        : JSON.stringify(old.overrides ?? []) !== JSON.stringify(s.overrides ?? []) ? 'Vorübergehender Turnus geändert' : '';
      if (i >= 0) db.staff[i] = clone(s); else db.staff.push(clone(s));
      if (text) log({ actorName: actor?.name, staffId: s.id, source: 'person', text });
    },
    async deleteStaff(_t, id, actor) {
      await wait();
      const st = db.staff.find((x) => x.id === id);
      db.staff = db.staff.filter((x) => x.id !== id);
      db.entries = db.entries.filter((e) => e.staffId !== id);
      log({ actorName: actor?.name, source: 'person', text: `Person gelöscht: ${st?.short ?? id}` });
    },
    async saveCarpools(_t, list) { await wait(); db.carpools = clone(list); },
    async audit(_t, limit) { await wait(); return clone(db.audit.slice(0, limit)); },

    async swaps() { await wait(); return clone(db.swaps); },
    async offerSwap(_t, { staffId, date, note }, actor) {
      await wait();
      if (staffId !== actor.staffId && !actor.isLead) throw new ApiError('forbidden');
      const code = codeOf(staffId, date);
      if (!isWork(code, db.settings)) throw new ApiError('invalid_entry', 'An diesem Tag ist kein Dienst eingeplant.');
      if (db.swaps.some((o) => o.kind === 'offer' && o.staffId === staffId && o.date === date && (o.status === 'open' || o.status === 'pending'))) {
        throw new ApiError('invalid_entry', 'Dieser Dienst wird schon angeboten.');
      }
      db.swaps.unshift(base(actor, { kind: 'offer', staffId, date, code, note, legs: [{ staffId, date, code }] }));
    },
    async proposeSwap(_t, { legs, note }, actor) {
      await wait();
      if (!actor.isLead && !legs.some((l) => l.staffId === actor.staffId)) throw new ApiError('forbidden');
      const full = legs.map((l) => ({ ...l, code: l.date ? codeOf(l.staffId, l.date) : '' }));
      asApi(() => planRing(full, db.staff, db.entries, db.settings)); // prüft vorab
      const first = full[0]!;
      const o = base(actor, { kind: 'direct', staffId: first.staffId, date: first.date ?? '', code: first.code, note, legs: full });
      if (actor.staffId && full.some((l) => l.staffId === actor.staffId)) o.accepted.push(actor.staffId);
      db.swaps.unshift(o);
      for (const l of full) notifyStaff(_t, l.staffId, 'dp_swap_proposed', 'Tauschvorschlag', 'Bitte in der Tauschbörse zustimmen oder ablehnen.', actor.memberId);
    },
    async respondProposal(_t, id, staffId, agree) {
      await wait();
      const o = find(id);
      if (o.kind !== 'direct' || o.status !== 'open') throw new ApiError('swap_not_open');
      if (!o.legs.some((l) => l.staffId === staffId)) throw new ApiError('not_an_applicant');
      if (!agree) {
        o.status = 'rejected';
        for (const l of o.legs) notifyStaff(_t, l.staffId, 'dp_swap_rejected', 'Tausch abgelehnt', 'Der Plan bleibt, wie er war.');
        return;
      }
      swapActor = db.staff.find((x) => x.id === staffId)?.short ?? 'System';
      if (!o.accepted.includes(staffId)) o.accepted.push(staffId);
      if (o.legs.every((l) => o.accepted.includes(l.staffId))) {
        if (needsApproval(o, db.settings)) {
          asApi(() => planRing(o.legs, db.staff, db.entries, db.settings));
          o.status = 'pending';
          notifyLeads(_t, 'dp_swap_pending', 'Tausch wartet auf Genehmigung', 'Bitte in der Tauschbörse prüfen.');
        } else execute(o, _t);
      }
    },
    async requestSwap(_t, id, { staffId, returnDate }) {
      await wait();
      const o = find(id);
      if (o.status !== 'open' || o.kind !== 'offer') throw new ApiError('swap_not_open');
      if (o.staffId === staffId) throw new ApiError('forbidden');
      // Gegendienst am selben Tag ist erlaubt (Schichten tauschen), sonst darf die Person an dem Tag keinen Dienst haben
      asApi(() => planRing([{ staffId: o.staffId, date: o.date, code: o.code }, { staffId, date: returnDate, code: '' }], db.staff, db.entries, db.settings));
      o.requests = o.requests.filter((r) => r.staffId !== staffId);
      o.requests.push({ id: uid('rq'), staffId, returnDate, at: new Date().toISOString() });
      notifyStaff(_t, o.staffId, 'dp_swap_request', 'Neue Anfrage auf dein Angebot', 'Bitte in der Tauschbörse ansehen.');
    },
    async withdrawRequest(_t, id, staffId) {
      await wait();
      const o = find(id);
      o.requests = o.requests.filter((r) => r.staffId !== staffId);
    },
    async acceptRequest(_t, id, requestId, actor) {
      await wait();
      const o = find(id);
      if (o.status !== 'open') throw new ApiError('swap_not_open');
      if (o.staffId !== actor.staffId && !actor.isLead) throw new ApiError('forbidden');
      if (!o.requests.some((r) => r.id === requestId)) throw new ApiError('not_an_applicant');
      o.acceptedRequestId = requestId;
      swapActor = actor.name;
      asApi(() => planRing(legsOf(o, db.staff, db.entries, db.settings), db.staff, db.entries, db.settings));
      if (needsApproval(o, db.settings) && !actor.isLead) {
        o.status = 'pending';
        notifyLeads(_t, 'dp_swap_pending', 'Tausch wartet auf Genehmigung', 'Bitte in der Tauschbörse prüfen.');
      } else execute(o, _t);
    },
    async decideSwap(_t, id, approve, actor) {
      await wait();
      if (!actor.isLead) throw new ApiError('forbidden');
      const o = find(id);
      if (o.status !== 'pending') throw new ApiError('already_decided');
      o.decidedBy = actor.name;
      swapActor = actor.name;
      if (approve) execute(o, _t);
      else {
        o.status = 'rejected';
        for (const l of legsOf(o, db.staff, db.entries, db.settings)) notifyStaff(_t, l.staffId, 'dp_swap_rejected', 'Tausch abgelehnt', 'Der Plan bleibt, wie er war.');
      }
    },
    async cancelSwap(_t, id, actor) {
      await wait();
      const o = find(id);
      if (o.status === 'done' || o.status === 'rejected' || o.status === 'cancelled') throw new ApiError('already_decided');
      const mine = o.staffId === actor.staffId || o.legs.some((l) => l.staffId === actor.staffId && o.kind === 'direct');
      if (!mine && !actor.isLead) throw new ApiError('forbidden');
      o.status = 'cancelled';
    },

    async comments(_t, from, to) { await wait(); return clone(db.comments.filter((c) => c.date >= from && c.date <= to)); },
    async addComment(_t, { staffId, date, text, mark }, actor) {
      await wait();
      if (!text.trim() && !mark) throw new ApiError('invalid_entry', 'Bitte Text oder Markierung angeben.');
      db.comments.push({ id: uid('c'), staffId, date, text: text.trim(), mark, authorMemberId: actor.memberId, authorName: actor.name,
        authorIsLead: actor.isLead, createdAt: new Date().toISOString(), updatedAt: null });
    },
    async updateComment(_t, id, { text, mark }, actor) {
      await wait();
      const c = db.comments.find((x) => x.id === id);
      if (!c) throw new ApiError('not_found');
      if (!canEditComment(c, actor)) throw new ApiError('forbidden');
      Object.assign(c, { text: text.trim(), mark, updatedAt: new Date().toISOString() });
    },
    async deleteComment(_t, id, actor) {
      await wait();
      const c = db.comments.find((x) => x.id === id);
      if (!c) throw new ApiError('not_found');
      if (!canEditComment(c, actor)) throw new ApiError('forbidden');
      db.comments = db.comments.filter((x) => x.id !== id);
    },
  };
}

let instance: DpApi | null = null;
/** Demo: die Demo-Abteilung hat die Beispieldaten, jede weitere Abteilung startet leer. */
export function dpFake(): DpApi {
  if (instance) return instance;
  const stores = new Map<string, DpApi>();
  const of = (t: string) => {
    let st = stores.get(t);
    if (!st) {
      st = stores.size === 0 || t === 't-morgenrot' ? fakeStore() : fakeStore({ settings: {}, staff: [], entries: [], carpools: [] } as unknown as DpSeed);
      stores.set(t, st);
    }
    return st;
  };
  instance = new Proxy({} as DpApi, {
    get: (_o, key: string) => (t: string, ...rest: unknown[]) => (of(t) as unknown as Record<string, (...a: unknown[]) => unknown>)[key]!(t, ...rest),
  });
  return instance;
}
