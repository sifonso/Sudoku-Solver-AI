-- Registrierung, Einladungen, Ausführungsrechte.

-- Firmenadresse frei? Vor dem Login aufrufbar (Registrierungsformular).
create or replace function slug_available(p_slug text) returns boolean
language sql stable security definer set search_path = public as $$
  select lower(p_slug) ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
     and not exists (select 1 from tenants where slug = lower(p_slug))
$$;

-- Einladungen einlösen: Mitglieder, deren Einladung an die bestätigte E-Mail des Aufrufers ging,
-- werden mit dem Konto verknüpft und aktiv. Läuft bei jeder Anmeldung ohne Mitgliedschaft.
create or replace function claim_invitations() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_confirmed timestamptz;
  v_count int := 0;
  inv record;
begin
  select email, email_confirmed_at into v_email, v_confirmed from auth.users where id = auth.uid();
  if v_email is null or v_confirmed is null then
    return 0;
  end if;
  for inv in
    select i.id, i.member_id from invitations i
    join members m on m.id = i.member_id
    where lower(i.email) = lower(v_email) and i.accepted_at is null and i.expires_at > now()
      and m.user_id is null and m.status = 'invited'
    for update of i
  loop
    update members set user_id = auth.uid(), status = 'active' where id = inv.member_id;
    update invitations set accepted_at = now() where id = inv.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Postgres erlaubt PUBLIC standardmäßig, jede Funktion auszuführen. Hier enger:
-- nur angemeldete Nutzer, außer slug_available. Trigger-Funktionen brauchen kein EXECUTE-Recht.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  has_role(uuid, text[]), is_member(uuid), my_member_id(uuid), can_plan(uuid),
  shift_bounds(date, time, time, text), ensure_shift(uuid, date),
  check_assignment(uuid, uuid, timestamptz, timestamptz), create_tenant(text, text, text, text),
  report_sick(uuid, date, date), request_vacation(uuid, date, date, text), decide_absence(uuid, boolean),
  offer_swap(uuid), apply_swap(uuid), decide_swap(uuid, uuid, boolean),
  complete_task(uuid, uuid, uuid, timestamptz), stats_month(uuid, date), claim_invitations()
  to authenticated;
grant execute on function slug_available(text) to anon, authenticated;
