-- 1. payment_attempts table
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL,
  table_id uuid,
  table_number integer,
  order_id uuid,
  method text NOT NULL CHECK (method IN ('upi','cash','card','razorpay','request_bill')),
  amount numeric NOT NULL DEFAULT 0,
  tip_amount numeric NOT NULL DEFAULT 0,
  utr text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verifying','verified','rejected','expired')),
  customer_name text DEFAULT '',
  customer_phone text DEFAULT '',
  rejection_reason text,
  verified_by uuid,
  verified_by_name text,
  verified_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_hotel ON public.payment_attempts(hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_utr ON public.payment_attempts(hotel_id, utr) WHERE utr IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_attempts_verified_utr
  ON public.payment_attempts(hotel_id, utr)
  WHERE status = 'verified' AND utr IS NOT NULL;

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

-- Guests (anon + authenticated) may create a payment attempt for a real hotel/table
CREATE POLICY "Guests can create payment attempts"
ON public.payment_attempts
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id)
);

-- Guests can read by exact id (used to poll status from CustomerOrder)
CREATE POLICY "Public can read payment attempts for tracking"
ON public.payment_attempts
FOR SELECT
TO anon, authenticated
USING (true);

-- Hotel staff can update (verify/reject) within their hotel
CREATE POLICY "Hotel members can update payment attempts"
ON public.payment_attempts
FOR UPDATE
TO authenticated
USING (hotel_id = get_user_hotel_id(auth.uid()))
WITH CHECK (hotel_id = get_user_hotel_id(auth.uid()));

-- Hotel staff can also insert (e.g. recording a manual cash payment)
CREATE POLICY "Hotel members can insert payment attempts"
ON public.payment_attempts
FOR INSERT
TO authenticated
WITH CHECK (hotel_id = get_user_hotel_id(auth.uid()));

-- Owners can delete
CREATE POLICY "Owners can delete payment attempts"
ON public.payment_attempts
FOR DELETE
TO authenticated
USING (hotel_id = get_user_hotel_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role));

-- Trigger: auto-update updated_at
CREATE TRIGGER update_payment_attempts_updated_at
BEFORE UPDATE ON public.payment_attempts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER TABLE public.payment_attempts REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'payment_attempts'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_attempts';
  END IF;
END $$;

-- 2. Hotel payment settings
ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS pay_upi_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pay_cash_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pay_card_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pay_razorpay_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pay_request_bill_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tip_options jsonb NOT NULL DEFAULT '[5,10,15]'::jsonb,
  ADD COLUMN IF NOT EXISTS razorpay_key_id text DEFAULT '';