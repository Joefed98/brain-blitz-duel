import { wordsmithPuzzle } from "@/puzzles/wordsmith";
import { wordHuntPuzzle } from "@/puzzles/wordHunt";
import { unblockPuzzle } from "@/puzzles/unblock";
import { blockPartyPuzzle } from "@/puzzles/blockParty";
import { chainCalculationPuzzle } from "@/puzzles/chainCalculation";
import { countUpPuzzle } from "@/puzzles/countUp";
import { equationPuzzle } from "@/puzzles/equation";
import { goNoGoPuzzle } from "@/puzzles/goNoGo";
import { mirrorMatchPuzzle } from "@/puzzles/mirrorMatch";
import { wordLadderPuzzle } from "@/puzzles/wordLadder";
import { numberClimbPuzzle } from "@/puzzles/numberClimb";
import { numberHuntPuzzle } from "@/puzzles/numberHunt";
import { numberSequencePuzzle } from "@/puzzles/numberSequence";
import { groupsPuzzle } from "@/puzzles/groups";
import { spotDifferencePuzzle } from "@/puzzles/spotTheDifference";
import { patternCompletionPuzzle } from "@/puzzles/patternCompletion";
import { percentSprintPuzzle } from "@/puzzles/percentSprint";
import { reactionPuzzle } from "@/puzzles/reaction";
import { reverseRecallPuzzle } from "@/puzzles/reverseRecall";
import { spinPuzzle } from "@/puzzles/spin";
import { sequencePuzzle } from "@/puzzles/sequence";
import { spatialMemoryPuzzle } from "@/puzzles/spatialMemory";
import { stopWatchPuzzle } from "@/puzzles/stopWatch";
import { stroopPuzzle } from "@/puzzles/stroop";
import { symbolScanPuzzle } from "@/puzzles/symbolScan";
import { targetNumberPuzzle } from "@/puzzles/targetNumber";
import { wordMatchPuzzle } from "@/puzzles/wordMatch";
import { lightsOutPuzzle } from "@/puzzles/lightsOut";
import { pipesPuzzle } from "@/puzzles/pipes";
import { miniSudokuPuzzle } from "@/puzzles/miniSudoku";
import type { PuzzleDefinition } from "@/puzzles/types";

import {
  REVEAL_MS,
  ROUND_MS,
  type PuzzleCategory,
  type PuzzleData,
  type PuzzleType,
} from "./types";
import { CORRECT_ANSWERS, ROUND_SUMMARIES } from "./roundSummaries";

/** The single registry of puzzle types. Add a new type by adding one entry. */
type RegisteredPuzzleDefinition = PuzzleDefinition &
  Required<Pick<PuzzleDefinition, "roundSummary" | "correctAnswer">>;

const LONG_REVEAL_TYPES = new Set<PuzzleType>([
  "chaincalc",
  "target",
  "wordsmith",
  "wordhunt",
  "stroop",
  "wordmatch",
  "pctsprint",
  "spin",
  "mirmatch",
  "gonogo",
  "spotdiff",
  "groups",
  "ladder",
]);

const BASE_REGISTRY: Record<PuzzleType, PuzzleDefinition> = {
  wordsmith: wordsmithPuzzle,
  groups: groupsPuzzle,
  ladder: wordLadderPuzzle,
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
  spotdiff: spotDifferencePuzzle,
  patcomp: patternCompletionPuzzle,
  spin: spinPuzzle,
  wordmatch: wordMatchPuzzle,
  pctsprint: percentSprintPuzzle,
  numclimb: numberClimbPuzzle,
  stopwatch: stopWatchPuzzle,
  countup: countUpPuzzle,
  mirmatch: mirrorMatchPuzzle,
  wordhunt: wordHuntPuzzle,
  unblock: unblockPuzzle,
  blockparty: blockPartyPuzzle,
  lightsout: lightsOutPuzzle,
  pipes: pipesPuzzle,
  sudoku: miniSudokuPuzzle,
};

export const PUZZLE_REGISTRY = Object.fromEntries(
  Object.entries(BASE_REGISTRY).map(([type, definition]) => [
    type,
    {
      ...definition,
      revealMs:
        definition.revealMs ?? (LONG_REVEAL_TYPES.has(type as PuzzleType) ? 8_000 : REVEAL_MS),
      roundSummary: ROUND_SUMMARIES[type as PuzzleType],
      correctAnswer: CORRECT_ANSWERS[type as PuzzleType],
    },
  ]),
) as Record<PuzzleType, RegisteredPuzzleDefinition>;

export const PUZZLE_TYPES = Object.keys(PUZZLE_REGISTRY) as PuzzleType[];

export function puzzleDef(type: PuzzleType): RegisteredPuzzleDefinition {
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

export function puzzleRevealMs(puzzle: PuzzleData | undefined): number {
  if (!puzzle) return REVEAL_MS;
  return puzzleDef(puzzle.type).revealMs ?? REVEAL_MS;
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
