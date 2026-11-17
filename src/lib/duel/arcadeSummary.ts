/**
 * Arcade games whose own Reveal is a visual summary of the run (15 Nov 2026, the Home Run and Top Bins overhaul):
 * the shared arcade reveal (ArcadeReveal) draws it under the breakdown, in practice always and in a room with the
 * breakdown. Light (no game code): AnswerReveal asks it before the game's chunk has to say anything.
 */
import type { PuzzleData } from "./types";

export function hasArcadeSummary(puzzle: PuzzleData): boolean {
  if (puzzle.type === "homerun") return (puzzle.homerunRev ?? 1) >= 5;
  if (puzzle.type === "freekick") return (puzzle.freekickRev ?? 1) >= 5;
  return false;
}
