-- Reset operasional diminta pengguna. Schema, referensi, konfigurasi, dan Owner dipertahankan.
do $$
declare
  v_owner uuid;
begin
  select ur.user_id into v_owner
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join public.profiles p on p.id = ur.user_id
  where r.key = 'owner' and p.is_active
  order by ur.assigned_at
  limit 1;

  if v_owner is null then
    -- Database baru (termasuk CI) belum mempunyai akun Auth/Owner. Reset ini
    -- adalah operasi satu kali untuk instalasi yang sudah aktif, sehingga aman
    -- dilewati ketika belum ada data pengguna. Objek schema di bawah tetap
    -- dibuat setelah blok DO selesai.
    raise notice 'Reset operasional dilewati: Owner aktif belum tersedia.';
    return;
  end if;

  truncate table
    public.events,
    public.documents,
    public.payouts,
    public.cash_transactions,
    public.notifications,
    public.audit_logs,
    public.external_hunters,
    public.venues
  restart identity cascade;

  delete from public.profiles where id <> v_owner;
  delete from auth.users where id <> v_owner;
  delete from public.app_settings where key = 'demo_dataset';

  insert into public.external_hunters(id, name, notes, is_active, created_by)
  values (
    'e0000000-0000-4000-8000-000000000001',
    'Hunter Luar',
    'Penerima generik untuk booking dari hunter eksternal; tidak menyimpan data pribadi.',
    true,
    v_owner
  );
end $$;

create or replace function public.get_members_directory()
returns table(
  id uuid,
  full_name text,
  email text,
  phone text,
  is_active boolean,
  role public.app_role,
  positions jsonb
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_management() then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.email,
    p.phone,
    p.is_active,
    r.key,
    coalesce(
      jsonb_agg(
        jsonb_build_object('id', pos.id, 'name', pos.name)
        order by pos.name
      ) filter (where pos.id is not null),
      '[]'::jsonb
    ) as positions
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id
  join public.roles r on r.id = ur.role_id
  left join public.member_positions mp on mp.member_id = p.id
  left join public.positions pos on pos.id = mp.position_id
  group by p.id, p.full_name, p.email, p.phone, p.is_active, r.key
  order by p.full_name;
end;
$$;

revoke all on function public.get_members_directory() from public, anon;
grant execute on function public.get_members_directory() to authenticated;
