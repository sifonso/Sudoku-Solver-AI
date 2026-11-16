-- Sonderaufgabe für eine Zuweisung: die eingeteilte Person bekommt eine Mitteilung (nicht, wenn sie sie selbst anlegt).
create or replace function notify_special_task() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_member uuid;
begin
  if new.kind <> 'special' or new.assignment_id is null then
    return null;
  end if;
  select member_id into v_member from assignments where id = new.assignment_id;
  if v_member is null or v_member is not distinct from my_member_id(new.tenant_id) then
    return null;
  end if;
  insert into notifications (tenant_id, member_id, type, title, body, data)
    values (new.tenant_id, v_member, 'task_new', 'Neue Aufgabe', new.title, jsonb_build_object('task_id', new.id));
  return null;
end $$;

create trigger tasks_notify_special after insert on tasks
  for each row execute function notify_special_task();
