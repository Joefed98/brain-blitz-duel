import type { GenerateContext } from "../generate.server";
import type { PuzzleData, SwapwordPuzzleData } from "../types";
import type { Level } from "@/lib/levels/levels";
import { SWAPWORD_LEVEL_SETTINGS, type SwapwordLevelSettings } from "@/lib/levels/word/swapword";
import { encodeSwapword, SW_EXPERT_LATTICE, SW_HARD_LATTICE, SW_NORMAL_LATTICE, SW_SLOT_TILES, SW_TILES, SWAPWORD_REV_LATTICE, swGeometry, swLatticeOf, type SwLattice } from "../swapword";
import { answerWords } from "../dictionary.server";
import { fillLatticeWords, fillWords, minSwaps, swapwordGenerateRev, swapwordWords, witnessSwaps } from "../swapword.server";
import { gradeAnswer } from "../gradeAnswer.server";
import { dealStandard } from "../standard/stamps";
import { limitEntryMs } from "./humanLimits";
import { rngBelow, rngShuffle, seededRng, wordGameSeed } from "../wordSeed.server";
import { swapwordDeduction, swapwordHumanSolves, swapwordOneArrangement } from "./swapwordProof.server";

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

/** The lattice a level's settings name (today's figure eight when none). */
export function swapwordLevelLattice(s: SwapwordLevelSettings): SwLattice {
  return s.lattice === "hard" ? SW_HARD_LATTICE : s.lattice === "expert" ? SW_EXPERT_LATTICE : SW_NORMAL_LATTICE;
}

/** A swap at the human limits: react, then tap the two tiles (humanLimits.ts). */
export const SWAPWORD_SWAP_TAPS = 2;

/**
 * The person-like line at the human limits (D1, 21 Nov 2026; the proof a level's 200 is reachable by the best humans):
 * the mark-reading solver (swapwordDeduction) works out the words from what the phone shows, 0.25 s to react for each
 * word it fixes, then the player makes the fewest swaps (witnessSwaps), each 0.25 s to react and two taps at 0.15 s;
 * graded by the server, as the deal's layers will stamp it, at the moment the last swap lands. Null when the solver
 * can't work the board out.
 */
export function swapwordLineAtLimits(p: SwapwordPuzzleData): { score: number; ms: number } | null {
  const lattice = swLatticeOf(p);
  const solution = p.solution ?? "";
  const trace = swapwordDeduction(p.start, solution, lattice);
  if (trace.known !== solution || trace.steps.some((step) => step.guessed)) return null;
  const swaps = witnessSwaps(p.start, solution);
  const ms = trace.steps.length * limitEntryMs(0) + swaps.length * limitEntryMs(SWAPWORD_SWAP_TAPS);
  const limit = p.timeLimitMs ?? 120_000;
  if (ms > limit) return { score: 0, ms };
  return { score: gradeAnswer(dealStandard(p), encodeSwapword(swaps), Math.max(0, limit - ms)).score, ms };
}

/** Null when a level board meets every rule of its settings, else the rule broken (the check reads the same). */
export function swapwordLevelRuleBreak(p: SwapwordPuzzleData, s: SwapwordLevelSettings): string | null {
  if (s.lattice) return swapwordLatticeRuleBreak(p, s);
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

/** swapwordLevelRuleBreak for a lattice level (swapwordRev 8): the same rules on the lattice's own tiles and words. */
function swapwordLatticeRuleBreak(p: SwapwordPuzzleData, s: SwapwordLevelSettings): string | null {
  const lattice = swapwordLevelLattice(s);
  const g = swGeometry(lattice);
  const solution = p.solution ?? "";
  if (p.swapwordRev !== SWAPWORD_REV_LATTICE) return `swapwordRev ${p.swapwordRev}, not ${SWAPWORD_REV_LATTICE}`;
  if (JSON.stringify(p.lattice) !== JSON.stringify(lattice)) return "the stored lattice is not the level's";
  if (solution.length !== g.tiles || p.start.length !== g.tiles) return "wrong tile count";
  if ([...p.start].sort().join("") !== [...solution].sort().join("")) return "start is not a scramble of the solution";
  const words = swapwordWords(solution, lattice);
  if (new Set(words).size !== words.length) return "repeated word";
  for (const w of words) if (!answerWords(w.length).includes(w)) return `${w} is not a common answer word`;
  const min = minSwaps(p.start, solution);
  if (min !== p.minSwaps) return `stored minimum ${p.minSwaps}, search says ${min}`;
  if (min < s.minSwaps[0] || min > s.minSwaps[1]) return `minimum ${min} outside ${s.minSwaps[0]}-${s.minSwaps[1]}`;
  if (p.maxSwaps !== min + s.spare) return `budget ${p.maxSwaps} is not ${min + s.spare}`;
  if (p.timeLimitMs !== s.timeLimitMs) return "clock";
  const inPlace = [...p.start].filter((ch, t) => ch === solution[t]).length;
  if (inPlace < s.inPlace[0] || inPlace > s.inPlace[1]) return `${inPlace} tiles start in place`;
  if (g.slotTiles.some((tiles) => tiles.every((t) => p.start[t] === solution[t]))) return "a word starts solved";
  if (!swapwordOneArrangement(p.start, solution, lattice)) return "more than one arrangement of answer words keeps the green tiles";
  if (s.humanSolvable && !swapwordHumanSolves(p.start, solution, lattice)) return "the human-like solver can't work it out";
  if (s.line200 && (swapwordLineAtLimits(p)?.score ?? 0) < 200) return "the person-like line doesn't reach 200 at the human limits";
  return null;
}

/** Lattice fills tried at most this many times for a level board (each with 60 scrambles). */
export const SWAPWORD_LATTICE_FILLS = 80;

function buildLatticeLevel(s: SwapwordLevelSettings, seed: number): SwapwordPuzzleData {
  const lattice = swapwordLevelLattice(s);
  const g = swGeometry(lattice);
  const rng = seededRng(seed);
  for (let attempt = 0; attempt < SWAPWORD_LATTICE_FILLS; attempt++) {
    const solution = fillLatticeWords(rng, lattice);
    if (!solution) continue;
    for (let tries = 0; tries < 60; tries++) {
      const fixedCount = s.inPlace[0] + rngBelow(rng, s.inPlace[1] - s.inPlace[0] + 1);
      const order = rngShuffle(rng, Array.from({ length: g.tiles }, (_, t) => t));
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
        swapwordRev: SWAPWORD_REV_LATTICE,
        start,
        minSwaps: min,
        maxSwaps: min + s.spare,
        solution,
        timeLimitMs: s.timeLimitMs,
        lattice: { cols: lattice.cols, rows: lattice.rows, cells: [...lattice.cells], slots: lattice.slots.map((x) => ({ ...x })) },
      };
      if (swapwordLatticeRuleBreak(puzzle, s) === null) return puzzle;
    }
  }
  throw new Error("Swapword: no lattice level board found");
}

export function buildSwapwordLevel(s: SwapwordLevelSettings, seed: number): SwapwordPuzzleData {
  if (s.lattice) return buildLatticeLevel(s, seed);
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
