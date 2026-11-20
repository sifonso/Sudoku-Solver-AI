// Dienstplan nach dem Muster der Excel-Disposition: Arbeitsplatz/Schicht je Person und Tag,
// darunter ein 16-Wochen-Grundrhythmus, der sich fortlaufend wiederholt.
// Nur reine Funktionen und Typen; Speicherung in store.ts.

export type ShiftGroup = 'F' | 'M' | 'S' | 'N';

export interface Workplace { code: string; name: string }
export interface ShiftDef {
  code: string;
  group: ShiftGroup;
  /** Zeitangabe je Arbeitsplatz, wie in der Tabelle „Arbeitszeiten“, z. B. „04:30-13:11 (13:41)“. */
  times: Record<string, string>;
}
export interface StatusCode {
  code: string;
  label: string;
  bg: string;
  fg: string;
  /** Zählerzeile unter dem Monatsplan, z. B. „Z & T“. Leer = nicht gezählt. */
  counter: string;
}
export type QualValue = '' | 'X' | '(X)' | 'Y';

export interface DpSettings {
  rhythmStart: string;
  rhythmLength: number;
  swapApproval: boolean;
  workplaces: Workplace[];
  shifts: ShiftDef[];
  /** Grundschichten im Rhythmus (F, M, MF, S, S/N, N, M/S, M/F). */
  baseShifts: string[];
  codes: StatusCode[];
  /** Mindestbesetzung je „Arbeitsplatz/Schichtgruppe“ und „Verfügbar“. Reihenfolge = Zählerzeilen. */
  minStaffing: Record<string, number>;
  qualColumns: string[];
}

export interface Staff {
  id: string;
  /** Kurzname wie im Plan, z. B. „Andrik J.“ */
  short: string;
  firstName: string;
  lastName: string;
  nr: string;
  sort: number;
  inPlan: boolean;
  isLead: boolean;
  teamLeadId: string | null;
  /** Grundrhythmus, Länge = rhythmLength, '' = frei. */
  rhythm: string[];
  quals: Record<string, QualValue | string>;
  phonePrivate: string;
  phoneMobile: string;
  persNr: string;
  whatsapp: string;
  memberId?: string | null;
}

export interface Entry { staffId: string; date: string; code: string; flex: boolean }
export interface Carpool { name: string; members: string[] }

export interface DpSeed {
  settings?: Partial<DpSettings>;
  staff: Staff[];
  entries: Entry[];
  carpools: Carpool[];
}

export type SwapStatus = 'open' | 'pending' | 'done' | 'rejected' | 'cancelled';
export interface SwapRequest { id: string; staffId: string; returnDate: string | null; at: string }
export interface SwapOffer {
  id: string;
  staffId: string;
  date: string;
  code: string;
  note: string;
  status: SwapStatus;
  requests: SwapRequest[];
  acceptedRequestId: string | null;
  createdAt: string;
  decidedBy: string | null;
}

const ALL_WP = ['T1', 'T2', 'PA', 'AK', 'AN'];
const t = (pairs: [string[], string][]) => {
  const out: Record<string, string> = {};
  for (const [wps, time] of pairs) for (const w of wps) out[w] = time;
  return out;
};

/** Werte aus den Blättern „Arbeitszeiten“, „Einstellungen“ und den Farbregeln der Monatsblätter. */
export const DEFAULT_SETTINGS: DpSettings = {
  rhythmStart: '2027-01-04',
  rhythmLength: 112,
  swapApproval: true,
  workplaces: ALL_WP.map((code) => ({ code, name: code })),
  shifts: [
    { code: 'F', group: 'F', times: t([[['T1', 'T2', 'AK', 'AN'], '04:30-13:11 (13:41)']]) },
    { code: 'F1', group: 'F', times: t([[ALL_WP, '05:00-13:41 (14:11)']]) },
    { code: 'F2', group: 'F', times: t([[['PA', 'AK'], '06:00-14:41 (15:11)']]) },
    { code: 'M', group: 'M', times: t([[ALL_WP, '08:00-16:41 (17:11)']]) },
    { code: 'M1', group: 'M', times: t([[ALL_WP, '09:00-17:41 (18:11)']]) },
    { code: 'MF', group: 'M', times: t([[ALL_WP, '09:00-17:41 (18:11)']]) },
    { code: 'M2', group: 'M', times: t([[ALL_WP, '10:00-18:41 (19:11)']]) },
    { code: 'S', group: 'S', times: t([[['T1', 'T2', 'PA', 'AK'], '(12:30) 13:00-21:41']]) },
    { code: 'S1', group: 'S', times: t([[['T1', 'T2', 'PA', 'AK'], '(13:30) 14:00-22:41']]) },
    { code: 'S2', group: 'S', times: t([[['AN'], '(15:00) 15:30-00:11']]) },
    { code: 'N', group: 'N', times: t([[['T1', 'T2'], '21:00-05:41 (06:11)']]) },
  ],
  baseShifts: ['F', 'M', 'MF', 'M/F', 'M/S', 'S', 'S/N', 'N'],
  codes: [
    { code: 'U', label: 'Urlaub', bg: '#1E9E3E', fg: '#FFFFFF', counter: 'U' },
    { code: 'UG', label: 'UG', bg: '#92D050', fg: '#0F172A', counter: 'UG' },
    { code: 'Z', label: 'Z-Tag', bg: '#1E9E3E', fg: '#FFFFFF', counter: 'Z & T' },
    { code: 'ZG', label: 'ZG', bg: '#92D050', fg: '#0F172A', counter: 'Z & T' },
    { code: 'T', label: 'T', bg: '#1E9E3E', fg: '#FFFFFF', counter: 'Z & T' },
    { code: 'K', label: 'Krank', bg: '#E02424', fg: '#FFFFFF', counter: 'K / KID' },
    { code: 'KID', label: 'KID', bg: '#E02424', fg: '#FFFFFF', counter: 'K / KID' },
    { code: 'W', label: 'Weiterbildung', bg: '#FFEB3B', fg: '#0F172A', counter: 'W / WS' },
    { code: 'WS', label: 'WS', bg: '#FFEB3B', fg: '#0F172A', counter: 'W / WS' },
    { code: 'BR', label: 'BR', bg: '#5DADE2', fg: '#0F172A', counter: '' },
    { code: 'A', label: 'A', bg: '#5DADE2', fg: '#0F172A', counter: '' },
    { code: 'DT', label: 'Diensttausch', bg: '#C6EFCE', fg: '#14532D', counter: 'DT' },
    { code: 'D', label: 'D', bg: '#E2E8F0', fg: '#0F172A', counter: 'D' },
    { code: 'CO', label: 'Check Out', bg: '#B39DDB', fg: '#0F172A', counter: '' },
    { code: 'ZD', label: 'Zusatzdienst', bg: '#BFBFBF', fg: '#0F172A', counter: '' },
  ],
  minStaffing: {
    'T1/F': 1, 'T2/F': 1, 'AK/F': 1, 'PA/F': 1, 'AN/F': 1,
    'T1/M': 1, 'T2/M': 1, 'PA/M': 1, 'AN/M': 1, 'AK/M': 1,
    Verfügbar: 0,
    'T1/S': 1, 'T2/S': 1, 'AK/S': 1, 'PA/S': 1, 'AN/S': 1,
    'T1/N': 1, 'T2/N': 1,
  },
  qualColumns: ['T1', 'T2', 'Ankunft', 'MAUS', 'PANDA AN', 'PANDA AB', 'ARGUS', 'FGB Einweisung',
    'Bereichstrainer Ausbildung', 'Bereichstrainer aktiv'],
};

export const COUNTER_ROWS = ['W / WS', 'U', 'UG', 'Z & T', 'K / KID', 'D', 'DT', 'FLEX'];

export const DAY_COLORS = {
  saturdayHead: { bg: '#475569', fg: '#FFFFFF' },
  sunday: '#F0F0F0',
  holiday: '#E0E0E0',
  today: '#00B0F0',
  flexText: '#DC2626',
  under: { bg: '#FECACA', fg: '#991B1B' },
  counted: { bg: '#BBF7D0', fg: '#166534' },
};

// ---------- Datum ----------
export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseIso = (s: string) => {
  const [y = 2000, m = 1, d = 1] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};
export const addDays = (s: string, n: number) => {
  const d = parseIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
/** Tage zwischen zwei Daten, unabhängig von der Zeitumstellung. */
export const dayDiff = (a: string, b: string) => {
  const [y1 = 0, m1 = 1, d1 = 1] = a.split('-').map(Number);
  const [y2 = 0, m2 = 1, d2 = 1] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};
export const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const weekday = (s: string) => parseIso(s).getDay();
export function monthDays(year: number, month: number): string[] {
  const n = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: n }, (_, i) => iso(new Date(year, month, i + 1, 12)));
}

// ---------- Feiertage Bayern (Ostern nach Gauß, wie im Blatt „Feiertage“) ----------
function easter(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(new Date(year, month - 1, day, 12));
}
const holidayCache = new Map<number, Map<string, string>>();
/** Feiertag → Kürzel wie in der Tabelle (z. B. „Hl. 3 K.“). Mariä Himmelfahrt eingeschlossen. */
export function holidays(year: number): Map<string, string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const e = easter(year);
  const map = new Map<string, string>([
    [`${year}-01-01`, 'Neujahr'], [`${year}-01-06`, 'Hl. 3 K.'],
    [addDays(e, -2), 'Karfr.'], [addDays(e, 1), 'Osterm.'], [`${year}-05-01`, '1. Mai'],
    [addDays(e, 39), 'Himmelf.'], [addDays(e, 50), 'Pfingstm.'], [addDays(e, 60), 'Fronl.'],
    [`${year}-08-15`, 'Mariä H.'], [`${year}-10-03`, 'Dt. Einh.'], [`${year}-11-01`, 'Allerh.'],
    [`${year}-12-25`, '1. WT'], [`${year}-12-26`, '2. WT'],
  ]);
  holidayCache.set(year, map);
  return map;
}
export const holidayOf = (date: string) => holidays(Number(date.slice(0, 4))).get(date) ?? null;

// ---------- Rhythmus ----------
/** Position im Zyklus (0-basiert), auch vor dem Rhythmusbeginn. */
export function rhythmIndex(date: string, s: Pick<DpSettings, 'rhythmStart' | 'rhythmLength'>): number {
  const len = s.rhythmLength || 112;
  return ((dayDiff(s.rhythmStart, date) % len) + len) % len;
}
export const rhythmWeek = (index: number) => Math.floor(index / 7) + 1;
export function rhythmShift(staff: Staff, date: string, s: DpSettings): string {
  return staff.rhythm[rhythmIndex(date, s)] ?? '';
}

// ---------- Codes ----------
export interface Parsed { workplace: string | null; shift: string | null; status: StatusCode | null }
export function parseCode(code: string, s: DpSettings): Parsed {
  const c = code.trim();
  if (!c) return { workplace: null, shift: null, status: null };
  const status = s.codes.find((x) => x.code.toUpperCase() === c.toUpperCase()) ?? null;
  if (status) return { workplace: null, shift: null, status };
  const slash = c.indexOf('/');
  const wp = slash > 0 ? c.slice(0, slash) : null;
  if (wp && s.workplaces.some((w) => w.code === wp)) return { workplace: wp, shift: c.slice(slash + 1), status: null };
  return { workplace: null, shift: c, status: null };
}
export function groupOf(shift: string | null, s: DpSettings): ShiftGroup | null {
  if (!shift) return null;
  const def = s.shifts.find((x) => x.code === shift);
  if (def) return def.group;
  const first = shift[0] as ShiftGroup;
  return (['F', 'M', 'S', 'N'] as const).includes(first) ? first : null;
}
export const isWork = (code: string, s: DpSettings) => {
  const p = parseCode(code, s);
  return !p.status && groupOf(p.shift, s) !== null;
};

export interface Cell {
  /** Angezeigter Wert: Eintrag, sonst Rhythmus-Grundschicht */
  code: string;
  fromRhythm: boolean;
  base: string;
  flex: boolean;
  entry: Entry | null;
}
export function cellFor(staff: Staff, date: string, entries: Map<string, Entry>, s: DpSettings, mode: 'fein' | 'rhythmus' = 'fein'): Cell {
  const base = rhythmShift(staff, date, s);
  const entry = entries.get(`${staff.id}|${date}`) ?? null;
  if (mode === 'rhythmus' || !entry || (!entry.code && !entry.flex)) return { code: base, fromRhythm: true, base, flex: entry?.flex ?? false, entry };
  return { code: entry.code, fromRhythm: false, base, flex: entry.flex, entry };
}
export const entryKey = (staffId: string, date: string) => `${staffId}|${date}`;
export const indexEntries = (entries: Entry[]) => new Map(entries.map((e) => [entryKey(e.staffId, e.date), e]));

export function cellColors(code: string, s: DpSettings): { bg: string; fg: string } | null {
  const p = parseCode(code, s);
  return p.status ? { bg: p.status.bg, fg: p.status.fg } : null;
}

export function shiftTime(code: string, s: DpSettings): string | null {
  const p = parseCode(code, s);
  if (!p.shift) return null;
  const def = s.shifts.find((x) => x.code === p.shift);
  if (!def) return null;
  if (p.workplace) return def.times[p.workplace] ?? null;
  return Object.values(def.times)[0] ?? null;
}

// ---------- Zähler unter dem Monatsplan ----------
export interface DayCount { key: string; value: number; min: number | null; under: boolean }
export function dayCounters(date: string, staff: Staff[], entries: Map<string, Entry>, s: DpSettings): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(s.minStaffing)) out[k] = 0;
  for (const k of COUNTER_ROWS) out[k] = 0;
  out['Schichtstärke'] = 0;
  for (const st of staff) {
    if (!st.inPlan) continue;
    const cell = cellFor(st, date, entries, s);
    if (cell.flex) out.FLEX = (out.FLEX ?? 0) + 1;
    const p = parseCode(cell.code, s);
    if (p.status) {
      if (p.status.counter) out[p.status.counter] = (out[p.status.counter] ?? 0) + 1;
      continue;
    }
    const g = groupOf(p.shift, s);
    if (!g) continue;
    if (p.workplace && !cell.fromRhythm) {
      const key = `${p.workplace}/${g}`;
      out[key] = (out[key] ?? 0) + 1;
      out['Schichtstärke'] = (out['Schichtstärke'] ?? 0) + 1;
    } else {
      out['Verfügbar'] = (out['Verfügbar'] ?? 0) + 1;
    }
  }
  return out;
}

// ---------- Jahresübersicht ----------
export interface YearStats { dienste: number; sonntag: number; feiertag: number; nacht: number; urlaub: number; z: number }
export function yearStats(staff: Staff, year: number, entries: Map<string, Entry>, s: DpSettings): YearStats & { perMonth: number[] } {
  const r = { dienste: 0, sonntag: 0, feiertag: 0, nacht: 0, urlaub: 0, z: 0, perMonth: Array(12).fill(0) as number[] };
  for (let m = 0; m < 12; m++) {
    for (const d of monthDays(year, m)) {
      const cell = cellFor(staff, d, entries, s);
      const p = parseCode(cell.code, s);
      if (p.status?.code === 'U') r.urlaub++;
      if (p.status?.code === 'Z') r.z++;
      if (p.status) continue;
      const g = groupOf(p.shift, s);
      if (!g) continue;
      r.dienste++;
      r.perMonth[m] = (r.perMonth[m] ?? 0) + 1;
      if (weekday(d) === 0) r.sonntag++;
      if (holidayOf(d)) r.feiertag++;
      if (g === 'N' || p.shift === 'S/N') r.nacht++;
    }
  }
  return r;
}

export const displayName = (st: Staff) => (st.firstName ? `${st.firstName} ${st.lastName}` : st.lastName || st.short);
