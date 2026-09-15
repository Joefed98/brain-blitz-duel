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
  { name: "Two", cells: [[0, 0], [0, 1]], colour: 1 },
  { name: "Three", cells: [[0, 0], [0, 1], [0, 2]], colour: 2 },
  { name: "Four", cells: [[0, 0], [0, 1], [0, 2], [0, 3]], colour: 3 },
  { name: "Square", cells: [[0, 0], [0, 1], [1, 0], [1, 1]], colour: 4 },
  { name: "Corner", cells: [[0, 0], [1, 0], [1, 1]], colour: 0 },
  { name: "L", cells: [[0, 0], [1, 0], [2, 0], [2, 1]], colour: 1 },
  { name: "T", cells: [[0, 0], [0, 1], [0, 2], [1, 1]], colour: 2 },
  { name: "S", cells: [[0, 1], [0, 2], [1, 0], [1, 1]], colour: 3 },
];

export const BLOCK_PIECE_CELLS = BLOCK_PIECES.reduce((sum, p) => sum + p.cells.length, 0);

type Offsets = [number, number][];

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
export function orientations(piece: number): Offsets[] {
  const base = normalise(BLOCK_PIECES[piece]!.cells);
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

/** Absolute cells for an orientation anchored at a top-left row and column. */
export function absoluteCells(offsets: Offsets, row: number, col: number): number[] | null {
  const cells: number[] = [];
  for (const [dr, dc] of offsets) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || r >= N || c < 0 || c >= N) return null;
    cells.push(r * N + c);
  }
  return cells;
}

export function fitsOn(cells: number[], taken: Set<number>): boolean {
  return cells.every((cell) => cell >= 0 && cell < BLOCK_CELLS && !taken.has(cell));
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
export function verifyPlacements(
  blockers: number[],
  placements: BlockPlacement[],
): BlockVerdict {
  const taken = new Set<number>(blockers);
  const used = new Set<number>();
  const legal: BlockPlacement[] = [];

  for (const placement of placements.slice(0, BLOCK_PIECES.length)) {
    const piece = placement.piece;
    if (!Number.isInteger(piece) || piece < 0 || piece >= BLOCK_PIECES.length) continue;
    if (used.has(piece)) continue;
    const cells = [...new Set(placement.cells ?? [])];
    if (cells.length !== BLOCK_PIECES[piece]!.cells.length) continue;
    if (!cells.every((c) => Number.isInteger(c) && c >= 0 && c < BLOCK_CELLS)) continue;
    if (!matchesShape(piece, cells)) continue;
    if (!fitsOn(cells, taken)) continue;
    for (const cell of cells) taken.add(cell);
    used.add(piece);
    legal.push({ piece, cells });
  }

  const covered = legal.reduce((sum, p) => sum + p.cells.length, 0);
  return { legal, covered, solved: covered >= BLOCK_FREE_CELLS };
}

/** True when these absolute cells are one of the piece's real orientations. */
export function matchesShape(piece: number, cells: number[]): boolean {
  const offsets = normalise(cells.map((cell) => [Math.floor(cell / N), cell % N] as [number, number]));
  const wanted = key(offsets);
  return BLOCK_ORIENTATIONS[piece]!.some((option) => key(option) === wanted);
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
