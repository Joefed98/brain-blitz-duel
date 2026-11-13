-- The rated queue's cooldown event for analytics (13 Nov 2026, Security A; docs/analytics.md).
-- Non-destructive and idempotent: it widens analytics.events' list of events (src/lib/analytics/events.ts
-- ANALYTICS_EVENTS holds the same list) by replacing the CHECK under its own name; no row is touched, and every event
-- allowed before is still allowed.
--
-- New, written by the server only (src/lib/rated/rated.server.ts joinQueue): rated_cooldown_applied, a search refused
-- while the player's wait after leaving matches during set-up runs (props.aborts, props.wait_s). Fixed words and
-- numbers only, never personal data.
--
-- The list is read from the constraint as it stands and this event is added to it (not written out in full), so an
-- event another migration added before this one is kept whatever the order.

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
    FROM (SELECT unnest(existing) AS e UNION SELECT unnest(ARRAY['rated_cooldown_applied'])) AS u;
  ALTER TABLE analytics.events DROP CONSTRAINT IF EXISTS events_event_check;
  EXECUTE format(
    'ALTER TABLE analytics.events ADD CONSTRAINT events_event_check CHECK (event IN (%s)) NOT VALID',
    (SELECT string_agg(quote_literal(e), ', ') FROM unnest(wanted) AS e)
  );
  ALTER TABLE analytics.events VALIDATE CONSTRAINT events_event_check;
END
$events$;
