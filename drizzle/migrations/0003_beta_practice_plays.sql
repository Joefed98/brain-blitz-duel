-- Beta recording, gap G2 (docs/beta-sql.md): one row per graded practice play,
-- written in practiceGradeFn (src/lib/duel/practice.functions.ts) after grading.
-- The outcome only, never the answer:
--   user_id        the device (anonymous auth user) from the call's bearer
--                  token; NULL when the call carried none;
--   game_id        the puzzle type; revision: the puzzle's numeric version
--                  stamps, e.g. {"brkRev": 6, "speedPar": 1};
--   score, is_correct, ms_remaining   as graded (the stored time left);
--   timed_out      the phone's clock had run out (it sent 0 ms left);
--   duration_ms    the arcade run's length when stored, else the time used
--                  against the clock; time_limit_ms: the puzzle's clock;
--   example        the fixed intro example (doesn't count for device bests);
--   flagged        the server replay flagged the run.
--
-- Server-only: RLS on with no client policies and no client grants. Written
-- best-effort (src/lib/duel/betaRecord.server.ts); never read by play.

CREATE TABLE IF NOT EXISTS public.practice_plays (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid,
  game_id text NOT NULL,
  revision jsonb NOT NULL DEFAULT '{}'::jsonb,
  score integer NOT NULL DEFAULT 0,
  is_correct boolean NOT NULL DEFAULT false,
  timed_out boolean NOT NULL DEFAULT false,
  duration_ms integer NOT NULL DEFAULT 0,
  time_limit_ms integer NOT NULL DEFAULT 0,
  ms_remaining integer NOT NULL DEFAULT 0,
  example boolean NOT NULL DEFAULT false,
  flagged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS practice_plays_created_idx ON public.practice_plays (created_at);
CREATE INDEX IF NOT EXISTS practice_plays_user_idx ON public.practice_plays (user_id, created_at);

REVOKE ALL ON public.practice_plays FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.practice_plays TO service_role;
ALTER TABLE public.practice_plays ENABLE ROW LEVEL SECURITY;
