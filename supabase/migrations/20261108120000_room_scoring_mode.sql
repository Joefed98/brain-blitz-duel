-- Room scoring choice (src/lib/duel/scoringMode.ts): the host picks Total score (today's behaviour) or
-- Placings (points by place in each round) in the room settings sheet. Stored on the room; every existing
-- room, and every room made without a choice, is 'total', so nothing about a stored room changes. Only the
-- server writes it (roomSettings.server.ts, through the service role); RLS is unchanged (clients only read
-- duels, as before). Until this is applied the app reads every room as 'total' and hides the choice.

ALTER TABLE public.duels
  ADD COLUMN IF NOT EXISTS scoring_mode text NOT NULL DEFAULT 'total';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'duels_scoring_mode_check'
  ) THEN
    ALTER TABLE public.duels
      ADD CONSTRAINT duels_scoring_mode_check CHECK (scoring_mode IN ('total', 'placings'));
  END IF;
END $$;
