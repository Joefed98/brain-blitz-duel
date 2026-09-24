import { ARCADE_DIAG_KEYS, buildArcadeDiag, type ArcadeDiag } from "@/lib/arcade/diagnostics";
import { decodePlacements, encodePlacements, verifyPlacements } from "./blockParty";
import { decodeGroupsAnswer, matchGroupsSelection } from "./groups.server";
import { decodePresses, decodeSides, lightsAllOff, lightsOnCount, replayLights } from "./logic";
import { gradePipesBoard, gradeSudokuGrid } from "./logic.server";
import { numberClimbSpan } from "./numberClimb";
import { decodeFlowPaths, verifyFlow } from "./flow";
import { decodeSlideMoves, replaySlide, slideDistance } from "./slide";
import { cratesOnTargets, decodePushMoves, replayPush } from "./push";
import { decodeLaserAnswer, verifyLaser } from "./laser";
import { decodeTowerMoves, replayTower } from "./tower";
import { decodeMazePath, verifyMazePath } from "./maze";
import { decodeTubeMoves, replayTubes } from "./tubes";
import { dialsCorrect, decodeSafeTries, safeOpenedOn } from "./safe";
import { checkBombPlan, decodeBombActions, decodeBombConstraints } from "./bomb";
import { decodeGravityTilts, replayGravity } from "./gravity";
import { gravityDistance } from "./gravity.server";
import { blockingCars } from "./unblock.server";
import { decodeChainTaps, replayChain } from "./chain";
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
import { decodeCrossRun, replayCrossRun } from "./cross";
import { decodeDualRun, replayDualRun } from "./dual";
import { decodeRicoRun, replayRicoRun } from "./ricochet";
import { decodeBinTossRun, replayBinTossRun } from "./binToss";
import { decodeBullseyeRun, replayBullseyeRun } from "./bullseye";
import { decodeMatchupRun, replayMatchupRun } from "./matchup";

import { validateLadder } from "./wordLadder.server";
import { checkAnswer } from "./puzzles";
import { countPatternAnswers } from "./pattern";
import { decodeMoves, replayUnblock } from "./unblock";
import { puzzleTimeLimitMs } from "./registry";
import { decodeSteps, formatStep, replayTargetSteps } from "./target";
import {
  scoreGoNoGo,
  scoreGroups,
  scoreEquation,
  scoreCountUp,
  scoreWordLadder,
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
  scoreSymbolScan,
  scoreStroop,
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
  GONOGO_ITEMS,
  NUMHUNT_COUNT,
  NUMSEQ_ITEMS,
  PCTSPRINT_ITEMS,
  REACTION_PENALTY_MS,
  ROUND_MS,
  SPOT_DIFFERENCES,
  STOPWATCH_MISS_MS,
  MIRMATCH_ITEMS,
  SPIN_ITEMS,
  STROOP_ITEMS,
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
      const attempts = answer.split(",").slice(0, 3).map((value) => Number.parseInt(value, 10));
      const total = Array.from({ length: 3 }, (_, index) => {
        const attempt = attempts[index];
        return attempt === undefined || !Number.isFinite(attempt)
          ? REACTION_PENALTY_MS
          : clamp(attempt, 0, REACTION_PENALTY_MS);
      });
      reactionAvgMs = Math.round(total.reduce((sum, attempt) => sum + attempt, 0) / 3);
      isCorrect = true;
      score = scoreReaction(reactionAvgMs);
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
      correctCount = clamp(extra.correctCount ?? 0, 0, STROOP_ITEMS);
      isCorrect = correctCount >= STROOP_ITEMS;
      score = scoreStroop(correctCount, ms);
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
      score = scoreSpotDifference(correctCount, ms);
      break;
    }
    case "symscan": {
      const selected = new Set(
        answer
          .split(",")
          .map((v) => Number.parseInt(v, 10))
          .filter(Number.isFinite),
      );
      correctCount = puzzle.targets.filter((target) => selected.has(target)).length;
      errors = [...selected].filter((index) => !puzzle.targets.includes(index)).length;
      isCorrect = correctCount === puzzle.targets.length && errors === 0;
      score = scoreSymbolScan(correctCount, puzzle.targets.length, errors, ms);
      break;
    }
    case "stopwatch": {
      const distances = answer.split(",").slice(0, 3).map((v) => Number.parseInt(v, 10));
      const total = Array.from({ length: 3 }, (_, index) => {
        const distance = distances[index];
        return distance === undefined || !Number.isFinite(distance)
          ? STOPWATCH_MISS_MS
          : clamp(distance, 0, STOPWATCH_MISS_MS);
      });
      reactionAvgMs = Math.round(total.reduce((a, b) => a + b, 0) / 3);
      isCorrect = true;
      score = scoreStopWatch(reactionAvgMs);
      storedMs = 0;
      break;
    }
    case "numhunt": {
      const parsed = Number.parseInt(answer.split(",")[0] ?? "0", 10);
      const reached = Number.isFinite(parsed) ? clamp(parsed, 0, NUMHUNT_COUNT) : 0;
      errors = clamp(extra.errors ?? 0, 0, 99);
      const finished = reached >= NUMHUNT_COUNT;
      isCorrect = finished;
      correctCount = reached;
      score = scoreNumberHunt(finished, ms, errors, reached, NUMHUNT_COUNT);
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
      score = scoreUnblock(replay.solved, ms, replay.moves, min, progress, fewerBlockers);
      extraDetail = { solved: replay.solved, moves: replay.moves, minMoves: min };
      break;
    }
    case "blockparty": {
      // Only placements that are legal together count towards the coverage.
      const verdict = verifyPlacements(puzzle.blockers, decodePlacements(answer));
      isCorrect = verdict.solved;
      score = scoreBlockParty(verdict.solved, ms, verdict.covered);
      extraDetail = {
        solved: verdict.solved,
        covered: verdict.covered,
        placements: encodePlacements(verdict.legal),
      };
      break;
    }
    case "lightsout": {
      // The phone sends its presses; they are replayed on the stored pattern.
      const presses = decodePresses(answer);
      const finalState = replayLights(puzzle.lights, presses);
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
      score = scoreLightsOut(isCorrect, presses.length, min, ms, leftOn, correctTaps);
      extraDetail = {
        presses: presses.length,
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
      score = scorePipes(verdict.solved, verdict.connected, ms);
      extraDetail = { solved: verdict.solved, connected: verdict.connected };
      break;
    }
    case "sudoku": {
      // Checked against the rules themselves, not just the stored grid.
      const verdict = gradeSudokuGrid(puzzle.givens, puzzle.solution ?? [], answer);
      isCorrect = verdict.solved;
      correctCount = verdict.correct;
      score = scoreSudoku(verdict.solved, verdict.correct, verdict.total, ms);
      extraDetail = { solved: verdict.solved, correct: verdict.correct, total: verdict.total };
      break;
    }
    case "flow": {
      // Every path the phone sends is re-walked here: contiguous, ending on the
      // right dots, and sharing no cell with another colour.
      const paths = decodeFlowPaths(answer, puzzle.pairs.length || FLOW_PAIRS);
      const verdict = verifyFlow(puzzle.pairs, paths);
      isCorrect = verdict.solved;
      correctCount = verdict.pairsJoined;
      score = scoreFlow(verdict.solved, verdict.pairsJoined, ms);
      extraDetail = {
        solved: verdict.solved,
        pairsJoined: verdict.pairsJoined,
        pairs: puzzle.pairs.length,
        filled: verdict.filled,
      };
      break;
    }
    case "iceslide": {
      // The phone sends its slides; they are replayed on the stored layout.
      const moves = decodeSlideMoves(answer);
      const holes = puzzle.holes ?? [];
      const arrows = puzzle.arrows ?? [];
      const replay = replaySlide(puzzle.walls, holes, puzzle.start, puzzle.exit, moves, arrows);
      const min = puzzle.minMoves ?? 0;
      const distanceTo = (cell: number) =>
        slideDistance(puzzle.walls, holes, cell, puzzle.exit, puzzle.start, arrows);
      const away = replay.solved ? null : distanceTo(replay.cell);
      // Credit follows the closest square the ball ever reached.
      let progress = 0;
      if (!replay.solved) {
        const startDistance = distanceTo(puzzle.start);
        const best = replay.visited
          .map(distanceTo)
          .filter((value): value is number => value !== null);
        if (startDistance && startDistance > 0 && best.length > 0) {
          progress = 1 - Math.min(...best) / startDistance;
        }
      }
      isCorrect = replay.solved;
      correctCount = replay.moves;
      score = scoreIceSlide(replay.solved, replay.moves, min, ms, progress);
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
      score = scorePush(replay.solved, replay.pushes, min, ms, home, puzzle.targets.length);
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
      const shot = decodeLaserAnswer(answer, puzzle.mirrors);
      const verdict = verifyLaser(puzzle, shot.mirrors, shot.fires);
      isCorrect = verdict.solved;
      correctCount = verdict.gemsLit;
      score = scoreLaser(verdict.solved, verdict.gemsLit, verdict.fires, ms);
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
      score = scoreMaze(verdict.solved, verdict.progress, ms);
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
      score = scoreTubes(replay.solved, replay.moves, puzzle.minMoves ?? 0, ms, replay.sorted);
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
      score = scoreSafe(openedOn, ms, right);
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
      score = scoreBomb(replay.defused, ms, replay.correctPrefix);
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
      // Every tilt is replayed on the stored board, both balls at once.
      const replay = replayGravity(
        puzzle.walls,
        { a: puzzle.startA, b: puzzle.startB },
        puzzle.targetA,
        puzzle.targetB,
        decodeGravityTilts(answer),
      );
      isCorrect = replay.solved;
      correctCount = replay.tilts;
      // Credit follows the closest joint position the balls ever reached.
      let progress = 0;
      if (!replay.solved) {
        const wallSet = new Set(puzzle.walls);
        const distanceTo = (balls: { a: number; b: number }) =>
          gravityDistance(wallSet, balls, puzzle.targetA, puzzle.targetB);
        const startDistance = distanceTo({ a: puzzle.startA, b: puzzle.startB });
        const best = replay.states
          .map(distanceTo)
          .filter((value): value is number => value !== null);
        if (startDistance && startDistance > 0 && best.length > 0) {
          progress = 1 - Math.min(...best) / startDistance;
        }
      }
      score = scoreGravity(
        replay.solved,
        replay.tilts,
        puzzle.minMoves ?? 0,
        ms,
        replay.onTarget,
        progress,
      );
      extraDetail = {
        solved: replay.solved,
        tilts: replay.tilts,
        minMoves: puzzle.minMoves ?? 0,
        onTarget: replay.onTarget,
      };
      break;
    }
    case "chain": {
      // The tap list is re-walked against the rule; wrong taps never advance.
      const replay = replayChain(puzzle.nodes, puzzle.cycle, decodeChainTaps(answer));
      isCorrect = replay.completed;
      correctCount = replay.chain.length;
      errors = replay.errors;
      score = scoreChain(replay.completed, replay.chain.length, replay.errors, ms);
      extraDetail = {
        completed: replay.completed,
        correct: replay.chain.length,
        errors: replay.errors,
      };
      break;
    }
    case "intruder": {
      // Taps are checked against the stored changed cells, never a client verdict.
      const replay = replayIntruder(puzzle.answers ?? [], decodeIntruderTaps(answer));
      isCorrect = replay.correct >= (puzzle.answers ?? puzzle.boards).length;
      correctCount = replay.correct;
      score = scoreIntruder(replay.correct, replay.allFirstTry, ms);
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
      score = scoreNonogram(replay.solved, replay.correct, replay.total, replay.wrong, ms);
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
      score = scorePairMatch(replay.solved, replay.pairs, replay.tries, ms);
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
      score = scoreFlood(replay.solved, replay.moves, puzzle.par, replay.region, ms);
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
      score = scoreTiles(replay.solved, replay.moves, puzzle.minMoves ?? 0, replay.inPlace, ms);
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
      const replay = replayRings(puzzle.segments, decodeRingTaps(answer));
      isCorrect = replay.solved;
      correctCount = replay.aligned;
      score = scoreRings(replay.solved, replay.moves, puzzle.minMoves ?? 0, replay.aligned, ms);
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
      const run = replayHoverRun(puzzle.seed, answer);
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.survived;
      correctCount = run.gates;
      score = run.score;
      extraDetail = {
        gates: run.gates,
        totalGates: run.totalGates,
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
      const run = replaySnakeRun(puzzle.seed, answer);
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.survived;
      correctCount = run.pellets;
      score = run.score;
      extraDetail = {
        pellets: run.pellets,
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
      const run = replayCrossRun(puzzle.seed, answer);
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.survived;
      correctCount = run.crossings;
      score = run.score;
      extraDetail = {
        crossings: run.crossings,
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
      const run = replayRallyRun(puzzle.seed, answer);
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.survived;
      correctCount = run.hits;
      score = run.score;
      extraDetail = {
        hits: run.hits,
        goldHits: run.goldHits,
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
      const run = replaySliceRun(puzzle.seed, answer);
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.bombsHit === 0;
      correctCount = run.slices;
      score = run.score;
      extraDetail = {
        slices: run.slices,
        totalDiscs: run.totalDiscs,
        bonuses: run.bonuses,
        bombsHit: run.bombsHit,
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
      const run = replayBubbleRun(puzzle.seed, answer);
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
      const run = replayBeatRun(puzzle.seed, answer);
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
    case "bintoss": {
      // Same rule as the other arcade games: only the server's replay scores.
      const replayStart = performance.now();
      const run = replayBinTossRun(puzzle.seed, answer);
      arcadeDiag = buildArcadeDiag(puzzle.type, run, answer, performance.now() - replayStart);
      if (arcadeDiag.replayMs > 500)
        console.warn(`[arcade] slow replay ${puzzle.type}: ${arcadeDiag.replayMs}ms`);
      isCorrect = run.perfect;
      correctCount = run.baskets;
      score = run.score;
      extraDetail = {
        baskets: run.baskets,
        throws: run.throws,
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
      const run = replayMatchupRun(puzzle.seed, answer);
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
      const run = replayBullseyeRun(puzzle.seed, answer, puzzle.winds);
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
      // A true equation wins outright; otherwise every operator in the right
      // place against the stored solution earns part marks.
      const given = answer
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      isCorrect = answer.length > 0 && checkAnswer(puzzle, answer);
      const inPlace = puzzle.operators.filter((op, i) => given[i] === op).length;
      correctCount = inPlace;
      score = scoreEquation(isCorrect, inPlace, ms, timeLimitMs);
      break;
    }
    case "countup": {
      // The stored count decides everything; a near miss still scores.
      const given = Number.parseInt(answer.trim(), 10);
      const answered = Number.isFinite(given);
      const total = puzzle.count ?? 0;
      isCorrect = answered && given === total;
      score = scoreCountUp(answered, answered ? given : 0, total, ms, timeLimitMs);
      extraDetail = { away: answered ? Math.abs(given - total) : null };
      break;
    }
    default: {
      isCorrect = answer.length > 0 && checkAnswer(puzzle, answer);
      score = scoreRound(isCorrect, ms, timeLimitMs);
    }
  }

  if (arcadeDiag) extraDetail = { ...(extraDetail ?? {}), diag: arcadeDiag };
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
