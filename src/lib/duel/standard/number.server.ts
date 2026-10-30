/**
 * The scoring standard's Number games (docs/scoring-standard.md, "Number decisions"), server only. Each grade starts
 * from the game's own grade (grade.ts) and re-derives what it needs from the answer with the game's own helpers;
 * history (wrong numbers entered, tiles undone) comes from the draft timeline. Tenfall scores in its sim (tenRev 5).
 */
import { gradeCheckoutStages, splitCheckoutRound, decodeCheckoutDarts, checkoutBigFinish } from "../checkout";
import { decodeBalance, balanceScalesSolved } from "../balance";
import { gradeMeasureBoards } from "../measure";
import { balancePlaceLimits, equationTryLimit, measureMoveLimits, splitCountSuffix } from "../moveLimits";
import { exactTilesUsed } from "../numberDepth.server";
import { npComplete, npCorrectCells, npDecode, npDecodeRound } from "../numberPyramid";
import { decodeNumline, gradeNumlineItems } from "../numline";
import { equationStageCorrect, splitStages } from "../stagedRounds";
import { decodeSteps, hasSolutionWithAtMostFourTiles, replayTargetSteps, solveTarget } from "../target";
import { trCorrectPrefix, trCorrectTiles, trDecode } from "../trail";
import type {
  BalancePuzzleData,
  CheckoutPuzzleData,
  EquationPuzzleData,
  MeasurePuzzleData,
  NumberPyramidPuzzleData,
  NumlinePuzzleData,
  TargetNumberPuzzleData,
  TrailPuzzleData,
  PuzzleType,
} from "../types";
import type { StandardGame } from "./grade.server";
import {
  BALLPARK_STD_BULL_MAX,
  BALLPARK_STD_BULL_POINTS,
  BALLPARK_STD_EARLY,
  BALLPARK_STD_ITEM,
  BALLPARK_STD_WILD,
  CHECKOUT_STD_BIG,
  CHECKOUT_STD_BOARD,
  CHECKOUT_STD_EARLY,
  CHECKOUT_STD_FEWEST,
  EXACT_STD_ELEGANCE,
  EXACT_STD_ELEGANCE_PER,
  NUMBER_CLEAN_EACH,
  NUMBER_PART_EARLY,
  NUMBER_PART_POINTS,
  NUMBER_SHARE_EARLY,
  NUMBER_SHARE_POINTS,
  NUMBER_STANDARD,
  ballparkAccuracy,
  checkoutBigBoards,
  exactCloseCredit,
  isStdBullseye,
} from "./number";
import { STANDARD_FINISH, cleanPoints, earlyPoints, parPoints, speedPoints } from "./shape";

function speedFor(type: keyof typeof NUMBER_STANDARD, msLeft: number, limitMs: number): number {
  const g = NUMBER_STANDARD[type]!;
  return speedPoints(g.speed, msLeft, limitMs, g.fullByS * 1000);
}

/* ------------------------------------------------------------------ Exact */

const minTilesCache = new Map<string, number>();

/** The fewest starting numbers any exact answer needs (6 when none is found with fewer). */
export function exactMinTiles(tiles: readonly number[], target: number): number {
  const key = `${tiles.join(",")}>${target}`;
  const hit = minTilesCache.get(key);
  if (hit !== undefined) return hit;
  let min = tiles.length;
  if (hasSolutionWithAtMostFourTiles([...tiles], target)) {
    outer: for (let k = 1; k <= 4; k++) for (const subset of subsets(tiles.length, k)) if (solveTarget(subset.map((i) => tiles[i]!), target)) { min = k; break outer; }
  } else {
    // No answer from four or fewer: any answer from five of the tiles uses all five.
    for (const subset of subsets(tiles.length, 5)) if (solveTarget(subset.map((i) => tiles[i]!), target)) { min = 5; break; }
  }
  if (minTilesCache.size > 512) minTilesCache.clear();
  minTilesCache.set(key, min);
  return min;
}

function subsets(n: number, k: number): number[][] {
  const out: number[][] = [];
  const pick: number[] = [];
  const rec = (start: number) => {
    if (pick.length === k) return void out.push([...pick]);
    for (let i = start; i < n; i++) {
      pick.push(i);
      rec(i + 1);
      pick.pop();
    }
  };
  rec(0);
  return out;
}

/** The closest any number the player made (any step's result, over every prefix of the steps) came to the target. */
export function exactBestDistance(puzzle: TargetNumberPuzzleData, answer: string): number | null {
  const replay = replayTargetSteps(puzzle.tiles, puzzle.target, decodeSteps(answer));
  let best: number | null = null;
  for (const step of replay.steps) {
    const d = Math.abs(step.result - puzzle.target);
    if (best === null || d < best) best = d;
  }
  return best;
}

const exact: StandardGame = {
  grade({ puzzle, answer, graded, msLeft, limitMs }) {
    const p = puzzle as TargetNumberPuzzleData;
    if (graded.isCorrect) {
      const used = exactTilesUsed(p, answer);
      const min = exactMinTiles(p.tiles, p.target);
      const elegance = used === null ? 0 : cleanPoints(EXACT_STD_ELEGANCE, EXACT_STD_ELEGANCE_PER, used - min);
      return { finished: true, speed: speedFor("target", msLeft, limitMs), bonus: elegance, measure: "elegance", facts: { tilesUsed: used, minTiles: min } };
    }
    const best = exactBestDistance(p, answer);
    return { finished: false, credit: exactCloseCredit(best), facts: { bestDistance: best } };
  },
};

/* ------------------------------------------------------------------ Operator */

function equationVerdicts(puzzle: EquationPuzzleData, answer: string): { correct: boolean[]; tries: number[] } {
  const tryLimit = equationTryLimit(puzzle);
  const { body, counts: tries } = tryLimit !== null ? splitCountSuffix(answer) : { body: answer, counts: [] as number[] };
  const parts = splitStages(body, puzzle.stages.length);
  const correct = puzzle.stages.map((stage, i) => equationStageCorrect(stage.numbers, stage.target, parts[i] ?? "") && (tryLimit === null || (tries[i] ?? 0) <= tryLimit));
  return { correct, tries };
}

const operator: StandardGame = {
  parts: (puzzle, draft) => equationVerdicts(puzzle as EquationPuzzleData, draft).correct.filter(Boolean).length,
  grade({ puzzle, answer, graded, msLeft, limitMs }, ctx) {
    const { correct, tries } = equationVerdicts(puzzle as EquationPuzzleData, answer);
    const right = correct.filter(Boolean).length;
    // Solved without a wrong attempt: the equation's one full set of signs was right (its only try).
    const clean = correct.filter((ok, i) => ok && (tries[i] ?? 0) <= 1).length;
    const cleanPts = Math.min(NUMBER_STANDARD.equation!.bonus, NUMBER_CLEAN_EACH * clean);
    const facts = { equationsRight: right, cleanEquations: clean };
    if (graded.isCorrect) return { finished: true, speed: speedFor("equation", msLeft, limitMs), bonus: cleanPts, measure: "clean", facts };
    return { finished: false, credit: NUMBER_PART_POINTS * right + ctx.early(NUMBER_PART_EARLY, right) + cleanPts, facts };
  },
};

/* ------------------------------------------------------------------ Counterweight */

function balanceVerdicts(puzzle: BalancePuzzleData, answer: string): { balanced: boolean[]; hangs: number[] } {
  const placeLimits = balancePlaceLimits(puzzle);
  const { body, counts: hangs } = placeLimits ? splitCountSuffix(answer) : { body: answer, counts: [] as number[] };
  const placements = decodeBalance(body, puzzle.scales);
  const balanced = balanceScalesSolved(puzzle.scales, placements).map((ok, s) => ok && (!placeLimits || (hangs[s] ?? 0) <= (placeLimits[s] ?? 0)));
  return { balanced, hangs };
}

const counterweight: StandardGame = {
  parts: (puzzle, draft) => balanceVerdicts(puzzle as BalancePuzzleData, draft).balanced.filter(Boolean).length,
  grade({ puzzle, answer, graded, msLeft, limitMs }, ctx) {
    const p = puzzle as BalancePuzzleData;
    const { balanced, hangs } = balanceVerdicts(p, answer);
    const scales = balanced.filter(Boolean).length;
    if (graded.isCorrect) {
      // Par hangs: every tray weight hung once (the fewest hangs a scale can take), over the four scales together.
      const par = p.scales.reduce((sum, scale) => sum + scale.tray.length, 0);
      const used = p.scales.reduce((sum, scale, s) => sum + Math.max(scale.tray.length, hangs[s] ?? 0), 0);
      return { finished: true, speed: speedFor("balance", msLeft, limitMs), bonus: parPoints(NUMBER_STANDARD.balance!.bonus, used, par), measure: "par", facts: { hangsUsed: used, parHangs: par } };
    }
    return { finished: false, credit: NUMBER_PART_POINTS * scales + ctx.early(NUMBER_PART_EARLY, scales), facts: { scalesBalanced: scales } };
  },
};

/* ------------------------------------------------------------------ Integer Pyramid */

interface PyramidBoard {
  complete: boolean;
  correct: number;
  empty: number;
}

function pyramidBoards(puzzle: NumberPyramidPuzzleData, answer: string): PyramidBoard[] {
  const decoded = npDecodeRound(answer);
  return puzzle.pyramids.map((board, i) => {
    const placements = npDecode(decoded.boards[i] ?? "", board.givens, board.tray.length);
    return {
      complete: npComplete(board.givens, board.tray, placements, board.rows),
      correct: npCorrectCells(board.givens, board.tray, puzzle.solutions?.[i] ?? [], placements),
      empty: board.givens.filter((g) => g == null).length,
    };
  });
}

/** The pyramids that ever held a wrong number (a tile whose value is not the cell's), from the drafts. */
function pyramidsEverWrong(puzzle: NumberPyramidPuzzleData, drafts: readonly { draft: string }[]): boolean[] {
  const wrong = puzzle.pyramids.map(() => false);
  for (const { draft } of drafts) {
    const decoded = npDecodeRound(draft);
    puzzle.pyramids.forEach((board, i) => {
      if (wrong[i]) return;
      const solution = puzzle.solutions?.[i] ?? [];
      const placements = npDecode(decoded.boards[i] ?? "", board.givens, board.tray.length);
      for (const [cell, tray] of Object.entries(placements)) if (board.tray[tray] !== solution[Number(cell)]) wrong[i] = true;
    });
  }
  return wrong;
}

const pyramid: StandardGame = {
  parts: (puzzle, draft) => pyramidBoards(puzzle as NumberPyramidPuzzleData, draft).filter((b) => b.complete).length,
  grade({ puzzle, answer, graded, msLeft, limitMs, drafts }, ctx) {
    const p = puzzle as NumberPyramidPuzzleData;
    const boards = pyramidBoards(p, answer);
    const done = boards.filter((b) => b.complete).length;
    // No timeline, no history: the clean bonus needs it (0 without).
    const everWrong = drafts ? pyramidsEverWrong(p, drafts) : boards.map(() => true);
    const clean = boards.filter((b, i) => b.complete && !everWrong[i]).length;
    const cleanPts = Math.min(NUMBER_STANDARD.numpyramid!.bonus, NUMBER_CLEAN_EACH * clean);
    const facts = { pyramidsDone: done, cleanPyramids: clean };
    if (graded.isCorrect) return { finished: true, speed: speedFor("numpyramid", msLeft, limitMs), bonus: cleanPts, measure: "clean", facts };
    // The current pyramid is the first unfinished one (they are played in order), as rev 1 reads it.
    const current = boards.find((b) => !b.complete);
    const share = current && current.empty > 0 ? Math.min(0.99, Math.min(current.correct, current.empty) / current.empty) : 0;
    const credit = (NUMBER_SHARE_POINTS * (done + share)) / Math.max(1, p.pyramids.length) + ctx.early(NUMBER_SHARE_EARLY / Math.max(1, p.pyramids.length), done) + cleanPts;
    return { finished: false, credit, facts };
  },
};

/* ------------------------------------------------------------------ Trail */

function trailPath(puzzle: TrailPuzzleData, draft: string): number[] {
  return trDecode(draft, puzzle.givens.length);
}

/** True when some placed tile was later taken back (a draft's tile not where the next draft has it). */
function trailEverUndone(puzzle: TrailPuzzleData, drafts: readonly { draft: string }[]): boolean {
  let prev: number[] = [];
  for (const { draft } of drafts) {
    const path = trailPath(puzzle, draft);
    for (let i = 0; i < prev.length; i++) {
      const cell = prev[i]!;
      if (cell >= 0 && puzzle.givens[cell] === null && path[i] !== cell) return true;
    }
    prev = path;
  }
  return false;
}

const trail: StandardGame = {
  parts: (puzzle, draft) => {
    const p = puzzle as TrailPuzzleData;
    return trCorrectTiles(p.givens, trailPath(p, draft), p.solution ?? []);
  },
  grade({ puzzle, answer, graded, msLeft, limitMs, drafts }, ctx) {
    const p = puzzle as TrailPuzzleData;
    const path = trailPath(p, answer);
    const solution = p.solution ?? [];
    const right = trCorrectTiles(p.givens, path, solution);
    if (graded.isCorrect) {
      const undone = drafts ? trailEverUndone(p, drafts) : true;
      return { finished: true, speed: speedFor("trail", msLeft, limitMs), bonus: undone ? 0 : NUMBER_STANDARD.trail!.bonus, measure: "clean", facts: { cleanPath: !undone } };
    }
    // Tiles in their right square, less the wrong ones (today's cost), or the right run from the start, whichever is more.
    const toPlace = p.givens.filter((g) => g === null).length;
    const prefix = trCorrectPrefix(path, solution);
    const inPrefix = path.slice(0, prefix).filter((cell) => cell >= 0 && p.givens[cell] === null).length;
    const placed = path.filter((cell, i) => cell >= 0 && p.givens[cell] === null && i < p.givens.length).length;
    const share = toPlace > 0 ? Math.max(inPrefix, right - (placed - right)) / toPlace : 0;
    const credit = NUMBER_SHARE_POINTS * share + ctx.early(NUMBER_SHARE_EARLY / Math.max(1, toPlace), right);
    return { finished: false, credit, facts: { tilesRight: right } };
  },
};

/* ------------------------------------------------------------------ Brimful */

function measureResults(puzzle: MeasurePuzzleData, answer: string) {
  return gradeMeasureBoards(puzzle.boards, puzzle.minMoves ?? [], answer, measureMoveLimits(puzzle));
}

const brimful: StandardGame = {
  parts: (puzzle, draft) => measureResults(puzzle as MeasurePuzzleData, draft).filter((r) => r.solved).length,
  grade({ puzzle, answer, graded, msLeft, limitMs }, ctx) {
    const p = puzzle as MeasurePuzzleData;
    const results = measureResults(p, answer);
    const solved = results.filter((r) => r.solved).length;
    if (graded.isCorrect) {
      // Par pours over the four puzzles together: total actions against the total of their par (their fewest).
      const par = results.reduce((sum, r, i) => sum + (p.par?.[i] ?? r.minMoves), 0);
      const used = results.reduce((sum, r) => sum + r.moves, 0);
      return { finished: true, speed: speedFor("measure", msLeft, limitMs), bonus: parPoints(NUMBER_STANDARD.measure!.bonus, used, par), measure: "par", facts: { pours: used, parPours: par } };
    }
    return { finished: false, credit: NUMBER_PART_POINTS * solved + ctx.early(NUMBER_PART_EARLY, solved), facts: { puzzlesSolved: solved } };
  },
};

/* ------------------------------------------------------------------ Checkout */

/** Big-finish points: the boards that pay share CHECKOUT_STD_BIG evenly; each solved on a big finish earns its share. */
export function checkoutBigPoints(puzzle: CheckoutPuzzleData, answer: string, solved: readonly boolean[]): { points: number; big: number; boards: number } {
  const eligible = checkoutBigBoards(puzzle.stages);
  const boards = eligible.filter(Boolean).length;
  if (!boards) return { points: 0, big: 0, boards: 0 };
  const parts = splitCheckoutRound(answer);
  let big = 0;
  puzzle.stages.forEach((stage, i) => {
    if (!eligible[i] || !solved[i]) return;
    const darts = decodeCheckoutDarts(parts[i] ?? "", stage.maxDarts);
    if (checkoutBigFinish(stage, darts[darts.length - 1])) big++;
  });
  return { points: (CHECKOUT_STD_BIG * big) / boards, big, boards };
}

const checkout: StandardGame = {
  parts: (puzzle, draft) => {
    const p = puzzle as CheckoutPuzzleData;
    return gradeCheckoutStages(p.stages, p.minDarts ?? [], draft).filter((r) => r.solved).length;
  },
  grade({ puzzle, answer, graded, msLeft, limitMs }, ctx) {
    const p = puzzle as CheckoutPuzzleData;
    const results = gradeCheckoutStages(p.stages, p.minDarts ?? [], answer);
    const solved = results.map((r) => r.solved);
    const count = solved.filter(Boolean).length;
    // A big finish is earned board by board, so it counts towards an unfinished score too.
    const big = checkoutBigPoints(p, answer, solved);
    const facts = { boardsSolved: count, bigFinishes: big.big, bigBoards: big.boards };
    if (graded.isCorrect) {
      const min = results.reduce((sum, r) => sum + r.minDarts, 0);
      const darts = results.reduce((sum, r) => sum + r.darts, 0);
      const fewest = parPoints(CHECKOUT_STD_FEWEST, darts, min);
      return { finished: true, speed: speedFor("checkout", msLeft, limitMs), bonus: fewest + big.points, measure: "bonus", facts: { ...facts, darts, fewestDarts: min } };
    }
    return { finished: false, credit: CHECKOUT_STD_BOARD * count + ctx.early(CHECKOUT_STD_EARLY, count) + big.points, facts };
  },
};

/* ------------------------------------------------------------------ Ballpark */

const ballpark: StandardGame = {
  parts: (_puzzle, draft) => decodeNumline(draft).length,
  grade({ puzzle, answer, graded, msLeft, limitMs }, ctx) {
    const p = puzzle as NumlinePuzzleData;
    const results = gradeNumlineItems(p.stages, p.values ?? [], answer, p.numlineRev);
    const total = Math.max(1, results.length);
    const acc = results.map((r) => (r.placed ? ballparkAccuracy(r.error) : 0));
    const average = acc.reduce((sum, a) => sum + a, 0) / total;
    const bulls = results.filter((r) => r.placed && isStdBullseye(r.error)).length;
    const bullPts = Math.min(BALLPARK_STD_BULL_MAX, BALLPARK_STD_BULL_POINTS * bulls);
    // A wild number (25 % or more of the line off) costs 1, finished or not, as today (numlineRev 2's −1 item).
    const wild = results.filter((r) => r.placed && r.error !== null && r.error >= BALLPARK_STD_WILD).length;
    const facts = { accuracy: Math.round(average * 1000) / 1000, bullseyes: bulls, wild };
    if (graded.isCorrect) {
      // Finished (every number placed): up to 150 by average accuracy; the speed points scale with it too. It never
      // scores below the same answer's unfinished credit: 150·A + speed·A + bullseyes − wild against 120·A + early
      // (at most 10·A, each number's share scaled by its accuracy) + bullseyes − wild leaves at least 20·A ≥ 0.
      return {
        finished: true,
        base: STANDARD_FINISH * average - wild,
        speed: speedFor("numline", msLeft, limitMs) * average,
        bonus: bullPts,
        measure: "bullseyes",
        facts,
      };
    }
    // Unfinished: up to 8 per number by accuracy, each number's early extra (10 ÷ 15) scaled by its accuracy too, so
    // quick random taps earn none.
    const placed = results.filter((r) => r.placed).length;
    const times = ctx.partTimes(placed);
    let early = 0;
    times.forEach((t, k) => {
      early += earlyPoints((BALLPARK_STD_EARLY / total) * (acc[k] ?? 0), [t], limitMs);
    });
    const credit = BALLPARK_STD_ITEM * acc.reduce((sum, a) => sum + a, 0) + early + bullPts - wild;
    return { finished: false, credit, facts };
  },
};

/** This category's standard games, read by the grader (games.server.ts). */
export const NUMBER_STANDARD_GAMES: Partial<Record<PuzzleType, StandardGame>> = {
  target: exact,
  equation: operator,
  balance: counterweight,
  numpyramid: pyramid,
  trail,
  measure: brimful,
  checkout,
  numline: ballpark,
};
