drop policy if exists private_documents_select on storage.objects;
create policy private_documents_select on storage.objects for select to authenticated using(
  bucket_id='private-documents' and (
    exists(select 1 from public.documents d where d.storage_path=name and (public.is_management() or d.owner_member_id=auth.uid() or (not d.is_financial and exists(select 1 from public.event_assignments ea where ea.event_id=d.event_id and ea.member_id=auth.uid()))))
    or exists(select 1 from public.document_versions dv join public.documents d on d.id=dv.document_id where dv.storage_path=name and (public.is_management() or d.owner_member_id=auth.uid() or (not d.is_financial and exists(select 1 from public.event_assignments ea where ea.event_id=d.event_id and ea.member_id=auth.uid()))))
  )
);
