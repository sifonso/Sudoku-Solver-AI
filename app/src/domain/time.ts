// Zeitrechnung in der Zeitzone des Mandanten, ohne Bibliothek (nur Intl).
// Spiegelt shift_bounds() aus replica/schema.sql.

const partsCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsCache.set(tz, f);
  }
  return f;
}

type Local = { y: number; m: number; d: number; h: number; min: number; s: number };

function localParts(ts: number, tz: string): Local {
  const out: Record<string, number> = {};
  for (const p of fmt(tz).formatToParts(new Date(ts))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return { y: out.year!, m: out.month!, d: out.day!, h: out.hour! % 24, min: out.minute!, s: out.second! };
}

/** Versatz der Zone zum Zeitpunkt ts in Millisekunden (Berlin Winter: +3 600 000). */
function offsetAt(ts: number, tz: string): number {
  const l = localParts(ts, tz);
  return Date.UTC(l.y, l.m - 1, l.d, l.h, l.min, l.s) - Math.floor(ts / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Lokales Datum + Uhrzeit in einer Zone -> UTC-ISO. Bei doppelter Stunde (Herbst) gilt die frühere. */
export function zonedToUtc(date: string, time: string, tz: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [h, min] = time.split(':').map(Number) as [number, number];
  const naive = Date.UTC(y, m - 1, d, h, min);
  let ts = naive - offsetAt(naive, tz);
  const second = naive - offsetAt(ts, tz);
  if (second !== ts) ts = Math.min(ts, second);
  return new Date(ts).toISOString();
}

/** UTC-ISO -> lokales Datum 'YYYY-MM-DD' in der Zone. */
export function localDate(iso: string, tz: string): string {
  const l = localParts(Date.parse(iso), tz);
  return `${l.y}-${pad(l.m)}-${pad(l.d)}`;
}

/** UTC-ISO -> 'HH:MM' in der Zone. */
export function localTime(iso: string, tz: string): string {
  const l = localParts(Date.parse(iso), tz);
  return `${pad(l.h)}:${pad(l.min)}`;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** ISO-Wochentag 1 = Montag … 7 = Sonntag. */
export function isoWeekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function startOfWeek(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

/** Schichtgrenzen: Ende <= Beginn heißt Folgetag (Nachtschicht). */
export function shiftBounds(date: string, start: string, end: string, tz: string) {
  const endDate = end <= start ? addDays(date, 1) : date;
  return { startAt: zonedToUtc(date, start, tz), endAt: zonedToUtc(endDate, end, tz) };
}

export function hoursBetween(startIso: string, endIso: string): number {
  return (Date.parse(endIso) - Date.parse(startIso)) / 3_600_000;
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return Date.parse(aStart) < Date.parse(bEnd) && Date.parse(bStart) < Date.parse(aEnd);
}

const WD = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WD_LONG = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const weekdayShort = (date: string) => WD[isoWeekday(date)]!;
export const weekdayLong = (date: string) => WD_LONG[isoWeekday(date)]!;

/** '2026-11-16' -> '16.11.2026' */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}.${m}.${y}`;
}

/** Heutiges Datum in der Zone. */
export function today(tz: string, now: number = Date.now()): string {
  return localDate(new Date(now).toISOString(), tz);
}

/** Arbeitstage im Zeitraum (beide Enden eingeschlossen) nach den Arbeitstagen des Betriebs. Feiertage fehlen noch. */
export function workdaysBetween(start: string, end: string, workdays: number[]): number {
  let n = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) if (workdays.includes(isoWeekday(d))) n++;
  return n;
}

/** '16.11.2026' oder '16.11.26' -> '2026-11-16'; ungültig -> null. */
export function parseGermanDate(input: string): string | null {
  const m = input.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]);
  const y = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Zeitraum als Text: '20.–21.11.2026' oder '30.11.–02.12.2026'. */
export function formatRange(start: string, end: string): string {
  if (start === end) return formatDate(start);
  const [ys, ms] = start.split('-');
  const [ye, me] = end.split('-');
  if (ys === ye && ms === me) return `${start.slice(8)}.–${formatDate(end)}`;
  if (ys === ye) return `${formatDate(start).slice(0, 6)}–${formatDate(end)}`;
  return `${formatDate(start)}–${formatDate(end)}`;
}
