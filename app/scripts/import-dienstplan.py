#!/usr/bin/env python3
"""Liest die Dienstplan-Excel (Monatsblätter, Grundrhythmus, Einstellungen, Qualifikationen,
Telefonnummern, Mitarbeiterzuordnung, Fahrgemeinschaften) und schreibt sie als JSON im Format
von `src/dienstplan/model.ts` (DpSeed).

Die Ausgabe enthält Personendaten (Namen, Telefonnummern, Personalnummern). Sie gehört nicht ins
Repository: Ziel immer außerhalb des Repos oder in eine Datei, die in .gitignore steht.

    python3 scripts/import-dienstplan.py plan.xlsx /pfad/ausserhalb/seed.json
"""
import datetime as dt
import difflib
import json
import re
import sys
import unicodedata

import openpyxl

QUAL_COLS = ['T1', 'T2', 'Ankunft', 'MAUS', 'PANDA AN', 'PANDA AB', 'ARGUS', 'FGB Einweisung',
             'Bereichstrainer Ausbildung', 'Bereichstrainer aktiv']
MONTHS = {'Januar': 1, 'Februar': 2, 'März': 3, 'April': 4, 'Mai': 5, 'Juni': 6, 'Juli': 7,
          'August': 8, 'September': 9, 'Oktober': 10, 'November': 11, 'Dezember': 12}


def norm(s):
    s = unicodedata.normalize('NFKD', str(s or '').strip().lower().replace('ß', 'ss'))
    return re.sub(r'[^a-z]', '', ''.join(ch for ch in s if not unicodedata.combining(ch)))


def text(v):
    if v is None:
        return ''
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


def main(src, out):
    wb = openpyxl.load_workbook(src, data_only=True)
    notes = []

    # Grundrhythmus: eine Zeile je Person, 112 Tage ab Spalte C.
    g = wb['Grundrhythmus']
    staff = []
    for r in range(5, g.max_row + 1):
        nr, short = g.cell(r, 1).value, g.cell(r, 2).value
        if not isinstance(nr, (int, float)) or not short:
            continue
        rhythm = [text(g.cell(r, 3 + i).value) for i in range(112)]
        staff.append({'nr': text(nr), 'short': text(short), 'rhythm': rhythm, 'inPlan': True})

    def find(last, first=None, pool=None, create=False, source=''):
        pool = staff if pool is None else pool
        nl, nf = norm(last), norm(first)
        cands = [s for s in pool if norm(s.get('lastName') or s['short'].split(' ')[0]) == nl]
        if len(cands) > 1 and nf:
            cands = [s for s in cands if norm(s.get('firstName', '')).startswith(nf[:3])
                     or norm(s['short']).endswith(nf[:1])] or cands
        if not cands:
            keys = {norm(s.get('lastName') or s['short'].split(' ')[0]): s for s in pool}
            close = difflib.get_close_matches(nl, keys.keys(), n=1, cutoff=0.8)
            if close:
                cands = [keys[close[0]]]
                notes.append(f'{source}: „{last}“ als „{cands[0]["short"]}“ erkannt')
        if len(cands) == 1:
            return cands[0]
        if create:
            s = {'nr': '', 'short': text(last), 'rhythm': [], 'inPlan': False}
            staff.append(s)
            return s
        return None

    # Qualifikationen liefern Vor- und Nachnamen.
    q = wb['Qualifikationen']
    for r in range(4, q.max_row + 1):
        first, last = q.cell(r, 3).value, q.cell(r, 4).value
        if not isinstance(q.cell(r, 2).value, (int, float)) or not last:
            continue
        s = find(last, first, source='Qualifikationen') or find(last, first, create=True, source='Qualifikationen')
        s['firstName'], s['lastName'] = text(first), text(last)
        s.setdefault('spell', []).append(text(last))
        s['quals'] = {c: text(q.cell(r, 5 + i).value) for i, c in enumerate(QUAL_COLS)}

    # Mitarbeiterzuordnung: Blöcke durch Leerzeilen getrennt, erste Person je Block leitet ihn.
    z = wb['Mitarbeiterzuordnung']
    lead = None
    for r in range(3, z.max_row + 1):
        last, first = z.cell(r, 1).value, z.cell(r, 2).value
        if not last:
            lead = None
            continue
        s = find(last, first, source='Mitarbeiterzuordnung') or find(last, first, create=True, source='Mitarbeiterzuordnung')
        s.setdefault('firstName', text(first))
        s.setdefault('lastName', text(last))
        s.setdefault('spell', []).append(text(last))
        if lead is None:
            lead = s
            s['isLead'] = True
        else:
            s['leadShort'] = lead['short']

    # Telefonnummern
    t = wb['Telefonnummern']
    for r in range(2, t.max_row + 1):
        last, first = t.cell(r, 1).value, t.cell(r, 2).value
        if not last or isinstance(last, dt.datetime) or text(last) in ('Name', 'SL') or not first:
            continue
        s = find(last, first, source='Telefonnummern') or find(last, first, create=True, source='Telefonnummern')
        if s.get('firstName') and norm(first) and not norm(first).startswith(norm(s['firstName'])[:3]):
            notes.append(f'Telefonnummern: Vorname „{text(first)}“ bei {s["lastName"]}, sonst „{s["firstName"]}“')
        s.setdefault('firstName', text(first))
        s.setdefault('lastName', text(last))
        s.setdefault('spell', []).append(text(last))
        s['phonePrivate'] = text(t.cell(r, 3).value)
        s['phoneMobile'] = text(t.cell(r, 4).value)
        s['persNr'] = text(t.cell(r, 5).value)
        s['whatsapp'] = text(t.cell(r, 6).value)

    # Fahrgemeinschaften
    f = wb['Fahrgemeinschaften']
    carpools = []
    for r in range(1, f.max_row + 1):
        label = text(f.cell(r, 1).value)
        if not label.startswith('Fahrgemeinschaft'):
            continue
        names = [text(f.cell(r, c).value) for c in range(3, 6) if f.cell(r, c).value]
        members = []
        for n in names:
            parts = n.split(' ')
            s = find(parts[0], parts[1].rstrip('.') if len(parts) > 1 else None, source='Fahrgemeinschaften')
            if s:
                members.append(s['short'])
        carpools.append({'name': label, 'members': members})

    # IDs vergeben, Planreihenfolge = Grundrhythmus, dann der Rest alphabetisch.
    for i, s in enumerate(sorted(staff, key=lambda s: (not s['inPlan'], int(s['nr']) if s['nr'].isdigit() else 999, s.get('lastName', s['short'])))):
        s['id'] = f'p{i + 1:02d}'
        s['sort'] = i + 1
        s.setdefault('firstName', '')
        s.setdefault('lastName', s['short'])
        s.setdefault('quals', {})
        for k in ('phonePrivate', 'phoneMobile', 'persNr', 'whatsapp'):
            s.setdefault(k, '')
        s['isLead'] = bool(s.get('isLead'))
    by_short = {s['short']: s for s in staff}
    for s in staff:
        s['teamLeadId'] = by_short[s.pop('leadShort')]['id'] if s.get('leadShort') else None
    for c in carpools:
        c['members'] = [by_short[m]['id'] for m in c['members']]

    # Monatsblätter: Person in Spalte B, darunter optional FLEX-Zeile.
    entries = {}
    for sheet in wb.sheetnames:
        ws = wb[sheet]
        if sheet not in MONTHS:
            continue
        header_row = next(r for r in range(1, 8) if text(ws.cell(r, 1).value) == 'Nr.')
        dates = {}
        for c in range(3, 40):
            v = ws.cell(header_row, c).value
            if isinstance(v, dt.datetime):
                dates[c] = v.date()
        r = header_row + 1
        while r <= ws.max_row:
            name = text(ws.cell(r, 2).value)
            if '/' in name or name in ('Verfügbar', 'Schichtstärke'):
                break  # ab hier Zählerzeilen
            if name in ('Wochentag', 'Feiertag', 'Datum', 'Name/Tag') or not name:
                r += 1
                continue
            parts = name.split(' ')
            s = find(parts[0], parts[1].rstrip('.') if len(parts) > 1 else None, source=sheet)
            if not s:
                notes.append(f'{sheet}: Zeile „{name}“ keiner Person zugeordnet')
                r += 1
                continue
            for c, d in dates.items():
                code = text(ws.cell(r, c).value)
                flex = text(ws.cell(r + 1, c).value).upper().startswith('FL')
                if code or flex:
                    entries[(s['id'], d.isoformat())] = {'staffId': s['id'], 'date': d.isoformat(), 'code': code, 'flex': flex}
            r += 1

    e = wb['Einstellungen']
    settings = {'rhythmStart': e['B3'].value.date().isoformat(), 'rhythmLength': int(e['B4'].value), 'minStaffing': {}}
    for r in range(28, 46):
        k, v = text(e.cell(r, 1).value), e.cell(r, 2).value
        if k and isinstance(v, (int, float)):
            settings['minStaffing'][k] = int(v)

    planned = {e['staffId'] for e in entries.values()}
    for s in staff:
        s['inPlan'] = s['inPlan'] or s['id'] in planned
        spell = s.pop('spell', [])
        if spell:
            s['lastName'] = max(set(spell), key=spell.count)
    seed = {'settings': settings, 'staff': sorted(staff, key=lambda s: s['sort']), 'entries': list(entries.values()), 'carpools': carpools}
    json.dump(seed, open(out, 'w'), ensure_ascii=False)
    print(f'{len(staff)} Personen ({sum(s["inPlan"] for s in staff)} im Plan, {sum(s["isLead"] for s in staff)} leiten ein Team), '
          f'{len(entries)} Planeinträge, {len(carpools)} Fahrgemeinschaften')
    for n in dict.fromkeys(notes):
        print('Hinweis:', n)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
