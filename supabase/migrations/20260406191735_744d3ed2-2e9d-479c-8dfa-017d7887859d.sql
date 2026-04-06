ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS logo_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS upi_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS receipt_footer text DEFAULT 'Thank you! Visit again.';