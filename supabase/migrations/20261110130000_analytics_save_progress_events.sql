-- Save-your-progress events for analytics (Wave 1, train 2, session 3; 10 Nov 2026; docs/analytics.md,
-- docs/accounts/README.md "Sign-up screens"). Non-destructive and idempotent: it widens analytics.events' list of
-- events (src/lib/analytics/events.ts ANALYTICS_EVENTS holds the same list) by replacing the CHECK under its own name,
-- as 20261110120100 did; no row is touched, and every event allowed before is still allowed. Approved by Joe in the
-- sign-up screens session, 10 Nov 2026.
--
-- New: save_progress_shown, save_progress_tapped, save_progress_dismissed (props: prompt sheet|popup, from
-- room|daily|challenge, method email|google|apple on a tap; never personal data or free text). Written only by the
-- server through recordSaveProgressFn (src/lib/account/saveProgress.functions.ts).

ALTER TABLE analytics.events DROP CONSTRAINT IF EXISTS events_event_check;
ALTER TABLE analytics.events ADD CONSTRAINT events_event_check CHECK (event IN (
  'app_opened', 'game_started', 'game_finished', 'room_created', 'room_joined', 'room_started', 'room_finished',
  'daily_started', 'daily_finished', 'challenge_created', 'challenge_played', 'share_tapped', 'invite_opened',
  'error_shown', 'offline_game_played',
  'sign_up_started', 'sign_up_completed', 'sign_in', 'sign_out', 'username_changed', 'account_deletion_requested',
  'under_thirteen_refused',
  'save_progress_shown', 'save_progress_tapped', 'save_progress_dismissed'
)) NOT VALID;
ALTER TABLE analytics.events VALIDATE CONSTRAINT events_event_check;
