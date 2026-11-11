-- Joulz Plus, the Daily archive, early access and the public cosmetics read (wave 2, train E, session E2; 13 Nov 2026;
-- docs/economy/plus.md, docs/economy/economy-design.md "Joulz Plus"). Additive and idempotent: new tables and functions,
-- one wider CHECK (async_rooms.kind gains 'daily_archive'), and C2's badge_facts and D2's pass_activity re-made with one
-- more condition each (an archive play never counts for a badge or Joules). No row is changed or removed.
--
-- What it adds:
--   * public.plus_memberships: a membership (monthly or yearly), one open at a time per account. Until real payments
--     exist every membership is a TEST purchase (test = true), started only by a shop tester (shop.testers, D1's ONE
--     tester list) or by Joe (plus.start_test), and ended by Joe (plus.remove_test_purchase).
--   * public.plus_perk_grants: one row per membership month and perk (coins, freezes, premium_pass) once granted. The
--     coins and freezes themselves go through A1's ledgers with the idempotency keys plus_monthly:<membership>:<month>
--     and plus_freezes:<membership>:<month> (reason plus_monthly), so a month is never paid twice, whatever races.
--   * public.plus_settings: the optional gold PLUS chip (off by default).
--   * public.early_access_games: a game held back for Plus members in Practice until a date (nothing marked yet).
--   * The Daily archive: a Plus member replays a past Daily in an async room of kind 'daily_archive' (room_key
--     'daily_archive:<user id>:<kind>:<day>'), its rounds copied from that day's stored Daily. It is never on a board
--     (boards read the day's own room), never in the streak (daily_history reads daily_puzzle / daily_arcade only),
--     never a badge (badge_facts below leaves it out) and never Joules (pass_activity below leaves it out).
--   * public.cosmetics_public(uuid[]): what everyone may see of a player's equipped cosmetics (avatar finish,
--     accessory, special edition, win celebration, podium entrance, the four reactions, the PLUS chip when on).
--
-- Every function is for the service role (the server functions in src/lib/plus and src/lib/cosmetics, through
-- src/lib/data/plus.server.ts and cosmetics.server.ts). Joe's functions live in the `plus` schema, unreachable from the
-- API (the service role included), each change logged in plus.admin_log.

CREATE SCHEMA IF NOT EXISTS plus;
REVOKE ALL ON SCHEMA plus FROM PUBLIC, anon, authenticated, service_role;

/* ------------------------------------------------------------------ the reasons a test membership pays and takes back */

-- A real membership's monthly coins and freezes carry reason plus_monthly (A1's). A TEST membership's carry
-- plus_test_monthly, so they can be told apart and taken back before launch (plus.remove_test_rewards), as D1's test
-- coin packs are (test_purchase / test_purchase_removed).
INSERT INTO public.economy_reasons (reason, note) VALUES
  ('plus_test_monthly', 'a test Joulz Plus membership''s monthly coins or streak freezes (removable with plus.remove_test_rewards)'),
  ('plus_test_removed', 'test Joulz Plus rewards taken back by Joe (plus.remove_test_rewards)')
ON CONFLICT (reason) DO NOTHING;

/* ------------------------------------------------------------------ the Daily archive's room kind */

DO $kind$
BEGIN
  IF to_regclass('public.async_rooms') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.async_rooms DROP CONSTRAINT IF EXISTS async_rooms_kind_check;
  ALTER TABLE public.async_rooms ADD CONSTRAINT async_rooms_kind_check
    CHECK (kind IN ('daily_puzzle', 'daily_arcade', 'challenge', 'daily_archive')) NOT VALID;
  ALTER TABLE public.async_rooms VALIDATE CONSTRAINT async_rooms_kind_check;
END
$kind$;

/* ------------------------------------------------------------------ memberships */

CREATE TABLE IF NOT EXISTS public.plus_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  -- Every membership is a test purchase until real payments exist (no payment taken).
  test boolean NOT NULL DEFAULT true,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ended_note text,
  CONSTRAINT plus_memberships_ended CHECK (ended_at IS NULL OR ended_at >= started_at)
);
-- One open membership per account.
CREATE UNIQUE INDEX IF NOT EXISTS plus_memberships_open ON public.plus_memberships (user_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS plus_memberships_user ON public.plus_memberships (user_id, started_at DESC);
ALTER TABLE public.plus_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plus_memberships FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.plus_memberships TO service_role;

CREATE TABLE IF NOT EXISTS public.plus_perk_grants (
  membership_id uuid NOT NULL REFERENCES public.plus_memberships (id) ON DELETE CASCADE,
  -- Month 0 starts at the membership's start, month n at started_at + n months.
  month_index integer NOT NULL CHECK (month_index BETWEEN 0 AND 1200),
  perk text NOT NULL CHECK (perk IN ('coins', 'freezes', 'premium_pass')),
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  detail jsonb,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (membership_id, month_index, perk)
);
CREATE INDEX IF NOT EXISTS plus_perk_grants_user ON public.plus_perk_grants (user_id, granted_at DESC);
ALTER TABLE public.plus_perk_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plus_perk_grants FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.plus_perk_grants TO service_role;

CREATE TABLE IF NOT EXISTS public.plus_settings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  show_mark boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.plus_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plus_settings FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.plus_settings TO service_role;

CREATE TABLE IF NOT EXISTS public.early_access_games (
  game_id text PRIMARY KEY CHECK (game_id ~ '^[a-z][a-z0-9_]{1,39}$'),
  -- Held back for Plus members until the end of this UK day; everyone plays it from the next day.
  until_day date NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.early_access_games ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.early_access_games FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.early_access_games TO service_role;

/* ------------------------------------------------------------------ Joe's log */

CREATE TABLE IF NOT EXISTS plus.admin_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  user_id uuid,
  detail jsonb,
  note text NOT NULL,
  by_role text NOT NULL DEFAULT session_user
);
ALTER TABLE plus.admin_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON plus.admin_log FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION plus.log(p_action text, p_user_id uuid, p_detail jsonb, p_note text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, plus
AS $$
DECLARE
  v_id bigint;
BEGIN
  IF coalesce(trim(p_note), '') = '' THEN
    RAISE EXCEPTION 'plus.%: give a note (why)', p_action;
  END IF;
  INSERT INTO plus.admin_log (action, user_id, detail, note) VALUES (p_action, p_user_id, p_detail, p_note)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION plus.log(text, uuid, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;

-- A removed account's log lines keep what was done but no longer name it.
CREATE OR REPLACE FUNCTION plus.forget_removed_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, plus
AS $$
BEGIN
  UPDATE plus.admin_log SET user_id = NULL WHERE user_id = OLD.user_id;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION plus.forget_removed_profile() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS plus_forget_removed_profile ON public.profiles;
CREATE TRIGGER plus_forget_removed_profile AFTER DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION plus.forget_removed_profile();

/* ------------------------------------------------------------------ the server's questions */

-- An account's open membership, null when none (a guest, an account waiting for deletion, no Plus).
CREATE OR REPLACE FUNCTION public.plus_membership(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('id', m.id, 'plan', m.plan, 'test', m.test, 'started_at', m.started_at,
                            'show_mark', coalesce(s.show_mark, false))
    FROM public.plus_memberships m
    JOIN public.profiles p ON p.user_id = m.user_id AND p.deletion_requested_at IS NULL
    LEFT JOIN public.plus_settings s ON s.user_id = m.user_id
   WHERE m.user_id = p_user_id AND m.ended_at IS NULL
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.plus_membership(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plus_membership(uuid) TO service_role;

-- Whether an account has Plus now (for the premium pass: D2's track counts a member as a premium holder).
CREATE OR REPLACE FUNCTION public.plus_is_member(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.plus_membership(p_user_id) IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.plus_is_member(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plus_is_member(uuid) TO service_role;

-- A tester's test purchase: starts Plus with no payment, marked as a test. Answers {status: started | already_member |
-- not_tester | no_account | bad_plan, membership}. Never for anyone off the shop's tester list.
CREATE OR REPLACE FUNCTION public.plus_test_purchase(p_user_id uuid, p_plan text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_plan IS NULL OR p_plan NOT IN ('monthly', 'yearly') THEN
    RETURN jsonb_build_object('status', 'bad_plan');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id AND deletion_requested_at IS NULL) THEN
    RETURN jsonb_build_object('status', 'no_account');
  END IF;
  IF to_regprocedure('public.shop_is_tester(uuid)') IS NULL OR NOT public.shop_is_tester(p_user_id) THEN
    RETURN jsonb_build_object('status', 'not_tester');
  END IF;
  -- One at a time: the open membership's row is locked by the unique index's insert.
  INSERT INTO public.plus_memberships (user_id, plan, test) VALUES (p_user_id, p_plan, true)
  ON CONFLICT (user_id) WHERE ended_at IS NULL DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('status', 'already_member', 'membership', public.plus_membership(p_user_id));
  END IF;
  RETURN jsonb_build_object('status', 'started', 'membership', public.plus_membership(p_user_id));
END;
$$;
REVOKE ALL ON FUNCTION public.plus_test_purchase(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plus_test_purchase(uuid, text) TO service_role;

-- Records that a membership month's perk was granted. Answers true only the first time (the caller records
-- plus_perk_granted then); the ledgers' own keys already stop a second payment.
CREATE OR REPLACE FUNCTION public.plus_note_grant(p_membership_id uuid, p_month integer, p_perk text, p_detail jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_n integer;
BEGIN
  SELECT user_id INTO v_user FROM public.plus_memberships WHERE id = p_membership_id;
  IF v_user IS NULL THEN
    RETURN false;
  END IF;
  INSERT INTO public.plus_perk_grants (membership_id, month_index, perk, user_id, detail)
  VALUES (p_membership_id, p_month, p_perk, v_user, p_detail)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.plus_note_grant(uuid, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plus_note_grant(uuid, integer, text, jsonb) TO service_role;

-- The months of a membership already noted for a perk.
CREATE OR REPLACE FUNCTION public.plus_granted_months(p_membership_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('month', month_index, 'perk', perk) ORDER BY month_index, perk), '[]'::jsonb)
    FROM public.plus_perk_grants WHERE membership_id = p_membership_id;
$$;
REVOKE ALL ON FUNCTION public.plus_granted_months(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plus_granted_months(uuid) TO service_role;

-- The PLUS chip on or off (members only). Answers set | not_member.
CREATE OR REPLACE FUNCTION public.plus_set_mark(p_user_id uuid, p_on boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.plus_membership(p_user_id) IS NULL THEN
    RETURN 'not_member';
  END IF;
  INSERT INTO public.plus_settings (user_id, show_mark, updated_at) VALUES (p_user_id, coalesce(p_on, false), now())
  ON CONFLICT (user_id) DO UPDATE SET show_mark = excluded.show_mark, updated_at = now();
  RETURN 'set';
END;
$$;
REVOKE ALL ON FUNCTION public.plus_set_mark(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plus_set_mark(uuid, boolean) TO service_role;

-- The games still held back on a UK day (p_day: today's UK date, from the server), with their last held-back day.
CREATE OR REPLACE FUNCTION public.plus_early_access(p_day date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('game', game_id, 'until', until_day) ORDER BY game_id), '[]'::jsonb)
    FROM public.early_access_games WHERE until_day >= p_day;
$$;
REVOKE ALL ON FUNCTION public.plus_early_access(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plus_early_access(date) TO service_role;

/* ------------------------------------------------------------------ what everyone may see */

-- The equipped cosmetics others see on a player (up to 100 ids): the avatar (as A1's public card has it) with its
-- finish, accessory and special edition,
-- the win celebration and podium entrance, the reactions in slot order, and the PLUS chip only when its owner has
-- Plus and has turned it on. Guests and accounts waiting for deletion: no row.
CREATE OR REPLACE FUNCTION public.cosmetics_public(p_user_ids uuid[])
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'user_id', p.user_id,
           'avatar_id', coalesce(l.avatar_id, 'captain-joulz'), 'colour', p.colour, 'gem', l.gem,
           'finish', (SELECT s.item_id FROM public.loadout_slots s WHERE s.user_id = p.user_id AND s.slot = 'avatar-finish'),
           'accessory', (SELECT s.item_id FROM public.loadout_slots s WHERE s.user_id = p.user_id AND s.slot = 'avatar-accessory'),
           'special', (SELECT s.item_id FROM public.loadout_slots s WHERE s.user_id = p.user_id AND s.slot = 'avatar-special-edition'),
           'celebration', (SELECT s.item_id FROM public.loadout_slots s WHERE s.user_id = p.user_id AND s.slot = 'celebration'),
           'entrance', (SELECT s.item_id FROM public.loadout_slots s WHERE s.user_id = p.user_id AND s.slot = 'podium-entrance'),
           'reactions', coalesce((SELECT jsonb_agg(s.item_id ORDER BY s.slot) FROM public.loadout_slots s
                                   WHERE s.user_id = p.user_id AND s.slot ~ '^reaction-[0-9]$'), '[]'::jsonb),
           'plus_mark', coalesce((SELECT st.show_mark FROM public.plus_settings st
                                   WHERE st.user_id = p.user_id AND public.plus_membership(p.user_id) IS NOT NULL), false)
         )), '[]'::jsonb)
    FROM public.profiles p
    LEFT JOIN public.loadouts l ON l.user_id = p.user_id
   WHERE p.user_id = ANY (p_user_ids[1:100]) AND p.deletion_requested_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.cosmetics_public(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cosmetics_public(uuid[]) TO service_role;

/* ------------------------------------------------------------------ badges never count an archive play */

-- C2's badge_facts (20261111220000_badges_titles.sql) exactly, with one more condition on the async rows: a Daily
-- archive replay (kind 'daily_archive') is unrated and never counts for a badge.
DO $badges$
BEGIN
  IF to_regprocedure('public.badge_facts(uuid, jsonb)') IS NULL OR to_regclass('public.practice_progress_start') IS NULL THEN
    RETURN;
  END IF;
  EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.badge_facts(p_user_id uuid, p_puzzle_limits jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $body$
  WITH results AS (
    SELECT d.round_order ->> (r.round_number - 1) AS game, r.score, r.is_correct, r.ms_remaining, NULL::integer AS limit_ms
      FROM public.round_results r
      JOIN public.duel_players p ON p.duel_id = r.duel_id AND p.player_slot = r.player_slot
      JOIN public.duels d ON d.id = r.duel_id
     WHERE p.user_id = p_user_id
    UNION ALL
    SELECT a.game_id, a.score, a.is_correct, a.ms_remaining, a.time_limit_ms
      FROM public.round_results_archive a
     WHERE a.user_id = p_user_id
    UNION ALL
    SELECT ro.round_order ->> (ar.round_number - 1), ar.score, ar.is_correct, ar.ms_remaining, NULL::integer
      FROM public.async_results ar
      JOIN public.async_rooms ro ON ro.id = ar.room_id
     WHERE ar.user_id = p_user_id
       AND ro.kind <> 'daily_archive'
       AND NOT EXISTS (
         SELECT 1 FROM public.challenges c
          WHERE c.room_id = ar.room_id AND c.source_duel_id IS NOT NULL
            AND (EXISTS (SELECT 1 FROM public.duel_players dp WHERE dp.duel_id = c.source_duel_id AND dp.user_id = p_user_id)
                 OR EXISTS (SELECT 1 FROM public.duel_players_archive da WHERE da.duel_id = c.source_duel_id AND da.user_id = p_user_id)))
    UNION ALL
    SELECT pp.game_id, pp.score, pp.is_correct, pp.ms_remaining, pp.time_limit_ms
      FROM public.practice_plays pp
     WHERE pp.user_id = p_user_id
       AND pp.created_at >= (SELECT s.fresh_start_at FROM public.practice_progress_start s LIMIT 1)
       AND NOT pp.example AND NOT pp.flagged
  ),
  puzzles AS (
    SELECT r.is_correct, r.ms_remaining, coalesce(r.limit_ms, (p_puzzle_limits ->> r.game)::integer) AS lim
      FROM results r
     WHERE r.game IS NOT NULL AND p_puzzle_limits ? r.game
  ),
  hosted AS (
    SELECT d.id, NULL::integer AS game_index
      FROM public.duels d
     WHERE d.host_user_id = p_user_id
       AND (SELECT count(DISTINCT r.player_slot) FROM public.round_results r WHERE r.duel_id = d.id) >= 3
    UNION ALL
    SELECT a.duel_id, a.game_index
      FROM public.round_results_archive a
      JOIN public.duels d ON d.id = a.duel_id
     WHERE d.host_user_id = p_user_id
     GROUP BY a.duel_id, a.game_index
    HAVING count(DISTINCT a.player_slot) >= 3
  )
  SELECT jsonb_build_object(
    'games200', (SELECT count(DISTINCT game) FROM results WHERE score >= 200 AND game IS NOT NULL),
    'buzzer', (SELECT count(*) FROM puzzles WHERE is_correct AND ms_remaining > 0 AND ms_remaining < 1000),
    'speedDemon', (SELECT count(*) FROM puzzles WHERE is_correct AND lim > 0 AND ms_remaining::bigint * 3 > lim::bigint * 2),
    'hosted3', (SELECT count(*) FROM hosted),
    'challenges', (SELECT count(*) FROM public.practice_challenge_progress
                    WHERE user_id = p_user_id AND completed_at IS NOT NULL),
    'stars', (SELECT count(*) FROM public.practice_progress
               WHERE user_id = p_user_id AND star_at IS NOT NULL AND level IN ('easy', 'classic', 'hard')),
    'starGames', coalesce((SELECT jsonb_agg(DISTINCT game_id) FROM public.practice_progress
                            WHERE user_id = p_user_id AND star_at IS NOT NULL AND level IN ('easy', 'classic', 'hard')),
                          '[]'::jsonb),
    'gems', (SELECT count(*) FROM public.gem_unlocks WHERE user_id = p_user_id)
  );
$body$
  $fn$;
  REVOKE ALL ON FUNCTION public.badge_facts(uuid, jsonb) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.badge_facts(uuid, jsonb) TO service_role;
END
$badges$;

/* ------------------------------------------------------------------ Joules never come from an archive play */

-- D2's pass_activity (20261113100000_season_pass.sql) exactly, with one more condition on the async attempts: a Daily
-- archive replay (kind 'daily_archive') is unrated and earns no Joules (D2 would otherwise read it as a challenge).
DO $joules$
BEGIN
  IF to_regprocedure('public.pass_activity(uuid, timestamptz, timestamptz)') IS NULL THEN
    RETURN;
  END IF;
  EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.pass_activity(p_user_id uuid, p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $body$
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
       AND ar.kind <> 'daily_archive'
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
$body$
  $fn$;
  REVOKE ALL ON FUNCTION public.pass_activity(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.pass_activity(uuid, timestamptz, timestamptz) TO service_role;
END
$joules$;

/* ------------------------------------------------------------------ Joe's functions (Supabase SQL editor) */

-- Starts a test membership for a tester (no payment, marked as a test).
--   SELECT plus.start_test('TheirUsername', 'yearly', 'testing Plus before Season 1');
CREATE OR REPLACE FUNCTION plus.start_test(p_player text, p_plan text, p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, plus, economy
AS $$
DECLARE
  v_user uuid := economy.account(p_player);
  v jsonb;
BEGIN
  PERFORM plus.log('start_test', v_user, jsonb_build_object('plan', p_plan), p_note);
  v := public.plus_test_purchase(v_user, p_plan);
  IF v ->> 'status' NOT IN ('started', 'already_member') THEN
    RAISE EXCEPTION 'plus.start_test: % (add them with shop.add_tester first)', v ->> 'status';
  END IF;
  PERFORM economy.note_event('plus_bought', v_user, jsonb_build_object('plan', p_plan, 'test', true));
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION plus.start_test(text, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Ends a test membership (the coins and freezes it granted stay; take them back with plus.remove_test_rewards).
--   SELECT plus.remove_test_purchase('TheirUsername', 'testing finished');
CREATE OR REPLACE FUNCTION plus.remove_test_purchase(p_player text, p_note text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, plus, economy
AS $$
DECLARE
  v_user uuid := economy.account(p_player);
  v_n integer;
BEGIN
  PERFORM plus.log('remove_test_purchase', v_user, NULL, p_note);
  UPDATE public.plus_memberships SET ended_at = now(), ended_note = p_note
   WHERE user_id = v_user AND ended_at IS NULL AND test;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN CASE WHEN v_n = 1 THEN 'removed' ELSE 'no_test_membership' END;
END;
$$;
REVOKE ALL ON FUNCTION plus.remove_test_purchase(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Every membership, newest first.
--   SELECT * FROM plus.list_members();
CREATE OR REPLACE FUNCTION plus.list_members()
RETURNS TABLE (username text, player_number integer, plan text, test boolean, started_at timestamptz,
               ended_at timestamptz, months_granted bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, plus
AS $$
  SELECT p.username, p.player_number, m.plan, m.test, m.started_at, m.ended_at,
         (SELECT count(DISTINCT g.month_index) FROM public.plus_perk_grants g WHERE g.membership_id = m.id)
    FROM public.plus_memberships m
    JOIN public.profiles p ON p.user_id = m.user_id
   ORDER BY m.started_at DESC;
$$;
REVOKE ALL ON FUNCTION plus.list_members() FROM PUBLIC, anon, authenticated, service_role;

-- Marks a game early access: Plus members only in Practice until the end of that UK day.
--   SELECT plus.mark_early_access('blockfall', '2027-02-08', 'new game week');
CREATE OR REPLACE FUNCTION plus.mark_early_access(p_game text, p_until date, p_note text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, plus
AS $$
BEGIN
  PERFORM plus.log('mark_early_access', NULL, jsonb_build_object('game', p_game, 'until', p_until), p_note);
  INSERT INTO public.early_access_games (game_id, until_day, note) VALUES (p_game, p_until, p_note)
  ON CONFLICT (game_id) DO UPDATE SET until_day = excluded.until_day, note = excluded.note;
  RETURN 'marked';
END;
$$;
REVOKE ALL ON FUNCTION plus.mark_early_access(text, date, text) FROM PUBLIC, anon, authenticated, service_role;

--   SELECT plus.clear_early_access('blockfall', 'open to everyone now');
CREATE OR REPLACE FUNCTION plus.clear_early_access(p_game text, p_note text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, plus
AS $$
DECLARE
  v_n integer;
BEGIN
  PERFORM plus.log('clear_early_access', NULL, jsonb_build_object('game', p_game), p_note);
  DELETE FROM public.early_access_games WHERE game_id = p_game;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN CASE WHEN v_n = 1 THEN 'cleared' ELSE 'not_marked' END;
END;
$$;
REVOKE ALL ON FUNCTION plus.clear_early_access(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Takes back every coin and streak freeze a TEST membership paid (reason plus_test_monthly), for every account or one
-- (p_player: a username or user id), in one call: each line is taken back once (key plus_test_removed:<line id>),
-- as much as the account still holds (a balance already spent below it gives what is left; the line is then done).
-- Memberships are not ended (plus.remove_test_purchase does that). Answers the lines and amounts taken.
--   SELECT plus.remove_test_rewards('clean test balances before launch');
--   SELECT plus.remove_test_rewards('one tester', 'TheirUsername');
CREATE OR REPLACE FUNCTION plus.remove_test_rewards(p_note text, p_player text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, plus, economy
AS $$
DECLARE
  v_only uuid := CASE WHEN p_player IS NULL THEN NULL ELSE economy.account(p_player) END;
  v_log bigint;
  r record;
  v_have integer;
  v_take integer;
  v jsonb;
  v_coin_lines integer := 0;
  v_coins integer := 0;
  v_freeze_lines integer := 0;
  v_freezes integer := 0;
BEGIN
  v_log := plus.log('remove_test_rewards', v_only, NULL, p_note);
  FOR r IN SELECT l.id, l.user_id, l.amount FROM public.coin_ledger l
            WHERE l.reason = 'plus_test_monthly' AND l.amount > 0 AND (v_only IS NULL OR l.user_id = v_only)
              AND NOT EXISTS (SELECT 1 FROM public.coin_ledger x WHERE x.user_id = l.user_id
                                AND x.idempotency_key = 'plus_test_removed:' || l.id)
            ORDER BY l.id LOOP
    SELECT balance INTO v_have FROM public.coin_wallets WHERE user_id = r.user_id;
    v_take := least(r.amount, coalesce(v_have, 0));
    IF v_take > 0 THEN
      v := economy.post_coins(r.user_id, -v_take, 'plus_test_removed', 'ledger', r.id::text, 'plus_test_removed:' || r.id);
      IF v ->> 'status' = 'ok' THEN
        v_coin_lines := v_coin_lines + 1;
        v_coins := v_coins + v_take;
        PERFORM economy.note_event('coins_spent', r.user_id, jsonb_build_object('reason', 'plus_test_removed', 'amount', v_take));
      END IF;
    END IF;
  END LOOP;
  FOR r IN SELECT l.id, l.user_id, l.kind, l.amount FROM public.consumable_ledger l
            WHERE l.reason = 'plus_test_monthly' AND l.amount > 0 AND (v_only IS NULL OR l.user_id = v_only)
              AND NOT EXISTS (SELECT 1 FROM public.consumable_ledger x WHERE x.user_id = l.user_id
                                AND x.idempotency_key = 'plus_test_removed:' || l.id)
            ORDER BY l.id LOOP
    SELECT count INTO v_have FROM public.consumable_balances WHERE user_id = r.user_id AND kind = r.kind;
    v_take := least(r.amount, coalesce(v_have, 0));
    IF v_take > 0 THEN
      v := economy.post_consumable(r.user_id, r.kind, -v_take, 'plus_test_removed', 'ledger', r.id::text, 'plus_test_removed:' || r.id);
      IF v ->> 'status' = 'ok' THEN
        v_freeze_lines := v_freeze_lines + 1;
        v_freezes := v_freezes + v_take;
      END IF;
    END IF;
  END LOOP;
  v := jsonb_build_object('coin_lines', v_coin_lines, 'coins', v_coins, 'freeze_lines', v_freeze_lines, 'freezes', v_freezes);
  UPDATE plus.admin_log SET detail = v WHERE id = v_log;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION plus.remove_test_rewards(text, text) FROM PUBLIC, anon, authenticated, service_role;
