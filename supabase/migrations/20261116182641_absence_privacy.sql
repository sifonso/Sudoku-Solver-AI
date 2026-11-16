-- Krankmeldungen sind Gesundheitsdaten (Art. 9 DSGVO). Mitteilungen werden als Push über Expo/Apple/Google
-- zugestellt, deshalb ohne Grund und ohne Namen. Details sehen Planer erst in der App (RLS auf absences).
create or replace function report_sick(p_tenant uuid, p_start date, p_end date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_member uuid := my_member_id(p_tenant);
  v_id uuid;
begin
  if v_member is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(p_end, p_start) < p_start then
    raise exception 'invalid_range' using errcode = 'P0001';
  end if;
  insert into absences (tenant_id, member_id, kind, start_date, end_date, status)
    values (p_tenant, v_member, 'sick', p_start, coalesce(p_end, p_start), 'approved')
    returning id into v_id;
  insert into notifications (tenant_id, member_id, type, title, body, data)
    select p_tenant, m.id, 'absence_new', 'Neue Abwesenheit', 'Bitte den Plan prüfen.', jsonb_build_object('absence_id', v_id)
    from members m where m.tenant_id = p_tenant and m.status = 'active' and m.role in ('chef','planer') and m.id <> v_member;
  return v_id;
end $$;

-- Urlaubsanspruch und Arbeitstage für die Resturlaubsanzeige lesen dürfen alle Mitglieder ohnehin
-- (members/tenants select). Antrag zurückziehen: nur eigener, noch offener Antrag.
create or replace function cancel_absence(p_absence_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a absences;
begin
  select * into a from absences where id = p_absence_id for update;
  if a.id is null or a.member_id is distinct from my_member_id(a.tenant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if a.status <> 'requested' then
    raise exception 'already_decided' using errcode = 'P0001';
  end if;
  update absences set status = 'cancelled' where id = a.id;
end $$;

grant execute on function report_sick(uuid, date, date), cancel_absence(uuid) to authenticated;
revoke execute on function cancel_absence(uuid) from public, anon;
