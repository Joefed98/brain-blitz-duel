/**
 * Tile Grid rules, shared by the phone and the server. A grid is 49 cells,
 * row-major, "" for empty. The answer is the grid as 49 characters ("." empty).
 * Dictionary checks happen only on the server.
 */
import { finishParts, partialParts, scoreRev1 } from "./puzzleScoreRev";


export const TG_SIZE = 7;
export const TG_CELLS = TG_SIZE * TG_SIZE;
export const TG_TILES = 15;
export const TG_TIME_MS = 100_000;
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

/** Union of cells in currently valid whole runs; crossings count only once.
 * The phone supplies server verdicts; the grader supplies its private dictionary.
 */
export function tileGridWordCells(cells: string[], validWord: (word: string) => boolean): Set<number> {
  const counted = new Set<number>();
  for (const run of tileGridRuns(cells)) {
    if (run.word.length < 3 || !validWord(run.word)) continue;
    for (const cell of run.cells) counted.add(cell);
  }
  return counted;
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

/**
 * Tile Grid score: all fifteen in a valid grid = 130 + speed (0–20, cap 150);
 * otherwise 8 per tile that sits in at least one real word of the grid.
 */
export function scoreTileGrid(valid: boolean, placed: number, wordTiles: number, speed: number): number {
  const n = Math.max(0, Math.min(TG_TILES, placed));
  // Rev 1: the grader passes PAR(30); unfinished credit is 110 × tiles in a real word ÷ 15.
  if (scoreRev1()) {
    if (valid && n === TG_TILES) return finishParts(Math.max(0, Math.min(30, speed)));
    return partialParts((110 * Math.max(0, Math.min(TG_TILES, wordTiles))) / TG_TILES);
  }
  if (valid && n === TG_TILES) return Math.min(150, 130 + Math.max(0, Math.min(20, speed)));
  return Math.min(150, 8 * Math.max(0, Math.min(TG_TILES, wordTiles)));
}
