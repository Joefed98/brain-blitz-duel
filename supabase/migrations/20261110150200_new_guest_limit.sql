-- The new-guest limit (Wave 1, train 2, session 4; 10 Nov 2026; docs/moderation.md "Bots"): at most 200 new guests
-- an hour from one network. Non-destructive and idempotent: it creates two functions and schedules a purge.
--
-- Guests are Supabase anonymous sign-ins, made by Supabase Auth itself, not by our server, so the limit sits where
-- Supabase Auth asks before creating any user: its "Before User Created" hook, set to the Postgres function below
-- (Authentication → Auth Hooks in the dashboard). The hook counts the new user in public.take_rate_limit, the same
-- counter src/lib/data/limits.server.ts takeRateLimit calls, under the bucket 'new-guest' (src/lib/duel/rateLimit.server.ts
-- NEW_GUEST_LIMIT holds the same numbers; moderation-check proves they match). Until Joe sets the hook nothing changes.
--
-- The network key: the first 16 bytes of SHA-256('duelz-ip:' || address) as a uuid, exactly as the server's addressKey
-- (rateLimit.server.ts). The address itself is never stored, and the key is kept only for the limit's window: every
-- call deletes the bucket's rows older than an hour, and an hourly job does the same. It is never written with an
-- event, a profile or anything else.

CREATE OR REPLACE FUNCTION public.network_key(p_address text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-' || substr(h, 13, 4) || '-' || substr(h, 17, 4) || '-' ||
          substr(h, 21, 12))::uuid
    FROM (SELECT encode(sha256(convert_to('duelz-ip:' || p_address, 'UTF8')), 'hex') AS h) x;
$$;
REVOKE ALL ON FUNCTION public.network_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.network_key(text) TO service_role;

-- A warning line in moderation.actions when the hook can't count (Joe's choice, 10 Nov 2026: fail open). Only the
-- reason and the Postgres error code: never an address, a key or a user id. Never raises.
CREATE OR REPLACE FUNCTION public.guest_limit_warning(p_reason text, p_sqlstate text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, moderation
AS $$
BEGIN
  INSERT INTO moderation.actions (action, user_id, report_id, detail, by_role)
  VALUES ('guest_limit_warning', NULL, NULL,
          jsonb_strip_nulls(jsonb_build_object('reason', p_reason, 'sqlstate', p_sqlstate)), 'system');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.guest_limit_warning(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Supabase Auth's Before User Created hook. Allows ({}) or refuses with a 429 and a plain message. Counts only
-- anonymous users (guests); a user the payload marks as not anonymous passes. It fails open: with no address in the
-- payload, or when the count can't be taken (any error), the sign-up is allowed and a warning line written
-- (guest_limit_warning: 'no_address' or 'limit_error'). Only over the limit is a guest refused.
CREATE OR REPLACE FUNCTION public.before_user_created_guest_limit(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_max constant integer := 200;
  c_window constant integer := 3600;
  v_address text;
  v_within boolean;
BEGIN
  BEGIN
    IF (event -> 'user' ->> 'is_anonymous') = 'false' THEN
      RETURN '{}'::jsonb;
    END IF;
    v_address := nullif(trim(event -> 'metadata' ->> 'ip_address'), '');
    IF v_address IS NULL THEN
      PERFORM public.guest_limit_warning('no_address');
      RETURN '{}'::jsonb;
    END IF;
    DELETE FROM public.rate_limit_hits
     WHERE bucket = 'new-guest' AND window_start < now() - make_interval(secs => c_window);
    v_within := public.take_rate_limit(public.network_key(v_address), 'new-guest', c_max, c_window);
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.guest_limit_warning('limit_error', SQLSTATE);
    RETURN '{}'::jsonb;
  END;
  IF v_within IS DISTINCT FROM false THEN
    RETURN '{}'::jsonb;
  END IF;
  RETURN jsonb_build_object('error', jsonb_build_object(
    'http_code', 429, 'message', 'Lots of new players from this network. Try again in a while.'));
END;
$$;
REVOKE ALL ON FUNCTION public.before_user_created_guest_limit(jsonb) FROM PUBLIC, anon, authenticated;

-- Supabase Auth runs hooks as supabase_auth_admin; other databases (the local proof) have no such role.
DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT EXECUTE ON FUNCTION public.before_user_created_guest_limit(jsonb) TO supabase_auth_admin;
  END IF;
END
$grant$;

-- The hourly purge of expired network keys (the hook purges too; this covers quiet hours).
DO $purge$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
      PERFORM cron.schedule('new-guest-purge', '7 * * * *',
        $$DELETE FROM public.rate_limit_hits WHERE bucket = 'new-guest' AND window_start < now() - interval '1 hour'$$);
    EXCEPTION WHEN OTHERS THEN
      PERFORM migration_log.note('warning', format('new-guest purge not scheduled (pg_cron: %s); see docs/moderation.md', SQLERRM));
    END;
  ELSE
    PERFORM migration_log.note('warning', 'new-guest purge not scheduled: pg_cron is not available on this database; see docs/moderation.md');
  END IF;
END
$purge$;
