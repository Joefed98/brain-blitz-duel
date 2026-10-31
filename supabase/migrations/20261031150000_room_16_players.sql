-- Rooms of up to 16 players and the colour wheel's 32 swatches (31 Oct 2026). NOT YET APPLIED:
-- the app works without it. Until it is applied, a room still seats 10 (the 11th join is refused
-- as "full" by the server, which reads the slot-range refusal), colours above the old 0–9 range are
-- stored as no colour (phones resolve those from the slot, identically), and share counts above 10
-- fail quietly as before. Apply it after 20261017120000_player_colour_icon.sql and
-- 20261021120000_beta_share_events.sql when those are applied; each step is guarded, so running it
-- with either of them missing is safe. No stored row is changed.
--
--   duel_players.player_slot  1–16 (was 1–10); MAX_PLAYERS in src/lib/duel/types.ts.
--   duels.max_players         default 16 for new rows (existing rows keep their value; the server
--                             seats up to MAX_PLAYERS in any lobby).
--   duel_players.colour       0–31, an index into the colour wheel (PLAYER_COLOURS in
--                             src/lib/duel/playerLook.ts); NULL as before.
--   share_events.place/players 1–20 (rooms of 16, challenges of 20).
-- Row-level security is unchanged.

ALTER TABLE public.duel_players
  DROP CONSTRAINT IF EXISTS duel_players_slot_range;
ALTER TABLE public.duel_players
  ADD CONSTRAINT duel_players_slot_range CHECK (player_slot BETWEEN 1 AND 16);

ALTER TABLE public.duels
  ALTER COLUMN max_players SET DEFAULT 16;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'duel_players' AND column_name = 'colour'
  ) THEN
    ALTER TABLE public.duel_players DROP CONSTRAINT IF EXISTS duel_players_colour_range;
    ALTER TABLE public.duel_players
      ADD CONSTRAINT duel_players_colour_range CHECK (colour IS NULL OR colour BETWEEN 0 AND 31);
  END IF;

  IF to_regclass('public.share_events') IS NOT NULL THEN
    ALTER TABLE public.share_events DROP CONSTRAINT IF EXISTS share_events_place_check;
    ALTER TABLE public.share_events DROP CONSTRAINT IF EXISTS share_events_players_check;
    ALTER TABLE public.share_events
      ADD CONSTRAINT share_events_place_check CHECK (place IS NULL OR place BETWEEN 1 AND 20);
    ALTER TABLE public.share_events
      ADD CONSTRAINT share_events_players_check CHECK (players IS NULL OR players BETWEEN 1 AND 20);
  END IF;
END
$$;
