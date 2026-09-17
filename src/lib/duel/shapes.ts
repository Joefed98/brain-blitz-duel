/**
 * Shared shape geometry for the coloured-shape puzzle types (Mirror Match and
 * Spin). Shapes are written as filled cells of a 5x5 grid; every helper works
 * on translation-normalised cell lists so shapes compare by what is drawn.
 */

import { pick, randInt, shuffled } from "./random";
import { ROTATION_COLS as N, type MirrorShape, type StroopColour } from "./types";

export const SHAPE_COLS = N;

export const SHAPE_PALETTE: StroopColour[] = [
  "RED",
  "BLUE",
  "GREEN",
  "PURPLE",
  "PINK",
  "ORANGE",
  "BROWN",
];

type Cells = number[];
type Coord = [number, number];

export interface Pt {
  r: number;
  c: number;
  colour: StroopColour;
}

/* -------------------------------------------------------------------------- */
/*  Plain (uncoloured) shapes                                                  */
/* -------------------------------------------------------------------------- */

export function toCoords(cells: Cells): Coord[] {
  return cells.map((i) => [Math.floor(i / N), i % N]);
}

export function normaliseCells(coords: Coord[]): Cells {
  const minR = Math.min(...coords.map((c) => c[0]));
  const minC = Math.min(...coords.map((c) => c[1]));
  return coords.map(([r, c]) => (r - minR) * N + (c - minC)).sort((a, b) => a - b);
}

function rotateCells90(cells: Cells): Cells {
  return normaliseCells(toCoords(cells).map(([r, c]) => [c, N - 1 - r] as Coord));
}

export function mirrorCells(cells: Cells): Cells {
  return normaliseCells(toCoords(cells).map(([r, c]) => [r, N - 1 - c] as Coord));
}

export function rotationsOf(cells: Cells): Cells[] {
  const out: Cells[] = [normaliseCells(toCoords(cells))];
  for (let i = 0; i < 3; i++) out.push(rotateCells90(out[out.length - 1]!));
  return out;
}

export const cellsKey = (cells: Cells) => cells.join(",");

/** Chiral: no rotation of the shape equals its own mirror image. */
export function isChiral(cells: Cells): boolean {
  const mirrored = cellsKey(mirrorCells(cells));
  return !rotationsOf(cells).some((r) => cellsKey(r) === mirrored);
}

/** Four genuinely different rotations, so distractors are never duplicates. */
export function hasFourRotations(cells: Cells): boolean {
  return new Set(rotationsOf(cells).map(cellsKey)).size === 4;
}

/** Eight six-cell shapes and eight seven-cell shapes, all of them chiral. */
const SOURCE: Cells[] = [
  [0, 1, 2, 3, 5, 6],
  [0, 1, 5, 6, 11, 12],
  [0, 1, 2, 5, 7, 10],
  [0, 1, 2, 3, 5, 10],
  [0, 5, 6, 7, 10, 15],
  [0, 5, 10, 11, 16, 17],
  [0, 5, 6, 7, 8, 11],
  [0, 5, 6, 11, 12, 16],
  [0, 1, 2, 3, 5, 6, 7],
  [0, 1, 2, 5, 6, 11, 12],
  [0, 1, 2, 3, 5, 7, 12],
  [0, 1, 2, 3, 5, 8, 10],
  [0, 5, 6, 7, 10, 12, 15],
  [0, 5, 7, 10, 11, 12, 16],
  [0, 2, 3, 5, 6, 7, 11],
  [0, 5, 6, 7, 11, 15, 16],
];

/** Only chiral shapes with four distinct rotations make fair puzzles. */
export const SHAPE_BANK: Cells[] = (() => {
  const seen = new Set<string>();
  const bank: Cells[] = [];
  for (const shape of SOURCE) {
    for (const variant of [shape, mirrorCells(shape)]) {
      if (!isChiral(variant) || !hasFourRotations(variant)) continue;
      const normal = normaliseCells(toCoords(variant));
      const k = cellsKey(normal);
      if (seen.has(k)) continue;
      seen.add(k);
      bank.push(normal);
    }
  }
  return bank;
})();

/* -------------------------------------------------------------------------- */
/*  Coloured shapes                                                            */
/* -------------------------------------------------------------------------- */

export function toPts(shape: MirrorShape): Pt[] {
  return shape.cells.map((i, k) => ({
    r: Math.floor(i / N),
    c: i % N,
    colour: shape.colours[k]!,
  }));
}

/** Shift a coloured shape to the top-left so shapes compare by what is drawn. */
export function normalise(pts: Pt[]): MirrorShape {
  const minR = Math.min(...pts.map((p) => p.r));
  const minC = Math.min(...pts.map((p) => p.c));
  const shifted = pts
    .map((p) => ({ ...p, r: p.r - minR, c: p.c - minC }))
    .sort((a, b) => a.r * N + a.c - (b.r * N + b.c));
  return {
    cells: shifted.map((p) => p.r * N + p.c),
    colours: shifted.map((p) => p.colour),
  };
}

/** Reflection across a vertical or horizontal dashed line. */
export function reflect(pts: Pt[], axis: "vertical" | "horizontal"): Pt[] {
  if (axis === "vertical") return pts.map((p) => ({ ...p, c: -p.c }));
  return pts.map((p) => ({ ...p, r: -p.r }));
}

/** Quarter turns clockwise. */
export function rotate(pts: Pt[], quarters: number): Pt[] {
  let out = pts;
  for (let i = 0; i < ((quarters % 4) + 4) % 4; i++)
    out = out.map((p) => ({ ...p, r: p.c, c: -p.r }));
  return out;
}

export const shapeKey = (shape: MirrorShape) =>
  `${shape.cells.join(",")}|${shape.colours.join(",")}`;

/** Side of the square box the shape (and its dashed line) is drawn in. */
export function boxSize(shape: MirrorShape): number {
  const rows = shape.cells.map((i) => Math.floor(i / N));
  const cols = shape.cells.map((i) => i % N);
  return Math.max(Math.max(...rows) + 1, Math.max(...cols) + 1);
}

/** The eight orientations of a coloured shape: four turns and four mirrored turns. */
export function orientations(shape: MirrorShape): MirrorShape[] {
  const pts = toPts(shape);
  const out: MirrorShape[] = [];
  for (const q of [0, 1, 2, 3]) out.push(normalise(rotate(pts, q)));
  const mirrored = reflect(pts, "vertical");
  for (const q of [0, 1, 2, 3]) out.push(normalise(rotate(mirrored, q)));
  return out;
}

/**
 * A random asymmetric colouring: two or three colours, all of them used, and
 * (when `strict`) all eight orientations telling themselves apart.
 */
export function randomColouring(cells: number[], strict = false): MirrorShape | null {
  const count = randInt(2, 3);
  const palette = shuffled(SHAPE_PALETTE).slice(0, count);
  const colours: StroopColour[] = cells.map(() => pick(palette));
  if (new Set(colours).size !== count) return null;

  const shape: MirrorShape = { cells, colours };
  const all = orientations(shape);
  if (strict) return new Set(all.map(shapeKey)).size === 8 ? shape : null;

  // Otherwise: the colouring must survive neither a flip nor a turn unchanged.
  const key = shapeKey(all[0]!);
  return all.slice(1).some((s) => shapeKey(s) === key) ? null : shape;
}
