/**
 * A human-like Gridlock solver (the difficulty levels, 15 Nov 2026): it never sees the stored solution or the exact
 * distances. A person solves a jam by working out which cars stand in the way of which ("to move this van I need that
 * car out of the way"), trying lines in the head before sliding. Modelled as a best-first search guided by that
 * chain (`gridlockChain`, the grader's own count of the cars in the gold car's way; then the moves already made), with
 * a budget of layouts it can imagine (MENTAL_BUDGET); the line it finds is then played. Lines are not the shortest:
 * the player's moves are counted as played (the par bonus reads them).
 *
 * Time: SLIDE_MS a slide, plus thinking in proportion to the layouts imagined, calibrated so a strong player's median
 * Normal board (today's game, 15–22 moves at the minimum) takes about NORMAL_TARGET_S seconds: the model measures how
 * much harder a level's boards are to reason out than Normal's, not an absolute human speed. Graded by the server's
 * own grader on the dealt puzzle (scripts/standard-lib.ts gradeSteps).
 *
 *   bun scripts/unblock-human.ts [--level=all|easy|normal|hard|expert] [--boards=40]
 */
import { gridlockChain } from "../src/lib/duel/standard/pattern.server";
import { applyMove, encodeMoves, isSolved, position, slideRange, type UnblockMove } from "../src/lib/duel/unblock";
import { unblockCols, type UnblockPuzzleData, type UnblockVehicle } from "../src/lib/duel/types";
import type { Step } from "./puzzle-fairness/kit";

/** Layouts a person can try in the head before giving up on a board. */
export const MENTAL_BUDGET = Number(process.env["UB_BUDGET"] ?? 60_000);
/** A slide's own time on the phone (a strong player's drag). */
export const SLIDE_MS = 900;
/** The calibration: a strong player's median Normal board, in seconds. */
export const NORMAL_TARGET_S = 35;
/** How strongly the chain of cars in the way steers the search (against the line's length so far). */
const CHAIN_WEIGHT = Number(process.env["UB_W"] ?? 4);

const keyOf = (vs: readonly UnblockVehicle[]) => vs.map((v) => (v.axis === "h" ? v.col : v.row)).join("");

function legal(vs: UnblockVehicle[], n: number): UnblockMove[] {
  const out: UnblockMove[] = [];
  for (const v of vs) {
    const { min, max } = slideRange(vs, v.id, n);
    for (let to = min; to <= max; to++) if (to !== position(v)) out.push({ id: v.id, to });
  }
  return out;
}

/** A small binary heap on priority (ties first in, first out). */
class Heap<T> {
  private items: { p: number; s: number; v: T }[] = [];
  private stamp = 0;
  get size() {
    return this.items.length;
  }
  private less(a: { p: number; s: number }, b: { p: number; s: number }) {
    return a.p < b.p || (a.p === b.p && a.s < b.s);
  }
  push(p: number, v: T) {
    const a = this.items;
    a.push({ p, s: this.stamp++, v });
    for (let i = a.length - 1; i > 0; ) {
      const up = (i - 1) >> 1;
      if (!this.less(a[i]!, a[up]!)) break;
      [a[up], a[i]] = [a[i]!, a[up]!];
      i = up;
    }
  }
  pop(): T {
    const a = this.items;
    const top = a[0]!.v;
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.less(a[l]!, a[m]!)) m = l;
        if (r < a.length && this.less(a[r]!, a[m]!)) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top;
  }
}

export interface MentalSolve {
  /** The line found (null: none within the budget). */
  line: UnblockMove[] | null;
  /** Layouts imagined. */
  imagined: number;
}

/** The best-first search a person does in the head: fewest cars in the way first, shorter lines next. */
export function mentalSolve(puzzle: UnblockPuzzleData, budget = MENTAL_BUDGET): MentalSolve {
  const n = unblockCols(puzzle);
  type Node = { vs: UnblockVehicle[]; g: number; parent: Node | null; move: UnblockMove | null };
  const start: Node = { vs: puzzle.vehicles.map((v) => ({ ...v })), g: 0, parent: null, move: null };
  const seen = new Set<string>([keyOf(start.vs)]);
  const heap = new Heap<Node>();
  heap.push(0, start);
  let imagined = 0;
  while (heap.size && imagined < budget) {
    const node = heap.pop();
    imagined++;
    if (isSolved(node.vs, n)) {
      const line: UnblockMove[] = [];
      for (let at: Node | null = node; at?.move; at = at.parent) line.unshift(at.move);
      return { line, imagined };
    }
    for (const m of legal(node.vs, n)) {
      const vs = applyMove(node.vs, m, n)!;
      const k = keyOf(vs);
      if (seen.has(k)) continue;
      seen.add(k);
      const h = isSolved(vs, n) ? 0 : gridlockChain(vs, n) + 1;
      heap.push(h * CHAIN_WEIGHT + node.g + 1, { vs, g: node.g + 1, parent: node, move: m });
    }
  }
  return { line: null, imagined };
}

export interface HumanResult {
  solved: boolean;
  moves: number;
  imagined: number;
  steps: Step[];
}

/** Plays a board as the model's person: the thinking spread over the line, a slide after each share. */
export function humanPlay(puzzle: UnblockPuzzleData, thinkMsPerLayout: number): HumanResult {
  const solve = mentalSolve(puzzle);
  if (!solve.line) return { solved: false, moves: 0, imagined: solve.imagined, steps: [] };
  const think = (solve.imagined * thinkMsPerLayout) / solve.line.length;
  const steps: Step[] = [];
  let at = 0;
  for (let i = 0; i < solve.line.length; i++) {
    at += think + SLIDE_MS;
    steps.push({ answer: encodeMoves(solve.line.slice(0, i + 1)), atMs: Math.round(at) });
  }
  return { solved: true, moves: solve.line.length, imagined: solve.imagined, steps };
}

export const median = (xs: readonly number[]) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)]!;

/** Thinking per layout imagined so the median Normal board (its line slid at SLIDE_MS) takes NORMAL_TARGET_S. */
export function calibrate(normalBoards: readonly UnblockPuzzleData[]): number {
  return median(
    normalBoards.map((p) => {
      const s = mentalSolve(p);
      if (!s.line) return Number.POSITIVE_INFINITY;
      return Math.max(0, NORMAL_TARGET_S * 1000 - s.line.length * SLIDE_MS) / Math.max(1, s.imagined);
    }),
  );
}

if (import.meta.main) {
  const { generatePuzzle } = await import("../src/lib/duel/generate.server");
  const { withSeededRandom } = await import("../src/lib/duel/random");
  const { gradeSteps } = await import("./standard-lib");
  const args = process.argv.slice(2);
  const which = args.find((a) => a.startsWith("--level="))?.slice(8) ?? "all";
  const boards = Number(args.find((a) => a.startsWith("--boards="))?.slice(9) ?? 40);
  const deal = (level: string, k: number) => {
    const seed = 50_000 + k * 7919;
    return withSeededRandom(seed, () => generatePuzzle("unblock", { bankSeed: seed, ...(level !== "normal" ? { level: level as "easy" } : {}) })) as UnblockPuzzleData;
  };
  const perLayout = calibrate(Array.from({ length: boards }, (_, k) => deal("normal", k)));
  console.log(`thinking ${perLayout.toFixed(2)} ms a layout imagined (Normal's median board in ${NORMAL_TARGET_S} s)`);
  const levels = which === "all" ? ["easy", "normal", "hard", "expert"] : [which];
  for (const level of levels) {
    const scores: number[] = [];
    const imagined: number[] = [];
    let solved = 0;
    let ratio = 0;
    for (let k = 0; k < boards; k++) {
      const p = deal(level, k);
      const r = humanPlay(p, perLayout);
      const g = gradeSteps(p, r.steps);
      scores.push(g.score);
      imagined.push(r.imagined);
      if (g.isCorrect) solved++;
      ratio += r.moves / Math.max(1, p.minMoves ?? 1);
    }
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    console.log(`${level.padEnd(7)} human-like: avg ${avg.toFixed(1)}  median ${median(scores)}  finished ${Math.round((100 * solved) / boards)}%  moves/min ${(ratio / boards).toFixed(2)}  layouts imagined (median) ${median(imagined)}  (${boards} boards)`);
  }
}
