-- Practice challenges (wave 2, train C, session C1b; 11 Nov 2026; docs/challenges/catalogue.md). Additive and
-- idempotent: two new tables, three service-role functions and one analytics event (added to the list, never replacing it).
-- No existing row is touched.
--
-- public.practice_challenge_progress: one row per player (auth user: guests too) and challenge: the best value one
-- graded Practice run gave it (its progress bar), when it was completed, the coins it pays (0, 100 or 250) and, for an
-- account, when they were paid and the ledger line. The server's checker (src/lib/challenges/challenges.server.ts)
-- decides completion from its own graded result; nobody else writes here. A player reads their own rows (RLS).
--
-- Writers (service role only, never anon or authenticated):
--   challenge_record(user, challenge, game, value, met, coins) keeps the best value and sets completed_at once;
--   challenge_pay_due(user)   pays every completed, unpaid challenge with coins, through A1's ledger
--                              (economy.post_coins, reason challenge_reward, key challenge_reward:<challenge id>), once
--                              per challenge per account. A guest's completions wait; they are paid the first time this
--                              runs once that guest is an account (sign-up, a Practice run, opening the list).
--
-- A removed account (accounts.forget_user deletes the auth user last) takes its rows with it (ON DELETE CASCADE).

CREATE TABLE IF NOT EXISTS public.practice_challenge_progress (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  challenge_id text NOT NULL CHECK (challenge_id ~ '^[a-z0-9]+\.[a-z0-9-]+$' AND length(challenge_id) <= 64),
  game_id text NOT NULL CHECK (game_id ~ '^[a-z0-9]+$' AND length(game_id) <= 32),
  best integer NOT NULL DEFAULT 0 CHECK (best >= 0),
  completed_at timestamptz,
  coins integer NOT NULL DEFAULT 0 CHECK (coins IN (0, 100, 250)),
  paid_at timestamptz,
  ledger_id bigint,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, challenge_id),
  CONSTRAINT practice_challenge_paid_after_done CHECK (paid_at IS NULL OR completed_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS practice_challenge_progress_due_idx
  ON public.practice_challenge_progress (user_id)
  WHERE completed_at IS NOT NULL AND coins > 0 AND paid_at IS NULL;

REVOKE ALL ON public.practice_challenge_progress FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.practice_challenge_progress TO authenticated;
GRANT SELECT ON public.practice_challenge_progress TO service_role;
ALTER TABLE public.practice_challenge_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS practice_challenge_progress_own ON public.practice_challenge_progress;
CREATE POLICY practice_challenge_progress_own ON public.practice_challenge_progress
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Records one graded run's value for one challenge. Keeps the best value; sets completed_at the first time `met`.
-- Answers {status: ok | bad, newly: bool, completed: bool, best: int}.
CREATE OR REPLACE FUNCTION public.challenge_record(
  p_user_id uuid, p_challenge_id text, p_game_id text, p_value integer, p_met boolean, p_coins integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.practice_challenge_progress%ROWTYPE;
  v_was_done boolean;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('status', 'bad');
  END IF;
  IF p_coins IS NULL OR p_coins NOT IN (0, 100, 250) THEN
    RETURN jsonb_build_object('status', 'bad');
  END IF;
  INSERT INTO public.practice_challenge_progress AS t (user_id, challenge_id, game_id, best, coins)
  VALUES (p_user_id, p_challenge_id, p_game_id, greatest(0, coalesce(p_value, 0)), p_coins)
  ON CONFLICT (user_id, challenge_id) DO NOTHING;
  SELECT * INTO v_row FROM public.practice_challenge_progress
   WHERE user_id = p_user_id AND challenge_id = p_challenge_id
   FOR UPDATE;
  v_was_done := v_row.completed_at IS NOT NULL;
  UPDATE public.practice_challenge_progress
     SET best = greatest(best, greatest(0, coalesce(p_value, 0))),
         completed_at = CASE WHEN completed_at IS NULL AND p_met THEN now() ELSE completed_at END,
         coins = CASE WHEN completed_at IS NULL THEN p_coins ELSE coins END,
         updated_at = now()
   WHERE user_id = p_user_id AND challenge_id = p_challenge_id
  RETURNING * INTO v_row;
  RETURN jsonb_build_object(
    'status', 'ok',
    'newly', (NOT v_was_done) AND v_row.completed_at IS NOT NULL,
    'completed', v_row.completed_at IS NOT NULL,
    'best', v_row.best);
END;
$$;
REVOKE ALL ON FUNCTION public.challenge_record(uuid, text, text, integer, boolean, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_record(uuid, text, text, integer, boolean, integer) TO service_role;

-- Pays every completed, unpaid challenge with coins on an account (a guest: nothing yet). Each pays once: the ledger's
-- key is fixed per challenge and account, and the row is marked paid in the same transaction. Answers
-- {status: ok | no_account, paid: [{challenge_id, game_id, coins, line_id}]}.
CREATE OR REPLACE FUNCTION public.challenge_pay_due(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, economy
AS $$
DECLARE
  v_row public.practice_challenge_progress%ROWTYPE;
  v jsonb;
  v_paid jsonb := '[]'::jsonb;
BEGIN
  IF p_user_id IS NULL OR NOT economy.active_account(p_user_id) THEN
    RETURN jsonb_build_object('status', 'no_account', 'paid', '[]'::jsonb);
  END IF;
  FOR v_row IN
    SELECT * FROM public.practice_challenge_progress
     WHERE user_id = p_user_id AND completed_at IS NOT NULL AND coins > 0 AND paid_at IS NULL
     ORDER BY completed_at, challenge_id
     FOR UPDATE
  LOOP
    v := economy.post_coins(p_user_id, v_row.coins, 'challenge_reward', 'challenge', v_row.challenge_id,
                            'challenge_reward:' || v_row.challenge_id);
    IF v ->> 'status' IN ('ok', 'duplicate') THEN
      UPDATE public.practice_challenge_progress
         SET paid_at = now(), ledger_id = (v ->> 'line_id')::bigint, updated_at = now()
       WHERE user_id = p_user_id AND challenge_id = v_row.challenge_id;
      IF v ->> 'status' = 'ok' THEN
        v_paid := v_paid || jsonb_build_array(jsonb_build_object(
          'challenge_id', v_row.challenge_id, 'game_id', v_row.game_id, 'coins', v_row.coins,
          'line_id', (v ->> 'line_id')::bigint));
      END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('status', 'ok', 'paid', v_paid);
END;
$$;
REVOKE ALL ON FUNCTION public.challenge_pay_due(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_pay_due(uuid) TO service_role;

-- public.practice_challenge_deals (Joe, 11 Nov 2026): the practice deals each player has had graded, by a digest of the
-- sealed deal (never the deal itself). A coin challenge pays only on a player's first graded run of a deal; a retry of
-- the same deal can still complete challenges that pay nothing. Written only by challenge_first_run; nobody reads it
-- through the API. A removed account takes its rows with it.
CREATE TABLE IF NOT EXISTS public.practice_challenge_deals (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  deal_key text NOT NULL CHECK (deal_key ~ '^[0-9a-f]{64}$'),
  graded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, deal_key)
);
REVOKE ALL ON public.practice_challenge_deals FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.practice_challenge_deals ENABLE ROW LEVEL SECURITY;

-- Notes a graded run of a deal: true the first time for this player and deal, false for every retry (two grades of the
-- same deal at once: exactly one is first, the key's primary key decides).
CREATE OR REPLACE FUNCTION public.challenge_first_run(p_user_id uuid, p_deal_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF p_user_id IS NULL OR p_deal_key IS NULL OR p_deal_key !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;
  INSERT INTO public.practice_challenge_deals (user_id, deal_key) VALUES (p_user_id, p_deal_key)
  ON CONFLICT (user_id, deal_key) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.challenge_first_run(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_first_run(uuid, text) TO service_role;

-- Analytics: challenge_completed (props: game, challenge, level, coins), written by the server only through
-- recordEvents (src/lib/data/events.server.ts). The list is read from the constraint as it stands and the new event
-- added to it, so events other migrations added are kept whatever the order (as 20261110200000 does).
DO $events$
DECLARE
  existing text[];
  wanted text[];
BEGIN
  IF to_regclass('analytics.events') IS NULL THEN
    RETURN;
  END IF;
  SELECT coalesce(array_agg(DISTINCT m[1]), ARRAY[]::text[])
    INTO existing
    FROM pg_constraint c,
         LATERAL regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''', 'g') AS m
   WHERE c.conrelid = 'analytics.events'::regclass AND c.conname = 'events_event_check';
  SELECT array_agg(e ORDER BY e) INTO wanted
    FROM (SELECT unnest(existing) AS e UNION SELECT unnest(ARRAY['challenge_completed'])) AS u;
  ALTER TABLE analytics.events DROP CONSTRAINT IF EXISTS events_event_check;
  EXECUTE format(
    'ALTER TABLE analytics.events ADD CONSTRAINT events_event_check CHECK (event IN (%s)) NOT VALID',
    (SELECT string_agg(quote_literal(e), ', ') FROM unnest(wanted) AS e)
  );
  ALTER TABLE analytics.events VALIDATE CONSTRAINT events_event_check;
END
$events$;
