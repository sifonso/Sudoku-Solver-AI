-- Urlaub ändern/stornieren (direkt durch FK4/SL oder als Anfrage der Person), Flextage, Aufforderung an alle,
-- weitere Abteilungen durch bestehende FK4/SL.

alter table dp_vacation
  add column change_kind text not null default '' check (change_kind in ('', 'storno', 'aenderung')),
  add column change_from date,
  add column change_to date;

-- U-Tage eines Urlaubs entfernen bzw. eintragen (Quelle „urlaub“ im Protokoll)
create or replace function dp_vac_unapply(v dp_vacation) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('dp.source', 'urlaub', true);
  delete from dp_entries where tenant_id = v.tenant_id and staff_id = v.staff_id and date between v.date_from and v.date_to and code = 'U';
  perform set_config('dp.source', '', true);
end $$;
create or replace function dp_vac_apply(t uuid, p_staff text, p_from date, p_to date) returns void
language plpgsql security definer set search_path = public as $$
declare d date;
begin
  perform set_config('dp.source', 'urlaub', true);
  for d in select generate_series(p_from, p_to, interval '1 day')::date loop
    if dp_is_work(t, dp_effective(t, p_staff, d)) then perform dp_put(t, p_staff, d, 'U'); end if;
  end loop;
  perform set_config('dp.source', '', true);
end $$;
revoke execute on function dp_vac_unapply(dp_vacation), dp_vac_apply(uuid, text, date, date) from public, anon, authenticated;

-- Ändern: eigener Wunsch, oder FK4/SL jederzeit (genehmigter Urlaub wird im Plan nachgezogen)
create or replace function dp_vac_update(p_id uuid, p_from date, p_to date, p_priority int, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare v dp_vacation;
begin
  select * into v from dp_vacation where id = p_id for update;
  if v.id is null then raise exception 'not_found'; end if;
  if p_to < p_from then raise exception 'invalid_entry'; end if;
  if not can_plan(v.tenant_id) and not (v.status = 'wunsch' and v.staff_id = dp_my_staff(v.tenant_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v.status = 'genehmigt' then perform dp_vac_unapply(v); end if;
  update dp_vacation set date_from = p_from, date_to = p_to, year = extract(year from p_from)::int, priority = coalesce(p_priority, priority),
    note = coalesce(p_note, note), change_kind = '', change_from = null, change_to = null where id = p_id;
  if v.status = 'genehmigt' then perform dp_vac_apply(v.tenant_id, v.staff_id, p_from, p_to); end if;
  if v.staff_id is distinct from dp_my_staff(v.tenant_id) then
    perform dp_notify_staff(v.tenant_id, v.staff_id, 'vac_changed', 'Urlaub geändert', to_char(p_from, 'DD.MM.') || '–' || to_char(p_to, 'DD.MM.YYYY'), '{}');
  end if;
end $$;

-- Person bittet um Storno oder Änderung eines vorgemerkten/genehmigten Urlaubs
create or replace function dp_vac_change_request(p_id uuid, p_kind text, p_from date default null, p_to date default null) returns void
language plpgsql security definer set search_path = public as $$
declare v dp_vacation;
begin
  select * into v from dp_vacation where id = p_id for update;
  if v.id is null then raise exception 'not_found'; end if;
  if v.staff_id is distinct from dp_my_staff(v.tenant_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v.status not in ('vorgemerkt', 'genehmigt') or p_kind not in ('storno', 'aenderung') then raise exception 'invalid_entry'; end if;
  if p_kind = 'aenderung' and (p_from is null or p_to is null or p_to < p_from) then raise exception 'invalid_entry'; end if;
  update dp_vacation set change_kind = p_kind, change_from = p_from, change_to = p_to where id = p_id;
  perform dp_notify_leads(v.tenant_id, 'vac_change', case when p_kind = 'storno' then 'Urlaub: Stornierung gewünscht' else 'Urlaub: Änderung gewünscht' end,
    coalesce((select data->>'short' from dp_staff where tenant_id = v.tenant_id and id = v.staff_id), '') || ': ' || to_char(v.date_from, 'DD.MM.') || '–' || to_char(v.date_to, 'DD.MM.YYYY'), '{}');
end $$;

create or replace function dp_vac_change_decide(p_id uuid, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v dp_vacation;
begin
  select * into v from dp_vacation where id = p_id for update;
  if v.id is null then raise exception 'not_found'; end if;
  if not can_plan(v.tenant_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v.change_kind = '' then raise exception 'already_decided'; end if;
  if not p_ok then
    update dp_vacation set change_kind = '', change_from = null, change_to = null where id = p_id;
    perform dp_notify_staff(v.tenant_id, v.staff_id, 'vac_change', 'Änderungswunsch abgelehnt', 'Der Urlaub bleibt wie geplant.', '{}');
    return;
  end if;
  if v.status = 'genehmigt' then perform dp_vac_unapply(v); end if;
  if v.change_kind = 'storno' then
    delete from dp_vacation where id = p_id;
    perform dp_notify_staff(v.tenant_id, v.staff_id, 'vac_change', 'Urlaub storniert', to_char(v.date_from, 'DD.MM.') || '–' || to_char(v.date_to, 'DD.MM.YYYY'), '{}');
  else
    update dp_vacation set date_from = v.change_from, date_to = v.change_to, year = extract(year from v.change_from)::int,
      change_kind = '', change_from = null, change_to = null where id = p_id;
    if v.status = 'genehmigt' then perform dp_vac_apply(v.tenant_id, v.staff_id, v.change_from, v.change_to); end if;
    perform dp_notify_staff(v.tenant_id, v.staff_id, 'vac_change', 'Urlaub geändert', to_char(v.change_from, 'DD.MM.') || '–' || to_char(v.change_to, 'DD.MM.YYYY'), '{}');
  end if;
end $$;

-- Löschen jetzt auch für vorgemerkte Wünsche der eigenen Person nicht mehr (dafür Stornowunsch)
create or replace function dp_vac_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v dp_vacation;
begin
  select * into v from dp_vacation where id = p_id;
  if v.id is null then raise exception 'not_found'; end if;
  if can_plan(v.tenant_id) or dp_is_fk3(v.tenant_id) then
    if v.status = 'genehmigt' then perform dp_vac_unapply(v); end if;
  elsif not (v.status in ('wunsch', 'abgelehnt') and v.staff_id = dp_my_staff(v.tenant_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from dp_vacation where id = p_id;
end $$;

grant execute on function dp_vac_update(uuid, date, date, int, text), dp_vac_change_request(uuid, text, date, date),
  dp_vac_change_decide(uuid, boolean) to authenticated;

-- Flextage: zusätzlicher Dienst an einem laut Turnus freien Tag; im Plan als FLEX markiert
create table dp_flex (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  staff_id text not null,
  date date not null,
  by_employer boolean not null default false,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  unique (tenant_id, staff_id, date),
  foreign key (tenant_id, staff_id) references dp_staff(tenant_id, id) on delete cascade
);
create index dp_flex_tenant on dp_flex (tenant_id, date);
alter table dp_flex enable row level security;
create policy dp_flex_read on dp_flex for select using (is_member(tenant_id));
grant select on dp_flex to authenticated;

create or replace function dp_flex_add(p_tenant uuid, p_date date, p_staff text default null, p_employer boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare me text := dp_my_staff(p_tenant); who text := coalesce(p_staff, me); lead boolean := can_plan(p_tenant);
  st jsonb; yr int := extract(year from p_date)::int; cnt int; lim int; v uuid;
begin
  if who is null or (who is distinct from me and not lead) or (p_employer and not lead) then raise exception 'forbidden' using errcode = '42501'; end if;
  select data into st from dp_settings where tenant_id = p_tenant;
  if not lead and not coalesce((st->'vacation'->'flexOpenYears') @> to_jsonb(yr), false) then raise exception 'flex_closed'; end if;
  if dp_is_work(p_tenant, dp_effective(p_tenant, who, p_date)) then raise exception 'flex_not_free'; end if;
  select count(*) into cnt from dp_flex where tenant_id = p_tenant and staff_id = who and extract(year from date) = yr and by_employer = coalesce(p_employer, false);
  lim := case when p_employer then coalesce((st->'vacation'->>'flexEmployer')::int, 2) else coalesce((st->'vacation'->>'flexOwn')::int, 4) end;
  if cnt >= lim then raise exception 'flex_limit'; end if;
  insert into dp_flex (tenant_id, staff_id, date, by_employer, created_by) values (p_tenant, who, p_date, coalesce(p_employer, false), dp_actor_name(p_tenant))
  returning id into v;
  perform set_config('dp.source', 'flex', true);
  insert into dp_entries (tenant_id, staff_id, date, code, flex, updated_by) values (p_tenant, who, p_date, '', true, auth.uid())
  on conflict (tenant_id, staff_id, date) do update set flex = true, updated_at = now(), updated_by = auth.uid();
  perform set_config('dp.source', '', true);
  if p_employer then perform dp_notify_staff(p_tenant, who, 'flex', 'Flextag vom Arbeitgeber', to_char(p_date, 'DD.MM.YYYY'), '{}'); end if;
  return v;
end $$;

create or replace function dp_flex_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare f dp_flex;
begin
  select * into f from dp_flex where id = p_id;
  if f.id is null then raise exception 'not_found'; end if;
  if not can_plan(f.tenant_id) and (f.by_employer or f.staff_id is distinct from dp_my_staff(f.tenant_id)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from dp_flex where id = p_id;
  perform set_config('dp.source', 'flex', true);
  update dp_entries set flex = false where tenant_id = f.tenant_id and staff_id = f.staff_id and date = f.date;
  delete from dp_entries where tenant_id = f.tenant_id and staff_id = f.staff_id and date = f.date and code = '' and not flex;
  perform set_config('dp.source', '', true);
end $$;
grant execute on function dp_flex_add(uuid, date, text, boolean), dp_flex_delete(uuid) to authenticated;

-- Aufforderung an alle (z. B. Urlaubswünsche bis …)
create or replace function dp_notify_all(p_tenant uuid, p_title text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_plan(p_tenant) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into notifications (tenant_id, member_id, type, title, body, data)
  select p_tenant, m.id, 'dp_notice', left(p_title, 120), left(p_body, 500), '{}'::jsonb
  from members m where m.tenant_id = p_tenant and m.status = 'active';
end $$;
grant execute on function dp_notify_all(uuid, text, text) to authenticated;

-- Weitere Abteilung: auch im geschlossenen Betrieb für bestehende FK4/SL
create or replace function create_tenant(p_slug text, p_name text, p_display_name text, p_initials text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
  v_member uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not coalesce((select allow_new_tenants from app_config), true)
     and not exists (select 1 from members where user_id = auth.uid() and role = 'chef' and status = 'active') then
    raise exception 'closed' using errcode = '42501';
  end if;
  insert into tenants (slug, name) values (lower(p_slug), p_name) returning id into v_tenant;
  insert into members (tenant_id, user_id, display_name, initials, role, status)
    values (v_tenant, auth.uid(), p_display_name, upper(p_initials), 'chef', 'active')
    returning id into v_member;
  insert into member_contacts (member_id, tenant_id, email)
    select v_member, v_tenant, email from auth.users where id = auth.uid();
  return v_tenant;
end $$;
