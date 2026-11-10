-- Account events for analytics (Wave 1, train 1, session 1; 10 Nov 2026; docs/analytics.md, docs/accounts/README.md).
-- Non-destructive and idempotent: it widens analytics.events' list of events (src/lib/analytics/events.ts
-- ANALYTICS_EVENTS holds the same list) by replacing the CHECK under its own name; no row is touched, and every
-- event allowed before is still allowed.
--
-- New: sign_up_started, sign_up_completed (props.method), sign_in (props.method), sign_out, username_changed,
-- account_deletion_requested, under_thirteen_refused (never a date of birth or an age).

ALTER TABLE analytics.events DROP CONSTRAINT IF EXISTS events_event_check;
ALTER TABLE analytics.events ADD CONSTRAINT events_event_check CHECK (event IN (
  'app_opened', 'game_started', 'game_finished', 'room_created', 'room_joined', 'room_started', 'room_finished',
  'daily_started', 'daily_finished', 'challenge_created', 'challenge_played', 'share_tapped', 'invite_opened',
  'error_shown', 'offline_game_played',
  'sign_up_started', 'sign_up_completed', 'sign_in', 'sign_out', 'username_changed', 'account_deletion_requested',
  'under_thirteen_refused'
)) NOT VALID;
ALTER TABLE analytics.events VALIDATE CONSTRAINT events_event_check;
