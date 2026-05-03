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
  select value into _url
    from public._internal_config where key = 'send_push_url';
  select value into _service_key
    from public._internal_config where key = 'send_push_service_key';

  if _url is null or _service_key is null then
    raise log 'notify_new_order_push: missing send_push_url or send_push_service_key';
    return new;
  end if;

  select rt.table_number::text into _table_number
    from public.restaurant_tables rt
    where rt.id = new.table_id;

  _payload := jsonb_build_object(
    'title', '🔔 New Order',
    'message', 'Table ' || coalesce(_table_number, '?') ||
               ' — ₹' || coalesce(round(new.total)::text, '0'),
    'roles', jsonb_build_array('chef', 'owner', 'manager'),
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