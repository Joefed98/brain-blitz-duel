-- Pre-beta security audit (docs/security-audit-oct-2026.md): per-user rate limits
-- for room creation, room-code lookups and chat reports, so one stranger cannot
-- flood the database or guess room codes by brute force.
--
-- Server-only, like duel_secrets: RLS on with no client policies, no client
-- grants, and the counter function callable by the service role alone. The
-- server functions fail open if this migration has not been applied yet
-- (src/lib/duel/rateLimit.server.ts), so the code can ship before it.
-- Stores only counters keyed by the anonymous auth user id; no game data.

CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  user_id uuid NOT NULL,
  bucket text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bucket)
);

REVOKE ALL ON public.rate_limit_hits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.rate_limit_hits TO service_role;
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;

-- Counts one hit in a fixed window and says whether the caller is still under
-- p_max. Atomic per (user, bucket) through the primary-key upsert.
CREATE OR REPLACE FUNCTION public.take_rate_limit(
  p_user_id uuid,
  p_bucket text,
  p_max integer,
  p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hits integer;
BEGIN
  INSERT INTO public.rate_limit_hits AS r (user_id, bucket, window_start, hits)
  VALUES (p_user_id, p_bucket, now(), 1)
  ON CONFLICT (user_id, bucket) DO UPDATE
    SET window_start = CASE
          WHEN r.window_start < now() - make_interval(secs => p_window_seconds) THEN now()
          ELSE r.window_start
        END,
        hits = CASE
          WHEN r.window_start < now() - make_interval(secs => p_window_seconds) THEN 1
          ELSE r.hits + 1
        END
  RETURNING hits INTO v_hits;
  RETURN v_hits <= p_max;
END;
$$;

REVOKE ALL ON FUNCTION public.take_rate_limit(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.take_rate_limit(uuid, text, integer, integer) TO service_role;
