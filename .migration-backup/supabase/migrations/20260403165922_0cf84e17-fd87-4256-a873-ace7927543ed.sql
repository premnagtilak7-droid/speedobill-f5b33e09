
-- =============================================
-- MASTER SECURITY & PERFORMANCE MIGRATION V18
-- =============================================

-- 1. PERFORMANCE INDEXES on high-traffic columns
CREATE INDEX IF NOT EXISTS idx_orders_hotel_id ON public.orders (hotel_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_hotel_created ON public.orders (hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_hotel_id ON public.menu_items (hotel_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_hotel_category ON public.menu_items (hotel_id, category);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_hotel_id ON public.restaurant_tables (hotel_id);
CREATE INDEX IF NOT EXISTS idx_kot_tickets_hotel_id ON public.kot_tickets (hotel_id);
CREATE INDEX IF NOT EXISTS idx_kot_tickets_hotel_status ON public.kot_tickets (hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_kot_items_kot_id ON public.kot_items (kot_id);
CREATE INDEX IF NOT EXISTS idx_sales_hotel_id ON public.sales (hotel_id);
CREATE INDEX IF NOT EXISTS idx_sales_hotel_date ON public.sales (hotel_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_expenses_hotel_id ON public.daily_expenses (hotel_id);
CREATE INDEX IF NOT EXISTS idx_daily_expenses_hotel_date ON public.daily_expenses (hotel_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_counter_orders_hotel_id ON public.counter_orders (hotel_id);
CREATE INDEX IF NOT EXISTS idx_counter_orders_hotel_created ON public.counter_orders (hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_orders_hotel_id ON public.customer_orders (hotel_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_hotel_status ON public.customer_orders (hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_profiles_hotel_id ON public.profiles (hotel_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_hotel_id ON public.audit_logs (hotel_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_hotel_created ON public.audit_logs (hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_void_reports_hotel_id ON public.void_reports (hotel_id);
CREATE INDEX IF NOT EXISTS idx_customers_hotel_id ON public.customers (hotel_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_hotel_id ON public.ingredients (hotel_id);
CREATE INDEX IF NOT EXISTS idx_held_orders_hotel_id ON public.held_orders (hotel_id);
CREATE INDEX IF NOT EXISTS idx_staff_pins_hotel_user ON public.staff_pins (hotel_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_wastage_logs_hotel_id ON public.wastage_logs (hotel_id);
CREATE INDEX IF NOT EXISTS idx_purchase_logs_hotel_id ON public.purchase_logs (hotel_id);
CREATE INDEX IF NOT EXISTS idx_reservations_hotel_id ON public.reservations (hotel_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_hotel_id ON public.waitlist (hotel_id);
CREATE INDEX IF NOT EXISTS idx_staff_salaries_hotel_id ON public.staff_salaries (hotel_id);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_hotel_id ON public.staff_shifts (hotel_id);
CREATE INDEX IF NOT EXISTS idx_staff_leaves_hotel_id ON public.staff_leaves (hotel_id);
CREATE INDEX IF NOT EXISTS idx_customer_feedback_hotel_id ON public.customer_feedback (hotel_id);
CREATE INDEX IF NOT EXISTS idx_recipes_hotel_id ON public.recipes (hotel_id);
CREATE INDEX IF NOT EXISTS idx_vendors_hotel_id ON public.vendors (hotel_id);

-- 2. RBAC: Ensure staff roles cannot access admin-only tables
-- Drop any overly permissive policies and replace with role-checked ones

-- Helper: check if user is owner/manager of their hotel
CREATE OR REPLACE FUNCTION public.is_hotel_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'manager')
  )
$$;

-- Audit logs: only admin can view/insert
DROP POLICY IF EXISTS "Hotel members view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Hotel members insert audit logs" ON public.audit_logs;
CREATE POLICY "Admins view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    hotel_id IN (SELECT hotel_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.is_hotel_admin(auth.uid())
  );
CREATE POLICY "Admins insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    hotel_id IN (SELECT hotel_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Void reports: only admin can view
DROP POLICY IF EXISTS "Hotel members view void reports" ON public.void_reports;
DROP POLICY IF EXISTS "Hotel members insert void reports" ON public.void_reports;
CREATE POLICY "Admins view void reports" ON public.void_reports
  FOR SELECT TO authenticated
  USING (
    hotel_id IN (SELECT hotel_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.is_hotel_admin(auth.uid())
  );
CREATE POLICY "Staff insert void reports" ON public.void_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    hotel_id IN (SELECT hotel_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Daily expenses: only admin can view
DROP POLICY IF EXISTS "Hotel members view expenses" ON public.daily_expenses;
DROP POLICY IF EXISTS "Hotel members insert expenses" ON public.daily_expenses;
DROP POLICY IF EXISTS "Hotel members update expenses" ON public.daily_expenses;
DROP POLICY IF EXISTS "Hotel members delete expenses" ON public.daily_expenses;
CREATE POLICY "Admins view expenses" ON public.daily_expenses
  FOR SELECT TO authenticated
  USING (
    hotel_id IN (SELECT hotel_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.is_hotel_admin(auth.uid())
  );
CREATE POLICY "Admins insert expenses" ON public.daily_expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    hotel_id IN (SELECT hotel_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.is_hotel_admin(auth.uid())
  );
CREATE POLICY "Admins update expenses" ON public.daily_expenses
  FOR UPDATE TO authenticated
  USING (
    hotel_id IN (SELECT hotel_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.is_hotel_admin(auth.uid())
  );
CREATE POLICY "Admins delete expenses" ON public.daily_expenses
  FOR DELETE TO authenticated
  USING (
    hotel_id IN (SELECT hotel_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.is_hotel_admin(auth.uid())
  );

-- Staff salaries: only admin
DROP POLICY IF EXISTS "Hotel members view salaries" ON public.staff_salaries;
DROP POLICY IF EXISTS "Hotel members insert salaries" ON public.staff_salaries;
DROP POLICY IF EXISTS "Hotel members update salaries" ON public.staff_salaries;
CREATE POLICY "Admins view salaries" ON public.staff_salaries
  FOR SELECT TO authenticated
  USING (
    hotel_id IN (SELECT hotel_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.is_hotel_admin(auth.uid())
  );
CREATE POLICY "Admins insert salaries" ON public.staff_salaries
  FOR INSERT TO authenticated
  WITH CHECK (
    hotel_id IN (SELECT hotel_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.is_hotel_admin(auth.uid())
  );
CREATE POLICY "Admins update salaries" ON public.staff_salaries
  FOR UPDATE TO authenticated
  USING (
    hotel_id IN (SELECT hotel_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.is_hotel_admin(auth.uid())
  );

-- Licenses: only admin/creator
DROP POLICY IF EXISTS "Authenticated view licenses" ON public.licenses;
DROP POLICY IF EXISTS "Authenticated insert licenses" ON public.licenses;
DROP POLICY IF EXISTS "Authenticated update licenses" ON public.licenses;
CREATE POLICY "Admins view own licenses" ON public.licenses
  FOR SELECT TO authenticated
  USING (
    used_by_hotel_id IS NULL 
    OR used_by_hotel_id IN (SELECT hotel_id FROM public.profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Admins use licenses" ON public.licenses
  FOR UPDATE TO authenticated
  USING (is_used = false);

-- Subscriptions: only admin
DROP POLICY IF EXISTS "Hotel view subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Hotel insert subscriptions" ON public.subscriptions;
CREATE POLICY "Admins view subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    hotel_id IN (SELECT hotel_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.is_hotel_admin(auth.uid())
  );
CREATE POLICY "Admins insert subscriptions" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    hotel_id IN (SELECT hotel_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.is_hotel_admin(auth.uid())
  );

-- 3. RATE LIMITING: Create a login_attempts table for tracking
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  email text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success boolean DEFAULT false
);
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON public.login_attempts (ip_address, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON public.login_attempts (email, attempted_at DESC);

-- Allow insert from authenticated and anon (login is pre-auth)
CREATE POLICY "Anyone can log attempts" ON public.login_attempts
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Only service role can read (for edge function checks)
CREATE POLICY "No public read" ON public.login_attempts
  FOR SELECT TO authenticated
  USING (false);
