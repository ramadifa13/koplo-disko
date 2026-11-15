insert into public.positions(name) values
  ('Manager'),('MC 2'),('DJ'),('Soundman')
on conflict(name) do nothing;

insert into public.event_types(name) values
  ('Cafe Regular'),('Cafe Non-Regular'),('Event'),('Festival'),
  ('Private'),('Corporate'),('Wedding'),('Lainnya')
on conflict(name) do nothing;

insert into public.cash_accounts(name) values('Kas Utama')
on conflict(name) do nothing;

insert into public.cash_categories(name,direction) values
  ('Alokasi Fee','income'),('Operasional','expense'),
  ('Peralatan','expense'),('Koreksi','income')
on conflict(name) do nothing;

insert into public.fee_templates(name) values('Pembagian Standar')
on conflict(name) do nothing;

insert into public.fee_template_items(
  template_id,component_key,calculation_type,value,sort_order
)
select template.id,item.component_key,item.calculation_type,item.value,item.sort_order
from public.fee_templates template
cross join (values
  ('manager','percentage',1500::bigint,1),
  ('hunter','percentage',500::bigint,2),
  ('cash','percentage',500::bigint,3),
  ('dj','fixed',300000::bigint,4),
  ('mc2','fixed',250000::bigint,5),
  ('soundman','fixed',150000::bigint,6),
  ('mc1','remainder',0::bigint,7)
) as item(component_key,calculation_type,value,sort_order)
where template.name='Pembagian Standar'
on conflict(template_id,component_key) do nothing;

insert into public.app_settings(key,value) values(
  'organization',
  jsonb_build_object(
    'name','Koplo Disko','timezone','Asia/Jakarta','locale','id-ID'
  )
)
on conflict(key) do nothing;
