ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS sound_box_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sound_box_provider text NOT NULL DEFAULT 'paytm',
  ADD COLUMN IF NOT EXISTS payment_verify_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS razorpay_webhook_secret_set boolean NOT NULL DEFAULT false;

-- payment_verify_mode allowed: 'utr' | 'manual' | 'webhook'
ALTER TABLE public.hotels
  ADD CONSTRAINT hotels_payment_verify_mode_check
  CHECK (payment_verify_mode IN ('utr', 'manual', 'webhook'));