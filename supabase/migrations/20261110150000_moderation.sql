-- Safety: reports, the automatic chat mute and Joe's review tools (Wave 1, train 2, session 4; 10 Nov 2026;
-- docs/moderation.md). Non-destructive and idempotent: it adds columns to public.room_reports (every existing row
-- keeps its values; the new columns are empty on them), creates the `moderation` schema with two tables, a view,
-- functions and one trigger, and widens analytics.events' list of events. No existing row is changed by applying it.
--
-- Who can reach what:
--   * the `moderation` schema (its tables, view and Joe's functions) is not exposed to the API: PUBLIC, anon,
--     authenticated and service_role have nothing there. Joe uses it from the Supabase dashboard's SQL editor;
--   * the server (service role) reaches it only through three public functions: file_room_report,
--     moderation_status and moderation_ack;
--   * clients get nothing new.
--
-- The automatic chat mute: three reports for abusive chat or an offensive name, from three different players, within
-- 24 hours, mute the reported player's room chat for 24 hours (enforced by the server, chat.functions.ts). One report
-- per reporter per reported player per UK day counts; repeats are stored but ignored for the mute.

/* ------------------------------------------------------------------ schema */

CREATE SCHEMA IF NOT EXISTS moderation;
REVOKE ALL ON SCHEMA moderation FROM PUBLIC, anon, authenticated, service_role;

/* ------------------------------------------------------------------ reports: the existing table, with context */

-- reported_user_id: whom the report is about (a message's sender, or the player whose name was tapped).
-- reason: offensive_name, abusive_chat or cheating (rows from before this migration have none).
-- message_text / reported_name: the context as it was when reported (kept even if the message or name changes).
-- counts: whether this report counts towards the automatic mute (the first from this reporter about this player
--         on this UK day).
-- resolved_at / resolution_note: set by moderation.resolve.
ALTER TABLE public.room_reports ADD COLUMN IF NOT EXISTS reported_user_id uuid;
ALTER TABLE public.room_reports ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.room_reports ADD COLUMN IF NOT EXISTS message_text text;
ALTER TABLE public.room_reports ADD COLUMN IF NOT EXISTS reported_name text;
ALTER TABLE public.room_reports ADD COLUMN IF NOT EXISTS uk_day date;
ALTER TABLE public.room_reports ADD COLUMN IF NOT EXISTS counts boolean NOT NULL DEFAULT false;
ALTER TABLE public.room_reports ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.room_reports ADD COLUMN IF NOT EXISTS resolution_note text;

ALTER TABLE public.room_reports DROP CONSTRAINT IF EXISTS room_reports_reason_check;
ALTER TABLE public.room_reports ADD CONSTRAINT room_reports_reason_check
  CHECK (reason IS NULL OR reason IN ('offensive_name', 'abusive_chat', 'cheating'));
ALTER TABLE public.room_reports DROP CONSTRAINT IF EXISTS room_reports_text_length_check;
ALTER TABLE public.room_reports ADD CONSTRAINT room_reports_text_length_check
  CHECK ((message_text IS NULL OR char_length(message_text) <= 500) AND (reported_name IS NULL OR char_length(reported_name) <= 64));

CREATE INDEX IF NOT EXISTS room_reports_reported_idx ON public.room_reports (reported_user_id, created_at DESC)
  WHERE reported_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS room_reports_message_idx ON public.room_reports (message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS room_reports_created_idx ON public.room_reports (created_at);

/* ------------------------------------------------------------------ a player's moderation state */

-- One row per player who has ever been reported or acted on (guests included: keyed by the auth user id).
CREATE TABLE IF NOT EXISTS moderation.player_state (
  user_id uuid PRIMARY KEY,
  -- Chat muted until (the automatic mute: 24 hours). muted_at: when the latest mute began; mute_lifted_at: when Joe
  -- lifted one early. Reports before the later of the two never count towards a new mute.
  muted_until timestamptz,
  muted_at timestamptz,
  mute_lifted_at timestamptz,
  -- Banned from rooms and chat until ('infinity' = permanent). Solo play is never affected.
  banned_until timestamptz,
  ban_note text,
  -- A one-time notice shown on the player's next open (moderation.warn).
  warning_note text,
  warning_pending boolean NOT NULL DEFAULT false,
  -- moderation.force_rename: a temporary energy name is given by the server on the next open (rename_temp_applied),
  -- then the player must pick a new name (rename_pending stays true until they do).
  rename_pending boolean NOT NULL DEFAULT false,
  rename_temp_applied boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE moderation.player_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON moderation.player_state FROM PUBLIC, anon, authenticated, service_role;

/* ------------------------------------------------------------------ the action log */

-- Every moderation action, Joe's and the system's: who (the database role that ran it; 'system' for the automatic
-- mute and the server's own steps), what, when, about whom, and the report it concerns.
CREATE TABLE IF NOT EXISTS moderation.actions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  user_id uuid,
  report_id uuid,
  detail jsonb,
  by_role text NOT NULL DEFAULT current_user
);
CREATE INDEX IF NOT EXISTS moderation_actions_user_idx ON moderation.actions (user_id, at DESC);
CREATE INDEX IF NOT EXISTS moderation_actions_at_idx ON moderation.actions (at);
ALTER TABLE moderation.actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON moderation.actions FROM PUBLIC, anon, authenticated, service_role;

/* ------------------------------------------------------------------ analytics: the three new events */

-- src/lib/analytics/events.ts ANALYTICS_EVENTS holds the same list (analytics-events-check). report_sent carries
-- props.reason only (never the message), chat_muted nothing more, moderation_action props.type only.
DO $events$
BEGIN
  IF to_regclass('analytics.events') IS NOT NULL THEN
    ALTER TABLE analytics.events DROP CONSTRAINT IF EXISTS events_event_check;
    ALTER TABLE analytics.events ADD CONSTRAINT events_event_check CHECK (event IN (
      'app_opened', 'game_started', 'game_finished', 'room_created', 'room_joined', 'room_started', 'room_finished',
      'daily_started', 'daily_finished', 'challenge_created', 'challenge_played', 'share_tapped', 'invite_opened',
      'error_shown', 'offline_game_played',
      'sign_up_started', 'sign_up_completed', 'sign_in', 'sign_out', 'username_changed', 'account_deletion_requested',
      'under_thirteen_refused',
      'save_progress_shown', 'save_progress_tapped', 'save_progress_dismissed',
      'report_sent', 'chat_muted', 'moderation_action'
    )) NOT VALID;
    ALTER TABLE analytics.events VALIDATE CONSTRAINT events_event_check;
  END IF;
END
$events$;

/* ------------------------------------------------------------------ helpers */

-- Writes one action line and one moderation_action analytics event (its type only). Joe's functions run in the
-- database, where src/lib/data/events.server.ts can't run, so they call the same record_analytics_events that module
-- calls, with the same row shape.
CREATE OR REPLACE FUNCTION moderation.log(
  p_action text, p_user_id uuid, p_report_id uuid, p_detail jsonb, p_by text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, moderation
AS $$
BEGIN
  INSERT INTO moderation.actions (action, user_id, report_id, detail, by_role)
  VALUES (p_action, p_user_id, p_report_id, p_detail, coalesce(p_by, current_user));
  IF to_regprocedure('public.record_analytics_events(jsonb)') IS NOT NULL THEN
    PERFORM public.record_analytics_events(
      jsonb_build_array(jsonb_build_object('event', 'moderation_action', 'props', jsonb_build_object('type', p_action))));
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION moderation.log(text, uuid, uuid, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;

-- A player named in one of Joe's calls: an auth user id (guests have no username: take theirs from
-- moderation.report_queue) or an account's username (any capitals).
CREATE OR REPLACE FUNCTION moderation.player(p_player text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, moderation
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_player ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_id := p_player::uuid;
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_id)
       OR EXISTS (SELECT 1 FROM moderation.player_state WHERE user_id = v_id)
       OR EXISTS (SELECT 1 FROM public.room_reports WHERE reported_user_id = v_id) THEN
      RETURN v_id;
    END IF;
    RAISE EXCEPTION 'moderation: no player with id %', p_player;
  END IF;
  SELECT user_id INTO v_id FROM public.profiles WHERE username_key = lower(trim(p_player));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'moderation: no account named % (for a guest, give their user_id from moderation.report_queue)', p_player;
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION moderation.player(text) FROM PUBLIC, anon, authenticated, service_role;

-- The player's state row, created when missing, locked for this transaction.
CREATE OR REPLACE FUNCTION moderation.state_for_update(p_user_id uuid)
RETURNS moderation.player_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, moderation
AS $$
DECLARE
  v_row moderation.player_state%ROWTYPE;
BEGIN
  INSERT INTO moderation.player_state (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_row FROM moderation.player_state WHERE user_id = p_user_id FOR UPDATE;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION moderation.state_for_update(uuid) FROM PUBLIC, anon, authenticated, service_role;

/* ------------------------------------------------------------------ the server's three calls (service role) */

-- Files one report (src/lib/data/chat.server.ts insertRoomReport). The server has checked that the reporter and the
-- reported player are in the room and that a message belongs to it. Answers { id, counts, muted } where `muted` is
-- true only when this report started a mute.
CREATE OR REPLACE FUNCTION public.file_room_report(
  p_duel_id uuid, p_message_id uuid, p_reporter_user_id uuid, p_reported_user_id uuid, p_reason text,
  p_message_text text, p_reported_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, moderation
AS $$
DECLARE
  v_reason text := coalesce(p_reason, 'abusive_chat');
  v_day date := (now() AT TIME ZONE 'Europe/London')::date;
  v_state moderation.player_state%ROWTYPE;
  v_counts boolean := false;
  v_id uuid;
  v_since timestamptz;
  v_reporters integer;
  v_muted boolean := false;
BEGIN
  IF v_reason NOT IN ('offensive_name', 'abusive_chat', 'cheating') THEN
    RAISE EXCEPTION 'file_room_report: unknown reason %', v_reason;
  END IF;
  IF p_reported_user_id IS NOT NULL AND p_reported_user_id IS DISTINCT FROM p_reporter_user_id THEN
    -- Every report about one player goes through their state row's lock, so two at once count once.
    v_state := moderation.state_for_update(p_reported_user_id);
    v_counts := NOT EXISTS (
      SELECT 1 FROM public.room_reports
       WHERE reporter_user_id = p_reporter_user_id AND reported_user_id = p_reported_user_id
         AND uk_day = v_day AND counts);
  END IF;
  INSERT INTO public.room_reports
    (duel_id, message_id, reporter_user_id, reported_user_id, reason, message_text, reported_name, uk_day, counts)
  VALUES (p_duel_id, p_message_id, p_reporter_user_id, p_reported_user_id, v_reason,
          left(p_message_text, 500), left(p_reported_name, 64), v_day, v_counts)
  RETURNING id INTO v_id;

  IF v_counts AND v_reason IN ('abusive_chat', 'offensive_name')
     AND (v_state.muted_until IS NULL OR v_state.muted_until <= now()) THEN
    v_since := greatest(now() - interval '24 hours', coalesce(v_state.muted_at, '-infinity'),
                        coalesce(v_state.mute_lifted_at, '-infinity'));
    SELECT count(DISTINCT reporter_user_id) INTO v_reporters
      FROM public.room_reports
     WHERE reported_user_id = p_reported_user_id AND counts
       AND reason IN ('abusive_chat', 'offensive_name') AND created_at > v_since;
    IF v_reporters >= 3 THEN
      UPDATE moderation.player_state
         SET muted_until = now() + interval '24 hours', muted_at = now(), updated_at = now()
       WHERE user_id = p_reported_user_id;
      PERFORM moderation.log('auto_mute', p_reported_user_id, v_id,
                             jsonb_build_object('reporters', v_reporters, 'hours', 24), 'system');
      v_muted := true;
    END IF;
  END IF;
  RETURN jsonb_build_object('id', v_id, 'counts', v_counts, 'muted', v_muted);
END;
$$;
REVOKE ALL ON FUNCTION public.file_room_report(uuid, uuid, uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.file_room_report(uuid, uuid, uuid, uuid, text, text, text) TO service_role;

-- What the server needs to know about one player: banned (rooms and chat refused), chat muted, a warning to show
-- once, a forced rename to apply. Never who reported them.
CREATE OR REPLACE FUNCTION public.moderation_status(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, moderation
AS $$
  SELECT jsonb_build_object(
    'banned', coalesce(s.banned_until > now(), false),
    'banned_until', CASE WHEN s.banned_until > now() AND s.banned_until <> 'infinity' THEN s.banned_until END,
    'banned_forever', coalesce(s.banned_until = 'infinity', false),
    'muted_until', CASE WHEN s.muted_until > now() THEN s.muted_until END,
    'warning', CASE WHEN s.warning_pending THEN s.warning_note END,
    'rename', coalesce(s.rename_pending, false),
    'rename_temp_applied', coalesce(s.rename_temp_applied, false))
  FROM (SELECT 1) one
  LEFT JOIN moderation.player_state s ON s.user_id = p_user_id;
$$;
REVOKE ALL ON FUNCTION public.moderation_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.moderation_status(uuid) TO service_role;

-- The server's steps on a player's own state, each logged as 'system':
--   'warning'     the player has seen their warning (cleared);
--   'rename_temp' the server gave them a temporary energy name (detail: the name);
--   'rename'      the player picked their new name (the forced rename is done).
-- Answers false when there was nothing to do.
CREATE OR REPLACE FUNCTION public.moderation_ack(p_user_id uuid, p_kind text, p_detail jsonb DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, moderation
AS $$
DECLARE
  n integer;
BEGIN
  IF p_kind = 'warning' THEN
    UPDATE moderation.player_state SET warning_pending = false, updated_at = now()
     WHERE user_id = p_user_id AND warning_pending;
  ELSIF p_kind = 'rename_temp' THEN
    UPDATE moderation.player_state SET rename_temp_applied = true, updated_at = now()
     WHERE user_id = p_user_id AND rename_pending AND NOT rename_temp_applied;
  ELSIF p_kind = 'rename' THEN
    UPDATE moderation.player_state SET rename_pending = false, rename_temp_applied = false, updated_at = now()
     WHERE user_id = p_user_id AND rename_pending;
  ELSE
    RAISE EXCEPTION 'moderation_ack: unknown kind %', p_kind;
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    PERFORM moderation.log(CASE p_kind WHEN 'warning' THEN 'warning_seen' WHEN 'rename_temp' THEN 'rename_temp_name'
                                       ELSE 'rename_done' END, p_user_id, NULL, p_detail, 'system');
  END IF;
  RETURN n > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.moderation_ack(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.moderation_ack(uuid, text, jsonb) TO service_role;

/* ------------------------------------------------------------------ Joe's review list */

-- Newest first, one row per reported player: their username (an account) or the name they had when reported (a
-- guest), the reasons, the messages reported, how many players reported them, any mute or ban, open or resolved.
--   SELECT * FROM moderation.report_queue;
--   SELECT * FROM moderation.report_queue WHERE status = 'open';
CREATE OR REPLACE VIEW moderation.report_queue AS
SELECT r.reported_user_id AS user_id,
       coalesce(p.username, (array_agg(r.reported_name ORDER BY r.created_at DESC) FILTER (WHERE r.reported_name IS NOT NULL))[1])
         AS name,
       (p.user_id IS NOT NULL) AS has_account,
       array_agg(DISTINCT r.reason) FILTER (WHERE r.reason IS NOT NULL) AS reasons,
       array_remove(array_agg(r.message_text ORDER BY r.created_at DESC), NULL) AS messages,
       count(DISTINCT r.reporter_user_id) AS players_reporting,
       count(*) AS reports,
       count(*) FILTER (WHERE r.resolved_at IS NULL) AS open_reports,
       max(r.created_at) AS latest_report,
       min(r.created_at) FILTER (WHERE r.resolved_at IS NULL) AS oldest_open,
       CASE WHEN s.muted_until > now() THEN s.muted_until END AS muted_until,
       CASE WHEN s.banned_until > now() THEN s.banned_until END AS banned_until,
       CASE WHEN count(*) FILTER (WHERE r.resolved_at IS NULL) > 0 THEN 'open' ELSE 'resolved' END AS status,
       array_agg(r.id ORDER BY r.created_at DESC) AS report_ids
  FROM public.room_reports r
  LEFT JOIN public.profiles p ON p.user_id = r.reported_user_id
  LEFT JOIN moderation.player_state s ON s.user_id = r.reported_user_id
 WHERE r.reported_user_id IS NOT NULL
 GROUP BY r.reported_user_id, p.user_id, p.username, s.muted_until, s.banned_until
 ORDER BY max(r.created_at) DESC;
REVOKE ALL ON moderation.report_queue FROM PUBLIC, anon, authenticated, service_role;

/* ------------------------------------------------------------------ Joe's functions (dashboard only) */

-- A one-time notice on the player's next open.
--   SELECT moderation.warn('Spammer99', 'Keep chat friendly, please.');
CREATE OR REPLACE FUNCTION moderation.warn(p_player text, p_note text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, moderation
AS $$
DECLARE
  v_id uuid := moderation.player(p_player);
BEGIN
  IF coalesce(trim(p_note), '') = '' THEN
    RAISE EXCEPTION 'moderation.warn: give the note the player will see';
  END IF;
  IF char_length(p_note) > 300 THEN
    RAISE EXCEPTION 'moderation.warn: keep the note to 300 characters';
  END IF;
  PERFORM moderation.state_for_update(v_id);
  UPDATE moderation.player_state SET warning_note = trim(p_note), warning_pending = true, updated_at = now()
   WHERE user_id = v_id;
  UPDATE public.profiles SET status = 'warned' WHERE user_id = v_id AND status = 'active';
  PERFORM moderation.log('warn', v_id, NULL, jsonb_build_object('note', trim(p_note)));
  RETURN format('%s will see the warning on their next open', p_player);
END;
$$;
REVOKE ALL ON FUNCTION moderation.warn(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- On the player's next open the server gives them a temporary energy name (src/lib/names, the one names module), then
-- they must pick a new name. An account's rename is a forced one: it never counts towards the change limit.
--   SELECT moderation.force_rename('BadName');
CREATE OR REPLACE FUNCTION moderation.force_rename(p_player text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, moderation
AS $$
DECLARE
  v_id uuid := moderation.player(p_player);
BEGIN
  PERFORM moderation.state_for_update(v_id);
  UPDATE moderation.player_state SET rename_pending = true, rename_temp_applied = false, updated_at = now()
   WHERE user_id = v_id;
  PERFORM moderation.log('force_rename', v_id, NULL,
                         jsonb_build_object('from', (SELECT username FROM public.profiles WHERE user_id = v_id)));
  RETURN format('%s gets a temporary name and must pick a new one on their next open', p_player);
END;
$$;
REVOKE ALL ON FUNCTION moderation.force_rename(text) FROM PUBLIC, anon, authenticated, service_role;

-- Bans a player from creating or joining rooms and from chat, for p_days days, or permanently with NULL. Practice
-- and offline play keep working.
--   SELECT moderation.ban('Spammer99', 7);      -- a week
--   SELECT moderation.ban('Spammer99', NULL);   -- permanent
CREATE OR REPLACE FUNCTION moderation.ban(p_player text, p_days integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, moderation
AS $$
DECLARE
  v_id uuid := moderation.player(p_player);
  v_until timestamptz;
BEGIN
  IF p_days IS NOT NULL AND (p_days < 1 OR p_days > 3650) THEN
    RAISE EXCEPTION 'moderation.ban: days must be 1 to 3650, or NULL for permanent';
  END IF;
  v_until := CASE WHEN p_days IS NULL THEN 'infinity'::timestamptz ELSE now() + make_interval(days => p_days) END;
  PERFORM moderation.state_for_update(v_id);
  UPDATE moderation.player_state SET banned_until = v_until, updated_at = now() WHERE user_id = v_id;
  UPDATE public.profiles SET status = 'banned' WHERE user_id = v_id;
  PERFORM moderation.log('ban', v_id, NULL,
                         jsonb_build_object('days', p_days, 'until', CASE WHEN p_days IS NULL THEN 'permanent' ELSE v_until::text END));
  RETURN CASE WHEN p_days IS NULL THEN format('%s is banned permanently', p_player)
              ELSE format('%s is banned until %s', p_player, v_until) END;
END;
$$;
REVOKE ALL ON FUNCTION moderation.ban(text, integer) FROM PUBLIC, anon, authenticated, service_role;

-- Lifts a ban.
--   SELECT moderation.unban('Spammer99');
CREATE OR REPLACE FUNCTION moderation.unban(p_player text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, moderation
AS $$
DECLARE
  v_id uuid := moderation.player(p_player);
BEGIN
  PERFORM moderation.state_for_update(v_id);
  UPDATE moderation.player_state SET banned_until = NULL, updated_at = now() WHERE user_id = v_id;
  UPDATE public.profiles SET status = 'active' WHERE user_id = v_id AND status = 'banned';
  PERFORM moderation.log('unban', v_id, NULL, NULL);
  RETURN format('%s is no longer banned', p_player);
END;
$$;
REVOKE ALL ON FUNCTION moderation.unban(text) FROM PUBLIC, anon, authenticated, service_role;

-- Lifts a chat mute early. Reports filed before now never count towards a new mute.
--   SELECT moderation.unmute('Spammer99');
CREATE OR REPLACE FUNCTION moderation.unmute(p_player text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, moderation
AS $$
DECLARE
  v_id uuid := moderation.player(p_player);
BEGIN
  PERFORM moderation.state_for_update(v_id);
  UPDATE moderation.player_state SET muted_until = NULL, mute_lifted_at = now(), updated_at = now()
   WHERE user_id = v_id;
  PERFORM moderation.log('unmute', v_id, NULL, NULL);
  RETURN format('%s can chat again', p_player);
END;
$$;
REVOKE ALL ON FUNCTION moderation.unmute(text) FROM PUBLIC, anon, authenticated, service_role;

-- Marks one report (its id, from report_queue.report_ids) or every open report about a player (their username or
-- user id) as resolved, with an optional note.
--   SELECT moderation.resolve('Spammer99');
--   SELECT moderation.resolve('Spammer99', 'warned');
--   SELECT moderation.resolve('3f0c…-report-id');
CREATE OR REPLACE FUNCTION moderation.resolve(p_target text, p_note text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, moderation
AS $$
DECLARE
  v_report public.room_reports%ROWTYPE;
  v_id uuid;
  n integer;
BEGIN
  IF p_target ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO v_report FROM public.room_reports WHERE id = p_target::uuid;
    IF FOUND THEN
      UPDATE public.room_reports SET resolved_at = coalesce(resolved_at, now()), resolution_note = coalesce(p_note, resolution_note)
       WHERE id = v_report.id;
      PERFORM moderation.log('resolve', v_report.reported_user_id, v_report.id, jsonb_build_object('note', p_note));
      RETURN 'report resolved';
    END IF;
  END IF;
  v_id := moderation.player(p_target);
  UPDATE public.room_reports SET resolved_at = now(), resolution_note = p_note
   WHERE reported_user_id = v_id AND resolved_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM moderation.log('resolve', v_id, NULL, jsonb_build_object('note', p_note, 'reports', n));
  RETURN format('%s open report(s) about %s resolved', n, p_target);
END;
$$;
REVOKE ALL ON FUNCTION moderation.resolve(text, text) FROM PUBLIC, anon, authenticated, service_role;

/* ------------------------------------------------------------------ a removed user (accounts.forget_user) */

-- When an auth user is removed (the accounts clean-up's forget_user deletes it last), the reports about them and the
-- action lines naming them keep their content but point at one fresh random id, and their state row goes.
CREATE OR REPLACE FUNCTION moderation.forget_removed_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, moderation
AS $$
DECLARE
  t uuid := gen_random_uuid();
BEGIN
  UPDATE public.room_reports SET reported_user_id = t WHERE reported_user_id = OLD.id;
  UPDATE moderation.actions SET user_id = t WHERE user_id = OLD.id;
  DELETE FROM moderation.player_state WHERE user_id = OLD.id;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION moderation.forget_removed_user() FROM PUBLIC, anon, authenticated, service_role;

DO $trigger$
BEGIN
  DROP TRIGGER IF EXISTS moderation_forget_removed_user ON auth.users;
  CREATE TRIGGER moderation_forget_removed_user AFTER DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION moderation.forget_removed_user();
EXCEPTION WHEN insufficient_privilege THEN
  PERFORM migration_log.note('warning', 'moderation: no trigger on auth.users (insufficient privilege); a removed user''s reports keep their id; see docs/moderation.md');
END
$trigger$;
