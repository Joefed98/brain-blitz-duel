-- Beta recording, the share loop (docs/beta-sql.md section 7): who shares a
-- result after a room, and who arrives from a shared link and then plays.
--   share_tap         a Share tap on the final screen (podium or two-player
--                     result): the room (duel_id, game_index), the sharer's
--                     place (NULL after leaving or a forfeit), the room's
--                     player and round counts, and how the phone shared it:
--                     method 'native' (the share sheet) or 'copy' (copied
--                     text and link);
--   arrival           a device's first visit from a shared link (?ref=share),
--                     landing 'room' (the room link) or 'home'; room_code is
--                     the room the link named (NULL for home links);
--   arrival_finished  that device's first finished room afterwards (the
--                     final screen showed), with its room, place and counts.
-- arrival and arrival_finished are one row per device (the unique indexes keep
-- the first); share_tap is one row per tap.
--
-- Outcome only: no answers, puzzles, names or scores. Server-only: RLS on with
-- no client policies and no client grants. Written best-effort by
-- src/lib/duel/betaRecord.server.ts (recordShareEvent) through
-- src/lib/duel/share.functions.ts; never read by play. Until this is applied
-- every write fails quietly and the app is unchanged.

CREATE TABLE IF NOT EXISTS public.share_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  event text NOT NULL CHECK (event IN ('share_tap', 'arrival', 'arrival_finished')),
  duel_id uuid,
  game_index integer,
  room_code text CHECK (room_code IS NULL OR room_code ~ '^[A-Z]{4}$'),
  place integer CHECK (place IS NULL OR place BETWEEN 1 AND 10),
  players integer CHECK (players IS NULL OR players BETWEEN 1 AND 10),
  rounds integer CHECK (rounds IS NULL OR rounds BETWEEN 1 AND 20),
  method text CHECK (method IS NULL OR method IN ('native', 'copy')),
  landing text CHECK (landing IS NULL OR landing IN ('home', 'room')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS share_events_created_idx ON public.share_events (created_at);
CREATE INDEX IF NOT EXISTS share_events_user_idx ON public.share_events (user_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS share_events_arrival_once
  ON public.share_events (user_id) WHERE event = 'arrival';
CREATE UNIQUE INDEX IF NOT EXISTS share_events_finish_once
  ON public.share_events (user_id) WHERE event = 'arrival_finished';

REVOKE ALL ON public.share_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.share_events TO service_role;
ALTER TABLE public.share_events ENABLE ROW LEVEL SECURITY;
