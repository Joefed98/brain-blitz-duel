-- Card backs in more games (13 Nov 2026, Joe; docs/cosmetics-review): the account's card back is drawn on the
-- face-down cards of Summit (tripeaks), Thirteen (pyramid) and Five Hands (fivehands) as well as Full House
-- (pokersquares), so a result in those games stores the back its player had equipped (display only: replays draw it).
-- The same function as 20261112090100_result_looks.sql with the back's game list widened; nothing else changes and no
-- stored row is touched.
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
    'back', CASE WHEN p_game IN ('pokersquares', 'tripeaks', 'pyramid', 'fivehands')
                 THEN (SELECT item_id FROM public.loadout_slots WHERE user_id = p_user_id AND slot = 'card-back') END
  )), '{}'::jsonb)
  WHERE p_user_id IS NOT NULL AND p_game IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.result_look_for(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.result_look_for(uuid, text) TO service_role;
