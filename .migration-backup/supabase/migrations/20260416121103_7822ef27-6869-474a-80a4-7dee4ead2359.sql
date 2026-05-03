
-- Drop the vulnerable policy
DROP POLICY IF EXISTS "Self bootstrap first role only" ON public.user_roles;

-- Recreate with role restriction — only staff roles allowed via self-bootstrap
CREATE POLICY "Self bootstrap first role only"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role IN ('waiter'::app_role, 'chef'::app_role, 'manager'::app_role)
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
  )
);
