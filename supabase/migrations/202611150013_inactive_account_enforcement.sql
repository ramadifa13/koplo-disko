create or replace function public.current_role() returns public.app_role language sql stable security definer set search_path=public,pg_temp as $$
select r.key from public.user_roles ur join public.roles r on r.id=ur.role_id join public.profiles p on p.id=ur.user_id and p.is_active where ur.user_id=auth.uid()
$$;
revoke all on function public.current_role() from public;
grant execute on function public.current_role() to authenticated;
