-- The Category Cup (Swiss) and the Joulz Championship (Knockout) (wave 4, W4c; docs/tournaments/events.md).
--
-- Additive and idempotent: new tables and functions, three new ledger reasons, one new catalogue item (the animated
-- Championship frame, an earned tournament prize, never sold), and the Swiss Champion and Knockout Champion badges
-- moved from waiting to earnable (Joe's approval, 11 Nov 2026). No stored round, result, input log, rating or ledger
-- line is changed (rule 4). Nothing here deals, grades, scores or rates: every match is an ordinary room
-- (public.duels) the server makes already started, graded by the rooms engine, and no tournament result is ever read
-- by ratings.
--
-- Both events are switched off at launch in src/config/tournamentEventsConfig.ts: while off the server refuses them and
-- no row is made here.
--
-- What it holds:
--   * tournament_events: one row per event (category_cup:<Saturday>, championship:<month>), its status
--     (open → running → finished, or cancelled), rounds, the next round's start and a short tick lock;
--   * tournament_entries: each entrant (coins, a ticket, or qualified for the Championship), entry order, seed, the
--     entry's spend line or ticket attempt (for refunds) and the final place;
--   * tournament_matches: every Swiss pairing and bracket match, its room once made, and its settled result;
--   * tournament_payouts: one row per entrant and prize kind, written as each prize is paid, so nothing pays twice;
--   * tournament_trophies: the gold, silver and bronze cups;
--   * tournament_hall_of_fame: every Championship winner, by month.
--
-- Who can reach what: nobody but the server. RLS on with no policies; anon and authenticated have no grants; the
-- service role reads and writes through src/lib/data/tournamentEvents.server.ts.

CREATE TABLE IF NOT EXISTS public.tournament_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('category_cup', 'championship')),
  event_key text NOT NULL UNIQUE,
  -- The cup's category (a room pick); the Championship plays Mixed.
  category text NOT NULL CHECK (category IN ('mixed', 'word', 'number', 'speed', 'attention', 'pattern', 'logic',
    'retro', 'sports', 'cards', 'action', 'strategy')),
  -- The Championship's month (YYYY-MM): its qualifiers come from that month's Score Attack standings.
  month text CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  starts_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'running', 'finished', 'cancelled')),
  rounds_total integer NOT NULL DEFAULT 0 CHECK (rounds_total BETWEEN 0 AND 12),
  current_round integer NOT NULL DEFAULT 0 CHECK (current_round BETWEEN 0 AND 12),
  -- When the current round's rooms are made (a minute after the round before settles).
  round_starts_at timestamptz,
  -- The Knockout's bracket size (2 … 64).
  bracket_size integer CHECK (bracket_size IN (2, 4, 8, 16, 32, 64)),
  field integer NOT NULL DEFAULT 0,
  cancelled_reason text CHECK (cancelled_reason IN ('too_few', 'no_qualifiers', 'by_joe')),
  reminded_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  paid_at timestamptz,
  -- One ticker at a time (tournament_event_lock).
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'championship') = (month IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS tournament_events_kind_start ON public.tournament_events (kind, starts_at DESC);

CREATE TABLE IF NOT EXISTS public.tournament_entries (
  event_id uuid NOT NULL REFERENCES public.tournament_events (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'entered' CHECK (status IN ('entered', 'withdrawn', 'refunded')),
  paid_with text NOT NULL CHECK (paid_with IN ('coins', 'ticket', 'qualified')),
  -- The spend line a coin entry made (refunded through economy_refund), and which entry this is (a re-entry after
  -- leaving pays again under a new key).
  coin_line_id bigint,
  attempt integer NOT NULL DEFAULT 1 CHECK (attempt BETWEEN 1 AND 50),
  entered_at timestamptz NOT NULL DEFAULT now(),
  -- The Knockout's seed (its Score Attack place); the Swiss entry order once the cup starts.
  seed integer CHECK (seed BETWEEN 1 AND 1000),
  final_place integer CHECK (final_place BETWEEN 1 AND 1000),
  refunded_at timestamptz,
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS tournament_entries_user ON public.tournament_entries (user_id, event_id);

CREATE TABLE IF NOT EXISTS public.tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.tournament_events (id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('swiss', 'knockout', 'third_place')),
  round integer NOT NULL CHECK (round BETWEEN 1 AND 12),
  slot integer NOT NULL CHECK (slot BETWEEN 0 AND 127),
  -- null: a bye (or, in a bracket, a side not yet known).
  player_a uuid,
  player_b uuid,
  seed_a integer,
  seed_b integer,
  duel_id uuid UNIQUE REFERENCES public.duels (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'playing', 'settling', 'settled')),
  -- null on a settled match: a drawn Swiss match (or two byes).
  winner uuid,
  walkover boolean NOT NULL DEFAULT false,
  games_a integer,
  games_b integer,
  total_a integer,
  total_b integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  room_made_at timestamptz,
  settled_at timestamptz,
  UNIQUE (event_id, stage, round, slot)
);
CREATE INDEX IF NOT EXISTS tournament_matches_event ON public.tournament_matches (event_id, round, slot);

CREATE TABLE IF NOT EXISTS public.tournament_payouts (
  event_id uuid NOT NULL REFERENCES public.tournament_events (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('coins', 'trophy', 'badge', 'frame', 'hall_of_fame', 'joules')),
  place integer,
  amount integer,
  paid_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id, kind)
);

CREATE TABLE IF NOT EXISTS public.tournament_trophies (
  user_id uuid NOT NULL,
  event_id uuid NOT NULL REFERENCES public.tournament_events (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('category_cup', 'championship')),
  place integer NOT NULL CHECK (place BETWEEN 1 AND 3),
  cup text NOT NULL CHECK (cup IN ('gold', 'silver', 'bronze')),
  awarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);
CREATE INDEX IF NOT EXISTS tournament_trophies_user ON public.tournament_trophies (user_id, awarded_at DESC);

CREATE TABLE IF NOT EXISTS public.tournament_hall_of_fame (
  month text PRIMARY KEY CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  event_id uuid NOT NULL UNIQUE REFERENCES public.tournament_events (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now()
);

DO $grants$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tournament_events', 'tournament_entries', 'tournament_matches', 'tournament_payouts',
                           'tournament_trophies', 'tournament_hall_of_fame'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END
$grants$;

-- One ticker at a time: true for exactly one caller until p_ms have passed or it unlocks.
CREATE OR REPLACE FUNCTION public.tournament_event_lock(p_event uuid, p_ms integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.tournament_events
     SET locked_until = now() + make_interval(secs => greatest(1, least(p_ms, 120000)) / 1000.0)
   WHERE id = p_event AND (locked_until IS NULL OR locked_until < now());
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.tournament_event_lock(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_event_lock(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.tournament_event_unlock(p_event uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.tournament_events SET locked_until = NULL WHERE id = p_event;
$$;
REVOKE ALL ON FUNCTION public.tournament_event_unlock(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_event_unlock(uuid) TO service_role;

-- Enters an account once the entry is paid: serialised per event, refused unless the event is open and before its
-- start, and while the field has room. Answers entered | already | closed | full. A refused entry's payment is
-- given back by the server.
CREATE OR REPLACE FUNCTION public.tournament_enter(
  p_event uuid, p_user uuid, p_paid_with text, p_coin_line bigint, p_attempt integer, p_max integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.tournament_events;
  v_entry public.tournament_entries;
BEGIN
  SELECT * INTO v_event FROM public.tournament_events WHERE id = p_event FOR UPDATE;
  IF NOT FOUND OR v_event.status <> 'open' OR v_event.starts_at <= now() THEN
    RETURN 'closed';
  END IF;
  SELECT * INTO v_entry FROM public.tournament_entries WHERE event_id = p_event AND user_id = p_user;
  IF FOUND AND v_entry.status = 'entered' THEN
    RETURN 'already';
  END IF;
  IF (SELECT count(*) FROM public.tournament_entries WHERE event_id = p_event AND status = 'entered') >= p_max THEN
    RETURN 'full';
  END IF;
  INSERT INTO public.tournament_entries (event_id, user_id, status, paid_with, coin_line_id, attempt, entered_at)
  VALUES (p_event, p_user, 'entered', p_paid_with, p_coin_line, p_attempt, now())
  ON CONFLICT (event_id, user_id) DO UPDATE
    SET status = 'entered', paid_with = EXCLUDED.paid_with, coin_line_id = EXCLUDED.coin_line_id,
        attempt = EXCLUDED.attempt, entered_at = now(), refunded_at = NULL;
  RETURN 'entered';
END;
$$;
REVOKE ALL ON FUNCTION public.tournament_enter(uuid, uuid, text, bigint, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_enter(uuid, uuid, text, bigint, integer, integer) TO service_role;

/* ------------------------------------------------------------------ the economy: reasons and the frame */

INSERT INTO public.economy_reasons (reason, note) VALUES
  ('tournament_entry', 'a Category Cup entry (coins or a ticket; W4c)'),
  ('tournament_refund', 'a tournament entry given back (left before the start, or the cup cancelled; W4c)'),
  ('tournament_prize', 'a Category Cup or Joulz Championship prize (W4c)')
ON CONFLICT (reason) DO NOTHING;

-- The Championship frame (docs/art/wave-4/catalogue.json): earned by the Joulz Championship's winner, animated, never
-- sold, never again anywhere. Placeholder art until drawn (the card draws the Plain frame for an unknown frame).
INSERT INTO public.catalogue_items
  (id, name, kind, slot, game, game_type, rarity, source, pass_level, price_coins, bundle, animated, exclusive,
   exclusive_forever, note, png_path, html_path, sort_order)
VALUES
  ('frame.championship', 'Championship', 'frame', 'frame', NULL, NULL, NULL, 'tournament', NULL, NULL, NULL, true, true,
   true, 'placeholder art until drawn', NULL, NULL, 111)
ON CONFLICT (id) DO NOTHING;

/* ------------------------------------------------------------------ badges (Joe's approval, 11 Nov 2026) */

-- Swiss Champion (win a Category Cup) and Knockout Champion (win the Joulz Championship's final) move from waiting to
-- earnable; the server awards them through badge_award when an event finishes.
DO $badges$
BEGIN
  IF to_regclass('public.badges') IS NOT NULL THEN
    UPDATE public.badges SET status = 'earnable', waits_for = NULL
     WHERE slug IN ('swiss-champion', 'knockout-champion') AND status = 'waits';
  END IF;
END
$badges$;
