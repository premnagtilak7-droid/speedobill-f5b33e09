
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  hotel_id UUID NOT NULL,
  onesignal_player_id TEXT NOT NULL,
  device_info JSONB DEFAULT '{}'::jsonb,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, onesignal_player_id)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_hotel ON public.push_subscriptions(hotel_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own push subscriptions select"
ON public.push_subscriptions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR (hotel_id = public.get_user_hotel_id(auth.uid()) AND public.is_hotel_admin(auth.uid())));

CREATE POLICY "Users insert their own push subscriptions"
ON public.push_subscriptions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND hotel_id = public.get_user_hotel_id(auth.uid()));

CREATE POLICY "Users update their own push subscriptions"
ON public.push_subscriptions FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete their own push subscriptions"
ON public.push_subscriptions FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER update_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
