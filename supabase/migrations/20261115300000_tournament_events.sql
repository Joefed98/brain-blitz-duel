-- The Category Cup (Swiss) and the Joulz Championship (Knockout) (wave 4, W4c; docs/tournaments/events.md), on W4b's
-- tournaments (20261115200000_tournaments.sql): each event is a row of its own kind in public.tournament_events, entered,
-- refunded, finished, paid and given its trophies through W4b's functions. This file adds only what the two formats need
-- beside the Arena's tables.
--
-- Additive and idempotent: new tables and functions, one new catalogue item (the animated Championship frame, an earned
-- tournament prize, never sold), and the Swiss Champion and Knockout Champion badges moved from waiting to earnable
-- (Joe's approval, 11 Nov 2026). No stored round, result, input log, rating or ledger line is changed (rule 4). Nothing
-- here deals, grades, scores or rates: every match is an ordinary room (public.duels) made already started on W3b's
-- engine and graded by the rooms engine; no tournament result is ever read by ratings.
--
-- Both kinds are switched off at launch (TOURNAMENT_KINDS_ON in src/config/tournamentConfig.ts): while off the server
-- refuses them and no row is made here.
--
-- What it holds:
--   * tournament_rounds: one row per started Category Cup or Championship: the rounds, the current round and when its
--     rooms are made, the bracket size, the field, and a short tick lock;
--   * tournament_seeds: each player's Swiss entry order or Knockout seed (the Score Attack place);
--   * tournament_matches: every Swiss pairing and bracket match, its room once made, its settled result, and whether a
--     side's run was flagged by the server;
--   * tournament_awards: the log of what each finish paid beyond W4b's prizes and trophies (badge, frame, hall of fame,
--     Joules), one row per entrant and kind, so nothing pays twice;
--   * tournament_hall_of_fame: every Championship winner, by month;
--   * moderation.tournament_flags: each run the server flagged in a Category Cup or Championship match, for Joe's
--     review, beside W3a's moderation.rated_flags (moderation.tournament_flag_queue() / tournament_flag_resolve()).
--
-- Who can reach what: nobody but the server. RLS on with no policies; anon and authenticated have no grants; the
-- service role reads and writes the public tables through src/lib/data/tournamentEvents.server.ts and logs flags only
-- through public.tournament_flag_log. A removed account takes its rows with it (ON DELETE CASCADE from profiles).

CREATE TABLE IF NOT EXISTS public.tournament_rounds (
  event_id text PRIMARY KEY REFERENCES public.tournament_events (id) ON DELETE CASCADE,
  rounds_total integer NOT NULL CHECK (rounds_total BETWEEN 1 AND 12),
  current_round integer NOT NULL DEFAULT 0 CHECK (current_round BETWEEN 0 AND 12),
  -- When the current round's rooms are made (a minute after the round before settles).
  round_starts_at timestamptz,
  -- The Knockout's bracket size.
  bracket_size integer CHECK (bracket_size IN (2, 4, 8, 16, 32, 64)),
  field integer NOT NULL CHECK (field >= 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  -- When the finish's own awards (badge, frame, hall of fame, Joules) were all paid.
  awarded_at timestamptz,
  locked_until timestamptz
);

CREATE TABLE IF NOT EXISTS public.tournament_seeds (
  event_id text NOT NULL REFERENCES public.tournament_events (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  seed integer NOT NULL CHECK (seed BETWEEN 1 AND 100000),
  PRIMARY KEY (event_id, user_id),
  UNIQUE (event_id, seed)
);

CREATE TABLE IF NOT EXISTS public.tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL REFERENCES public.tournament_events (id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('swiss', 'knockout', 'third_place')),
  round integer NOT NULL CHECK (round BETWEEN 1 AND 12),
  slot integer NOT NULL CHECK (slot BETWEEN 0 AND 100000),
  -- null: a bye (or, in a bracket, a side not yet known).
  player_a uuid,
  player_b uuid,
  seed_a integer,
  seed_b integer,
  duel_id uuid UNIQUE REFERENCES public.duels (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'playing', 'settling', 'settled')),
  -- null on a settled match: a drawn Swiss match, two flagged sides, or two byes.
  winner uuid,
  walkover boolean NOT NULL DEFAULT false,
  -- A side whose run the server flagged in this match: it earns nothing from it (Joe, 11 Nov 2026).
  flagged_a boolean NOT NULL DEFAULT false,
  flagged_b boolean NOT NULL DEFAULT false,
  games_a integer,
  games_b integer,
  total_a integer,
  total_b integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  room_made_at timestamptz,
  settled_at timestamptz,
  UNIQUE (event_id, stage, round, slot)
);
CREATE INDEX IF NOT EXISTS tournament_matches_event ON public.tournament_matches (event_id, round, slot);

CREATE TABLE IF NOT EXISTS public.tournament_awards (
  event_id text NOT NULL REFERENCES public.tournament_events (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('badge', 'frame', 'hall_of_fame', 'joules')),
  place integer,
  amount integer,
  paid_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id, kind)
);

CREATE TABLE IF NOT EXISTS public.tournament_hall_of_fame (
  month text PRIMARY KEY CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  event_id text NOT NULL UNIQUE REFERENCES public.tournament_events (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now()
);

DO $grants$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tournament_rounds', 'tournament_seeds', 'tournament_matches', 'tournament_awards',
                           'tournament_hall_of_fame'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END
$grants$;

-- One ticker at a time: true for exactly one caller until p_ms have passed or it unlocks.
CREATE OR REPLACE FUNCTION public.tournament_rounds_lock(p_event text, p_ms integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.tournament_rounds
     SET locked_until = now() + make_interval(secs => greatest(1, least(p_ms, 120000)) / 1000.0)
   WHERE event_id = p_event AND (locked_until IS NULL OR locked_until < now());
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.tournament_rounds_unlock(p_event text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ UPDATE public.tournament_rounds SET locked_until = NULL WHERE event_id = p_event; $$;

REVOKE ALL ON FUNCTION public.tournament_rounds_lock(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_rounds_unlock(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_rounds_lock(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.tournament_rounds_unlock(text) TO service_role;

/* ------------------------------------------------------------------ flagged runs, for Joe's review */

-- A Category Cup or Championship match with a run the server's grading or anti-cheat flagged (a stored grade's
-- extra.flagged): one row per flagged player and game. That player earned nothing from the event. Beside W3a's
-- moderation.rated_flags (whose rows must be rated matches), unreachable from the API, the service role included;
-- written only through public.tournament_flag_log.
CREATE TABLE IF NOT EXISTS moderation.tournament_flags (
  id bigserial PRIMARY KEY,
  event_id text NOT NULL REFERENCES public.tournament_events (id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.tournament_matches (id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  game_idx smallint CHECK (game_idx >= 0),
  game text,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 40),
  flagged_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_note text,
  CONSTRAINT tournament_flags_once UNIQUE NULLS NOT DISTINCT (match_id, player_id, game_idx)
);
REVOKE ALL ON moderation.tournament_flags FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE moderation.tournament_flags_id_seq FROM PUBLIC, anon, authenticated, service_role;

-- Logs a match's flags once each (p_flags: [{player_id, game_idx, game, reason}]). Answers how many were new.
CREATE OR REPLACE FUNCTION public.tournament_flag_log(p_event text, p_match uuid, p_flags jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, moderation
AS $$
DECLARE n integer;
BEGIN
  INSERT INTO moderation.tournament_flags (event_id, match_id, player_id, game_idx, game, reason)
  SELECT p_event, p_match, (e ->> 'player_id')::uuid, (e ->> 'game_idx')::smallint, e ->> 'game', left(e ->> 'reason', 40)
    FROM jsonb_array_elements(coalesce(p_flags, '[]'::jsonb)) AS e
  ON CONFLICT ON CONSTRAINT tournament_flags_once DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.tournament_flag_log(text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_flag_log(text, uuid, jsonb) TO service_role;

-- Joe's list (the SQL editor): open flags, or every flag with p_all, with the username and the event.
CREATE OR REPLACE FUNCTION moderation.tournament_flag_queue(p_all boolean DEFAULT false)
RETURNS TABLE (id bigint, event_id text, match_id uuid, player_id uuid, player text, game text, game_idx smallint,
               reason text, flagged_at timestamptz, resolved_at timestamptz, resolved_note text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, moderation
AS $$
  SELECT f.id, f.event_id, f.match_id, f.player_id, coalesce(p.username, 'guest'), f.game, f.game_idx, f.reason,
         f.flagged_at, f.resolved_at, f.resolved_note
    FROM moderation.tournament_flags f
    LEFT JOIN public.profiles p ON p.user_id = f.player_id
   WHERE p_all OR f.resolved_at IS NULL
   ORDER BY f.flagged_at DESC;
$$;

CREATE OR REPLACE FUNCTION moderation.tournament_flag_resolve(p_id bigint, p_note text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, moderation
AS $$
DECLARE n integer;
BEGIN
  UPDATE moderation.tournament_flags SET resolved_at = now(), resolved_note = left(trim(coalesce(p_note, '')), 500)
   WHERE id = p_id AND resolved_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END;
$$;
REVOKE ALL ON FUNCTION moderation.tournament_flag_queue(boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION moderation.tournament_flag_resolve(bigint, text) FROM PUBLIC, anon, authenticated, service_role;

/* ------------------------------------------------------------------ the Championship frame */

-- docs/art/wave-4/catalogue.json: earned by the Joulz Championship's winner, animated, never sold, never again
-- anywhere. Placeholder art until drawn (the card draws the Plain frame for an unknown frame meanwhile).
INSERT INTO public.catalogue_items
  (id, name, kind, slot, game, game_type, rarity, source, pass_level, price_coins, bundle, animated, exclusive,
   exclusive_forever, note, png_path, html_path, sort_order)
VALUES
  ('frame.championship', 'Championship', 'frame', 'frame', NULL, NULL, NULL, 'tournament', NULL, NULL, NULL, true, true,
   true, 'placeholder art until drawn', NULL, NULL, 111)
ON CONFLICT (id) DO NOTHING;

/* ------------------------------------------------------------------ badges (Joe's approval, 11 Nov 2026) */

-- Swiss Champion (win a Category Cup) and Knockout Champion (win the Joulz Championship's final) move from waiting to
-- earnable; the events award them through badge_award when they finish.
DO $badges$
BEGIN
  IF to_regclass('public.badges') IS NOT NULL THEN
    UPDATE public.badges SET status = 'earnable', waits_for = NULL
     WHERE slug IN ('swiss-champion', 'knockout-champion') AND status = 'waits';
  END IF;
END
$badges$;
