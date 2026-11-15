-- Owner dan Manager mempunyai fitur yang sama. Owner hanya dilindungi sebagai
-- administrator recovery agar organisasi tidak kehilangan kendali akun.
create or replace function public.get_my_capabilities()
returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select case public.current_role()
    when 'owner' then jsonb_build_object(
      'management', true, 'manage_owner', true, 'manage_members', true,
      'manage_finance', true, 'manage_documents', true,
      'manage_settings', true, 'view_audit', true
    )
    when 'manager' then jsonb_build_object(
      'management', true, 'manage_owner', false, 'manage_members', true,
      'manage_finance', true, 'manage_documents', true,
      'manage_settings', true, 'view_audit', true
    )
    else jsonb_build_object(
      'management', false, 'manage_owner', false, 'manage_members', false,
      'manage_finance', false, 'manage_documents', false,
      'manage_settings', false, 'view_audit', false
    )
  end
$$;
revoke all on function public.get_my_capabilities() from public,anon;
grant execute on function public.get_my_capabilities() to authenticated;

create or replace function public.set_member_access(
  p_user_id uuid,
  p_role public.app_role,
  p_is_active boolean
) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_actor_role public.app_role;
  v_current_role public.app_role;
  v_owner_count integer;
begin
  v_actor_role := public.current_role();
  if v_actor_role not in ('owner','manager') then
    raise exception 'Akses ditolak' using errcode='42501';
  end if;

  select r.key into v_current_role
  from public.user_roles ur
  join public.roles r on r.id=ur.role_id
  where ur.user_id=p_user_id
  for update of ur;
  if v_current_role is null then raise exception 'Anggota tidak ditemukan'; end if;

  -- Manager setara secara fitur, tetapi tidak dapat membuat atau mengubah
  -- identitas Owner yang merupakan akun recovery.
  if v_actor_role='manager' and (v_current_role='owner' or p_role='owner') then
    raise exception 'Hanya Owner yang dapat mengelola akses Owner' using errcode='42501';
  end if;

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
    jsonb_build_object('previous_role',v_current_role,'role',p_role,'is_active',p_is_active));
end $$;
revoke all on function public.set_member_access(uuid,public.app_role,boolean) from public,anon;
grant execute on function public.set_member_access(uuid,public.app_role,boolean) to authenticated;

-- Laporan fee member harus memakai tanggal event asli dan periode yang dipilih.
create or replace function public.get_member_fee_report(
  p_start timestamptz,
  p_end timestamptz
) returns table(
  event_name text,
  starts_at timestamptz,
  component_key text,
  amount bigint,
  remaining_amount bigint
)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or p_start is null or p_end is null or p_start >= p_end then
    raise exception 'Periode laporan tidak valid';
  end if;
  return query
  select e.name, e.starts_at, fa.component_key, fa.amount,
    (fa.amount-coalesce(sum(case
      when p.id is not null
       and p.reversal_of is null
       and not exists(select 1 from public.payouts rev where rev.reversal_of=p.id)
      then pa.amount else 0 end),0))::bigint
  from public.fee_allocations fa
  join public.fee_splits fs on fs.id=fa.fee_split_id
  join public.events e on e.id=fs.event_id
  left join public.payout_allocations pa on pa.fee_allocation_id=fa.id
  left join public.payouts p on p.id=pa.payout_id
  where fa.recipient_member_id=auth.uid()
    and fs.status='final' and fs.is_current
    and e.starts_at>=p_start and e.starts_at<p_end
  group by e.name,e.starts_at,fa.id,fa.component_key,fa.amount
  order by e.starts_at, e.name;
end $$;
revoke all on function public.get_member_fee_report(timestamptz,timestamptz) from public,anon;
grant execute on function public.get_member_fee_report(timestamptz,timestamptz) to authenticated;

create or replace function public.get_management_finance_summary()
returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if not public.is_management() then
    raise exception 'Akses ditolak' using errcode='42501';
  end if;
  with payment_totals as (
    select e.id,e.contract_value,
      coalesce(sum(case when cp.kind='refund' then -cp.amount else cp.amount end),0)::bigint received
    from public.events e
    left join public.client_payments cp on cp.event_id=e.id
    where e.booking_status<>'cancelled'
    group by e.id,e.contract_value
  ), cash_total as (
    select coalesce(sum(case when direction='income' then amount else -amount end),0)::bigint value
    from public.cash_transactions
  )
  select jsonb_build_object(
    'contract',coalesce(sum(pt.contract_value),0),
    'received',coalesce(sum(pt.received),0),
    'receivable',coalesce(sum(greatest(0,pt.contract_value-pt.received)),0),
    'settled',count(*) filter(where pt.received>=pt.contract_value),
    'active_events',count(*),
    'cash_balance',(select value from cash_total)
  ) into v_result from payment_totals pt;
  return v_result;
end $$;
revoke all on function public.get_management_finance_summary() from public,anon;
grant execute on function public.get_management_finance_summary() to authenticated;

create index if not exists client_payments_paid_at_idx on public.client_payments(paid_at desc);
create index if not exists payouts_paid_at_idx on public.payouts(paid_at desc);
create index if not exists cash_transactions_transacted_at_idx on public.cash_transactions(transacted_at desc);
create index if not exists documents_created_at_idx on public.documents(created_at desc);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);

create table if not exists public.invite_attempts(
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.invite_attempts enable row level security;
revoke all on public.invite_attempts from public,anon,authenticated;
create index if not exists invite_attempts_actor_created_idx
on public.invite_attempts(actor_id,created_at desc);

alter table public.documents
  add constraint documents_safe_name_length check(length(trim(name)) between 1 and 160),
  add constraint documents_allowed_mime check(mime_type in (
    'application/pdf','image/jpeg','image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ));

-- Database-level serialization closes double-submit races even when two RPC
-- calls pass their pre-insert checks at the same time.
create or replace function public.enforce_client_payment_balance()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_contract bigint; v_net bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.event_id::text,0));
  select contract_value into v_contract from public.events where id=new.event_id;
  select coalesce(sum(case when kind='refund' then -amount else amount end),0)
  into v_net from public.client_payments where event_id=new.event_id;
  if new.kind='refund' and new.amount>v_net then
    raise exception 'Refund melampaui pembayaran bersih';
  end if;
  if new.kind<>'refund' and v_net+new.amount>v_contract then
    raise exception 'Pembayaran melampaui nilai kontrak';
  end if;
  return new;
end $$;
drop trigger if exists client_payment_balance_guard on public.client_payments;
create trigger client_payment_balance_guard before insert on public.client_payments
for each row execute function public.enforce_client_payment_balance();

create or replace function public.enforce_payout_allocation_balance()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_limit bigint; v_paid bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.fee_allocation_id::text,0));
  select amount into v_limit from public.fee_allocations where id=new.fee_allocation_id;
  select coalesce(sum(pa.amount),0) into v_paid
  from public.payout_allocations pa
  join public.payouts p on p.id=pa.payout_id
  where pa.fee_allocation_id=new.fee_allocation_id
    and p.reversal_of is null
    and not exists(select 1 from public.payouts rev where rev.reversal_of=p.id);
  if new.amount<=0 or v_paid+new.amount>v_limit then
    raise exception 'Pembayaran melampaui sisa alokasi';
  end if;
  return new;
end $$;
drop trigger if exists payout_allocation_balance_guard on public.payout_allocations;
create trigger payout_allocation_balance_guard before insert on public.payout_allocations
for each row execute function public.enforce_payout_allocation_balance();

create or replace function public.assign_event_crew(p_event_id uuid,p_member_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_position_id uuid;
  v_position_count integer;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
begin
  if not public.is_management() then
    raise exception 'Akses ditolak' using errcode='42501';
  end if;
  if not exists(select 1 from public.profiles where id=p_member_id and is_active) then
    raise exception 'Anggota tidak aktif atau tidak ditemukan';
  end if;
  select starts_at, starts_at + make_interval(mins=>duration_minutes)
  into v_starts_at,v_ends_at from public.events where id=p_event_id;
  if not found then raise exception 'Acara tidak ditemukan'; end if;
  if exists(
    select 1 from public.event_assignments ea
    join public.events e on e.id=ea.event_id
    where ea.member_id=p_member_id and ea.event_id<>p_event_id
      and e.booking_status<>'cancelled'
      and tstzrange(e.starts_at,e.starts_at+make_interval(mins=>e.duration_minutes),'[)')
          && tstzrange(v_starts_at,v_ends_at,'[)')
  ) then
    raise exception 'Anggota memiliki jadwal yang bertabrakan';
  end if;
  select count(*) into v_position_count
  from public.member_positions where member_id=p_member_id;
  if v_position_count<>1 then
    raise exception 'Anggota harus memiliki tepat satu jabatan utama';
  end if;
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
