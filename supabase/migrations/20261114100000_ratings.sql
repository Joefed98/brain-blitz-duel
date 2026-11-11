-- Ratings (wave 3, session W3a, the ratings engine; 14 Nov 2026; docs/rated/README.md, docs/rated/ratings-interface.md).
-- Additive and idempotent: new tables and functions only. No existing table, column or row is changed.
--
-- What it adds:
--   * public.rated_profiles: one row per player who has played rated (placement, the Joulz Rating, the tier shown,
--     the competitive badges' counts), with a version for optimistic concurrency;
--   * public.rated_ratings: each player's Glicko-2 rating, RD and volatility per rating (puzzles, arcade and the 11
--     categories), each with its own version;
--   * public.rated_matches (one row per match: idempotency, the stored result and outcome), rated_match_players
--     (each player's part: result, place, frozen, Joules, games by pool, changes) and rated_games (each game with its
--     type, pool, category, version and dealt signature: ratings key a game's epoch on the signature);
--   * public.rated_pair_days (rated matches between two live players in a UK day: the 4th-match rule) and
--     rated_run_uses (every use of a recorded run, by UK day: W3b enforces 5 a day, recorded here);
--   * public.rated_standings and rated_standings_meta (ranks, shares and the caps' grace, from the standings job);
--   * the service-role functions rated_state, rated_apply_match, rated_recompute_standings, rated_set_tiers,
--     rated_tier_counts and rated_badge_facts.
--
-- Who can write: nobody through the API. anon and authenticated have no right on any of these tables or functions;
-- the service role reads the tables and writes only through rated_apply_match / rated_set_tiers /
-- rated_recompute_standings. The phone reads ratings through the server's functions (src/lib/rated/ratings.functions.ts).
-- A removed user (accounts.forget_user deletes the auth user last) takes their rows with it (ON DELETE CASCADE);
-- matches and games stay, the removed player's rows gone.

/* ------------------------------------------------------------------ tables */

CREATE TABLE IF NOT EXISTS public.rated_profiles (
  player_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  placement_played smallint NOT NULL DEFAULT 0 CHECK (placement_played BETWEEN 0 AND 5),
  matches integer NOT NULL DEFAULT 0 CHECK (matches >= 0),
  wins integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
  win_streak integer NOT NULL DEFAULT 0 CHECK (win_streak >= 0),
  best_win_streak integer NOT NULL DEFAULT 0 CHECK (best_win_streak >= 0),
  comebacks integer NOT NULL DEFAULT 0 CHECK (comebacks >= 0),
  clean_sweeps integer NOT NULL DEFAULT 0 CHECK (clean_sweeps >= 0),
  podiums integer NOT NULL DEFAULT 0 CHECK (podiums >= 0),
  giant_slayers integer NOT NULL DEFAULT 0 CHECK (giant_slayers >= 0),
  revenges integer NOT NULL DEFAULT 0 CHECK (revenges >= 0),
  photo_finishes integer NOT NULL DEFAULT 0 CHECK (photo_finishes >= 0),
  joulz double precision CHECK (joulz IS NULL OR joulz >= 100),
  shown_tier text CHECK (shown_tier IN ('spark', 'charge', 'volt', 'surge', 'storm', 'lightning', 'top500')),
  peak_tier text CHECK (peak_tier IN ('spark', 'charge', 'volt', 'surge', 'storm', 'lightning', 'top500')),
  top500_ever boolean NOT NULL DEFAULT false,
  last_match_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rated_profiles_joulz_placed CHECK ((joulz IS NULL) = (placement_played < 5))
);

CREATE TABLE IF NOT EXISTS public.rated_ratings (
  player_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (key IN ('puzzles', 'arcade', 'word', 'number', 'speed', 'attention', 'pattern', 'logic',
                                   'retro', 'sports', 'cards', 'action', 'strategy')),
  rating double precision NOT NULL CHECK (rating >= 100),
  rd double precision NOT NULL CHECK (rd > 0 AND rd <= 350),
  volatility double precision NOT NULL CHECK (volatility > 0 AND volatility < 1),
  matches integer NOT NULL CHECK (matches >= 1),
  last_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  PRIMARY KEY (player_id, key)
);

CREATE TABLE IF NOT EXISTS public.rated_matches (
  match_id uuid PRIMARY KEY,
  format jsonb NOT NULL,
  choice text NOT NULL CHECK (choice IN ('mixed', 'puzzles', 'arcade')),
  uk_day date NOT NULL,
  finished_at timestamptz NOT NULL,
  rematch_of uuid,
  result jsonb NOT NULL,
  outcome jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rated_match_players (
  match_id uuid NOT NULL REFERENCES public.rated_matches(match_id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  side text NOT NULL CHECK (side IN ('live', 'recorded')),
  run_id text,
  run_source text CHECK (run_source IN ('rated', 'room', 'daily', 'practice')),
  result text NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
  place smallint CHECK (place BETWEEN 1 AND 8),
  counted boolean NOT NULL,
  moved boolean NOT NULL,
  frozen text CHECK (frozen IN ('same_opponent_today', 'recorded_unrated_source', 'recorded_daily_limit')),
  joules integer NOT NULL DEFAULT 0 CHECK (joules >= 0),
  puzzles_games smallint NOT NULL DEFAULT 0 CHECK (puzzles_games >= 0),
  arcade_games smallint NOT NULL DEFAULT 0 CHECK (arcade_games >= 0),
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  finished_at timestamptz NOT NULL,
  PRIMARY KEY (match_id, player_id),
  CONSTRAINT rated_match_players_run CHECK ((side = 'recorded') = (run_id IS NOT NULL AND run_source IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS rated_match_players_recent ON public.rated_match_players (player_id, finished_at DESC);

CREATE TABLE IF NOT EXISTS public.rated_games (
  match_id uuid NOT NULL REFERENCES public.rated_matches(match_id) ON DELETE CASCADE,
  idx smallint NOT NULL CHECK (idx >= 0),
  type text NOT NULL,
  pool text NOT NULL CHECK (pool IN ('puzzles', 'arcade')),
  category text NOT NULL,
  version text NOT NULL,
  signature text NOT NULL,
  scores jsonb NOT NULL,
  PRIMARY KEY (match_id, idx)
);
-- A game's epoch is its dealt signature.
CREATE INDEX IF NOT EXISTS rated_games_epoch ON public.rated_games (type, signature);

CREATE TABLE IF NOT EXISTS public.rated_pair_days (
  uk_day date NOT NULL,
  player_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matches integer NOT NULL CHECK (matches >= 1),
  PRIMARY KEY (uk_day, player_a, player_b),
  CONSTRAINT rated_pair_days_order CHECK (player_a < player_b)
);

CREATE TABLE IF NOT EXISTS public.rated_run_uses (
  run_id text NOT NULL,
  match_id uuid NOT NULL REFERENCES public.rated_matches(match_id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uk_day date NOT NULL,
  moved boolean NOT NULL,
  PRIMARY KEY (run_id, match_id)
);
CREATE INDEX IF NOT EXISTS rated_run_uses_day ON public.rated_run_uses (run_id, uk_day);

CREATE TABLE IF NOT EXISTS public.rated_standings (
  player_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  joulz double precision NOT NULL,
  rank integer NOT NULL CHECK (rank >= 1),
  share double precision NOT NULL CHECK (share > 0 AND share <= 1),
  storm_ok boolean NOT NULL,
  top500_ok boolean NOT NULL,
  storm_grace_until timestamptz,
  top500_grace_until timestamptz,
  computed_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rated_standings_meta (
  id smallint PRIMARY KEY CHECK (id = 1),
  rated_players integer NOT NULL,
  caps_active boolean NOT NULL,
  computed_at timestamptz NOT NULL
);

DO $own$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rated_profiles', 'rated_ratings', 'rated_matches', 'rated_match_players', 'rated_games',
                           'rated_pair_days', 'rated_run_uses', 'rated_standings', 'rated_standings_meta'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, service_role', t);
    EXECUTE format('GRANT SELECT ON public.%I TO service_role', t);
  END LOOP;
END
$own$;

/* ------------------------------------------------------------------ helpers */

CREATE OR REPLACE FUNCTION public.rated_ms(p timestamptz)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$ SELECT CASE WHEN p IS NULL THEN NULL ELSE (extract(epoch FROM p) * 1000)::bigint END $$;
REVOKE ALL ON FUNCTION public.rated_ms(timestamptz) FROM PUBLIC, anon, authenticated;

/* ------------------------------------------------------------------ reads */

-- Everything recordRatedMatch (and the phone's reads, through the server) needs about some players, in one call:
-- the stored outcome of the match if it was already recorded, profiles, ratings, today's pair counts among them,
-- live games by pool since p_since (the Joulz Rating's 90 days), today's uses of the recorded runs, the standings
-- and, for a rematch, who won the match it follows.
CREATE OR REPLACE FUNCTION public.rated_state(
  p_match_id uuid,
  p_players uuid[],
  p_day date,
  p_since timestamptz,
  p_run_ids text[],
  p_rematch_of uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'outcome', (SELECT m.outcome FROM rated_matches m WHERE m.match_id = p_match_id),
    'profiles', coalesce((SELECT jsonb_agg(to_jsonb(p) || jsonb_build_object('last_match_ms', rated_ms(p.last_match_at)))
                            FROM rated_profiles p WHERE p.player_id = ANY (p_players)), '[]'::jsonb),
    'ratings', coalesce((SELECT jsonb_agg(jsonb_build_object(
                             'player_id', r.player_id, 'key', r.key, 'rating', r.rating, 'rd', r.rd,
                             'volatility', r.volatility, 'matches', r.matches, 'last_ms', rated_ms(r.last_at),
                             'version', r.version))
                           FROM rated_ratings r WHERE r.player_id = ANY (p_players)), '[]'::jsonb),
    'pairs', coalesce((SELECT jsonb_agg(jsonb_build_object('a', d.player_a, 'b', d.player_b, 'matches', d.matches))
                         FROM rated_pair_days d
                        WHERE d.uk_day = p_day AND d.player_a = ANY (p_players) AND d.player_b = ANY (p_players)), '[]'::jsonb),
    'recent', coalesce((SELECT jsonb_agg(jsonb_build_object('player_id', x.player_id, 'puzzles', x.puzzles, 'arcade', x.arcade))
                          FROM (SELECT mp.player_id, sum(mp.puzzles_games)::int AS puzzles, sum(mp.arcade_games)::int AS arcade
                                  FROM rated_match_players mp
                                 WHERE mp.player_id = ANY (p_players) AND mp.side = 'live' AND mp.counted
                                   AND mp.finished_at >= p_since
                                 GROUP BY mp.player_id) x), '[]'::jsonb),
    'runs', coalesce((SELECT jsonb_agg(jsonb_build_object('run_id', u.run_id, 'uses', u.n))
                        FROM (SELECT run_id, count(*)::int AS n FROM rated_run_uses
                               WHERE run_id = ANY (p_run_ids) AND uk_day = p_day GROUP BY run_id) u), '[]'::jsonb),
    'meta', (SELECT to_jsonb(s) FROM rated_standings_meta s WHERE s.id = 1),
    'standings', coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM rated_standings s WHERE s.player_id = ANY (p_players)), '[]'::jsonb),
    'rematch', coalesce((SELECT jsonb_agg(jsonb_build_object('player_id', mp.player_id, 'side', mp.side, 'result', mp.result))
                           FROM rated_match_players mp WHERE mp.match_id = p_rematch_of), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.rated_state(uuid, uuid[], date, timestamptz, text[], uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rated_state(uuid, uuid[], date, timestamptz, text[], uuid) TO service_role;

-- The competitive badges' counts for one player (zeros before their first rated match).
CREATE OR REPLACE FUNCTION public.rated_badge_facts(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT jsonb_build_object(
       'wins', p.wins, 'winStreak', p.win_streak, 'bestWinStreak', p.best_win_streak,
       'placementPlayed', p.placement_played, 'comebacks', p.comebacks, 'cleanSweeps', p.clean_sweeps,
       'podiums', p.podiums, 'giantSlayers', p.giant_slayers, 'revenges', p.revenges,
       'photoFinishes', p.photo_finishes, 'peakTier', p.peak_tier, 'top500Ever', p.top500_ever)
       FROM rated_profiles p WHERE p.player_id = p_user_id),
    jsonb_build_object('wins', 0, 'winStreak', 0, 'bestWinStreak', 0, 'placementPlayed', 0, 'comebacks', 0,
                       'cleanSweeps', 0, 'podiums', 0, 'giantSlayers', 0, 'revenges', 0, 'photoFinishes', 0,
                       'peakTier', NULL, 'top500Ever', false));
$$;
REVOKE ALL ON FUNCTION public.rated_badge_facts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rated_badge_facts(uuid) TO service_role;

-- How many placed players show each tier (the ladder's shares).
CREATE OR REPLACE FUNCTION public.rated_tier_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_object_agg(shown_tier, n), '{}'::jsonb)
    FROM (SELECT shown_tier, count(*)::int AS n FROM rated_profiles
           WHERE joulz IS NOT NULL AND shown_tier IS NOT NULL GROUP BY shown_tier) t;
$$;
REVOKE ALL ON FUNCTION public.rated_tier_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rated_tier_counts() TO service_role;

/* ------------------------------------------------------------------ recording a match */

-- Stores one match worked out by the server (src/lib/rated/ratings.server.ts), all or nothing:
--   {match_id, uk_day, finished_at, rematch_of, format, choice, result, outcome,
--    profiles: [{player_id, expect (0 = new), row: {...}}], ratings: [{player_id, key, expect, rating, rd, volatility, matches, last_ms}],
--    players: [{player_id, side, run_id, run_source, result, place, counted, moved, frozen, joules, puzzles_games, arcade_games, changes}],
--    games: [{idx, type, pool, category, version, signature, scores}],
--    pairs: [{a, b, expect}], run_uses: [{run_id, owner_id, moved}]}
-- Answers {status: recorded} | {status: duplicate, outcome} (the match id was already stored: nothing changes) |
-- {status: stale} (a row changed since it was read: nothing stored; the server reads again and retries).
CREATE OR REPLACE FUNCTION public.rated_apply_match(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match uuid := (p ->> 'match_id')::uuid;
  v_day date := (p ->> 'uk_day')::date;
  v_at timestamptz := (p ->> 'finished_at')::timestamptz;
  v_stored jsonb;
  x jsonb;
  r jsonb;
  n integer;
BEGIN
  SELECT outcome INTO v_stored FROM rated_matches WHERE match_id = v_match;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'duplicate', 'outcome', v_stored);
  END IF;
  BEGIN
    INSERT INTO rated_matches (match_id, format, choice, uk_day, finished_at, rematch_of, result, outcome)
    VALUES (v_match, p -> 'format', p ->> 'choice', v_day, v_at, nullif(p ->> 'rematch_of', '')::uuid, p -> 'result', p -> 'outcome');

    FOR x IN SELECT * FROM jsonb_array_elements(p -> 'profiles') LOOP
      r := x -> 'row';
      IF (x ->> 'expect')::int = 0 THEN
        INSERT INTO rated_profiles (player_id) VALUES ((x ->> 'player_id')::uuid) ON CONFLICT (player_id) DO NOTHING;
        GET DIAGNOSTICS n = ROW_COUNT;
        IF n = 0 THEN RAISE EXCEPTION 'rated: stale' USING ERRCODE = 'RS001'; END IF;
      END IF;
      UPDATE rated_profiles SET
        version = version + CASE WHEN (x ->> 'expect')::int = 0 THEN 0 ELSE 1 END,
        placement_played = (r ->> 'placementPlayed')::smallint,
        matches = (r ->> 'matches')::int,
        wins = (r ->> 'wins')::int,
        win_streak = (r ->> 'winStreak')::int,
        best_win_streak = (r ->> 'bestWinStreak')::int,
        comebacks = (r ->> 'comebacks')::int,
        clean_sweeps = (r ->> 'cleanSweeps')::int,
        podiums = (r ->> 'podiums')::int,
        giant_slayers = (r ->> 'giantSlayers')::int,
        revenges = (r ->> 'revenges')::int,
        photo_finishes = (r ->> 'photoFinishes')::int,
        joulz = (r ->> 'joulz')::double precision,
        shown_tier = r ->> 'shownTier',
        peak_tier = r ->> 'peakTier',
        top500_ever = (r ->> 'top500Ever')::boolean,
        last_match_at = CASE WHEN (x ->> 'counted')::boolean THEN v_at ELSE last_match_at END,
        updated_at = now()
      WHERE player_id = (x ->> 'player_id')::uuid
        AND version = CASE WHEN (x ->> 'expect')::int = 0 THEN 1 ELSE (x ->> 'expect')::int END;
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n = 0 THEN RAISE EXCEPTION 'rated: stale' USING ERRCODE = 'RS001'; END IF;
    END LOOP;

    FOR x IN SELECT * FROM jsonb_array_elements(p -> 'ratings') LOOP
      IF (x ->> 'expect')::int = 0 THEN
        INSERT INTO rated_ratings (player_id, key, rating, rd, volatility, matches, last_at)
        VALUES ((x ->> 'player_id')::uuid, x ->> 'key', (x ->> 'rating')::float8, (x ->> 'rd')::float8,
                (x ->> 'volatility')::float8, (x ->> 'matches')::int, to_timestamp((x ->> 'last_ms')::float8 / 1000))
        ON CONFLICT (player_id, key) DO NOTHING;
      ELSE
        UPDATE rated_ratings SET
          rating = (x ->> 'rating')::float8, rd = (x ->> 'rd')::float8, volatility = (x ->> 'volatility')::float8,
          matches = (x ->> 'matches')::int, last_at = to_timestamp((x ->> 'last_ms')::float8 / 1000), version = version + 1
        WHERE player_id = (x ->> 'player_id')::uuid AND key = x ->> 'key' AND version = (x ->> 'expect')::int;
      END IF;
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n = 0 THEN RAISE EXCEPTION 'rated: stale' USING ERRCODE = 'RS001'; END IF;
    END LOOP;

    FOR x IN SELECT * FROM jsonb_array_elements(p -> 'pairs') LOOP
      IF (x ->> 'expect')::int = 0 THEN
        INSERT INTO rated_pair_days (uk_day, player_a, player_b, matches)
        VALUES (v_day, (x ->> 'a')::uuid, (x ->> 'b')::uuid, 1)
        ON CONFLICT (uk_day, player_a, player_b) DO NOTHING;
      ELSE
        UPDATE rated_pair_days SET matches = matches + 1
         WHERE uk_day = v_day AND player_a = (x ->> 'a')::uuid AND player_b = (x ->> 'b')::uuid
           AND matches = (x ->> 'expect')::int;
      END IF;
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n = 0 THEN RAISE EXCEPTION 'rated: stale' USING ERRCODE = 'RS001'; END IF;
    END LOOP;

    INSERT INTO rated_match_players (match_id, player_id, side, run_id, run_source, result, place, counted, moved,
                                     frozen, joules, puzzles_games, arcade_games, changes, finished_at)
    SELECT v_match, (e ->> 'player_id')::uuid, e ->> 'side', e ->> 'run_id', e ->> 'run_source', e ->> 'result',
           (e ->> 'place')::smallint, (e ->> 'counted')::boolean, (e ->> 'moved')::boolean, e ->> 'frozen',
           (e ->> 'joules')::int, (e ->> 'puzzles_games')::smallint, (e ->> 'arcade_games')::smallint,
           coalesce(e -> 'changes', '[]'::jsonb), v_at
      FROM jsonb_array_elements(p -> 'players') AS e;

    INSERT INTO rated_games (match_id, idx, type, pool, category, version, signature, scores)
    SELECT v_match, (e ->> 'idx')::smallint, e ->> 'type', e ->> 'pool', e ->> 'category', e ->> 'version',
           e ->> 'signature', e -> 'scores'
      FROM jsonb_array_elements(p -> 'games') AS e;

    INSERT INTO rated_run_uses (run_id, match_id, owner_id, uk_day, moved)
    SELECT e ->> 'run_id', v_match, (e ->> 'owner_id')::uuid, v_day, (e ->> 'moved')::boolean
      FROM jsonb_array_elements(coalesce(p -> 'run_uses', '[]'::jsonb)) AS e;
  EXCEPTION
    WHEN SQLSTATE 'RS001' THEN
      RETURN jsonb_build_object('status', 'stale');
    WHEN unique_violation THEN
      -- Another call stored the same match first.
      SELECT outcome INTO v_stored FROM rated_matches WHERE match_id = v_match;
      IF FOUND THEN RETURN jsonb_build_object('status', 'duplicate', 'outcome', v_stored); END IF;
      RETURN jsonb_build_object('status', 'stale');
  END;
  RETURN jsonb_build_object('status', 'recorded');
END;
$$;
REVOKE ALL ON FUNCTION public.rated_apply_match(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rated_apply_match(jsonb) TO service_role;

/* ------------------------------------------------------------------ the standings job (a Cloudflare Cron Trigger) */

-- Recomputes every placed player's Joulz Rating (the 90-day shares move with the days), their rank and share, and
-- the caps with their 3-day grace (src/lib/rated/tiers.ts holds the same numbers; ratings-check compares them).
-- Answers {rated_players, caps_active, players: [{player_id, joulz, rank, share, storm_ok, top500_ok, shown_tier}]}
-- for the players whose tier may have changed (the server works out the tier and stores it with rated_set_tiers).
CREATE OR REPLACE FUNCTION public.rated_recompute_standings(p_now timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
  v_caps boolean;
  v_was boolean;
  v_prev jsonb;
  v_out jsonb;
BEGIN
  -- The Joulz Rating: Puzzles and Arcade by the share of live rated games in each over the last 90 days; equal
  -- weight with none; a pool never played never counts.
  WITH recent AS (
    SELECT player_id, sum(puzzles_games)::float8 AS np, sum(arcade_games)::float8 AS na
      FROM rated_match_players
     WHERE side = 'live' AND counted AND finished_at >= p_now - interval '90 days'
     GROUP BY player_id
  ), pools AS (
    SELECT p.player_id,
           (SELECT rating FROM rated_ratings r WHERE r.player_id = p.player_id AND r.key = 'puzzles') AS rp,
           (SELECT rating FROM rated_ratings r WHERE r.player_id = p.player_id AND r.key = 'arcade') AS ra,
           coalesce(x.np, 0) AS np, coalesce(x.na, 0) AS na
      FROM rated_profiles p LEFT JOIN recent x USING (player_id)
     WHERE p.joulz IS NOT NULL
  ), j AS (
    SELECT player_id,
           CASE
             WHEN rp IS NOT NULL AND ra IS NOT NULL AND np + na > 0 THEN (rp * np + ra * na) / (np + na)
             WHEN rp IS NOT NULL AND ra IS NOT NULL THEN (rp + ra) / 2
             ELSE coalesce(rp, ra)
           END AS joulz
      FROM pools
  )
  UPDATE rated_profiles p SET joulz = j.joulz
    FROM j WHERE j.player_id = p.player_id AND j.joulz IS NOT NULL AND p.joulz IS DISTINCT FROM j.joulz;

  SELECT count(*) INTO v_n FROM rated_profiles WHERE joulz IS NOT NULL;
  v_caps := v_n >= 1000;
  SELECT caps_active INTO v_was FROM rated_standings_meta WHERE id = 1;

  SELECT coalesce(jsonb_object_agg(player_id::text, jsonb_build_object('joulz', joulz, 'storm_ok', storm_ok, 'top500_ok', top500_ok)), '{}'::jsonb)
    INTO v_prev FROM rated_standings;

  -- Ranks by the rating as shown (whole numbers), level players sharing a rank.
  WITH ranked AS (
    SELECT player_id, joulz,
           rank() OVER (ORDER BY round(joulz) DESC)::int AS rk
      FROM rated_profiles WHERE joulz IS NOT NULL
  )
  INSERT INTO rated_standings AS s (player_id, joulz, rank, share, storm_ok, top500_ok, storm_grace_until, top500_grace_until, computed_at)
  SELECT player_id, joulz, rk, rk::float8 / v_n, false, false, NULL, NULL, p_now FROM ranked
  ON CONFLICT (player_id) DO UPDATE SET joulz = EXCLUDED.joulz, rank = EXCLUDED.rank, share = EXCLUDED.share,
                                        computed_at = EXCLUDED.computed_at;
  DELETE FROM rated_standings s WHERE NOT EXISTS (SELECT 1 FROM rated_profiles p WHERE p.player_id = s.player_id AND p.joulz IS NOT NULL);

  -- In a capped share now: the grace runs 3 days from the last time the job saw them in it.
  UPDATE rated_standings SET
    storm_grace_until = CASE WHEN round(joulz) >= 1900 AND share <= 0.03 THEN p_now + interval '3 days' ELSE storm_grace_until END,
    top500_grace_until = CASE WHEN round(joulz) >= 2400 AND rank <= 500 THEN p_now + interval '3 days' ELSE top500_grace_until END;
  UPDATE rated_standings SET
    storm_ok = round(joulz) >= 1900 AND storm_grace_until IS NOT NULL AND p_now < storm_grace_until,
    top500_ok = round(joulz) >= 2400 AND top500_grace_until IS NOT NULL AND p_now < top500_grace_until;

  INSERT INTO rated_standings_meta (id, rated_players, caps_active, computed_at) VALUES (1, v_n, v_caps, p_now)
  ON CONFLICT (id) DO UPDATE SET rated_players = EXCLUDED.rated_players, caps_active = EXCLUDED.caps_active,
                                 computed_at = EXCLUDED.computed_at;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'player_id', s.player_id, 'joulz', s.joulz, 'rank', s.rank, 'share', s.share, 'storm_ok', s.storm_ok,
           'top500_ok', s.top500_ok, 'shown_tier', p.shown_tier) ORDER BY s.rank), '[]'::jsonb)
    INTO v_out
    FROM rated_standings s
    JOIN rated_profiles p USING (player_id)
   WHERE NOT (v_prev ? s.player_id::text)
      OR (v_prev -> s.player_id::text ->> 'joulz')::float8 IS DISTINCT FROM s.joulz
      OR (v_prev -> s.player_id::text ->> 'storm_ok')::boolean IS DISTINCT FROM s.storm_ok
      OR (v_prev -> s.player_id::text ->> 'top500_ok')::boolean IS DISTINCT FROM s.top500_ok
      OR (v_was IS DISTINCT FROM v_caps AND round(s.joulz) >= 1900);
  RETURN jsonb_build_object('rated_players', v_n, 'caps_active', v_caps, 'players', v_out);
END;
$$;
REVOKE ALL ON FUNCTION public.rated_recompute_standings(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rated_recompute_standings(timestamptz) TO service_role;

-- Stores the tiers the server worked out after the standings job: [{player_id, shown_tier, peak_tier, top500_ever}].
-- Only ever raises the peak and sets top500_ever (never clears it). Answers the number of rows changed.
CREATE OR REPLACE FUNCTION public.rated_set_tiers(p jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
  tiers text[] := ARRAY['spark', 'charge', 'volt', 'surge', 'storm', 'lightning', 'top500'];
BEGIN
  UPDATE rated_profiles r SET
    shown_tier = e ->> 'shown_tier',
    peak_tier = CASE WHEN coalesce(array_position(tiers, e ->> 'peak_tier'), 0) > coalesce(array_position(tiers, r.peak_tier), 0)
                     THEN e ->> 'peak_tier' ELSE r.peak_tier END,
    top500_ever = r.top500_ever OR coalesce((e ->> 'top500_ever')::boolean, false),
    version = r.version + 1,
    updated_at = now()
  FROM jsonb_array_elements(p) AS e
  WHERE r.player_id = (e ->> 'player_id')::uuid AND r.joulz IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.rated_set_tiers(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rated_set_tiers(jsonb) TO service_role;
