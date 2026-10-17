import type { AwardRound } from "./podiumAwards";
import { isLiveType, puzzleName, puzzleShowsTimer, puzzleTimeLimitMs, usesArcadeClock } from "./registry";
import type { DuelRow, PuzzleData, StoredPuzzleType } from "./types";

/**
 * What podiumAwards needs about each of a room's rounds. Only live puzzle rounds with a visible
 * answer clock are timed; arcade-engine runs, Flash's reactions and deleted games are not.
 */
export function awardRoundsFor(duel: Pick<DuelRow, "round_order" | "puzzles_public" | "round_count">): AwardRound[] {
  const count = duel.round_count || duel.round_order.length;
  return Array.from({ length: count }, (_, index) => {
    const puzzle = duel.puzzles_public[index] as PuzzleData | undefined;
    const type = (puzzle?.type ?? duel.round_order[index] ?? "wordsmith") as StoredPuzzleType;
    const live = isLiveType(type);
    return {
      type,
      name: puzzleName(type),
      timeLimitMs: live ? puzzleTimeLimitMs(puzzle) : 0,
      timed: live && !!puzzle && type !== "reaction" && !usesArcadeClock(type) && puzzleShowsTimer(puzzle),
    };
  });
}
