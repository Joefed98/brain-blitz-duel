-- Rated matchmaking, rated matches and recorded runs (wave 3, W3b; docs/rated/matchmaking-interface.md).
--
-- Additive and idempotent: new tables and functions only. No stored row is changed (rule 4), no existing table gains
-- or loses a column, and nothing here grades, scores or deals: a rated match is an ordinary room (public.duels) the
-- server makes already started, and every score in it is the room's own grading.
--
-- What it holds:
--   * mm_queue: one row per searching player (format, choice, the rating the match moves, placement), claimed by a
--     match atomically (mm_queue_claim) so two searchers are never put in two matches;
--   * mm_matches / mm_match_players: each match, its room, its kind (live or recorded), the recorded run it plays
--     against (that run's stored games, server only), the rematch accepts and the result handed to W3a's
--     recordRatedMatch once (status playing → settling → settled, claimed with a guarded update);
--   * mm_runs: each player's run from a settled rated match (their games, scores, finish times and the server-made
--     timeline), the pool recorded runs are chosen from first;
--   * mm_run_uses: each time a run (rated or fallback) was played against, for the 5-a-day cap (mm_run_use);
--   * mm_progress: the latest live score each player's phone reports during a game (display only, never read to
--     grade or rank; the server withholds it in the final 20 % of each game).
--
-- Who can reach what: nobody but the server. RLS is on with no policies and anon / authenticated have no grants; the
-- service role reads and writes through the typed data layer (src/lib/data/rated.server.ts).

CREATE TABLE IF NOT EXISTS public.mm_queue (
  user_id uuid PRIMARY KEY,
  format text NOT NULL CHECK (format IN ('bo3', 'bo5', 'bo7', 'ffa4', 'ffa8')),
  choice text NOT NULL CHECK (choice IN ('mixed', 'puzzles', 'arcade', 'word', 'number', 'speed', 'attention',
    'pattern', 'logic', 'retro', 'sports', 'cards', 'action', 'strategy')),
  rating integer NOT NULL,
  placement boolean NOT NULL DEFAULT false,
  -- A guest's room name (checked as a room's guest name); an account plays under its username.
  display_name text CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 16),
  joined_at timestamptz NOT NULL DEFAULT now(),
  -- Set once, by mm_queue_claim, when the player is put in a match.
  match_id uuid
);
CREATE INDEX IF NOT EXISTS mm_queue_waiting ON public.mm_queue (format, choice, joined_at) WHERE match_id IS NULL;

CREATE TABLE IF NOT EXISTS public.mm_matches (
  id uuid PRIMARY KEY,
  format text NOT NULL CHECK (format IN ('bo3', 'bo5', 'bo7', 'ffa4', 'ffa8')),
  choice text NOT NULL CHECK (choice IN ('mixed', 'puzzles', 'arcade', 'word', 'number', 'speed', 'attention',
    'pattern', 'logic', 'retro', 'sports', 'cards', 'action', 'strategy')),
  -- Every game deals Classic until wave 3.5.
  game_mode text NOT NULL DEFAULT 'classic' CHECK (game_mode IN ('classic')),
  kind text NOT NULL CHECK (kind IN ('live', 'recorded')),
  duel_id uuid UNIQUE REFERENCES public.duels (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'playing' CHECK (status IN ('playing', 'settling', 'settled', 'abandoned')),
  -- A recorded match: the run played against (mm_runs.key or a fallback key), its source, owner and age, and its
  -- stored games (type, signature, score, finishMs, timeline). Server only: the phone gets what the playback allows.
  recorded_key text,
  recorded_source text CHECK (recorded_source IN ('rated', 'room', 'daily', 'practice')),
  recorded_owner uuid,
  recorded_owner_rating integer,
  recorded_fallback boolean,
  recorded_at timestamptz,
  recorded_games jsonb,
  recorded_look jsonb,
  rematch_of uuid REFERENCES public.mm_matches (id) ON DELETE SET NULL,
  -- Claimed before the rematch row exists (rated.server.ts requestRematch), so no foreign key.
  rematch_match_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  settled_at timestamptz,
  result jsonb,
  CHECK ((kind = 'recorded') = (recorded_key IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS mm_matches_recent_recorded ON public.mm_matches (recorded_owner, created_at DESC)
  WHERE kind = 'recorded';

CREATE TABLE IF NOT EXISTS public.mm_match_players (
  match_id uuid NOT NULL REFERENCES public.mm_matches (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  slot integer NOT NULL CHECK (slot BETWEEN 1 AND 16),
  rating_before integer NOT NULL,
  placement boolean NOT NULL DEFAULT false,
  rematch_at timestamptz,
  PRIMARY KEY (match_id, user_id),
  UNIQUE (match_id, slot)
);
CREATE INDEX IF NOT EXISTS mm_match_players_user ON public.mm_match_players (user_id, match_id);

CREATE TABLE IF NOT EXISTS public.mm_runs (
  key text PRIMARY KEY,
  owner_id uuid NOT NULL,
  match_id uuid NOT NULL REFERENCES public.mm_matches (id) ON DELETE CASCADE,
  format text NOT NULL,
  choice text NOT NULL,
  owner_rating integer NOT NULL,
  -- The owner's games, in order: {type, signature, score, finishMs, timeline}.
  games jsonb NOT NULL,
  -- Where the deals are: the match's room and the owner's slot in it.
  duel_id uuid NOT NULL,
  slot integer NOT NULL,
  look jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mm_runs_pool ON public.mm_runs (format, choice, recorded_at DESC);

CREATE TABLE IF NOT EXISTS public.mm_run_uses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_key text NOT NULL,
  viewer_id uuid NOT NULL,
  match_id uuid NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mm_run_uses_key ON public.mm_run_uses (run_key, used_at DESC);

CREATE TABLE IF NOT EXISTS public.mm_progress (
  match_id uuid NOT NULL REFERENCES public.mm_matches (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  round_number integer NOT NULL CHECK (round_number BETWEEN 1 AND 12),
  score integer NOT NULL CHECK (score BETWEEN 0 AND 1000),
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, user_id)
);

DO $grants$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['mm_queue', 'mm_matches', 'mm_match_players', 'mm_runs', 'mm_run_uses', 'mm_progress'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END
$grants$;

-- Puts every listed searcher in one match, or none of them: each must still be waiting for this format and choice.
CREATE OR REPLACE FUNCTION public.mm_queue_claim(p_users uuid[], p_match uuid, p_format text, p_choice text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  IF p_users IS NULL OR array_length(p_users, 1) IS NULL THEN
    RETURN false;
  END IF;
  BEGIN
    UPDATE public.mm_queue
       SET match_id = p_match
     WHERE user_id = ANY (p_users) AND match_id IS NULL AND format = p_format AND choice = p_choice;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> (SELECT count(DISTINCT u) FROM unnest(p_users) AS u) THEN
      RAISE EXCEPTION 'mm_queue_claim: not every searcher was free';
    END IF;
  EXCEPTION WHEN raise_exception THEN
    RETURN false;
  END;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.mm_queue_claim(uuid[], uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_queue_claim(uuid[], uuid, text, text) TO service_role;

-- Counts one play against a run, unless it has been played against p_max times since p_day_start (the UK day's
-- start). Serialised per run, so two searchers can't both take its fifth use.
CREATE OR REPLACE FUNCTION public.mm_run_use(p_key text, p_viewer uuid, p_match uuid, p_day_start timestamptz, p_max integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('mm_run_use:' || p_key));
  IF (SELECT count(*) FROM public.mm_run_uses WHERE run_key = p_key AND used_at >= p_day_start) >= p_max THEN
    RETURN false;
  END IF;
  INSERT INTO public.mm_run_uses (run_key, viewer_id, match_id) VALUES (p_key, p_viewer, p_match);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.mm_run_use(text, uuid, uuid, timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_run_use(text, uuid, uuid, timestamptz, integer) TO service_role;

-- The tester list is D1's shop.testers (the ONE list; Joe manages it with shop.add_tester / shop.remove_tester).
-- Read dynamically, so this file applies before or after D1's: with no list yet, nobody is a tester.
CREATE OR REPLACE FUNCTION public.mm_is_tester(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE is_tester boolean := false;
BEGIN
  IF p_user_id IS NULL OR to_regclass('shop.testers') IS NULL THEN
    RETURN false;
  END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM shop.testers WHERE user_id = $1)' INTO is_tester USING p_user_id;
  RETURN coalesce(is_tester, false);
END;
$$;
REVOKE ALL ON FUNCTION public.mm_is_tester(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_is_tester(uuid) TO service_role;
