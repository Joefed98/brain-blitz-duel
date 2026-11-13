-- Withdrawn cosmetics (13 Nov 2026, Joe's rule: every cosmetic offered must look premium; docs/cosmetics-review).
--
-- Every catalogue item the cosmetics review did not mark Keep is withdrawn: never sold (the shop query, so the daily
-- shop, the bundles and every purchase refuse it), never granted as a reward (pass claims, badges, season and
-- tournament rewards, through economy.add_item) and not in a new account's starter set, until it is redrawn and Joe
-- approves it. Owners keep what they own: their inventory, loadout and every drawing are unchanged.
--
-- Joe brings one item back with ONE line, here in a new migration or in the dashboard's SQL editor:
--   SELECT economy.restore_item('card-art.lava', 'redrawn, approved 20 Nov');
-- and can withdraw one the same way:
--   SELECT economy.withdraw_item('card-art.lava', 'why');
-- Restoring an item also gives it to everyone it was owed to while withdrawn: a starter to every account, a season
-- reward to every season_rewards row naming it, the Championship frame to every recorded winner (pass levels are
-- claimed by the player as usual; the Founding frame is settled on each visit).
--
-- Additive: two columns, functions replaced with the same signatures. No stored row is rewritten but the flag.

ALTER TABLE public.catalogue_items ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz;
ALTER TABLE public.catalogue_items ADD COLUMN IF NOT EXISTS withdrawn_note text;

-- The one shop query, now without withdrawn items (the columns as before, the two new ones last).
CREATE OR REPLACE VIEW public.catalogue_shop WITH (security_invoker = true) AS
  SELECT * FROM public.catalogue_items
   WHERE source = 'shop' AND NOT exclusive AND price_coins IS NOT NULL AND withdrawn_at IS NULL;
REVOKE ALL ON public.catalogue_shop FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.catalogue_shop TO anon, authenticated, service_role;

-- Adds an item to an inventory (never 'shop': a purchase goes through public.economy_purchase_item). A withdrawn item
-- is never added as a reward or a starter; only Joe's own grant ('grant') may still give one. Answers
-- granted | owned | withdrawn | no_account | unknown_item | bad_how.
CREATE OR REPLACE FUNCTION economy.add_item(p_user_id uuid, p_item_id text, p_how text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_n integer;
  v_withdrawn timestamptz;
BEGIN
  IF p_how NOT IN ('starter', 'pass', 'earned', 'grant') THEN
    RETURN 'bad_how';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RETURN 'no_account';
  END IF;
  SELECT withdrawn_at INTO v_withdrawn FROM public.catalogue_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RETURN 'unknown_item';
  END IF;
  IF v_withdrawn IS NOT NULL AND p_how <> 'grant' AND NOT EXISTS (
    SELECT 1 FROM public.inventory_items WHERE user_id = p_user_id AND item_id = p_item_id) THEN
    RETURN 'withdrawn';
  END IF;
  INSERT INTO public.inventory_items (user_id, item_id, how) VALUES (p_user_id, p_item_id, p_how)
  ON CONFLICT (user_id, item_id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN CASE WHEN v_n = 1 THEN 'granted' ELSE 'owned' END;
END;
$$;
REVOKE ALL ON FUNCTION economy.add_item(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- A new account's starter set: the free starters that aren't withdrawn.
CREATE OR REPLACE FUNCTION economy.on_new_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_item record;
BEGIN
  INSERT INTO public.coin_wallets (user_id) VALUES (NEW.user_id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.loadouts (user_id) VALUES (NEW.user_id) ON CONFLICT (user_id) DO NOTHING;
  FOR v_item IN
    INSERT INTO public.inventory_items (user_id, item_id, how)
    SELECT NEW.user_id, c.id, 'starter' FROM public.catalogue_items c
     WHERE c.source = 'free-starter' AND c.withdrawn_at IS NULL
    ON CONFLICT (user_id, item_id) DO NOTHING
    RETURNING item_id
  LOOP
    PERFORM economy.note_event('item_granted', NEW.user_id,
      (SELECT jsonb_build_object('kind', c.kind, 'rarity', c.rarity, 'source', c.source)
         FROM public.catalogue_items c WHERE c.id = v_item.item_id));
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION economy.on_new_profile() FROM PUBLIC, anon, authenticated, service_role;

-- Joe's: withdraw one item (logged).   SELECT economy.withdraw_item('card-art.lava', 'why');
CREATE OR REPLACE FUNCTION economy.withdraw_item(p_item_id text, p_note text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.catalogue_items WHERE id = p_item_id) THEN
    RAISE EXCEPTION 'economy.withdraw_item: no item %', p_item_id;
  END IF;
  PERFORM economy.log('withdraw_item', NULL, jsonb_build_object('item', p_item_id), p_note);
  UPDATE public.catalogue_items SET withdrawn_at = coalesce(withdrawn_at, now()), withdrawn_note = p_note
   WHERE id = p_item_id;
  RETURN 'withdrawn';
END;
$$;
REVOKE ALL ON FUNCTION economy.withdraw_item(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Joe's: bring one item back (logged), and give it to everyone it was owed to while withdrawn.
--   SELECT economy.restore_item('card-art.lava', 'redrawn, approved');
CREATE OR REPLACE FUNCTION economy.restore_item(p_item_id text, p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_item public.catalogue_items%ROWTYPE;
  v_given integer := 0;
  r record;
BEGIN
  SELECT * INTO v_item FROM public.catalogue_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'economy.restore_item: no item %', p_item_id;
  END IF;
  PERFORM economy.log('restore_item', NULL, jsonb_build_object('item', p_item_id), p_note);
  UPDATE public.catalogue_items SET withdrawn_at = NULL, withdrawn_note = NULL WHERE id = p_item_id;
  IF v_item.source = 'free-starter' THEN
    FOR r IN SELECT user_id FROM public.profiles LOOP
      IF economy.add_item(r.user_id, p_item_id, 'starter') = 'granted' THEN v_given := v_given + 1; END IF;
    END LOOP;
  END IF;
  FOR r IN SELECT season_id, season_start, user_id FROM public.season_rewards
            WHERE frame_item = p_item_id OR card_art = p_item_id LOOP
    IF economy.add_item(r.user_id, p_item_id, 'earned') = 'granted' THEN
      v_given := v_given + 1;
      UPDATE public.season_rewards SET granted_items = granted_items || p_item_id
       WHERE season_id = r.season_id AND season_start = r.season_start AND user_id = r.user_id;
    END IF;
  END LOOP;
  IF p_item_id = 'frame.championship' THEN
    FOR r IN SELECT DISTINCT user_id FROM public.tournament_awards WHERE kind = 'frame' LOOP
      IF economy.add_item(r.user_id, p_item_id, 'earned') = 'granted' THEN v_given := v_given + 1; END IF;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('item', p_item_id, 'given', v_given);
END;
$$;
REVOKE ALL ON FUNCTION economy.restore_item(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- The review's withdrawn items (every item not marked Keep), one a line: docs/cosmetics-review/tools/verdicts.ts.
UPDATE public.catalogue_items c
   SET withdrawn_at = now(), withdrawn_note = 'cosmetics review, 13 Nov 2026: not Keep'
  FROM (VALUES
  ('card-art.joulz-navy'),
  ('card-art.bolt-stripes'),
  ('card-art.grid'),
  ('card-art.waves'),
  ('card-art.hexes'),
  ('card-art.dots'),
  ('card-art.sunburst'),
  ('card-art.tier.spark'),
  ('card-art.tier.charge'),
  ('card-art.tier.volt'),
  ('card-art.tier.surge'),
  ('card-art.tier.storm'),
  ('card-art.tier.top-500'),
  ('card-art.royal'),
  ('card-art.lava'),
  ('card-art.diamond-plate'),
  ('card-art.frost'),
  ('card-art.static'),
  ('card-art.neon-skyline'),
  ('frame.bronze'),
  ('frame.silver'),
  ('frame.obsidian'),
  ('frame.founding'),
  ('frame.top-500'),
  ('name-colour.chrome'),
  ('name-colour.neon-pink'),
  ('name-colour.neon-cyan'),
  ('name-colour.neon-red'),
  ('name-colour.electric-orange'),
  ('card-back.royal-damask'),
  ('card-back.holo-foil'),
  ('card-back.neon'),
  ('game-skin.full-house.midnight-felt'),
  ('game-skin.full-house.crimson-velvet'),
  ('game-skin.full-house.neon-felt'),
  ('game-skin.crazy-golf.watermelon'),
  ('game-skin.crazy-golf.disco'),
  ('game-skin.crazy-golf.neon-glow'),
  ('game-skin.crazy-golf.plasma'),
  ('game-skin.cue-ball.pixel-pool'),
  ('game-skin.cue-ball.galaxy-set'),
  ('game-skin.cue-ball.neon-8-ball'),
  ('game-skin.cue-ball.neon-ball-set'),
  ('game-skin.curl-champ.glacier'),
  ('game-skin.curl-champ.aurora'),
  ('game-skin.curl-champ.neon-stones'),
  ('world-theme.apex.neon-night'),
  ('world-theme.crazy-golf.neon-course'),
  ('world-theme.curl-champ.neon-rink'),
  ('avatar-finish.chrome'),
  ('avatar-finish.carbon'),
  ('avatar-finish.holographic'),
  ('avatar-finish.neon-glow'),
  ('avatar-accessory.neon-bolt'),
  ('reaction.retro-arcade'),
  ('reaction.captains-calls'),
  ('reaction.spark'),
  ('reaction.zap'),
  ('reaction.clutch'),
  ('reaction.neon-signs'),
  ('celebration.spotlight'),
  ('celebration.shockwave'),
  ('celebration.circuit-overload'),
  ('tile-style.circuit-trace'),
  ('frame.championship'),
  ('frame.s1-spark'),
  ('frame.s1-charge'),
  ('frame.s1-volt'),
  ('frame.s1-surge'),
  ('frame.s1-storm'),
  ('frame.s1-lightning'),
  ('frame.s1-top-500')
  ) AS w (id)
 WHERE c.id = w.id AND c.withdrawn_at IS NULL;
