-- A player's rated matches in a window, for the weekly challenges marked R (wave 3, session W3a; 11 Nov 2026; D2's
-- src/lib/pass/weekly.ts). Additive: one read-only, service-role function. Only matches that counted (live, not frozen
-- by the 4th-match rule) are answered, in the order finished, each with its result, best-of (null for 4 and 8 players)
-- and every game's category and whether this player won it (the top score, alone).
CREATE OR REPLACE FUNCTION public.rated_week_matches(p_user_id uuid, p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'result', mp.result,
           'bestOf', CASE WHEN m.format ->> 'kind' = 'duel' THEN (m.format ->> 'bestOf')::int END,
           'games', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                              'category', g.category,
                              'won', (g.scores ->> p_user_id::text)::float8 > (
                                       SELECT coalesce(max(v::float8), '-Infinity'::float8)
                                         FROM jsonb_each_text(g.scores) AS e(k, v) WHERE e.k <> p_user_id::text))
                            ORDER BY g.idx), '[]'::jsonb)
                       FROM rated_games g WHERE g.match_id = m.match_id))
           ORDER BY mp.finished_at, m.match_id), '[]'::jsonb)
    FROM rated_match_players mp
    JOIN rated_matches m USING (match_id)
   WHERE mp.player_id = p_user_id AND mp.side = 'live' AND mp.counted
     AND mp.finished_at >= p_from AND mp.finished_at < p_to;
$$;
REVOKE ALL ON FUNCTION public.rated_week_matches(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rated_week_matches(uuid, timestamptz, timestamptz) TO service_role;
