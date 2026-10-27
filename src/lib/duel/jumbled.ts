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
 *
 * Gradient, tilesRev 4 (27 Oct 2026, Joe's phone notes; phoneNotes.ts, docs/phone-notes-oct-2026.md): the game is
 * shown as "Gradient". Each round has its own colour scheme (`palette`, gradientPalette.ts) and a move swaps two
 * tiles (tap one, then another). A tile on its own cell is locked (as the corner anchors are): it can't be picked
 * or swapped. Row and column slides could not take locks: once the last few tiles were locked round them they
 * were often stuck for good (98 % of simulated runs), so tilesRev 4 swaps instead, and any board can always be
 * finished. Scoring is tilesRev 3's (scoreJumbled) on the swaps: par is the proved fewest swaps + par slack.
 */
import { eliteStretchPoints } from "./d5Remodels";
import type { TilesPuzzleData } from "./types";

export const TILES_REV_GRADIENT = 3;
/** Gradient (Joe's phone notes, 27 Oct 2026): swaps, locked tiles and a colour scheme per round. */
export const TILES_REV_SWAP = 4;
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

export function isJumbledGradient(puzzle: { type: string; tilesRev?: number } | null | undefined): puzzle is TilesPuzzleData & { tilesRev: 3 | 4 } {
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

/* ------------------------------------------------------------------ tilesRev 4: swaps and locked tiles */

/** True for a tilesRev 4 round (swaps, locks, its own palette). */
export function isGradientSwap(puzzle: { type: string; tilesRev?: number } | null | undefined): boolean {
  return Boolean(puzzle && puzzle.type === "tiles" && (puzzle.tilesRev ?? 0) >= TILES_REV_SWAP);
}

/** A cell whose tile is locked: an anchor, or a tile on its own cell. */
export function gradientLocked(frame: readonly number[], cell: number): boolean {
  return JUMBLED_CORNERS.includes(cell) || frame[cell] === cell;
}

export interface GradientSwap {
  a: number;
  b: number;
}

/** "S0312" = swap the tiles on cells 3 and 12. */
export function encodeGradientSwap(swap: GradientSwap): string {
  return `S${String(swap.a).padStart(2, "0")}${String(swap.b).padStart(2, "0")}`;
}

export function encodeGradient(swaps: readonly GradientSwap[]): string {
  return swaps.map(encodeGradientSwap).join(",");
}

/** A tilesRev 4 answer's swaps (anything else, slides included, is skipped). */
export function decodeGradient(raw: string): GradientSwap[] {
  const out: GradientSwap[] = [];
  for (const part of String(raw ?? "").split(",").slice(0, 600)) {
    const m = /^S(\d\d)(\d\d)$/.exec(part.trim().toUpperCase());
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === b || a >= JUMBLED_CELLS || b >= JUMBLED_CELLS) continue;
    out.push({ a, b });
  }
  return out;
}

/** One swap; null when either tile is locked (the move doesn't happen and doesn't count). */
export function gradientSwap(frame: readonly number[], swap: GradientSwap): number[] | null {
  if (swap.a === swap.b || gradientLocked(frame, swap.a) || gradientLocked(frame, swap.b)) return null;
  const next = [...frame];
  next[swap.a] = frame[swap.b]!;
  next[swap.b] = frame[swap.a]!;
  return next;
}

/** The one place a swap list is replayed (phone, server, reveal). Nothing counts after the board is solved. */
export function replayGradient(start: readonly number[], swaps: readonly GradientSwap[], onFrame?: (frame: number[]) => void): JumbledReplay {
  let frame = [...start];
  let moves = 0;
  for (const swap of swaps) {
    if (jumbledSolved(frame)) break;
    const next = gradientSwap(frame, swap);
    if (!next) continue;
    frame = next;
    moves++;
    onFrame?.(frame);
  }
  return { frame, solved: jumbledSolved(frame), moves, inPlace: jumbledInPlace(frame) };
}

/** Fewest swaps to solve a frame: the tiles out of place less their cycles. */
export function gradientMinimum(frame: readonly number[]): number {
  const seen = new Set<number>();
  let out = 0;
  let cycles = 0;
  frame.forEach((tile, cell) => {
    if (tile === cell || seen.has(cell)) return;
    cycles++;
    for (let c = cell; !seen.has(c); c = frame[c]!) {
      seen.add(c);
      out++;
    }
  });
  return out - cycles;
}

/** A stored round's replay, slides (tilesRev 3) or swaps (tilesRev 4). */
export function replayGradientAnswer(puzzle: TilesPuzzleData, answer: string | null | undefined): JumbledReplay {
  return isGradientSwap(puzzle) ? replayGradient(puzzle.frame, decodeGradient(answer ?? "")) : replayJumbled(puzzle.frame, decodeJumbled(answer ?? ""));
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

/** The solved board's colours, cell by cell: the round's own scheme on tilesRev 4, else the fixed gradient. */
export function jumbledPalette(puzzle?: Pick<TilesPuzzleData, "palette"> | null): readonly string[] {
  const own = puzzle?.palette;
  return own && own.length === JUMBLED_CELLS ? own : JUMBLED_PALETTE;
}

/* ------------------------------------------------------------------ scoring (tilesRev 3, to 200) */

export const JUMBLED_FINISH_BASE = 120;
/** Finishing at or under par (a modest fixed amount). */
export const JUMBLED_PAR_POINTS = 12;
/** Each move over par takes this off the par points. */
export const JUMBLED_OVER_PAR_STEP = 6;
/** Speed points, 38 × √(share left ÷ JUMBLED_FAST_SHARE), all of them from JUMBLED_FAST_SHARE left. */
export const JUMBLED_SPEED_POINTS = 38;
export const JUMBLED_FAST_SHARE = 0.65;
/** The elite stretch: nothing at JUMBLED_ELITE_FROM (a near-perfect pace), all of it at JUMBLED_ELITE_SHARE left at the minimum. */
export const JUMBLED_ELITE_POINTS = 30;
export const JUMBLED_ELITE_FROM = 0.78;
export const JUMBLED_ELITE_SHARE = 0.87;
export const JUMBLED_UNFINISHED_CAP = 110;

export interface JumbledScore {
  score: number;
  parts: { kind: "finish" | "partial"; base: number; efficiency?: number; speed?: number; measure?: string };
  /** Unfinished: the share of the misplaced tiles the player put in place. */
  progress?: number;
  /** Finish only: the elite stretch's share of the speed points. */
  elite?: number;
}

export function jumbledParPoints(moves: number, par: number): number {
  return Math.max(0, JUMBLED_PAR_POINTS - JUMBLED_OVER_PAR_STEP * Math.max(0, moves - par));
}

/**
 * tilesRev 3's score (max 200, ROUND_MAX.tiles):
 *   solved: 120 + par points (12 at or under par, 6 at one over) + up to 38 for speed (38 × √(share left ÷ 0.65),
 *   all 38 with 65 % of the clock left) + up to 30 elite (eliteStretchPoints: nothing at 78 % left, about a
 *   near-perfect pace, all 30 at 87 % left with no wasted slides; efficiency = the proved minimum ÷ the slides made);
 *   unsolved: 110 × the share of the tiles that started out of place now in place (net), at most 110.
 */
export function scoreJumbled(
  start: readonly number[],
  replay: JumbledReplay,
  par: number,
  msRemaining: number,
  limitMs: number,
  /** The proved minimum (server-side); without it the elite stretch counts no waste. */
  minMoves?: number,
): JumbledScore {
  if (replay.solved) {
    const left = limitMs > 0 ? Math.max(0, Math.min(limitMs, msRemaining)) / limitMs : 0;
    // Concave: a steady solve earns most of it; all 38 from 65 % of the clock left.
    const linear = Math.round(JUMBLED_SPEED_POINTS * Math.sqrt(Math.min(1, left / JUMBLED_FAST_SHARE)));
    const efficiency = minMoves && replay.moves ? Math.min(1, minMoves / replay.moves) : 1;
    const elite = eliteStretchPoints(left, JUMBLED_ELITE_FROM, JUMBLED_ELITE_SHARE, efficiency, JUMBLED_ELITE_POINTS);
    const parPts = jumbledParPoints(replay.moves, par);
    return {
      score: JUMBLED_FINISH_BASE + parPts + linear + elite,
      parts: { kind: "finish", base: JUMBLED_FINISH_BASE, efficiency: parPts, measure: "par", speed: linear + elite },
      elite,
    };
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

/** Seconds an elite solve at the minimum takes for the full 200. */
export function jumbledEliteSeconds(limitMs = JUMBLED_TIME_MS): number {
  return Math.round((limitMs * (1 - JUMBLED_ELITE_SHARE)) / 1000);
}

/* ------------------------------------------------------------------ texts ({max} = ROUND_MAX.tiles) */

/** The "?" help SCORE text. */
export function jumbledHelpScore(): string {
  return `Finish: ${JUMBLED_FINISH_BASE}, + ${JUMBLED_PAR_POINTS} at or under par (${JUMBLED_PAR_POINTS - JUMBLED_OVER_PAR_STEP} one over), + up to ${JUMBLED_SPEED_POINTS} for speed (all of it if you finish in about ${jumbledFastSeconds()} s). Faster still, in the fewest swaps, earns up to ${JUMBLED_ELITE_POINTS} more: {max} needs the fewest swaps in about ${jumbledEliteSeconds()} s. Unfinished: up to ${JUMBLED_UNFINISHED_CAP} for the tiles you put in place.`;
}

/** The round intro SCORE line (two phone lines, no scoring terms). */
export const JUMBLED_INTRO_SCORE = "Points for tiles in place. Finish in few swaps, and fast, for up to {max}.";
