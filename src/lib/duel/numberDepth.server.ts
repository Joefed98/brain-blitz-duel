/**
 * Server half of the Number depth to 200 (depthRev 1, numberDepth.ts; docs/depth/d2-number.md): the stamp new
 * Number puzzles are dealt with, and the grade layer that turns a depth round's puzzleScoreRev 3 grade (Ballpark:
 * rev 2's) into its score to 200. A round without the stamp is returned exactly as graded.
 *
 * Server-only: it reads stored answers and private fields (Exact's steps, Brimful's moves, Checkout's darts,
 * Ballpark's errors), never anything the phone sends as a score.
 */
import { decodeCheckoutDarts, splitCheckoutRound } from "./checkout";
import type { Graded } from "./grade";
import {
  ballparkSpeedPoints,
  ballparkStreak,
  ballparkStreakPoints,
  dealtDepthRev,
  depthFeaturePoints,
  depthFeaturePointsRev2,
  depthRevOf,
  depthStretchPoints,
  EXACT_ELEGANT_TILES,
  isBigFinishDart,
  NUMBER_DEPTH_GAMES,
  NUMBER_DEPTH_MAX,
  numberDepthDealt,
  usesNumberDepth,
} from "./numberDepth";
import { NUMLINE_REV2_FULL_ERROR } from "./numline";
import { storedScoreParts, type ScoreParts } from "./puzzleScoreRev";
import { rev3Game } from "./puzzleScoreRev3";
import { puzzleTimeLimitMs } from "./registry";
import { applyOperation, decodeSteps } from "./target";
import type { CheckoutPuzzleData, MeasurePuzzleData, PuzzleData, TargetNumberPuzzleData } from "./types";

/**
 * Stamps a newly generated Number puzzle with depthRev 1 (Exact, Brimful and Checkout: depthRev 2) (when rooms deal it: puzzleScoreRev 3, not pinned by a
 * check). Brimful also gets its public par pours. Exact and Checkout build their depth content in their own
 * generators (numberDepthDealt()).
 */
export function stampNumberDepth<T extends PuzzleData>(puzzle: T): T {
  if (!numberDepthDealt() || !(puzzle.type in NUMBER_DEPTH_GAMES)) return puzzle;
  const stamped = { ...(puzzle as object), depthRev: dealtDepthRev(puzzle.type) } as T;
  if (puzzle.type === "measure") {
    const m = stamped as unknown as MeasurePuzzleData;
    if (m.minMoves) m.par = [...m.minMoves];
  }
  return stamped;
}

/* ------------------------------------------------------------------ feature shares */

/** Exact: how many of the six starting numbers fed the number that hit the target (null: no exact hit). */
export function exactTilesUsed(puzzle: TargetNumberPuzzleData, answer: string): number | null {
  let pool = puzzle.tiles.map((value, i) => ({ value, mask: 1 << i }));
  for (const raw of decodeSteps(answer).slice(0, 20)) {
    const a = Number(raw.a);
    const b = Number(raw.b);
    const op = raw.operator as "+" | "-" | "×" | "÷";
    const first = pool.findIndex((t) => t.value === a);
    if (first < 0) break;
    const rest = pool.filter((_, i) => i !== first);
    const second = rest.findIndex((t) => t.value === b);
    if (second < 0) break;
    const result = applyOperation(a, b, op);
    if (result === null) break;
    pool = [...rest.filter((_, i) => i !== second), { value: result, mask: pool[first]!.mask | rest[second]!.mask }];
  }
  const hit = pool.find((t) => t.value === puzzle.target);
  if (!hit) return null;
  let n = 0;
  for (let m = hit.mask; m; m >>= 1) n += m & 1;
  return n;
}

/** Brimful: boards solved in exactly their par pours, of all boards. */
export function brimfulParBoards(puzzle: MeasurePuzzleData, extra: Record<string, unknown> | null): { par: number; boards: number } {
  const boards = Array.isArray(extra?.["boards"]) ? (extra!["boards"] as { solved?: boolean; moves?: number; minMoves?: number }[]) : [];
  const par = boards.filter((b, i) => b.solved && typeof b.moves === "number" && b.moves <= (puzzle.par?.[i] ?? b.minMoves ?? 0)).length;
  return { par, boards: puzzle.boards.length };
}

/** Checkout: the solved stages whose last dart was a big finish. */
export function checkoutBigFinishes(puzzle: CheckoutPuzzleData, answer: string, extra: Record<string, unknown> | null): number {
  const stages = Array.isArray(extra?.["stages"]) ? (extra!["stages"] as { solved?: boolean }[]) : [];
  const parts = splitCheckoutRound(answer);
  return puzzle.stages.filter((stage, i) => {
    if (!stage.bigFinish || !stages[i]?.solved) return false;
    const darts = decodeCheckoutDarts(parts[i] ?? "", stage.maxDarts);
    const last = darts[darts.length - 1];
    return !!last && isBigFinishDart(stage.finish, last);
  }).length;
}

/* ------------------------------------------------------------------ the grade layer */

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * A depth round's score to 200 from its puzzleScoreRev 3 grade (Ballpark: rev 2's). Unfinished rounds keep their
 * grade (at most 110); a finish keeps its 120 + speed and adds the stretch or the feature (or, for Ballpark, the
 * streak and speed stretch). The breakdown adds up to the score: the stretch rides in `speed`, a feature in the
 * `efficiency` slot with its own name (`measure`).
 */
export function withNumberDepth(puzzle: PuzzleData, answer: string, graded: Graded): Graded {
  if (!usesNumberDepth(puzzle)) return graded;
  const game = NUMBER_DEPTH_GAMES[puzzle.type]!;
  const extra = (graded.extra ?? {}) as Record<string, unknown>;
  const parts = storedScoreParts(extra);
  if (!graded.isCorrect) return graded;

  if (game.route === "open") {
    // Ballpark: rev 2's score, plus the speed stretch and the bullseye streak.
    const limit = puzzleTimeLimitMs(puzzle);
    const errors = Array.isArray(extra["errors"]) ? (extra["errors"] as (number | null)[]) : [];
    const close = errors.length ? errors.filter((e) => e !== null && e <= NUMBER_DEPTH_CLOSE).length / errors.length : 0;
    const streak = ballparkStreak(errors);
    const streakPts = ballparkStreakPoints(streak.sum);
    const speedPts = ballparkSpeedPoints(limit > 0 ? graded.storedMs / limit : 0, close);
    const score = Math.min(NUMBER_DEPTH_MAX, graded.score + streakPts + speedPts);
    const depthParts: ScoreParts = { kind: "finish", base: graded.score, efficiency: streakPts, measure: "streak", speed: speedPts };
    return { ...graded, score, extra: { ...extra, parts: depthParts, rev2Score: graded.score, depth: { streak: streak.sum, bestStreak: streak.best, bullseyes: streak.runs.filter((r) => r > 0).length, streakPoints: streakPts, speedPoints: speedPts } } };
  }

  if (!parts || parts.kind !== "finish") return graded;
  const left = num(extra["time"]) ?? 0;
  const efficiency = num(extra["efficiency"]) ?? 1;
  const fast = rev3Game(puzzle.type).fastShare;
  const speed = parts.speed ?? 0;

  if (game.route === "stretch") {
    const stretch = depthStretchPoints(left, fast, game.elite ?? 1, efficiency);
    const score = Math.min(NUMBER_DEPTH_MAX, graded.score + stretch);
    const depthParts: ScoreParts = { kind: "finish", base: parts.base, speed: speed + stretch };
    return { ...graded, score, extra: { ...extra, parts: depthParts, depth: { stretch } } };
  }

  // Features: the share of the feature earned; rev 1 pays it in full at the fast share of the clock, rev 2 only
  // part there and the rest by the game's elite share.
  let share = 0;
  let measure = "bonus";
  let detail: Record<string, unknown> = {};
  if (puzzle.type === "target") {
    const used = exactTilesUsed(puzzle as TargetNumberPuzzleData, answer);
    share = used !== null && used <= EXACT_ELEGANT_TILES ? 1 : 0;
    measure = "elegance";
    detail = { tilesUsed: used, elegant: share === 1 };
  } else if (puzzle.type === "measure") {
    const { par, boards } = brimfulParBoards(puzzle as MeasurePuzzleData, extra);
    share = boards > 0 ? par / boards : 0;
    measure = "par";
    detail = { parBoards: par };
  } else if (puzzle.type === "checkout") {
    const big = checkoutBigFinishes(puzzle as CheckoutPuzzleData, answer, extra);
    share = big / Math.max(1, (puzzle as CheckoutPuzzleData).stages.length);
    measure = "big finish";
    detail = { bigFinishes: big };
  }
  const bonus = depthRevOf(puzzle) >= 2
    ? depthFeaturePointsRev2(share, left, fast, game.featureElite ?? 1, game.featureBase ?? 1)
    : depthFeaturePoints(share, left, fast);
  const score = Math.min(NUMBER_DEPTH_MAX, graded.score + bonus);
  const depthParts: ScoreParts = { kind: "finish", base: parts.base, efficiency: bonus, measure, speed };
  return { ...graded, score, extra: { ...extra, parts: depthParts, depth: { ...detail, bonus } } };
}

/** Ballpark's "close" placement (rev 2's full-points error): the speed stretch scales with their share. */
const NUMBER_DEPTH_CLOSE = NUMLINE_REV2_FULL_ERROR;
