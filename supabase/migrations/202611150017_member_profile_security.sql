create or replace function public.update_member_profile(
  p_member_id uuid,
  p_full_name text,
  p_phone text,
  p_position_ids uuid[] default array[]::uuid[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role text;
begin
  if not public.is_management() then
    raise exception 'Anda tidak memiliki izin mengelola anggota';
  end if;
  if length(trim(coalesce(p_full_name, ''))) < 2 then
    raise exception 'Nama lengkap minimal 2 karakter';
  end if;

  select r.key into v_target_role
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = p_member_id;

  if v_target_role = 'owner' and public.current_role() <> 'owner' then
    raise exception 'Manager tidak dapat mengubah profil Owner';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_position_ids, array[]::uuid[])) position_id
    left join public.positions p on p.id = position_id and p.is_active
    where p.id is null
  ) then
    raise exception 'Jabatan tidak valid atau sudah nonaktif';
  end if;

  update public.profiles
  set full_name = trim(p_full_name),
      phone = nullif(trim(coalesce(p_phone, '')), ''),
      updated_at = now()
  where id = p_member_id;
  if not found then raise exception 'Anggota tidak ditemukan'; end if;

  delete from public.member_positions where member_id = p_member_id;
  insert into public.member_positions(member_id, position_id)
  select p_member_id, position_id
  from unnest(coalesce(p_position_ids, array[]::uuid[])) position_id
  on conflict do nothing;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, new_data)
  values (
    auth.uid(),
    'member.profile_updated',
    'profile',
    p_member_id,
    jsonb_build_object('position_ids', p_position_ids)
  );
end;
$$;

revoke all on function public.update_member_profile(uuid,text,text,uuid[]) from public, anon;
grant execute on function public.update_member_profile(uuid,text,text,uuid[]) to authenticated;

revoke update on public.profiles from authenticated;
revoke insert, update, delete on public.member_positions from authenticated;
