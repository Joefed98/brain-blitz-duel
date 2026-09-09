CREATE TABLE public.duels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'waiting',
  round_order jsonb NOT NULL,
  puzzles jsonb NOT NULL,
  current_round int NOT NULL DEFAULT 0,
  round_started_at timestamptz,
  next_duel_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.duel_players (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  duel_id uuid NOT NULL REFERENCES public.duels(id) ON DELETE CASCADE,
  player_slot int NOT NULL,
  display_name text NOT NULL,
  session_token text NOT NULL,
  ready_round int NOT NULL DEFAULT 0,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (duel_id, player_slot)
);

CREATE TABLE public.round_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  duel_id uuid NOT NULL REFERENCES public.duels(id) ON DELETE CASCADE,
  player_slot int NOT NULL,
  round_number int NOT NULL,
  answer text,
  is_correct boolean NOT NULL DEFAULT false,
  ms_remaining int NOT NULL DEFAULT 0,
  score int NOT NULL DEFAULT 0,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (duel_id, player_slot, round_number)
);

CREATE INDEX idx_duel_players_duel ON public.duel_players(duel_id);
CREATE INDEX idx_round_results_duel ON public.round_results(duel_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.duels TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duel_players TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.round_results TO anon, authenticated;
GRANT ALL ON public.duels TO service_role;
GRANT ALL ON public.duel_players TO service_role;
GRANT ALL ON public.round_results TO service_role;

ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "duels open access" ON public.duels FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "duel_players open access" ON public.duel_players FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "round_results open access" ON public.round_results FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.duels REPLICA IDENTITY FULL;
ALTER TABLE public.duel_players REPLICA IDENTITY FULL;
ALTER TABLE public.round_results REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.duels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.duel_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.round_results;