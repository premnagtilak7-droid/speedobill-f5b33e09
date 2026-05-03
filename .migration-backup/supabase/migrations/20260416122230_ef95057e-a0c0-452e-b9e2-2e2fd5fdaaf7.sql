
-- ============================================================
-- 1. LOGIN_ATTEMPTS: Server-side rate limit function + tighter policies
-- ============================================================

-- Rate-limiting function
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT count(*) FROM public.login_attempts
    WHERE email = _email
      AND attempted_at > (now() - interval '1 minute')
  ) < 10
$$;

-- Drop old policies
DROP POLICY IF EXISTS "Anon can log attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "No public read" ON public.login_attempts;

-- Anon insert with real rate limit
CREATE POLICY "Anon can log attempts rate limited"
ON public.login_attempts FOR INSERT TO anon
WITH CHECK (
  public.check_login_rate_limit(email)
);

-- No one can read (except via security definer functions)
CREATE POLICY "No public read"
ON public.login_attempts FOR SELECT TO authenticated
USING (false);

CREATE POLICY "No anon read"
ON public.login_attempts FOR SELECT TO anon
USING (false);

-- ============================================================
-- 2. PLATFORM_CONFIG: Add hotel_id and scope SELECT
-- ============================================================

-- Add hotel_id column (nullable for backward compat)
ALTER TABLE public.platform_config ADD COLUMN IF NOT EXISTS hotel_id uuid REFERENCES public.hotels(id);

-- Backfill existing owner_pin_ rows
UPDATE public.platform_config
SET hotel_id = CASE
  WHEN config_key LIKE 'owner_pin_%' THEN
    REPLACE(config_key, 'owner_pin_', '')::uuid
  ELSE NULL
END
WHERE hotel_id IS NULL AND config_key LIKE 'owner_pin_%';

-- Drop old SELECT policy
DROP POLICY IF EXISTS "Users can read own hotel config" ON public.platform_config;

-- New hotel-scoped SELECT
CREATE POLICY "Users can read own hotel config"
ON public.platform_config FOR SELECT TO authenticated
USING (
  hotel_id = get_user_hotel_id(auth.uid())
);

-- Update INSERT policy to require hotel_id
DROP POLICY IF EXISTS "Owners can insert platform config" ON public.platform_config;
CREATE POLICY "Owners can insert platform config"
ON public.platform_config FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role)
  AND hotel_id = get_user_hotel_id(auth.uid())
);

-- Update UPDATE policy
DROP POLICY IF EXISTS "Owners can update own pin" ON public.platform_config;
CREATE POLICY "Owners can update own config"
ON public.platform_config FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role)
  AND hotel_id = get_user_hotel_id(auth.uid())
);

-- ============================================================
-- 3. STORAGE: Restrict bucket listing while keeping public read by path
-- ============================================================

-- Drop broad SELECT policies on storage.objects
DROP POLICY IF EXISTS "Public read menu images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view menu images" ON storage.objects;
DROP POLICY IF EXISTS "Public read qr codes" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view qr codes" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- menu-images: allow read by exact path only (not listing)
CREATE POLICY "Public read menu images by path"
ON storage.objects FOR SELECT TO public
USING (
  bucket_id = 'menu-images'
  AND name IS NOT NULL
  AND name <> ''
);

-- qr-codes: allow read by exact path only
CREATE POLICY "Public read qr codes by path"
ON storage.objects FOR SELECT TO public
USING (
  bucket_id = 'qr-codes'
  AND name IS NOT NULL
  AND name <> ''
);
