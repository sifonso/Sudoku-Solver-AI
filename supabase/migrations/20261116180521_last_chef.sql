-- Ein Betrieb behält immer mindestens einen aktiven Chef.
-- Verhindert, dass sich der letzte Chef herabstuft, sperrt oder archiviert.
-- Löschen des ganzen Betriebs (cascade) und delete-account (löscht vorher den Betrieb) bleiben möglich.
create or replace function keep_one_chef() returns trigger
language plpgsql as $$
begin
  if old.role = 'chef' and old.status = 'active'
     and (new.role <> 'chef' or new.status <> 'active')
     and not exists (
       select 1 from members m
       where m.tenant_id = old.tenant_id and m.id <> old.id and m.role = 'chef' and m.status = 'active'
     ) then
    raise exception 'last_chef' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger members_keep_one_chef before update of role, status on members
  for each row execute function keep_one_chef();
