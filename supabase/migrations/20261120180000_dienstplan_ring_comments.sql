-- Ringtausch (1:1 auch am selben Tag, Dreieckstausch), Angebote durch FK4/SL,
-- Kommentare/Markierungen je Tag und vorübergehender Turnus (staff.data.overrides).

alter table dp_swaps
  add column kind text not null default 'offer' check (kind in ('offer','direct')),
  add column legs jsonb not null default '[]'::jsonb,
  add column accepted text[] not null default '{}',
  add column created_by_lead boolean not null default false,
  add column created_by_name text not null default '';
update dp_swaps set legs = jsonb_build_array(jsonb_build_object('staffId', staff_id, 'date', date, 'code', code)) where legs = '[]'::jsonb;
alter table dp_swaps alter column date drop not null;

create table dp_comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  staff_id text not null,
  date date not null,
  text text not null default '' check (length(text) <= 1000),
  mark text not null default '' check (length(mark) <= 9),
  author_member_id uuid not null references members(id) on delete cascade,
  author_name text not null default '',
  author_is_lead boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  foreign key (tenant_id, staff_id) references dp_staff(tenant_id, id) on delete cascade
);
create index dp_comments_day on dp_comments (tenant_id, date);
alter table dp_comments enable row level security;
create policy dp_comments_read on dp_comments for select using (is_member(tenant_id));
create policy dp_comments_insert on dp_comments for insert with check (
  is_member(tenant_id) and author_member_id = my_member_id(tenant_id) and author_is_lead = can_plan(tenant_id));
create policy dp_comments_change on dp_comments for update using (
  author_member_id = my_member_id(tenant_id) or (author_is_lead and can_plan(tenant_id)));
create policy dp_comments_delete on dp_comments for delete using (
  author_member_id = my_member_id(tenant_id) or (author_is_lead and can_plan(tenant_id)));
grant select, insert, update, delete on dp_comments to authenticated;

-- Verfasser bleibt beim Bearbeiten unverändert
create or replace function dp_comment_keep_author() returns trigger language plpgsql as $$
begin
  new.tenant_id := old.tenant_id; new.staff_id := old.staff_id; new.date := old.date;
  new.author_member_id := old.author_member_id; new.author_name := old.author_name;
  new.author_is_lead := old.author_is_lead; new.created_at := old.created_at; new.updated_at := now();
  return new;
end $$;
create trigger dp_comment_keep_author before update on dp_comments for each row execute function dp_comment_keep_author();

-- Grundschicht mit vorübergehendem Turnus: follow = Dienst einer anderen Person, shift = um Wochen verschoben, none = kein Turnus
create or replace function dp_effective_d(t uuid, p_staff text, p_date date, depth int) returns text
language plpgsql stable security definer set search_path = public as $$
declare s jsonb; st jsonb; len int; idx int; ov jsonb; e text;
begin
  select nullif(code, '') into e from dp_entries where tenant_id = t and staff_id = p_staff and date = p_date;
  if e is not null then return e; end if;
  select data into s from dp_staff where tenant_id = t and id = p_staff;
  if s is null then return ''; end if;
  select data into st from dp_settings where tenant_id = t;
  len := coalesce((st->>'rhythmLength')::int, 112);
  idx := (((p_date - coalesce((st->>'rhythmStart')::date, date '2027-01-04')) % len) + len) % len;
  select o into ov from jsonb_array_elements(coalesce(s->'overrides', '[]'::jsonb)) o
    where (o->>'from')::date <= p_date and p_date <= (o->>'to')::date limit 1;
  if ov is null then return coalesce(s->'rhythm'->>idx, ''); end if;
  if ov->>'kind' = 'none' then return ''; end if;
  if ov->>'kind' = 'shift' then
    return coalesce(s->'rhythm'->>((((idx + coalesce((ov->>'weeks')::int, 0) * 7) % len) + len) % len), '');
  end if;
  if depth > 0 or ov->>'followId' is null then return ''; end if;
  return dp_effective_d(t, ov->>'followId', p_date, depth + 1);
end $$;

create or replace function dp_effective(t uuid, p_staff text, p_date date) returns text
language sql stable security definer set search_path = public as $$ select dp_effective_d(t, p_staff, p_date, 0) $$;

-- Ring prüfen und vollziehen: Dienst von Glied i geht an Glied i+1
create or replace function dp_apply_ring(t uuid, p_legs jsonb, p_write boolean) returns void
language plpgsql security definer set search_path = public as $$
declare n int := jsonb_array_length(p_legs); i int; leg jsonb; nxt jsonb; d date; c text; recv text;
  r_staff text[] := '{}'; r_date date[] := '{}'; r_code text[] := '{}';
begin
  if n < 2 then raise exception 'invalid_entry'; end if;
  if (select count(distinct x->>'staffId') from jsonb_array_elements(p_legs) x) <> n then raise exception 'invalid_entry'; end if;
  for i in 0 .. n - 1 loop
    leg := p_legs->i;
    if leg->>'date' is null then continue; end if;
    d := (leg->>'date')::date;
    c := dp_effective(t, leg->>'staffId', d);
    if not dp_is_work(t, c) then raise exception 'swap_not_open'; end if;
    nxt := p_legs->((i + 1) % n);
    recv := nxt->>'staffId';
    if dp_is_work(t, dp_effective(t, recv, d)) and not exists (
      select 1 from jsonb_array_elements(p_legs) x where x->>'staffId' = recv and x->>'date' = leg->>'date') then
      raise exception 'no_double_booking';
    end if;
    r_staff := r_staff || recv; r_date := r_date || d; r_code := r_code || c;
  end loop;
  if array_length(r_staff, 1) is null then raise exception 'invalid_entry'; end if;
  if not p_write then return; end if;
  for i in 1 .. array_length(r_staff, 1) loop
    perform dp_put(t, r_staff[i], r_date[i], r_code[i]);
  end loop;
  for leg in select x from jsonb_array_elements(p_legs) x where x->>'date' is not null loop
    if not exists (select 1 from unnest(r_staff, r_date) as u(s, dd) where u.s = leg->>'staffId' and u.dd = (leg->>'date')::date) then
      perform dp_put(t, leg->>'staffId', (leg->>'date')::date, 'DT');
    end if;
  end loop;
end $$;
revoke execute on function dp_apply_ring(uuid, jsonb, boolean) from public, anon, authenticated;

create or replace function dp_execute_swap(p_swap uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s dp_swaps;
begin
  select * into s from dp_swaps where id = p_swap for update;
  perform dp_apply_ring(s.tenant_id, s.legs, true);
  update dp_swaps set status = 'done' where id = p_swap;
end $$;
revoke execute on function dp_execute_swap(uuid) from public, anon, authenticated;

-- Angebot: eigene Person, FK4/SL auch für andere
drop function if exists dp_offer_swap(uuid, date, text);
create or replace function dp_offer_swap(p_tenant uuid, p_date date, p_note text default '', p_staff text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare me text := dp_my_staff(p_tenant); who text := coalesce(p_staff, me); c text; v uuid; lead boolean := can_plan(p_tenant);
begin
  if who is null or (who is distinct from me and not lead) then raise exception 'forbidden' using errcode = '42501'; end if;
  c := dp_effective(p_tenant, who, p_date);
  if not dp_is_work(p_tenant, c) then raise exception 'invalid_entry'; end if;
  if exists (select 1 from dp_swaps where tenant_id = p_tenant and kind = 'offer' and staff_id = who and date = p_date and status in ('open','pending')) then
    raise exception 'invalid_entry';
  end if;
  insert into dp_swaps (tenant_id, staff_id, date, code, note, kind, legs, created_by_lead, created_by_name)
  values (p_tenant, who, p_date, c, coalesce(p_note, ''), 'offer',
    jsonb_build_array(jsonb_build_object('staffId', who, 'date', p_date, 'code', c)), lead,
    coalesce((select display_name from members where id = my_member_id(p_tenant)), ''))
  returning id into v;
  return v;
end $$;

-- Vollständiger Vorschlag: [{staffId, date|null}, …]
create or replace function dp_propose_swap(p_tenant uuid, p_legs jsonb, p_note text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare me text := dp_my_staff(p_tenant); lead boolean := can_plan(p_tenant); v_legs jsonb; v uuid; v_first jsonb;
begin
  if not is_member(p_tenant) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not lead and not exists (select 1 from jsonb_array_elements(p_legs) x where x->>'staffId' = me) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select jsonb_agg(jsonb_build_object('staffId', x->>'staffId', 'date', x->'date',
           'code', case when x->>'date' is null then '' else dp_effective(p_tenant, x->>'staffId', (x->>'date')::date) end) order by o)
    into v_legs from jsonb_array_elements(p_legs) with ordinality as a(x, o);
  perform dp_apply_ring(p_tenant, v_legs, false);
  v_first := v_legs->0;
  insert into dp_swaps (tenant_id, staff_id, date, code, note, kind, legs, accepted, created_by_lead, created_by_name)
  values (p_tenant, v_first->>'staffId', (v_first->>'date')::date, v_first->>'code', coalesce(p_note, ''), 'direct', v_legs,
    case when me is not null and exists (select 1 from jsonb_array_elements(v_legs) x where x->>'staffId' = me) then array[me] else '{}' end,
    lead, coalesce((select display_name from members where id = my_member_id(p_tenant)), ''))
  returning id into v;
  return v;
end $$;

create or replace function dp_respond_proposal(p_swap uuid, p_agree boolean) returns void
language plpgsql security definer set search_path = public as $$
declare s dp_swaps; me text; needs boolean;
begin
  select * into s from dp_swaps where id = p_swap for update;
  if s.id is null then raise exception 'not_found'; end if;
  me := dp_my_staff(s.tenant_id);
  if s.kind <> 'direct' or s.status <> 'open' then raise exception 'swap_not_open'; end if;
  if me is null or not exists (select 1 from jsonb_array_elements(s.legs) x where x->>'staffId' = me) then raise exception 'not_an_applicant'; end if;
  if not p_agree then update dp_swaps set status = 'rejected' where id = p_swap; return; end if;
  update dp_swaps set accepted = array(select distinct unnest(accepted || me)) where id = p_swap returning * into s;
  if (select bool_and(x->>'staffId' = any (s.accepted)) from jsonb_array_elements(s.legs) x) then
    select coalesce((data->>'swapApproval')::boolean, true) into needs from dp_settings where tenant_id = s.tenant_id;
    if coalesce(needs, true) and not s.created_by_lead then
      perform dp_apply_ring(s.tenant_id, s.legs, false);
      update dp_swaps set status = 'pending' where id = p_swap;
    else
      perform dp_execute_swap(p_swap);
    end if;
  end if;
end $$;

-- Anfrage auf ein Angebot; Gegendienst am selben Tag erlaubt
create or replace function dp_request_swap(p_swap uuid, p_return_date date default null) returns void
language plpgsql security definer set search_path = public as $$
declare s dp_swaps; me text;
begin
  select * into s from dp_swaps where id = p_swap;
  if s.id is null then raise exception 'not_found'; end if;
  me := dp_my_staff(s.tenant_id);
  if me is null or me = s.staff_id then raise exception 'forbidden' using errcode = '42501'; end if;
  if s.status <> 'open' or s.kind <> 'offer' then raise exception 'swap_not_open'; end if;
  perform dp_apply_ring(s.tenant_id, jsonb_build_array(s.legs->0, jsonb_build_object('staffId', me, 'date', p_return_date)), false);
  insert into dp_swap_requests (swap_id, tenant_id, staff_id, return_date) values (p_swap, s.tenant_id, me, p_return_date)
  on conflict (swap_id, staff_id) do update set return_date = excluded.return_date, at = now();
end $$;

create or replace function dp_accept_request(p_swap uuid, p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s dp_swaps; r dp_swap_requests; needs boolean; lead boolean; v_legs jsonb;
begin
  select * into s from dp_swaps where id = p_swap for update;
  if s.id is null then raise exception 'not_found'; end if;
  lead := can_plan(s.tenant_id);
  if s.staff_id is distinct from dp_my_staff(s.tenant_id) and not lead then raise exception 'forbidden' using errcode = '42501'; end if;
  if s.status <> 'open' then raise exception 'swap_not_open'; end if;
  select * into r from dp_swap_requests where id = p_request and swap_id = p_swap;
  if r.id is null then raise exception 'not_an_applicant'; end if;
  v_legs := jsonb_build_array(s.legs->0, jsonb_build_object('staffId', r.staff_id, 'date', r.return_date,
    'code', case when r.return_date is null then '' else dp_effective(s.tenant_id, r.staff_id, r.return_date) end));
  perform dp_apply_ring(s.tenant_id, v_legs, false);
  update dp_swaps set accepted_request = p_request, legs = v_legs where id = p_swap;
  select coalesce((data->>'swapApproval')::boolean, true) into needs from dp_settings where tenant_id = s.tenant_id;
  if coalesce(needs, true) and not lead and not s.created_by_lead then
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
  update dp_swaps set decided_by = coalesce((select display_name from members where id = my_member_id(s.tenant_id)), '') where id = p_swap;
  if p_approve then perform dp_execute_swap(p_swap);
  else update dp_swaps set status = 'rejected' where id = p_swap; end if;
end $$;

create or replace function dp_cancel_swap(p_swap uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s dp_swaps; me text;
begin
  select * into s from dp_swaps where id = p_swap for update;
  if s.id is null then raise exception 'not_found'; end if;
  me := dp_my_staff(s.tenant_id);
  if not can_plan(s.tenant_id) and s.staff_id is distinct from me
     and not (s.kind = 'direct' and exists (select 1 from jsonb_array_elements(s.legs) x where x->>'staffId' = me)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if s.status in ('done','rejected','cancelled') then raise exception 'already_decided'; end if;
  update dp_swaps set status = 'cancelled' where id = p_swap;
end $$;

grant execute on function dp_effective_d(uuid, text, date, int), dp_offer_swap(uuid, date, text, text),
  dp_propose_swap(uuid, jsonb, text), dp_respond_proposal(uuid, boolean) to authenticated;
