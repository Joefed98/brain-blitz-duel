-- Rooms and rated play (13 Nov 2026, Security A). Additive and idempotent; no stored row is changed.
--
-- 1. Private Realtime channels for rooms. A room's three channels are private (the phone asks for `private: true`):
--      room-chat-<room id>          read by players still in the room (public.can_read_room_chat); nobody writes:
--                                   reactions are broadcast by the server (public.room_send_reaction)
--      race-ghosts-<room id>:<round> read and written by players still in the room (Racing's ghost cars)
--      duel-<room code>             read by the room's players (the room's row changes, already filtered by RLS)
--    Realtime allows a private channel by reading these policies on realtime.messages with realtime.topic() set to the
--    channel's topic, as the joining player. Public access to Realtime stays as it is until Joe turns it off.
-- 2. public.room_send_reaction: the server's broadcast of one room reaction (service role only).
-- 3. Room chat is read by players still in the room: the read policy on room_messages now uses
--    public.can_read_room_chat (a player row in the room whose status isn't 'left').
-- 4. public.duel_removed_players: the players the host removed from a room's lobby, by game, so the join can refuse
--    them until Play again (server only; nobody else reads or writes it).
-- 5. public.mm_recent_aborts: the times a player left rated matches during set-up, for the queue's cooldown, with a
--    partial index over aborted matches (service role only).

-- 3. Who may read a room's chat.
CREATE OR REPLACE FUNCTION public.can_read_room_chat(_duel_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.duel_players p
    WHERE p.duel_id = _duel_id AND p.user_id = auth.uid() AND p.status <> 'left'
  )
$$;
REVOKE ALL ON FUNCTION public.can_read_room_chat(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_room_chat(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Participants can read messages of their room" ON public.room_messages;
DROP POLICY IF EXISTS "Players still in the room read its messages" ON public.room_messages;
CREATE POLICY "Players still in the room read its messages"
  ON public.room_messages FOR SELECT TO authenticated
  USING (public.can_read_room_chat(duel_id));

-- 1. Which room topics a player may read (p_write false) or send on (p_write true).
CREATE OR REPLACE FUNCTION public.room_topic_allowed(p_topic text, p_write boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  m text[];
BEGIN
  IF me IS NULL OR p_topic IS NULL THEN
    RETURN false;
  END IF;
  m := regexp_match(p_topic, '^room-chat-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$');
  IF m IS NOT NULL THEN
    RETURN NOT p_write AND public.can_read_room_chat(m[1]::uuid);
  END IF;
  m := regexp_match(p_topic, '^race-ghosts-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([0-9]{1,3})$');
  IF m IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.duel_players p
      WHERE p.duel_id = m[1]::uuid AND p.user_id = me AND p.status <> 'left'
    );
  END IF;
  m := regexp_match(p_topic, '^duel-([A-Z0-9]{4,8})$');
  IF m IS NOT NULL THEN
    RETURN NOT p_write AND EXISTS (
      SELECT 1 FROM public.duels d JOIN public.duel_players p ON p.duel_id = d.id
      WHERE d.room_code = m[1] AND p.user_id = me
    );
  END IF;
  RETURN false;
END
$$;
REVOKE ALL ON FUNCTION public.room_topic_allowed(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.room_topic_allowed(text, boolean) TO authenticated, service_role;

DO $topics$
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RETURN;
  END IF;
  DROP POLICY IF EXISTS "Joulz room members read room topics" ON realtime.messages;
  CREATE POLICY "Joulz room members read room topics" ON realtime.messages
    FOR SELECT TO authenticated
    USING (public.room_topic_allowed(realtime.topic(), false));
  DROP POLICY IF EXISTS "Joulz room members send on ghost topics" ON realtime.messages;
  CREATE POLICY "Joulz room members send on ghost topics" ON realtime.messages
    FOR INSERT TO authenticated
    WITH CHECK (extension = 'broadcast' AND public.room_topic_allowed(realtime.topic(), true));
END
$topics$;

-- 2. The server's broadcast of one reaction, on the room's private chat topic.
CREATE OR REPLACE FUNCTION public.room_send_reaction(p_duel_id uuid, p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM realtime.send(p_payload, 'reaction', 'room-chat-' || p_duel_id::text, true);
END
$$;
REVOKE ALL ON FUNCTION public.room_send_reaction(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.room_send_reaction(uuid, jsonb) TO service_role;

-- 4. Removals from a lobby, by game (the room's game index: its history's length, which Play again grows).
CREATE TABLE IF NOT EXISTS public.duel_removed_players (
  duel_id uuid NOT NULL REFERENCES public.duels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_index integer NOT NULL CHECK (game_index >= 0),
  removed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (duel_id, user_id, game_index)
);
ALTER TABLE public.duel_removed_players ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.duel_removed_players FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.duel_removed_players TO service_role;
CREATE INDEX IF NOT EXISTS duel_removed_players_user_idx ON public.duel_removed_players (user_id);

-- 5. Set-up leaves in rated play: the times this player was among an aborted match's leavers since p_since.
DO $aborts$
BEGIN
  IF to_regclass('public.mm_matches') IS NULL THEN
    RETURN;
  END IF;
  CREATE INDEX IF NOT EXISTS mm_matches_aborts_idx ON public.mm_matches USING gin (leavers jsonb_path_ops)
    WHERE ended = 'abort';
  CREATE OR REPLACE FUNCTION public.mm_recent_aborts(p_user uuid, p_since timestamptz)
  RETURNS SETOF timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
    SELECT coalesce(m.ended_at, m.created_at)
      FROM public.mm_matches m
     WHERE m.ended = 'abort'
       AND m.leavers @> jsonb_build_array(jsonb_build_object('userId', p_user::text))
       AND coalesce(m.ended_at, m.created_at) >= p_since
     ORDER BY 1 DESC
  $fn$;
  REVOKE ALL ON FUNCTION public.mm_recent_aborts(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.mm_recent_aborts(uuid, timestamptz) TO service_role;
END
$aborts$;
