-- Dienstplan nach Excel-Muster: Personen mit 16-Wochen-Grundrhythmus, Einträge je Tag
-- („T1/F“, „U“, …), Einstellungen der FK4/SL und Tauschbörse.

create table dp_settings (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table dp_staff (
  tenant_id uuid not null references tenants(id) on delete cascade,
  id text not null,
  member_id uuid references members(id) on delete set null,
  sort int not null default 0,
  -- short, firstName, lastName, nr, inPlan, isLead, teamLeadId, rhythm[], quals{}, phonePrivate, phoneMobile, whatsapp
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);
create unique index dp_staff_member on dp_staff (tenant_id, member_id) where member_id is not null;

-- Personalnummer nur für FK4/SL und Planer
create table dp_staff_private (
  tenant_id uuid not null,
  staff_id text not null,
  pers_nr text not null default '',
  primary key (tenant_id, staff_id),
  foreign key (tenant_id, staff_id) references dp_staff(tenant_id, id) on delete cascade
);

create table dp_entries (
  tenant_id uuid not null,
  staff_id text not null,
  date date not null,
  code text not null default '' check (length(code) <= 12),
  flex boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (tenant_id, staff_id, date),
  foreign key (tenant_id, staff_id) references dp_staff(tenant_id, id) on delete cascade
);
create index dp_entries_date on dp_entries (tenant_id, date);

create table dp_carpools (
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  members text[] not null default '{}',
  primary key (tenant_id, name)
);

create table dp_swaps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  staff_id text not null,
  date date not null,
  code text not null,
  note text not null default '' check (length(note) <= 300),
  status text not null default 'open' check (status in ('open','pending','done','rejected','cancelled')),
  accepted_request uuid,
  decided_by text,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, staff_id) references dp_staff(tenant_id, id) on delete cascade
);
create index dp_swaps_tenant on dp_swaps (tenant_id, created_at desc);

create table dp_swap_requests (
  id uuid primary key default gen_random_uuid(),
  swap_id uuid not null references dp_swaps(id) on delete cascade,
  tenant_id uuid not null,
  staff_id text not null,
  return_date date,
  at timestamptz not null default now(),
  unique (swap_id, staff_id),
  foreign key (tenant_id, staff_id) references dp_staff(tenant_id, id) on delete cascade
);

alter table dp_settings enable row level security;
alter table dp_staff enable row level security;
alter table dp_staff_private enable row level security;
alter table dp_entries enable row level security;
alter table dp_carpools enable row level security;
alter table dp_swaps enable row level security;
alter table dp_swap_requests enable row level security;

create policy dp_settings_read on dp_settings for select using (is_member(tenant_id));
create policy dp_settings_write on dp_settings for all using (can_plan(tenant_id)) with check (can_plan(tenant_id));
create policy dp_staff_read on dp_staff for select using (is_member(tenant_id));
create policy dp_staff_write on dp_staff for all using (can_plan(tenant_id)) with check (can_plan(tenant_id));
create policy dp_private_rw on dp_staff_private for all using (can_plan(tenant_id)) with check (can_plan(tenant_id));
create policy dp_entries_read on dp_entries for select using (is_member(tenant_id));
create policy dp_entries_write on dp_entries for all using (can_plan(tenant_id)) with check (can_plan(tenant_id));
create policy dp_carpools_read on dp_carpools for select using (is_member(tenant_id));
create policy dp_carpools_write on dp_carpools for all using (can_plan(tenant_id)) with check (can_plan(tenant_id));
-- Tauschbörse: lesen alle im Betrieb, schreiben nur über die Funktionen unten
create policy dp_swaps_read on dp_swaps for select using (is_member(tenant_id));
create policy dp_swap_requests_read on dp_swap_requests for select using (is_member(tenant_id));

grant select, insert, update, delete on dp_settings, dp_staff, dp_staff_private, dp_entries, dp_carpools to authenticated;
grant select on dp_swaps, dp_swap_requests to authenticated;

create or replace function dp_my_staff(t uuid) returns text
language sql stable security definer set search_path = public as $$
  select s.id from dp_staff s where s.tenant_id = t and s.member_id = my_member_id(t)
$$;

-- Angezeigter Dienst: Eintrag, sonst Grundrhythmus
create or replace function dp_effective(t uuid, p_staff text, p_date date) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(e.code, '') from dp_entries e where e.tenant_id = t and e.staff_id = p_staff and e.date = p_date),
    (select s.data->'rhythm'->>(
        (((p_date - coalesce((st.data->>'rhythmStart')::date, date '2027-01-04'))
          % coalesce((st.data->>'rhythmLength')::int, 112))
          + coalesce((st.data->>'rhythmLength')::int, 112))
          % coalesce((st.data->>'rhythmLength')::int, 112))
     from dp_staff s left join dp_settings st on st.tenant_id = s.tenant_id
     where s.tenant_id = t and s.id = p_staff),
    '')
$$;

-- Dienst = kein Status-Kürzel und Schichtgruppe F/M/S/N (nach optionalem „Arbeitsplatz/“)
create or replace function dp_is_work(t uuid, p_code text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_code, '') <> ''
    and not exists (
      select 1 from dp_settings st, jsonb_array_elements(coalesce(st.data->'codes', '[]'::jsonb)) c
      where st.tenant_id = t and upper(c->>'code') = upper(p_code))
    and p_code not in ('U','UG','Z','ZG','T','K','KID','W','WS','BR','A','DT','D','CO','ZD')
    and left(case when position('/' in p_code) between 2 and 4 then substr(p_code, position('/' in p_code) + 1) else p_code end, 1)
        in ('F','M','S','N')
$$;

create or replace function dp_put(t uuid, p_staff text, p_date date, p_code text) returns void
language sql security definer set search_path = public as $$
  insert into dp_entries (tenant_id, staff_id, date, code, flex, updated_by)
  values (t, p_staff, p_date, p_code, false, auth.uid())
  on conflict (tenant_id, staff_id, date) do update set code = excluded.code, flex = false, updated_at = now(), updated_by = auth.uid()
$$;

create or replace function dp_offer_swap(p_tenant uuid, p_date date, p_note text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare me text := dp_my_staff(p_tenant); c text; v uuid;
begin
  if me is null then raise exception 'forbidden' using errcode = '42501'; end if;
  c := dp_effective(p_tenant, me, p_date);
  if not dp_is_work(p_tenant, c) then raise exception 'invalid_entry'; end if;
  if exists (select 1 from dp_swaps where tenant_id = p_tenant and staff_id = me and date = p_date and status in ('open','pending')) then
    raise exception 'invalid_entry';
  end if;
  insert into dp_swaps (tenant_id, staff_id, date, code, note) values (p_tenant, me, p_date, c, coalesce(p_note, '')) returning id into v;
  return v;
end $$;

create or replace function dp_request_swap(p_swap uuid, p_return_date date default null) returns void
language plpgsql security definer set search_path = public as $$
declare s dp_swaps; me text;
begin
  select * into s from dp_swaps where id = p_swap;
  if s.id is null then raise exception 'not_found'; end if;
  me := dp_my_staff(s.tenant_id);
  if me is null or me = s.staff_id then raise exception 'forbidden' using errcode = '42501'; end if;
  if s.status <> 'open' then raise exception 'swap_not_open'; end if;
  insert into dp_swap_requests (swap_id, tenant_id, staff_id, return_date) values (p_swap, s.tenant_id, me, p_return_date)
  on conflict (swap_id, staff_id) do update set return_date = excluded.return_date, at = now();
end $$;

create or replace function dp_withdraw_request(p_swap uuid) returns void
language sql security definer set search_path = public as $$
  delete from dp_swap_requests r using dp_swaps s
  where r.swap_id = p_swap and s.id = p_swap and s.status = 'open' and r.staff_id = dp_my_staff(s.tenant_id)
$$;

create or replace function dp_execute_swap(p_swap uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s dp_swaps; r dp_swap_requests; a_code text; b_code text;
begin
  select * into s from dp_swaps where id = p_swap for update;
  select * into r from dp_swap_requests where id = s.accepted_request;
  if r.id is null then raise exception 'not_found'; end if;
  a_code := dp_effective(s.tenant_id, s.staff_id, s.date);
  if not dp_is_work(s.tenant_id, a_code) then raise exception 'swap_not_open'; end if;
  if dp_is_work(s.tenant_id, dp_effective(s.tenant_id, r.staff_id, s.date)) then raise exception 'no_double_booking'; end if;
  if r.return_date is not null then
    b_code := dp_effective(s.tenant_id, r.staff_id, r.return_date);
    if not dp_is_work(s.tenant_id, b_code) then raise exception 'swap_not_open'; end if;
    if dp_is_work(s.tenant_id, dp_effective(s.tenant_id, s.staff_id, r.return_date)) then raise exception 'no_double_booking'; end if;
  end if;
  perform dp_put(s.tenant_id, r.staff_id, s.date, a_code);
  perform dp_put(s.tenant_id, s.staff_id, s.date, 'DT');
  if r.return_date is not null then
    perform dp_put(s.tenant_id, s.staff_id, r.return_date, b_code);
    perform dp_put(s.tenant_id, r.staff_id, r.return_date, 'DT');
  end if;
  update dp_swaps set status = 'done' where id = p_swap;
end $$;
revoke execute on function dp_execute_swap(uuid) from public, anon, authenticated;
revoke execute on function dp_put(uuid, text, date, text) from public, anon, authenticated;

create or replace function dp_accept_request(p_swap uuid, p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s dp_swaps; needs boolean;
begin
  select * into s from dp_swaps where id = p_swap for update;
  if s.id is null then raise exception 'not_found'; end if;
  if s.staff_id is distinct from dp_my_staff(s.tenant_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if s.status <> 'open' then raise exception 'swap_not_open'; end if;
  if not exists (select 1 from dp_swap_requests where id = p_request and swap_id = p_swap) then raise exception 'not_an_applicant'; end if;
  update dp_swaps set accepted_request = p_request where id = p_swap;
  select coalesce((data->>'swapApproval')::boolean, true) into needs from dp_settings where tenant_id = s.tenant_id;
  if coalesce(needs, true) then
    update dp_swaps set status = 'pending' where id = p_swap;
  else
    perform dp_execute_swap(p_swap);
  end if;
end $$;

create or replace function dp_decide_swap(p_swap uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare s dp_swaps;
begin
  select * into s from dp_swaps where id = p_swap for update;
  if s.id is null then raise exception 'not_found'; end if;
  if not can_plan(s.tenant_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if s.status <> 'pending' then raise exception 'already_decided'; end if;
  update dp_swaps set decided_by = dp_my_staff(s.tenant_id) where id = p_swap;
  if p_approve then perform dp_execute_swap(p_swap);
  else update dp_swaps set status = 'rejected' where id = p_swap; end if;
end $$;

create or replace function dp_cancel_swap(p_swap uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s dp_swaps;
begin
  select * into s from dp_swaps where id = p_swap for update;
  if s.id is null then raise exception 'not_found'; end if;
  if s.staff_id is distinct from dp_my_staff(s.tenant_id) and not can_plan(s.tenant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if s.status in ('done','rejected','cancelled') then raise exception 'already_decided'; end if;
  update dp_swaps set status = 'cancelled' where id = p_swap;
end $$;

grant execute on function dp_my_staff(uuid), dp_effective(uuid, text, date), dp_is_work(uuid, text),
  dp_offer_swap(uuid, date, text), dp_request_swap(uuid, date), dp_withdraw_request(uuid),
  dp_accept_request(uuid, uuid), dp_decide_swap(uuid, boolean), dp_cancel_swap(uuid) to authenticated;
