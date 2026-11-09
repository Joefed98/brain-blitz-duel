-- Our own analytics (Wave 0 night 2, 9 Nov 2026; docs/analytics.md). Non-destructive and idempotent: it only creates
-- objects, and safe to apply more than once.
--
-- One table of events, written by the server (src/lib/data/events.server.ts, the one writer) through the RPC below,
-- plus a per-player view Joe reads in the Supabase dashboard. Nothing players see reads any of it.
--
-- Privacy: the schema `analytics` is NOT in the API's exposed schemas and anon / authenticated get no grant on it.
-- The table has no column for an email, an IP address, a user agent or a name: platform is coarse (ios, android,
-- desktop), worked out on the server from the user agent, which is then dropped. The view reads names only from the
-- existing room and async-attempt tables.
--
-- The existing beta tables (room_events, room_joins, async_events, share_events, challenge_events, terms_events,
-- practice_plays) are untouched; analytics.events is written alongside them.

CREATE SCHEMA IF NOT EXISTS analytics;
REVOKE ALL ON SCHEMA analytics FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS analytics.events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- When it happened: the server's time, or the phone's for an event queued offline (held to the past 30 days).
  occurred_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz NOT NULL DEFAULT now(),
  event text NOT NULL CHECK (event IN (
    'app_opened', 'game_started', 'game_finished', 'room_created', 'room_joined', 'room_started', 'room_finished',
    'daily_started', 'daily_finished', 'challenge_created', 'challenge_played', 'share_tapped', 'invite_opened',
    'error_shown', 'offline_game_played'
  )),
  -- The Supabase auth user id (anonymous players have one too); null for a room-level event with no one player.
  player_id uuid,
  game text CHECK (game IS NULL OR char_length(game) <= 40),
  -- 'rated' comes later (a new migration widens this check).
  mode text CHECK (mode IS NULL OR mode IN ('room', 'daily', 'challenge', 'practice')),
  score integer,
  completed boolean,
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  room_id uuid,
  app_version text CHECK (app_version IS NULL OR char_length(app_version) <= 64),
  platform text CHECK (platform IS NULL OR platform IN ('ios', 'android', 'desktop')),
  -- As stored on results (src/lib/inputType.ts): touch, mouse, keyboard or a mix such as mouse+keyboard.
  input_type text CHECK (input_type IS NULL OR input_type ~ '^(touch|mouse|keyboard)(\+(touch|mouse|keyboard)){0,2}$'),
  -- Small event-specific extras (a reason, a source, an error code).
  props jsonb CHECK (props IS NULL OR (jsonb_typeof(props) = 'object' AND pg_column_size(props) <= 2048))
);

CREATE INDEX IF NOT EXISTS analytics_events_occurred_at_idx ON analytics.events (occurred_at);
CREATE INDEX IF NOT EXISTS analytics_events_player_occurred_idx ON analytics.events (player_id, occurred_at);
CREATE INDEX IF NOT EXISTS analytics_events_event_idx ON analytics.events (event);

-- RLS on with no policies: no role but the owner (and the dashboard's postgres) reads or writes it.
ALTER TABLE analytics.events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON analytics.events FROM PUBLIC, anon, authenticated, service_role;

-- The one write path: the server's service-role client calls this RPC (public, so PostgREST can reach it without
-- exposing the schema). EXECUTE for service_role only. At most 50 events a call.
CREATE OR REPLACE FUNCTION public.record_analytics_events(p_events jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = analytics, public
AS $$
DECLARE
  n integer;
BEGIN
  IF jsonb_typeof(p_events) IS DISTINCT FROM 'array' OR jsonb_array_length(p_events) > 50 THEN
    RAISE EXCEPTION 'record_analytics_events: expected an array of at most 50 events';
  END IF;
  INSERT INTO analytics.events
    (occurred_at, event, player_id, game, mode, score, completed, duration_ms, room_id, app_version, platform,
     input_type, props)
  SELECT coalesce(e.occurred_at, now()), e.event, e.player_id, e.game, e.mode, e.score, e.completed, e.duration_ms,
         e.room_id, e.app_version, e.platform, e.input_type, e.props
    FROM jsonb_to_recordset(p_events) AS e(
      occurred_at timestamptz, event text, player_id uuid, game text, mode text, score integer, completed boolean,
      duration_ms integer, room_id uuid, app_version text, platform text, input_type text, props jsonb);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.record_analytics_events(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_analytics_events(jsonb) TO service_role;

-- The player activity view: one row per player, a player being anyone with at least one game_started event.
-- Read it in the dashboard (SQL editor: SELECT * FROM analytics.player_activity ORDER BY last_played DESC;
-- the table editor's schema picker shows `analytics`). Not reachable from the app or the API.
CREATE OR REPLACE VIEW analytics.player_activity AS
WITH players AS (
  SELECT player_id,
         min(occurred_at) AS first_seen,
         max(occurred_at) AS last_played,
         count(*) AS games_played,
         count(DISTINCT (occurred_at AT TIME ZONE 'Europe/London')::date) AS days_active
    FROM analytics.events
   WHERE event = 'game_started' AND player_id IS NOT NULL
   GROUP BY player_id
),
seen AS (
  SELECT player_id, min(occurred_at) AS first_any
    FROM analytics.events
   WHERE player_id IN (SELECT player_id FROM players)
   GROUP BY player_id
),
favourites AS (
  SELECT player_id, array_agg(game ORDER BY plays DESC, game) FILTER (WHERE rank <= 3) AS favourite_games
    FROM (
      SELECT player_id, game, count(*) AS plays,
             row_number() OVER (PARTITION BY player_id ORDER BY count(*) DESC, game) AS rank
        FROM analytics.events
       WHERE event = 'game_started' AND player_id IS NOT NULL AND game IS NOT NULL
       GROUP BY player_id, game
    ) ranked
   GROUP BY player_id
),
names AS (
  -- Their latest display name from the existing tables (a room seat or a daily / challenge attempt).
  -- WAVE 1: a username column arrives then; read it first here (coalesce(username, latest room/attempt name)).
  SELECT DISTINCT ON (user_id) user_id, display_name
    FROM (
      SELECT user_id, display_name, joined_at AS at FROM public.duel_players
      UNION ALL
      SELECT user_id, display_name, started_at AS at FROM public.async_attempts
    ) named
   ORDER BY user_id, at DESC
)
SELECT p.player_id,
       n.display_name AS name,
       least(p.first_seen, s.first_any) AS first_seen,
       p.last_played,
       p.games_played,
       coalesce(f.favourite_games, ARRAY[]::text[]) AS favourite_games,
       p.days_active
  FROM players p
  LEFT JOIN seen s USING (player_id)
  LEFT JOIN favourites f USING (player_id)
  LEFT JOIN names n ON n.user_id = p.player_id;

REVOKE ALL ON analytics.player_activity FROM PUBLIC, anon, authenticated, service_role;

-- Retention: raw events older than 13 months are deleted daily. The delete lives in this function's body (a
-- scheduled clean-up of analytics rows only); pg_cron calls it at 03:17 UTC.
CREATE OR REPLACE FUNCTION analytics.purge_old_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = analytics
AS $$
DECLARE
  n integer;
BEGIN
  DELETE FROM analytics.events WHERE occurred_at < now() - interval '13 months';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION analytics.purge_old_events() FROM PUBLIC, anon, authenticated, service_role;

-- pg_cron where the database offers it (Supabase does; a plain local PostgreSQL usually doesn't, and then this only
-- warns, so the from-scratch proof still applies). cron.schedule with a job name replaces an existing job of that
-- name, so applying twice keeps one job. Check on the live project: SELECT jobname, schedule, command FROM cron.job;
DO $retention$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
      PERFORM cron.schedule('analytics-retention', '17 3 * * *', 'SELECT analytics.purge_old_events()');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'analytics retention not scheduled (pg_cron: %); see docs/analytics.md', SQLERRM;
    END;
  ELSE
    RAISE WARNING 'analytics retention not scheduled: pg_cron is not available on this database; see docs/analytics.md';
  END IF;
END
$retention$;
