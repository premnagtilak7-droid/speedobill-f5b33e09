-- 1. Lock down admin_notifications insert (remove open policy)
DROP POLICY IF EXISTS "System can insert notifications" ON public.admin_notifications;

CREATE POLICY "Creator admin can insert notifications"
ON public.admin_notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.email() = 'speedobill7@gmail.com'::text);

-- 2. Restrict license activation to assigned hotels
ALTER TABLE public.licenses
ADD COLUMN IF NOT EXISTS assigned_to_hotel_id uuid REFERENCES public.hotels(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Owner activates unused license" ON public.licenses;

CREATE POLICY "Owner activates assigned license"
ON public.licenses
FOR UPDATE
TO authenticated
USING (
  is_used = false
  AND used_by_hotel_id IS NULL
  AND has_role(auth.uid(), 'owner'::app_role)
  AND (
    assigned_to_hotel_id IS NULL
    OR assigned_to_hotel_id = get_user_hotel_id(auth.uid())
  )
)
WITH CHECK (
  is_used = true
  AND used_by_hotel_id = get_user_hotel_id(auth.uid())
  AND has_role(auth.uid(), 'owner'::app_role)
  AND (
    assigned_to_hotel_id IS NULL
    OR assigned_to_hotel_id = get_user_hotel_id(auth.uid())
  )
);

-- 3. Restrict storage bucket listing - keep public read of individual files but prevent listing
-- Drop overly broad SELECT policies on storage.objects for our public buckets
DROP POLICY IF EXISTS "Public read menu-images" ON storage.objects;
DROP POLICY IF EXISTS "Public read qr-codes" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view menu images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view menu images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view qr codes" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view qr codes" ON storage.objects;
DROP POLICY IF EXISTS "Menu images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "QR codes are publicly accessible" ON storage.objects;

-- Authenticated hotel members can list their own folder
CREATE POLICY "Hotel members list own menu-images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'menu-images'
  AND (storage.foldername(name))[1] = get_user_hotel_id(auth.uid())::text
);

CREATE POLICY "Hotel members list own qr-codes"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'qr-codes'
  AND (storage.foldername(name))[1] = get_user_hotel_id(auth.uid())::text
);
