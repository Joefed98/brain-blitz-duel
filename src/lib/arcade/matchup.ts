/**
 * Matchup — an arcade game on the shared engine.
 *
 * A 7×7 board of six symbols. A swap that makes a line of three or more clears
 * it, everything above falls, and new symbols enter from the top. Refills never
 * draw fresh randomness during play: every column has a fixed queue built at
 * init, so the whole room sees the identical board and the identical incoming
 * symbols. The only PRNG call after init is a deterministic reshuffle when the
 * board has no valid swap left.
 *
 * Every value in the state is an integer; a swap, its clears, falls, refills
 * and cascades all resolve inside the tick the swap event applies on.
 */

import {
  clampInt,
  inputRange,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";

/* ============================== Constants ============================== */

export const MATCHUP_WORLD_W = 390;
export const MATCHUP_WORLD_H = 560;

export const MATCHUP_RUN_SECONDS = 60;
export const MATCHUP_RUN_TICKS = MATCHUP_RUN_SECONDS * TICKS_PER_SECOND;

export const MATCHUP_SIZE = 7;
export const MATCHUP_CELLS = MATCHUP_SIZE * MATCHUP_SIZE;
export const MATCHUP_KINDS = 6;
export const MATCHUP_BOMB = 6;
export const MATCHUP_CROSS = 7;

/** Cells are 50 px; symbols are drawn at 70% of the cell. */
export const MATCHUP_CELL_PX = 50;
export const MATCHUP_SYMBOL_PCT = 70;
export const MATCHUP_BOARD_W = MATCHUP_SIZE * MATCHUP_CELL_PX;
export const MATCHUP_BOARD_X = Math.round((MATCHUP_WORLD_W - MATCHUP_BOARD_W) / 2);
export const MATCHUP_BOARD_Y = 100;
export const MATCHUP_NEXT_Y = 54;
export const MATCHUP_NEXT_H = 34;

/** Fixed refill queue per column, built once at init. */
export const MATCHUP_QUEUE_LEN = 60;

/** Line length to points: 3 = 10, 4 = 25, 5 or more = 50. */
export function matchupLinePoints(length: number): number {
  if (length >= 5) return 50;
  if (length === 4) return 25;
  if (length === 3) return 10;
  return 0;
}

/** Ticks of no scoring swap before the hint appears (five seconds). */
export const MATCHUP_HINT_TICKS = 5 * TICKS_PER_SECOND;

/** A swap: a = row1, b = col1, c = row2, d = col2. */
export const MATCHUP_INPUT_SWAP = 3;
export const MATCHUP_INPUT_RANGES: readonly InputRange[] = [
  inputRange(
    MATCHUP_INPUT_SWAP,
    [0, MATCHUP_SIZE - 1],
    [0, MATCHUP_SIZE - 1],
    [0, MATCHUP_SIZE - 1],
    [0, MATCHUP_SIZE - 1],
  ),
];

export const MATCHUP_SHAPES = [
  "circle",
  "square",
  "triangle",
  "diamond",
  "star",
  "hexagon",
] as const;
export type MatchupShape = (typeof MATCHUP_SHAPES)[number];

function isNormal(kind: number): boolean {
  return kind >= 0 && kind < MATCHUP_KINDS;
}

function isSpecial(kind: number): boolean {
  return kind === MATCHUP_BOMB || kind === MATCHUP_CROSS;
}

/** One game colour per symbol kind. */
export const MATCHUP_COLOURS = [
  "#F5B82E",
  "#FF4D4D",
  "#4D8CFF",
  "#3DDC84",
  "#B26BFF",
  "#FF6BD6",
] as const;

/* ============================ Board helpers ============================ */

export function matchupIndex(row: number, col: number): number {
  return row * MATCHUP_SIZE + col;
}

function adjacent(r1: number, c1: number, r2: number, c2: number): boolean {
  const dr = Math.abs(r1 - r2);
  const dc = Math.abs(c1 - c2);
  return dr + dc === 1;
}

export interface MatchupRun {
  /** Cell indices in this line, in board order. */
  cells: number[];
  length: number;
  points: number;
}

/** Every maximal run of three or more, rows then columns. An L or T yields two. */
export function matchupRuns(cells: readonly number[]): MatchupRun[] {
  const runs: MatchupRun[] = [];
  const push = (group: number[]) => {
    if (group.length >= 3) {
      runs.push({ cells: group, length: group.length, points: matchupLinePoints(group.length) });
    }
  };
  for (let row = 0; row < MATCHUP_SIZE; row++) {
    let group: number[] = [];
    for (let col = 0; col < MATCHUP_SIZE; col++) {
      const index = matchupIndex(row, col);
      const lastIndex = group.length > 0 ? group[group.length - 1] : undefined;
      const previous = lastIndex === undefined ? -1 : (cells[lastIndex] ?? -1);
      const current = cells[index] ?? -1;
      if (isNormal(current) && current === previous) group.push(index);
      else {
        push(group);
        group = isNormal(current) ? [index] : [];
      }
    }
    push(group);
  }
  for (let col = 0; col < MATCHUP_SIZE; col++) {
    let group: number[] = [];
    for (let row = 0; row < MATCHUP_SIZE; row++) {
      const index = matchupIndex(row, col);
      const lastIndex = group.length > 0 ? group[group.length - 1] : undefined;
      const previous = lastIndex === undefined ? -1 : (cells[lastIndex] ?? -1);
      const current = cells[index] ?? -1;
      if (isNormal(current) && current === previous) group.push(index);
      else {
        push(group);
        group = isNormal(current) ? [index] : [];
      }
    }
    push(group);
  }
  return runs;
}

export function matchupHasLine(cells: readonly number[]): boolean {
  return matchupRuns(cells).length > 0;
}

export interface MatchupSwap {
  row1: number;
  col1: number;
  row2: number;
  col2: number;
}

/**
 * The first swap that would make a line, scanning rows then columns — used for
 * the render-only hint and for the "is this board playable" test. Derived from
 * the state, so every player is shown the same hint.
 */
export function matchupFindSwap(cells: readonly number[]): MatchupSwap | null {
  const board = [...cells];
  const test = (row1: number, col1: number, row2: number, col2: number): MatchupSwap | null => {
    const a = matchupIndex(row1, col1);
    const b = matchupIndex(row2, col2);
    if (isSpecial(board[a] ?? -1) || isSpecial(board[b] ?? -1)) return { row1, col1, row2, col2 };
    if (board[a] === board[b]) return null;
    const av = board[a] ?? 0;
    const bv = board[b] ?? 0;
    board[a] = bv;
    board[b] = av;
    const made = matchupHasLine(board);
    board[a] = av;
    board[b] = bv;
    return made ? { row1, col1, row2, col2 } : null;
  };
  for (let row = 0; row < MATCHUP_SIZE; row++) {
    for (let col = 0; col < MATCHUP_SIZE; col++) {
      if (col + 1 < MATCHUP_SIZE) {
        const found = test(row, col, row, col + 1);
        if (found) return found;
      }
      if (row + 1 < MATCHUP_SIZE) {
        const found = test(row, col, row + 1, col);
        if (found) return found;
      }
    }
  }
  return null;
}

/* ================================ State ================================ */

export interface MatchupAnimMove {
  kind: number;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

export interface MatchupAnimSpecial {
  index: number;
  kind: number;
}

export interface MatchupAnimStep {
  before: number[];
  after: number[];
  cleared: number[];
  detonated: number[];
  created: MatchupAnimSpecial[];
  specialIndex: number;
  specialKind: number;
  moves: MatchupAnimMove[];
  ticks: number;
}

export interface MatchupState {
  tick: number;
  rng: number;
  /** Row-major, row 0 at the top. */
  cells: number[];
  /** One fixed refill queue per column, drawn at init only. */
  queues: number[][];
  /** How far into each column's queue the refills have reached. */
  heads: number[];
  /** Scoring swaps made. */
  swaps: number;
  /** Raw points earned; the round score is this divided by four. */
  raw: number;
  /** The longest line cleared so far. */
  bestLine: number;
  /** Cascade steps resolved across the whole run. */
  cascades: number;
  /** Deterministic reshuffles because no valid swap was left. */
  reshuffles: number;
  /** Tick of the last scoring swap — the hint waits five seconds after it. */
  lastScoreTick: number;
  /** The last swap's result, for the client's animation. Render only. */
  lastGain: number;
  lastSteps: number;
  lastCleared: number[];
  lastAnimation: MatchupAnimStep[];
  lastAnimTicks: number;
  /** A swap that made no line, so it swaps back. Render only. */
  lastInvalidA: number;
  lastInvalidB: number;
  lastInvalidTick: number;
  endedTick: number;
}

function drawSymbol(rng: number): { state: number; value: number } {
  return rngBelow(rng, MATCHUP_KINDS);
}

/** A board with no line already on it and at least one valid swap. */
function rollBoard(rng: number): { state: number; cells: number[] } {
  let state = rng;
  for (let attempt = 0; attempt < 400; attempt++) {
    const cells: number[] = [];
    for (let index = 0; index < MATCHUP_CELLS; index++) {
      const drawn = drawSymbol(state);
      state = drawn.state;
      cells.push(drawn.value);
    }
    if (!matchupHasLine(cells) && matchupFindSwap(cells)) return { state, cells };
  }
  // Unreachable in practice; a fixed fallback keeps the sim total.
  const cells = Array.from({ length: MATCHUP_CELLS }, (_, index) => index % MATCHUP_KINDS);
  return { state, cells };
}

function init(seed: number): MatchupState {
  const rolled = rollBoard(seed | 0);
  let rng = rolled.state;
  const queues: number[][] = [];
  for (let col = 0; col < MATCHUP_SIZE; col++) {
    const queue: number[] = [];
    for (let slot = 0; slot < MATCHUP_QUEUE_LEN; slot++) {
      const drawn = drawSymbol(rng);
      rng = drawn.state;
      queue.push(drawn.value);
    }
    queues.push(queue);
  }
  return {
    tick: 0,
    rng,
    cells: rolled.cells,
    queues,
    heads: Array.from({ length: MATCHUP_SIZE }, () => 0),
    swaps: 0,
    raw: 0,
    bestLine: 0,
    cascades: 0,
    reshuffles: 0,
    lastScoreTick: 0,
    lastGain: 0,
    lastSteps: 0,
    lastCleared: [],
    lastAnimation: [],
    lastAnimTicks: 0,
    lastInvalidA: -1,
    lastInvalidB: -1,
    lastInvalidTick: 0,
    endedTick: 0,
  };
}

function middleCell(run: MatchupRun): number {
  return run.cells[run.cells.length >> 1] ?? run.cells[0] ?? 0;
}

function lineSpecialIndex(run: MatchupRun, preferred: number | null): number {
  return preferred !== null && run.cells.includes(preferred) ? preferred : middleCell(run);
}

function addBlast(index: number, kind: number, gone: Set<number>): number {
  let gained = 0;
  const row = Math.trunc(index / MATCHUP_SIZE);
  const col = index % MATCHUP_SIZE;
  const add = (target: number) => {
    if (!gone.has(target)) {
      gone.add(target);
      gained += 10;
    }
  };
  if (kind === MATCHUP_BOMB) {
    for (let r = Math.max(0, row - 1); r <= Math.min(MATCHUP_SIZE - 1, row + 1); r++) {
      for (let c = Math.max(0, col - 1); c <= Math.min(MATCHUP_SIZE - 1, col + 1); c++) {
        add(matchupIndex(r, c));
      }
    }
  } else if (kind === MATCHUP_CROSS) {
    for (let c = 0; c < MATCHUP_SIZE; c++) add(matchupIndex(row, c));
    for (let r = 0; r < MATCHUP_SIZE; r++) add(matchupIndex(r, col));
  }
  return gained;
}

function expandSpecials(
  cells: readonly number[],
  gone: Set<number>,
  initial: readonly number[],
): { gained: number; detonated: number[] } {
  let gained = 0;
  const detonated: number[] = [];
  const queue = [...initial];
  for (const index of gone) if (isSpecial(cells[index] ?? -1) && !queue.includes(index)) queue.push(index);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor] ?? -1;
    if (detonated.includes(index)) continue;
    const kind = cells[index] ?? -1;
    if (!isSpecial(kind)) continue;
    detonated.push(index);
    gained += addBlast(index, kind, gone);
    for (const target of gone) {
      if (isSpecial(cells[target] ?? -1) && !detonated.includes(target) && !queue.includes(target)) {
        queue.push(target);
      }
    }
  }
  return { gained, detonated };
}

function fallAndRefill(
  cells: number[],
  queues: readonly number[][],
  heads: number[],
  gone: Set<number>,
): { moves: MatchupAnimMove[] } {
  const moves: MatchupAnimMove[] = [];
  for (let col = 0; col < MATCHUP_SIZE; col++) {
    const kept: { kind: number; row: number }[] = [];
    for (let row = MATCHUP_SIZE - 1; row >= 0; row--) {
      const index = matchupIndex(row, col);
      if (!gone.has(index)) kept.push({ kind: cells[index] ?? 0, row });
    }
    const queue = queues[col] ?? [];
    for (let row = MATCHUP_SIZE - 1; row >= 0; row--) {
      const depth = MATCHUP_SIZE - 1 - row;
      const target = matchupIndex(row, col);
      if (depth < kept.length) {
        const item = kept[depth];
        if (!item) continue;
        cells[target] = item.kind;
        if (item.row !== row) moves.push({ kind: item.kind, fromRow: item.row, fromCol: col, toRow: row, toCol: col });
      } else {
        const head = heads[col] ?? 0;
        const slot = head % MATCHUP_QUEUE_LEN;
        heads[col] = head + 1;
        const kind = queue[slot] ?? 0;
        const fromRow = -(depth - kept.length + 1);
        cells[target] = kind;
        moves.push({ kind, fromRow, fromCol: col, toRow: row, toCol: col });
      }
    }
  }
  return { moves };
}

/** Clears, falls and refills until nothing more lines up. Mutates its inputs. */
function resolveBoard(
  cells: number[],
  queues: readonly number[][],
  heads: number[],
  preferredSpecial: number | null,
  detonations: readonly number[] = [],
): { gain: number; steps: number; best: number; cleared: number[]; animation: MatchupAnimStep[] } {
  let gain = 0;
  let steps = 0;
  let best = 0;
  let preferred = preferredSpecial;
  const cleared: number[] = [];
  const animation: MatchupAnimStep[] = [];

  for (;;) {
    const activeDetonations = steps === 0 ? detonations : [];
    const runs = matchupRuns(cells);
    if (runs.length === 0 && activeDetonations.length === 0) break;

    const before = [...cells];
    const gone = new Set<number>();
    const created = new Map<number, number>();

    for (const run of runs) {
      gain += run.points;
      if (run.length > best) best = run.length;
      let specialIndex = -1;
      let specialKind = -1;
      if (run.length === 4) {
        specialIndex = lineSpecialIndex(run, preferred);
        specialKind = MATCHUP_BOMB;
      } else if (run.length >= 5) {
        specialIndex = lineSpecialIndex(run, preferred);
        specialKind = MATCHUP_CROSS;
      }
      if (specialIndex >= 0) created.set(specialIndex, specialKind);
      for (const index of run.cells) if (index !== specialIndex) gone.add(index);
    }

    for (const [index, kind] of created) cells[index] = kind;
    for (const index of created.keys()) gone.delete(index);

    const special = expandSpecials(cells, gone, activeDetonations);
    gain += special.gained;
    for (const index of special.detonated) gone.add(index);

    if (gone.size === 0) break;
    const stepCleared = [...gone].sort((a, b) => a - b);
    for (const index of stepCleared) cleared.push(index);

    const { moves } = fallAndRefill(cells, queues, heads, gone);
    const maxDrop = moves.reduce((max, move) => Math.max(max, move.toRow - move.fromRow), 1);
    const specialEntry = [...created.entries()][0];
    animation.push({
      before,
      after: [...cells],
      cleared: stepCleared,
      detonated: special.detonated,
      created: [...created.entries()].map(([index, kind]) => ({ index, kind })),
      specialIndex: specialEntry?.[0] ?? -1,
      specialKind: specialEntry?.[1] ?? -1,
      moves,
      ticks: maxDrop,
    });

    steps += 1;
    preferred = null;
    if (steps > 64) break;
  }

  return { gain, steps, best, cleared, animation };
}

/** A board with no valid swap is reshuffled with the state's own PRNG. */
function reshuffle(cells: number[], rng: number): { state: number; cells: number[] } {
  let state = rng;
  for (let attempt = 0; attempt < 200; attempt++) {
    const next = [...cells];
    for (let i = next.length - 1; i > 0; i--) {
      const drawn = rngBelow(state, i + 1);
      state = drawn.state;
      const j = drawn.value;
      const iv = next[i] ?? 0;
      const jv = next[j] ?? 0;
      next[i] = jv;
      next[j] = iv;
    }
    if (!matchupHasLine(next) && matchupFindSwap(next)) return { state, cells: next };
  }
  return { state, cells };
}

function isOver(state: MatchupState): boolean {
  return state.tick >= MATCHUP_RUN_TICKS;
}

function step(state: MatchupState, input: ArcadeInputEvent | null): MatchupState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;

  if (input && input.k === MATCHUP_INPUT_SWAP) {
    const row1 = clampInt(input.a, 0, MATCHUP_SIZE - 1);
    const col1 = clampInt(input.b, 0, MATCHUP_SIZE - 1);
    const row2 = clampInt(input.c, 0, MATCHUP_SIZE - 1);
    const col2 = clampInt(input.d, 0, MATCHUP_SIZE - 1);
    if (adjacent(row1, col1, row2, col2)) {
      const a = matchupIndex(row1, col1);
      const b = matchupIndex(row2, col2);
      const movedIndex = b;
      const cells = [...state.cells];
      const av = cells[a] ?? 0;
      const bv = cells[b] ?? 0;
      cells[a] = bv;
      cells[b] = av;
      const specialSeeds = [a, b].filter((index) => isSpecial(cells[index] ?? -1));
      if (!matchupHasLine(cells) && specialSeeds.length === 0) {
        // No line: it swaps back (the client animates it) and costs nothing.
        const next: MatchupState = {
          ...state,
          tick,
          lastInvalidA: a,
          lastInvalidB: b,
          lastInvalidTick: tick,
          lastGain: 0,
          lastSteps: 0,
          lastCleared: [],
          lastAnimation: [],
          lastAnimTicks: 0,
        };
        return isOver(next) ? { ...next, endedTick: tick } : next;
      }
      const heads = [...state.heads];
      const resolved = resolveBoard(cells, state.queues, heads, movedIndex, specialSeeds);
      let rng = state.rng;
      let board = cells;
      let reshuffles = state.reshuffles;
      if (!matchupFindSwap(board)) {
        const shuffled = reshuffle(board, rng);
        rng = shuffled.state;
        board = shuffled.cells;
        reshuffles += 1;
      }
      const next: MatchupState = {
        ...state,
        tick,
        rng,
        cells: board,
        heads,
        swaps: state.swaps + 1,
        raw: state.raw + resolved.gain,
        bestLine: Math.max(state.bestLine, resolved.best),
        cascades: state.cascades + Math.max(0, resolved.steps - 1),
        reshuffles,
        lastScoreTick: tick,
        lastGain: resolved.gain,
        lastSteps: resolved.steps,
        lastCleared: resolved.cleared,
        lastAnimation: resolved.animation,
        lastAnimTicks: resolved.animation.reduce(
          (total, item) => total + 12 + Math.max(1, item.ticks) * 7 + 15,
          0,
        ),
        lastInvalidA: -1,
        lastInvalidB: -1,
      };
      return isOver(next) ? { ...next, endedTick: tick } : next;
    }
  }

  const next: MatchupState = { ...state, tick };
  return isOver(next) ? { ...next, endedTick: tick } : next;
}

function score(state: MatchupState): number {
  return clampInt(Math.round(state.raw / 10), 0, 150);
}


/** True once the hint should be shown. Derived from the sim, so it is shared. */
export function matchupShowHint(state: MatchupState): boolean {
  return state.tick - state.lastScoreTick >= MATCHUP_HINT_TICKS;
}

/* =========================== Integrity checks ========================== */

export const MATCHUP_CHECKPOINT_INTERVAL = 300;

export interface MatchupCheckpointState {
  tick: number;
  swaps: number;
  raw: number;
  bestLine: number;
  cascades: number;
  reshuffles: number;
  /** FNV-1a over the board and the queue heads. */
  board: number;
}

export interface MatchupCheckpoint extends MatchupCheckpointState {
  checksum: number;
}

function fnv(values: readonly number[]): number {
  let sum = 0x811c9dc5;
  for (const value of values) {
    sum ^= value | 0;
    sum = Math.imul(sum, 0x01000193) >>> 0;
  }
  return sum;
}

export function matchupCheckpointState(state: MatchupState): MatchupCheckpointState {
  return {
    tick: state.tick,
    swaps: state.swaps,
    raw: state.raw,
    bestLine: state.bestLine,
    cascades: state.cascades,
    reshuffles: state.reshuffles,
    board: fnv([...state.cells, ...state.heads]),
  };
}

export function matchupCheckpoint(state: MatchupState): MatchupCheckpoint {
  const snapshot = matchupCheckpointState(state);
  return { ...snapshot, checksum: fnv(Object.values(snapshot)) };
}

/* ================================ Drawing ============================== */

export const MATCHUP_BG = "#0B0B0F";
export const MATCHUP_GOLD = "#F5B82E";
export const MATCHUP_TEXT = "#F7F7F8";

export interface MatchupTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function matchupTransform(size: CanvasSize): MatchupTransform {
  const scale = Math.min(size.width / MATCHUP_WORLD_W, size.height / MATCHUP_WORLD_H);
  return {
    scale,
    offsetX: (size.width - MATCHUP_WORLD_W * scale) / 2,
    offsetY: (size.height - MATCHUP_WORLD_H * scale) / 2,
  };
}

/** Canvas point to a board cell, or null outside the board. */
export function matchupCellAt(
  size: CanvasSize,
  x: number,
  y: number,
): { row: number; col: number } | null {
  const { scale, offsetX, offsetY } = matchupTransform(size);
  const divisor = Math.max(scale, 0.0001);
  const wx = (x - offsetX) / divisor - MATCHUP_BOARD_X;
  const wy = (y - offsetY) / divisor - MATCHUP_BOARD_Y;
  const col = Math.floor(wx / MATCHUP_CELL_PX);
  const row = Math.floor(wy / MATCHUP_CELL_PX);
  if (row < 0 || col < 0 || row >= MATCHUP_SIZE || col >= MATCHUP_SIZE) return null;
  return { row, col };
}

export const MATCHUP_CLEAR_MS = 200;
export const MATCHUP_DROP_MS = 120;
export const MATCHUP_DETONATE_MS = 250;

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

/** One symbol, centred on (cx, cy), at the given radius. */
export function matchupDrawSymbol(
  ctx: CanvasRenderingContext2D,
  kind: number,
  cx: number,
  cy: number,
  radius: number,
): void {
  if (kind === MATCHUP_BOMB) {
    ctx.save();
    ctx.fillStyle = "#15151C";
    ctx.strokeStyle = MATCHUP_GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy + radius * 0.08, radius * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = MATCHUP_GOLD;
    ctx.beginPath();
    ctx.moveTo(cx + radius * 0.38, cy - radius * 0.58);
    ctx.quadraticCurveTo(cx + radius * 0.72, cy - radius * 0.95, cx + radius * 0.2, cy - radius * 1.1);
    ctx.stroke();
    ctx.fillStyle = MATCHUP_GOLD;
    ctx.beginPath();
    ctx.arc(cx + radius * 0.12, cy - radius * 1.08, radius * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (kind === MATCHUP_CROSS) {
    ctx.save();
    ctx.fillStyle = MATCHUP_GOLD;
    ctx.strokeStyle = "#0B0B0F";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let point = 0; point < 8; point++) {
      const r = point % 2 === 0 ? radius : radius * 0.38;
      const angle = (Math.PI / 4) * point - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (point === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }

  const shape = MATCHUP_SHAPES[kind] ?? "circle";
  ctx.fillStyle = MATCHUP_COLOURS[kind] ?? MATCHUP_GOLD;
  ctx.beginPath();
  if (shape === "circle") {
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  } else if (shape === "square") {
    ctx.rect(cx - radius * 0.88, cy - radius * 0.88, radius * 1.76, radius * 1.76);
  } else if (shape === "triangle") {
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx + radius, cy + radius * 0.8);
    ctx.lineTo(cx - radius, cy + radius * 0.8);
    ctx.closePath();
  } else if (shape === "diamond") {
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx + radius, cy);
    ctx.lineTo(cx, cy + radius);
    ctx.lineTo(cx - radius, cy);
    ctx.closePath();
  } else if (shape === "star") {
    for (let point = 0; point < 10; point++) {
      const r = point % 2 === 0 ? radius : radius * 0.45;
      const angle = (Math.PI / 5) * point - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (point === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else {
    for (let point = 0; point < 6; point++) {
      const angle = (Math.PI / 3) * point - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (point === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  ctx.fill();
}

function cellCentre(row: number, col: number): { x: number; y: number } {
  return {
    x: MATCHUP_BOARD_X + col * MATCHUP_CELL_PX + MATCHUP_CELL_PX / 2,
    y: MATCHUP_BOARD_Y + row * MATCHUP_CELL_PX + MATCHUP_CELL_PX / 2,
  };
}

function drawGrid(ctx: CanvasRenderingContext2D): void {
  for (let row = 0; row < MATCHUP_SIZE; row++) {
    for (let col = 0; col < MATCHUP_SIZE; col++) {
      const x = MATCHUP_BOARD_X + col * MATCHUP_CELL_PX;
      const y = MATCHUP_BOARD_Y + row * MATCHUP_CELL_PX;
      ctx.fillStyle = (row + col) % 2 === 0 ? "#15151C" : "#101017";
      ctx.fillRect(x, y, MATCHUP_CELL_PX, MATCHUP_CELL_PX);
    }
  }
}

function drawNextStrip(ctx: CanvasRenderingContext2D, state: MatchupState): void {
  roundedRect(ctx, MATCHUP_BOARD_X, MATCHUP_NEXT_Y, MATCHUP_BOARD_W, MATCHUP_NEXT_H, 12);
  ctx.fillStyle = "rgba(247, 247, 248, 0.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(247, 247, 248, 0.14)";
  ctx.lineWidth = 1;
  ctx.stroke();
  // One slot per column, sitting directly above that column.
  for (let col = 0; col < MATCHUP_SIZE; col++) {
    const cx = MATCHUP_BOARD_X + col * MATCHUP_CELL_PX + MATCHUP_CELL_PX / 2;
    const cy = MATCHUP_NEXT_Y + MATCHUP_NEXT_H / 2;
    const queue = state.queues[col] ?? [];
    const head = state.heads[col] ?? 0;
    const kind = queue[head % MATCHUP_QUEUE_LEN] ?? 0;
    matchupDrawSymbol(ctx, kind, cx, cy, 9);
  }
}


function drawSettledBoard(ctx: CanvasRenderingContext2D, cells: readonly number[]): void {
  const radius = (MATCHUP_CELL_PX * MATCHUP_SYMBOL_PCT) / 200;
  drawGrid(ctx);
  for (let row = 0; row < MATCHUP_SIZE; row++) {
    for (let col = 0; col < MATCHUP_SIZE; col++) {
      const index = matchupIndex(row, col);
      const { x, y } = cellCentre(row, col);
      matchupDrawSymbol(ctx, cells[index] ?? 0, x, y, radius);
    }
  }
}

function animatedKind(step: MatchupAnimStep, index: number): number {
  const created = step.created.find((item) => item.index === index);
  return created?.kind ?? step.before[index] ?? 0;
}

export function matchupAnimationDuration(steps: readonly MatchupAnimStep[]): number {
  return steps.reduce(
    (total, item) => total + MATCHUP_CLEAR_MS + Math.max(1, item.ticks) * MATCHUP_DROP_MS,
    0,
  );
}

function drawDetonations(ctx: CanvasRenderingContext2D, step: MatchupAnimStep, progress: number): void {
  for (const index of step.detonated) {
    const kind = step.before[index] ?? -1;
    const row = Math.trunc(index / MATCHUP_SIZE);
    const col = index % MATCHUP_SIZE;
    const { x, y } = cellCentre(row, col);
    ctx.save();
    ctx.globalAlpha = 1 - progress * 0.7;
    ctx.strokeStyle = MATCHUP_GOLD;
    ctx.lineWidth = 2;
    if (kind === MATCHUP_CROSS) {
      const spread = MATCHUP_CELL_PX * (0.5 + progress * MATCHUP_SIZE);
      ctx.fillStyle = "rgba(245, 184, 46, 0.18)";
      ctx.fillRect(MATCHUP_BOARD_X, y - 3, MATCHUP_BOARD_W, 6);
      ctx.fillRect(x - 3, MATCHUP_BOARD_Y, 6, MATCHUP_BOARD_W);
      ctx.beginPath();
      ctx.moveTo(x - spread, y);
      ctx.lineTo(x + spread, y);
      ctx.moveTo(x, y - spread);
      ctx.lineTo(x, y + spread);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 8 + progress * MATCHUP_CELL_PX * 1.8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawAnimatedBoard(
  ctx: CanvasRenderingContext2D,
  state: MatchupState,
  elapsedMs: number,
): void {
  let remaining = elapsedMs;
  const radius = (MATCHUP_CELL_PX * MATCHUP_SYMBOL_PCT) / 200;
  for (const step of state.lastAnimation) {
    const dropMs = Math.max(1, step.ticks) * MATCHUP_DROP_MS;
    const total = MATCHUP_CLEAR_MS + dropMs;
    if (remaining >= total) {
      remaining -= total;
      continue;
    }

    drawGrid(ctx);
    const cleared = new Set(step.cleared);
    if (remaining < MATCHUP_CLEAR_MS) {
      const p = remaining / MATCHUP_CLEAR_MS;
      for (let row = 0; row < MATCHUP_SIZE; row++) {
        for (let col = 0; col < MATCHUP_SIZE; col++) {
          const index = matchupIndex(row, col);
          const { x, y } = cellCentre(row, col);
          if (cleared.has(index)) {
            ctx.save();
            ctx.globalAlpha = 1 - p;
            matchupDrawSymbol(ctx, animatedKind(step, index), x, y, radius * (1 - p * 0.65));
            ctx.restore();
          } else {
            matchupDrawSymbol(ctx, animatedKind(step, index), x, y, radius);
          }
        }
      }
      drawDetonations(ctx, step, Math.min(1, remaining / MATCHUP_DETONATE_MS));
      return;
    }

    const p = Math.min(1, (remaining - MATCHUP_CLEAR_MS) / dropMs);
    for (let row = 0; row < MATCHUP_SIZE; row++) {
      for (let col = 0; col < MATCHUP_SIZE; col++) {
        const index = matchupIndex(row, col);
        if (cleared.has(index)) continue;
        if (step.moves.some((move) => move.fromRow === row && move.fromCol === col)) continue;
        const { x, y } = cellCentre(row, col);
        matchupDrawSymbol(ctx, animatedKind(step, index), x, y, radius);
      }
    }
    for (const move of step.moves) {
      const from = cellCentre(move.fromRow, move.fromCol);
      const to = cellCentre(move.toRow, move.toCol);
      const x = from.x + (to.x - from.x) * p;
      const y = from.y + (to.y - from.y) * p;
      matchupDrawSymbol(ctx, move.kind, x, y, radius);
    }
    return;
  }
  drawSettledBoard(ctx, state.cells);
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  state: MatchupState,
  size: CanvasSize,
  animationElapsedMs: number | null,
): void {
  const { scale, offsetX, offsetY } = matchupTransform(size);
  ctx.save();
  ctx.fillStyle = MATCHUP_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  drawNextStrip(ctx, state);
  if (animationElapsedMs !== null && state.lastAnimation.length > 0) {
    drawAnimatedBoard(ctx, state, animationElapsedMs);
  } else {
    drawSettledBoard(ctx, state.cells);
  }

  // A subtle hint after five seconds without a scoring swap.
  if (matchupShowHint(state) && animationElapsedMs === null) {
    const hint = matchupFindSwap(state.cells);
    if (hint) {
      ctx.strokeStyle = MATCHUP_GOLD;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      const cells = [
        { row: hint.row1, col: hint.col1 },
        { row: hint.row2, col: hint.col2 },
      ];
      for (const cell of cells) {
        ctx.strokeRect(
          MATCHUP_BOARD_X + cell.col * MATCHUP_CELL_PX + 3,
          MATCHUP_BOARD_Y + cell.row * MATCHUP_CELL_PX + 3,
          MATCHUP_CELL_PX - 6,
          MATCHUP_CELL_PX - 6,
        );
      }
      ctx.globalAlpha = 1;
    }
  }

  const remaining = Math.max(0, MATCHUP_RUN_TICKS - state.tick) / TICKS_PER_SECOND;
  ctx.font = "600 15px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = MATCHUP_TEXT;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`${state.raw} pts`, 12, 12);
  ctx.textAlign = "right";
  ctx.fillText(`${remaining.toFixed(1)}s`, MATCHUP_WORLD_W - 12, 12);
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, state: MatchupState, size: CanvasSize): void {
  drawScene(ctx, state, size, null);
}

export function matchupDrawAnimated(
  ctx: CanvasRenderingContext2D,
  state: MatchupState,
  size: CanvasSize,
  elapsedMs: number,
): void {
  drawScene(ctx, state, size, elapsedMs);
}

/** The selected cell's outline, drawn while a swap is being made. Render only. */
export function matchupDrawSelection(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  row: number,
  col: number,
): void {
  const { scale, offsetX, offsetY } = matchupTransform(size);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.strokeStyle = MATCHUP_GOLD;
  ctx.lineWidth = 3;
  ctx.strokeRect(
    MATCHUP_BOARD_X + col * MATCHUP_CELL_PX + 2,
    MATCHUP_BOARD_Y + row * MATCHUP_CELL_PX + 2,
    MATCHUP_CELL_PX - 4,
    MATCHUP_CELL_PX - 4,
  );
  ctx.restore();
}

export const matchupGame: ArcadeGame<MatchupState, ArcadeInputEvent | null> = {
  key: "matchup",
  runTicks: MATCHUP_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: MATCHUP_INPUT_RANGES,
};
