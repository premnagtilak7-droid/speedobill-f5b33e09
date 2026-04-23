ALTER TABLE public.demo_leads
  ADD COLUMN IF NOT EXISTS number_of_tables integer,
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS preferred_contact_time text;