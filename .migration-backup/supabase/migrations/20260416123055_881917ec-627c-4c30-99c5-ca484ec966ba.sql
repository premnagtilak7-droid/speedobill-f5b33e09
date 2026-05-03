
-- Drop the vulnerable INSERT policy
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Recreate with hotel_id restriction:
-- hotel_id must be NULL (bootstrapping) or reference a hotel the user owns
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    hotel_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.hotels WHERE id = profiles.hotel_id AND owner_id = auth.uid()
    )
  )
);
