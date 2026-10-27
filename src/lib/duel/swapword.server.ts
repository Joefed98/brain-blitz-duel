/**
 * Swapword generation, the exact minimum-swap search and live checks (server
 * only: the solution never leaves it before the reveal).
 */

import { dealtTopupRev } from "./depthTopup";
import { answerWords } from "./dictionary.server";
import {
  SWAPWORD_REV,
  SWAPWORD_REV_TOPUP,
  SWAPWORD_REV_NOTES,
  SWAPWORD_REV3,
  SW_SLOTS,
  SW_SLOT_TILES,
  SW_TILES,
  decodeSwapword,
  replaySwapword,
  swapwordBudget,
  swapwordMarks,
  type SwSwap,
  type SwView,
} from "./swapword";
import { dealtNotesRev } from "./phoneNotes";
import type { SwapwordPuzzleData } from "./types";
import { dealtDepthRev } from "./wordDepth";
import { rngBelow, rngShuffle, seededRng } from "./wordSeed.server";

export const SW_MIN_TARGET = 9;
export const SW_MAX_TARGET = 12;
export const SW_MIN_IN_PLACE = 3;
export const SW_MAX_IN_PLACE = 5;

/**
 * Fewest swaps that turn `board` into `solution` when equal letters are
 * interchangeable. Every misplaced tile is an edge from the letter it holds to
 * the letter its square needs; a swap can add at most one cycle to a cycle
 * decomposition of that letter graph, so the minimum is misplaced − (largest
 * number of cycles the edges split into). The largest split is found by an
 * exhaustive, memoised search over the cycles through one fixed edge at a time
 * (search, not a count of one permutation's cycles: with repeated letters many
 * permutations fit the board and they differ).
 */
export function minSwaps(board: string, solution: string): number {
  const E = new Map<string, number>();
  let misplaced = 0;
  for (let t = 0; t < board.length; t++) {
    if (board[t] === solution[t]) continue;
    misplaced++;
    const key = board[t]! + solution[t]!;
    E.set(key, (E.get(key) ?? 0) + 1);
  }
  return misplaced - maxCycles(E, new Map());
}

function stateKey(E: Map<string, number>): string {
  return [...E].filter(([, n]) => n > 0).map(([k, n]) => `${k}${n}`).sort().join("");
}

function maxCycles(E: Map<string, number>, memo: Map<string, number>): number {
  const key = stateKey(E);
  if (key === "") return 0;
  const known = memo.get(key);
  if (known !== undefined) return known;
  // Fix one edge a→b; some cycle of every decomposition holds it, and a best
  // decomposition uses simple cycles only (a repeated letter splits a cycle).
  const first = [...E].filter(([, n]) => n > 0).map(([k]) => k).sort()[0]!;
  const a = first[0]!, b = first[1]!;
  let best = 0;
  const take = (edge: string, d: number) => E.set(edge, (E.get(edge) ?? 0) + d);
  take(first, -1);
  // Simple paths b → … → a over the remaining edges.
  const visited = new Set<string>([a, b]);
  const walk = (at: string) => {
    if (at === a) return;
    for (const [edge, n] of [...E]) {
      if (n <= 0 || edge[0] !== at) continue;
      const next = edge[1]!;
      if (next !== a && visited.has(next)) continue;
      take(edge, -1);
      if (next === a) best = Math.max(best, 1 + maxCycles(E, memo));
      else {
        visited.add(next);
        walk(next);
        visited.delete(next);
      }
      take(edge, 1);
    }
  };
  walk(b);
  take(first, 1);
  memo.set(key, best);
  return best;
}

/**
 * One concrete swap list of exactly minSwaps(board, solution) swaps that solves
 * the board: each step takes a swap that lowers the minimum by one (the check
 * replays it as the witness that the minimum is reachable).
 */
export function witnessSwaps(start: string, solution: string): SwSwap[] {
  const board = [...start];
  const out: SwSwap[] = [];
  let need = minSwaps(start, solution);
  while (need > 0) {
    let found = false;
    for (let i = 0; i < SW_TILES && !found; i++) {
      if (board[i] === solution[i]) continue;
      for (let j = 0; j < SW_TILES && !found; j++) {
        if (i === j || board[j] !== solution[i]) continue;
        [board[i], board[j]] = [board[j]!, board[i]!];
        if (minSwaps(board.join(""), solution) === need - 1) {
          out.push([i, j]);
          need--;
          found = true;
        } else [board[i], board[j]] = [board[j]!, board[i]!];
      }
    }
    if (!found) throw new Error("Swapword: no witness step");
  }
  return out;
}

/** Fills the six slots with different common words (letters in tile order). */
function fillWords(rng: () => number): string | null {
  const letters: (string | undefined)[] = Array.from({ length: SW_TILES }, () => undefined);
  const used: string[] = [];
  // Long crossing words first, then the four short ones.
  const order = [1, 4, 0, 3, 2, 5];
  const place = (k: number): boolean => {
    if (k === order.length) return true;
    const s = order[k]!;
    const tiles = SW_SLOT_TILES[s]!;
    const pool = answerWords(SW_SLOTS[s]!.len);
    const fits = pool.filter((w) => !used.includes(w) && tiles.every((t, i) => letters[t] === undefined || letters[t] === w[i]));
    for (const w of rngShuffle(rng, fits).slice(0, 40)) {
      const before = tiles.map((t) => letters[t]);
      tiles.forEach((t, i) => (letters[t] = w[i]));
      used.push(w);
      if (place(k + 1)) return true;
      used.pop();
      tiles.forEach((t, i) => (letters[t] = before[i]));
    }
    return false;
  };
  return place(0) ? letters.join("") : null;
}

/** The six words of a solution, in slot order. */
export function swapwordWords(solution: string): string[] {
  return SW_SLOT_TILES.map((tiles) => tiles.map((t) => solution[t]).join(""));
}

/** Null when a puzzle meets every generator rule, else the rule broken. */
export function swapwordRuleBreak(p: SwapwordPuzzleData): string | null {
  const solution = p.solution ?? "";
  if (solution.length !== SW_TILES || p.start.length !== SW_TILES) return "wrong tile count";
  if ([...p.start].sort().join("") !== [...solution].sort().join("")) return "start is not a scramble of the solution";
  const words = swapwordWords(solution);
  if (new Set(words).size !== words.length) return "repeated word";
  for (let s = 0; s < words.length; s++) {
    if (!answerWords(SW_SLOTS[s]!.len).includes(words[s]!)) return `${words[s]} is not a common answer word`;
  }
  const min = minSwaps(p.start, solution);
  if (min !== p.minSwaps) return `stored minimum ${p.minSwaps}, search says ${min}`;
  if (min < SW_MIN_TARGET || min > SW_MAX_TARGET) return `minimum ${min} outside ${SW_MIN_TARGET}-${SW_MAX_TARGET}`;
  if (p.maxSwaps !== swapwordBudget(min, p.swapwordRev)) return `budget ${p.maxSwaps} is not ${swapwordBudget(min, p.swapwordRev)} (rev ${p.swapwordRev})`;
  const inPlace = [...p.start].filter((ch, t) => ch === solution[t]).length;
  if (inPlace < SW_MIN_IN_PLACE || inPlace > SW_MAX_IN_PLACE) return `${inPlace} tiles start in place`;
  if (SW_SLOT_TILES.some((tiles) => tiles.every((t) => p.start[t] === solution[t]))) return "a word starts solved";
  return null;
}

/** Six crossing common words, scrambled to a proven 9–12-swap minimum (rev 3: budget minimum + 8; rev 2's boards). */
export function generateSwapword(seed: number): SwapwordPuzzleData {
  // Word depth d1: rev 4 (par swaps) deals rev 3's boards and budget; a check pinning the pre-depth stamps gets rev 3.
  // The puzzle top-up (26 Oct 2026): rev 5 deals rev 4's boards (the stamp only changes the par bonus).
  // Joe's phone notes (27 Oct 2026): rev 6 deals rev 5's boards with 4 more swaps.
  const rev = dealtNotesRev(
    SWAPWORD_REV_NOTES,
    SWAPWORD_REV_TOPUP,
    dealtDepthRev(dealtTopupRev(SWAPWORD_REV_TOPUP, SWAPWORD_REV), SWAPWORD_REV3),
  );
  const rng = seededRng(seed);
  for (let attempt = 0; attempt < 200; attempt++) {
    const solution = fillWords(rng);
    if (!solution) continue;
    for (let tries = 0; tries < 60; tries++) {
      const fixedCount = SW_MIN_IN_PLACE + rngBelow(rng, SW_MAX_IN_PLACE - SW_MIN_IN_PLACE + 1);
      const order = rngShuffle(rng, Array.from({ length: SW_TILES }, (_, t) => t));
      const moving = order.slice(fixedCount);
      // A permutation with r − c = target swaps: c cycles, each at least 2 long.
      const target = SW_MIN_TARGET + rngBelow(rng, SW_MAX_TARGET - SW_MIN_TARGET + 1);
      const cycles = moving.length - target;
      if (cycles < 1 || cycles * 2 > moving.length) continue;
      const lengths = Array.from({ length: cycles }, () => 2);
      for (let extra = moving.length - 2 * cycles; extra > 0; extra--) lengths[rngBelow(rng, cycles)]!++;
      const board = [...solution];
      let at = 0;
      for (const len of lengths) {
        const cyc = moving.slice(at, at + len);
        at += len;
        cyc.forEach((p, i) => (board[cyc[(i + 1) % len]!] = solution[p]!));
      }
      const start = board.join("");
      const min = minSwaps(start, solution);
      const puzzle: SwapwordPuzzleData = {
        type: "swapword",
        swapwordRev: rev,
        start,
        minSwaps: min,
        maxSwaps: swapwordBudget(min, rev),
        solution,
      };
      if (swapwordRuleBreak(puzzle) === null) return puzzle;
    }
  }
  throw new Error("Swapword: no board found");
}

/** Live check: replays every swap and returns the marks for the board it leads to. */
export function checkSwapwordMoves(puzzle: SwapwordPuzzleData, moves: string): SwView {
  const swaps = decodeSwapword(moves);
  const solution = puzzle.solution ?? "";
  const run = replaySwapword(puzzle.start, swaps, puzzle.maxSwaps, solution);
  return { marks: swapwordMarks(run.board, solution), swaps: run.swaps, solved: run.solved, over: run.over, count: swaps.length };
}
