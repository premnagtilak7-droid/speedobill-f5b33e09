-- 1. Fix profiles UPDATE policy: prevent hotel_id hijacking
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND (
    -- hotel_id must remain unchanged OR be set to a hotel the user owns OR be null
    hotel_id IS NULL
    OR hotel_id = (SELECT p.hotel_id FROM public.profiles p WHERE p.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.hotels h
      WHERE h.id = profiles.hotel_id AND h.owner_id = auth.uid()
    )
  )
);

-- 2. Fix login_attempts INSERT policy: bind to authenticated user's email
DROP POLICY IF EXISTS "Authenticated can log attempts rate limited" ON public.login_attempts;

CREATE POLICY "Authenticated can log attempts rate limited"
ON public.login_attempts
FOR INSERT
TO authenticated
WITH CHECK (
  email = auth.email()
  AND check_login_rate_limit(email)
);