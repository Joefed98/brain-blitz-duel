-- Friend challenges (22 Oct 2026; src/lib/duel/challenge.ts, challenge.server.ts). WRITTEN BUT NOT
-- APPLIED: Joe asks Lovable to apply it, after 20261021130000_async_rooms_daily.sql (it builds on
-- those tables). Until it is, the challenge status call finds no table, the Play tab's "Challenge a
-- friend" card and the podium's button stay hidden, and Profile shows no "Your challenges"; nothing
-- else changes.
--
-- A challenge is an async room (async_rooms.kind = 'challenge', room_key 'challenge:<CODE>',
-- closes_at seven days after it was made) plus one row here: its code, who made it, from where (the
-- Play tab, or a finished room's podium) and the creator's chosen categories. Attempts, rounds and
-- answers are the async room's own tables (one attempt per device, its unique index).
--
--   challenges        one row per challenge; server only.
--   challenge_events  beta recording (docs/beta-sql.md section 9): a challenge made, a link
--                     opened, a friend's finish, and whether that friend later plays a room or
--                     a daily; server only.
--
-- The 20-player cap is also held in the database: an attempt beyond the 20th on a challenge room
-- is refused by a trigger (serialised per room, so racing starts can't pass it together). Making
-- challenges is rate limited per device by the server (rateLimit.server.ts CHALLENGE_CREATE_LIMIT,
-- and at most CHALLENGE_CREATE_PER_HOUR counted from this table, which needs no other migration).
--
-- RLS: clients have no grant on either table (reads and writes go through the server functions,
-- service role); async_attempts' read policy (20261021130000) already lets a device read a room's
-- leaderboard columns only once its own attempt is finished or the room has closed.

CREATE TABLE IF NOT EXISTS public.challenges (
  room_id uuid PRIMARY KEY REFERENCES public.async_rooms (id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),
  created_by uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('play', 'room')),
  -- A challenge made from a finished room: that room and which game in it (one challenge per game).
  source_duel_id uuid,
  source_game_index integer,
  -- The creator's choice on the create screen (the room's selection, for one made from a room).
  selected_categories text[] NOT NULL DEFAULT '{}',
  round_count integer NOT NULL CHECK (round_count BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > created_at),
  CHECK ((source = 'room') = (source_duel_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS challenges_from_room
  ON public.challenges (source_duel_id, source_game_index) WHERE source_duel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS challenges_creator ON public.challenges (created_by, created_at DESC);

CREATE TABLE IF NOT EXISTS public.challenge_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id uuid,
  code text,
  user_id uuid NOT NULL,
  event text NOT NULL CHECK (event IN ('created', 'link_opened', 'friend_finished', 'followup_room', 'followup_daily')),
  -- created: 'play' or 'room'.
  source text CHECK (source IN ('play', 'room')),
  at timestamptz NOT NULL DEFAULT now()
);

-- Once per challenge and device (a link opened twice, a retried finish), and a friend's follow-up
-- once per device and kind (their first room or daily after a challenge).
CREATE UNIQUE INDEX IF NOT EXISTS challenge_events_once
  ON public.challenge_events (room_id, user_id, event) WHERE event IN ('created', 'link_opened', 'friend_finished');
CREATE UNIQUE INDEX IF NOT EXISTS challenge_events_followup_once
  ON public.challenge_events (user_id, event) WHERE event IN ('followup_room', 'followup_daily');

REVOKE ALL ON public.challenges FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.challenge_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.challenges TO service_role;
GRANT ALL ON public.challenge_events TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_events ENABLE ROW LEVEL SECURITY;

-- The cap: at most 20 attempts on a challenge room. The advisory lock serialises inserts per room,
-- so two racing 20th starts can't both pass the count.
CREATE OR REPLACE FUNCTION public.challenge_attempt_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.async_rooms r WHERE r.id = NEW.room_id AND r.kind = 'challenge') THEN
    PERFORM pg_advisory_xact_lock(hashtext('challenge_attempt_cap:' || NEW.room_id::text));
    IF (SELECT count(*) FROM public.async_attempts a WHERE a.room_id = NEW.room_id) >= 20 THEN
      RAISE EXCEPTION 'challenge_full' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.challenge_attempt_cap() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS challenge_attempt_cap ON public.async_attempts;
CREATE TRIGGER challenge_attempt_cap
  BEFORE INSERT ON public.async_attempts
  FOR EACH ROW EXECUTE FUNCTION public.challenge_attempt_cap();

-- Share taps and arrivals by source (share_events, 20261021120000, also written but not applied).
-- A Share tap on a room's final screen, a daily's results or board, or a challenge's screens, and a
-- device's first arrival from any of those links, now say which: source 'room' (every row before this
-- migration, and the default), 'daily' (with daily_kind) or 'challenge' (with challenge_code). A
-- challenge's share carries its place and counts, so place and players allow up to 20.
ALTER TABLE public.share_events
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'room',
  ADD COLUMN IF NOT EXISTS challenge_code text,
  ADD COLUMN IF NOT EXISTS daily_kind text;
ALTER TABLE public.share_events DROP CONSTRAINT IF EXISTS share_events_source_check;
ALTER TABLE public.share_events ADD CONSTRAINT share_events_source_check CHECK (source IN ('room', 'daily', 'challenge'));
ALTER TABLE public.share_events DROP CONSTRAINT IF EXISTS share_events_challenge_code_check;
ALTER TABLE public.share_events ADD CONSTRAINT share_events_challenge_code_check
  CHECK (challenge_code IS NULL OR challenge_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$');
ALTER TABLE public.share_events DROP CONSTRAINT IF EXISTS share_events_daily_kind_check;
ALTER TABLE public.share_events ADD CONSTRAINT share_events_daily_kind_check CHECK (daily_kind IS NULL OR daily_kind IN ('puzzle', 'arcade'));
ALTER TABLE public.share_events DROP CONSTRAINT IF EXISTS share_events_place_check;
ALTER TABLE public.share_events ADD CONSTRAINT share_events_place_check CHECK (place IS NULL OR place BETWEEN 1 AND 20);
ALTER TABLE public.share_events DROP CONSTRAINT IF EXISTS share_events_players_check;
ALTER TABLE public.share_events ADD CONSTRAINT share_events_players_check CHECK (players IS NULL OR players BETWEEN 1 AND 20);
CREATE INDEX IF NOT EXISTS share_events_source_idx ON public.share_events (source, event, created_at);
