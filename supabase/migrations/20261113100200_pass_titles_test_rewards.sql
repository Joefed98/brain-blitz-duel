-- Pass titles and test-season rewards (Wave 2, train D, session D2 follow-up; 13 Nov 2026; docs/economy/pass.md).
-- Additive and idempotent: two rows added to public.titles, two ledger reasons, C2's public.badge_set_title redefined
-- with one rule more (a pass title once unlocked), and one new admin function. No existing row is changed.
--
--   * Neon Rider and Circuit Breaker (kind 'pass') join public.titles after the brief's 32 (Joe approved the 34, 11 Nov
--     2026); badge_set_title equips one only once it is unlocked on the pass (public.pass_title_unlocks). Everything
--     else badge_set_title does is exactly C2's (20261111220000_badges_titles.sql).
--   * Coins and consumables the testers' season pays are lines with reason test_pass_reward (as D1's test coin packs
--     are test_purchase), so they can be told apart and taken back.
--   * pass.remove_test_season_rewards takes back, in one call, everything the test season paid: its coins and
--     consumables (a line of their own, test_pass_reward_removed, never below zero), its items (unless the same item
--     was also claimed in a real season) and its titles (back to Rookie if one is on the card); and marks the test
--     season's premium tracks removed. Logged. Ledger lines are never changed.

/* ------------------------------------------------------------------ the pass titles */

INSERT INTO public.titles (id, name, kind, badge, sort_order)
SELECT v.id, v.name, 'pass', NULL, (SELECT coalesce(max(sort_order), 0) FROM public.titles) + v.n
  FROM (VALUES ('neon-rider', 'Neon Rider', 1), ('circuit-breaker', 'Circuit Breaker', 2)) AS v (id, name, n)
 WHERE NOT EXISTS (SELECT 1 FROM public.titles t WHERE t.id = v.id)
 ORDER BY v.n;

-- C2's function, with a pass title equippable once unlocked. Answers set | unchanged | no_account | unknown_title |
-- not_earned.
CREATE OR REPLACE FUNCTION public.badge_set_title(p_user_id uuid, p_title text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_title public.titles%ROWTYPE;
  v_old text;
BEGIN
  IF NOT economy.active_account(p_user_id) THEN
    RETURN 'no_account';
  END IF;
  SELECT * INTO v_title FROM public.titles WHERE id = coalesce(p_title, 'rookie');
  IF NOT FOUND THEN
    RETURN 'unknown_title';
  END IF;
  IF v_title.kind = 'badge' AND NOT EXISTS (
       SELECT 1 FROM public.player_badges WHERE user_id = p_user_id AND badge = v_title.badge) THEN
    RETURN 'not_earned';
  END IF;
  IF v_title.kind = 'pass' AND NOT EXISTS (
       SELECT 1 FROM public.pass_title_unlocks WHERE user_id = p_user_id AND title_id = v_title.id) THEN
    RETURN 'not_earned';
  END IF;
  IF v_title.kind = 'season' THEN
    RETURN 'not_earned';
  END IF;
  SELECT title INTO v_old FROM public.card_titles WHERE user_id = p_user_id;
  IF coalesce(v_old, 'rookie') = v_title.id THEN
    RETURN 'unchanged';
  END IF;
  IF v_title.kind = 'starter' THEN
    DELETE FROM public.card_titles WHERE user_id = p_user_id;
  ELSE
    INSERT INTO public.card_titles (user_id, title) VALUES (p_user_id, v_title.id)
    ON CONFLICT (user_id) DO UPDATE SET title = EXCLUDED.title, equipped_at = now();
  END IF;
  RETURN 'set';
END;
$$;
REVOKE ALL ON FUNCTION public.badge_set_title(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.badge_set_title(uuid, text) TO service_role;

/* ------------------------------------------------------------------ test-season rewards */

INSERT INTO public.economy_reasons (reason, note) VALUES
  ('test_pass_reward', 'a coin or consumable reward claimed in the testers'' season (removable with pass.remove_test_season_rewards)'),
  ('test_pass_reward_removed', 'a test-season reward taken back by Joe (pass.remove_test_season_rewards)')
ON CONFLICT (reason) DO NOTHING;

-- Takes back everything the testers' season paid, for one tester (by username or user id) or every account. Coins and
-- consumables: a line of their own per test line (reason test_pass_reward_removed, key test_pass_reward_removed:<line>),
-- never below zero (what was already spent can't be taken; the answer says how much was short). Items claimed in the
-- test season: removed (and so unequipped) unless the same item was also claimed in a real season. Pass titles first
-- unlocked in the test season: removed, and a card showing one goes back to Rookie. The test season's premium tracks:
-- marked removed. Running it again takes nothing more.
--   SELECT pass.remove_test_season_rewards('clean-up before launch');
--   SELECT pass.remove_test_season_rewards('clean-up', 'TheirUsername');
CREATE OR REPLACE FUNCTION pass.remove_test_season_rewards(p_note text, p_player text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pass, economy
AS $$
DECLARE
  v_user uuid := CASE WHEN p_player IS NULL THEN NULL ELSE economy.account(p_player) END;
  r record;
  v_have integer;
  v_take integer;
  v jsonb;
  v_coins integer := 0;
  v_coins_short integer := 0;
  v_cons integer := 0;
  v_cons_short integer := 0;
  v_items integer := 0;
  v_titles integer := 0;
  v_premium integer := 0;
  v_n integer;
BEGIN
  PERFORM pass.log('remove_test_season_rewards', 'test', v_user, NULL, p_note);

  FOR r IN SELECT l.* FROM public.coin_ledger l
            WHERE l.reason = 'test_pass_reward' AND l.amount > 0 AND (v_user IS NULL OR l.user_id = v_user)
              AND NOT EXISTS (SELECT 1 FROM public.coin_ledger x WHERE x.user_id = l.user_id
                                AND x.idempotency_key = 'test_pass_reward_removed:' || l.id)
            ORDER BY l.id LOOP
    SELECT coalesce((SELECT balance FROM public.coin_wallets WHERE user_id = r.user_id FOR UPDATE), 0) INTO v_have;
    v_take := least(r.amount, v_have);
    v_coins_short := v_coins_short + (r.amount - v_take);
    IF v_take > 0 THEN
      v := economy.post_coins(r.user_id, -v_take, 'test_pass_reward_removed', 'ledger', r.id::text,
                              'test_pass_reward_removed:' || r.id);
      IF v ->> 'status' <> 'ok' THEN
        RAISE EXCEPTION 'pass.remove_test_season_rewards: coins %', v ->> 'status';
      END IF;
      PERFORM economy.note_event('coins_spent', r.user_id, jsonb_build_object('reason', 'test_pass_reward_removed', 'amount', v_take));
      v_coins := v_coins + v_take;
    END IF;
  END LOOP;

  FOR r IN SELECT l.* FROM public.consumable_ledger l
            WHERE l.reason = 'test_pass_reward' AND l.amount > 0 AND (v_user IS NULL OR l.user_id = v_user)
              AND NOT EXISTS (SELECT 1 FROM public.consumable_ledger x WHERE x.user_id = l.user_id
                                AND x.idempotency_key = 'test_pass_reward_removed:' || l.id)
            ORDER BY l.id LOOP
    SELECT coalesce((SELECT count FROM public.consumable_balances WHERE user_id = r.user_id AND kind = r.kind FOR UPDATE), 0)
      INTO v_have;
    v_take := least(r.amount, v_have);
    v_cons_short := v_cons_short + (r.amount - v_take);
    IF v_take > 0 THEN
      v := economy.post_consumable(r.user_id, r.kind, -v_take, 'test_pass_reward_removed', 'ledger', r.id::text,
                                   'test_pass_reward_removed:' || r.id);
      IF v ->> 'status' <> 'ok' THEN
        RAISE EXCEPTION 'pass.remove_test_season_rewards: % %', r.kind, v ->> 'status';
      END IF;
      v_cons := v_cons + v_take;
    END IF;
  END LOOP;

  FOR r IN SELECT DISTINCT c.user_id, c.reward ->> 'item' AS item
             FROM public.pass_claims c
            WHERE c.season_id = 'test' AND c.reward ->> 'kind' = 'item' AND (v_user IS NULL OR c.user_id = v_user)
              AND NOT EXISTS (SELECT 1 FROM public.pass_claims o WHERE o.user_id = c.user_id AND o.season_id <> 'test'
                                AND o.reward ->> 'item' = c.reward ->> 'item') LOOP
    DELETE FROM public.inventory_items WHERE user_id = r.user_id AND item_id = r.item AND how = 'pass';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_items := v_items + v_n;
  END LOOP;

  FOR r IN SELECT t.user_id, t.title_id FROM public.pass_title_unlocks t
            WHERE t.season_id = 'test' AND (v_user IS NULL OR t.user_id = v_user)
              AND NOT EXISTS (SELECT 1 FROM public.pass_claims o WHERE o.user_id = t.user_id AND o.season_id <> 'test'
                                AND o.reward ->> 'title' = t.title_id) LOOP
    DELETE FROM public.card_titles WHERE user_id = r.user_id AND title = r.title_id;
    DELETE FROM public.pass_title_unlocks WHERE user_id = r.user_id AND title_id = r.title_id;
    v_titles := v_titles + 1;
  END LOOP;

  UPDATE public.pass_premium SET removed_at = now(), removed_note = p_note
   WHERE season_id = 'test' AND removed_at IS NULL AND (v_user IS NULL OR user_id = v_user);
  GET DIAGNOSTICS v_premium = ROW_COUNT;

  RETURN jsonb_build_object('coins', v_coins, 'coins_already_spent', v_coins_short, 'consumables', v_cons,
                            'consumables_already_used', v_cons_short, 'items', v_items, 'titles', v_titles,
                            'premium_tracks', v_premium);
END;
$$;
REVOKE ALL ON FUNCTION pass.remove_test_season_rewards(text, text) FROM PUBLIC, anon, authenticated, service_role;
