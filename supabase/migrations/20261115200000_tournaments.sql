-- Tournaments (wave 4, session W4b; 11 Nov 2026; docs/tournaments/README.md, docs/tournaments/interface.md).
-- Non-destructive and idempotent: it creates a schema, tables, functions and policies, adds two rows to
-- public.economy_reasons and widens async_rooms' kind check by one value (every kind allowed before is still allowed;
-- no row is touched). Coins and tickets move only through A1's own functions (economy_spend, economy_refund,
-- economy_credit, economy_use_consumable, economy_grant_consumable), so every movement is a ledger line.
--
-- What it holds:
--   * public.tournament_events: one row per event (the schedule's id, kind, title, featured pick, window, status);
--   * public.tournament_entries: one per account and event (how it was entered and the ledger line that paid it);
--   * public.tournament_reminders: who asked to be told when an event starts;
--   * public.tournament_arena_queue / _duels / _players: the Arena's searchers, its best-of-3 duels (each an ordinary
--     room on W3b's engine; never a rated match, so no rating moves) and its live standings;
--   * public.tournament_results, public.tournament_prizes, public.tournament_trophies: final places, the coins paid
--     (once each, logged) and the trophies.
--
-- Who can reach what: nobody writes these tables through the API (no INSERT, UPDATE or DELETE for anon, authenticated
-- or service_role); the server (service role) writes only through the public.tournament_* functions below; a signed-in
-- player reads events and only their own entries, reminders, results, prizes and trophies. Joe's tools are in the
-- `tournaments` schema, unreachable from the app and the API.

CREATE SCHEMA IF NOT EXISTS tournaments;
REVOKE ALL ON SCHEMA tournaments FROM PUBLIC, anon, authenticated, service_role;

/* ------------------------------------------------------------------ ledger reasons */

INSERT INTO public.economy_reasons (reason, note) VALUES
  ('tournament_entry', 'a tournament entry paid in coins or with a ticket (refunded in full if the event does not run)'),
  ('tournament_prize', 'a tournament prize, fixed by Joulz (never pooled from entries)')
ON CONFLICT (reason) DO NOTHING;

/* ------------------------------------------------------------------ the Score Attack's async room */

-- The daily Score Attack is an async room of its own kind (the Daily's engine). Widened, never narrowed.
ALTER TABLE public.async_rooms DROP CONSTRAINT IF EXISTS async_rooms_kind_check;
ALTER TABLE public.async_rooms ADD CONSTRAINT async_rooms_kind_check
  CHECK (kind IN ('daily_puzzle', 'daily_arcade', 'challenge', 'score_attack')) NOT VALID;
ALTER TABLE public.async_rooms VALIDATE CONSTRAINT async_rooms_kind_check;

/* ------------------------------------------------------------------ tables */

CREATE TABLE IF NOT EXISTS public.tournament_events (
  id text PRIMARY KEY CHECK (id ~ '^[a-z_]+:[0-9]{4}-[0-9]{2}(-[0-9]{2})?(:[0-9]{4})?$'),
  kind text NOT NULL CHECK (kind IN ('arena', 'score_attack', 'category_cup', 'championship')),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 60),
  pick text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'finished', 'cancelled')),
  async_room_id uuid REFERENCES public.async_rooms (id),
  entrants integer NOT NULL DEFAULT 0 CHECK (entrants >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text
);
CREATE INDEX IF NOT EXISTS tournament_events_starts_idx ON public.tournament_events (starts_at);

CREATE TABLE IF NOT EXISTS public.tournament_entries (
  event_id text NOT NULL REFERENCES public.tournament_events (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  entry text NOT NULL CHECK (entry IN ('free', 'coins', 'ticket_score_attack', 'ticket_category_cup')),
  coins integer NOT NULL DEFAULT 0 CHECK (coins >= 0),
  ledger_id bigint,
  consumable_line bigint,
  entered_at timestamptz NOT NULL DEFAULT now(),
  refunded_at timestamptz,
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS tournament_entries_user_idx ON public.tournament_entries (user_id, entered_at DESC);

CREATE TABLE IF NOT EXISTS public.tournament_reminders (
  event_id text NOT NULL REFERENCES public.tournament_events (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  asked_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.tournament_arena_queue (
  event_id text NOT NULL REFERENCES public.tournament_events (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  rating integer NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_opponent uuid,
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.tournament_arena_duels (
  id uuid PRIMARY KEY,
  event_id text NOT NULL REFERENCES public.tournament_events (id) ON DELETE CASCADE,
  a_user uuid NOT NULL,
  b_user uuid NOT NULL CHECK (b_user <> a_user),
  duel_id uuid REFERENCES public.duels (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'playing' CHECK (status IN ('playing', 'settled', 'void')),
  winner text CHECK (winner IN ('a', 'b', 'draw')),
  a_points integer NOT NULL DEFAULT 0,
  b_points integer NOT NULL DEFAULT 0,
  a_score integer NOT NULL DEFAULT 0,
  b_score integer NOT NULL DEFAULT 0,
  games jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);
CREATE INDEX IF NOT EXISTS tournament_arena_duels_event_idx ON public.tournament_arena_duels (event_id, created_at);
CREATE INDEX IF NOT EXISTS tournament_arena_duels_room_idx ON public.tournament_arena_duels (duel_id);
CREATE INDEX IF NOT EXISTS tournament_arena_duels_a_idx ON public.tournament_arena_duels (a_user, status);
CREATE INDEX IF NOT EXISTS tournament_arena_duels_b_idx ON public.tournament_arena_duels (b_user, status);

CREATE TABLE IF NOT EXISTS public.tournament_arena_players (
  event_id text NOT NULL REFERENCES public.tournament_events (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  draws integer NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  played integer NOT NULL DEFAULT 0,
  score_total integer NOT NULL DEFAULT 0,
  last_win_at timestamptz,
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.tournament_results (
  event_id text NOT NULL REFERENCES public.tournament_events (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  place integer NOT NULL CHECK (place >= 1),
  points integer,
  total integer,
  tie_ms bigint,
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.tournament_prizes (
  event_id text NOT NULL REFERENCES public.tournament_events (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  place integer NOT NULL CHECK (place >= 1),
  coins integer NOT NULL CHECK (coins > 0),
  ledger_id bigint NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.tournament_trophies (
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES public.tournament_events (id) ON DELETE CASCADE,
  kind text NOT NULL,
  medal text NOT NULL CHECK (medal IN ('gold', 'silver', 'bronze')),
  place integer NOT NULL CHECK (place BETWEEN 1 AND 3),
  title text NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

ALTER TABLE public.tournament_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_arena_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_arena_duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_arena_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_trophies ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tournament_events, public.tournament_entries, public.tournament_reminders,
  public.tournament_arena_queue, public.tournament_arena_duels, public.tournament_arena_players,
  public.tournament_results, public.tournament_prizes, public.tournament_trophies
  FROM PUBLIC, anon, authenticated, service_role;
-- The server reads everything; it writes only through the functions below.
GRANT SELECT ON public.tournament_events, public.tournament_entries, public.tournament_reminders,
  public.tournament_arena_queue, public.tournament_arena_duels, public.tournament_arena_players,
  public.tournament_results, public.tournament_prizes, public.tournament_trophies TO service_role;

GRANT SELECT ON public.tournament_events TO authenticated;
DROP POLICY IF EXISTS tournament_events_read ON public.tournament_events;
CREATE POLICY tournament_events_read ON public.tournament_events FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.tournament_entries, public.tournament_reminders, public.tournament_results,
  public.tournament_prizes, public.tournament_trophies TO authenticated;
DROP POLICY IF EXISTS tournament_entries_read_own ON public.tournament_entries;
CREATE POLICY tournament_entries_read_own ON public.tournament_entries FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS tournament_reminders_read_own ON public.tournament_reminders;
CREATE POLICY tournament_reminders_read_own ON public.tournament_reminders FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS tournament_results_read_own ON public.tournament_results;
CREATE POLICY tournament_results_read_own ON public.tournament_results FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS tournament_prizes_read_own ON public.tournament_prizes;
CREATE POLICY tournament_prizes_read_own ON public.tournament_prizes FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS tournament_trophies_read_own ON public.tournament_trophies;
CREATE POLICY tournament_trophies_read_own ON public.tournament_trophies FOR SELECT TO authenticated USING (user_id = auth.uid());

/* ------------------------------------------------------------------ events */

-- Stores a scheduled event once (the schedule's id decides; a second call changes nothing).
CREATE OR REPLACE FUNCTION public.tournament_ensure_event(
  p_id text, p_kind text, p_title text, p_pick text, p_starts timestamptz, p_ends timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tournament_events (id, kind, title, pick, starts_at, ends_at)
  VALUES (p_id, p_kind, p_title, p_pick, p_starts, p_ends)
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- Moves an event from one of `p_from` to `p_to` (live, finished). Answers whether this call moved it.
CREATE OR REPLACE FUNCTION public.tournament_set_status(p_event text, p_from text[], p_to text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  IF p_to NOT IN ('live', 'finished') THEN
    RAISE EXCEPTION 'tournament_set_status: % is not a status this sets (cancel with tournament_cancel)', p_to;
  END IF;
  UPDATE public.tournament_events
     SET status = p_to, finished_at = CASE WHEN p_to = 'finished' THEN now() ELSE finished_at END
   WHERE id = p_event AND status = ANY (p_from);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n = 1;
END;
$$;

-- The Score Attack's async room, set once.
CREATE OR REPLACE FUNCTION public.tournament_set_room(p_event text, p_room uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room uuid;
BEGIN
  UPDATE public.tournament_events SET async_room_id = p_room WHERE id = p_event AND async_room_id IS NULL;
  SELECT async_room_id INTO v_room FROM public.tournament_events WHERE id = p_event;
  RETURN v_room;
END;
$$;

/* ------------------------------------------------------------------ entry */

-- Enters an account once. p_entry: free | coins | ticket_score_attack | ticket_category_cup; p_coins the coin price
-- (coins only). The spend or the ticket and the entry row are one transaction, so an entry exists exactly when it was
-- paid. Answers {status: entered | duplicate | closed | no_account | insufficient | no_ticket | bad_entry, entry}.
CREATE OR REPLACE FUNCTION public.tournament_enter(p_event text, p_user_id uuid, p_entry text, p_coins integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_event public.tournament_events%ROWTYPE;
  v_row public.tournament_entries%ROWTYPE;
  v jsonb;
  v_ledger bigint;
  v_line bigint;
BEGIN
  SELECT * INTO v_event FROM public.tournament_events WHERE id = p_event FOR UPDATE;
  IF NOT FOUND OR v_event.status IN ('finished', 'cancelled') THEN
    RETURN jsonb_build_object('status', 'closed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RETURN jsonb_build_object('status', 'no_account');
  END IF;
  SELECT * INTO v_row FROM public.tournament_entries WHERE event_id = p_event AND user_id = p_user_id;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'duplicate', 'entry', v_row.entry);
  END IF;
  IF p_entry = 'free' THEN
    NULL;
  ELSIF p_entry = 'coins' THEN
    IF p_coins IS NULL OR p_coins <= 0 THEN
      RETURN jsonb_build_object('status', 'bad_entry');
    END IF;
    v := public.economy_spend(p_user_id, p_coins, 'tournament_entry', 'tournament', p_event, 'tournament_entry:' || p_event);
    IF v ->> 'status' = 'insufficient' THEN
      RETURN jsonb_build_object('status', 'insufficient', 'balance', v -> 'balance');
    ELSIF v ->> 'status' NOT IN ('spent', 'duplicate') THEN
      RETURN jsonb_build_object('status', coalesce(v ->> 'status', 'bad_entry'));
    END IF;
    v_ledger := (v ->> 'line_id')::bigint;
  ELSIF p_entry IN ('ticket_score_attack', 'ticket_category_cup') THEN
    v := public.economy_use_consumable(p_user_id, p_entry, 1, 'tournament_entry', 'tournament', p_event, 'tournament_entry:' || p_event);
    IF v ->> 'status' = 'insufficient' THEN
      RETURN jsonb_build_object('status', 'no_ticket');
    ELSIF v ->> 'status' NOT IN ('used', 'duplicate') THEN
      RETURN jsonb_build_object('status', coalesce(v ->> 'status', 'bad_entry'));
    END IF;
    v_line := (v ->> 'line_id')::bigint;
  ELSE
    RETURN jsonb_build_object('status', 'bad_entry');
  END IF;
  INSERT INTO public.tournament_entries (event_id, user_id, entry, coins, ledger_id, consumable_line)
  VALUES (p_event, p_user_id, p_entry, CASE WHEN p_entry = 'coins' THEN p_coins ELSE 0 END, v_ledger, v_line);
  UPDATE public.tournament_events SET entrants = entrants + 1 WHERE id = p_event;
  -- An entry is always reminded.
  INSERT INTO public.tournament_reminders (event_id, user_id) VALUES (p_event, p_user_id) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('status', 'entered', 'entry', p_entry, 'ledger_id', v_ledger, 'consumable_line', v_line);
END;
$$;

-- Calls an event off and gives every entry back in full: coins through economy_refund (key refund:<line id>), a
-- ticket through economy_grant_consumable (reason refund, key refund:consumable:<line id>). Idempotent: a second call
-- refunds nothing more. Answers {status: cancelled | not_cancellable, refunded}.
CREATE OR REPLACE FUNCTION public.tournament_cancel(p_event text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_event public.tournament_events%ROWTYPE;
  v_entry public.tournament_entries%ROWTYPE;
  v jsonb;
  v_n integer := 0;
BEGIN
  SELECT * INTO v_event FROM public.tournament_events WHERE id = p_event FOR UPDATE;
  IF NOT FOUND OR v_event.status = 'finished' THEN
    RETURN jsonb_build_object('status', 'not_cancellable');
  END IF;
  UPDATE public.tournament_events
     SET status = 'cancelled', cancelled_at = coalesce(cancelled_at, now()), cancel_reason = coalesce(cancel_reason, p_reason)
   WHERE id = p_event;
  FOR v_entry IN SELECT * FROM public.tournament_entries WHERE event_id = p_event AND refunded_at IS NULL FOR UPDATE LOOP
    IF v_entry.ledger_id IS NOT NULL THEN
      v := public.economy_refund(v_entry.user_id, v_entry.ledger_id);
      IF v ->> 'status' NOT IN ('refunded', 'duplicate') THEN
        RAISE EXCEPTION 'tournament_cancel: refund of line % answered %', v_entry.ledger_id, v ->> 'status';
      END IF;
    ELSIF v_entry.consumable_line IS NOT NULL THEN
      v := public.economy_grant_consumable(v_entry.user_id, v_entry.entry, 1, 'refund', 'tournament', p_event,
        'refund:consumable:' || v_entry.consumable_line);
      IF v ->> 'status' NOT IN ('granted', 'duplicate') THEN
        RAISE EXCEPTION 'tournament_cancel: ticket back for line % answered %', v_entry.consumable_line, v ->> 'status';
      END IF;
    END IF;
    UPDATE public.tournament_entries SET refunded_at = now() WHERE event_id = p_event AND user_id = v_entry.user_id;
    v_n := v_n + 1;
  END LOOP;
  DELETE FROM public.tournament_arena_queue WHERE event_id = p_event;
  RETURN jsonb_build_object('status', 'cancelled', 'refunded', v_n);
END;
$$;

-- Asks for (p_on) or drops a reminder. An entrant's reminder stays. Answers whether the account is reminded.
CREATE OR REPLACE FUNCTION public.tournament_remind(p_event text, p_user_id uuid, p_on boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tournament_events WHERE id = p_event)
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RETURN false;
  END IF;
  IF p_on THEN
    INSERT INTO public.tournament_reminders (event_id, user_id) VALUES (p_event, p_user_id) ON CONFLICT DO NOTHING;
  ELSIF NOT EXISTS (SELECT 1 FROM public.tournament_entries WHERE event_id = p_event AND user_id = p_user_id) THEN
    DELETE FROM public.tournament_reminders WHERE event_id = p_event AND user_id = p_user_id;
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.tournament_reminders WHERE event_id = p_event AND user_id = p_user_id);
END;
$$;

-- Marks reminders sent (so the tick asks the push module once per account and event).
CREATE OR REPLACE FUNCTION public.tournament_mark_reminded(p_event text, p_users uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.tournament_reminders SET notified_at = now()
   WHERE event_id = p_event AND user_id = ANY (p_users) AND notified_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

/* ------------------------------------------------------------------ the Arena */

-- Puts an entrant in the Arena's queue (the earliest join kept). Answers joined | not_live | not_entered | in_duel.
CREATE OR REPLACE FUNCTION public.tournament_arena_join(p_event text, p_user_id uuid, p_rating integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tournament_events WHERE id = p_event AND kind = 'arena' AND status = 'live') THEN
    RETURN 'not_live';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tournament_entries WHERE event_id = p_event AND user_id = p_user_id AND refunded_at IS NULL) THEN
    RETURN 'not_entered';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tournament_arena_duels
              WHERE event_id = p_event AND status = 'playing' AND (a_user = p_user_id OR b_user = p_user_id)) THEN
    RETURN 'in_duel';
  END IF;
  SELECT CASE WHEN a_user = p_user_id THEN b_user ELSE a_user END INTO v_last
    FROM public.tournament_arena_duels
   WHERE event_id = p_event AND (a_user = p_user_id OR b_user = p_user_id)
   ORDER BY created_at DESC LIMIT 1;
  INSERT INTO public.tournament_arena_queue (event_id, user_id, rating, last_opponent)
  VALUES (p_event, p_user_id, p_rating, v_last)
  ON CONFLICT (event_id, user_id) DO NOTHING;
  INSERT INTO public.tournament_arena_players (event_id, user_id) VALUES (p_event, p_user_id) ON CONFLICT DO NOTHING;
  RETURN 'joined';
END;
$$;

CREATE OR REPLACE FUNCTION public.tournament_arena_leave(p_event text, p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.tournament_arena_queue WHERE event_id = p_event AND user_id = p_user_id;
$$;

-- Takes two searchers out of the queue into one new duel, both or neither (two pollers can't pair one player twice).
CREATE OR REPLACE FUNCTION public.tournament_arena_pair(p_event text, p_a uuid, p_b uuid, p_duel uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  IF p_a = p_b THEN
    RETURN false;
  END IF;
  -- Both rows locked in a fixed order (by user id), then both or neither leave the queue.
  PERFORM 1 FROM public.tournament_arena_queue
   WHERE event_id = p_event AND user_id IN (p_a, p_b) ORDER BY user_id FOR UPDATE;
  SELECT count(*) INTO v_n FROM public.tournament_arena_queue WHERE event_id = p_event AND user_id IN (p_a, p_b);
  IF v_n <> 2 THEN
    RETURN false;
  END IF;
  DELETE FROM public.tournament_arena_queue WHERE event_id = p_event AND user_id IN (p_a, p_b);
  INSERT INTO public.tournament_arena_duels (id, event_id, a_user, b_user) VALUES (p_duel, p_event, p_a, p_b);
  RETURN true;
END;
$$;

-- The duel's room, once it exists.
CREATE OR REPLACE FUNCTION public.tournament_arena_set_room(p_duel uuid, p_room uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.tournament_arena_duels SET duel_id = p_room WHERE id = p_duel AND duel_id IS NULL;
$$;

-- A duel that never got its room (or never finished by the event's close): no points, no result.
CREATE OR REPLACE FUNCTION public.tournament_arena_void(p_duel uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.tournament_arena_duels SET status = 'void', settled_at = now() WHERE id = p_duel AND status = 'playing';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n = 1;
END;
$$;

-- Settles a finished duel once: a win adds 2 points, or 4 once the winner had already won 2 in a row, and extends the
-- streak; a loss or a draw adds nothing and breaks it (src/lib/tournaments/rules.ts applyArenaResult, the same rule).
-- Answers {status: settled | already, a_points, b_points, a_streak, b_streak}.
CREATE OR REPLACE FUNCTION public.tournament_arena_settle(
  p_duel uuid, p_winner text, p_a_score integer, p_b_score integer, p_games jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duel public.tournament_arena_duels%ROWTYPE;
  v_a public.tournament_arena_players%ROWTYPE;
  v_b public.tournament_arena_players%ROWTYPE;
  v_ap integer := 0;
  v_bp integer := 0;
BEGIN
  IF p_winner NOT IN ('a', 'b', 'draw') THEN
    RAISE EXCEPTION 'tournament_arena_settle: bad winner %', p_winner;
  END IF;
  SELECT * INTO v_duel FROM public.tournament_arena_duels WHERE id = p_duel FOR UPDATE;
  IF NOT FOUND OR v_duel.status <> 'playing' THEN
    RETURN jsonb_build_object('status', 'already', 'a_points', coalesce(v_duel.a_points, 0), 'b_points', coalesce(v_duel.b_points, 0));
  END IF;
  INSERT INTO public.tournament_arena_players (event_id, user_id) VALUES (v_duel.event_id, v_duel.a_user), (v_duel.event_id, v_duel.b_user)
  ON CONFLICT DO NOTHING;
  -- Both rows locked in a fixed order (by user id), so two settles of different duels never deadlock.
  PERFORM 1 FROM public.tournament_arena_players
   WHERE event_id = v_duel.event_id AND user_id IN (v_duel.a_user, v_duel.b_user) ORDER BY user_id FOR UPDATE;
  SELECT * INTO v_a FROM public.tournament_arena_players WHERE event_id = v_duel.event_id AND user_id = v_duel.a_user;
  SELECT * INTO v_b FROM public.tournament_arena_players WHERE event_id = v_duel.event_id AND user_id = v_duel.b_user;
  IF p_winner = 'a' THEN
    v_ap := CASE WHEN v_a.streak >= 2 THEN 4 ELSE 2 END;
  ELSIF p_winner = 'b' THEN
    v_bp := CASE WHEN v_b.streak >= 2 THEN 4 ELSE 2 END;
  END IF;
  UPDATE public.tournament_arena_players SET
    points = points + v_ap,
    wins = wins + CASE WHEN p_winner = 'a' THEN 1 ELSE 0 END,
    losses = losses + CASE WHEN p_winner = 'b' THEN 1 ELSE 0 END,
    draws = draws + CASE WHEN p_winner = 'draw' THEN 1 ELSE 0 END,
    streak = CASE WHEN p_winner = 'a' THEN streak + 1 ELSE 0 END,
    best_streak = greatest(best_streak, CASE WHEN p_winner = 'a' THEN streak + 1 ELSE 0 END),
    played = played + 1,
    score_total = score_total + greatest(p_a_score, 0),
    last_win_at = CASE WHEN p_winner = 'a' THEN now() ELSE last_win_at END
  WHERE event_id = v_duel.event_id AND user_id = v_duel.a_user;
  UPDATE public.tournament_arena_players SET
    points = points + v_bp,
    wins = wins + CASE WHEN p_winner = 'b' THEN 1 ELSE 0 END,
    losses = losses + CASE WHEN p_winner = 'a' THEN 1 ELSE 0 END,
    draws = draws + CASE WHEN p_winner = 'draw' THEN 1 ELSE 0 END,
    streak = CASE WHEN p_winner = 'b' THEN streak + 1 ELSE 0 END,
    best_streak = greatest(best_streak, CASE WHEN p_winner = 'b' THEN streak + 1 ELSE 0 END),
    played = played + 1,
    score_total = score_total + greatest(p_b_score, 0),
    last_win_at = CASE WHEN p_winner = 'b' THEN now() ELSE last_win_at END
  WHERE event_id = v_duel.event_id AND user_id = v_duel.b_user;
  UPDATE public.tournament_arena_duels SET
    status = 'settled', winner = p_winner, a_points = v_ap, b_points = v_bp,
    a_score = greatest(p_a_score, 0), b_score = greatest(p_b_score, 0), games = p_games, settled_at = now()
  WHERE id = p_duel;
  RETURN jsonb_build_object(
    'status', 'settled', 'a_points', v_ap, 'b_points', v_bp,
    'a_streak', CASE WHEN p_winner = 'a' THEN v_a.streak + 1 ELSE 0 END,
    'b_streak', CASE WHEN p_winner = 'b' THEN v_b.streak + 1 ELSE 0 END);
END;
$$;

/* ------------------------------------------------------------------ results, prizes, trophies */

-- Stores the final places (p_rows: [{user_id, place, points, total, tie_ms}]) and marks the event finished. Places
-- already stored are kept. Answers whether this call finished the event.
CREATE OR REPLACE FUNCTION public.tournament_finish(p_event text, p_rows jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  INSERT INTO public.tournament_results (event_id, user_id, place, points, total, tie_ms)
  SELECT p_event, r.user_id, r.place, r.points, r.total, r.tie_ms
    FROM jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) AS r(user_id uuid, place integer, points integer, total integer, tie_ms bigint)
   WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = r.user_id)
  ON CONFLICT (event_id, user_id) DO NOTHING;
  UPDATE public.tournament_events SET status = 'finished', finished_at = now()
   WHERE id = p_event AND status IN ('scheduled', 'live');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n = 1;
END;
$$;

-- Pays one place's prize once (coins through economy_credit, key tournament_prize:<event>:<user>, and its row here, in
-- one transaction) and, with p_medal, the trophy. Answers {status: paid | duplicate | no_account | not_finished, ...}.
CREATE OR REPLACE FUNCTION public.tournament_pay_prize(
  p_event text, p_user_id uuid, p_place integer, p_coins integer, p_medal text, p_title text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_event public.tournament_events%ROWTYPE;
  v jsonb := NULL;
  v_prize public.tournament_prizes%ROWTYPE;
  v_trophy boolean := false;
  v_n integer;
BEGIN
  SELECT * INTO v_event FROM public.tournament_events WHERE id = p_event;
  IF NOT FOUND OR v_event.status <> 'finished' THEN
    RETURN jsonb_build_object('status', 'not_finished');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RETURN jsonb_build_object('status', 'no_account');
  END IF;
  IF p_coins IS NOT NULL AND p_coins > 0 THEN
    SELECT * INTO v_prize FROM public.tournament_prizes WHERE event_id = p_event AND user_id = p_user_id;
    IF NOT FOUND THEN
      v := public.economy_credit(p_user_id, p_coins, 'tournament_prize', 'tournament', p_event,
        'tournament_prize:' || p_event || ':' || p_user_id);
      IF v ->> 'status' NOT IN ('credited', 'duplicate') THEN
        RETURN jsonb_build_object('status', coalesce(v ->> 'status', 'error'));
      END IF;
      INSERT INTO public.tournament_prizes (event_id, user_id, place, coins, ledger_id)
      VALUES (p_event, p_user_id, p_place, p_coins, (v ->> 'line_id')::bigint)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  IF p_medal IS NOT NULL THEN
    INSERT INTO public.tournament_trophies (user_id, event_id, kind, medal, place, title)
    VALUES (p_user_id, p_event, v_event.kind, p_medal, p_place, p_title)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_trophy := v_n = 1;
  END IF;
  RETURN jsonb_build_object(
    'status', CASE WHEN v IS NOT NULL AND v ->> 'status' = 'credited' OR v_trophy THEN 'paid' ELSE 'duplicate' END,
    'coins', CASE WHEN v IS NOT NULL AND v ->> 'status' = 'credited' THEN p_coins ELSE 0 END,
    'trophy', v_trophy);
END;
$$;

REVOKE ALL ON FUNCTION public.tournament_ensure_event(text, text, text, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_set_status(text, text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_set_room(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_enter(text, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_cancel(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_remind(text, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_mark_reminded(text, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_arena_join(text, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_arena_leave(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_arena_pair(text, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_arena_set_room(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_arena_void(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_arena_settle(uuid, text, integer, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_finish(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tournament_pay_prize(text, uuid, integer, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_ensure_event(text, text, text, text, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.tournament_set_status(text, text[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.tournament_set_room(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.tournament_enter(text, uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.tournament_cancel(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.tournament_remind(text, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.tournament_mark_reminded(text, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.tournament_arena_join(text, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.tournament_arena_leave(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.tournament_arena_pair(text, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.tournament_arena_set_room(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.tournament_arena_void(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.tournament_arena_settle(uuid, text, integer, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.tournament_finish(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.tournament_pay_prize(text, uuid, integer, integer, text, text) TO service_role;

/* ------------------------------------------------------------------ Joe's tools (Supabase SQL editor) */

CREATE TABLE IF NOT EXISTS tournaments.admin_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  event_id text,
  detail jsonb,
  note text NOT NULL,
  by_role text NOT NULL DEFAULT session_user
);
ALTER TABLE tournaments.admin_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tournaments.admin_log FROM PUBLIC, anon, authenticated, service_role;

-- Calls an event off by hand and refunds every entry in full (coins and tickets). A note is required.
--   SELECT tournaments.cancel_event('score_attack:2026-11-20', 'server outage');
CREATE OR REPLACE FUNCTION tournaments.cancel_event(p_event text, p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, tournaments
AS $$
DECLARE
  v jsonb;
BEGIN
  IF coalesce(trim(p_note), '') = '' THEN
    RAISE EXCEPTION 'tournaments.cancel_event: give a note (why)';
  END IF;
  v := public.tournament_cancel(p_event, 'cancelled by Joulz: ' || p_note);
  INSERT INTO tournaments.admin_log (action, event_id, detail, note) VALUES ('cancel_event', p_event, v, p_note);
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION tournaments.cancel_event(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- One event at a glance: its row, entries by type, the places, the prizes paid and the trophies.
--   SELECT tournaments.summary('arena:2026-11-20:1300');
CREATE OR REPLACE FUNCTION tournaments.summary(p_event text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, tournaments
AS $$
  SELECT jsonb_build_object(
    'event', (SELECT to_jsonb(e) FROM public.tournament_events e WHERE e.id = p_event),
    'entries', (SELECT coalesce(jsonb_object_agg(entry, n), '{}'::jsonb)
                  FROM (SELECT entry, count(*) AS n FROM public.tournament_entries WHERE event_id = p_event GROUP BY entry) x),
    'refunded', (SELECT count(*) FROM public.tournament_entries WHERE event_id = p_event AND refunded_at IS NOT NULL),
    'results', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.place), '[]'::jsonb) FROM public.tournament_results r WHERE r.event_id = p_event),
    'prizes', (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.place), '[]'::jsonb) FROM public.tournament_prizes p WHERE p.event_id = p_event),
    'trophies', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.place), '[]'::jsonb) FROM public.tournament_trophies t WHERE t.event_id = p_event));
$$;
REVOKE ALL ON FUNCTION tournaments.summary(text) FROM PUBLIC, anon, authenticated, service_role;
