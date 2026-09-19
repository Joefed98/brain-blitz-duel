ALTER TABLE public.duel_players
  ADD COLUMN IF NOT EXISTS last_reaction_at timestamp with time zone;