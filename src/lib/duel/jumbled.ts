/**
 * Jumbled, tilesRev 3 (25 Oct 2026, the remodel; docs/depth/d5-remodels.md). Shared rules: the phone animates
 * and the server replays exactly this code.
 *
 * A 5 × 5 colour gradient. A move slides one whole row (left / right) or column (up / down) any number of
 * steps, its tiles wrapping round, with no gap. The four corner tiles are fixed anchors: no slide moves them,
 * so the top and bottom rows and the left and right columns slide only their middle three tiles round, and
 * the middle rows and columns all five. Every board is the solved gradient scrambled by legal slides, so it is
 * always solvable; the server proves its exact minimum (jumbled.server.ts) and shows par.
 *
 * A frame is one tile per cell: tile t belongs on cell t. Stored rounds (tilesRev absent, 1 or 2) keep the
 * sliding-gap rules (tiles.ts).
 */
import type { TilesPuzzleData } from "./types";

export const TILES_REV_GRADIENT = 3;
export const JUMBLED_N = 5;
export const JUMBLED_CELLS = JUMBLED_N * JUMBLED_N;
export const JUMBLED_CORNERS: readonly number[] = [0, JUMBLED_N - 1, JUMBLED_CELLS - JUMBLED_N, JUMBLED_CELLS - 1];
/** Tiles a slide can move (all but the anchors). */
export const JUMBLED_MOVABLE = JUMBLED_CELLS - JUMBLED_CORNERS.length;
export const JUMBLED_TIME_MS = 120_000;
/** Par is the proved minimum plus this. */
export const JUMBLED_PAR_SLACK = 3;

export type LineKind = "R" | "C";

export interface JumbledMove {
  kind: LineKind;
  /** Row or column index, 0–4. */
  index: number;
  /** Steps right (rows) or down (columns), 1 … line length − 1. */
  shift: number;
}

export function isJumbledGradient(puzzle: { type: string; tilesRev?: number } | null | undefined): puzzle is TilesPuzzleData & { tilesRev: 3 } {
  return Boolean(puzzle && puzzle.type === "tiles" && (puzzle.tilesRev ?? 0) >= TILES_REV_GRADIENT);
}

const LINES = new Map<string, number[]>();
/** The cells of a line in order (left to right, top to bottom), anchors left out. */
export function lineCells(kind: LineKind, index: number): number[] {
  const key = `${kind}${index}`;
  let cells = LINES.get(key);
  if (!cells) {
    const edge = index === 0 || index === JUMBLED_N - 1;
    const from = edge ? 1 : 0;
    const to = edge ? JUMBLED_N - 2 : JUMBLED_N - 1;
    cells = [];
    for (let k = from; k <= to; k++) cells.push(kind === "R" ? index * JUMBLED_N + k : k * JUMBLED_N + index);
    LINES.set(key, cells);
  }
  return cells;
}

export function lineLength(kind: LineKind, index: number): number {
  return lineCells(kind, index).length;
}

/** Every distinct move (each line, each shift). */
export const JUMBLED_MOVES: readonly JumbledMove[] = (["R", "C"] as LineKind[]).flatMap((kind) =>
  Array.from({ length: JUMBLED_N }, (_, index) => index).flatMap((index) =>
    Array.from({ length: lineLength(kind, index) - 1 }, (_, s) => ({ kind, index, shift: s + 1 })),
  ),
);

export function solvedJumbled(): number[] {
  return Array.from({ length: JUMBLED_CELLS }, (_, cell) => cell);
}

export function jumbledSolved(frame: readonly number[]): boolean {
  return frame.every((tile, cell) => tile === cell);
}

/** Movable tiles sitting on their own cell (anchors not counted). */
export function jumbledInPlace(frame: readonly number[]): number {
  let n = 0;
  frame.forEach((tile, cell) => {
    if (tile === cell && !JUMBLED_CORNERS.includes(cell)) n++;
  });
  return n;
}

/** One slide. */
export function jumbledSlide(frame: readonly number[], move: JumbledMove): number[] {
  const cells = lineCells(move.kind, move.index);
  const len = cells.length;
  const shift = ((move.shift % len) + len) % len;
  const next = [...frame];
  cells.forEach((cell, k) => {
    next[cells[(k + shift) % len]!] = frame[cell]!;
  });
  return next;
}

/** "R21" = row 2 slid 1 right; "C34" = column 3 slid 4 down (one up). Undo "U", reset "X". */
export function encodeJumbledMove(move: JumbledMove): string {
  return `${move.kind}${move.index}${move.shift}`;
}

export const JUMBLED_UNDO = "U";
export const JUMBLED_RESET = "X";
export type JumbledToken = JumbledMove | typeof JUMBLED_UNDO | typeof JUMBLED_RESET;

export function encodeJumbled(tokens: readonly JumbledToken[]): string {
  return tokens.map((t) => (typeof t === "string" ? t : encodeJumbledMove(t))).join(",");
}

export function decodeJumbled(raw: string): JumbledToken[] {
  const out: JumbledToken[] = [];
  for (const part of String(raw ?? "").split(",").slice(0, 600)) {
    const p = part.trim().toUpperCase();
    if (p === JUMBLED_UNDO || p === JUMBLED_RESET) {
      out.push(p);
      continue;
    }
    const m = /^([RC])([0-4])([1-4])$/.exec(p);
    if (!m) continue;
    const kind = m[1] as LineKind;
    const index = Number(m[2]);
    const shift = Number(m[3]);
    if (shift >= lineLength(kind, index)) continue;
    out.push({ kind, index, shift });
  }
  return out;
}

export interface JumbledReplay {
  frame: number[];
  solved: boolean;
  /** Slides made (Undo and Reset give none back). */
  moves: number;
  inPlace: number;
}

/** The one place a move list is replayed (phone, server, reveal). Nothing counts after the board is solved. */
export function replayJumbled(start: readonly number[], tokens: readonly JumbledToken[], onFrame?: (frame: number[]) => void): JumbledReplay {
  const history: number[][] = [[...start]];
  let moves = 0;
  for (const token of tokens) {
    const frame = history[history.length - 1]!;
    if (jumbledSolved(frame)) break;
    if (token === JUMBLED_UNDO) {
      if (history.length > 1) history.pop();
    } else if (token === JUMBLED_RESET) history.length = 1;
    else {
      history.push(jumbledSlide(frame, token));
      moves++;
    }
    onFrame?.(history[history.length - 1]!);
  }
  const frame = history[history.length - 1]!;
  return { frame, solved: jumbledSolved(frame), moves, inPlace: jumbledInPlace(frame) };
}

/* ------------------------------------------------------------------ the gradient */

/**
 * The solved board's 25 colours, cell by cell: deep blue top left, through purple and pink, to coral bottom
 * right. Drawn in OKLCH with lightness rising down the board (0.31 → 0.89) and hue turning across it and down it
 * (267° → 394°), chroma 0.14–0.16 (pulled in only where sRGB needs it). Chosen by a search for the largest
 * smallest neighbour difference under normal and simulated protan / deutan / tritan vision (scripts/d5-remodels/
 * colour.ts): neighbours are at least 6.2 ΔE2000 apart with normal vision and 4.1 with any of the three, so the
 * gradient reads without numbers; the number toggle on the board is there for anyone who wants them.
 */
export const JUMBLED_PALETTE: readonly string[] = [
  "#122373", "#3c2c84", "#62358e", "#873e90", "#aa498c",
  "#3a358d", "#623d99", "#88479d", "#ad519a", "#d05f90",
  "#6146a3", "#894fa9", "#af59a8", "#d466a0", "#f47692",
  "#8958b5", "#b161b5", "#d76daf", "#f97da2", "#fda2a0",
  "#b26ac3", "#da75be", "#fd84b3", "#feabb0", "#ffcbbf",
];

/** The solved board's colours, cell by cell. */
export function jumbledPalette(): readonly string[] {
  return JUMBLED_PALETTE;
}

/* ------------------------------------------------------------------ scoring (tilesRev 3, to 200) */

export const JUMBLED_FINISH_BASE = 120;
/** Finishing at or under par. */
export const JUMBLED_PAR_POINTS = 40;
/** Each move over par takes this off the par points. */
export const JUMBLED_OVER_PAR_STEP = 10;
export const JUMBLED_SPEED_POINTS = 40;
/** Share of the clock left that earns every speed point. */
export const JUMBLED_FAST_SHARE = 0.65;
export const JUMBLED_UNFINISHED_CAP = 110;

export interface JumbledScore {
  score: number;
  parts: { kind: "finish" | "partial"; base: number; efficiency?: number; speed?: number; measure?: string };
  /** Unfinished: the share of the misplaced tiles the player put in place. */
  progress?: number;
}

export function jumbledParPoints(moves: number, par: number): number {
  return Math.max(0, JUMBLED_PAR_POINTS - JUMBLED_OVER_PAR_STEP * Math.max(0, moves - par));
}

/**
 * tilesRev 3's score (max 200, ROUND_MAX.tiles):
 *   solved: 120 + par points (40 at or under par, 10 fewer each move over) + up to 40 for speed (all 40 with
 *   65 % of the clock left);
 *   unsolved: 110 × the share of the tiles that started out of place now in place (net), at most 110.
 */
export function scoreJumbled(start: readonly number[], replay: JumbledReplay, par: number, msRemaining: number, limitMs: number): JumbledScore {
  if (replay.solved) {
    const left = limitMs > 0 ? Math.max(0, Math.min(limitMs, msRemaining)) / limitMs : 0;
    const speed = Math.round(JUMBLED_SPEED_POINTS * Math.min(1, left / JUMBLED_FAST_SHARE));
    const parPts = jumbledParPoints(replay.moves, par);
    return { score: JUMBLED_FINISH_BASE + parPts + speed, parts: { kind: "finish", base: JUMBLED_FINISH_BASE, efficiency: parPts, measure: "par", speed } };
  }
  const progress = jumbledProgress(start, replay.frame);
  const base = Math.min(JUMBLED_UNFINISHED_CAP, Math.round(JUMBLED_UNFINISHED_CAP * progress));
  return { score: base, parts: { kind: "partial", base }, progress: Math.round(progress * 1000) / 1000 };
}

/** Net tiles put in place, as a share of those that started out of place (0–1). */
export function jumbledProgress(start: readonly number[], frame: readonly number[]): number {
  const startIn = jumbledInPlace(start);
  const out = JUMBLED_MOVABLE - startIn;
  if (out <= 0) return 1;
  // One short of solved always leaves at least two tiles out, so a near-solve stays under the cap.
  return Math.max(0, Math.min(1, (jumbledInPlace(frame) - startIn) / out));
}

export function jumbledFastSeconds(limitMs = JUMBLED_TIME_MS): number {
  return Math.round((limitMs * (1 - JUMBLED_FAST_SHARE)) / 1000);
}

/* ------------------------------------------------------------------ texts ({max} = ROUND_MAX.tiles) */

/** The "?" help SCORE text. */
export function jumbledHelpScore(): string {
  return `Finish: ${JUMBLED_FINISH_BASE}, + ${JUMBLED_PAR_POINTS} at or under par (${JUMBLED_OVER_PAR_STEP} fewer each move over), + up to ${JUMBLED_SPEED_POINTS} for speed: {max} if you finish at par in about ${jumbledFastSeconds()} s. Unfinished: up to ${JUMBLED_UNFINISHED_CAP} for the tiles you put in place.`;
}

/** The round intro SCORE line (two phone lines, no scoring terms). */
export const JUMBLED_INTRO_SCORE = "Points for tiles in place. Finish in few moves, and fast, for up to {max}.";
