-- Beta recording, G1 fix-up (follows 20261016130300, docs/beta-sql.md): the
-- archive now stores the time limit each round actually used and the round's
-- version stamps, by the same rule practice_plays uses, so room and practice
-- rows compare directly.
--
-- The database can't see the games' default limits (they live in the app's
-- registry), so startRoomFn now stores, once per room at the deal, one entry
-- per round in duel_secrets.round_records (index = round_number - 1):
--   {"time_limit_ms": <registry.puzzleTimeLimitMs(puzzle): the puzzle's own
--    timeLimitMs, else its game's default>,
--    "revision": <the full puzzle's numeric version stamps, e.g. {"brkRev": 6}>}
-- That write is best-effort (a failure is logged; the start goes on). The
-- limit is fixed by the stored puzzle, so the deal and the round's start give
-- the same value.
--
-- restart_duel_room copies those into round_results_archive.time_limit_ms and
-- the new round_results_archive.revision. Rooms dealt without round_records
-- (before this ships) keep the old rule: the puzzle's own timeLimitMs, else
-- null, and revision null. Existing archived rows are not changed.
--
-- Everything else restart_duel_room does is unchanged from 20261016130300 (same
-- checks, winner entry, archive sub-block, deletes, resets, joins and result).
-- Nothing here is read by play, scoring, timing or replay.

ALTER TABLE public.duel_secrets ADD COLUMN IF NOT EXISTS round_records jsonb;
ALTER TABLE public.round_results_archive ADD COLUMN IF NOT EXISTS revision jsonb;

COMMENT ON COLUMN public.duel_secrets.round_records IS
  'Beta recording: per round {time_limit_ms, revision}, written by startRoomFn; copied into round_results_archive by restart_duel_room.';
COMMENT ON COLUMN public.round_results_archive.time_limit_ms IS
  'The limit the round used (registry.puzzleTimeLimitMs, as practice_plays); null for rows archived before 20261016170000 without an own timeLimitMs.';
COMMENT ON COLUMN public.round_results_archive.revision IS
  'The round puzzle''s numeric version stamps (as practice_plays.revision); null for rooms dealt before 20261016170000.';

CREATE OR REPLACE FUNCTION public.restart_duel_room(p_room_id uuid, p_host_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.duels%ROWTYPE;
  v_winner jsonb;
  v_game_index integer;
  v_rounds jsonb;
BEGIN
  SELECT * INTO v_room FROM public.duels WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND OR v_room.status <> 'finished' OR v_room.host_user_id <> p_host_id
     OR v_room.disbanded_at IS NOT NULL THEN
    RETURN false;
  END IF;

  SELECT jsonb_build_object(
           'winner', display_name,
           'date', now(),
           'score', points,
           'round_order', v_room.round_order,
           'word_match_words', coalesce((
             SELECT jsonb_agg(item->>'prompt')
             FROM jsonb_array_elements(v_room.puzzles_public) puzzle,
                  jsonb_array_elements(CASE WHEN puzzle->>'type' = 'wordmatch'
                                            THEN puzzle->'items' ELSE '[]'::jsonb END) item),
           '[]'::jsonb))
    INTO v_winner
  FROM (SELECT p.display_name, coalesce(sum(r.score), 0) points
        FROM public.duel_players p
        LEFT JOIN public.round_results r ON r.duel_id = p_room_id AND r.player_slot = p.player_slot
        WHERE p.duel_id = p_room_id
        GROUP BY p.id
        ORDER BY points DESC, p.player_slot
        LIMIT 1) ranking;

  -- Beta recording (G1): keep this game's answers and departed players before
  -- the deletes below. Best-effort: a failure is a WARNING, never a failed reset.
  v_game_index := coalesce(jsonb_array_length(v_room.tournament_history), 0);
  BEGIN
    -- The rounds' effective limits and stamps, stored by startRoomFn at the deal.
    SELECT CASE WHEN jsonb_typeof(s.round_records) = 'array' THEN s.round_records END
      INTO v_rounds
    FROM public.duel_secrets s WHERE s.duel_id = p_room_id;

    INSERT INTO public.round_results_archive
      (id, duel_id, game_index, game_id, time_limit_ms, revision, player_slot, user_id,
       round_number, answer, is_correct, ms_remaining, reaction_avg_ms, correct_count, errors,
       extra, score, submitted_at)
    SELECT r.id, r.duel_id, v_game_index,
           v_room.round_order ->> (r.round_number - 1),
           CASE WHEN jsonb_typeof(v_rounds -> (r.round_number - 1) -> 'time_limit_ms') = 'number'
                THEN (v_rounds -> (r.round_number - 1) ->> 'time_limit_ms')::numeric::integer
                WHEN jsonb_typeof(v_room.puzzles_public -> (r.round_number - 1) -> 'timeLimitMs') = 'number'
                THEN (v_room.puzzles_public -> (r.round_number - 1) ->> 'timeLimitMs')::numeric::integer END,
           CASE WHEN jsonb_typeof(v_rounds -> (r.round_number - 1) -> 'revision') = 'object'
                THEN v_rounds -> (r.round_number - 1) -> 'revision' END,
           r.player_slot,
           (SELECT p.user_id FROM public.duel_players p
            WHERE p.duel_id = r.duel_id AND p.player_slot = r.player_slot
            ORDER BY (p.status = 'left'), p.joined_at DESC LIMIT 1),
           r.round_number, r.answer, r.is_correct, r.ms_remaining, r.reaction_avg_ms,
           r.correct_count, r.errors, r.extra, r.score, r.submitted_at
    FROM public.round_results r
    WHERE r.duel_id = p_room_id;

    INSERT INTO public.duel_players_archive
      (id, duel_id, game_index, user_id, player_slot, display_name, status, joined_at, created_at,
       last_seen_at, ready_round, intro_ready_round, muted_by_host)
    SELECT p.id, p.duel_id, v_game_index, p.user_id, p.player_slot, p.display_name, p.status,
           p.joined_at, p.created_at, p.last_seen_at, p.ready_round, p.intro_ready_round,
           p.muted_by_host
    FROM public.duel_players p
    WHERE p.duel_id = p_room_id AND p.status = 'left';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'restart_duel_room: archive skipped for room % (%)', p_room_id, SQLERRM;
  END;

  DELETE FROM public.round_results WHERE duel_id = p_room_id;
  DELETE FROM public.duel_secrets WHERE duel_id = p_room_id;
  DELETE FROM public.duel_players WHERE duel_id = p_room_id AND status = 'left';
  UPDATE public.duel_players SET status = 'active', ready_round = 0, intro_ready_round = 0
  WHERE duel_id = p_room_id;
  UPDATE public.duels
  SET status = 'waiting', round_order = '[]'::jsonb, puzzles_public = '[]'::jsonb,
      current_round = 0, phase = 'intro', phase_started_at = NULL, round_started_at = NULL,
      tournament_history = tournament_history || coalesce(jsonb_build_array(v_winner), '[]'::jsonb)
  WHERE id = p_room_id;

  -- Beta recording (G4): everyone still here goes into the next game by Play again.
  BEGIN
    INSERT INTO public.room_joins (duel_id, user_id, player_slot, game_index, via)
    SELECT p.duel_id, p.user_id, p.player_slot, v_game_index + 1, 'play_again'
    FROM public.duel_players p
    WHERE p.duel_id = p_room_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'restart_duel_room: play-again joins skipped for room % (%)', p_room_id, SQLERRM;
  END;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.restart_duel_room(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restart_duel_room(uuid, uuid) TO service_role;
