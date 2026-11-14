-- Recorded runs never come from a deal a player has already played (Joe, 13 Nov 2026; Security C1a,
-- src/lib/rated/rated.server.ts makeRecordedMatch).
--
-- duels.deal_origin_id (20261117500000_room_start_claim.sql) is filled for every room started before it with the
-- room's own id: a new column only, no existing value changes (Joe's approval, 13 Nov 2026). Rooms copied for recorded
-- matches before this count by their own id.
--
-- mm_seen_deal_origins(player) answers the origins of every room the player has sat in: their joins (every game of the
-- room, Play again included), their seats, and seats archived by Play again. Service role only.

UPDATE public.duels SET deal_origin_id = id WHERE deal_origin_id IS NULL;

CREATE INDEX IF NOT EXISTS duels_deal_origin_idx ON public.duels (deal_origin_id);
CREATE INDEX IF NOT EXISTS room_joins_user_idx ON public.room_joins (user_id);

CREATE OR REPLACE FUNCTION public.mm_seen_deal_origins(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT DISTINCT coalesce(d.deal_origin_id, d.id)
    FROM public.duels d
   WHERE d.id IN (
           SELECT j.duel_id FROM public.room_joins j WHERE j.user_id = p_user_id
           UNION SELECT p.duel_id FROM public.duel_players p WHERE p.user_id = p_user_id
           UNION SELECT a.duel_id FROM public.duel_players_archive a WHERE a.user_id = p_user_id
         )
$$;

REVOKE ALL ON FUNCTION public.mm_seen_deal_origins(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_seen_deal_origins(uuid) TO service_role;
