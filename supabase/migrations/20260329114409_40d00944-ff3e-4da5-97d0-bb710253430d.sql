-- Staff PIN system table
CREATE TABLE public.staff_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.staff_pins ENABLE ROW LEVEL SECURITY;

-- Owners can manage all staff PINs in their hotel
CREATE POLICY "Owners can manage staff pins"
  ON public.staff_pins FOR ALL
  TO authenticated
  USING (hotel_id = get_user_hotel_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (hotel_id = get_user_hotel_id(auth.uid()) AND has_role(auth.uid(), 'owner'::app_role));

-- Staff can view and update their own PIN
CREATE POLICY "Users can view own pin"
  ON public.staff_pins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own pin"
  ON public.staff_pins FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Allow staff to insert their own PIN (first-time setup)
CREATE POLICY "Users can insert own pin"
  ON public.staff_pins FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND hotel_id = get_user_hotel_id(auth.uid()));

-- Add notification_volume to profiles for volume control
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_volume numeric DEFAULT 0.5;

-- Add staff_pins to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE staff_pins;