-- Phone notifications (wave 2 B2), 12 Nov 2026: the daily cap counted the day's sends from the time the server passes
-- (p_since, the player's local midnight from the server's clock) but stamped each new send with the database's own
-- now(). Both halves of the rule now come from one clock: push_reserve_at is push_reserve with the send time (p_now),
-- which stamps the log row. Additive: push_reserve stays as it is (nothing in the app calls it after this change). A
-- new name, not an overload, so a call by argument names can never be ambiguous.

CREATE OR REPLACE FUNCTION public.push_reserve_at(
  p_user_id uuid,
  p_event text,
  p_counts_cap boolean,
  p_since timestamptz,
  p_cap integer,
  p_dedupe_key text,
  p_now timestamptz
) RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('push:' || p_user_id::text, 0));
  IF p_dedupe_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.notification_log WHERE user_id = p_user_id AND dedupe_key = p_dedupe_key
  ) THEN
    RETURN 'duplicate';
  END IF;
  IF p_counts_cap THEN
    SELECT count(*) INTO n FROM public.notification_log
     WHERE user_id = p_user_id AND counts_cap AND sent_at >= p_since;
    IF n >= p_cap THEN
      RETURN 'capped';
    END IF;
  END IF;
  INSERT INTO public.notification_log (user_id, event, counts_cap, dedupe_key, sent_at)
  VALUES (p_user_id, p_event, p_counts_cap, p_dedupe_key, coalesce(p_now, now()));
  RETURN 'ok';
END
$$;
REVOKE ALL ON FUNCTION public.push_reserve_at(uuid, text, boolean, timestamptz, integer, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_reserve_at(uuid, text, boolean, timestamptz, integer, text, timestamptz) TO service_role;
