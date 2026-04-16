
CREATE TABLE public.demo_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_name TEXT NOT NULL,
  restaurant_name TEXT NOT NULL,
  city TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.demo_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a demo lead"
ON public.demo_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admin can view demo leads"
ON public.demo_leads
FOR SELECT
TO authenticated
USING (auth.jwt()->>'email' = 'speedobill7@gmail.com');

CREATE POLICY "Admin can delete demo leads"
ON public.demo_leads
FOR DELETE
TO authenticated
USING (auth.jwt()->>'email' = 'speedobill7@gmail.com');
