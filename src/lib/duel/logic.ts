/**
 * Pure rules for the three logic types — Lights Out, Pipes and Mini Sudoku.
 * Shared by the phone (to draw the live board) and by the server (to replay
 * and check what a phone sends). No answers and no generators live here.
 */

import {
  LIGHTS_CELLS,
  LIGHTS_COLS,
  PIPES_CELLS,
  PIPES_COLS,
  SUDOKU_BOX_COLS,
  SUDOKU_BOX_ROWS,
  SUDOKU_CELLS,
  SUDOKU_COLS,
  type PipeShape,
  type PipeTile,
} from "./types";

/* -------------------------------------------------------------------------- */
/*  Lights Out                                                                 */
/* -------------------------------------------------------------------------- */

/** The cell itself plus its orthogonal neighbours. */
export function lightsNeighbourhood(cell: number): number[] {
  const row = Math.floor(cell / LIGHTS_COLS);
  const col = cell % LIGHTS_COLS;
  const cells = [cell];
  if (row > 0) cells.push(cell - LIGHTS_COLS);
  if (row < LIGHTS_COLS - 1) cells.push(cell + LIGHTS_COLS);
  if (col > 0) cells.push(cell - 1);
  if (col < LIGHTS_COLS - 1) cells.push(cell + 1);
  return cells;
}

export function pressLights(lights: boolean[], cell: number): boolean[] {
  const next = [...lights];
  if (!Number.isInteger(cell) || cell < 0 || cell >= LIGHTS_CELLS) return next;
  for (const index of lightsNeighbourhood(cell)) next[index] = !next[index];
  return next;
}

export function lightsAllOff(lights: boolean[]): boolean {
  return lights.every((on) => !on);
}

export function lightsOnCount(lights: boolean[]): number {
  return lights.filter(Boolean).length;
}

export function encodePresses(presses: number[]): string {
  return presses.join(",");
}

export function decodePresses(raw: string): number[] {
  return String(raw ?? "")
    .split(",")
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value >= -2 && value < LIGHTS_CELLS)
    .slice(0, 400);
}

/** Replays a phone's presses on the stored pattern. */
export function replayLights(start: boolean[], presses: number[]): boolean[] {
  let state = [...start];
  const history = [state];
  for (const cell of presses) {
    if (cell === -1) { if (history.length > 1) history.pop(); state = history[history.length - 1]!; }
    else if (cell === -2) { history.length = 1; state = history[0]!; }
    else { state = pressLights(state, cell); history.push(state); }
  }
  return state;
}

/* -------------------------------------------------------------------------- */
/*  Pipes                                                                      */
/* -------------------------------------------------------------------------- */

/** Open sides as a bitmask: north 1, east 2, south 4, west 8. */
export const PIPE_N = 1;
export const PIPE_E = 2;
export const PIPE_S = 4;
export const PIPE_W = 8;

export const PIPE_BITS = [PIPE_N, PIPE_E, PIPE_S, PIPE_W];

/** Rotates a side-set by `turns` quarter turns clockwise (N→E→S→W→N). */
export function rotateMask(mask: number, turns: number): number {
  const t = ((turns % 4) + 4) % 4;
  let out = 0;
  for (let bit = 0; bit < 4; bit++) {
    if (mask & (1 << bit)) out |= 1 << ((bit + t) % 4);
  }
  return out;
}

/** The tile's open sides — the single source of truth for drawing and flow. */
export function tileOpenings(tile: PipeTile): number {
  return (tile?.sides ?? 0) & 15;
}

export function rotateTile(tile: PipeTile, turns = 1): PipeTile {
  return { sides: rotateMask(tileOpenings(tile), turns) };
}

/** Every distinct side-set this tile can be turned into. */
export function tileRotations(tile: PipeTile): number[] {
  const seen = new Set<number>();
  for (let turns = 0; turns < 4; turns++) seen.add(rotateMask(tileOpenings(tile), turns));
  return [...seen];
}

/** Drawn shape, derived from the side-set alone. */
export function shapeForMask(mask: number): PipeShape {
  const open = mask & 15;
  const count = PIPE_BITS.filter((bit) => open & bit).length;
  if (count === 4) return "cross";
  if (count === 3) return "tee";
  if (count === 1) return "end";
  if (count === 2) {
    return open === (PIPE_N | PIPE_S) || open === (PIPE_E | PIPE_W) ? "straight" : "corner";
  }
  return "end";
}

/** The neighbour reached through one opening, or null at a wall. */
export function pipeNeighbour(cell: number, bit: number): number | null {
  const row = Math.floor(cell / PIPES_COLS);
  const col = cell % PIPES_COLS;
  if (bit === PIPE_N) return row > 0 ? cell - PIPES_COLS : null;
  if (bit === PIPE_S) return row < PIPES_COLS - 1 ? cell + PIPES_COLS : null;
  if (bit === PIPE_W) return col > 0 ? cell - 1 : null;
  if (bit === PIPE_E) return col < PIPES_COLS - 1 ? cell + 1 : null;
  return null;
}

const OPPOSITE: Record<number, number> = {
  [PIPE_N]: PIPE_S,
  [PIPE_S]: PIPE_N,
  [PIPE_E]: PIPE_W,
  [PIPE_W]: PIPE_E,
};

export interface PipesState {
  /** Every tile reachable from the source through matching openings. */
  connected: Set<number>;
  /** Tiles with an opening pointing at a wall or an unmatched neighbour. */
  leaks: Set<number>;
  solved: boolean;
}

/** Works out the live water flow and the leaks of a board. */
export function pipesState(tiles: PipeTile[], source: number): PipesState {
  const openings = tiles.map(tileOpenings);
  const leaks = new Set<number>();

  for (let cell = 0; cell < tiles.length; cell++) {
    for (const bit of [PIPE_N, PIPE_E, PIPE_S, PIPE_W]) {
      if (!(openings[cell]! & bit)) continue;
      const next = pipeNeighbour(cell, bit);
      if (next === null || !(openings[next]! & OPPOSITE[bit]!)) leaks.add(cell);
    }
  }

  const connected = new Set<number>();
  if (source >= 0 && source < tiles.length) {
    const queue = [source];
    connected.add(source);
    while (queue.length) {
      const cell = queue.pop()!;
      for (const bit of [PIPE_N, PIPE_E, PIPE_S, PIPE_W]) {
        if (!(openings[cell]! & bit)) continue;
        const next = pipeNeighbour(cell, bit);
        if (next === null || connected.has(next)) continue;
        if (!(openings[next]! & OPPOSITE[bit]!)) continue;
        connected.add(next);
        queue.push(next);
      }
    }
  }

  return {
    connected,
    leaks,
    solved: connected.size === tiles.length && leaks.size === 0,
  };
}

/** One hex character per tile, holding its open sides. */
export function encodeSides(tiles: PipeTile[]): string {
  return tiles.map((tile) => tileOpenings(tile).toString(16)).join("");
}

/**
 * Reads a phone's final side-sets back. A submitted set is only accepted when
 * it is a rotation of the stored tile, so a phone cannot invent a new shape.
 */
export function decodeSides(tiles: PipeTile[], raw: string): PipeTile[] {
  const chars = String(raw ?? "").replace(/[^0-9a-fA-F]/g, "");
  return tiles.map((tile, index) => {
    const parsed = Number.parseInt(chars[index] ?? "", 16);
    const allowed = tileRotations(tile);
    return { sides: allowed.includes(parsed) ? parsed : tileOpenings(tile) };
  });
}

export const PIPES_TILE_COUNT = PIPES_CELLS;

/* -------------------------------------------------------------------------- */
/*  Mini Sudoku                                                                */
/* -------------------------------------------------------------------------- */

export function sudokuBox(cell: number): number {
  const row = Math.floor(cell / SUDOKU_COLS);
  const col = cell % SUDOKU_COLS;
  return (
    Math.floor(row / SUDOKU_BOX_ROWS) * (SUDOKU_COLS / SUDOKU_BOX_COLS) +
    Math.floor(col / SUDOKU_BOX_COLS)
  );
}

/** True when no row, column or box repeats a digit (empties ignored). */
export function sudokuLegal(grid: number[]): boolean {
  const groups: Record<string, Set<number>> = {};
  for (let cell = 0; cell < SUDOKU_CELLS; cell++) {
    const value = grid[cell] ?? 0;
    if (!value) continue;
    const keys = [
      `r${Math.floor(cell / SUDOKU_COLS)}`,
      `c${cell % SUDOKU_COLS}`,
      `b${sudokuBox(cell)}`,
    ];
    for (const key of keys) {
      const seen = (groups[key] ??= new Set<number>());
      if (seen.has(value)) return false;
      seen.add(value);
    }
  }
  return true;
}

export function sudokuComplete(grid: number[]): boolean {
  return grid.length === SUDOKU_CELLS && grid.every((value) => value >= 1 && value <= SUDOKU_COLS);
}

/** A finished, rule-correct grid — the only thing that counts as solved. */
export function sudokuSolved(grid: number[], givens: number[]): boolean {
  if (!sudokuComplete(grid)) return false;
  for (let cell = 0; cell < SUDOKU_CELLS; cell++) {
    const given = givens[cell] ?? 0;
    if (given && grid[cell] !== given) return false;
  }
  return sudokuLegal(grid);
}

export function encodeSudoku(grid: number[]): string {
  return grid.map((value) => (value >= 1 && value <= 9 ? value : 0)).join("");
}

export function decodeSudoku(raw: string): number[] {
  const digits = String(raw ?? "").replace(/[^0-6]/g, "");
  return Array.from(
    { length: SUDOKU_CELLS },
    (_, index) => Number.parseInt(digits[index] ?? "0", 10) || 0,
  );
}
