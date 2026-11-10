-- Coins and items (Wave 2, train A, session A1; 10 Nov 2026; docs/economy/README.md). Non-destructive and
-- idempotent: it only creates objects (a schema, tables, a view, functions, triggers and policies), adds rows to its
-- own new reference tables and widens analytics.events' list of events. No existing table, row or column is changed.
-- The catalogue's 110 items and the backfill for existing accounts come in the next file
-- (20261110160100_economy_catalogue.sql).
--
-- What it holds:
--   * public.catalogue_items: every item (catalogue.json is the source of truth), with the rules the table enforces;
--     public.catalogue_shop: the only shop query (shop items that aren't exclusive);
--   * public.coin_ledger + public.coin_wallets: one line per change of coins; the wallet is a cache of the lines' sum,
--     changed only in the same transaction as the line;
--   * public.consumable_ledger + public.consumable_balances: streak freezes and tournament tickets, counted the same way;
--   * public.inventory_items: what each account owns (each item at most once);
--   * public.loadouts, public.loadout_slots, public.gem_unlocks: the avatar, the gem and one equipped item per slot.
--
-- Who can reach what (as Supabase applies it):
--   * anon and authenticated: read the catalogue; a signed-in player reads only their own wallet, lines, consumables,
--     inventory, loadout and gem unlocks. Nobody but the database's own functions writes any of these tables: no
--     INSERT, UPDATE or DELETE for anon, authenticated or service_role;
--   * the server (service role) reaches the writes only through the public.economy_* functions below, each checking
--     the rules (accounts only, idempotency keys, the balance, ownership, the slot);
--   * the `economy` schema (Joe's admin functions and their log) is unreachable from the app and the API.
-- Guests have nothing here: every row keys on public.profiles(user_id), so a user without a profile has no wallet.
-- When an account is removed (accounts.forget_user deletes its profile), its rows go with it (ON DELETE CASCADE) and
-- its admin-log lines lose their user id.

CREATE SCHEMA IF NOT EXISTS economy;
REVOKE ALL ON SCHEMA economy FROM PUBLIC, anon, authenticated, service_role;

/* ------------------------------------------------------------------ reference lists (later sessions add rows) */

-- Why coins or consumables changed. A later session adds its own with an INSERT in its migration.
CREATE TABLE IF NOT EXISTS public.economy_reasons (
  reason text PRIMARY KEY CHECK (reason ~ '^[a-z][a-z0-9_]{1,39}$'),
  note text
);
ALTER TABLE public.economy_reasons ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.economy_reasons FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.economy_reasons TO service_role;
INSERT INTO public.economy_reasons (reason, note) VALUES
  ('signup_reward', 'the 1,000 coins for making an account (paid by C2)'),
  ('challenge_reward', 'a practice or season challenge'),
  ('badge_reward', 'a badge earned'),
  ('pass_reward', 'a battle pass level'),
  ('plus_monthly', 'Joulz Plus monthly grant'),
  ('ad_reward', 'a rewarded video'),
  ('shop_purchase', 'an item bought in the shop'),
  ('bundle_purchase', 'a bundle bought in the shop'),
  ('pack_purchase', 'a coin pack bought'),
  ('refund', 'a spend given back'),
  ('admin_adjustment', 'Joe, from the dashboard')
ON CONFLICT (reason) DO NOTHING;

-- Consumables: counted per account (granted by the pass and Plus; spent where the feature lives).
CREATE TABLE IF NOT EXISTS public.consumable_kinds (
  kind text PRIMARY KEY CHECK (kind ~ '^[a-z][a-z0-9_]{1,39}$'),
  name text NOT NULL
);
ALTER TABLE public.consumable_kinds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consumable_kinds FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.consumable_kinds TO anon, authenticated, service_role;
DROP POLICY IF EXISTS consumable_kinds_read ON public.consumable_kinds;
CREATE POLICY consumable_kinds_read ON public.consumable_kinds FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.consumable_kinds (kind, name) VALUES
  ('streak_freeze', 'Streak freeze'),
  ('ticket_score_attack', 'Score Attack ticket'),
  ('ticket_category_cup', 'Category Cup ticket')
ON CONFLICT (kind) DO NOTHING;

/* ------------------------------------------------------------------ the item catalogue */

-- One row per item, seeded from docs/art/wave-2/catalogue.json (never typed by hand). `slot` is where it is equipped
-- (src/lib/economy/slots.ts holds the same mapping): the kind, except game skins and world themes (per game), reactions
-- (any of the reaction slots) and the celebration the catalogue marks as a podium entrance.
CREATE TABLE IF NOT EXISTS public.catalogue_items (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  kind text NOT NULL CHECK (kind IN ('card-art', 'frame', 'name-colour', 'avatar-special-edition', 'avatar-finish',
                                     'avatar-accessory', 'reaction', 'celebration', 'tile-style', 'game-skin',
                                     'world-theme')),
  slot text NOT NULL,
  -- Skins and world themes: the game's display name as in the catalogue file, and its PuzzleType id.
  game text,
  game_type text,
  -- None for free and earned items.
  rarity text CHECK (rarity IN ('common', 'rare', 'epic', 'elite', 'legendary')),
  -- 'tournament' is reserved for wave 4's tournament prizes.
  source text NOT NULL CHECK (source IN ('shop', 'pass-free', 'pass-premium', 'free-starter', 'earned-season-peak-tier',
                                         'earned-founding-player', 'earned-top-500', 'tournament')),
  pass_level smallint CHECK (pass_level BETWEEN 1 AND 100),
  price_coins integer,
  bundle text,
  animated boolean NOT NULL,
  -- Never sold: true for everything not from the shop (the constraint below), so no shop query can return it.
  exclusive boolean NOT NULL,
  -- The catalogue's own "exclusive forever" (Season 1's pass and the earned items: never again, anywhere).
  exclusive_forever boolean NOT NULL DEFAULT false,
  note text,
  png_path text,
  html_path text,
  -- The catalogue file's order.
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalogue_price_only_shop CHECK ((source = 'shop') = (price_coins IS NOT NULL)),
  CONSTRAINT catalogue_price_by_rarity CHECK (source <> 'shop' OR coalesce(price_coins = CASE rarity
      WHEN 'epic' THEN 1000 WHEN 'elite' THEN 1600 WHEN 'legendary' THEN 2800 END, false)),
  CONSTRAINT catalogue_legendary_animated CHECK (rarity IS DISTINCT FROM 'legendary' OR animated),
  CONSTRAINT catalogue_exclusive_unless_shop CHECK (exclusive = (source <> 'shop')),
  CONSTRAINT catalogue_pass_level CHECK ((source IN ('pass-free', 'pass-premium')) = (pass_level IS NOT NULL)),
  CONSTRAINT catalogue_rarity_by_source CHECK (CASE
      WHEN source IN ('shop', 'pass-free', 'pass-premium') THEN rarity IS NOT NULL
      WHEN source = 'tournament' THEN true
      ELSE rarity IS NULL END),
  CONSTRAINT catalogue_game CHECK ((kind IN ('game-skin', 'world-theme')) = (game_type IS NOT NULL)
                                   AND (game IS NULL) = (game_type IS NULL)),
  CONSTRAINT catalogue_slot CHECK (CASE kind
      WHEN 'game-skin' THEN slot = 'game-skin:' || game_type
      WHEN 'world-theme' THEN slot = 'world-theme:' || game_type
      WHEN 'celebration' THEN slot IN ('celebration', 'podium-entrance')
      ELSE slot = kind END)
);
CREATE INDEX IF NOT EXISTS catalogue_items_source_idx ON public.catalogue_items (source);

ALTER TABLE public.catalogue_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalogue_items FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.catalogue_items TO anon, authenticated, service_role;
DROP POLICY IF EXISTS catalogue_items_read ON public.catalogue_items;
CREATE POLICY catalogue_items_read ON public.catalogue_items FOR SELECT TO anon, authenticated USING (true);

-- The one shop query: items from the shop that aren't exclusive (the table's constraints make those the same set;
-- both are asked, so neither alone can let an exclusive item through).
CREATE OR REPLACE VIEW public.catalogue_shop WITH (security_invoker = true) AS
  SELECT * FROM public.catalogue_items
   WHERE source = 'shop' AND NOT exclusive AND price_coins IS NOT NULL;
REVOKE ALL ON public.catalogue_shop FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.catalogue_shop TO anon, authenticated, service_role;

/* ------------------------------------------------------------------ coins */

-- The cached balance: always the sum of the account's ledger lines, changed only by economy.post_coins in the same
-- transaction as the line it adds.
CREATE TABLE IF NOT EXISTS public.coin_wallets (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One line per change. Never changed or removed (a trigger refuses it), except with the account itself.
CREATE TABLE IF NOT EXISTS public.coin_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount <> 0 AND abs(amount) <= 1000000),
  reason text NOT NULL REFERENCES public.economy_reasons (reason),
  -- What it is about: 'item' (a catalogue id), 'reward', 'purchase', 'ledger' (a refunded line's id), 'admin' ...
  ref_kind text CHECK (ref_kind IS NULL OR ref_kind ~ '^[a-z][a-z0-9_]{1,39}$'),
  ref_id text CHECK (ref_id IS NULL OR char_length(ref_id) <= 200),
  -- The same key on the same account never pays (or charges) twice.
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 200),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coin_ledger_key UNIQUE (user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS coin_ledger_user_idx ON public.coin_ledger (user_id, id DESC);

/* ------------------------------------------------------------------ consumables */

CREATE TABLE IF NOT EXISTS public.consumable_balances (
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  kind text NOT NULL REFERENCES public.consumable_kinds (kind),
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind)
);

CREATE TABLE IF NOT EXISTS public.consumable_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  kind text NOT NULL REFERENCES public.consumable_kinds (kind),
  amount integer NOT NULL CHECK (amount <> 0 AND abs(amount) <= 10000),
  reason text NOT NULL REFERENCES public.economy_reasons (reason),
  ref_kind text CHECK (ref_kind IS NULL OR ref_kind ~ '^[a-z][a-z0-9_]{1,39}$'),
  ref_id text CHECK (ref_id IS NULL OR char_length(ref_id) <= 200),
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 200),
  count_after integer NOT NULL CHECK (count_after >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consumable_ledger_key UNIQUE (user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS consumable_ledger_user_idx ON public.consumable_ledger (user_id, id DESC);

-- Ledger lines are append-only: no update ever, and a delete only as part of removing the account (its profile row
-- is already gone when the cascade reaches the lines).
CREATE OR REPLACE FUNCTION economy.ledger_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = OLD.user_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '%: ledger lines are never changed or removed', TG_TABLE_NAME;
END;
$$;
REVOKE ALL ON FUNCTION economy.ledger_guard() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS coin_ledger_guard ON public.coin_ledger;
CREATE TRIGGER coin_ledger_guard BEFORE UPDATE OR DELETE ON public.coin_ledger
  FOR EACH ROW EXECUTE FUNCTION economy.ledger_guard();
DROP TRIGGER IF EXISTS consumable_ledger_guard ON public.consumable_ledger;
CREATE TRIGGER consumable_ledger_guard BEFORE UPDATE OR DELETE ON public.consumable_ledger
  FOR EACH ROW EXECUTE FUNCTION economy.ledger_guard();

/* ------------------------------------------------------------------ ownership and equipping */

-- How an item was got: starter (every account), shop (bought: ledger_id is the spend line), pass, earned, grant (Joe).
CREATE TABLE IF NOT EXISTS public.inventory_items (
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES public.catalogue_items (id),
  how text NOT NULL CHECK (how IN ('starter', 'shop', 'pass', 'earned', 'grant')),
  acquired_at timestamptz NOT NULL DEFAULT now(),
  ledger_id bigint REFERENCES public.coin_ledger (id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, item_id),
  CONSTRAINT inventory_bought_has_line CHECK ((how = 'shop') = (ledger_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_ledger_idx ON public.inventory_items (ledger_id) WHERE ledger_id IS NOT NULL;

-- Gem colours unlocked by mastery stars (C1 writes them; none before). Never sold.
CREATE TABLE IF NOT EXISTS public.gem_unlocks (
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  gem text NOT NULL CHECK (gem IN ('amber', 'rose-quartz', 'ruby', 'jade', 'amethyst', 'aquamarine', 'sapphire',
                                   'pearl', 'obsidian', 'diamond')),
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, gem)
);

-- The avatar builder's options (Joe's addendum, 10 Nov 2026): every avatar has a main colour (any of the 32 player
-- colours: the profile's colour), an accent colour, one feature, an accessory and a background. Which option belongs
-- to which avatar is one row here, seeded by the next file from docs/art/avatars/avatars.json and avatars.py: today only
-- each avatar's own accent and its scene backdrop (the art defines no feature or accessory options yet; a later
-- migration adds rows). The avatar's own accessory option is not the catalogue's avatar-accessory item (Neon Bolt),
-- which is equipped in the avatar-accessory loadout slot.
CREATE TABLE IF NOT EXISTS public.avatar_options (
  avatar_id text NOT NULL CHECK (avatar_id IN (
    'captain-joulz', 'gemstone', 'hover', 'apex', 'pinball', 'crazy-golf', 'iron-wall', 'wavefront', 'breaker',
    'fission', 'tempo', 'nucleus', 'blackout', 'hanoi', 'polypotions', 'safe-cracker', 'coral-pop', 'swish',
    'flightpath', 'home-run', 'cue-ball', 'blockzone', 'spacewalk', 'meteor', 'moon-climb', 'curl-champ', 'top-bins',
    'lightbender', 'cryptogrid', 'high-rise', 'rainbow-bridge', 'orbit')),
  kind text NOT NULL CHECK (kind IN ('accent', 'feature', 'accessory', 'background')),
  option_id text NOT NULL CHECK (option_id ~ '^[a-z0-9#][a-z0-9#-]{0,39}$'),
  -- The avatar's default for this kind (at most one per avatar and kind).
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (avatar_id, kind, option_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS avatar_options_default_idx ON public.avatar_options (avatar_id, kind) WHERE is_default;
ALTER TABLE public.avatar_options ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.avatar_options FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.avatar_options TO anon, authenticated, service_role;
DROP POLICY IF EXISTS avatar_options_read ON public.avatar_options;
CREATE POLICY avatar_options_read ON public.avatar_options FOR SELECT TO anon, authenticated USING (true);

-- The avatar (one of the 32 free game avatars, docs/art/avatars/avatars.json; its main colour is the profile's
-- colour), its options (null: the avatar's default; each one of that avatar's rows in avatar_options, checked by
-- public.economy_set_avatar, the only writer) and the gem, which must be one this account has unlocked (the foreign
-- key). A new account starts as Captain Joulz's helmet in its colour.
CREATE TABLE IF NOT EXISTS public.loadouts (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  avatar_id text NOT NULL DEFAULT 'captain-joulz' CHECK (avatar_id IN (
    'captain-joulz', 'gemstone', 'hover', 'apex', 'pinball', 'crazy-golf', 'iron-wall', 'wavefront', 'breaker',
    'fission', 'tempo', 'nucleus', 'blackout', 'hanoi', 'polypotions', 'safe-cracker', 'coral-pop', 'swish',
    'flightpath', 'home-run', 'cue-ball', 'blockzone', 'spacewalk', 'meteor', 'moon-climb', 'curl-champ', 'top-bins',
    'lightbender', 'cryptogrid', 'high-rise', 'rainbow-bridge', 'orbit')),
  accent text,
  feature text,
  accessory text,
  background text,
  gem text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loadouts_gem_unlocked FOREIGN KEY (user_id, gem) REFERENCES public.gem_unlocks (user_id, gem)
);

-- One equipped item per slot (no row: the slot's default). The foreign key on the inventory means only an owned
-- item can sit here, and removing an item from the inventory unequips it.
CREATE TABLE IF NOT EXISTS public.loadout_slots (
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  slot text NOT NULL CHECK (slot ~ '^[a-z][a-z0-9:-]{1,47}$'),
  item_id text NOT NULL,
  equipped_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, slot),
  CONSTRAINT loadout_slots_item_once UNIQUE (user_id, item_id),
  CONSTRAINT loadout_slots_owned FOREIGN KEY (user_id, item_id)
    REFERENCES public.inventory_items (user_id, item_id) ON DELETE CASCADE
);

/* ------------------------------------------------------------------ RLS: own rows, read only */

DO $own$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['coin_wallets', 'coin_ledger', 'consumable_balances', 'consumable_ledger',
                           'inventory_items', 'gem_unlocks', 'loadouts', 'loadout_slots'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, service_role', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated, service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (user_id = auth.uid())',
                   t || '_read_own', t);
  END LOOP;
END
$own$;

/* ------------------------------------------------------------------ analytics: the four new events */

-- src/lib/analytics/events.ts ANALYTICS_EVENTS holds the same list (analytics-events-check). coins_credited and
-- coins_spent carry props.reason and props.amount; item_granted props.kind, props.rarity and props.source;
-- item_equipped props.kind.
DO $events$
BEGIN
  IF to_regclass('analytics.events') IS NOT NULL THEN
    ALTER TABLE analytics.events DROP CONSTRAINT IF EXISTS events_event_check;
    ALTER TABLE analytics.events ADD CONSTRAINT events_event_check CHECK (event IN (
      'app_opened', 'game_started', 'game_finished', 'room_created', 'room_joined', 'room_started', 'room_finished',
      'daily_started', 'daily_finished', 'challenge_created', 'challenge_played', 'share_tapped', 'invite_opened',
      'error_shown', 'offline_game_played',
      'sign_up_started', 'sign_up_completed', 'sign_in', 'sign_out', 'username_changed', 'account_deletion_requested',
      'under_thirteen_refused',
      'save_progress_shown', 'save_progress_tapped', 'save_progress_dismissed',
      'report_sent', 'chat_muted', 'moderation_action',
      'coins_credited', 'coins_spent', 'item_granted', 'item_equipped'
    )) NOT VALID;
    ALTER TABLE analytics.events VALIDATE CONSTRAINT events_event_check;
  END IF;
END
$events$;

/* ------------------------------------------------------------------ internal helpers (economy schema) */

-- One analytics event from inside the database (Joe's functions and the sign-up grant), the row shape
-- src/lib/data/events.server.ts writes. Never fails the caller.
CREATE OR REPLACE FUNCTION economy.note_event(p_event text, p_user_id uuid, p_props jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
BEGIN
  IF to_regprocedure('public.record_analytics_events(jsonb)') IS NOT NULL THEN
    PERFORM public.record_analytics_events(jsonb_build_array(jsonb_build_object(
      'event', p_event, 'player_id', p_user_id, 'props', p_props)));
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;
REVOKE ALL ON FUNCTION economy.note_event(text, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- An account that may spend, equip and change its look: a profile not waiting for deletion.
CREATE OR REPLACE FUNCTION economy.active_account(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id AND deletion_requested_at IS NULL);
$$;
REVOKE ALL ON FUNCTION economy.active_account(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- The one writer of coins: adds a line and moves the cached balance in the same transaction, with the wallet row
-- locked first, so two changes to one account run one after the other and a spend is checked against the balance it
-- will change. Answers {status: ok | duplicate | insufficient | no_account | bad_reason, line_id, balance, amount}.
CREATE OR REPLACE FUNCTION economy.post_coins(
  p_user_id uuid, p_amount integer, p_reason text, p_ref_kind text, p_ref_id text, p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_balance integer;
  v_line public.coin_ledger%ROWTYPE;
  v_id bigint;
BEGIN
  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'post_coins: amount must be non-zero';
  END IF;
  IF coalesce(p_key, '') = '' THEN
    RAISE EXCEPTION 'post_coins: an idempotency key is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.economy_reasons WHERE reason = p_reason) THEN
    RETURN jsonb_build_object('status', 'bad_reason');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RETURN jsonb_build_object('status', 'no_account');
  END IF;
  INSERT INTO public.coin_wallets (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_balance FROM public.coin_wallets WHERE user_id = p_user_id FOR UPDATE;
  SELECT * INTO v_line FROM public.coin_ledger WHERE user_id = p_user_id AND idempotency_key = p_key;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'duplicate', 'line_id', v_line.id, 'balance', v_balance, 'amount', v_line.amount);
  END IF;
  IF v_balance + p_amount < 0 THEN
    RETURN jsonb_build_object('status', 'insufficient', 'balance', v_balance, 'amount', p_amount);
  END IF;
  INSERT INTO public.coin_ledger (user_id, amount, reason, ref_kind, ref_id, idempotency_key, balance_after)
  VALUES (p_user_id, p_amount, p_reason, p_ref_kind, p_ref_id, p_key, v_balance + p_amount)
  RETURNING id INTO v_id;
  UPDATE public.coin_wallets SET balance = v_balance + p_amount, updated_at = now() WHERE user_id = p_user_id;
  RETURN jsonb_build_object('status', 'ok', 'line_id', v_id, 'balance', v_balance + p_amount, 'amount', p_amount);
END;
$$;
REVOKE ALL ON FUNCTION economy.post_coins(uuid, integer, text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- The same for one consumable kind.
CREATE OR REPLACE FUNCTION economy.post_consumable(
  p_user_id uuid, p_kind text, p_amount integer, p_reason text, p_ref_kind text, p_ref_id text, p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_count integer;
  v_line public.consumable_ledger%ROWTYPE;
  v_id bigint;
BEGIN
  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'post_consumable: amount must be non-zero';
  END IF;
  IF coalesce(p_key, '') = '' THEN
    RAISE EXCEPTION 'post_consumable: an idempotency key is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.consumable_kinds WHERE kind = p_kind) THEN
    RETURN jsonb_build_object('status', 'bad_kind');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.economy_reasons WHERE reason = p_reason) THEN
    RETURN jsonb_build_object('status', 'bad_reason');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RETURN jsonb_build_object('status', 'no_account');
  END IF;
  INSERT INTO public.consumable_balances (user_id, kind) VALUES (p_user_id, p_kind) ON CONFLICT DO NOTHING;
  SELECT count INTO v_count FROM public.consumable_balances WHERE user_id = p_user_id AND kind = p_kind FOR UPDATE;
  SELECT * INTO v_line FROM public.consumable_ledger WHERE user_id = p_user_id AND idempotency_key = p_key;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'duplicate', 'line_id', v_line.id, 'count', v_count, 'amount', v_line.amount);
  END IF;
  IF v_count + p_amount < 0 THEN
    RETURN jsonb_build_object('status', 'insufficient', 'count', v_count, 'amount', p_amount);
  END IF;
  INSERT INTO public.consumable_ledger (user_id, kind, amount, reason, ref_kind, ref_id, idempotency_key, count_after)
  VALUES (p_user_id, p_kind, p_amount, p_reason, p_ref_kind, p_ref_id, p_key, v_count + p_amount)
  RETURNING id INTO v_id;
  UPDATE public.consumable_balances SET count = v_count + p_amount, updated_at = now()
   WHERE user_id = p_user_id AND kind = p_kind;
  RETURN jsonb_build_object('status', 'ok', 'line_id', v_id, 'count', v_count + p_amount, 'amount', p_amount);
END;
$$;
REVOKE ALL ON FUNCTION economy.post_consumable(uuid, text, integer, text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Adds an item to an inventory (never 'shop': a purchase goes through public.economy_purchase_item). Answers
-- granted | owned | no_account | unknown_item | bad_how.
CREATE OR REPLACE FUNCTION economy.add_item(p_user_id uuid, p_item_id text, p_how text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_n integer;
BEGIN
  IF p_how NOT IN ('starter', 'pass', 'earned', 'grant') THEN
    RETURN 'bad_how';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RETURN 'no_account';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.catalogue_items WHERE id = p_item_id) THEN
    RETURN 'unknown_item';
  END IF;
  INSERT INTO public.inventory_items (user_id, item_id, how) VALUES (p_user_id, p_item_id, p_how)
  ON CONFLICT (user_id, item_id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN CASE WHEN v_n = 1 THEN 'granted' ELSE 'owned' END;
END;
$$;
REVOKE ALL ON FUNCTION economy.add_item(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;

/* ------------------------------------------------------------------ the server's functions (service role only) */

-- Credits coins. p_amount > 0. Answers {status: credited | duplicate | no_account | bad_reason, line_id, balance}.
CREATE OR REPLACE FUNCTION public.economy_credit(
  p_user_id uuid, p_amount integer, p_reason text, p_ref_kind text, p_ref_id text, p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v jsonb;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'economy_credit: amount must be positive';
  END IF;
  v := economy.post_coins(p_user_id, p_amount, p_reason, p_ref_kind, p_ref_id, p_key);
  IF v ->> 'status' = 'ok' THEN v := jsonb_set(v, '{status}', '"credited"'); END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.economy_credit(uuid, integer, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.economy_credit(uuid, integer, text, text, text, text) TO service_role;

-- Spends coins. p_amount > 0 (the line is -p_amount). Answers {status: spent | duplicate | insufficient | no_account |
-- bad_reason, line_id, balance}. An account waiting for deletion can't spend.
CREATE OR REPLACE FUNCTION public.economy_spend(
  p_user_id uuid, p_amount integer, p_reason text, p_ref_kind text, p_ref_id text, p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v jsonb;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'economy_spend: amount must be positive';
  END IF;
  IF NOT economy.active_account(p_user_id) THEN
    RETURN jsonb_build_object('status', 'no_account');
  END IF;
  v := economy.post_coins(p_user_id, -p_amount, p_reason, p_ref_kind, p_ref_id, p_key);
  IF v ->> 'status' = 'ok' THEN v := jsonb_set(v, '{status}', '"spent"'); END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.economy_spend(uuid, integer, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.economy_spend(uuid, integer, text, text, text, text) TO service_role;

-- Gives back one spend line, once (its key is fixed: 'refund:<line id>'); an item bought with it leaves the
-- inventory (and its slot). Answers {status: refunded | duplicate | not_a_spend | no_account, line_id, balance,
-- item_removed}.
CREATE OR REPLACE FUNCTION public.economy_refund(p_user_id uuid, p_line_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_line public.coin_ledger%ROWTYPE;
  v jsonb;
  v_item text;
BEGIN
  SELECT * INTO v_line FROM public.coin_ledger WHERE id = p_line_id AND user_id = p_user_id;
  IF NOT FOUND OR v_line.amount >= 0 THEN
    RETURN jsonb_build_object('status', 'not_a_spend');
  END IF;
  v := economy.post_coins(p_user_id, -v_line.amount, 'refund', 'ledger', p_line_id::text, 'refund:' || p_line_id);
  IF v ->> 'status' <> 'ok' THEN RETURN v; END IF;
  DELETE FROM public.inventory_items WHERE user_id = p_user_id AND ledger_id = p_line_id RETURNING item_id INTO v_item;
  RETURN jsonb_set(v, '{status}', '"refunded"') || jsonb_build_object('item_removed', v_item);
END;
$$;
REVOKE ALL ON FUNCTION public.economy_refund(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.economy_refund(uuid, bigint) TO service_role;

-- Buys one shop item at its catalogue price: the spend and the item in one transaction. Only items the shop query
-- returns can be bought. Answers {status: purchased | owned | not_for_sale | insufficient | duplicate | no_account,
-- line_id, balance, price}.
CREATE OR REPLACE FUNCTION public.economy_purchase_item(p_user_id uuid, p_item_id text, p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_price integer;
  v jsonb;
BEGIN
  IF NOT economy.active_account(p_user_id) THEN
    RETURN jsonb_build_object('status', 'no_account');
  END IF;
  SELECT price_coins INTO v_price FROM public.catalogue_shop WHERE id = p_item_id;
  IF v_price IS NULL THEN
    RETURN jsonb_build_object('status', 'not_for_sale');
  END IF;
  -- The wallet first (as every coin change), so two purchases on one account queue here.
  INSERT INTO public.coin_wallets (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  PERFORM 1 FROM public.coin_wallets WHERE user_id = p_user_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.coin_ledger WHERE user_id = p_user_id AND idempotency_key = p_key) THEN
    RETURN economy.post_coins(p_user_id, -v_price, 'shop_purchase', 'item', p_item_id, p_key);
  END IF;
  IF EXISTS (SELECT 1 FROM public.inventory_items WHERE user_id = p_user_id AND item_id = p_item_id) THEN
    RETURN jsonb_build_object('status', 'owned');
  END IF;
  v := economy.post_coins(p_user_id, -v_price, 'shop_purchase', 'item', p_item_id, p_key);
  IF v ->> 'status' <> 'ok' THEN RETURN v; END IF;
  INSERT INTO public.inventory_items (user_id, item_id, how, ledger_id)
  VALUES (p_user_id, p_item_id, 'shop', (v ->> 'line_id')::bigint);
  RETURN jsonb_set(v, '{status}', '"purchased"') || jsonb_build_object('price', v_price);
END;
$$;
REVOKE ALL ON FUNCTION public.economy_purchase_item(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.economy_purchase_item(uuid, text, text) TO service_role;

-- Grants an item without coins (p_how: pass, earned, grant, starter). Answers granted | owned | no_account |
-- unknown_item | bad_how.
CREATE OR REPLACE FUNCTION public.economy_grant_item(p_user_id uuid, p_item_id text, p_how text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, economy
AS $$ SELECT economy.add_item(p_user_id, p_item_id, p_how) $$;
REVOKE ALL ON FUNCTION public.economy_grant_item(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.economy_grant_item(uuid, text, text) TO service_role;

-- Grants consumables (p_amount > 0). Answers {status: granted | duplicate | no_account | bad_kind | bad_reason, count}.
CREATE OR REPLACE FUNCTION public.economy_grant_consumable(
  p_user_id uuid, p_kind text, p_amount integer, p_reason text, p_ref_kind text, p_ref_id text, p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v jsonb;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'economy_grant_consumable: amount must be positive';
  END IF;
  v := economy.post_consumable(p_user_id, p_kind, p_amount, p_reason, p_ref_kind, p_ref_id, p_key);
  IF v ->> 'status' = 'ok' THEN v := jsonb_set(v, '{status}', '"granted"'); END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.economy_grant_consumable(uuid, text, integer, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.economy_grant_consumable(uuid, text, integer, text, text, text, text) TO service_role;

-- Uses consumables (p_amount > 0), for the features that spend them (tickets in wave 4). Answers {status: used |
-- duplicate | insufficient | no_account | bad_kind | bad_reason, count}.
CREATE OR REPLACE FUNCTION public.economy_use_consumable(
  p_user_id uuid, p_kind text, p_amount integer, p_reason text, p_ref_kind text, p_ref_id text, p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v jsonb;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'economy_use_consumable: amount must be positive';
  END IF;
  IF NOT economy.active_account(p_user_id) THEN
    RETURN jsonb_build_object('status', 'no_account');
  END IF;
  v := economy.post_consumable(p_user_id, p_kind, -p_amount, p_reason, p_ref_kind, p_ref_id, p_key);
  IF v ->> 'status' = 'ok' THEN v := jsonb_set(v, '{status}', '"used"'); END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.economy_use_consumable(uuid, text, integer, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.economy_use_consumable(uuid, text, integer, text, text, text, text) TO service_role;

-- Equips an owned item in a slot, or (p_item_id null) empties the slot back to its default. The server has checked
-- the slot's name against src/lib/economy/slots.ts; here the database checks the account, the item, that it fits the
-- slot (its catalogue slot; a reaction fits any reaction-<n>) and that it is owned. An item sits in one slot at a
-- time. Answers equipped | unequipped | no_account | unknown_item | wrong_slot | not_owned.
CREATE OR REPLACE FUNCTION public.economy_equip(p_user_id uuid, p_slot text, p_item_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_slot text;
BEGIN
  IF NOT economy.active_account(p_user_id) THEN
    RETURN 'no_account';
  END IF;
  IF p_item_id IS NULL THEN
    DELETE FROM public.loadout_slots WHERE user_id = p_user_id AND slot = p_slot;
    RETURN 'unequipped';
  END IF;
  SELECT slot INTO v_slot FROM public.catalogue_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RETURN 'unknown_item';
  END IF;
  IF NOT (v_slot = p_slot OR (v_slot = 'reaction' AND p_slot ~ '^reaction-[1-9]$')) THEN
    RETURN 'wrong_slot';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.inventory_items WHERE user_id = p_user_id AND item_id = p_item_id) THEN
    RETURN 'not_owned';
  END IF;
  DELETE FROM public.loadout_slots WHERE user_id = p_user_id AND item_id = p_item_id AND slot <> p_slot;
  INSERT INTO public.loadout_slots (user_id, slot, item_id) VALUES (p_user_id, p_slot, p_item_id)
  ON CONFLICT (user_id, slot) DO UPDATE SET item_id = EXCLUDED.item_id, equipped_at = now();
  RETURN 'equipped';
END;
$$;
REVOKE ALL ON FUNCTION public.economy_equip(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.economy_equip(uuid, text, text) TO service_role;

-- Sets the avatar, its main colour (the profile's colour, one of the 32), its accent, feature, accessory and
-- background (null: the avatar's default; otherwise one of that avatar's options in public.avatar_options) and the gem
-- (null for none; only an unlocked one). Every field is set at once, so changing avatar never keeps another avatar's
-- options. Answers set | no_account | bad_avatar | bad_colour | bad_option | gem_locked.
CREATE OR REPLACE FUNCTION public.economy_set_avatar(
  p_user_id uuid, p_avatar_id text, p_colour smallint, p_accent text, p_feature text, p_accessory text,
  p_background text, p_gem text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
BEGIN
  IF NOT economy.active_account(p_user_id) THEN
    RETURN 'no_account';
  END IF;
  -- Every avatar has its option rows (its accent at least), so an avatar without any is not one of the 32.
  IF p_avatar_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.avatar_options WHERE avatar_id = p_avatar_id) THEN
    RETURN 'bad_avatar';
  END IF;
  IF p_colour IS NULL OR p_colour < 0 OR p_colour > 31 THEN
    RETURN 'bad_colour';
  END IF;
  IF (p_accent IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.avatar_options
        WHERE avatar_id = p_avatar_id AND kind = 'accent' AND option_id = p_accent))
     OR (p_feature IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.avatar_options
        WHERE avatar_id = p_avatar_id AND kind = 'feature' AND option_id = p_feature))
     OR (p_accessory IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.avatar_options
        WHERE avatar_id = p_avatar_id AND kind = 'accessory' AND option_id = p_accessory))
     OR (p_background IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.avatar_options
        WHERE avatar_id = p_avatar_id AND kind = 'background' AND option_id = p_background)) THEN
    RETURN 'bad_option';
  END IF;
  IF p_gem IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.gem_unlocks WHERE user_id = p_user_id AND gem = p_gem) THEN
    RETURN 'gem_locked';
  END IF;
  BEGIN
    INSERT INTO public.loadouts (user_id, avatar_id, accent, feature, accessory, background, gem, updated_at)
    VALUES (p_user_id, p_avatar_id, p_accent, p_feature, p_accessory, p_background, p_gem, now())
    ON CONFLICT (user_id) DO UPDATE
      SET avatar_id = EXCLUDED.avatar_id, accent = EXCLUDED.accent, feature = EXCLUDED.feature,
          accessory = EXCLUDED.accessory, background = EXCLUDED.background, gem = EXCLUDED.gem, updated_at = now();
  EXCEPTION
    WHEN check_violation OR not_null_violation THEN RETURN 'bad_avatar';
    WHEN foreign_key_violation THEN RETURN 'gem_locked';
  END;
  UPDATE public.profiles SET colour = p_colour WHERE user_id = p_user_id AND colour IS DISTINCT FROM p_colour;
  RETURN 'set';
END;
$$;
REVOKE ALL ON FUNCTION public.economy_set_avatar(uuid, text, smallint, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.economy_set_avatar(uuid, text, smallint, text, text, text, text, text) TO service_role;

-- What anyone may see of up to 100 accounts: username, colour, player number, founding, the avatar with its options
-- and gem, and the equipped card art, frame and name colour (null: the default). Accounts waiting for deletion and guests are not
-- returned (the server shows them the default card).
CREATE OR REPLACE FUNCTION public.economy_public_cards(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, username text, colour smallint, player_number integer, founding boolean,
               avatar_id text, accent text, feature text, accessory text, background text, gem text,
               card_art text, frame text, name_colour text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.username, p.colour, p.player_number, p.founding,
         coalesce(l.avatar_id, 'captain-joulz'), l.accent, l.feature, l.accessory, l.background, l.gem,
         (SELECT s.item_id FROM public.loadout_slots s WHERE s.user_id = p.user_id AND s.slot = 'card-art'),
         (SELECT s.item_id FROM public.loadout_slots s WHERE s.user_id = p.user_id AND s.slot = 'frame'),
         (SELECT s.item_id FROM public.loadout_slots s WHERE s.user_id = p.user_id AND s.slot = 'name-colour')
    FROM public.profiles p
    LEFT JOIN public.loadouts l ON l.user_id = p.user_id
   WHERE p.user_id = ANY (p_user_ids[1:100]) AND p.deletion_requested_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.economy_public_cards(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.economy_public_cards(uuid[]) TO authenticated, service_role;

/* ------------------------------------------------------------------ every new account */

-- A new profile (sign-up) gets its wallet, its loadout and the starter items (the free card arts and the Plain frame:
-- every catalogue item whose source is free-starter), with one item_granted event each.
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
    SELECT NEW.user_id, c.id, 'starter' FROM public.catalogue_items c WHERE c.source = 'free-starter'
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

DROP TRIGGER IF EXISTS economy_new_profile ON public.profiles;
CREATE TRIGGER economy_new_profile AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION economy.on_new_profile();

/* ------------------------------------------------------------------ Joe's tools (dashboard only) */

-- Every admin change: who (the session's database user), what, when, about whom, and the note.
CREATE TABLE IF NOT EXISTS economy.admin_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  user_id uuid,
  detail jsonb,
  note text NOT NULL,
  by_role text NOT NULL DEFAULT session_user
);
CREATE INDEX IF NOT EXISTS economy_admin_log_user_idx ON economy.admin_log (user_id, at DESC);
ALTER TABLE economy.admin_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON economy.admin_log FROM PUBLIC, anon, authenticated, service_role;

-- A removed account's log lines keep what was done but no longer name it.
CREATE OR REPLACE FUNCTION economy.forget_removed_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
BEGIN
  UPDATE economy.admin_log SET user_id = NULL WHERE user_id = OLD.user_id;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION economy.forget_removed_profile() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS economy_forget_removed_profile ON public.profiles;
CREATE TRIGGER economy_forget_removed_profile AFTER DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION economy.forget_removed_profile();

-- An account named in one of Joe's calls: its username (any capitals) or its user id.
CREATE OR REPLACE FUNCTION economy.account(p_player text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_player ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT user_id INTO v_id FROM public.profiles WHERE user_id = p_player::uuid;
  ELSE
    SELECT user_id INTO v_id FROM public.profiles WHERE username_key = lower(trim(p_player));
  END IF;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'economy: no account %: guests have no coins or items', p_player;
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION economy.account(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION economy.log(p_action text, p_user_id uuid, p_detail jsonb, p_note text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_id bigint;
BEGIN
  IF coalesce(trim(p_note), '') = '' THEN
    RAISE EXCEPTION 'economy.%: give a note (why)', p_action;
  END IF;
  INSERT INTO economy.admin_log (action, user_id, detail, note) VALUES (p_action, p_user_id, p_detail, p_note)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION economy.log(text, uuid, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;

-- Credits coins (p_amount > 0), with a reason (admin_adjustment unless given, e.g. a missed signup_reward).
--   SELECT economy.grant_coins('Username', 500, 'make-good for the outage on 12 Nov');
CREATE OR REPLACE FUNCTION economy.grant_coins(p_player text, p_amount integer, p_note text,
                                               p_reason text DEFAULT 'admin_adjustment')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_user uuid := economy.account(p_player);
  v_log bigint;
  v jsonb;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'economy.grant_coins: amount must be positive (use economy.adjust_coins to take coins away)';
  END IF;
  v_log := economy.log('grant_coins', v_user, jsonb_build_object('amount', p_amount, 'reason', p_reason), p_note);
  v := economy.post_coins(v_user, p_amount, p_reason, 'admin', v_log::text, 'admin:' || v_log);
  IF v ->> 'status' <> 'ok' THEN
    RAISE EXCEPTION 'economy.grant_coins: %', v ->> 'status';
  END IF;
  UPDATE economy.admin_log SET detail = detail || jsonb_build_object('line_id', v -> 'line_id', 'balance', v -> 'balance')
   WHERE id = v_log;
  PERFORM economy.note_event('coins_credited', v_user, jsonb_build_object('reason', p_reason, 'amount', p_amount));
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION economy.grant_coins(text, integer, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Moves coins up or down (reason admin_adjustment); never below zero.
--   SELECT economy.adjust_coins('Username', -200, 'duplicate grant on 12 Nov');
CREATE OR REPLACE FUNCTION economy.adjust_coins(p_player text, p_amount integer, p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_user uuid := economy.account(p_player);
  v_log bigint;
  v jsonb;
BEGIN
  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'economy.adjust_coins: amount must be non-zero';
  END IF;
  v_log := economy.log('adjust_coins', v_user, jsonb_build_object('amount', p_amount), p_note);
  v := economy.post_coins(v_user, p_amount, 'admin_adjustment', 'admin', v_log::text, 'admin:' || v_log);
  IF v ->> 'status' <> 'ok' THEN
    RAISE EXCEPTION 'economy.adjust_coins: % (balance %)', v ->> 'status', v ->> 'balance';
  END IF;
  UPDATE economy.admin_log SET detail = detail || jsonb_build_object('line_id', v -> 'line_id', 'balance', v -> 'balance')
   WHERE id = v_log;
  PERFORM economy.note_event(CASE WHEN p_amount > 0 THEN 'coins_credited' ELSE 'coins_spent' END, v_user,
                             jsonb_build_object('reason', 'admin_adjustment', 'amount', abs(p_amount)));
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION economy.adjust_coins(text, integer, text) FROM PUBLIC, anon, authenticated, service_role;

-- Gives an item (how = 'grant').
--   SELECT economy.grant_item('Username', 'frame.gold', 'competition prize');
CREATE OR REPLACE FUNCTION economy.grant_item(p_player text, p_item_id text, p_note text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_user uuid := economy.account(p_player);
  v_status text;
BEGIN
  PERFORM economy.log('grant_item', v_user, jsonb_build_object('item', p_item_id), p_note);
  v_status := economy.add_item(v_user, p_item_id, 'grant');
  IF v_status = 'unknown_item' THEN
    RAISE EXCEPTION 'economy.grant_item: no item %', p_item_id;
  END IF;
  IF v_status = 'granted' THEN
    PERFORM economy.note_event('item_granted', v_user,
      (SELECT jsonb_build_object('kind', kind, 'rarity', rarity, 'source', source) FROM public.catalogue_items
        WHERE id = p_item_id));
  END IF;
  RETURN v_status;
END;
$$;
REVOKE ALL ON FUNCTION economy.grant_item(text, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Takes an item away (and out of its slot). Starter items can't be removed. Coins spent on it are not given back:
-- refund the line with public.economy_refund from the server, or economy.grant_coins.
--   SELECT economy.remove_item('Username', 'frame.gold', 'granted by mistake');
CREATE OR REPLACE FUNCTION economy.remove_item(p_player text, p_item_id text, p_note text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_user uuid := economy.account(p_player);
  v_row public.inventory_items%ROWTYPE;
BEGIN
  IF EXISTS (SELECT 1 FROM public.catalogue_items WHERE id = p_item_id AND source = 'free-starter') THEN
    RAISE EXCEPTION 'economy.remove_item: % is a starter item every account owns', p_item_id;
  END IF;
  DELETE FROM public.inventory_items WHERE user_id = v_user AND item_id = p_item_id RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RETURN 'not_owned';
  END IF;
  PERFORM economy.log('remove_item', v_user,
    jsonb_build_object('item', p_item_id, 'how', v_row.how, 'ledger_id', v_row.ledger_id), p_note);
  RETURN 'removed';
END;
$$;
REVOKE ALL ON FUNCTION economy.remove_item(text, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Gives (or, with a negative count, takes) consumables; never below zero.
--   SELECT economy.grant_consumable('Username', 'streak_freeze', 2, 'lost streak in the outage');
CREATE OR REPLACE FUNCTION economy.grant_consumable(p_player text, p_kind text, p_count integer, p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_user uuid := economy.account(p_player);
  v_log bigint;
  v jsonb;
BEGIN
  IF p_count IS NULL OR p_count = 0 THEN
    RAISE EXCEPTION 'economy.grant_consumable: count must be non-zero';
  END IF;
  v_log := economy.log('grant_consumable', v_user, jsonb_build_object('kind', p_kind, 'count', p_count), p_note);
  v := economy.post_consumable(v_user, p_kind, p_count, 'admin_adjustment', 'admin', v_log::text, 'admin:' || v_log);
  IF v ->> 'status' <> 'ok' THEN
    RAISE EXCEPTION 'economy.grant_consumable: % (count %)', v ->> 'status', v ->> 'count';
  END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION economy.grant_consumable(text, text, integer, text) FROM PUBLIC, anon, authenticated, service_role;

-- One account at a glance: balance, consumables, items and the latest coin lines.
--   SELECT economy.account_summary('Username');
CREATE OR REPLACE FUNCTION economy.account_summary(p_player text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, economy
AS $$
  WITH a AS (SELECT economy.account(p_player) AS id)
  SELECT jsonb_build_object(
    'user_id', a.id,
    'balance', (SELECT balance FROM public.coin_wallets WHERE user_id = a.id),
    'ledger_sum', (SELECT coalesce(sum(amount), 0) FROM public.coin_ledger WHERE user_id = a.id),
    'consumables', (SELECT coalesce(jsonb_object_agg(kind, count), '{}'::jsonb) FROM public.consumable_balances WHERE user_id = a.id),
    'items', (SELECT coalesce(jsonb_agg(item_id ORDER BY item_id), '[]'::jsonb) FROM public.inventory_items WHERE user_id = a.id),
    'latest_lines', (SELECT coalesce(jsonb_agg(l ORDER BY l.id DESC), '[]'::jsonb) FROM (
        SELECT id, amount, reason, ref_kind, ref_id, balance_after, created_at FROM public.coin_ledger
         WHERE user_id = a.id ORDER BY id DESC LIMIT 20) l))
  FROM a;
$$;
REVOKE ALL ON FUNCTION economy.account_summary(text) FROM PUBLIC, anon, authenticated, service_role;
