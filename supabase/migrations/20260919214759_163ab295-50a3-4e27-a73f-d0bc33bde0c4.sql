ALTER TABLE public.duels
  ADD COLUMN IF NOT EXISTS add_maths boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS add_memory boolean NOT NULL DEFAULT false;