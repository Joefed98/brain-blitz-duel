-- Matchmaking, part 2 (wave 3, W3b; Joe, 11 Nov 2026; docs/rated/matchmaking-interface.md section 7).
--
-- Additive and idempotent. No stored row of any existing table is changed (rule 4).
--
-- 1. mm_practice_deals: the deal of each graded Practice play that C1a counts towards progress (never the intro
--    example, a flagged run or a play from before the fresh start), written by the server alone
--    (src/lib/duel/practice.functions.ts → src/lib/rated/practiceDeals.server.ts), so Practice runs from now on can be
--    recorded-run fallbacks beside rooms and the Daily. Kept 15 days (recorded runs come from the last 14):
--    public.mm_purge_practice_deals, run daily by the Worker's Cron Trigger (`rated:practice-deals-purge`, 04:37 UTC,
--    vite.config.ts MATCHMAKING_TASKS), so it runs whether or not this database has pg_cron, and also by pg_cron
--    where available (`mm-practice-deals`); the purge is idempotent.
-- 2. A deleted account's stored runs are removed, not just skipped: when accounts.forget_user removes the auth user,
--    the trigger below deletes their rated runs, practice deals, search and live progress, and re-keys what other
--    players' matches keep (their seat in a match, the runs played against, the uses) to one fresh random id.

CREATE TABLE IF NOT EXISTS public.mm_practice_deals (
  play_id bigint PRIMARY KEY,
  user_id uuid NOT NULL,
  game text NOT NULL,
  -- The whole puzzle (public and private halves) as it was graded, so it can be dealt again exactly.
  puzzle jsonb NOT NULL,
  answer text,
  score integer NOT NULL,
  ms_remaining integer NOT NULL,
  reaction_avg_ms integer,
  -- The server replay's flag on the grade (a flagged run is never played against).
  flagged boolean NOT NULL DEFAULT false,
  -- The server's stored grade extra (as practice_plays.breakdown holds it), handed to the ratings engine.
  extra jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mm_practice_deals_recent ON public.mm_practice_deals (recorded_at DESC);
CREATE INDEX IF NOT EXISTS mm_practice_deals_user ON public.mm_practice_deals (user_id, recorded_at DESC);

ALTER TABLE public.mm_practice_deals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mm_practice_deals FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.mm_practice_deals TO service_role;

-- Deals older than 15 days can never be played against again.
CREATE OR REPLACE FUNCTION public.mm_purge_practice_deals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.mm_practice_deals WHERE recorded_at < now() - interval '15 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.mm_purge_practice_deals() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_purge_practice_deals() TO service_role;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
      PERFORM cron.schedule('mm-practice-deals', '29 4 * * *', 'SELECT public.mm_purge_practice_deals()');
    EXCEPTION WHEN OTHERS THEN
      PERFORM migration_log.note('warning', format('practice deals purge not scheduled in pg_cron (%s); the Worker''s Cron Trigger still runs it; see docs/rated/matchmaking-interface.md', SQLERRM));
    END;
  ELSE
    PERFORM migration_log.note('warning', 'practice deals purge: pg_cron is not available on this database; the Worker''s Cron Trigger runs it instead; see docs/rated/matchmaking-interface.md');
  END IF;
END
$cron$;

-- A removed user (accounts.forget_user deletes the auth user last).
CREATE OR REPLACE FUNCTION public.mm_forget_removed_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t uuid := gen_random_uuid();
  old_id text := OLD.id::text;
BEGIN
  -- Their own stored runs and deals go.
  DELETE FROM public.mm_runs WHERE owner_id = OLD.id;
  DELETE FROM public.mm_practice_deals WHERE user_id = OLD.id;
  DELETE FROM public.mm_queue WHERE user_id = OLD.id;
  DELETE FROM public.mm_progress WHERE user_id = OLD.id;
  -- Other players' matches keep their shape, under one fresh id (run keys name the owner, so they are re-keyed too).
  UPDATE public.mm_match_players SET user_id = t WHERE user_id = OLD.id;
  UPDATE public.mm_run_uses SET viewer_id = t WHERE viewer_id = OLD.id;
  UPDATE public.mm_run_uses SET run_key = replace(run_key, old_id, t::text) WHERE position(old_id IN run_key) > 0;
  UPDATE public.mm_matches
     SET recorded_owner = t,
         recorded_key = replace(recorded_key, old_id, t::text),
         recorded_games = CASE WHEN jsonb_typeof(recorded_games) = 'object'
                               THEN jsonb_set(recorded_games, '{ownerName}', '"Deleted player"') ELSE recorded_games END
   WHERE recorded_owner = OLD.id;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.mm_forget_removed_user() FROM PUBLIC, anon, authenticated, service_role;

DO $trigger$
BEGIN
  DROP TRIGGER IF EXISTS mm_forget_removed_user ON auth.users;
  CREATE TRIGGER mm_forget_removed_user AFTER DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.mm_forget_removed_user();
EXCEPTION WHEN insufficient_privilege THEN
  PERFORM migration_log.note('warning', 'matchmaking: no trigger on auth.users (insufficient privilege); a removed user''s runs are only skipped; see docs/rated/matchmaking-interface.md');
END
$trigger$;
