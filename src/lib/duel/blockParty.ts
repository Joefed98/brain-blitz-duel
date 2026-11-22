/**
 * Block Party rules and piece shapes. Shared by the phone (to decide whether a
 * drop is legal) and by the server (to verify what a phone sends).
 */

import { gameLevelSettings } from "@/lib/levels/gameLevels";
import { NORMAL, puzzleLevel, type Level } from "@/lib/levels/levels";

import { BLOCK_CELLS, BLOCK_COLS as N, BLOCK_FREE_CELLS, type BlockPlacement } from "./types";
import { patternLevelFullByS } from "./standard/plLevelSpeed";

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
 * blockRev 1 (depth batch 4, docs/depth/d4-pattern.md): the 7×7 board's nine pieces: the 6×6 board's set with
 * the Dot swapped for a Plus, covering exactly its 33 free cells (49 less sixteen pegs). A bigger shape to fill
 * with the same number of pieces, so the round still fits its 60 seconds. The Plus takes the Dot's index (0).
 */
export const BLOCK_D4_PIECES: BlockPieceDef[] = [
  {
    name: "Plus",
    cells: [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 1],
    ],
    colour: 0,
  },
  ...BLOCK_PIECES.slice(1),
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
/** blockRev 1: 7×7, sixteen pegs, nine pieces (a Plus for the Dot). */
export const BLOCK_GEOMETRY_D4: BlockGeometry = { cols: 7, cells: 49, blockers: 16, free: 33, pieces: BLOCK_D4_PIECES };

/**
 * Every piece shape a Tessellate level may name (the Pattern overhaul, stage 3, 16 Nov 2026), by name: the 6×6 and
 * 7×7 boards' pieces plus two pentominoes for Expert (U and P). A level's settings
 * (src/lib/levels/pattern/blockparty.levels.ts) list its pieces by these names, in tray order; the index in that list
 * is the piece's number and its colour.
 */
export const BLOCK_SHAPES: Readonly<Record<string, [number, number][]>> = {
  ...Object.fromEntries([...BLOCK_PIECES, BLOCK_D4_PIECES[0]!].map((p) => [p.name, p.cells])),
  U: [
    [0, 0],
    [0, 2],
    [1, 0],
    [1, 1],
    [1, 2],
  ],
  P: [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
    [2, 0],
  ],
};

/** The board settings a Tessellate level carries (the levels file; plain data). */
export interface BlockLevelSettings {
  /** The board's width and height in squares. */
  cols: number;
  /** The tray's pieces by name (BLOCK_SHAPES), in tray order. */
  pieces: readonly string[];
  /** Pegs: every square the pieces don't cover (cols² less the pieces' squares). */
  pegs: number;
  /** The board's solution count, proved by an exhaustive count in the bank build (max null: no upper bound). */
  solutions: { min: number; max: number | null };
  /** How the bank lays the pegs: "scatter" (random pegs, as Normal) or "grow" (the pieces grown into one patch). */
  layout: "scatter" | "grow";
  /**
   * Only boards the human-like solver (blockPartyLevels.server.ts humanSolveBlock, at most 4 placements a guess)
   * finishes holding at most `max` guesses at once, and needs at least `min` of them (not a board of forced moves
   * only); null: no such rule (Easy).
   */
  humanDepth: { min: number; max: number } | null;
  /** The round's clock. */
  timeLimitMs: number;
  /** Speed points are full when the board is filled within this many seconds of play. */
  speedFullByS: number;
}

const LEVEL_GEOMETRY = new Map<string, BlockGeometry>();

/**
 * A level's board (stage 3) from its settings' size and pieces, or null at Normal. Hard keeps the 7×7 board's own
 * geometry object (the same pieces), so everything keyed on it is shared.
 */
export function blockLevelGeometry(level: Level): BlockGeometry | null {
  if (level === NORMAL) return null;
  const settings = gameLevelSettings<BlockLevelSettings>("blockparty", level);
  if (!settings) return null;
  const id = `${settings.cols}:${settings.pieces.join(",")}`;
  const known = LEVEL_GEOMETRY.get(id);
  if (known) return known;
  let geo: BlockGeometry;
  if (settings.cols === BLOCK_GEOMETRY_D4.cols && settings.pieces.join(",") === BLOCK_D4_PIECES.map((p) => p.name).join(",")) {
    geo = BLOCK_GEOMETRY_D4;
  } else {
    const pieces: BlockPieceDef[] = settings.pieces.map((name, colour) => {
      const cells = BLOCK_SHAPES[name];
      if (!cells) throw new Error(`Tessellate: no piece shape "${name}"`);
      return { name, cells, colour };
    });
    const cells = settings.cols * settings.cols;
    const free = pieces.reduce((sum, p) => sum + p.cells.length, 0);
    geo = { cols: settings.cols, cells, blockers: cells - free, free, pieces };
  }
  LEVEL_GEOMETRY.set(id, geo);
  return geo;
}

/** A level board's full-speed time (its settings' speedFullByS), or null for every puzzle not dealt at a level. */
export function blockLevelFullByS(puzzle: { blockRev?: number; level?: unknown } | null | undefined): number | null {
  if ((puzzle?.blockRev ?? 0) < 1 || puzzle?.level === undefined) return null;
  // Its stamped time (D4, 22 Nov 2026), else the time its level had when it was dealt (plLevelSpeed.ts).
  return patternLevelFullByS("blockparty", puzzle);
}

/**
 * The board a stored puzzle plays on. A puzzle dealt at a level (stage 3: `level` is only ever stamped on deals made
 * since levels, all on the 7×7 era's stamps) plays its level's board; every other puzzle exactly as before.
 */
export function blockGeometry(puzzle: { blockRev?: number; level?: unknown } | null | undefined): BlockGeometry {
  if ((puzzle?.blockRev ?? 0) >= 1 && puzzle?.level !== undefined) {
    const geo = blockLevelGeometry(puzzleLevel(puzzle));
    if (geo) return geo;
  }
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
/** Orientations of every piece of the 7×7 board. */
export const BLOCK_D4_ORIENTATIONS: Offsets[][] = BLOCK_D4_PIECES.map((_, i) => orientations(i, BLOCK_D4_PIECES));

const LEVEL_ORIENTATIONS = new WeakMap<BlockPieceDef[], Offsets[][]>();

export function orientationsFor(geo: BlockGeometry): Offsets[][] {
  if (geo === BLOCK_GEOMETRY_D4 || geo.pieces === BLOCK_D4_PIECES) return BLOCK_D4_ORIENTATIONS;
  if (geo === BLOCK_GEOMETRY_0 || geo.pieces === BLOCK_PIECES) return BLOCK_ORIENTATIONS;
  // A level's own pieces (stage 3).
  let known = LEVEL_ORIENTATIONS.get(geo.pieces);
  if (!known) {
    known = geo.pieces.map((_, i) => orientations(i, geo.pieces));
    LEVEL_ORIENTATIONS.set(geo.pieces, known);
  }
  return known;
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
export function orientationOffsets(piece: number, rot: number, flipped: boolean, pieces: BlockPieceDef[] = BLOCK_PIECES): Offsets {
  let cells = normalise(pieces[piece]!.cells);
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

/**
 * A tray piece's pose after a tap (pattern review fixes, 15 Nov 2026; display only, the answer stores cells). A
 * single tap turns it a quarter; the second tap of a double tap takes back the quarter turn the first tap gave and
 * flips it instead, so a double tap only flips and a single tap only turns.
 */
export function tapPose(state: { rot: number; flip: boolean }, double: boolean): { rot: number; flip: boolean } {
  return double ? { rot: (state.rot + 3) % 4, flip: !state.flip } : { ...state, rot: (state.rot + 1) % 4 };
}

/**
 * blockRev 4 (the Pattern overhaul, 15 Nov 2026; patternNov15.ts): moving a placed piece no longer costs the "right
 * first time" bonus; only illegal drops do (a piece let go over the board where it doesn't fit, sliding back to the
 * tray). The phone counts them and sends the count as the answer's last entry, `!n` (no entry for 0). Every reader of
 * placements skips it (decodePlacements keeps only entries that start with a piece number), so older readers and
 * older stamps are unchanged; the phone adds it only on blockRev 4.
 */
export const BLOCK_ILLEGAL_MAX = 999;

export function encodeBlockAnswer(placements: BlockPlacement[], illegal: number): string {
  const body = encodePlacements(placements);
  const n = Math.max(0, Math.min(BLOCK_ILLEGAL_MAX, Math.floor(illegal)));
  return n > 0 ? `${body}${body ? ";" : ""}!${n}` : body;
}

/** The illegal drops a blockRev 4 answer reports (its last `!n` entry; 0 without one). */
export function blockIllegalDrops(answer: string): number {
  const m = /(?:^|;)!(\d{1,3})$/.exec(answer ?? "");
  return m ? Math.min(BLOCK_ILLEGAL_MAX, Number.parseInt(m[1]!, 10)) : 0;
}
