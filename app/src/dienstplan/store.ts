// Speicherung des Dienstplans. Demo: im Speicher, Startdaten aus `globalThis.__DP_SEED__`
// (vom Veröffentlichungsskript eingesetzt, nie im Repository) oder aus sample.ts.
import { ApiError } from '../data/api';
import {
  DEFAULT_SETTINGS, byIdOf, cellFor, indexEntries, isWork,
  type Carpool, type DpComment, type DpSeed, type DpSettings, type Entry, type Staff, type SwapLeg, type SwapOffer,
} from './model.ts';
import { sampleSeed } from './sample';
import { SwapError, legsOf, planRing } from './swap.ts';

export interface DpState { settings: DpSettings; staff: Staff[]; carpools: Carpool[] }

/** Wer gerade handelt. staffId = eigene Person im Plan (falls verknüpft). */
export interface Actor { memberId: string; name: string; isLead: boolean; staffId: string | null }

export interface DpApi {
  load(tenantId: string): Promise<DpState>;
  entries(tenantId: string, from: string, to: string): Promise<Entry[]>;
  /** code '' und flex false löscht den Eintrag (Rhythmus gilt wieder). */
  setEntry(tenantId: string, e: Entry): Promise<void>;
  /** Mehrere Einträge auf einmal (Autodisposition). Nur FK4/SL. */
  setEntries(tenantId: string, list: Entry[]): Promise<void>;
  saveSettings(tenantId: string, s: DpSettings): Promise<void>;
  saveStaff(tenantId: string, s: Staff): Promise<void>;

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
    dispo: { ...DEFAULT_SETTINGS.dispo, ...(partial?.dispo ?? {}), qualFor: { ...DEFAULT_SETTINGS.dispo.qualFor, ...(partial?.dispo?.qualFor ?? {}) } },
  };
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

function fakeStore(): DpApi {
  const raw = (globalThis as { __DP_SEED__?: DpSeed }).__DP_SEED__ ?? sampleSeed();
  const db = {
    settings: mergeSettings(raw.settings),
    staff: clone(raw.staff),
    entries: clone(raw.entries),
    carpools: clone(raw.carpools),
    swaps: [] as SwapOffer[],
    comments: [] as DpComment[],
  };
  // Demo-Konten: die Mitarbeiterin sieht den Plan der ersten Person im Plan, die FK4/SL die erste Teamleitung.
  const firstPlan = db.staff.find((x) => x.inPlan);
  if (firstPlan && !db.staff.some((x) => x.memberId === 'm-mira')) firstPlan.memberId = 'm-mira';
  const lead = db.staff.find((x) => x.isLead);
  if (lead && !db.staff.some((x) => x.memberId === 'm-jana')) lead.memberId = 'm-jana';

  const put = (e: Entry) => {
    db.entries = db.entries.filter((x) => !(x.staffId === e.staffId && x.date === e.date));
    if (e.code || e.flex) db.entries.push({ ...e });
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
  const execute = (o: SwapOffer) => {
    asApi(() => planRing(legsOf(o, db.staff, db.entries, db.settings), db.staff, db.entries, db.settings)).forEach(put);
    o.status = 'done';
  };
  const base = (actor: Actor, partial: Pick<SwapOffer, 'kind' | 'staffId' | 'date' | 'code' | 'note' | 'legs'>): SwapOffer => ({
    ...partial, id: uid('sw'), status: 'open', requests: [], acceptedRequestId: null, accepted: [],
    createdAt: new Date().toISOString(), decidedBy: null, createdByLead: actor.isLead, createdByName: actor.name,
  });

  return {
    async load() { await wait(); return clone({ settings: db.settings, staff: db.staff, carpools: db.carpools }); },
    async entries(_t, from, to) { await wait(); return clone(db.entries.filter((e) => e.date >= from && e.date <= to)); },
    async setEntry(_t, e) { await wait(); put(e); },
    async setEntries(_t, list) { await wait(); list.forEach(put); },
    async saveSettings(_t, s) { await wait(); db.settings = clone(s); },
    async saveStaff(_t, s) {
      await wait();
      const i = db.staff.findIndex((x) => x.id === s.id);
      if (i >= 0) db.staff[i] = clone(s); else db.staff.push(clone(s));
    },

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
    },
    async respondProposal(_t, id, staffId, agree) {
      await wait();
      const o = find(id);
      if (o.kind !== 'direct' || o.status !== 'open') throw new ApiError('swap_not_open');
      if (!o.legs.some((l) => l.staffId === staffId)) throw new ApiError('not_an_applicant');
      if (!agree) { o.status = 'rejected'; return; }
      if (!o.accepted.includes(staffId)) o.accepted.push(staffId);
      if (o.legs.every((l) => o.accepted.includes(l.staffId))) {
        if (needsApproval(o, db.settings)) {
          asApi(() => planRing(o.legs, db.staff, db.entries, db.settings));
          o.status = 'pending';
        } else execute(o);
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
      asApi(() => planRing(legsOf(o, db.staff, db.entries, db.settings), db.staff, db.entries, db.settings));
      if (needsApproval(o, db.settings) && !actor.isLead) o.status = 'pending';
      else execute(o);
    },
    async decideSwap(_t, id, approve, actor) {
      await wait();
      if (!actor.isLead) throw new ApiError('forbidden');
      const o = find(id);
      if (o.status !== 'pending') throw new ApiError('already_decided');
      o.decidedBy = actor.name;
      if (approve) execute(o);
      else o.status = 'rejected';
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
export function dpFake(): DpApi {
  instance ??= fakeStore();
  return instance;
}
