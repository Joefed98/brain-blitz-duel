-- Retired games out of the app (13 Nov 2026, Joe's rule; the Retirements session). Additive and idempotent: one new
-- table and three new functions, and three existing functions redefined. No stored row is changed or deleted: stars,
-- bests, challenge completions, gem unlocks, badges and results all stay exactly as they are.
--
-- From now on a retired game counts towards nothing: the star total (and so the gems it unlocks), and the badge facts
-- (stars, starred games, completed challenges, 200s, buzzer and speed finishes). A gem or badge already earned stays.
--
-- The one switch is RETIRED_TYPES in src/lib/duel/catalogue.ts. This database keeps a mirror of it, public.game_retirement
-- (the retired ids and the live star total, STAR_TOTAL_MAX), which the server writes through
-- public.game_retirement_sync whenever it differs (src/lib/data/retirement.server.ts), so removing a game from
-- RETIRED_TYPES restores everything on the next server call with no migration. This file seeds the mirror with the list
-- as it stands today (21 games, 83 live games, 249 stars).
--
-- Gems: Diamond becomes every live star (the mirror's star total, 249 today); every other threshold is unchanged
-- (src/lib/practice/progressRules.ts holds the same; practice-progress-check proves every threshold is at most the
-- live star total).
--
-- public.badge_facts is C2's function as Joulz Plus last defined it (20261113200000_joulz_plus.sql) with retired games
-- left out; both of E2's conditions (no Daily archive replay, no run the server flagged) are kept exactly.
--
-- Who can reach what: anon and authenticated nothing. The service role reads the mirror and writes it only through
-- public.game_retirement_sync.

CREATE TABLE IF NOT EXISTS public.game_retirement (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  retired text[] NOT NULL,
  star_total integer NOT NULL CHECK (star_total > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.game_retirement ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.game_retirement FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.game_retirement TO service_role;

INSERT INTO public.game_retirement (id, retired, star_total)
VALUES (true, ARRAY['rooftop', 'swerve', 'dual', 'steady', 'hotfloor', 'dig', 'junction', 'wordfall', 'snip', 'pokersquares', 'muggins', 'golfsol', 'stroop', 'tiles', 'rings', 'lightsout', 'stopwatch', 'slice', 'alleyroll', 'bintoss', 'bullseye']::text[], 249)
ON CONFLICT (id) DO NOTHING;

-- The retired ids (empty if the mirror is missing, so nothing is ever hidden by accident).
CREATE OR REPLACE FUNCTION public.retired_game_ids()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT retired FROM public.game_retirement WHERE id), ARRAY[]::text[]);
$$;
REVOKE ALL ON FUNCTION public.retired_game_ids() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retired_game_ids() TO service_role;

-- The server's copy of RETIRED_TYPES and STAR_TOTAL_MAX. True when it changed the mirror.
CREATE OR REPLACE FUNCTION public.game_retirement_sync(p_retired text[], p_star_total integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sorted text[];
BEGIN
  IF p_retired IS NULL OR p_star_total IS NULL OR p_star_total <= 0 THEN
    RAISE EXCEPTION 'game_retirement_sync: a list and a positive star total';
  END IF;
  SELECT coalesce(array_agg(DISTINCT r ORDER BY r), ARRAY[]::text[]) INTO v_sorted FROM unnest(p_retired) AS r;
  INSERT INTO public.game_retirement AS g (id, retired, star_total, updated_at)
  VALUES (true, v_sorted, p_star_total, now())
  ON CONFLICT (id) DO UPDATE
     SET retired = EXCLUDED.retired, star_total = EXCLUDED.star_total, updated_at = now()
   WHERE g.retired IS DISTINCT FROM EXCLUDED.retired OR g.star_total IS DISTINCT FROM EXCLUDED.star_total;
  RETURN FOUND;
END
$$;
REVOKE ALL ON FUNCTION public.game_retirement_sync(text[], integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.game_retirement_sync(text[], integer) TO service_role;

/* ------------------------------------------------------------------ stars and gems */

-- A player's star total: every star on Easy, Classic and Hard of a live game (the mirror's star total at most).
CREATE OR REPLACE FUNCTION public.practice_star_total(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer FROM public.practice_progress
   WHERE user_id = p_user_id AND star_at IS NOT NULL AND level IN ('easy', 'classic', 'hard')
     AND NOT (game_id = ANY (public.retired_game_ids()));
$$;
REVOKE ALL ON FUNCTION public.practice_star_total(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.practice_star_total(uuid) TO service_role;

-- The gems a star total has unlocked, in order. Diamond is every live star (the mirror's total; 250 if it is missing).
CREATE OR REPLACE FUNCTION public.practice_gems_for(p_stars integer)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(g ORDER BY n), ARRAY[]::text[])
    FROM (VALUES ('amber', 10), ('rose-quartz', 20), ('ruby', 30), ('jade', 50), ('amethyst', 75),
                 ('aquamarine', 100), ('sapphire', 125), ('pearl', 150), ('obsidian', 200),
                 ('diamond', coalesce((SELECT star_total FROM public.game_retirement WHERE id), 250))) AS t(g, n)
   WHERE n <= coalesce(p_stars, 0);
$$;
REVOKE ALL ON FUNCTION public.practice_gems_for(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.practice_gems_for(integer) TO service_role;

/* ------------------------------------------------------------------ badge facts */

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
       AND coalesce(r.extra ->> 'flagged', 'false') <> 'true'
    UNION ALL
    SELECT a.game_id, a.score, a.is_correct, a.ms_remaining, a.time_limit_ms
      FROM public.round_results_archive a
     WHERE a.user_id = p_user_id
       AND coalesce(a.extra ->> 'flagged', 'false') <> 'true'
    UNION ALL
    SELECT ro.round_order ->> (ar.round_number - 1), ar.score, ar.is_correct, ar.ms_remaining, NULL::integer
      FROM public.async_results ar
      JOIN public.async_rooms ro ON ro.id = ar.room_id
     WHERE ar.user_id = p_user_id
       AND ro.kind <> 'daily_archive'
       AND coalesce(ar.extra ->> 'flagged', 'false') <> 'true'
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
  live AS (
    SELECT * FROM results WHERE game IS NULL OR NOT (game = ANY (public.retired_game_ids()))
  ),
  puzzles AS (
    SELECT r.is_correct, r.ms_remaining, coalesce(r.limit_ms, (p_puzzle_limits ->> r.game)::integer) AS lim
      FROM live r
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
    'games200', (SELECT count(DISTINCT game) FROM live WHERE score >= 200 AND game IS NOT NULL),
    'buzzer', (SELECT count(*) FROM puzzles WHERE is_correct AND ms_remaining > 0 AND ms_remaining < 1000),
    'speedDemon', (SELECT count(*) FROM puzzles WHERE is_correct AND lim > 0 AND ms_remaining::bigint * 3 > lim::bigint * 2),
    'hosted3', (SELECT count(*) FROM hosted),
    'challenges', (SELECT count(*) FROM public.practice_challenge_progress
                    WHERE user_id = p_user_id AND completed_at IS NOT NULL
                      AND NOT (game_id = ANY (public.retired_game_ids()))),
    'stars', public.practice_star_total(p_user_id),
    'starGames', coalesce((SELECT jsonb_agg(DISTINCT game_id) FROM public.practice_progress
                            WHERE user_id = p_user_id AND star_at IS NOT NULL AND level IN ('easy', 'classic', 'hard')
                              AND NOT (game_id = ANY (public.retired_game_ids()))),
                          '[]'::jsonb),
    'gems', (SELECT count(*) FROM public.gem_unlocks WHERE user_id = p_user_id)
  );
$body$
  $fn$;
  REVOKE ALL ON FUNCTION public.badge_facts(uuid, jsonb) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.badge_facts(uuid, jsonb) TO service_role;
END
$badges$;

/* ------------------------------------------------------------------ what the retirement hides, counted for Joe */

-- Read only (nothing is changed): the Daily archive days (the last 30 UK days) that included a retired game, which the
-- archive now hides, and the open friend challenges holding one, which now read as closed. Written to the deploy log.
DO $counts$
DECLARE
  v_days integer := 0;
  v_challenges integer := 0;
BEGIN
  IF to_regclass('public.async_rooms') IS NULL THEN
    RETURN;
  END IF;
  SELECT count(*) INTO v_days
    FROM public.async_rooms r
   WHERE r.kind IN ('daily_puzzle', 'daily_arcade')
     AND r.day >= (now() AT TIME ZONE 'Europe/London')::date - 30
     AND r.day < (now() AT TIME ZONE 'Europe/London')::date
     AND EXISTS (SELECT 1 FROM jsonb_array_elements(r.puzzles_public) AS p WHERE p ->> 'type' = ANY (public.retired_game_ids()));
  SELECT count(*) INTO v_challenges
    FROM public.async_rooms r
   WHERE r.kind = 'challenge' AND r.closes_at > now()
     AND EXISTS (SELECT 1 FROM jsonb_array_elements(r.puzzles_public) AS p WHERE p ->> 'type' = ANY (public.retired_game_ids()));
  IF to_regprocedure('migration_log.note(text, text)') IS NOT NULL THEN
    PERFORM migration_log.note('notice', format('retired games: %s Daily archive day(s) of the last 30 hidden, %s open friend challenge(s) closed', v_days, v_challenges));
  ELSE
    RAISE NOTICE 'retired games: % Daily archive day(s) of the last 30 hidden, % open friend challenge(s) closed', v_days, v_challenges;
  END IF;
END
$counts$;
