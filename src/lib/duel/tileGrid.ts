/**
 * Tile Grid rules, shared by the phone and the server. A grid is 49 cells,
 * row-major, "" for empty. The answer is the grid as 49 characters ("." empty).
 * Dictionary checks happen only on the server.
 */

export const TG_SIZE = 7;
export const TG_CELLS = TG_SIZE * TG_SIZE;
export const TG_TILES = 15;
export const TG_TIME_MS = 90_000;
export const TG_REVEAL_MS = 8_000;

export interface TileRun {
  word: string;
  cells: number[];
  horizontal: boolean;
}

export function encodeTileGrid(cells: string[]): string {
  return Array.from({ length: TG_CELLS }, (_, i) => (cells[i] ? cells[i]!.slice(0, 1) : ".")).join("");
}

export function decodeTileGrid(raw: string): string[] {
  const text = typeof raw === "string" ? raw.toUpperCase() : "";
  return Array.from({ length: TG_CELLS }, (_, i) => {
    const ch = text[i] ?? ".";
    return /^[A-Z]$/.test(ch) ? ch : "";
  });
}

export function placedCount(cells: string[]): number {
  return cells.filter(Boolean).length;
}

/** Every horizontal and vertical run of two or more touching letters. */
export function tileGridRuns(cells: string[]): TileRun[] {
  const runs: TileRun[] = [];
  for (const horizontal of [true, false]) {
    for (let a = 0; a < TG_SIZE; a++) {
      let current: number[] = [];
      for (let b = 0; b <= TG_SIZE; b++) {
        const index = horizontal ? a * TG_SIZE + b : b * TG_SIZE + a;
        if (b < TG_SIZE && cells[index]) {
          current.push(index);
          continue;
        }
        if (current.length >= 2) {
          runs.push({ word: current.map((i) => cells[i]).join(""), cells: current, horizontal });
        }
        current = [];
      }
    }
  }
  return runs;
}

/** True when every placed tile touches the others as one group. */
export function tileGridConnected(cells: string[]): boolean {
  const filled = cells.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
  if (filled.length === 0) return false;
  const seen = new Set<number>([filled[0]!]);
  const queue = [filled[0]!];
  while (queue.length) {
    const cell = queue.pop()!;
    const col = cell % TG_SIZE;
    const next = [cell - TG_SIZE, cell + TG_SIZE, col > 0 ? cell - 1 : -1, col < TG_SIZE - 1 ? cell + 1 : -1];
    for (const n of next) {
      if (n < 0 || n >= TG_CELLS || !cells[n] || seen.has(n)) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return seen.size === filled.length;
}

/** True when the placed letters are drawn from the tray, no letter used twice. */
export function fitsTray(cells: string[], tray: string[]): boolean {
  const pool = new Map<string, number>();
  for (const letter of tray) pool.set(letter, (pool.get(letter) ?? 0) + 1);
  for (const letter of cells) {
    if (!letter) continue;
    const left = pool.get(letter) ?? 0;
    if (left <= 0) return false;
    pool.set(letter, left - 1);
  }
  return true;
}

/** Tile Grid score: valid = share of 100 (+ speed with all 15, cap 150); invalid = share of 50. */
export function scoreTileGrid(valid: boolean, placed: number, speed: number): number {
  const n = Math.max(0, Math.min(TG_TILES, placed));
  if (!valid) return Math.round((50 * n) / TG_TILES);
  if (n === TG_TILES) return Math.min(150, 100 + speed);
  // Near-miss ceiling: an incomplete grid never scores above 90.
  return Math.min(90, Math.round((100 * n) / TG_TILES));
}
