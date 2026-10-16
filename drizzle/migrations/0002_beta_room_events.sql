-- Beta recording, gap G3 (docs/beta-sql.md): when each game in a room starts
-- and ends, and when each round starts and ends and why.
--   game_started  (round 0)  the host's start claimed the room (startRoomFn);
--   round_started (round n)  the round's clock started (intro -> puzzle);
--   round_ended   (round n)  answers closed (puzzle -> reveal), reason
--                            'all_answered' (every active player had answered)
--                            or 'timer' (the clock ran out first);
--   game_ended    (round 0)  reason 'completed' (the winner reveal, or the last
--                            standings in older rooms), 'finish_now', 'host_left'
--                            or 'disbanded' (only for a game in progress).
-- game_index = the room's Play again count (0 = the first game), matching
-- duels.tournament_history[game_index] once the game is archived.
-- One row per (room, game, round, event): the unique index keeps the first, so
-- racing phones and timers record each moment once.
--
-- Server-only: RLS on with no client policies and no client grants. Written
-- best-effort by src/lib/duel/betaRecord.server.ts; never read by play.

CREATE TABLE IF NOT EXISTS public.room_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  duel_id uuid NOT NULL,
  game_index integer NOT NULL DEFAULT 0,
  round_number integer NOT NULL DEFAULT 0,
  event text NOT NULL CHECK (event IN ('game_started', 'round_started', 'round_ended', 'game_ended')),
  reason text CHECK (reason IN ('all_answered', 'timer', 'completed', 'finish_now', 'host_left', 'disbanded')),
  at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS room_events_once
  ON public.room_events (duel_id, game_index, round_number, event);

REVOKE ALL ON public.room_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.room_events TO service_role;
ALTER TABLE public.room_events ENABLE ROW LEVEL SECURITY;
