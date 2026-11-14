-- Public ids beyond rooms (Security C3, Joe's approval of 14 Nov 2026).
--
-- Friends lists, player cards, tournament rows and rated match views answer a phone with each player's public id
-- (public.player_public_ids, Security C1b) in place of the account id. The server converts at its edge; the tables and
-- the rows already stored keep their account ids.
--
-- 1. public.public_ids_of(uuid[]): the public id of each account in the list, made on first use (one call for a whole
--    list; public.public_id_of answers one). An id with no account behind it (a deleted player's stand-in) gets a fresh
--    id that is kept nowhere, so it names nobody. Server only.
-- 2. Phones no longer read account ids from these, none of which a phone calls or reads (the server reads them with its
--    own role): EXECUTE on public.public_profiles, public.economy_public_cards and public.badge_public_cards, and SELECT
--    on public.friendships, public.friend_requests and public.player_blocks.

CREATE OR REPLACE FUNCTION public.public_ids_of(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, public_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  INSERT INTO public.player_public_ids (user_id)
  SELECT DISTINCT u.id FROM auth.users u WHERE u.id = ANY (coalesce(p_user_ids, '{}'))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN QUERY
    SELECT ids.id, coalesce(p.public_id, gen_random_uuid())
      FROM (SELECT DISTINCT unnest(coalesce(p_user_ids, '{}')) AS id) ids
      LEFT JOIN public.player_public_ids p ON p.user_id = ids.id
     WHERE ids.id IS NOT NULL;
END
$$;
REVOKE ALL ON FUNCTION public.public_ids_of(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_ids_of(uuid[]) TO service_role;

-- 2. Account-id reads phones don't make.
REVOKE EXECUTE ON FUNCTION public.public_profiles(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.economy_public_cards(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.badge_public_cards(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_profiles(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.economy_public_cards(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.badge_public_cards(uuid[]) TO service_role;

REVOKE SELECT ON public.friendships FROM anon, authenticated;
REVOKE SELECT ON public.friend_requests FROM anon, authenticated;
REVOKE SELECT ON public.player_blocks FROM anon, authenticated;
