create or replace function public.export_app_backup()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_table text;
  v_rows jsonb;
  v_data jsonb := '{}'::jsonb;
  v_tables constant text[] := array[
    'positions','member_positions','external_hunters','event_types','venues',
    'fee_templates','fee_template_items','events','event_assignments',
    'event_hunters','event_status_history','fee_splits','fee_allocations',
    'allocation_revisions','documents','document_versions','client_payments',
    'payouts','payout_allocations','cash_accounts','cash_categories',
    'cash_transactions','notifications','app_settings'
  ];
begin
  if public.current_role()<>'owner' then
    raise exception 'Hanya Owner yang dapat mengekspor backup' using errcode='42501';
  end if;
  foreach v_table in array v_tables loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from public.%I r',
      v_table
    ) into v_rows;
    v_data := v_data || jsonb_build_object(v_table,v_rows);
  end loop;
  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
  into v_rows from public.audit_logs r;
  v_data := v_data || jsonb_build_object('audit_logs',v_rows);
  return jsonb_build_object(
    'format','koplo-disko-backup',
    'version',1,
    'exported_at',now(),
    'data',v_data
  );
end;
$$;

create or replace function public.reset_app_data()
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if public.current_role()<>'owner' then
    raise exception 'Hanya Owner yang dapat mereset data' using errcode='42501';
  end if;

  delete from public.payout_allocations;
  delete from public.cash_transactions;
  delete from public.payouts;
  delete from public.client_payments;
  delete from public.document_versions;
  delete from public.documents;
  delete from public.allocation_revisions;
  delete from public.fee_allocations;
  delete from public.fee_splits;
  delete from public.event_status_history;
  delete from public.event_hunters;
  delete from public.event_assignments;
  delete from public.events;
  delete from public.notifications;
  delete from public.external_hunters;
  delete from public.audit_logs;

  insert into public.audit_logs(actor_id,action,entity_type,new_data)
  values(auth.uid(),'system.data_reset','system',jsonb_build_object('reset_at',now()));
end;
$$;

create or replace function public.import_app_backup(p_backup jsonb)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_table text;
  v_data jsonb;
  v_tables constant text[] := array[
    'positions','member_positions','external_hunters','event_types','venues',
    'fee_templates','fee_template_items','events','event_assignments',
    'event_hunters','event_status_history','fee_splits','fee_allocations',
    'allocation_revisions','documents','document_versions','client_payments',
    'payouts','payout_allocations','cash_accounts','cash_categories',
    'cash_transactions','app_settings'
  ];
begin
  if public.current_role()<>'owner' then
    raise exception 'Hanya Owner yang dapat mengimpor backup' using errcode='42501';
  end if;
  if p_backup->>'format'<>'koplo-disko-backup'
     or p_backup->>'version'<>'1'
     or jsonb_typeof(p_backup->'data')<>'object' then
    raise exception 'Format backup tidak valid';
  end if;
  v_data := p_backup->'data';
  foreach v_table in array v_tables loop
    if jsonb_typeof(v_data->v_table)<>'array' then
      raise exception 'Data tabel % tidak valid',v_table;
    end if;
  end loop;
  if jsonb_typeof(v_data->'notifications')<>'array' then
    raise exception 'Data notifications tidak valid';
  end if;
  if jsonb_typeof(v_data->'audit_logs')<>'array' then
    raise exception 'Data audit_logs tidak valid';
  end if;

  -- Hapus dalam urutan dependensi terbalik. Seluruh fungsi berjalan dalam
  -- satu transaksi, sehingga kegagalan restore mengembalikan snapshot lama.
  for v_table in
    select unnest(array[
      'payout_allocations','cash_transactions','payouts','client_payments',
      'document_versions','documents','allocation_revisions','fee_allocations',
      'fee_splits','event_status_history','event_hunters','event_assignments',
      'events','fee_template_items','fee_templates','member_positions',
      'positions','external_hunters','event_types','venues','notifications',
      'cash_accounts','cash_categories','app_settings'
    ]::text[])
  loop
    execute format('delete from public.%I',v_table);
  end loop;
  delete from public.audit_logs;

  foreach v_table in array v_tables loop
    execute format(
      'insert into public.%I select * from jsonb_populate_recordset(null::public.%I,$1)',
      v_table,v_table
    ) using v_data->v_table;
  end loop;
  -- Trigger penugasan dapat membuat notifikasi baru saat restore. Ganti dengan
  -- snapshot asli setelah seluruh relasi event selesai dimasukkan.
  delete from public.notifications;
  insert into public.notifications
  select * from jsonb_populate_recordset(
    null::public.notifications,v_data->'notifications'
  );
  insert into public.audit_logs overriding system value
  select * from jsonb_populate_recordset(
    null::public.audit_logs,v_data->'audit_logs'
  );
  perform setval(
    pg_get_serial_sequence('public.audit_logs','id'),
    greatest(coalesce((select max(id) from public.audit_logs),0)+1,1),
    false
  );
  insert into public.audit_logs(actor_id,action,entity_type,new_data)
  values(auth.uid(),'system.backup_imported','system',
    jsonb_build_object('imported_at',now(),'exported_at',p_backup->>'exported_at'));
end;
$$;

revoke all on function public.export_app_backup() from public,anon;
revoke all on function public.reset_app_data() from public,anon;
revoke all on function public.import_app_backup(jsonb) from public,anon;
grant execute on function public.export_app_backup() to authenticated;
grant execute on function public.reset_app_data() to authenticated;
grant execute on function public.import_app_backup(jsonb) to authenticated;
