-- Remove overly permissive policies on qr-codes bucket
DROP POLICY IF EXISTS "Authenticated users can read qr-codes" ON storage.objects;
DROP POLICY IF EXISTS "Hotel scoped qr-codes read" ON storage.objects;
DROP POLICY IF EXISTS "Hotel members list own qr-codes" ON storage.objects;

-- Remove duplicate non-owner-restricted write policies (keep the owner-restricted ones)
DROP POLICY IF EXISTS "Hotel scoped qr code upload" ON storage.objects;
DROP POLICY IF EXISTS "Hotel scoped qr code update" ON storage.objects;
DROP POLICY IF EXISTS "Hotel scoped qr code delete" ON storage.objects;