-- Beta recording, gap G4 (docs/beta-sql.md): how each device came into each
-- game of a room. Append-only, one row per arrival:
--   via 'host'       the device created the room (createRoomFn, game 0);
--   via 'code'       it typed or pasted the room code on the home screen;
--   via 'link'       it opened the room link (JoinFromLink);
--   via 'play_again' it was still in the room when the host pressed Play again
--                    (written by restart_duel_room for the new game);
--   via NULL         a phone running a build from before this change.
-- rejoin = true when a device that had left came back in the lobby.
-- game_index = the room's Play again count when it happened (0 = first game).
--
-- Server-only, like rate_limit_hits: RLS on with no client policies and no
-- client grants. Written best-effort by src/lib/duel/betaRecord.server.ts, so
-- a missing table or a failed insert never blocks play. No game data.

CREATE TABLE IF NOT EXISTS public.room_joins (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  duel_id uuid NOT NULL,
  user_id uuid NOT NULL,
  player_slot integer NOT NULL,
  game_index integer NOT NULL DEFAULT 0,
  via text CHECK (via IN ('host', 'code', 'link', 'play_again')),
  rejoin boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS room_joins_duel_idx ON public.room_joins (duel_id, game_index);
CREATE INDEX IF NOT EXISTS room_joins_user_idx ON public.room_joins (user_id, joined_at);

REVOKE ALL ON public.room_joins FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.room_joins TO service_role;
ALTER TABLE public.room_joins ENABLE ROW LEVEL SECURITY;
