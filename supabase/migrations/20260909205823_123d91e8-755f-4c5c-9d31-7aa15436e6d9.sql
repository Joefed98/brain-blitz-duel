-- MVP reset: stored puzzles are being restructured, so clear in-flight duels.
DELETE FROM public.round_results;
DELETE FROM public.duel_players;
DELETE FROM public.duels;

-- 1. Split puzzle content: public render data stays on duels, answers move out.
ALTER TABLE public.duels ADD COLUMN puzzles_public jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.duels DROP COLUMN puzzles;

CREATE TABLE public.duel_secrets (
  duel_id uuid PRIMARY KEY REFERENCES public.duels(id) ON DELETE CASCADE,
  puzzles_private jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.duel_secrets FROM anon, authenticated;
GRANT ALL ON public.duel_secrets TO service_role;
ALTER TABLE public.duel_secrets ENABLE ROW LEVEL SECURITY;

-- 2. Real auth identity per device instead of a client-held token.
ALTER TABLE public.duel_players ADD COLUMN user_id uuid NOT NULL;
ALTER TABLE public.duel_players DROP COLUMN session_token;
CREATE UNIQUE INDEX IF NOT EXISTS duel_players_duel_user_key ON public.duel_players(duel_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS duel_players_duel_slot_key ON public.duel_players(duel_id, player_slot);
CREATE UNIQUE INDEX IF NOT EXISTS round_results_duel_slot_round_key ON public.round_results(duel_id, player_slot, round_number);

-- 3. Helper predicates used by the read policies.
CREATE OR REPLACE FUNCTION public.is_duel_participant(_duel_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.duel_players p
    WHERE p.duel_id = _duel_id AND p.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.my_duel_slot(_duel_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.player_slot FROM public.duel_players p
  WHERE p.duel_id = _duel_id AND p.user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.duel_round_ended(_duel_id uuid, _round integer)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.duels d
    WHERE d.id = _duel_id
      AND (
        d.status = 'finished'
        OR d.current_round > _round
        OR (d.current_round = _round AND d.phase IN ('reveal', 'result'))
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_duel_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_duel_slot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.duel_round_ended(uuid, integer) TO authenticated;

-- 4. Read-only client access, scoped to duels the caller is part of.
DROP POLICY IF EXISTS "duels open access" ON public.duels;
DROP POLICY IF EXISTS "duel_players open access" ON public.duel_players;
DROP POLICY IF EXISTS "round_results open access" ON public.round_results;

REVOKE ALL ON public.duels FROM anon, authenticated;
REVOKE ALL ON public.duel_players FROM anon, authenticated;
REVOKE ALL ON public.round_results FROM anon, authenticated;
GRANT SELECT ON public.duels TO authenticated;
GRANT SELECT ON public.duel_players TO authenticated;
GRANT SELECT ON public.round_results TO authenticated;
GRANT ALL ON public.duels TO service_role;
GRANT ALL ON public.duel_players TO service_role;
GRANT ALL ON public.round_results TO service_role;

CREATE POLICY "Participants can read their duel"
ON public.duels FOR SELECT TO authenticated
USING (public.is_duel_participant(id));

CREATE POLICY "Participants can read players of their duel"
ON public.duel_players FOR SELECT TO authenticated
USING (public.is_duel_participant(duel_id));

CREATE POLICY "Participants can read own results and finished rounds"
ON public.round_results FOR SELECT TO authenticated
USING (
  public.is_duel_participant(duel_id)
  AND (
    player_slot = public.my_duel_slot(duel_id)
    OR public.duel_round_ended(duel_id, round_number)
  )
);

-- 5. Realtime keeps working for the three readable tables.
ALTER TABLE public.duels REPLICA IDENTITY FULL;
ALTER TABLE public.duel_players REPLICA IDENTITY FULL;
ALTER TABLE public.round_results REPLICA IDENTITY FULL;