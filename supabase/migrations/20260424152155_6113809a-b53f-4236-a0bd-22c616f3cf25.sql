-- Drop the order-insert trigger that called the push edge function
drop trigger if exists trg_notify_new_order_push on public.orders;

-- Drop the trigger function
drop function if exists public.notify_new_order_push();

-- Drop helper config table (held the send-push URL + service key)
drop table if exists public._internal_config;

-- Drop OneSignal device subscription mapping table
drop table if exists public.push_subscriptions;