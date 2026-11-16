-- Beitreten mit Einladungscode (statt Einladungs-Mail). Der Chef gibt den Code weiter (Messenger, persönlich).
-- Der Code wird nur als SHA-256 gespeichert (invitations.token_hash); 8 Zeichen aus 31 Symbolen.
create or replace function claim_invitation_code(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv record;
  v_hash text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  v_hash := encode(sha256(convert_to(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'UTF8')), 'hex');
  select i.id, i.tenant_id, i.member_id into inv
    from invitations i join members m on m.id = i.member_id
    where i.token_hash = v_hash and i.accepted_at is null and i.expires_at > now()
      and m.user_id is null and m.status = 'invited'
    for update of i;
  if inv.id is null then
    raise exception 'invalid_code' using errcode = 'P0001';
  end if;
  if exists (select 1 from members where tenant_id = inv.tenant_id and user_id = auth.uid()) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;
  update members set user_id = auth.uid(), status = 'active' where id = inv.member_id;
  update invitations set accepted_at = now() where id = inv.id;
  insert into member_contacts (member_id, tenant_id, email)
    select inv.member_id, inv.tenant_id, email from auth.users where id = auth.uid()
    on conflict (member_id) do update set email = excluded.email;
  return inv.tenant_id;
end $$;

revoke execute on function claim_invitation_code(text) from public, anon;
grant execute on function claim_invitation_code(text) to authenticated;
