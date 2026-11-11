-- Tournament events for analytics (wave 4, W4b; 11 Nov 2026; docs/tournaments/interface.md section 8).
-- Non-destructive and idempotent: it widens analytics.events' list of events (src/lib/analytics/events.ts
-- ANALYTICS_EVENTS holds the same list) and its list of modes (ANALYTICS_MODES) by replacing each CHECK under its own
-- name; no row is touched, and every event and mode allowed before is still allowed.
--
-- New events: tournament_entered (props.kind, props.entry), tournament_finished (props.kind, props.place),
-- prize_paid (props.kind, props.place, props.coins). New mode: tournament (the Score Attack's game events). Fixed
-- words and numbers only, never personal data or free text. Written only by the server
-- (src/lib/tournaments/tournaments.server.ts, src/lib/duel/asyncRoom.server.ts).
--
-- Each list is read from its constraint as it stands and these are added to it (not written out in full), so an
-- event or mode another migration added before this one is kept whatever the order.

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
          UNION SELECT unnest(ARRAY['tournament_entered', 'tournament_finished', 'prize_paid'])) AS u;
  ALTER TABLE analytics.events DROP CONSTRAINT IF EXISTS events_event_check;
  EXECUTE format(
    'ALTER TABLE analytics.events ADD CONSTRAINT events_event_check CHECK (event IN (%s)) NOT VALID',
    (SELECT string_agg(quote_literal(e), ', ') FROM unnest(wanted) AS e)
  );
  ALTER TABLE analytics.events VALIDATE CONSTRAINT events_event_check;

  SELECT coalesce(array_agg(DISTINCT m[1]), ARRAY[]::text[])
    INTO existing
    FROM pg_constraint c,
         LATERAL regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''', 'g') AS m
   WHERE c.conrelid = 'analytics.events'::regclass AND c.conname = 'events_mode_check';
  SELECT array_agg(e ORDER BY e) INTO wanted
    FROM (SELECT unnest(existing) AS e UNION SELECT 'tournament') AS u;
  ALTER TABLE analytics.events DROP CONSTRAINT IF EXISTS events_mode_check;
  EXECUTE format(
    'ALTER TABLE analytics.events ADD CONSTRAINT events_mode_check CHECK (mode IS NULL OR mode IN (%s)) NOT VALID',
    (SELECT string_agg(quote_literal(e), ', ') FROM unnest(wanted) AS e)
  );
  ALTER TABLE analytics.events VALIDATE CONSTRAINT events_mode_check;
END
$events$;
