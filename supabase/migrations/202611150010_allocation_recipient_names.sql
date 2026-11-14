drop view if exists public.fee_allocation_balances;
create view public.fee_allocation_balances with(security_invoker=true) as
select fa.id,fa.fee_split_id,fs.event_id,e.name as event_name,fa.component_key,fa.recipient_member_id,fa.recipient_hunter_id,coalesce(pm.full_name,eh.name,'Kas') as recipient_name,fa.amount,
coalesce(sum(case when p.id is not null and not exists(select 1 from public.payouts rev where rev.reversal_of=p.id) then pa.amount else 0 end),0)::bigint as paid_amount,
(fa.amount-coalesce(sum(case when p.id is not null and not exists(select 1 from public.payouts rev where rev.reversal_of=p.id) then pa.amount else 0 end),0))::bigint as remaining_amount
from public.fee_allocations fa join public.fee_splits fs on fs.id=fa.fee_split_id and fs.is_current join public.events e on e.id=fs.event_id
left join public.profiles pm on pm.id=fa.recipient_member_id left join public.external_hunters eh on eh.id=fa.recipient_hunter_id
left join public.payout_allocations pa on pa.fee_allocation_id=fa.id left join public.payouts p on p.id=pa.payout_id
where fs.status='final' group by fa.id,fs.event_id,e.name,pm.full_name,eh.name;
grant select on public.fee_allocation_balances to authenticated;
