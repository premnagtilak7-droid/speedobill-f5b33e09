-- Switch any hotels using webhook mode to manual
UPDATE public.hotels
SET payment_verify_mode = 'manual'
WHERE payment_verify_mode = 'webhook';

-- Replace constraint to disallow 'webhook'
ALTER TABLE public.hotels
  DROP CONSTRAINT IF EXISTS hotels_payment_verify_mode_check;

ALTER TABLE public.hotels
  ADD CONSTRAINT hotels_payment_verify_mode_check
  CHECK (payment_verify_mode IN ('utr', 'manual'));