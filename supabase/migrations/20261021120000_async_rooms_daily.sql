-- Async rooms and the daily challenge (21 Oct 2026; src/lib/duel/asyncRoom.server.ts,
-- src/lib/duel/daily.server.ts). WRITTEN BUT NOT APPLIED: Joe asks Lovable to apply it.
-- Until it is, the daily status call finds no table, the Play tab hides the Daily
-- challenge card and /daily says the dailies are coming soon; nothing else changes.
--
-- An async room is a set of rounds dealt once on the server from a seed and stored
-- (rule 5), which each player plays at their own time on their own clock. The daily
-- puzzle and the daily arcade are async rooms (kind daily_puzzle / daily_arcade, one
-- per UK day, room_key '<kind>:<YYYY-MM-DD>'); a later friend challenge reuses them
-- (kind 'challenge').
--
--   async_rooms         the dealt rounds' public halves and the room's window;
--   async_room_secrets  the private halves (answers), server only;
--   async_attempts      one row per device per room (unique), its totals for the board;
--   async_results       one row per attempt per round: written when the round starts
--                       (started_at, the per-player clock), filled when it is graded;
--   async_events        beta recording (docs/beta-sql.md section 7): attempt and round
--                       starts, finishes and abandons, once each.
--
-- Every write goes through the server functions (service role), which only ever write
-- the calling device's own attempt and results (keyed on its auth id). Clients have no
-- write grant on any of these tables. Clients may read only the leaderboard columns of
-- async_attempts, and only for a room whose board is open to them (async_board_open:
-- they finished their own attempt, or the room has closed), plus their own row; and only
-- the window columns of async_rooms (never the puzzles). Results, secrets and events are
-- server only.

CREATE TABLE IF NOT EXISTS public.async_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('daily_puzzle', 'daily_arcade', 'challenge')),
  room_key text NOT NULL UNIQUE,
  day date,
  seed bigint NOT NULL,
  round_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  round_count integer NOT NULL CHECK (round_count BETWEEN 1 AND 10),
  puzzles_public jsonb NOT NULL DEFAULT '[]'::jsonb,
  opens_at timestamptz NOT NULL,
  closes_at timestamptz NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (closes_at > opens_at)
);

CREATE TABLE IF NOT EXISTS public.async_room_secrets (
  room_id uuid PRIMARY KEY REFERENCES public.async_rooms (id) ON DELETE CASCADE,
  puzzles_private jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Each round's effective clock and version stamps (betaRecord.server.ts roundRecords).
  round_records jsonb
);

CREATE TABLE IF NOT EXISTS public.async_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.async_rooms (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 14),
  colour smallint CHECK (colour BETWEEN 0 AND 9),
  icon text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  rounds_done integer NOT NULL DEFAULT 0,
  total_score integer NOT NULL DEFAULT 0,
  -- The room tie-break's time used (scoring.ts roundTimeUsedMs, summed; unplayed rounds count in full).
  tie_ms bigint NOT NULL DEFAULT 0,
  round_scores jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT async_attempts_once UNIQUE (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS async_attempts_board
  ON public.async_attempts (room_id, total_score DESC, tie_ms ASC);

CREATE TABLE IF NOT EXISTS public.async_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.async_rooms (id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL REFERENCES public.async_attempts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  round_number integer NOT NULL CHECK (round_number BETWEEN 1 AND 10),
  started_at timestamptz NOT NULL,
  answered boolean NOT NULL DEFAULT false,
  answered_at timestamptz,
  -- True when no answer arrived before the round stopped taking answers (scored 0).
  missed boolean NOT NULL DEFAULT false,
  answer text,
  is_correct boolean NOT NULL DEFAULT false,
  ms_remaining integer NOT NULL DEFAULT 0,
  reaction_avg_ms integer,
  correct_count integer,
  errors integer,
  extra jsonb,
  score integer NOT NULL DEFAULT 0,
  CONSTRAINT async_results_once UNIQUE (attempt_id, round_number)
);

CREATE INDEX IF NOT EXISTS async_results_room ON public.async_results (room_id, round_number);

CREATE TABLE IF NOT EXISTS public.async_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id uuid NOT NULL,
  kind text NOT NULL,
  attempt_id uuid NOT NULL,
  user_id uuid,
  -- 0 for attempt_started / attempt_finished.
  round_number integer NOT NULL DEFAULT 0,
  event text NOT NULL CHECK (event IN ('attempt_started', 'round_started', 'round_finished', 'round_abandoned', 'attempt_finished')),
  -- round_finished: 'answered' (before the clock) or 'timeout' (the draft at or after it);
  -- round_abandoned: 'no_answer' (nothing arrived while the round took answers).
  reason text CHECK (reason IN ('answered', 'timeout', 'no_answer')),
  at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS async_events_once
  ON public.async_events (attempt_id, round_number, event);

-- Server-only tables: no client grants, RLS on with no policies.
REVOKE ALL ON public.async_room_secrets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.async_results FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.async_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.async_room_secrets TO service_role;
GRANT ALL ON public.async_results TO service_role;
GRANT ALL ON public.async_events TO service_role;
ALTER TABLE public.async_room_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.async_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.async_events ENABLE ROW LEVEL SECURITY;

-- Rooms: the window columns only (never the puzzles, the seed or the round order).
REVOKE ALL ON public.async_rooms FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.async_rooms TO service_role;
GRANT SELECT (id, kind, room_key, day, round_count, opens_at, closes_at) ON public.async_rooms TO authenticated;
ALTER TABLE public.async_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS async_rooms_read ON public.async_rooms;
CREATE POLICY async_rooms_read ON public.async_rooms FOR SELECT TO authenticated USING (true);

-- Whether the caller may read a room's board: their own attempt there is finished, or the
-- room has closed. SECURITY DEFINER so the attempts policy can ask without recursing.
CREATE OR REPLACE FUNCTION public.async_board_open(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.async_rooms r WHERE r.id = p_room_id AND r.closes_at <= now())
      OR EXISTS (
        SELECT 1 FROM public.async_attempts a
        WHERE a.room_id = p_room_id AND a.user_id = auth.uid() AND a.finished_at IS NOT NULL
      );
$$;

REVOKE ALL ON FUNCTION public.async_board_open(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.async_board_open(uuid) TO authenticated, service_role;

-- Attempts: the leaderboard columns only (no user id, no start time), on finished
-- attempts of an open board, and the caller's own row.
REVOKE ALL ON public.async_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.async_attempts TO service_role;
GRANT SELECT (id, room_id, display_name, colour, icon, finished_at, rounds_done, total_score, tie_ms, round_scores)
  ON public.async_attempts TO authenticated;
ALTER TABLE public.async_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS async_attempts_read ON public.async_attempts;
CREATE POLICY async_attempts_read ON public.async_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.async_board_open(room_id));
