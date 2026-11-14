-- Kebijakan tulis manajemen untuk tabel operasional/keuangan yang tidak boleh dimutasi Member.
create policy event_hunters_allowed_select on public.event_hunters for select to authenticated using(public.is_management() or member_id=auth.uid() or exists(select 1 from public.event_assignments ea where ea.event_id=event_hunters.event_id and ea.member_id=auth.uid()));
create policy event_hunters_management_write on public.event_hunters for all to authenticated using(public.is_management()) with check(public.is_management());
create policy fee_allocations_management_write on public.fee_allocations for all to authenticated using(public.is_management()) with check(public.is_management());
create policy allocation_revisions_management_all on public.allocation_revisions for all to authenticated using(public.is_management()) with check(public.is_management());
create policy client_payments_management_write on public.client_payments for all to authenticated using(public.is_management()) with check(public.is_management() and created_by=auth.uid());
create policy payouts_management_write on public.payouts for all to authenticated using(public.is_management()) with check(public.is_management() and created_by=auth.uid());
create policy payout_allocations_own_or_management_select on public.payout_allocations for select to authenticated using(public.is_management() or exists(select 1 from public.payouts p where p.id=payout_id and p.recipient_member_id=auth.uid()));
create policy payout_allocations_management_write on public.payout_allocations for all to authenticated using(public.is_management()) with check(public.is_management());
create policy cash_accounts_management_select on public.cash_accounts for select to authenticated using(public.is_management());
create policy cash_categories_management_select on public.cash_categories for select to authenticated using(public.is_management());
create policy cash_transactions_management_all on public.cash_transactions for all to authenticated using(public.is_management()) with check(public.is_management() and created_by=auth.uid());
create policy fee_templates_management_select on public.fee_templates for select to authenticated using(public.is_management());
create policy fee_template_items_management_select on public.fee_template_items for select to authenticated using(public.is_management());
create policy audit_logs_owner_select on public.audit_logs for select to authenticated using(public.current_role()='owner');
create policy venues_authenticated_select on public.venues for select to authenticated using(true);
create policy venues_management_write on public.venues for all to authenticated using(public.is_management()) with check(public.is_management());
create policy event_types_management_write on public.event_types for all to authenticated using(public.is_management()) with check(public.is_management());
create policy positions_management_write on public.positions for all to authenticated using(public.is_management()) with check(public.is_management());
create policy private_documents_update on storage.objects for update to authenticated using(bucket_id='private-documents' and public.is_management()) with check(bucket_id='private-documents' and public.is_management());
create policy private_documents_delete on storage.objects for delete to authenticated using(bucket_id='private-documents' and public.is_management());

create or replace function public.finalize_fee_split(
  p_event_id uuid,
  p_allocations jsonb,
  p_revision_reason text default null
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_contract bigint;
  v_total numeric;
  v_split_id uuid;
  v_version integer;
begin
  if not public.is_management() then raise exception 'Akses ditolak' using errcode='42501'; end if;
  select contract_value into v_contract from public.events where id=p_event_id for update;
  if not found then raise exception 'Event tidak ditemukan' using errcode='P0002'; end if;
  if jsonb_typeof(p_allocations)<>'array' or jsonb_array_length(p_allocations)=0 then raise exception 'Alokasi fee wajib diisi'; end if;
  select coalesce(sum((item->>'amount')::bigint),0) into v_total from jsonb_array_elements(p_allocations) item;
  if v_total<>v_contract then raise exception 'Total alokasi harus sama dengan nilai kontrak'; end if;
  if exists(select 1 from jsonb_array_elements(p_allocations) item where (item->>'amount')::bigint<0) then raise exception 'Nominal alokasi tidak boleh negatif'; end if;
  select coalesce(max(version),0)+1 into v_version from public.fee_splits where event_id=p_event_id;
  insert into public.fee_splits(event_id,version,status,contract_snapshot,revision_reason,finalized_at,finalized_by,created_by)
  values(p_event_id,v_version,'final',v_contract,nullif(trim(p_revision_reason),''),now(),auth.uid(),auth.uid()) returning id into v_split_id;
  insert into public.fee_allocations(fee_split_id,component_key,recipient_member_id,recipient_hunter_id,is_cash_allocation,amount,percentage_bps)
  select v_split_id,x.component_key,x.recipient_member_id,x.recipient_hunter_id,coalesce(x.is_cash_allocation,false),x.amount,x.percentage_bps
  from jsonb_to_recordset(p_allocations) as x(component_key text,recipient_member_id uuid,recipient_hunter_id uuid,is_cash_allocation boolean,amount bigint,percentage_bps integer);
  if exists(select 1 from public.fee_allocations where fee_split_id=v_split_id and num_nonnulls(recipient_member_id,recipient_hunter_id)+(is_cash_allocation::integer)<>1) then raise exception 'Setiap alokasi harus memiliki tepat satu penerima'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_data) values(auth.uid(),'fee_split.finalize','fee_split',v_split_id,jsonb_build_object('event_id',p_event_id,'version',v_version,'total',v_total));
  insert into public.notifications(recipient_id,title,body,kind,entity_type,entity_id)
  select distinct fa.recipient_member_id,'Pembagian fee sudah final','Hak fee Anda sudah dapat dilihat.','fee_finalized','event',p_event_id
  from public.fee_allocations fa where fa.fee_split_id=v_split_id and fa.recipient_member_id is not null;
  return v_split_id;
end $$;
revoke all on function public.finalize_fee_split(uuid,jsonb,text) from public;
grant execute on function public.finalize_fee_split(uuid,jsonb,text) to authenticated;

create or replace function public.record_client_payment(
  p_event_id uuid,p_kind public.payment_kind,p_amount bigint,p_paid_at timestamptz,p_method text,p_notes text,p_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_contract bigint; v_net bigint; v_id uuid;
begin
  if not public.is_management() then raise exception 'Akses ditolak' using errcode='42501'; end if;
  if p_amount<=0 then raise exception 'Nominal harus lebih dari nol'; end if;
  select contract_value into v_contract from public.events where id=p_event_id for update;
  if not found then raise exception 'Event tidak ditemukan'; end if;
  select coalesce(sum(case when kind='refund' then -amount else amount end),0) into v_net from public.client_payments where event_id=p_event_id;
  if p_kind<>'refund' and v_net+p_amount>v_contract then raise exception 'Pembayaran melampaui nilai kontrak'; end if;
  insert into public.client_payments(event_id,kind,amount,paid_at,method,notes,idempotency_key,created_by)
  values(p_event_id,p_kind,p_amount,p_paid_at,p_method,nullif(trim(p_notes),''),p_idempotency_key,auth.uid())
  on conflict(idempotency_key) do update set idempotency_key=excluded.idempotency_key returning id into v_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,new_data) values(auth.uid(),'client_payment.record','client_payment',v_id,jsonb_build_object('event_id',p_event_id,'amount',p_amount,'kind',p_kind));
  return v_id;
end $$;
revoke all on function public.record_client_payment(uuid,public.payment_kind,bigint,timestamptz,text,text,uuid) from public;
grant execute on function public.record_client_payment(uuid,public.payment_kind,bigint,timestamptz,text,text,uuid) to authenticated;
