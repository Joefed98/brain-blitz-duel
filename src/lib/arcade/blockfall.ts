/**
 * Blockfall (Retro, 1 Nov 2026; docs/arcade-standard/blockfall.md): a 60-second falling-block line-clear run on the
 * arcade engine, born on the arcade scoring standard (`blockfallRev` 1).
 *
 * A 10 × 20 well (two hidden rows above it, where pieces appear). Pieces of four squares in the seven shapes come in
 * a seeded order: shuffled bags of seven drawn with the engine's PRNG from the room seed, so every player in a room
 * gets the identical sequence. The next three pieces show, one piece can be held (once per piece), and a ghost shows
 * where the falling piece lands. Gravity speeds up every 15 s (BF_GRAVITY). A piece that can no longer fall locks
 * after BF_LOCK_TICKS (a move or turn that succeeds resets the wait, at most BF_LOCK_RESETS times). Full rows clear
 * at once. A new piece that would overlap the stack tops the run out: it ends early and keeps its score.
 *
 * Inputs (one per tick, the phone's log): k1 move by `a` columns (−9…9, step by step until blocked), k2 turn (a = 1
 * clockwise, −1 the other way, with small wall kicks), k3 drop (straight to the ghost and lock), k4 hold, k5 one row
 * down.
 *
 * Scoring (blockfallRev 1, the arcade standard; 200 in all): the core 140 on a straight line, lines cleared ÷
 * BF_CORE_FULL × 140, full at the elite skill-band median (the brief's "near-flawless": the level just below Flawless); multi-line clears up to 40 (4 for two at once, 8 for
 * three, 12 for four); a low stack at the buzzer up to 20 (full with the highest block in the bottom 4 rows, 0 from
 * row 10 up, a straight line between). Any run that played scores at least 1; no input scores 0.
 */
import { clampInt, inputRange, rngBelow, type ArcadeGame, type ArcadeInputEvent } from "./engine";
import { stdEach, stdLine, stdPart, stdScore, stdSum, type StdPart, type StdSpec } from "./arcadeStandard";
import { bandCurve, type BandParts } from "./scoreBands";
import { hashInts } from "./cards/cards";

/** blockfallRev 1, the first rules (60 s, hold, pads). */
export const BLOCKFALL_REV = 1;
/** blockfallRev 2, Blockzone (3 Nov 2026): 90 s, no hold, gestures only, a soft drop; the stamp rooms deal. */
export const BLOCKFALL_REV_ZONE = 2;
export const BF_W = 10;
/** Visible rows. */
export const BF_H = 20;
/** Hidden rows above the well, where pieces appear. */
export const BF_HIDDEN = 2;
export const BF_ROWS = BF_H + BF_HIDDEN;
export const BF_RUN_TICKS = 60 * 60;
/** Speed rises every 15 s. */
export const BF_LEVEL_TICKS = 15 * 60;
/** Ticks per row of gravity at each 15-second step. */
export const BF_GRAVITY = [48, 34, 24, 16] as const;
export const BF_LOCK_TICKS = 30;
export const BF_LOCK_RESETS = 15;
export const BF_PREVIEW = 3;

export const BF_INPUT_MOVE = 1;
export const BF_INPUT_TURN = 2;
export const BF_INPUT_DROP = 3;
export const BF_INPUT_HOLD = 4;
export const BF_INPUT_DOWN = 5;

export const BF_CORE_MAX = 140;
export const BF_MULTI_MAX = 40;
export const BF_LOW_MAX = 20;
/** Multi-line points by rows cleared at once (index = rows). */
export const BF_MULTI_POINTS = [0, 0, 4, 8, 12] as const;
/** Low stack: full with the stack at most this high, 0 from BF_LOW_ZERO up. */
export const BF_LOW_FULL = 4;
export const BF_LOW_ZERO = 10;
/**
 * The core is full at this many lines: the elite skill-band median in 60 s (`bun scripts/new-arcade-bands.ts blockfall`,
 * docs/arcade-standard/blockfall.md; the near-perfect median, 27, left near-perfect, elite and flawless all at 200).
 */
export const BF_CORE_FULL = 33;
/** The core's straight line (LIVE_BANDS and arcade-help-bands-check read it). */
export const BF_V1_BAND_CURVE = bandCurve([0, BF_CORE_FULL], [0, BF_CORE_MAX]);

export const BF_STD_SPEC: StdSpec = {
  field: "blockfallRev",
  rev: BLOCKFALL_REV,
  parts: [
    { key: "core", label: "Lines", max: BF_CORE_MAX, of: BF_CORE_FULL, item: "line", how: `a straight line, full at ${BF_CORE_FULL} lines` },
    { key: "multi", label: "Multi-line clears", max: BF_MULTI_MAX, of: 10, item: "clear", how: "4 for two lines at once, 8 for three, 12 for four" },
    { key: "low", label: "Low stack", max: BF_LOW_MAX, of: BF_LOW_ZERO - BF_LOW_FULL, item: "row", how: `full with the highest block in the bottom ${BF_LOW_FULL} rows at the buzzer, 0 from row ${BF_LOW_ZERO} up` },
  ],
};

/* ================================ Pieces ================================ */

/** The seven shapes' cells at turn 0, in their box (x, y; y down), and the box size. */
const SHAPES: readonly { box: number; cells: readonly (readonly [number, number])[] }[] = [
  { box: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] }, // 0 bar
  { box: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] }, // 1 square
  { box: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] }, // 2 tee
  { box: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] }, // 3 step right
  { box: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] }, // 4 step left
  { box: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] }, // 5 hook left
  { box: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] }, // 6 hook right
];
export const BF_SHAPES = SHAPES.length;

/** PIECE_CELLS[shape][turn]: the four cells (x, y) in the box after `turn` clockwise quarter turns. */
const PIECE_CELLS: readonly (readonly (readonly [number, number])[])[][] = SHAPES.map((s) => {
  const out: (readonly [number, number])[][] = [];
  let cells = s.cells.map(([x, y]) => [x, y] as const);
  for (let r = 0; r < 4; r++) {
    out.push(cells);
    cells = cells.map(([x, y]) => [s.box - 1 - y, x] as const);
  }
  return out;
});

export function bfCells(shape: number, turn: number): readonly (readonly [number, number])[] {
  return PIECE_CELLS[shape]![((turn % 4) + 4) % 4]!;
}

/** The kicks tried, in order, when a turn is blocked where it stands (dx, dy; dy up is negative). */
const KICKS: readonly (readonly [number, number])[] = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [-1, -1], [1, -1]];

/** Where a new piece appears: its box's left column and top row (its lowest row is the well's first visible one). */
export function bfSpawn(shape: number): { x: number; y: number } {
  return { x: shape === 1 ? 4 : 3, y: shape === 0 ? 0 : 1 };
}

/* ================================ State ================================ */

export interface BfPiece {
  shape: number;
  turn: number;
  x: number;
  y: number;
}

export interface BfState {
  tick: number;
  rev: number;
  /** The well, row by row from the top (BF_ROWS × BF_W): 0 empty, else shape + 1. */
  board: number[];
  piece: BfPiece;
  /** The upcoming shapes (at least BF_PREVIEW + 1); refilled a shuffled bag of seven at a time. */
  queue: number[];
  rng: number;
  /** The held shape, or −1; whether this piece already used hold. */
  hold: number;
  held: number;
  fall: number;
  lock: number;
  resets: number;
  lines: number;
  doubles: number;
  triples: number;
  quads: number;
  pieces: number;
  rejects: number;
  acted: number;
  /** 0 running, 1 the buzzer, 2 topped out. */
  ended: number;
  endTick: number;
  /** Display only: the rows cleared by the last clear (top row index first) and its tick; the last lock's tick. */
  cleared: number[];
  clearTick: number;
  lockTick: number;
  std: number;
  /** blockfallRev 2 only: the soft drop held (0/1). */
  soft?: number;
}

function fill(rng: number, queue: number[]): number {
  const bag = [0, 1, 2, 3, 4, 5, 6];
  let r = rng;
  for (let i = bag.length - 1; i > 0; i--) {
    const d = rngBelow(r, i + 1);
    r = d.state;
    const t = bag[i]!;
    bag[i] = bag[d.value]!;
    bag[d.value] = t;
  }
  queue.push(...bag);
  return r;
}

export function bfFits(board: readonly number[], shape: number, turn: number, x: number, y: number): boolean {
  for (const [cx, cy] of bfCells(shape, turn)) {
    const gx = x + cx;
    const gy = y + cy;
    if (gx < 0 || gx >= BF_W || gy >= BF_ROWS) return false;
    if (gy >= 0 && board[gy * BF_W + gx]) return false;
  }
  return true;
}

/** The row the piece would land on (its box's top row). */
export function bfGhostY(board: readonly number[], p: BfPiece): number {
  let y = p.y;
  while (bfFits(board, p.shape, p.turn, p.x, y + 1)) y++;
  return y;
}

export function bfLevel(tick: number): number {
  return clampInt(Math.floor(tick / BF_LEVEL_TICKS), 0, BF_GRAVITY.length - 1);
}

/** The stack's height: rows from the bottom up to the highest filled square (0 empty, 20+ into the hidden rows). */
export function bfStackHeight(board: readonly number[]): number {
  for (let y = 0; y < BF_ROWS; y++) {
    for (let x = 0; x < BF_W; x++) if (board[y * BF_W + x]) return BF_ROWS - y;
  }
  return 0;
}

export function bfMultiPoints(s: Pick<BfState, "doubles" | "triples" | "quads">): number {
  return s.doubles * BF_MULTI_POINTS[2] + s.triples * BF_MULTI_POINTS[3] + s.quads * BF_MULTI_POINTS[4];
}

/** Low-stack points for a stack height: 20 at 4 rows or lower, 0 at 10 or higher, a straight line between. */
export function bfLowPoints(height: number): number {
  return stdLine(BF_LOW_MAX, BF_LOW_ZERO - height, BF_LOW_ZERO - BF_LOW_FULL);
}

function spawn(s: BfState, shape: number): BfState {
  const at = bfSpawn(shape);
  const piece = { shape, turn: 0, x: at.x, y: at.y };
  const next = { ...s, piece, fall: 0, lock: 0, resets: 0 };
  if (!bfFits(s.board, shape, 0, at.x, at.y)) {
    next.ended = 2;
    next.endTick = s.tick;
  }
  return next;
}

function takeNext(s: BfState): { shape: number; queue: number[]; rng: number } {
  const queue = s.queue.slice();
  const shape = queue.shift()!;
  let rng = s.rng;
  if (queue.length <= BF_PREVIEW + 1) rng = fill(rng, queue);
  return { shape, queue, rng };
}

export function bfInit(seed: number): BfState {
  const queue: number[] = [];
  let rng = fill(seed | 0, queue);
  rng = fill(rng, queue);
  const shape = queue.shift()!;
  const base: BfState = {
    tick: 0, rev: BLOCKFALL_REV, board: new Array<number>(BF_ROWS * BF_W).fill(0), piece: { shape, turn: 0, x: 0, y: 0 }, queue, rng,
    hold: -1, held: 0, fall: 0, lock: 0, resets: 0, lines: 0, doubles: 0, triples: 0, quads: 0, pieces: 0, rejects: 0, acted: 0,
    ended: 0, endTick: 0, cleared: [], clearTick: 0, lockTick: 0, std: 1,
  };
  return spawn(base, shape);
}

/** Locks the piece where it is, clears full rows and brings in the next piece. */
function lockPiece(s: BfState): BfState {
  const board = s.board.slice();
  const p = s.piece;
  let above = true;
  for (const [cx, cy] of bfCells(p.shape, p.turn)) {
    const gy = p.y + cy;
    if (gy >= BF_HIDDEN) above = false;
    if (gy >= 0) board[gy * BF_W + p.x + cx] = p.shape + 1;
  }
  const cleared: number[] = [];
  for (let y = 0; y < BF_ROWS; y++) {
    let full = true;
    for (let x = 0; x < BF_W; x++) if (!board[y * BF_W + x]) { full = false; break; }
    if (full) cleared.push(y);
  }
  let out = board;
  if (cleared.length) {
    const kept: number[] = [];
    for (let y = 0; y < BF_ROWS; y++) if (!cleared.includes(y)) kept.push(...board.slice(y * BF_W, y * BF_W + BF_W));
    out = new Array<number>(cleared.length * BF_W).fill(0).concat(kept);
  }
  const n = cleared.length;
  let next: BfState = {
    ...s, board: out, lines: s.lines + n, doubles: s.doubles + (n === 2 ? 1 : 0), triples: s.triples + (n === 3 ? 1 : 0), quads: s.quads + (n === 4 ? 1 : 0),
    pieces: s.pieces + 1, held: 0, lockTick: s.tick,
  };
  if (n) next = { ...next, cleared, clearTick: s.tick };
  if (above && n === 0) return { ...next, ended: 2, endTick: s.tick };
  const t = takeNext(next);
  return spawn({ ...next, queue: t.queue, rng: t.rng }, t.shape);
}

/** After a move or turn that succeeded: the lock wait starts again (a limited number of times). */
function moved(s: BfState): BfState {
  if (s.rev === BLOCKFALL_REV_ZONE) return movedZone(s);
  if (s.resets >= BF_LOCK_RESETS) return s;
  return { ...s, lock: 0, resets: s.resets + 1 };
}

/** Applies one input to a running state (no tick advance); the rejected count rises on a move that did nothing. */
export function bfApply(s: BfState, ev: Pick<ArcadeInputEvent, "k" | "a">): BfState {
  const p = s.piece;
  switch (ev.k) {
    case BF_INPUT_MOVE: {
      const dir = ev.a < 0 ? -1 : 1;
      let x = p.x;
      for (let i = 0; i < Math.abs(ev.a); i++) {
        if (!bfFits(s.board, p.shape, p.turn, x + dir, p.y)) break;
        x += dir;
      }
      if (x === p.x) return { ...s, rejects: s.rejects + 1 };
      return moved({ ...s, piece: { ...p, x } });
    }
    case BF_INPUT_TURN: {
      const turn = (p.turn + (ev.a < 0 ? 3 : 1)) % 4;
      for (const [dx, dy] of KICKS) {
        if (p.shape === 1) return moved({ ...s, piece: { ...p, turn } });
        if (bfFits(s.board, p.shape, turn, p.x + dx, p.y + dy)) return moved({ ...s, piece: { ...p, turn, x: p.x + dx, y: p.y + dy } });
      }
      return { ...s, rejects: s.rejects + 1 };
    }
    case BF_INPUT_DROP:
      return lockPiece({ ...s, piece: { ...p, y: bfGhostY(s.board, p) } });
    case BF_INPUT_DOWN: {
      if (!bfFits(s.board, p.shape, p.turn, p.x, p.y + 1)) return { ...s, rejects: s.rejects + 1 };
      return { ...s, piece: { ...p, y: p.y + 1 }, fall: 0 };
    }
    case BF_INPUT_HOLD: {
      // Blockzone (blockfallRev 2) has no hold.
      if (s.held || s.rev === BLOCKFALL_REV_ZONE) return { ...s, rejects: s.rejects + 1 };
      if (s.hold < 0) {
        const t = takeNext(s);
        return { ...spawn({ ...s, queue: t.queue, rng: t.rng, hold: p.shape }, t.shape), held: 1 };
      }
      return { ...spawn({ ...s, hold: p.shape }, s.hold), held: 1 };
    }
    default:
      return s;
  }
}

function step(state: BfState, input: ArcadeInputEvent | null): BfState {
  if (state.rev === BLOCKFALL_REV_ZONE) return stepZone(state, input);
  if (state.ended) return state;
  let s: BfState = { ...state, tick: state.tick + 1 };
  if (input && input.k >= BF_INPUT_MOVE && input.k <= BF_INPUT_DOWN) {
    s.acted = 1;
    s = bfApply(s, input);
    if (s.ended) return s;
  }
  // Gravity, then the lock wait once the piece rests.
  const p = s.piece;
  const resting = !bfFits(s.board, p.shape, p.turn, p.x, p.y + 1);
  if (resting) {
    const lock = s.lock + 1;
    if (lock >= BF_LOCK_TICKS) s = lockPiece({ ...s, lock });
    else s = { ...s, lock, fall: 0 };
  } else {
    const fall = s.fall + 1;
    if (fall >= BF_GRAVITY[bfLevel(s.tick)]!) s = { ...s, piece: { ...p, y: p.y + 1 }, fall: 0, lock: 0 };
    else s = { ...s, fall };
  }
  if (!s.ended && s.tick >= BF_RUN_TICKS) s = { ...s, ended: 1, endTick: s.tick };
  return s;
}

/* ================================ Scoring ================================ */

export function blockfallStdParts(state: BfState): StdPart[] | null {
  if (!state || !state.std) return null;
  if (state.rev === BLOCKFALL_REV_ZONE) return zoneStdParts(state);
  const multi = bfMultiPoints(state);
  const clears = state.doubles + state.triples + state.quads;
  // A topped-out stack has reached the hidden rows: no low-stack points.
  const height = state.ended === 2 ? BF_ROWS : bfStackHeight(state.board);
  return [
    stdPart(BF_STD_SPEC, "core", stdLine(BF_CORE_MAX, state.lines, BF_CORE_FULL), `${state.lines} lines`),
    stdPart(BF_STD_SPEC, "multi", stdEach(multi, 1, BF_MULTI_MAX), `${clears} multi-line clear${clears === 1 ? "" : "s"}`),
    stdPart(BF_STD_SPEC, "low", bfLowPoints(height), state.ended === 2 ? "topped out" : `stack ${height} high`),
  ];
}

export function blockfallScore(state: BfState): number {
  return stdScore(blockfallStdParts(state) ?? [], Boolean(state.acted));
}

export function blockfallBandParts(state: BfState): BandParts {
  const parts = blockfallStdParts(state) ?? [];
  const core = parts[0]?.points ?? 0;
  return { units: state.lines, points: core, bonus: stdSum(parts) - core, penalty: 0, finished: state.ended === 1, text: `${state.lines} lines` };
}

/* ============================== Checkpoints ============================== */

export const BF_CHECKPOINT_INTERVAL = 300;
export const BF_CHECKPOINT_KEYS = ["tick", "lines", "ended", "checksum"] as const;
export interface BfCheckpoint {
  tick: number;
  lines: number;
  ended: number;
  checksum: number;
}

export function bfCheckpoint(state: BfState): BfCheckpoint {
  const p = state.piece;
  const flat = [state.tick, state.lines, state.ended, p.shape, p.turn, p.x, p.y, state.hold, state.rng, ...state.board];
  if (state.rev === BLOCKFALL_REV_ZONE) flat.push(state.soft ?? 0, state.lock, state.resets, state.fall);
  return { tick: state.tick, lines: state.lines, ended: state.ended, checksum: hashInts(flat) };
}

export const blockfallGame: ArcadeGame<BfState, ArcadeInputEvent | null> = {
  key: "blockfall",
  runTicks: BF_RUN_TICKS,
  init: bfInit,
  step,
  isOver: (state) => state.ended !== 0,
  score: blockfallScore,
  draw: () => {},
  inputRanges: [
    inputRange(BF_INPUT_MOVE, [-(BF_W - 1), BF_W - 1]),
    inputRange(BF_INPUT_TURN, [-1, 1]),
    inputRange(BF_INPUT_DROP),
    inputRange(BF_INPUT_HOLD),
    inputRange(BF_INPUT_DOWN),
  ],
};

export function blockfallGameFor(rev?: number | null): ArcadeGame<BfState, ArcadeInputEvent | null> {
  return (rev ?? 1) >= BLOCKFALL_REV_ZONE ? blockzoneGame : blockfallGame;
}

/* ======================= blockfallRev 2: Blockzone (3 Nov 2026) ======================= */
/*
 * Blockzone (docs/arcade-standard/blockfall.md "blockfallRev 2"): the same well, pieces and bags, with:
 * - a 90 s run (BF_ZONE_RUN_TICKS), gravity a step faster every 15 s over six steps (BF_ZONE_GRAVITY);
 * - no hold (the input is outside the stamp's ranges and does nothing);
 * - a soft drop (k6, a 1 while the finger drags down, 0 when it stops): the piece falls a row every
 *   BF_ZONE_SOFT_TICKS while it is held;
 * - the lock wait BF_LOCK_TICKS (0.5 s) once a piece touches down; a move or turn that succeeds while it rests
 *   starts the wait again, at most BF_ZONE_LOCK_RESETS times a piece (a hard drop still locks at once).
 * Scoring (the arcade standard, 200): lines 95 on a straight line, full at BF_ZONE_CORE_FULL; 1 for every piece
 * placed, up to 65; multi-line clears 4 / 8 / 12 up to 24; a low stack at the buzzer up to 16 (BF_ZONE_STD_SPEC).
 * Fitted to the skill-band targets on fresh seeds (docs/arcade-standard/blockfall.md "blockfallRev 2").
 */
export const BF_ZONE_RUN_TICKS = 90 * 60;
export const BF_ZONE_GRAVITY = [48, 42, 36, 31, 27, 24] as const;
export const BF_ZONE_LOCK_RESETS = 10;
export const BF_ZONE_SOFT_TICKS = 2;
export const BF_INPUT_SOFT = 6;
export const BF_ZONE_CORE_MAX = 95;
export const BF_ZONE_PIECES_MAX = 65;
export const BF_ZONE_MULTI_MAX = 24;
export const BF_ZONE_LOW_MAX = 16;
/** The core is full at this many lines (fitted to the skill-band targets, `bun scripts/new-arcade-bands.ts blockfall`). */
export const BF_ZONE_CORE_FULL = 51;
export const BF_V2_BAND_CURVE = bandCurve([0, BF_ZONE_CORE_FULL], [0, BF_ZONE_CORE_MAX]);

export const BF_ZONE_STD_SPEC: StdSpec = {
  field: "blockfallRev",
  rev: BLOCKFALL_REV_ZONE,
  parts: [
    { key: "core", label: "Lines", max: BF_ZONE_CORE_MAX, of: BF_ZONE_CORE_FULL, item: "line", how: `a straight line, full at ${BF_ZONE_CORE_FULL} lines` },
    { key: "pieces", label: "Pieces placed", max: BF_ZONE_PIECES_MAX, of: BF_ZONE_PIECES_MAX, item: "piece", how: `1 for every piece placed, up to ${BF_ZONE_PIECES_MAX}` },
    { key: "multi", label: "Multi-line clears", max: BF_ZONE_MULTI_MAX, of: 6, item: "clear", how: `4 for two lines at once, 8 for three, 12 for four, up to ${BF_ZONE_MULTI_MAX}` },
    { key: "low", label: "Low stack", max: BF_ZONE_LOW_MAX, of: BF_LOW_ZERO - BF_LOW_FULL, item: "row", how: `full with the highest block in the bottom ${BF_LOW_FULL} rows at the buzzer, 0 from row ${BF_LOW_ZERO} up` },
  ],
};

/** The gravity step on a tick, by stamp. */
export function bfLevelFor(tick: number, rev: number | null | undefined): number {
  if (rev === BLOCKFALL_REV_ZONE) return clampInt(Math.floor(tick / BF_LEVEL_TICKS), 0, BF_ZONE_GRAVITY.length - 1);
  return bfLevel(tick);
}
export function bfGravityFor(rev: number | null | undefined): readonly number[] {
  return rev === BLOCKFALL_REV_ZONE ? BF_ZONE_GRAVITY : BF_GRAVITY;
}
export function bfRunTicksFor(rev: number | null | undefined): number {
  return rev === BLOCKFALL_REV_ZONE ? BF_ZONE_RUN_TICKS : BF_RUN_TICKS;
}
export function bfCoreFullFor(rev: number | null | undefined): number {
  return rev === BLOCKFALL_REV_ZONE ? BF_ZONE_CORE_FULL : BF_CORE_FULL;
}

function isResting(s: BfState): boolean {
  const p = s.piece;
  return !bfFits(s.board, p.shape, p.turn, p.x, p.y + 1);
}

/** Rev 2: a move or turn while the piece rests starts the lock wait again, at most BF_ZONE_LOCK_RESETS times. */
function movedZone(s: BfState): BfState {
  if (s.lock === 0) return s;
  if (s.resets >= BF_ZONE_LOCK_RESETS) return s;
  return { ...s, lock: 0, resets: s.resets + 1 };
}

export function bzInit(seed: number): BfState {
  return { ...bfInit(seed), rev: BLOCKFALL_REV_ZONE, soft: 0 };
}

function stepZone(state: BfState, input: ArcadeInputEvent | null): BfState {
  if (state.ended) return state;
  let s: BfState = { ...state, tick: state.tick + 1 };
  if (input && input.k >= BF_INPUT_MOVE && input.k <= BF_INPUT_SOFT && input.k !== BF_INPUT_HOLD) {
    s.acted = 1;
    if (input.k === BF_INPUT_SOFT) s = { ...s, soft: input.a > 0 ? 1 : 0 };
    else {
      // A move or turn on a resting piece keeps its lock wait counting from where it was, then movedZone resets it.
      s = bfApply(s, input);
      if (s.ended) return s;
    }
  }
  const p = s.piece;
  if (isResting(s)) {
    const lock = s.lock + 1;
    if (lock >= BF_LOCK_TICKS) s = lockPiece({ ...s, lock });
    else s = { ...s, lock, fall: 0 };
  } else {
    const fall = s.fall + 1;
    const g = BF_ZONE_GRAVITY[bfLevelFor(s.tick, BLOCKFALL_REV_ZONE)]!;
    const every = s.soft ? Math.min(g, BF_ZONE_SOFT_TICKS) : g;
    if (fall >= every) s = { ...s, piece: { ...p, y: p.y + 1 }, fall: 0, lock: 0 };
    else s = { ...s, fall, lock: 0 };
  }
  if (!s.ended && s.tick >= BF_ZONE_RUN_TICKS) s = { ...s, ended: 1, endTick: s.tick };
  return s;
}

function zoneStdParts(state: BfState): StdPart[] {
  const multi = bfMultiPoints(state);
  const clears = state.doubles + state.triples + state.quads;
  const height = state.ended === 2 ? BF_ROWS : bfStackHeight(state.board);
  return [
    stdPart(BF_ZONE_STD_SPEC, "core", stdLine(BF_ZONE_CORE_MAX, state.lines, BF_ZONE_CORE_FULL), `${state.lines} lines`),
    stdPart(BF_ZONE_STD_SPEC, "pieces", stdEach(state.pieces, 1, BF_ZONE_PIECES_MAX), `${state.pieces} pieces`),
    stdPart(BF_ZONE_STD_SPEC, "multi", stdEach(multi, 1, BF_ZONE_MULTI_MAX), `${clears} multi-line clear${clears === 1 ? "" : "s"}`),
    stdPart(BF_ZONE_STD_SPEC, "low", stdLine(BF_ZONE_LOW_MAX, BF_LOW_ZERO - height, BF_LOW_ZERO - BF_LOW_FULL), state.ended === 2 ? "topped out" : `stack ${height} high`),
  ];
}

export const blockzoneGame: ArcadeGame<BfState, ArcadeInputEvent | null> = {
  key: "blockfall",
  runTicks: BF_ZONE_RUN_TICKS,
  init: bzInit,
  step,
  isOver: (state) => state.ended !== 0,
  score: blockfallScore,
  draw: () => {},
  inputRanges: [
    inputRange(BF_INPUT_MOVE, [-(BF_W - 1), BF_W - 1]),
    inputRange(BF_INPUT_TURN, [-1, 1]),
    inputRange(BF_INPUT_DROP),
    inputRange(BF_INPUT_DOWN),
    inputRange(BF_INPUT_SOFT, [0, 1]),
  ],
};
