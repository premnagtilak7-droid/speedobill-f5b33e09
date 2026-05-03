
-- =============================================
-- 1. Remove staff_pins from Realtime publication
-- =============================================
ALTER PUBLICATION supabase_realtime DROP TABLE staff_pins;

-- =============================================
-- 2. Fix public→authenticated on audit_logs
-- =============================================
DROP POLICY IF EXISTS "Hotel members can insert audit logs" ON audit_logs;
CREATE POLICY "Hotel members can insert audit logs" ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (hotel_id = get_user_hotel_id(auth.uid()));

DROP POLICY IF EXISTS "Owners can view audit logs" ON audit_logs;
CREATE POLICY "Owners can view audit logs" ON audit_logs FOR SELECT TO authenticated
  USING ((hotel_id = get_user_hotel_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role));

-- =============================================
-- 3. Fix public→authenticated on custom_categories
-- =============================================
DROP POLICY IF EXISTS "Hotel members can view categories" ON custom_categories;
CREATE POLICY "Hotel members can view categories" ON custom_categories FOR SELECT TO authenticated
  USING (hotel_id = get_user_hotel_id(auth.uid()));

DROP POLICY IF EXISTS "Owners can delete categories" ON custom_categories;
CREATE POLICY "Owners can delete categories" ON custom_categories FOR DELETE TO authenticated
  USING ((hotel_id = get_user_hotel_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role));

DROP POLICY IF EXISTS "Owners can insert categories" ON custom_categories;
CREATE POLICY "Owners can insert categories" ON custom_categories FOR INSERT TO authenticated
  WITH CHECK ((hotel_id = get_user_hotel_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role));

-- =============================================
-- 4. Fix public→authenticated on daily_expenses
-- =============================================
DROP POLICY IF EXISTS "Owners can delete expenses" ON daily_expenses;
CREATE POLICY "Owners can delete expenses" ON daily_expenses FOR DELETE TO authenticated
  USING ((hotel_id = get_user_hotel_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role));

DROP POLICY IF EXISTS "Owners can insert expenses" ON daily_expenses;
CREATE POLICY "Owners can insert expenses" ON daily_expenses FOR INSERT TO authenticated
  WITH CHECK ((hotel_id = get_user_hotel_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role));

DROP POLICY IF EXISTS "Owners can view expenses" ON daily_expenses;
CREATE POLICY "Owners can view expenses" ON daily_expenses FOR SELECT TO authenticated
  USING ((hotel_id = get_user_hotel_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role));

-- =============================================
-- 5. Fix public→authenticated on kot_items
-- =============================================
DROP POLICY IF EXISTS "Hotel members can insert KOT items" ON kot_items;
CREATE POLICY "Hotel members can insert KOT items" ON kot_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM kot_tickets k WHERE k.id = kot_items.kot_id AND k.hotel_id = get_user_hotel_id(auth.uid())));

DROP POLICY IF EXISTS "Hotel members can view KOT items" ON kot_items;
CREATE POLICY "Hotel members can view KOT items" ON kot_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM kot_tickets k WHERE k.id = kot_items.kot_id AND k.hotel_id = get_user_hotel_id(auth.uid())));

-- =============================================
-- 6. Fix public→authenticated on kot_tickets
-- =============================================
DROP POLICY IF EXISTS "Hotel members can insert KOT" ON kot_tickets;
CREATE POLICY "Hotel members can insert KOT" ON kot_tickets FOR INSERT TO authenticated
  WITH CHECK (hotel_id = get_user_hotel_id(auth.uid()));

DROP POLICY IF EXISTS "Hotel members can view KOT" ON kot_tickets;
CREATE POLICY "Hotel members can view KOT" ON kot_tickets FOR SELECT TO authenticated
  USING (hotel_id = get_user_hotel_id(auth.uid()));

-- =============================================
-- 7. Fix public→authenticated on void_reports
-- =============================================
DROP POLICY IF EXISTS "Hotel members can insert void reports" ON void_reports;
CREATE POLICY "Hotel members can insert void reports" ON void_reports FOR INSERT TO authenticated
  WITH CHECK (hotel_id = get_user_hotel_id(auth.uid()));

DROP POLICY IF EXISTS "Owners can view void reports" ON void_reports;
CREATE POLICY "Owners can view void reports" ON void_reports FOR SELECT TO authenticated
  USING ((hotel_id = get_user_hotel_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role));

-- =============================================
-- 8. Fix public→authenticated on upi_qr_codes
-- =============================================
DROP POLICY IF EXISTS "Hotel members can view QR codes" ON upi_qr_codes;
CREATE POLICY "Hotel members can view QR codes" ON upi_qr_codes FOR SELECT TO authenticated
  USING (hotel_id = get_user_hotel_id(auth.uid()));

DROP POLICY IF EXISTS "Owners can delete QR codes" ON upi_qr_codes;
CREATE POLICY "Owners can delete QR codes" ON upi_qr_codes FOR DELETE TO authenticated
  USING ((hotel_id = get_user_hotel_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role));

DROP POLICY IF EXISTS "Owners can insert QR codes" ON upi_qr_codes;
CREATE POLICY "Owners can insert QR codes" ON upi_qr_codes FOR INSERT TO authenticated
  WITH CHECK ((hotel_id = get_user_hotel_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role));

DROP POLICY IF EXISTS "Owners can view QR codes" ON upi_qr_codes;
CREATE POLICY "Owners can view QR codes" ON upi_qr_codes FOR SELECT TO authenticated
  USING ((hotel_id = get_user_hotel_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role));

-- =============================================
-- 9. Fix public→authenticated on licenses
-- =============================================
DROP POLICY IF EXISTS "Admin all access licenses" ON licenses;
CREATE POLICY "Admin all access licenses" ON licenses FOR ALL TO authenticated
  USING (auth.email() = 'speedobill7@gmail.com'::text);

DROP POLICY IF EXISTS "Owners can view their used licenses" ON licenses;
CREATE POLICY "Owners can view their used licenses" ON licenses FOR SELECT TO authenticated
  USING (used_by_hotel_id IS NOT NULL AND used_by_hotel_id IN (SELECT id FROM hotels WHERE owner_id = auth.uid()));

-- =============================================
-- 10. Fix public→authenticated on subscriptions
-- =============================================
DROP POLICY IF EXISTS "Admin full access subscriptions" ON subscriptions;
CREATE POLICY "Admin full access subscriptions" ON subscriptions FOR ALL TO authenticated
  USING (auth.email() = 'speedobill7@gmail.com'::text);

DROP POLICY IF EXISTS "Owners insert subscription" ON subscriptions;
CREATE POLICY "Owners insert subscription" ON subscriptions FOR INSERT TO authenticated
  WITH CHECK (hotel_id IN (SELECT id FROM hotels WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Owners view own subscription" ON subscriptions;
CREATE POLICY "Owners view own subscription" ON subscriptions FOR SELECT TO authenticated
  USING (hotel_id IN (SELECT id FROM hotels WHERE owner_id = auth.uid()));

-- =============================================
-- 11. Add storage policies for qr-codes bucket
-- =============================================
CREATE POLICY "Authenticated users can read qr-codes"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'qr-codes');

CREATE POLICY "Owners can upload qr-codes"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'qr-codes' AND auth.role() = 'authenticated');

CREATE POLICY "Owners can update qr-codes"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'qr-codes' AND auth.role() = 'authenticated');

CREATE POLICY "Owners can delete qr-codes"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'qr-codes' AND auth.role() = 'authenticated');
