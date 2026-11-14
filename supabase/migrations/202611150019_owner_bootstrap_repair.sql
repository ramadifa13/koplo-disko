create or replace function public.bootstrap_first_owner(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user auth.users%rowtype;
begin
  if exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where r.key = 'owner' and ur.user_id <> p_user_id
  ) then
    raise exception 'Owner sudah tersedia';
  end if;

  select * into v_user from auth.users where id = p_user_id;
  if not found then raise exception 'Pengguna Auth tidak ditemukan'; end if;

  insert into public.profiles(id, full_name, email, is_active)
  values (
    v_user.id,
    coalesce(nullif(trim(v_user.raw_user_meta_data->>'full_name'), ''), split_part(v_user.email, '@', 1)),
    lower(v_user.email),
    true
  )
  on conflict(id) do update
  set email = excluded.email, is_active = true, updated_at = now();

  insert into public.user_roles(user_id, role_id, assigned_at)
  values (p_user_id, (select id from public.roles where key = 'owner'), now())
  on conflict(user_id) do update
  set role_id = excluded.role_id, assigned_at = excluded.assigned_at;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, new_data)
  values (p_user_id, 'owner.bootstrap', 'profile', p_user_id, jsonb_build_object('role', 'owner'));
end;
$$;

revoke all on function public.bootstrap_first_owner(uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_first_owner(uuid) to service_role;
