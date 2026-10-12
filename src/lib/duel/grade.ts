import { buildArcadeReveal } from "@/lib/arcade/reveal";
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
import { decodeLaserAnswer, verifyLaser } from "./laser";
import { decodeTowerMoves, replayTower } from "./tower";
import { decodeMazePath, verifyMazePath } from "./maze";
import { decodeTubeMoves, replayTubes } from "./tubes";
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
import { decodeSnipRun, replaySnipRun } from "./snip";
import { decodeTiltRun, replayTiltRun } from "./tilt";
import { decodeHotFloorRun, replayHotFloorRun } from "./hotFloor";
import { replayColourClashRun } from "./colourClash";
import { clashVariantOf } from "@/lib/arcade/colourClash";
import { decodeTents, scoreTents, tentsLayoutValid } from "./tents";
import { decodeShikaku, scoreShikaku, shikakuCovered } from "./shikaku";
import { decodeBulbs, lightUpStatus, scoreLightUp } from "./lightUp";
import { decodeBallTrackRun, replayBallTrackRun } from "./ballTrack";
import { scoreTrail, trComplete, trCorrectPrefix, trCorrectTiles, trDecode } from "./trail";
import { npComplete, npCorrectCells, npDecode, npDecodeRound, scoreNumberPyramid } from "./numberPyramid";
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
import { balanceRoundScore, balanceSolvedCount, BAL_SCALES, decodeBalance } from "./balance";
import { decodeSlideTokens, markedRowWord, replayWordSlide, WS_MARKED_ROWS } from "./wordSlide";
import { checkWordSlideRow, markedRowsSolved } from "./wordSlide.server";
import { checkAnswer } from "./puzzles";
import { countPatternAnswers } from "./pattern";
import { decodeMoves, replayUnblock } from "./unblock";
import { puzzleTimeLimitMs } from "./registry";
import { decodeSteps, formatStep, replayTargetSteps } from "./target";
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
  STROOP_ITEMS,
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
 * The single place an answer is checked and scored. Runs on the server only —
 * for real rooms (submit_answer) and for practice mode alike.
 */
export function gradeSubmission(
  puzzle: PuzzleData,
  rawAnswer: string,
  msRemaining: number,
  rawExtra?: SubmitExtra,
): Graded {
  const extra = rawExtra ?? {};
  // Arcade runs carry a full input log (one event a tick at most), so they get a
  // far larger allowance; cutting a log short silently changes the replay.
  const answerCap = ARCADE_DIAG_KEYS.has(puzzle.type) ? 400_000 : 4_000;
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
      score = scoreTileGrid(verdict.valid, verdict.placed, verdict.wordTiles, wordSpeedBonus(ms, timeLimitMs));
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
      const solved = balanceSolvedCount(puzzle.scales, decodeBalance(answer, puzzle.scales));
      correctCount = solved;
      isCorrect = solved === BAL_SCALES;
      score = balanceRoundScore(solved, ms, timeLimitMs);
      extraDetail = { solved };
      break;
    }
    case "wordslide": {
      // Every swipe, Undo and Reset is replayed on the stored grid.
      const replay = replayWordSlide(puzzle.grid, decodeSlideTokens(answer));
      const rows = markedRowsSolved(replay.grid);
      isCorrect = rows === WS_MARKED_ROWS.length;
      correctCount = rows;
      score = scoreWordSlide(rows, WS_MARKED_ROWS.length, ms, timeLimitMs, replay.moves, puzzle.par);
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
      isCorrect = replay.correct >= replay.total;
      score = replay.score;
      storedMs = 0;
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
      // The phone sends every cell it tapped; the three differences live
      // server-side, so only the stored answers decide the score.
      const tapped = answer
        .split(",")
        .map((v) => Number.parseInt(v, 10))
        .filter((v) => Number.isFinite(v));
      const differences = puzzle.differences ?? [];
      correctCount = differences.filter((d) => d.cells.some((c) => tapped.includes(c))).length;
      isCorrect = correctCount >= SPOT_DIFFERENCES;
      score = scoreSpotDifference(correctCount, ms, timeLimitMs);
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
      const distance = replay.distance ?? Number.MAX_SAFE_INTEGER;
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
        if (before > 0) progress = Math.max(0, (before - after) / before) * 0.9;
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
      score = scoreBlockParty(verdict.solved, ms, verdict.legal.length, timeLimitMs);
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
      score = scoreLightsOut(isCorrect, actions.filter((cell) => cell >= 0).length, min, ms, leftOn, correctTaps, timeLimitMs);
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
      score = scorePipes(verdict.solved, verdict.connected, ms, timeLimitMs);
      extraDetail = { solved: verdict.solved, connected: verdict.connected };
      break;
    }
    case "sudoku": {
      // Checked against the rules themselves, not just the stored grid.
      const verdict = gradeSudokuGrid(puzzle.givens, puzzle.solution ?? [], answer);
      isCorrect = verdict.solved;
      correctCount = verdict.correct;
      score = scoreSudoku(verdict.solved, verdict.correct, verdict.total, ms, timeLimitMs);
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
      score = scoreFlow(verdict.solved, verdict.pairsJoined, ms, puzzle.pairs.length, timeLimitMs);
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
          progress = Math.max(0, 1 - Math.min(...best) / startDistance);
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
      score = scorePush(replay.solved, replay.pushes, min, ms, home, puzzle.targets.length, timeLimitMs);
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
      score = scoreMaze(verdict.solved, verdict.progress, ms, timeLimitMs);
      extraDetail = {
        solved: verdict.solved,
        progress: Math.round(verdict.progress * 100),
        wasted: verdict.wasted,
      };
      break;
    }
    case "tubes": {
      // Every pour is replayed on the stored board, so illegal pours never count.
      const replay = replayTubes(puzzle.tubes, decodeTubeMoves(answer));
      isCorrect = replay.solved;
      correctCount = replay.moves;
      score = scoreTubes(replay.solved, replay.moves, puzzle.minMoves ?? 0, ms, replay.sorted, timeLimitMs);
      extraDetail = {
        solved: replay.solved,
        moves: replay.moves,
        minMoves: puzzle.minMoves ?? 0,
        sorted: replay.sorted,
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
      const replay = replayGravity(puzzle.walls, puzzle.starts, puzzle.targets, decodeGravityTilts(answer));
      isCorrect = replay.solved;
      correctCount = replay.tilts;
      score = scoreGravity(replay.solved, replay.tilts, puzzle.minMoves ?? 0, ms, replay.locked, timeLimitMs);
      extraDetail = {
        solved: replay.solved,
        tilts: replay.tilts,
        minMoves: puzzle.minMoves ?? 0,
        locked: replay.locked,
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
      score = scorePairMatch(replay.solved, replay.pairs, ms, timeLimitMs);
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
      const replay = replayFlood(puzzle.grid, decodeFloodMoves(answer));
      isCorrect = replay.solved;
      correctCount = replay.region;
      score = scoreFlood(replay.solved, replay.moves, puzzle.par, replay.region, ms, timeLimitMs);
      extraDetail = {
        solved: replay.solved,
        moves: replay.moves,
        par: puzzle.par,
        region: replay.region,
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
      score = scoreTiles(replay.solved, replay.moves, puzzle.minMoves ?? 0, replay.inPlace, ms, timeLimitMs);
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
      score = scoreRings(replay.solved, replay.moves, puzzle.minMoves ?? 0, replay.aligned, ms, timeLimitMs);
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
      const run = replaySkylineRun(puzzle.seed, answer);
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
      const run = replayBreakerRun(puzzle.seed, answer);
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
      const run = replayTenDropRun(puzzle.seed, answer);
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
      const run = replayWavefrontRun(puzzle.seed, answer);
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
      const run = replayJunctionRun(puzzle.seed, answer);
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
      const run = replayBurstRun(puzzle.seed, answer);
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
      const run = replayTiltRun(puzzle.seed, answer);
      revealRun = run;
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.state.ended === 1;
      correctCount = run.mazes;
      score = run.score;
      extraDetail = {
        mazes: run.mazes,
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
      score = scoreShikaku(solved, ms, timeLimitMs, covered);
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
      score = scoreTrail(complete, ms, timeLimitMs, correctCount);
      extraDetail = { complete, prefix, correctTiles: correctCount, drawn: path.filter((cell) => cell >= 0).length };
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
      const active = boards[decoded.active];
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
      isCorrect = v.totalCells > 0 && v.cells >= v.totalCells;
      correctCount = v.slots.length;
      errors = v.wrong;
      score = scoreLetterWheel(v.slots.length, puzzle.slots.length, ms, timeLimitMs);
      extraDetail = { slots: v.slots.length, total: puzzle.slots.length, cells: v.cells, totalCells: v.totalCells };
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
      score = scoreLightUp(solved, ms, timeLimitMs, status.lit.size, status.whites, status.clashing.size);
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
      const parts = splitStages(answer, puzzle.stages.length);
      const correct = puzzle.stages.map((stage, i) => equationStageCorrect(stage.numbers, stage.target, parts[i] ?? ""));
      correctCount = correct.filter(Boolean).length;
      isCorrect = puzzle.stages.length > 0 && correctCount === puzzle.stages.length;
      score = scoreEquationStages(correct, ms);
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
    answer,
    isCorrect,
    score,
    reactionAvgMs,
    correctCount,
    errors,
    extra: extraDetail,
    storedMs,
  };
}
