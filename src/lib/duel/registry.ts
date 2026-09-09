import { anagramPuzzle } from "@/puzzles/anagram";
import { arithmeticPuzzle } from "@/puzzles/arithmetic";
import { equationPuzzle } from "@/puzzles/equation";
import { goNoGoPuzzle } from "@/puzzles/goNoGo";
import { missingLettersPuzzle } from "@/puzzles/missingLetters";
import { numberSequencePuzzle } from "@/puzzles/numberSequence";
import { oddWordPuzzle } from "@/puzzles/oddWordOut";
import { patternCompletionPuzzle } from "@/puzzles/patternCompletion";
import { reactionPuzzle } from "@/puzzles/reaction";
import { sequencePuzzle } from "@/puzzles/sequence";
import { spatialMemoryPuzzle } from "@/puzzles/spatialMemory";
import { stroopPuzzle } from "@/puzzles/stroop";
import type { PuzzleDefinition } from "@/puzzles/types";

import { ROUND_MS, type PuzzleCategory, type PuzzleData, type PuzzleType } from "./types";

/** The single registry of puzzle types. Add a new type by adding one entry. */
export const PUZZLE_REGISTRY: Record<PuzzleType, PuzzleDefinition> = {
  anagram: anagramPuzzle,
  oddword: oddWordPuzzle,
  missing: missingLettersPuzzle,
  arithmetic: arithmeticPuzzle,
  numseq: numberSequencePuzzle,
  equation: equationPuzzle,
  sequence: sequencePuzzle,
  spatial: spatialMemoryPuzzle,
  reaction: reactionPuzzle,
  gonogo: goNoGoPuzzle,
  stroop: stroopPuzzle,
  patcomp: patternCompletionPuzzle,
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

/** Preparation time before a puzzle's clock starts (0 for most types). */
export function puzzlePrepMs(puzzle: PuzzleData | undefined): number {
  if (!puzzle) return 0;
  return puzzleDef(puzzle.type).prepMs?.(puzzle) ?? 0;
}

/** How long the puzzle phase lasts for this puzzle. */
export function puzzleDurationMs(puzzle: PuzzleData | undefined): number {
  if (!puzzle) return ROUND_MS;
  const def = puzzleDef(puzzle.type);
  return def.durationMs?.(puzzle) ?? puzzlePrepMs(puzzle) + ROUND_MS;
}

export function puzzleShowsTimer(puzzle: PuzzleData | undefined): boolean {
  if (!puzzle) return true;
  return puzzleDef(puzzle.type).showTimer !== false;
}
