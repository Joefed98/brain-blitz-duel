-- The arcade wall-clock trial's events for analytics (13 Nov 2026, Security B; docs/security/arcade-wall-clock.md).
-- Non-destructive and idempotent: it widens analytics.events' list of events (src/lib/analytics/events.ts
-- ANALYTICS_EVENTS holds the same list) by replacing the CHECK under its own name; no row is touched, and every event
-- allowed before is still allowed.
--
-- New: arcade_run_slow, written by the server (src/lib/round/wallClock.server.ts) for a room or practice arcade run
-- that arrived past run length x 1.3 + 15 s (game, mode, props.run_ms, props.over_ms, in practice props.token_age_s);
-- arcade_run_timed, sent by the phone (CLIENT_EVENTS) once a played run (game, props.wall_ms, props.hidden_ms,
-- props.dropped_ticks, props.run_ticks). Numbers only, never a score or personal data. Log only: nothing reads them for
-- grading.
--
-- The list is read from the constraint as it stands and these are added to it (not written out in full), so an event
-- another migration added before this one is kept whatever the order.

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
    FROM (SELECT unnest(existing) AS e UNION SELECT unnest(ARRAY['arcade_run_slow', 'arcade_run_timed'])) AS u;
  ALTER TABLE analytics.events DROP CONSTRAINT IF EXISTS events_event_check;
  EXECUTE format(
    'ALTER TABLE analytics.events ADD CONSTRAINT events_event_check CHECK (event IN (%s)) NOT VALID',
    (SELECT string_agg(quote_literal(e), ', ') FROM unnest(wanted) AS e)
  );
  ALTER TABLE analytics.events VALIDATE CONSTRAINT events_event_check;
END
$events$;
