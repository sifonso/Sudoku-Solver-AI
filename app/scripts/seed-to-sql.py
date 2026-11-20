#!/usr/bin/env python3
"""Erzeugt aus der JSON-Ausgabe von import-dienstplan.py SQL für einen Betrieb in Supabase.
Der Betrieb wird über seine Firmenadresse (slug) gefunden. Vorhandene Dienstplandaten dieses
Betriebs werden überschrieben (Personen, Einträge, Fahrgemeinschaften, Einstellungen).

    python3 scripts/seed-to-sql.py seed.json mein-betrieb > /pfad/ausserhalb/import.sql

Die SQL-Datei enthält Personendaten und gehört nicht ins Repository.
"""
import json, sys

def lit(v):
    return "'" + str(v).replace("'", "''") + "'"

def main(seed_path, slug):
    d = json.load(open(seed_path))
    t = f"(select id from tenants where slug = {lit(slug)})"
    out = ['begin;', f"do $$ begin if {t} is null then raise exception 'Betrieb {slug} nicht gefunden'; end if; end $$;"]
    out.append(f'delete from dp_swaps where tenant_id = {t};')
    out.append(f'delete from dp_carpools where tenant_id = {t};')
    out.append(f'delete from dp_staff where tenant_id = {t};')  # Einträge und Personalnummern über Fremdschlüssel
    settings = {'rhythmStart': d['settings']['rhythmStart'], 'rhythmLength': d['settings']['rhythmLength'],
                'minStaffing': d['settings']['minStaffing'], 'swapApproval': True}
    out.append(f"insert into dp_settings (tenant_id, data) values ({t}, {lit(json.dumps(settings, ensure_ascii=False))}::jsonb) "
               "on conflict (tenant_id) do update set data = dp_settings.data || excluded.data, updated_at = now();")
    for s in d['staff']:
        data = {k: v for k, v in s.items() if k not in ('id', 'sort', 'persNr', 'memberId')}
        out.append(f"insert into dp_staff (tenant_id, id, sort, data) values ({t}, {lit(s['id'])}, {int(s['sort'])}, {lit(json.dumps(data, ensure_ascii=False))}::jsonb);")
        if s.get('persNr'):
            out.append(f"insert into dp_staff_private (tenant_id, staff_id, pers_nr) values ({t}, {lit(s['id'])}, {lit(s['persNr'])});")
    rows = [f"({t}, {lit(e['staffId'])}, {lit(e['date'])}, {lit(e['code'])}, {'true' if e['flex'] else 'false'})" for e in d['entries']]
    for i in range(0, len(rows), 500):
        out.append('insert into dp_entries (tenant_id, staff_id, date, code, flex) values\n' + ',\n'.join(rows[i:i + 500]) + ';')
    for c in d['carpools']:
        arr = 'array[' + ','.join(lit(m) for m in c['members']) + ']::text[]'
        out.append(f"insert into dp_carpools (tenant_id, name, members) values ({t}, {lit(c['name'])}, {arr});")
    out.append('commit;')
    print('\n'.join(out))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
