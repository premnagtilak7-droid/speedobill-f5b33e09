
ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS gst_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS business_type text DEFAULT 'Restaurant',
  ADD COLUMN IF NOT EXISTS operating_hours jsonb DEFAULT jsonb_build_object(
    'mon', jsonb_build_object('open', '09:00', 'close', '22:00', 'closed', false),
    'tue', jsonb_build_object('open', '09:00', 'close', '22:00', 'closed', false),
    'wed', jsonb_build_object('open', '09:00', 'close', '22:00', 'closed', false),
    'thu', jsonb_build_object('open', '09:00', 'close', '22:00', 'closed', false),
    'fri', jsonb_build_object('open', '09:00', 'close', '22:00', 'closed', false),
    'sat', jsonb_build_object('open', '09:00', 'close', '22:00', 'closed', false),
    'sun', jsonb_build_object('open', '09:00', 'close', '22:00', 'closed', true)
  ),
  ADD COLUMN IF NOT EXISTS show_gst_on_receipt boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_header_style text NOT NULL DEFAULT 'bold';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT jsonb_build_object(
    'daily_summary', false,
    'low_stock', true,
    'new_order', false
  );
