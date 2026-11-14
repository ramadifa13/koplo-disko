create or replace function public.set_event_booking_source(
  p_event_id uuid,
  p_source text,
  p_member_id uuid default null
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_external_id constant uuid := 'e0000000-0000-4000-8000-000000000001'::uuid;
begin
  if not public.is_management() then raise exception 'Akses ditolak' using errcode='42501'; end if;
  if p_source not in ('direct','internal','external') then raise exception 'Sumber booking tidak valid'; end if;
  perform 1 from public.events where id=p_event_id for update;
  if not found then raise exception 'Acara tidak ditemukan'; end if;
  if exists(select 1 from public.fee_splits where event_id=p_event_id and is_current and status='final') then
    raise exception 'Sumber booking terkunci karena pembagian fee sudah final';
  end if;
  if p_source='internal' and not exists(
    select 1 from public.profiles where id=p_member_id and is_active
  ) then raise exception 'Anggota sumber booking tidak aktif atau tidak ditemukan'; end if;

  delete from public.event_hunters where event_id=p_event_id;
  if p_source='internal' then
    insert into public.event_hunters(event_id,member_id) values(p_event_id,p_member_id);
  elsif p_source='external' then
    insert into public.event_hunters(event_id,external_hunter_id) values(p_event_id,v_external_id);
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_data)
  values(auth.uid(),'event.booking_source_updated','event',p_event_id,
    jsonb_build_object('source',p_source,'member_id',p_member_id));
end $$;
