/**
 * Joules for rated matches (wave 3, session W3a; docs/economy/economy-design.md "Joules and pacing", Joe's table):
 * a best of 3 pays 150 for a win and 100 for a loss; a best of 5 or 7, and a 4- or 8-player match, 1.5 times that.
 * Every live player earns them, win or lose; a recorded run's owner earns none (they didn't play).
 *
 * D2 (the Season pass) credits them: each live player's amount is stored on their row of the match
 * (`rated_match_players.joules`) and answered by recordRatedMatch, and D2's hook pays it under ratedJoulesKey, so
 * it pays once however often it is asked. Pure; shared by the phone (the result screen's line) and the server.
 */
import type { RatedFormat } from "@/lib/data/ratings";

export const RATED_JOULES_WIN = 150;
export const RATED_JOULES_LOSS = 100;
export const RATED_JOULES_LONG_FACTOR = 1.5;

/** A best of 3 (×1) or the longer and bigger formats (×1.5). */
export function joulesFactor(format: RatedFormat): number {
  return format.kind === "duel" && format.bestOf === 3 ? 1 : RATED_JOULES_LONG_FACTOR;
}

/** What one live player's match pays. A draw pays a loss's amount; first place in 4 or 8 players is a win. */
export function ratedMatchJoules(format: RatedFormat, result: "win" | "loss" | "draw"): number {
  return Math.round((result === "win" ? RATED_JOULES_WIN : RATED_JOULES_LOSS) * joulesFactor(format));
}

/** D2's idempotency key for one player's Joules from one match. */
export function ratedJoulesKey(matchId: string, playerId: string): string {
  return `rated_match:${matchId}:${playerId}`;
}
