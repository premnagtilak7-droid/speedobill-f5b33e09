
CREATE TABLE public.demo_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  canteen_name TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a demo request (public form)
CREATE POLICY "Anyone can insert demo requests"
ON public.demo_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only creator admin can view demo requests
CREATE POLICY "Creator can view demo requests"
ON public.demo_requests
FOR SELECT
TO authenticated
USING (auth.email() = 'speedobill7@gmail.com');

-- Creator can delete demo requests
CREATE POLICY "Creator can delete demo requests"
ON public.demo_requests
FOR DELETE
TO authenticated
USING (auth.email() = 'speedobill7@gmail.com');
