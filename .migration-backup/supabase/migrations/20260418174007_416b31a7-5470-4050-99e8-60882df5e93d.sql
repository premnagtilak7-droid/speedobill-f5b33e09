-- Update the existing demo_leads INSERT trigger to call the new notify-demo-lead function
CREATE OR REPLACE FUNCTION public.notify_demo_lead_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    url := 'https://pkpefscbpyqpafogdbor.supabase.co/functions/v1/notify-demo-lead',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := _payload::text
  );

  return NEW;
exception when others then
  raise warning 'notify_demo_lead_insert failed: %', sqlerrm;
  return NEW;
end;
$function$;

-- Ensure the trigger exists on demo_leads (idempotent)
DROP TRIGGER IF EXISTS demo_leads_notify_insert ON public.demo_leads;
CREATE TRIGGER demo_leads_notify_insert
AFTER INSERT ON public.demo_leads
FOR EACH ROW
EXECUTE FUNCTION public.notify_demo_lead_insert();