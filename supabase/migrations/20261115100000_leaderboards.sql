-- Leaderboards (wave 4, session W4a; 11 Nov 2026; docs/leaderboards.md). Additive, non-destructive and idempotent: it
-- creates a private schema, tables, indexes and functions, and schedules one pg_cron job where pg_cron exists. No
-- existing row or object is changed.
--
--   leaderboard_settings        "Show me on leaderboards": an account's choice (no row = the default: shown for 18+,
--                               hidden for under-18s)
--   leaderboard_generations     one row per refresh of the rating boards (the newest complete one is read)
--   leaderboard_rating_rows     the rating boards as of a generation: Joulz Rating, Puzzles, Arcade and the 11
--                               categories, this season and all-time peak, with each row's global and country rank
--   daily_boards                one row per Daily (Puzzle / Arcade, one per UK day): its field size and whether it is
--                               final (refreshed until 30 minutes after the day closes, then frozen and kept)
--   daily_board_entries         each counted attempt's rank on its Daily board
--
-- Boards are refreshed by public.leaderboard_refresh() (pg_cron job `leaderboards-refresh`, every 5 minutes), never
-- computed per request. Rows store ids, values and ranks only, never a name: names, colours and player numbers are
-- read from public.profiles when a board is read, so a rename shows at once and a deleted account's name is gone.
--
-- Who counts on a Daily board: accounts only (a profile), each account's one attempt that day (async_attempts is unique
-- per room and player), finished, made by an account at least 24 hours old when the attempt started (so a throwaway
-- account can't top the board), and never an attempt with a flagged round (the server replay flagged it). Order:
-- higher total, then less time (the room tie-break), level on both sharing a place (1, 2, 2, 4), exactly
-- src/lib/duel/ranking.ts; display order inside a shared place by finish time, then id (daily.ts rankBoard).
--
-- Privacy (decided 11 Nov 2026): on global and country boards an under-18 is shown as "Hidden player" unless they
-- switched "Show me on leaderboards" on; an adult is shown unless they switched it off. A hidden row keeps its rank and
-- value. Friends always see each other, and a player always sees their own row. A board row carries no more than the
-- player card shows (username, colour, player number).
--
-- The rating boards read W3a's ratings through ONE function, leaderboards.rating_source() (below). W3a's ratings
-- engine is not merged yet, so it answers no rows and every rating board reads as "not ready"; binding it is one
-- `CREATE OR REPLACE FUNCTION leaderboards.rating_source()` in a later migration over W3a's tables (the contract is in
-- docs/leaderboards.md). The checks stand a source in to prove the boards.
--
-- Nobody but the service role reaches any of it: no grants to anon or authenticated on the tables or functions, RLS on
-- with no policies. The server reads boards for a caller through the functions below (src/lib/data/leaderboards.server.ts).

CREATE SCHEMA IF NOT EXISTS leaderboards;
REVOKE ALL ON SCHEMA leaderboards FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA leaderboards TO service_role;

/* ------------------------------------------------------------------ tables */

CREATE TABLE IF NOT EXISTS public.leaderboard_settings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  show_on_boards boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leaderboard_generations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  made_at timestamptz NOT NULL DEFAULT now(),
  -- Rows written; set when the generation is complete (readers take the newest complete one).
  row_count integer,
  complete boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.leaderboard_rating_rows (
  generation bigint NOT NULL REFERENCES public.leaderboard_generations (id) ON DELETE CASCADE,
  board text NOT NULL CHECK (board IN ('joulz', 'puzzles', 'arcade', 'word', 'number', 'speed', 'attention', 'pattern',
                                       'logic', 'retro', 'sports', 'cards', 'action', 'strategy')),
  period text NOT NULL CHECK (period IN ('season', 'peak')),
  player_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  value integer NOT NULL,
  global_rank integer NOT NULL CHECK (global_rank >= 1),
  -- Display order inside a shared rank (player number).
  position integer NOT NULL CHECK (position >= 1),
  country text,
  country_rank integer,
  -- W3a's tier id for this rating ('top500' marks the Top 500); this season's Joulz board only.
  tier text,
  PRIMARY KEY (generation, board, period, player_id)
);
CREATE INDEX IF NOT EXISTS leaderboard_rating_rows_rank
  ON public.leaderboard_rating_rows (generation, board, period, position);
CREATE INDEX IF NOT EXISTS leaderboard_rating_rows_country
  ON public.leaderboard_rating_rows (generation, board, period, country, country_rank);
CREATE INDEX IF NOT EXISTS leaderboard_rating_rows_player
  ON public.leaderboard_rating_rows (player_id);

CREATE TABLE IF NOT EXISTS public.daily_boards (
  room_id uuid PRIMARY KEY REFERENCES public.async_rooms (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('daily_puzzle', 'daily_arcade')),
  day date NOT NULL,
  -- Players counted on the board (the field size the Daily badges need).
  players integer NOT NULL DEFAULT 0,
  final boolean NOT NULL DEFAULT false,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_boards_once UNIQUE (kind, day)
);

CREATE TABLE IF NOT EXISTS public.daily_board_entries (
  room_id uuid NOT NULL REFERENCES public.daily_boards (room_id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL REFERENCES public.async_attempts (id) ON DELETE CASCADE,
  -- The account; NULL once the account is deleted (the row keeps its place, shown as "Deleted player").
  player_id uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  total integer NOT NULL,
  tie_ms bigint NOT NULL,
  finished_at timestamptz NOT NULL,
  rank integer NOT NULL CHECK (rank >= 1),
  position integer NOT NULL CHECK (position >= 1),
  PRIMARY KEY (room_id, attempt_id)
);
CREATE INDEX IF NOT EXISTS daily_board_entries_order ON public.daily_board_entries (room_id, position);
CREATE INDEX IF NOT EXISTS daily_board_entries_player ON public.daily_board_entries (player_id);

DO $grants$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['leaderboard_settings', 'leaderboard_generations', 'leaderboard_rating_rows',
                           'daily_boards', 'daily_board_entries'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END
$grants$;

/* ------------------------------------------------------------------ private helpers */

-- 18 or over on the UK calendar day (src/lib/account/age.ts's rule).
CREATE OR REPLACE FUNCTION leaderboards.is_adult(p_date_of_birth date)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$ SELECT p_date_of_birth <= ((now() AT TIME ZONE 'Europe/London')::date - interval '18 years')::date $$;

-- Whether a player is shown by name on global and country boards: their setting, else adults yes, under-18s no. A
-- profile waiting for deletion is never shown.
CREATE OR REPLACE FUNCTION leaderboards.shown(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT CASE WHEN p.deletion_requested_at IS NOT NULL THEN false
                 ELSE coalesce(s.show_on_boards, leaderboards.is_adult(p.date_of_birth)) END
       FROM public.profiles p
       LEFT JOIN public.leaderboard_settings s ON s.user_id = p.user_id
      WHERE p.user_id = p_user),
    false);
$$;

CREATE OR REPLACE FUNCTION leaderboards.friends(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_a IS NOT NULL AND p_b IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.friendships WHERE user_low = least(p_a, p_b) AND user_high = greatest(p_a, p_b));
$$;

-- One board row as a phone may see it: rank, value and, when the viewer may see who it is, the card's public fields.
CREATE OR REPLACE FUNCTION leaderboards.row_json(p_viewer uuid, p_player uuid, p_rank integer, p_value bigint,
                                                p_friends_scope boolean, p_extra jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.profiles%ROWTYPE;
  is_me boolean := p_player IS NOT NULL AND p_player = p_viewer;
  is_friend boolean := NOT is_me AND leaderboards.friends(p_viewer, p_player);
  visible boolean;
BEGIN
  IF p_player IS NOT NULL THEN
    SELECT * INTO p FROM public.profiles WHERE user_id = p_player;
  END IF;
  visible := p.user_id IS NOT NULL AND (is_me OR (p.deletion_requested_at IS NULL AND
             (is_friend OR p_friends_scope OR leaderboards.shown(p_player))));
  RETURN jsonb_build_object(
    'rank', p_rank,
    'value', p_value,
    'isMe', is_me,
    'isFriend', is_friend,
    'hidden', NOT visible,
    'deleted', p.user_id IS NULL,
    'name', CASE WHEN visible THEN p.username END,
    'colour', CASE WHEN visible THEN p.colour END,
    'playerNumber', CASE WHEN visible THEN p.player_number END
  ) || coalesce(p_extra, '{}'::jsonb);
END
$$;

-- W3a's ratings, as the boards read them: one row per player and board (joulz, puzzles, arcade or a category) with
-- this season's rating (NULL when not rated this season), the all-time peak (NULL when never rated) and, for this
-- season's Joulz Rating, W3a's tier id (src/lib/data/ratings.ts TIERS; 'top500' for the Top 500, from W3a's caps).
-- Players still in placement are left out (W3a hides every rating until placement is done). Until W3a's engine is
-- merged this answers nothing; see the header.
CREATE OR REPLACE FUNCTION leaderboards.rating_source()
RETURNS TABLE (player_id uuid, board text, season_rating integer, peak_rating integer, tier text)
LANGUAGE sql
STABLE
AS $$ SELECT NULL::uuid, NULL::text, NULL::integer, NULL::integer, NULL::text WHERE false $$;

DO $private$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['leaderboards.is_adult(date)', 'leaderboards.shown(uuid)', 'leaderboards.friends(uuid, uuid)',
                           'leaderboards.row_json(uuid, uuid, integer, bigint, boolean, jsonb)',
                           'leaderboards.rating_source()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END
$private$;

/* ------------------------------------------------------------------ refresh */

-- A new generation of the rating boards from leaderboards.rating_source(); the one before it is kept (a read in flight
-- finishes on it) and older ones are removed. Ranks: a higher rating first, level ratings sharing a rank (1, 2, 2, 4);
-- display order inside a rank by player number.
CREATE OR REPLACE FUNCTION public.leaderboard_refresh_ratings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gen bigint;
  n integer;
BEGIN
  INSERT INTO public.leaderboard_generations DEFAULT VALUES RETURNING id INTO gen;
  WITH src AS (
    SELECT s.player_id, s.board, x.period, x.value, CASE WHEN x.period = 'season' AND s.board = 'joulz' THEN s.tier END AS tier,
           p.country, p.player_number
      FROM leaderboards.rating_source() s
      JOIN public.profiles p ON p.user_id = s.player_id AND p.deletion_requested_at IS NULL
      CROSS JOIN LATERAL (VALUES ('season', s.season_rating), ('peak', s.peak_rating)) AS x(period, value)
     WHERE x.value IS NOT NULL
       AND s.board IN ('joulz', 'puzzles', 'arcade', 'word', 'number', 'speed', 'attention', 'pattern', 'logic',
                       'retro', 'sports', 'cards', 'action', 'strategy')
  )
  INSERT INTO public.leaderboard_rating_rows (generation, board, period, player_id, value, global_rank, position,
                                              country, country_rank, tier)
  SELECT gen, board, period, player_id, value,
         rank() OVER (PARTITION BY board, period ORDER BY value DESC),
         row_number() OVER (PARTITION BY board, period ORDER BY value DESC, player_number ASC),
         country,
         CASE WHEN country IS NOT NULL THEN rank() OVER (PARTITION BY board, period, country ORDER BY value DESC) END,
         tier
    FROM src;
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.leaderboard_generations SET complete = true, row_count = n WHERE id = gen;
  DELETE FROM public.leaderboard_generations
   WHERE id < (SELECT max(id) FROM public.leaderboard_generations WHERE complete AND id < gen);
  RETURN jsonb_build_object('generation', gen, 'rows', n);
END
$$;

-- Every Daily board not yet final: recomputed from the attempts; frozen (final) once its day closed 30 minutes ago, so
-- every round started before the close has finished. Final boards are never recomputed and are kept.
CREATE OR REPLACE FUNCTION public.leaderboard_refresh_daily(p_now timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  n integer;
  boards integer := 0;
  finals integer := 0;
BEGIN
  FOR r IN
    SELECT ar.id, ar.kind, ar.day, ar.closes_at
      FROM public.async_rooms ar
      LEFT JOIN public.daily_boards b ON b.room_id = ar.id
     WHERE ar.kind IN ('daily_puzzle', 'daily_arcade') AND ar.day IS NOT NULL
       AND ar.opens_at <= p_now AND coalesce(b.final, false) = false
     ORDER BY ar.day
  LOOP
    INSERT INTO public.daily_boards (room_id, kind, day) VALUES (r.id, r.kind, r.day)
      ON CONFLICT (room_id) DO NOTHING;
    DELETE FROM public.daily_board_entries WHERE room_id = r.id;
    INSERT INTO public.daily_board_entries (room_id, attempt_id, player_id, total, tie_ms, finished_at, rank, position)
    SELECT r.id, a.id, a.user_id, a.total_score, a.tie_ms, a.finished_at,
           rank() OVER (ORDER BY a.total_score DESC, a.tie_ms ASC),
           row_number() OVER (ORDER BY a.total_score DESC, a.tie_ms ASC, a.finished_at ASC, a.id::text COLLATE "C" ASC)
      FROM public.async_attempts a
      JOIN public.profiles p ON p.user_id = a.user_id
     WHERE a.room_id = r.id
       AND a.finished_at IS NOT NULL
       AND p.created_at <= a.started_at - interval '24 hours'
       AND NOT EXISTS (SELECT 1 FROM public.async_results x
                        WHERE x.attempt_id = a.id AND coalesce(x.extra ->> 'flagged', '') = 'true');
    GET DIAGNOSTICS n = ROW_COUNT;
    UPDATE public.daily_boards
       SET players = n, refreshed_at = p_now, final = (p_now >= r.closes_at + interval '30 minutes')
     WHERE room_id = r.id;
    boards := boards + 1;
    IF p_now >= r.closes_at + interval '30 minutes' THEN finals := finals + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('boards', boards, 'finalised', finals);
END
$$;

-- The job pg_cron runs every few minutes. One run at a time (a second one finding the lock taken does nothing).
CREATE OR REPLACE FUNCTION public.leaderboard_refresh()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('joulz-leaderboards-refresh')) THEN
    RETURN jsonb_build_object('skipped', true);
  END IF;
  RETURN jsonb_build_object('ratings', public.leaderboard_refresh_ratings(),
                            'daily', public.leaderboard_refresh_daily(now()));
END
$$;

/* ------------------------------------------------------------------ reads (the server, for a caller) */

-- A rating board page. p_scope: 'global', 'country' (the viewer's profile country) or 'friends' (the viewer and their
-- friends, ranked among themselves). Answers { ready, rows, me, total, refreshedAt } where `me` is the viewer's own
-- row on this board and scope (pinned by the phone when it isn't among the rows) or null.
CREATE OR REPLACE FUNCTION public.leaderboard_page(p_viewer uuid, p_board text, p_period text, p_scope text,
                                                   p_offset integer, p_limit integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gen bigint;
  made timestamptz;
  v_country text;
  rows_out jsonb;
  me jsonb;
  total integer;
  lim integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  off integer := least(greatest(coalesce(p_offset, 0), 0), 500);
BEGIN
  IF p_board NOT IN ('joulz', 'puzzles', 'arcade', 'word', 'number', 'speed', 'attention', 'pattern', 'logic',
                     'retro', 'sports', 'cards', 'action', 'strategy')
     OR p_period NOT IN ('season', 'peak') OR p_scope NOT IN ('global', 'country', 'friends') THEN
    RETURN jsonb_build_object('ready', false, 'reason', 'bad_board');
  END IF;
  SELECT id, made_at INTO gen, made FROM public.leaderboard_generations WHERE complete ORDER BY id DESC LIMIT 1;
  IF gen IS NULL THEN
    RETURN jsonb_build_object('ready', false, 'reason', 'not_ready', 'rows', '[]'::jsonb, 'me', NULL, 'total', 0);
  END IF;
  SELECT country INTO v_country FROM public.profiles WHERE user_id = p_viewer;

  IF p_scope = 'global' THEN
    -- The list never runs past the top 500 (your own row is pinned below it).
    lim := least(lim, greatest(500 - off, 0));
    SELECT coalesce(jsonb_agg(leaderboards.row_json(p_viewer, r.player_id, r.global_rank, r.value, false,
                                CASE WHEN r.tier = 'top500' THEN jsonb_build_object('top500', r.global_rank) END)
                              ORDER BY r.position), '[]'::jsonb)
      INTO rows_out
      FROM (SELECT * FROM public.leaderboard_rating_rows
             WHERE generation = gen AND board = p_board AND period = p_period
             ORDER BY position OFFSET off LIMIT lim) r;
    SELECT count(*) INTO total FROM public.leaderboard_rating_rows WHERE generation = gen AND board = p_board AND period = p_period;
    SELECT leaderboards.row_json(p_viewer, r.player_id, r.global_rank, r.value, false,
             CASE WHEN r.tier = 'top500' THEN jsonb_build_object('top500', r.global_rank) END)
      INTO me FROM public.leaderboard_rating_rows r
     WHERE generation = gen AND board = p_board AND period = p_period AND player_id = p_viewer;
  ELSIF p_scope = 'country' THEN
    IF v_country IS NULL THEN
      RETURN jsonb_build_object('ready', true, 'reason', 'no_country', 'rows', '[]'::jsonb, 'me', NULL, 'total', 0,
                                'refreshedAt', made);
    END IF;
    SELECT coalesce(jsonb_agg(leaderboards.row_json(p_viewer, r.player_id, r.country_rank, r.value, false,
                                CASE WHEN r.tier = 'top500' THEN jsonb_build_object('top500', r.global_rank) END)
                              ORDER BY r.country_rank, r.position), '[]'::jsonb)
      INTO rows_out
      FROM (SELECT * FROM public.leaderboard_rating_rows
             WHERE generation = gen AND board = p_board AND period = p_period AND country = v_country
             ORDER BY country_rank, position OFFSET off LIMIT lim) r;
    SELECT count(*) INTO total FROM public.leaderboard_rating_rows
     WHERE generation = gen AND board = p_board AND period = p_period AND country = v_country;
    SELECT leaderboards.row_json(p_viewer, r.player_id, r.country_rank, r.value, false,
             CASE WHEN r.tier = 'top500' THEN jsonb_build_object('top500', r.global_rank) END)
      INTO me FROM public.leaderboard_rating_rows r
     WHERE generation = gen AND board = p_board AND period = p_period AND player_id = p_viewer;
  ELSE
    WITH circle AS (
      SELECT r.*, rank() OVER (ORDER BY r.value DESC) AS friend_rank
        FROM public.leaderboard_rating_rows r
       WHERE r.generation = gen AND r.board = p_board AND r.period = p_period
         AND (r.player_id = p_viewer OR leaderboards.friends(p_viewer, r.player_id))
    )
    SELECT coalesce(jsonb_agg(leaderboards.row_json(p_viewer, c.player_id, c.friend_rank::integer, c.value, true,
                                CASE WHEN c.tier = 'top500' THEN jsonb_build_object('top500', c.global_rank) END)
                              ORDER BY c.friend_rank, c.position), '[]'::jsonb),
           count(*)::integer,
           (SELECT leaderboards.row_json(p_viewer, m.player_id, m.friend_rank::integer, m.value, true,
                     CASE WHEN m.tier = 'top500' THEN jsonb_build_object('top500', m.global_rank) END)
              FROM circle m WHERE m.player_id = p_viewer)
      INTO rows_out, total, me
      FROM (SELECT * FROM circle ORDER BY friend_rank, position LIMIT 201) c;
  END IF;

  RETURN jsonb_build_object('ready', true, 'rows', rows_out, 'me', me, 'total', coalesce(total, 0),
                            'refreshedAt', made, 'country', v_country);
END
$$;

-- A Daily board: p_scope 'top100' (every row ranked 1–100, a shared 100th included) or 'friends' (the viewer and their
-- friends on that board, ranked among themselves). The rows show only once the viewer has finished that day's attempt
-- or the day has closed (the Daily's own rule); `me` is the viewer's own counted entry with their place on the whole
-- board, else `meReason` says why they aren't on it. prevDay / nextDay are the nearest days with a board.
CREATE OR REPLACE FUNCTION public.daily_board_page(p_viewer uuid, p_kind text, p_day date, p_scope text,
                                                   p_now timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.daily_boards%ROWTYPE;
  room public.async_rooms%ROWTYPE;
  mine public.async_attempts%ROWTYPE;
  mine_entry public.daily_board_entries%ROWTYPE;
  is_account boolean;
  v_open boolean;
  rows_out jsonb := '[]'::jsonb;
  me jsonb;
  me_reason text;
  prev_day date;
  next_day date;
BEGIN
  IF p_kind NOT IN ('daily_puzzle', 'daily_arcade') OR p_scope NOT IN ('top100', 'friends') OR p_day IS NULL THEN
    RETURN jsonb_build_object('exists', false, 'reason', 'bad_board');
  END IF;
  SELECT max(day) INTO prev_day FROM public.daily_boards WHERE kind = p_kind AND day < p_day;
  SELECT min(day) INTO next_day FROM public.daily_boards WHERE kind = p_kind AND day > p_day;
  SELECT * INTO b FROM public.daily_boards WHERE kind = p_kind AND day = p_day;
  IF b.room_id IS NULL THEN
    RETURN jsonb_build_object('exists', false, 'day', p_day, 'prevDay', prev_day, 'nextDay', next_day);
  END IF;
  SELECT * INTO room FROM public.async_rooms WHERE id = b.room_id;
  SELECT * INTO mine FROM public.async_attempts WHERE room_id = b.room_id AND user_id = p_viewer;
  SELECT * INTO mine_entry FROM public.daily_board_entries WHERE room_id = b.room_id AND player_id = p_viewer;
  is_account := EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_viewer);
  v_open := b.final OR p_now >= room.closes_at OR mine.finished_at IS NOT NULL;

  IF mine_entry.attempt_id IS NOT NULL THEN
    me := leaderboards.row_json(p_viewer, p_viewer, mine_entry.rank, mine_entry.total, true,
                                jsonb_build_object('timeMs', mine_entry.tie_ms));
  ELSE
    me_reason := CASE
      WHEN NOT is_account THEN 'guest'
      WHEN mine.id IS NULL THEN 'not_played'
      WHEN mine.finished_at IS NULL THEN 'not_finished'
      WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = p_viewer
                    AND p.created_at > mine.started_at - interval '24 hours') THEN 'new_account'
      WHEN NOT b.final AND b.refreshed_at < mine.finished_at THEN 'pending'
      ELSE 'not_counted' END;
  END IF;

  IF v_open THEN
    IF p_scope = 'top100' THEN
      SELECT coalesce(jsonb_agg(leaderboards.row_json(p_viewer, e.player_id, e.rank, e.total, false,
                                  jsonb_build_object('timeMs', e.tie_ms)) ORDER BY e.position), '[]'::jsonb)
        INTO rows_out
        FROM (SELECT * FROM public.daily_board_entries
               WHERE room_id = b.room_id AND rank <= 100 ORDER BY position LIMIT 150) e;
    ELSE
      SELECT coalesce(jsonb_agg(leaderboards.row_json(p_viewer, e.player_id, e.friend_rank::integer, e.total, true,
                                  jsonb_build_object('timeMs', e.tie_ms, 'boardRank', e.rank))
                                ORDER BY e.friend_rank, e.position), '[]'::jsonb)
        INTO rows_out
        FROM (SELECT x.*, rank() OVER (ORDER BY x.total DESC, x.tie_ms ASC) AS friend_rank
                FROM public.daily_board_entries x
               WHERE x.room_id = b.room_id
                 AND (x.player_id = p_viewer OR leaderboards.friends(p_viewer, x.player_id))
               ORDER BY x.position LIMIT 201) e;
    END IF;
  END IF;

  RETURN jsonb_build_object('exists', true, 'day', b.day, 'kind', b.kind, 'players', b.players, 'final', b.final,
                            'open', v_open, 'closesAt', room.closes_at, 'refreshedAt', b.refreshed_at,
                            'rows', rows_out, 'me', me, 'meReason', me_reason,
                            'prevDay', prev_day, 'nextDay', next_day);
END
$$;

-- The Daily badges' facts for a player, from final boards only: firsts on a board 100+ players were counted on (Daily
-- Champion) and top-100 finishes on a board of 500+ (Daily Top 100). The field sizes are passed in
-- (src/lib/leaderboards/boards.ts DAILY_CHAMPION_FIELD / DAILY_TOP100_FIELD).
CREATE OR REPLACE FUNCTION public.daily_board_badge_facts(p_user uuid, p_champion_field integer, p_top100_field integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'wins', count(*) FILTER (WHERE e.rank = 1 AND b.players >= p_champion_field),
    'top100', count(*) FILTER (WHERE e.rank <= 100 AND b.players >= p_top100_field))
    FROM public.daily_board_entries e
    JOIN public.daily_boards b ON b.room_id = e.room_id AND b.final
   WHERE e.player_id = p_user;
$$;

/* ------------------------------------------------------------------ the setting */

-- { show, setting, adult }: whether the player is shown on global and country boards now, their own choice (null: the
-- default) and whether they are 18+. NULL for a guest.
CREATE OR REPLACE FUNCTION public.leaderboard_visibility(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('show', leaderboards.shown(p.user_id),
                            'setting', s.show_on_boards,
                            'adult', leaderboards.is_adult(p.date_of_birth))
    FROM public.profiles p
    LEFT JOIN public.leaderboard_settings s ON s.user_id = p.user_id
   WHERE p.user_id = p_user;
$$;

-- Sets "Show me on leaderboards" (null puts the default back). False for a guest.
CREATE OR REPLACE FUNCTION public.leaderboard_set_visibility(p_user uuid, p_show boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user) THEN
    RETURN false;
  END IF;
  IF p_show IS NULL THEN
    DELETE FROM public.leaderboard_settings WHERE user_id = p_user;
  ELSE
    INSERT INTO public.leaderboard_settings (user_id, show_on_boards, updated_at) VALUES (p_user, p_show, now())
      ON CONFLICT (user_id) DO UPDATE SET show_on_boards = EXCLUDED.show_on_boards, updated_at = now();
  END IF;
  RETURN true;
END
$$;

DO $public$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.leaderboard_refresh_ratings()', 'public.leaderboard_refresh_daily(timestamptz)',
                           'public.leaderboard_refresh()',
                           'public.leaderboard_page(uuid, text, text, text, integer, integer)',
                           'public.daily_board_page(uuid, text, date, text, timestamptz)',
                           'public.daily_board_badge_facts(uuid, integer, integer)',
                           'public.leaderboard_visibility(uuid)', 'public.leaderboard_set_visibility(uuid, boolean)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END
$public$;

/* ------------------------------------------------------------------ the schedule */

DO $schedule$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
      PERFORM cron.schedule('leaderboards-refresh', '*/5 * * * *', 'SELECT public.leaderboard_refresh()');
    EXCEPTION WHEN OTHERS THEN
      PERFORM migration_log.note('warning', format('leaderboards refresh not scheduled (pg_cron: %s); see docs/leaderboards.md', SQLERRM));
    END;
  ELSE
    PERFORM migration_log.note('warning', 'leaderboards refresh not scheduled: pg_cron is not available on this database; see docs/leaderboards.md');
  END IF;
END
$schedule$;
