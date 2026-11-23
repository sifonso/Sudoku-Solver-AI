-- Geschlossener Betrieb, Jahresurlaubsplanung mit Freigabe durch FK3, Dokumente (Regeln, Betriebsvereinbarungen).

-- 1. Geschlossen: neue Betriebe nur, solange erlaubt (nach Einrichtung des eigenen Betriebs abschalten)
create table app_config (
  id boolean primary key default true check (id),
  allow_new_tenants boolean not null default true
);
insert into app_config default values;
alter table app_config enable row level security; -- kein Zugriff von außen, nur über Funktionen

create or replace function create_tenant(p_slug text, p_name text, p_display_name text, p_initials text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
  v_member uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not coalesce((select allow_new_tenants from app_config), true) then
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

-- 2. FK3: Freigabe der Jahresurlaubsplanung (Mitglieder in dp_settings.data.vacation.approvers)
create or replace function dp_is_fk3(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from dp_settings s, jsonb_array_elements_text(coalesce(s.data->'vacation'->'approvers', '[]'::jsonb)) a
    where s.tenant_id = t and a = my_member_id(t)::text)
$$;
-- Ohne eingetragene FK3 gibt FK4/SL selbst frei
create or replace function dp_can_release(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select dp_is_fk3(t) or (can_plan(t) and not exists (
    select 1 from dp_settings s where s.tenant_id = t and jsonb_array_length(coalesce(s.data->'vacation'->'approvers', '[]'::jsonb)) > 0))
$$;
grant execute on function dp_is_fk3(uuid), dp_can_release(uuid) to authenticated;

create or replace function dp_notify_fk3(t uuid, p_type text, p_title text, p_body text)
returns void language sql security definer set search_path = public as $$
  insert into notifications (tenant_id, member_id, type, title, body, data)
  select t, a::uuid, p_type, p_title, p_body, '{}'::jsonb
  from dp_settings s, jsonb_array_elements_text(coalesce(s.data->'vacation'->'approvers', '[]'::jsonb)) a
  where s.tenant_id = t
$$;
revoke execute on function dp_notify_fk3(uuid, text, text, text) from public, anon, authenticated;

create table dp_vacation (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  staff_id text not null,
  year int not null,
  date_from date not null,
  date_to date not null,
  priority int not null default 1 check (priority in (1, 2)),
  note text not null default '' check (length(note) <= 300),
  status text not null default 'wunsch' check (status in ('wunsch','vorgemerkt','abgelehnt','genehmigt')),
  reason text not null default '' check (length(reason) <= 300),
  fk4_name text, fk4_at timestamptz,
  fk3_name text, fk3_at timestamptz,
  created_at timestamptz not null default now(),
  check (date_to >= date_from and date_to - date_from <= 62),
  foreign key (tenant_id, staff_id) references dp_staff(tenant_id, id) on delete cascade
);
create index dp_vacation_year on dp_vacation (tenant_id, year);
alter table dp_vacation enable row level security;
-- Urlaub im Team ist für alle sichtbar (Abstimmung untereinander); Änderungen nur über die Funktionen
create policy dp_vacation_read on dp_vacation for select using (is_member(tenant_id));
grant select on dp_vacation to authenticated;

create or replace function dp_vac_wish(p_tenant uuid, p_from date, p_to date, p_priority int default 1, p_note text default '', p_staff text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me text := dp_my_staff(p_tenant); who text := coalesce(p_staff, me); v uuid;
begin
  if who is null or (who is distinct from me and not can_plan(p_tenant)) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_to < p_from then raise exception 'invalid_entry'; end if;
  insert into dp_vacation (tenant_id, staff_id, year, date_from, date_to, priority, note)
  values (p_tenant, who, extract(year from p_from)::int, p_from, p_to, coalesce(p_priority, 1), coalesce(p_note, ''))
  returning id into v;
  perform dp_notify_leads(p_tenant, 'vac_wish', 'Neuer Urlaubswunsch',
    coalesce((select data->>'short' from dp_staff where tenant_id = p_tenant and id = who), '') || ': ' || to_char(p_from, 'DD.MM.') || '–' || to_char(p_to, 'DD.MM.YYYY'), '{}');
  return v;
end $$;

create or replace function dp_vac_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v dp_vacation;
begin
  select * into v from dp_vacation where id = p_id;
  if v.id is null then raise exception 'not_found'; end if;
  if v.status = 'genehmigt' then
    if not (can_plan(v.tenant_id) or dp_is_fk3(v.tenant_id)) then raise exception 'forbidden' using errcode = '42501'; end if;
    -- eingetragene U-Tage wieder freigeben
    perform set_config('dp.source', 'urlaub', true);
    delete from dp_entries where tenant_id = v.tenant_id and staff_id = v.staff_id and date between v.date_from and v.date_to and code = 'U';
    perform set_config('dp.source', '', true);
  elsif v.staff_id is distinct from dp_my_staff(v.tenant_id) and not can_plan(v.tenant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from dp_vacation where id = p_id;
end $$;

-- FK4/SL: Wunsch vormerken oder ablehnen
create or replace function dp_vac_review(p_id uuid, p_ok boolean, p_reason text default '') returns void
language plpgsql security definer set search_path = public as $$
declare v dp_vacation;
begin
  select * into v from dp_vacation where id = p_id for update;
  if v.id is null then raise exception 'not_found'; end if;
  if not can_plan(v.tenant_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v.status not in ('wunsch', 'vorgemerkt') then raise exception 'already_decided'; end if;
  update dp_vacation set status = case when p_ok then 'vorgemerkt' else 'abgelehnt' end, reason = coalesce(p_reason, ''),
    fk4_name = dp_actor_name(v.tenant_id), fk4_at = now() where id = p_id;
  perform dp_notify_staff(v.tenant_id, v.staff_id, 'vac_review', case when p_ok then 'Urlaubswunsch vorgemerkt' else 'Urlaubswunsch abgelehnt' end,
    to_char(v.date_from, 'DD.MM.') || '–' || to_char(v.date_to, 'DD.MM.YYYY') || case when p_ok then ', wartet auf Freigabe' else '' end, '{}');
  if p_ok then perform dp_notify_fk3(v.tenant_id, 'vac_release', 'Urlaubsplanung zur Freigabe', 'Ein vorgemerkter Urlaub wartet auf dein OK.'); end if;
end $$;

-- FK3: Freigabe; genehmigter Urlaub wird an Diensttagen als U in den Plan geschrieben
create or replace function dp_vac_release(p_id uuid, p_ok boolean, p_reason text default '') returns void
language plpgsql security definer set search_path = public as $$
declare v dp_vacation; d date;
begin
  select * into v from dp_vacation where id = p_id for update;
  if v.id is null then raise exception 'not_found'; end if;
  if not dp_can_release(v.tenant_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v.status <> 'vorgemerkt' then raise exception 'already_decided'; end if;
  update dp_vacation set status = case when p_ok then 'genehmigt' else 'abgelehnt' end, reason = coalesce(p_reason, ''),
    fk3_name = dp_actor_name(v.tenant_id), fk3_at = now() where id = p_id;
  if p_ok then
    perform set_config('dp.source', 'urlaub', true);
    for d in select generate_series(v.date_from, v.date_to, interval '1 day')::date loop
      if dp_is_work(v.tenant_id, dp_effective(v.tenant_id, v.staff_id, d)) then perform dp_put(v.tenant_id, v.staff_id, d, 'U'); end if;
    end loop;
    perform set_config('dp.source', '', true);
  end if;
  perform dp_notify_staff(v.tenant_id, v.staff_id, 'vac_release', case when p_ok then 'Urlaub genehmigt' else 'Urlaub abgelehnt' end,
    to_char(v.date_from, 'DD.MM.') || '–' || to_char(v.date_to, 'DD.MM.YYYY'), '{}');
end $$;

grant execute on function dp_vac_wish(uuid, date, date, int, text, text), dp_vac_delete(uuid), dp_vac_review(uuid, boolean, text),
  dp_vac_release(uuid, boolean, text) to authenticated;

-- 3. Dokumente: Dienstplanregeln, Betriebsvereinbarungen, Sonstiges. Dateien im Storage-Bucket dp-docs (eigene Migration).
create table dp_docs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  category text not null default 'Sonstiges',
  note text not null default '' check (length(note) <= 4000),
  file_path text,
  file_name text,
  mime text,
  size int,
  valid_from date,
  uploaded_by uuid,
  uploaded_name text not null default '',
  uploaded_at timestamptz not null default now()
);
create index dp_docs_tenant on dp_docs (tenant_id, category, uploaded_at desc);
alter table dp_docs enable row level security;
create policy dp_docs_read on dp_docs for select using (is_member(tenant_id));
create policy dp_docs_write on dp_docs for insert with check ((can_plan(tenant_id) or dp_is_fk3(tenant_id)) and uploaded_by = my_member_id(tenant_id));
create policy dp_docs_delete on dp_docs for delete using (can_plan(tenant_id) or dp_is_fk3(tenant_id));
grant select, insert, delete on dp_docs to authenticated;

-- Planungsprotokoll kennt die Quelle „urlaub“ (keine Mitteilung je Tag, die kommt gesammelt)
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
