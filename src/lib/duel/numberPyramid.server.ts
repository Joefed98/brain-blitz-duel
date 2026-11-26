import type { Level } from "@/lib/levels/levels";
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import type { NpLevelSettings } from "./numberPyramidLevels";

import { NUMBER_PYRAMID_BANK } from "./numberPyramidBank.server";
import { NUMBER_PYRAMID_LEVEL_BANKS } from "./numberPyramidLevelsBank.server";
import type { NumberPyramidPuzzleData } from "./types";

/**
 * Draws one pre-proven four-pyramid set: Normal (no level) from the bank it always has; Easy, Hard and Expert from
 * their own proved banks (stage 3 of the Number overhaul, numberPyramidLevels.ts).
 */
export function generateNumberPyramid(level?: Level): NumberPyramidPuzzleData {
  const bank = level && level !== "normal" ? NUMBER_PYRAMID_LEVEL_BANKS[level] : NUMBER_PYRAMID_BANK;
  const entry = bank[Math.floor(Math.random() * bank.length)]!;
  // D2 (22 Nov 2026): a level's own "full by" time, stamped on the deal.
  const fullByS = level && level !== "normal" ? gameLevelSettings<NpLevelSettings>("numpyramid", level)?.fullByS : undefined;
  return {
    type: "numpyramid",
    pyramids: entry.pyramids.map(({ rows, givens, tray }) => ({ rows, givens: [...givens], tray: [...tray] })),
    solutions: entry.pyramids.map(({ solution }) => [...solution]),
    ...(fullByS ? { speedFullByS: fullByS } : {}),
  };
}
