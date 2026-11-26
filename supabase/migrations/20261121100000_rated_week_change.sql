-- Home's player banner, "+22 this week" (P1, 21 Nov 2026; Joe: worked out on the server from the rated match history,
-- so it is the same on every device). Additive: one read-only, service-role function. Each stored rated match keeps
-- every player's Joulz Rating before and after it (rated_matches.outcome, W3a's RatedPlayerChange); this sums one
-- player's changes over the matches they finished from p_from on. A match where either side of the change is unknown
-- (placement, a hidden rating) adds nothing. Answers {matches, change}.
CREATE OR REPLACE FUNCTION public.rated_week_change(p_user_id uuid, p_from timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
           'matches', count(*),
           'change', coalesce(sum(((j.o ->> 'after')::float8) - ((j.o ->> 'before')::float8))
                                FILTER (WHERE j.o ->> 'after' IS NOT NULL AND j.o ->> 'before' IS NOT NULL), 0))
    FROM rated_match_players mp
    JOIN rated_matches m USING (match_id)
    CROSS JOIN LATERAL (
      SELECT e -> 'joulz' AS o
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(m.outcome) = 'array' THEN m.outcome ELSE '[]'::jsonb END) AS e
       WHERE e ->> 'playerId' = p_user_id::text
       LIMIT 1
    ) AS j
   WHERE mp.player_id = p_user_id AND mp.side = 'live' AND mp.finished_at >= p_from;
$$;
REVOKE ALL ON FUNCTION public.rated_week_change(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rated_week_change(uuid, timestamptz) TO service_role;
