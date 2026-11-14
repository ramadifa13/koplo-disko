alter table public.fee_splits add column if not exists is_current boolean not null default true;
create unique index if not exists fee_splits_one_current_idx on public.fee_splits(event_id) where is_current;
drop policy if exists allocations_own_final_select on public.fee_allocations;
create policy allocations_own_final_select on public.fee_allocations for select to authenticated using((recipient_member_id=auth.uid() and exists(select 1 from fee_splits fs where fs.id=fee_split_id and fs.status='final' and fs.is_current)) or public.is_management());

create or replace function public.finalize_fee_split(p_event_id uuid,p_allocations jsonb,p_revision_reason text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_contract bigint;v_total numeric;v_split_id uuid;v_previous_id uuid;v_version integer;
begin
  if not public.is_management() then raise exception 'Akses ditolak' using errcode='42501'; end if;
  select contract_value into v_contract from public.events where id=p_event_id for update;
  if not found then raise exception 'Event tidak ditemukan' using errcode='P0002'; end if;
  if jsonb_typeof(p_allocations)<>'array' or jsonb_array_length(p_allocations)=0 then raise exception 'Alokasi fee wajib diisi'; end if;
  select coalesce(sum((item->>'amount')::bigint),0) into v_total from jsonb_array_elements(p_allocations) item;
  if v_total<>v_contract then raise exception 'Total alokasi harus sama dengan nilai kontrak'; end if;
  if exists(select 1 from jsonb_array_elements(p_allocations) item where (item->>'amount')::bigint<0) then raise exception 'Nominal alokasi tidak boleh negatif'; end if;
  select id into v_previous_id from public.fee_splits where event_id=p_event_id and is_current for update;
  if v_previous_id is not null then
    if nullif(trim(p_revision_reason),'') is null then raise exception 'Alasan revisi wajib diisi'; end if;
    if exists(select 1 from public.payout_allocations pa join public.fee_allocations fa on fa.id=pa.fee_allocation_id where fa.fee_split_id=v_previous_id) then raise exception 'Pembagian yang sudah dibayar tidak dapat direvisi'; end if;
    insert into public.allocation_revisions(fee_split_id,reason,snapshot,created_by) select v_previous_id,p_revision_reason,jsonb_build_object('split',to_jsonb(fs),'allocations',(select jsonb_agg(to_jsonb(fa)) from public.fee_allocations fa where fa.fee_split_id=fs.id)),auth.uid() from public.fee_splits fs where fs.id=v_previous_id;
    update public.fee_splits set is_current=false where id=v_previous_id;
  end if;
  select coalesce(max(version),0)+1 into v_version from public.fee_splits where event_id=p_event_id;
  insert into public.fee_splits(event_id,version,status,is_current,contract_snapshot,revision_reason,finalized_at,finalized_by,created_by) values(p_event_id,v_version,'final',true,v_contract,nullif(trim(p_revision_reason),''),now(),auth.uid(),auth.uid()) returning id into v_split_id;
  insert into public.fee_allocations(fee_split_id,component_key,recipient_member_id,recipient_hunter_id,is_cash_allocation,amount,percentage_bps)
  select v_split_id,x.component_key,x.recipient_member_id,x.recipient_hunter_id,coalesce(x.is_cash_allocation,false),x.amount,x.percentage_bps from jsonb_to_recordset(p_allocations) as x(component_key text,recipient_member_id uuid,recipient_hunter_id uuid,is_cash_allocation boolean,amount bigint,percentage_bps integer);
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_data) values(auth.uid(),case when v_previous_id is null then 'fee_split.finalize' else 'fee_split.revise' end,'fee_split',v_split_id,jsonb_build_object('event_id',p_event_id,'version',v_version,'total',v_total));
  insert into public.notifications(recipient_id,title,body,kind,entity_type,entity_id) select distinct fa.recipient_member_id,'Pembagian fee sudah final','Hak fee Anda sudah dapat dilihat.','fee_finalized','event',p_event_id from public.fee_allocations fa where fa.fee_split_id=v_split_id and fa.recipient_member_id is not null;
  return v_split_id;
end $$;

create or replace view public.fee_allocation_balances with(security_invoker=true) as
select fa.id,fa.fee_split_id,fs.event_id,e.name as event_name,fa.component_key,fa.recipient_member_id,fa.recipient_hunter_id,fa.amount,coalesce(sum(pa.amount),0)::bigint as paid_amount,(fa.amount-coalesce(sum(pa.amount),0))::bigint as remaining_amount
from public.fee_allocations fa join public.fee_splits fs on fs.id=fa.fee_split_id and fs.is_current join public.events e on e.id=fs.event_id left join public.payout_allocations pa on pa.fee_allocation_id=fa.id left join public.payouts p on p.id=pa.payout_id and p.reversal_of is null where fs.status='final' group by fa.id,fs.event_id,e.name;
grant select on public.fee_allocation_balances to authenticated;
