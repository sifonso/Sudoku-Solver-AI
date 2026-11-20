// Erfundene Beispieldaten für die Demo ohne eingespielte Excel. Keine echten Personen.
import { addDays, iso, type DpSeed, type Staff } from './model';

const NAMES: [string, string][] = [
  ['Anna', 'Berger'], ['Ben', 'Carstens'], ['Clara', 'Diehl'], ['David', 'Engel'], ['Ella', 'Fuchs'],
  ['Felix', 'Graf'], ['Greta', 'Haas'], ['Hannes', 'Iske'], ['Ida', 'Jansen'], ['Jonas', 'Kühn'],
  ['Kira', 'Lorenz'], ['Lukas', 'Maier'], ['Mara', 'Nowak'], ['Nico', 'Ott'], ['Olga', 'Peters'], ['Paul', 'Quast'],
];
// 16-Wochen-Muster: Früh-, Mittel-, Spät- und Nachtblöcke mit freien Tagen dazwischen.
const BLOCK = ['F', 'F', 'F', 'MF', 'MF', '', '', '', 'S', 'S', 'S', 'S/N', 'S/N', '', '', '', 'M', 'M', 'S', 'N', 'N', '', '', ''];

function rhythmFor(offset: number): string[] {
  return Array.from({ length: 112 }, (_, i) => BLOCK[(i + offset * 7) % BLOCK.length] ?? '');
}

export function sampleSeed(): DpSeed {
  const leads: Staff[] = ([['Rita', 'Sommer'], ['Tom', 'Ulrich']] as const).map(([f, l], i) => ({
    id: `l${i + 1}`, short: l, firstName: f, lastName: l, nr: '', sort: 100 + i, inPlan: false, isLead: true, teamLeadId: null,
    rhythm: [], quals: {}, phonePrivate: '', phoneMobile: `0170 000000${i}`, persNr: '', whatsapp: 'ok',
  }));
  const staff: Staff[] = NAMES.map(([f, l], i) => ({
    id: `s${i + 1}`, short: l, firstName: f, lastName: l, nr: String(i + 1), sort: i + 1, inPlan: true, isLead: false,
    teamLeadId: leads[i % 2]?.id ?? null, rhythm: rhythmFor(i),
    quals: { T1: i % 3 ? 'X' : '', T2: 'X', Ankunft: i % 2 ? 'X' : '(X)', MAUS: i % 4 ? 'X' : '', ARGUS: 'X' },
    phonePrivate: '', phoneMobile: `0151 00000${String(i).padStart(2, '0')}`, persNr: String(90000 + i), whatsapp: i % 3 ? 'ok' : 'nok',
  }));
  // Ein paar Feinplan-Einträge im laufenden Monat: Arbeitsplätze, Urlaub, Krank.
  const today = new Date();
  const first = iso(new Date(today.getFullYear(), today.getMonth(), 1, 12));
  const wps = ['T1', 'T2', 'PA', 'AK', 'AN'];
  const entries = [] as DpSeed['entries'];
  staff.forEach((s, si) => {
    for (let d = 0; d < 28; d++) {
      const date = addDays(first, d);
      const idx = (((Math.round((Date.parse(date) - Date.parse('2027-01-04')) / 86400000)) % 112) + 112) % 112;
      const base = s.rhythm[idx] ?? '';
      if (!base) continue;
      if (si === 2 && d >= 8 && d < 14) entries.push({ staffId: s.id, date, code: 'U', flex: false });
      else if (si === 5 && d >= 3 && d < 5) entries.push({ staffId: s.id, date, code: 'K', flex: false });
      else if ((si + d) % 5 !== 0) {
        const g = base.startsWith('S/N') ? 'S' : base[0];
        const wp = g === 'N' ? wps[(si + d) % 2] : wps[(si + d) % 5];
        entries.push({ staffId: s.id, date, code: `${wp}/${g}`, flex: (si + d) % 17 === 0 });
      }
    }
  });
  return { staff: [...staff, ...leads], entries, carpools: [{ name: 'Fahrgemeinschaft 1', members: ['s1', 's4'] }] };
}
