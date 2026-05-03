DROP POLICY IF EXISTS "Authenticated users can view active broadcasts" ON public.broadcasts;

CREATE POLICY "Staff can view broadcasts targeted to their role"
ON public.broadcasts
FOR SELECT
TO authenticated
USING (
  (expires_at IS NULL OR expires_at > now())
  AND (
    (target_owners   = true AND public.has_role(auth.uid(), 'owner'))
    OR (target_managers = true AND public.has_role(auth.uid(), 'manager'))
    OR (target_chefs    = true AND public.has_role(auth.uid(), 'chef'))
    OR (target_waiters  = true AND public.has_role(auth.uid(), 'waiter'))
  )
);