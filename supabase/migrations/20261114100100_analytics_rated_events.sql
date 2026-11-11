-- Rated play's analytics events (wave 3, session W3a; 14 Nov 2026; docs/rated/README.md). Additive: adds
-- rated_match_finished, placement_finished and tier_changed to analytics.events' list. The list is read from the
-- constraint as it stands (as C2's migration did), so events other migrations added are kept whatever the order.
-- src/lib/analytics/events.ts ANALYTICS_EVENTS holds the same list.
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
          UNION SELECT unnest(ARRAY['rated_match_finished', 'placement_finished', 'tier_changed'])) AS u;
  ALTER TABLE analytics.events DROP CONSTRAINT IF EXISTS events_event_check;
  EXECUTE format(
    'ALTER TABLE analytics.events ADD CONSTRAINT events_event_check CHECK (event IN (%s)) NOT VALID',
    (SELECT string_agg(quote_literal(e), ', ') FROM unnest(wanted) AS e)
  );
  ALTER TABLE analytics.events VALIDATE CONSTRAINT events_event_check;
END
$events$;
