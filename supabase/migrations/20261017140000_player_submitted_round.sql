-- Live "finished" pings (17 Oct 2026; room data only). NOT YET APPLIED: the app works without it
-- (no pings are shown and nothing else changes), so publishing first is safe; apply it when ready.
--
--   submitted_round  the last round this player's answer was stored for (0: none this game).
--
-- It says only THAT a player has finished a round, never their score, answer or result: those stay
-- in round_results, unreadable by other players until the round closes (duel_round_ended).
-- Written only by the server: submitAnswerFn sets it after the player's round_results row is stored
-- (finishedPing.server.ts markSubmitted), rematchFn clears it for Play again (clearSubmitted).
-- Row-level security is unchanged: clients keep SELECT on their own rooms' players and no write
-- access (the restrictive "No client writes to players" policy and the revoked grants still apply),
-- so every player in the room reads it through the existing participant read policy and realtime.

ALTER TABLE public.duel_players
  ADD COLUMN IF NOT EXISTS submitted_round integer NOT NULL DEFAULT 0
    CONSTRAINT duel_players_submitted_round_range CHECK (submitted_round BETWEEN 0 AND 7);
