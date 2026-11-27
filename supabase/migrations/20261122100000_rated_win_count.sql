-- You's "Rated wins" gauge (P3, 22 Nov 2026; Joe: the player's rated win count from the server, read only, the same
-- pattern as rated_week_change). Additive: one read-only, service-role function. Counts one player's own live rated
-- matches that counted (a match the server froze for a flagged run counts for nobody), and the wins among them.
-- Answers {played, wins}.
CREATE OR REPLACE FUNCTION public.rated_win_count(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
           'played', count(*),
           'wins', count(*) FILTER (WHERE mp.result = 'win'))
    FROM rated_match_players mp
   WHERE mp.player_id = p_user_id AND mp.side = 'live' AND mp.counted;
$$;
REVOKE ALL ON FUNCTION public.rated_win_count(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rated_win_count(uuid) TO service_role;
