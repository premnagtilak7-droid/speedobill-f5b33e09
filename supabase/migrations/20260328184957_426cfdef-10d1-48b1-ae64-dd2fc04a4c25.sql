-- Remove unsafe anonymous/public policies tied to QR flow and staff profile updates
DROP POLICY IF EXISTS "Anon can read table by id" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Anyone can place customer orders" ON public.customer_orders;
DROP POLICY IF EXISTS "Anon can read own table orders" ON public.customer_orders;
DROP POLICY IF EXISTS "Anon can send service requests" ON public.service_calls;
DROP POLICY IF EXISTS "Owners can update staff status" ON public.profiles;

-- Recreate staff update policy scoped to authenticated users only
CREATE POLICY "Owners can update staff status"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  hotel_id = public.get_user_hotel_id(auth.uid())
  AND public.has_role(auth.uid(), 'owner'::public.app_role)
  AND user_id <> auth.uid()
);