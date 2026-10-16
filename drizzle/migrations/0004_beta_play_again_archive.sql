-- Beta recording, gap G1 (docs/beta-sql.md): Play again (restart_duel_room)
-- deletes the room's round_results and the players who had left. From now on
-- it first copies those rows into round_results_archive and
-- duel_players_archive, tagged with the room and which game in the room they
-- belong to (game_index = the Play again count before this press, so 0 is the
-- room's first game and duels.tournament_history[game_index] is its summary).
-- It also records the players carried into the next game (room_joins, via
-- 'play_again', migration 20261016130000).
--
-- Everything else restart_duel_room does is unchanged (same checks, same
-- winner entry, same deletes and resets, same result). The copies run in their
-- own sub-block: if one fails it is logged as a WARNING and Play again carries
-- on exactly as before, so recording never blocks play.
--
-- Server-only: RLS on with no client policies and no client grants. Never
-- read by play; stored rows are copied, never changed.

CREATE TABLE IF NOT EXISTS public.round_results_archive (
  archive_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id uuid NOT NULL,                    -- round_results.id
  duel_id uuid NOT NULL,
  game_index integer NOT NULL,
  game_id text,                        -- round_order[round_number - 1]
  time_limit_ms integer,               -- the puzzle's own timeLimitMs, if it had one
  player_slot integer NOT NULL,
  user_id uuid,                        -- duel_players.user_id for that slot at archive time
  round_number integer NOT NULL,
  answer text,
  is_correct boolean NOT NULL,
  ms_remaining integer NOT NULL,
  reaction_avg_ms integer,
  correct_count integer,
  errors integer,
  extra jsonb,
  score integer NOT NULL,
  submitted_at timestamptz NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS round_results_archive_duel_idx
  ON public.round_results_archive (duel_id, game_index, round_number);

CREATE TABLE IF NOT EXISTS public.duel_players_archive (
  archive_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id uuid NOT NULL,                    -- duel_players.id
  duel_id uuid NOT NULL,
  game_index integer NOT NULL,
  user_id uuid NOT NULL,
  player_slot integer NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL,
  joined_at timestamptz,
  created_at timestamptz,
  last_seen_at timestamptz,
  ready_round integer,
  intro_ready_round integer,
  muted_by_host boolean,
  archived_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS duel_players_archive_duel_idx
  ON public.duel_players_archive (duel_id, game_index);
CREATE INDEX IF NOT EXISTS duel_players_archive_user_idx
  ON public.duel_players_archive (user_id);

REVOKE ALL ON public.round_results_archive FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.round_results_archive TO service_role;
ALTER TABLE public.round_results_archive ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.duel_players_archive FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.duel_players_archive TO service_role;
ALTER TABLE public.duel_players_archive ENABLE ROW LEVEL SECURITY;

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
    INSERT INTO public.round_results_archive
      (id, duel_id, game_index, game_id, time_limit_ms, player_slot, user_id, round_number,
       answer, is_correct, ms_remaining, reaction_avg_ms, correct_count, errors, extra, score,
       submitted_at)
    SELECT r.id, r.duel_id, v_game_index,
           v_room.round_order ->> (r.round_number - 1),
           CASE WHEN jsonb_typeof(v_room.puzzles_public -> (r.round_number - 1) -> 'timeLimitMs') = 'number'
                THEN (v_room.puzzles_public -> (r.round_number - 1) ->> 'timeLimitMs')::numeric::integer END,
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
