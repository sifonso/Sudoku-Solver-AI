-- Warnungen für alle zuweisbaren Personen einer Schicht in einem Aufruf (S05).
-- Vorher eine Anfrage pro Person; bei 40 Personen 40 Netzwerk-Rundreisen.
create or replace function check_assignments(p_shift_id uuid)
returns table (member_id uuid, warnings jsonb)
language plpgsql stable security definer set search_path = public as $$
declare
  s shifts;
begin
  select * into s from shifts where id = p_shift_id;
  if s.id is null or not can_plan(s.tenant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select m.id, check_assignment(p_shift_id, m.id)
    from members m
    where m.tenant_id = s.tenant_id and m.status in ('active', 'invited')
      and not exists (select 1 from assignments a where a.shift_id = p_shift_id and a.member_id = m.id);
end $$;

revoke execute on function check_assignments(uuid) from public, anon;
grant execute on function check_assignments(uuid) to authenticated;
