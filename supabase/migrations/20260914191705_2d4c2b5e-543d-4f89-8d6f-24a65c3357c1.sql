ALTER TABLE public.duels
  ADD COLUMN IF NOT EXISTS host_user_id uuid,
  ADD COLUMN IF NOT EXISTS max_players integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS round_count integer NOT NULL DEFAULT 6;

ALTER TABLE public.duel_players
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS joined_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.duel_players
  DROP CONSTRAINT IF EXISTS duel_players_slot_range;
ALTER TABLE public.duel_players
  ADD CONSTRAINT duel_players_slot_range CHECK (player_slot BETWEEN 1 AND 10);

ALTER TABLE public.duel_players
  DROP CONSTRAINT IF EXISTS duel_players_status_valid;
ALTER TABLE public.duel_players
  ADD CONSTRAINT duel_players_status_valid CHECK (status IN ('active', 'inactive', 'left'));