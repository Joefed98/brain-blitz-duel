-- Beta recording, the beta terms (docs/beta-sql.md section 10): when a device
-- agreed to the beta terms (/terms, shown once before its first room, daily or
-- challenge), the date the phone stored with its I AGREE, and which version of
-- the terms. One row per device and version (the unique index keeps the first).
--
-- No names, scores or answers. Server-only: RLS on with no client policies and
-- no client grants. Written best-effort by src/lib/duel/betaRecord.server.ts
-- (recordTermsAgreed) through src/lib/beta/terms.functions.ts; never read by
-- play. Until this is applied every write fails quietly and the app is
-- unchanged (the agreement is still kept on the device).

CREATE TABLE IF NOT EXISTS public.terms_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  terms_version integer NOT NULL CHECK (terms_version BETWEEN 1 AND 1000),
  agreed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS terms_events_once
  ON public.terms_events (user_id, terms_version);
CREATE INDEX IF NOT EXISTS terms_events_created_idx ON public.terms_events (created_at);

REVOKE ALL ON public.terms_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.terms_events TO service_role;
ALTER TABLE public.terms_events ENABLE ROW LEVEL SECURITY;