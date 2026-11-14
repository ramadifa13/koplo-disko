create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_member_role uuid;
begin
  if new.email is null then return new; end if;
  insert into public.profiles(id,full_name,email,is_active)
  values(new.id,coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),split_part(new.email,'@',1)),new.email,true)
  on conflict(id) do update set email=excluded.email;
  select id into v_member_role from public.roles where key='member';
  insert into public.user_roles(user_id,role_id) values(new.id,v_member_role) on conflict(user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

create or replace function public.set_member_access(p_user_id uuid,p_role public.app_role,p_is_active boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor_role public.app_role; v_current_role public.app_role; v_owner_count integer;
begin
  v_actor_role:=public.current_role();
  if v_actor_role not in ('owner','manager') then raise exception 'Akses ditolak' using errcode='42501'; end if;
  select r.key into v_current_role from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=p_user_id for update;
  if v_actor_role='manager' and (p_role<>'member' or v_current_role='owner' or p_user_id=auth.uid()) then raise exception 'Manager tidak dapat mengubah akses ini' using errcode='42501'; end if;
  if v_current_role='owner' and (p_role<>'owner' or not p_is_active) then
    select count(*) into v_owner_count from public.user_roles ur join public.roles r on r.id=ur.role_id join public.profiles p on p.id=ur.user_id where r.key='owner' and p.is_active;
    if v_owner_count<=1 then raise exception 'Owner aktif terakhir tidak dapat diubah'; end if;
  end if;
  update public.user_roles set role_id=(select id from public.roles where key=p_role),assigned_by=auth.uid(),assigned_at=now() where user_id=p_user_id;
  update public.profiles set is_active=p_is_active,updated_at=now() where id=p_user_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_data) values(auth.uid(),'member.access.update','profile',p_user_id,jsonb_build_object('role',p_role,'is_active',p_is_active));
end $$;
revoke all on function public.set_member_access(uuid,public.app_role,boolean) from public;
grant execute on function public.set_member_access(uuid,public.app_role,boolean) to authenticated;

create or replace function public.bootstrap_first_owner(p_user_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where r.key='owner') then raise exception 'Owner sudah tersedia'; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Pengguna Auth tidak ditemukan'; end if;
  update public.user_roles set role_id=(select id from public.roles where key='owner'),assigned_at=now() where user_id=p_user_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_data) values(p_user_id,'owner.bootstrap','profile',p_user_id,jsonb_build_object('role','owner'));
end $$;
revoke all on function public.bootstrap_first_owner(uuid) from public,anon,authenticated;
