ALTER TABLE public.duel_players
  ADD COLUMN IF NOT EXISTS intro_ready_round integer NOT NULL DEFAULT 0;