-- Difficulty levels (phase 2 step 4, 15 Nov 2026; docs/design/difficulty/README.md). Additive only: nothing stored is
-- changed, no row is rewritten.
--
-- 1. Bests and stars per level. practice_plays.level and practice_progress.level (20261111101500) already keep one
--    row per player, game and level. Every row stored so far is on the level the app called Classic, which is the
--    framework's Normal: today's game. The stored key stays 'classic' (so no row moves and every check of the stored
--    rows reads as before); the app reads it as Normal (src/lib/levels/levels.ts levelFromStored / storedLevelKey).
--    `public.level_name` is the same mapping for SQL that wants the framework's names.
--
-- 2. Tournaments: an event's level (default Normal), so events can use levels later. No tournament rule reads it
--    yet; every event deals Normal as before.
--
-- Rated matches and the Daily are always Normal (enforced in the server's deal, src/lib/levels/modes.ts); rated
-- game_mode keeps its 'classic' key for the same reason as practice.

COMMENT ON COLUMN public.practice_progress.level IS
  'The level: easy, classic (the app''s Normal, today''s game), hard or expert. public.level_name gives the app''s name.';
COMMENT ON COLUMN public.practice_plays.level IS
  'The level the run was dealt at: easy, classic (Normal), hard or expert; NULL is Normal (every run before levels).';

CREATE OR REPLACE FUNCTION public.level_name(p_stored text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE WHEN p_stored IN ('easy', 'hard', 'expert') THEN p_stored ELSE 'normal' END;
$$;
REVOKE ALL ON FUNCTION public.level_name(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.level_name(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.level_name(text) TO service_role;

ALTER TABLE public.tournament_events ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'normal';
ALTER TABLE public.tournament_events DROP CONSTRAINT IF EXISTS tournament_events_level_check;
ALTER TABLE public.tournament_events ADD CONSTRAINT tournament_events_level_check
  CHECK (level IN ('easy', 'normal', 'hard', 'expert'));
COMMENT ON COLUMN public.tournament_events.level IS
  'The level the event''s games are dealt at (default normal). No tournament rule reads it yet.';
