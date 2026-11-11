-- The look each result was played in (wave 2, E1; 11 Nov 2026, Joe; docs/skins.md "Replays and ghosts").
--
-- Display only: a result's `look` is the game skin, world theme and (Full House) card back its player had equipped when
-- the result was stored, so replays draw each player's own skin and other players' ghost cars show theirs. Nothing
-- reads it to grade, score, rank, deal or time anything.
--
-- It is filled by the database itself from the player's loadout (only owned items can sit there), never sent by a
-- phone. A guest, an account with nothing equipped for the game, or a game without skins stores NULL. The trigger can
-- never fail an insert: any error stores NULL.

ALTER TABLE public.round_results ADD COLUMN IF NOT EXISTS look jsonb;
ALTER TABLE public.async_results ADD COLUMN IF NOT EXISTS look jsonb;

-- A player's equipped look for one game: {skin, world, back} (absent keys: the default), or NULL for none.
CREATE OR REPLACE FUNCTION public.result_look_for(p_user_id uuid, p_game text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nullif(jsonb_strip_nulls(jsonb_build_object(
    'skin', (SELECT item_id FROM public.loadout_slots WHERE user_id = p_user_id AND slot = 'game-skin:' || p_game),
    'world', (SELECT item_id FROM public.loadout_slots WHERE user_id = p_user_id AND slot = 'world-theme:' || p_game),
    'back', CASE WHEN p_game = 'pokersquares'
                 THEN (SELECT item_id FROM public.loadout_slots WHERE user_id = p_user_id AND slot = 'card-back') END
  )), '{}'::jsonb)
  WHERE p_user_id IS NOT NULL AND p_game IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.result_look_for(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.result_look_for(uuid, text) TO service_role;

-- Rooms: the round's game from the room's stored puzzles, the player from their slot.
CREATE OR REPLACE FUNCTION public.round_result_look()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    NEW.look := public.result_look_for(
      (SELECT p.user_id FROM public.duel_players p WHERE p.duel_id = NEW.duel_id AND p.player_slot = NEW.player_slot LIMIT 1),
      (SELECT d.puzzles_public -> (NEW.round_number - 1) ->> 'type' FROM public.duels d WHERE d.id = NEW.duel_id));
  EXCEPTION WHEN OTHERS THEN
    NEW.look := NULL;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.round_result_look() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS round_result_look ON public.round_results;
CREATE TRIGGER round_result_look BEFORE INSERT ON public.round_results
  FOR EACH ROW EXECUTE FUNCTION public.round_result_look();

-- The Daily and challenges: the round's game from the async room's stored puzzles (the row is made as the round starts).
CREATE OR REPLACE FUNCTION public.async_result_look()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    NEW.look := public.result_look_for(
      NEW.user_id,
      (SELECT r.puzzles_public -> (NEW.round_number - 1) ->> 'type' FROM public.async_rooms r WHERE r.id = NEW.room_id));
  EXCEPTION WHEN OTHERS THEN
    NEW.look := NULL;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.async_result_look() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS async_result_look ON public.async_results;
CREATE TRIGGER async_result_look BEFORE INSERT ON public.async_results
  FOR EACH ROW EXECUTE FUNCTION public.async_result_look();

-- Ghost cars: every player still in a room, with their equipped look for the room's current game (the server calls it
-- for a player in that room; each look is the database's own read of the owner's loadout).
CREATE OR REPLACE FUNCTION public.room_game_looks(p_duel_id uuid, p_game text)
RETURNS TABLE (player_slot integer, look jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.player_slot::integer, public.result_look_for(p.user_id, p_game)
    FROM public.duel_players p
   WHERE p.duel_id = p_duel_id AND p.status <> 'left';
$$;
REVOKE ALL ON FUNCTION public.room_game_looks(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.room_game_looks(uuid, text) TO service_role;
