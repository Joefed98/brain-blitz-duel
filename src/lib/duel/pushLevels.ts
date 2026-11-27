/**
 * Heave's levels as the phone and the grader read them from a stored puzzle (the Pattern overhaul, stage 3, 16 Nov
 * 2026; src/lib/levels/pattern/push.levels.ts). Shared and pure. A puzzle without a `level` is Normal.
 */
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import { NORMAL, puzzleLevel } from "@/lib/levels/levels";
import { PUSH_NORMAL_STUCK_HINT, type PushLevelSettings } from "@/lib/levels/pattern/push.levels";
import { patternLevelFullByS } from "./standard/plLevelSpeed";

function levelSettings(puzzle: { type?: string; level?: unknown } | null | undefined): PushLevelSettings | null {
  if (puzzle?.type !== "push" || puzzle.level === undefined) return null;
  const level = puzzleLevel(puzzle);
  return level === NORMAL ? null : gameLevelSettings<PushLevelSettings>("push", level);
}

/** Whether a dealt Heave puzzle shows the stuck hint (display only): Normal and Easy. */
export function stuckHintOn(puzzle: { type?: string; level?: unknown } | null | undefined): boolean {
  if (puzzle?.type !== "push") return false;
  if (puzzleLevel(puzzle) === NORMAL) return PUSH_NORMAL_STUCK_HINT;
  return levelSettings(puzzle)?.stuckHint === true;
}

/** The full-speed time of a board dealt at a level, or null (Normal and every puzzle dealt before levels: 45 s). */
export function pushLevelFullByS(puzzle: { type?: string; level?: unknown } | null | undefined): number | null {
  if (puzzle?.type !== "push" || puzzle.level === undefined) return null;
  // Its stamped time (D4, 22 Nov 2026), else the time its level had when it was dealt (plLevelSpeed.ts).
  return patternLevelFullByS("push", puzzle);
}
