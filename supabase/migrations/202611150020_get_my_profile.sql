create or replace function public.get_my_profile()
returns table(
  id uuid,
  full_name text,
  email text,
  is_active boolean,
  role public.app_role
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.email, p.is_active, r.key
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id
  join public.roles r on r.id = ur.role_id
  where p.id = auth.uid()
  limit 1
$$;

revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;
