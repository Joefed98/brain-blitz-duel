-- The shop (Wave 2, train D, session D1; 11 Nov 2026; docs/economy/shop.md). Non-destructive and idempotent: it only
-- creates objects (a schema, tables, functions and policies) and adds rows to its own new tables and to
-- public.economy_reasons. No existing table, row or column is changed; A1's catalogue, ledger and inventory are
-- written only through A1's own functions (economy.post_coins, the inventory insert they already make).
--
-- What it holds:
--   * shop.testers: the ONE list of accounts that see the shop (its tab and its functions) while it is closed to
--     everyone (Joe manages it: shop.add_tester, shop.remove_tester, shop.list_testers; every change logged in
--     shop.admin_log). Player #0001 is added here and whenever an account becomes #0001;
--   * public.shop_days: each day's four items (and the day's backups per rarity), chosen once by the server at
--     midnight UK time and never changed, so any day can be checked later;
--   * public.shop_weeks: each week's Monday bundle as it was offered (items, price, separate price);
--   * public.shop_wishlist: the hearts, one row per account and item;
--   * public.shop_purchase_bundle: a bundle's coins and items in one transaction (one spend line per item, so a refund
--     gives back that item's share), idempotent;
--   * public.shop_test_pack: a tester's coin pack with no payment, a ledger line with reason test_purchase;
--     shop.remove_test_purchase takes one back with a line of its own (lines are never changed).
--
-- Who can reach what: nobody writes these tables through the API (no INSERT, UPDATE or DELETE for anon, authenticated
-- or service_role); the server (service role) writes only through the public.shop_* functions; a signed-in player
-- reads only their own wishlist rows; the `shop` schema (testers, the log, Joe's functions) is unreachable from the
-- app and the API.

CREATE SCHEMA IF NOT EXISTS shop;
REVOKE ALL ON SCHEMA shop FROM PUBLIC, anon, authenticated, service_role;

/* ------------------------------------------------------------------ ledger reasons */

INSERT INTO public.economy_reasons (reason, note) VALUES
  ('test_purchase', 'a tester''s coin pack with no payment (removable with shop.remove_test_purchase)'),
  ('test_purchase_removed', 'a test purchase taken back by Joe (shop.remove_test_purchase)')
ON CONFLICT (reason) DO NOTHING;

/* ------------------------------------------------------------------ testers and Joe's log */

CREATE TABLE IF NOT EXISTS shop.testers (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by text NOT NULL DEFAULT session_user,
  note text NOT NULL
);
ALTER TABLE shop.testers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON shop.testers FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS shop.admin_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  -- A removed account's lines keep what was done but no longer name it.
  user_id uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  detail jsonb,
  note text NOT NULL,
  by_role text NOT NULL DEFAULT session_user
);
CREATE INDEX IF NOT EXISTS shop_admin_log_user_idx ON shop.admin_log (user_id, at DESC);
ALTER TABLE shop.admin_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON shop.admin_log FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION shop.log(p_action text, p_user_id uuid, p_detail jsonb, p_note text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, shop
AS $$
DECLARE
  v_id bigint;
BEGIN
  IF coalesce(trim(p_note), '') = '' THEN
    RAISE EXCEPTION 'shop.%: give a note (why)', p_action;
  END IF;
  INSERT INTO shop.admin_log (action, user_id, detail, note) VALUES (p_action, p_user_id, p_detail, p_note)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION shop.log(text, uuid, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;

-- Joe's account (#0001, given by accounts.admin_assign_player_one) is on the list: now if it exists, and whenever an
-- account becomes #0001 later (the trigger below). shop.testers is the ONE list of who sees the shop while it is closed
-- to everyone; the app has no other (src/config/shopConfig.ts).
INSERT INTO shop.testers (user_id, note)
SELECT user_id, 'player #0001 (Joe)' FROM public.profiles WHERE player_number = 1
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION shop.on_player_one()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, shop
AS $$
BEGIN
  IF NEW.player_number = 1 THEN
    INSERT INTO shop.testers (user_id, note) VALUES (NEW.user_id, 'player #0001 (Joe)')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION shop.on_player_one() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS shop_player_one_tester ON public.profiles;
CREATE TRIGGER shop_player_one_tester AFTER INSERT OR UPDATE OF player_number ON public.profiles
  FOR EACH ROW WHEN (NEW.player_number = 1) EXECUTE FUNCTION shop.on_player_one();

/* ------------------------------------------------------------------ the recorded days and weeks */

CREATE TABLE IF NOT EXISTS public.shop_days (
  day date PRIMARY KEY,
  items text[] NOT NULL CHECK (cardinality(items) = 4),
  rarities text[] NOT NULL CHECK (cardinality(rarities) = 4 AND rarities <@ ARRAY['epic', 'elite', 'legendary']),
  backups jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shop_days FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.shop_days TO service_role;

CREATE TABLE IF NOT EXISTS public.shop_weeks (
  week_start date PRIMARY KEY CHECK (extract(isodow FROM week_start) = 1),
  bundle_id text NOT NULL CHECK (bundle_id ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  items text[] NOT NULL CHECK (cardinality(items) BETWEEN 2 AND 12),
  price integer NOT NULL CHECK (price > 0),
  full_price integer NOT NULL CHECK (full_price > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Always 20 to 30 % off the separate prices.
  CONSTRAINT shop_weeks_discount CHECK (price * 10 >= full_price * 7 AND price * 10 <= full_price * 8)
);
ALTER TABLE public.shop_weeks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shop_weeks FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.shop_weeks TO service_role;

-- Records days (an array of {day, items, rarities, backups}); a day already recorded is kept as it was. Every item
-- must be one the shop query returns: pass, free and earned items can never be recorded. Answers how many were new.
CREATE OR REPLACE FUNCTION public.shop_record_days(p_days jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, shop
AS $$
DECLARE
  d jsonb;
  v_items text[];
  v_n integer := 0;
  v_k integer;
BEGIN
  FOR d IN SELECT * FROM jsonb_array_elements(coalesce(p_days, '[]'::jsonb)) LOOP
    v_items := ARRAY(SELECT jsonb_array_elements_text(d -> 'items'));
    IF cardinality(v_items) <> 4 OR (SELECT count(DISTINCT x) FROM unnest(v_items) x) <> 4 THEN
      RAISE EXCEPTION 'shop_record_days: % needs four different items', d ->> 'day';
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(v_items) x WHERE NOT EXISTS (SELECT 1 FROM public.catalogue_shop s WHERE s.id = x)) THEN
      RAISE EXCEPTION 'shop_record_days: % names an item the shop does not sell', d ->> 'day';
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(v_items) WITH ORDINALITY AS x(id, i)
                JOIN public.catalogue_shop s ON s.id = x.id
               WHERE s.rarity <> (d -> 'rarities' ->> (i::int - 1))) THEN
      RAISE EXCEPTION 'shop_record_days: % has an item in a slot of another rarity', d ->> 'day';
    END IF;
    INSERT INTO public.shop_days (day, items, rarities, backups)
    VALUES ((d ->> 'day')::date, v_items, ARRAY(SELECT jsonb_array_elements_text(d -> 'rarities')),
            coalesce(d -> 'backups', '{}'::jsonb))
    ON CONFLICT (day) DO NOTHING;
    GET DIAGNOSTICS v_k = ROW_COUNT;
    v_n := v_n + v_k;
  END LOOP;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.shop_record_days(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_record_days(jsonb) TO service_role;

-- Records a week's bundle (kept as first recorded). Every item must be a shop item.
CREATE OR REPLACE FUNCTION public.shop_record_week(
  p_week date, p_bundle_id text, p_name text, p_items text[], p_price integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, shop
AS $$
DECLARE
  v_full integer;
BEGIN
  IF EXISTS (SELECT 1 FROM unnest(p_items) x WHERE NOT EXISTS (SELECT 1 FROM public.catalogue_shop s WHERE s.id = x)) THEN
    RAISE EXCEPTION 'shop_record_week: % names an item the shop does not sell', p_bundle_id;
  END IF;
  SELECT sum(s.price_coins) INTO v_full FROM public.catalogue_shop s WHERE s.id = ANY (p_items);
  INSERT INTO public.shop_weeks (week_start, bundle_id, name, items, price, full_price)
  VALUES (p_week, p_bundle_id, p_name, p_items, p_price, v_full)
  ON CONFLICT (week_start) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.shop_record_week(date, text, text, text[], integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_record_week(date, text, text, text[], integer) TO service_role;

/* ------------------------------------------------------------------ testers (the server's question) */

CREATE OR REPLACE FUNCTION public.shop_is_tester(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, shop
AS $$
  SELECT EXISTS (SELECT 1 FROM shop.testers t JOIN public.profiles p ON p.user_id = t.user_id
                  WHERE t.user_id = p_user_id AND p.deletion_requested_at IS NULL);
$$;
REVOKE ALL ON FUNCTION public.shop_is_tester(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_is_tester(uuid) TO service_role;

/* ------------------------------------------------------------------ the wishlist */

CREATE TABLE IF NOT EXISTS public.shop_wishlist (
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES public.catalogue_items (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
ALTER TABLE public.shop_wishlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shop_wishlist FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.shop_wishlist TO authenticated, service_role;
DROP POLICY IF EXISTS shop_wishlist_read_own ON public.shop_wishlist;
CREATE POLICY shop_wishlist_read_own ON public.shop_wishlist FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Hearts (p_on) or un-hearts a shop item. Answers added | removed | unchanged | no_account | not_for_sale.
CREATE OR REPLACE FUNCTION public.shop_wishlist_set(p_user_id uuid, p_item_id text, p_on boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, shop, economy
AS $$
DECLARE
  v_n integer;
BEGIN
  IF NOT economy.active_account(p_user_id) THEN
    RETURN 'no_account';
  END IF;
  IF p_on THEN
    IF NOT EXISTS (SELECT 1 FROM public.catalogue_shop WHERE id = p_item_id) THEN
      RETURN 'not_for_sale';
    END IF;
    INSERT INTO public.shop_wishlist (user_id, item_id) VALUES (p_user_id, p_item_id) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN CASE WHEN v_n = 1 THEN 'added' ELSE 'unchanged' END;
  END IF;
  DELETE FROM public.shop_wishlist WHERE user_id = p_user_id AND item_id = p_item_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN CASE WHEN v_n = 1 THEN 'removed' ELSE 'unchanged' END;
END;
$$;
REVOKE ALL ON FUNCTION public.shop_wishlist_set(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_wishlist_set(uuid, text, boolean) TO service_role;

/* ------------------------------------------------------------------ buying a bundle */

-- Buys the week's bundle (or its unowned part): p_items with p_prices (the bundle price split over them by the
-- server). One transaction: the wallet locked first, then one spend line per item (reason bundle_purchase, key
-- p_key || ':' || n) and the item in the inventory against its line; all or nothing. The week must be recorded with
-- those items and the price no more than 30 % off their separate prices.
-- Answers {status: purchased | duplicate | owned | insufficient | not_for_sale | no_account | bad_price, balance,
-- price, line_ids}.
CREATE OR REPLACE FUNCTION public.shop_purchase_bundle(
  p_user_id uuid, p_week date, p_bundle_id text, p_items text[], p_prices integer[], p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, shop, economy
AS $$
DECLARE
  v_week public.shop_weeks%ROWTYPE;
  v_total integer;
  v_full integer;
  v_balance integer;
  v jsonb;
  v_lines bigint[] := ARRAY[]::bigint[];
  i integer;
BEGIN
  IF NOT economy.active_account(p_user_id) THEN
    RETURN jsonb_build_object('status', 'no_account');
  END IF;
  IF coalesce(p_key, '') = '' OR char_length(p_key) > 180 THEN
    RAISE EXCEPTION 'shop_purchase_bundle: a key is required';
  END IF;
  SELECT * INTO v_week FROM public.shop_weeks WHERE week_start = p_week AND bundle_id = p_bundle_id;
  IF NOT FOUND OR cardinality(p_items) = 0 OR cardinality(p_items) <> cardinality(p_prices)
     OR NOT (p_items <@ v_week.items)
     OR (SELECT count(DISTINCT x) FROM unnest(p_items) x) <> cardinality(p_items)
     OR EXISTS (SELECT 1 FROM unnest(p_items) x WHERE NOT EXISTS (SELECT 1 FROM public.catalogue_shop s WHERE s.id = x)) THEN
    RETURN jsonb_build_object('status', 'not_for_sale');
  END IF;
  SELECT sum(x) INTO v_total FROM unnest(p_prices) x;
  SELECT sum(s.price_coins) INTO v_full FROM public.catalogue_shop s WHERE s.id = ANY (p_items);
  IF EXISTS (SELECT 1 FROM unnest(p_prices) x WHERE x IS NULL OR x <= 0)
     OR v_total * 10 < v_full * 7 - 100 OR v_total > v_full THEN
    RETURN jsonb_build_object('status', 'bad_price');
  END IF;
  -- The wallet first (as every coin change), so two purchases on one account queue here.
  INSERT INTO public.coin_wallets (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_balance FROM public.coin_wallets WHERE user_id = p_user_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.coin_ledger WHERE user_id = p_user_id AND idempotency_key = p_key || ':1') THEN
    RETURN jsonb_build_object('status', 'duplicate', 'balance', v_balance);
  END IF;
  IF EXISTS (SELECT 1 FROM public.inventory_items WHERE user_id = p_user_id AND item_id = ANY (p_items)) THEN
    RETURN jsonb_build_object('status', 'owned', 'balance', v_balance);
  END IF;
  IF v_balance < v_total THEN
    RETURN jsonb_build_object('status', 'insufficient', 'balance', v_balance, 'price', v_total);
  END IF;
  FOR i IN 1 .. cardinality(p_items) LOOP
    v := economy.post_coins(p_user_id, -p_prices[i], 'bundle_purchase', 'bundle',
                            p_bundle_id || ':' || p_week::text, p_key || ':' || i);
    IF v ->> 'status' <> 'ok' THEN
      -- Can't happen with the wallet locked and checked; never leave half a bundle.
      RAISE EXCEPTION 'shop_purchase_bundle: % on item %', v ->> 'status', p_items[i];
    END IF;
    INSERT INTO public.inventory_items (user_id, item_id, how, ledger_id)
    VALUES (p_user_id, p_items[i], 'shop', (v ->> 'line_id')::bigint);
    v_lines := v_lines || (v ->> 'line_id')::bigint;
  END LOOP;
  RETURN jsonb_build_object('status', 'purchased', 'balance', v_balance - v_total, 'price', v_total,
                            'line_ids', to_jsonb(v_lines));
END;
$$;
REVOKE ALL ON FUNCTION public.shop_purchase_bundle(uuid, date, text, text[], integer[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_purchase_bundle(uuid, date, text, text[], integer[], text) TO service_role;

/* ------------------------------------------------------------------ test purchases (testers only, no payment) */

-- The four packs (src/lib/shop/packs.ts COIN_PACKS holds the same).
CREATE OR REPLACE FUNCTION shop.pack_coins(p_pack text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_pack WHEN 'starter' THEN 500 WHEN 'standard' THEN 1000 WHEN 'multipack' THEN 3000
                     WHEN 'mega' THEN 10000 END;
$$;
REVOKE ALL ON FUNCTION shop.pack_coins(text) FROM PUBLIC, anon, authenticated, service_role;

-- Credits a pack's coins to a tester with no payment: a line with reason test_purchase (ref test_pack / the pack).
-- Coin packs are for 18+ accounts (on the web, the only platform today). Answers {status: credited | duplicate |
-- not_tester | under_age | bad_pack | no_account, line_id, balance, coins}.
CREATE OR REPLACE FUNCTION public.shop_test_pack(p_user_id uuid, p_pack text, p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, shop, economy
AS $$
DECLARE
  v_coins integer := shop.pack_coins(p_pack);
  v_dob date;
  v jsonb;
BEGIN
  IF v_coins IS NULL THEN
    RETURN jsonb_build_object('status', 'bad_pack');
  END IF;
  IF NOT economy.active_account(p_user_id) THEN
    RETURN jsonb_build_object('status', 'no_account');
  END IF;
  IF NOT public.shop_is_tester(p_user_id) THEN
    RETURN jsonb_build_object('status', 'not_tester');
  END IF;
  SELECT date_of_birth INTO v_dob FROM public.profiles WHERE user_id = p_user_id;
  IF v_dob IS NULL OR extract(year FROM age((now() AT TIME ZONE 'Europe/London')::date, v_dob)) < 18 THEN
    RETURN jsonb_build_object('status', 'under_age');
  END IF;
  v := economy.post_coins(p_user_id, v_coins, 'test_purchase', 'test_pack', p_pack, p_key);
  IF v ->> 'status' = 'ok' THEN v := jsonb_set(v, '{status}', '"credited"'); END IF;
  RETURN v || jsonb_build_object('coins', v_coins);
END;
$$;
REVOKE ALL ON FUNCTION public.shop_test_pack(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_test_pack(uuid, text, text) TO service_role;

/* ------------------------------------------------------------------ Joe's functions (Supabase SQL editor) */

-- Adds a tester (username, any capitals, or user id; guests refused).
--   SELECT shop.add_tester('TheirUsername', 'testing the shop before launch');
CREATE OR REPLACE FUNCTION shop.add_tester(p_player text, p_note text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, shop, economy
AS $$
DECLARE
  v_user uuid := economy.account(p_player);
  v_n integer;
BEGIN
  PERFORM shop.log('add_tester', v_user, NULL, p_note);
  INSERT INTO shop.testers (user_id, note) VALUES (v_user, p_note) ON CONFLICT (user_id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN CASE WHEN v_n = 1 THEN 'added' ELSE 'already_tester' END;
END;
$$;
REVOKE ALL ON FUNCTION shop.add_tester(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Removes a tester (their coins, items and test lines stay; remove test coins with shop.remove_test_purchase).
--   SELECT shop.remove_tester('TheirUsername', 'testing finished');
CREATE OR REPLACE FUNCTION shop.remove_tester(p_player text, p_note text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, shop, economy
AS $$
DECLARE
  v_user uuid := economy.account(p_player);
  v_n integer;
BEGIN
  PERFORM shop.log('remove_tester', v_user, NULL, p_note);
  DELETE FROM shop.testers WHERE user_id = v_user;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN CASE WHEN v_n = 1 THEN 'removed' ELSE 'not_a_tester' END;
END;
$$;
REVOKE ALL ON FUNCTION shop.remove_tester(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Every tester.
--   SELECT * FROM shop.list_testers();
CREATE OR REPLACE FUNCTION shop.list_testers()
RETURNS TABLE (username text, player_number integer, user_id uuid, added_at timestamptz, added_by text, note text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, shop
AS $$
  SELECT p.username, p.player_number, t.user_id, t.added_at, t.added_by, t.note
    FROM shop.testers t JOIN public.profiles p ON p.user_id = t.user_id
   ORDER BY t.added_at;
$$;
REVOKE ALL ON FUNCTION shop.list_testers() FROM PUBLIC, anon, authenticated, service_role;

-- Test purchases (all, or one player's), with whether each was taken back.
--   SELECT * FROM shop.test_purchases();
--   SELECT * FROM shop.test_purchases('TheirUsername');
CREATE OR REPLACE FUNCTION shop.test_purchases(p_player text DEFAULT NULL)
RETURNS TABLE (line_id bigint, username text, pack text, coins integer, at timestamptz, removed boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, shop, economy
AS $$
  SELECT l.id, p.username, l.ref_id, l.amount, l.created_at,
         EXISTS (SELECT 1 FROM public.coin_ledger r WHERE r.user_id = l.user_id
                   AND r.idempotency_key = 'test_purchase_removed:' || l.id)
    FROM public.coin_ledger l JOIN public.profiles p ON p.user_id = l.user_id
   WHERE l.reason = 'test_purchase'
     AND (p_player IS NULL OR l.user_id = economy.account(p_player))
   ORDER BY l.id DESC;
$$;
REVOKE ALL ON FUNCTION shop.test_purchases(text) FROM PUBLIC, anon, authenticated, service_role;

-- Takes a test purchase back: a line of its own (reason test_purchase_removed), once per test line; never below
-- zero. If the tester has already spent the coins it refuses, unless p_take_what_is_left, which takes the balance
-- down to zero instead.
--   SELECT shop.remove_test_purchase(1234, 'end of test round');
--   SELECT shop.remove_test_purchase(1234, 'end of test round', true);
CREATE OR REPLACE FUNCTION shop.remove_test_purchase(p_line_id bigint, p_note text, p_take_what_is_left boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, shop, economy
AS $$
DECLARE
  v_line public.coin_ledger%ROWTYPE;
  v_balance integer;
  v_take integer;
  v_log bigint;
  v jsonb;
BEGIN
  SELECT * INTO v_line FROM public.coin_ledger WHERE id = p_line_id;
  IF NOT FOUND OR v_line.reason <> 'test_purchase' OR v_line.amount <= 0 THEN
    RAISE EXCEPTION 'shop.remove_test_purchase: line % is not a test purchase', p_line_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.coin_ledger WHERE user_id = v_line.user_id
               AND idempotency_key = 'test_purchase_removed:' || p_line_id) THEN
    RETURN jsonb_build_object('status', 'already_removed');
  END IF;
  SELECT balance INTO v_balance FROM public.coin_wallets WHERE user_id = v_line.user_id;
  v_take := least(v_line.amount, coalesce(v_balance, 0));
  IF v_take < v_line.amount AND NOT p_take_what_is_left THEN
    RAISE EXCEPTION 'shop.remove_test_purchase: the balance is % (the line was %); pass true as the third argument to take what is left', v_balance, v_line.amount;
  END IF;
  v_log := shop.log('remove_test_purchase', v_line.user_id,
    jsonb_build_object('line_id', p_line_id, 'amount', v_line.amount, 'taken', v_take), p_note);
  IF v_take = 0 THEN
    RETURN jsonb_build_object('status', 'nothing_left', 'balance', v_balance);
  END IF;
  v := economy.post_coins(v_line.user_id, -v_take, 'test_purchase_removed', 'ledger', p_line_id::text,
                          'test_purchase_removed:' || p_line_id);
  IF v ->> 'status' <> 'ok' THEN
    RAISE EXCEPTION 'shop.remove_test_purchase: %', v ->> 'status';
  END IF;
  UPDATE shop.admin_log SET detail = detail || jsonb_build_object('removal_line_id', v -> 'line_id') WHERE id = v_log;
  PERFORM economy.note_event('coins_spent', v_line.user_id,
    jsonb_build_object('reason', 'test_purchase_removed', 'amount', v_take));
  RETURN jsonb_set(v, '{status}', '"removed"') || jsonb_build_object('taken', v_take);
END;
$$;
REVOKE ALL ON FUNCTION shop.remove_test_purchase(bigint, text, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- What the shop showed on a day: the four, the backups and that week's bundle.
--   SELECT shop.day('2026-11-12');
CREATE OR REPLACE FUNCTION shop.day(p_day date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, shop
AS $$
  SELECT jsonb_build_object(
    'day', p_day,
    'items', (SELECT to_jsonb(items) FROM public.shop_days WHERE day = p_day),
    'rarities', (SELECT to_jsonb(rarities) FROM public.shop_days WHERE day = p_day),
    'backups', (SELECT backups FROM public.shop_days WHERE day = p_day),
    'bundle', (SELECT to_jsonb(w) FROM public.shop_weeks w
                WHERE w.week_start = p_day - (extract(isodow FROM p_day)::int - 1)));
$$;
REVOKE ALL ON FUNCTION shop.day(date) FROM PUBLIC, anon, authenticated, service_role;

-- The log.
--   SELECT at, by_role, action, user_id, detail, note FROM shop.admin_log ORDER BY at DESC;
