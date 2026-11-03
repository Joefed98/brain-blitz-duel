import { buildArcadeReveal } from "@/lib/arcade/reveal";
import { TICKS_PER_SECOND } from "@/lib/arcade/engine";
import { puzzleUsesTieRev } from "./tieBreak";
import { isRemovedType } from "./removedGames";
import { ACTION_LOG_ANSWER_CAP, usesActionLog, type ActionLogDiag } from "./actionLog";
import { replayLaserLog } from "./laserLog";
import { ARCADE_DIAG_KEYS, buildArcadeDiag, type ArcadeDiag } from "@/lib/arcade/diagnostics";
import {
  STAGE_COUNT,
  equationStageCorrect,
  parseCount,
  parseSelection,
  scanStageResult,
  scoreCountUpStages,
  scoreEquationStages,
  scoreSymbolScanStages,
  splitStages,
} from "./stagedRounds";
import { blockGeometry, decodePlacements, encodePlacements, verifyPlacements } from "./blockParty";
import { isDepth4 } from "./depth4/stamps";
import { decodePipesTaps, pipesAfterTaps } from "./depth4/pipesTaps";
import { replayGems } from "./depth4/iceGems";
import { gemMinMoves } from "./depth4/gems.server";
import { activeLightPresses, decodePresses, decodeSides, lightsAllOff, lightsOnCount, replayLights } from "./logic";
import { gradePipesBoard, gradeSudokuGrid } from "./logic.server";
import { decodeFlowPaths, verifyFlow } from "./flow";
import { decodeSlideMoves, replaySlide, slideBoard, slideDistance } from "./slide";
import { cratesOnTargets, decodePushMoves, replayPush } from "./push";
import { decodeLaserAnswer, isSplitter, verifyLaser } from "./laser";
import { decodeTowerMoves, replayTower } from "./tower";
import { decodeMazePath, mazeColsOf, verifyMazePath } from "./maze";
import { decodeMazeTrail, mazeStarsTaken, mazeTrailBacktracks, mazeTrailRoute, mazeTrailWalk, usesMazeDepth } from "./depth/labyrinth";
import { decodeTubeLog, decodeTubeMoves, replayTubeLog, replayTubes } from "./tubes";
import { dialsCorrect, decodeSafePending, decodeSafeTries, safeOpenedOn } from "./safe";
import { checkBombPlan, decodeBombActions, decodeBombConstraints } from "./bomb";
import { decodeGravityTilts, replayGravity } from "./gravity";
import { blockingCars } from "./unblock.server";
import { decodeChainAnswer, replayChain } from "./chain";
import { decodeNonoCells, nonoSizeOf, replayNonogram } from "./nonogram";
import { decodePairFlips, replayPairs } from "./pairmatch";
import { decodeFloodMoves, replayFlood } from "./flood";
import { decodeTileMoves, replayTiles, tilesLayout } from "./tiles";
import { decodeRingTaps, replayRings } from "./rings";
import { decodeHoverRun, replayHoverRun } from "./hover";
import { decodeSwerveRun, replaySwerveRun } from "./swerve";
import { decodeSkylineRun, replaySkylineRun } from "./skyline";
import { SKYLINE_REV_EXPAND, SKYLINE_REV_LIFT, SKYLINE_REV_STD } from "@/lib/arcade/skyline";
import { pinIsExpanded, PIN_REV_STD } from "@/lib/arcade/pinball";
import { decodeSnakeRun, replaySnakeRun } from "./snake";
import { snakeStdParts } from "@/lib/arcade/snake";
import { decodeBreakerRun, replayBreakerRun } from "./breaker";
import { breakerStdParts, brkSkillPaid, brkWallSize } from "@/lib/arcade/breaker";
import { hoverFeatureBonus, hoverStandardParts } from "@/lib/arcade/hover";
import { decodePinballRun, replayPinballRun } from "./pinball";
import { decodeMinesweeperRun, replayMinesweeperRun } from "./minesweeper";
import { decodeMahjongRun, replayMahjongRun } from "./mahjong";
import { MINES_SAFE } from "@/lib/arcade/minesweeper";
import { decodeHomerunRun, replayHomerunRun } from "./homerun";
import { decodeFreekickRun, replayFreekickRun } from "./freekick";
import { decodeRacingRun, replayRacingRun } from "./racing";
import type { StdPart } from "@/lib/arcade/arcadeStandard";
import { replayMinigolfRun } from "./minigolf";
import { replayPoolRun } from "./pool";
import { replayCurlingRun } from "./curling";
import { minigolfStdParts } from "@/lib/arcade/minigolf";
import { poolStdParts } from "@/lib/arcade/pool";
import { curlingStdParts } from "@/lib/arcade/curling";
import { decodeRallyRun, replayRallyRun } from "./rally";
import { rallyBonusCount, rallyBonusPoints, rallyBonusPtsOf, RALLY_V12_EXP } from "@/lib/arcade/rally";
import { decodeSteadyRun, replaySteadyRun } from "./steady";
import { decodeSliceRun, replaySliceRun } from "./slice";
import { decodeBubbleRun, replayBubbleRun } from "./bubble";
import { decodeBeatRun, replayBeatRun } from "./beat";
import { beatAccuracy, beatFeatureCounts } from "@/lib/arcade/beat";
import { decodeWhackRun, replayWhackRun, whackDepthDetail } from "./whack";
import { decodeTenDropRun, replayTenDropRun } from "./tenDrop";
import { decodeWordfallRun, replayWordfallRun } from "./wordfall";
import { ensureWordfallDict } from "./wordfallDict.server";
import { clayDepthDetail, decodeClayRun, replayClayRun } from "./clayShoot";
import { clayChargesEmptyShots, clayEmptyShotCost, clayEmptyShots } from "@/lib/arcade/clayShoot";
import { decodeWavefrontRun, replayWavefrontRun } from "./wavefront";
import { decodeBastionRun, decodeBastionTankRun, isBastionTank, replayBastionRun, replayBastionTankRun } from "./bastion";
import { decodeRooftopRun, replayRooftopRun } from "./rooftop";
import { decodeFlipRun, replayFlipRun } from "./flip";
import {
  decodeFiveHandsRun, decodeFreecellRun, decodePokerSquaresRun, decodeTripeaksRun, replayFiveHandsRun, replayFreecellRun, replayPokerSquaresRun, replayTripeaksRun,
  decodeGolfSolRun, decodeMugginsRun, decodePyramidRun, replayGolfSolRun, replayMugginsRun, replayPyramidRun,
} from "./cards";
import { decodeBlockfallRun, replayBlockfallRun } from "./blockfall";
import { decodeAlleyRollRun, replayAlleyRollRun } from "./alleyroll";
import { decodeJunctionRun, replayJunctionRun } from "./junction";
import { decodeInkBridgeRun, replayInkBridgeRun } from "./inkBridge";
import { decodeBurstRun, replayBurstRun } from "./burst";
import { burstCarryBonus, burstCleanBonus, burstGoldenCount, burstStdParts, BURST_V10_GOLDENS } from "@/lib/arcade/burst";
import { decodeOrbitRun, replayOrbitRun } from "./orbit";
import { decodeSwingRun, replaySwingRun } from "./swing";
import { SWING_REV, SWING_REV_BAND, SWING_REV_TUNED, SWING_REV_TUNEC, SWING_REV_SPREAD, SWING_REV_TALL, SWING_REV_TARGET, SWING_REV_STRICT, SWING_REV_EXPAND, swingFeaturePoints, swingAssaultCounts, swingBandPartsV14, swingReworkParts } from "@/lib/arcade/swing";
import { decodeSnipRun, replaySnipRun } from "./snip";
import { snipFeatureBonus, SNIP_REV_EXPAND, SNIP_X_MAX } from "@/lib/arcade/snip";
import { decodeTiltRun, replayTiltRun } from "./tilt";
import { tiltIsExpand } from "@/lib/arcade/tilt";
import { decodeHotFloorRun, replayHotFloorRun } from "./hotFloor";
import { replayColourClashRun } from "./colourClash";
import { clashRev4Finished, clashVariantOf, CLASH_REV, CLASH_REV_TALL, CLASH_REV_BANDS, CLASH_REV_GREAT } from "@/lib/arcade/colourClash";
import { decodeTents, scoreTents, tentsHeightOf, tentsLayoutValid } from "./tents";
import { gradeGridPuzzle } from "./gridPuzzles";
import { acceptedRects, decodeShikaku, scoreShikaku, shikakuCovered, shikakuHeightOf } from "./shikaku";
import { decodeBulbs, lightUpStatus, scoreLightUp } from "./lightUp";
import { decodeBallTrackRun, replayBallTrackRun } from "./ballTrack";
import { scoreTrail, trComplete, trCorrectPrefix, trCorrectTiles, trDecode } from "./trail";
import { npComplete, npCorrectCells, npDecode, npDecodeRound, scoreNumberPyramid } from "./numberPyramid";
import { gradeMeasureBoards, scoreMeasure } from "./measure";
import { gradeCheckoutStages, scoreCheckout } from "./checkout";
import { gradeNumlineItems, numlineAccuracy, numlineFullError, scoreNumline } from "./numline";
import { digCleanCollected, digDecode, digReplay, scoreDig } from "./dig";
import { scoreWordSearch, wsDecode, wsGrade, wsSplitBonus } from "./wordSearch";
import { LW_FREE_MISSES, lwDecode, lwDecodeLog, lwGrade, lwTallyLog, lwUsesLog, scoreLetterWheel, scoreLetterWheelLog } from "./letterWheel";
import { decodeCrossRun, replayCrossRun } from "./cross";
import { decodeDualRun, replayDualRun } from "./dual";
import { decodeNinjaRun, decodeRicoRun, isNinjaRev, replayNinjaRun, replayRicoRun } from "./ricochet";
import { NINJA_CORE_FULL_M } from "@/lib/arcade/ricochetNinja";
import { decodeBinTossRun, replayBinTossRun } from "./binToss";
import { decodeBullseyeRun, replayBullseyeRun } from "./bullseye";
import { bullseyeDeadPoints, bullseyeStreakPoints } from "@/lib/arcade/bullseye";
import { decodeMatchupRun, replayMatchupRun } from "./matchup";

import { decodeTileGrid, scoreTileGrid } from "./tileGrid";
import { judgeTileGrid } from "./tileGrid.server";
import { balanceRoundScore, balanceScaleCount, balanceScalesSolved, balanceSolvedCount, decodeBalance } from "./balance";
import { decodeSlideTokens, markedRowWord, WS_MARKED_ROWS } from "./wordSlide";
import { checkWordSlideRow, markedRowsSolved, replayWordSlideFor } from "./wordSlide.server";
import { checkAnswer } from "./puzzles";
import {
  TAP_LOG_ANSWER_CAP,
  decodeNumberTaps,
  decodeTapTimes,
  replayAscend,
  replayBangOn,
  replayFlash,
  usesTapLog,
  tapRevOf,
  type TapLogDiag,
} from "./tapLog";
import { decodeMoves, replayUnblock } from "./unblock";
import {
  COUNT_REV2_TRAYS,
  countUpStageTruth,
  scanRev1StageResult,
  scanStageMatches,
  scoreCountRev2,
  scoreScanRev1,
  scoreSpotTwo,
  spotTwoResult,
  usesCountRev2,
  usesScanRev1,
  usesSpotRev1,
  parseSpotTaps,
  SPOT_REV1_SCENES,
} from "./attentionRev";
import { scanCorrections, usesScanDepth } from "./depth/eagleEye";
import { spotBonusFound, usesSpotDepth } from "./depth/doubleTake";
import { puzzleTimeLimitMs } from "./registry";
import { PUZZLE_SCORE_REV, puzzleScoreRevOf, recordParts, scoreRev1, takeScoreParts, wasteFactor, withPuzzleScoreRev } from "./puzzleScoreRev";
import { isTopsy, replayTopsyPuzzle, scoreTopsy } from "./topsy";
import { isJumbledGradient, replayGradientAnswer, scoreJumbled } from "./jumbled";
import { sortedTubeCount } from "./tubes";
import { madeDistance } from "./target";
import { isWord } from "./dictionary.server";
import {
  STRIKEOUT_REV2,
  decodeStrikeout,
  decodeStrikeout2,
  encodeStrikeout,
  encodeStrikeout2,
  replayStrikeout,
  replayStrikeout2,
  scoreStrikeout,
  scoreStrikeout2,
  so2Rules,
  so2Tally,
  soTally,
  strikeoutRevOf,
} from "./strikeout";
import { codewordTally, decodeCodeword, replayCodeword, scoreCodeword } from "./codeword";
import { decodeSwapword, replaySwapword, scoreSwapword } from "./swapword";
import {
  blockPartyCounts,
  flowRouteCounts,
  lightUpBulbCounts,
  shikakuAreas,
  swapwordCounts,
  tilesCounts,
  wordSlideMadeRows,
} from "./progressFigures";
import { decodeSteps, formatStep, replayTargetSteps } from "./target";
import { balancePlaceLimits, equationTryLimit, floodMoveLimit, gravityTiltLimit, measureMoveLimits, splitCountSuffix, tubesPourLimit, tubesSendsUndo, GRAVITY_PROGRESS_REV, TUBES_PROGRESS_REV } from "./moveLimits";
import { gravitySolverProgress, tubesSolverProgress } from "./solverProgress.server";
import {
  scoreWordSlide,
  wordSpeedBonus,
  scoreNumberHunt,
  scoreReaction,
  reactionFalseStartCost,
  STOPWATCH_REV2_KNEE_MS,
  STOPWATCH_REV2_ZERO_MS,
  scoreRound,
  scoreSpotDifference,
  SPOT_REV1_WRONG_LIMIT,
  scoreStopWatch,
  scoreBlockParty,
  scoreUnblock,
  scoreTargetNumber,
  scoreLightsOut,
  scorePipes,
  scoreSudoku,
  scoreFlow,
  scoreIceSlide,
  scorePush,
  scoreLaser,
  scoreTower,
  scoreMaze,
  scoreTubes,
  scoreSafe,
  scoreBomb,
  scoreGravity,
  scoreChain,
  scoreNonogram,
  scorePairMatch,
  scoreFlood,
  scoreTiles,
  scoreRings,
} from "./scoring";
import {
  BOMB_V2,
  NUMHUNT_COUNT,
  REACTION_MISS_MS,
  ROUND_MS,
  SPOT_DIFFERENCES,
  STOPWATCH_ATTEMPTS,
  STOPWATCH_MISS_MS,
  FLOW_PAIRS,
  CHAIN_TIME_MS,
  CHAIN_TIME_REV,
  type PuzzleData,
} from "./types";

export interface SubmitExtra {
  reactionAvgMs?: number | undefined;
  correctCount?: number | undefined;
  errors?: number | undefined;
}

export interface Graded {
  answer: string;
  isCorrect: boolean;
  score: number;
  reactionAvgMs: number | null;
  correctCount: number | null;
  errors: number | null;
  /** Per-type detail stored on the round (Target Number: value reached + steps). */
  extra: Record<string, unknown> | null;
  storedMs: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Network allowance between a player's tap and the server receiving it. */
export const TIME_CLAIM_TOLERANCE_MS = 1_500;

/**
 * The phone times its own tap against the shared round start, which is the only
 * fair measure. The server keeps that figure unless it is impossible — more
 * time left than the server's own receipt time allows, network grace included.
 */
export function trustedMsRemaining(
  claimedMs: number,
  serverMsRemaining: number,
  timeLimitMs: number,
): { ms: number; clamped: boolean } {
  const claim = Number(claimedMs);
  const bounded = Number.isFinite(claim) ? clamp(claim, 0, timeLimitMs) : 0;
  const ceiling = clamp(serverMsRemaining, 0, timeLimitMs) + TIME_CLAIM_TOLERANCE_MS;
  if (bounded > ceiling) return { ms: clamp(serverMsRemaining, 0, timeLimitMs), clamped: true };
  return { ms: bounded, clamped: false };
}

/**
 * The last round-clock ms a tap-log tap may carry: the end of the round, or,
 * in a room, the moment the server received the log plus the same network
 * allowance as the time-left check. A tap the phone claims after that never
 * happened before the answer was sent.
 */
export function latestTapMs(timeLimitMs: number, receivedMsRemaining?: number): number {
  if (receivedMsRemaining === undefined || !Number.isFinite(receivedMsRemaining)) return timeLimitMs;
  return Math.min(timeLimitMs, Math.round(timeLimitMs - receivedMsRemaining) + TIME_CLAIM_TOLERANCE_MS);
}

function actionLogDetail(diag: ActionLogDiag): Record<string, unknown> {
  return {
    actions: diag.received,
    repaired: diag.clamped + diag.dropped,
    clamped: diag.clamped,
    dropped: diag.dropped,
    ...(diag.first ? { reason: diag.first } : {}),
  };
}

function tapLogDetail(diag: TapLogDiag): Record<string, unknown> {
  return {
    taps: diag.received,
    repaired: diag.clamped + diag.dropped,
    clamped: diag.clamped,
    dropped: diag.dropped,
    ...(diag.first ? { reason: diag.first } : {}),
  };
}

/**
 * The single place an answer is checked and scored. Runs on the server only —
 * for real rooms (submit_answer) and for practice mode alike.
 * `receivedMsRemaining` is the server's own time left when the answer arrived
 * (rooms only); tap logs may not carry taps after it, network grace included.
 */
export function gradeSubmission(
  puzzle: PuzzleData,
  rawAnswer: string,
  msRemaining: number,
  rawExtra?: SubmitExtra,
  receivedMsRemaining?: number,
): Graded {
  // A deleted game (removedGames.ts) has no grader left: nothing is scored for it.
  if (isRemovedType(puzzle.type)) return gradeRemoved(rawAnswer);
  // The score shape follows the stored stamp (puzzleScoreRev.ts); unstamped rounds grade as they always did.
  const rev = puzzleScoreRevOf(puzzle);
  return withPuzzleScoreRev(rev, () => {
    takeScoreParts();
    const graded = gradeUnderRev(puzzle, rawAnswer, msRemaining, rawExtra, receivedMsRemaining);
    const parts = takeScoreParts();
    if (rev >= PUZZLE_SCORE_REV && parts) graded.extra = { ...(graded.extra ?? {}), parts };
    return graded;
  });
}

/**
 * A submission that still arrives for a deleted game (a room dealt before the
 * deletion) is stored as an unscored answer, so the room can move on. Stored
 * rounds of these games are never graded again (`scoreStoredRound`).
 */
export function gradeRemoved(rawAnswer: string): Graded {
  const answer = typeof rawAnswer === "string" ? rawAnswer.slice(0, 4_000) : "";
  return { answer, isCorrect: false, score: 0, reactionAvgMs: null, correctCount: null, errors: null, extra: { removed: true }, storedMs: 0 };
}

function gradeUnderRev(
  puzzle: PuzzleData,
  rawAnswer: string,
  msRemaining: number,
  rawExtra?: SubmitExtra,
  receivedMsRemaining?: number,
): Graded {
  const extra = rawExtra ?? {};
  const tapLog = usesTapLog(puzzle);
  const actionLog = usesActionLog(puzzle);
  // Arcade runs carry a full input log (one event a tick at most), so they get a
  // far larger allowance; cutting a log short silently changes the replay.
  // Mixed Signals is an engine run too (fixed 19 Oct 2026): at 4,000 characters a busy run lost its last inputs, and a cut
  // inside its end tick replayed only a few ticks (close to 0). Stored answers were already cut there, so none regrades.
  const answerCap = ARCADE_DIAG_KEYS.has(puzzle.type) || puzzle.type === "stroop" ? 400_000 : tapLog ? TAP_LOG_ANSWER_CAP : actionLog ? ACTION_LOG_ANSWER_CAP : 4_000;
  const answer = typeof rawAnswer === "string" ? rawAnswer.slice(0, answerCap) : "";
  let arcadeDiag: ArcadeDiag | null = null;
  /** The server replay result, for the stored arcade reveal summary. */
  let revealRun: unknown = null;
  const timeLimitMs = puzzleTimeLimitMs(puzzle);
  const ms = clamp(msRemaining, 0, timeLimitMs);

  let isCorrect = false;
  let score = 0;
  let reactionAvgMs: number | null = null;
  let correctCount: number | null = null;
  let errors: number | null = null;
  let extraDetail: Record<string, unknown> | null = null;
  let storedMs = ms;
  /** Strikeout stores its canonical action list (rejected solves dropped) so the reveal replays it exactly. */
  let storedAnswer: string | null = null;

  switch (puzzle.type) {
    case "tilegrid": {
      // The placed grid is re-checked against the tray and the dictionary here.
      const verdict = judgeTileGrid(decodeTileGrid(answer), puzzle.tray);
      // puzzleScoreRev 3: a finish needs every tile of the tray in the grid (a short valid grid is progress).
      isCorrect = verdict.valid && (puzzleScoreRevOf(puzzle) < 3 || verdict.placed === puzzle.tray.length);
      correctCount = verdict.placed;
      score = scoreTileGrid(verdict.valid, verdict.placed, verdict.wordTiles, wordSpeedBonus(ms, timeLimitMs, scoreRev1() ? 30 : 20));
      extraDetail = { placed: verdict.placed, valid: verdict.valid, wordTiles: verdict.wordTiles };
      break;
    }
    case "balance": {
      // The server recomputes every torque; any balanced arrangement counts.
      // balanceRev 1: the answer ends "#h1,h2,h3", the phone's hang count per scale; a scale hung more
      // often than its stored limit does not count (the counts are the phone's word: moveLimits.ts).
      const placeLimits = balancePlaceLimits(puzzle);
      const { body, counts: hangs } = placeLimits ? splitCountSuffix(answer) : { body: answer, counts: [] };
      const placements = decodeBalance(body, puzzle.scales);
      const withinLimit = (s: number) => !placeLimits || (hangs[s] ?? 0) <= (placeLimits[s] ?? 0);
      const verdicts = balanceScalesSolved(puzzle.scales, placements).map((ok, s) => ok && withinLimit(s));
      // balanceRev 2 deals four scales (the fourth with 10 notches, 120 s on the puzzle); stored rounds three.
      const total = balanceScaleCount(puzzle);
      const firstOpen = verdicts.indexOf(false);
      const solved = placeLimits ? (firstOpen < 0 ? total : firstOpen) : balanceSolvedCount(puzzle.scales, placements);
      // Rev 1 credits every balanced scale in any order.
      const scales = scoreRev1() ? verdicts : undefined;
      correctCount = scales ? scales.filter(Boolean).length : solved;
      isCorrect = scales ? correctCount === total : solved === total;
      score = balanceRoundScore(solved, ms, timeLimitMs, scales);
      extraDetail = scales ? { solved, scales, ...(placeLimits ? { hangs: puzzle.scales.map((_, s) => hangs[s] ?? 0), placeLimits } : {}) } : { solved };
      break;
    }
    case "wordslide": {
      // Every swipe, Undo and Reset is replayed on the stored grid.
      const replay = replayWordSlideFor(puzzle, decodeSlideTokens(answer));
      const rows = markedRowsSolved(replay.grid);
      isCorrect = rows === WS_MARKED_ROWS.length;
      correctCount = rows;
      // Rev 1: an unfinished grid earns only the word rows the player made (a row still as it started is not counted).
      const validRows = WS_MARKED_ROWS.filter((r) => checkWordSlideRow(markedRowWord(replay.grid, r)).valid);
      const madeRows = scoreRev1() && !isCorrect ? wordSlideMadeRows(puzzle.grid, replay.grid, validRows) : rows;
      score = scoreWordSlide(madeRows, WS_MARKED_ROWS.length, ms, timeLimitMs, replay.moves, puzzle.par);
      extraDetail = { solved: isCorrect, moves: replay.moves, par: puzzle.par, rows, validRows };
      break;
    }
    case "reaction": {
      if (tapLog) {
        // Every reaction and false start is worked out from the raw taps against
        // the stored flash schedule.
        const { times, diag } = decodeTapTimes(answer, latestTapMs(timeLimitMs, receivedMsRemaining));
        const replay = replayFlash(puzzle, times, timeLimitMs);
        const flashCount = puzzle.flashes.length;
        const total = replay.times.map((v) => (v === null ? REACTION_MISS_MS : clamp(v, 1, REACTION_MISS_MS)));
        const falseStarts = clamp(replay.falseStarts, 0, 99);
        reactionAvgMs = Math.round(total.reduce((sum, v) => sum + v, 0) / Math.max(1, flashCount));
        isCorrect = true;
        errors = falseStarts;
        const tapRev = tapRevOf(puzzle);
        score = scoreReaction(reactionAvgMs, falseStarts, tapRev);
        storedMs = 0;
        extraDetail = {
          times: total,
          falseStarts,
          misses: total.filter((v) => v >= REACTION_MISS_MS).length,
          // tapRev 2: the stored false-start cost, so the reveal never recomputes it.
          ...(tapRev >= 2 ? { falseStartCost: reactionFalseStartCost(falseStarts, tapRev) } : {}),
          ...tapLogDetail(diag),
        };
        break;
      }
      const [timesPart = "", falsePart = "0"] = answer.split("|");
      const flashCount = puzzle.flashes.length;
      const attempts = timesPart.split(",").slice(0, flashCount).map((value) => Number.parseInt(value, 10));
      const total = Array.from({ length: flashCount }, (_, index) => {
        const attempt = attempts[index];
        return attempt === undefined || !Number.isFinite(attempt)
          ? REACTION_MISS_MS
          : clamp(attempt, 1, REACTION_MISS_MS);
      });
      const parsedFalse = Number.parseInt(falsePart, 10);
      const falseStarts = Number.isFinite(parsedFalse) ? clamp(parsedFalse, 0, 99) : 0;
      reactionAvgMs = Math.round(total.reduce((sum, attempt) => sum + attempt, 0) / Math.max(1, flashCount));
      isCorrect = true;
      errors = falseStarts;
      score = scoreReaction(reactionAvgMs, falseStarts);
      storedMs = 0;
      break;
    }
    case "stroop": {
      const replay = replayColourClashRun(puzzle.seed, answer, clashVariantOf(puzzle));
      revealRun = replay;
      correctCount = replay.correct;
      // clashRev 4–7: a finish allows up to CLASH_REV4_MAX_WRONG wrong gates; older rounds need every word right.
      // clashRev 8 (depth to 200): its own finish (one more wrong word allowed for the "don't sort" words).
      isCorrect = replay.depth ? replay.depth.finished : puzzle.clashRev === CLASH_REV || puzzle.clashRev === CLASH_REV_TALL || puzzle.clashRev === CLASH_REV_BANDS || puzzle.clashRev === CLASH_REV_GREAT
        ? clashRev4Finished(replay.correct, replay.wrong, replay.total, replay.state.finishTick)
        : replay.correct >= replay.total;
      score = replay.score;
      // Tie-break rooms store the real finishing time, from the sim's finishing
      // tick (held to the time left the receipt check allows); an unfinished run
      // used the whole run. Older rounds stored 0.
      const finishTick = replay.state.finishTick;
      storedMs =
        puzzleUsesTieRev(puzzle) && replay.finished && finishTick > 0
          ? Math.min(ms, clamp(timeLimitMs - (finishTick * 1000) / TICKS_PER_SECOND, 0, timeLimitMs))
          : 0;
      extraDetail = { wrong: replay.wrong, missed: replay.missed, total: replay.total };
      // clashRev 8: the score's parts and the streak / gold / "don't sort" counts, for the reveal.
      if (replay.depth) {
        const d = replay.depth;
        // clashRev 10 (the scoring standard): `standard` marks the standard's parts (base 150 or the share, stretch = speed).
        extraDetail = { ...extraDetail, depth: { base: d.base, gold: d.gold, streak: d.streak, stretch: d.stretch, best: d.best, golds: d.golds, goldWords: d.goldWords, touched: d.touched, passed: d.passed, skips: d.skips, ...(d.standard ? { standard: 1 } : {}) } };
      }
      break;
    }
    case "spotdiff": {
      if (usesSpotRev1(puzzle)) {
        // spotRev 1: two pictures, "cells|cells"; a finish needs all twelve and at most 5 wrong taps in each picture.
        const result = spotTwoResult(puzzle, answer);
        correctCount = result.found.reduce((a, b) => a + b, 0);
        errors = result.wrong.reduce((a, b) => a + b, 0);
        isCorrect = result.finished;
        score = scoreSpotTwo(result, ms, timeLimitMs);
        extraDetail = { found: result.found, wrong: result.wrong };
        // spotRev 2: whether the hidden seventh difference was tapped (scored by depth/doubleTake.server.ts).
        if (usesSpotDepth(puzzle)) extraDetail["hiddenFound"] = spotBonusFound(puzzle, parseSpotTaps(answer, SPOT_REV1_SCENES));
        break;
      }
      // The phone sends every cell it tapped; the six differences live
      // server-side, so only the stored answers decide the score.
      const tapped = answer
        .split(",")
        .map((v) => Number.parseInt(v, 10))
        .filter((v) => Number.isFinite(v));
      const differences = puzzle.differences ?? [];
      correctCount = differences.filter((d) => d.cells.some((c) => tapped.includes(c))).length;
      const diffCells = new Set(differences.flatMap((d) => d.cells));
      const wrongTaps = new Set(tapped.filter((c) => !diffCells.has(c))).size;
      score = scoreSpotDifference(correctCount, ms, timeLimitMs, wrongTaps);
      // Rev 1: all six with more than SPOT_REV1_WRONG_LIMIT wrong taps is not a finish.
      isCorrect = correctCount >= SPOT_DIFFERENCES && (!scoreRev1() || wrongTaps <= SPOT_REV1_WRONG_LIMIT);
      if (scoreRev1()) errors = wrongTaps;
      break;
    }
    case "symscan": {
      if (usesScanRev1(puzzle)) {
        // scanRev 1: grid 3 counts eagles facing either target; truth comes from the stored cells.
        const parts = splitStages(answer);
        const results = puzzle.stages.map((stage, i) => scanRev1StageResult(i, parseSelection(parts[i] ?? ""), scanStageMatches(stage)));
        correctCount = results.filter((r) => r.perfect).length;
        errors = results.reduce((sum, r) => sum + r.wrong, 0);
        isCorrect = correctCount === STAGE_COUNT;
        score = scoreScanRev1(results, ms, timeLimitMs);
        // scanRev 2: taps taken back, the phone's count (scored by depth/eagleEye.server.ts).
        if (usesScanDepth(puzzle)) extraDetail = { corrections: scanCorrections(answer) };
        break;
      }
      const parts = splitStages(answer);
      const results = puzzle.stages.map((_, i) =>
        scanStageResult(i, parseSelection(parts[i] ?? ""), puzzle.targets?.[i] ?? []),
      );
      correctCount = results.filter((r) => r.perfect).length;
      errors = results.reduce((sum, r) => sum + r.wrong, 0);
      isCorrect = correctCount === STAGE_COUNT;
      score = scoreSymbolScanStages(results, ms, timeLimitMs);
      break;
    }
    case "stopwatch": {
      if (tapLog) {
        // The server places the marker and the target at every tap from the
        // stored watch specs on the fixed schedule.
        const { times, diag } = decodeTapTimes(answer, latestTapMs(timeLimitMs, receivedMsRemaining));
        const replay = replayBangOn(puzzle.watches, times, timeLimitMs);
        const total = Array.from({ length: STOPWATCH_ATTEMPTS }, (_, index) => {
          const distance = replay.results[index]?.distance;
          return distance === undefined || distance === null ? STOPWATCH_MISS_MS : clamp(distance, 0, STOPWATCH_MISS_MS);
        });
        reactionAvgMs = Math.round(total.reduce((a, b) => a + b, 0) / STOPWATCH_ATTEMPTS);
        isCorrect = true;
        const tapRev = tapRevOf(puzzle);
        score = scoreStopWatch(reactionAvgMs, tapRev);
        storedMs = 0;
        extraDetail = {
          distances: total,
          signed: replay.results.map((r) => r.signed),
          // tapRev 2: the curve this round was scored on, for the reveal.
          ...(tapRev >= 2 ? { averageMs: reactionAvgMs, kneeMs: STOPWATCH_REV2_KNEE_MS, zeroMs: STOPWATCH_REV2_ZERO_MS } : {}),
          ...tapLogDetail(diag),
        };
        break;
      }
      const distances = answer.split(",").slice(0, STOPWATCH_ATTEMPTS).map((v) => Number.parseInt(v, 10));
      const total = Array.from({ length: STOPWATCH_ATTEMPTS }, (_, index) => {
        const distance = distances[index];
        return distance === undefined || !Number.isFinite(distance)
          ? STOPWATCH_MISS_MS
          : clamp(distance, 0, STOPWATCH_MISS_MS);
      });
      reactionAvgMs = Math.round(total.reduce((a, b) => a + b, 0) / STOPWATCH_ATTEMPTS);
      isCorrect = true;
      score = scoreStopWatch(reactionAvgMs);
      storedMs = 0;
      break;
    }
    case "numhunt": {
      if (tapLog) {
        // Every tap is checked against the layout on screen at its time; the
        // count reached, the wrong taps and the finish time all come from the log.
        const { taps, diag } = decodeNumberTaps(answer, latestTapMs(timeLimitMs, receivedMsRemaining), puzzle);
        const replay = replayAscend(puzzle, taps);
        const reached = clamp(replay.reached, 0, NUMHUNT_COUNT);
        errors = clamp(replay.errors, 0, 99);
        const finished = reached >= NUMHUNT_COUNT && replay.finishedAt !== null;
        // Time left is the phone's claim (already held to the receipt check), but
        // never more than the log's own finishing tap allows. An unfinished run
        // has no time left.
        storedMs = finished ? Math.min(ms, clamp(timeLimitMs - replay.finishedAt!, 0, timeLimitMs)) : 0;
        isCorrect = finished;
        correctCount = reached;
        score = scoreNumberHunt(finished, storedMs, errors, reached, NUMHUNT_COUNT, timeLimitMs);
        extraDetail = {
          reached,
          finishedAtMs: finished ? replay.finishedAt : null,
          ...tapLogDetail(diag),
        };
        break;
      }
      const parts = answer.split(",");
      const parsed = Number.parseInt(parts[0] ?? "0", 10);
      const reached = Number.isFinite(parsed) ? clamp(parsed, 0, NUMHUNT_COUNT) : 0;
      const parsedErrors = Number.parseInt(parts[1] ?? "0", 10);
      errors = Number.isFinite(parsedErrors) ? clamp(parsedErrors, 0, 99) : 0;
      const finished = reached >= NUMHUNT_COUNT;
      isCorrect = finished;
      correctCount = reached;
      score = scoreNumberHunt(finished, ms, errors, reached, NUMHUNT_COUNT, timeLimitMs);
      break;
    }
    case "target": {
      // The client sends its steps; every one is replayed and re-checked here
      // and the final value is worked out from the tiles, never trusted.
      const replay = replayTargetSteps(puzzle.tiles, puzzle.target, decodeSteps(answer));
      // Rev 1: only numbers the player made count (no step, no credit).
      const distance = scoreRev1() ? madeDistance(puzzle.tiles, puzzle.target, replay) : replay.distance ?? Number.MAX_SAFE_INTEGER;
      isCorrect = distance === 0;
      score = scoreTargetNumber(distance, ms, timeLimitMs);
      extraDetail = {
        value: replay.value,
        steps: replay.steps.map(formatStep),
      };
      break;
    }
    case "unblock": {
      // The phone sends its slides; every one is replayed on the stored layout.
      const played = decodeMoves(answer);
      const replay = replayUnblock(puzzle.vehicles, played);
      const min = puzzle.minMoves ?? 0;
      isCorrect = replay.solved;
      let progress = 0;
      let fewerBlockers = false;
      if (!replay.solved) {
        // Progress is the share of the gold car's blockers cleared from its
        // lane — a cheap count, so no solver ever runs during a room.
        const before = blockingCars(puzzle.vehicles);
        const after = blockingCars(replay.vehicles);
        if (before > 0) progress = Math.max(0, (before - after) / before) * (scoreRev1() ? 1 : 0.9);
        fewerBlockers = after < before;
      }
      score = scoreUnblock(replay.solved, ms, replay.moves, min, progress, fewerBlockers, timeLimitMs);
      extraDetail = { solved: replay.solved, moves: replay.moves, minMoves: min, ...(isDepth4(puzzle) ? { par: puzzle.par ?? min } : {}) };
      break;
    }
    case "blockparty": {
      // Only placements that are legal together count towards the coverage.
      // blockRev 1 (depth batch 4): the 7×7 board and its twelve pieces.
      const geo = blockGeometry(puzzle);
      const verdict = verifyPlacements(puzzle.blockers, decodePlacements(answer), geo);
      isCorrect = verdict.solved;
      // Rev 1: an unfinished board earns only pieces placed where the stored solution has a piece of that shape.
      const credited = scoreRev1() && puzzle.solution?.length
        ? blockPartyCounts(puzzle.solution, verdict.legal).inSpot
        : verdict.legal.length;
      // Rev 1: legal pieces off the solution count against, so dropping pieces at random earns about 0.
      score = scoreBlockParty(verdict.solved, ms, scoreRev1() ? 2 * credited - verdict.legal.length : credited, timeLimitMs);
      extraDetail = {
        solved: verdict.solved,
        covered: verdict.covered,
        placements: encodePlacements(verdict.legal),
        // The bigger board's unfinished progress: its own pieces in the solution's spots (11 of 12 = one short).
        ...(isDepth4(puzzle) ? { d4Progress: Math.max(0, 2 * credited - verdict.legal.length) / (geo.pieces.length - 1) } : {}),
      };
      break;
    }
    case "lightsout": {
      // The phone sends its presses; they are replayed on the stored pattern.
      const actions = decodePresses(answer);
      const presses = activeLightPresses(actions);
      const finalState = replayLights(puzzle.lights, actions);
      const startOn = lightsOnCount(puzzle.lights);
      const leftOn = lightsOnCount(finalState);
      const min = puzzle.minPresses ?? 0;
      isCorrect = presses.length > 0 && lightsAllOff(finalState);
      correctCount = presses.length;
      // A tap counts when it belongs to the stored solution and was made an
      // odd number of times, so it still stands at the end.
      const counts = new Map<number, number>();
      for (const cell of presses) counts.set(cell, (counts.get(cell) ?? 0) + 1);
      const correctTaps = (puzzle.solution ?? []).filter(
        (cell) => (counts.get(cell) ?? 0) % 2 === 1,
      ).length;
      const solutionSet = new Set(puzzle.solution ?? []);
      const wrongStanding = [...counts].filter(([cell, n]) => n % 2 === 1 && !solutionSet.has(cell)).length;
      score = scoreLightsOut(isCorrect, actions.filter((cell) => cell >= 0).length, min, ms, leftOn, correctTaps, timeLimitMs, wrongStanding);
      extraDetail = {
        presses: actions.filter((cell) => cell >= 0).length,
        minPresses: min,
        lightsLeft: leftOn,
        lightsAtStart: startOn,
      };
      break;
    }
    case "pipes": {
      // Connectivity and leaks are worked out here, so any valid layout counts.
      // pipesRev 1 (depth batch 4): the board comes from the tap log alone; the taps up to the solve are counted.
      const taps = isDepth4(puzzle) ? decodePipesTaps(answer, puzzle.tiles.length) : null;
      let turns = 0;
      if (taps) {
        for (let k = 0; k <= taps.length; k++) {
          turns = k;
          if (gradePipesBoard(puzzle.source, pipesAfterTaps(puzzle.tiles, taps.slice(0, k))).solved) break;
        }
      }
      const board = taps ? pipesAfterTaps(puzzle.tiles, taps.slice(0, turns)) : decodeSides(puzzle.tiles, answer);
      const verdict = gradePipesBoard(puzzle.source, board);
      isCorrect = verdict.solved;
      correctCount = verdict.connected;
      const startConnected = scoreRev1() ? gradePipesBoard(puzzle.source, decodeSides(puzzle.tiles, "")).connected : 0;
      score = scorePipes(verdict.solved, verdict.connected, ms, timeLimitMs, startConnected);
      extraDetail = { solved: verdict.solved, connected: verdict.connected, ...(taps ? { turns, par: puzzle.par ?? 0 } : {}) };
      break;
    }
    case "sudoku": {
      // Checked against the rules themselves, not just the stored grid.
      const verdict = gradeSudokuGrid(puzzle.givens, puzzle.solution ?? [], answer);
      isCorrect = verdict.solved;
      correctCount = verdict.correct;
      score = scoreSudoku(verdict.solved, verdict.correct, verdict.total, ms, timeLimitMs, verdict.wrong);
      if (scoreRev1()) errors = verdict.wrong;
      extraDetail = { solved: verdict.solved, correct: verdict.correct, total: verdict.total };
      break;
    }
    case "flow": {
      // Every path the phone sends is re-walked here: contiguous, ending on the
      // right dots, and sharing no cell with another colour.
      const paths = decodeFlowPaths(answer, puzzle.pairs.length || FLOW_PAIRS);
      const verdict = verifyFlow(puzzle.pairs, paths, puzzle.walls ?? []);
      isCorrect = verdict.solved;
      correctCount = verdict.pairsJoined;
      // Rev 1: an unfinished board earns only pairs joined along their (unique) solution route.
      // Pairs joined off their route count against, so random lines earn about 0.
      const { onRoute } = flowRouteCounts(puzzle.solution, paths, verdict.joined);
      const credited = scoreRev1() && puzzle.solution?.length ? 2 * onRoute - verdict.pairsJoined : verdict.pairsJoined;
      score = scoreFlow(verdict.solved, credited, ms, puzzle.pairs.length, timeLimitMs);
      extraDetail = {
        solved: verdict.solved,
        pairsJoined: verdict.pairsJoined,
        pairs: puzzle.pairs.length,
        filled: verdict.filled,
      };
      break;
    }
    case "iceslide": {
      // The phone sends its slides; they are replayed on the stored layout,
      // thin ice breaking exactly as it did on the phone.
      const board = slideBoard(puzzle);
      const replay = replaySlide(board, decodeSlideMoves(answer));
      const min = puzzle.minMoves ?? 0;
      const away = replay.solved ? null : slideDistance(board, replay);
      // Credit follows the closest state the ball ever reached.
      let progress = 0;
      if (!replay.solved) {
        const startDistance = slideDistance(board, { cell: puzzle.start, mask: 0 });
        const best = replay.visited
          .map((state) => slideDistance(board, state))
          .filter((value): value is number => value !== null);
        if (startDistance && startDistance > 0 && best.length > 0) {
          progress = scoreRev1()
            ? Math.max(0, (startDistance - Math.min(...best)) / Math.max(1, startDistance - 1))
            : Math.max(0, 1 - Math.min(...best) / startDistance);
        }
      }
      isCorrect = replay.solved;
      correctCount = replay.moves;
      // slideRev 1 (depth batch 4): the gems collected; the slides they need are not wasted moves, so a finish is
      // measured against the fewest slides that collect those gems (gemRouteLength), not the bare minimum.
      const gems = isDepth4(puzzle) ? (puzzle.gems ?? []) : [];
      const gemReplay = gems.length ? replayGems(board, gems, decodeSlideMoves(answer)) : null;
      const gemMin = gemReplay && replay.solved && gemReplay.collected > 0 ? gemMinMoves(puzzle, gems.filter((_g, i) => gemReplay.mask & (1 << i))) : null;
      score = scoreIceSlide(replay.solved, replay.moves, gemMin ?? min, ms, progress, timeLimitMs);
      extraDetail = {
        solved: replay.solved,
        moves: replay.moves,
        minMoves: min,
        movesFromExit: away,
        falls: replay.falls,
        // slideRev 1 (depth batch 4): the ice gems the standing slides collected.
        ...(isDepth4(puzzle) ? { gems: gems.length, gemsCollected: gemReplay?.collected ?? 0, ...(gemMin !== null ? { gemMinMoves: gemMin } : {}) } : {}),
      };
      break;
    }

    case "push": {
      // Every step is replayed on the stored warehouse, so only legal pushes count.
      const moves = decodePushMoves(answer);
      const replay = replayPush(puzzle.walls, puzzle.targets, puzzle.pusher, puzzle.crates, moves);
      const min = puzzle.minPushes ?? 0;
      const home = replay.solved
        ? puzzle.targets.length
        : cratesOnTargets(replay.state.crates, puzzle.targets);
      isCorrect = replay.solved;
      correctCount = replay.pushes;
      score = scorePush(replay.solved, replay.pushes, min, ms, home, puzzle.targets.length, timeLimitMs, cratesOnTargets(puzzle.crates, puzzle.targets));
      extraDetail = {
        solved: replay.solved,
        pushes: replay.pushes,
        moves: replay.moves,
        minPushes: min,
        cratesHome: home,
        crates: puzzle.targets.length,
        // pushRev 1 (depth batch 4): the gold crate ended on its gold mark (crates keep their index through every push).
        ...(isDepth4(puzzle) && puzzle.gold ? { goldHome: replay.solved && replay.state.crates[puzzle.gold.crate] === puzzle.gold.target } : {}),
      };
      break;
    }
    case "laser": {
      if (actionLog) {
        // The action log is replayed on the stored board: the server counts the
        // shots and takes the layout at each one from the log. Only a FIRE that
        // lights every gem without a bomb solves; otherwise the final layout's
        // gems earn the unfinished credit (as the old timeout draft did, which
        // always claimed at least one shot).
        const replay = replayLaserLog(puzzle, answer, latestTapMs(timeLimitMs, receivedMsRemaining));
        const solveMs = replay.solvedAt === null ? ms : Math.min(ms, clamp(timeLimitMs - replay.solvedAt, 0, timeLimitMs));
        storedMs = replay.solved ? solveMs : ms;
        isCorrect = replay.solved;
        correctCount = replay.gemsLit;
        score = scoreLaser(replay.solved, replay.gemsLit, replay.solved ? replay.solvedShot! : Math.max(1, replay.shots), storedMs, timeLimitMs);
        extraDetail = {
          solved: replay.solved,
          gemsLit: replay.gemsLit,
          fires: replay.solved ? replay.solvedShot : replay.shots,
          hitBomb: replay.hitBomb,
          shots: replay.shotLog.map((shot) => ({ t: shot.t, gems: shot.gemsLit, bomb: shot.hitBomb })),
          mirrorsPlaced: replay.layout.filter((piece) => !isSplitter(piece.kind)).length,
          // laserRev 1 (depth batch 4): the mirrors in the solving shot's layout, against the par.
          ...(isDepth4(puzzle) ? { solveMirrors: replay.solved ? replay.layout.filter((piece) => !isSplitter(piece.kind)).length : null, par: puzzle.par ?? 0 } : {}),
          ...actionLogDetail(replay.diag),
        };
        break;
      }
      // The beam is re-traced here from the placement the phone sent, so the
      // client's own claim about the shot is never trusted.
      const shot = decodeLaserAnswer(answer, puzzle.mirrors + (puzzle.splitterPieces ?? 0));
      const verdict = verifyLaser(puzzle, shot.mirrors, shot.fires);
      isCorrect = verdict.solved;
      correctCount = verdict.gemsLit;
      score = scoreLaser(verdict.solved, verdict.gemsLit, verdict.fires, ms, timeLimitMs);
      extraDetail = {
        solved: verdict.solved,
        gemsLit: verdict.gemsLit,
        fires: verdict.fires,
        hitBomb: verdict.trace.hitBomb,
        mirrorsPlaced: verdict.mirrorsPlaced,
      };
      break;
    }

    case "tower": {
      // Every move is replayed on the stored spread, so illegal moves never count.
      const moves = decodeTowerMoves(answer);
      const replay = replayTower(puzzle.start ?? [], puzzle.targetPeg, puzzle.discs, moves);

      isCorrect = replay.solved;
      correctCount = replay.moves;
      score = scoreTower(
        replay.solved,
        replay.moves,
        puzzle.minMoves,
        ms,
        timeLimitMs,
        replay.correctFromBottom,
        puzzle.discs,
        scoreRev1() ? replayTower(puzzle.start ?? [], puzzle.targetPeg, puzzle.discs, []).correctFromBottom : 0,
      );
      extraDetail = {
        solved: replay.solved,
        moves: replay.moves,
        minMoves: puzzle.minMoves,
        discs: puzzle.discs,
        discsHome: replay.correctFromBottom,
      };
      break;
    }
    case "maze": {
      // mazeRev 1 (depth/labyrinth.ts): the answer is the whole trail; the route is the trail with its backtracks
      // folded away, graded exactly as the older path answer, and the stars are the ones the trail rolled over.
      const depth = usesMazeDepth(puzzle);
      const cols = mazeColsOf(puzzle);
      const walk = depth ? mazeTrailWalk(puzzle.cells, puzzle.start, puzzle.exit, decodeMazeTrail(answer, puzzle.start, cols, puzzle.cells.length), cols) : null;
      // The drawn route is re-walked through the stored corridors.
      const path = walk ? mazeTrailRoute(walk) : decodeMazePath(answer);
      const verdict = verifyMazePath(
        puzzle.cells,
        puzzle.start,
        puzzle.exit,
        puzzle.solution ?? [],
        path,
        cols,
      );
      isCorrect = verdict.solved;
      correctCount = verdict.walked;
      // Rev 1: progress counts route steps beyond the start cell, so standing still is 0.
      const routeLength = Math.max(2, (puzzle.solution ?? []).length);
      // Cells walked beyond the route discount it as in the moves games (0 at 4× the route), so scribbling earns about 0.
      const progress = scoreRev1()
        ? Math.max(0, (verdict.progress * routeLength - 1) / (routeLength - 1)) * wasteFactor(verdict.walked, routeLength)
        : verdict.progress;
      score = scoreMaze(verdict.solved, progress, ms, timeLimitMs);
      extraDetail = {
        solved: verdict.solved,
        progress: Math.round(verdict.progress * 100),
        wasted: verdict.wasted,
        ...(walk ? { stars: mazeStarsTaken(walk, puzzle.stars ?? []), backtracks: mazeTrailBacktracks(walk) } : {}),
      };
      break;
    }
    case "tubes": {
      // Every pour is replayed on the stored board, so illegal pours never count.
      // tubesRev 1: the log carries Undo and Reset, every pour counts and nothing past the pour limit does.
      const pourLimit = tubesPourLimit(puzzle);
      // The boards the player stood on, start first (tubesRev 2: a dead board keeps the best before it).
      const tubeBoards = [puzzle.tubes];
      const replay = tubesSendsUndo(puzzle)
        ? replayTubeLog(puzzle.tubes, decodeTubeLog(answer), pourLimit, (b) => tubeBoards.push(b))
        : replayTubes(puzzle.tubes, decodeTubeMoves(answer));
      isCorrect = replay.solved;
      correctCount = replay.moves;
      const colours = new Set(puzzle.tubes.flat()).size;
      // tubesRev 2: an unfinished board's progress is the solver distance closed, net of waste.
      const tubesShare = !replay.solved && (puzzle.tubesRev ?? 0) >= TUBES_PROGRESS_REV ? tubesSolverProgress(puzzle, tubeBoards, replay.moves) : undefined;
      score = scoreTubes(replay.solved, replay.moves, puzzle.minMoves ?? 0, ms, replay.sorted, timeLimitMs, colours, sortedTubeCount(puzzle.tubes), tubesShare);
      extraDetail = {
        solved: replay.solved,
        moves: replay.moves,
        minMoves: puzzle.minMoves ?? 0,
        sorted: replay.sorted,
        ...(tubesShare !== undefined ? { progress: Math.round(tubesShare * 100) } : {}),
        ...(pourLimit !== null ? { pourLimit, outOfPours: "outOfPours" in replay && replay.outOfPours } : {}),
      };
      break;
    }
    case "safe": {
      // Each try is checked here against the stored combination.
      const combination = puzzle.combination ?? [];
      const tries = decodeSafeTries(answer);
      const openedOn = safeOpenedOn(tries, combination);
      const last = tries[tries.length - 1] ?? [];
      // puzzleScoreRev 2 (score bands): an unopened safe keeps its best try's dials, not only the last try's.
      const right = !combination.length ? 0
        : puzzleScoreRevOf(puzzle) >= 2 ? Math.max(0, ...[...tries, ...(openedOn > 0 || tries.length >= 3 ? [] : [decodeSafePending(answer) ?? []])].map((t) => dialsCorrect(t, combination)))
        : dialsCorrect(last, combination);
      isCorrect = openedOn > 0;
      correctCount = openedOn > 0 ? combination.length : right;
      score = scoreSafe(openedOn, ms, right, timeLimitMs);
      extraDetail = {
        opened: openedOn > 0,
        openedOn,
        tries: tries.length,
        dialsRight: openedOn > 0 ? combination.length : right,
      };
      break;
    }
    case "bomb": {
      // Any order that carries out the required actions and respects every
      // ordering constraint defuses the bomb.
      const required = decodeBombActions(puzzle.required ?? puzzle.sequence ?? "");
      const constraints = decodeBombConstraints(puzzle.constraints ?? "");
      const replay = checkBombPlan(required, constraints, decodeBombActions(answer));
      isCorrect = replay.defused;
      correctCount = replay.correctPrefix;
      // Versions 2 and 3 (six steps) score partial credit as a share of the plan; stored four-step rounds keep 25 per step.
      score = scoreBomb(
        replay.defused,
        ms,
        replay.correctPrefix,
        timeLimitMs,
        (puzzle.bombVersion ?? 1) >= BOMB_V2 ? required.length : undefined,
      );
      extraDetail = {
        defused: replay.defused,
        exploded: replay.exploded,
        correctPrefix: replay.correctPrefix,
        firstWrong: replay.firstWrong,
        required: required.length,
      };
      break;
    }
    case "gravity": {
      // gravityRev 3 (the remodel, topsy.ts): three boards, six balls with holes, stars; scored to 200 here.
      if (isTopsy(puzzle)) {
        const replay = replayTopsyPuzzle(puzzle, decodeGravityTilts(answer));
        // The elite stretch's efficiency: the boards' all-stars minimums ÷ the tilts made (server-only minimums).
        const graded = scoreTopsy(replay, ms, timeLimitMs, undefined, (puzzle.boardStarMins ?? []).reduce((n, m) => n + m, 0) || undefined);
        isCorrect = replay.solved;
        correctCount = replay.home;
        score = graded.score;
        recordParts(graded.parts);
        extraDetail = {
          solved: replay.solved,
          tilts: replay.tilts,
          minMoves: puzzle.minMoves ?? 0,
          home: replay.home,
          stars: replay.stars,
          cleared: replay.cleared,
          boardTilts: replay.boards.map((b) => b.tilts),
          outOfTilts: replay.boards.filter((b) => b.outOfTilts).length,
        };
        break;
      }
      // Every tilt is replayed on the stored board, all four balls at once.
      // gravityRev 1: nothing past the stored tilt limit counts.
      const tiltLimit = gravityTiltLimit(puzzle);
      // The boards the player stood on, start first (gravityRev 2: a dead board keeps the best before it).
      const gravityBoards = [puzzle.starts];
      const replay = replayGravity(puzzle.walls, puzzle.starts, puzzle.targets, decodeGravityTilts(answer), tiltLimit, (b) => gravityBoards.push(b));
      isCorrect = replay.solved;
      correctCount = replay.tilts;
      const lockedAtStart = scoreRev1() ? replayGravity(puzzle.walls, puzzle.starts, puzzle.targets, []).locked : 0;
      // gravityRev 2: an unfinished board's progress is the solver distance closed, net of waste.
      const gravityShare = !replay.solved && (puzzle.gravityRev ?? 0) >= GRAVITY_PROGRESS_REV ? gravitySolverProgress(puzzle, gravityBoards, replay.tilts) : undefined;
      score = scoreGravity(replay.solved, replay.tilts, puzzle.minMoves ?? 0, ms, replay.locked, timeLimitMs, lockedAtStart, puzzle.starts.length, gravityShare);
      extraDetail = {
        solved: replay.solved,
        tilts: replay.tilts,
        minMoves: puzzle.minMoves ?? 0,
        locked: replay.locked,
        ...(gravityShare !== undefined ? { progress: Math.round(gravityShare * 100) } : {}),
        ...(tiltLimit !== null ? { tiltLimit, outOfTilts: replay.outOfTilts } : {}),
      };
      break;
    }
    case "chain": {
      // The timed tap list is re-walked: rule, board and momentum window all checked here.
      const answerData = decodeChainAnswer(answer);
      const replay = replayChain(puzzle, answerData);
      isCorrect = replay.reason === "complete";
      correctCount = replay.links;
      errors = replay.reason === "wrong" ? 1 : 0;
      // chainTimeRev 1: time left is the claim (already held to the receipt
      // check), but never more than the replayed last tap allows.
      if (puzzle.chainTimeRev === CHAIN_TIME_REV && isCorrect && replay.lastT !== null)
        storedMs = Math.min(ms, clamp(CHAIN_TIME_MS - replay.lastT, 0, CHAIN_TIME_MS));
      score = scoreChain(replay.links, storedMs, puzzle);
      extraDetail = {
        links: replay.links,
        reason: replay.reason,
        claimedReason: answerData.reason,
      };
      break;
    }
    case "nonogram": {
      // The submitted cells are checked against the stored picture, never a client verdict.
      const replay = replayNonogram(puzzle.pattern ?? [], decodeNonoCells(answer, nonoSizeOf(puzzle)));
      isCorrect = replay.solved;
      correctCount = replay.correct;
      errors = replay.wrong;
      score = scoreNonogram(replay.solved, replay.correct, replay.total, replay.wrong, ms, timeLimitMs);
      extraDetail = {
        solved: replay.solved,
        correct: replay.correct,
        wrong: replay.wrong,
        total: replay.total,
      };
      break;
    }
    case "pairmatch": {
      // The flip list is re-walked on the stored board to count the pairs found.
      const replay = replayPairs(puzzle.cards, decodePairFlips(answer));
      isCorrect = replay.solved;
      correctCount = replay.pairs;
      score = scorePairMatch(replay.solved, replay.pairs, ms, timeLimitMs, replay.tries);
      extraDetail = {
        solved: replay.solved,
        pairs: replay.pairs,
        flips: replay.flips,
        tries: replay.tries,
      };
      break;
    }
    case "flood": {
      // Every tapped colour is replayed on the stored grid.
      // floodRev 1: taps beyond the stored move limit are ignored, so running out ends the board unfinished.
      const moveLimit = floodMoveLimit(puzzle);
      const replay = replayFlood(puzzle.grid, decodeFloodMoves(answer), undefined, moveLimit);
      isCorrect = replay.solved;
      correctCount = replay.region;
      score = scoreFlood(replay.solved, replay.moves, puzzle.par, replay.region, ms, timeLimitMs, scoreRev1() ? replayFlood(puzzle.grid, []).region : 0, moveLimit);
      extraDetail = {
        solved: replay.solved,
        moves: replay.moves,
        par: puzzle.par,
        region: replay.region,
        ...(moveLimit !== null ? { moveLimit, outOfMoves: replay.outOfMoves } : {}),
      };
      break;
    }
    case "tiles": {
      // tilesRev 3 (the remodel, jumbled.ts): the 5×5 gradient with row and column slides; scored to 200 here.
      if (isJumbledGradient(puzzle)) {
        // tilesRev 4 (Gradient, Joe's phone notes): swaps with locked tiles, scored the same way.
        const replay = replayGradientAnswer(puzzle, answer);
        const graded = scoreJumbled(puzzle.frame, replay, puzzle.par ?? 0, ms, timeLimitMs, puzzle.minMoves);
        isCorrect = replay.solved;
        correctCount = replay.inPlace;
        score = graded.score;
        recordParts(graded.parts);
        extraDetail = {
          solved: replay.solved,
          moves: replay.moves,
          minMoves: puzzle.minMoves ?? 0,
          par: puzzle.par ?? 0,
          inPlace: replay.inPlace,
          ...(graded.progress !== undefined ? { progress: Math.round(graded.progress * 100) } : {}),
        };
        break;
      }
      // Every tapped tile is replayed on the stored frame, Undo and Reset too.
      // tilesRev 1: the extra-cell board (ten cells, tiles 1–9); stored rounds keep the 3×3 frame.
      const layout = tilesLayout(puzzle);
      const replay = replayTiles(puzzle.frame, decodeTileMoves(answer, layout.count), layout);
      isCorrect = replay.solved;
      correctCount = replay.inPlace;
      if (scoreRev1()) {
        // Rev 1: only tiles the player put in place, not ones that started there.
        // Tiles that started in place and were moved out count against, so random slides earn about 0.
        const { startIn, placed } = tilesCounts(puzzle.frame, replay.frame, layout.goal);
        score = scoreTiles(replay.solved, replay.moves, puzzle.minMoves ?? 0, placed, ms, timeLimitMs, startIn, layout.count);
      } else score = scoreTiles(replay.solved, replay.moves, puzzle.minMoves ?? 0, replay.inPlace, ms, timeLimitMs);
      extraDetail = {
        solved: replay.solved,
        moves: replay.moves,
        minMoves: puzzle.minMoves ?? 0,
        inPlace: replay.inPlace,
      };
      break;
    }
    case "rings": {
      // Turns are replayed with the same middle-to-outer link the player saw.
      const replay = replayRings(puzzle.segments, puzzle.pattern, decodeRingTaps(answer));
      isCorrect = replay.solved;
      correctCount = replay.aligned;
      const alignedAtStart = scoreRev1() ? replayRings(puzzle.segments, puzzle.pattern, []).aligned : 0;
      score = scoreRings(replay.solved, replay.moves, puzzle.minMoves ?? 0, replay.aligned, ms, timeLimitMs, alignedAtStart);
      extraDetail = {
        solved: replay.solved,
        moves: replay.moves,
        minMoves: puzzle.minMoves ?? 0,
        aligned: replay.aligned,
        ...(isDepth4(puzzle) ? { par: puzzle.par ?? puzzle.minMoves ?? 0 } : {}),
      };
      break;
    }
    case "hover": {
      // The run is replayed from the stored seed; the phone's own score is
      // never trusted, only recorded as a claim on the stored result.
      const replayStart = performance.now();
      const run = replayHoverRun(puzzle.seed, answer, puzzle.hoverRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.survived;
      correctCount = run.gates;
      score = run.score;
      extraDetail = {
        gates: run.gates,
        totalGates: run.totalGates,
        ...(puzzle.hoverRev ? { hoverRev: puzzle.hoverRev, stars: run.stars, totalStars: run.totalStars } : {}),
        // hoverRev 9 (the 200 expansion): the features and the skill points paid for them.
        ...(run.state.xp ? { tightGates: run.state.tight ?? 0, starChains: run.state.chainsDone ?? 0, centrePts: run.state.ctrPts ?? 0, centreLines: run.state.ctrLog?.length ?? 0, shieldBreaks: run.state.shieldBreaks ?? 0, skill: hoverFeatureBonus(run.state) } : {}),
        // hoverRev 10 (the arcade scoring standard): each part's points; `skill` is then everything beyond the core.
        ...(run.state.std ? (({ core, chains, gold, tight, centre }) => ({ corePts: core, chainPts: chains, goldPts: gold, tightPts: tight, centreLinePts: centre, skill: chains + gold + tight + centre }))(hoverStandardParts(run.state)) : {}),
        survived: run.survived,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeHoverRun(answer).inputs,
        claimedScore: decodeHoverRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "swerve": {
      // Same rule as Hover: only the server's replay of the stored seed scores.
      const replayStart = performance.now();
      const run = replaySwerveRun(puzzle.seed, answer);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.survived;
      correctCount = run.coins;
      score = run.score;
      extraDetail = {
        coins: run.coins,
        totalCoins: run.totalCoins,
        survived: run.survived,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeSwerveRun(answer).taps.length,
        claimedScore: decodeSwerveRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "skyline": {
      const replayStart = performance.now();
      const run = replaySkylineRun(puzzle.seed, answer, puzzle.skylineRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.survived;
      correctCount = run.blocks;
      score = run.score;
      extraDetail = {
        blocks: run.blocks,
        perfects: run.perfects,
        ...(puzzle.skylineRev ? { skylineRev: puzzle.skylineRev, bestStreak: run.bestStreak, streakPoints: run.streakPoints } : {}),
        // skylineRev 7+ (the expansion; 8 is its play on a gentler curve): gold blocks landed perfectly, the best streak multiplier, height milestones.
        ...(puzzle.skylineRev === SKYLINE_REV_EXPAND || puzzle.skylineRev === SKYLINE_REV_LIFT ? { golds: run.golds, bestMult: run.bestMult, milestones: run.milestones } : {}),
        // skylineRev 9 (the arcade scoring standard): gold blocks landed perfectly (of 5) and height milestones (no multiplier).
        ...(puzzle.skylineRev === SKYLINE_REV_STD ? { golds: run.golds, milestones: run.milestones } : {}),
        survived: run.survived,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeSkylineRun(answer).inputs.length,
        claimedScore: decodeSkylineRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "snake": {
      // As with every arcade game, only the server's own replay scores.
      const replayStart = performance.now();
      const run = replaySnakeRun(puzzle.seed, answer, puzzle.snakeRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.survived;
      correctCount = run.pellets;
      score = run.score;
      extraDetail = {
        pellets: run.pellets,
        ...(puzzle.snakeRev ? { snakeRev: puzzle.snakeRev, rocks: run.rocks, rocksDodged: run.rocksDodged, rockHit: run.rockHit } : {}),
        // snakeRev 11 (the arcade scoring standard): each part's points (core, gold, combo, lane, warp).
        ...(run.state.std ? { meteorParts: snakeStdParts(run.state) } : {}),
        length: run.length,
        survived: run.survived,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeSnakeRun(answer).events.length,
        claimedScore: decodeSnakeRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "cross": {
      const replayStart = performance.now();
      const run = replayCrossRun(puzzle.seed, answer, puzzle.crossRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.survived;
      correctCount = run.crossings;
      score = run.score;
      extraDetail = {
        crossings: run.crossings,
        clean: run.clean,
        livesLost: run.livesLost,
        lanes: run.lanes,
        survived: run.survived,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeCrossRun(answer).events.length,
        claimedScore: decodeCrossRun(answer).claimedScore,
        // crossRev 9 (x200): coins and streak points (older rounds keep exactly their old fields).
        ...(run.state.wide ? { coins: run.state.coinTotal ?? 0, streakPts: run.state.streakPts ?? 0, closeCalls: run.state.closeCalls ?? 0 } : {}),
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "dual": {
      const replayStart = performance.now();
      const run = replayDualRun(puzzle.seed, answer);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.survived;
      correctCount = run.passed;
      score = run.score;
      extraDetail = {
        passed: run.passed,
        jumps: run.jumps,
        survived: run.survived,
        crashedSide: run.crashedSide,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeDualRun(answer).events.length,
        claimedScore: decodeDualRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "ricochet": {
      if (isNinjaRev(puzzle.ricoRev)) {
        // ricoRev 2, the ninja wall-climb: the tower dealt from the stored seed, the move log replayed; only that scores.
        const replayStart = performance.now();
        const run = replayNinjaRun(puzzle.seed, answer);
        revealRun = run;
        arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
        isCorrect = run.metres >= NINJA_CORE_FULL_M;
        correctCount = run.metres;
        score = run.score;
        extraDetail = {
          ricoRev: puzzle.ricoRev,
          metres: run.metres,
          coins: run.coins,
          lanterns: run.lanterns,
          scrolls: run.scrolls,
          hits: run.hits,
          leaps: run.leaps,
          djs: run.djs,
          endedSeconds: run.endedSeconds,
          flagged: run.flagged,
          clientLag: run.clientLag,
          clientTick: run.clientTick,
          desyncTick: run.desyncTick,
          inputs: decodeNinjaRun(answer).events.length,
          claimedScore: decodeNinjaRun(answer).claimedScore,
          ...(run.reason ? { reason: run.reason } : {}),
        };
        break;
      }
      const replayStart = performance.now();
      const run = replayRicoRun(puzzle.seed, answer);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.survived;
      correctCount = run.heightPx;
      score = run.score;
      extraDetail = {
        heightPx: run.heightPx,
        leaps: run.leaps,
        survived: run.survived,
        spiked: run.spiked,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeRicoRun(answer).inputs.length,
        claimedScore: decodeRicoRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "breaker": {
      // As with every arcade game, only the server's own replay scores.
      const replayStart = performance.now();
      const run = replayBreakerRun(puzzle.seed, answer, puzzle.brkRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.cleared;
      correctCount = run.hits;
      score = run.score;
      extraDetail = {
        hits: run.hits,
        bricksLeft: run.bricksLeft,
        destroyed: run.destroyed,
        totalHits: run.totalHits,
        losses: run.losses,
        powerUps: run.powerUps,
        ...(puzzle.brkRev ? { brkRev: puzzle.brkRev, fireballs: run.fireballs } : {}),
        // brkRev 9 (the expansion): its wall size and skill points, for the reveal.
        ...(run.state.deep && !run.state.std ? { wall: brkWallSize(run.state), goldBroken: run.state.goldBroken ?? 0, comboPts: run.state.comboPts ?? 0, bestChain: run.state.bestChain ?? 0, skill: brkSkillPaid(run.state) } : {}),
        // brkRev 11 (the arcade scoring standard): the four parts instead of the skill points (combos pay nothing).
        ...(run.state.std
          ? (({ bricks, all, core, clear, speed, goldBroken, goldDealt, gold }) => ({ std: 1, wall: brkWallSize(run.state), bricks, bricksAll: all, core, clearPts: clear, speedPts: speed, goldBroken, goldDealt, goldPts: gold, bestChain: run.state.bestChain ?? 0 }))(breakerStdParts(run.state))
          : {}),
        cleared: run.cleared,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeBreakerRun(answer).events.length,
        claimedScore: decodeBreakerRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "minigolf":
    case "pool":
    case "curling": {
      // Sports (30 Oct 2026): as with every arcade game, only the server's own replay scores (sportsKit.ts); the
      // stored extras name what each part of the arcade standard paid.
      const replayStart = performance.now();
      const common = (run: { endedSeconds: number; flagged: boolean; clientLag: boolean; clientTick: number; desyncTick: number | null; inputs: number; claimedScore: number; reason?: string }) => ({
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: run.inputs,
        claimedScore: run.claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      });
      const pts = (parts: { key: string; points: number }[] | null, key: string) => parts?.find((p) => p.key === key)?.points ?? 0;
      if (puzzle.type === "minigolf") {
        const run = replayMinigolfRun(puzzle.seed, answer, puzzle.pars, puzzle.golfRev);
        revealRun = run;
        arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
        const parts = minigolfStdParts(run.state);
        isCorrect = run.perfect;
        correctCount = run.holed;
        score = run.score;
        extraDetail = {
          golfRev: puzzle.golfRev ?? 1,
          holed: run.holed,
          strokes: run.strokes,
          atPar: run.pars,
          birdies: run.birdies,
          waters: run.waters,
          taken: run.state.taken,
          pars: run.state.pars,
          corePts: pts(parts, "core"),
          parPts: pts(parts, "par"),
          underPts: pts(parts, "under"),
          speedPts: pts(parts, "speed"),
          ...common(run),
        };
      } else if (puzzle.type === "pool") {
        const run = replayPoolRun(puzzle.seed, answer, puzzle.poolRev);
        revealRun = run;
        arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
        const parts = poolStdParts(run.state);
        isCorrect = run.perfect;
        correctCount = run.spots;
        score = run.score;
        extraDetail = {
          poolRev: puzzle.poolRev ?? 1,
          spots: run.spots,
          black: run.black ? 1 : 0,
          fouls: run.fouls,
          streakBest: run.streakBest,
          corePts: pts(parts, "core"),
          blackPts: pts(parts, "black"),
          streakPts: pts(parts, "streak"),
          speedPts: pts(parts, "speed"),
          ...common(run),
        };
      } else if (puzzle.type === "curling") {
        const run = replayCurlingRun(puzzle.seed, answer, puzzle.curlRev);
        revealRun = run;
        arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
        const parts = curlingStdParts(run.state);
        isCorrect = run.perfect;
        correctCount = run.onButton;
        score = run.score;
        extraDetail = {
          curlRev: puzzle.curlRev ?? 1,
          onButton: run.onButton,
          inFourFoot: run.inFourFoot,
          takeouts: run.takeouts,
          opponents: run.opponents,
          holding: run.holding ? 1 : 0,
          corePts: pts(parts, "core"),
          takeoutPts: pts(parts, "takeouts"),
          ringPts: pts(parts, "redring"),
          holdPts: pts(parts, "hold"),
          ...common(run),
        };
      }
      if (arcadeDiag && arcadeDiag.replayMs > 500) console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      break;
    }
    case "homerun":
    case "freekick":
    case "racing": {
      // The Sports group (30 Oct 2026): as with every arcade game, only the server's own replay scores. Each is born
      // on the arcade scoring standard; the stored extra carries each part's points (numbers only) for the reveal.
      const replayStart = performance.now();
      const field = puzzle.type === "homerun" ? "homerunRev" : puzzle.type === "freekick" ? "freekickRev" : "racingRev";
      const rev = (puzzle as { homerunRev?: number; freekickRev?: number; racingRev?: number })[field] ?? 1;
      const run: { score: number; flagged: boolean; clientLag: boolean; clientTick: number; desyncTick: number | null; endedSeconds: number; reason?: string; parts: StdPart[]; state: { acted?: number } } =
        puzzle.type === "homerun"
          ? replayHomerunRun(puzzle.seed, answer, rev)
          : puzzle.type === "freekick"
            ? replayFreekickRun(puzzle.seed, answer, rev)
            : replayRacingRun(puzzle.seed, answer, rev);
      const decoded = puzzle.type === "homerun" ? decodeHomerunRun(answer) : puzzle.type === "freekick" ? decodeFreekickRun(answer) : decodeRacingRun(answer);
      revealRun = run as unknown as typeof revealRun;
      arcadeDiag = buildArcadeDiag(puzzle.type, run as unknown as Parameters<typeof buildArcadeDiag>[1], answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500) console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      const core = run.parts.find((part) => part.key === "core")?.points ?? 0;
      isCorrect = run.score > 0;
      correctCount = core;
      score = run.score;
      extraDetail = {
        [field]: rev,
        std: true,
        ...Object.fromEntries(run.parts.map((part) => [`part_${part.key}`, part.points])),
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decoded.events.length,
        claimedScore: decoded.claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "pinball": {
      // As with every arcade game, only the server's own replay scores.
      const replayStart = performance.now();
      const run = replayPinballRun(puzzle.seed, answer, puzzle.pinRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.ballsLeft > 0;
      correctCount = run.bumps + run.drops;
      score = run.score;
      extraDetail = {
        pinRev: puzzle.pinRev ?? 1,
        points: run.points,
        mult: run.mult,
        bumps: run.bumps,
        drops: run.drops,
        banks: run.banks,
        spins: run.spins,
        laneSets: run.laneSets,
        // pinRev 4 (the expansion): ramps, the best combo, multiballs, jackpots and skill shots.
        ...(pinIsExpanded(puzzle.pinRev) ? { ramps: run.ramps, bestCombo: run.bestCombo, multiballs: run.multiballs, jackpots: run.jackpots, skills: run.skills } : {}),
        // pinRev 6 (the arcade scoring standard): back-to-back ramp shots, one of its features.
        ...(puzzle.pinRev === PIN_REV_STD ? { combos: run.combos } : {}),
        lost: run.lost,
        ballsLeft: run.ballsLeft,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodePinballRun(answer).events.length,
        claimedScore: decodePinballRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    // Cards & Board (30 Oct 2026): the server's own replay of the move log on the stored deal.
    case "freecell": {
      const replayStart = performance.now();
      const run = replayFreecellRun(puzzle.seed, answer, puzzle.freecellRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      isCorrect = run.finished;
      correctCount = run.home;
      score = run.score;
      extraDetail = {
        freecellRev: puzzle.freecellRev ?? 1,
        home: run.home,
        sorted: run.sorted,
        moves: run.moves,
        par: run.par,
        ...((puzzle.freecellRev ?? 1) >= 2 ? { undos: run.undos, resets: run.resets } : {}),
        finished: run.finished,
        finishSeconds: run.finishSeconds,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeFreecellRun(answer).events.length,
        claimedScore: decodeFreecellRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "tripeaks": {
      const replayStart = performance.now();
      const run = replayTripeaksRun(puzzle.seed, answer, puzzle.tripeaksRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      isCorrect = run.finished;
      correctCount = run.cleared;
      score = run.score;
      extraDetail = {
        tripeaksRev: puzzle.tripeaksRev ?? 1,
        cleared: run.cleared,
        peaks: run.peaks,
        bestRun: run.bestRun,
        stockLeft: run.stockLeft,
        // tripeaksRev 2: stock cards turned and the deal's stock par (the reveal's Stock par tile).
        ...((puzzle.tripeaksRev ?? 1) >= 2 ? { stockTurns: run.stockTurns, stockPar: run.stockPar } : {}),
        finished: run.finished,
        finishSeconds: run.finishSeconds,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeTripeaksRun(answer).events.length,
        claimedScore: decodeTripeaksRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "pokersquares": {
      const replayStart = performance.now();
      const run = replayPokerSquaresRun(puzzle.seed, answer, puzzle.pokerSquaresRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      isCorrect = run.placed === 25;
      correctCount = run.made;
      score = run.score;
      extraDetail = {
        pokerSquaresRev: puzzle.pokerSquaresRev ?? 1,
        total: run.total,
        target: run.target,
        made: run.made,
        placed: run.placed,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodePokerSquaresRun(answer).events.length,
        claimedScore: decodePokerSquaresRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    // Blockfall (1 Nov 2026): the piece order comes from the stored seed and the run is replayed; only that scores.
    case "blockfall": {
      const replayStart = performance.now();
      const run = replayBlockfallRun(puzzle.seed, answer, puzzle.blockfallRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      isCorrect = !run.toppedOut && run.state.ended === 1;
      correctCount = run.lines;
      score = run.score;
      extraDetail = {
        blockfallRev: puzzle.blockfallRev ?? 1,
        lines: run.lines,
        doubles: run.doubles,
        triples: run.triples,
        quads: run.quads,
        height: run.height,
        toppedOut: run.toppedOut,
        pieces: run.pieces,
        ...Object.fromEntries(run.parts.map((p) => [`part_${p.key}`, p.points])),
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeBlockfallRun(answer).events.length,
        claimedScore: decodeBlockfallRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    // Alley Roll (1 Nov 2026): the rolls are replayed on the one lane; only that scores.
    case "alleyroll": {
      const replayStart = performance.now();
      const run = replayAlleyRollRun(puzzle.seed, answer, puzzle.alleyRollRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      isCorrect = run.finished;
      correctCount = run.balls;
      score = run.score;
      extraDetail = {
        alleyRollRev: puzzle.alleyRollRev ?? 1,
        rings: run.rings,
        pockets: run.pockets,
        streak: run.streak,
        balls: run.balls,
        finished: run.finished,
        ...Object.fromEntries(run.parts.map((p) => [`part_${p.key}`, p.points])),
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeAlleyRollRun(answer).events.length,
        claimedScore: decodeAlleyRollRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    // Five Hands (31 Oct 2026): the deck is shuffled from the stored seed and the run replayed; only that scores.
    case "fivehands": {
      const replayStart = performance.now();
      const run = replayFiveHandsRun(puzzle.seed, answer, puzzle.fiveHandsRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      isCorrect = run.finished;
      correctCount = run.made;
      score = run.score;
      extraDetail = {
        fiveHandsRev: puzzle.fiveHandsRev ?? 1,
        total: run.total,
        made: run.made,
        placed: run.placed,
        finished: run.finished,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeFiveHandsRun(answer).events.length,
        claimedScore: decodeFiveHandsRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    // Pyramid (1 Nov 2026): the deal is built from the stored seed and the run replayed; only that scores.
    case "pyramid": {
      const replayStart = performance.now();
      const run = replayPyramidRun(puzzle.seed, answer, puzzle.pyramidRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      isCorrect = run.finished;
      correctCount = run.removed;
      score = run.score;
      extraDetail = {
        pyramidRev: puzzle.pyramidRev ?? 1,
        removed: run.removed,
        ppPairs: run.ppPairs,
        kings: run.kings,
        finished: run.finished,
        finishSeconds: run.finishSeconds,
        undos: run.undos,
        resets: run.resets,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodePyramidRun(answer).events.length,
        claimedScore: decodePyramidRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    // Golf Solitaire (1 Nov 2026): the bank deal is the stored seed; the run is replayed and only that scores.
    case "golfsol": {
      const replayStart = performance.now();
      const run = replayGolfSolRun(puzzle.seed, answer, puzzle.golfSolRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      isCorrect = run.finished;
      correctCount = run.cleared;
      score = run.score;
      extraDetail = {
        golfSolRev: puzzle.golfSolRev ?? 1,
        cleared: run.cleared,
        runs: run.runs,
        bestRun: run.bestRun,
        stockLeft: run.stockLeft,
        finished: run.finished,
        finishSeconds: run.finishSeconds,
        undos: run.undos,
        resets: run.resets,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeGolfSolRun(answer).events.length,
        claimedScore: decodeGolfSolRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    // Muggins (1 Nov 2026): the tiles are dealt from the stored seed and the run replayed; only that scores.
    case "muggins": {
      const replayStart = performance.now();
      const run = replayMugginsRun(puzzle.seed, answer, puzzle.mugginsRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      isCorrect = run.finished;
      correctCount = run.plays;
      score = run.score;
      extraDetail = {
        mugginsRev: puzzle.mugginsRev ?? 1,
        points: run.points,
        bigs: run.bigs,
        plays: run.plays,
        handLeft: run.handLeft,
        finished: run.finished,
        finishSeconds: run.finishSeconds,
        undos: run.undos,
        resets: run.resets,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeMugginsRun(answer).events.length,
        claimedScore: decodeMugginsRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    // Cards & Board (30 Oct 2026): the board is dealt from the stored seed and the run replayed; only that scores.
    case "minesweeper": {
      const replayStart = performance.now();
      const run = replayMinesweeperRun(puzzle.seed, answer, puzzle.minesRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.cleared;
      correctCount = run.revealed - run.opening;
      score = run.score;
      extraDetail = {
        minesRev: puzzle.minesRev ?? 1,
        revealed: run.revealed,
        opening: run.opening,
        safe: MINES_SAFE,
        hits: run.hits,
        flags: run.flags,
        chords: run.chords,
        cleared: run.cleared,
        clearedSeconds: run.clearedSeconds,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeMinesweeperRun(answer).events.length,
        claimedScore: decodeMinesweeperRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "mahjong": {
      const replayStart = performance.now();
      const run = replayMahjongRun(puzzle.seed, answer, puzzle.mahjongRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.cleared;
      correctCount = run.pairs;
      score = run.score;
      extraDetail = {
        mahjongRev: puzzle.mahjongRev ?? 1,
        pairs: run.pairs,
        shuffles: run.shuffles,
        misses: run.misses,
        cleared: run.cleared,
        clearedSeconds: run.clearedSeconds,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeMahjongRun(answer).events.length,
        claimedScore: decodeMahjongRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "rally": {
      const replayStart = performance.now();
      const run = replayRallyRun(puzzle.seed, answer, puzzle.rallyRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.survived;
      correctCount = run.hits;
      score = run.score;
      extraDetail = {
        hits: run.hits,
        goldHits: run.goldHits,
        targetHits: run.targetHits,
        rallyRev: run.rallyRev,
        // rallyRev 10 (expansion E9): the gold bonus targets struck, for the reveal.
        // rallyRev 12 (the arcade scoring standard): 5 a target (6 before).
        ...(run.state.exp ? { bonusHits: rallyBonusCount(run.state), bonusPts: (run.state.exp ?? 0) >= RALLY_V12_EXP ? rallyBonusPtsOf(run.state) * rallyBonusCount(run.state) : rallyBonusPoints(run.state) } : {}),
        paddleWidth: run.paddleWidth,
        survived: run.survived,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeRallyRun(answer).events.length,
        claimedScore: decodeRallyRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "steady": {
      const replayStart = performance.now();
      const run = replaySteadyRun(puzzle.seed, answer);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.clean;
      correctCount = run.points;
      score = run.score;
      extraDetail = {
        distance: run.distance,
        metres: run.metres,
        points: run.points,
        touches: run.touches,
        width: run.width,
        clean: run.clean,
        finished: run.finished,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeSteadyRun(answer).events.length,
        claimedScore: decodeSteadyRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "slice": {
      const replayStart = performance.now();
      const run = replaySliceRun(puzzle.seed, answer, puzzle.sliceRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.bombsHit === 0;
      correctCount = run.slices;
      score = run.score;
      extraDetail = {
        slices: run.slices,
        totalDiscs: run.totalDiscs,
        bestMult: run.bestMult,
        bonuses: run.bonuses,
        bombsHit: run.bombsHit,
        ...(run.mayoOn ? { mayo: run.mayo } : {}),
        finished: run.finished,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeSliceRun(answer).events.length,
        claimedScore: decodeSliceRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "bubble": {
      const replayStart = performance.now();
      const run = replayBubbleRun(puzzle.seed, answer, puzzle.bubbleRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.cleared;
      correctCount = run.popped + run.dropped;
      score = run.score;
      extraDetail = {
        popped: run.popped,
        dropped: run.dropped,
        shots: run.shots,
        bubblesLeft: run.bubblesLeft,
        ...(puzzle.bubbleRev ? { bubbleRev: puzzle.bubbleRev, jokers: run.jokers, bombs: run.bombs, lines: run.lines } : {}),
        // bubbleRev 11 (the arcade scoring standard): the scored features' counts.
        ...(run.state.std ? { chests: run.state.chests ?? 0, banks: run.state.banks ?? 0, combos: run.state.combos ?? 0 } : {}),
        startCount: run.state.startCount,
        cleared: run.cleared,
        survived: run.survived,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeBubbleRun(answer).events.length,
        claimedScore: decodeBubbleRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "beat": {
      const replayStart = performance.now();
      const run = replayBeatRun(puzzle.seed, answer, puzzle.beatRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.clean;
      correctCount = run.hits;
      score = run.score;
      extraDetail = {
        hits: run.hits,
        noteCount: run.noteCount,
        perfect: run.perfect,
        good: run.good,
        ok: run.ok,
        misses: run.misses,
        strays: run.strays,
        maxCombo: run.maxCombo,
        holds: run.holds,
        holdsDone: run.holdsDone,
        swipes: run.swipes,
        swipesHit: run.swipesHit,
        clean: run.clean,
        finished: run.finished,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        // beatRev 11 (the arcade scoring standard): the core measure and each feature against the song's own count.
        ...(run.state.std ? { beatRev: puzzle.beatRev, accuracy: beatAccuracy(run.state), fevers: run.state.fevers ?? 0, goldsHit: run.state.goldsHit ?? 0, golds: beatFeatureCounts(run.state).golds, doublesDone: run.state.doublesDone ?? 0, doubles: beatFeatureCounts(run.state).doubles, maxStreak: run.state.maxStreak ?? 0 } : {}),
        inputs: decodeBeatRun(answer).events.length,
        claimedScore: decodeBeatRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "whack": {
      const replayStart = performance.now();
      const run = replayWhackRun(puzzle.seed, answer, puzzle.whackRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.perfect;
      correctCount = run.hits;
      errors = run.wrong;
      score = run.score;
      extraDetail = {
        hits: run.hits,
        totalTargets: run.totalTargets,
        wrong: run.wrong,
        bombs: run.bombs,
        empty: run.empty,
        taps: run.taps,
        perfect: run.perfect,
        finished: run.finished,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeWhackRun(answer).events.length,
        claimedScore: decodeWhackRun(answer).claimedScore,
        // whackRev 3 (depth to 200): the base, the gold combo and the diamonds, stored for the reveal.
        ...(run.state.dp ? { depth: whackDepthDetail(run.state) } : {}),
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "tendrop": {
      const replayStart = performance.now();
      const run = replayTenDropRun(puzzle.seed, answer, puzzle.tenRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.perfect;
      correctCount = run.cleared;
      errors = run.resets;
      score = run.score;
      extraDetail = {
        cleared: run.cleared,
        resets: run.resets,
        refused: run.refused,
        taps: run.taps,
        perfect: run.perfect,
        finished: run.finished,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeTenDropRun(answer).events.length,
        claimedScore: decodeTenDropRun(answer).claimedScore,
        // tenRev 4: tens made by the gold tile (absent on older revisions).
        ...(run.goldTens !== undefined ? { goldTens: run.goldTens } : {}),
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "wordfall": {
      ensureWordfallDict();
      const replayStart = performance.now();
      const run = replayWordfallRun(puzzle.seed, answer, puzzle.wordfallRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.finished;
      correctCount = run.words;
      errors = run.invalid;
      score = run.score;
      const sent = decodeWordfallRun(answer, puzzle.wordfallRev);
      extraDetail = {
        points: run.points,
        par: run.par,
        words: run.words,
        cleared: run.cleared,
        invalid: run.invalid,
        submits: run.submits,
        taps: run.taps,
        longest: run.longest,
        best: run.best,
        overflow: run.overflow,
        survived: run.survived,
        finished: run.finished,
        endedSeconds: run.endedSeconds,
        wordfallRev: puzzle.wordfallRev ?? 1,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: sent.events.length,
        claimedScore: sent.claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "clayshoot": {
      const replayStart = performance.now();
      const run = replayClayRun(puzzle.seed, answer, puzzle.clayRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.perfect;
      correctCount = run.hits;
      errors = run.missed;
      score = run.score;
      extraDetail = {
        hits: run.hits,
        orangeHits: run.orangeHits,
        goldHits: run.goldHits,
        birdHits: run.birdHits,
        birdTotal: run.birdTotal,
        missed: run.missed,
        shots: run.shots,
        total: run.total,
        perfect: run.perfect,
        finished: run.finished,
        endedSeconds: run.endedSeconds,
        // clayRev 4: the stored empty-shot cost, so the reveal never recomputes it.
        ...(clayChargesEmptyShots(puzzle.clayRev)
          ? (() => {
              const emptyShots = clayEmptyShots(run.shots, run.hits, run.birdHits);
              return { emptyShots, emptyShotCost: clayEmptyShotCost(emptyShots, puzzle.clayRev) };
            })()
          : {}),
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeClayRun(answer).events.length,
        claimedScore: decodeClayRun(answer).claimedScore,
        // clayRev 9 (depth to 200): the base, the doubles and the hit streak, stored for the reveal.
        ...(run.state.dp ? { depth: clayDepthDetail(run.state) } : {}),
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "wavefront": {
      const replayStart = performance.now();
      const run = replayWavefrontRun(puzzle.seed, answer, puzzle.wavRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.state.ended === 1;
      correctCount = run.shapesDown;
      score = run.score;
      extraDetail = {
        wave: run.wave,
        shapesDown: run.shapesDown,
        saucers: run.saucers,
        armourHits: run.armourHits,
        wavesCleared: run.wavesCleared,
        ...(puzzle.wavRev ? { wavRev: puzzle.wavRev, bossHits: run.bossHits, bossKilled: run.bossKilled, rammed: run.rammed } : {}),
        lives: run.lives,
        survived: run.survived,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeWavefrontRun(answer).events.length,
        claimedScore: decodeWavefrontRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "bastion": {
      if (isBastionTank(puzzle.bastionRev)) {
        // bastionRev 2 (1 Nov 2026): the tank-defence shooter on the arcade scoring standard; the server's replay alone
        // scores, and the stored extra carries each part's points (numbers only) for the reveal.
        const replayStart = performance.now();
        const run = replayBastionTankRun(puzzle.seed, answer);
        const decoded = decodeBastionTankRun(answer);
        revealRun = run as unknown as typeof revealRun;
        arcadeDiag = buildArcadeDiag(puzzle.type, run as unknown as Parameters<typeof buildArcadeDiag>[1], answer, performance.now() - replayStart);
        if (arcadeDiag.replayMs > 500) console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
        isCorrect = run.score > 0;
        correctCount = run.kills;
        score = run.score;
        extraDetail = {
          bastionRev: puzzle.bastionRev,
          std: true,
          ...Object.fromEntries(run.parts.map((part) => [`part_${part.key}`, part.points])),
          destroyedHp: run.destroyedHp,
          kills: run.kills,
          weak: run.weak,
          fast: run.fast,
          jams: run.jams,
          shots: run.shots,
          hits: run.hits,
          base: run.base,
          wave: run.wave,
          fell: run.fell,
          endedSeconds: run.endedSeconds,
          flagged: run.flagged,
          clientLag: run.clientLag,
          clientTick: run.clientTick,
          desyncTick: run.desyncTick,
          inputs: decoded.events.length,
          claimedScore: decoded.claimedScore,
          ...(run.reason ? { reason: run.reason } : {}),
        };
        break;
      }
      const replayStart = performance.now();
      const run = replayBastionRun(puzzle.seed, answer);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.state.ended === 1;
      correctCount = run.destroyed;
      score = run.score;
      extraDetail = {
        destroyed: run.destroyed,
        health: run.health,
        survived: run.survived,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeBastionRun(answer).events.length,
        claimedScore: decodeBastionRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "rooftop": {
      const replayStart = performance.now();
      const run = replayRooftopRun(puzzle.seed, answer);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.state.ended === 1;
      correctCount = Math.floor(run.survivedSeconds);
      score = run.score;
      extraDetail = {
        survivedSeconds: run.survivedSeconds,
        survived: run.survived,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeRooftopRun(answer).events.length,
        claimedScore: decodeRooftopRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "flip": {
      const replayStart = performance.now();
      const run = replayFlipRun(puzzle.seed, answer, puzzle.flipRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.state.ended === 1;
      correctCount = Math.floor(run.survivedSeconds);
      score = run.score;
      extraDetail = {
        survivedSeconds: run.survivedSeconds,
        survived: run.survived,
        ...(run.starsTotal > 0 ? { stars: run.stars, starsTotal: run.starsTotal } : {}),
        // flipRev 8 (the expansion): the features' counts and the skill points paid.
        ...(run.sweetsTotal > 0 ? { trailStars: run.trailStars, trailTotal: run.trailTotal, combos: run.combos, saves: run.saves, sweets: run.sweets, sweetsTotal: run.sweetsTotal, skill: run.skill } : {}),
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeFlipRun(answer).events.length,
        claimedScore: decodeFlipRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "junction": {
      const replayStart = performance.now();
      const run = replayJunctionRun(puzzle.seed, answer, puzzle.junctionRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.state.ended === 1;
      correctCount = run.cleared;
      score = run.score;
      extraDetail = {
        cleared: run.cleared,
        gaveUp: run.gaveUp,
        ambThrough: run.ambThrough,
        ambStopped: run.ambStopped,
        total: run.total,
        ...(puzzle.junctionRev ? { junctionRev: puzzle.junctionRev, busCleared: run.busCleared, diagCleared: run.diagCleared } : {}),
        survived: run.survived,
        survivedSeconds: run.survivedSeconds,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeJunctionRun(answer).events.length,
        claimedScore: decodeJunctionRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "inkbridge": {
      const replayStart = performance.now();
      const run = replayInkBridgeRun(puzzle.seed, answer, puzzle.inkRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.levels >= run.total;
      correctCount = run.levels;
      score = run.score;
      extraDetail = {
        levels: run.levels,
        total: run.total,
        fails: run.fails,
        stars: run.stars,
        starLevels: run.starLevels,
        // inkRev 10 (x200): trick shots, silver coins and the shamrock (older rounds store none of these).
        ...(run.cloudLevels ? { tricks: run.tricks, cloudLevels: run.cloudLevels, silver: run.silver, silverTotal: run.silverTotal, shamrock: run.shamrock } : {}),
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeInkBridgeRun(answer).events.length,
        claimedScore: decodeInkBridgeRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "burst": {
      const replayStart = performance.now();
      const run = replayBurstRun(puzzle.seed, answer, puzzle.burstRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.state.ended === 1;
      correctCount = run.cleared;
      score = run.score;
      extraDetail = {
        wave: run.wave,
        hits: run.hits,
        cleared: run.cleared,
        lives: run.lives,
        livesLost: run.livesLost,
        ...(puzzle.burstRev ? { burstRev: puzzle.burstRev, freezes: run.freezes } : {}),
        // burstRev 8 (expansion E9): clean waves, golden atoms and the features' points, for the reveal.
        // burstRev 9 (phone-test notes): waves cleared with a time bonus, golden atoms and the features' points.
        // burstRev 10 (the arcade scoring standard): each part's points, golden atoms of the five dealt, and whether all five waves were cleared.
        ...(run.state.std ? (() => { const p = burstStdParts(run.state); return { quickWaves: run.state.quickWaves ?? 0, goldens: burstGoldenCount(run.state), goldensDealt: BURST_V10_GOLDENS, atoms: p.atoms, core: p.core, clearPts: p.clear, goldPts: p.gold, lifeCost: p.lives, done: run.state.done ?? 0, skill: p.clear + p.gold }; })() : run.state.carry ? { quickWaves: run.state.quickWaves ?? 0, goldens: burstGoldenCount(run.state), skill: burstCarryBonus(run.state).total } : run.state.exp ? { cleanWaves: run.state.cleanWaves ?? 0, goldens: burstGoldenCount(run.state), skill: burstCleanBonus(run.state).total } : {}),
        survived: run.survived,
        survivedSeconds: run.survivedSeconds,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeBurstRun(answer).events.length,
        claimedScore: decodeBurstRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "orbit": {
      const replayStart = performance.now();
      const run = replayOrbitRun(puzzle.seed, answer, puzzle.orbitRev, puzzle.planets, puzzle.holes, puzzle.extras);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.state.ended === 1;
      correctCount = run.passed;
      score = run.score;
      extraDetail = {
        passed: run.passed,
        captured: run.captured,
        jumps: "jumps" in run ? run.jumps : 0,
        skipped: "skipped" in run ? run.skipped : 0,
        finished: run.finished,
        secondsLeft: run.secondsLeft,
        total: run.total,
        survived: run.survived,
        survivedSeconds: run.survivedSeconds,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeOrbitRun(answer).events.length,
        claimedScore: decodeOrbitRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
        // orbitRev 12 (the expansion to 200): the features the run took, as flat numbers.
        ...(run.xp ? { dust: run.xp.dust, dustTotal: run.xp.dustTotal, slings: run.xp.slings, slingsTotal: run.xp.slingsTotal, threads: run.xp.threads, threadsTotal: run.xp.threadsTotal, perfect: run.xp.perfect } : {}),
      };
      break;
    }
    case "snip": {
      const replayStart = performance.now();
      const run = replaySnipRun(puzzle.seed, answer, puzzle.snipRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      // snipRev 11 (the 200-point expansion) scores to 200: a perfect run is 200; older revisions keep 150.
      isCorrect = run.score >= (puzzle.snipRev === SNIP_REV_EXPAND ? SNIP_X_MAX : 150);
      correctCount = run.eaten;
      score = run.score;
      extraDetail = {
        eaten: run.eaten,
        stars: run.stars,
        levels: run.levels,
        cuts: run.cuts,
        // snipRev 11: the courses' fruit, levels fed, golden apples, par levels, par-time levels and credit, second leaves, skill paid.
        ...(run.state.course
          ? {
              snipRev: puzzle.snipRev,
              fruits: run.state.fruitsDealt ?? 0,
              cleared: run.state.cleared ?? 0,
              golden: run.state.golden ?? 0,
              parLevels: run.state.parLevels ?? 0,
              quickLevels: run.state.quickLevels ?? 0,
              quickTicks: run.state.quickTicks ?? 0,
              stars2: run.state.stars2 ?? 0,
              strokes: run.state.strokes ?? 0,
              skill: snipFeatureBonus(run.state),
            }
          : {}),
        finished: run.finished,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeSnipRun(answer).events.length,
        claimedScore: decodeSnipRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "swing": {
      const replayStart = performance.now();
      const run = replaySwingRun(puzzle.seed, answer, puzzle.swingRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.state.ended === 1;
      correctCount = run.metres;
      score = run.score;
      extraDetail = {
        metres: run.metres,
        survived: run.survived,
        survivedSeconds: run.survivedSeconds,
        // swingRev 4: stars taken (of starTotal) and what ended the run (1 dragon, 2 stalactite, 3 lava jet).
        ...(puzzle.swingRev === SWING_REV || puzzle.swingRev === SWING_REV_BAND || puzzle.swingRev === SWING_REV_TUNED || puzzle.swingRev === SWING_REV_TUNEC || puzzle.swingRev === SWING_REV_SPREAD || puzzle.swingRev === SWING_REV_TALL || puzzle.swingRev === SWING_REV_TARGET || puzzle.swingRev === SWING_REV_STRICT || puzzle.swingRev === SWING_REV_EXPAND ? { swingRev: puzzle.swingRev, stars: run.stars ?? 0, starTotal: run.starTotal ?? 0, cause: run.cause ?? 0 } : {}),
        // swingRev 13 (the 200 expansion): the features and their payout (raw skill points and what they paid).
        ...(run.state.expand ? (({ comboPts, bestChain, gems, gemTotal, gates, gateTotal, ledges, ledgeTotal, sections, sectionTotal, parsBeaten, parBeat, parPts, raw, total }) => ({ comboPts, bestChain, gems, gemTotal, gates, gateTotal, ledges, ledgeTotal, sections, sectionTotal, parsBeaten, parBeat, parPts, skillRaw: raw, skill: total }))(swingFeaturePoints(run.state)) : {}),
        // swingRev 14 (the assault course): sections, restarts, pars and the pickups banked, with the parts that add up to the score.
        // swingRev 15 (the swinging course): the same counts, the course's share reached and the three parts (core, pars, pickups).
        ...(run.state.rework ? (({ sections, sectionTotal, restarts, caught, parsBeaten, gems, gemTotal, gates, gateTotal, starsBanked, starTotal }, parts) => ({ swingRev: puzzle.swingRev, sections, sectionTotal, restarts, caught, parsBeaten, gems, gemTotal, gates, gateTotal, stars: starsBanked, starTotal, permille: parts.permille, basePts: parts.core, parPts: parts.par, pickupPts: parts.pickups, bonusPts: parts.par + parts.pickups }))(swingAssaultCounts(run.state), swingReworkParts(run.state)) : run.state.assault ? (({ sections, sectionTotal, restarts, caught, parsBeaten, gems, gemTotal, gates, gateTotal, starsBanked, starTotal }, parts) => ({ swingRev: puzzle.swingRev, sections, sectionTotal, restarts, caught, parsBeaten, gems, gemTotal, gates, gateTotal, stars: starsBanked, starTotal, basePts: parts.points, bonusPts: parts.bonus }))(swingAssaultCounts(run.state), swingBandPartsV14(run.state)) : {}),
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeSwingRun(answer).events.length,
        claimedScore: decodeSwingRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "tilt": {
      const replayStart = performance.now();
      const run = replayTiltRun(puzzle.seed, answer, puzzle.tiltRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.state.ended === 1;
      correctCount = run.mazes;
      score = run.score;
      extraDetail = {
        mazes: run.mazes,
        ...(puzzle.tiltRev ? { tiltRev: puzzle.tiltRev, stars: run.stars, totalStars: run.totalStars } : {}),
        // tiltRev 8 (the expansion): quick stars, falls and the paid skill points.
        ...(tiltIsExpand(puzzle.tiltRev) ? { quickStars: run.quickStars, totalQuick: run.totalQuick, falls: run.falls, skillPoints: run.skillPoints } : {}),
        survived: run.survived,
        survivedSeconds: run.survivedSeconds,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeTiltRun(answer).events.length,
        claimedScore: decodeTiltRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "hotfloor": {
      const replayStart = performance.now();
      const run = replayHotFloorRun(puzzle.seed, answer);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.stages >= 10;
      correctCount = run.stages;
      score = run.score;
      extraDetail = {
        stages: run.stages,
        livesLost: run.livesLost,
        completedSeconds: run.completedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeHotFloorRun(answer).events.length,
        claimedScore: decodeHotFloorRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "shikaku": {
      // Rectangles are re-checked against the clues; overlaps and wrong areas don't count.
      // The depth revision's grid is 10 × 11 (`height`); older boards are square.
      const shikakuRows = shikakuHeightOf(puzzle);
      const rects = decodeShikaku(answer, puzzle.size, shikakuRows);
      const covered = shikakuCovered(rects, puzzle.clues, puzzle.size);
      const solved = covered === puzzle.size * shikakuRows;
      isCorrect = solved;
      correctCount = covered;
      if (scoreRev1() && !solved && puzzle.solution?.length) {
        // Rev 1: area of rectangles on the (unique) solution, less the area of other accepted rectangles.
        const { right, wrong: wrongArea } = shikakuAreas(puzzle.solution, acceptedRects(rects, puzzle.clues, puzzle.size));
        score = scoreShikaku(false, ms, timeLimitMs, right - wrongArea, puzzle.size * shikakuRows);
      } else score = scoreShikaku(solved, ms, timeLimitMs, covered, puzzle.size * shikakuRows);
      extraDetail = { solved, covered, rects: rects.length };
      break;
    }
    case "dig": {
      // The dig log is replayed against the stored board; the water result is the server's own.
      const run = digReplay(puzzle, digDecode(answer, puzzle.cols * puzzle.rows));
      const s = run.state;
      isCorrect = s.completeStep > 0;
      correctCount = digCleanCollected(s);
      errors = s.lost + s.settledUnits;
      score = scoreDig(s, puzzle.minDigs);
      extraDetail = {
        collected: digCleanCollected(s),
        drained: s.drained,
        targets: s.targets,
        lost: s.lost,
        settled: s.settledUnits,
        toxic: s.toxicIn,
        pool: s.pool,
        completeStep: s.completeStep,
        dug: run.dug,
        budget: puzzle.budget,
        minDigs: puzzle.minDigs,
        steps: s.step,
      };
      break;
    }
    case "trail": {
      // The path is checked against the stored givens and solution; no score comes from the client.
      const path = trDecode(answer, puzzle.givens.length);
      const prefix = trCorrectPrefix(path, puzzle.solution ?? []);
      const complete = trComplete(puzzle.givens, path) && prefix === puzzle.givens.length;
      isCorrect = complete;
      correctCount = trCorrectTiles(puzzle.givens, path, puzzle.solution ?? []);
      const placedTiles = path.filter((cell, i) => cell >= 0 && puzzle.givens[cell] === null && i < puzzle.givens.length).length;
      score = scoreTrail(complete, ms, timeLimitMs, correctCount, puzzle.givens.filter((g) => g === null).length, placedTiles - correctCount);
      extraDetail = { complete, prefix, correctTiles: correctCount, drawn: path.filter((cell) => cell >= 0).length };
      break;
    }
    case "measure": {
      // Each board's action list is replayed on the stored jugs; the minimums are the server's own.
      // measureRev 2: a board stops at its stored move limit (and so ends the run unfinished).
      const results = gradeMeasureBoards(puzzle.boards, puzzle.minMoves ?? [], answer, measureMoveLimits(puzzle));
      const solved = results.filter((r) => r.solved).length;
      isCorrect = solved === puzzle.boards.length;
      correctCount = solved;
      score = scoreMeasure(results, ms, timeLimitMs);
      extraDetail = { solved, measureRev: puzzle.measureRev, boards: results };
      break;
    }
    case "checkout": {
      // Every stage's darts are re-added against the stored board, target and finishing ring.
      const results = gradeCheckoutStages(puzzle.stages, puzzle.minDarts ?? [], answer);
      const solved = results.filter((r) => r.solved).length;
      isCorrect = solved === puzzle.stages.length;
      correctCount = solved;
      score = scoreCheckout(results, ms, timeLimitMs);
      extraDetail = { solved, fewest: results.filter((r) => r.fewest).length, checkoutRev: puzzle.checkoutRev, stages: results };
      break;
    }
    case "numline": {
      // Placements are measured against the stored exact values; the client sends positions only.
      // numlineRev 2: the tighter item curve (and the 90 s clock stored on the puzzle).
      const results = gradeNumlineItems(puzzle.stages, puzzle.values ?? [], answer, puzzle.numlineRev);
      const placed = results.filter((r) => r.placed).length;
      // Finished = every number placed; accuracy decides the score.
      isCorrect = placed === results.length;
      correctCount = placed;
      score = scoreNumline(results, ms, timeLimitMs, puzzle.numlineRev);
      extraDetail = {
        placed,
        withinFull: results.filter((r) => r.error !== null && r.error <= numlineFullError(puzzle.numlineRev)).length,
        accuracy: Math.round(numlineAccuracy(results) * 10) / 10,
        numlineRev: puzzle.numlineRev,
        errors: results.map((r) => (r.error === null ? null : Math.round(r.error * 10_000) / 10_000)),
      };
      break;
    }
    case "fences":
    case "fillomino":
    case "bridges":
    case "kakuro": {
      // New grid puzzles (1 Nov 2026), born on the scoring standard: the verdict is the rules (the solution is unique,
      // so a board that keeps them is the solution) and the progress counts items against the stored solution. The
      // standard's grader (standard/grid.server.ts) turns these facts into the score; this one is its fallback only.
      const grid = gradeGridPuzzle(puzzle, answer);
      isCorrect = grid.solved;
      correctCount = grid.right;
      errors = grid.wrong;
      score = grid.solved ? 150 : Math.round((120 * Math.max(0, grid.right - grid.wrong)) / Math.max(1, grid.total));
      extraDetail = { solved: grid.solved, right: grid.right, wrong: grid.wrong, total: grid.total };
      break;
    }
    case "numpyramid": {
      // Each placement map is checked against its stored tray and private solution.
      const decoded = npDecodeRound(answer);
      const boards = puzzle.pyramids.map((board, index) => {
        const placements = npDecode(decoded.boards[index] ?? "", board.givens, board.tray.length);
        const solution = puzzle.solutions?.[index] ?? [];
        const emptyCells = board.givens.filter((g) => g == null).length;
        const correctCells = npCorrectCells(board.givens, board.tray, solution, placements);
        const complete = npComplete(board.givens, board.tray, placements, board.rows);
        return { complete, correctCells, emptyCells, placed: Object.keys(placements).length };
      });
      const completed = boards.filter((board) => board.complete).length;
      // Rev 1: partial credit goes to the first unfinished pyramid (they are played in order); the phone's `active` is not read.
      const active = scoreRev1() ? boards.find((b) => !b.complete) : boards[decoded.active];
      isCorrect = completed === puzzle.pyramids.length;
      correctCount = boards.reduce((sum, board) => sum + board.correctCells, 0);
      score = scoreNumberPyramid(completed, isCorrect, ms, active && !active.complete ? active.correctCells : 0, active?.emptyCells ?? 0, timeLimitMs);
      extraDetail = { completed, active: decoded.active, boards };
      break;
    }
    case "balltrack": {
      // The full input log is replayed against the stored course.
      const replayStart = performance.now();
      const run = replayBallTrackRun(puzzle.course, puzzle.seed, answer, puzzle.btRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      isCorrect = run.perfect;
      correctCount = run.home;
      errors = run.wrong;
      score = run.score;
      extraDetail = {
        home: run.home,
        wrong: run.wrong,
        lost: run.lost,
        released: run.released,
        actions: run.actions,
        par: puzzle.par ?? null,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeBallTrackRun(puzzle.course, answer).events.length,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "wordsearch": {
      // Selections are matched against the stored placements; the client's word list is never read.
      // wordSearchRev 3: drags on the private bonus word are set aside (never a wrong pick); the depth grader adds its points.
      const split = wsSplitBonus(puzzle.bonus, wsDecode(answer, puzzle.size));
      const selections = split.rest;
      const verdict = wsGrade(puzzle.placements ?? [], selections);
      const total = puzzle.placements?.length ?? puzzle.wordCount;
      isCorrect = verdict.found.length === total;
      correctCount = verdict.found.length;
      errors = verdict.wrong;
      score = scoreWordSearch(verdict.found.length, total, verdict.wrong, ms, timeLimitMs);
      extraDetail = { found: verdict.found.length, total, wrong: verdict.wrong, ...(puzzle.bonus ? { bonusFound: split.bonusFound } : {}) };
      break;
    }
    case "letterwheel": {
      if (lwUsesLog(puzzle)) {
        // wheelRev 1: the answer is every submitted trace; slot words are found in the log itself and misses cost.
        const tally = lwTallyLog(puzzle.words ?? [], puzzle.letters, lwDecodeLog(answer), isWord);
        const total = puzzle.slots.length;
        const cells = lwGrade(puzzle.words ?? [], puzzle.slots, puzzle.cols, tally.slots.map((i) => puzzle.words![i]!));
        isCorrect = total > 0 && tally.slots.length >= total;
        correctCount = tally.slots.length;
        errors = tally.misses;
        score = scoreLetterWheelLog(tally.slots.length, total, tally.misses, ms, timeLimitMs);
        extraDetail = {
          slots: tally.slots.length,
          total,
          cells: cells.cells,
          totalCells: cells.totalCells,
          traces: tally.traces,
          misses: tally.misses,
          freeMisses: LW_FREE_MISSES,
          neutral: tally.neutral,
        };
        break;
      }
      // Each submitted word is matched against the stored crossword.
      const words = lwDecode(answer);
      const v = lwGrade(puzzle.words ?? [], puzzle.slots, puzzle.cols, words);
      // Rev 1: correct means every word slot found, the same measure the score uses.
      isCorrect = scoreRev1() ? puzzle.slots.length > 0 && v.slots.length >= puzzle.slots.length : v.totalCells > 0 && v.cells >= v.totalCells;
      correctCount = v.slots.length;
      errors = v.wrong;
      score = scoreLetterWheel(v.slots.length, puzzle.slots.length, ms, timeLimitMs);
      extraDetail = { slots: v.slots.length, total: puzzle.slots.length, cells: v.cells, totalCells: v.totalCells };
      break;
    }
    case "strikeout": {
      if (strikeoutRevOf(puzzle) >= STRIKEOUT_REV2) {
        // Rev 2: one word at a time, givens public, two vowel guesses per word, five strikes shared.
        // Rev 3: the same with three vowel guesses, ten strikes and 1.5 per strike left (so2Rules).
        const rules2 = so2Rules(strikeoutRevOf(puzzle));
        const state2 = replayStrikeout2(
          puzzle.words ?? [],
          puzzle.givens ?? [],
          decodeStrikeout2(answer),
          isWord,
          rules2,
        );
        const tally2 = so2Tally(state2);
        isCorrect = tally2.done;
        correctCount = tally2.solvedWords;
        errors = tally2.strikes;
        score = scoreStrikeout2(tally2, ms, timeLimitMs, rules2);
        storedAnswer = encodeStrikeout2(state2.effective);
        extraDetail = {
          solvedRows: tally2.solvedWords,
          foundTiles: tally2.foundTiles,
          strikes: tally2.strikes,
          done: tally2.done,
          over: state2.over,
          strikeoutRev: puzzle.strikeoutRev,
        };
        break;
      }
      // Every guess and solve is replayed on the stored words; solves are checked against the dictionary.
      const state = replayStrikeout(puzzle.words ?? [], decodeStrikeout(answer), isWord);
      const tally = soTally(state);
      isCorrect = tally.done;
      correctCount = tally.solvedRows;
      errors = tally.strikes;
      score = scoreStrikeout(tally, ms, timeLimitMs);
      storedAnswer = encodeStrikeout(state.effective);
      extraDetail = {
        solvedRows: tally.solvedRows,
        partialTiles: tally.partialTiles,
        strikes: tally.strikes,
        done: tally.done,
        over: state.over,
        strikeoutRev: puzzle.strikeoutRev,
      };
      break;
    }
    case "codeword": {
      // The final letter code is rebuilt from every assignment and compared with the stored one.
      const letters = replayCodeword(puzzle.numbers, puzzle.givens, decodeCodeword(answer, puzzle.numbers));
      const tally = codewordTally(letters, puzzle.solution ?? "", puzzle.givens);
      const given = new Set(puzzle.givens.map((g) => g.n));
      isCorrect = tally.solved;
      correctCount = tally.correct;
      errors = letters.filter((l, i) => l && !given.has(i + 1) && l !== puzzle.solution?.[i]).length;
      score = scoreCodeword(tally, ms, timeLimitMs);
      extraDetail = { solved: tally.solved, correct: tally.correct, hidden: tally.hidden, codewordRev: puzzle.codewordRev };
      break;
    }
    case "swapword": {
      // Every swap is replayed on the stored scramble, within the swap budget.
      const run = replaySwapword(puzzle.start, decodeSwapword(answer), puzzle.maxSwaps, puzzle.solution);
      const solution = puzzle.solution ?? "";
      const { placed, toPlace, displaced } = swapwordCounts(puzzle.start, run.board, solution);
      const left = [...run.board].filter((ch, t) => ch !== solution[t]).length;
      isCorrect = run.solved;
      correctCount = placed;
      score = scoreSwapword(run.solved, run.swaps, puzzle.minSwaps, scoreRev1() ? placed - displaced : placed, ms, timeLimitMs, toPlace);
      extraDetail = { solved: run.solved, swaps: run.swaps, minSwaps: puzzle.minSwaps, placed, tilesLeft: left, swapwordRev: puzzle.swapwordRev };
      break;
    }
    case "lightup": {
      // The bulb layout is re-lit against the stored walls and numbers.
      const bulbs = decodeBulbs(answer, puzzle);
      const status = lightUpStatus(puzzle, bulbs);
      const solved = status.clashing.size === 0 && status.numbersOk && status.lit.size === status.whites;
      isCorrect = solved;
      correctCount = status.lit.size;
      errors = status.clashing.size;
      if (scoreRev1() && !solved && puzzle.solution?.length) {
        // Rev 1: credit for bulbs on the (unique) solution, less 5 per other bulb, so lighting everything at random earns nothing.
        const { right, other } = lightUpBulbCounts(puzzle.solution, bulbs);
        score = scoreLightUp(false, ms, timeLimitMs, right, Math.max(1, new Set(puzzle.solution).size - 1), other);
      } else score = scoreLightUp(solved, ms, timeLimitMs, status.lit.size, status.whites, status.clashing.size);
      extraDetail = { solved, lit: status.lit.size, whites: status.whites, clashing: status.clashing.size, bulbs: bulbs.length };
      break;
    }
    case "tents": {
      // The layout is re-checked against the rules and the stored solution.
      const treeSet = new Set(puzzle.trees);
      const tents = decodeTents(answer, puzzle.size, tentsHeightOf(puzzle)).filter((cell) => !treeSet.has(cell));
      const solution = new Set(puzzle.solution ?? []);
      const solved = tentsLayoutValid(puzzle, tents);
      const correct = tents.filter((cell) => solution.has(cell)).length;
      const wrong = tents.length - correct;
      isCorrect = solved;
      correctCount = correct;
      errors = wrong;
      score = scoreTents(solved, ms, timeLimitMs, correct, wrong, puzzle.trees.length);
      extraDetail = { solved, correct, wrong, trees: puzzle.trees.length };
      break;
    }
    case "bintoss": {
      // Same rule as the other arcade games: only the server's replay scores.
      const replayStart = performance.now();
      const run = replayBinTossRun(puzzle.seed, answer, puzzle.binRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.perfect;
      correctCount = run.baskets;
      score = run.score;
      extraDetail = {
        baskets: run.baskets,
        throws: run.throws,
        swishes: run.swishes,
        hoops: run.hoops,
        results: run.results,
        perfect: run.perfect,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeBinTossRun(answer).events.length,
        claimedScore: decodeBinTossRun(answer).claimedScore,
        // binRev 9 (the arcade scoring standard): far baskets and close misses, for the reveal and summaries.
        ...(run.far !== undefined ? { far: run.far, close: run.close ?? 0 } : {}),
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "matchup": {
      // As with every arcade game, only the server's own replay scores.
      const replayStart = performance.now();
      const run = replayMatchupRun(puzzle.seed, answer, puzzle.matchupRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.score >= 150;
      correctCount = run.swaps;
      score = run.score;
      extraDetail = {
        raw: run.raw,
        swaps: run.swaps,
        bestLine: run.bestLine,
        ...(puzzle.matchupRev ? { matchupRev: puzzle.matchupRev, parRaw: run.parRaw, jackpots: run.jackpots, jackpotsFired: run.jackpotsFired } : {}),
        cascades: run.cascades,
        reshuffles: run.reshuffles,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeMatchupRun(answer).events.length,
        claimedScore: decodeMatchupRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "bullseye": {
      const replayStart = performance.now();
      const run = replayBullseyeRun(puzzle.seed, answer, puzzle.winds, puzzle.bullRev);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.inner >= run.arrows;
      correctCount = run.inner;
      score = run.score;
      extraDetail = {
        total: run.total,
        inner: run.inner,
        arrows: run.arrows,
        innerBulls: run.innerBulls,
        pops: run.pops,
        balloons: run.balloons,
        bullRev: run.bullRev,
        ...(run.tuned ? { tuned: run.tuned, balloonPoints: run.balloonPoints } : {}),
        // bullRev 8 (expansion E9): the streak and dead-centre points, for the reveal.
        ...(run.state.expand ? { streakPts: bullseyeStreakPoints(run.state), dead: run.state.dead ?? 0, deadPts: bullseyeDeadPoints(run.state) } : {}),
        finished: run.finished,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeBullseyeRun(answer).events.length,
        claimedScore: decodeBullseyeRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }

    case "equation": {
      // equationRev 1: the answer ends "#t1,t2,t3,t4", the phone's full tries per equation; an
      // equation tried more often than the stored limit does not count (the phone's word: moveLimits.ts).
      const tryLimit = equationTryLimit(puzzle);
      const { body, counts: tries } = tryLimit !== null ? splitCountSuffix(answer) : { body: answer, counts: [] };
      const parts = splitStages(body, puzzle.stages.length);
      const correct = puzzle.stages.map((stage, i) =>
        equationStageCorrect(stage.numbers, stage.target, parts[i] ?? "") && (tryLimit === null || (tries[i] ?? 0) <= tryLimit));
      correctCount = correct.filter(Boolean).length;
      isCorrect = puzzle.stages.length > 0 && correctCount === puzzle.stages.length;
      score = scoreEquationStages(correct, ms);
      if (tryLimit !== null) extraDetail = { tries: puzzle.stages.map((_, i) => tries[i] ?? 0), tryLimit };
      break;
    }
    case "countup": {
      if (usesCountRev2(puzzle)) {
        // countRev 2: four trays, the fourth a comparison; truth from the stored scenes.
        const parts = splitStages(answer, COUNT_REV2_TRAYS);
        const truths = puzzle.stages.map(countUpStageTruth);
        const given = truths.map((_, i) => parseCount(parts[i] ?? ""));
        correctCount = truths.filter((truth, i) => given[i] === truth).length;
        isCorrect = truths.length === COUNT_REV2_TRAYS && correctCount === COUNT_REV2_TRAYS;
        score = scoreCountRev2(given, truths, ms, timeLimitMs);
        break;
      }
      const parts = splitStages(answer);
      // Truth is derived from the stored scene, never accepted from a client or
      // a duplicated hidden count.
      const counts = puzzle.stages.map((stage) => stage.shapes.filter((shape) => shape.shape === stage.targetShape && shape.colour === stage.targetColour).length);
      const given = counts.map((_, i) => parseCount(parts[i] ?? ""));
      correctCount = counts.filter((truth, i) => given[i] === truth).length;
      isCorrect = counts.length === STAGE_COUNT && correctCount === STAGE_COUNT;
      score = scoreCountUpStages(given, counts, ms, timeLimitMs);
      break;
    }
    default: {
      isCorrect = answer.length > 0 && checkAnswer(puzzle, answer);
      score = scoreRound(isCorrect, ms, timeLimitMs);
    }
  }

  if (arcadeDiag) extraDetail = { ...(extraDetail ?? {}), diag: arcadeDiag };
  const reveal = buildArcadeReveal(puzzle.type, revealRun, score);
  if (reveal) extraDetail = { ...(extraDetail ?? {}), reveal };
  return {
    answer: storedAnswer ?? answer,
    isCorrect,
    score,
    reactionAvgMs,
    correctCount,
    errors,
    extra: extraDetail,
    storedMs,
  };
}
