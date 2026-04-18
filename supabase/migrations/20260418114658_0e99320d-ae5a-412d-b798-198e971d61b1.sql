-- Trigger: notify the team via the notify-demo-request Edge Function
-- whenever a new row is inserted into demo_leads.

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_demo_lead_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _payload jsonb;
begin
  _payload := jsonb_build_object(
    'type', 'INSERT',
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', to_jsonb(NEW)
  );

  perform extensions.http_post(
    url := 'https://pkpefscbpyqpafogdbor.supabase.co/functions/v1/notify-demo-request',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := _payload::text
  );

  return NEW;
exception when others then
  -- Never block the insert if the notification fails
  raise warning 'notify_demo_lead_insert failed: %', sqlerrm;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_demo_lead_insert on public.demo_leads;

create trigger trg_notify_demo_lead_insert
after insert on public.demo_leads
for each row
execute function public.notify_demo_lead_insert();
