
CREATE TABLE public.hotel_loyalty_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  visit_goal integer NOT NULL DEFAULT 10,
  reward_type text NOT NULL DEFAULT 'percent_discount',
  reward_description text NOT NULL DEFAULT '10% Off',
  reward_value numeric NOT NULL DEFAULT 10,
  min_bill_value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(hotel_id)
);

ALTER TABLE public.hotel_loyalty_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage loyalty config"
  ON public.hotel_loyalty_configs FOR ALL TO authenticated
  USING (hotel_id = get_user_hotel_id(auth.uid()) AND has_role(auth.uid(), 'owner'))
  WITH CHECK (hotel_id = get_user_hotel_id(auth.uid()) AND has_role(auth.uid(), 'owner'));

CREATE POLICY "Hotel members can view loyalty config"
  ON public.hotel_loyalty_configs FOR SELECT TO authenticated
  USING (hotel_id = get_user_hotel_id(auth.uid()));

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS visit_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS rewards_claimed integer NOT NULL DEFAULT 0;
