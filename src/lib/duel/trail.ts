/**
 * Trail: one king-move path through every cell of a 6×6 grid, numbered 1–36.
 * Shared by the phone, the grader and the bank script.
 */

export const TR_SIZE = 6;
export const TR_CELLS = TR_SIZE * TR_SIZE;
export const TR_MIN_GIVENS = 8;
export const TR_MAX_GIVENS = 12;

export function trAdjacent(a: number, b: number, size = TR_SIZE): boolean {
  if (a === b) return false;
  const dr = Math.abs(Math.floor(a / size) - Math.floor(b / size));
  const dc = Math.abs((a % size) - (b % size));
  return dr <= 1 && dc <= 1;
}

export function trNeighbours(cell: number, size = TR_SIZE): number[] {
  const r = Math.floor(cell / size);
  const c = cell % size;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) out.push(nr * size + nc);
    }
  }
  return out;
}

function chebyshev(a: number, b: number, size: number): number {
  return Math.max(Math.abs(Math.floor(a / size) - Math.floor(b / size)), Math.abs((a % size) - (b % size)));
}

/** Answer = cell indices in path order, dot-separated. */
export function trEncode(path: readonly number[]): string {
  return path.join(".");
}

export function trDecode(answer: string, cells = TR_CELLS): number[] {
  if (!answer) return [];
  const out: number[] = [];
  for (const part of answer.split(".").slice(0, cells)) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n >= cells) break;
    out.push(n);
  }
  return out;
}

/**
 * Can `cell` become step `path.length + 1`? Adjacent to the end, unfilled, and
 * consistent with the givens (a given cell only at its own step, and a step
 * owned by a given only on that given's cell).
 */
export function trCanStep(givens: readonly (number | null)[], path: readonly number[], cell: number, size = TR_SIZE): boolean {
  const step = path.length + 1;
  if (step > givens.length) return false;
  if (path.length && !trAdjacent(path[path.length - 1]!, cell, size)) return false;
  if (path.includes(cell)) return false;
  const g = givens[cell];
  if (g != null) return g === step;
  return !givens.includes(step);
}

/** Longest prefix of `path` that matches the solution step for step. */
export function trCorrectPrefix(path: readonly number[], solution: readonly number[]): number {
  let n = 0;
  while (n < path.length && n < solution.length && path[n] === solution[n]) n++;
  return n;
}

/** A full, legal path through every cell that honours every given. */
export function trComplete(givens: readonly (number | null)[], path: readonly number[], size = TR_SIZE): boolean {
  if (path.length !== givens.length) return false;
  const seen: number[] = [];
  for (const cell of path) {
    if (!trCanStep(givens, seen, cell, size)) return false;
    seen.push(cell);
  }
  return true;
}

export function scoreTrail(complete: boolean, msRemaining: number, timeLimitMs: number, prefix: number, cells = TR_CELLS): number {
  if (complete) return Math.min(150, 130 + (timeLimitMs > 0 ? Math.round((20 * Math.max(0, Math.min(msRemaining, timeLimitMs))) / timeLimitMs) : 0));
  return Math.min(150, 5 * Math.max(0, Math.min(prefix, cells)));
}

/**
 * Counts solutions (up to `limit`) by backtracking from the cell given as 1.
 * Prunes on distance to the next given and on connectivity of the unvisited
 * cells. Calls `onSolution` with each path found.
 */
export function trCountSolutions(
  givens: readonly (number | null)[],
  limit = 2,
  size = TR_SIZE,
  onSolution?: (path: number[]) => void,
): number {
  const cells = size * size;
  const at = new Array<number>(cells + 2).fill(-1);
  givens.forEach((g, cell) => {
    if (g != null) at[g] = cell;
  });
  const start = at[1]!;
  if (start < 0) return 0;
  const nbrs = Array.from({ length: cells }, (_, c) => trNeighbours(c, size));
  // next given step after each step
  const nextGiven = new Array<number>(cells + 2).fill(-1);
  for (let s = cells; s >= 1; s--) nextGiven[s] = at[s + 1]! >= 0 ? s + 1 : nextGiven[s + 1] ?? -1;
  const used = new Uint8Array(cells);
  const path: number[] = [start];
  used[start] = 1;
  let count = 0;
  const stack = new Int32Array(cells);

  const connected = (from: number, free: number): boolean => {
    // flood from `from` over unused cells; must reach all `free` of them
    const mark = new Uint8Array(cells);
    let top = 0;
    stack[top++] = from;
    mark[from] = 1;
    let reached = 0;
    while (top) {
      const c = stack[--top]!;
      for (const n of nbrs[c]!) {
        if (mark[n] || used[n]) continue;
        mark[n] = 1;
        reached++;
        stack[top++] = n;
      }
    }
    if (reached !== free) return false;
    // Dead ends: an unvisited cell with one way in must be the last cell.
    let ends = 0;
    for (let c = 0; c < cells; c++) {
      if (used[c]) continue;
      let exits = 0;
      for (const n of nbrs[c]!) if (!used[n] || n === from) exits++;
      if (exits === 0) return false;
      if (exits === 1) {
        if (at[cells]! >= 0 && at[cells] !== c) return false;
        if (++ends > 1) return false;
      }
    }
    return true;
  };

  const go = (step: number, cell: number) => {
    if (count >= limit) return;
    if (step === cells) {
      count++;
      onSolution?.([...path]);
      return;
    }
    const ng = nextGiven[step]!;
    const free = cells - step;
    if (!connected(cell, free)) return;
    const want = at[step + 1]!;
    for (const n of nbrs[cell]!) {
      if (used[n]) continue;
      if (want >= 0 ? n !== want : givens[n] != null) continue;
      if (ng > step + 1 && chebyshev(n, at[ng]!, size) > ng - step - 1) continue;
      used[n] = 1;
      path.push(n);
      go(step + 1, n);
      path.pop();
      used[n] = 0;
      if (count >= limit) return;
    }
  };
  go(1, start);
  return count;
}
