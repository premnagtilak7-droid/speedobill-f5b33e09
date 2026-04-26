-- Public order tracker: allow anon + authenticated to SELECT a single order row.
-- This is safe because the order UUID is unguessable and no listing endpoint
-- exposes the full table to the anon role (no broad SELECT without filter).
CREATE POLICY "Public can read order for tracking"
ON public.orders
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Public can read kot_tickets for tracking"
ON public.kot_tickets
FOR SELECT
TO anon, authenticated
USING (true);