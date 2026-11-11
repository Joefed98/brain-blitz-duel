-- Badges, titles and the account rewards (wave 2, train C, session C2; 11 Nov 2026; docs/badges/README.md).
-- Additive and idempotent: new tables, functions and reference rows, two new economy reasons' worth of rows, and
-- widened analytics events. No existing table, column or row is changed; the backfill only adds ledger lines,
-- badges and items through the economy's own writers, each under an idempotency key, so a second run adds nothing.
--
-- What it adds:
--   * public.badges (the 54 of docs/art/badges/badges.json; src/lib/badges/catalogue.ts holds the same list) and
--     public.titles (Rookie and the badge titles), readable by anyone;
--   * public.player_badges (what each account has earned, once each), public.card_badges (up to three on the card,
--     only earned ones) and public.card_titles (one title, only an unlocked one; no row = Rookie);
--   * public.daily_streak_freezes (the missed UK days a streak freeze covered, one per day) and the reason
--     streak_freeze_used for the consumable line;
--   * the service-role functions public.badge_award, badge_set_card, badge_set_title, badge_mark_seen,
--     daily_streak_freeze, and public.badge_public_cards for any signed-in device;
--   * the backfill: every existing account's sign-up reward (1,000 coins, key signup_reward:<user id>) and, for
--     Founding Players, the Founding Player badge with their number, its 250 coins (key badge_reward:founding-player)
--     and the Founding frame (frame.founding, how 'earned'). New accounts get the same from the server
--     (src/lib/badges/badges.server.ts settleAccountRewards), under the same keys, so nothing is ever paid twice.
--
-- Who can write: nobody through the API (anon, authenticated and the service role have no INSERT, UPDATE or DELETE on
-- any of these tables); the server writes only through the functions below, and anon / authenticated can't run them.

CREATE SCHEMA IF NOT EXISTS economy;

/* ------------------------------------------------------------------ reference lists */

CREATE TABLE IF NOT EXISTS public.badges (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z][a-z0-9-]{1,39}$'),
  name text NOT NULL,
  grp text NOT NULL CHECK (grp IN ('competitive', 'mastery', 'daily-and-tournaments', 'challenges', 'fun', 'social-and-special')),
  rarity text NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'elite', 'legendary')),
  coins integer NOT NULL,
  -- earnable: the server checks its rule now; waits: needs a later wave; rule_pending: no rule supplied yet.
  status text NOT NULL CHECK (status IN ('earnable', 'waits', 'rule_pending')),
  waits_for text CHECK (waits_for IN ('rated-play', 'tournaments', 'mastery-stars', 'practice-challenges')),
  rule text,
  sort_order integer NOT NULL UNIQUE,
  CONSTRAINT badges_legendary_coins CHECK (coins = CASE WHEN rarity = 'legendary' THEN 250 ELSE 0 END),
  CONSTRAINT badges_waits CHECK ((status = 'waits') = (waits_for IS NOT NULL)),
  CONSTRAINT badges_earnable_rule CHECK (status <> 'earnable' OR rule IS NOT NULL)
);
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.badges FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.badges TO anon, authenticated, service_role;
DROP POLICY IF EXISTS badges_read ON public.badges;
CREATE POLICY badges_read ON public.badges FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.titles (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('starter', 'badge', 'season', 'pass')),
  badge text REFERENCES public.badges (slug),
  sort_order integer NOT NULL UNIQUE,
  CONSTRAINT titles_badge CHECK ((kind = 'badge') = (badge IS NOT NULL))
);
ALTER TABLE public.titles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.titles FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.titles TO anon, authenticated, service_role;
DROP POLICY IF EXISTS titles_read ON public.titles;
CREATE POLICY titles_read ON public.titles FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.badges (slug, name, grp, rarity, coins, status, waits_for, rule, sort_order) VALUES
  ('first-win', 'First Win', 'competitive', 'common', 0, 'rule_pending', NULL, NULL, 1),
  ('placed', 'Placed', 'competitive', 'common', 0, 'rule_pending', NULL, NULL, 2),
  ('hot-streak', 'Hot Streak', 'competitive', 'rare', 0, 'rule_pending', NULL, NULL, 3),
  ('comeback-kid', 'Comeback Kid', 'competitive', 'rare', 0, 'rule_pending', NULL, NULL, 4),
  ('clean-sweep', 'Clean Sweep', 'competitive', 'epic', 0, 'rule_pending', NULL, NULL, 5),
  ('podium-regular', 'Podium Regular', 'competitive', 'epic', 0, 'rule_pending', NULL, NULL, 6),
  ('unstoppable', 'Unstoppable', 'competitive', 'elite', 0, 'rule_pending', NULL, NULL, 7),
  ('giant-slayer', 'Giant Slayer', 'competitive', 'elite', 0, 'rule_pending', NULL, NULL, 8),
  ('storm-chaser', 'Storm Chaser', 'competitive', 'elite', 0, 'waits', 'rated-play', NULL, 9),
  ('lightning-strikes', 'Lightning Strikes', 'competitive', 'legendary', 250, 'waits', 'rated-play', NULL, 10),
  ('top-500', 'Top 500', 'competitive', 'legendary', 250, 'waits', 'rated-play', NULL, 11),
  ('first-star', 'First Star', 'mastery', 'common', 0, 'waits', 'mastery-stars', NULL, 12),
  ('flawless', 'Flawless', 'mastery', 'rare', 0, 'rule_pending', NULL, NULL, 13),
  ('all-rounder', 'All-Rounder', 'mastery', 'rare', 0, 'waits', 'mastery-stars', NULL, 14),
  ('logic-master', 'Logic Master', 'mastery', 'epic', 0, 'waits', 'mastery-stars', NULL, 15),
  ('word-master', 'Word Master', 'mastery', 'epic', 0, 'waits', 'mastery-stars', NULL, 16),
  ('number-master', 'Number Master', 'mastery', 'epic', 0, 'waits', 'mastery-stars', NULL, 17),
  ('pattern-master', 'Pattern Master', 'mastery', 'epic', 0, 'waits', 'mastery-stars', NULL, 18),
  ('speed-master', 'Speed Master', 'mastery', 'epic', 0, 'waits', 'mastery-stars', NULL, 19),
  ('attention-master', 'Attention Master', 'mastery', 'epic', 0, 'waits', 'mastery-stars', NULL, 20),
  ('action-master', 'Action Master', 'mastery', 'epic', 0, 'waits', 'mastery-stars', NULL, 21),
  ('retro-master', 'Retro Master', 'mastery', 'epic', 0, 'waits', 'mastery-stars', NULL, 22),
  ('sports-master', 'Sports Master', 'mastery', 'epic', 0, 'waits', 'mastery-stars', NULL, 23),
  ('cards-master', 'Cards Master', 'mastery', 'epic', 0, 'waits', 'mastery-stars', NULL, 24),
  ('strategy-master', 'Strategy Master', 'mastery', 'epic', 0, 'waits', 'mastery-stars', NULL, 25),
  ('perfectionist', 'Perfectionist', 'mastery', 'elite', 0, 'rule_pending', NULL, NULL, 26),
  ('grand-master', 'Grand Master', 'mastery', 'legendary', 250, 'waits', 'mastery-stars', NULL, 27),
  ('daily-habit', 'Daily Habit', 'daily-and-tournaments', 'common', 0, 'rule_pending', NULL, NULL, 28),
  ('dedicated', 'Dedicated', 'daily-and-tournaments', 'rare', 0, 'rule_pending', NULL, NULL, 29),
  ('daily-top-100', 'Daily Top 100', 'daily-and-tournaments', 'rare', 0, 'rule_pending', NULL, NULL, 30),
  ('century', 'Century', 'daily-and-tournaments', 'elite', 0, 'rule_pending', NULL, NULL, 31),
  ('daily-champion', 'Daily Champion', 'daily-and-tournaments', 'legendary', 250, 'rule_pending', NULL, NULL, 32),
  ('entrant', 'Entrant', 'daily-and-tournaments', 'common', 0, 'waits', 'tournaments', NULL, 33),
  ('trophy-hunter', 'Trophy Hunter', 'daily-and-tournaments', 'rare', 0, 'waits', 'tournaments', NULL, 34),
  ('arena-ace', 'Arena Ace', 'daily-and-tournaments', 'epic', 0, 'waits', 'tournaments', NULL, 35),
  ('champion', 'Champion', 'daily-and-tournaments', 'epic', 0, 'waits', 'tournaments', NULL, 36),
  ('arena-champion', 'Arena Champion', 'daily-and-tournaments', 'elite', 0, 'waits', 'tournaments', NULL, 37),
  ('score-attack-champion', 'Score Attack Champion', 'daily-and-tournaments', 'elite', 0, 'waits', 'tournaments', NULL, 38),
  ('swiss-champion', 'Swiss Champion', 'daily-and-tournaments', 'elite', 0, 'waits', 'tournaments', NULL, 39),
  ('knockout-champion', 'Knockout Champion', 'daily-and-tournaments', 'legendary', 250, 'waits', 'tournaments', NULL, 40),
  ('serial-winner', 'Serial Winner', 'daily-and-tournaments', 'legendary', 250, 'waits', 'tournaments', NULL, 41),
  ('challenger', 'Challenger', 'challenges', 'common', 0, 'waits', 'practice-challenges', NULL, 42),
  ('challenge-seeker', 'Challenge Seeker', 'challenges', 'rare', 0, 'waits', 'practice-challenges', NULL, 43),
  ('challenge-expert', 'Challenge Expert', 'challenges', 'epic', 0, 'waits', 'practice-challenges', NULL, 44),
  ('category-clear', 'Category Clear', 'challenges', 'elite', 0, 'waits', 'practice-challenges', NULL, 45),
  ('completionist', 'Completionist', 'challenges', 'legendary', 250, 'waits', 'practice-challenges', NULL, 46),
  ('revenge', 'Revenge', 'fun', 'common', 0, 'rule_pending', NULL, NULL, 47),
  ('photo-finish', 'Photo Finish', 'fun', 'rare', 0, 'rule_pending', NULL, NULL, 48),
  ('buzzer-beater', 'Buzzer Beater', 'fun', 'rare', 0, 'rule_pending', NULL, NULL, 49),
  ('speed-demon', 'Speed Demon', 'fun', 'epic', 0, 'rule_pending', NULL, NULL, 50),
  ('friendly', 'Friendly', 'social-and-special', 'common', 0, 'rule_pending', NULL, NULL, 51),
  ('party-host', 'Party Host', 'social-and-special', 'rare', 0, 'rule_pending', NULL, NULL, 52),
  ('gem-hunter', 'Gem Hunter', 'social-and-special', 'rare', 0, 'rule_pending', NULL, NULL, 53),
  ('founding-player', 'Founding Player', 'social-and-special', 'legendary', 250, 'earnable', NULL, 'Make an account before 26 January 2027.', 54)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.titles (id, name, kind, badge, sort_order) VALUES
  ('rookie', 'Rookie', 'starter', NULL, 1),
  ('grand-master', 'Grand Master', 'badge', 'grand-master', 2),
  ('top-500', 'Top 500', 'badge', 'top-500', 3),
  ('daily-champion', 'Daily Champion', 'badge', 'daily-champion', 4),
  ('knockout-champion', 'Knockout Champion', 'badge', 'knockout-champion', 5),
  ('serial-winner', 'Serial Winner', 'badge', 'serial-winner', 6),
  ('completionist', 'Completionist', 'badge', 'completionist', 7),
  ('lightning', 'Lightning', 'badge', 'lightning-strikes', 8),
  ('founding-player', 'Founding Player', 'badge', 'founding-player', 9),
  ('unstoppable', 'Unstoppable', 'badge', 'unstoppable', 10),
  ('giant-slayer', 'Giant Slayer', 'badge', 'giant-slayer', 11),
  ('perfectionist', 'Perfectionist', 'badge', 'perfectionist', 12),
  ('century', 'Century', 'badge', 'century', 13),
  ('storm-chaser', 'Storm Chaser', 'badge', 'storm-chaser', 14),
  ('comeback-kid', 'Comeback Kid', 'badge', 'comeback-kid', 15),
  ('clean-sweeper', 'Clean Sweeper', 'badge', 'clean-sweep', 16),
  ('speed-demon', 'Speed Demon', 'badge', 'speed-demon', 17),
  ('podium-regular', 'Podium Regular', 'badge', 'podium-regular', 18),
  ('logician', 'Logician', 'badge', 'logic-master', 19),
  ('wordsmith', 'Wordsmith', 'badge', 'word-master', 20),
  ('number-cruncher', 'Number Cruncher', 'badge', 'number-master', 21),
  ('pattern-seeker', 'Pattern Seeker', 'badge', 'pattern-master', 22),
  ('speedster', 'Speedster', 'badge', 'speed-master', 23),
  ('sharp-eye', 'Sharp Eye', 'badge', 'attention-master', 24),
  ('action-hero', 'Action Hero', 'badge', 'action-master', 25),
  ('retro-legend', 'Retro Legend', 'badge', 'retro-master', 26),
  ('sports-star', 'Sports Star', 'badge', 'sports-master', 27),
  ('card-shark', 'Card Shark', 'badge', 'cards-master', 28),
  ('strategist', 'Strategist', 'badge', 'strategy-master', 29),
  ('photo-finisher', 'Photo Finisher', 'badge', 'photo-finish', 30),
  ('buzzer-beater', 'Buzzer Beater', 'badge', 'buzzer-beater', 31),
  ('avenger', 'Avenger', 'badge', 'revenge', 32)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.economy_reasons (reason, note) VALUES
  ('streak_freeze_used', 'a streak freeze covered a missed Daily (C2)')
ON CONFLICT (reason) DO NOTHING;

/* ------------------------------------------------------------------ per-account tables */

CREATE TABLE IF NOT EXISTS public.player_badges (
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  badge text NOT NULL REFERENCES public.badges (slug),
  earned_at timestamptz NOT NULL DEFAULT now(),
  -- What the badge carries (the Founding Player's {"number": 42}); fixed words and numbers only.
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- When the phone showed the badge-earned moment (null: not yet).
  seen_at timestamptz,
  PRIMARY KEY (user_id, badge)
);

CREATE TABLE IF NOT EXISTS public.card_badges (
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 3),
  badge text NOT NULL,
  PRIMARY KEY (user_id, position),
  CONSTRAINT card_badges_once UNIQUE (user_id, badge),
  CONSTRAINT card_badges_earned FOREIGN KEY (user_id, badge)
    REFERENCES public.player_badges (user_id, badge) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.card_titles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  title text NOT NULL REFERENCES public.titles (id),
  equipped_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_streak_freezes (
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  day date NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now(),
  consumable_line bigint,
  PRIMARY KEY (user_id, day)
);

DO $own$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['player_badges', 'card_badges', 'card_titles', 'daily_streak_freezes'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, service_role', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated, service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read_own', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (user_id = auth.uid())',
                   t || '_read_own', t);
  END LOOP;
END
$own$;

/* ------------------------------------------------------------------ analytics: badge_earned, title_equipped */

-- src/lib/analytics/events.ts ANALYTICS_EVENTS holds the same list. badge_earned carries props.badge and
-- props.rarity; title_equipped props.title. The list is read from the constraint as it stands (as A2's migration did),
-- so events other migrations added are kept whatever the order.
DO $events$
DECLARE
  existing text[];
  wanted text[];
BEGIN
  IF to_regclass('analytics.events') IS NULL THEN
    RETURN;
  END IF;
  SELECT coalesce(array_agg(DISTINCT m[1]), ARRAY[]::text[])
    INTO existing
    FROM pg_constraint c,
         LATERAL regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''', 'g') AS m
   WHERE c.conrelid = 'analytics.events'::regclass AND c.conname = 'events_event_check';
  SELECT array_agg(e ORDER BY e) INTO wanted
    FROM (SELECT unnest(existing) AS e UNION SELECT unnest(ARRAY['badge_earned', 'title_equipped'])) AS u;
  ALTER TABLE analytics.events DROP CONSTRAINT IF EXISTS events_event_check;
  EXECUTE format(
    'ALTER TABLE analytics.events ADD CONSTRAINT events_event_check CHECK (event IN (%s)) NOT VALID',
    (SELECT string_agg(quote_literal(e), ', ') FROM unnest(wanted) AS e)
  );
  ALTER TABLE analytics.events VALIDATE CONSTRAINT events_event_check;
END
$events$;

/* ------------------------------------------------------------------ the server's functions (service role only) */

-- Awards a badge once. Only an earnable badge (its rule is checked by the server before it calls this). A Legendary
-- pays 250 coins once (reason badge_reward, key badge_reward:<slug>), in the same transaction; asked again for an
-- owned Legendary it re-posts under the same key, which answers duplicate, so a lost payment is mended and never doubled.
-- Answers {status: awarded | owned | no_account | unknown_badge | not_earnable, coins: <post_coins answer> | null}.
CREATE OR REPLACE FUNCTION public.badge_award(p_user_id uuid, p_badge text, p_detail jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_badge public.badges%ROWTYPE;
  v_n integer;
  v_coins jsonb;
BEGIN
  SELECT * INTO v_badge FROM public.badges WHERE slug = p_badge;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'unknown_badge');
  END IF;
  IF v_badge.status <> 'earnable' THEN
    RETURN jsonb_build_object('status', 'not_earnable');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RETURN jsonb_build_object('status', 'no_account');
  END IF;
  INSERT INTO public.player_badges (user_id, badge, detail)
  VALUES (p_user_id, p_badge, coalesce(p_detail, '{}'::jsonb))
  ON CONFLICT (user_id, badge) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_badge.coins > 0 THEN
    v_coins := economy.post_coins(p_user_id, v_badge.coins, 'badge_reward', 'badge', p_badge, 'badge_reward:' || p_badge);
  END IF;
  RETURN jsonb_build_object('status', CASE WHEN v_n = 1 THEN 'awarded' ELSE 'owned' END, 'coins', v_coins);
END;
$$;
REVOKE ALL ON FUNCTION public.badge_award(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.badge_award(uuid, text, jsonb) TO service_role;

-- Sets the card's badges (0 to 3, in order, each earned, none twice). Answers set | no_account | too_many | duplicate |
-- not_earned.
CREATE OR REPLACE FUNCTION public.badge_set_card(p_user_id uuid, p_badges text[])
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_list text[] := coalesce(p_badges, ARRAY[]::text[]);
  i integer;
BEGIN
  IF NOT economy.active_account(p_user_id) THEN
    RETURN 'no_account';
  END IF;
  IF cardinality(v_list) > 3 THEN
    RETURN 'too_many';
  END IF;
  IF (SELECT count(DISTINCT b) FROM unnest(v_list) AS b) <> cardinality(v_list) THEN
    RETURN 'duplicate';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_list) AS b
              WHERE NOT EXISTS (SELECT 1 FROM public.player_badges pb WHERE pb.user_id = p_user_id AND pb.badge = b)) THEN
    RETURN 'not_earned';
  END IF;
  PERFORM 1 FROM public.profiles WHERE user_id = p_user_id FOR UPDATE;
  DELETE FROM public.card_badges WHERE user_id = p_user_id;
  FOR i IN 1 .. cardinality(v_list) LOOP
    INSERT INTO public.card_badges (user_id, position, badge) VALUES (p_user_id, i, v_list[i]);
  END LOOP;
  RETURN 'set';
END;
$$;
REVOKE ALL ON FUNCTION public.badge_set_card(uuid, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.badge_set_card(uuid, text[]) TO service_role;

-- Sets the title: Rookie (or null) always; a badge title only with its badge earned. Answers set | unchanged |
-- no_account | unknown_title | not_earned.
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
  IF v_title.kind IN ('season', 'pass') THEN
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

-- Marks badges as shown (the badge-earned moment). Answers how many changed.
CREATE OR REPLACE FUNCTION public.badge_mark_seen(p_user_id uuid, p_badges text[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.player_badges SET seen_at = now()
   WHERE user_id = p_user_id AND badge = ANY (coalesce(p_badges, ARRAY[]::text[])) AND seen_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.badge_mark_seen(uuid, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.badge_mark_seen(uuid, text[]) TO service_role;

-- What any signed-in device may see of up to 100 accounts' cards: the badges on the card (in order, with the
-- Founding Player's number) and the title (null: Rookie). Accounts waiting for deletion and guests are left out.
CREATE OR REPLACE FUNCTION public.badge_public_cards(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, badges text[], title text, founding_number integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id,
         coalesce((SELECT array_agg(c.badge ORDER BY c.position) FROM public.card_badges c WHERE c.user_id = p.user_id),
                  ARRAY[]::text[]),
         (SELECT t.title FROM public.card_titles t WHERE t.user_id = p.user_id),
         (SELECT (pb.detail ->> 'number')::integer FROM public.player_badges pb
           WHERE pb.user_id = p.user_id AND pb.badge = 'founding-player')
    FROM public.profiles p
   WHERE p.user_id = ANY (p_user_ids[1:100]) AND p.deletion_requested_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.badge_public_cards(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.badge_public_cards(uuid[]) TO authenticated, service_role;

-- Uses one streak freeze to cover a missed UK day of the Daily (a closed day: before today in the UK), once per day:
-- the consumable line (reason streak_freeze_used, key streak_freeze:<day>) and the day's row in one transaction.
-- Answers {status: used | duplicate | insufficient | no_account | open_day, count}.
CREATE OR REPLACE FUNCTION public.daily_streak_freeze(p_user_id uuid, p_day date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v jsonb;
BEGIN
  IF p_day IS NULL OR p_day >= (now() AT TIME ZONE 'Europe/London')::date THEN
    RETURN jsonb_build_object('status', 'open_day');
  END IF;
  IF NOT economy.active_account(p_user_id) THEN
    RETURN jsonb_build_object('status', 'no_account');
  END IF;
  IF EXISTS (SELECT 1 FROM public.daily_streak_freezes WHERE user_id = p_user_id AND day = p_day) THEN
    RETURN jsonb_build_object('status', 'duplicate');
  END IF;
  v := economy.post_consumable(p_user_id, 'streak_freeze', -1, 'streak_freeze_used', 'daily', p_day::text,
                               'streak_freeze:' || p_day::text);
  IF v ->> 'status' IN ('ok', 'duplicate') THEN
    INSERT INTO public.daily_streak_freezes (user_id, day, consumable_line)
    VALUES (p_user_id, p_day, (v ->> 'line_id')::bigint)
    ON CONFLICT (user_id, day) DO NOTHING;
    IF v ->> 'status' = 'ok' THEN v := jsonb_set(v, '{status}', '"used"'); END IF;
  END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.daily_streak_freeze(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daily_streak_freeze(uuid, date) TO service_role;

-- One player's Daily history (the Daily streak on the account): each Daily they started (an attempt exists, the rule
-- dailyRecord.ts kept on the phone: a Daily counts as played once started), its UK day and kind, whether it was
-- finished and its total. The latest 800 (a little over a year of both kinds). Service role only.
CREATE OR REPLACE FUNCTION public.daily_history(p_user_id uuid)
RETURNS TABLE (day date, kind text, finished boolean, total integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.day, r.kind, a.finished_at IS NOT NULL, a.total_score
    FROM public.async_attempts a
    JOIN public.async_rooms r ON r.id = a.room_id
   WHERE a.user_id = p_user_id AND r.kind IN ('daily_puzzle', 'daily_arcade') AND r.day IS NOT NULL
   ORDER BY r.day DESC
   LIMIT 800;
$$;
REVOKE ALL ON FUNCTION public.daily_history(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daily_history(uuid) TO service_role;

/* ------------------------------------------------------------------ the backfill */

-- Every existing account: the sign-up reward (1,000, key signup_reward:<user id>, as the server pays new accounts);
-- every Founding Player (profiles.founding, accounts.is_founding on the creation time): the badge with their number,
-- its 250 coins and the Founding frame. Joe's #0001 included. Each line through the economy's own writers under its
-- key and each event as the server records them; the counts go to the deploy log. A second run adds nothing.
DO $backfill$
DECLARE
  v_p record;
  v jsonb;
  n_accounts integer := 0;
  n_signup integer := 0;
  n_badges integer := 0;
  n_badge_coins integer := 0;
  n_frames integer := 0;
  v_ins integer;
BEGIN
  FOR v_p IN SELECT user_id, founding, player_number FROM public.profiles ORDER BY player_number LOOP
    n_accounts := n_accounts + 1;
    v := economy.post_coins(v_p.user_id, 1000, 'signup_reward', 'account', v_p.user_id::text,
                            'signup_reward:' || v_p.user_id::text);
    IF v ->> 'status' = 'ok' THEN
      n_signup := n_signup + 1;
      PERFORM economy.note_event('coins_credited', v_p.user_id, jsonb_build_object('reason', 'signup_reward', 'amount', 1000));
    END IF;
    IF v_p.founding THEN
      INSERT INTO public.player_badges (user_id, badge, detail)
      VALUES (v_p.user_id, 'founding-player', jsonb_build_object('number', v_p.player_number))
      ON CONFLICT (user_id, badge) DO NOTHING;
      GET DIAGNOSTICS v_ins = ROW_COUNT;
      IF v_ins = 1 THEN
        n_badges := n_badges + 1;
        PERFORM economy.note_event('badge_earned', v_p.user_id, jsonb_build_object('badge', 'founding-player', 'rarity', 'legendary'));
      END IF;
      v := economy.post_coins(v_p.user_id, 250, 'badge_reward', 'badge', 'founding-player', 'badge_reward:founding-player');
      IF v ->> 'status' = 'ok' THEN
        n_badge_coins := n_badge_coins + 1;
        PERFORM economy.note_event('coins_credited', v_p.user_id, jsonb_build_object('reason', 'badge_reward', 'amount', 250));
      END IF;
      IF economy.add_item(v_p.user_id, 'frame.founding', 'earned') = 'granted' THEN
        n_frames := n_frames + 1;
        PERFORM economy.note_event('item_granted', v_p.user_id,
          jsonb_build_object('kind', 'frame', 'rarity', NULL, 'source', 'earned-founding-player'));
      END IF;
    END IF;
  END LOOP;
  PERFORM migration_log.note('notice', format(
    'badges backfill: %s accounts; %s sign-up rewards paid, %s Founding Player badges, %s badge rewards paid, %s Founding frames granted',
    n_accounts, n_signup, n_badges, n_badge_coins, n_frames));
END
$backfill$;
