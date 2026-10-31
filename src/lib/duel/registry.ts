import { wordsmithPuzzle } from "@/puzzles/wordsmith";
import { wordHuntPuzzle } from "@/puzzles/wordHunt";
import { unblockPuzzle } from "@/puzzles/unblock";
import { blockPartyPuzzle } from "@/puzzles/blockParty";
import { countUpPuzzle } from "@/puzzles/countUp";
import { equationPuzzle } from "@/puzzles/equation";
import { tileGridPuzzle } from "@/puzzles/tileGrid";
import { wordSlidePuzzle } from "@/puzzles/wordSlide";
import { balancePuzzle } from "@/puzzles/balance";
import { numberHuntPuzzle } from "@/puzzles/numberHunt";
import { spotDifferencePuzzle } from "@/puzzles/spotTheDifference";
import { reactionPuzzle } from "@/puzzles/reaction";
import { stopWatchPuzzle } from "@/puzzles/stopWatch";
import { stroopPuzzle } from "@/puzzles/stroop";
import { symbolScanPuzzle } from "@/puzzles/symbolScan";
import { targetNumberPuzzle } from "@/puzzles/targetNumber";
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
import { nonogramPuzzle } from "@/puzzles/nonogram";
import { pairMatchPuzzle } from "@/puzzles/pairMatch";
import { colourFloodPuzzle } from "@/puzzles/colourFlood";
import { slidingTilesPuzzle } from "@/puzzles/slidingTiles";
import { rotatingRingsPuzzle } from "@/puzzles/rotatingRings";
import { hoverPuzzle } from "@/puzzles/hover";
import { swervePuzzle } from "@/puzzles/swerve";
import { skylinePuzzle } from "@/puzzles/skyline";
import { binTossPuzzle } from "@/puzzles/binToss";
import { bullseyePuzzle } from "@/puzzles/bullseye";
import { matchupPuzzle } from "@/puzzles/matchup";
import { breakerPuzzle } from "@/puzzles/breaker";
import { pinballPuzzle } from "@/puzzles/pinball";
import { minesweeperPuzzle } from "@/puzzles/minesweeper";
import { mahjongPuzzle } from "@/puzzles/mahjong";
import { homerunPuzzle } from "@/puzzles/homerun";
import { freekickPuzzle } from "@/puzzles/freekick";
import { racingPuzzle } from "@/puzzles/racing";
import { freecellPuzzle } from "@/puzzles/freecell";
import { tripeaksPuzzle } from "@/puzzles/tripeaks";
import { pokerSquaresPuzzle } from "@/puzzles/pokerSquares";
import { fiveHandsPuzzle } from "@/puzzles/fiveHands";
import { minigolfPuzzle } from "@/puzzles/minigolf";
import { poolPuzzle } from "@/puzzles/pool";
import { curlingPuzzle } from "@/puzzles/curling";
import { removedGameDefinition } from "@/puzzles/removedGame";
import { PINBALL_IN_ROOMS } from "@/lib/arcade/pinball";
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
import { shikakuPuzzle } from "@/puzzles/shikaku";
import { lightUpPuzzle } from "@/puzzles/lightUp";
import { wavefrontPuzzle } from "@/puzzles/wavefront";
import { bastionPuzzle } from "@/puzzles/bastion";
import { rooftopPuzzle } from "@/puzzles/rooftop";
import { flipPuzzle } from "@/puzzles/flip";
import { junctionPuzzle } from "@/puzzles/junction";
import { inkBridgePuzzle } from "@/puzzles/inkBridge";
import { burstPuzzle } from "@/puzzles/burst";
import { orbitPuzzle } from "@/puzzles/orbit";
import { swingPuzzle } from "@/puzzles/swing";
import { snipPuzzle } from "@/puzzles/snip";
import { tiltPuzzle } from "@/puzzles/tilt";
import { hotFloorPuzzle } from "@/puzzles/hotFloor";
import { ballTrackPuzzle } from "@/puzzles/ballTrack";
import { wordSearchPuzzle } from "@/puzzles/wordSearch";
import { letterWheelPuzzle } from "@/puzzles/letterWheel";
import { strikeoutPuzzle } from "@/puzzles/strikeout";
import { codewordPuzzle } from "@/puzzles/codeword";
import { swapwordPuzzle } from "@/puzzles/swapword";
import { tenDropPuzzle } from "@/puzzles/tenDrop";
import { wordfallPuzzle } from "@/puzzles/wordfall";
import { clayShootPuzzle } from "@/puzzles/clayShoot";
import { numberPyramidPuzzle } from "@/puzzles/numberPyramid";
import { trailPuzzle } from "@/puzzles/trail";
import { digPuzzle } from "@/puzzles/dig";
import { measurePuzzle } from "@/puzzles/measure";
import { checkoutPuzzle } from "@/puzzles/checkout";
import { numlinePuzzle } from "@/puzzles/numline";

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
import { gameTheme, type GameTheme } from "@/lib/fx/theme";
import { feedbackStage } from "@/components/duel/FeedbackStage";
import { removedGameName, type RemovedPuzzleType } from "./removedGames";

/** The single registry of puzzle types. Add a new type by adding one entry. */
type RegisteredPuzzleDefinition = PuzzleDefinition &
  Required<Pick<PuzzleDefinition, "roundSummary" | "correctAnswer" | "instructions" | "retired">> & { theme: GameTheme };

const LONG_REVEAL_TYPES = new Set<PuzzleType>([
  "target",
  "wordsmith",
  "wordhunt",
  "stroop",
  "spotdiff",
  "tilegrid",
]);

/** Always in the room draw. */
export const CORE_CATEGORIES: PuzzleCategory[] = ["logic", "pattern", "speed", "attention", "word"];

/** Only drawn when the host switches them on in the lobby. */
export const OPT_IN_CATEGORIES: PuzzleCategory[] = ["number"];

/** The arcade pool: one round at most, and only when the host toggle is on. */
export const ARCADE_CATEGORY: PuzzleCategory = "arcade";

/** Never drawn in rooms; still playable in practice. */
const RETIRED_TYPES = new Set<PuzzleType>([
  "rooftop",
  "swerve",
  "dual",
  "ricochet",
  "steady",
  "hotfloor",
  "dig",
  "bastion",
  // Tuning C (Oct 2026): practice only.
  "junction",
  // Scoring report batch 2 (20 Oct 2026): practice only, on its current stamps (wordfallRev 3).
  "wordfall",
  // Joe's decision (27 Oct 2026): Scrumper is practice only; stored rounds replay and grade as before.
  "snip",
  // New (13 Oct 2026): practice only until PINBALL_IN_ROOMS (src/lib/arcade/pinball.ts) is switched on.
  ...(PINBALL_IN_ROOMS ? [] : (["pinball"] as const)),
]);

/** Slack added to every arcade phase beyond its run; never shown to players. */
export const ARCADE_PHASE_SLACK_MS = 3000;

const BASE_REGISTRY: Record<PuzzleType, Omit<PuzzleDefinition, "instructions">> = {
  wordsmith: wordsmithPuzzle,
  tilegrid: tileGridPuzzle,
  wordslide: wordSlidePuzzle,
  balance: balancePuzzle,
  target: targetNumberPuzzle,
  equation: equationPuzzle,
  reaction: reactionPuzzle,
  numhunt: numberHuntPuzzle,
  stroop: stroopPuzzle,
  symscan: symbolScanPuzzle,
  spotdiff: spotDifferencePuzzle,
  stopwatch: stopWatchPuzzle,
  countup: countUpPuzzle,
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
  nonogram: nonogramPuzzle,
  pairmatch: pairMatchPuzzle,
  flood: colourFloodPuzzle,
  tiles: slidingTilesPuzzle,
  rings: rotatingRingsPuzzle,
  hover: hoverPuzzle,
  swerve: swervePuzzle,
  skyline: skylinePuzzle,
  bintoss: binTossPuzzle,
  bullseye: bullseyePuzzle,
  matchup: matchupPuzzle,
  breaker: breakerPuzzle,
  pinball: pinballPuzzle,
  // Cards & Board (30 Oct 2026): dealt in rooms from the start.
  minesweeper: minesweeperPuzzle,
  mahjong: mahjongPuzzle,
  // The Sports group (30 Oct 2026, docs/arcade-standard/homerun.md, freekick.md, racing.md).
  homerun: homerunPuzzle,
  freekick: freekickPuzzle,
  racing: racingPuzzle,
  freecell: freecellPuzzle,
  tripeaks: tripeaksPuzzle,
  pokersquares: pokerSquaresPuzzle,
  fivehands: fiveHandsPuzzle,
  minigolf: minigolfPuzzle,
  pool: poolPuzzle,
  curling: curlingPuzzle,
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
  shikaku: shikakuPuzzle,
  lightup: lightUpPuzzle,
  wavefront: wavefrontPuzzle,
  bastion: bastionPuzzle,
  rooftop: rooftopPuzzle,
  flip: flipPuzzle,
  junction: junctionPuzzle,
  inkbridge: inkBridgePuzzle,
  burst: burstPuzzle,
  orbit: orbitPuzzle,
  swing: swingPuzzle,
  snip: snipPuzzle,
  tilt: tiltPuzzle,
  hotfloor: hotFloorPuzzle,
  balltrack: ballTrackPuzzle,
  wordsearch: wordSearchPuzzle,
  letterwheel: letterWheelPuzzle,
  strikeout: strikeoutPuzzle,
  codeword: codewordPuzzle,
  swapword: swapwordPuzzle,
  tendrop: tenDropPuzzle,
  wordfall: wordfallPuzzle,
  clayshoot: clayShootPuzzle,
  numpyramid: numberPyramidPuzzle,
  dig: digPuzzle,
  trail: trailPuzzle,
  measure: measurePuzzle,
  checkout: checkoutPuzzle,
  numline: numlinePuzzle,
};

export const PUZZLE_REGISTRY = Object.fromEntries<RegisteredPuzzleDefinition>(
  Object.entries(BASE_REGISTRY).map(([type, definition]) => [
    type,
    {
      ...definition,
      theme: gameTheme(type as PuzzleType, definition.category),
      Stage: feedbackStage(definition.Stage, gameTheme(type as PuzzleType, definition.category), Boolean(definition.arcadeRun || definition.category === "arcade"), {
        type: type as PuzzleType,
        arcade: definition.category === "arcade",
        runMs: definition.category === "arcade" ? definition.timeLimitMs - ARCADE_PHASE_SLACK_MS : null,
      }),
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

/**
 * A type's definition. A deleted game's id (removedGames.ts), still held by
 * stored rounds, gets a read-only stand-in: its name and a notice, never a board.
 */
export function puzzleDef(type: PuzzleType | RemovedPuzzleType): RegisteredPuzzleDefinition {
  return PUZZLE_REGISTRY[type as PuzzleType] ?? removedDefinition(type);
}

const REMOVED_DEFINITIONS = new Map<string, RegisteredPuzzleDefinition>();

function removedDefinition(type: string): RegisteredPuzzleDefinition {
  let definition = REMOVED_DEFINITIONS.get(type);
  if (!definition) {
    const base = removedGameDefinition(type);
    definition = {
      ...base,
      theme: gameTheme(undefined, base.category),
      instructions: base.instructions!,
      retired: true,
      revealMs: REVEAL_MS,
      roundSummary: base.roundSummary!,
      correctAnswer: base.correctAnswer!,
    };
    REMOVED_DEFINITIONS.set(type, definition);
  }
  return definition;
}

/** A live type's name, or the name a deleted game had (stored history rows still carry its id). */
export function puzzleName(type: PuzzleType | RemovedPuzzleType): string {
  return PUZZLE_REGISTRY[type as PuzzleType]?.name ?? removedGameName(type) ?? type;
}

/** True for a type the app can still play, reveal and replay; false for deleted ids in stored rounds. */
export function isLiveType(type: unknown): type is PuzzleType {
  return typeof type === "string" && Object.prototype.hasOwnProperty.call(PUZZLE_REGISTRY, type);
}

/** True for types kept only for practice. */
export function isRetired(type: PuzzleType): boolean {
  return PUZZLE_REGISTRY[type]?.retired === true;
}

/** Every type still in rotation. */
export const ACTIVE_PUZZLE_TYPES = PUZZLE_TYPES.filter((t) => !isRetired(t));

export const RETIRED_PUZZLE_TYPES = PUZZLE_TYPES.filter((t) => isRetired(t));

/**
 * New games that rooms do not deal yet, listed on their own in practice (not
 * under Retired): Pinball until PINBALL_IN_ROOMS. They are also in
 * RETIRED_PUZZLE_TYPES, which is what keeps them out of room draws.
 */
export const PREVIEW_PUZZLE_TYPES: PuzzleType[] = PINBALL_IN_ROOMS ? [] : ["pinball"];

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

/** Live game counts for marketing lines: non-retired core/opt-in types vs arcade types. */
export function gameCounts(): { puzzle: number; arcade: number } {
  const puzzle = [...CORE_CATEGORIES, ...OPT_IN_CATEGORIES].reduce((n, c) => n + typesInCategory(c).length, 0);
  return { puzzle, arcade: typesInCategory(ARCADE_CATEGORY).length };
}
