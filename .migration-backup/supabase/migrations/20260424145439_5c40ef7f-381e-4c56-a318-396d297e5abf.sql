-- Ensure pg_net is available for outbound HTTP from triggers
create extension if not exists pg_net with schema extensions;

-- Store the edge function URL + service role key for trigger use.
-- We use Postgres' GUC system (current_setting) via a small helper table to avoid
-- exposing the service role inside trigger source code or app settings UI.
create table if not exists public._internal_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public._internal_config enable row level security;

-- No policies: only the service role (which bypasses RLS) can read/write this.
revoke all on public._internal_config from anon, authenticated;

-- Seed the configuration values used by the trigger
insert into public._internal_config (key, value)
values
  ('send_push_url', 'https://pkpefscbpyqpafogdbor.supabase.co/functions/v1/send-push')
on conflict (key) do update set value = excluded.value, updated_at = now();

-- The service role key is read from a vault-style row.
-- IMPORTANT: this row stores the SUPABASE_SERVICE_ROLE_KEY so pg_net can
-- authenticate the internal call. It is protected by RLS (no policies + revoked grants).
-- The user must insert it once via the SQL editor (see notes after migration).

-- Trigger function: fires after a new order is inserted.
create or replace function public.notify_new_order_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _url text;
  _service_key text;
  _table_number text;
  _payload jsonb;
begin
  -- Resolve config
  select value into _url
    from public._internal_config where key = 'send_push_url';
  select value into _service_key
    from public._internal_config where key = 'send_push_service_key';

  if _url is null or _service_key is null then
    -- Configuration missing; skip silently to avoid blocking the insert
    raise log 'notify_new_order_push: missing send_push_url or send_push_service_key';
    return new;
  end if;

  -- Resolve human-readable table number for the message
  select rt.table_number::text into _table_number
    from public.restaurant_tables rt
    where rt.id = new.table_id;

  _payload := jsonb_build_object(
    'title', '🔔 New Order',
    'message', 'Table ' || coalesce(_table_number, '?') ||
               ' — ₹' || coalesce(round(new.total)::text, '0'),
    'roles', jsonb_build_array('chef', 'owner'),
    'hotelId', new.hotel_id,
    'url', '/order-history',
    'data', jsonb_build_object(
      'order_id', new.id,
      'hotel_id', new.hotel_id,
      'table_id', new.table_id,
      'table_number', _table_number,
      'total_price', new.total
    )
  );

  perform extensions.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body := _payload::text
  );

  return new;
exception when others then
  raise log 'notify_new_order_push failed: %', sqlerrm;
  return new;
end;
$$;

-- Drop existing trigger if present, then attach
drop trigger if exists trg_notify_new_order_push on public.orders;

create trigger trg_notify_new_order_push
after insert on public.orders
for each row
execute function public.notify_new_order_push();