-- Create admin_notifications table
CREATE TABLE public.admin_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT false,
  navigate_to TEXT NOT NULL DEFAULT '/creator-admin',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_notifications_created_at ON public.admin_notifications(created_at DESC);
CREATE INDEX idx_admin_notifications_is_read ON public.admin_notifications(is_read);

-- Enable RLS
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Policies: only the creator admin can read/manage
CREATE POLICY "Admin can view notifications"
ON public.admin_notifications
FOR SELECT
TO authenticated
USING (auth.email() = 'speedobill7@gmail.com');

CREATE POLICY "Admin can update notifications"
ON public.admin_notifications
FOR UPDATE
TO authenticated
USING (auth.email() = 'speedobill7@gmail.com');

CREATE POLICY "Admin can delete notifications"
ON public.admin_notifications
FOR DELETE
TO authenticated
USING (auth.email() = 'speedobill7@gmail.com');

-- Allow authenticated + anon inserts (so triggers and public demo-lead form can create notifications)
CREATE POLICY "System can insert notifications"
ON public.admin_notifications
FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- Trigger: new demo lead -> notification
CREATE OR REPLACE FUNCTION public.notify_admin_new_demo_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, title, description, navigate_to, metadata)
  VALUES (
    'lead',
    'New demo request from ' || COALESCE(NEW.owner_name, 'Unknown'),
    COALESCE(NEW.restaurant_name, '') || ' • ' || COALESCE(NEW.city, ''),
    '/creator-admin?tab=leads',
    jsonb_build_object('lead_id', NEW.id, 'whatsapp', NEW.whatsapp_number)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_new_demo_lead ON public.demo_leads;
CREATE TRIGGER trg_notify_admin_new_demo_lead
AFTER INSERT ON public.demo_leads
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_demo_lead();

-- Trigger: new hotel -> notification (proxy for new signup)
CREATE OR REPLACE FUNCTION public.notify_admin_new_hotel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, title, description, navigate_to, metadata)
  VALUES (
    'signup',
    'New hotel owner registered',
    COALESCE(NEW.name, 'New Hotel') || ' joined SpeedoBill',
    '/creator-admin?tab=directory',
    jsonb_build_object('hotel_id', NEW.id, 'tier', NEW.subscription_tier)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_new_hotel ON public.hotels;
CREATE TRIGGER trg_notify_admin_new_hotel
AFTER INSERT ON public.hotels
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_hotel();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
ALTER TABLE public.admin_notifications REPLICA IDENTITY FULL;