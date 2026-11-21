// Autodisposition: verteilt Personen, die laut (vorübergehendem) Turnus Dienst haben, aber noch keinen
// Arbeitsplatz, auf die Arbeitsplätze. Reihenfolge: erst die Mindestbesetzung (knappste Plätze zuerst),
// dann optional der Überhang. Bestehende Einträge (manuell, Abwesenheit, Tausch) bleiben unangetastet.
import {
  EMPTY_RULES, addDays, byIdOf, cellFor, groupOf, indexEntries, parseCode,
  type DpSettings, type Entry, type PersonRules, type ShiftGroup, type Staff,
} from './model.ts';

export interface DispoGap { date: string; key: string; missing: number }
export interface DispoNote { date: string; staffId: string; text: string }
export interface DispoResult { changes: Entry[]; gaps: DispoGap[]; notes: DispoNote[] }

/** Schichtgruppe einer Grundschicht (MF → M, S/N → S, M/S und M/F → M). */
export function baseGroup(code: string, s: DpSettings): ShiftGroup | null {
  if (!code) return null;
  const p = parseCode(code, s);
  if (p.status || p.workplace) return null;
  if (code === 'S/N') return 'S';
  if (code === 'M/S' || code === 'M/F' || code === 'MF') return 'M';
  return groupOf(p.shift, s);
}

export function qualified(st: Staff, wp: string, s: DpSettings): boolean {
  const col = s.dispo.qualFor[wp];
  if (!col) return true;
  const v = st.quals?.[col] ?? '';
  return v === 'X' || (s.dispo.allowPlanned && v === '(X)');
}

const rulesOf = (st: Staff): PersonRules => ({ ...EMPTY_RULES, ...(st.rules ?? {}) });

export function eligible(st: Staff, wp: string, g: ShiftGroup, s: DpSettings): boolean {
  const r = rulesOf(st);
  if (r.noGroups.includes(g) || r.noWorkplaces.includes(wp)) return false;
  if (!(s.presets[wp] ?? []).includes(g)) return false;
  return qualified(st, wp, s);
}

/**
 * Vorschlag für den Zeitraum [from, to]. `entries` sollte den Zeitraum plus 4 Wochen davor enthalten,
 * damit die Verteilung der Arbeitsplätze die jüngste Vergangenheit berücksichtigt.
 */
export function autoDispo(staff: Staff[], entries: Entry[], s: DpSettings, from: string, to: string): DispoResult {
  const byId = byIdOf(staff);
  const map = indexEntries(entries);
  const changes: Entry[] = [];
  const gaps: DispoGap[] = [];
  const notes: DispoNote[] = [];
  // Zähler je Person und Arbeitsplatz für gleichmäßige Verteilung
  const load = new Map<string, number>();
  const bump = (id: string, wp: string) => load.set(`${id}|${wp}`, (load.get(`${id}|${wp}`) ?? 0) + 1);
  for (const e of entries) {
    if (e.date >= addDays(from, -28) && e.date < from) {
      const p = parseCode(e.code, s);
      if (p.workplace) bump(e.staffId, p.workplace);
    }
  }
  const wps = s.workplaces.map((w) => w.code);

  for (let date = from; date <= to; date = addDays(date, 1)) {
    const filled = new Map<string, number>();
    const free: { st: Staff; g: ShiftGroup }[] = [];
    for (const st of staff) {
      if (!st.inPlan) continue;
      const cell = cellFor(st, date, map, s, 'fein', byId);
      if (cell.source === 'temp' && cell.temp?.kind === 'follow') continue; // Ausbildung läuft mit
      if (cell.source === 'entry') {
        const p = parseCode(cell.code, s);
        const g = groupOf(p.shift, s);
        if (p.workplace && g) filled.set(`${p.workplace}/${g}`, (filled.get(`${p.workplace}/${g}`) ?? 0) + 1);
        else if (!p.status && g) free.push({ st, g }); // Schicht ohne Arbeitsplatz von Hand eingetragen
        continue;
      }
      const g = baseGroup(cell.base, s);
      if (!g) continue;
      if (rulesOf(st).noGroups.includes(g)) {
        notes.push({ date, staffId: st.id, text: `${st.short}: ${g}-Dienst laut Turnus, aber im Regelwerk gesperrt` });
        continue;
      }
      free.push({ st, g });
    }

    const score = (st: Staff, wp: string) => {
      const r = rulesOf(st);
      let v = 0;
      if (s.dispo.usePreferences) v += (r.prefer.includes(wp) ? 3 : 0) - (r.avoid.includes(wp) ? 3 : 0);
      if (s.dispo.balance) v -= load.get(`${st.id}|${wp}`) ?? 0;
      return v;
    };
    const take = (st: Staff, wp: string, g: ShiftGroup) => {
      changes.push({ staffId: st.id, date, code: `${wp}/${g}`, flex: map.get(`${st.id}|${date}`)?.flex ?? false });
      filled.set(`${wp}/${g}`, (filled.get(`${wp}/${g}`) ?? 0) + 1);
      bump(st.id, wp);
      free.splice(free.findIndex((f) => f.st.id === st.id), 1);
    };

    // 1. Mindestbesetzung, knappste Plätze zuerst
    const slots: { wp: string; g: ShiftGroup }[] = [];
    for (const [key, min] of Object.entries(s.minStaffing)) {
      const [wp, g] = key.split('/') as [string, ShiftGroup | undefined];
      if (!g || !wps.includes(wp)) continue;
      for (let i = filled.get(key) ?? 0; i < min; i++) slots.push({ wp, g });
    }
    const pool = (wp: string, g: ShiftGroup) => free.filter((f) => f.g === g && eligible(f.st, wp, g, s));
    slots.sort((a, b) => pool(a.wp, a.g).length - pool(b.wp, b.g).length);
    for (const slot of slots) {
      const cands = pool(slot.wp, slot.g);
      if (!cands.length) {
        const key = `${slot.wp}/${slot.g}`;
        const gap = gaps.find((x) => x.date === date && x.key === key);
        if (gap) gap.missing++; else gaps.push({ date, key, missing: 1 });
        continue;
      }
      cands.sort((a, b) => score(b.st, slot.wp) - score(a.st, slot.wp) || a.st.sort - b.st.sort);
      take(cands[0]!.st, slot.wp, slot.g);
    }

    // 2. Überhang: Arbeitsplatz mit der geringsten Besetzung bzw. Vorliebe
    if (s.dispo.distributeSurplus) {
      for (const f of [...free]) {
        const options = wps.filter((wp) => (s.presets[wp] ?? []).includes(f.g) && eligible(f.st, wp, f.g, s));
        if (!options.length) {
          notes.push({ date, staffId: f.st.id, text: `${f.st.short}: kein passender Arbeitsplatz für ${f.g}` });
          continue;
        }
        options.sort((a, b) => (filled.get(`${a}/${f.g}`) ?? 0) - (filled.get(`${b}/${f.g}`) ?? 0) || score(f.st, b) - score(f.st, a));
        take(f.st, options[0]!, f.g);
      }
    }
  }
  return { changes, gaps, notes };
}
