-- Round puzzles released round by round (13 Nov 2026, Security C1a).
--
-- A room started by start_dealt_room (20261117500000_room_start_claim.sql) keeps its public halves in
-- duel_secrets.puzzles_public, and duels.puzzles_public stays [] while it plays. Each round's public half is copied into
-- duel_round_puzzles when that round's intro begins (or any later phase is reached), where the room's players can read
-- it. When the room finishes (not disbanded), every round is released and duels.puzzles_public takes the full list, so
-- a finished room reads exactly as before. Rooms started before this (no held halves) are untouched.
--
-- Rows are keyed by the room's game index (its tournament_history length, as Play again counts games), and players read
-- only the current game's, so a room's next game starts hidden again. Additive only.

CREATE TABLE IF NOT EXISTS public.duel_round_puzzles (
  duel_id uuid NOT NULL REFERENCES public.duels(id) ON DELETE CASCADE,
  game_index integer NOT NULL,
  round_number integer NOT NULL CHECK (round_number BETWEEN 1 AND 12),
  puzzle jsonb NOT NULL,
  released_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (duel_id, game_index, round_number)
);

ALTER TABLE public.duel_round_puzzles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.duel_round_puzzles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.duel_round_puzzles TO authenticated;
GRANT ALL ON public.duel_round_puzzles TO service_role;

-- The game a room is on now (Play again's count), for the read rule below.
CREATE OR REPLACE FUNCTION public.room_game_index(_duel_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_array_length(d.tournament_history), 0) FROM public.duels d WHERE d.id = _duel_id
$$;
REVOKE ALL ON FUNCTION public.room_game_index(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.room_game_index(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Players read their room's released rounds" ON public.duel_round_puzzles;
CREATE POLICY "Players read their room's released rounds" ON public.duel_round_puzzles
  FOR SELECT TO authenticated
  USING (public.is_duel_participant(duel_id) AND game_index = public.room_game_index(duel_id));

-- The release: before each room update, so it lands in the same transaction as the phase or status it follows.
CREATE OR REPLACE FUNCTION public.release_round_puzzles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_held jsonb;
  v_game integer;
BEGIN
  IF NEW.status = 'waiting' THEN
    RETURN NEW;
  END IF;
  SELECT s.puzzles_public INTO v_held FROM public.duel_secrets s WHERE s.duel_id = NEW.id;
  IF v_held IS NULL OR jsonb_typeof(v_held) <> 'array' OR jsonb_array_length(v_held) = 0 THEN
    RETURN NEW;
  END IF;
  v_game := coalesce(jsonb_array_length(NEW.tournament_history), 0);
  IF NEW.status = 'finished' THEN
    IF OLD.status IS DISTINCT FROM 'finished' AND NEW.disbanded_at IS NULL THEN
      NEW.puzzles_public := v_held;
      INSERT INTO public.duel_round_puzzles (duel_id, game_index, round_number, puzzle)
      SELECT NEW.id, v_game, x.n::integer, x.e
        FROM jsonb_array_elements(v_held) WITH ORDINALITY AS x(e, n)
      ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status = 'in_progress'
     AND NEW.current_round BETWEEN 1 AND jsonb_array_length(v_held)
     AND NEW.phase IS NOT NULL
     AND NEW.phase NOT IN ('starting', 'round_title') THEN
    INSERT INTO public.duel_round_puzzles (duel_id, game_index, round_number, puzzle)
    VALUES (NEW.id, v_game, NEW.current_round, v_held -> (NEW.current_round - 1))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.release_round_puzzles() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS duels_release_round_puzzles ON public.duels;
CREATE TRIGGER duels_release_round_puzzles
  BEFORE UPDATE ON public.duels
  FOR EACH ROW EXECUTE FUNCTION public.release_round_puzzles();

-- Players get a released round the moment it lands (the room's private channel; RLS above decides who).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'duel_round_puzzles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.duel_round_puzzles;
  END IF;
END;
$$;
