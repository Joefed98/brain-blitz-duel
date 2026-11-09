-- Finished pings for rounds 8–12 (9 Nov 2026, hotfix found during the Supabase move; room data only).
-- Idempotent and safe to apply at any time, before or after 20261017140000_player_submitted_round.sql.
--
-- 20261017140000 added duel_players.submitted_round with CHECK (submitted_round BETWEEN 0 AND 7), sized for
-- the 6- and 7-round rooms of the time. Room settings (31 Oct 2026) allow up to MAX_ROUNDS = 12 rounds
-- (src/lib/duel/roomSettings.ts), so markSubmitted's update for rounds 8–12 broke the check; the write is best
-- effort (finishedPing.server.ts), so the error was dropped and those rounds' "finished" pings never showed.
-- This widens the check to 0..12 (0: none this game). No stored row changes (rule 4): every existing value is
-- already 0–7. RLS and grants are unchanged. scripts/submitted-round-check.ts proves it on a 12-round room and
-- fails if MAX_ROUNDS ever outgrows the bound here.

-- The column itself, in case 20261017140000 was never applied (no-op when it was).
ALTER TABLE public.duel_players
  ADD COLUMN IF NOT EXISTS submitted_round integer NOT NULL DEFAULT 0;

-- Replace the range check by its own name (20261017140000's, kept), so re-applying this file is harmless.
ALTER TABLE public.duel_players DROP CONSTRAINT IF EXISTS duel_players_submitted_round_range;
ALTER TABLE public.duel_players
  ADD CONSTRAINT duel_players_submitted_round_range CHECK (submitted_round BETWEEN 0 AND 12);
