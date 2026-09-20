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
import { decodeBombActions, replayBomb } from "./bomb";
import { decodeGravityTilts, replayGravity } from "./gravity";
import { decodeChainTaps, replayChain } from "./chain";
import { decodeIntruderTaps, replayIntruder } from "./intruder";
import { decodeNonoCells, replayNonogram } from "./nonogram";
import { decodePairFlips, replayPairs } from "./pairmatch";
import { decodeFloodMoves, replayFlood } from "./flood";
import { validateLadder } from "./wordLadder.server";
import { checkAnswer } from "./puzzles";
import { countPatternAnswers } from "./pattern";
import { decodeMoves, replayUnblock } from "./unblock";
import { puzzleTimeLimitMs } from "./registry";
import { decodeSteps, formatStep, replayTargetSteps } from "./target";
import {
  scoreGoNoGo,
  scoreGroups,
  scoreWordLadder,
  scoreNumberClimb,
  scoreNumberHunt,
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
} from "./scoring";
import {
  GONOGO_ITEMS,
  NUMHUNT_COUNT,
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
  const answer = typeof rawAnswer === "string" ? rawAnswer.slice(0, 4_000) : "";
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
      score = scoreWordLadder(isCorrect, correctCount, shortestLength, ms);
      extraDetail = { rungsUsed: correctCount + 1, shortestLength };
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
      reactionAvgMs = clamp(extra.reactionAvgMs ?? REACTION_PENALTY_MS, 0, 5_000);
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
      const distances = answer
        .split(",")
        .map((v) => Number.parseInt(v, 10))
        .filter((v) => Number.isFinite(v))
        .map((v) => clamp(v, 0, STOPWATCH_MISS_MS));
      reactionAvgMs = distances.length
        ? Math.round(distances.reduce((a, b) => a + b, 0) / distances.length)
        : STOPWATCH_MISS_MS;
      isCorrect = true;
      score = scoreStopWatch(reactionAvgMs);
      storedMs = 0;
      break;
    }
    case "numhunt": {
      const reached = Number.parseInt(answer.split(",")[0] ?? "0", 10);
      errors = clamp(extra.errors ?? 0, 0, 99);
      const finished = Number.isFinite(reached) && reached >= NUMHUNT_COUNT;
      isCorrect = finished;
      score = scoreNumberHunt(finished, ms, errors);
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
      const replay = replayUnblock(puzzle.vehicles, decodeMoves(answer));
      const min = puzzle.minMoves ?? 0;
      isCorrect = replay.solved;
      score = scoreUnblock(replay.solved, ms, replay.moves, min);
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
      score = scoreLightsOut(isCorrect, presses.length, min, ms, startOn - leftOn, startOn);
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
      const away = replay.solved
        ? null
        : slideDistance(puzzle.walls, holes, replay.cell, puzzle.exit, puzzle.start, arrows);
      isCorrect = replay.solved;
      correctCount = replay.moves;
      score = scoreIceSlide(replay.solved, replay.moves, min, ms, away);
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
      // The action list is replayed against the stored sequence, strikes included.
      const required = decodeBombActions(puzzle.sequence ?? "");
      const replay = replayBomb(required, decodeBombActions(answer));
      isCorrect = replay.defused;
      correctCount = replay.steps;
      score = scoreBomb(replay.defused, replay.strikes, ms, replay.steps);
      extraDetail = {
        defused: replay.defused,
        exploded: replay.exploded,
        strikes: replay.strikes,
        steps: replay.steps,
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
      score = scoreGravity(replay.solved, replay.tilts, puzzle.minMoves ?? 0, ms, replay.onTarget);
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
    default: {
      isCorrect = answer.length > 0 && checkAnswer(puzzle, answer);
      score = scoreRound(isCorrect, ms, timeLimitMs);
    }
  }

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
