-- Planungsprotokoll: wer hat wann welchen Dienst geändert (inkl. Tausch, Autodisposition, Turnus).
create table dp_audit (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  at timestamptz not null default now(),
  actor_member_id uuid,
  actor_name text not null default '',
  staff_id text,
  date date,
  old_code text,
  new_code text,
  source text not null default 'plan',
  text text not null default ''
);
create index dp_audit_tenant on dp_audit (tenant_id, at desc);
alter table dp_audit enable row level security;
create policy dp_audit_read on dp_audit for select using (can_plan(tenant_id));
grant select on dp_audit to authenticated;

create or replace function dp_actor_name(t uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select display_name from members where id = my_member_id(t)), 'System')
$$;

create or replace function dp_audit_entries() returns trigger
language plpgsql security definer set search_path = public as $$
declare t uuid := coalesce(new.tenant_id, old.tenant_id);
begin
  if tg_op = 'UPDATE' and old.code = new.code and old.flex = new.flex then return new; end if;
  insert into dp_audit (tenant_id, actor_member_id, actor_name, staff_id, date, old_code, new_code, source)
  values (t, my_member_id(t), dp_actor_name(t), coalesce(new.staff_id, old.staff_id), coalesce(new.date, old.date),
    case when tg_op <> 'INSERT' then old.code || case when old.flex then ' FLEX' else '' end end,
    case when tg_op <> 'DELETE' then new.code || case when new.flex then ' FLEX' else '' end end,
    coalesce(nullif(current_setting('dp.source', true), ''), 'plan'));
  return coalesce(new, old);
end $$;
create trigger dp_audit_entries after insert or update or delete on dp_entries for each row execute function dp_audit_entries();

create or replace function dp_audit_staff() returns trigger
language plpgsql security definer set search_path = public as $$
declare t uuid := coalesce(new.tenant_id, old.tenant_id); msg text;
begin
  if tg_op = 'INSERT' then msg := 'Person angelegt';
  elsif tg_op = 'DELETE' then msg := 'Person gelöscht: ' || coalesce(old.data->>'short', old.id);
  elsif coalesce((old.data->>'archived')::boolean, false) <> coalesce((new.data->>'archived')::boolean, false) then
    msg := case when coalesce((new.data->>'archived')::boolean, false) then 'Aus dem Team entfernt' else 'Wieder ins Team aufgenommen' end;
  elsif old.data->'rhythm' is distinct from new.data->'rhythm' then msg := 'Grundturnus geändert';
  elsif old.data->'overrides' is distinct from new.data->'overrides' then msg := 'Vorübergehender Turnus geändert';
  else return new;
  end if;
  insert into dp_audit (tenant_id, actor_member_id, actor_name, staff_id, source, text)
  values (t, my_member_id(t), dp_actor_name(t), case when tg_op = 'DELETE' then null else new.id end, 'person', msg);
  return coalesce(new, old);
end $$;
create trigger dp_audit_staff after insert or update or delete on dp_staff for each row execute function dp_audit_staff();

-- Tausch im Protokoll als solcher kennzeichnen
create or replace function dp_execute_swap(p_swap uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s dp_swaps;
begin
  select * into s from dp_swaps where id = p_swap for update;
  perform set_config('dp.source', 'tausch', true);
  perform dp_apply_ring(s.tenant_id, s.legs, true);
  perform set_config('dp.source', '', true);
  update dp_swaps set status = 'done' where id = p_swap;
end $$;
revoke execute on function dp_execute_swap(uuid) from public, anon, authenticated;

-- Mehrere Einträge auf einmal (Autodisposition), mit Quelle fürs Protokoll
create or replace function dp_set_entries(p_tenant uuid, p_entries jsonb, p_source text default 'plan') returns integer
language plpgsql security definer set search_path = public as $$
declare e jsonb; n int := 0;
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
  return n;
end $$;
grant execute on function dp_set_entries(uuid, jsonb, text) to authenticated;
