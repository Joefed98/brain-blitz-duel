/**
 * The Word games' level deals (the Word overhaul, stage 3, 15 Nov 2026): generatePuzzle hands a Word game asked at a
 * level beyond Normal here first; each game builds that level's board in its own module (src/lib/duel/levels/). Null:
 * Normal's board. Never reached at Normal (the deal hands Normal no level), so every Normal deal is today's.
 */
import type { GenerateContext } from "./generate.server";
import type { PuzzleData, PuzzleType } from "./types";
import type { Level } from "@/lib/levels/levels";
import { dealNucleusLevel } from "./levels/wordsmith.server";
import { dealInterlockLevel } from "./levels/tilegrid.server";
import { dealSliderLevel } from "./levels/wordslide.server";
import { dealForageLevel } from "./levels/wordhunt.server";
import { dealLookoutLevel } from "./levels/wordsearch.server";
import { dealRoundaboutLevel } from "./levels/letterwheel.server";
import { dealStrikeoutLevel } from "./levels/strikeout.server";
import { dealCryptogridLevel } from "./levels/codeword.server";
import { dealSwapwordLevel } from "./levels/swapword.server";

export function dealWordLevel(type: PuzzleType, level: Exclude<Level, "normal">, context: GenerateContext): PuzzleData | null {
  switch (type) {
    case "wordsmith": return dealNucleusLevel(level, context);
    case "tilegrid": return dealInterlockLevel(level, context);
    case "wordslide": return dealSliderLevel(level, context);
    case "wordhunt": return dealForageLevel(level, context);
    case "wordsearch": return dealLookoutLevel(level, context);
    case "letterwheel": return dealRoundaboutLevel(level, context);
    case "strikeout": return dealStrikeoutLevel(level, context);
    case "codeword": return dealCryptogridLevel(level, context);
    case "swapword": return dealSwapwordLevel(level, context);
    default: return null;
  }
}
