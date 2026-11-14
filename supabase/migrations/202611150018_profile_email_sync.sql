create or replace function public.sync_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.profiles
    set email = lower(new.email), updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_profile_email_from_auth() from public, anon, authenticated;

drop trigger if exists auth_user_email_sync on auth.users;
create trigger auth_user_email_sync
after update of email on auth.users
for each row
execute function public.sync_profile_email_from_auth();
