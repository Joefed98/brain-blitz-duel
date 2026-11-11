-- Friends (Wave 2, train B, session B1; 11 Nov 2026; docs/friends.md). Non-destructive and idempotent: it creates a
-- schema, tables, indexes, policies and functions, and relaxes one NOT NULL (room_reports.duel_id, so a report filed
-- from a friend's profile, outside any room, goes through wave 1's own report function). No existing row is changed.
--
-- Accounts only: every table here refers to public.profiles, so a guest can't appear in any of it, and an account's
-- removal (accounts.forget_user deletes the profile) takes its friendships, requests, blocks, invite link, setting,
-- presence and events with it (ON DELETE CASCADE).
--
-- What clients may do (RLS and column grants, as Supabase applies them): a signed-in player reads only their own
-- friendships, the requests they sent or received (never a request's status, so a sender can't tell a decline), the
-- blocks they made, their invite link and their setting. Nobody writes anything: every change goes through the server
-- (src/lib/friends/friends.server.ts) on the service-role functions below. Presence and the events for phone
-- notifications (B2) are server-only.
--
-- The rules in SQL (the server checks them too, and the checks prove both):
--   * search: only an adult (18+ on the UK calendar day) may search, and search never returns an under-18 account;
--   * invite links work for every account, under-18s included;
--   * a blocked player can't request, invite, challenge or see status, both ways; blocking removes the friendship;
--   * a decline is never shown to the sender: their request still reads as sent, and a new one from them to the same
--     player is quietly ignored for 30 days;
--   * the friends cap (passed in by the server, src/lib/friends/friends.ts FRIENDS_CAP) is checked for both players.

/* ------------------------------------------------------------------ private helpers */

CREATE SCHEMA IF NOT EXISTS friends;
REVOKE ALL ON SCHEMA friends FROM PUBLIC, anon, authenticated;

-- 18 or over on the UK calendar day (the same rule as src/lib/account/age.ts).
CREATE OR REPLACE FUNCTION friends.is_adult(p_date_of_birth date)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$ SELECT p_date_of_birth <= ((now() AT TIME ZONE 'Europe/London')::date - interval '18 years')::date $$;
REVOKE ALL ON FUNCTION friends.is_adult(date) FROM PUBLIC, anon, authenticated;

/* ------------------------------------------------------------------ tables */

-- One row per friendship, the lower id first.
CREATE TABLE IF NOT EXISTS public.friendships (
  user_low uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  user_high uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_low, user_high),
  CONSTRAINT friendships_order CHECK (user_low < user_high)
);
CREATE INDEX IF NOT EXISTS friendships_high_idx ON public.friendships (user_high);

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  via text NOT NULL CHECK (via IN ('search', 'link')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT friend_requests_not_self CHECK (from_user_id <> to_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_pending_pair_idx
  ON public.friend_requests (from_user_id, to_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS friend_requests_to_idx ON public.friend_requests (to_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS friend_requests_pair_idx ON public.friend_requests (from_user_id, to_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.player_blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT player_blocks_not_self CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS player_blocks_blocked_idx ON public.player_blocks (blocked_id);

-- A player's personal invite link (/friends?invite=<token>); a reset gives a new token, the old one stops working.
CREATE TABLE IF NOT EXISTS public.friend_invite_links (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  token text NOT NULL CHECK (token ~ '^[a-z0-9]{12}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS friend_invite_links_token_idx ON public.friend_invite_links (token);

-- "Show when I'm online": null = the default (on for adults, off for under-18s, worked out on the day).
CREATE TABLE IF NOT EXISTS public.friend_settings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  show_online boolean,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The app's own heartbeat (accounts only; rooms keep theirs in duel_presence): when the player was last seen and
-- whether they were in Practice. Server only.
CREATE TABLE IF NOT EXISTS public.player_presence (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  activity text NOT NULL DEFAULT 'app' CHECK (activity IN ('app', 'practice'))
);

-- Friend events for phone notifications (B2 sends them; this session only records them). Server only.
CREATE TABLE IF NOT EXISTS public.friend_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipient_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('friend_request_received', 'friend_request_accepted',
                                     'friend_challenge_received', 'room_invite_received')),
  -- Fixed fields only: a request id, a room code, a challenge code. Never a message.
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS friend_events_recipient_idx ON public.friend_events (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS friend_events_created_idx ON public.friend_events (created_at);

/* ------------------------------------------------------------------ access */

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_invite_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.friendships, public.friend_requests, public.player_blocks, public.friend_invite_links,
  public.friend_settings, public.player_presence, public.friend_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.friendships, public.friend_requests, public.player_blocks, public.friend_invite_links,
  public.friend_settings, public.player_presence, public.friend_events TO service_role;

GRANT SELECT ON public.friendships TO authenticated;
DROP POLICY IF EXISTS friendships_read_own ON public.friendships;
CREATE POLICY friendships_read_own ON public.friendships
  FOR SELECT TO authenticated USING (auth.uid() = user_low OR auth.uid() = user_high);

-- Never the status or when it was answered: a sender can't tell a decline from a wait.
GRANT SELECT (id, from_user_id, to_user_id, via, created_at) ON public.friend_requests TO authenticated;
DROP POLICY IF EXISTS friend_requests_read_own ON public.friend_requests;
CREATE POLICY friend_requests_read_own ON public.friend_requests
  FOR SELECT TO authenticated USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- The blocker sees their own blocks; the blocked player never sees one.
GRANT SELECT ON public.player_blocks TO authenticated;
DROP POLICY IF EXISTS player_blocks_read_own ON public.player_blocks;
CREATE POLICY player_blocks_read_own ON public.player_blocks
  FOR SELECT TO authenticated USING (auth.uid() = blocker_id);

GRANT SELECT ON public.friend_invite_links TO authenticated;
DROP POLICY IF EXISTS friend_invite_links_read_own ON public.friend_invite_links;
CREATE POLICY friend_invite_links_read_own ON public.friend_invite_links
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

GRANT SELECT ON public.friend_settings TO authenticated;
DROP POLICY IF EXISTS friend_settings_read_own ON public.friend_settings;
CREATE POLICY friend_settings_read_own ON public.friend_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

/* ------------------------------------------------------------------ reports from a friend's profile */

-- Wave 1's report function (public.file_room_report) stores the room a report came from; a report from a friend's
-- profile has none. Relaxing the NOT NULL changes no row.
ALTER TABLE public.room_reports ALTER COLUMN duel_id DROP NOT NULL;

/* ------------------------------------------------------------------ private helpers over the tables */

CREATE OR REPLACE FUNCTION friends.are_friends(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.friendships
                  WHERE user_low = least(p_a, p_b) AND user_high = greatest(p_a, p_b));
$$;
REVOKE ALL ON FUNCTION friends.are_friends(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION friends.blocked_either(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.player_blocks
                  WHERE (blocker_id = p_a AND blocked_id = p_b) OR (blocker_id = p_b AND blocked_id = p_a));
$$;
REVOKE ALL ON FUNCTION friends.blocked_either(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION friends.friend_count(p_user uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer FROM public.friendships WHERE user_low = p_user OR user_high = p_user;
$$;
REVOKE ALL ON FUNCTION friends.friend_count(uuid) FROM PUBLIC, anon, authenticated;

-- An active account (a profile not waiting for deletion).
CREATE OR REPLACE FUNCTION friends.active_account(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user AND deletion_requested_at IS NULL);
$$;
REVOKE ALL ON FUNCTION friends.active_account(uuid) FROM PUBLIC, anon, authenticated;

-- Whether the player shows their status: their setting, else on for adults and off for under-18s.
CREATE OR REPLACE FUNCTION friends.shows_online(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, friends
AS $$
  SELECT coalesce(
    (SELECT s.show_online FROM public.friend_settings s WHERE s.user_id = p_user),
    (SELECT friends.is_adult(p.date_of_birth) FROM public.profiles p WHERE p.user_id = p_user),
    false);
$$;
REVOKE ALL ON FUNCTION friends.shows_online(uuid) FROM PUBLIC, anon, authenticated;

-- A player's open room (in it, not left, the room waiting or playing and not disbanded), the most recently seen.
CREATE OR REPLACE FUNCTION friends.open_room(p_user uuid)
RETURNS TABLE (duel_id uuid, room_code text, status text, players integer, max_players integer, seen_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.room_code, d.status,
         (SELECT count(*)::integer FROM public.duel_players x WHERE x.duel_id = d.id AND x.status <> 'left'),
         d.max_players,
         greatest(dp.last_seen_at, pr.last_seen_at)
    FROM public.duel_players dp
    JOIN public.duels d ON d.id = dp.duel_id
    LEFT JOIN public.duel_presence pr ON pr.duel_id = dp.duel_id AND pr.user_id = dp.user_id
   WHERE dp.user_id = p_user AND dp.status <> 'left'
     AND d.disbanded_at IS NULL AND d.status IN ('waiting', 'playing')
   ORDER BY greatest(dp.last_seen_at, pr.last_seen_at) DESC NULLS LAST
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION friends.open_room(uuid) FROM PUBLIC, anon, authenticated;

-- A player's status as their friends see it: 'room' (a lobby, with its code and seats), 'playing' (a room's game),
-- 'practice', 'online', 'offline' (with when they were last seen), or 'hidden' (their setting is off). Online means
-- seen in the past 150 seconds (the phone beats every 60).
CREATE OR REPLACE FUNCTION friends.status_of(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, friends
AS $$
DECLARE
  v_room record;
  v_beat public.player_presence%ROWTYPE;
  v_window interval := interval '150 seconds';
  v_last timestamptz;
BEGIN
  IF NOT friends.shows_online(p_user) THEN
    RETURN jsonb_build_object('kind', 'hidden');
  END IF;
  SELECT * INTO v_room FROM friends.open_room(p_user);
  IF FOUND AND v_room.seen_at > now() - v_window THEN
    IF v_room.status = 'waiting' THEN
      RETURN jsonb_build_object('kind', 'room', 'code', v_room.room_code, 'players', v_room.players,
                                'maxPlayers', v_room.max_players);
    END IF;
    RETURN jsonb_build_object('kind', 'playing', 'code', v_room.room_code);
  END IF;
  SELECT * INTO v_beat FROM public.player_presence WHERE user_id = p_user;
  IF FOUND AND v_beat.last_seen_at > now() - v_window THEN
    RETURN jsonb_build_object('kind', CASE WHEN v_beat.activity = 'practice' THEN 'practice' ELSE 'online' END);
  END IF;
  SELECT max(greatest(dp.last_seen_at, pr.last_seen_at)) INTO v_last
    FROM public.duel_players dp
    LEFT JOIN public.duel_presence pr ON pr.duel_id = dp.duel_id AND pr.user_id = dp.user_id
   WHERE dp.user_id = p_user;
  v_last := greatest(v_last, v_beat.last_seen_at);
  RETURN jsonb_build_object('kind', 'offline', 'lastSeen', v_last);
END;
$$;
REVOKE ALL ON FUNCTION friends.status_of(uuid) FROM PUBLIC, anon, authenticated;

-- A player's public fields (as public_profiles).
CREATE OR REPLACE FUNCTION friends.card(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('id', p.user_id, 'username', p.username, 'colour', p.colour,
                            'playerNumber', p.player_number, 'founding', p.founding)
    FROM public.profiles p WHERE p.user_id = p_user AND p.deletion_requested_at IS NULL;
$$;
REVOKE ALL ON FUNCTION friends.card(uuid) FROM PUBLIC, anon, authenticated;

-- Makes a friendship between two players whose requests are being answered: cap checked for both, pending requests
-- between them settled. Answers 'accepted', 'cap' (the caller's list is full) or 'their_cap'.
CREATE OR REPLACE FUNCTION friends.befriend(p_user uuid, p_other uuid, p_cap integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, friends
AS $$
BEGIN
  IF friends.are_friends(p_user, p_other) THEN
    RETURN 'accepted';
  END IF;
  IF friends.friend_count(p_user) >= p_cap THEN
    RETURN 'cap';
  END IF;
  IF friends.friend_count(p_other) >= p_cap THEN
    RETURN 'their_cap';
  END IF;
  INSERT INTO public.friendships (user_low, user_high)
  VALUES (least(p_user, p_other), greatest(p_user, p_other))
  ON CONFLICT DO NOTHING;
  UPDATE public.friend_requests SET status = 'accepted', responded_at = now()
   WHERE status = 'pending'
     AND ((from_user_id = p_user AND to_user_id = p_other) OR (from_user_id = p_other AND to_user_id = p_user));
  RETURN 'accepted';
END;
$$;
REVOKE ALL ON FUNCTION friends.befriend(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;

-- One lock per pair of players (in either order), held to the end of the transaction, so two requests, an accept
-- and a block can't interleave.
CREATE OR REPLACE FUNCTION friends.lock_pair(p_a uuid, p_b uuid)
RETURNS void
LANGUAGE sql
AS $$ SELECT pg_advisory_xact_lock(hashtextextended(least(p_a, p_b)::text || greatest(p_a, p_b)::text, 7177)) $$;
REVOKE ALL ON FUNCTION friends.lock_pair(uuid, uuid) FROM PUBLIC, anon, authenticated;

/* ------------------------------------------------------------------ server functions (service role only) */

-- Search by username for an adult (18+): a prefix of the name, ignoring capitals, up to p_limit players. Never an
-- under-18 account, the caller, an account waiting for deletion, or anyone blocked either way. An under-18 caller (or
-- a guest) gets nothing. Each row says how the caller stands with them: 'friends', 'requested', 'incoming', 'none'.
CREATE OR REPLACE FUNCTION public.friends_search(p_user uuid, p_query text, p_limit integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, friends
AS $$
DECLARE
  v_q text := lower(coalesce(p_query, ''));
  v_rows jsonb;
BEGIN
  IF v_q !~ '^[a-z0-9_]{2,16}$' THEN
    RETURN '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles me WHERE me.user_id = p_user AND me.deletion_requested_at IS NULL
                                                    AND friends.is_adult(me.date_of_birth)) THEN
    RETURN '[]'::jsonb;
  END IF;
  SELECT coalesce(jsonb_agg(hit ORDER BY ord, len, key), '[]'::jsonb) INTO v_rows FROM (
    SELECT jsonb_build_object(
             'id', p.user_id, 'username', p.username, 'colour', p.colour, 'playerNumber', p.player_number,
             'founding', p.founding,
             'relation', CASE
               WHEN friends.are_friends(p_user, p.user_id) THEN 'friends'
               WHEN EXISTS (SELECT 1 FROM public.friend_requests r WHERE r.from_user_id = p.user_id AND r.to_user_id = p_user
                                                                    AND r.status = 'pending') THEN 'incoming'
               WHEN EXISTS (SELECT 1 FROM public.friend_requests r WHERE r.from_user_id = p_user AND r.to_user_id = p.user_id
                              AND (r.status = 'pending' OR (r.status = 'declined' AND r.created_at > now() - interval '30 days')))
                 THEN 'requested'
               ELSE 'none' END) AS hit,
           CASE WHEN p.username_key = v_q THEN 0 ELSE 1 END AS ord,
           length(p.username_key) AS len,
           p.username_key AS key
      FROM public.profiles p
     WHERE p.username_key LIKE replace(v_q, '_', '\_') || '%'
       AND p.user_id <> p_user
       AND p.deletion_requested_at IS NULL
       AND friends.is_adult(p.date_of_birth)
       AND NOT friends.blocked_either(p_user, p.user_id)
     ORDER BY ord, len, key
     LIMIT greatest(1, least(coalesce(p_limit, 10), 20))
  ) found;
  RETURN v_rows;
END;
$$;
REVOKE ALL ON FUNCTION public.friends_search(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.friends_search(uuid, text, integer) TO service_role;

-- Sends a friend request. p_via 'search' (both players must be adults) or 'link' (anyone with the link). Answers
-- {result, created, requestId?}: result 'sent' (also when the other player has blocked the caller, or declined them in
-- the past 30 days: they are never told, and nothing is stored), 'accepted' (they had already asked the caller: now
-- friends), 'friends' (already), 'blocked' (the caller has blocked them: unblock first), 'cap' / 'their_cap',
-- 'not_found' (no such account, or search's age rule), 'self', 'not_account' (the caller has no account).
CREATE OR REPLACE FUNCTION public.friends_send_request(p_from uuid, p_to uuid, p_via text, p_cap integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, friends
AS $$
DECLARE
  v_reverse uuid;
  v_id uuid;
  v_result text;
BEGIN
  IF p_via NOT IN ('search', 'link') THEN
    RAISE EXCEPTION 'friends_send_request: unknown via %', p_via;
  END IF;
  IF NOT friends.active_account(p_from) THEN
    RETURN jsonb_build_object('result', 'not_account', 'created', false);
  END IF;
  IF p_from = p_to THEN
    RETURN jsonb_build_object('result', 'self', 'created', false);
  END IF;
  IF NOT friends.active_account(p_to) THEN
    RETURN jsonb_build_object('result', 'not_found', 'created', false);
  END IF;
  IF p_via = 'search' AND NOT EXISTS (
       SELECT 1 FROM public.profiles a, public.profiles b
        WHERE a.user_id = p_from AND b.user_id = p_to
          AND friends.is_adult(a.date_of_birth) AND friends.is_adult(b.date_of_birth)) THEN
    RETURN jsonb_build_object('result', 'not_found', 'created', false);
  END IF;
  PERFORM friends.lock_pair(p_from, p_to);
  IF EXISTS (SELECT 1 FROM public.player_blocks WHERE blocker_id = p_from AND blocked_id = p_to) THEN
    RETURN jsonb_build_object('result', 'blocked', 'created', false);
  END IF;
  IF EXISTS (SELECT 1 FROM public.player_blocks WHERE blocker_id = p_to AND blocked_id = p_from) THEN
    RETURN jsonb_build_object('result', 'sent', 'created', false);
  END IF;
  IF friends.are_friends(p_from, p_to) THEN
    RETURN jsonb_build_object('result', 'friends', 'created', false);
  END IF;
  SELECT id INTO v_reverse FROM public.friend_requests
   WHERE from_user_id = p_to AND to_user_id = p_from AND status = 'pending';
  IF FOUND THEN
    v_result := friends.befriend(p_from, p_to, p_cap);
    IF v_result = 'accepted' THEN
      INSERT INTO public.friend_events (recipient_id, actor_id, kind, payload)
      VALUES (p_to, p_from, 'friend_request_accepted', jsonb_build_object('requestId', v_reverse));
    END IF;
    RETURN jsonb_build_object('result', v_result, 'created', false, 'requestId', v_reverse);
  END IF;
  SELECT id INTO v_id FROM public.friend_requests
   WHERE from_user_id = p_from AND to_user_id = p_to
     AND (status = 'pending' OR (status = 'declined' AND created_at > now() - interval '30 days'))
   ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('result', 'sent', 'created', false, 'requestId', v_id);
  END IF;
  IF friends.friend_count(p_from) >= p_cap THEN
    RETURN jsonb_build_object('result', 'cap', 'created', false);
  END IF;
  INSERT INTO public.friend_requests (from_user_id, to_user_id, via) VALUES (p_from, p_to, p_via) RETURNING id INTO v_id;
  INSERT INTO public.friend_events (recipient_id, actor_id, kind, payload)
  VALUES (p_to, p_from, 'friend_request_received', jsonb_build_object('requestId', v_id));
  RETURN jsonb_build_object('result', 'sent', 'created', true, 'requestId', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.friends_send_request(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.friends_send_request(uuid, uuid, text, integer) TO service_role;

-- Answers a request sent to p_user. Accept: friends (cap checked for both), the sender's event. Decline: nothing is
-- sent to anyone. Answers {result: 'accepted' | 'declined' | 'missing' | 'cap' | 'their_cap', friend, via}.
CREATE OR REPLACE FUNCTION public.friends_respond(p_user uuid, p_request uuid, p_accept boolean, p_cap integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, friends
AS $$
DECLARE
  v_req public.friend_requests%ROWTYPE;
  v_result text;
BEGIN
  SELECT * INTO v_req FROM public.friend_requests WHERE id = p_request AND to_user_id = p_user;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'missing');
  END IF;
  PERFORM friends.lock_pair(v_req.from_user_id, p_user);
  SELECT * INTO v_req FROM public.friend_requests WHERE id = p_request FOR UPDATE;
  IF v_req.status <> 'pending' OR NOT friends.active_account(v_req.from_user_id)
     OR friends.blocked_either(p_user, v_req.from_user_id) THEN
    RETURN jsonb_build_object('result', 'missing');
  END IF;
  IF NOT p_accept THEN
    UPDATE public.friend_requests SET status = 'declined', responded_at = now() WHERE id = p_request;
    RETURN jsonb_build_object('result', 'declined', 'friend', v_req.from_user_id, 'via', v_req.via);
  END IF;
  v_result := friends.befriend(p_user, v_req.from_user_id, p_cap);
  IF v_result = 'accepted' THEN
    INSERT INTO public.friend_events (recipient_id, actor_id, kind, payload)
    VALUES (v_req.from_user_id, p_user, 'friend_request_accepted', jsonb_build_object('requestId', p_request));
  END IF;
  RETURN jsonb_build_object('result', v_result, 'friend', v_req.from_user_id, 'via', v_req.via);
END;
$$;
REVOKE ALL ON FUNCTION public.friends_respond(uuid, uuid, boolean, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.friends_respond(uuid, uuid, boolean, integer) TO service_role;

-- Removes a friendship, silently (no event; pending requests between them are cancelled). Answers whether one existed.
CREATE OR REPLACE FUNCTION public.friends_remove(p_user uuid, p_friend uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, friends
AS $$
DECLARE
  n integer;
BEGIN
  PERFORM friends.lock_pair(p_user, p_friend);
  DELETE FROM public.friendships WHERE user_low = least(p_user, p_friend) AND user_high = greatest(p_user, p_friend);
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.friend_requests SET status = 'cancelled', responded_at = now()
   WHERE status = 'pending'
     AND ((from_user_id = p_user AND to_user_id = p_friend) OR (from_user_id = p_friend AND to_user_id = p_user));
  RETURN n > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.friends_remove(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.friends_remove(uuid, uuid) TO service_role;

-- Blocks a player (an account): the friendship and any pending request either way go, and from now on neither can
-- request, invite, challenge or see the other's status. The blocked player is never told. Answers {result:
-- 'blocked' | 'not_found' | 'self', removed (a friendship was removed), created (a new block)}.
CREATE OR REPLACE FUNCTION public.friends_block(p_user uuid, p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, friends
AS $$
DECLARE
  n integer;
  v_created integer;
BEGIN
  IF p_user = p_target THEN
    RETURN jsonb_build_object('result', 'self', 'removed', false, 'created', false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_target)
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user) THEN
    RETURN jsonb_build_object('result', 'not_found', 'removed', false, 'created', false);
  END IF;
  PERFORM friends.lock_pair(p_user, p_target);
  INSERT INTO public.player_blocks (blocker_id, blocked_id) VALUES (p_user, p_target) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_created = ROW_COUNT;
  DELETE FROM public.friendships WHERE user_low = least(p_user, p_target) AND user_high = greatest(p_user, p_target);
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.friend_requests SET status = 'cancelled', responded_at = now()
   WHERE status = 'pending'
     AND ((from_user_id = p_user AND to_user_id = p_target) OR (from_user_id = p_target AND to_user_id = p_user));
  RETURN jsonb_build_object('result', 'blocked', 'removed', n > 0, 'created', v_created > 0);
END;
$$;
REVOKE ALL ON FUNCTION public.friends_block(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.friends_block(uuid, uuid) TO service_role;

-- Lifts the caller's own block (it doesn't make them friends again). Answers whether there was one.
CREATE OR REPLACE FUNCTION public.friends_unblock(p_user uuid, p_target uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  DELETE FROM public.player_blocks WHERE blocker_id = p_user AND blocked_id = p_target;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.friends_unblock(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.friends_unblock(uuid, uuid) TO service_role;

-- The caller's invite link's token: their current one, or p_token when they have none or p_reset (a reset retires the
-- old token at once). Answers the token, or null for a guest; a token already in use raises unique_violation (the
-- server draws another).
CREATE OR REPLACE FUNCTION public.friends_invite_token(p_user uuid, p_token text, p_reset boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, friends
AS $$
DECLARE
  v_token text;
BEGIN
  IF NOT friends.active_account(p_user) THEN
    RETURN NULL;
  END IF;
  IF NOT p_reset THEN
    SELECT token INTO v_token FROM public.friend_invite_links WHERE user_id = p_user;
    IF FOUND THEN
      RETURN v_token;
    END IF;
  END IF;
  INSERT INTO public.friend_invite_links (user_id, token, created_at) VALUES (p_user, p_token, now())
  ON CONFLICT (user_id) DO UPDATE SET token = EXCLUDED.token, created_at = EXCLUDED.created_at;
  RETURN p_token;
END;
$$;
REVOKE ALL ON FUNCTION public.friends_invite_token(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.friends_invite_token(uuid, text, boolean) TO service_role;

-- Whose link a token is (their public fields), or null: no such token, a reset one, an account waiting for deletion.
CREATE OR REPLACE FUNCTION public.friends_link_owner(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, friends
AS $$
  SELECT friends.card(l.user_id) FROM public.friend_invite_links l WHERE l.token = lower(p_token);
$$;
REVOKE ALL ON FUNCTION public.friends_link_owner(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.friends_link_owner(text) TO service_role;

-- "Show when I'm online": true / false, or null for the default by age.
CREATE OR REPLACE FUNCTION public.friends_set_show_online(p_user uuid, p_show boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, friends
AS $$
BEGIN
  IF NOT friends.active_account(p_user) THEN
    RETURN false;
  END IF;
  INSERT INTO public.friend_settings (user_id, show_online, updated_at) VALUES (p_user, p_show, now())
  ON CONFLICT (user_id) DO UPDATE SET show_online = EXCLUDED.show_online, updated_at = EXCLUDED.updated_at;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.friends_set_show_online(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.friends_set_show_online(uuid, boolean) TO service_role;

-- The app's heartbeat for an account: seen now, in Practice or elsewhere. Answers false for a guest.
CREATE OR REPLACE FUNCTION public.friends_presence_beat(p_user uuid, p_activity text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, friends
AS $$
BEGIN
  IF p_activity NOT IN ('app', 'practice') THEN
    RAISE EXCEPTION 'friends_presence_beat: unknown activity %', p_activity;
  END IF;
  IF NOT friends.active_account(p_user) THEN
    RETURN false;
  END IF;
  INSERT INTO public.player_presence (user_id, last_seen_at, activity) VALUES (p_user, now(), p_activity)
  ON CONFLICT (user_id) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at, activity = EXCLUDED.activity;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.friends_presence_beat(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.friends_presence_beat(uuid, text) TO service_role;

-- Invites a friend to the caller's open lobby (the room the caller is in, waiting to start; never a code the phone
-- names). Answers {result: 'sent' | 'no_room' | 'not_friends' | 'room_full', code, created}. The same invite within two
-- minutes isn't recorded twice.
CREATE OR REPLACE FUNCTION public.friends_room_invite(p_from uuid, p_to uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, friends
AS $$
DECLARE
  v_room record;
BEGIN
  IF NOT friends.are_friends(p_from, p_to) OR friends.blocked_either(p_from, p_to)
     OR NOT friends.active_account(p_to) THEN
    RETURN jsonb_build_object('result', 'not_friends', 'created', false);
  END IF;
  SELECT * INTO v_room FROM friends.open_room(p_from);
  IF NOT FOUND OR v_room.status <> 'waiting' THEN
    RETURN jsonb_build_object('result', 'no_room', 'created', false);
  END IF;
  IF v_room.players >= v_room.max_players THEN
    RETURN jsonb_build_object('result', 'room_full', 'code', v_room.room_code, 'created', false);
  END IF;
  IF EXISTS (SELECT 1 FROM public.friend_events
              WHERE recipient_id = p_to AND actor_id = p_from AND kind = 'room_invite_received'
                AND payload ->> 'code' = v_room.room_code AND created_at > now() - interval '2 minutes') THEN
    RETURN jsonb_build_object('result', 'sent', 'code', v_room.room_code, 'created', false);
  END IF;
  INSERT INTO public.friend_events (recipient_id, actor_id, kind, payload)
  VALUES (p_to, p_from, 'room_invite_received', jsonb_build_object('code', v_room.room_code, 'roomId', v_room.duel_id));
  RETURN jsonb_build_object('result', 'sent', 'code', v_room.room_code, 'created', true);
END;
$$;
REVOKE ALL ON FUNCTION public.friends_room_invite(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.friends_room_invite(uuid, uuid) TO service_role;

-- Sends the caller's own open friend challenge (made through the existing flow) to a friend. Answers {result: 'sent' |
-- 'not_friends' | 'not_found', created}; the same challenge to the same friend is recorded once.
CREATE OR REPLACE FUNCTION public.friends_challenge_send(p_from uuid, p_to uuid, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, friends
AS $$
BEGIN
  IF NOT friends.are_friends(p_from, p_to) OR friends.blocked_either(p_from, p_to)
     OR NOT friends.active_account(p_to) THEN
    RETURN jsonb_build_object('result', 'not_friends', 'created', false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.challenges
                  WHERE code = upper(p_code) AND created_by = p_from AND expires_at > now()) THEN
    RETURN jsonb_build_object('result', 'not_found', 'created', false);
  END IF;
  IF EXISTS (SELECT 1 FROM public.friend_events
              WHERE recipient_id = p_to AND actor_id = p_from AND kind = 'friend_challenge_received'
                AND payload ->> 'code' = upper(p_code)) THEN
    RETURN jsonb_build_object('result', 'sent', 'created', false);
  END IF;
  INSERT INTO public.friend_events (recipient_id, actor_id, kind, payload)
  VALUES (p_to, p_from, 'friend_challenge_received', jsonb_build_object('code', upper(p_code)));
  RETURN jsonb_build_object('result', 'sent', 'created', true);
END;
$$;
REVOKE ALL ON FUNCTION public.friends_challenge_send(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.friends_challenge_send(uuid, uuid, text) TO service_role;

-- Whether two players are friends (for the chat policy and later waves: friends type to each other everywhere).
CREATE OR REPLACE FUNCTION public.friends_are_friends(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, friends
AS $$ SELECT friends.are_friends(p_a, p_b) AND NOT friends.blocked_either(p_a, p_b) $$;
REVOKE ALL ON FUNCTION public.friends_are_friends(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.friends_are_friends(uuid, uuid) TO service_role;

-- The head-to-head record of p_a against p_b from what both played: finished room games (each Play again's game
-- from the archive, and the room's latest finished game) and finished friend challenges both played, each won by the
-- higher total (level: a draw). Answers {matches, wins, losses, draws, last (newest first, up to 5: 'win', 'loss',
-- 'draw'), best ({game, wins, played}: the game whose rounds p_a won most against p_b in rooms, or null)}.
CREATE OR REPLACE FUNCTION public.friends_head_to_head(p_a uuid, p_b uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH archived AS (
    SELECT r.duel_id, r.game_index, r.round_number, r.game_id, r.user_id, r.score, r.submitted_at
      FROM public.round_results_archive r
     WHERE r.user_id IN (p_a, p_b)
       AND r.duel_id IN (SELECT duel_id FROM public.round_results_archive WHERE user_id = p_a
                         INTERSECT SELECT duel_id FROM public.round_results_archive WHERE user_id = p_b)
  ),
  latest AS (
    SELECT r.duel_id, jsonb_array_length(d.tournament_history) AS game_index, r.round_number,
           d.round_order ->> (r.round_number - 1) AS game_id, p.user_id, r.score, r.submitted_at
      FROM public.duels d
      JOIN public.duel_players p ON p.duel_id = d.id AND p.user_id IN (p_a, p_b)
      JOIN public.round_results r ON r.duel_id = d.id AND r.player_slot = p.player_slot
     WHERE d.status = 'finished' AND d.disbanded_at IS NULL
       AND d.id IN (SELECT duel_id FROM public.duel_players WHERE user_id = p_a
                    INTERSECT SELECT duel_id FROM public.duel_players WHERE user_id = p_b)
  ),
  rounds AS (SELECT * FROM archived UNION ALL SELECT * FROM latest),
  room_games AS (
    SELECT duel_id::text || ':' || game_index AS game_key,
           sum(score) FILTER (WHERE user_id = p_a) AS a_total,
           sum(score) FILTER (WHERE user_id = p_b) AS b_total,
           max(submitted_at) AS ended_at
      FROM rounds GROUP BY duel_id, game_index
    HAVING count(*) FILTER (WHERE user_id = p_a) > 0 AND count(*) FILTER (WHERE user_id = p_b) > 0
  ),
  challenge_games AS (
    SELECT 'c:' || a.room_id::text AS game_key, a.total_score::bigint AS a_total, b.total_score::bigint AS b_total,
           greatest(a.finished_at, b.finished_at) AS ended_at
      FROM public.async_attempts a
      JOIN public.async_attempts b ON b.room_id = a.room_id AND b.user_id = p_b AND b.finished_at IS NOT NULL
      JOIN public.async_rooms ar ON ar.id = a.room_id AND ar.kind = 'challenge'
     WHERE a.user_id = p_a AND a.finished_at IS NOT NULL
  ),
  games AS (
    SELECT ended_at, CASE WHEN a_total > b_total THEN 'win' WHEN a_total < b_total THEN 'loss' ELSE 'draw' END AS result
      FROM (SELECT * FROM room_games UNION ALL SELECT * FROM challenge_games) g
  ),
  round_pairs AS (
    SELECT game_id,
           max(score) FILTER (WHERE user_id = p_a) AS a_score,
           max(score) FILTER (WHERE user_id = p_b) AS b_score
      FROM rounds WHERE game_id IS NOT NULL
     GROUP BY duel_id, game_index, round_number, game_id
    HAVING count(*) FILTER (WHERE user_id = p_a) > 0 AND count(*) FILTER (WHERE user_id = p_b) > 0
  ),
  best AS (
    SELECT game_id, count(*) FILTER (WHERE a_score > b_score) AS wins, count(*) AS played
      FROM round_pairs GROUP BY game_id
     ORDER BY count(*) FILTER (WHERE a_score > b_score) DESC, count(*) FILTER (WHERE a_score < b_score), game_id
     LIMIT 1
  )
  SELECT jsonb_build_object(
    'matches', (SELECT count(*) FROM games),
    'wins', (SELECT count(*) FROM games WHERE result = 'win'),
    'losses', (SELECT count(*) FROM games WHERE result = 'loss'),
    'draws', (SELECT count(*) FROM games WHERE result = 'draw'),
    'last', coalesce((SELECT jsonb_agg(result ORDER BY ended_at DESC)
                        FROM (SELECT result, ended_at FROM games ORDER BY ended_at DESC LIMIT 5) l), '[]'::jsonb),
    'best', (SELECT jsonb_build_object('game', game_id, 'wins', wins, 'played', played) FROM best WHERE wins > 0));
$$;
REVOKE ALL ON FUNCTION public.friends_head_to_head(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.friends_head_to_head(uuid, uuid) TO service_role;

-- Everything the Friends list shows, for p_user: friends with their status (as each one's setting allows), requests
-- waiting for them, players they have asked (still shown as asked after a decline), room invites from friends in the
-- past 30 minutes to lobbies still open, challenges from friends still open and not yet played, the players they have
-- blocked, the count, the cap and their own "Show when I'm online" (setting and effective value). Null for a guest.
CREATE OR REPLACE FUNCTION public.friends_overview(p_user uuid, p_cap integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, friends
AS $$
DECLARE
  v_me public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_me FROM public.profiles WHERE user_id = p_user AND deletion_requested_at IS NULL;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'friends', coalesce((
      SELECT jsonb_agg(friends.card(f.other) || jsonb_build_object('since', f.created_at, 'status', friends.status_of(f.other))
                       ORDER BY p.username_key)
        FROM (SELECT CASE WHEN user_low = p_user THEN user_high ELSE user_low END AS other, created_at
                FROM public.friendships WHERE user_low = p_user OR user_high = p_user) f
        JOIN public.profiles p ON p.user_id = f.other AND p.deletion_requested_at IS NULL), '[]'::jsonb),
    'incoming', coalesce((
      SELECT jsonb_agg(friends.card(r.from_user_id) || jsonb_build_object('requestId', r.id, 'via', r.via, 'at', r.created_at)
                       ORDER BY r.created_at DESC)
        FROM public.friend_requests r
       WHERE r.to_user_id = p_user AND r.status = 'pending' AND friends.active_account(r.from_user_id)
         AND NOT friends.blocked_either(p_user, r.from_user_id)), '[]'::jsonb),
    'outgoing', coalesce((
      SELECT jsonb_agg(DISTINCT r.to_user_id)
        FROM public.friend_requests r
       WHERE r.from_user_id = p_user
         AND (r.status = 'pending' OR (r.status = 'declined' AND r.created_at > now() - interval '30 days'))), '[]'::jsonb),
    'invites', coalesce((
      SELECT jsonb_agg(x ORDER BY at DESC) FROM (
        SELECT DISTINCT ON (e.actor_id)
               friends.card(e.actor_id) || jsonb_build_object('code', e.payload ->> 'code', 'at', e.created_at) AS x,
               e.created_at AS at
          FROM public.friend_events e
          JOIN public.duels d ON d.room_code = e.payload ->> 'code' AND d.id::text = e.payload ->> 'roomId'
         WHERE e.recipient_id = p_user AND e.kind = 'room_invite_received'
           AND e.created_at > now() - interval '30 minutes'
           AND d.status = 'waiting' AND d.disbanded_at IS NULL
           AND friends.are_friends(p_user, e.actor_id) AND NOT friends.blocked_either(p_user, e.actor_id)
           AND NOT EXISTS (SELECT 1 FROM public.duel_players dp WHERE dp.duel_id = d.id AND dp.user_id = p_user
                                                                  AND dp.status <> 'left')
         ORDER BY e.actor_id, e.created_at DESC) i), '[]'::jsonb),
    'challenges', coalesce((
      SELECT jsonb_agg(friends.card(e.actor_id) || jsonb_build_object('code', c.code, 'at', e.created_at,
                                                                       'expiresAt', c.expires_at)
                       ORDER BY e.created_at DESC)
        FROM public.friend_events e
        JOIN public.challenges c ON c.code = e.payload ->> 'code'
       WHERE e.recipient_id = p_user AND e.kind = 'friend_challenge_received'
         AND c.expires_at > now()
         AND friends.are_friends(p_user, e.actor_id) AND NOT friends.blocked_either(p_user, e.actor_id)
         AND NOT EXISTS (SELECT 1 FROM public.async_attempts a WHERE a.room_id = c.room_id AND a.user_id = p_user)),
      '[]'::jsonb),
    'blocked', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', b.blocked_id, 'username', p.username) ORDER BY p.username_key)
        FROM public.player_blocks b JOIN public.profiles p ON p.user_id = b.blocked_id
       WHERE b.blocker_id = p_user), '[]'::jsonb),
    'count', friends.friend_count(p_user),
    'cap', p_cap,
    'showOnline', friends.shows_online(p_user),
    'showOnlineSetting', (SELECT show_online FROM public.friend_settings WHERE user_id = p_user),
    'adult', friends.is_adult(v_me.date_of_birth));
END;
$$;
REVOKE ALL ON FUNCTION public.friends_overview(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.friends_overview(uuid, integer) TO service_role;

-- How many requests are waiting for p_user (the badge on Friends).
CREATE OR REPLACE FUNCTION public.friends_waiting(p_user uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, friends
AS $$
  SELECT count(*)::integer FROM public.friend_requests r
   WHERE r.to_user_id = p_user AND r.status = 'pending' AND friends.active_account(r.from_user_id)
     AND NOT friends.blocked_either(p_user, r.from_user_id);
$$;
REVOKE ALL ON FUNCTION public.friends_waiting(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.friends_waiting(uuid) TO service_role;

-- Another player's profile as p_viewer sees it: their card, how they stand ('self', 'friends', 'requested',
-- 'incoming' (with the request's id), 'none', 'blocked' (the viewer blocked them)), and for a friend their status and
-- the head-to-head; plus the viewer's own open lobby (for Invite to room). Null when there's nothing to show: no such
-- account, one waiting for deletion, or the other player has blocked the viewer.
CREATE OR REPLACE FUNCTION public.friends_profile(p_viewer uuid, p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, friends
AS $$
DECLARE
  v_card jsonb := friends.card(p_target);
  v_relation text;
  v_request uuid;
  v_room record;
  v_friend boolean;
BEGIN
  IF v_card IS NULL OR EXISTS (SELECT 1 FROM public.player_blocks WHERE blocker_id = p_target AND blocked_id = p_viewer) THEN
    RETURN NULL;
  END IF;
  v_friend := friends.are_friends(p_viewer, p_target);
  IF p_viewer = p_target THEN
    v_relation := 'self';
  ELSIF EXISTS (SELECT 1 FROM public.player_blocks WHERE blocker_id = p_viewer AND blocked_id = p_target) THEN
    v_relation := 'blocked';
  ELSIF v_friend THEN
    v_relation := 'friends';
  ELSE
    SELECT id INTO v_request FROM public.friend_requests
     WHERE from_user_id = p_target AND to_user_id = p_viewer AND status = 'pending';
    IF FOUND THEN
      v_relation := 'incoming';
    ELSIF EXISTS (SELECT 1 FROM public.friend_requests
                   WHERE from_user_id = p_viewer AND to_user_id = p_target
                     AND (status = 'pending' OR (status = 'declined' AND created_at > now() - interval '30 days'))) THEN
      v_relation := 'requested';
    ELSE
      v_relation := 'none';
    END IF;
  END IF;
  SELECT * INTO v_room FROM friends.open_room(p_viewer);
  RETURN jsonb_build_object(
    'card', v_card,
    'relation', v_relation,
    'requestId', v_request,
    'status', CASE WHEN v_relation = 'friends' THEN friends.status_of(p_target) END,
    'headToHead', CASE WHEN v_relation = 'friends' THEN public.friends_head_to_head(p_viewer, p_target) END,
    'myRoom', CASE WHEN FOUND AND v_room.status = 'waiting' THEN jsonb_build_object('code', v_room.room_code) END);
END;
$$;
REVOKE ALL ON FUNCTION public.friends_profile(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.friends_profile(uuid, uuid) TO service_role;

/* ------------------------------------------------------------------ Joe's review list: where each report came from */

-- moderation.report_queue (20261110150000_moderation.sql) exactly as before, with two columns added at the end:
--   sources       where the player's reports came from: 'chat message' (a room's message), 'room name' (a lobby
--                 name) or 'profile' (a friend's or player's profile, outside any room: duel_id null);
--   from_profile  how many of the player's reports came from a profile.
-- Every earlier column keeps its name, order and meaning; still unreachable from the API.
CREATE OR REPLACE VIEW moderation.report_queue AS
SELECT r.reported_user_id AS user_id,
       coalesce(p.username, (array_agg(r.reported_name ORDER BY r.created_at DESC) FILTER (WHERE r.reported_name IS NOT NULL))[1])
         AS name,
       (p.user_id IS NOT NULL) AS has_account,
       array_agg(DISTINCT r.reason) FILTER (WHERE r.reason IS NOT NULL) AS reasons,
       array_remove(array_agg(r.message_text ORDER BY r.created_at DESC), NULL) AS messages,
       count(DISTINCT r.reporter_user_id) AS players_reporting,
       count(*) AS reports,
       count(*) FILTER (WHERE r.resolved_at IS NULL) AS open_reports,
       max(r.created_at) AS latest_report,
       min(r.created_at) FILTER (WHERE r.resolved_at IS NULL) AS oldest_open,
       CASE WHEN s.muted_until > now() THEN s.muted_until END AS muted_until,
       CASE WHEN s.banned_until > now() THEN s.banned_until END AS banned_until,
       CASE WHEN count(*) FILTER (WHERE r.resolved_at IS NULL) > 0 THEN 'open' ELSE 'resolved' END AS status,
       array_agg(r.id ORDER BY r.created_at DESC) AS report_ids,
       array_agg(DISTINCT CASE WHEN r.duel_id IS NULL THEN 'profile'
                               WHEN r.message_id IS NOT NULL OR r.message_text IS NOT NULL THEN 'chat message'
                               ELSE 'room name' END) AS sources,
       count(*) FILTER (WHERE r.duel_id IS NULL) AS from_profile
  FROM public.room_reports r
  LEFT JOIN public.profiles p ON p.user_id = r.reported_user_id
  LEFT JOIN moderation.player_state s ON s.user_id = r.reported_user_id
 WHERE r.reported_user_id IS NOT NULL
 GROUP BY r.reported_user_id, p.user_id, p.username, s.muted_until, s.banned_until
 ORDER BY max(r.created_at) DESC;
REVOKE ALL ON moderation.report_queue FROM PUBLIC, anon, authenticated, service_role;
