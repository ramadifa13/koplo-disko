create index if not exists documents_active_created_idx
on public.documents(created_at desc)
where archived_at is null;

create or replace function public.add_document_version(
  p_document_id uuid,
  p_storage_path text,
  p_name text,
  p_mime_type text,
  p_size_bytes bigint
) returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  next_version integer;
begin
  if not public.is_management() then
    raise exception 'Akses ditolak';
  end if;
  if p_size_bytes not between 1 and 20971520 then
    raise exception 'Ukuran berkas tidak valid';
  end if;
  if p_mime_type not in (
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) then
    raise exception 'Tipe berkas tidak didukung';
  end if;

  perform 1 from public.documents where id=p_document_id for update;
  if not found then raise exception 'Dokumen tidak ditemukan'; end if;

  select coalesce(max(version),0)+1 into next_version
  from public.document_versions where document_id=p_document_id;

  insert into public.document_versions(
    document_id,storage_path,version,size_bytes,uploaded_by
  ) values (
    p_document_id,p_storage_path,next_version,p_size_bytes,auth.uid()
  );

  update public.documents set
    storage_path=p_storage_path,
    name=left(trim(p_name),160),
    mime_type=p_mime_type,
    size_bytes=p_size_bytes
  where id=p_document_id;

  return next_version;
end;
$$;

revoke all on function public.add_document_version(uuid,text,text,text,bigint) from public;
grant execute on function public.add_document_version(uuid,text,text,text,bigint) to authenticated;
