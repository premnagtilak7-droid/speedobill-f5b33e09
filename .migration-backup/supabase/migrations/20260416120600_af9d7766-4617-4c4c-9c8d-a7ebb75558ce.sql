
-- ============================================================
-- 1. FIX LICENSES TABLE POLICIES
-- ============================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Admins view own licenses" ON public.licenses;
DROP POLICY IF EXISTS "Admins use licenses" ON public.licenses;

-- Only platform admin can see unused licenses; owners see their own used ones
CREATE POLICY "Platform admin views all licenses"
ON public.licenses FOR SELECT TO authenticated
USING (auth.email() = 'speedobill7@gmail.com');

CREATE POLICY "Owners view own hotel licenses"
ON public.licenses FOR SELECT TO authenticated
USING (
  used_by_hotel_id IS NOT NULL
  AND used_by_hotel_id IN (SELECT id FROM public.hotels WHERE owner_id = auth.uid())
);

-- Only owners can activate an unused license for their hotel
DROP POLICY IF EXISTS "Activate license" ON public.licenses;
CREATE POLICY "Owner activates unused license"
ON public.licenses FOR UPDATE TO authenticated
USING (
  is_used = false
  AND used_by_hotel_id IS NULL
  AND has_role(auth.uid(), 'owner'::app_role)
)
WITH CHECK (
  is_used = true
  AND used_by_hotel_id = get_user_hotel_id(auth.uid())
  AND has_role(auth.uid(), 'owner'::app_role)
);

-- ============================================================
-- 2. FIX USER_ROLES TABLE POLICIES
-- ============================================================

-- Drop all existing policies on user_roles to rebuild cleanly
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_roles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', pol.policyname);
  END LOOP;
END $$;

-- Users can read their own role
CREATE POLICY "Users can view own role"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Owners/managers can view roles of staff in their hotel
CREATE POLICY "Admins can view hotel staff roles"
ON public.user_roles FOR SELECT TO authenticated
USING (
  is_hotel_admin(auth.uid())
  AND user_id IN (
    SELECT p.user_id FROM public.profiles p
    WHERE p.hotel_id = get_user_hotel_id(auth.uid())
  )
);

-- Platform admin full access
CREATE POLICY "Platform admin full access user_roles"
ON public.user_roles FOR ALL TO authenticated
USING (auth.email() = 'speedobill7@gmail.com')
WITH CHECK (auth.email() = 'speedobill7@gmail.com');

-- Only the handle_new_user trigger and create-staff edge function (service role) insert roles.
-- Block all regular user inserts except self-bootstrap (handled by auth-bootstrap which uses service role indirectly).
-- We allow insert only if user is inserting their OWN role AND no role exists yet (first-time bootstrap).
CREATE POLICY "Self bootstrap first role only"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
  )
);

-- No regular user can UPDATE roles
-- No regular user can DELETE roles

-- ============================================================
-- 3. FIX REALTIME CHANNEL AUTHORIZATION
-- ============================================================

-- Enable RLS on realtime.messages
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Restrict realtime subscriptions to user's own hotel topic
CREATE POLICY "Restrict realtime to own hotel"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.topic() = ('hotel:' || get_user_hotel_id(auth.uid())::text)
);

-- ============================================================
-- 4. FIX STORAGE POLICIES - MENU IMAGES
-- ============================================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Allow authenticated users to upload menu images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update menu images" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete menu images" ON storage.objects;

-- Hotel-scoped upload: files must be stored under {hotel_id}/ path
CREATE POLICY "Hotel scoped menu image upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'menu-images'
  AND (storage.foldername(name))[1] = get_user_hotel_id(auth.uid())::text
);

CREATE POLICY "Hotel scoped menu image update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'menu-images'
  AND (storage.foldername(name))[1] = get_user_hotel_id(auth.uid())::text
);

CREATE POLICY "Hotel scoped menu image delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'menu-images'
  AND (storage.foldername(name))[1] = get_user_hotel_id(auth.uid())::text
);

-- ============================================================
-- 5. FIX STORAGE POLICIES - QR CODES
-- ============================================================

DROP POLICY IF EXISTS "Allow authenticated users to upload qr codes" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update qr codes" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete qr codes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload QR codes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update QR codes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete QR codes" ON storage.objects;

CREATE POLICY "Hotel scoped qr code upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'qr-codes'
  AND (storage.foldername(name))[1] = get_user_hotel_id(auth.uid())::text
);

CREATE POLICY "Hotel scoped qr code update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'qr-codes'
  AND (storage.foldername(name))[1] = get_user_hotel_id(auth.uid())::text
);

CREATE POLICY "Hotel scoped qr code delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'qr-codes'
  AND (storage.foldername(name))[1] = get_user_hotel_id(auth.uid())::text
);
