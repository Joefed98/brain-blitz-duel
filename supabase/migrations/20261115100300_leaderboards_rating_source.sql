-- Leaderboards read W3a's ratings (wave 4, session W4a; 11 Nov 2026; docs/leaderboards.md "W3a's ratings"). Additive and
-- idempotent: it replaces only leaderboards.rating_source(), the one function the rating boards read
-- (20261115100000_leaderboards.sql, where it answered no rows until W3a's engine was merged), with a read of W3a's tables
-- (20261114100000_ratings.sql). No row of any table is touched; nothing about how ratings are worked out changes.
--
-- One row per placed player and board:
--   joulz      rated_profiles.joulz (the Joulz Rating W3a stores, kept current by every match and the hourly standings
--              job), its tier rated_profiles.shown_tier ('top500' marks the Top 500, from W3a's caps);
--   puzzles, arcade and the 11 categories: rated_ratings.rating.
-- Every value is rounded to a whole number as W3a shows it (ratings.server.ts poolView / ratingsView; ranks of level
-- shown ratings are shared, as W3a's own standings do).
--
-- "This season": W3a has no seasons yet, so this season's rating is the current one. "All-time peak": the highest the
-- rating has been after any of the player's stored matches (rated_match_players.changes' `after` for a pool or category
-- that moved; rated_matches.outcome's joulz `after` for the Joulz Rating), or the current one if higher.
-- Players still in placement (fewer than 5 placement matches, every rating hidden) are left out, as W3a hides them.

CREATE OR REPLACE FUNCTION leaderboards.rating_source()
RETURNS TABLE (player_id uuid, board text, season_rating integer, peak_rating integer, tier text)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH placed AS (
    SELECT p.player_id, p.joulz, p.shown_tier
      FROM public.rated_profiles p
     WHERE p.placement_played >= 5 AND p.joulz IS NOT NULL
  ),
  pool_peaks AS (
    SELECT mp.player_id, c ->> 'key' AS key, max((c ->> 'after')::double precision) AS peak
      FROM public.rated_match_players mp
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(mp.changes) = 'array' THEN mp.changes ELSE '[]'::jsonb END) AS c
     WHERE mp.moved AND (c ->> 'after') IS NOT NULL
     GROUP BY mp.player_id, c ->> 'key'
  ),
  joulz_peaks AS (
    SELECT (x ->> 'playerId')::uuid AS player_id, max((x -> 'joulz' ->> 'after')::double precision) AS peak
      FROM public.rated_matches m
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(m.outcome) = 'array' THEN m.outcome ELSE '[]'::jsonb END) AS x
     WHERE jsonb_typeof(x -> 'joulz' -> 'after') = 'number'
     GROUP BY (x ->> 'playerId')::uuid
  )
  SELECT pl.player_id, 'joulz'::text,
         round(pl.joulz)::integer,
         round(greatest(pl.joulz, coalesce(j.peak, pl.joulz)))::integer,
         pl.shown_tier
    FROM placed pl
    LEFT JOIN joulz_peaks j ON j.player_id = pl.player_id
  UNION ALL
  SELECT r.player_id, r.key,
         round(r.rating)::integer,
         round(greatest(r.rating, coalesce(pp.peak, r.rating)))::integer,
         NULL::text
    FROM public.rated_ratings r
    JOIN placed pl ON pl.player_id = r.player_id
    LEFT JOIN pool_peaks pp ON pp.player_id = r.player_id AND pp.key = r.key;
$$;

REVOKE ALL ON FUNCTION leaderboards.rating_source() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION leaderboards.rating_source() TO service_role;
