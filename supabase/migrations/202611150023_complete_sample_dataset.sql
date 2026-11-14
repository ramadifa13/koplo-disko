do $$
declare
  v_owner uuid;
  v_manager uuid;
  v_mc uuid;
  v_dj uuid;
  v_soundman uuid;
  v_event_type uuid;
  v_cafe_type uuid;
  v_owner_pos uuid;
  v_manager_pos uuid;
  v_mc_pos uuid;
  v_dj_pos uuid;
  v_soundman_pos uuid;
  v_cash_account uuid;
  v_income_category uuid;
  v_expense_category uuid;
begin
  select p.id into v_owner from public.profiles p join public.user_roles ur on ur.user_id=p.id join public.roles r on r.id=ur.role_id where r.key='owner' limit 1;
  select id into v_manager from public.profiles where email='manager@koplodisko.com';
  select id into v_mc from public.profiles where email='mc@koplodisko.com';
  select id into v_dj from public.profiles where email='dj@koplodisko.com';
  select id into v_soundman from public.profiles where email='soundman@koplodisko.com';
  if num_nulls(v_owner,v_manager,v_mc,v_dj,v_soundman)>0 then raise exception 'Akun contoh belum lengkap'; end if;

  select id into v_event_type from public.event_types where name='Event';
  select id into v_cafe_type from public.event_types where name='Cafe Regular';
  select id into v_owner_pos from public.positions where name='Owner / MC 1';
  select id into v_manager_pos from public.positions where name='Manager';
  select id into v_mc_pos from public.positions where name='MC 2';
  select id into v_dj_pos from public.positions where name='DJ';
  select id into v_soundman_pos from public.positions where name='Soundman';
  select id into v_cash_account from public.cash_accounts where name='Kas Utama';
  select id into v_income_category from public.cash_categories where name='Alokasi Fee';
  select id into v_expense_category from public.cash_categories where name='Operasional';

  insert into public.venues(id,name,location,maps_url) values
    ('f1000000-0000-4000-8000-000000000001','Hutan Kota by Plataran','Gelora, Jakarta Pusat','https://maps.google.com/?q=Hutan+Kota+by+Plataran'),
    ('f1000000-0000-4000-8000-000000000002','The Pallas','SCBD, Jakarta Selatan','https://maps.google.com/?q=The+Pallas+Jakarta'),
    ('f1000000-0000-4000-8000-000000000003','Kopi Nako','Depok, Jawa Barat','https://maps.google.com/?q=Kopi+Nako+Depok');

  insert into public.events(id,name,venue_id,location,event_type_id,starts_at,duration_minutes,contract_value,booking_status,maps_url,client_pic,client_contact,notes,created_by) values
    ('f2000000-0000-4000-8000-000000000001','Festival Musik Akhir Pekan','f1000000-0000-4000-8000-000000000001','Gelora, Jakarta Pusat',v_event_type,'2026-10-24 20:00:00+07',120,8000000,'completed','https://maps.google.com/?q=Hutan+Kota+by+Plataran','Nadia Pratama','081211110001','Acara selesai dan seluruh pembayaran klien sudah diterima.',v_manager),
    ('f2000000-0000-4000-8000-000000000002','Corporate Night','f1000000-0000-4000-8000-000000000002','SCBD, Jakarta Selatan',v_event_type,'2026-11-28 19:30:00+07',150,10000000,'confirmed','https://maps.google.com/?q=The+Pallas+Jakarta','Raka Mahendra','081211110002','Persiapan soundcheck pukul 17.00 WIB.',v_manager),
    ('f2000000-0000-4000-8000-000000000003','Koplo Friday Session','f1000000-0000-4000-8000-000000000003','Depok, Jawa Barat',v_cafe_type,'2026-12-04 21:00:00+07',90,6500000,'negotiation','https://maps.google.com/?q=Kopi+Nako+Depok','Salsa Amalia','081211110003','Menunggu persetujuan final rundown.',v_manager),
    ('f2000000-0000-4000-8000-000000000004','Wedding After Party',null,'Bogor, Jawa Barat',v_event_type,'2026-12-19 20:00:00+07',120,12000000,'inquiry',null,'Andra Wijaya','081211110004','Permintaan baru, follow-up tiga hari lagi.',v_manager);

  insert into public.event_assignments(event_id,member_id,position_id)
  select event_id,member_id,position_id from (values
    ('f2000000-0000-4000-8000-000000000001'::uuid,v_owner,v_owner_pos),('f2000000-0000-4000-8000-000000000001'::uuid,v_manager,v_manager_pos),('f2000000-0000-4000-8000-000000000001'::uuid,v_mc,v_mc_pos),('f2000000-0000-4000-8000-000000000001'::uuid,v_dj,v_dj_pos),('f2000000-0000-4000-8000-000000000001'::uuid,v_soundman,v_soundman_pos),
    ('f2000000-0000-4000-8000-000000000002'::uuid,v_owner,v_owner_pos),('f2000000-0000-4000-8000-000000000002'::uuid,v_manager,v_manager_pos),('f2000000-0000-4000-8000-000000000002'::uuid,v_mc,v_mc_pos),('f2000000-0000-4000-8000-000000000002'::uuid,v_dj,v_dj_pos),('f2000000-0000-4000-8000-000000000002'::uuid,v_soundman,v_soundman_pos),
    ('f2000000-0000-4000-8000-000000000003'::uuid,v_manager,v_manager_pos),('f2000000-0000-4000-8000-000000000003'::uuid,v_mc,v_mc_pos),('f2000000-0000-4000-8000-000000000003'::uuid,v_dj,v_dj_pos),('f2000000-0000-4000-8000-000000000003'::uuid,v_soundman,v_soundman_pos)
  ) x(event_id,member_id,position_id);

  insert into public.event_hunters(event_id,external_hunter_id) values
    ('f2000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001'),
    ('f2000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000001');

  insert into public.event_status_history(event_id,old_status,new_status,reason,changed_by,created_at) values
    ('f2000000-0000-4000-8000-000000000001',null,'inquiry','Permintaan klien diterima.',v_manager,'2026-09-10 10:00:00+07'),
    ('f2000000-0000-4000-8000-000000000001','inquiry','confirmed','DP diterima dan tanggal dikunci.',v_manager,'2026-09-12 14:00:00+07'),
    ('f2000000-0000-4000-8000-000000000001','confirmed','completed','Acara selesai sesuai jadwal.',v_manager,'2026-10-24 23:00:00+07'),
    ('f2000000-0000-4000-8000-000000000002','negotiation','confirmed','Penawaran disetujui klien.',v_manager,'2026-11-01 16:00:00+07');

  insert into public.fee_splits(id,event_id,version,status,is_current,contract_snapshot,finalized_at,finalized_by,created_by) values
    ('f3000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001',1,'final',true,8000000,'2026-10-25 09:00:00+07',v_manager,v_manager),
    ('f3000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000002',1,'final',true,10000000,'2026-11-02 09:00:00+07',v_manager,v_manager);

  insert into public.fee_allocations(id,fee_split_id,component_key,recipient_member_id,recipient_hunter_id,is_cash_allocation,amount,percentage_bps) values
    ('f4000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000001','manager',v_manager,null,false,1200000,1500),
    ('f4000000-0000-4000-8000-000000000002','f3000000-0000-4000-8000-000000000001','hunter',null,'e0000000-0000-4000-8000-000000000001',false,400000,500),
    ('f4000000-0000-4000-8000-000000000003','f3000000-0000-4000-8000-000000000001','cash',null,null,true,400000,500),
    ('f4000000-0000-4000-8000-000000000004','f3000000-0000-4000-8000-000000000001','dj',v_dj,null,false,300000,null),
    ('f4000000-0000-4000-8000-000000000005','f3000000-0000-4000-8000-000000000001','mc2',v_mc,null,false,250000,null),
    ('f4000000-0000-4000-8000-000000000006','f3000000-0000-4000-8000-000000000001','soundman',v_soundman,null,false,150000,null),
    ('f4000000-0000-4000-8000-000000000007','f3000000-0000-4000-8000-000000000001','mc1',v_owner,null,false,5300000,null),
    ('f4000000-0000-4000-8000-000000000008','f3000000-0000-4000-8000-000000000002','manager',v_manager,null,false,1500000,1500),
    ('f4000000-0000-4000-8000-000000000009','f3000000-0000-4000-8000-000000000002','hunter',null,'e0000000-0000-4000-8000-000000000001',false,500000,500),
    ('f4000000-0000-4000-8000-00000000000a','f3000000-0000-4000-8000-000000000002','cash',null,null,true,500000,500),
    ('f4000000-0000-4000-8000-00000000000b','f3000000-0000-4000-8000-000000000002','dj',v_dj,null,false,300000,null),
    ('f4000000-0000-4000-8000-00000000000c','f3000000-0000-4000-8000-000000000002','mc2',v_mc,null,false,250000,null),
    ('f4000000-0000-4000-8000-00000000000d','f3000000-0000-4000-8000-000000000002','soundman',v_soundman,null,false,150000,null),
    ('f4000000-0000-4000-8000-00000000000e','f3000000-0000-4000-8000-000000000002','mc1',v_owner,null,false,6800000,null);

  insert into public.client_payments(id,event_id,kind,amount,paid_at,method,notes,idempotency_key,created_by) values
    ('f5000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','deposit',3000000,'2026-09-12 14:10:00+07','Transfer Bank','Uang muka booking.','f6000000-0000-4000-8000-000000000001',v_manager),
    ('f5000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000001','settlement',5000000,'2026-10-24 18:00:00+07','Transfer Bank','Pelunasan sebelum tampil.','f6000000-0000-4000-8000-000000000002',v_manager),
    ('f5000000-0000-4000-8000-000000000003','f2000000-0000-4000-8000-000000000002','deposit',3000000,'2026-11-01 16:15:00+07','Transfer Bank','DP 30 persen.','f6000000-0000-4000-8000-000000000003',v_manager);

  insert into public.payouts(id,recipient_member_id,amount,paid_at,method,notes,idempotency_key,created_by) values
    ('f7000000-0000-4000-8000-000000000001',v_dj,300000,'2026-10-26 10:00:00+07','Transfer Bank','Fee DJ Festival Musik.','f8000000-0000-4000-8000-000000000001',v_manager);
  insert into public.payout_allocations(payout_id,fee_allocation_id,amount) values
    ('f7000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000004',300000);

  insert into public.cash_transactions(id,cash_account_id,category_id,direction,amount,transacted_at,description,source_client_payment_id,idempotency_key,created_by) values
    ('f9000000-0000-4000-8000-000000000001',v_cash_account,v_income_category,'income',3000000,'2026-09-12 14:10:00+07','DP Festival Musik Akhir Pekan','f5000000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001',v_manager),
    ('f9000000-0000-4000-8000-000000000002',v_cash_account,v_income_category,'income',5000000,'2026-10-24 18:00:00+07','Pelunasan Festival Musik Akhir Pekan','f5000000-0000-4000-8000-000000000002','fa000000-0000-4000-8000-000000000002',v_manager),
    ('f9000000-0000-4000-8000-000000000003',v_cash_account,v_expense_category,'expense',650000,'2026-10-24 16:00:00+07','Transportasi dan konsumsi tim',null,'fa000000-0000-4000-8000-000000000003',v_manager);

  insert into public.notifications(recipient_id,title,body,kind,entity_type,entity_id,read_at,created_at)
  select recipient_id,title,body,kind,'event',entity_id,read_at,created_at from (values
    (v_manager,'Jadwal dikonfirmasi','Corporate Night telah dikonfirmasi.','event_confirmed','f2000000-0000-4000-8000-000000000002'::uuid,null::timestamptz,'2026-11-01 16:00:00+07'::timestamptz),
    (v_mc,'Jadwal baru','Anda ditugaskan sebagai MC pada Corporate Night.','event_assigned','f2000000-0000-4000-8000-000000000002'::uuid,null::timestamptz,'2026-11-01 16:05:00+07'::timestamptz),
    (v_dj,'Pembayaran fee tercatat','Fee DJ Festival Musik sebesar Rp300.000 telah dibayar.','fee_paid','f2000000-0000-4000-8000-000000000001'::uuid,null::timestamptz,'2026-10-26 10:00:00+07'::timestamptz),
    (v_soundman,'Jadwal baru','Anda ditugaskan sebagai Soundman pada Corporate Night.','event_assigned','f2000000-0000-4000-8000-000000000002'::uuid,null::timestamptz,'2026-11-01 16:06:00+07'::timestamptz)
  ) n(recipient_id,title,body,kind,entity_id,read_at,created_at);

  insert into public.app_settings(key,value,updated_by) values('demo_dataset',jsonb_build_object('installed',true,'version',2,'accounts',4,'description','Dataset lengkap dengan akun login contoh'),v_owner)
  on conflict(key) do update set value=excluded.value,updated_by=excluded.updated_by,updated_at=now();
end $$;
