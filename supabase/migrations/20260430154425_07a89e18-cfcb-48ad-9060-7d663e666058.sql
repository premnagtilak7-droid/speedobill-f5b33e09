-- 1. Internal team role enum
DO $$ BEGIN
  CREATE TYPE public.internal_team_role AS ENUM (
    'super_admin',
    'sales_manager',
    'sales_executive',
    'support_agent',
    'tech_lead',
    'finance_manager',
    'marketing_manager'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Internal team table (SpeedoBill company staff)
CREATE TABLE IF NOT EXISTS public.internal_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,                   -- linked when invitee signs up; nullable for pending invites
  email text NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  role public.internal_team_role NOT NULL DEFAULT 'support_agent',
  is_active boolean NOT NULL DEFAULT true,
  invited_by uuid,
  invited_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz,
  last_active_at timestamptz,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS internal_team_user_id_idx ON public.internal_team(user_id);
CREATE INDEX IF NOT EXISTS internal_team_role_idx ON public.internal_team(role);

-- 3. Helper functions (SECURITY DEFINER — avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (
    -- Hardcoded creator email always counts as super admin
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = _user_id AND lower(u.email) = 'speedobill7@gmail.com')
    OR EXISTS (SELECT 1 FROM public.internal_team t WHERE t.user_id = _user_id AND t.role = 'super_admin' AND t.is_active = true)
  )
$$;

CREATE OR REPLACE FUNCTION public.has_internal_role(_user_id uuid, _role public.internal_team_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_team
    WHERE user_id = _user_id AND role = _role AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_internal_team_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (
    public.is_super_admin(_user_id)
    OR EXISTS (SELECT 1 FROM public.internal_team WHERE user_id = _user_id AND is_active = true)
  )
$$;

-- 4. RLS for internal_team
ALTER TABLE public.internal_team ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin manages team" ON public.internal_team;
CREATE POLICY "Super admin manages team" ON public.internal_team
FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Team members view themselves" ON public.internal_team;
CREATE POLICY "Team members view themselves" ON public.internal_team
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 5. Trigger: auto-link user_id when an invited email signs up + maintain updated_at
CREATE OR REPLACE FUNCTION public.update_internal_team_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_internal_team_updated_at ON public.internal_team;
CREATE TRIGGER trg_internal_team_updated_at
BEFORE UPDATE ON public.internal_team
FOR EACH ROW EXECUTE FUNCTION public.update_internal_team_updated_at();

CREATE OR REPLACE FUNCTION public.link_internal_team_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.internal_team
     SET user_id = NEW.id,
         joined_at = COALESCE(joined_at, now())
   WHERE lower(email) = lower(NEW.email)
     AND user_id IS NULL;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_link_internal_team ON auth.users;
CREATE TRIGGER trg_link_internal_team
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.link_internal_team_on_signup();

-- 6. Support tickets table (foundation for Phase 2)
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid,
  raised_by uuid,
  raised_by_name text DEFAULT '',
  raised_by_email text DEFAULT '',
  subject text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  priority text NOT NULL DEFAULT 'normal',  -- low|normal|high|urgent
  status text NOT NULL DEFAULT 'open',      -- open|in_progress|waiting|resolved|closed
  assigned_to uuid,                          -- internal_team.id
  resolution text DEFAULT '',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS support_tickets_assigned_idx ON public.support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS support_tickets_hotel_idx ON public.support_tickets(hotel_id);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin all tickets" ON public.support_tickets;
CREATE POLICY "Super admin all tickets" ON public.support_tickets
FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Support agents manage tickets" ON public.support_tickets;
CREATE POLICY "Support agents manage tickets" ON public.support_tickets
FOR ALL TO authenticated
USING (public.has_internal_role(auth.uid(), 'support_agent') OR public.has_internal_role(auth.uid(), 'tech_lead'))
WITH CHECK (public.has_internal_role(auth.uid(), 'support_agent') OR public.has_internal_role(auth.uid(), 'tech_lead'));

DROP POLICY IF EXISTS "Hotel users insert own tickets" ON public.support_tickets;
CREATE POLICY "Hotel users insert own tickets" ON public.support_tickets
FOR INSERT TO authenticated
WITH CHECK (raised_by = auth.uid());

DROP POLICY IF EXISTS "Hotel users view own tickets" ON public.support_tickets;
CREATE POLICY "Hotel users view own tickets" ON public.support_tickets
FOR SELECT TO authenticated
USING (raised_by = auth.uid());

DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Activity log for internal team (sales follow-ups, support actions, etc.)
CREATE TABLE IF NOT EXISTS public.team_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid REFERENCES public.internal_team(id) ON DELETE SET NULL,
  user_id uuid,
  activity_type text NOT NULL DEFAULT 'note',  -- note|call|email|demo|ticket_update|lead_assigned
  subject text NOT NULL DEFAULT '',
  details text DEFAULT '',
  related_hotel_id uuid,
  related_lead_id uuid,
  related_ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS team_activity_member_idx ON public.team_activity_logs(team_member_id);
CREATE INDEX IF NOT EXISTS team_activity_created_idx ON public.team_activity_logs(created_at DESC);

ALTER TABLE public.team_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin all activities" ON public.team_activity_logs;
CREATE POLICY "Super admin all activities" ON public.team_activity_logs
FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Team members log own activity" ON public.team_activity_logs;
CREATE POLICY "Team members log own activity" ON public.team_activity_logs
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_internal_team_member(auth.uid()));

DROP POLICY IF EXISTS "Team members view own activity" ON public.team_activity_logs;
CREATE POLICY "Team members view own activity" ON public.team_activity_logs
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- 8. Lead assignment column (for sales executives)
ALTER TABLE public.demo_leads
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS assignment_status text DEFAULT 'unassigned',
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz;

-- Allow sales managers to view & assign all leads
DROP POLICY IF EXISTS "Sales team views leads" ON public.demo_leads;
CREATE POLICY "Sales team views leads" ON public.demo_leads
FOR SELECT TO authenticated
USING (
  public.has_internal_role(auth.uid(), 'sales_manager')
  OR public.has_internal_role(auth.uid(), 'sales_executive')
  OR public.has_internal_role(auth.uid(), 'super_admin')
);

DROP POLICY IF EXISTS "Sales managers update leads" ON public.demo_leads;
CREATE POLICY "Sales managers update leads" ON public.demo_leads
FOR UPDATE TO authenticated
USING (
  public.has_internal_role(auth.uid(), 'sales_manager')
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Sales executives update assigned leads" ON public.demo_leads;
CREATE POLICY "Sales executives update assigned leads" ON public.demo_leads
FOR UPDATE TO authenticated
USING (
  public.has_internal_role(auth.uid(), 'sales_executive')
  AND assigned_to = (SELECT id FROM public.internal_team WHERE user_id = auth.uid() LIMIT 1)
);

-- 9. Seed: ensure speedobill7@gmail.com is registered as super_admin (if user already exists)
INSERT INTO public.internal_team (user_id, email, full_name, role, is_active, joined_at)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name','Super Admin'), 'super_admin', true, now()
FROM auth.users u
WHERE lower(u.email) = 'speedobill7@gmail.com'
ON CONFLICT (email) DO UPDATE SET role = 'super_admin', is_active = true, user_id = EXCLUDED.user_id;