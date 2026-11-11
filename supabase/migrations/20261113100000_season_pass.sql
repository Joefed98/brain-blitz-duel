-- The Season pass, Joules and weekly challenges (Wave 2, train D, session D2; 13 Nov 2026; docs/economy/pass.md).
-- Non-destructive and idempotent: it creates a schema, new tables and functions, and adds rows to its own new tables
-- (the two seasons). No existing table, row or column is changed; coins, items and consumables move only through A1's
-- own functions (economy.post_coins and friends, called by the server through economy_credit / economy_grant_item /
-- economy_grant_consumable), and the shop's tester list (shop.testers, D1) is read, never written.
--
-- What it holds:
--   * public.pass_seasons: each season's name, kind ('season' or the testers' 'test' season), start and end. Dates are
--     set only by Joe's functions below (pass.set_season_dates, pass.end_season, pass.start_test_season,
--     pass.end_test_season); nothing in the app writes them. Season 1 ("Neon Circuit", id s1) has no dates yet.
--   * public.pass_joules: one line per source event (a stored result) per account per season and start ("epoch": the
--     season's start for that account, moved on by a test-season reset), never changed; the day limits and the soft
--     cap applied under a lock by public.pass_credit_joules;
--   * public.pass_members: the level each account has been told about (the level-up notice and pass_level_reached);
--   * public.pass_premium: who has the premium track for a season and where it came from ('test', 'purchase',
--     'plus'); a test purchase is removable (removed_at, by Joe's pass.remove_test_purchase), never deleted;
--   * public.pass_claims: each reward claimed (a tap on the pass screen), once per track and level;
--   * public.pass_title_unlocks: the pass's two titles (Neon Rider, Circuit Breaker) an account has unlocked;
--   * public.pass_weeks: each week's three weekly challenges as first drawn, so any week can be checked later;
--   * public.pass_member_resets: a tester's own test-season reset.
--
-- Who can reach what: anon and authenticated nothing (no grants; RLS on). The server (service role) reads the tables
-- and writes only through the public.pass_* functions below. The `pass` schema (Joe's functions and their log) is
-- unreachable from the app and the API.

CREATE SCHEMA IF NOT EXISTS pass;
REVOKE ALL ON SCHEMA pass FROM PUBLIC, anon, authenticated, service_role;

/* ------------------------------------------------------------------ seasons */

CREATE TABLE IF NOT EXISTS public.pass_seasons (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9][a-z0-9-]{0,23}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  kind text NOT NULL CHECK (kind IN ('season', 'test')),
  starts_at timestamptz,
  ends_at timestamptz,
  -- A test season reset for everyone: Joules, claims and progress count again from here.
  reset_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pass_seasons_order CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

INSERT INTO public.pass_seasons (id, name, kind) VALUES
  ('s1', 'Neon Circuit', 'season'),
  ('test', 'Test season', 'test')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.pass_member_resets (
  season_id text NOT NULL REFERENCES public.pass_seasons (id),
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  reset_at timestamptz NOT NULL,
  PRIMARY KEY (season_id, user_id)
);

/* ------------------------------------------------------------------ Joules */

CREATE TABLE IF NOT EXISTS public.pass_joules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season_id text NOT NULL REFERENCES public.pass_seasons (id),
  epoch bigint NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  source_key text NOT NULL CHECK (char_length(source_key) BETWEEN 3 AND 120),
  kind text NOT NULL CHECK (kind IN ('daily_puzzle', 'daily_arcade', 'room_round', 'room_finish', 'challenge',
                                     'practice', 'practice_challenge', 'weekly', 'rated', 'tournament')),
  -- The UK calendar day of the source event (the day limits and the soft cap count per UK day).
  uk_day date NOT NULL,
  at timestamptz NOT NULL,
  -- What the source pays after its day limit (0 when the limit was reached), and what was credited after the soft cap.
  base integer NOT NULL CHECK (base >= 0),
  amount integer NOT NULL CHECK (amount >= 0 AND amount <= base),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pass_joules_once UNIQUE (season_id, epoch, user_id, source_key)
);
CREATE INDEX IF NOT EXISTS pass_joules_day_idx ON public.pass_joules (season_id, epoch, user_id, uk_day);

CREATE TABLE IF NOT EXISTS public.pass_members (
  season_id text NOT NULL REFERENCES public.pass_seasons (id),
  epoch bigint NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  -- The highest level pass_level_reached has been recorded for, and the highest the level-up notice has shown.
  level_reached integer NOT NULL DEFAULT 0 CHECK (level_reached BETWEEN 0 AND 60),
  level_seen integer NOT NULL DEFAULT 0 CHECK (level_seen BETWEEN 0 AND 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season_id, epoch, user_id)
);

/* ------------------------------------------------------------------ the premium track, claims, titles */

CREATE TABLE IF NOT EXISTS public.pass_premium (
  season_id text NOT NULL REFERENCES public.pass_seasons (id),
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  -- 'test': a tester's test purchase (no payment); 'purchase': a real purchase (later); 'plus': Joulz Plus (E2).
  source text NOT NULL CHECK (source IN ('test', 'purchase', 'plus')),
  grant_key text NOT NULL CHECK (char_length(grant_key) BETWEEN 3 AND 120),
  granted_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_note text,
  PRIMARY KEY (season_id, user_id),
  CONSTRAINT pass_premium_removed CHECK ((removed_at IS NULL) = (removed_note IS NULL))
);

CREATE TABLE IF NOT EXISTS public.pass_claims (
  season_id text NOT NULL REFERENCES public.pass_seasons (id),
  epoch bigint NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  track text NOT NULL CHECK (track IN ('free', 'premium')),
  level integer NOT NULL CHECK (level BETWEEN 1 AND 60),
  reward jsonb NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season_id, epoch, user_id, track, level)
);

CREATE TABLE IF NOT EXISTS public.pass_title_unlocks (
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  title_id text NOT NULL CHECK (title_id IN ('neon-rider', 'circuit-breaker')),
  season_id text NOT NULL REFERENCES public.pass_seasons (id),
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, title_id)
);

/* ------------------------------------------------------------------ the weekly draws */

CREATE TABLE IF NOT EXISTS public.pass_weeks (
  week_start date PRIMARY KEY CHECK (extract(isodow FROM week_start) = 1),
  easy text NOT NULL CHECK (easy ~ '^e[0-9]{1,2}$'),
  medium text NOT NULL CHECK (medium ~ '^m[0-9]{1,2}$'),
  hard text NOT NULL CHECK (hard ~ '^h[0-9]{1,2}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $grants$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pass_seasons', 'pass_member_resets', 'pass_joules', 'pass_members', 'pass_premium',
                           'pass_claims', 'pass_title_unlocks', 'pass_weeks'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, service_role', t);
    EXECUTE format('GRANT SELECT ON public.%I TO service_role', t);
  END LOOP;
END
$grants$;

/* ------------------------------------------------------------------ crediting Joules */

-- Credits a batch of source events for one account in one season (and epoch). p_rows: [{key, kind, base, at}], paid in
-- the order of `at`. Under a lock on the account's member row, so two calls never pay past a limit together:
--   * a key already credited is 'duplicate' (once per source event);
--   * Practice: 20 a game up to 200 a UK day (later games that day are recorded at 0, 'limit');
--   * friend challenges: the first five a UK day pay (later ones 'limit');
--   * the soft cap: once the UK day's Joules from play reach 4,000, further play earns half (rounded down);
--   * weekly challenge rewards are paid whole and don't count towards the day.
-- Answers [{key, status: credited | duplicate | limit, amount}].
CREATE OR REPLACE FUNCTION public.pass_credit_joules(p_user_id uuid, p_season text, p_epoch bigint, p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  r jsonb;
  v_key text;
  v_kind text;
  v_at timestamptz;
  v_day date;
  v_base integer;
  v_allowed integer;
  v_total integer;
  v_n integer;
  v_amount integer;
  v_full integer;
  v_out jsonb := '[]'::jsonb;
BEGIN
  IF NOT economy.active_account(p_user_id) THEN
    RAISE EXCEPTION 'pass_credit_joules: no account';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pass_seasons WHERE id = p_season) THEN
    RAISE EXCEPTION 'pass_credit_joules: no season %', p_season;
  END IF;
  INSERT INTO public.pass_members (season_id, epoch, user_id) VALUES (p_season, p_epoch, p_user_id)
  ON CONFLICT DO NOTHING;
  PERFORM 1 FROM public.pass_members WHERE season_id = p_season AND epoch = p_epoch AND user_id = p_user_id FOR UPDATE;

  FOR r IN SELECT x FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) AS x ORDER BY (x ->> 'at')::timestamptz, x ->> 'key' LOOP
    v_key := r ->> 'key';
    v_kind := r ->> 'kind';
    v_at := (r ->> 'at')::timestamptz;
    v_base := (r ->> 'base')::integer;
    IF v_key IS NULL OR v_kind IS NULL OR v_at IS NULL OR v_base IS NULL OR v_base < 0 THEN
      RAISE EXCEPTION 'pass_credit_joules: a row needs key, kind, base and at';
    END IF;
    v_day := (v_at AT TIME ZONE 'Europe/London')::date;
    IF EXISTS (SELECT 1 FROM public.pass_joules WHERE season_id = p_season AND epoch = p_epoch AND user_id = p_user_id
                AND source_key = v_key) THEN
      v_out := v_out || jsonb_build_object('key', v_key, 'status', 'duplicate', 'amount', 0);
      CONTINUE;
    END IF;
    v_allowed := v_base;
    IF v_kind = 'practice' THEN
      SELECT count(*) INTO v_n FROM public.pass_joules
       WHERE season_id = p_season AND epoch = p_epoch AND user_id = p_user_id AND uk_day = v_day
         AND kind = 'practice' AND base > 0;
      IF v_n * 20 >= 200 THEN v_allowed := 0; END IF;
    ELSIF v_kind = 'challenge' THEN
      SELECT count(*) INTO v_n FROM public.pass_joules
       WHERE season_id = p_season AND epoch = p_epoch AND user_id = p_user_id AND uk_day = v_day
         AND kind = 'challenge' AND base > 0;
      IF v_n >= 5 THEN v_allowed := 0; END IF;
    END IF;
    IF v_kind = 'weekly' THEN
      v_amount := v_allowed;
    ELSE
      SELECT coalesce(sum(amount), 0) INTO v_total FROM public.pass_joules
       WHERE season_id = p_season AND epoch = p_epoch AND user_id = p_user_id AND uk_day = v_day AND kind <> 'weekly';
      IF v_allowed = 0 THEN
        v_amount := 0;
      ELSIF v_total >= 4000 THEN
        v_amount := v_allowed / 2;
      ELSIF v_total + v_allowed <= 4000 THEN
        v_amount := v_allowed;
      ELSE
        v_full := 4000 - v_total;
        v_amount := v_full + (v_allowed - v_full) / 2;
      END IF;
    END IF;
    INSERT INTO public.pass_joules (season_id, epoch, user_id, source_key, kind, uk_day, at, base, amount)
    VALUES (p_season, p_epoch, p_user_id, v_key, v_kind, v_day, v_at, v_allowed, v_amount);
    v_out := v_out || jsonb_build_object('key', v_key, 'status', CASE WHEN v_allowed = 0 THEN 'limit' ELSE 'credited' END,
                                         'amount', v_amount);
  END LOOP;
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.pass_credit_joules(uuid, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pass_credit_joules(uuid, text, bigint, jsonb) TO service_role;

/* ------------------------------------------------------------------ the account's pass state */

-- One account's state in a season and epoch: Joules total, today's (UK) Joules, claims, premium, the levels told,
-- this account's own test reset, and the credited Joules by source key prefix (for the results line).
CREATE OR REPLACE FUNCTION public.pass_state(p_user_id uuid, p_season text, p_epoch bigint)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'joules', coalesce((SELECT sum(amount) FROM public.pass_joules
                         WHERE season_id = p_season AND epoch = p_epoch AND user_id = p_user_id), 0),
    'claims', coalesce((SELECT jsonb_agg(jsonb_build_object('track', track, 'level', level) ORDER BY level, track)
                          FROM public.pass_claims WHERE season_id = p_season AND epoch = p_epoch AND user_id = p_user_id), '[]'::jsonb),
    'premium', (SELECT jsonb_build_object('source', source, 'grantedAt', granted_at)
                  FROM public.pass_premium WHERE season_id = p_season AND user_id = p_user_id AND removed_at IS NULL),
    'levelReached', coalesce((SELECT level_reached FROM public.pass_members
                               WHERE season_id = p_season AND epoch = p_epoch AND user_id = p_user_id), 0),
    'levelSeen', coalesce((SELECT level_seen FROM public.pass_members
                            WHERE season_id = p_season AND epoch = p_epoch AND user_id = p_user_id), 0),
    'weekly', coalesce((SELECT jsonb_agg(source_key) FROM public.pass_joules
                         WHERE season_id = p_season AND epoch = p_epoch AND user_id = p_user_id AND kind = 'weekly'), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.pass_state(uuid, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pass_state(uuid, text, bigint) TO service_role;

-- The Joules credited for source events from an instant on (the results screen's Joules line: what this game earned).
CREATE OR REPLACE FUNCTION public.pass_joules_since(p_user_id uuid, p_season text, p_epoch bigint, p_since timestamptz)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(sum(amount), 0)::integer FROM public.pass_joules
   WHERE season_id = p_season AND epoch = p_epoch AND user_id = p_user_id AND kind <> 'weekly' AND at >= p_since;
$$;
REVOKE ALL ON FUNCTION public.pass_joules_since(uuid, text, bigint, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pass_joules_since(uuid, text, bigint, timestamptz) TO service_role;

-- A tester's own test-season reset (null: none).
CREATE OR REPLACE FUNCTION public.pass_member_reset(p_user_id uuid, p_season text)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT reset_at FROM public.pass_member_resets WHERE season_id = p_season AND user_id = p_user_id;
$$;
REVOKE ALL ON FUNCTION public.pass_member_reset(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pass_member_reset(uuid, text) TO service_role;

-- Records the level reached (answers the level recorded before, so the server records pass_level_reached once for
-- each new level) and, with p_seen, the level the notice has shown.
CREATE OR REPLACE FUNCTION public.pass_note_level(p_user_id uuid, p_season text, p_epoch bigint, p_level integer, p_seen boolean)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_before integer;
BEGIN
  IF NOT economy.active_account(p_user_id) OR p_level < 0 OR p_level > 60 THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.pass_members (season_id, epoch, user_id) VALUES (p_season, p_epoch, p_user_id)
  ON CONFLICT DO NOTHING;
  SELECT CASE WHEN p_seen THEN level_seen ELSE level_reached END INTO v_before FROM public.pass_members
   WHERE season_id = p_season AND epoch = p_epoch AND user_id = p_user_id FOR UPDATE;
  IF p_seen THEN
    UPDATE public.pass_members SET level_seen = greatest(level_seen, p_level)
     WHERE season_id = p_season AND epoch = p_epoch AND user_id = p_user_id;
  ELSE
    UPDATE public.pass_members SET level_reached = greatest(level_reached, p_level)
     WHERE season_id = p_season AND epoch = p_epoch AND user_id = p_user_id;
  END IF;
  RETURN v_before;
END;
$$;
REVOKE ALL ON FUNCTION public.pass_note_level(uuid, text, bigint, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pass_note_level(uuid, text, bigint, integer, boolean) TO service_role;

-- Records a claim once (the server pays the reward first through A1's idempotent functions, under the claim's own key).
-- Answers claimed | duplicate | no_account.
CREATE OR REPLACE FUNCTION public.pass_record_claim(
  p_user_id uuid, p_season text, p_epoch bigint, p_track text, p_level integer, p_reward jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_n integer;
BEGIN
  IF NOT economy.active_account(p_user_id) THEN
    RETURN 'no_account';
  END IF;
  INSERT INTO public.pass_claims (season_id, epoch, user_id, track, level, reward)
  VALUES (p_season, p_epoch, p_user_id, p_track, p_level, coalesce(p_reward, '{}'::jsonb))
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN CASE WHEN v_n = 1 THEN 'claimed' ELSE 'duplicate' END;
END;
$$;
REVOKE ALL ON FUNCTION public.pass_record_claim(uuid, text, bigint, text, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pass_record_claim(uuid, text, bigint, text, integer, jsonb) TO service_role;

-- Gives an account the premium track for a season. Idempotent: an account that already has it answers 'already' (a
-- removed test purchase can be granted again). p_source: test (a tester's test purchase; the tester list is checked
-- here too), purchase (a real purchase, later), plus (Joulz Plus, E2). Answers granted | already | no_account |
-- unknown_season | not_tester | bad_source.
CREATE OR REPLACE FUNCTION public.pass_grant_premium(p_user_id uuid, p_season text, p_source text, p_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_row public.pass_premium%ROWTYPE;
BEGIN
  IF p_source NOT IN ('test', 'purchase', 'plus') OR coalesce(p_key, '') = '' THEN
    RETURN 'bad_source';
  END IF;
  IF NOT economy.active_account(p_user_id) THEN
    RETURN 'no_account';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pass_seasons WHERE id = p_season) THEN
    RETURN 'unknown_season';
  END IF;
  IF p_source = 'test' AND NOT public.shop_is_tester(p_user_id) THEN
    RETURN 'not_tester';
  END IF;
  SELECT * INTO v_row FROM public.pass_premium WHERE season_id = p_season AND user_id = p_user_id FOR UPDATE;
  IF FOUND AND v_row.removed_at IS NULL THEN
    RETURN 'already';
  END IF;
  IF FOUND THEN
    UPDATE public.pass_premium
       SET source = p_source, grant_key = p_key, granted_at = now(), removed_at = NULL, removed_note = NULL
     WHERE season_id = p_season AND user_id = p_user_id;
  ELSE
    INSERT INTO public.pass_premium (season_id, user_id, source, grant_key) VALUES (p_season, p_user_id, p_source, p_key);
  END IF;
  RETURN 'granted';
END;
$$;
REVOKE ALL ON FUNCTION public.pass_grant_premium(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pass_grant_premium(uuid, text, text, text) TO service_role;

-- Unlocks a pass title. Answers unlocked | already | no_account | unknown_title.
CREATE OR REPLACE FUNCTION public.pass_unlock_title(p_user_id uuid, p_title text, p_season text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_n integer;
BEGIN
  IF p_title NOT IN ('neon-rider', 'circuit-breaker') THEN
    RETURN 'unknown_title';
  END IF;
  IF NOT economy.active_account(p_user_id) THEN
    RETURN 'no_account';
  END IF;
  INSERT INTO public.pass_title_unlocks (user_id, title_id, season_id) VALUES (p_user_id, p_title, p_season)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN CASE WHEN v_n = 1 THEN 'unlocked' ELSE 'already' END;
END;
$$;
REVOKE ALL ON FUNCTION public.pass_unlock_title(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pass_unlock_title(uuid, text, text) TO service_role;

-- The pass titles an account has unlocked.
CREATE OR REPLACE FUNCTION public.pass_titles_of(p_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(title_id ORDER BY unlocked_at, title_id), ARRAY[]::text[])
    FROM public.pass_title_unlocks WHERE user_id = p_user_id;
$$;
REVOKE ALL ON FUNCTION public.pass_titles_of(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pass_titles_of(uuid) TO service_role;

-- Records a week's three (kept as first drawn).
CREATE OR REPLACE FUNCTION public.pass_record_week(p_week date, p_easy text, p_medium text, p_hard text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.pass_weeks (week_start, easy, medium, hard) VALUES (p_week, p_easy, p_medium, p_hard)
  ON CONFLICT (week_start) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public.pass_record_week(date, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pass_record_week(date, text, text, text) TO service_role;

/* ------------------------------------------------------------------ the stored results the pass reads */

-- One account's stored play between two instants, as source events: room rounds (live and archived by Play again,
-- keyed by the result row's id, so archiving never counts one twice), room finishes (the last round's result: keyed
-- by the room and its game index), Daily and friend-challenge rounds and finishes (challenge attempts copied in from a
-- room left out: those rounds were the room's), counted Practice runs (C1a's: graded, counted, after its fresh
-- start), stars earned (C1a) and Practice challenges completed (C1b). Read only.
-- Answers [{k, key, at, game, score, day}] (day: a Daily's UK day).
CREATE OR REPLACE FUNCTION public.pass_activity(p_user_id uuid, p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  live_rounds AS (
    SELECT 'room_round'::text AS k, 'room_round:' || r.id AS key, r.submitted_at AS at,
           d.round_order ->> (r.round_number - 1) AS game, r.score, NULL::date AS day
      FROM public.round_results r
      JOIN public.duel_players p ON p.duel_id = r.duel_id AND p.player_slot = r.player_slot AND p.user_id = p_user_id
      JOIN public.duels d ON d.id = r.duel_id
     WHERE r.submitted_at >= p_from AND r.submitted_at < p_to
  ),
  archived_rounds AS (
    SELECT 'room_round', 'room_round:' || a.id, a.submitted_at, a.game_id, a.score, NULL::date
      FROM public.round_results_archive a
     WHERE a.user_id = p_user_id AND a.submitted_at >= p_from AND a.submitted_at < p_to
  ),
  live_finishes AS (
    SELECT 'room_finish', 'room_finish:' || d.id || ':' || coalesce(jsonb_array_length(d.tournament_history), 0),
           r.submitted_at, NULL::text, NULL::integer, NULL::date
      FROM public.duels d
      JOIN public.round_results r ON r.duel_id = d.id AND r.round_number = jsonb_array_length(d.round_order)
      JOIN public.duel_players p ON p.duel_id = r.duel_id AND p.player_slot = r.player_slot AND p.user_id = p_user_id
     WHERE d.status = 'finished' AND jsonb_typeof(d.round_order) = 'array' AND jsonb_array_length(d.round_order) > 0
       AND r.submitted_at >= p_from AND r.submitted_at < p_to
  ),
  archived_finishes AS (
    SELECT 'room_finish', 'room_finish:' || a.duel_id || ':' || a.game_index, a.submitted_at, NULL::text, NULL::integer, NULL::date
      FROM public.round_results_archive a
     WHERE a.user_id = p_user_id AND a.submitted_at >= p_from AND a.submitted_at < p_to
       AND a.round_number = (SELECT max(b.round_number) FROM public.round_results_archive b
                              WHERE b.duel_id = a.duel_id AND b.game_index = a.game_index)
  ),
  attempts AS (
    SELECT t.*, ar.kind, ar.day, ar.round_order, ar.opens_at,
           (c.source = 'room' AND t.started_at - ar.opens_at < interval '1 second') AS imported
      FROM public.async_attempts t
      JOIN public.async_rooms ar ON ar.id = t.room_id
      LEFT JOIN public.challenges c ON c.room_id = t.room_id
     WHERE t.user_id = p_user_id
  ),
  async_rounds AS (
    SELECT CASE t.kind WHEN 'daily_puzzle' THEN 'daily_puzzle_round' WHEN 'daily_arcade' THEN 'daily_arcade_round'
                       ELSE 'challenge_round' END,
           'async_round:' || r.id, coalesce(r.answered_at, r.started_at),
           t.round_order ->> (r.round_number - 1), r.score, t.day
      FROM public.async_results r
      JOIN attempts t ON t.id = r.attempt_id
     WHERE NOT coalesce(t.imported, false)
       AND coalesce(r.answered_at, r.started_at) >= p_from AND coalesce(r.answered_at, r.started_at) < p_to
  ),
  async_finishes AS (
    SELECT CASE t.kind WHEN 'daily_puzzle' THEN 'daily_puzzle' WHEN 'daily_arcade' THEN 'daily_arcade' ELSE 'challenge' END,
           CASE WHEN t.kind = 'challenge' THEN 'challenge:' || t.id ELSE t.kind || ':' || t.day END,
           t.finished_at, NULL::text, t.total_score, t.day
      FROM attempts t
     WHERE t.finished_at IS NOT NULL AND NOT coalesce(t.imported, false)
       AND t.finished_at >= p_from AND t.finished_at < p_to
  ),
  practice AS (
    SELECT 'practice', 'practice:' || pp.id, pp.created_at, pp.game_id, pp.score, NULL::date
      FROM public.practice_plays pp
     WHERE pp.user_id = p_user_id AND pp.progress_counted_at IS NOT NULL AND NOT pp.example
       AND pp.created_at >= (SELECT fresh_start_at FROM public.practice_progress_start LIMIT 1)
       AND pp.created_at >= p_from AND pp.created_at < p_to
  ),
  stars AS (
    SELECT 'star', 'star:' || s.game_id || ':' || s.level, s.star_at, s.game_id, s.star_score, NULL::date
      FROM public.practice_progress s
     WHERE s.user_id = p_user_id AND s.star_at IS NOT NULL AND s.star_at >= p_from AND s.star_at < p_to
  ),
  practice_challenges AS (
    SELECT 'practice_challenge', 'practice_challenge:' || pc.challenge_id, pc.completed_at, pc.game_id, NULL::integer, NULL::date
      FROM public.practice_challenge_progress pc
     WHERE pc.user_id = p_user_id AND pc.completed_at IS NOT NULL AND pc.completed_at >= p_from AND pc.completed_at < p_to
  ),
  everything (k, key, at, game, score, day) AS (
    SELECT * FROM live_rounds
    UNION ALL SELECT * FROM archived_rounds
    UNION ALL SELECT * FROM live_finishes
    UNION ALL SELECT * FROM archived_finishes
    UNION ALL SELECT * FROM async_rounds
    UNION ALL SELECT * FROM async_finishes
    UNION ALL SELECT * FROM practice
    UNION ALL SELECT * FROM stars
    UNION ALL SELECT * FROM practice_challenges
  ),
  -- A room round archived after being read live keeps its key; read both at once, keep one.
  distinct_events AS (
    SELECT DISTINCT ON (key) k, key, at, game, score, day FROM everything ORDER BY key, at
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('k', k, 'key', key, 'at', at, 'game', game, 'score', score, 'day', day)
                            ORDER BY at, key), '[]'::jsonb)
    FROM distinct_events;
$$;
REVOKE ALL ON FUNCTION public.pass_activity(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pass_activity(uuid, timestamptz, timestamptz) TO service_role;

-- The games an account had played (any mode) before an instant: for "a game you've never played".
CREATE OR REPLACE FUNCTION public.pass_games_before(p_user_id uuid, p_before timestamptz)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(DISTINCT g) FILTER (WHERE g IS NOT NULL), ARRAY[]::text[]) FROM (
    SELECT d.round_order ->> (r.round_number - 1) AS g
      FROM public.round_results r
      JOIN public.duel_players p ON p.duel_id = r.duel_id AND p.player_slot = r.player_slot AND p.user_id = p_user_id
      JOIN public.duels d ON d.id = r.duel_id
     WHERE r.submitted_at < p_before
    UNION ALL
    SELECT a.game_id FROM public.round_results_archive a WHERE a.user_id = p_user_id AND a.submitted_at < p_before
    UNION ALL
    SELECT ar.round_order ->> (r.round_number - 1)
      FROM public.async_results r JOIN public.async_rooms ar ON ar.id = r.room_id
     WHERE r.user_id = p_user_id AND r.started_at < p_before
    UNION ALL
    SELECT pp.game_id FROM public.practice_plays pp WHERE pp.user_id = p_user_id AND pp.created_at < p_before
  ) AS played;
$$;
REVOKE ALL ON FUNCTION public.pass_games_before(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pass_games_before(uuid, timestamptz) TO service_role;

/* ------------------------------------------------------------------ Joe's functions (the pass schema) */

CREATE TABLE IF NOT EXISTS pass.admin_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  season_id text,
  -- A removed account's lines keep what was done but no longer name it.
  user_id uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  detail jsonb,
  note text NOT NULL,
  by_role text NOT NULL DEFAULT session_user
);
ALTER TABLE pass.admin_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON pass.admin_log FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION pass.log(p_action text, p_season text, p_user_id uuid, p_detail jsonb, p_note text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pass
AS $$
DECLARE
  v_id bigint;
BEGIN
  IF coalesce(trim(p_note), '') = '' THEN
    RAISE EXCEPTION 'pass.%: give a note (why)', p_action;
  END IF;
  INSERT INTO pass.admin_log (action, season_id, user_id, detail, note)
  VALUES (p_action, p_season, p_user_id, p_detail, p_note)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION pass.log(text, text, uuid, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;

-- Sets a real season's start and end (UK times are fine: '2027-01-26 00:00 Europe/London'). The end may be null (open).
--   SELECT pass.set_season_dates('s1', '2027-01-26 00:00 Europe/London', '2027-03-23 00:00 Europe/London', 'Season 1 dates');
CREATE OR REPLACE FUNCTION pass.set_season_dates(p_season text, p_starts timestamptz, p_ends timestamptz, p_note text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pass
AS $$
DECLARE
  v_kind text;
BEGIN
  SELECT kind INTO v_kind FROM public.pass_seasons WHERE id = p_season FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pass.set_season_dates: no season %', p_season;
  END IF;
  IF v_kind <> 'season' THEN
    RAISE EXCEPTION 'pass.set_season_dates: % is the test season: use pass.start_test_season', p_season;
  END IF;
  IF p_starts IS NULL OR (p_ends IS NOT NULL AND p_ends <= p_starts) THEN
    RAISE EXCEPTION 'pass.set_season_dates: give a start, and an end after it (or null)';
  END IF;
  PERFORM pass.log('set_season_dates', p_season, NULL, jsonb_build_object('starts_at', p_starts, 'ends_at', p_ends), p_note);
  UPDATE public.pass_seasons SET starts_at = p_starts, ends_at = p_ends, updated_at = now() WHERE id = p_season;
  RETURN 'set';
END;
$$;
REVOKE ALL ON FUNCTION pass.set_season_dates(text, timestamptz, timestamptz, text) FROM PUBLIC, anon, authenticated, service_role;

-- Ends a season now (its Joules, claims and items stay; nothing more is earned or claimed).
--   SELECT pass.end_season('s1', 'Season 1 over');
CREATE OR REPLACE FUNCTION pass.end_season(p_season text, p_note text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pass
AS $$
DECLARE
  v_row public.pass_seasons%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.pass_seasons WHERE id = p_season FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pass.end_season: no season %', p_season;
  END IF;
  IF v_row.starts_at IS NULL OR v_row.starts_at > now() THEN
    RAISE EXCEPTION 'pass.end_season: % has not started', p_season;
  END IF;
  IF v_row.ends_at IS NOT NULL AND v_row.ends_at <= now() THEN
    RETURN 'already_ended';
  END IF;
  PERFORM pass.log('end_season', p_season, NULL, jsonb_build_object('ends_at', now()), p_note);
  UPDATE public.pass_seasons SET ends_at = now(), updated_at = now() WHERE id = p_season;
  RETURN 'ended';
END;
$$;
REVOKE ALL ON FUNCTION pass.end_season(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Adds a later season (no dates: set them with pass.set_season_dates).
--   SELECT pass.create_season('s2', 'Season 2 name', 'next season');
CREATE OR REPLACE FUNCTION pass.create_season(p_season text, p_name text, p_note text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pass
AS $$
DECLARE
  v_n integer;
BEGIN
  PERFORM pass.log('create_season', NULL, NULL, jsonb_build_object('id', p_season, 'name', p_name), p_note);
  INSERT INTO public.pass_seasons (id, name, kind) VALUES (p_season, p_name, 'season') ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN CASE WHEN v_n = 1 THEN 'created' ELSE 'exists' END;
END;
$$;
REVOKE ALL ON FUNCTION pass.create_season(text, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- The testers' season: starts now (testers only; open-ended unless an end is given). Starting it again while it runs
-- keeps its start; after it ended it starts afresh (a new start: earlier Joules and claims no longer count).
--   SELECT pass.start_test_season('testing the pass');
CREATE OR REPLACE FUNCTION pass.start_test_season(p_note text, p_ends timestamptz DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pass
AS $$
DECLARE
  v_row public.pass_seasons%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.pass_seasons WHERE id = 'test' FOR UPDATE;
  IF p_ends IS NOT NULL AND p_ends <= now() THEN
    RAISE EXCEPTION 'pass.start_test_season: the end must be later than now';
  END IF;
  IF v_row.starts_at IS NOT NULL AND v_row.starts_at <= now() AND (v_row.ends_at IS NULL OR v_row.ends_at > now()) THEN
    PERFORM pass.log('start_test_season', 'test', NULL, jsonb_build_object('ends_at', p_ends, 'already', true), p_note);
    UPDATE public.pass_seasons SET ends_at = p_ends, updated_at = now() WHERE id = 'test';
    RETURN 'running';
  END IF;
  PERFORM pass.log('start_test_season', 'test', NULL, jsonb_build_object('starts_at', now(), 'ends_at', p_ends), p_note);
  UPDATE public.pass_seasons SET starts_at = now(), ends_at = p_ends, reset_at = NULL, updated_at = now() WHERE id = 'test';
  RETURN 'started';
END;
$$;
REVOKE ALL ON FUNCTION pass.start_test_season(text, timestamptz) FROM PUBLIC, anon, authenticated, service_role;

--   SELECT pass.end_test_season('testing finished');
CREATE OR REPLACE FUNCTION pass.end_test_season(p_note text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pass
AS $$
DECLARE
  v_row public.pass_seasons%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.pass_seasons WHERE id = 'test' FOR UPDATE;
  IF v_row.starts_at IS NULL OR (v_row.ends_at IS NOT NULL AND v_row.ends_at <= now()) THEN
    RETURN 'not_running';
  END IF;
  PERFORM pass.log('end_test_season', 'test', NULL, jsonb_build_object('ends_at', now()), p_note);
  UPDATE public.pass_seasons SET ends_at = now(), updated_at = now() WHERE id = 'test';
  RETURN 'ended';
END;
$$;
REVOKE ALL ON FUNCTION pass.end_test_season(text) FROM PUBLIC, anon, authenticated, service_role;

-- Resets the test season for one tester (by username or user id) or, with no player, for every tester: Joules,
-- claims, levels and weekly progress count again from now. Nothing is deleted (earlier lines stay under their old
-- start); items and coins already claimed stay owned.
--   SELECT pass.reset_test_season('again from zero', 'TheirUsername');
--   SELECT pass.reset_test_season('everyone again from zero');
CREATE OR REPLACE FUNCTION pass.reset_test_season(p_note text, p_player text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pass, economy
AS $$
DECLARE
  v_user uuid;
BEGIN
  IF p_player IS NULL THEN
    PERFORM pass.log('reset_test_season', 'test', NULL, jsonb_build_object('all', true), p_note);
    UPDATE public.pass_seasons SET reset_at = now(), updated_at = now() WHERE id = 'test';
    RETURN 'reset_all';
  END IF;
  v_user := economy.account(p_player);
  PERFORM pass.log('reset_test_season', 'test', v_user, NULL, p_note);
  INSERT INTO public.pass_member_resets (season_id, user_id, reset_at) VALUES ('test', v_user, now())
  ON CONFLICT (season_id, user_id) DO UPDATE SET reset_at = EXCLUDED.reset_at;
  RETURN 'reset';
END;
$$;
REVOKE ALL ON FUNCTION pass.reset_test_season(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Test purchases of the premium track (all, or one player's).
--   SELECT * FROM pass.test_purchases();
CREATE OR REPLACE FUNCTION pass.test_purchases(p_player text DEFAULT NULL)
RETURNS TABLE (season_id text, username text, user_id uuid, granted_at timestamptz, removed_at timestamptz, removed_note text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pass, economy
AS $$
  SELECT pr.season_id, p.username, pr.user_id, pr.granted_at, pr.removed_at, pr.removed_note
    FROM public.pass_premium pr JOIN public.profiles p ON p.user_id = pr.user_id
   WHERE pr.source = 'test' AND (p_player IS NULL OR pr.user_id = economy.account(p_player))
   ORDER BY pr.granted_at DESC;
$$;
REVOKE ALL ON FUNCTION pass.test_purchases(text) FROM PUBLIC, anon, authenticated, service_role;

-- Takes a test purchase of the premium track away (marked removed, never deleted). Premium rewards already claimed
-- stay owned. p_season null: every season's.
--   SELECT pass.remove_test_purchase('TheirUsername', 'end of the test round');
--   SELECT pass.remove_test_purchase('TheirUsername', 'end of the test round', 'test');
CREATE OR REPLACE FUNCTION pass.remove_test_purchase(p_player text, p_note text, p_season text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pass, economy
AS $$
DECLARE
  v_user uuid := economy.account(p_player);
  v_n integer;
BEGIN
  PERFORM pass.log('remove_test_purchase', p_season, v_user, NULL, p_note);
  UPDATE public.pass_premium SET removed_at = now(), removed_note = p_note
   WHERE user_id = v_user AND source = 'test' AND removed_at IS NULL AND (p_season IS NULL OR season_id = p_season);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN CASE WHEN v_n > 0 THEN 'removed' ELSE 'none' END;
END;
$$;
REVOKE ALL ON FUNCTION pass.remove_test_purchase(text, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- A week's three weekly challenges as drawn (null: not drawn yet; the week is any day of it).
--   SELECT pass.week('2026-11-16');
CREATE OR REPLACE FUNCTION pass.week(p_day date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pass
AS $$
  SELECT to_jsonb(w) FROM public.pass_weeks w
   WHERE w.week_start = p_day - (extract(isodow FROM p_day)::integer - 1);
$$;
REVOKE ALL ON FUNCTION pass.week(date) FROM PUBLIC, anon, authenticated, service_role;

-- One account's pass at a glance: per season and start, Joules, claims and premium.
--   SELECT pass.summary('TheirUsername');
CREATE OR REPLACE FUNCTION pass.summary(p_player text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pass, economy
AS $$
  WITH u AS (SELECT economy.account(p_player) AS id)
  SELECT jsonb_build_object(
    'joules', (SELECT coalesce(jsonb_agg(jsonb_build_object('season', season_id, 'epoch', epoch, 'joules', s)), '[]'::jsonb)
                 FROM (SELECT season_id, epoch, sum(amount) AS s FROM public.pass_joules, u
                        WHERE user_id = u.id GROUP BY season_id, epoch) j),
    'claims', (SELECT count(*) FROM public.pass_claims, u WHERE user_id = u.id),
    'premium', (SELECT coalesce(jsonb_agg(to_jsonb(pr) - 'user_id'), '[]'::jsonb) FROM public.pass_premium pr, u WHERE pr.user_id = u.id),
    'titles', (SELECT coalesce(jsonb_agg(title_id), '[]'::jsonb) FROM public.pass_title_unlocks t, u WHERE t.user_id = u.id)
  );
$$;
REVOKE ALL ON FUNCTION pass.summary(text) FROM PUBLIC, anon, authenticated, service_role;
