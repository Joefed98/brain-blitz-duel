import type { PuzzleData } from "./types";
import { HOMERUN_REV_DEALT } from "@/lib/arcade/homerun";
import { FREEKICK_REV_DEALT } from "@/lib/arcade/freekick";

/**
 * The Home Run and Top Bins overhaul's demo rule (15 Nov 2026): homerunRev 5 (the innings) and freekickRev 5 (the
 * layered kick) are new games, so only a demo recorded on the stamp rooms deal, on Normal (no `level`), plays; an
 * older demo stays stopped and the intro shows its still. Pure, so a check can ask it (introDemo.functions.ts does).
 */
export function sportsDemoPlays(type: string, puzzle: PuzzleData | null | undefined): boolean {
  if (type === "homerun") return puzzle?.type === "homerun" && puzzle.homerunRev === HOMERUN_REV_DEALT && !puzzle.level;
  if (type === "freekick") return puzzle?.type === "freekick" && puzzle.freekickRev === FREEKICK_REV_DEALT && !puzzle.level;
  return true;
}
