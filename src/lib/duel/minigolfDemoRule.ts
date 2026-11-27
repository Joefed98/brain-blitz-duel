import type { PuzzleData } from "./types";
import { MINIGOLF_REV_COURSE, MINIGOLF_REV_D6 } from "@/lib/arcade/minigolf";

/**
 * Crazy Golf's demo rule (the Crazy Golf overhaul, 15 Nov 2026): golfRev 3 deals new holes from the hole bank, the chip
 * and the levels, so only a demo recorded on golfRev 3, on Normal (no `level`), plays; an older demo stays stopped and
 * the intro shows its still. golfRev 4 (D6, 27 Nov 2026) is golfRev 3's holes and play with only the scoring moved, so a
 * demo recorded on either plays. Pure, so a check can ask it (introDemo.functions.ts does).
 */
export function minigolfDemoPlays(type: string, puzzle: PuzzleData | null | undefined): boolean {
  if (type !== "minigolf") return true;
  return puzzle?.type === "minigolf" && (puzzle.golfRev === MINIGOLF_REV_COURSE || puzzle.golfRev === MINIGOLF_REV_D6) && !(puzzle as { level?: unknown }).level;
}
