-- Owner dan Manager memiliki izin operasional yang sama. Perlindungan Owner
-- aktif terakhir tetap dipertahankan agar organisasi tidak kehilangan admin.
insert into public.role_permissions(role_id, permission_id)
select manager.id, permission.id
from public.roles manager
cross join public.permissions permission
where manager.key = 'manager'
on conflict do nothing;

drop policy if exists audit_logs_owner_select on public.audit_logs;
create policy audit_logs_management_select on public.audit_logs
for select to authenticated using (public.is_management());

drop policy if exists app_settings_owner_write on public.app_settings;
create policy app_settings_management_write on public.app_settings
for all to authenticated using (public.is_management()) with check (public.is_management());

drop policy if exists role_permissions_owner_select on public.role_permissions;
create policy role_permissions_management_select on public.role_permissions
for select to authenticated using (public.is_management());

drop policy if exists permissions_owner_select on public.permissions;
create policy permissions_management_select on public.permissions
for select to authenticated using (public.is_management());

create or replace function public.set_member_access(
  p_user_id uuid,
  p_role public.app_role,
  p_is_active boolean
) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_current_role public.app_role;
  v_owner_count integer;
begin
  if not public.is_management() then
    raise exception 'Akses ditolak' using errcode='42501';
  end if;

  select r.key into v_current_role
  from public.user_roles ur
  join public.roles r on r.id=ur.role_id
  where ur.user_id=p_user_id
  for update of ur;

  if v_current_role is null then raise exception 'Anggota tidak ditemukan'; end if;

  if v_current_role='owner' and (p_role<>'owner' or not p_is_active) then
    select count(*) into v_owner_count
    from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    join public.profiles p on p.id=ur.user_id
    where r.key='owner' and p.is_active;
    if v_owner_count<=1 then
      raise exception 'Owner aktif terakhir tidak dapat diubah';
    end if;
  end if;

  update public.user_roles
  set role_id=(select id from public.roles where key=p_role),
      assigned_by=auth.uid(), assigned_at=now()
  where user_id=p_user_id;
  update public.profiles
  set is_active=p_is_active,updated_at=now()
  where id=p_user_id;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_data)
  values(auth.uid(),'member.access.update','profile',p_user_id,
    jsonb_build_object('role',p_role,'is_active',p_is_active));
end $$;

-- Satu anggota hanya memiliki satu jabatan utama.
with ranked as (
  select member_id, position_id,
         row_number() over (partition by member_id order by position_id) as row_number
  from public.member_positions
)
delete from public.member_positions mp
using ranked r
where mp.member_id=r.member_id and mp.position_id=r.position_id and r.row_number>1;

create unique index if not exists member_positions_one_primary_position
on public.member_positions(member_id);

create or replace function public.update_member_profile(
  p_member_id uuid,
  p_full_name text,
  p_phone text,
  p_position_ids uuid[] default array[]::uuid[]
) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_position_id uuid;
begin
  if not public.is_management() then
    raise exception 'Anda tidak memiliki izin mengelola anggota';
  end if;
  if length(trim(coalesce(p_full_name,''))) < 2 then
    raise exception 'Nama lengkap minimal 2 karakter';
  end if;
  if coalesce(cardinality(p_position_ids),0) <> 1 then
    raise exception 'Pilih tepat satu jabatan utama';
  end if;
  v_position_id := p_position_ids[1];
  if not exists(select 1 from public.positions where id=v_position_id and is_active) then
    raise exception 'Jabatan tidak valid atau sudah nonaktif';
  end if;

  update public.profiles set
    full_name=trim(p_full_name),
    phone=nullif(trim(coalesce(p_phone,'')),''),
    updated_at=now()
  where id=p_member_id;
  if not found then raise exception 'Anggota tidak ditemukan'; end if;

  delete from public.member_positions where member_id=p_member_id;
  insert into public.member_positions(member_id,position_id)
  values(p_member_id,v_position_id);

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_data)
  values(auth.uid(),'member.profile_updated','profile',p_member_id,
    jsonb_build_object('position_id',v_position_id));
end $$;

create or replace function public.assign_event_crew(p_event_id uuid,p_member_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_position_id uuid; v_position_count integer;
begin
  if not public.is_management() then raise exception 'Akses ditolak' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=p_member_id and is_active) then
    raise exception 'Anggota tidak aktif atau tidak ditemukan';
  end if;
  select count(*) into v_position_count
  from public.member_positions where member_id=p_member_id;
  if v_position_count <> 1 then raise exception 'Anggota harus memiliki tepat satu jabatan utama'; end if;
  select position_id into v_position_id
  from public.member_positions where member_id=p_member_id;

  insert into public.event_assignments(event_id,member_id,position_id)
  values(p_event_id,p_member_id,v_position_id);
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_data)
  values(auth.uid(),'event.crew_assigned','event',p_event_id,
    jsonb_build_object('member_id',p_member_id,'position_id',v_position_id));
exception when unique_violation then
  raise exception 'Anggota sudah ditugaskan pada acara ini';
end $$;

-- Satu acara mempunyai tepat satu kategori sumber booking: langsung (tanpa
-- baris), anggota internal, atau Hunter Luar generik.
with ranked as (
  select id,row_number() over(partition by event_id order by created_at,id) as row_number
  from public.event_hunters
)
delete from public.event_hunters eh using ranked r
where eh.id=r.id and r.row_number>1;

create unique index if not exists event_hunters_one_booking_source
on public.event_hunters(event_id);

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

revoke all on function public.assign_event_crew(uuid,uuid) from public,anon;
grant execute on function public.assign_event_crew(uuid,uuid) to authenticated;
revoke all on function public.set_event_booking_source(uuid,text,uuid) from public,anon;
grant execute on function public.set_event_booking_source(uuid,text,uuid) to authenticated;
