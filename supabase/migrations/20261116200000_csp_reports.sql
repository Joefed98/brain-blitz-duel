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
