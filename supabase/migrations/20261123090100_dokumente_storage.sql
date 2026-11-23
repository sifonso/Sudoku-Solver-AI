-- Privater Storage-Bucket für Dokumente. Pfad: <tenant_id>/<datei>. Lesen alle im Betrieb, hochladen/löschen FK4/SL und FK3.
insert into storage.buckets (id, name, public, file_size_limit)
values ('dp-docs', 'dp-docs', false, 20971520)
on conflict (id) do nothing;

create policy dp_docs_obj_read on storage.objects for select to authenticated
  using (bucket_id = 'dp-docs' and is_member(((storage.foldername(name))[1])::uuid));
create policy dp_docs_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'dp-docs' and (can_plan(((storage.foldername(name))[1])::uuid) or dp_is_fk3(((storage.foldername(name))[1])::uuid)));
create policy dp_docs_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'dp-docs' and (can_plan(((storage.foldername(name))[1])::uuid) or dp_is_fk3(((storage.foldername(name))[1])::uuid)));
