CREATE TABLE public.intro_demos (
  game_type text PRIMARY KEY,
  seed bigint NOT NULL,
  puzzle jsonb NOT NULL,
  input_log jsonb NOT NULL,
  start_tick integer NOT NULL DEFAULT 0,
  length_ticks integer NOT NULL DEFAULT 480,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.intro_demos TO anon, authenticated;
GRANT ALL ON public.intro_demos TO service_role;
ALTER TABLE public.intro_demos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Intro demos are public" ON public.intro_demos FOR SELECT TO anon, authenticated USING (true);