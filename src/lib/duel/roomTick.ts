/**
 * The room screen's clock tick (battery, 31 Oct 2026; display and phone timing only). During a round's
 * phases (Prepare to Duel, the round title, intro, the live puzzle, the reveal and the winner reveal) the
 * screen re-reads the shared clock every 100 ms as before: its timer ring, countdowns, drafts and shared-
 * clock moments need it. Between rounds (the lobby, the round result, standings and the final screens)
 * nothing on screen moves faster than a whole second, so it ticks every 250 ms: a quarter of the work.
 * The server still guards every move (advancePhase is idempotent and checks the phase); between rounds the
 * lead phone asks to move on at most 150 ms later than before (the stand-in phone waits 2.5 s regardless).
 */
export const ROUND_TICK_MS = 100;
export const BETWEEN_ROUNDS_TICK_MS = 250;

export function roomTickMs(duel: { status: string; phase?: string | null } | null | undefined): number {
  if (!duel) return ROUND_TICK_MS;
  if (duel.status === "waiting" || duel.status === "finished") return BETWEEN_ROUNDS_TICK_MS;
  return duel.phase === "result" || duel.phase === "standings" ? BETWEEN_ROUNDS_TICK_MS : ROUND_TICK_MS;
}
