/**
 * Tessellate's levels (the Pattern overhaul, stage 3, 16 Nov 2026; src/lib/levels/pattern/blockparty.levels.ts):
 * the exhaustive solver for any board, the level boards' builder and verifier (shared by the bank build,
 * scripts/blockparty-levels-bank.ts, and the levels check), the human-like solver Expert must pass, and the deal from
 * the level bank by the room seed. Server-only; randomness only through ./random.
 */
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import type { Level } from "@/lib/levels/levels";

import { absoluteCells, blockLevelGeometry, orientationsFor, verifyPlacements, type BlockGeometry, type BlockLevelSettings } from "./blockParty";
import { d4BankIndex } from "./depth4/bankIndex";
import { randomBelow, shuffled } from "./random";
import type { BlockPartyPuzzleData, BlockPlacement } from "./types";

export type BlockLevel = Exclude<Level, "normal">;
export const BLOCK_LEVELS: readonly BlockLevel[] = ["easy", "hard", "expert"];

export function blockLevelSettings(level: BlockLevel): BlockLevelSettings {
  const s = gameLevelSettings<BlockLevelSettings>("blockparty", level);
  if (!s) throw new Error(`Tessellate has no ${level} level`);
  return s;
}

export function blockLevelGeo(level: BlockLevel): BlockGeometry {
  const geo = blockLevelGeometry(level);
  if (!geo) throw new Error(`Tessellate has no ${level} level`);
  return geo;
}

/* ------------------------------------------------------------------ the exhaustive solver */

interface Prepared {
  geo: BlockGeometry;
  /** cover[piece][cell]: every placement of the piece that covers the cell. */
  cover: number[][][][];
  /** fillable[unused mask × (free + 1) + n]: some set of the unused pieces covers exactly n squares. */
  fillable: Uint8Array;
  width: number;
  full: number;
}

const PREPARED = new WeakMap<BlockGeometry, Prepared>();

function prepare(geo: BlockGeometry): Prepared {
  const known = PREPARED.get(geo);
  if (known) return known;
  const n = geo.cols;
  const ori = orientationsFor(geo);
  const cover = geo.pieces.map((_, piece) =>
    Array.from({ length: geo.cells }, (_c, cell) => {
      const out: number[][] = [];
      const row = Math.floor(cell / n);
      const col = cell % n;
      for (const offsets of ori[piece]!) {
        for (const [dr, dc] of offsets) {
          const cells = absoluteCells(offsets, row - dr, col - dc, n);
          if (cells && cells.includes(cell) && !out.some((o) => o.join() === cells.join())) out.push(cells);
        }
      }
      return out;
    }),
  );
  const sizes = geo.pieces.map((p) => p.cells.length);
  const full = (1 << sizes.length) - 1;
  const width = geo.free + 1;
  const fillable = new Uint8Array((full + 1) * width);
  for (let mask = 0; mask <= full; mask++) {
    fillable[mask * width] = 1;
    for (let piece = 0; piece < sizes.length; piece++) {
      if (!(mask & (1 << piece))) continue;
      const rest = mask & ~(1 << piece);
      for (let k = 0; k + sizes[piece]! <= geo.free; k++) if (fillable[rest * width + k]) fillable[mask * width + k + sizes[piece]!] = 1;
    }
  }
  const prepared = { geo, cover, fillable, width, full };
  PREPARED.set(geo, prepared);
  return prepared;
}

/** False when some empty region could not be covered exactly by any set of the unused pieces. */
function regionsFillable(pr: Prepared, taken: boolean[], unused: number, seen: Uint8Array, stack: number[]): boolean {
  const { geo } = pr;
  const n = geo.cols;
  seen.fill(0);
  for (let start = 0; start < geo.cells; start++) {
    if (taken[start] || seen[start]) continue;
    let size = 0;
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      size += 1;
      const r = Math.floor(c / n);
      const col = c % n;
      if (r > 0 && !taken[c - n] && !seen[c - n]) { seen[c - n] = 1; stack.push(c - n); }
      if (r < n - 1 && !taken[c + n] && !seen[c + n]) { seen[c + n] = 1; stack.push(c + n); }
      if (col > 0 && !taken[c - 1] && !seen[c - 1]) { seen[c - 1] = 1; stack.push(c - 1); }
      if (col < n - 1 && !taken[c + 1] && !seen[c + 1]) { seen[c + 1] = 1; stack.push(c + 1); }
    }
    if (size > geo.free || !pr.fillable[unused * pr.width + size]) return false;
  }
  return true;
}

export interface BlockSolve {
  count: number;
  first: BlockPlacement[] | null;
  /** True when the search ran out of budget (the count is then a lower bound). */
  exhausted: boolean;
}

/** Counts every full packing up to `cap` (lowest free square first, pieces in order), keeping the first found (and every one in `all` when given). */
export function solveBlockBoard(geo: BlockGeometry, blockers: readonly number[], cap = Infinity, budget = 50_000_000, all?: BlockPlacement[][]): BlockSolve {
  const pr = prepare(geo);
  const taken = new Array<boolean>(geo.cells).fill(false);
  for (const cell of blockers) taken[cell] = true;
  let used = 0;
  const stack: BlockPlacement[] = [];
  let count = 0;
  let first: BlockPlacement[] | null = null;
  let steps = 0;
  const seen = new Uint8Array(geo.cells);
  const scratch: number[] = [];
  if (!regionsFillable(pr, taken, pr.full, seen, scratch)) return { count: 0, first: null, exhausted: false };
  const recurse = (): void => {
    if (count >= cap || steps > budget) return;
    steps += 1;
    const cell = taken.indexOf(false);
    if (cell === -1) {
      count += 1;
      if (!first) first = stack.map((p) => ({ piece: p.piece, cells: [...p.cells] }));
      all?.push(stack.map((p) => ({ piece: p.piece, cells: [...p.cells] })));
      return;
    }
    for (let piece = 0; piece < geo.pieces.length; piece++) {
      if (used & (1 << piece)) continue;
      for (const cells of pr.cover[piece]![cell]!) {
        if (cells.some((c) => taken[c])) continue;
        for (const c of cells) taken[c] = true;
        used |= 1 << piece;
        stack.push({ piece, cells });
        if (regionsFillable(pr, taken, pr.full & ~used, seen, scratch)) recurse();
        stack.pop();
        used &= ~(1 << piece);
        for (const c of cells) taken[c] = false;
        if (count >= cap || steps > budget) return;
      }
    }
  };
  recurse();
  return { count, first, exhausted: steps > budget };
}

/* ------------------------------------------------------------------ the level boards */

const inBand = (count: number, s: BlockLevelSettings) => count >= s.solutions.min && (s.solutions.max === null || count <= s.solutions.max);

/** Pegs at random (Normal's way). */
function scatterPegs(geo: BlockGeometry): number[] {
  return shuffled(Array.from({ length: geo.cells }, (_, i) => i))
    .slice(0, geo.blockers)
    .sort((a, b) => a - b);
}

/** The pieces dropped one at a time, in random order, each touching what is already down; the rest are pegs. */
function growPegs(geo: BlockGeometry): number[] | null {
  const n = geo.cols;
  const ori = orientationsFor(geo);
  const taken = new Array<boolean>(geo.cells).fill(false);
  let any = false;
  const touches = (x: number) => {
    const r = Math.floor(x / n);
    const c = x % n;
    return (r > 0 && taken[x - n]) || (r < n - 1 && taken[x + n]) || (c > 0 && taken[x - 1]) || (c < n - 1 && taken[x + 1]);
  };
  for (const piece of shuffled(geo.pieces.map((_, i) => i))) {
    const options: number[][] = [];
    for (const offsets of ori[piece]!)
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
          const cells = absoluteCells(offsets, r, c, n);
          if (!cells || cells.some((x) => taken[x])) continue;
          if (any && !cells.some(touches)) continue;
          options.push(cells);
        }
    if (!options.length) return null;
    for (const x of options[randomBelow(options.length)]!) taken[x] = true;
    any = true;
  }
  return Array.from({ length: geo.cells }, (_, i) => i).filter((i) => !taken[i]);
}

/** One board of the level whose exhaustive solution count is in its band, or null after `attempts`. */
export function generateBlockLevel(level: BlockLevel, attempts = 400): BlockPartyPuzzleData | null {
  const s = blockLevelSettings(level);
  const geo = blockLevelGeo(level);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const blockers = s.layout === "grow" ? growPegs(geo) : scatterPegs(geo);
    if (!blockers) continue;
    // A quick capped count first (most scattered boards have none), then the full count.
    const quick = solveBlockBoard(geo, blockers, s.solutions.max === null ? s.solutions.min : s.solutions.max + 1, 2_000_000);
    if (!quick.first || quick.exhausted || !inBand(quick.count, s)) continue;
    const { count, first, exhausted } = solveBlockBoard(geo, blockers);
    if (!first || exhausted || !inBand(count, s)) continue;
    // Hard and Expert: only a board the human-like solver finishes within the level's guesses (humanly possible), and
    // needing at least its least (not forced moves alone).
    if (!humanDepthOk(geo, blockers, s)) continue;
    // The board's size and pieces ride on it (D4, 22 Nov 2026), so a later retune of the level never moves it.
    return { type: "blockparty", blockers, solution: first, solutions: count, blockRev: 1, level, blockCols: s.cols, blockPieces: [...s.pieces] };
  }
  return null;
}

/** Null when a stored level board passes every rule the builder applies (the solution count re-counted exhaustively). */
export function verifyBlockLevel(level: BlockLevel, puzzle: BlockPartyPuzzleData): string | null {
  const s = blockLevelSettings(level);
  const geo = blockLevelGeo(level);
  const { blockers } = puzzle;
  if (puzzle.type !== "blockparty") return "wrong type";
  if ((puzzle as { level?: unknown }).level !== level) return "level";
  if (geo.blockers !== s.pegs) return "settings: pegs do not match the pieces";
  if (blockers.length !== geo.blockers) return "peg count";
  if (blockers.some((c, i) => !Number.isInteger(c) || c < 0 || c >= geo.cells || (i > 0 && c <= blockers[i - 1]!))) return "pegs not distinct and sorted";
  if (!puzzle.solution || !verifyPlacements(blockers, puzzle.solution, geo).solved) return "solution does not solve";
  const { count, first, exhausted } = solveBlockBoard(geo, blockers);
  if (exhausted) return "solver budget";
  if (count < 1) return "no solution";
  if (!inBand(count, s)) return `solution count ${count} outside the band`;
  if (count !== puzzle.solutions) return "stored solution count";
  if (JSON.stringify(first) !== JSON.stringify(puzzle.solution)) return "stored solution is not the solver's first";
  if (!humanDepthOk(geo, blockers, s)) return `human-like solver depth ${humanDepthOf(geo, blockers, 6)} outside ${JSON.stringify(s.humanDepth)}`;
  return null;
}

/** The fewest guesses held at once with which the human-like solver finishes the board (up to `max`; null: not by then). */
export function humanDepthOf(geo: BlockGeometry, blockers: readonly number[], max: number): number | null {
  for (let depth = 0; depth <= max; depth++) if (humanSolveBlock(geo, blockers, { width: HUMAN_LIMITS.width, depth }).solved) return depth;
  return null;
}

function humanDepthOk(geo: BlockGeometry, blockers: readonly number[], s: BlockLevelSettings): boolean {
  if (!s.humanDepth) return true;
  const depth = humanDepthOf(geo, blockers, s.humanDepth.max);
  return depth !== null && depth >= s.humanDepth.min;
}

/* ------------------------------------------------------------------ the human-like solver */

export interface HumanSolve {
  solved: boolean;
  /** Pieces placed because a square or a piece had one place left. */
  forced: number;
  /** Guesses made (a placement tried on a square with a few options), and those that led to a dead end. */
  trials: number;
  dead: number;
}

export interface HumanLimits {
  /** The most options a square may have for the person to guess on it (else they are stuck). */
  width: number;
  /** The most guesses held open at once (a guess inside a guess is depth 2). */
  depth: number;
}

/**
 * The person stage 3's Expert rule is judged against: guesses among at most 4 placements, at most 3 held at once (the
 * levels' `humanDepth.max` may ask for fewer or allow more held guesses; the width is always this one).
 */
export const HUMAN_LIMITS: HumanLimits = { width: 4, depth: 3 };

/**
 * A solver that reasons as a person does (stage 3's Expert rule). It places a piece when it is forced (a free square
 * only one remaining placement covers, or a piece with one place left) and rules out any placement that would leave a
 * hole the remaining pieces can't fill exactly (a gap of one with the Dot gone, a pocket of two with the Two used…).
 * When nothing is forced it guesses: it picks the square with the fewest options, only when that is at most
 * `limits.width`, places one and carries on; a guess that runs into a dead end is taken back and the next option
 * tried. It never holds more than `limits.depth` guesses at once: past that it is stuck, as a person who can't keep a
 * longer chain of "what ifs" in mind.
 */
export function humanSolveBlock(geo: BlockGeometry, blockers: readonly number[], limits: HumanLimits = HUMAN_LIMITS): HumanSolve {
  const pr = prepare(geo);
  const stats = { forced: 0, trials: 0, dead: 0 };
  const seen = new Uint8Array(geo.cells);
  const scratch: number[] = [];
  const holeFree = (taken: boolean[], used: number) => regionsFillable(pr, taken, pr.full & ~used, seen, scratch);

  interface Option { piece: number; cells: number[] }
  /** Every placement still possible: fits and leaves no hole the rest can't fill. byCell[cell], byPiece[piece]. */
  const options = (taken: boolean[], used: number) => {
    const byCell: Option[][] = Array.from({ length: geo.cells }, () => []);
    const byPiece: Option[][] = geo.pieces.map(() => []);
    const done = new Set<string>();
    for (let piece = 0; piece < geo.pieces.length; piece++) {
      if (used & (1 << piece)) continue;
      for (let cell = 0; cell < geo.cells; cell++) {
        if (taken[cell]) continue;
        for (const cells of pr.cover[piece]![cell]!) {
          const k = `${piece}:${cells.join(",")}`;
          if (done.has(k) || cells.some((c) => taken[c])) continue;
          done.add(k);
          for (const c of cells) taken[c] = true;
          const ok = holeFree(taken, used | (1 << piece));
          for (const c of cells) taken[c] = false;
          if (!ok) continue;
          const o = { piece, cells };
          byPiece[piece]!.push(o);
          for (const c of cells) byCell[c]!.push(o);
        }
      }
    }
    return { byCell, byPiece };
  };

  const solve = (takenIn: boolean[], usedIn: number, depth: number): boolean => {
    const taken = [...takenIn];
    let used = usedIn;
    for (;;) {
      if (taken.every(Boolean)) return true;
      const { byCell, byPiece } = options(taken, used);
      let move: Option | null = null;
      let best = -1;
      for (let cell = 0; cell < geo.cells; cell++) {
        if (taken[cell]) continue;
        const n = byCell[cell]!.length;
        if (n === 0) return false;
        if (n === 1 && !move) move = byCell[cell]![0]!;
        if (best === -1 || n < byCell[best]!.length) best = cell;
      }
      for (let piece = 0; piece < geo.pieces.length; piece++) {
        if (used & (1 << piece)) continue;
        if (byPiece[piece]!.length === 0) return false;
        if (byPiece[piece]!.length === 1 && !move) move = byPiece[piece]![0]!;
      }
      if (move) {
        for (const c of move.cells) taken[c] = true;
        used |= 1 << move.piece;
        stats.forced += 1;
        continue;
      }
      // Nothing forced: a guess on the most constrained square, if the person can still hold one more.
      const tries = byCell[best]!;
      if (depth >= limits.depth || tries.length > limits.width) return false;
      for (const t of tries) {
        stats.trials += 1;
        const next = [...taken];
        for (const c of t.cells) next[c] = true;
        if (solve(next, used | (1 << t.piece), depth + 1)) return true;
        stats.dead += 1;
      }
      return false;
    }
  };

  const taken = new Array<boolean>(geo.cells).fill(false);
  for (const b of blockers) taken[b] = true;
  return { solved: solve(taken, 0, 0), ...stats };
}

/* ------------------------------------------------------------------ the deal */

/** A level board from its bank by the room seed (practice: a fresh pick). */
export function drawBlockLevel(level: BlockLevel, bank: readonly BlockPartyPuzzleData[], seed: number | undefined): BlockPartyPuzzleData {
  const index = seed === undefined ? randomBelow(bank.length) : d4BankIndex(`blockLevel:${level}`, seed, bank.length);
  const puzzle = JSON.parse(JSON.stringify(bank[index]!)) as BlockPartyPuzzleData;
  const s = blockLevelSettings(level);
  // The level's own clock where it isn't the game's (Expert's 90 s).
  return s.timeLimitMs !== 60_000 ? { ...puzzle, timeLimitMs: s.timeLimitMs } : puzzle;
}
