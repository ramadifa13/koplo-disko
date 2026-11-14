-- Dataset contoh operasional. Semua record memakai UUID tetap agar idempoten dan
-- nama [CONTOH] agar tidak tertukar dengan data produksi pengguna.
do $$
declare
  v_owner uuid;
  v_owner_position uuid;
  v_event_type_event uuid;
  v_event_type_cafe uuid;
  v_cash_account uuid;
  v_income_category uuid;
  v_expense_category uuid;
  v_split_one uuid := 'd1000000-0000-4000-8000-000000000001';
  v_split_two uuid := 'd1000000-0000-4000-8000-000000000002';
  v_owner_allocation uuid := 'd2000000-0000-4000-8000-000000000001';
  v_hunter_allocation uuid := 'd2000000-0000-4000-8000-000000000002';
begin
  select ur.user_id into v_owner
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join public.profiles p on p.id = ur.user_id
  where r.key = 'owner' and p.is_active
  order by ur.assigned_at
  limit 1;

  if v_owner is null then
    raise notice 'Dataset contoh dilewati: profil Owner aktif belum tersedia.';
    return;
  end if;

  select id into v_owner_position from public.positions where name = 'Owner / MC 1';
  select id into v_event_type_event from public.event_types where name = 'Event';
  select id into v_event_type_cafe from public.event_types where name = 'Cafe Regular';
  select id into v_cash_account from public.cash_accounts where name = 'Kas Utama';
  select id into v_income_category from public.cash_categories where name = 'Alokasi Fee';
  select id into v_expense_category from public.cash_categories where name = 'Operasional';

  insert into public.venues(id, name, location, maps_url) values
    ('d3000000-0000-4000-8000-000000000001', '[CONTOH] Hutan Kota by Plataran', 'Gelora, Jakarta Pusat', 'https://maps.google.com/?q=Hutan+Kota+by+Plataran'),
    ('d3000000-0000-4000-8000-000000000002', '[CONTOH] The Pallas', 'SCBD, Jakarta Selatan', 'https://maps.google.com/?q=The+Pallas+Jakarta'),
    ('d3000000-0000-4000-8000-000000000003', '[CONTOH] Kopi Nako', 'Depok, Jawa Barat', 'https://maps.google.com/?q=Kopi+Nako+Depok')
  on conflict(id) do nothing;

  insert into public.external_hunters(id, name, phone, notes, created_by) values
    ('d4000000-0000-4000-8000-000000000001', '[CONTOH] Dimas Event Partner', '081200000001', 'Rekan booking eksternal untuk simulasi alur hunter.', v_owner)
  on conflict(id) do nothing;

  insert into public.events(id, name, venue_id, location, event_type_id, starts_at, duration_minutes, contract_value, booking_status, maps_url, client_pic, client_contact, notes, created_by) values
    ('d5000000-0000-4000-8000-000000000001', '[CONTOH] Festival Musik Akhir Pekan', 'd3000000-0000-4000-8000-000000000001', 'Gelora, Jakarta Pusat', v_event_type_event, '2026-10-24 20:00:00+07', 120, 8000000, 'completed', 'https://maps.google.com/?q=Hutan+Kota+by+Plataran', 'Nadia Pratama', '081211110001', 'Contoh acara selesai dan sudah lunas.', v_owner),
    ('d5000000-0000-4000-8000-000000000002', '[CONTOH] Corporate Night', 'd3000000-0000-4000-8000-000000000002', 'SCBD, Jakarta Selatan', v_event_type_event, '2026-11-28 19:30:00+07', 150, 10000000, 'confirmed', 'https://maps.google.com/?q=The+Pallas+Jakarta', 'Raka Mahendra', '081211110002', 'Contoh acara terkonfirmasi dengan pembayaran DP.', v_owner),
    ('d5000000-0000-4000-8000-000000000003', '[CONTOH] Koplo Friday Session', 'd3000000-0000-4000-8000-000000000003', 'Depok, Jawa Barat', v_event_type_cafe, '2026-12-04 21:00:00+07', 90, 6500000, 'negotiation', 'https://maps.google.com/?q=Kopi+Nako+Depok', 'Salsa Amalia', '081211110003', 'Contoh booking dalam tahap negosiasi.', v_owner),
    ('d5000000-0000-4000-8000-000000000004', '[CONTOH] Wedding After Party', null, 'Bogor, Jawa Barat', v_event_type_event, '2026-12-19 20:00:00+07', 120, 12000000, 'inquiry', null, 'Andra Wijaya', '081211110004', 'Contoh permintaan baru yang belum dikonfirmasi.', v_owner)
  on conflict(id) do nothing;

  insert into public.event_assignments(id, event_id, member_id, position_id) values
    ('d6000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001', v_owner, v_owner_position),
    ('d6000000-0000-4000-8000-000000000002', 'd5000000-0000-4000-8000-000000000002', v_owner, v_owner_position),
    ('d6000000-0000-4000-8000-000000000003', 'd5000000-0000-4000-8000-000000000003', v_owner, v_owner_position)
  on conflict(id) do nothing;

  insert into public.event_hunters(id, event_id, external_hunter_id) values
    ('d7000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000001'),
    ('d7000000-0000-4000-8000-000000000002', 'd5000000-0000-4000-8000-000000000002', 'd4000000-0000-4000-8000-000000000001')
  on conflict(id) do nothing;

  insert into public.event_status_history(id, event_id, old_status, new_status, reason, changed_by, created_at) values
    ('d8000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001', null, 'inquiry', 'Contoh permintaan masuk.', v_owner, '2026-09-10 10:00:00+07'),
    ('d8000000-0000-4000-8000-000000000002', 'd5000000-0000-4000-8000-000000000001', 'inquiry', 'confirmed', 'DP diterima dan tanggal dikunci.', v_owner, '2026-09-12 14:00:00+07'),
    ('d8000000-0000-4000-8000-000000000003', 'd5000000-0000-4000-8000-000000000001', 'confirmed', 'completed', 'Acara selesai sesuai jadwal.', v_owner, '2026-10-24 23:00:00+07'),
    ('d8000000-0000-4000-8000-000000000004', 'd5000000-0000-4000-8000-000000000002', 'negotiation', 'confirmed', 'Penawaran disetujui klien.', v_owner, '2026-11-01 16:00:00+07')
  on conflict(id) do nothing;

  insert into public.fee_splits(id, event_id, version, status, is_current, contract_snapshot, finalized_at, finalized_by, created_by) values
    (v_split_one, 'd5000000-0000-4000-8000-000000000001', 1, 'final', true, 8000000, '2026-10-25 09:00:00+07', v_owner, v_owner),
    (v_split_two, 'd5000000-0000-4000-8000-000000000002', 1, 'final', true, 10000000, '2026-11-02 09:00:00+07', v_owner, v_owner)
  on conflict(id) do nothing;

  insert into public.fee_allocations(id, fee_split_id, component_key, recipient_member_id, recipient_hunter_id, is_cash_allocation, amount, percentage_bps) values
    (v_owner_allocation, v_split_one, 'mc1', v_owner, null, false, 7200000, 9000),
    (v_hunter_allocation, v_split_one, 'hunter', null, 'd4000000-0000-4000-8000-000000000001', false, 400000, 500),
    ('d2000000-0000-4000-8000-000000000003', v_split_one, 'cash', null, null, true, 400000, 500),
    ('d2000000-0000-4000-8000-000000000004', v_split_two, 'mc1', v_owner, null, false, 9000000, 9000),
    ('d2000000-0000-4000-8000-000000000005', v_split_two, 'hunter', null, 'd4000000-0000-4000-8000-000000000001', false, 500000, 500),
    ('d2000000-0000-4000-8000-000000000006', v_split_two, 'cash', null, null, true, 500000, 500)
  on conflict(id) do nothing;

  insert into public.client_payments(id, event_id, kind, amount, paid_at, method, notes, idempotency_key, created_by) values
    ('d9000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001', 'deposit', 3000000, '2026-09-12 14:10:00+07', 'Transfer bank', '[CONTOH] Uang muka booking.', 'da000000-0000-4000-8000-000000000001', v_owner),
    ('d9000000-0000-4000-8000-000000000002', 'd5000000-0000-4000-8000-000000000001', 'settlement', 5000000, '2026-10-24 18:00:00+07', 'Transfer bank', '[CONTOH] Pelunasan sebelum tampil.', 'da000000-0000-4000-8000-000000000002', v_owner),
    ('d9000000-0000-4000-8000-000000000003', 'd5000000-0000-4000-8000-000000000002', 'deposit', 3000000, '2026-11-01 16:15:00+07', 'Transfer bank', '[CONTOH] DP 30 persen.', 'da000000-0000-4000-8000-000000000003', v_owner)
  on conflict(id) do nothing;

  insert into public.payouts(id, recipient_hunter_id, amount, paid_at, method, notes, idempotency_key, created_by) values
    ('db000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000001', 400000, '2026-10-26 10:00:00+07', 'Transfer bank', '[CONTOH] Fee hunter telah dibayar.', 'dc000000-0000-4000-8000-000000000001', v_owner)
  on conflict(id) do nothing;

  insert into public.payout_allocations(payout_id, fee_allocation_id, amount) values
    ('db000000-0000-4000-8000-000000000001', v_hunter_allocation, 400000)
  on conflict do nothing;

  insert into public.cash_transactions(id, cash_account_id, category_id, direction, amount, transacted_at, description, source_client_payment_id, idempotency_key, created_by) values
    ('dd000000-0000-4000-8000-000000000001', v_cash_account, v_income_category, 'income', 3000000, '2026-09-12 14:10:00+07', '[CONTOH] DP Festival Musik Akhir Pekan', 'd9000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', v_owner),
    ('dd000000-0000-4000-8000-000000000002', v_cash_account, v_income_category, 'income', 5000000, '2026-10-24 18:00:00+07', '[CONTOH] Pelunasan Festival Musik Akhir Pekan', 'd9000000-0000-4000-8000-000000000002', 'de000000-0000-4000-8000-000000000002', v_owner),
    ('dd000000-0000-4000-8000-000000000003', v_cash_account, v_expense_category, 'expense', 650000, '2026-10-24 16:00:00+07', '[CONTOH] Transportasi dan konsumsi tim', null, 'de000000-0000-4000-8000-000000000003', v_owner)
  on conflict(id) do nothing;

  insert into public.notifications(id, recipient_id, title, body, kind, entity_type, entity_id, read_at, created_at) values
    ('df000000-0000-4000-8000-000000000001', v_owner, '[CONTOH] Jadwal baru dikonfirmasi', 'Corporate Night telah dikonfirmasi untuk 28 November 2026.', 'event_confirmed', 'event', 'd5000000-0000-4000-8000-000000000002', null, '2026-11-01 16:00:00+07'),
    ('df000000-0000-4000-8000-000000000002', v_owner, '[CONTOH] Pembayaran diterima', 'DP Corporate Night sebesar Rp3.000.000 telah tercatat.', 'payment_received', 'event', 'd5000000-0000-4000-8000-000000000002', '2026-11-01 17:00:00+07', '2026-11-01 16:15:00+07'),
    ('df000000-0000-4000-8000-000000000003', v_owner, '[CONTOH] Follow-up penawaran', 'Hubungi PIC Koplo Friday Session untuk finalisasi harga.', 'event_reminder', 'event', 'd5000000-0000-4000-8000-000000000003', null, '2026-11-14 09:00:00+07')
  on conflict(id) do nothing;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, new_data, created_at) values
    (v_owner, 'demo_dataset.create', 'event', 'd5000000-0000-4000-8000-000000000001', jsonb_build_object('label', '[CONTOH]', 'status', 'completed'), '2026-10-25 09:00:00+07'),
    (v_owner, 'demo_dataset.create', 'event', 'd5000000-0000-4000-8000-000000000002', jsonb_build_object('label', '[CONTOH]', 'status', 'confirmed'), '2026-11-02 09:00:00+07');

  insert into public.app_settings(key, value, updated_by) values
    ('demo_dataset', jsonb_build_object('installed', true, 'label', '[CONTOH]', 'version', 1, 'description', 'Dataset panduan awal Koplo Disko'), v_owner)
  on conflict(key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
end $$;
