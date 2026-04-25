-- 1. Tighten license activation policy: require explicit assignment to caller's hotel
DROP POLICY IF EXISTS "Owner activates assigned license" ON public.licenses;

CREATE POLICY "Owner activates assigned license"
ON public.licenses
FOR UPDATE
TO authenticated
USING (
  is_used = false
  AND used_by_hotel_id IS NULL
  AND has_role(auth.uid(), 'owner'::app_role)
  AND assigned_to_hotel_id IS NOT NULL
  AND assigned_to_hotel_id = get_user_hotel_id(auth.uid())
)
WITH CHECK (
  is_used = true
  AND used_by_hotel_id = get_user_hotel_id(auth.uid())
  AND has_role(auth.uid(), 'owner'::app_role)
  AND assigned_to_hotel_id = get_user_hotel_id(auth.uid())
);

-- 2. Remove broad menu-images storage policies; keep hotel-scoped ones
DROP POLICY IF EXISTS "Allow upload menu images" ON storage.objects;
DROP POLICY IF EXISTS "Allow update menu images" ON storage.objects;

-- Ensure hotel-scoped policies exist for menu-images (folder = hotel_id)
DROP POLICY IF EXISTS "Hotel scoped menu image upload" ON storage.objects;
DROP POLICY IF EXISTS "Hotel scoped menu image update" ON storage.objects;
DROP POLICY IF EXISTS "Hotel scoped menu image delete" ON storage.objects;
DROP POLICY IF EXISTS "Hotel scoped menu image read" ON storage.objects;

CREATE POLICY "Hotel scoped menu image read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'menu-images');

CREATE POLICY "Hotel scoped menu image upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'menu-images'
  AND (storage.foldername(name))[1] = public.get_user_hotel_id(auth.uid())::text
);

CREATE POLICY "Hotel scoped menu image update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'menu-images'
  AND (storage.foldername(name))[1] = public.get_user_hotel_id(auth.uid())::text
)
WITH CHECK (
  bucket_id = 'menu-images'
  AND (storage.foldername(name))[1] = public.get_user_hotel_id(auth.uid())::text
);

CREATE POLICY "Hotel scoped menu image delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'menu-images'
  AND (storage.foldername(name))[1] = public.get_user_hotel_id(auth.uid())::text
);

-- 3. Remove broad qr-codes policies; replace with hotel-folder-scoped ones
DROP POLICY IF EXISTS "Owners can delete qr-codes" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update qr-codes" ON storage.objects;
DROP POLICY IF EXISTS "Hotel scoped qr-codes upload" ON storage.objects;
DROP POLICY IF EXISTS "Hotel scoped qr-codes update" ON storage.objects;
DROP POLICY IF EXISTS "Hotel scoped qr-codes delete" ON storage.objects;
DROP POLICY IF EXISTS "Hotel scoped qr-codes read" ON storage.objects;

CREATE POLICY "Hotel scoped qr-codes read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'qr-codes');

CREATE POLICY "Hotel scoped qr-codes upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'qr-codes'
  AND (storage.foldername(name))[1] = public.get_user_hotel_id(auth.uid())::text
  AND has_role(auth.uid(), 'owner'::app_role)
);

CREATE POLICY "Hotel scoped qr-codes update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'qr-codes'
  AND (storage.foldername(name))[1] = public.get_user_hotel_id(auth.uid())::text
  AND has_role(auth.uid(), 'owner'::app_role)
)
WITH CHECK (
  bucket_id = 'qr-codes'
  AND (storage.foldername(name))[1] = public.get_user_hotel_id(auth.uid())::text
  AND has_role(auth.uid(), 'owner'::app_role)
);

CREATE POLICY "Hotel scoped qr-codes delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'qr-codes'
  AND (storage.foldername(name))[1] = public.get_user_hotel_id(auth.uid())::text
  AND has_role(auth.uid(), 'owner'::app_role)
);

-- 4. Fix mutable search_path on verify_staff_pin
CREATE OR REPLACE FUNCTION public.verify_staff_pin(input_hotel_id uuid, input_profile_id uuid, input_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = input_profile_id 
    AND hotel_id = input_hotel_id 
    AND staff_pin = input_pin
    AND is_active = true
  );
END;
$function$;