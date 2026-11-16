-- Schnellaktionen: Werte serverseitig prüfen. out_of_range kommt nicht vom Gerät, sondern aus den Felddefinitionen
-- (fields: [{key,label,type:number|text|check,unit,min,max,required}]). Fehlende Pflichtfelder werden abgelehnt.
create or replace function quick_entry_check() returns trigger
language plpgsql as $$
declare
  qa quick_actions;
  f jsonb;
  v text;
  n numeric;
  oor boolean := false;
begin
  select * into qa from quick_actions where id = new.quick_action_id and tenant_id = new.tenant_id;
  if qa.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if qa.archived_at is not null then
    raise exception 'quick_action_archived' using errcode = 'P0001';
  end if;
  for f in select * from jsonb_array_elements(qa.fields) loop
    v := new."values" ->> (f ->> 'key');
    if coalesce((f ->> 'required')::boolean, false) and (v is null or btrim(v) = '') then
      raise exception 'missing_field:%', f ->> 'key' using errcode = 'P0001';
    end if;
    if f ->> 'type' = 'number' and v is not null and btrim(v) <> '' then
      begin
        n := replace(v, ',', '.')::numeric;
      exception when others then
        raise exception 'invalid_number:%', f ->> 'key' using errcode = 'P0001';
      end;
      if (f ? 'min' and n < (f ->> 'min')::numeric) or (f ? 'max' and n > (f ->> 'max')::numeric) then
        oor := true;
      end if;
    end if;
  end loop;
  new.out_of_range := oor;
  return new;
end $$;

create trigger quick_entries_check before insert on quick_action_entries
  for each row execute function quick_entry_check();
