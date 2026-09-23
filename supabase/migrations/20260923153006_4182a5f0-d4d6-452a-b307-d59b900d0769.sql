CREATE TABLE public.unblock_bank (
  id SERIAL PRIMARY KEY,
  layout TEXT NOT NULL UNIQUE,
  min_moves INTEGER NOT NULL CHECK (min_moves BETWEEN 15 AND 22),
  solution TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.unblock_bank TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.unblock_bank_id_seq TO service_role;
ALTER TABLE public.unblock_bank ENABLE ROW LEVEL SECURITY;
CREATE INDEX unblock_bank_last_used_idx ON public.unblock_bank (last_used_at NULLS FIRST);