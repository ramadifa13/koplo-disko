create policy fee_templates_management_write on public.fee_templates for all to authenticated using(public.is_management()) with check(public.is_management());
create policy fee_template_items_management_write on public.fee_template_items for all to authenticated using(public.is_management()) with check(public.is_management());
create policy app_settings_management_select on public.app_settings for select to authenticated using(public.is_management());
create policy app_settings_owner_write on public.app_settings for all to authenticated using(public.current_role()='owner') with check(public.current_role()='owner');
create policy documents_management_update on public.documents for update to authenticated using(public.is_management()) with check(public.is_management());
create policy document_versions_allowed_select on public.document_versions for select to authenticated using(exists(select 1 from public.documents d where d.id=document_id and (public.is_management() or d.owner_member_id=auth.uid())));
create policy document_versions_management_write on public.document_versions for all to authenticated using(public.is_management()) with check(public.is_management() and uploaded_by=auth.uid());
create policy event_status_history_allowed_select on public.event_status_history for select to authenticated using(public.is_management() or exists(select 1 from public.event_assignments ea where ea.event_id=event_status_history.event_id and ea.member_id=auth.uid()));
create policy event_status_history_management_insert on public.event_status_history for insert to authenticated with check(public.is_management() and changed_by=auth.uid());
create policy member_positions_allowed_select on public.member_positions for select to authenticated using(public.is_management() or member_id=auth.uid());
create policy member_positions_management_write on public.member_positions for all to authenticated using(public.is_management()) with check(public.is_management());
create policy role_permissions_owner_select on public.role_permissions for select to authenticated using(public.current_role()='owner');
create policy permissions_owner_select on public.permissions for select to authenticated using(public.current_role()='owner');

insert into public.permissions(key,name) values
('events.manage','Kelola jadwal'),('members.manage','Kelola anggota'),('finance.manage','Kelola keuangan'),('documents.manage','Kelola dokumen'),('reports.view_all','Lihat seluruh laporan'),('settings.manage','Kelola pengaturan'),('audit.view','Lihat audit log') on conflict(key) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where r.key='owner' on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on p.key in('events.manage','members.manage','finance.manage','documents.manage','reports.view_all') where r.key='manager' on conflict do nothing;
insert into public.app_settings(key,value) values('organization',jsonb_build_object('name','Koplo Disko','timezone','Asia/Jakarta','locale','id-ID')) on conflict(key) do nothing;
