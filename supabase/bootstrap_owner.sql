-- Jalankan setelah membuat pengguna pertama melalui Supabase Auth Dashboard.
-- Ganti nilai email, lalu jalankan satu kali di SQL Editor.
begin;
insert into public.profiles(id,full_name,email,is_active)
select id,coalesce(raw_user_meta_data->>'full_name','Owner Koplo Disko'),email,true from auth.users where email='GANTI_EMAIL_OWNER' on conflict(id) do update set full_name=excluded.full_name,is_active=true;
insert into public.user_roles(user_id,role_id)
select u.id,r.id from auth.users u cross join public.roles r where u.email='GANTI_EMAIL_OWNER' and r.key='owner' on conflict(user_id) do update set role_id=excluded.role_id;
commit;
