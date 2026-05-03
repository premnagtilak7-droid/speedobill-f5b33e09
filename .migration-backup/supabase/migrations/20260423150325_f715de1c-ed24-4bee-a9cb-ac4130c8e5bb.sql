-- Switch hotel_code to a unique 6-digit numeric format (e.g., 384172)
-- Update generator function used by the existing trigger
CREATE OR REPLACE FUNCTION public.generate_hotel_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  new_code text;
  attempts int := 0;
BEGIN
  IF NEW.hotel_code IS NULL OR NEW.hotel_code = '' OR NEW.hotel_code !~ '^[0-9]{6}$' THEN
    LOOP
      -- Random number between 100000 and 999999 inclusive
      new_code := LPAD(FLOOR(RANDOM() * 900000 + 100000)::text, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.hotels WHERE hotel_code = new_code);
      attempts := attempts + 1;
      IF attempts > 50 THEN
        RAISE EXCEPTION 'Could not generate unique hotel_code after 50 attempts';
      END IF;
    END LOOP;
    NEW.hotel_code := new_code;
  END IF;
  RETURN NEW;
END;
$function$;

-- Make sure the trigger exists on hotels (idempotent)
DROP TRIGGER IF EXISTS hotels_generate_code_trg ON public.hotels;
CREATE TRIGGER hotels_generate_code_trg
BEFORE INSERT ON public.hotels
FOR EACH ROW
EXECUTE FUNCTION public.generate_hotel_code();

-- Backfill existing hotels that still use the old QB-XXXX format
DO $$
DECLARE
  rec record;
  new_code text;
  attempts int;
BEGIN
  FOR rec IN SELECT id FROM public.hotels WHERE hotel_code !~ '^[0-9]{6}$' LOOP
    attempts := 0;
    LOOP
      new_code := LPAD(FLOOR(RANDOM() * 900000 + 100000)::text, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.hotels WHERE hotel_code = new_code);
      attempts := attempts + 1;
      EXIT WHEN attempts > 50;
    END LOOP;
    UPDATE public.hotels SET hotel_code = new_code WHERE id = rec.id;
  END LOOP;
END $$;