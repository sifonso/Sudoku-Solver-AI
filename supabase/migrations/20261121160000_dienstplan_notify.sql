-- Mitteilungen zum Dienstplan: Dienständerung, Tausch, veröffentlichte Autodisposition, unbesetzte Pflichtdienste.
-- Landen in notifications (Glocke); der vorhandene Push-Webhook verschickt sie, sobald er eingerichtet ist.

create or replace function dp_notify_staff(t uuid, p_staff text, p_type text, p_title text, p_body text, p_data jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into notifications (tenant_id, member_id, type, title, body, data)
  select t, s.member_id, p_type, p_title, p_body, p_data
  from dp_staff s where s.tenant_id = t and s.id = p_staff and s.member_id is not null
    and s.member_id is distinct from my_member_id(t)
$$;

create or replace function dp_notify_leads(t uuid, p_type text, p_title text, p_body text, p_data jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into notifications (tenant_id, member_id, type, title, body, data)
  select t, m.id, p_type, p_title, p_body, p_data
  from members m where m.tenant_id = t and m.status = 'active' and m.role in ('chef','planer')
$$;
revoke execute on function dp_notify_staff(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function dp_notify_leads(uuid, text, text, text, jsonb) from public, anon, authenticated;

-- Einzelne Änderung durch FK4/SL: betroffene Person informieren
create or replace function dp_notify_entry() returns trigger
language plpgsql security definer set search_path = public as $$
declare t uuid := coalesce(new.tenant_id, old.tenant_id); src text := coalesce(nullif(current_setting('dp.source', true), ''), 'plan');
begin
  if src <> 'plan' then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' and old.code = new.code then return new; end if;
  perform dp_notify_staff(t, coalesce(new.staff_id, old.staff_id), 'dp_changed', 'Dienst geändert',
    to_char(coalesce(new.date, old.date), 'DD.MM.') || ': ' || coalesce(nullif(old.code, ''), 'frei') || ' → ' ||
    coalesce(nullif(case when tg_op = 'DELETE' then '' else new.code end, ''), 'laut Turnus'),
    jsonb_build_object('date', coalesce(new.date, old.date)));
  return coalesce(new, old);
end $$;
create trigger dp_notify_entry after insert or update or delete on dp_entries for each row execute function dp_notify_entry();

-- Tausch: Beteiligte bei Vorschlag, Anfrage, Ergebnis; FK4/SL bei „wartet auf Genehmigung“
create or replace function dp_notify_swap() returns trigger
language plpgsql security definer set search_path = public as $$
declare l jsonb;
begin
  if tg_op = 'INSERT' and new.kind = 'direct' then
    for l in select * from jsonb_array_elements(new.legs) loop
      perform dp_notify_staff(new.tenant_id, l->>'staffId', 'dp_swap_proposed', 'Tauschvorschlag', 'Bitte in der Tauschbörse zustimmen oder ablehnen.', jsonb_build_object('swap', new.id));
    end loop;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'pending' then
      perform dp_notify_leads(new.tenant_id, 'dp_swap_pending', 'Tausch wartet auf Genehmigung', 'Bitte in der Tauschbörse prüfen.', jsonb_build_object('swap', new.id));
    elsif new.status in ('done', 'rejected') then
      for l in select * from jsonb_array_elements(new.legs) loop
        perform dp_notify_staff(new.tenant_id, l->>'staffId', 'dp_swap_' || new.status,
          case when new.status = 'done' then 'Tausch gilt' else 'Tausch abgelehnt' end,
          case when new.status = 'done' then 'Der Plan ist aktualisiert.' else 'Der Plan bleibt, wie er war.' end, jsonb_build_object('swap', new.id));
      end loop;
    end if;
  end if;
  return new;
end $$;
create trigger dp_notify_swap after insert or update on dp_swaps for each row execute function dp_notify_swap();

create or replace function dp_notify_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare s dp_swaps;
begin
  select * into s from dp_swaps where id = new.swap_id;
  perform dp_notify_staff(s.tenant_id, s.staff_id, 'dp_swap_request', 'Neue Anfrage auf dein Angebot', 'Bitte in der Tauschbörse ansehen.', jsonb_build_object('swap', s.id));
  return new;
end $$;
create trigger dp_notify_request after insert on dp_swap_requests for each row execute function dp_notify_request();

-- Autodisposition: je betroffener Person eine Mitteilung; unbesetzte Pflichtdienste an FK4/SL
create or replace function dp_set_entries(p_tenant uuid, p_entries jsonb, p_source text default 'plan') returns integer
language plpgsql security definer set search_path = public as $$
declare e jsonb; n int := 0; r record;
begin
  if not can_plan(p_tenant) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform set_config('dp.source', left(coalesce(p_source, 'plan'), 20), true);
  for e in select * from jsonb_array_elements(p_entries) loop
    if coalesce(e->>'code', '') = '' and not coalesce((e->>'flex')::boolean, false) then
      delete from dp_entries where tenant_id = p_tenant and staff_id = e->>'staffId' and date = (e->>'date')::date;
    else
      insert into dp_entries (tenant_id, staff_id, date, code, flex, updated_by)
      values (p_tenant, e->>'staffId', (e->>'date')::date, e->>'code', coalesce((e->>'flex')::boolean, false), auth.uid())
      on conflict (tenant_id, staff_id, date) do update set code = excluded.code, flex = excluded.flex, updated_at = now(), updated_by = auth.uid();
    end if;
    n := n + 1;
  end loop;
  perform set_config('dp.source', '', true);
  if p_source = 'autodispo' then
    for r in select x->>'staffId' as staff, count(*) as cnt, min((x->>'date')::date) as von, max((x->>'date')::date) as bis
             from jsonb_array_elements(p_entries) x group by 1 loop
      perform dp_notify_staff(p_tenant, r.staff, 'dp_published', 'Neuer Dienstplan veröffentlicht',
        r.cnt || ' Dienste zwischen ' || to_char(r.von, 'DD.MM.') || ' und ' || to_char(r.bis, 'DD.MM.'), '{}');
    end loop;
  end if;
  return n;
end $$;
grant execute on function dp_set_entries(uuid, jsonb, text) to authenticated;

create or replace function dp_alert_leads(p_tenant uuid, p_title text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_plan(p_tenant) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform dp_notify_leads(p_tenant, 'dp_required_gap', left(p_title, 120), left(p_body, 500), '{}');
end $$;
grant execute on function dp_alert_leads(uuid, text, text) to authenticated;
