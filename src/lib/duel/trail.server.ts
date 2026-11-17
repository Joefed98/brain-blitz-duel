import { TRAIL_BANK } from "./trailBank.server";
import { trCountSolutions, trNeighbours, TR_CELLS } from "./trail";
import type { TrailLevel } from "./logicLevels";
import type { TrailPuzzleData } from "./types";

/**
 * Normal draws one pre-proven trail from the bank (built by scripts/trail-bank.ts). A level (logicLevels.ts) builds one
 * live the same way the bank does, on the same 6 × 6 king-move board: a random path, then the fewest numbers it stays
 * unique with, kept only when that is at most the level's count, topped up to exactly it, and kept only when the solver's
 * search steps (its difficulty grade) fall in the level's band. Math.random only, so a room's
 * seeded deal is the same for every player.
 */
export function generateTrail(level: TrailLevel | null = null): TrailPuzzleData {
  if (level) {
    const built = buildTrail(level.givens, level.nodes);
    return { type: "trail", givens: built.givens, solution: built.solution, timeLimitMs: level.timeLimitMs };
  }
  const entry = TRAIL_BANK[Math.floor(Math.random() * TRAIL_BANK.length)]!;
  return { type: "trail", givens: [...entry.givens], solution: [...entry.solution] };
}

const rand = (n: number) => Math.floor(Math.random() * n);
function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** A random king-move path over every square (the bank's randomised Warnsdorff walk). */
function randomPath(): number[] {
  for (;;) {
    const used = new Uint8Array(TR_CELLS);
    let cell = rand(TR_CELLS);
    const path = [cell];
    used[cell] = 1;
    while (path.length < TR_CELLS) {
      const options = shuffle(trNeighbours(cell).filter((n) => !used[n]));
      if (!options.length) break;
      const deg = (c: number) => trNeighbours(c).filter((n) => !used[n] && n !== c).length;
      options.sort((a, b) => deg(a) - deg(b));
      cell = options.length > 1 && Math.random() < 0.15 ? options[1]! : options[0]!;
      used[cell] = 1;
      path.push(cell);
    }
    if (path.length === TR_CELLS) return path;
  }
}

function givensFor(path: readonly number[], steps: ReadonlySet<number>): (number | null)[] {
  const g: (number | null)[] = new Array(TR_CELLS).fill(null);
  for (const s of steps) g[path[s - 1]!] = s;
  return g;
}

/** Every step given, then steps dropped in random order while the path stays unique (1 and 36 always shown). */
function minimalGivens(path: readonly number[]): Set<number> {
  const steps = new Set(Array.from({ length: TR_CELLS }, (_, i) => i + 1));
  for (const s of shuffle([...steps].filter((s) => s !== 1 && s !== TR_CELLS))) {
    steps.delete(s);
    if (trCountSolutions(givensFor(path, steps), 2) !== 1) steps.add(s);
  }
  return steps;
}

function buildTrail(target: number, nodes: readonly [number, number]): { givens: (number | null)[]; solution: number[] } {
  for (let attempt = 0; attempt < 600; attempt++) {
    const path = randomPath();
    let best: Set<number> | null = null;
    for (let t = 0; t < 4; t++) {
      const s = minimalGivens(path);
      if (!best || s.size < best.size) best = s;
      if (best.size <= target) break;
    }
    if (!best || best.size > target) continue;
    const pad = shuffle(Array.from({ length: TR_CELLS - 2 }, (_, i) => i + 2).filter((s) => !best!.has(s)));
    while (best.size < target) best.add(pad.pop()!);
    const givens = givensFor(path, best);
    const stats = { nodes: 0 };
    if (trCountSolutions(givens, 2, undefined, undefined, stats) !== 1) continue;
    if (stats.nodes < nodes[0] || stats.nodes > nodes[1]) continue;
    return { givens, solution: [...path] };
  }
  throw new Error("Trail generation failed");
}
