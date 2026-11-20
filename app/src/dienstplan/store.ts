// Speicherung des Dienstplans. Demo: im Speicher, Startdaten aus `globalThis.__DP_SEED__`
// (vom Veröffentlichungsskript eingesetzt, nie im Repository) oder aus sample.ts.
import { ApiError } from '../data/api';
import {
  DEFAULT_SETTINGS, cellFor, indexEntries, isWork,
  type Carpool, type DpSeed, type DpSettings, type Entry, type Staff, type SwapOffer,
} from './model.ts';
import { sampleSeed } from './sample';
import { SwapError, planSwap } from './swap.ts';

export interface DpState { settings: DpSettings; staff: Staff[]; carpools: Carpool[] }

export interface DpApi {
  load(tenantId: string): Promise<DpState>;
  entries(tenantId: string, from: string, to: string): Promise<Entry[]>;
  /** code '' und flex false löscht den Eintrag (Rhythmus gilt wieder). */
  setEntry(tenantId: string, e: Entry): Promise<void>;
  saveSettings(tenantId: string, s: DpSettings): Promise<void>;
  saveStaff(tenantId: string, s: Staff): Promise<void>;
  swaps(tenantId: string): Promise<SwapOffer[]>;
  offerSwap(tenantId: string, input: { staffId: string; date: string; note: string }): Promise<void>;
  requestSwap(tenantId: string, offerId: string, input: { staffId: string; returnDate: string | null }): Promise<void>;
  withdrawRequest(tenantId: string, offerId: string, staffId: string): Promise<void>;
  /** Anbieter wählt eine Anfrage. Mit Genehmigungspflicht danach „pending“, sonst sofort getauscht. */
  acceptRequest(tenantId: string, offerId: string, requestId: string): Promise<void>;
  /** FK4/SL genehmigt oder lehnt ab. */
  decideSwap(tenantId: string, offerId: string, approve: boolean, byStaffId: string | null): Promise<void>;
  cancelSwap(tenantId: string, offerId: string): Promise<void>;
}

const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
let n = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(n++).toString(36)}`;

export function mergeSettings(partial?: Partial<DpSettings>): DpSettings {
  return { ...DEFAULT_SETTINGS, ...(partial ?? {}), minStaffing: { ...DEFAULT_SETTINGS.minStaffing, ...(partial?.minStaffing ?? {}) } };
}

/** Wie planSwap, Fehler als ApiError. */
export function applySwap(...args: Parameters<typeof planSwap>): Entry[] {
  try {
    return planSwap(...args);
  } catch (e) {
    if (e instanceof SwapError) throw new ApiError(e.code, e.message);
    throw e;
  }
}

function fakeStore(): DpApi {
  const raw = (globalThis as { __DP_SEED__?: DpSeed }).__DP_SEED__ ?? sampleSeed();
  const db = {
    settings: mergeSettings(raw.settings),
    staff: clone(raw.staff),
    entries: clone(raw.entries),
    carpools: clone(raw.carpools),
    swaps: [] as SwapOffer[],
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
  const offer = (id: string) => {
    const o = db.swaps.find((x) => x.id === id);
    if (!o) throw new ApiError('not_found');
    return o;
  };
  const execute = (o: SwapOffer) => {
    const req = o.requests.find((r) => r.id === o.acceptedRequestId);
    if (!req) throw new ApiError('not_found');
    applySwap(o, req, db.staff, db.entries, db.settings).forEach(put);
    o.status = 'done';
  };
  return {
    async load() { await wait(); return clone({ settings: db.settings, staff: db.staff, carpools: db.carpools }); },
    async entries(_t, from, to) { await wait(); return clone(db.entries.filter((e) => e.date >= from && e.date <= to)); },
    async setEntry(_t, e) { await wait(); put(e); },
    async saveSettings(_t, s) { await wait(); db.settings = clone(s); },
    async saveStaff(_t, s) {
      await wait();
      const i = db.staff.findIndex((x) => x.id === s.id);
      if (i >= 0) db.staff[i] = clone(s); else db.staff.push(clone(s));
    },
    async swaps() { await wait(); return clone(db.swaps); },
    async offerSwap(_t, { staffId, date, note }) {
      await wait();
      const st = db.staff.find((x) => x.id === staffId);
      if (!st) throw new ApiError('not_found');
      const cell = cellFor(st, date, indexEntries(db.entries), db.settings);
      if (!isWork(cell.code, db.settings)) throw new ApiError('invalid_entry', 'An diesem Tag hast du keinen Dienst.');
      if (db.swaps.some((o) => o.staffId === staffId && o.date === date && (o.status === 'open' || o.status === 'pending'))) {
        throw new ApiError('invalid_entry', 'Diesen Dienst bietest du schon an.');
      }
      db.swaps.unshift({ id: uid('sw'), staffId, date, code: cell.code, note, status: 'open', requests: [], acceptedRequestId: null, createdAt: new Date().toISOString(), decidedBy: null });
    },
    async requestSwap(_t, id, { staffId, returnDate }) {
      await wait();
      const o = offer(id);
      if (o.status !== 'open') throw new ApiError('swap_not_open');
      if (o.staffId === staffId) throw new ApiError('forbidden');
      o.requests = o.requests.filter((r) => r.staffId !== staffId);
      o.requests.push({ id: uid('rq'), staffId, returnDate, at: new Date().toISOString() });
    },
    async withdrawRequest(_t, id, staffId) {
      await wait();
      const o = offer(id);
      o.requests = o.requests.filter((r) => r.staffId !== staffId);
    },
    async acceptRequest(_t, id, requestId) {
      await wait();
      const o = offer(id);
      if (o.status !== 'open') throw new ApiError('swap_not_open');
      const req = o.requests.find((r) => r.id === requestId);
      if (!req) throw new ApiError('not_an_applicant');
      applySwap(o, req, db.staff, db.entries, db.settings); // prüft vorab
      o.acceptedRequestId = requestId;
      if (db.settings.swapApproval) o.status = 'pending';
      else execute(o);
    },
    async decideSwap(_t, id, approve, by) {
      await wait();
      const o = offer(id);
      if (o.status !== 'pending') throw new ApiError('already_decided');
      o.decidedBy = by;
      if (approve) execute(o);
      else o.status = 'rejected';
    },
    async cancelSwap(_t, id) {
      await wait();
      const o = offer(id);
      if (o.status === 'done') throw new ApiError('already_decided');
      o.status = 'cancelled';
    },
  };
}

let instance: DpApi | null = null;
export function dpFake(): DpApi {
  instance ??= fakeStore();
  return instance;
}
