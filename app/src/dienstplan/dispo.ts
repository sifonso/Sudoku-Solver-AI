// Autodisposition nach Regelwerk. Je Tag:
// 1. Pflichtdienste (z. B. T1/F, T1/S, T1/N …) je einmal besetzen, knappste zuerst.
// 2. Danach die Zusatzdienste (z. B. T1/M, T2/M, PA/M, AK/M) in der eingestellten Reihenfolge.
// 3. Alle übrigen bekommen einen Dienst ohne Arbeitsplatz (F, M, S, N).
// Grundlage ist die Grundschicht aus dem (vorübergehenden) Turnus; flexible Grundschichten
// (S/N, M/S, M/F) können in beide Gruppen fallen. Bestehende Einträge bleiben unangetastet.
import {
  EMPTY_RULES, addDays, byIdOf, cellFor, groupOf, indexEntries, parseCode,
  type Carpool, type DpSettings, type Entry, type PersonRules, type ShiftGroup, type Staff,
} from './model.ts';

export interface DispoGap { date: string; key: string; missing: number; required: boolean }
export interface DispoNote { date: string; staffId: string; text: string }
export interface DispoResult { changes: Entry[]; gaps: DispoGap[]; notes: DispoNote[] }

/** Mögliche Schichtgruppen einer Grundschicht. */
export function baseGroups(code: string, s: DpSettings): ShiftGroup[] {
  if (!code) return [];
  const p = parseCode(code, s);
  if (p.status || p.workplace) return [];
  if (code === 'S/N') return ['S', 'N'];
  if (code === 'M/S') return ['M', 'S'];
  if (code === 'M/F') return ['M', 'F'];
  if (code === 'MF') return ['M'];
  const g = groupOf(p.shift, s);
  return g ? [g] : [];
}

/** Erste Schichtgruppe (für Anzeige und Tests). */
export const baseGroup = (code: string, s: DpSettings): ShiftGroup | null => baseGroups(code, s)[0] ?? null;

export function qualified(st: Staff, wp: string, s: DpSettings): boolean {
  const cols = (s.dispo.qualFor[wp] ?? []).filter(Boolean);
  if (!cols.length) return true;
  const ok = (col: string) => {
    const v = st.quals?.[col] ?? '';
    return v === 'X' || (s.dispo.allowPlanned && v === '(X)');
  };
  return s.dispo.qualAll[wp] === false ? cols.some(ok) : cols.every(ok);
}

export const rulesOf = (st: Staff): PersonRules => ({ ...EMPTY_RULES, ...(st.rules ?? {}) });

export function eligible(st: Staff, wp: string, g: ShiftGroup, s: DpSettings): boolean {
  const r = rulesOf(st);
  if (r.noGroups.includes(g) || r.noWorkplaces.includes(wp)) return false;
  return qualified(st, wp, s);
}

/** Beginn und Ende eines Dienstes, z. B. „04:30-13:11“ aus „04:30-13:11 (13:41)“. */
export function startEnd(wp: string | null, g: ShiftGroup, s: DpSettings): string {
  const def = s.shifts.find((x) => x.code === g);
  const t = (wp ? def?.times[wp] : Object.values(def?.times ?? {})[0]) ?? '';
  return t.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/)?.slice(1, 3).join('-') ?? g;
}

export function autoDispo(staff: Staff[], entries: Entry[], s: DpSettings, from: string, to: string, carpools: Carpool[] = []): DispoResult {
  const byId = byIdOf(staff);
  const map = indexEntries(entries);
  const changes: Entry[] = [];
  const gaps: DispoGap[] = [];
  const notes: DispoNote[] = [];
  const d = s.dispo;
  const partners = new Map<string, string[]>();
  if (d.carpools) {
    for (const cp of carpools) for (const m of cp.members) partners.set(m, cp.members.filter((x) => x !== m));
  }
  // Verteilung: Arbeitsplätze der letzten 4 Wochen zählen mit
  const load = new Map<string, number>();
  const bump = (id: string, wp: string) => load.set(`${id}|${wp}`, (load.get(`${id}|${wp}`) ?? 0) + 1);
  for (const e of entries) {
    if (e.date >= addDays(from, -28) && e.date < from) {
      const p = parseCode(e.code, s);
      if (p.workplace) bump(e.staffId, p.workplace);
    }
  }

  for (let date = from; date <= to; date = addDays(date, 1)) {
    const filled = new Map<string, number>();
    const free: { st: Staff; groups: ShiftGroup[] }[] = [];
    const times = new Map<string, string>(); // staffId → Beginn-Ende heute
    for (const st of staff) {
      if (!st.inPlan) continue;
      const cell = cellFor(st, date, map, s, 'fein', byId);
      if (cell.source === 'temp' && cell.temp?.kind === 'follow') continue; // Ausbildung läuft mit
      if (cell.source === 'entry') {
        const p = parseCode(cell.code, s);
        const g = groupOf(p.shift, s);
        if (p.workplace && g) {
          filled.set(`${p.workplace}/${g}`, (filled.get(`${p.workplace}/${g}`) ?? 0) + 1);
          times.set(st.id, startEnd(p.workplace, g, s));
        } else if (!p.status && g) free.push({ st, groups: [g] }); // Schicht ohne Arbeitsplatz von Hand
        continue;
      }
      const r = rulesOf(st);
      const all = baseGroups(cell.base, s);
      const groups = all.filter((g) => !r.noGroups.includes(g));
      if (all.length && !groups.length) {
        notes.push({ date, staffId: st.id, text: `${st.short}: ${all.join('/')} laut Turnus, im Regelwerk gesperrt` });
        continue;
      }
      if (groups.length) free.push({ st, groups });
    }

    const score = (f: { st: Staff; groups: ShiftGroup[] }, wp: string | null, g: ShiftGroup) => {
      const r = rulesOf(f.st);
      let v = 0;
      if (d.usePreferences) {
        if (wp) v += (r.prefer.includes(wp) ? 3 : 0) - (r.avoid.includes(wp) ? 3 : 0);
        v += (r.preferGroups.includes(g) ? 3 : 0) - (r.avoidGroups.includes(g) ? 3 : 0);
      }
      if (d.balance && wp) v -= load.get(`${f.st.id}|${wp}`) ?? 0;
      if (f.groups.length === 1) v += 2; // Flexible Personen für später aufheben
      const te = startEnd(wp, g, s);
      for (const p of partners.get(f.st.id) ?? []) if (times.get(p) === te) v += 6; // Fahrgemeinschaft: gleiche Zeiten
      return v;
    };
    const take = (f: { st: Staff }, wp: string | null, g: ShiftGroup) => {
      changes.push({ staffId: f.st.id, date, code: wp ? `${wp}/${g}` : g, flex: map.get(`${f.st.id}|${date}`)?.flex ?? false });
      if (wp) { filled.set(`${wp}/${g}`, (filled.get(`${wp}/${g}`) ?? 0) + 1); bump(f.st.id, wp); }
      times.set(f.st.id, startEnd(wp, g, s));
      free.splice(free.findIndex((x) => x.st.id === f.st.id), 1);
    };
    const pool = (wp: string, g: ShiftGroup) => free.filter((f) => f.groups.includes(g) && eligible(f.st, wp, g, s));
    const fillOne = (key: string, required: boolean) => {
      const [wp, g] = key.split('/') as [string, ShiftGroup];
      if ((filled.get(key) ?? 0) > 0) return;
      const cands = pool(wp, g);
      if (!cands.length) {
        gaps.push({ date, key, missing: 1, required });
        return;
      }
      cands.sort((a, b) => score(b, wp, g) - score(a, wp, g) || a.st.sort - b.st.sort);
      take(cands[0]!, wp, g);
    };

    // 1. Pflichtdienste, knappste zuerst
    [...d.required].sort((a, b) => {
      const [wa, ga] = a.split('/') as [string, ShiftGroup];
      const [wb, gb] = b.split('/') as [string, ShiftGroup];
      return pool(wa, ga).length - pool(wb, gb).length;
    }).forEach((k) => fillOne(k, true));
    // 2. Zusatzdienste in fester Reihenfolge
    d.secondary.forEach((k) => fillOne(k, false));
    // 3. Übrige: Dienst ohne Arbeitsplatz
    if (d.nakedRest) {
      for (const f of [...free]) {
        const g = [...f.groups].sort((a, b) => score(f, null, b) - score(f, null, a))[0]!;
        take(f, null, g);
      }
    }
  }
  return { changes, gaps, notes };
}

/** Pflichtdienste ohne Besetzung im bestehenden Plan (für den Hinweis im Monatsplan). */
export function requiredGaps(days: string[], staff: Staff[], entries: Map<string, Entry>, s: DpSettings): DispoGap[] {
  const byId = byIdOf(staff);
  const out: DispoGap[] = [];
  for (const date of days) {
    const filled = new Set<string>();
    for (const st of staff) {
      if (!st.inPlan) continue;
      const c = cellFor(st, date, entries, s, 'fein', byId);
      const p = parseCode(c.code, s);
      const g = groupOf(p.shift, s);
      if (c.source === 'entry' && p.workplace && g) filled.add(`${p.workplace}/${g}`);
    }
    for (const k of s.dispo.required) if (!filled.has(k)) out.push({ date, key: k, missing: 1, required: true });
  }
  return out;
}
