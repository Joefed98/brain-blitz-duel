/**
 * Bridges rules (1 Nov 2026), shared by the phone, the server and the reveal. Each island's number is how many bridges
 * connect to it. Bridges run straight, horizontally or vertically, never cross, at most two between a pair, and all
 * islands must end up connected.
 *
 * A bridge can only join an island to its nearest island along a row or column, so the board's candidate pairs are
 * fixed (`bridgePairs`, in island order: each island's pair to the right, then down). The answer is one digit per
 * candidate pair, "0", "1" or "2". Pure; integers only.
 */
import type { BridgesIsland, BridgesPuzzleData } from "./types";

export interface BridgePair {
  /** Island indices, a < b (a is left of / above b). */
  a: number;
  b: number;
  horizontal: boolean;
  /** The cells strictly between the two islands. */
  between: number[];
}

/** Every pair of islands a bridge could join: neighbours along a row or column with nothing between. */
export function bridgePairs(islands: readonly BridgesIsland[], size: number): BridgePair[] {
  const at = new Map<number, number>();
  islands.forEach((island, i) => at.set(island.cell, i));
  const out: BridgePair[] = [];
  islands.forEach((island, a) => {
    const r = Math.floor(island.cell / size);
    const c = island.cell % size;
    const between: number[] = [];
    for (let cc = c + 1; cc < size; cc++) {
      const cell = r * size + cc;
      const b = at.get(cell);
      if (b !== undefined) {
        if (between.length) out.push({ a, b, horizontal: true, between: [...between] });
        break;
      }
      between.push(cell);
    }
    between.length = 0;
    for (let rr = r + 1; rr < size; rr++) {
      const cell = rr * size + c;
      const b = at.get(cell);
      if (b !== undefined) {
        if (between.length) out.push({ a, b, horizontal: false, between: [...between] });
        break;
      }
      between.push(cell);
    }
  });
  return out;
}

/** True when two pairs would cross (one horizontal, one vertical, sharing a cell between their islands). */
export function pairsCross(p: BridgePair, q: BridgePair): boolean {
  if (p.horizontal === q.horizontal) return false;
  const cells = new Set(p.between);
  return q.between.some((c) => cells.has(c));
}

/** For each pair, the indices of the pairs it crosses. */
export function crossingTable(pairs: readonly BridgePair[]): number[][] {
  return pairs.map((p) => pairs.flatMap((q, j) => (pairsCross(p, q) ? [j] : [])));
}

/** Bridges per candidate pair (0–2; anything unreadable is 0). */
export function decodeBridges(answer: string, pairCount: number): number[] {
  const raw = String(answer ?? "");
  const out = new Array<number>(pairCount).fill(0);
  for (let i = 0; i < pairCount && i < raw.length; i++) {
    const v = raw.charCodeAt(i) - 48;
    out[i] = v === 1 || v === 2 ? v : 0;
  }
  return out;
}

export function encodeBridges(counts: readonly number[]): string {
  return counts.map((v) => (v === 1 || v === 2 ? String(v) : "0")).join("");
}

/** Bridges at each island. */
export function islandDegrees(islands: readonly BridgesIsland[], pairs: readonly BridgePair[], counts: readonly number[]): number[] {
  const deg = new Array<number>(islands.length).fill(0);
  pairs.forEach((p, i) => {
    const k = counts[i] ?? 0;
    deg[p.a]! += k;
    deg[p.b]! += k;
  });
  return deg;
}

/** True when bridges cross somewhere. */
export function bridgesCrossing(pairs: readonly BridgePair[], counts: readonly number[]): boolean {
  for (let i = 0; i < pairs.length; i++) {
    if (!counts[i]) continue;
    for (let j = i + 1; j < pairs.length; j++) if (counts[j] && pairsCross(pairs[i]!, pairs[j]!)) return true;
  }
  return false;
}

/** True when every island is reached from the first through bridges. */
export function bridgesConnected(islands: readonly BridgesIsland[], pairs: readonly BridgePair[], counts: readonly number[]): boolean {
  if (!islands.length) return false;
  const adj: number[][] = islands.map(() => []);
  pairs.forEach((p, i) => {
    if (counts[i]) {
      adj[p.a]!.push(p.b);
      adj[p.b]!.push(p.a);
    }
  });
  const seen = new Set<number>([0]);
  const stack = [0];
  while (stack.length) for (const n of adj[stack.pop()!]!) if (!seen.has(n)) (seen.add(n), stack.push(n));
  return seen.size === islands.length;
}

/** Solved by the rules alone (the board's solution is unique, so this is the solution). */
export function bridgesSolvedCounts(islands: readonly BridgesIsland[], pairs: readonly BridgePair[], counts: readonly number[]): boolean {
  const deg = islandDegrees(islands, pairs, counts);
  if (deg.some((d, i) => d !== islands[i]!.n)) return false;
  return !bridgesCrossing(pairs, counts) && bridgesConnected(islands, pairs, counts);
}

export function bridgesSolved(puzzle: Pick<BridgesPuzzleData, "size" | "islands">, answer: string): boolean {
  const pairs = bridgePairs(puzzle.islands, puzzle.size);
  return bridgesSolvedCounts(puzzle.islands, pairs, decodeBridges(answer, pairs.length));
}

/**
 * Progress toward the solution, pair by pair so guessing never pays: a pair built exactly as the solution has it counts
 * its bridges as right; a pair built any other way (too many, or one bridge of a double, or a bridge the solution never
 * has) counts the bridges on it as wrong; an empty pair counts nothing. Building every pair single or every pair double
 * so places about as many wrong bridges as right ones (the generator deals only boards where it nets nothing, see
 * bridgesGuessShare in bridges.server.ts). Total: the solution's bridges.
 */
export function bridgesProgress(puzzle: BridgesPuzzleData, answer: string): { right: number; wrong: number; total: number } {
  const pairs = bridgePairs(puzzle.islands, puzzle.size);
  return bridgesProgressCounts(puzzle.solution ?? [], decodeBridges(answer, pairs.length));
}

/** bridgesProgress on decoded counts (per candidate pair) against the solution's. */
export function bridgesProgressCounts(solution: readonly number[], counts: readonly number[]): { right: number; wrong: number; total: number } {
  let right = 0;
  let wrong = 0;
  let total = 0;
  solution.forEach((want, i) => {
    const have = counts[i] ?? 0;
    total += want;
    if (!have) return;
    if (have === want) right += want;
    else wrong += have;
  });
  return { right, wrong, total };
}

/** The wrong bridges an answer holds, as stable keys ("pair:k" for each bridge beyond the solution's). */
export function bridgesWrongKeys(puzzle: BridgesPuzzleData, answer: string): string[] {
  const pairs = bridgePairs(puzzle.islands, puzzle.size);
  const counts = decodeBridges(answer, pairs.length);
  const sol = puzzle.solution ?? [];
  const out: string[] = [];
  pairs.forEach((_, i) => {
    for (let k = (sol[i] ?? 0) + 1; k <= (counts[i] ?? 0); k++) out.push(`${i}:${k}`);
  });
  return out;
}
