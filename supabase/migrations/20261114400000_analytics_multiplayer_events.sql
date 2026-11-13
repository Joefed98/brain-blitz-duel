-- Rated 4- and 8-player match events for analytics (wave 3, session W3d; 11 Nov 2026; docs/rated/multiplayer.md).
-- Non-destructive and idempotent: it widens analytics.events' list of events (src/lib/analytics/events.ts
-- ANALYTICS_EVENTS holds the same list) by replacing the CHECK under its own name; no row is touched, and every event
-- allowed before is still allowed.
--
-- New: multiplayer_match_started (props.size, props.live_seats, props.recorded_seats), multiplayer_match_finished
-- (props.size, props.placing). Written only by the server (src/lib/rated/multi/multi.server.ts).
--
-- The list is read from the constraint as it stands and these two are added to it (not written out in full), so an
-- event another migration added before this one (W3a's, W3b's, W3c's, wave 2's) is kept whatever the order.

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
    FROM (SELECT unnest(existing) AS e
          UNION SELECT unnest(ARRAY['multiplayer_match_started', 'multiplayer_match_finished'])) AS u;
  ALTER TABLE analytics.events DROP CONSTRAINT IF EXISTS events_event_check;
  EXECUTE format(
    'ALTER TABLE analytics.events ADD CONSTRAINT events_event_check CHECK (event IN (%s)) NOT VALID',
    (SELECT string_agg(quote_literal(e), ', ') FROM unnest(wanted) AS e)
  );
  ALTER TABLE analytics.events VALIDATE CONSTRAINT events_event_check;
END
$events$;
