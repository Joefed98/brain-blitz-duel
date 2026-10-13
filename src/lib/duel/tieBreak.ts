/**
 * Tie-break time (rooms built from 13 Oct 2026). Players level on points are
 * split by the total time they used, each round adding the time actually
 * spent against that round's own limit:
 *
 * - puzzle rounds: the puzzle's stored timeLimitMs, else the registry limit,
 *   minus the stored ms_remaining;
 * - arcade and engine rounds (Mixed Signals, Letterfall…): the run length;
 *   ms_remaining is stored against the run plus the phase slack, so the time
 *   used is that clock minus ms_remaining, held to the run;
 * - Flash: its average reaction time, as before;
 * - a round with no answer: the whole limit.
 *
 * Every player in a room plays the same rounds, so a plain sum is fair; no
 * normalising by limit. Rooms are stamped per round (`tieRev` on every puzzle
 * buildRoomPuzzles makes); a room whose rounds are not all stamped keeps the
 * original tie-break (30 s minus time left per answered round), so rooms
 * played before rank exactly as they did.
 */
import { puzzleRunMs, puzzleTimeLimitMs } from "./registry";
import type { TieRound } from "./scoring";
import type { PuzzleData } from "./types";

export const TIE_REV = 1;

export function puzzleUsesTieRev(puzzle: unknown): boolean {
  return (puzzle as { tieRev?: number } | null)?.tieRev === TIE_REV;
}

/** Stamps a new room puzzle with the tie-break revision. */
export function stampTieRev<T extends PuzzleData>(puzzle: T): T {
  return { ...puzzle, tieRev: TIE_REV };
}

export function tieRoundFor(puzzle: PuzzleData): TieRound {
  const phaseLimitMs = puzzleTimeLimitMs(puzzle);
  const runMs = puzzleRunMs(puzzle);
  return { limitMs: runMs ?? phaseLimitMs, phaseLimitMs, flash: puzzle.type === "reaction" };
}

/** The room's tie-break rounds, or null when the room predates the stamp. */
export function roomTieRounds(
  puzzles: readonly PuzzleData[] | null | undefined,
): TieRound[] | null {
  if (!puzzles || puzzles.length === 0 || !puzzles.every(puzzleUsesTieRev)) return null;
  return puzzles.map(tieRoundFor);
}
