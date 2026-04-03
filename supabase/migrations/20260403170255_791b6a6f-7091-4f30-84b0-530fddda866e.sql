
DROP POLICY IF EXISTS "Anyone can log attempts" ON public.login_attempts;
CREATE POLICY "Anon can log attempts" ON public.login_attempts
  FOR INSERT TO anon
  WITH CHECK (
    attempted_at >= now() - interval '1 minute'
  );
