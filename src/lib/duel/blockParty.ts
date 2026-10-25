/**
 * Block Party rules and piece shapes. Shared by the phone (to decide whether a
 * drop is legal) and by the server (to verify what a phone sends).
 */

import { BLOCK_CELLS, BLOCK_COLS as N, BLOCK_FREE_CELLS, type BlockPlacement } from "./types";

export interface BlockPieceDef {
  name: string;
  /** Base cells as [row, col] offsets. */
  cells: [number, number][];
  /** Index into the tray palette. */
  colour: number;
}

/** Nine pieces covering exactly the 29 free cells of the board. */
export const BLOCK_PIECES: BlockPieceDef[] = [
  { name: "Dot", cells: [[0, 0]], colour: 0 },
  {
    name: "Two",
    cells: [
      [0, 0],
      [0, 1],
    ],
    colour: 1,
  },
  {
    name: "Three",
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    colour: 2,
  },
  {
    name: "Four",
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ],
    colour: 3,
  },
  {
    name: "Square",
    cells: [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
    colour: 4,
  },
  {
    name: "Corner",
    cells: [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    colour: 0,
  },
  {
    name: "L",
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
    ],
    colour: 1,
  },
  {
    name: "T",
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 1],
    ],
    colour: 2,
  },
  {
    name: "S",
    cells: [
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
    ],
    colour: 3,
  },
];

export const BLOCK_PIECE_CELLS = BLOCK_PIECES.reduce((sum, p) => sum + p.cells.length, 0);

/**
 * blockRev 1 (depth batch 4, docs/depth/d4-pattern.md): the 7×7 board's ten pieces, the nine above plus a
 * Plus, covering exactly its 34 free cells (49 less fifteen pegs): a bigger shape with one more piece, so the
 * round still fits its 60 seconds.
 */
export const BLOCK_D4_PIECES: BlockPieceDef[] = [
  ...BLOCK_PIECES,
  {
    name: "Plus",
    cells: [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 1],
    ],
    colour: 4,
  },
];

/** A Tessellate board's shape: its width, its pegs and its pieces. */
export interface BlockGeometry {
  cols: number;
  cells: number;
  blockers: number;
  free: number;
  pieces: BlockPieceDef[];
}

/** The board every round dealt before blockRev 1 plays. */
export const BLOCK_GEOMETRY_0: BlockGeometry = { cols: N, cells: BLOCK_CELLS, blockers: 7, free: BLOCK_FREE_CELLS, pieces: BLOCK_PIECES };
/** blockRev 1: 7×7, fifteen pegs, ten pieces. */
export const BLOCK_GEOMETRY_D4: BlockGeometry = { cols: 7, cells: 49, blockers: 15, free: 34, pieces: BLOCK_D4_PIECES };

/** The board a stored puzzle plays on. */
export function blockGeometry(puzzle: { blockRev?: number } | null | undefined): BlockGeometry {
  return (puzzle?.blockRev ?? 0) >= 1 ? BLOCK_GEOMETRY_D4 : BLOCK_GEOMETRY_0;
}

export type Offsets = [number, number][];

function normalise(cells: Offsets): Offsets {
  const minR = Math.min(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  return cells
    .map(([r, c]) => [r - minR, c - minC] as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

const key = (cells: Offsets) => cells.map(([r, c]) => `${r},${c}`).join(" ");

function rotate(cells: Offsets): Offsets {
  return normalise(cells.map(([r, c]) => [c, -r] as [number, number]));
}

function flip(cells: Offsets): Offsets {
  return normalise(cells.map(([r, c]) => [r, -c] as [number, number]));
}

/** Every distinct rotation and reflection of a piece. */
export function orientations(piece: number, pieces: BlockPieceDef[] = BLOCK_PIECES): Offsets[] {
  const base = normalise(pieces[piece]!.cells);
  const seen = new Map<string, Offsets>();
  let current = base;
  for (let f = 0; f < 2; f++) {
    current = f === 0 ? base : flip(base);
    for (let r = 0; r < 4; r++) {
      seen.set(key(current), current);
      current = rotate(current);
    }
  }
  return [...seen.values()];
}

export const BLOCK_ORIENTATIONS: Offsets[][] = BLOCK_PIECES.map((_, i) => orientations(i));
/** Orientations of every piece of the 7×7 board (the first nine are BLOCK_ORIENTATIONS). */
export const BLOCK_D4_ORIENTATIONS: Offsets[][] = BLOCK_D4_PIECES.map((_, i) => orientations(i, BLOCK_D4_PIECES));

export function orientationsFor(geo: BlockGeometry): Offsets[][] {
  return geo === BLOCK_GEOMETRY_D4 || geo.pieces === BLOCK_D4_PIECES ? BLOCK_D4_ORIENTATIONS : BLOCK_ORIENTATIONS;
}

/** Absolute cells for an orientation anchored at a top-left row and column. */
export function absoluteCells(offsets: Offsets, row: number, col: number, cols: number = N): number[] | null {
  const cells: number[] = [];
  for (const [dr, dc] of offsets) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || r >= cols || c < 0 || c >= cols) return null;
    cells.push(r * cols + c);
  }
  return cells;
}

export function fitsOn(cells: number[], taken: Set<number>, total: number = BLOCK_CELLS): boolean {
  return cells.every((cell) => cell >= 0 && cell < total && !taken.has(cell));
}

export interface BlockVerdict {
  /** Only the placements that are legal together, in order. */
  legal: BlockPlacement[];
  covered: number;
  solved: boolean;
}

/**
 * Checks a set of placements: one entry per piece at most, matching that piece's
 * real shape, inside the grid, never on a peg or another piece.
 */
export function verifyPlacements(blockers: number[], placements: BlockPlacement[], geo: BlockGeometry = BLOCK_GEOMETRY_0): BlockVerdict {
  const taken = new Set<number>(blockers);
  const used = new Set<number>();
  const legal: BlockPlacement[] = [];
  const pieces = geo.pieces;

  for (const placement of placements.slice(0, pieces.length)) {
    const piece = placement.piece;
    if (!Number.isInteger(piece) || piece < 0 || piece >= pieces.length) continue;
    if (used.has(piece)) continue;
    const cells = [...new Set(placement.cells ?? [])];
    if (cells.length !== pieces[piece]!.cells.length) continue;
    if (!cells.every((c) => Number.isInteger(c) && c >= 0 && c < geo.cells)) continue;
    if (!matchesShape(piece, cells, geo)) continue;
    if (!fitsOn(cells, taken, geo.cells)) continue;
    for (const cell of cells) taken.add(cell);
    used.add(piece);
    legal.push({ piece, cells });
  }

  const covered = legal.reduce((sum, p) => sum + p.cells.length, 0);
  return { legal, covered, solved: covered >= geo.free };
}

/** True when these absolute cells are one of the piece's real orientations. */
export function matchesShape(piece: number, cells: number[], geo: BlockGeometry = BLOCK_GEOMETRY_0): boolean {
  const cols = geo.cols;
  const offsets = normalise(
    cells.map((cell) => [Math.floor(cell / cols), cell % cols] as [number, number]),
  );
  const wanted = key(offsets);
  return (orientationsFor(geo)[piece] ?? []).some((option) => key(option) === wanted);
}

export function encodePlacements(placements: BlockPlacement[]): string {
  return placements.map((p) => `${p.piece}:${p.cells.join("-")}`).join(";");
}

export function decodePlacements(raw: string): BlockPlacement[] {
  return raw
    .split(";")
    .filter(Boolean)
    .map((part) => {
      const [piece, cells] = part.split(":");
      return {
        piece: Number.parseInt(piece ?? "", 10),
        cells: (cells ?? "")
          .split("-")
          .map((value) => Number.parseInt(value, 10))
          .filter(Number.isFinite),
      };
    })
    .filter((p) => Number.isInteger(p.piece));
}

/** The piece's cells after a number of quarter turns and an optional flip. */
export function orientationOffsets(piece: number, rot: number, flipped: boolean): Offsets {
  let cells = normalise(BLOCK_D4_PIECES[piece]!.cells);
  if (flipped) cells = flip(cells);
  const turns = ((rot % 4) + 4) % 4;
  for (let i = 0; i < turns; i++) cells = rotate(cells);
  return cells;
}

/** Bounding box of an orientation, in cells. */
export function offsetsSize(offsets: Offsets): { rows: number; cols: number } {
  return {
    rows: Math.max(...offsets.map(([r]) => r)) + 1,
    cols: Math.max(...offsets.map(([, c]) => c)) + 1,
  };
}
