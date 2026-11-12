-- Rated matches: leaving, aborts and forfeits (wave 3, W3b; Joe's decision of 12 Nov 2026; docs/rated/matchmaking-interface.md
-- "Leaving a match"). Additive and idempotent: new nullable columns on W3b's own tables and two analytics event names.
-- No stored row changes.
--
--   * mm_matches.intro_at: when the first game's intro appears (the room's fixed first deadline, written when the match
--     is made). Leaving before it aborts the match; after it a player has a 20-second grace.
--   * mm_matches.ended / ended_at / ended_step: 'abort' (left during set-up: no rating, no Joules, no placement; the
--     stayers back to searching) or 'forfeit' (away for more than 20 s before the match was decided); ended_step the
--     room phase it happened in.
--   * mm_matches.leavers: [{ userId, at, step }], in the order they left (the latest leaver places highest of them).
--   * mm_match_players.left_at: a player's own Leave, when they pressed it; gone_at: when the server found them gone for
--     good (a 4- or 8-player match carries on without them), written once.
--   * analytics events rated_match_aborted (props.step, props.format) and rated_match_forfeited (props.format,
--     props.games_played), one row per leaver, so repeat aborting can be spotted later.

ALTER TABLE public.mm_matches ADD COLUMN IF NOT EXISTS intro_at timestamptz;
ALTER TABLE public.mm_matches ADD COLUMN IF NOT EXISTS ended text;
ALTER TABLE public.mm_matches ADD COLUMN IF NOT EXISTS ended_at timestamptz;
ALTER TABLE public.mm_matches ADD COLUMN IF NOT EXISTS ended_step text;
ALTER TABLE public.mm_matches ADD COLUMN IF NOT EXISTS leavers jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.mm_match_players ADD COLUMN IF NOT EXISTS left_at timestamptz;
ALTER TABLE public.mm_match_players ADD COLUMN IF NOT EXISTS gone_at timestamptz;

DO $ended$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.mm_matches'::regclass AND conname = 'mm_matches_ended_check') THEN
    ALTER TABLE public.mm_matches ADD CONSTRAINT mm_matches_ended_check CHECK (ended IS NULL OR ended IN ('abort', 'forfeit'));
  END IF;
END
$ended$;

DO $events$
DECLARE
  existing text[];
  wanted text[];
BEGIN
  IF to_regclass('analytics.events') IS NULL THEN
    RETURN;
  END IF;
  SELECT coalesce(array_agg(DISTINCT m[1]), ARRAY[]::text[])
    INTO existing
    FROM pg_constraint c,
         LATERAL regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''', 'g') AS m
   WHERE c.conrelid = 'analytics.events'::regclass AND c.conname = 'events_event_check';
  SELECT array_agg(e ORDER BY e) INTO wanted
    FROM (SELECT unnest(existing) AS e
          UNION SELECT unnest(ARRAY['rated_match_aborted', 'rated_match_forfeited'])) AS u;
  ALTER TABLE analytics.events DROP CONSTRAINT IF EXISTS events_event_check;
  EXECUTE format(
    'ALTER TABLE analytics.events ADD CONSTRAINT events_event_check CHECK (event IN (%s)) NOT VALID',
    (SELECT string_agg(quote_literal(e), ', ') FROM unnest(wanted) AS e)
  );
  ALTER TABLE analytics.events VALIDATE CONSTRAINT events_event_check;
END
$events$;
