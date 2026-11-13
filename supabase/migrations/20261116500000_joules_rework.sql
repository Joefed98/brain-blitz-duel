-- The Joules rework (Joe, 13 Nov 2026; docs/economy/economy-design.md "Joules and pacing", docs/economy/pass.md).
--
-- What changes in the database (the amounts themselves live in src/lib/pass/joules.ts):
--   * public.pass_joules.kind gains 'star' (a mastery star's Joules, once per star), read from the check as it stands
--     and added to, never written out in full.
--   * public.pass_activity: E2's definition (20261113200000_joulz_plus.sql) exactly, keeping its two conditions (a
--     Daily archive replay never counts; a run the server flagged never counts, nor the finish of an attempt or room
--     game holding one), with one rule added: a friend challenge's creator is paid for their own attempt only once
--     another player has finished that challenge, at the later of the two finishes. plus-copies proves both
--     conditions are kept here.
--
-- Rooms and Practice games stop paying Joules in the server's code (they are still read here: the weekly challenges
-- count them). Rows already credited are never touched; public.pass_credit_joules is unchanged.

/* ------------------------------------------------------------------ pass_joules.kind gains 'star' */

DO $kinds$
DECLARE
  existing text[];
  wanted text[];
  v_name text;
BEGIN
  IF to_regclass('public.pass_joules') IS NULL THEN
    RETURN;
  END IF;
  SELECT c.conname INTO v_name
    FROM pg_constraint c
   WHERE c.conrelid = 'public.pass_joules'::regclass AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) LIKE '%kind%' AND pg_get_constraintdef(c.oid) LIKE '%weekly%';
  IF v_name IS NULL THEN
    RETURN;
  END IF;
  SELECT coalesce(array_agg(DISTINCT m[1]), ARRAY[]::text[]) INTO existing
    FROM pg_constraint c, LATERAL regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''', 'g') AS m
   WHERE c.conrelid = 'public.pass_joules'::regclass AND c.conname = v_name;
  IF 'star' = ANY (existing) THEN
    RETURN;
  END IF;
  SELECT array_agg(e ORDER BY e) INTO wanted
    FROM (SELECT unnest(existing) AS e UNION SELECT 'star') AS u;
  EXECUTE format('ALTER TABLE public.pass_joules DROP CONSTRAINT %I', v_name);
  EXECUTE format('ALTER TABLE public.pass_joules ADD CONSTRAINT %I CHECK (kind IN (%s))', v_name,
    (SELECT string_agg(quote_literal(e), ', ') FROM unnest(wanted) AS e));
END
$kinds$;

/* ------------------------------------------------------------------ pass_activity: the friend challenge creator rule */

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
       AND coalesce(r.extra ->> 'flagged', 'false') <> 'true'
  ),
  archived_rounds AS (
    SELECT 'room_round', 'room_round:' || a.id, a.submitted_at, a.game_id, a.score, NULL::date
      FROM public.round_results_archive a
     WHERE a.user_id = p_user_id AND a.submitted_at >= p_from AND a.submitted_at < p_to
       AND coalesce(a.extra ->> 'flagged', 'false') <> 'true'
  ),
  live_finishes AS (
    SELECT 'room_finish', 'room_finish:' || d.id || ':' || coalesce(jsonb_array_length(d.tournament_history), 0),
           r.submitted_at, NULL::text, NULL::integer, NULL::date
      FROM public.duels d
      JOIN public.round_results r ON r.duel_id = d.id AND r.round_number = jsonb_array_length(d.round_order)
      JOIN public.duel_players p ON p.duel_id = r.duel_id AND p.player_slot = r.player_slot AND p.user_id = p_user_id
     WHERE d.status = 'finished' AND jsonb_typeof(d.round_order) = 'array' AND jsonb_array_length(d.round_order) > 0
       AND r.submitted_at >= p_from AND r.submitted_at < p_to
       AND NOT EXISTS (SELECT 1 FROM public.round_results f WHERE f.duel_id = d.id AND f.player_slot = p.player_slot
                         AND coalesce(f.extra ->> 'flagged', 'false') = 'true')
  ),
  archived_finishes AS (
    SELECT 'room_finish', 'room_finish:' || a.duel_id || ':' || a.game_index, a.submitted_at, NULL::text, NULL::integer, NULL::date
      FROM public.round_results_archive a
     WHERE a.user_id = p_user_id AND a.submitted_at >= p_from AND a.submitted_at < p_to
       AND a.round_number = (SELECT max(b.round_number) FROM public.round_results_archive b
                              WHERE b.duel_id = a.duel_id AND b.game_index = a.game_index)
       AND NOT EXISTS (SELECT 1 FROM public.round_results_archive f WHERE f.duel_id = a.duel_id AND f.game_index = a.game_index
                         AND f.user_id = a.user_id AND coalesce(f.extra ->> 'flagged', 'false') = 'true')
  ),
  attempts AS (
    SELECT t.*, ar.kind, ar.day, ar.round_order, ar.opens_at,
           (c.source = 'room' AND t.started_at - ar.opens_at < interval '1 second') AS imported,
           c.created_by AS challenge_creator
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
       AND coalesce(r.extra ->> 'flagged', 'false') <> 'true'
  ),
  -- A friend challenge's creator is paid for their own attempt only once another player has finished that challenge
  -- (an attempt with no flagged run), at the later of the two finishes (Joe, 13 Nov 2026): until then it earns
  -- nothing. Every other attempt (a friend's on someone else's challenge, a Daily) is earned at its own finish.
  earned AS (
    SELECT t.*,
           CASE WHEN t.kind = 'challenge' AND t.challenge_creator = p_user_id THEN
             (SELECT CASE WHEN min(o.finished_at) IS NULL THEN NULL ELSE greatest(t.finished_at, min(o.finished_at)) END
                FROM public.async_attempts o
               WHERE o.room_id = t.room_id AND o.user_id <> p_user_id AND o.finished_at IS NOT NULL
                 AND NOT EXISTS (SELECT 1 FROM public.async_results g WHERE g.attempt_id = o.id
                                   AND coalesce(g.extra ->> 'flagged', 'false') = 'true'))
           ELSE t.finished_at END AS earned_at
      FROM attempts t
     WHERE t.finished_at IS NOT NULL AND NOT coalesce(t.imported, false)
  ),
  async_finishes AS (
    SELECT CASE t.kind WHEN 'daily_puzzle' THEN 'daily_puzzle' WHEN 'daily_arcade' THEN 'daily_arcade' ELSE 'challenge' END,
           CASE WHEN t.kind = 'challenge' THEN 'challenge:' || t.id ELSE t.kind || ':' || t.day END,
           t.earned_at, NULL::text, t.total_score, t.day
      FROM earned t
     WHERE t.earned_at IS NOT NULL
       AND t.earned_at >= p_from AND t.earned_at < p_to
       AND NOT EXISTS (SELECT 1 FROM public.async_results f WHERE f.attempt_id = t.id
                         AND coalesce(f.extra ->> 'flagged', 'false') = 'true')
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
