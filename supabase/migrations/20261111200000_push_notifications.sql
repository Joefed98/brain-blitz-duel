-- Phone notifications (wave 2 train B, session B2; 11 Nov 2026; docs/push-notifications.md). Additive and idempotent:
-- four new tables, four service-role functions, a retention job and three analytics events; no existing row, table,
-- column or policy is changed. Needs train C's public.daily_history (20261111120000_badges_titles.sql) and train B1's
-- public.friend_events (20261111180000_friends.sql), both earlier.
--
--  public.push_subscriptions   one row per account and device (a browser's push subscription). Accounts only: the row
--                               hangs off public.profiles, so a guest can't have one and an account's removal takes
--                               its rows with it. Written only by the server (src/lib/data/push.server.ts) after its
--                               checks (an account, a known push service); a player may read and delete their own.
--  public.notification_settings one row per account: the master switch, a switch per event, when the phone last asked
--                               and when the player declined. A player may read, add and change their own row.
--  public.notification_log      one row per notification sent (the daily cap, the streak reminder's once a day);
--                               service role only. Kept 30 days (pg_cron job `push-log-retention`).
--  public.push_friend_deliveries which of B1's friend events have been taken for a notification (each sent at most
--                               once); service role only.
--
-- Every function is for the service role only (anon and authenticated can't call them).

/* ------------------------------------------------------------------ subscriptions */

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE CHECK (char_length(endpoint) BETWEEN 1 AND 1024 AND endpoint LIKE 'https://%'),
  p256dh text NOT NULL CHECK (char_length(p256dh) BETWEEN 80 AND 100),
  auth text NOT NULL CHECK (char_length(auth) BETWEEN 16 AND 32),
  -- The device's IANA time zone (quiet hours and the daily cap are on the player's own clock).
  time_zone text NOT NULL DEFAULT 'Europe/London' CHECK (char_length(time_zone) BETWEEN 1 AND 64),
  platform text CHECK (platform IN ('ios', 'android', 'desktop')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user ON public.push_subscriptions (user_id, last_seen_at DESC);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
DROP POLICY IF EXISTS push_subscriptions_read_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_read_own ON public.push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete_own ON public.push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

/* ------------------------------------------------------------------ settings */

CREATE TABLE IF NOT EXISTS public.notification_settings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  friend_request boolean NOT NULL DEFAULT true,
  friend_accepted boolean NOT NULL DEFAULT true,
  friend_challenge boolean NOT NULL DEFAULT true,
  room_invite boolean NOT NULL DEFAULT true,
  tournament_starting boolean NOT NULL DEFAULT true,
  daily_streak boolean NOT NULL DEFAULT true,
  asked_at timestamptz,
  declined_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.notification_settings TO authenticated;
GRANT INSERT (user_id, enabled, friend_request, friend_accepted, friend_challenge, room_invite, tournament_starting, daily_streak)
  ON public.notification_settings TO authenticated;
GRANT UPDATE (enabled, friend_request, friend_accepted, friend_challenge, room_invite, tournament_starting, daily_streak)
  ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;
DROP POLICY IF EXISTS notification_settings_read_own ON public.notification_settings;
CREATE POLICY notification_settings_read_own ON public.notification_settings
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS notification_settings_insert_own ON public.notification_settings;
CREATE POLICY notification_settings_insert_own ON public.notification_settings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS notification_settings_update_own ON public.notification_settings;
CREATE POLICY notification_settings_update_own ON public.notification_settings
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

/* ------------------------------------------------------------------ the log */

CREATE TABLE IF NOT EXISTS public.notification_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('friend_request', 'friend_accepted', 'friend_challenge', 'room_invite', 'tournament_starting', 'daily_streak')),
  -- False for room invites (outside the daily cap).
  counts_cap boolean NOT NULL,
  -- One notification per key and player (the streak reminder's "daily_streak:<UK day>"); null: no such rule.
  dedupe_key text CHECK (dedupe_key IS NULL OR char_length(dedupe_key) <= 120),
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_log_once UNIQUE (user_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS notification_log_user_sent ON public.notification_log (user_id, sent_at DESC);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.notification_log TO service_role;

/* ------------------------------------------------------------------ service-role functions */

-- Takes one notification's place in the player's log, atomically (one player at a time): 'duplicate' when the key was
-- already used, 'capped' when it counts against the cap and p_cap are already logged since p_since (the player's
-- local midnight), else the row is written and 'ok'. The caller sends only on 'ok'.
CREATE OR REPLACE FUNCTION public.push_reserve(
  p_user_id uuid,
  p_event text,
  p_counts_cap boolean,
  p_since timestamptz,
  p_cap integer,
  p_dedupe_key text
) RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('push:' || p_user_id::text, 0));
  IF p_dedupe_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.notification_log WHERE user_id = p_user_id AND dedupe_key = p_dedupe_key
  ) THEN
    RETURN 'duplicate';
  END IF;
  IF p_counts_cap THEN
    SELECT count(*) INTO n FROM public.notification_log
     WHERE user_id = p_user_id AND counts_cap AND sent_at >= p_since;
    IF n >= p_cap THEN
      RETURN 'capped';
    END IF;
  END IF;
  INSERT INTO public.notification_log (user_id, event, counts_cap, dedupe_key)
  VALUES (p_user_id, p_event, p_counts_cap, p_dedupe_key);
  RETURN 'ok';
END
$$;
REVOKE ALL ON FUNCTION public.push_reserve(uuid, text, boolean, timestamptz, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_reserve(uuid, text, boolean, timestamptz, integer, text) TO service_role;

-- Who may get the Daily streak reminder for UK day p_day: an account (not being deleted) with a device, notifications
-- and the reminder on (no settings row: the defaults, on), a Daily started in the 60 days before p_day and none on
-- p_day, not yet reminded for p_day; with each, its newest device's time zone. Read from train C's Daily history
-- (public.daily_history, the starts the account's streak is worked out from). This is only the narrowing: the server
-- then asks C2's dailyStreakFor (src/lib/duel/dailyStreak.server.ts) for the streak itself, freezes included, and
-- reminds only a live streak with today's Daily not played (src/lib/push/notify.server.ts).
CREATE OR REPLACE FUNCTION public.push_streak_candidates(p_day date)
RETURNS TABLE (user_id uuid, time_zone text)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p.user_id,
         (SELECT s.time_zone FROM public.push_subscriptions s WHERE s.user_id = p.user_id ORDER BY s.last_seen_at DESC LIMIT 1)
    FROM public.profiles p
    LEFT JOIN public.notification_settings ns ON ns.user_id = p.user_id
   WHERE p.deletion_requested_at IS NULL
     AND EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = p.user_id)
     AND coalesce(ns.enabled, true) AND coalesce(ns.daily_streak, true)
     AND EXISTS (SELECT 1 FROM public.daily_history(p.user_id) h WHERE h.day < p_day AND h.day >= p_day - 60)
     AND NOT EXISTS (SELECT 1 FROM public.daily_history(p.user_id) h WHERE h.day = p_day)
     AND NOT EXISTS (
       SELECT 1 FROM public.notification_log l
        WHERE l.user_id = p.user_id AND l.dedupe_key = 'daily_streak:' || p_day::text
     )
   ORDER BY p.user_id
$$;
REVOKE ALL ON FUNCTION public.push_streak_candidates(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_streak_candidates(date) TO service_role;

/* ------------------------------------------------------------------ friend events (train B1's outbox) */

-- Which of B1's public.friend_events have been taken for a notification: one row per event, claimed once (so the
-- request's own dispatch and the five-minute sweep never both send it). Goes with its event.
CREATE TABLE IF NOT EXISTS public.push_friend_deliveries (
  event_id bigint PRIMARY KEY REFERENCES public.friend_events (id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_friend_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_friend_deliveries FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.push_friend_deliveries TO service_role;

-- Claims up to p_limit friend events made since p_since (all recipients, oldest first) that no one has claimed, and
-- returns them. Atomic: two dispatches at once never return the same event.
CREATE OR REPLACE FUNCTION public.push_claim_friend_events(p_since timestamptz, p_limit integer)
RETURNS TABLE (id bigint, recipient_id uuid, actor_id uuid, kind text, payload jsonb, created_at timestamptz)
LANGUAGE sql
SET search_path = public
AS $$
  WITH c AS (
    INSERT INTO public.push_friend_deliveries (event_id)
    SELECT e.id FROM public.friend_events e
     WHERE e.created_at >= p_since
       AND NOT EXISTS (SELECT 1 FROM public.push_friend_deliveries d WHERE d.event_id = e.id)
     ORDER BY e.id
     LIMIT greatest(0, least(p_limit, 500))
    ON CONFLICT (event_id) DO NOTHING
    RETURNING event_id
  )
  SELECT e.id, e.recipient_id, e.actor_id, e.kind, e.payload, e.created_at
    FROM public.friend_events e JOIN c ON c.event_id = e.id
   ORDER BY e.id
$$;
REVOKE ALL ON FUNCTION public.push_claim_friend_events(timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_claim_friend_events(timestamptz, integer) TO service_role;

-- The log's retention: rows older than 30 days (the cap looks back one day, the reminder's key one).
CREATE OR REPLACE FUNCTION public.push_log_retention() RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  DELETE FROM public.notification_log WHERE sent_at < now() - interval '30 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM public.push_friend_deliveries WHERE claimed_at < now() - interval '30 days';
  RETURN n;
END
$$;
REVOKE ALL ON FUNCTION public.push_log_retention() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_log_retention() TO service_role;

DO $retention$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
      PERFORM cron.schedule('push-log-retention', '29 4 * * *', 'SELECT public.push_log_retention()');
    EXCEPTION WHEN OTHERS THEN
      PERFORM migration_log.note('warning', format('push log retention not scheduled (pg_cron: %s); see docs/push-notifications.md', SQLERRM));
    END;
  ELSE
    PERFORM migration_log.note('warning', 'push log retention not scheduled: pg_cron is not available on this database; see docs/push-notifications.md');
  END IF;
END
$retention$;

/* ------------------------------------------------------------------ analytics events */

-- notification_opt_in (props.answer accepted|declined, props.moment), notification_sent (props.event, props.devices),
-- notification_opened (props.event). The list is read from the constraint as it stands and these three are added.
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
    FROM (SELECT unnest(existing) AS e UNION SELECT unnest(ARRAY['notification_opt_in', 'notification_sent', 'notification_opened'])) AS u;
  ALTER TABLE analytics.events DROP CONSTRAINT IF EXISTS events_event_check;
  EXECUTE format(
    'ALTER TABLE analytics.events ADD CONSTRAINT events_event_check CHECK (event IN (%s)) NOT VALID',
    (SELECT string_agg(quote_literal(e), ', ') FROM unnest(wanted) AS e)
  );
  ALTER TABLE analytics.events VALIDATE CONSTRAINT events_event_check;
END
$events$;
