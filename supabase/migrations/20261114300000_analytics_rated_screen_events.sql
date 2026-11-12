-- Rated match screen events for analytics (wave 3, session W3c; 11 Nov 2026; docs/analytics.md). Non-destructive and
-- idempotent: it widens analytics.events' list of events (src/lib/analytics/events.ts ANALYTICS_EVENTS holds the same
-- list) by replacing the CHECK under its own name; no row is touched, and every event allowed before is still allowed.
--
-- New: play_card_tapped (props.pick a pick's fixed id, props.placement), vs_shown (props.source live|recorded),
-- result_viewed (props.outcome won|lost, props.placement), next_match_tapped (no props), tier_ladder_viewed
-- (props.from home|result|reveal|profile): fixed words and booleans, never personal data, a rating or free text.
-- Written only by the server through recordRatedEventFn (src/lib/rated/ratedEvents.functions.ts).
--
-- The list is read from the constraint as it stands and these five are added to it (not written out in full), so an
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
    FROM (SELECT unnest(existing) AS e UNION SELECT unnest(ARRAY['play_card_tapped', 'vs_shown', 'result_viewed', 'next_match_tapped', 'tier_ladder_viewed'])) AS u;
  ALTER TABLE analytics.events DROP CONSTRAINT IF EXISTS events_event_check;
  EXECUTE format(
    'ALTER TABLE analytics.events ADD CONSTRAINT events_event_check CHECK (event IN (%s)) NOT VALID',
    (SELECT string_agg(quote_literal(e), ', ') FROM unnest(wanted) AS e)
  );
  ALTER TABLE analytics.events VALIDATE CONSTRAINT events_event_check;
END
$events$;
