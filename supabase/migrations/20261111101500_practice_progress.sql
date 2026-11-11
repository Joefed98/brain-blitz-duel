-- Practice progress on the account (Wave 2, train C, session C1a; 11 Nov 2026; docs/practice-progress.md).
-- Non-destructive and idempotent: it adds three columns to practice_plays (none of its rows is changed), creates new
-- tables and functions, adds a trigger on profiles and widens analytics.events' list of events. Nothing is deleted.
--
-- What it holds:
--   * practice_plays.breakdown: what the server's grading produced for the run (the same shape round_results.extra
--     has: standard parts, facts, the arcade reveal); written only by the server's own grading, never by the phone.
--   * practice_plays.level: the run's level (easy / classic / hard / expert); NULL means Classic (every run today).
--   * practice_plays.progress_counted_at: when the run was counted towards progress (once; NULL = not counted).
--   * public.practice_progress_start: one row, the fresh start's moment (Joe's decision, 10 Nov 2026): the time this
--     migration ran on the live database. Runs graded before it never count; nothing from before is deleted.
--   * public.practice_progress: one row per player, game and level: the best score from graded runs, and the star
--     (175 or more on Easy, Classic or Hard; Expert's crown comes in wave 3.5 and is never a star) with the score that
--     earned it. A star once earned is kept.
--   * public.practice_refresh_notes: the player has seen Practice's one-time "Stars and challenges have had a
--     refresh" note.
--   * Gem colours (public.gem_unlocks, A1's table) unlock on the star total: Amber 10, Rose Quartz 20, Ruby 30, Jade 50,
--     Amethyst 75, Aquamarine 100, Sapphire 125, Pearl 150, Obsidian 200, Diamond 250; never removed. Gems need an
--     account (gem_unlocks keys on profiles): a guest's stars unlock them when the guest signs up (the profile trigger).
--
-- Who can reach what: anon and authenticated nothing at all. The server (service role) reads the tables and writes only
-- through public.practice_record_play(play id) and public.practice_mark_refresh_note_seen(user id). Progress keys on
-- auth.users, so a guest has progress too, and an account's removal (accounts.forget_user deletes the auth user) takes
-- its progress with it.

ALTER TABLE public.practice_plays ADD COLUMN IF NOT EXISTS breakdown jsonb;
ALTER TABLE public.practice_plays ADD COLUMN IF NOT EXISTS level text;
ALTER TABLE public.practice_plays ADD COLUMN IF NOT EXISTS progress_counted_at timestamptz;
ALTER TABLE public.practice_plays DROP CONSTRAINT IF EXISTS practice_plays_level_check;
ALTER TABLE public.practice_plays ADD CONSTRAINT practice_plays_level_check
  CHECK (level IS NULL OR level IN ('easy', 'classic', 'hard', 'expert'));

/* ------------------------------------------------------------------ the fresh start */

CREATE TABLE IF NOT EXISTS public.practice_progress_start (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  fresh_start_at timestamptz NOT NULL DEFAULT now()
);
-- The first run of this file sets the moment; a re-run keeps it.
INSERT INTO public.practice_progress_start (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

/* ------------------------------------------------------------------ progress */

CREATE TABLE IF NOT EXISTS public.practice_progress (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  game_id text NOT NULL,
  level text NOT NULL CHECK (level IN ('easy', 'classic', 'hard', 'expert')),
  best_score integer NOT NULL CHECK (best_score >= 0),
  best_play_id bigint,
  best_at timestamptz NOT NULL DEFAULT now(),
  star_at timestamptz,
  star_score integer,
  CONSTRAINT practice_progress_star_levels CHECK (star_at IS NULL OR level IN ('easy', 'classic', 'hard')),
  CONSTRAINT practice_progress_star_score CHECK ((star_at IS NULL) = (star_score IS NULL) AND (star_score IS NULL OR star_score >= 175)),
  PRIMARY KEY (user_id, game_id, level)
);

CREATE TABLE IF NOT EXISTS public.practice_refresh_notes (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT now()
);

DO $grants$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['practice_progress_start', 'practice_progress', 'practice_refresh_notes'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, service_role', t);
    EXECUTE format('GRANT SELECT ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END
$grants$;

/* ------------------------------------------------------------------ gems */

-- The gems a star total has unlocked, in order (the master plan's thresholds; src/lib/practice/progressRules.ts).
CREATE OR REPLACE FUNCTION public.practice_gems_for(p_stars integer)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(array_agg(g ORDER BY n), ARRAY[]::text[])
    FROM (VALUES ('amber', 10), ('rose-quartz', 20), ('ruby', 30), ('jade', 50), ('amethyst', 75),
                 ('aquamarine', 100), ('sapphire', 125), ('pearl', 150), ('obsidian', 200), ('diamond', 250)) AS t(g, n)
   WHERE n <= coalesce(p_stars, 0);
$$;
REVOKE ALL ON FUNCTION public.practice_gems_for(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.practice_gems_for(integer) TO service_role;

-- A player's star total: every star on Easy, Classic and Hard (276 at most: 92 games, 3 levels).
CREATE OR REPLACE FUNCTION public.practice_star_total(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer FROM public.practice_progress
   WHERE user_id = p_user_id AND star_at IS NOT NULL AND level IN ('easy', 'classic', 'hard');
$$;
REVOKE ALL ON FUNCTION public.practice_star_total(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.practice_star_total(uuid) TO service_role;

-- Unlocks every gem the player's star total has reached (an account only: gem_unlocks keys on profiles). Returns the
-- gems this call unlocked; a gem already unlocked stays unlocked, whatever the total later reads.
CREATE OR REPLACE FUNCTION public.practice_sync_gems(p_user_id uuid)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new text[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RETURN ARRAY[]::text[];
  END IF;
  WITH added AS (
    INSERT INTO public.gem_unlocks (user_id, gem)
    SELECT p_user_id, g FROM unnest(public.practice_gems_for(public.practice_star_total(p_user_id))) AS g
    ON CONFLICT (user_id, gem) DO NOTHING
    RETURNING gem
  )
  SELECT coalesce(array_agg(gem), ARRAY[]::text[]) INTO v_new FROM added;
  RETURN v_new;
END
$$;
REVOKE ALL ON FUNCTION public.practice_sync_gems(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.practice_sync_gems(uuid) TO service_role;

-- A guest who signs up keeps their stars (wave 1's linking keeps the same user id), so the new profile gets the gems.
CREATE OR REPLACE FUNCTION public.practice_profile_gems()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.practice_sync_gems(NEW.user_id);
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.practice_profile_gems() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS practice_new_profile_gems ON public.profiles;
CREATE TRIGGER practice_new_profile_gems AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.practice_profile_gems();

/* ------------------------------------------------------------------ counting a run */

-- Counts one graded practice play (its row in practice_plays, written by the server's grading) towards its player's
-- progress, once. Not counted: a play already counted, with no player, the fixed intro example, a run the server
-- replay flagged, and any play graded before the fresh start. The answer (jsonb):
--   counted, reason (when not counted), game, level, score, previous_best (null before any counted run), best,
--   best_set (the best was set or raised), improved (an earlier best was beaten), star (the game has its star on this
--   level), star_earned (this run earned it), star_score, star_total, gems_unlocked (text[]).
CREATE OR REPLACE FUNCTION public.practice_record_play(p_play_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.practice_plays%ROWTYPE;
  prev public.practice_progress%ROWTYPE;
  v_level text;
  v_fresh timestamptz;
  v_had boolean;
  v_best_set boolean;
  v_star_earned boolean;
  v_gems text[];
  v_now timestamptz := now();
  cur public.practice_progress%ROWTYPE;
BEGIN
  UPDATE public.practice_plays SET progress_counted_at = v_now
   WHERE id = p_play_id AND progress_counted_at IS NULL
  RETURNING * INTO p;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('counted', false, 'reason', 'not_found_or_counted');
  END IF;
  SELECT fresh_start_at INTO v_fresh FROM public.practice_progress_start WHERE id;
  IF p.user_id IS NULL THEN
    RETURN jsonb_build_object('counted', false, 'reason', 'no_player');
  ELSIF p.example THEN
    RETURN jsonb_build_object('counted', false, 'reason', 'example');
  ELSIF p.flagged THEN
    RETURN jsonb_build_object('counted', false, 'reason', 'flagged');
  ELSIF v_fresh IS NULL OR p.created_at < v_fresh THEN
    RETURN jsonb_build_object('counted', false, 'reason', 'before_fresh_start');
  ELSIF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p.user_id) THEN
    RETURN jsonb_build_object('counted', false, 'reason', 'no_player');
  END IF;

  v_level := coalesce(p.level, 'classic');
  -- One player's runs are counted one at a time.
  PERFORM pg_advisory_xact_lock(hashtextextended('practice_progress:' || p.user_id::text, 0));
  SELECT * INTO prev FROM public.practice_progress
   WHERE user_id = p.user_id AND game_id = p.game_id AND level = v_level;
  v_had := FOUND;
  v_best_set := NOT v_had OR p.score > prev.best_score;
  v_star_earned := v_level IN ('easy', 'classic', 'hard') AND p.score >= 175 AND (NOT v_had OR prev.star_at IS NULL);

  IF NOT v_had THEN
    INSERT INTO public.practice_progress (user_id, game_id, level, best_score, best_play_id, best_at, star_at, star_score)
    VALUES (p.user_id, p.game_id, v_level, greatest(p.score, 0), p.id, v_now,
            CASE WHEN v_star_earned THEN v_now END, CASE WHEN v_star_earned THEN p.score END)
    RETURNING * INTO cur;
  ELSIF v_best_set OR v_star_earned THEN
    UPDATE public.practice_progress
       SET best_score = CASE WHEN v_best_set THEN p.score ELSE best_score END,
           best_play_id = CASE WHEN v_best_set THEN p.id ELSE best_play_id END,
           best_at = CASE WHEN v_best_set THEN v_now ELSE best_at END,
           star_at = CASE WHEN v_star_earned THEN v_now ELSE star_at END,
           star_score = CASE WHEN v_star_earned THEN p.score ELSE star_score END
     WHERE user_id = p.user_id AND game_id = p.game_id AND level = v_level
    RETURNING * INTO cur;
  ELSE
    cur := prev;
  END IF;

  v_gems := CASE WHEN v_star_earned THEN public.practice_sync_gems(p.user_id) ELSE ARRAY[]::text[] END;

  RETURN jsonb_build_object(
    'counted', true,
    'game', p.game_id,
    'level', v_level,
    'score', p.score,
    'previous_best', CASE WHEN v_had THEN to_jsonb(prev.best_score) ELSE 'null'::jsonb END,
    'best', cur.best_score,
    'best_set', v_best_set,
    'improved', v_had AND p.score > prev.best_score,
    'star', cur.star_at IS NOT NULL,
    'star_earned', v_star_earned,
    'star_score', cur.star_score,
    'star_total', public.practice_star_total(p.user_id),
    'gems_unlocked', to_jsonb(v_gems)
  );
END
$$;
REVOKE ALL ON FUNCTION public.practice_record_play(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.practice_record_play(bigint) TO service_role;

-- The one-time refresh note: true when this call recorded it (false: seen before).
CREATE OR REPLACE FUNCTION public.practice_mark_refresh_note_seen(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN false;
  END IF;
  INSERT INTO public.practice_refresh_notes (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  RETURN FOUND;
END
$$;
REVOKE ALL ON FUNCTION public.practice_mark_refresh_note_seen(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.practice_mark_refresh_note_seen(uuid) TO service_role;

/* ------------------------------------------------------------------ analytics */

-- star_earned (game, props.level), best_set (game, props.level), gem_unlocked (props.gem): written by the server
-- (src/lib/practice/progress.server.ts) through src/lib/data/events.server.ts. The list is read from the constraint
-- as it stands and these three added to it, as 20261110200000_analytics_identity_events.sql does.
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
    FROM (SELECT unnest(existing) AS e UNION SELECT unnest(ARRAY['star_earned', 'best_set', 'gem_unlocked'])) AS u;
  ALTER TABLE analytics.events DROP CONSTRAINT IF EXISTS events_event_check;
  EXECUTE format(
    'ALTER TABLE analytics.events ADD CONSTRAINT events_event_check CHECK (event IN (%s)) NOT VALID',
    (SELECT string_agg(quote_literal(e), ', ') FROM unnest(wanted) AS e)
  );
  ALTER TABLE analytics.events VALIDATE CONSTRAINT events_event_check;
END
$events$;
