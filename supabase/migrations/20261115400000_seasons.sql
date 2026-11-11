-- Seasons for ratings: the season end, the reset and the peak-tier rewards (Wave 4, session W4d; 15 Nov 2026;
-- docs/seasons/README.md). Additive and idempotent: new tables and functions, seven rows added to public.titles,
-- seven rows added to public.catalogue_items (the Season 1 frames, docs/art/wave-4/catalogue.json), two rows of season
-- reward sets, and C2 / D2's public.badge_set_title redefined with one rule more (a season title once granted). No
-- existing row or column is changed.
--
-- One season clock: D2's public.pass_seasons is the only list of seasons (Joe's pass.* functions set its dates and
-- length). A rated match counts towards the season the player is in at that moment, by D2's rule: a tester (D1's
-- shop.testers) is in the test season while it runs, everyone else in the live real season.
--
-- What it holds:
--   * public.season_rated_matches: one row per live player per rated match in a season (the tier held after it, and
--     whether placement was done), written only by public.season_note_rated_match, which the ratings engine (W3a's
--     recordRatedMatch) calls once per live player. The season peak, the count of rated matches and "finished
--     placement" are read from these rows.
--   * public.season_closes: each season (and test-season run, keyed by its start) closed, with how many players were
--     rewarded and whether the ratings were reset.
--   * public.season_rewards: each player's reward for a season: the peak tier actually held (a cap-held
--     "Storm-rated" player's peak is Surge), the season emblem's mark ("S1"), the frame, the tier card art and the title. Granted once.
--   * public.season_placement_resets: who was reset at a season's end, so their next placement is 3 matches.
--   * public.season_reward_sets: what each season pays (Season 1 and the testers' season: "S1", frame.s1-<tier>,
--     the title s1-<tier>); a season without a set records the peak and the emblem's mark only.
--
-- The reset: Puzzles, Arcade and the 11 categories each move a third of the way back towards the average of rated
-- players (rated in that rating), and their uncertainty widens a third of the way back towards the starting 350
-- (public.season_reset_rating, the one formula; src/lib/seasons/rules.ts mirrors it), applied to W3a's tables by
-- public.ratings_season_reset: placed players go back into a 3-match placement (rated_profiles.placement_from, one
-- column added), the Joulz Rating and tier hidden until it is done, when the engine works the Joulz Rating out again
-- from the reset pools.
--
-- Who can reach what: anon and authenticated nothing (no grants; RLS on). The server (service role) reads the tables
-- and writes only through public.season_note_rated_match and public.season_reward_seen. Only Joe closes a season and
-- grants its rewards: pass.close_season / pass.close_test_season, in the `pass` schema, unreachable from the app and
-- the API (no role but the owner can run them).

/* ------------------------------------------------------------------ tiers */

-- The tier order (W3a's TierId), lowest first; null for anything else.
CREATE OR REPLACE FUNCTION public.season_tier_rank(p_tier text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$ SELECT array_position(ARRAY['spark', 'charge', 'volt', 'surge', 'storm', 'lightning', 'top500'], p_tier) $$;
REVOKE ALL ON FUNCTION public.season_tier_rank(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.season_tier_rank(text) TO service_role;

/* ------------------------------------------------------------------ what each season pays */

CREATE TABLE IF NOT EXISTS public.season_reward_sets (
  season_id text PRIMARY KEY REFERENCES public.pass_seasons (id),
  -- The emblem's mark ("S1") and the start of each tier's frame and title id.
  mark text NOT NULL CHECK (mark ~ '^S[0-9]{1,3}$'),
  frame_prefix text CHECK (frame_prefix IS NULL OR frame_prefix ~ '^frame\.[a-z0-9-]+-$'),
  -- The tier's card art (Joe, 11 Nov 2026): A1's seven card-art.tier.<tier> items, the same every season.
  card_art_prefix text CHECK (card_art_prefix IS NULL OR card_art_prefix ~ '^card-art\.[a-z0-9-]+\.$'),
  title_prefix text CHECK (title_prefix IS NULL OR title_prefix ~ '^[a-z0-9-]+-$')
);

INSERT INTO public.season_reward_sets (season_id, mark, frame_prefix, card_art_prefix, title_prefix) VALUES
  ('s1', 'S1', 'frame.s1-', 'card-art.tier.', 's1-'),
  -- The testers' season pays Season 1's rewards, so the whole path can be tried before Season 1.
  ('test', 'S1', 'frame.s1-', 'card-art.tier.', 's1-')
ON CONFLICT (season_id) DO NOTHING;

-- The seven Season 1 frames (docs/art/wave-4/catalogue.json, after W4c's Championship frame at 111; placeholder art until
-- drawn; earned, never sold).
INSERT INTO public.catalogue_items (id, name, kind, slot, rarity, source, pass_level, price_coins, bundle, animated,
                                   exclusive, exclusive_forever, note, png_path, html_path, sort_order)
SELECT v.id, v.name, 'frame', 'frame', NULL, 'earned-season-peak-tier', NULL, NULL, NULL, v.animated, true, true,
       'placeholder art until drawn', 'placeholders/frame/' || v.file || '.png', 'placeholders/frame/' || v.file || '.html',
       111 + v.n
  FROM (VALUES
    ('frame.s1-spark', 'Season 1 Spark', false, 's1-spark', 1),
    ('frame.s1-charge', 'Season 1 Charge', false, 's1-charge', 2),
    ('frame.s1-volt', 'Season 1 Volt', false, 's1-volt', 3),
    ('frame.s1-surge', 'Season 1 Surge', false, 's1-surge', 4),
    ('frame.s1-storm', 'Season 1 Storm', true, 's1-storm', 5),
    ('frame.s1-lightning', 'Season 1 Lightning', true, 's1-lightning', 6),
    ('frame.s1-top-500', 'Season 1 Top 500', true, 's1-top-500', 7)
  ) AS v (id, name, animated, file, n)
ON CONFLICT (id) DO NOTHING;

-- The seven Season 1 titles (C2's titles, kind 'season'), after the titles already there.
INSERT INTO public.titles (id, name, kind, badge, sort_order)
SELECT v.id, v.name, 'season', NULL, (SELECT coalesce(max(sort_order), 0) FROM public.titles) + v.n
  FROM (VALUES
    ('s1-spark', 'S1 Spark', 1), ('s1-charge', 'S1 Charge', 2), ('s1-volt', 'S1 Volt', 3), ('s1-surge', 'S1 Surge', 4),
    ('s1-storm', 'S1 Storm', 5), ('s1-lightning', 'S1 Lightning', 6), ('s1-top-500', 'S1 Top 500', 7)
  ) AS v (id, name, n)
 WHERE NOT EXISTS (SELECT 1 FROM public.titles t WHERE t.id = v.id)
 ORDER BY v.n;

/* ------------------------------------------------------------------ rated matches in a season */

CREATE TABLE IF NOT EXISTS public.season_rated_matches (
  season_id text NOT NULL REFERENCES public.pass_seasons (id),
  -- The season's start when the match was played: a test season run again later is a new run.
  season_start timestamptz NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  match_id uuid NOT NULL,
  at timestamptz NOT NULL,
  -- The tier held after the match (the shown tier: a cap-held player's is the capped one); null in placement.
  tier text CHECK (tier IS NULL OR public.season_tier_rank(tier) IS NOT NULL),
  tier_label text CHECK (tier_label IS NULL OR char_length(tier_label) BETWEEN 1 AND 40),
  placement_done boolean NOT NULL,
  -- 'match': a live rated match (counted towards the 10); 'standing': a tier the standings job gave (peak only).
  kind text NOT NULL DEFAULT 'match' CHECK (kind IN ('match', 'standing')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season_id, season_start, user_id, match_id),
  CONSTRAINT season_rated_matches_tier CHECK (tier IS NULL OR placement_done)
);
CREATE INDEX IF NOT EXISTS season_rated_matches_user_idx ON public.season_rated_matches (user_id, season_id, season_start);

CREATE TABLE IF NOT EXISTS public.season_closes (
  season_id text NOT NULL REFERENCES public.pass_seasons (id),
  season_start timestamptz NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  players_rewarded integer NOT NULL CHECK (players_rewarded >= 0),
  -- 'done': the ratings were reset; 'waiting_for_ratings': the ratings engine wasn't there yet (close again later).
  reset_status text NOT NULL CHECK (reset_status IN ('done', 'waiting_for_ratings')),
  reset_at timestamptz,
  reset_detail jsonb,
  PRIMARY KEY (season_id, season_start)
);

CREATE TABLE IF NOT EXISTS public.season_rewards (
  season_id text NOT NULL REFERENCES public.pass_seasons (id),
  season_start timestamptz NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (public.season_tier_rank(tier) IS NOT NULL),
  peak_label text NOT NULL CHECK (char_length(peak_label) BETWEEN 1 AND 40),
  rated_matches integer NOT NULL CHECK (rated_matches >= 10),
  mark text NOT NULL CHECK (mark ~ '^[A-Z0-9]{1,4}$'),
  frame_item text REFERENCES public.catalogue_items (id),
  -- The tier's card art (card-art.tier.<tier>), kept forever once owned.
  card_art text REFERENCES public.catalogue_items (id),
  -- The items this reward actually added to the inventory (an item already owned isn't listed), so a test reward taken
  -- back removes only what it gave.
  granted_items text[] NOT NULL DEFAULT ARRAY[]::text[],
  title_id text REFERENCES public.titles (id),
  test boolean NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  -- The in-app notice shown (on a tab page, never over a result).
  seen_at timestamptz,
  -- A test-season reward taken back by Joe (pass.remove_test_season_tier_rewards); never deleted.
  removed_at timestamptz,
  removed_note text,
  PRIMARY KEY (season_id, season_start, user_id),
  CONSTRAINT season_rewards_removed CHECK ((removed_at IS NULL) = (removed_note IS NULL))
);

CREATE TABLE IF NOT EXISTS public.season_placement_resets (
  -- Guests play rated too (W3a), so keyed on the auth user, as public.rated_profiles is.
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  season_id text NOT NULL REFERENCES public.pass_seasons (id),
  season_start timestamptz NOT NULL,
  reset_at timestamptz NOT NULL,
  -- Placement matches the next season starts with.
  placement_of smallint NOT NULL DEFAULT 3 CHECK (placement_of BETWEEN 1 AND 5),
  PRIMARY KEY (user_id, season_id, season_start)
);
CREATE INDEX IF NOT EXISTS season_placement_resets_user_idx ON public.season_placement_resets (user_id, reset_at DESC);

DO $grants$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['season_reward_sets', 'season_rated_matches', 'season_closes', 'season_rewards',
                           'season_placement_resets'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, service_role', t);
    EXECUTE format('GRANT SELECT ON public.%I TO service_role', t);
  END LOOP;
END
$grants$;

/* ------------------------------------------------------------------ which season */

-- The season a player is in at a moment (D2's rule): the test season for a tester while it runs, else the real season
-- running then. Answers no row between seasons.
CREATE OR REPLACE FUNCTION public.season_at(p_user_id uuid, p_at timestamptz)
RETURNS TABLE (season_id text, season_start timestamptz, test boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.starts_at, s.kind = 'test'
    FROM public.pass_seasons s
   WHERE s.starts_at IS NOT NULL AND s.starts_at <= p_at AND (s.ends_at IS NULL OR p_at < s.ends_at)
     AND (s.kind = 'season' OR public.shop_is_tester(p_user_id))
   ORDER BY (s.kind = 'test') DESC, s.starts_at DESC
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.season_at(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.season_at(uuid, timestamptz) TO service_role;

-- Records one live player's rated match in the season they are in (called by the ratings engine once per live player
-- per match, after the match's ratings are stored). p_tier: the tier shown after the match (W3a's TierView.tier, the
-- capped one), null while in placement. Idempotent on the match. Answers noted | duplicate | no_season | no_account |
-- bad_tier.
CREATE OR REPLACE FUNCTION public.season_note_rated_match(
  p_user_id uuid, p_match_id uuid, p_at timestamptz, p_tier text, p_tier_label text, p_placement_done boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season record;
  v_n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RETURN 'no_account';
  END IF;
  IF (p_tier IS NOT NULL AND (public.season_tier_rank(p_tier) IS NULL OR NOT coalesce(p_placement_done, false)))
     OR (p_tier IS NULL) <> (p_tier_label IS NULL) THEN
    RETURN 'bad_tier';
  END IF;
  SELECT * INTO v_season FROM public.season_at(p_user_id, coalesce(p_at, now()));
  IF NOT FOUND THEN
    RETURN 'no_season';
  END IF;
  INSERT INTO public.season_rated_matches (season_id, season_start, user_id, match_id, at, tier, tier_label, placement_done)
  VALUES (v_season.season_id, v_season.season_start, p_user_id, p_match_id, coalesce(p_at, now()), p_tier, p_tier_label,
          coalesce(p_placement_done, false))
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN CASE WHEN v_n = 1 THEN 'noted' ELSE 'duplicate' END;
END;
$$;
REVOKE ALL ON FUNCTION public.season_note_rated_match(uuid, uuid, timestamptz, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.season_note_rated_match(uuid, uuid, timestamptz, text, text, boolean) TO service_role;

-- Records a tier the standings job gave a placed player (W3a's runStandingsJob: the Top 500 and cap changes come only
-- from it), so the season's peak is every tier actually held. Not a rated match: it never counts towards the 10.
-- Idempotent on (player, time, tier). Answers noted | duplicate | no_season | no_account | bad_tier.
CREATE OR REPLACE FUNCTION public.season_note_tier(p_user_id uuid, p_at timestamptz, p_tier text, p_tier_label text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season record;
  v_n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RETURN 'no_account';
  END IF;
  IF public.season_tier_rank(p_tier) IS NULL OR coalesce(trim(p_tier_label), '') = '' THEN
    RETURN 'bad_tier';
  END IF;
  SELECT * INTO v_season FROM public.season_at(p_user_id, coalesce(p_at, now()));
  IF NOT FOUND THEN
    RETURN 'no_season';
  END IF;
  INSERT INTO public.season_rated_matches (season_id, season_start, user_id, match_id, at, tier, tier_label, placement_done, kind)
  VALUES (v_season.season_id, v_season.season_start, p_user_id,
          md5(p_user_id::text || ':' || coalesce(p_at, now())::text || ':' || p_tier)::uuid,
          coalesce(p_at, now()), p_tier, left(p_tier_label, 40), true, 'standing')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN CASE WHEN v_n = 1 THEN 'noted' ELSE 'duplicate' END;
END;
$$;
REVOKE ALL ON FUNCTION public.season_note_tier(uuid, timestamptz, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.season_note_tier(uuid, timestamptz, text, text) TO service_role;

-- One player's standing in one season run: rated matches, placement done, and the peak tier actually held.
CREATE OR REPLACE FUNCTION public.season_standing(p_user_id uuid, p_season text, p_start timestamptz)
RETURNS TABLE (rated_matches integer, placement_done boolean, peak_tier text, peak_label text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (count(*) FILTER (WHERE m.kind = 'match'))::integer,
         coalesce(bool_or(m.placement_done), false),
         (SELECT x.tier FROM public.season_rated_matches x
           WHERE x.season_id = p_season AND x.season_start = p_start AND x.user_id = p_user_id AND x.tier IS NOT NULL
           ORDER BY public.season_tier_rank(x.tier) DESC, x.at ASC LIMIT 1),
         (SELECT x.tier_label FROM public.season_rated_matches x
           WHERE x.season_id = p_season AND x.season_start = p_start AND x.user_id = p_user_id AND x.tier IS NOT NULL
           ORDER BY public.season_tier_rank(x.tier) DESC, x.at ASC LIMIT 1)
    FROM public.season_rated_matches m
   WHERE m.season_id = p_season AND m.season_start = p_start AND m.user_id = p_user_id;
$$;
REVOKE ALL ON FUNCTION public.season_standing(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.season_standing(uuid, text, timestamptz) TO service_role;

/* ------------------------------------------------------------------ the reset */

-- The one reset formula (src/lib/seasons/rules.ts SEASON_RESET mirrors it): a third of the way back towards the
-- average, and the uncertainty a third of the way back towards the starting 350 (never narrower than it was).
CREATE OR REPLACE FUNCTION public.season_reset_rating(p_rating numeric, p_rd numeric, p_average numeric,
                                                      OUT rating numeric, OUT rd numeric)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_rating + (p_average - p_rating) / 3,
         least(350::numeric, greatest(p_rd, p_rd + (350 - p_rd) / 3));
$$;
REVOKE ALL ON FUNCTION public.season_reset_rating(numeric, numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.season_reset_rating(numeric, numeric, numeric) TO service_role;

-- Where a placement started (W3a's public.rated_profiles, one column added): 0 the first time; the season reset sets it,
-- with placement_played, to 2, so the new season's placement is 3 matches ("Placement 2 of 3"; src/lib/rated/match.ts
-- placementOf). rated_state reads the whole row, and rated_apply_match never writes this column, so it is kept.
ALTER TABLE public.rated_profiles ADD COLUMN IF NOT EXISTS placement_from smallint NOT NULL DEFAULT 0;
DO $c$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rated_profiles_placement_from') THEN
    ALTER TABLE public.rated_profiles ADD CONSTRAINT rated_profiles_placement_from CHECK (placement_from IN (0, 2));
  END IF;
END
$c$;

-- The ratings engine's side of the reset (W3a's tables). For every placed player in scope (everyone, or the testers
-- for the testers' season): each of Puzzles, Arcade and the 11 categories through public.season_reset_rating, the
-- average taken over every placed player rated in it; then placement back to 2 of 5 (3 matches to play), with the
-- Joulz Rating and the shown tier hidden until it is done, when the engine works the Joulz Rating out again from the
-- reset pools. Players still in placement are left as they are. Answers {players: [...], detail: {averages, players}}.
CREATE OR REPLACE FUNCTION public.ratings_season_reset(p_season text, p_start timestamptz, p_testers_only boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg jsonb;
  v_scope uuid[];
  v_players jsonb;
  v_n integer;
BEGIN
  SELECT coalesce(jsonb_object_agg(x.key, x.a), '{}'::jsonb) INTO v_avg
    FROM (SELECT r.key, avg(r.rating::numeric) AS a
            FROM public.rated_ratings r JOIN public.rated_profiles p ON p.player_id = r.player_id
           WHERE p.placement_played >= 5 GROUP BY r.key) x;
  SELECT coalesce(array_agg(p.player_id ORDER BY p.player_id), ARRAY[]::uuid[]) INTO v_scope
    FROM public.rated_profiles p
   WHERE p.placement_played >= 5 AND (NOT p_testers_only OR public.shop_is_tester(p.player_id));
  UPDATE public.rated_ratings r
     SET (rating, rd) = (SELECT x.rating::double precision, x.rd::double precision
                           FROM public.season_reset_rating(r.rating::numeric, r.rd::numeric, (v_avg ->> r.key)::numeric) x),
         version = r.version + 1
   WHERE r.player_id = ANY (v_scope) AND v_avg ? r.key;
  UPDATE public.rated_profiles p
     SET placement_played = 2, placement_from = 2, joulz = NULL, shown_tier = NULL, floor_grace = NULL,
         version = p.version + 1, updated_at = now()
   WHERE p.player_id = ANY (v_scope);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_players := to_jsonb(v_scope);
  RETURN jsonb_build_object('players', v_players, 'detail', jsonb_build_object('averages', v_avg, 'players', v_n,
                            'testers_only', p_testers_only));
END;
$$;
REVOKE ALL ON FUNCTION public.ratings_season_reset(text, timestamptz, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- Resets the ratings at a season's end, once per season run, through public.ratings_season_reset above (called by
-- name, so a database where it is missing records 'waiting_for_ratings' and a later close completes it). Each player
-- reset gets a season_placement_resets row (3 placement matches next).
CREATE OR REPLACE FUNCTION public.season_reset_ratings(p_season text, p_start timestamptz, p_testers_only boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v jsonb;
  v_n integer;
BEGIN
  SELECT reset_status INTO v_status FROM public.season_closes
   WHERE season_id = p_season AND season_start = p_start FOR UPDATE;
  IF v_status = 'done' THEN
    RETURN jsonb_build_object('status', 'done', 'again', true);
  END IF;
  IF to_regprocedure('public.ratings_season_reset(text,timestamptz,boolean)') IS NULL THEN
    UPDATE public.season_closes SET reset_status = 'waiting_for_ratings'
     WHERE season_id = p_season AND season_start = p_start;
    RETURN jsonb_build_object('status', 'waiting_for_ratings');
  END IF;
  EXECUTE 'SELECT public.ratings_season_reset($1, $2, $3)' INTO v USING p_season, p_start, p_testers_only;
  INSERT INTO public.season_placement_resets (user_id, season_id, season_start, reset_at, placement_of)
  SELECT u.user_id, p_season, p_start, now(), 3
    FROM (SELECT DISTINCT (jsonb_array_elements_text(coalesce(v -> 'players', '[]'::jsonb)))::uuid AS user_id) u
    JOIN auth.users p ON p.id = u.user_id
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  UPDATE public.season_closes
     SET reset_status = 'done', reset_at = now(),
         reset_detail = coalesce(v -> 'detail', '{}'::jsonb) || jsonb_build_object('players_reset', v_n)
   WHERE season_id = p_season AND season_start = p_start;
  RETURN jsonb_build_object('status', 'done', 'players_reset', v_n);
END;
$$;
REVOKE ALL ON FUNCTION public.season_reset_ratings(text, timestamptz, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- How many placement matches a player has now, and from when they count: 3 after a season reset (counted from the
-- reset), else the first placement's 5 (from the start). The ratings engine reads it ("Placement 2 of 3").
CREATE OR REPLACE FUNCTION public.season_placement_for(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT jsonb_build_object('of', r.placement_of, 'since', r.reset_at, 'season', r.season_id)
       FROM public.season_placement_resets r WHERE r.user_id = p_user_id ORDER BY r.reset_at DESC LIMIT 1),
    jsonb_build_object('of', 5, 'since', NULL, 'season', NULL));
$$;
REVOKE ALL ON FUNCTION public.season_placement_for(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.season_placement_for(uuid) TO service_role;

/* ------------------------------------------------------------------ closing a season (rewards, then the reset) */

-- The whole close for one season run, idempotent: rewards first (each player who finished placement and played 10 or
-- more rated matches in it, from the peak tier actually held: the emblem's mark, the frame, the card art, the title, each once), then
-- the reset. Run again, it grants nothing more and only completes a reset left waiting. Only Joe's functions call it.
CREATE OR REPLACE FUNCTION pass.season_close_run(p_season text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pass, economy
AS $$
DECLARE
  v_row public.pass_seasons%ROWTYPE;
  v_set public.season_reward_sets%ROWTYPE;
  v_first boolean;
  r record;
  v_suffix text;
  v_frame text;
  v_card text;
  v_item text;
  v_added text[];
  v_title text;
  v_granted integer := 0;
  v_rewarded integer;
  v_reset jsonb;
BEGIN
  SELECT * INTO v_row FROM public.pass_seasons WHERE id = p_season FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pass.close_season: no season %', p_season;
  END IF;
  IF v_row.starts_at IS NULL OR v_row.ends_at IS NULL OR v_row.ends_at > now() THEN
    RAISE EXCEPTION 'pass.close_season: % has not ended', p_season;
  END IF;
  SELECT * INTO v_set FROM public.season_reward_sets WHERE season_id = p_season;
  v_first := NOT EXISTS (SELECT 1 FROM public.season_closes WHERE season_id = p_season AND season_start = v_row.starts_at);

  IF v_first THEN
    FOR r IN
      SELECT m.user_id, s.rated_matches, s.peak_tier, s.peak_label
        FROM (SELECT DISTINCT user_id FROM public.season_rated_matches
               WHERE season_id = p_season AND season_start = v_row.starts_at) m
        CROSS JOIN LATERAL public.season_standing(m.user_id, p_season, v_row.starts_at) s
        JOIN public.profiles p ON p.user_id = m.user_id
       WHERE s.placement_done AND s.rated_matches >= 10 AND s.peak_tier IS NOT NULL
       ORDER BY m.user_id
    LOOP
      v_suffix := replace(r.peak_tier, 'top500', 'top-500');
      v_frame := CASE WHEN v_set.frame_prefix IS NULL THEN NULL ELSE v_set.frame_prefix || v_suffix END;
      v_title := CASE WHEN v_set.title_prefix IS NULL THEN NULL ELSE v_set.title_prefix || v_suffix END;
      v_card := CASE WHEN v_set.card_art_prefix IS NULL THEN NULL ELSE v_set.card_art_prefix || v_suffix END;
      INSERT INTO public.season_rewards (season_id, season_start, user_id, tier, peak_label, rated_matches, mark,
                                         frame_item, card_art, title_id, test)
      VALUES (p_season, v_row.starts_at, r.user_id, r.peak_tier, r.peak_label, r.rated_matches,
              coalesce(v_set.mark, upper(left(regexp_replace(p_season, '[^a-z0-9]', '', 'g'), 4))), v_frame, v_card,
              v_title, v_row.kind = 'test')
      ON CONFLICT DO NOTHING;
      IF FOUND THEN
        v_granted := v_granted + 1;
        -- The frame and the card art, each once: an item already owned stays as it is (nothing more).
        v_added := ARRAY[]::text[];
        FOREACH v_item IN ARRAY array_remove(ARRAY[v_frame, v_card], NULL) LOOP
          IF economy.add_item(r.user_id, v_item, 'earned') = 'granted' THEN
            v_added := v_added || v_item;
            PERFORM economy.note_event('item_granted', r.user_id,
              jsonb_build_object('kind', split_part(v_item, '.', 1), 'rarity', NULL, 'source', 'earned-season-peak-tier'));
          END IF;
        END LOOP;
        UPDATE public.season_rewards SET granted_items = v_added
         WHERE season_id = p_season AND season_start = v_row.starts_at AND user_id = r.user_id;
        PERFORM economy.note_event('season_reward_granted', r.user_id, jsonb_build_object('tier', r.peak_tier, 'season', p_season));
      END IF;
    END LOOP;
    SELECT count(*) INTO v_rewarded FROM public.season_rewards WHERE season_id = p_season AND season_start = v_row.starts_at;
    INSERT INTO public.season_closes (season_id, season_start, players_rewarded, reset_status)
    VALUES (p_season, v_row.starts_at, v_rewarded, 'waiting_for_ratings')
    ON CONFLICT DO NOTHING;
    PERFORM economy.note_event('season_ended', NULL, jsonb_build_object('season', p_season, 'players_rewarded', v_rewarded));
  END IF;

  v_reset := public.season_reset_ratings(p_season, v_row.starts_at, v_row.kind = 'test');
  RETURN jsonb_build_object(
    'season', p_season,
    'season_start', v_row.starts_at,
    'first_close', v_first,
    'rewarded_now', v_granted,
    'players_rewarded', (SELECT players_rewarded FROM public.season_closes WHERE season_id = p_season AND season_start = v_row.starts_at),
    'reset', v_reset);
END;
$$;
REVOKE ALL ON FUNCTION pass.season_close_run(text) FROM PUBLIC, anon, authenticated, service_role;

-- Joe: ends a real season now (if it is still running) and closes it: rewards, then the reset. Safe to run again (it
-- grants nothing twice, and completes a reset left waiting for the ratings engine). Logged.
--   SELECT pass.close_season('s1', 'Season 1 over');
CREATE OR REPLACE FUNCTION pass.close_season(p_season text, p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pass
AS $$
DECLARE
  v_kind text;
  v jsonb;
BEGIN
  SELECT kind INTO v_kind FROM public.pass_seasons WHERE id = p_season;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pass.close_season: no season %', p_season;
  END IF;
  IF v_kind <> 'season' THEN
    RAISE EXCEPTION 'pass.close_season: % is the test season: use pass.close_test_season', p_season;
  END IF;
  PERFORM pass.end_season(p_season, p_note);
  v := pass.season_close_run(p_season);
  PERFORM pass.log('close_season', p_season, NULL, v, p_note);
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION pass.close_season(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Joe: the same path for the testers' season: ends it now (if running) and closes this run of it (rewards to the
-- testers who qualified, then the testers' ratings reset). Start it again with pass.start_test_season for another run.
--   SELECT pass.close_test_season('trying the season end');
CREATE OR REPLACE FUNCTION pass.close_test_season(p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pass
AS $$
DECLARE
  v jsonb;
BEGIN
  PERFORM pass.end_test_season(p_note);
  v := pass.season_close_run('test');
  PERFORM pass.log('close_test_season', 'test', NULL, v, p_note);
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION pass.close_test_season(text) FROM PUBLIC, anon, authenticated, service_role;

-- Joe: a season's close at a glance (each run: when, how many rewarded per tier, the reset).
--   SELECT pass.season_report('s1');
CREATE OR REPLACE FUNCTION pass.season_report(p_season text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pass
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'season_start', c.season_start, 'closed_at', c.closed_at, 'players_rewarded', c.players_rewarded,
           'reset_status', c.reset_status, 'reset_at', c.reset_at, 'reset_detail', c.reset_detail,
           'by_tier', (SELECT coalesce(jsonb_object_agg(t.tier, t.n), '{}'::jsonb)
                         FROM (SELECT tier, count(*) AS n FROM public.season_rewards w
                                WHERE w.season_id = c.season_id AND w.season_start = c.season_start AND w.removed_at IS NULL
                                GROUP BY tier) t))
         ORDER BY c.season_start), '[]'::jsonb)
    FROM public.season_closes c WHERE c.season_id = p_season;
$$;
REVOKE ALL ON FUNCTION pass.season_report(text) FROM PUBLIC, anon, authenticated, service_role;

-- Joe: takes back the tier rewards the testers' season paid (all testers, or one): each reward marked removed (never
-- deleted), the frame and card art it added removed unless another reward still gives them (an item the tester owned
-- before stays), its title off the card (back to Rookie).
-- Ratings already reset stay reset. Running it again takes nothing more.
--   SELECT pass.remove_test_season_tier_rewards('clean-up before launch');
--   SELECT pass.remove_test_season_tier_rewards('clean-up', 'TheirUsername');
CREATE OR REPLACE FUNCTION pass.remove_test_season_tier_rewards(p_note text, p_player text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pass, economy
AS $$
DECLARE
  v_user uuid := CASE WHEN p_player IS NULL THEN NULL ELSE economy.account(p_player) END;
  r record;
  v_rewards integer := 0;
  v_items integer := 0;
  v_item text;
  v_titles integer := 0;
  v_n integer;
BEGIN
  PERFORM pass.log('remove_test_season_tier_rewards', 'test', v_user, NULL, p_note);
  FOR r IN SELECT * FROM public.season_rewards
            WHERE test AND removed_at IS NULL AND (v_user IS NULL OR user_id = v_user) FOR UPDATE LOOP
    UPDATE public.season_rewards SET removed_at = now(), removed_note = p_note
     WHERE season_id = r.season_id AND season_start = r.season_start AND user_id = r.user_id;
    v_rewards := v_rewards + 1;
    -- Only what this reward added (an item the player already owned stays), and never one another reward still gives.
    FOREACH v_item IN ARRAY r.granted_items LOOP
      IF NOT EXISTS (
           SELECT 1 FROM public.season_rewards x
            WHERE x.user_id = r.user_id AND x.removed_at IS NULL AND (x.frame_item = v_item OR x.card_art = v_item)) THEN
        DELETE FROM public.inventory_items WHERE user_id = r.user_id AND item_id = v_item AND how = 'earned';
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_items := v_items + v_n;
      END IF;
    END LOOP;
    IF r.title_id IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.season_rewards x
          WHERE x.user_id = r.user_id AND x.title_id = r.title_id AND x.removed_at IS NULL) THEN
      DELETE FROM public.card_titles WHERE user_id = r.user_id AND title = r.title_id;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_titles := v_titles + v_n;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('rewards', v_rewards, 'items', v_items, 'titles_unequipped', v_titles);
END;
$$;
REVOKE ALL ON FUNCTION pass.remove_test_season_tier_rewards(text, text) FROM PUBLIC, anon, authenticated, service_role;

/* ------------------------------------------------------------------ what the server reads for the phone */

-- One player's seasons: the season they are in now (its rated matches, placement, and peak so far) and their history
-- (every season reward, oldest first). Real data only: nothing is made up for a season not played.
CREATE OR REPLACE FUNCTION public.season_view(p_user_id uuid, p_now timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cur AS (SELECT * FROM public.season_at(p_user_id, p_now)),
       st AS (SELECT s.* FROM cur CROSS JOIN LATERAL public.season_standing(p_user_id, cur.season_id, cur.season_start) s)
  SELECT jsonb_build_object(
    'current', (SELECT jsonb_build_object(
                  'season', cur.season_id, 'name', ps.name, 'test', cur.test,
                  'mark', coalesce(rs.mark, upper(left(regexp_replace(cur.season_id, '[^a-z0-9]', '', 'g'), 4))),
                  'rated_matches', st.rated_matches, 'placement_done', st.placement_done,
                  'peak_tier', st.peak_tier, 'peak_label', st.peak_label)
                  FROM cur JOIN public.pass_seasons ps ON ps.id = cur.season_id
                  LEFT JOIN public.season_reward_sets rs ON rs.season_id = cur.season_id, st),
    'history', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                  'season', w.season_id, 'name', ps.name, 'test', w.test, 'mark', w.mark, 'tier', w.tier,
                  'peak_label', w.peak_label, 'rated_matches', w.rated_matches, 'frame', w.frame_item, 'card_art', w.card_art,
                  'title', w.title_id, 'granted_at', w.granted_at, 'seen', w.seen_at IS NOT NULL)
                  ORDER BY w.granted_at), '[]'::jsonb)
                  FROM public.season_rewards w JOIN public.pass_seasons ps ON ps.id = w.season_id
                 WHERE w.user_id = p_user_id AND w.removed_at IS NULL));
$$;
REVOKE ALL ON FUNCTION public.season_view(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.season_view(uuid, timestamptz) TO service_role;

-- The notice shown: marks one season's reward seen. Answers seen | already | none.
CREATE OR REPLACE FUNCTION public.season_reward_seen(p_user_id uuid, p_season text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.season_rewards WHERE user_id = p_user_id AND season_id = p_season AND removed_at IS NULL) THEN
    RETURN 'none';
  END IF;
  UPDATE public.season_rewards SET seen_at = now()
   WHERE user_id = p_user_id AND season_id = p_season AND seen_at IS NULL AND removed_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN CASE WHEN v_n > 0 THEN 'seen' ELSE 'already' END;
END;
$$;
REVOKE ALL ON FUNCTION public.season_reward_seen(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.season_reward_seen(uuid, text) TO service_role;

-- The season titles an account holds (each granted reward's title, not taken back).
CREATE OR REPLACE FUNCTION public.season_titles_of(p_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(DISTINCT title_id ORDER BY title_id), ARRAY[]::text[])
    FROM public.season_rewards WHERE user_id = p_user_id AND title_id IS NOT NULL AND removed_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.season_titles_of(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.season_titles_of(uuid) TO service_role;

/* ------------------------------------------------------------------ equipping a season title */

-- C2's function as D2 left it (20261113100200_pass_titles_test_rewards.sql), with a season title equippable once its
-- season reward is granted (and not taken back). Everything else is exactly as before. Answers set | unchanged |
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
  IF v_title.kind = 'pass' AND NOT EXISTS (
       SELECT 1 FROM public.pass_title_unlocks WHERE user_id = p_user_id AND title_id = v_title.id) THEN
    RETURN 'not_earned';
  END IF;
  IF v_title.kind = 'season' AND NOT EXISTS (
       SELECT 1 FROM public.season_rewards
        WHERE user_id = p_user_id AND title_id = v_title.id AND removed_at IS NULL) THEN
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
