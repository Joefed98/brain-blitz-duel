/**
 * Tile Grid rules, shared by the phone and the server. A grid is 49 cells,
 * row-major, "" for empty. The answer is the grid as 49 characters ("." empty).
 * Dictionary checks happen only on the server.
 */
import { finishParts, partialParts, scoreRev1 } from "./puzzleScoreRev";
import { dealtDepthRev } from "./wordDepth";
import { dealtTopupRev } from "./depthTopup";
import type { TileGridPuzzleData } from "./types";


export const TG_SIZE = 7;
export const TG_CELLS = TG_SIZE * TG_SIZE;
export const TG_TILES = 15;
export const TG_TIME_MS = 100_000;
export const TG_REVEAL_MS = 8_000;

/** Word depth to 200 (25 Oct 2026): Interlock's stretch stamp; the board and rules are unchanged (depth/tilegrid.server.ts). */
export const TILE_GRID_DEPTH_REV = 1;

/** The puzzle top-up (26 Oct 2026): tileGridRev 2, the same board, its pace bonus retuned (TILEGRID_STRETCH_TOPUP). */
export const TILE_GRID_TOPUP_REV = 2;

/** New rounds carry tileGridRev 2 (1 while a check pins the live stamps, none while one pins the pre-depth stamps). */
export function stampTileGridRev(puzzle: TileGridPuzzleData): TileGridPuzzleData {
  const rev = dealtDepthRev<number | undefined>(dealtTopupRev(TILE_GRID_TOPUP_REV, TILE_GRID_DEPTH_REV), undefined);
  return rev === undefined ? puzzle : { ...puzzle, tileGridRev: rev };
}

/**
 * Interlock's levels (D1, 21 Nov 2026; difficulty-spec.md "Interlock"): tileGridRev 5 on level deals only. The board's
 * side and its tile count are stored on the puzzle (`size`, `tiles`; Easy 6 and 10, Hard 8 and 19, Expert 9 and 23), the
 * answer string is the stored size's cells, and an unfinished grid's tile credit is 120 × tiles counted ÷ tiles. Normal
 * stays tileGridRev 4 on the 7 × 7 board of fifteen tiles: every helper below defaults to it.
 */
export const TILE_GRID_LEVEL_REV = 5;

/** The board's side: a level deal's stored size (tileGridRev 5), else TG_SIZE. */
export function tileGridSize(puzzle: { size?: number } | null | undefined): number {
  const v = puzzle?.size;
  return typeof v === "number" && Number.isInteger(v) && v >= 4 && v <= 10 ? v : TG_SIZE;
}

/** The tiles a board deals: a level deal's stored count (tileGridRev 5), else TG_TILES. */
export function tileGridTiles(puzzle: { tiles?: number } | null | undefined): number {
  const v = puzzle?.tiles;
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : TG_TILES;
}

/** A grid's side from its cells (a level board's 36, 64 or 81 cells); TG_SIZE for anything else. */
export function tileGridSizeOfCells(cells: readonly unknown[]): number {
  const n = Math.round(Math.sqrt(cells.length));
  return n * n === cells.length && n >= 4 && n <= 10 ? n : TG_SIZE;
}

export interface TileRun {
  word: string;
  cells: number[];
  horizontal: boolean;
}

export function encodeTileGrid(cells: string[], size: number = TG_SIZE): string {
  return Array.from({ length: size * size }, (_, i) => (cells[i] ? cells[i]!.slice(0, 1) : ".")).join("");
}

export function decodeTileGrid(raw: string, size: number = TG_SIZE): string[] {
  const text = typeof raw === "string" ? raw.toUpperCase() : "";
  return Array.from({ length: size * size }, (_, i) => {
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
export function tileGridWordCells(cells: string[], validWord: (word: string) => boolean, size: number = tileGridSizeOfCells(cells)): Set<number> {
  const counted = new Set<number>();
  for (const run of tileGridRuns(cells, size)) {
    if (run.word.length < 3 || !validWord(run.word)) continue;
    for (const cell of run.cells) counted.add(cell);
  }
  return counted;
}

/** Every horizontal and vertical run of two or more touching letters (the grid's side from its cells unless given). */
export function tileGridRuns(cells: string[], size: number = tileGridSizeOfCells(cells)): TileRun[] {
  const runs: TileRun[] = [];
  for (const horizontal of [true, false]) {
    for (let a = 0; a < size; a++) {
      let current: number[] = [];
      for (let b = 0; b <= size; b++) {
        const index = horizontal ? a * size + b : b * size + a;
        if (b < size && cells[index]) {
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
export function tileGridConnected(cells: string[], size: number = tileGridSizeOfCells(cells)): boolean {
  const filled = cells.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
  if (filled.length === 0) return false;
  const seen = new Set<number>([filled[0]!]);
  const queue = [filled[0]!];
  while (queue.length) {
    const cell = queue.pop()!;
    const col = cell % size;
    const next = [cell - size, cell + size, col > 0 ? cell - 1 : -1, col < size - 1 ? cell + 1 : -1];
    for (const n of next) {
      if (n < 0 || n >= size * size || !cells[n] || seen.has(n)) continue;
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
export function scoreTileGrid(valid: boolean, placed: number, wordTiles: number, speed: number, tiles: number = TG_TILES): number {
  const n = Math.max(0, Math.min(tiles, placed));
  // Rev 1: the grader passes PAR(30); unfinished credit is 110 × tiles in a real word ÷ 15.
  if (scoreRev1()) {
    if (valid && n === tiles) return finishParts(Math.max(0, Math.min(30, speed)));
    return partialParts((110 * Math.max(0, Math.min(tiles, wordTiles))) / tiles);
  }
  if (valid && n === tiles) return Math.min(150, 130 + Math.max(0, Math.min(20, speed)));
  return Math.min(150, ((8 * TG_TILES) / tiles) * Math.max(0, Math.min(tiles, wordTiles)));
}

/**
 * The reveal and leaderboard line for a stored Interlock result (display only, 19 Oct 2026).
 * A finish is all fifteen tiles in a valid grid; anything shorter says how many tiles were placed
 * and how many sit in a real word (the stored `wordTiles`), never "valid" in gold. Older rounds
 * without `wordTiles` say whether the grid was valid.
 */
export function tileGridResultLine(result: { placed: number; valid: boolean; wordTiles?: number | null; countedTiles?: number | null }, tiles: number = TG_TILES): {
  text: string;
  finish: boolean;
} {
  const TG_TILES = tiles;
  const placed = Math.max(0, Math.min(TG_TILES, Math.round(result.placed) || 0));
  // tileGridRev 4 (wordNov7.ts): an unfinished grid counts tiles in real words or placed as in the answer grid.
  if (typeof result.countedTiles === "number" && Number.isFinite(result.countedTiles) && placed > 0 && !(placed === TG_TILES && result.valid)) {
    const counted = Math.max(0, Math.min(placed, Math.round(result.countedTiles)));
    const head = placed === TG_TILES ? `All ${TG_TILES} placed` : `${placed} of ${TG_TILES} tiles placed`;
    return { text: `${head} · ${counted === 0 ? "none" : counted} counted`, finish: false };
  }
  const words =
    typeof result.wordTiles === "number" && Number.isFinite(result.wordTiles)
      ? Math.max(0, Math.min(placed, Math.round(result.wordTiles)))
      : null;
  if (placed === 0) return { text: "No tiles placed", finish: false };
  if (placed === TG_TILES && result.valid) return { text: `All ${TG_TILES} tiles · every word valid`, finish: true };
  const head = placed === TG_TILES ? `All ${TG_TILES} placed` : `${placed} of ${TG_TILES} tiles placed`;
  if (words === null || words === placed) {
    return { text: `${head} · ${result.valid ? "every word valid" : "grid not valid"}`, finish: false };
  }
  return { text: `${head} · ${words === 0 ? "none" : words} in valid words`, finish: false };
}
