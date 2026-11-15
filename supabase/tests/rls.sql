begin;
select plan(13);

select has_table('public','events','events tersedia');
select has_table('public','fee_allocations','fee_allocations tersedia');
select has_function('public','finalize_fee_split',array['uuid','jsonb','text'],'RPC finalisasi tersedia');
select has_function('public','record_client_payment',array['uuid','payment_kind','bigint','timestamp with time zone','text','text','uuid'],'RPC pembayaran client tersedia');
select has_function('public','record_payout',array['uuid','uuid','jsonb','timestamp with time zone','text','text','uuid'],'RPC payout tersedia');
select ok((select relrowsecurity from pg_class where oid='public.events'::regclass),'RLS events aktif');
select ok((select relrowsecurity from pg_class where oid='public.fee_allocations'::regclass),'RLS fee aktif');
select ok((select relrowsecurity from pg_class where oid='public.documents'::regclass),'RLS documents aktif');
select has_function('public','get_my_capabilities',array[]::text[],'RPC capability tersedia');
select has_function('public','get_member_fee_report',array['timestamp with time zone','timestamp with time zone'],'RPC laporan fee member tersedia');
select has_function('public','get_management_finance_summary',array[]::text[],'RPC ringkasan keuangan tersedia');
select ok((select relrowsecurity from pg_class where oid='public.invite_attempts'::regclass),'RLS rate limit undangan aktif');
select has_index('public','invite_attempts','invite_attempts_actor_created_idx','Index rate limit tersedia');

select * from finish();
rollback;
