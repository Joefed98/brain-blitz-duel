/**
 * Sliding Tiles rules. A frame is one number per cell, with 0 for the gap.
 * The player's answer is the list of tile values tapped; the server replays it
 * through exactly this code.
 *
 * Stored rounds (no `tilesRev`) play the classic 3×3 frame: nine cells, tiles
 * 1–8. From `tilesRev: 1` (14 Oct 2026) the board is the 3×3 grid plus one
 * extra cell attached to one side (`extra`), so one row or column has four
 * cells: ten cells, tiles 1–9 and one gap. Cells 0–8 are the grid row-major and
 * cell 9 is the extra cell. Either way the finished order is 1, 2, 3 … in
 * reading order (row by row, left to right) with the gap in the last cell.
 */

import { TILES_COUNT, TILES_SIZE, type TilesExtra, type TilesPuzzleData } from "./types";

export const TILES_UNDO = -1;
export const TILES_RESET = -2;

/** The extra-cell board's stamp (tilesRev 1). */
export const TILES_REV_EXTRA = 1;
/**
 * tilesRev 2 (20 Oct 2026, Joe's ruling; docs/scoring-targets.md): the same extra-cell board on a 90 s clock
 * (stored on the puzzle as `timeLimitMs`), since the average simulated players ran out of time at 60 s (none of
 * 30 finished; their median finish was 99 s). Rounds without it keep 60 s.
 */
export const TILES_REV_CLOCK = 2;
export const TILES_REV2_TIME_MS = 90_000;
/** Tiles on the extra-cell board. */
export const TILES_EXTRA_COUNT = 9;

/** A board's cells (row, column; the extra cell may sit at -1 or 3) and its finished frame. */
export interface TilesLayout {
  cells: { r: number; c: number }[];
  goal: number[];
  /** Tiles on the board (8 or 9). */
  count: number;
  /** The bounding box in cells, and where its top-left sits. */
  rows: number;
  cols: number;
  top: number;
  left: number;
}

function buildLayout(cells: { r: number; c: number }[]): TilesLayout {
  const order = cells.map((cell, index) => ({ ...cell, index })).sort((a, b) => a.r - b.r || a.c - b.c);
  const goal = new Array<number>(cells.length).fill(0);
  order.forEach((cell, rank) => {
    goal[cell.index] = rank === order.length - 1 ? 0 : rank + 1;
  });
  const rs = cells.map((cell) => cell.r);
  const cs = cells.map((cell) => cell.c);
  const top = Math.min(...rs);
  const left = Math.min(...cs);
  return {
    cells,
    goal,
    count: cells.length - 1,
    rows: Math.max(...rs) - top + 1,
    cols: Math.max(...cs) - left + 1,
    top,
    left,
  };
}

const GRID_CELLS = Array.from({ length: TILES_SIZE * TILES_SIZE }, (_v, index) => ({
  r: Math.floor(index / TILES_SIZE),
  c: index % TILES_SIZE,
}));

/** The classic 3×3 frame every stored round plays. */
export const CLASSIC_TILES_LAYOUT: TilesLayout = buildLayout(GRID_CELLS);

/** Where the extra cell sits for one side and position along it. */
export function extraCell(extra: TilesExtra): { r: number; c: number } {
  const i = Math.max(0, Math.min(TILES_SIZE - 1, Math.round(extra.index)));
  if (extra.side === "top") return { r: -1, c: i };
  if (extra.side === "bottom") return { r: TILES_SIZE, c: i };
  if (extra.side === "left") return { r: i, c: -1 };
  return { r: i, c: TILES_SIZE };
}

const LAYOUTS = new Map<string, TilesLayout>();
export function extraLayout(extra: TilesExtra): TilesLayout {
  const key = `${extra.side}:${extra.index}`;
  let layout = LAYOUTS.get(key);
  if (!layout) {
    layout = buildLayout([...GRID_CELLS, extraCell(extra)]);
    LAYOUTS.set(key, layout);
  }
  return layout;
}

/** The board a stored puzzle plays: the extra-cell board from tilesRev 1, else the classic frame. */
export function tilesLayout(puzzle: Pick<TilesPuzzleData, "tilesRev" | "extra">): TilesLayout {
  return (puzzle.tilesRev ?? 0) >= TILES_REV_EXTRA && puzzle.extra ? extraLayout(puzzle.extra) : CLASSIC_TILES_LAYOUT;
}

export function solvedFrame(layout: TilesLayout = CLASSIC_TILES_LAYOUT): number[] {
  return [...layout.goal];
}

export function tilesSolved(frame: number[], layout: TilesLayout = CLASSIC_TILES_LAYOUT): boolean {
  const goal = layout.goal;
  return frame.length === goal.length && frame.every((value, index) => value === goal[index]);
}

/** How many tiles already sit in their finished position. */
export function tilesInPlace(frame: number[], layout: TilesLayout = CLASSIC_TILES_LAYOUT): number {
  const goal = layout.goal;
  return frame.filter((value, index) => value !== 0 && value === goal[index]).length;
}

function adjacent(a: number, b: number, layout: TilesLayout): boolean {
  const ca = layout.cells[a];
  const cb = layout.cells[b];
  if (!ca || !cb) return false;
  return Math.abs(ca.r - cb.r) + Math.abs(ca.c - cb.c) === 1;
}

/** Every tile value that can slide into the gap right now. */
export function tilesMovable(frame: number[], layout: TilesLayout = CLASSIC_TILES_LAYOUT): number[] {
  const gap = frame.indexOf(0);
  if (gap < 0) return [];
  return frame
    .map((value, index) => (value !== 0 && adjacent(index, gap, layout) ? value : 0))
    .filter((value) => value !== 0);
}

/** Slides one tile into the gap, or returns null when that tile cannot move. */
export function tilesSlide(frame: number[], tile: number, layout: TilesLayout = CLASSIC_TILES_LAYOUT): number[] | null {
  const gap = frame.indexOf(0);
  const from = frame.indexOf(tile);
  if (gap < 0 || from < 0 || tile === 0 || !adjacent(from, gap, layout)) return null;
  const next = [...frame];
  next[gap] = tile;
  next[from] = 0;
  return next;
}

export function encodeTileMoves(moves: number[]): string {
  return moves.join(",");
}

/** `maxTile` is the board's tile count: 8 on stored rounds (a 9 was always dropped there), 9 from tilesRev 1. */
export function decodeTileMoves(raw: string, maxTile: number = TILES_COUNT): number[] {
  return String(raw ?? "")
    .split(",")
    .map((part) => Number.parseInt(part, 10))
    .filter((value) => Number.isInteger(value) && value >= TILES_RESET && value <= maxTile);
}

export interface TilesReplay {
  frame: number[];
  solved: boolean;
  moves: number;
  inPlace: number;
}

/** The one place a move list is replayed — used for scoring, Undo and Reset. */
export function replayTiles(start: number[], moves: number[], layout: TilesLayout = CLASSIC_TILES_LAYOUT): TilesReplay {
  const history: number[][] = [[...start]];
  let totalMoves = 0;
  for (const move of moves) {
    const frame = history[history.length - 1]!;
    if (tilesSolved(frame, layout)) break;
    if (move === TILES_RESET) {
      history.length = 1;
      continue;
    }
    if (move === TILES_UNDO) {
      if (history.length > 1) history.pop();
      continue;
    }
    const next = tilesSlide(frame, move, layout);
    if (next) { history.push(next); totalMoves++; }
  }
  const frame = history[history.length - 1]!;
  return {
    frame,
    solved: tilesSolved(frame, layout),
    moves: totalMoves,
    inPlace: tilesInPlace(frame, layout),
  };
}
