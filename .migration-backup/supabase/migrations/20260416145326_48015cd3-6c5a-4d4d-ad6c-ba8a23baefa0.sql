
-- 1. Fix check_login_rate_limit: STABLE → VOLATILE to prevent caching
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(_email text)
 RETURNS boolean
 LANGUAGE sql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT (
    SELECT count(*) FROM public.login_attempts
    WHERE email = _email
      AND attempted_at > (now() - interval '1 minute')
  ) < 10
$$;

-- 2. Remove anon INSERT policy on login_attempts, replace with authenticated-only
DROP POLICY IF EXISTS "Anon can log attempts rate limited" ON public.login_attempts;

CREATE POLICY "Authenticated can log attempts rate limited"
ON public.login_attempts
FOR INSERT
TO authenticated
WITH CHECK (public.check_login_rate_limit(email));

-- 3. Fix user_roles self-bootstrap: remove 'manager' from allowed self-assign roles
DROP POLICY IF EXISTS "Self bootstrap first role only" ON public.user_roles;

CREATE POLICY "Self bootstrap first role only"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role IN ('waiter', 'chef')
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
  )
);
