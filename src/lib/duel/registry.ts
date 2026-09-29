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
import { tileGridPuzzle } from "@/puzzles/tileGrid";
import { wordSlidePuzzle } from "@/puzzles/wordSlide";
import { sumHuntPuzzle } from "@/puzzles/sumHunt";
import { balancePuzzle } from "@/puzzles/balance";
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
import { flowPuzzle } from "@/puzzles/flow";
import { iceSlidePuzzle } from "@/puzzles/iceSlide";
import { pushPuzzle } from "@/puzzles/push";
import { laserPuzzle } from "@/puzzles/laser";
import { towerPuzzle } from "@/puzzles/tower";
import { mazeDashPuzzle } from "@/puzzles/mazeDash";
import { sortTubesPuzzle } from "@/puzzles/sortTubes";
import { safeCrackerPuzzle } from "@/puzzles/safeCracker";
import { bombDefusalPuzzle } from "@/puzzles/bombDefusal";
import { gravityMazePuzzle } from "@/puzzles/gravityMaze";
import { chainTapPuzzle } from "@/puzzles/chainTap";
import { intruderDetectionPuzzle } from "@/puzzles/intruderDetection";
import { nonogramPuzzle } from "@/puzzles/nonogram";
import { pairMatchPuzzle } from "@/puzzles/pairMatch";
import { colourFloodPuzzle } from "@/puzzles/colourFlood";
import { oneStrokePuzzle } from "@/puzzles/oneStroke";
import { slidingTilesPuzzle } from "@/puzzles/slidingTiles";
import { rotatingRingsPuzzle } from "@/puzzles/rotatingRings";
import { hoverPuzzle } from "@/puzzles/hover";
import { swervePuzzle } from "@/puzzles/swerve";
import { skylinePuzzle } from "@/puzzles/skyline";
import { binTossPuzzle } from "@/puzzles/binToss";
import { bullseyePuzzle } from "@/puzzles/bullseye";
import { matchupPuzzle } from "@/puzzles/matchup";
import { breakerPuzzle } from "@/puzzles/breaker";
import { rallyPuzzle } from "@/puzzles/rally";
import { steadyPuzzle } from "@/puzzles/steady";
import { slicePuzzle } from "@/puzzles/slice";
import { bubblePuzzle } from "@/puzzles/bubble";
import { beatPuzzle } from "@/puzzles/beat";
import { snakePuzzle } from "@/puzzles/snake";
import { crossPuzzle } from "@/puzzles/cross";
import { dualPuzzle } from "@/puzzles/dual";
import { ricochetPuzzle } from "@/puzzles/ricochet";
import { whackPuzzle } from "@/puzzles/whack";
import { tentsPuzzle } from "@/puzzles/tents";
import { wavefrontPuzzle } from "@/puzzles/wavefront";
import { bastionPuzzle } from "@/puzzles/bastion";
import { rooftopPuzzle } from "@/puzzles/rooftop";
import { sortRushPuzzle } from "@/puzzles/sortRush";
import { flipPuzzle } from "@/puzzles/flip";
import { parryPuzzle } from "@/puzzles/parry";
import { junctionPuzzle } from "@/puzzles/junction";
import { inkBridgePuzzle } from "@/puzzles/inkBridge";

import type { PuzzleDefinition } from "@/puzzles/types";

import {
  REVEAL_MS,
  ROUND_MS,
  type PuzzleCategory,
  type PuzzleData,
  type PuzzleType,
} from "./types";
import { CORRECT_ANSWERS, ROUND_SUMMARIES } from "./roundSummaries";
import { PUZZLE_INSTRUCTIONS } from "./instructions";

/** The single registry of puzzle types. Add a new type by adding one entry. */
type RegisteredPuzzleDefinition = PuzzleDefinition &
  Required<Pick<PuzzleDefinition, "roundSummary" | "correctAnswer" | "instructions" | "retired">>;

const LONG_REVEAL_TYPES = new Set<PuzzleType>([
  "numseq",
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
  "tilegrid",
]);

/** Always in the room draw. */
export const CORE_CATEGORIES: PuzzleCategory[] = ["logic", "pattern", "speed", "attention", "word"];

/** Only drawn when the host switches them on in the lobby. */
export const OPT_IN_CATEGORIES: PuzzleCategory[] = ["number", "memory"];

/** The arcade pool: one round at most, and only when the host toggle is on. */
export const ARCADE_CATEGORY: PuzzleCategory = "arcade";

/** Weighting for a core category filling an extra round. */
export const CORE_SIXTH_WEIGHTS: Record<PuzzleCategory, number> = {
  logic: 0.35,
  pattern: 0.35,
  speed: 0.15,
  attention: 0.1,
  word: 0.05,
  number: 0,
  memory: 0,
  arcade: 0,
};

/** Never drawn in rooms; still playable in practice. */
const RETIRED_TYPES = new Set<PuzzleType>([
  "groups",
  "chaincalc",
  "sequence",
  "reverse",
  "spatial",
  "numclimb",
  "patcomp",
  "rooftop",
]);

const BASE_REGISTRY: Record<PuzzleType, Omit<PuzzleDefinition, "instructions">> = {
  wordsmith: wordsmithPuzzle,
  groups: groupsPuzzle,
  ladder: wordLadderPuzzle,
  tilegrid: tileGridPuzzle,
  wordslide: wordSlidePuzzle,
  sumhunt: sumHuntPuzzle,
  balance: balancePuzzle,
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
  flow: flowPuzzle,
  iceslide: iceSlidePuzzle,
  push: pushPuzzle,
  laser: laserPuzzle,
  tower: towerPuzzle,
  maze: mazeDashPuzzle,
  tubes: sortTubesPuzzle,
  safe: safeCrackerPuzzle,
  bomb: bombDefusalPuzzle,
  gravity: gravityMazePuzzle,
  chain: chainTapPuzzle,
  intruder: intruderDetectionPuzzle,
  nonogram: nonogramPuzzle,
  pairmatch: pairMatchPuzzle,
  flood: colourFloodPuzzle,
  stroke: oneStrokePuzzle,
  tiles: slidingTilesPuzzle,
  rings: rotatingRingsPuzzle,
  hover: hoverPuzzle,
  swerve: swervePuzzle,
  skyline: skylinePuzzle,
  bintoss: binTossPuzzle,
  bullseye: bullseyePuzzle,
  matchup: matchupPuzzle,
  breaker: breakerPuzzle,
  rally: rallyPuzzle,
  steady: steadyPuzzle,
  slice: slicePuzzle,
  bubble: bubblePuzzle,
  beat: beatPuzzle,
  snake: snakePuzzle,
  cross: crossPuzzle,
  dual: dualPuzzle,
  ricochet: ricochetPuzzle,
  whack: whackPuzzle,
  tents: tentsPuzzle,
  wavefront: wavefrontPuzzle,
  bastion: bastionPuzzle,
  rooftop: rooftopPuzzle,
  sortrush: sortRushPuzzle,
  flip: flipPuzzle,
  parry: parryPuzzle,
  junction: junctionPuzzle,
  inkbridge: inkBridgePuzzle,
};

export const PUZZLE_REGISTRY = Object.fromEntries(
  Object.entries(BASE_REGISTRY).map(([type, definition]) => [
    type,
    {
      ...definition,
      instructions: PUZZLE_INSTRUCTIONS[type as PuzzleType],
      retired: RETIRED_TYPES.has(type as PuzzleType),
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

/** True for types kept only for practice. */
export function isRetired(type: PuzzleType): boolean {
  return PUZZLE_REGISTRY[type]?.retired === true;
}

/** Every type still in rotation. */
export const ACTIVE_PUZZLE_TYPES = PUZZLE_TYPES.filter((t) => !isRetired(t));

export const RETIRED_PUZZLE_TYPES = PUZZLE_TYPES.filter((t) => isRetired(t));

export function puzzleCategories(): PuzzleCategory[] {
  return Array.from(new Set(ACTIVE_PUZZLE_TYPES.map((t) => PUZZLE_REGISTRY[t].category)));
}

/** Non-retired types in a category — what every draw and list reads. */
export function typesInCategory(category: PuzzleCategory): PuzzleType[] {
  return ACTIVE_PUZZLE_TYPES.filter((t) => PUZZLE_REGISTRY[t].category === category);
}

/** Includes retired types; for practice listings only. */
export function allTypesInCategory(category: PuzzleCategory): PuzzleType[] {
  return PUZZLE_TYPES.filter((t) => PUZZLE_REGISTRY[t].category === category);
}

/** Pool sizes per category, retired types excluded. */
export function categoryPoolSizes(): Record<PuzzleCategory, number> {
  const out = {} as Record<PuzzleCategory, number>;
  for (const category of [...CORE_CATEGORIES, ...OPT_IN_CATEGORIES]) {
    out[category] = typesInCategory(category).length;
  }
  return out;
}

/** The clock length for a puzzle type (30s unless the type says otherwise). */
export function typeTimeLimitMs(type: PuzzleType): number {
  return puzzleDef(type).timeLimitMs ?? ROUND_MS;
}

/**
 * The clock length for a specific puzzle. A puzzle may carry its own limit —
 * Tower's five-disc variant does — which always wins over the type's default.
 */
export function puzzleTimeLimitMs(puzzle: PuzzleData | undefined): number {
  if (!puzzle) return ROUND_MS;
  const own = (puzzle as { timeLimitMs?: number }).timeLimitMs;
  if (typeof own === "number" && own > 0) return own;
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

/** Slack added to every arcade phase beyond its run; never shown to players. */
export const ARCADE_PHASE_SLACK_MS = 3000;

/** Arcade-category games plus any other type built on the arcade engine. */
export function usesArcadeClock(type: PuzzleType): boolean {
  const def = puzzleDef(type);
  return def.category === "arcade" || def.arcadeRun === true;
}

/** For arcade rounds, the run length the clock shows; null for everything else. */
export function puzzleRunMs(puzzle: PuzzleData | undefined): number | null {
  if (!puzzle) return null;
  const def = puzzleDef(puzzle.type);
  if (!usesArcadeClock(puzzle.type)) return null;
  return def.timeLimitMs - ARCADE_PHASE_SLACK_MS;
}

export function puzzleShowsTimer(puzzle: PuzzleData | undefined): boolean {
  if (!puzzle) return true;
  return puzzleDef(puzzle.type).showTimer !== false;
}
