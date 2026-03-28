-- Fix 1: Remove overly permissive anon SELECT on hotels
-- The QR ordering flow only needs hotel_id from restaurant_tables, not direct hotel reads
DROP POLICY IF EXISTS "Anon can read hotel by table reference" ON public.hotels;

-- Fix 2: Remove insecure anon INSERT on customers
-- Customer records should only be created by authenticated hotel staff
DROP POLICY IF EXISTS "Anon can insert customers via phone login" ON public.customers;

-- Fix 3: Remove the anon SELECT on customers (already returns false but shouldn't exist)
DROP POLICY IF EXISTS "Anon can read customer by phone and hotel" ON public.customers;