create or replace function public.protect_event_financial_fields() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.contract_value is distinct from old.contract_value and (exists(select 1 from public.fee_splits where event_id=old.id and is_current) or exists(select 1 from public.client_payments where event_id=old.id)) then raise exception 'Nilai kontrak tidak dapat diubah setelah pembagian fee atau pembayaran tercatat';end if;
 return new;
end $$;
drop trigger if exists events_protect_finance on public.events;
create trigger events_protect_finance before update on public.events for each row execute function public.protect_event_financial_fields();
