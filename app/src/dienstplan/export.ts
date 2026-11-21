// Export des Dienstplans als Excel (.xlsx) und PDF. Läuft komplett auf dem Gerät.
// Excel wird als minimales Office-Open-XML-Paket geschrieben (fflate zum Zippen), PDF mit jsPDF.
import { strToU8, zipSync } from 'fflate';
import { jsPDF } from 'jspdf';
import { Platform } from 'react-native';
import {
  COUNTER_ROWS, DAY_COLORS, MONTHS, WEEKDAYS, byIdOf, cellColors, cellFor, dayCounters, holidayOf, monthDays, weekday, yearStats,
  type DpSettings, type Entry, type Staff,
} from './model';

type CellOut = { v: string | number; bg?: string; fg?: string; bold?: boolean };
export interface Sheet { name: string; rows: CellOut[][]; widths?: number[] }

// ---------- Inhalte ----------

export function monthSheet(year: number, month: number, staff: Staff[], entries: Map<string, Entry>, s: DpSettings): Sheet {
  const days = monthDays(year, month);
  const byId = byIdOf(staff);
  const head = (d: string): CellOut => ({ v: `${WEEKDAYS[weekday(d)]} ${Number(d.slice(8))}`, bold: true, bg: holidayOf(d) ? DAY_COLORS.holiday : weekday(d) === 6 ? '#475569' : weekday(d) === 0 ? DAY_COLORS.sunday : '#E2E3F3', fg: weekday(d) === 6 && !holidayOf(d) ? '#FFFFFF' : undefined });
  const rows: CellOut[][] = [
    [{ v: `Dienstplan ${MONTHS[month]} ${year}`, bold: true }],
    [{ v: 'Nr.', bold: true }, { v: 'Name', bold: true }, ...days.map(head)],
    [{ v: '' }, { v: 'Feiertag', bold: true }, ...days.map((d) => ({ v: holidayOf(d) ?? '', bg: holidayOf(d) ? DAY_COLORS.holiday : undefined }))],
  ];
  for (const st of staff.filter((x) => x.inPlan)) {
    rows.push([{ v: st.nr }, { v: st.short, bold: true }, ...days.map((d): CellOut => {
      const cell = cellFor(st, d, entries, s, 'fein', byId);
      const col = cellColors(cell.code, s);
      const code = cell.code + (cell.flex ? ' FLEX' : '');
      return { v: code, bg: col?.bg ?? (holidayOf(d) ? DAY_COLORS.holiday : weekday(d) === 0 ? DAY_COLORS.sunday : undefined), fg: col?.fg ?? (cell.flex ? DAY_COLORS.flexText : cell.source !== 'entry' ? '#7D8099' : undefined) };
    })]);
  }
  rows.push([{ v: '' }]);
  const counters = days.map((d) => dayCounters(d, staff, entries, s));
  for (const k of [...Object.keys(s.minStaffing), 'Schichtstärke', ...COUNTER_ROWS]) {
    rows.push([{ v: '' }, { v: k, bold: true }, ...counters.map((cnt): CellOut => {
      const v = cnt[k] ?? 0;
      const min = s.minStaffing[k];
      const under = k === 'Verfügbar' ? v > (min ?? 0) : min != null && v < min;
      return { v, bg: under ? DAY_COLORS.under.bg : undefined, fg: under ? DAY_COLORS.under.fg : undefined };
    })]);
  }
  return { name: `${MONTHS[month]} ${year}`, rows, widths: [5, 14, ...days.map(() => 6.5)] };
}

export function yearSheet(year: number, st: Staff, staff: Staff[], entries: Map<string, Entry>, s: DpSettings): Sheet {
  const byId = byIdOf(staff);
  const stats = yearStats(st, year, entries, s, byId);
  const rows: CellOut[][] = [
    [{ v: `Jahresübersicht ${year} · ${st.firstName} ${st.lastName}`.trim(), bold: true }],
    [{ v: `Dienste ${stats.dienste} · Sonntagsdienste ${stats.sonntag} · Feiertagsdienste ${stats.feiertag} · Nachtdienste ${stats.nacht} · Urlaub ${stats.urlaub} · Z-Tage ${stats.z}` }],
    [{ v: 'Tag', bold: true }, ...MONTHS.map((m, i) => ({ v: `${m} (${stats.perMonth[i] ?? 0})`, bold: true, bg: '#E2E3F3' }))],
  ];
  for (let d = 1; d <= 31; d++) {
    rows.push([{ v: d, bold: true }, ...MONTHS.map((_, m): CellOut => {
      const date = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (d > new Date(year, m + 1, 0).getDate()) return { v: '', bg: '#CBD5E1' };
      const cell = cellFor(st, date, entries, s, 'fein', byId);
      const col = cellColors(cell.code, s);
      const work = !!cell.code && !col;
      return {
        v: `${WEEKDAYS[weekday(date)]} ${cell.code}${holidayOf(date) ? ` (${holidayOf(date)})` : ''}`.trim(),
        bg: col?.bg ?? (work ? '#252940' : holidayOf(date) ? DAY_COLORS.holiday : weekday(date) === 0 ? DAY_COLORS.sunday : undefined),
        fg: col?.fg ?? (work ? '#FFFFFF' : undefined),
      };
    })]);
  }
  return { name: `${st.short} ${year}`, rows, widths: [5, ...MONTHS.map(() => 16)] };
}

// ---------- Excel ----------

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const argb = (hex: string) => `FF${hex.replace('#', '').toUpperCase()}`;
const colName = (i: number) => { let n = i + 1, s = ''; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

export function toXlsx(sheets: Sheet[]): Uint8Array {
  // Stile sammeln: Kombination aus Hintergrund, Schriftfarbe, fett
  const fills: string[] = [];
  const fonts: string[] = ['|0'];
  const xfs: string[] = ['0|0'];
  const styleOf = (c: CellOut) => {
    let fi = 0;
    if (c.bg) { let i = fills.indexOf(c.bg); if (i < 0) { fills.push(c.bg); i = fills.length - 1; } fi = i + 2; }
    const fk = `${c.fg ?? ''}|${c.bold ? 1 : 0}`;
    let fo = fonts.indexOf(fk); if (fo < 0) { fonts.push(fk); fo = fonts.length - 1; }
    const key = `${fi}|${fo}`;
    let x = xfs.indexOf(key); if (x < 0) { xfs.push(key); x = xfs.length - 1; }
    return x;
  };
  const sheetXml = sheets.map((sh) => {
    const rows = sh.rows.map((r, ri) => `<row r="${ri + 1}">${r.map((c, ci) => {
      const ref = `${colName(ci)}${ri + 1}`;
      const st = styleOf(c);
      return typeof c.v === 'number'
        ? `<c r="${ref}" s="${st}"><v>${c.v}</v></c>`
        : c.v === '' && !c.bg ? '' : `<c r="${ref}" s="${st}" t="inlineStr"><is><t>${esc(String(c.v))}</t></is></c>`;
    }).join('')}</row>`).join('');
    const cols = sh.widths ? `<cols>${sh.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane xSplit="2" ySplit="3" topLeftCell="C4" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${rows}</sheetData></worksheet>`;
  });
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + `<fonts count="${fonts.length}">${fonts.map((f) => { const [fg, b] = f.split('|'); return `<font>${b === '1' ? '<b/>' : ''}<sz val="10"/>${fg ? `<color rgb="${argb(fg)}"/>` : ''}<name val="Arial"/></font>`; }).join('')}</fonts>`
    + `<fills count="${fills.length + 2}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fills.map((f) => `<fill><patternFill patternType="solid"><fgColor rgb="${argb(f)}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills>`
    + `<borders count="2"><border/><border><left style="thin"><color rgb="FFD0D0D8"/></left><right style="thin"><color rgb="FFD0D0D8"/></right><top style="thin"><color rgb="FFD0D0D8"/></top><bottom style="thin"><color rgb="FFD0D0D8"/></bottom></border></borders>`
    + `<cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.map((x) => { const [fi, fo] = x.split('|'); return `<xf fontId="${fo}" fillId="${fi}" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`; }).join('')}</cellXfs></styleSheet>`;
  const names = sheets.map((s, i) => esc(s.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || `Blatt ${i + 1}`));
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': strToU8(styles),
  };
  sheetXml.forEach((x, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(x); });
  return zipSync(files);
}

// ---------- PDF ----------

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/** Tabelle über eine oder mehrere Seiten, Spaltenbreiten an die Seite angepasst. */
export function toPdf(sheets: Sheet[], title: string): Uint8Array {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297, H = 210, M = 8;
  sheets.forEach((sh, si) => {
    if (si > 0) doc.addPage();
    const widths = sh.widths ?? sh.rows[1]?.map(() => 10) ?? [];
    const total = widths.reduce((a, b) => a + b, 0);
    const scale = (W - 2 * M) / total;
    const colW = widths.map((w) => w * scale);
    const bodyRows = sh.rows.slice(1);
    const rowH = Math.min(6, (H - 2 * M - 10) / Math.max(1, bodyRows.length));
    const font = Math.max(4.5, Math.min(8, rowH * 1.9));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(String(sh.rows[0]?.[0]?.v ?? title), M, M + 4);
    let y = M + 8;
    for (const r of bodyRows) {
      let x = M;
      r.forEach((c, ci) => {
        const w = colW[ci] ?? colW[colW.length - 1] ?? 8;
        if (c.bg) { doc.setFillColor(...rgb(c.bg)); doc.rect(x, y, w, rowH, 'F'); }
        doc.setDrawColor(208, 208, 216);
        doc.rect(x, y, w, rowH, 'S');
        const t = String(c.v ?? '');
        if (t) {
          doc.setFont('helvetica', c.bold ? 'bold' : 'normal');
          doc.setFontSize(r.length === 1 ? 8 : font);
          doc.setTextColor(...rgb(c.fg ?? '#252940'));
          const fitted = doc.splitTextToSize(t, r.length === 1 ? W - 2 * M : w - 0.6)[0] ?? '';
          if (r.length === 1) doc.text(fitted, x, y + rowH * 0.7);
          else doc.text(fitted, x + w / 2, y + rowH * 0.68, { align: 'center' });
        }
        x += w;
      });
      y += rowH;
    }
    doc.setTextColor(125, 128, 153);
    doc.setFontSize(7);
    doc.text(`Erstellt am ${new Date().toLocaleDateString('de-DE')}`, M, H - 4);
  });
  return new Uint8Array(doc.output('arraybuffer'));
}

// ---------- Speichern / Teilen ----------

export async function saveFile(name: string, bytes: Uint8Array, mime: string): Promise<'downloaded' | 'shared'> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return 'downloaded';
  }
  const FS = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const uri = `${FS.cacheDirectory}${name}`;
  await FS.writeAsStringAsync(uri, globalThis.btoa(bin), { encoding: FS.EncodingType.Base64 });
  await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: name });
  return 'shared';
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const PDF_MIME = 'application/pdf';
