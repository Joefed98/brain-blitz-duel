import { buildArcadeReveal } from "@/lib/arcade/reveal";
import { TICKS_PER_SECOND } from "@/lib/arcade/engine";
import { puzzleUsesTieRev } from "./tieBreak";
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
import { decodePlacements, encodePlacements, verifyPlacements } from "./blockParty";
import { decodeGroupsAnswer, matchGroupsSelection } from "./groups.server";
import { activeLightPresses, decodePresses, decodeSides, lightsAllOff, lightsOnCount, replayLights } from "./logic";
import { gradePipesBoard, gradeSudokuGrid } from "./logic.server";
import { numberClimbSpan } from "./numberClimb";
import { decodeFlowPaths, verifyFlow } from "./flow";
import { decodeSlideMoves, replaySlide, slideBoard, slideDistance } from "./slide";
import { cratesOnTargets, decodePushMoves, replayPush } from "./push";
import { decodeLaserAnswer, isSplitter, verifyLaser } from "./laser";
import { decodeTowerMoves, replayTower } from "./tower";
import { decodeMazePath, verifyMazePath } from "./maze";
import { decodeTubeLog, decodeTubeMoves, replayTubeLog, replayTubes } from "./tubes";
import { dialsCorrect, decodeSafeTries, safeOpenedOn } from "./safe";
import { checkBombPlan, decodeBombActions, decodeBombConstraints } from "./bomb";
import { decodeGravityTilts, replayGravity } from "./gravity";
import { blockingCars } from "./unblock.server";
import { decodeChainAnswer, replayChain } from "./chain";
import { decodeIntruderTaps, replayIntruder } from "./intruder";
import { decodeNonoCells, replayNonogram } from "./nonogram";
import { decodePairFlips, replayPairs } from "./pairmatch";
import { decodeFloodMoves, replayFlood } from "./flood";
import { decodeStrokeAttempts, replayStroke } from "./stroke";
import { decodeTileMoves, replayTiles } from "./tiles";
import { decodeRingTaps, replayRings } from "./rings";
import { decodeHoverRun, replayHoverRun } from "./hover";
import { decodeSwerveRun, replaySwerveRun } from "./swerve";
import { decodeSkylineRun, replaySkylineRun } from "./skyline";
import { decodeSnakeRun, replaySnakeRun } from "./snake";
import { decodeBreakerRun, replayBreakerRun } from "./breaker";
import { decodeRallyRun, replayRallyRun } from "./rally";
import { decodeSteadyRun, replaySteadyRun } from "./steady";
import { decodeSliceRun, replaySliceRun } from "./slice";
import { decodeBubbleRun, replayBubbleRun } from "./bubble";
import { decodeBeatRun, replayBeatRun } from "./beat";
import { decodeWhackRun, replayWhackRun } from "./whack";
import { decodeTenDropRun, replayTenDropRun } from "./tenDrop";
import { decodeWordfallRun, replayWordfallRun } from "./wordfall";
import { ensureWordfallDict } from "./wordfallDict.server";
import { decodeClayRun, replayClayRun } from "./clayShoot";
import { decodeWavefrontRun, replayWavefrontRun } from "./wavefront";
import { decodeBastionRun, replayBastionRun } from "./bastion";
import { decodeRooftopRun, replayRooftopRun } from "./rooftop";
import { decodeSortRushRun, replaySortRushRun } from "./sortRush";
import { decodeFlipRun, replayFlipRun } from "./flip";
import { decodeParryRun, replayParryRun } from "./parry";
import { decodeJunctionRun, replayJunctionRun } from "./junction";
import { decodeInkBridgeRun, replayInkBridgeRun } from "./inkBridge";
import { decodeBurstRun, replayBurstRun } from "./burst";
import { decodeOrbitRun, replayOrbitRun } from "./orbit";
import { decodeSwingRun, replaySwingRun } from "./swing";
import { SWING_REV, SWING_REV_BAND, SWING_REV_TUNED, SWING_REV_TUNEC } from "@/lib/arcade/swing";
import { decodeSnipRun, replaySnipRun } from "./snip";
import { decodeTiltRun, replayTiltRun } from "./tilt";
import { decodeHotFloorRun, replayHotFloorRun } from "./hotFloor";
import { replayColourClashRun } from "./colourClash";
import { clashRev4Finished, clashVariantOf, CLASH_REV } from "@/lib/arcade/colourClash";
import { decodeTents, scoreTents, tentsLayoutValid } from "./tents";
import { acceptedRects, decodeShikaku, scoreShikaku, shikakuCovered } from "./shikaku";
import { decodeBulbs, lightUpStatus, scoreLightUp } from "./lightUp";
import { decodeBallTrackRun, replayBallTrackRun } from "./ballTrack";
import { scoreTrail, trComplete, trCorrectPrefix, trCorrectTiles, trDecode } from "./trail";
import { npComplete, npCorrectCells, npDecode, npDecodeRound, scoreNumberPyramid } from "./numberPyramid";
import { gradeMeasureBoards, scoreMeasure } from "./measure";
import { gradeCheckoutStages, scoreCheckout } from "./checkout";
import { gradeNumlineItems, NUMLINE_FULL_ERROR, numlineAccuracy, scoreNumline } from "./numline";
import { digCleanCollected, digDecode, digReplay, scoreDig } from "./dig";
import { scoreWordSearch, wsDecode, wsGrade } from "./wordSearch";
import { lwDecode, lwGrade, scoreLetterWheel } from "./letterWheel";
import { decodeCrossRun, replayCrossRun } from "./cross";
import { decodeDualRun, replayDualRun } from "./dual";
import { decodeRicoRun, replayRicoRun } from "./ricochet";
import { decodeBinTossRun, replayBinTossRun } from "./binToss";
import { decodeBullseyeRun, replayBullseyeRun } from "./bullseye";
import { decodeMatchupRun, replayMatchupRun } from "./matchup";

import { validateLadder } from "./wordLadder.server";
import { decodeTileGrid, scoreTileGrid } from "./tileGrid";
import { judgeTileGrid } from "./tileGrid.server";
import { decodeSumPaths, replaySumHunt, sumHuntRoundScore, SH_STAGES } from "./sumHunt";
import { balanceRoundScore, balanceScalesSolved, balanceSolvedCount, BAL_SCALES, decodeBalance } from "./balance";
import { decodeSlideTokens, markedRowWord, replayWordSlide, WS_MARKED_ROWS } from "./wordSlide";
import { checkWordSlideRow, markedRowsSolved } from "./wordSlide.server";
import { checkAnswer } from "./puzzles";
import {
  TAP_LOG_ANSWER_CAP,
  decodeNumberTaps,
  decodeTapTimes,
  replayAscend,
  replayBangOn,
  replayFlash,
  usesTapLog,
  type TapLogDiag,
} from "./tapLog";
import { countPatternAnswers } from "./pattern";
import { decodeMoves, replayUnblock } from "./unblock";
import { puzzleTimeLimitMs } from "./registry";
import { PUZZLE_SCORE_REV, puzzleScoreRevOf, scoreRev1, takeScoreParts, wasteFactor, withPuzzleScoreRev } from "./puzzleScoreRev";
import { solvedFrame } from "./tiles";
import { sortedTubeCount } from "./tubes";
import { madeDistance } from "./target";
import { isWord } from "./dictionary.server";
import { decodeStrikeout, encodeStrikeout, replayStrikeout, scoreStrikeout, soTally } from "./strikeout";
import { codewordTally, decodeCodeword, replayCodeword, scoreCodeword } from "./codeword";
import { decodeSwapword, replaySwapword, scoreSwapword, swapwordPlaced } from "./swapword";
import { decodeSteps, formatStep, replayTargetSteps } from "./target";
import { balancePlaceLimits, equationTryLimit, floodMoveLimit, gravityTiltLimit, measureMoveLimits, splitCountSuffix, tubesPourLimit, tubesSendsUndo } from "./moveLimits";
import {
  scoreGoNoGo,
  scoreGroups,
  scoreWordLadder,
  scoreWordSlide,
  wordSpeedBonus,
  scoreNumberClimb,
  scoreNumberHunt,
  scoreNumberSequence,
  scorePercentSprint,
  scorePatternCompletion,
  scoreReaction,
  scoreRound,
  scoreSpotDifference,
  SPOT_REV1_WRONG_LIMIT,
  scoreStopWatch,
  scoreBlockParty,
  scoreMirrorMatch,
  scoreSpin,
  scoreUnblock,
  scoreTargetNumber,
  scoreWordMatch,
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
  scoreIntruder,
  scoreNonogram,
  scorePairMatch,
  scoreFlood,
  scoreStroke,
  scoreTiles,
  scoreRings,
} from "./scoring";
import {
  BOMB_V2,
  GONOGO_ITEMS,
  NUMHUNT_COUNT,
  NUMSEQ_ITEMS,
  PCTSPRINT_ITEMS,
  REACTION_MISS_MS,
  ROUND_MS,
  SPOT_DIFFERENCES,
  STOPWATCH_ATTEMPTS,
  STOPWATCH_MISS_MS,
  MIRMATCH_ITEMS,
  SPIN_ITEMS,
  INTRUDER_BOARDS,
  WORDMATCH_ITEMS,
  FLOW_PAIRS,
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
  const answerCap = ARCADE_DIAG_KEYS.has(puzzle.type) ? 400_000 : tapLog ? TAP_LOG_ANSWER_CAP : actionLog ? ACTION_LOG_ANSWER_CAP : 4_000;
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
    case "groups": {
      const matches = new Set(
        decodeGroupsAnswer(answer)
          .map((selection) => matchGroupsSelection(puzzle, selection))
          .filter((index): index is number => index !== null),
      );
      correctCount = matches.size;
      isCorrect = correctCount === 4;
      score = scoreGroups(correctCount, ms);
      extraDetail = { foundGroups: correctCount };
      break;
    }
    case "tilegrid": {
      // The placed grid is re-checked against the tray and the dictionary here.
      const verdict = judgeTileGrid(decodeTileGrid(answer), puzzle.tray);
      isCorrect = verdict.valid;
      correctCount = verdict.placed;
      score = scoreTileGrid(verdict.valid, verdict.placed, verdict.wordTiles, wordSpeedBonus(ms, timeLimitMs, scoreRev1() ? 30 : 20));
      extraDetail = { placed: verdict.placed, valid: verdict.valid, wordTiles: verdict.wordTiles };
      break;
    }
    case "sumhunt": {
      // Every path is replayed on the seeded board; wrong sums never count.
      const replay = replaySumHunt(puzzle.seed, puzzle.target, decodeSumPaths(answer));
      correctCount = replay.paths;
      score = sumHuntRoundScore(replay.stage, ms);
      isCorrect = replay.stage > SH_STAGES;
      extraDetail = { stage: replay.stage, paths: replay.paths };
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
      const firstOpen = verdicts.indexOf(false);
      const solved = placeLimits ? (firstOpen < 0 ? BAL_SCALES : firstOpen) : balanceSolvedCount(puzzle.scales, placements);
      // Rev 1 credits every balanced scale in any order.
      const scales = scoreRev1() ? verdicts : undefined;
      correctCount = scales ? scales.filter(Boolean).length : solved;
      isCorrect = scales ? correctCount === BAL_SCALES : solved === BAL_SCALES;
      score = balanceRoundScore(solved, ms, timeLimitMs, scales);
      extraDetail = scales ? { solved, scales, ...(placeLimits ? { hangs: puzzle.scales.map((_, s) => hangs[s] ?? 0), placeLimits } : {}) } : { solved };
      break;
    }
    case "wordslide": {
      // Every swipe, Undo and Reset is replayed on the stored grid.
      const replay = replayWordSlide(puzzle.grid, decodeSlideTokens(answer));
      const rows = markedRowsSolved(replay.grid);
      isCorrect = rows === WS_MARKED_ROWS.length;
      correctCount = rows;
      // Rev 1: an unfinished grid earns only the word rows the player made (a row still as it started is not counted).
      const madeRows = scoreRev1() && !isCorrect
        ? WS_MARKED_ROWS.filter((r) => markedRowWord(replay.grid, r) !== markedRowWord(puzzle.grid, r) && checkWordSlideRow(markedRowWord(replay.grid, r)).valid).length
        : rows;
      score = scoreWordSlide(madeRows, WS_MARKED_ROWS.length, ms, timeLimitMs, replay.moves, puzzle.par);
      extraDetail = { solved: isCorrect, moves: replay.moves, par: puzzle.par, rows,
        validRows: WS_MARKED_ROWS.filter((r) => checkWordSlideRow(markedRowWord(replay.grid, r)).valid) };
      break;
    }
    case "ladder": {
      const verdict = validateLadder(puzzle, answer);
      const shortestLength = puzzle.shortestLength ?? 0;
      isCorrect = verdict.solved;
      correctCount = verdict.validRungs.length;
      // How close the last good rung came: the positions that still differ.
      const last = verdict.validRungs[verdict.validRungs.length - 1] ?? puzzle.startWord;
      const target = puzzle.targetWord;
      const lettersAway =
        last.length === target.length
          ? [...target].filter((letter, i) => last[i] !== letter).length
          : target.length;
      score = scoreWordLadder(isCorrect, correctCount, shortestLength, ms, lettersAway);
      extraDetail = { rungsUsed: correctCount + 1, shortestLength, lettersAway };
      break;
    }
    case "numclimb": {
      const expected = puzzle.answerDigits ?? "";
      const span = numberClimbSpan(answer, expected);
      correctCount = span;
      isCorrect = span === 12;
      score = scoreNumberClimb(span, ms);
      extraDetail = { span };
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
        score = scoreReaction(reactionAvgMs, falseStarts);
        storedMs = 0;
        extraDetail = {
          times: total,
          falseStarts,
          misses: total.filter((v) => v >= REACTION_MISS_MS).length,
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
    case "gonogo": {
      correctCount = clamp(extra.correctCount ?? 0, 0, GONOGO_ITEMS);
      reactionAvgMs =
        extra.reactionAvgMs === undefined || extra.reactionAvgMs === null
          ? null
          : clamp(extra.reactionAvgMs, 0, 5_000);
      isCorrect = correctCount >= GONOGO_ITEMS;
      score = scoreGoNoGo(correctCount, reactionAvgMs);
      storedMs = 0;
      break;
    }
    case "stroop": {
      const replay = replayColourClashRun(puzzle.seed, answer, clashVariantOf(puzzle));
      revealRun = replay;
      correctCount = replay.correct;
      // clashRev 4: a finish allows up to CLASH_REV4_MAX_WRONG wrong gates; older rounds need every word right.
      isCorrect = puzzle.clashRev === CLASH_REV
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
      break;
    }
    case "mirmatch": {
      // The correct candidate of each item lives server-side only.
      const picks = answer.split(",").map((v) => Number.parseInt(v, 10));
      correctCount = (puzzle.answers ?? []).filter((a, i) => picks[i] === a).length;
      isCorrect = correctCount >= MIRMATCH_ITEMS;
      score = scoreMirrorMatch(correctCount, ms);
      break;
    }
    case "patcomp": {
      correctCount = countPatternAnswers(puzzle, answer);
      isCorrect = correctCount === 3;
      score = scorePatternCompletion(correctCount, ms);
      break;
    }
    case "spin": {
      // Same again: the transform used for each item is never sent to the phone.
      const picks = answer.split(",").filter(Boolean);
      correctCount = (puzzle.answers ?? []).filter((a, i) => picks[i] === a).length;
      isCorrect = correctCount >= SPIN_ITEMS;
      score = scoreSpin(correctCount, ms);
      break;
    }
    case "wordmatch": {
      // Checked here against the stored answers — the client never sees them.
      const picks = answer.split(",").map((v) => Number.parseInt(v, 10));
      correctCount = (puzzle.answers ?? []).filter((a, i) => picks[i] === a).length;
      isCorrect = correctCount >= WORDMATCH_ITEMS;
      score = scoreWordMatch(correctCount, ms);
      break;
    }
    case "numseq": {
      // The five correct option indices live server-side only.
      const picks = answer.split(",").map((v) => Number.parseInt(v, 10));
      correctCount = (puzzle.answers ?? []).filter((a, i) => picks[i] === a).length;
      isCorrect = correctCount >= NUMSEQ_ITEMS;
      score = scoreNumberSequence(correctCount, ms);
      break;
    }
    case "pctsprint": {
      // Same again: the three correct option indices live server-side only.
      const picks = answer.split(",").map((v) => Number.parseInt(v, 10));
      correctCount = (puzzle.answers ?? []).filter((a, i) => picks[i] === a).length;
      isCorrect = correctCount >= PCTSPRINT_ITEMS;
      score = scorePercentSprint(correctCount, ms);
      break;
    }
    case "spotdiff": {
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
        score = scoreStopWatch(reactionAvgMs);
        storedMs = 0;
        extraDetail = { distances: total, signed: replay.results.map((r) => r.signed), ...tapLogDetail(diag) };
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
      extraDetail = { solved: replay.solved, moves: replay.moves, minMoves: min };
      break;
    }
    case "blockparty": {
      // Only placements that are legal together count towards the coverage.
      const verdict = verifyPlacements(puzzle.blockers, decodePlacements(answer));
      isCorrect = verdict.solved;
      // Rev 1: an unfinished board earns only pieces placed where the stored solution has a piece of that shape.
      const solutionCells = new Set((puzzle.solution ?? []).map((p) => [...p.cells].sort((a, b) => a - b).join(",")));
      const credited = scoreRev1() && puzzle.solution?.length
        ? verdict.legal.filter((p) => solutionCells.has([...p.cells].sort((a, b) => a - b).join(","))).length
        : verdict.legal.length;
      // Rev 1: legal pieces off the solution count against, so dropping pieces at random earns about 0.
      score = scoreBlockParty(verdict.solved, ms, scoreRev1() ? 2 * credited - verdict.legal.length : credited, timeLimitMs);
      extraDetail = {
        solved: verdict.solved,
        covered: verdict.covered,
        placements: encodePlacements(verdict.legal),
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
      const board = decodeSides(puzzle.tiles, answer);
      const verdict = gradePipesBoard(puzzle.source, board);
      isCorrect = verdict.solved;
      correctCount = verdict.connected;
      const startConnected = scoreRev1() ? gradePipesBoard(puzzle.source, decodeSides(puzzle.tiles, "")).connected : 0;
      score = scorePipes(verdict.solved, verdict.connected, ms, timeLimitMs, startConnected);
      extraDetail = { solved: verdict.solved, connected: verdict.connected };
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
      const routeKey = (path: number[]) => [...path].sort((a, b) => a - b).join(",");
      // Pairs joined off their route count against, so random lines earn about 0.
      const onRoute = verdict.joined.filter((ok, i) => ok && puzzle.solution?.[i] && routeKey(paths[i] ?? []) === routeKey(puzzle.solution[i]!)).length;
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
      score = scoreIceSlide(replay.solved, replay.moves, min, ms, progress, timeLimitMs);
      extraDetail = {
        solved: replay.solved,
        moves: replay.moves,
        minMoves: min,
        movesFromExit: away,
        falls: replay.falls,
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
      // The drawn route is re-walked through the stored corridors.
      const path = decodeMazePath(answer);
      const verdict = verifyMazePath(
        puzzle.cells,
        puzzle.start,
        puzzle.exit,
        puzzle.solution ?? [],
        path,
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
      };
      break;
    }
    case "tubes": {
      // Every pour is replayed on the stored board, so illegal pours never count.
      // tubesRev 1: the log carries Undo and Reset, every pour counts and nothing past the pour limit does.
      const pourLimit = tubesPourLimit(puzzle);
      const replay = tubesSendsUndo(puzzle)
        ? replayTubeLog(puzzle.tubes, decodeTubeLog(answer), pourLimit)
        : replayTubes(puzzle.tubes, decodeTubeMoves(answer));
      isCorrect = replay.solved;
      correctCount = replay.moves;
      const colours = new Set(puzzle.tubes.flat()).size;
      score = scoreTubes(replay.solved, replay.moves, puzzle.minMoves ?? 0, ms, replay.sorted, timeLimitMs, colours, sortedTubeCount(puzzle.tubes));
      extraDetail = {
        solved: replay.solved,
        moves: replay.moves,
        minMoves: puzzle.minMoves ?? 0,
        sorted: replay.sorted,
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
      const right = combination.length ? dialsCorrect(last, combination) : 0;
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
      // Version 2 (six steps) scores partial credit as a share of the plan; stored four-step rounds keep 25 per step.
      score = scoreBomb(
        replay.defused,
        ms,
        replay.correctPrefix,
        timeLimitMs,
        puzzle.bombVersion === BOMB_V2 ? required.length : undefined,
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
      // Every tilt is replayed on the stored board, all four balls at once.
      // gravityRev 1: nothing past the stored tilt limit counts.
      const tiltLimit = gravityTiltLimit(puzzle);
      const replay = replayGravity(puzzle.walls, puzzle.starts, puzzle.targets, decodeGravityTilts(answer), tiltLimit);
      isCorrect = replay.solved;
      correctCount = replay.tilts;
      const lockedAtStart = scoreRev1() ? replayGravity(puzzle.walls, puzzle.starts, puzzle.targets, []).locked : 0;
      score = scoreGravity(replay.solved, replay.tilts, puzzle.minMoves ?? 0, ms, replay.locked, timeLimitMs, lockedAtStart, puzzle.starts.length);
      extraDetail = {
        solved: replay.solved,
        tilts: replay.tilts,
        minMoves: puzzle.minMoves ?? 0,
        locked: replay.locked,
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
      score = scoreChain(replay.links, ms, puzzle);
      extraDetail = {
        links: replay.links,
        reason: replay.reason,
        claimedReason: answerData.reason,
      };
      break;
    }
    case "intruder": {
      // Taps are checked against the stored changed cells, never a client verdict.
      const replay = replayIntruder(puzzle.answers ?? [], decodeIntruderTaps(answer));
      isCorrect = replay.correct >= (puzzle.answers ?? puzzle.boards).length;
      correctCount = replay.correct;
      score = scoreIntruder(replay.points, replay.correct >= INTRUDER_BOARDS, ms, timeLimitMs);
      extraDetail = {
        correct: replay.correct,
        allFirstTry: replay.allFirstTry,
        boards: puzzle.boards.length,
      };
      break;
    }
    case "nonogram": {
      // The submitted cells are checked against the stored picture, never a client verdict.
      const replay = replayNonogram(puzzle.pattern ?? [], decodeNonoCells(answer));
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
      score = scoreFlood(replay.solved, replay.moves, puzzle.par, replay.region, ms, timeLimitMs, scoreRev1() ? replayFlood(puzzle.grid, []).region : 0);
      extraDetail = {
        solved: replay.solved,
        moves: replay.moves,
        par: puzzle.par,
        region: replay.region,
        ...(moveLimit !== null ? { moveLimit, outOfMoves: replay.outOfMoves } : {}),
      };
      break;
    }
    case "stroke": {
      // Each attempt is re-walked over the stored figure; no client verdict.
      const replay = replayStroke(puzzle.edges, decodeStrokeAttempts(answer));
      isCorrect = replay.solved;
      correctCount = replay.best;
      score = scoreStroke(replay.solved, replay.solvedOn, replay.best, replay.total, ms);
      extraDetail = {
        solved: replay.solved,
        solvedOn: replay.solvedOn,
        attempts: replay.attempts,
        best: replay.best,
        total: replay.total,
      };
      break;
    }
    case "tiles": {
      // Every tapped tile is replayed on the stored frame, Undo and Reset too.
      const replay = replayTiles(puzzle.frame, decodeTileMoves(answer));
      isCorrect = replay.solved;
      correctCount = replay.inPlace;
      if (scoreRev1()) {
        // Rev 1: only tiles the player put in place, not ones that started there.
        const goal = solvedFrame();
        const startIn = puzzle.frame.filter((v, i) => v !== 0 && v === goal[i]).length;
        // Tiles that started in place and were moved out count against, so random slides earn about 0.
        const displaced = puzzle.frame.filter((v, i) => v !== 0 && v === goal[i] && replay.frame[i] !== v).length;
        const placed = replay.frame.filter((v, i) => v !== 0 && v === goal[i] && puzzle.frame[i] !== v).length - displaced;
        score = scoreTiles(replay.solved, replay.moves, puzzle.minMoves ?? 0, placed, ms, timeLimitMs, startIn);
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
        inputs: decodeBeatRun(answer).events.length,
        claimedScore: decodeBeatRun(answer).claimedScore,
        ...(run.reason ? { reason: run.reason } : {}),
      };
      break;
    }
    case "whack": {
      const replayStart = performance.now();
      const run = replayWhackRun(puzzle.seed, answer);
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
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeClayRun(answer).events.length,
        claimedScore: decodeClayRun(answer).claimedScore,
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
    case "sortrush": {
      const replayStart = performance.now();
      const run = replaySortRushRun(puzzle.seed, answer);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.state.ended === 1;
      correctCount = run.sorted;
      score = run.score;
      extraDetail = {
        sorted: run.sorted,
        wrong: run.wrong,
        total: run.total,
        survivedSeconds: run.survivedSeconds,
        survived: run.survived,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeSortRushRun(answer).events.length,
        claimedScore: decodeSortRushRun(answer).claimedScore,
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
    case "parry": {
      const replayStart = performance.now();
      const run = replayParryRun(puzzle.seed, answer);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.state.ended === 1;
      correctCount = run.deflected;
      score = run.score;
      extraDetail = {
        deflected: run.deflected,
        hits: run.hits,
        total: run.total,
        survivedSeconds: run.survivedSeconds,
        survived: run.survived,
        endedSeconds: run.endedSeconds,
        flagged: run.flagged,
        clientLag: run.clientLag,
        clientTick: run.clientTick,
        desyncTick: run.desyncTick,
        inputs: decodeParryRun(answer).events.length,
        claimedScore: decodeParryRun(answer).claimedScore,
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
      const run = replayOrbitRun(puzzle.seed, answer, puzzle.orbitRev, puzzle.planets, puzzle.holes);
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
      isCorrect = run.score >= 150;
      correctCount = run.eaten;
      score = run.score;
      extraDetail = {
        eaten: run.eaten,
        stars: run.stars,
        levels: run.levels,
        cuts: run.cuts,
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
        ...(puzzle.swingRev === SWING_REV || puzzle.swingRev === SWING_REV_BAND || puzzle.swingRev === SWING_REV_TUNED || puzzle.swingRev === SWING_REV_TUNEC ? { swingRev: puzzle.swingRev, stars: run.stars ?? 0, starTotal: run.starTotal ?? 0, cause: run.cause ?? 0 } : {}),
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
      const rects = decodeShikaku(answer, puzzle.size);
      const covered = shikakuCovered(rects, puzzle.clues, puzzle.size);
      const solved = covered === puzzle.size * puzzle.size;
      isCorrect = solved;
      correctCount = covered;
      if (scoreRev1() && !solved && puzzle.solution?.length) {
        // Rev 1: area of rectangles on the (unique) solution, less the area of other accepted rectangles.
        const key = (r: { r0: number; c0: number; r1: number; c1: number }) => `${r.r0},${r.c0},${r.r1},${r.c1}`;
        const sol = new Set(puzzle.solution.map(key));
        const accepted = acceptedRects(rects, puzzle.clues, puzzle.size);
        const area = (r: { r0: number; c0: number; r1: number; c1: number }) => (r.r1 - r.r0 + 1) * (r.c1 - r.c0 + 1);
        const right = accepted.filter((r) => sol.has(key(r))).reduce((sum, r) => sum + area(r), 0);
        const wrongArea = accepted.filter((r) => !sol.has(key(r))).reduce((sum, r) => sum + area(r), 0);
        score = scoreShikaku(false, ms, timeLimitMs, right - wrongArea);
      } else score = scoreShikaku(solved, ms, timeLimitMs, covered);
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
      const results = gradeNumlineItems(puzzle.stages, puzzle.values ?? [], answer);
      const placed = results.filter((r) => r.placed).length;
      // Finished = every number placed; accuracy decides the score.
      isCorrect = placed === results.length;
      correctCount = placed;
      score = scoreNumline(results, ms, timeLimitMs);
      extraDetail = {
        placed,
        withinFull: results.filter((r) => r.error !== null && r.error <= NUMLINE_FULL_ERROR).length,
        accuracy: Math.round(numlineAccuracy(results) * 10) / 10,
        numlineRev: puzzle.numlineRev,
        errors: results.map((r) => (r.error === null ? null : Math.round(r.error * 10_000) / 10_000)),
      };
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
      const selections = wsDecode(answer, puzzle.size);
      const verdict = wsGrade(puzzle.placements ?? [], selections);
      const total = puzzle.placements?.length ?? puzzle.wordCount;
      isCorrect = verdict.found.length === total;
      correctCount = verdict.found.length;
      errors = verdict.wrong;
      score = scoreWordSearch(verdict.found.length, total, verdict.wrong, ms, timeLimitMs);
      extraDetail = { found: verdict.found.length, total, wrong: verdict.wrong };
      break;
    }
    case "letterwheel": {
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
      const placed = swapwordPlaced(puzzle.start, run.board, solution);
      const left = [...run.board].filter((ch, t) => ch !== solution[t]).length;
      isCorrect = run.solved;
      correctCount = placed;
      const toPlace = [...puzzle.start].filter((ch, t) => ch !== solution[t]).length;
      const displaced = [...puzzle.start].filter((ch, t) => ch === solution[t] && run.board[t] !== solution[t]).length;
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
        const sol = new Set(puzzle.solution);
        const right = bulbs.filter((b) => sol.has(b)).length;
        score = scoreLightUp(false, ms, timeLimitMs, right, Math.max(1, sol.size - 1), bulbs.length - right);
      } else score = scoreLightUp(solved, ms, timeLimitMs, status.lit.size, status.whites, status.clashing.size);
      extraDetail = { solved, lit: status.lit.size, whites: status.whites, clashing: status.clashing.size, bulbs: bulbs.length };
      break;
    }
    case "tents": {
      // The layout is re-checked against the rules and the stored solution.
      const treeSet = new Set(puzzle.trees);
      const tents = decodeTents(answer, puzzle.size).filter((cell) => !treeSet.has(cell));
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
