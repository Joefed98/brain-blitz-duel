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
import { pyramidPuzzle } from "@/puzzles/pyramid";
import { golfSolPuzzle } from "@/puzzles/golfSol";
import { mugginsPuzzle } from "@/puzzles/muggins";
import { minigolfPuzzle } from "@/puzzles/minigolf";
import { poolPuzzle } from "@/puzzles/pool";
import { curlingPuzzle } from "@/puzzles/curling";
import { blockfallPuzzle } from "@/puzzles/blockfall";
import { alleyRollPuzzle } from "@/puzzles/alleyroll";
import { removedGameDefinition } from "@/puzzles/removedGame";
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
import { fencesPuzzle } from "@/puzzles/fences";
import { fillominoPuzzle } from "@/puzzles/fillomino";
import { bridgesPuzzle } from "@/puzzles/bridges";
import { kakuroPuzzle } from "@/puzzles/kakuro";

import type { PuzzleDefinition } from "@/puzzles/types";

import type { PuzzleType } from "./types";
import { CORRECT_ANSWERS, ROUND_SUMMARIES } from "./roundSummaries";
import { type RemovedPuzzleType } from "./removedGames";
import { registerDefinition, removedDefinition, type LoadedPuzzleDefinition } from "./registerDefinition";

/*
 * The full registry: every game's definition, Stage, Reveal and summaries. Since speed fix 1 (Nov 2026)
 * only the server and the checks import it; the phone reads `catalogue.ts` (names, categories, clocks)
 * and loads one game's code at a time through `gameLoader.ts`. Every helper below comes from the
 * catalogue, so both read the same values (game-catalogue-check).
 */
export * from "./catalogue";

/** The single registry of puzzle types. Add a new type by adding one entry (then run scripts/game-catalogue.ts). */
type RegisteredPuzzleDefinition = LoadedPuzzleDefinition &
  Required<Pick<PuzzleDefinition, "roundSummary" | "correctAnswer">>;

export const BASE_REGISTRY: Record<PuzzleType, Omit<PuzzleDefinition, "instructions">> = {
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
  pyramid: pyramidPuzzle,
  golfsol: golfSolPuzzle,
  muggins: mugginsPuzzle,
  minigolf: minigolfPuzzle,
  pool: poolPuzzle,
  curling: curlingPuzzle,
  // Blockfall (Retro) and Alley Roll (Sports), 1 Nov 2026: born on the arcade standard (docs/arcade-standard/blockfall.md, alleyroll.md).
  blockfall: blockfallPuzzle,
  alleyroll: alleyRollPuzzle,
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
  // New grid puzzles (1 Nov 2026), born on the scoring standard.
  fences: fencesPuzzle,
  fillomino: fillominoPuzzle,
  bridges: bridgesPuzzle,
  kakuro: kakuroPuzzle,
};

export const PUZZLE_REGISTRY = Object.fromEntries<RegisteredPuzzleDefinition>(
  Object.entries(BASE_REGISTRY).map(([type, definition]) => [
    type,
    // Object.assign keeps the definition's name read through its catalogue line (registerDefinition).
    Object.assign(registerDefinition(type as PuzzleType, definition), {
      roundSummary: ROUND_SUMMARIES[type as PuzzleType],
      correctAnswer: CORRECT_ANSWERS[type as PuzzleType],
    }),
  ]),
) as Record<PuzzleType, RegisteredPuzzleDefinition>;

/**
 * A type's definition. A deleted game's id (removedGames.ts), still held by
 * stored rounds, gets a read-only stand-in: its name and a notice, never a board.
 */
export function puzzleDef(type: PuzzleType | RemovedPuzzleType): RegisteredPuzzleDefinition {
  return PUZZLE_REGISTRY[type as PuzzleType] ?? (removedDefinition(type) as RegisteredPuzzleDefinition);
}
