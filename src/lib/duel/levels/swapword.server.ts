import type { GenerateContext } from "../generate.server";
import type { PuzzleData, SwapwordPuzzleData } from "../types";
import type { Level } from "@/lib/levels/levels";
import { SWAPWORD_LEVEL_SETTINGS, type SwapwordLevelSettings } from "@/lib/levels/word/swapword";
import { SW_SLOT_TILES, SW_TILES } from "../swapword";
import { fillWords, minSwaps, swapwordGenerateRev } from "../swapword.server";
import { rngBelow, rngShuffle, seededRng, wordGameSeed } from "../wordSeed.server";
import { swapwordHumanSolves, swapwordOneArrangement } from "./swapwordProof.server";

/**
 * Swapword dealt at a level beyond Normal (the Word overhaul, stage 3; settings in src/lib/levels/word/swapword.ts).
 * Today's recipe (six crossing common words, then a scramble of a chosen number of swap cycles) with the level's
 * swap minimum, tiles in place, budget and clock, from its own stream of the room seed (salted by level, so a level's
 * board never repeats Normal's). Only boards with one arrangement of six answer words keeping their green tiles are
 * dealt, and on Expert only boards the human-like solver works out. Never called at Normal.
 */
export function dealSwapwordLevel(level: Exclude<Level, "normal">, context: GenerateContext): PuzzleData | null {
  return buildSwapwordLevel(SWAPWORD_LEVEL_SETTINGS[level], wordGameSeed(`swapword:${level}`, context.bankSeed));
}

/** Null when a level board meets every rule of its settings, else the rule broken (the check reads the same). */
export function swapwordLevelRuleBreak(p: SwapwordPuzzleData, s: SwapwordLevelSettings): string | null {
  const solution = p.solution ?? "";
  if (solution.length !== SW_TILES || p.start.length !== SW_TILES) return "wrong tile count";
  if ([...p.start].sort().join("") !== [...solution].sort().join("")) return "start is not a scramble of the solution";
  const min = minSwaps(p.start, solution);
  if (min !== p.minSwaps) return `stored minimum ${p.minSwaps}, search says ${min}`;
  if (min < s.minSwaps[0] || min > s.minSwaps[1]) return `minimum ${min} outside ${s.minSwaps[0]}-${s.minSwaps[1]}`;
  if (p.maxSwaps !== min + s.spare) return `budget ${p.maxSwaps} is not ${min + s.spare}`;
  if ((p as { timeLimitMs?: number }).timeLimitMs !== s.timeLimitMs) return "clock";
  const inPlace = [...p.start].filter((ch, t) => ch === solution[t]).length;
  if (inPlace < s.inPlace[0] || inPlace > s.inPlace[1]) return `${inPlace} tiles start in place`;
  if (SW_SLOT_TILES.some((tiles) => tiles.every((t) => p.start[t] === solution[t]))) return "a word starts solved";
  if (!swapwordOneArrangement(p.start, solution)) return "more than one arrangement of six answer words keeps the green tiles";
  if (s.humanSolvable && !swapwordHumanSolves(p.start, solution)) return "the human-like solver can't work it out";
  return null;
}

export function buildSwapwordLevel(s: SwapwordLevelSettings, seed: number): SwapwordPuzzleData {
  const rng = seededRng(seed);
  for (let attempt = 0; attempt < 400; attempt++) {
    const solution = fillWords(rng);
    if (!solution) continue;
    for (let tries = 0; tries < 60; tries++) {
      const fixedCount = s.inPlace[0] + rngBelow(rng, s.inPlace[1] - s.inPlace[0] + 1);
      const order = rngShuffle(rng, Array.from({ length: SW_TILES }, (_, t) => t));
      const moving = order.slice(fixedCount);
      const target = s.minSwaps[0] + rngBelow(rng, s.minSwaps[1] - s.minSwaps[0] + 1);
      const cycles = moving.length - target;
      if (cycles < 1 || cycles * 2 > moving.length) continue;
      const lengths = Array.from({ length: cycles }, () => 2);
      for (let extra = moving.length - 2 * cycles; extra > 0; extra--) lengths[rngBelow(rng, cycles)]!++;
      const board = [...solution];
      let at = 0;
      for (const len of lengths) {
        const cyc = moving.slice(at, at + len);
        at += len;
        cyc.forEach((p, i) => (board[cyc[(i + 1) % len]!] = solution[p]!));
      }
      const start = board.join("");
      const min = minSwaps(start, solution);
      const puzzle: SwapwordPuzzleData = {
        type: "swapword",
        swapwordRev: swapwordGenerateRev(),
        start,
        minSwaps: min,
        maxSwaps: min + s.spare,
        solution,
        timeLimitMs: s.timeLimitMs,
      };
      if (swapwordLevelRuleBreak(puzzle, s) === null) return puzzle;
    }
  }
  throw new Error("Swapword: no level board found");
}
