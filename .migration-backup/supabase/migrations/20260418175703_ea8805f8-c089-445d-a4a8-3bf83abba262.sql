
-- Broadcasts table for in-app announcements
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  style text NOT NULL DEFAULT 'popup',
  target_owners boolean NOT NULL DEFAULT true,
  target_waiters boolean NOT NULL DEFAULT false,
  target_chefs boolean NOT NULL DEFAULT false,
  target_managers boolean NOT NULL DEFAULT false,
  sent_via_email boolean NOT NULL DEFAULT false,
  email_recipients_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active broadcasts"
ON public.broadcasts FOR SELECT TO authenticated
USING (expires_at > now());

CREATE POLICY "Creator admin manages broadcasts"
ON public.broadcasts FOR ALL TO authenticated
USING (auth.email() = 'speedobill7@gmail.com')
WITH CHECK (auth.email() = 'speedobill7@gmail.com');

-- Track which users have dismissed/seen which broadcast
CREATE TABLE IF NOT EXISTS public.broadcast_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broadcast_id, user_id)
);

ALTER TABLE public.broadcast_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own broadcast reads"
ON public.broadcast_reads FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_broadcasts_expires ON public.broadcasts(expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_reads_user ON public.broadcast_reads(user_id);
