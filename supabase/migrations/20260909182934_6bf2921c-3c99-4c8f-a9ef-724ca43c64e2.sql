ALTER TABLE public.duels
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'intro',
  ADD COLUMN IF NOT EXISTS phase_started_at timestamp with time zone;