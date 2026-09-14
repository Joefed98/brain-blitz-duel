import { anagramPuzzle } from "@/puzzles/anagram";
import { chainCalculationPuzzle } from "@/puzzles/chainCalculation";
import { countUpPuzzle } from "@/puzzles/countUp";
import { equationPuzzle } from "@/puzzles/equation";
import { goNoGoPuzzle } from "@/puzzles/goNoGo";
import { mirrorMatchPuzzle } from "@/puzzles/mirrorMatch";
import { missingLettersPuzzle } from "@/puzzles/missingLetters";
import { numberSpanPuzzle } from "@/puzzles/numberSpan";
import { numberHuntPuzzle } from "@/puzzles/numberHunt";
import { numberSequencePuzzle } from "@/puzzles/numberSequence";
import { oddWordPuzzle } from "@/puzzles/oddWordOut";
import { oddShapeOutPuzzle } from "@/puzzles/oddShapeOut";
import { patternCompletionPuzzle } from "@/puzzles/patternCompletion";
import { percentSprintPuzzle } from "@/puzzles/percentSprint";
import { reactionPuzzle } from "@/puzzles/reaction";
import { reverseRecallPuzzle } from "@/puzzles/reverseRecall";
import { rotationMatchPuzzle } from "@/puzzles/rotationMatch";
import { sequencePuzzle } from "@/puzzles/sequence";
import { spatialMemoryPuzzle } from "@/puzzles/spatialMemory";
import { stopWatchPuzzle } from "@/puzzles/stopWatch";
import { stroopPuzzle } from "@/puzzles/stroop";
import { symbolScanPuzzle } from "@/puzzles/symbolScan";
import { targetNumberPuzzle } from "@/puzzles/targetNumber";
import { wordMatchPuzzle } from "@/puzzles/wordMatch";
import type { PuzzleDefinition } from "@/puzzles/types";

import { ROUND_MS, type PuzzleCategory, type PuzzleData, type PuzzleType } from "./types";

/** The single registry of puzzle types. Add a new type by adding one entry. */
export const PUZZLE_REGISTRY: Record<PuzzleType, PuzzleDefinition> = {
  anagram: anagramPuzzle,
  oddword: oddWordPuzzle,
  missing: missingLettersPuzzle,
  target: targetNumberPuzzle,
  numseq: numberSequencePuzzle,
  equation: equationPuzzle,
  chaincalc: chainCalculationPuzzle,
  sequence: sequencePuzzle,
  reverse: reverseRecallPuzzle,
  spatial: spatialMemoryPuzzle,
  reaction: reactionPuzzle,
  gonogo: goNoGoPuzzle,
  numhunt: numberHuntPuzzle,
  stroop: stroopPuzzle,
  symscan: symbolScanPuzzle,
  oddshape: oddShapeOutPuzzle,
  patcomp: patternCompletionPuzzle,
  rotmatch: rotationMatchPuzzle,
  wordmatch: wordMatchPuzzle,
  pctsprint: percentSprintPuzzle,
  numspan: numberSpanPuzzle,
  stopwatch: stopWatchPuzzle,
  countup: countUpPuzzle,
  mirmatch: mirrorMatchPuzzle,
};

export const PUZZLE_TYPES = Object.keys(PUZZLE_REGISTRY) as PuzzleType[];

export function puzzleDef(type: PuzzleType): PuzzleDefinition {
  return PUZZLE_REGISTRY[type];
}

export function puzzleName(type: PuzzleType): string {
  return PUZZLE_REGISTRY[type]?.name ?? type;
}

export function puzzleCategories(): PuzzleCategory[] {
  return Array.from(new Set(PUZZLE_TYPES.map((t) => PUZZLE_REGISTRY[t].category)));
}

export function typesInCategory(category: PuzzleCategory): PuzzleType[] {
  return PUZZLE_TYPES.filter((t) => PUZZLE_REGISTRY[t].category === category);
}

/** The clock length for a puzzle type (30s unless the type says otherwise). */
export function typeTimeLimitMs(type: PuzzleType): number {
  return puzzleDef(type).timeLimitMs ?? ROUND_MS;
}

/** The clock length for a specific puzzle. */
export function puzzleTimeLimitMs(puzzle: PuzzleData | undefined): number {
  if (!puzzle) return ROUND_MS;
  return typeTimeLimitMs(puzzle.type);
}

/** Preparation time before a puzzle's clock starts (0 for most types). */
export function puzzlePrepMs(puzzle: PuzzleData | undefined): number {
  if (!puzzle) return 0;
  return puzzleDef(puzzle.type).prepMs?.(puzzle) ?? 0;
}

/** How long the puzzle phase lasts for this puzzle. */
export function puzzleDurationMs(puzzle: PuzzleData | undefined): number {
  if (!puzzle) return ROUND_MS;
  const def = puzzleDef(puzzle.type);
  return def.durationMs?.(puzzle) ?? puzzlePrepMs(puzzle) + puzzleTimeLimitMs(puzzle);
}

export function puzzleShowsTimer(puzzle: PuzzleData | undefined): boolean {
  if (!puzzle) return true;
  return puzzleDef(puzzle.type).showTimer !== false;
}
