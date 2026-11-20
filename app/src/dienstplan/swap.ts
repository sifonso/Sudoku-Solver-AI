// Tauschregel, gleich wie dp_execute_swap() in der Datenbank.
// Ein Tausch ist ein Ring: Der Dienst von Glied i geht an die Person von Glied i+1, der letzte an die erste.
// 1:1 = zwei Glieder, Dreieckstausch = drei, Übernahme ohne Gegendienst = zweites Glied ohne Datum.
import { byIdOf, cellFor, indexEntries, isWork, type DpSettings, type Entry, type Staff, type SwapLeg, type SwapOffer } from './model.ts';

export type SwapErrorCode = 'not_found' | 'swap_not_open' | 'no_double_booking' | 'invalid_entry';
export class SwapError extends Error {
  code: SwapErrorCode;
  constructor(code: SwapErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

const fmt = (d: string) => `${Number(d.slice(8))}.${Number(d.slice(5, 7))}.`;

/** Prüft einen Ring und liefert die neuen Einträge. Wirft SwapError, wenn er nicht aufgeht. */
export function planRing(legs: SwapLeg[], staff: Staff[], entries: Entry[], s: DpSettings): Entry[] {
  if (legs.length < 2) throw new SwapError('invalid_entry', 'Ein Tausch braucht mindestens zwei Personen.');
  if (new Set(legs.map((l) => l.staffId)).size !== legs.length) throw new SwapError('invalid_entry', 'Jede Person darf nur einmal im Tausch vorkommen.');
  if (!legs.some((l) => l.date)) throw new SwapError('invalid_entry', 'Mindestens ein Dienst muss abgegeben werden.');
  const map = indexEntries(entries);
  const byId = byIdOf(staff);
  const person = (id: string) => {
    const p = byId.get(id);
    if (!p) throw new SwapError('not_found');
    return p;
  };
  const gives = new Set(legs.filter((l) => l.date).map((l) => `${l.staffId}|${l.date}`));
  const received = new Map<string, Entry>();
  legs.forEach((leg, i) => {
    if (!leg.date) return;
    const giver = person(leg.staffId);
    const code = cellFor(giver, leg.date, map, s, 'fein', byId).code;
    if (!isWork(code, s)) throw new SwapError('swap_not_open', `${giver.short} hat am ${fmt(leg.date)} keinen Dienst mehr.`);
    const next = legs[(i + 1) % legs.length]!;
    const receiver = person(next.staffId);
    const own = cellFor(receiver, leg.date, map, s, 'fein', byId).code;
    if (isWork(own, s) && !gives.has(`${receiver.id}|${leg.date}`)) {
      throw new SwapError('no_double_booking', `${receiver.short} hat am ${fmt(leg.date)} schon Dienst und gibt ihn in diesem Tausch nicht ab.`);
    }
    const key = `${receiver.id}|${leg.date}`;
    if (received.has(key)) throw new SwapError('no_double_booking', `${receiver.short} bekäme am ${fmt(leg.date)} zwei Dienste.`);
    received.set(key, { staffId: receiver.id, date: leg.date, code, flex: false });
  });
  const out = [...received.values()];
  for (const g of gives) {
    if (!received.has(g)) {
      const [staffId, date] = g.split('|') as [string, string];
      out.push({ staffId, date, code: 'DT', flex: false });
    }
  }
  return out;
}

/** Glieder eines angenommenen Angebots: Anbieter gibt ab, Anfragende übernimmt (optional mit Gegendienst, auch am selben Tag). */
export function legsOf(offer: SwapOffer, staff: Staff[], entries: Entry[], s: DpSettings): SwapLeg[] {
  if (offer.kind === 'direct') return offer.legs;
  const req = offer.requests.find((r) => r.id === offer.acceptedRequestId);
  if (!req) throw new SwapError('not_found');
  const map = indexEntries(entries);
  const byId = byIdOf(staff);
  const b = byId.get(req.staffId);
  return [
    { staffId: offer.staffId, date: offer.date, code: offer.code },
    { staffId: req.staffId, date: req.returnDate, code: req.returnDate && b ? cellFor(b, req.returnDate, map, s, 'fein', byId).code : '' },
  ];
}

/** Alte Signatur für Angebot + Anfrage. */
export function planSwap(offer: Pick<SwapOffer, 'staffId' | 'date' | 'code'>, req: { staffId: string; returnDate: string | null }, staff: Staff[], entries: Entry[], s: DpSettings): Entry[] {
  return planRing([{ staffId: offer.staffId, date: offer.date, code: offer.code }, { staffId: req.staffId, date: req.returnDate, code: '' }], staff, entries, s);
}
