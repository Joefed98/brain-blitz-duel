-- Room heartbeats off the realtime feed (Speed fix 3, 9 Nov 2026; docs/audit-nov-2026/performance.md item 3).
-- Idempotent: safe to apply more than once, and in either order with the code that uses it. Apply it to the
-- current Lovable database and to the new Supabase project alike.
--
-- Every phone in a room calls heartbeatFn every 4 s. It used to write duel_players.last_seen_at, and
-- duel_players is in the supabase_realtime publication, so every heartbeat was a realtime change sent to every
-- phone in the room, and each one made those phones refetch the whole player list (about 16 queries a second in
-- a room of 16). This table holds the heartbeat instead. It is NOT added to supabase_realtime, so a heartbeat
-- reaches no phone; the heartbeat's own reply carries the room's last-seen times (src/lib/duel/presence.server.ts).
--
-- Until this file is applied the code finds no table and writes duel_players.last_seen_at as before. After it,
-- the server reads each player's last seen as the later of the two columns, so nothing is lost across the switch.
-- No stored row changes (rule 4): duel_players.last_seen_at stays where it is, still written on join and READY.

CREATE TABLE IF NOT EXISTS public.duel_presence (
  duel_id uuid NOT NULL,
  user_id uuid NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (duel_id, user_id),
  -- Only a room's own players have a row, and it goes with the player row (a left player removed by Play again,
  -- a deleted room): the heartbeat of someone outside the room is refused by this key.
  CONSTRAINT duel_presence_player_fkey FOREIGN KEY (duel_id, user_id)
    REFERENCES public.duel_players (duel_id, user_id) ON DELETE CASCADE
);

-- Server only: the service role reads and writes it; phones never see it (no policy for anon or authenticated).
ALTER TABLE public.duel_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.duel_presence FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.duel_presence TO service_role;

-- The lobby's stale-host check (checkHostPresenceFn) reads the host's last seen from either column.
CREATE OR REPLACE FUNCTION public.disband_stale_room(p_room_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.duels d
     SET disbanded_at = now(), status = 'finished'
    FROM public.duel_players p
    LEFT JOIN public.duel_presence s ON s.duel_id = p.duel_id AND s.user_id = p.user_id
   WHERE d.id = p_room_id
     AND d.status = 'waiting'
     AND d.disbanded_at IS NULL
     AND p.duel_id = d.id
     AND p.user_id = d.host_user_id
     AND greatest(p.last_seen_at, s.last_seen_at) < now() - interval '2 minutes';
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.disband_stale_room(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.disband_stale_room(uuid) TO service_role;