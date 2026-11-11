-- Pass events for analytics (Wave 2, train D, session D2; 13 Nov 2026; docs/analytics.md, docs/economy/pass.md).
-- Non-destructive and idempotent: it widens analytics.events' list of events (src/lib/analytics/events.ts
-- ANALYTICS_EVENTS holds the same list) by replacing the CHECK under its own name; no row is touched, and every event
-- allowed before is still allowed.
--
-- New, all written by the server only (src/lib/pass/pass.server.ts through src/lib/data/events.server.ts):
--   pass_bought (props.season, props.test), pass_level_reached (props.season, props.level),
--   reward_claimed (props.season, props.track, props.level, props.kind),
--   weekly_challenge_completed (props.tier, props.challenge). Fixed words and numbers only, never personal data.
--
-- The list is read from the constraint as it stands and these four are added to it (not written out in full), so an
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
    FROM (SELECT unnest(existing) AS e UNION SELECT unnest(ARRAY['pass_bought', 'pass_level_reached', 'reward_claimed', 'weekly_challenge_completed'])) AS u;
  ALTER TABLE analytics.events DROP CONSTRAINT IF EXISTS events_event_check;
  EXECUTE format(
    'ALTER TABLE analytics.events ADD CONSTRAINT events_event_check CHECK (event IN (%s)) NOT VALID',
    (SELECT string_agg(quote_literal(e), ', ') FROM unnest(wanted) AS e)
  );
  ALTER TABLE analytics.events VALIDATE CONSTRAINT events_event_check;
END
$events$;
