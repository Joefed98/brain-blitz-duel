/**
 * The time until a rated 4- or 8-player match's next game starts (wave 3, session W3c), for the format slot's Between
 * screen. Pure, from the room's own phase clock (the same constants the room route advances on): between games the
 * room shows its round result (NEXT_ROUND_AUTO_MS) and then its standings (STANDINGS_MS), and the next game's title
 * card follows. After the last game there is no next game: null. Every player tapping Continue can end it sooner.
 */
import { NEXT_ROUND_AUTO_MS, STANDINGS_MS } from "@/lib/duel/types";

export type BetweenPhase = "result" | "standings";

export function isBetweenPhase(phase: string | null | undefined): phase is BetweenPhase {
  return phase === "result" || phase === "standings";
}

export function msUntilNextGame(phase: BetweenPhase, elapsedMs: number, round: number, totalRounds: number): number | null {
  if (round >= totalRounds) return null;
  const elapsed = Math.max(0, elapsedMs);
  const left = phase === "result" ? Math.max(0, NEXT_ROUND_AUTO_MS - elapsed) + STANDINGS_MS : Math.max(0, STANDINGS_MS - elapsed);
  return left;
}
