-- Leaderboard rows carry their player's card (wave 4, session W4a; 11 Nov 2026, Joe's rule: a player's card, avatar and
-- frame show wherever they appear; docs/leaderboards.md "Rows"). Additive and idempotent: it replaces only
-- leaderboards.row_json (20261115100000_leaderboards.sql) so a row the viewer may see by name also carries `pid`, the
-- player's id, for the server alone: src/lib/leaderboards/leaderboards.server.ts reads every visible row's public card
-- through A1's public.economy_public_cards in one call per page, puts it on the row and removes `pid` before the page
-- leaves the server. A hidden or deleted row carries no id, so it gets no card (still "Hidden player" / "Deleted
-- player"). A visible row also carries `tier`, W3a's shown tier (rated_profiles.shown_tier, placed players only), for the
-- tier emblem on the row's nameplate. The function stays callable by the service role only. No row of any table is
-- touched.

CREATE OR REPLACE FUNCTION leaderboards.row_json(p_viewer uuid, p_player uuid, p_rank integer, p_value bigint,
                                                p_friends_scope boolean, p_extra jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.profiles%ROWTYPE;
  is_me boolean := p_player IS NOT NULL AND p_player = p_viewer;
  is_friend boolean := NOT is_me AND leaderboards.friends(p_viewer, p_player);
  visible boolean;
BEGIN
  IF p_player IS NOT NULL THEN
    SELECT * INTO p FROM public.profiles WHERE user_id = p_player;
  END IF;
  visible := p.user_id IS NOT NULL AND (is_me OR (p.deletion_requested_at IS NULL AND
             (is_friend OR p_friends_scope OR leaderboards.shown(p_player))));
  RETURN jsonb_build_object(
    'rank', p_rank,
    'value', p_value,
    'isMe', is_me,
    'isFriend', is_friend,
    'hidden', NOT visible,
    'deleted', p.user_id IS NULL,
    'name', CASE WHEN visible THEN p.username END,
    'colour', CASE WHEN visible THEN p.colour END,
    'playerNumber', CASE WHEN visible THEN p.player_number END,
    'pid', CASE WHEN visible THEN p.user_id END,
    'tier', CASE WHEN visible THEN (SELECT r.shown_tier FROM public.rated_profiles r
                                     WHERE r.player_id = p.user_id AND r.joulz IS NOT NULL) END
  ) || coalesce(p_extra, '{}'::jsonb);
END
$$;

REVOKE ALL ON FUNCTION leaderboards.row_json(uuid, uuid, integer, bigint, boolean, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION leaderboards.row_json(uuid, uuid, integer, bigint, boolean, jsonb) TO service_role;
