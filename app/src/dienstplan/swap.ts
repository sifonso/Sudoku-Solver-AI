// Tauschregel, gleich wie dp_execute_swap() in der Datenbank.
import { cellFor, indexEntries, isWork, type DpSettings, type Entry, type Staff, type SwapOffer } from './model.ts';

export type SwapErrorCode = 'not_found' | 'swap_not_open' | 'no_double_booking';
export class SwapError extends Error {
  code: SwapErrorCode;
  constructor(code: SwapErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

/** Prüft und vollzieht einen Tausch auf den Einträgen. Gemeinsam für Demo und Tests. */
export function planSwap(offer: SwapOffer, req: { staffId: string; returnDate: string | null }, staff: Staff[], entries: Entry[], s: DpSettings): Entry[] {
  const map = indexEntries(entries);
  const a = staff.find((x) => x.id === offer.staffId);
  const b = staff.find((x) => x.id === req.staffId);
  if (!a || !b) throw new SwapError('not_found');
  const aCell = cellFor(a, offer.date, map, s);
  if (!isWork(aCell.code, s)) throw new SwapError('swap_not_open', 'Der angebotene Dienst ist nicht mehr eingeplant.');
  if (isWork(cellFor(b, offer.date, map, s).code, s)) throw new SwapError('no_double_booking', 'Die anfragende Person ist an dem Tag schon eingeteilt.');
  const changes: Entry[] = [
    { staffId: b.id, date: offer.date, code: aCell.code, flex: false },
    { staffId: a.id, date: offer.date, code: 'DT', flex: false },
  ];
  if (req.returnDate) {
    const bCell = cellFor(b, req.returnDate, map, s);
    if (!isWork(bCell.code, s)) throw new SwapError('swap_not_open', 'Der Gegendienst ist nicht mehr eingeplant.');
    if (isWork(cellFor(a, req.returnDate, map, s).code, s)) throw new SwapError('no_double_booking', 'Am Tag des Gegendienstes bist du schon eingeteilt.');
    changes.push({ staffId: a.id, date: req.returnDate, code: bCell.code, flex: false }, { staffId: b.id, date: req.returnDate, code: 'DT', flex: false });
  }
  return changes;
}

