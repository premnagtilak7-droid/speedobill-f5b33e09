
CREATE TABLE public.bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  hotel_id uuid REFERENCES public.hotels(id),
  role text,
  page text DEFAULT '',
  message text NOT NULL,
  device_info text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own bug reports
CREATE POLICY "Users can insert own bug reports"
  ON public.bug_reports FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Creator admin can view all bug reports
CREATE POLICY "Creator can view all bug reports"
  ON public.bug_reports FOR SELECT
  TO authenticated
  USING (auth.email() = 'speedobill7@gmail.com');

-- Users can view own bug reports
CREATE POLICY "Users can view own bug reports"
  ON public.bug_reports FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
