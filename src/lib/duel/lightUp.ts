/**
 * Light Up rules, shared by the phone (live lighting, auto-lock) and the
 * server (grading, generation). Bulbs light their row and column up to a wall;
 * a layout is valid when every white cell is lit, no bulb lights another, and
 * every numbered wall has exactly that many bulbs orthogonally beside it.
 */

export const LIGHTUP_SIZE = 9;

export interface LightUpBoard {
  size: number;
  walls: readonly number[];
  /** Parallel to walls: the number, or -1 for a plain wall. */
  wallNumbers: readonly number[];
}

export function orth(cell: number, size: number): number[] {
  const r = Math.floor(cell / size);
  const c = cell % size;
  const out: number[] = [];
  if (r > 0) out.push(cell - size);
  if (r < size - 1) out.push(cell + size);
  if (c > 0) out.push(cell - 1);
  if (c < size - 1) out.push(cell + 1);
  return out;
}

/** Cells a bulb at `cell` would light (itself included), stopping at walls. */
export function sightLine(cell: number, size: number, wallSet: ReadonlySet<number>): number[] {
  const out = [cell];
  const r = Math.floor(cell / size);
  const c = cell % size;
  for (const [dr, dc] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    let rr = r + dr;
    let cc = c + dc;
    while (rr >= 0 && cc >= 0 && rr < size && cc < size && !wallSet.has(rr * size + cc)) {
      out.push(rr * size + cc);
      rr += dr;
      cc += dc;
    }
  }
  return out;
}

export function whiteCells(board: LightUpBoard): number[] {
  const wallSet = new Set(board.walls);
  return [...Array(board.size * board.size).keys()].filter((cell) => !wallSet.has(cell));
}

export interface LightUpStatus {
  lit: Set<number>;
  /** Bulbs lit by another bulb. */
  clashing: Set<number>;
  whites: number;
  numbersOk: boolean;
}

export function lightUpStatus(board: LightUpBoard, bulbs: readonly number[]): LightUpStatus {
  const wallSet = new Set(board.walls);
  const bulbSet = new Set(bulbs);
  const lit = new Set<number>();
  const clashing = new Set<number>();
  for (const bulb of bulbs) {
    for (const cell of sightLine(bulb, board.size, wallSet)) {
      lit.add(cell);
      if (cell !== bulb && bulbSet.has(cell)) clashing.add(bulb);
    }
  }
  const numbersOk = board.walls.every((wall, i) => {
    const n = board.wallNumbers[i] ?? -1;
    return n < 0 || orth(wall, board.size).filter((cell) => bulbSet.has(cell)).length === n;
  });
  return { lit, clashing, whites: board.size * board.size - board.walls.length, numbersOk };
}

export function lightUpValid(board: LightUpBoard, bulbs: readonly number[]): boolean {
  const s = lightUpStatus(board, bulbs);
  return s.clashing.size === 0 && s.numbersOk && s.lit.size === s.whites;
}

export function encodeBulbs(bulbs: readonly number[]): string {
  return [...new Set(bulbs)].sort((a, b) => a - b).join(",");
}

export function decodeBulbs(raw: string, board: LightUpBoard): number[] {
  const wallSet = new Set(board.walls);
  const cells = String(raw ?? "")
    .split(",")
    .map((part) => Number.parseInt(part, 10))
    .filter((cell) => Number.isInteger(cell) && cell >= 0 && cell < board.size * board.size && !wallSet.has(cell));
  return [...new Set(cells)];
}

/** Counts valid layouts up to `limit` by backtracking over white cells in order. */
export function countLightUpSolutions(board: LightUpBoard, limit = 2): number {
  const { size } = board;
  const wallSet = new Set(board.walls);
  const whites = whiteCells(board);
  const order = new Map(whites.map((cell, i) => [cell, i]));
  const sight = new Map(whites.map((cell) => [cell, sightLine(cell, size, wallSet)]));
  // After deciding index i, these cells must already be lit / these walls complete.
  const litDue: number[][] = whites.map(() => []);
  for (const cell of whites) {
    const last = Math.max(...sight.get(cell)!.map((other) => order.get(other)!));
    litDue[last]!.push(cell);
  }
  const wallDue: number[][] = whites.map(() => []);
  const numbered = board.walls
    .map((wall, i) => ({ wall, n: board.wallNumbers[i] ?? -1 }))
    .filter((w) => w.n >= 0);
  const wallsBeside = new Map<number, number[]>();
  for (const [index, w] of numbered.entries()) {
    const around = orth(w.wall, size).filter((cell) => !wallSet.has(cell));
    if (!around.length) {
      if (w.n > 0) return 0;
      continue;
    }
    wallDue[Math.max(...around.map((cell) => order.get(cell)!))]!.push(index);
    for (const cell of around) wallsBeside.set(cell, [...(wallsBeside.get(cell) ?? []), index]);
  }
  const wallCount = new Array<number>(numbered.length).fill(0);
  const litCount = new Array<number>(size * size).fill(0);
  let found = 0;

  const walk = (i: number): void => {
    if (found >= limit) return;
    if (i === whites.length) {
      found += 1;
      return;
    }
    const cell = whites[i]!;
    const tryState = (bulb: boolean) => {
      const line = sight.get(cell)!;
      if (bulb) {
        if (litCount[cell]! > 0) return;
        for (const w of wallsBeside.get(cell) ?? []) if (wallCount[w]! >= numbered[w]!.n) return;
        for (const other of line) litCount[other]! += 1;
        for (const w of wallsBeside.get(cell) ?? []) wallCount[w]! += 1;
      }
      const ok =
        litDue[i]!.every((due) => litCount[due]! > 0) &&
        wallDue[i]!.every((w) => wallCount[w] === numbered[w]!.n);
      if (ok) walk(i + 1);
      if (bulb) {
        for (const other of line) litCount[other]! -= 1;
        for (const w of wallsBeside.get(cell) ?? []) wallCount[w]! -= 1;
      }
    };
    tryState(true);
    tryState(false);
  };
  walk(0);
  return found;
}

/** Solved = 100 + time bonus; otherwise 70 × lit ÷ whites − 5 per clashing bulb. */
export function scoreLightUp(
  solved: boolean,
  msRemaining: number,
  timeLimitMs: number,
  lit: number,
  whites: number,
  clashing: number,
): number {
  if (solved) return Math.min(150, 130 + Math.round((20 * Math.max(0, Math.min(timeLimitMs, msRemaining))) / timeLimitMs));
  if (whites <= 0) return 0;
  return Math.max(0, Math.round((110 * lit) / whites) - 5 * clashing);
}
