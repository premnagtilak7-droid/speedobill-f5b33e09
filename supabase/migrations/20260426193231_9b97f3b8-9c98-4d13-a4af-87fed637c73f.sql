-- 1. waiter_calls -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.waiter_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL,
  table_id uuid NOT NULL,
  table_number integer NOT NULL,
  request_type text NOT NULL DEFAULT 'other',
  message text NOT NULL DEFAULT '',
  guest_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waiter_calls_hotel_status
  ON public.waiter_calls (hotel_id, status, created_at DESC);

ALTER TABLE public.waiter_calls ENABLE ROW LEVEL SECURITY;

-- Guests (anon + authenticated) may create a call for a real table in that hotel.
CREATE POLICY "Anyone can create a waiter call for a valid table"
ON public.waiter_calls
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurant_tables t
    WHERE t.id = waiter_calls.table_id
      AND t.hotel_id = waiter_calls.hotel_id
  )
);

-- Staff of the hotel can view their hotel's waiter calls.
CREATE POLICY "Hotel members can view waiter calls"
ON public.waiter_calls
FOR SELECT
TO authenticated
USING (hotel_id = public.get_user_hotel_id(auth.uid()));

-- Staff of the hotel can update (acknowledge / mark done).
CREATE POLICY "Hotel members can update waiter calls"
ON public.waiter_calls
FOR UPDATE
TO authenticated
USING (hotel_id = public.get_user_hotel_id(auth.uid()))
WITH CHECK (hotel_id = public.get_user_hotel_id(auth.uid()));

-- Owners can purge old calls.
CREATE POLICY "Owners can delete waiter calls"
ON public.waiter_calls
FOR DELETE
TO authenticated
USING (
  hotel_id = public.get_user_hotel_id(auth.uid())
  AND public.has_role(auth.uid(), 'owner'::app_role)
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.waiter_calls;

-- 2. hotels.waiter_confirms_first -------------------------------------------
ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS waiter_confirms_first boolean NOT NULL DEFAULT false;