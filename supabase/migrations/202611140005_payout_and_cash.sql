create or replace function public.record_payout(
  p_recipient_member_id uuid,
  p_recipient_hunter_id uuid,
  p_allocations jsonb,
  p_paid_at timestamptz,
  p_method text,
  p_notes text,
  p_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_amount bigint; v_id uuid; v_item jsonb; v_allocation public.fee_allocations%rowtype; v_paid bigint;
begin
  if not public.is_management() then raise exception 'Akses ditolak' using errcode='42501'; end if;
  if num_nonnulls(p_recipient_member_id,p_recipient_hunter_id)<>1 then raise exception 'Penerima tidak valid'; end if;
  if jsonb_typeof(p_allocations)<>'array' or jsonb_array_length(p_allocations)=0 then raise exception 'Alokasi pembayaran wajib diisi'; end if;
  select coalesce(sum((item->>'amount')::bigint),0) into v_amount from jsonb_array_elements(p_allocations) item;
  if v_amount<=0 then raise exception 'Nominal pembayaran harus lebih dari nol'; end if;
  for v_item in select * from jsonb_array_elements(p_allocations) loop
    select * into v_allocation from public.fee_allocations where id=(v_item->>'fee_allocation_id')::uuid for update;
    if not found or v_allocation.recipient_member_id is distinct from p_recipient_member_id or v_allocation.recipient_hunter_id is distinct from p_recipient_hunter_id then raise exception 'Alokasi tidak sesuai penerima'; end if;
    select coalesce(sum(pa.amount),0) into v_paid from public.payout_allocations pa join public.payouts p on p.id=pa.payout_id where pa.fee_allocation_id=v_allocation.id and p.reversal_of is null;
    if v_paid+(v_item->>'amount')::bigint>v_allocation.amount then raise exception 'Pembayaran melampaui sisa alokasi'; end if;
  end loop;
  insert into public.payouts(recipient_member_id,recipient_hunter_id,amount,paid_at,method,notes,idempotency_key,created_by)
  values(p_recipient_member_id,p_recipient_hunter_id,v_amount,p_paid_at,p_method,nullif(trim(p_notes),''),p_idempotency_key,auth.uid())
  on conflict(idempotency_key) do update set idempotency_key=excluded.idempotency_key returning id into v_id;
  insert into public.payout_allocations(payout_id,fee_allocation_id,amount)
  select v_id,(x->>'fee_allocation_id')::uuid,(x->>'amount')::bigint from jsonb_array_elements(p_allocations) x on conflict do nothing;
  insert into public.notifications(recipient_id,title,body,kind,entity_type,entity_id)
  select p_recipient_member_id,'Pembayaran fee tercatat','Pembayaran fee sebesar '||v_amount::text||' Rupiah telah dicatat.','fee_paid','payout',v_id where p_recipient_member_id is not null;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_data) values(auth.uid(),'payout.record','payout',v_id,jsonb_build_object('amount',v_amount));
  return v_id;
end $$;
revoke all on function public.record_payout(uuid,uuid,jsonb,timestamptz,text,text,uuid) from public;
grant execute on function public.record_payout(uuid,uuid,jsonb,timestamptz,text,text,uuid) to authenticated;

create or replace function public.record_cash_transaction(
  p_cash_account_id uuid,p_category_id uuid,p_direction public.cash_direction,p_amount bigint,p_transacted_at timestamptz,p_description text,p_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_category_direction public.cash_direction; v_id uuid;
begin
  if not public.is_management() then raise exception 'Akses ditolak' using errcode='42501'; end if;
  if p_amount<=0 then raise exception 'Nominal harus lebih dari nol'; end if;
  select direction into v_category_direction from public.cash_categories where id=p_category_id and is_active;
  if not found or v_category_direction<>p_direction then raise exception 'Kategori tidak sesuai jenis transaksi'; end if;
  insert into public.cash_transactions(cash_account_id,category_id,direction,amount,transacted_at,description,idempotency_key,created_by)
  values(p_cash_account_id,p_category_id,p_direction,p_amount,p_transacted_at,p_description,p_idempotency_key,auth.uid())
  on conflict(idempotency_key) do update set idempotency_key=excluded.idempotency_key returning id into v_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_data) values(auth.uid(),'cash.record','cash_transaction',v_id,jsonb_build_object('direction',p_direction,'amount',p_amount));
  return v_id;
end $$;
revoke all on function public.record_cash_transaction(uuid,uuid,public.cash_direction,bigint,timestamptz,text,uuid) from public;
grant execute on function public.record_cash_transaction(uuid,uuid,public.cash_direction,bigint,timestamptz,text,uuid) to authenticated;

create or replace view public.fee_allocation_balances with(security_invoker=true) as
select fa.id,fa.fee_split_id,fs.event_id,e.name as event_name,fa.component_key,fa.recipient_member_id,fa.recipient_hunter_id,fa.amount,
coalesce(sum(pa.amount),0)::bigint as paid_amount,(fa.amount-coalesce(sum(pa.amount),0))::bigint as remaining_amount
from public.fee_allocations fa join public.fee_splits fs on fs.id=fa.fee_split_id join public.events e on e.id=fs.event_id
left join public.payout_allocations pa on pa.fee_allocation_id=fa.id left join public.payouts p on p.id=pa.payout_id and p.reversal_of is null
where fs.status='final' group by fa.id,fs.event_id,e.name;
grant select on public.fee_allocation_balances to authenticated;
