-- One identity everywhere (13 Nov 2026, Joe): which of a room's accounts read "Hidden player" on anything that leaves
-- the room (the share card's image). The same rule as the leaderboards' global and country boards
-- (leaderboards.shown): an under-18 by default, an adult who opted out, an account waiting for deletion. Guests have no
-- profile and are never in the answer. Read only, for the service role (the room's one card read,
-- src/lib/identity/roomCards.server.ts); nothing stored changes.

CREATE OR REPLACE FUNCTION public.players_hidden_outside(p_user_ids uuid[])
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(p.user_id ORDER BY p.user_id), '{}'::uuid[])
    FROM public.profiles p
   WHERE p.user_id = ANY (p_user_ids[1:100])
     AND NOT leaderboards.shown(p.user_id);
$$;

REVOKE ALL ON FUNCTION public.players_hidden_outside(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.players_hidden_outside(uuid[]) TO service_role;
