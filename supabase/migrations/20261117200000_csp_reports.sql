-- The content security policy trial's reports (13 Nov 2026, Security B; docs/security/csp-trial.md). Additive and
-- idempotent. Each row is one report a browser sent to /csp-report: the directive and the blocked resource's host (or a
-- keyword such as 'inline'); never a URL, path, script sample, address or anything about the player. Written by the
-- server (service role) only; nobody reads or writes it through the API.

CREATE TABLE IF NOT EXISTS public.csp_reports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  directive text NOT NULL CHECK (directive ~ '^[a-z][a-z-]{1,39}$'),
  blocked_host text NOT NULL CHECK (char_length(blocked_host) BETWEEN 1 AND 253),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.csp_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.csp_reports FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.csp_reports TO service_role;
CREATE INDEX IF NOT EXISTS csp_reports_created_idx ON public.csp_reports (created_at);

-- Keep 30 days of reports (Joe, 13 Nov 2026), on the existing daily analytics clean-up (pg_cron job
-- 'analytics-retention', 03:17 UTC, from 20261109140000_analytics_events.sql): its function, as it stands, plus the
-- reports older than 30 days. It still answers the number of analytics events removed, as before.
CREATE OR REPLACE FUNCTION analytics.purge_old_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = analytics
AS $$
DECLARE
  n integer;
BEGIN
  DELETE FROM analytics.events WHERE occurred_at < now() - interval '13 months';
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM public.csp_reports WHERE created_at < now() - interval '30 days';
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION analytics.purge_old_events() FROM PUBLIC, anon, authenticated, service_role;
