create or replace function public.set_updated_at() returns trigger language plpgsql set search_path=public,pg_temp as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at before update on public.events for each row execute function public.set_updated_at();

create or replace function public.notify_event_change() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_title text; v_body text; v_kind text;
begin
  if new.booking_status is distinct from old.booking_status then
    v_kind:=case when new.booking_status='cancelled' then 'event_cancelled' when new.booking_status='confirmed' then 'event_confirmed' else 'event_changed' end;
    v_title:=case when new.booking_status='cancelled' then 'Event dibatalkan' when new.booking_status='confirmed' then 'Event dikonfirmasi' else 'Status event berubah' end;
    v_body:=new.name||' memiliki perubahan status.';
  elsif new.starts_at is distinct from old.starts_at or new.location is distinct from old.location then v_kind:='event_changed';v_title:='Jadwal berubah';v_body:=new.name||' memiliki perubahan waktu atau lokasi.';
  else return new; end if;
  insert into public.notifications(recipient_id,title,body,kind,entity_type,entity_id)
  select distinct member_id,v_title,v_body,v_kind,'event',new.id from public.event_assignments where event_id=new.id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,old_data,new_data) values(auth.uid(),'event.update','event',new.id,to_jsonb(old),to_jsonb(new));
  return new;
end $$;
drop trigger if exists events_notify_change on public.events;
create trigger events_notify_change after update on public.events for each row execute function public.notify_event_change();

create or replace function public.notify_new_assignment() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_name text;
begin
  select name into v_name from public.events where id=new.event_id;
  insert into public.notifications(recipient_id,title,body,kind,entity_type,entity_id) values(new.member_id,'Jadwal baru','Anda ditugaskan pada '||v_name||'.','event_assigned','event',new.event_id);
  return new;
end $$;
drop trigger if exists assignments_notify_insert on public.event_assignments;
create trigger assignments_notify_insert after insert on public.event_assignments for each row execute function public.notify_new_assignment();

create or replace function public.audit_document_change() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin insert into public.audit_logs(actor_id,action,entity_type,entity_id,old_data,new_data) values(auth.uid(),'document.update','document',new.id,to_jsonb(old),to_jsonb(new));return new;end $$;
drop trigger if exists documents_audit_update on public.documents;
create trigger documents_audit_update after update on public.documents for each row execute function public.audit_document_change();
