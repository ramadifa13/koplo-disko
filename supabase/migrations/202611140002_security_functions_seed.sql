create or replace function public.current_role() returns public.app_role language sql stable security definer set search_path=public,pg_temp as $$ select r.key from user_roles ur join roles r on r.id=ur.role_id where ur.user_id=auth.uid() $$;
revoke all on function public.current_role() from public; grant execute on function public.current_role() to authenticated;
create or replace function public.is_management() returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select coalesce(public.current_role() in ('owner','manager'),false) $$;
revoke all on function public.is_management() from public; grant execute on function public.is_management() to authenticated;

do $$ declare t text; begin foreach t in array array['roles','permissions','role_permissions','profiles','user_roles','positions','member_positions','external_hunters','event_types','venues','events','event_assignments','event_hunters','event_status_history','fee_templates','fee_template_items','fee_splits','fee_allocations','allocation_revisions','client_payments','payouts','payout_allocations','cash_accounts','cash_categories','cash_transactions','documents','document_versions','notifications','audit_logs','app_settings'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from anon, authenticated',t); execute format('grant select,insert,update,delete on public.%I to authenticated',t); end loop; end $$;
create policy profiles_self_or_management_select on public.profiles for select to authenticated using(id=auth.uid() or public.is_management());
create policy profiles_management_write on public.profiles for update to authenticated using(public.is_management()) with check(public.is_management());
create policy reference_authenticated_select on public.roles for select to authenticated using(true);
create policy reference_positions_select on public.positions for select to authenticated using(true);
create policy reference_event_types_select on public.event_types for select to authenticated using(true);
create policy user_roles_self_or_management_select on public.user_roles for select to authenticated using(user_id=auth.uid() or public.is_management());
create policy events_allowed_select on public.events for select to authenticated using(public.is_management() or exists(select 1 from event_assignments ea where ea.event_id=events.id and ea.member_id=auth.uid()));
create policy events_management_insert on public.events for insert to authenticated with check(public.is_management() and created_by=auth.uid());
create policy events_management_update on public.events for update to authenticated using(public.is_management()) with check(public.is_management());
create policy assignments_allowed_select on public.event_assignments for select to authenticated using(public.is_management() or member_id=auth.uid());
create policy assignments_management_all on public.event_assignments for all to authenticated using(public.is_management()) with check(public.is_management());
create policy allocations_own_final_select on public.fee_allocations for select to authenticated using(recipient_member_id=auth.uid() and exists(select 1 from fee_splits fs where fs.id=fee_split_id and fs.status='final') or public.is_management());
create policy finance_management_all on public.fee_splits for all to authenticated using(public.is_management()) with check(public.is_management());
create policy payments_management_select on public.client_payments for select to authenticated using(public.is_management());
create policy payouts_own_or_management_select on public.payouts for select to authenticated using(recipient_member_id=auth.uid() or public.is_management());
create policy notifications_own_select on public.notifications for select to authenticated using(recipient_id=auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());
create policy documents_allowed_select on public.documents for select to authenticated using(public.is_management() or (not is_financial and (owner_member_id=auth.uid() or exists(select 1 from event_assignments ea where ea.event_id=documents.event_id and ea.member_id=auth.uid()))));
create policy management_generic_external_hunters on public.external_hunters for all to authenticated using(public.is_management()) with check(public.is_management());
create policy management_generic_documents on public.documents for insert to authenticated with check(public.is_management() and uploaded_by=auth.uid());

create or replace function public.get_management_dashboard() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
select case when not public.is_management() then jsonb_build_object() else jsonb_build_object('events_count',(select count(*) from events where starts_at>=date_trunc('month',now()) and starts_at<date_trunc('month',now())+interval '1 month'),'upcoming_count',(select count(*) from events where starts_at>=now() and booking_status='confirmed'),'contract_total',coalesce((select sum(contract_value) from events where starts_at>=date_trunc('month',now())),0),'received_total',coalesce((select sum(case when kind='refund' then -amount else amount end) from client_payments),0),'receivable_total',greatest(0,coalesce((select sum(contract_value) from events where booking_status<>'cancelled'),0)-coalesce((select sum(case when kind='refund' then -amount else amount end) from client_payments),0)),'unpaid_fees',coalesce((select sum(fa.amount) from fee_allocations fa join fee_splits fs on fs.id=fa.fee_split_id where fs.status='final'),0)-coalesce((select sum(amount) from payout_allocations),0),'cash_balance',coalesce((select sum(case when direction='income' then amount else -amount end) from cash_transactions),0)) end $$;
revoke all on function public.get_management_dashboard() from public; grant execute on function public.get_management_dashboard() to authenticated;
create or replace function public.get_member_dashboard() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$ select jsonb_build_object('events_count',(select count(*) from event_assignments ea join events e on e.id=ea.event_id where ea.member_id=auth.uid() and e.starts_at>=date_trunc('month',now())),'upcoming_count',(select count(*) from event_assignments ea join events e on e.id=ea.event_id where ea.member_id=auth.uid() and e.starts_at>=now()),'contract_total',coalesce((select sum(fa.amount) from fee_allocations fa join fee_splits fs on fs.id=fa.fee_split_id where fa.recipient_member_id=auth.uid() and fs.status='final'),0),'received_total',coalesce((select sum(amount) from payouts where recipient_member_id=auth.uid()),0),'receivable_total',greatest(0,coalesce((select sum(fa.amount) from fee_allocations fa join fee_splits fs on fs.id=fa.fee_split_id where fa.recipient_member_id=auth.uid() and fs.status='final'),0)-coalesce((select sum(amount) from payouts where recipient_member_id=auth.uid()),0)),'unpaid_fees',0,'cash_balance',0) $$;
revoke all on function public.get_member_dashboard() from public; grant execute on function public.get_member_dashboard() to authenticated;

insert into roles(key,name) values('owner','Owner'),('manager','Manager'),('member','Member');
insert into positions(name) values('Owner / MC 1'),('Manager'),('MC 2'),('DJ'),('Soundman');
insert into event_types(name) values('Cafe Regular'),('Cafe Non-Regular'),('Event'),('Festival'),('Private'),('Corporate'),('Wedding'),('Lainnya');
insert into cash_accounts(name) values('Kas Utama');
insert into cash_categories(name,direction) values('Alokasi Fee','income'),('Operasional','expense'),('Peralatan','expense'),('Koreksi','income');
insert into fee_templates(name) values('Pembagian Standar');
insert into fee_template_items(template_id,component_key,calculation_type,value,sort_order) select id,'manager','percentage',1500,1 from fee_templates where name='Pembagian Standar';
insert into fee_template_items(template_id,component_key,calculation_type,value,sort_order) select id,'hunter','percentage',500,2 from fee_templates where name='Pembagian Standar';
insert into fee_template_items(template_id,component_key,calculation_type,value,sort_order) select id,'cash','percentage',500,3 from fee_templates where name='Pembagian Standar';
insert into fee_template_items(template_id,component_key,calculation_type,value,sort_order) select id,'dj','fixed',300000,4 from fee_templates where name='Pembagian Standar';
insert into fee_template_items(template_id,component_key,calculation_type,value,sort_order) select id,'mc2','fixed',250000,5 from fee_templates where name='Pembagian Standar';
insert into fee_template_items(template_id,component_key,calculation_type,value,sort_order) select id,'soundman','fixed',150000,6 from fee_templates where name='Pembagian Standar';
insert into fee_template_items(template_id,component_key,calculation_type,value,sort_order) select id,'mc1','remainder',0,7 from fee_templates where name='Pembagian Standar';

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('private-documents','private-documents',false,20971520,array['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) on conflict(id) do update set public=false;
create policy private_documents_select on storage.objects for select to authenticated using(bucket_id='private-documents' and exists(select 1 from documents d where d.storage_path=name and (public.is_management() or d.owner_member_id=auth.uid())));
create policy private_documents_insert on storage.objects for insert to authenticated with check(bucket_id='private-documents' and public.is_management());
