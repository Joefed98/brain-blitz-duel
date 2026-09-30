/**
 * Hot Floor — plan-then-go. Ten deterministic stages; each board is static
 * while the player taps a route from START to EXIT (k = 11, a = tile), may
 * CLEAR it (k = 12) and presses GO (k = 13). The figure then hops one tile per
 * 20 ticks. A tile's number is how many hops it survives: a tile marked n is
 * safe to land on for hops 1..n and falls at hop n + 1. START and EXIT never
 * fall. A fall costs a life and resets the stage (same board, route cleared).
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

export const HOT_WORLD_W = 390;
export const HOT_WORLD_H = 620;
export const HOT_RUN_TICKS = 120 * TICKS_PER_SECOND;
export const HOT_INPUT_TILE = 11;
export const HOT_INPUT_CLEAR = 12;
export const HOT_INPUT_GO = 13;
export const HOT_INPUT_UNDO = 14;
export const HOT_COLS = 7;
export const HOT_MAX_ROWS = 9;
export const HOT_STAGES = 10;
export const HOT_HOP_TICKS = 20;
const FALL_PAUSE = 40;
const EXIT_PAUSE = 30;
const START_LIVES = 3;
const MAX_ROUTE = 48;
/** Number stored for START/EXIT: they never fall. */
export const HOT_FOREVER = 99;

export const HOT_INPUT_RANGES: readonly InputRange[] = [
  inputRange(HOT_INPUT_TILE, [0, HOT_WORLD_W], [0, HOT_WORLD_H]),
  inputRange(HOT_INPUT_CLEAR),
  inputRange(HOT_INPUT_GO),
  inputRange(HOT_INPUT_UNDO),
];

export interface HotFloorStage {
  rows: number;
  cols: number;
  start: number;
  exit: number;
  missing: number[];
  /** Hops each tile survives after GO (HOT_FOREVER on start/exit, 0 on missing). */
  numbers: number[];
  /** The stored route, verified to be the only survivor (stage 1 may allow two). */
  route: number[];
  /** Maximum hops accepted by GO — exactly the stored route's length. */
  hopBudget: number;
  /** The first late-failing decoy. */
  decoy: number[];
  decoys: number[][];
  fingerprint: number;
}

/** Cell indices use a fixed stride of HOT_COLS; narrower boards leave the right columns unused. */
export function hotNeighbours(cell: number, rows: number, cols: number = HOT_COLS): number[] {
  const row = Math.trunc(cell / HOT_COLS);
  const col = cell % HOT_COLS;
  const out: number[] = [];
  if (col > 0) out.push(cell - 1);
  if (col + 1 < cols) out.push(cell + 1);
  if (row > 0) out.push(cell - HOT_COLS);
  if (row + 1 < rows) out.push(cell + HOT_COLS);
  return out;
}

function adjacent(a: number, b: number): boolean {
  const d = Math.abs(a - b);
  return (d === 1 && Math.trunc(a / HOT_COLS) === Math.trunc(b / HOT_COLS)) || d === HOT_COLS;
}

const colOf = (cell: number) => cell % HOT_COLS;
const rowOf = (cell: number) => Math.trunc(cell / HOT_COLS);

/** Hop index at which a route first fails, or -1 if it reaches the exit. */
export function hotRouteFailure(stage: HotFloorStage, route: readonly number[]): number {
  if (route[0] !== stage.start) return 0;
  for (let hop = 1; hop < route.length; hop++) {
    const cell = route[hop]!;
    if (!adjacent(route[hop - 1]!, cell) || colOf(cell) >= stage.cols) return hop;
    if (stage.missing[cell] || stage.numbers[cell]! < hop) return hop;
    if (cell === stage.exit) return hop === route.length - 1 ? -1 : hop;
  }
  return route.length;
}

/** Breadth-first search over (tile, hop): the shortest surviving route within budget, if any. */
export function hotfloorStageRoute(stage: HotFloorStage): number[] | null {
  const key = (cell: number, hop: number) => hop * 128 + cell;
  const parent = new Map<number, number>();
  let layer = [stage.start];
  parent.set(key(stage.start, 0), -1);
  for (let hop = 1; hop <= stage.hopBudget && layer.length; hop++) {
    const next: number[] = [];
    for (const from of layer) {
      for (const cell of hotNeighbours(from, stage.rows, stage.cols)) {
        if (stage.missing[cell] || stage.numbers[cell]! < hop) continue;
        const k = key(cell, hop);
        if (parent.has(k)) continue;
        parent.set(k, key(from, hop - 1));
        if (cell === stage.exit) {
          const route: number[] = [];
          for (let at = k; at >= 0; at = parent.get(at)!) route.push(at % 128);
          return route.reverse();
        }
        next.push(cell);
      }
    }
    layer = next;
  }
  return null;
}

/**
 * Exact number of surviving tap routes within the budget (revisits included, since the
 * planner allows them), optionally restricted to cells passing `allow`.
 */
export function hotSurvivorCount(stage: HotFloorStage, allow?: (cell: number) => boolean): number {
  let cur = new Array<number>(HOT_COLS * stage.rows).fill(0);
  cur[stage.start] = 1;
  let total = 0;
  for (let hop = 1; hop <= stage.hopBudget; hop++) {
    const next = new Array<number>(cur.length).fill(0);
    for (let cell = 0; cell < cur.length; cell++) {
      if (!cur[cell] || cell === stage.exit) continue;
      for (const nb of hotNeighbours(cell, stage.rows, stage.cols)) {
        if (stage.missing[nb] || stage.numbers[nb]! < hop) continue;
        if (allow && !allow(nb)) continue;
        next[nb] = next[nb]! + cur[cell]!;
      }
    }
    total += next[stage.exit]!;
    next[stage.exit] = 0;
    cur = next;
  }
  return total;
}

/** Decoys: simple routes within budget that fail on a tile number at the third-to-last hop or later. */
export function hotfloorLateDecoys(stage: HotFloorStage, cap = 32): number[][] {
  const out: number[][] = [];
  const path = [stage.start];
  const seen = new Set<number>(path);
  let nodes = 0;
  const open = (cell: number) => !stage.missing[cell] && !seen.has(cell) && colOf(cell) < stage.cols;
  const walk = (cell: number) => {
    if (out.length >= cap || ++nodes > 60_000) return;
    const hop = path.length;
    if (hop > stage.hopBudget) return;
    for (const nb of hotNeighbours(cell, stage.rows, stage.cols)) {
      if (nb === stage.exit || !open(nb)) continue;
      if (stage.numbers[nb]! < hop) {
        if (adjacent(nb, stage.exit) && hop + 1 <= stage.hopBudget) out.push([...path, nb, stage.exit]);
        if (hop + 2 > stage.hopBudget) continue;
        for (const z of hotNeighbours(nb, stage.rows, stage.cols)) {
          if (z !== stage.exit && open(z) && z !== nb && adjacent(z, stage.exit)) out.push([...path, nb, z, stage.exit]);
        }
      } else {
        path.push(nb);
        seen.add(nb);
        walk(nb);
        seen.delete(nb);
        path.pop();
      }
    }
  };
  walk(stage.start);
  return out;
}

export interface HotFloorShape {
  manhattan: number;
  ratio: number;
  turns: number;
  away: number;
}

export function hotRouteShape(stage: HotFloorStage, route: readonly number[] = stage.route): HotFloorShape {
  const manhattan = Math.abs(rowOf(stage.start) - rowOf(stage.exit)) + Math.abs(colOf(stage.start) - colOf(stage.exit));
  const exitCol = colOf(stage.exit);
  let turns = 0;
  let away = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!;
    const b = route[i]!;
    if (rowOf(b) > rowOf(a)) away++;
    else if (rowOf(b) === rowOf(a) && Math.abs(colOf(b) - exitCol) > Math.abs(colOf(a) - exitCol)) away++;
    if (i >= 2 && b - a !== a - route[i - 2]!) turns++;
  }
  return { manhattan, ratio: (route.length - 1) / manhattan, turns, away };
}

/** Columns within one of the straight start-to-exit line. */
export function hotDirectCorridor(stage: HotFloorStage): (cell: number) => boolean {
  const lo = Math.min(colOf(stage.start), colOf(stage.exit)) - 1;
  const hi = Math.max(colOf(stage.start), colOf(stage.exit)) + 1;
  return (cell) => colOf(cell) >= lo && colOf(cell) <= hi;
}

/** Every direct approach fails, including arriving straight up into the exit. */
export function hotDirectClosed(stage: HotFloorStage): boolean {
  if (hotSurvivorCount(stage, hotDirectCorridor(stage)) !== 0) return false;
  const below = stage.exit + HOT_COLS;
  const straightHop = rowOf(stage.start) - rowOf(below) + Math.abs(colOf(stage.start) - colOf(stage.exit));
  return Boolean(stage.missing[below]) || stage.numbers[below]! < straightHop;
}

export function hotfloorRouteHasPinch(stage: HotFloorStage, route: readonly number[]): boolean {
  return route.slice(1, -1).some((cell, index) => stage.numbers[cell] === index + 1);
}

function stageSeed(seed: number, stage: number, attempt: number): number {
  return (seed ^ Math.imul(stage + 1, 0x45d9f3b) ^ Math.imul(attempt + 1, 0x27d4eb2d)) | 0;
}

export function hotSizeFor(stageIndex: number): { rows: number; cols: number } {
  return stageIndex < 2 ? { rows: 6, cols: 6 } : stageIndex < 5 ? { rows: 8, cols: 6 } : { rows: 9, cols: 7 };
}
export function hotRowsFor(stageIndex: number): number {
  return hotSizeFor(stageIndex).rows;
}

const HOT_MIN_RATIO = 1.8;

function tryStage(seed: number, stageIndex: number, attempt: number): HotFloorStage | null {
  let rng = stageSeed(seed, stageIndex, attempt);
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const { rows, cols } = hotSizeFor(stageIndex);
  const total = HOT_COLS * rows;
  const startCol = 1 + draw(cols - 2);
  const exitCol = Math.max(0, Math.min(cols - 1, startCol + draw(3) - 1));
  const start = (rows - 1) * HOT_COLS + startCol;
  const exit = exitCol;
  const manhattan = rows - 1 + Math.abs(startCol - exitCol);
  const minLen = Math.ceil(HOT_MIN_RATIO * manhattan);
  const maxLen = minLen + 4;
  const lo = Math.min(startCol, exitCol) - 1;
  const hi = Math.max(startCol, exitCol) + 1;

  // 1. A winding induced path: no two non-consecutive route tiles touch, so there are no shortcuts.
  const path = [start];
  const inRoute = new Set<number>(path);
  let nodes = 0;
  const shapeOk = (route: readonly number[]) => {
    if (route[route.length - 2] === exit + HOT_COLS) return false;
    if (!route.some((cell) => colOf(cell) < lo || colOf(cell) > hi)) return false;
    const probe = { start, exit, cols, rows } as HotFloorStage;
    const shape = hotRouteShape(probe, route);
    return shape.turns >= 3 && shape.away >= 2 && shape.ratio >= HOT_MIN_RATIO;
  };
  const go = (cell: number): boolean => {
    if (++nodes > 3000) return false;
    const hops = path.length - 1;
    if (cell === exit) return hops >= minLen && shapeOk(path);
    if (hops + rowOf(cell) + Math.abs(colOf(cell) - exitCol) > maxLen) return false;
    const options = hotNeighbours(cell, rows, cols);
    for (let i = options.length - 1; i > 0; i--) {
      const j = draw(i + 1);
      [options[i], options[j]] = [options[j]!, options[i]!];
    }
    for (const nb of options) {
      if (inRoute.has(nb)) continue;
      if (nb === exit && hops + 1 < minLen) continue;
      if (hotNeighbours(nb, rows, cols).some((o) => o !== cell && inRoute.has(o))) continue;
      path.push(nb);
      inRoute.add(nb);
      if (go(nb)) return true;
      inRoute.delete(nb);
      path.pop();
    }
    return false;
  };
  if (!go(start)) return null;
  const route = [...path];
  const routeIndex = new Map<number, number>();
  route.forEach((cell, i) => routeIndex.set(cell, i));

  // 2. Missing tiles: forced where a start-side tile would shortcut onto the route, plus random gaps.
  const missing = new Array<number>(total).fill(0);
  for (let cell = 0; cell < total; cell++) if (colOf(cell) >= cols) missing[cell] = 1;
  for (const nb of hotNeighbours(start, rows, cols)) {
    if (routeIndex.has(nb)) continue;
    if (hotNeighbours(nb, rows, cols).some((o) => (routeIndex.get(o) ?? 0) >= 2)) missing[nb] = 1;
  }
  const missingCount = stageIndex < 2 ? 2 + stageIndex : Math.min(12, 6 + stageIndex - 2);
  const candidates: number[] = [];
  for (let cell = 0; cell < total; cell++) {
    if (missing[cell] || routeIndex.has(cell)) continue;
    if (rowOf(cell) === 0 && adjacent(cell, exit)) continue; // keep side approaches for decoys
    candidates.push(cell);
  }
  for (let n = 0; n < missingCount && candidates.length; n++) missing[candidates.splice(draw(candidates.length), 1)[0]!] = 1;

  // 3. Numbers: route tiles last until their hop (at least half exact); off-route tiles fall one hop
  // before anyone can reach them, except a few high-numbered dead-end pockets.
  const dist = new Array<number>(total).fill(-1);
  dist[start] = 0;
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    for (const nb of hotNeighbours(queue[q]!, rows, cols)) {
      if (missing[nb] || dist[nb]! >= 0) continue;
      dist[nb] = dist[queue[q]!]! + 1;
      queue.push(nb);
    }
  }
  const numbers = new Array<number>(total).fill(0);
  for (let i = 1; i < route.length - 1; i++) {
    const exact = i % 2 === 1 || draw(4) !== 0;
    numbers[route[i]!] = i + (exact ? 0 : 1);
  }
  const pocketPct = attempt < 200 ? 30 : attempt < 500 ? 12 : 0;
  for (let cell = 0; cell < total; cell++) {
    if (missing[cell] || routeIndex.has(cell)) continue;
    const d = Math.max(1, dist[cell]!);
    numbers[cell] = draw(100) < pocketPct ? d + draw(5) : Math.max(1, d - 1);
  }
  numbers[start] = HOT_FOREVER;
  numbers[exit] = HOT_FOREVER;

  let fingerprint = 0x811c9dc5;
  for (const value of [rows, cols, start, exit, ...missing, ...numbers]) {
    fingerprint ^= value | 0;
    fingerprint = Math.imul(fingerprint, 0x01000193) >>> 0;
  }
  const stage: HotFloorStage = {
    rows, cols, start, exit, missing, numbers, route, hopBudget: route.length - 1,
    decoy: [], decoys: [], fingerprint,
  };
  if (hotRouteFailure(stage, route) !== -1) return null;
  const survivors = hotSurvivorCount(stage);
  if (survivors < 1 || survivors > (stageIndex === 0 ? 2 : 1)) return null;
  if (!hotDirectClosed(stage)) return null;
  const decoys = hotfloorLateDecoys(stage);
  if (decoys.length < 4) return null;
  stage.decoys = decoys.slice(0, 6);
  stage.decoy = decoys[0]!;
  return stage;
}

const stageCache = new Map<string, HotFloorStage>();
const HOT_ATTEMPTS = 2000;

export function buildHotFloorStage(seed: number, stageIndex: number): HotFloorStage {
  const id = `${seed | 0}:${stageIndex}`;
  const hit = stageCache.get(id);
  if (hit) return hit;
  for (let attempt = 0; attempt < HOT_ATTEMPTS; attempt++) {
    const stage = tryStage(seed, stageIndex, attempt);
    if (stage) {
      if (stageCache.size > 200) stageCache.clear();
      stageCache.set(id, stage);
      return stage;
    }
  }
  throw new Error("Hot Floor could not generate a stage");
}

export function hotfloorCourseSurvivable(seed: number): boolean {
  return Array.from({ length: HOT_STAGES }, (_, i) => buildHotFloorStage(seed, i)).every(
    (stage) => hotRouteFailure(stage, stage.route) === -1 && hotfloorStageRoute(stage) !== null,
  );
}

/** Attempts rejected before each stage of a course was accepted (for reporting). */
export function hotfloorCourseRerolls(seed: number): number {
  let rerolls = 0;
  for (let i = 0; i < HOT_STAGES; i++) {
    let attempt = 0;
    while (!tryStage(seed, i, attempt)) attempt += 1;
    rerolls += attempt;
  }
  return rerolls;
}

/* ================================ State ================================ */

export interface HotFloorState {
  tick: number;
  rng: number;
  seed: number;
  stage: number;
  lives: number;
  /** 0 planning, 1 running, 2 fell (pause), 3 reached exit (pause). */
  phase: number;
  route: number[];
  hop: number;
  pause: number;
  ended: number;
  endedTick: number;
  board: HotFloorStage;
}

function init(seed: number): HotFloorState {
  const board = buildHotFloorStage(seed, 0);
  return {
    tick: 0, rng: board.fingerprint | 0, seed: seed | 0, stage: 0, lives: START_LIVES,
    phase: 0, route: [board.start], hop: 0, pause: 0, ended: 0, endedTick: 0, board,
  };
}

function isOver(state: HotFloorState): boolean { return state.ended !== 0; }

function plan(s: HotFloorState, input: ArcadeInputEvent): void {
  const last = s.route[s.route.length - 1]!;
  if (input.k === HOT_INPUT_CLEAR) {
    s.route = [s.board.start];
  } else if (input.k === HOT_INPUT_UNDO) {
    if (s.route.length > 1) s.route = s.route.slice(0, -1);
  } else if (input.k === HOT_INPUT_GO) {
    if (last === s.board.exit && s.route.length > 1 && s.route.length - 1 <= s.board.hopBudget) {
      s.phase = 1;
      s.hop = 0;
      s.pause = HOT_HOP_TICKS;
    }
  } else if (input.k === HOT_INPUT_TILE) {
    const cell = hotCellAt(s.board, input.a, input.b);
    if (cell < 0) return;
    if (cell === last && s.route.length > 1) s.route = s.route.slice(0, -1);
    else if (last !== s.board.exit && adjacent(last, cell) && !s.board.missing[cell] && s.route.length < MAX_ROUTE)
      s.route = [...s.route, cell];
  }
}

function step(state: HotFloorState, input: ArcadeInputEvent | null): HotFloorState {
  if (isOver(state)) return state;
  const s: HotFloorState = { ...state, tick: state.tick + 1 };
  if (s.phase === 0) {
    if (input) plan(s, input);
  } else if (s.phase === 1) {
    s.pause -= 1;
    if (s.pause <= 0) {
      s.hop += 1;
      const cell = s.route[s.hop]!;
      if (s.board.missing[cell] || s.board.numbers[cell]! < s.hop) {
        s.lives -= 1;
        s.phase = 2;
        s.pause = FALL_PAUSE;
      } else if (cell === s.board.exit) {
        s.phase = 3;
        s.pause = EXIT_PAUSE;
      } else s.pause = HOT_HOP_TICKS;
    }
  } else {
    s.pause -= 1;
    if (s.pause <= 0) {
      if (s.phase === 2) {
        if (s.lives <= 0) {
          s.ended = 2;
          s.endedTick = s.tick;
          return s;
        }
      } else {
        s.stage += 1;
        if (s.stage >= HOT_STAGES) {
          s.ended = 1;
          s.endedTick = s.tick;
          return s;
        }
        s.board = buildHotFloorStage(s.seed, s.stage);
        s.rng = s.board.fingerprint | 0;
      }
      s.phase = 0;
      s.hop = 0;
      s.pause = 0;
      s.route = [s.board.start];
    }
  }
  if (!s.ended && s.tick >= HOT_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = s.tick;
  }
  return s;
}

function score(state: HotFloorState): number { return clampInt(state.stage * 15, 0, 150); }

export function hotfloorExtra(s: HotFloorState) {
  return { stages: s.stage, livesLost: START_LIVES - s.lives, completedSeconds: s.tick / TICKS_PER_SECOND };
}

export const HOTFLOOR_CHECKPOINT_INTERVAL = 300;
export const HOTFLOOR_CHECKPOINT_KEYS = [
  "tick", "stage", "lives", "phase", "hop", "pause", "routeLen", "routeHash", "ended", "rng", "checksum",
] as const;

export interface HotFloorCheckpoint {
  tick: number; stage: number; lives: number; phase: number; hop: number; pause: number;
  routeLen: number; routeHash: number; ended: number; rng: number; checksum: number;
}

export function hotfloorCheckpoint(state: HotFloorState): HotFloorCheckpoint {
  let routeHash = 0x811c9dc5;
  for (const cell of state.route) {
    routeHash ^= cell;
    routeHash = Math.imul(routeHash, 0x01000193) >>> 0;
  }
  const snap = {
    tick: state.tick, stage: state.stage, lives: state.lives, phase: state.phase, hop: state.hop,
    pause: state.pause, routeLen: state.route.length, routeHash: routeHash | 0, ended: state.ended,
    rng: state.rng | 0,
  };
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snap)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snap, checksum };
}

/* =============================== Layout =============================== */

export const HOT_BG = "#07070D";
export const HOT_GOLD = "#F5B82E";
export const HOT_TEAL = "#2EC4B6";
export const HOT_RED = "#FF4D5E";
const HOT_ORANGE = "#F28C28";
const BOARD_Y = 80;
const BOARD_H = 388;
const BOARD_W = 336;
const UNDO_Y = 476;
const UNDO_H = 44;
const BTN_Y = 528;
const BTN_H = 56;
const CLEAR_X0 = 27;
const CLEAR_X1 = 183;
const GO_X0 = 207;
const GO_X1 = 363;

/** Board geometry for a stage: tiles sized to fit, centred horizontally. */
export function hotLayout(stage: Pick<HotFloorStage, "rows" | "cols">): { tile: number; x: number; y: number } {
  const tile = Math.min(56, Math.floor(BOARD_W / stage.cols), Math.floor(BOARD_H / stage.rows));
  return { tile, x: Math.round((HOT_WORLD_W - tile * stage.cols) / 2), y: BOARD_Y };
}

/** World point to a board cell, or -1. */
export function hotCellAt(stage: HotFloorStage, x: number, y: number): number {
  const { tile, x: ox, y: oy } = hotLayout(stage);
  const col = Math.floor((x - ox) / tile);
  const row = Math.floor((y - oy) / tile);
  if (col < 0 || col >= stage.cols || row < 0 || row >= stage.rows) return -1;
  return row * HOT_COLS + col;
}

/** Centre of a cell in world units (as a tile-tap payload). */
export function hotTilePoint(stage: HotFloorStage, cell: number): { a: number; b: number } {
  const { tile, x, y } = hotLayout(stage);
  return { a: x + colOf(cell) * tile + (tile >> 1), b: y + rowOf(cell) * tile + (tile >> 1) };
}

/** World point to the input it means (tile tap carries the point; the sim resolves the cell). */
export function hotfloorHit(x: number, y: number): { k: number; a: number; b: number } | null {
  if (y >= UNDO_Y && y <= UNDO_Y + UNDO_H) {
    return x >= CLEAR_X0 && x <= GO_X1 ? { k: HOT_INPUT_UNDO, a: 0, b: 0 } : null;
  }
  if (y >= BTN_Y && y <= BTN_Y + BTN_H) {
    if (x >= CLEAR_X0 && x <= CLEAR_X1) return { k: HOT_INPUT_CLEAR, a: 0, b: 0 };
    if (x >= GO_X0 && x <= GO_X1) return { k: HOT_INPUT_GO, a: 0, b: 0 };
    return null;
  }
  if (y < BOARD_Y || y >= BOARD_Y + BOARD_H || x < 0 || x > HOT_WORLD_W) return null;
  return { k: HOT_INPUT_TILE, a: Math.round(x), b: Math.round(y) };
}

function draw(ctx: CanvasRenderingContext2D, state: HotFloorState, size: CanvasSize): void {
  const scale = Math.min(size.width / HOT_WORLD_W, size.height / HOT_WORLD_H);
  ctx.save();
  ctx.fillStyle = HOT_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate((size.width - HOT_WORLD_W * scale) / 2, (size.height - HOT_WORLD_H * scale) / 2);
  ctx.scale(scale, scale);
  const board = state.board;
  const { tile: TILE, x: BOARD_X } = hotLayout(board);
  const HUD_X = 27;

  ctx.font = "700 18px JetBrains Mono, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = HOT_GOLD;
  ctx.fillText(`Stage ${Math.min(HOT_STAGES, state.stage + 1)}`, HUD_X, 46);
  ctx.font = "700 14px JetBrains Mono, monospace";
  ctx.fillStyle = "#E8E8ED";
  ctx.fillText(`Max ${board.hopBudget} hops`, HUD_X + 112, 46);
  for (let life = 0; life < START_LIVES; life++) {
    ctx.globalAlpha = life < state.lives ? 1 : 0.2;
    ctx.beginPath();
    ctx.arc(HOT_WORLD_W - HUD_X - 6 - life * 22, 40, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const running = state.phase !== 0;
  const center = (cell: number) => ({
    x: BOARD_X + (cell % HOT_COLS) * TILE + TILE / 2,
    y: BOARD_Y + Math.trunc(cell / HOT_COLS) * TILE + TILE / 2,
  });
  const lastHop = new Map<number, number>();
  state.route.forEach((cell, i) => { if (i > 0) lastHop.set(cell, i); });

  for (let cell = 0; cell < HOT_COLS * board.rows; cell++) {
    if (colOf(cell) >= board.cols) continue;
    const x = BOARD_X + (cell % HOT_COLS) * TILE;
    const y = BOARD_Y + Math.trunc(cell / HOT_COLS) * TILE;
    const number = board.numbers[cell]!;
    const forever = number === HOT_FOREVER;
    const left = running ? number - state.hop : number;
    const fallen = !forever && !board.missing[cell] && running && left < 0;
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 4, TILE - 8, TILE - 8, 7);
    if (board.missing[cell] || fallen) {
      ctx.fillStyle = "#0B0B11";
      ctx.fill();
      if (fallen) {
        ctx.strokeStyle = HOT_RED;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const u = TILE / 56;
        ctx.moveTo(x + 12 * u, y + 12 * u); ctx.lineTo(x + 30 * u, y + 29 * u); ctx.lineTo(x + 22 * u, y + 45 * u);
        ctx.moveTo(x + 30 * u, y + 29 * u); ctx.lineTo(x + 44 * u, y + 18 * u);
        ctx.stroke();
      }
      continue;
    }
    ctx.fillStyle = cell === board.exit ? HOT_GOLD : "#1A1A24";
    ctx.fill();
    if (cell === board.exit) {
      ctx.strokeStyle = HOT_GOLD;
      ctx.globalAlpha = 0.45 + 0.3 * Math.sin(state.tick / 8);
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (cell === board.exit) {
      ctx.fillStyle = HOT_BG;
      ctx.font = "700 14px JetBrains Mono, monospace";
      ctx.fillText("EXIT", x + TILE / 2, y + TILE / 2);
    } else if (cell === board.start) {
      ctx.fillStyle = "#8A8A99";
      ctx.font = "700 11px JetBrains Mono, monospace";
      ctx.fillText("START", x + TILE / 2, y + TILE - 12);
    } else {
      ctx.fillStyle = left <= 1 ? HOT_RED : left <= 2 ? HOT_ORANGE : "#E8E8ED";
      ctx.font = `700 ${Math.round(TILE * 0.36)}px JetBrains Mono, monospace`;
      ctx.fillText(String(Math.max(0, left)), x + TILE / 2, y + TILE / 2);
    }
  }

  // Route: gold line with hop numbers.
  if (state.route.length > 1) {
    ctx.strokeStyle = HOT_GOLD;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    state.route.forEach((cell, i) => {
      const p = center(cell);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = "700 11px JetBrains Mono, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const [cell, hop] of lastHop) {
      const x = BOARD_X + (cell % HOT_COLS) * TILE + 12;
      const y = BOARD_Y + Math.trunc(cell / HOT_COLS) * TILE + 12;
      ctx.fillStyle = HOT_GOLD;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = HOT_BG;
      ctx.fillText(String(hop), x, y + 0.5);
    }
  }

  // Figure.
  const at = state.route[Math.min(state.hop, state.route.length - 1)]!;
  const next = state.phase === 1 ? state.route[state.hop + 1] : undefined;
  const p = center(at);
  let fx = p.x;
  let fy = p.y;
  if (next !== undefined) {
    const q = center(next);
    const f = Math.max(0, Math.min(1, 1 - state.pause / 8));
    fx += (q.x - p.x) * f;
    fy += (q.y - p.y) * f - Math.sin(f * Math.PI) * 10;
  }
  if (state.phase === 2) {
    const f = 1 - state.pause / FALL_PAUSE;
    ctx.globalAlpha = Math.max(0, 1 - f);
    fy += f * 18;
  }
  ctx.fillStyle = state.phase === 2 ? HOT_RED : HOT_GOLD;
  ctx.beginPath();
  ctx.roundRect(fx - 9, fy - 14, 18, 28, 9);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Buttons.
  const canGo = state.phase === 0 && state.route.length > 1 && state.route.length - 1 <= board.hopBudget && state.route[state.route.length - 1] === board.exit;
  ctx.lineWidth = 2;
  const canUndo = state.phase === 0 && state.route.length > 1;
  ctx.beginPath();
  ctx.roundRect(CLEAR_X0, UNDO_Y, GO_X1 - CLEAR_X0, UNDO_H, 12);
  ctx.fillStyle = "#15151F";
  ctx.fill();
  ctx.strokeStyle = canUndo ? "#5A5A66" : "#2A2A33";
  ctx.stroke();
  ctx.font = "800 16px JetBrains Mono, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = canUndo ? "#E8E8ED" : "#55555F";
  ctx.fillText("UNDO", (CLEAR_X0 + GO_X1) / 2, UNDO_Y + UNDO_H / 2);
  ctx.beginPath();
  ctx.roundRect(CLEAR_X0, BTN_Y, CLEAR_X1 - CLEAR_X0, BTN_H, 12);
  ctx.fillStyle = "#15151F";
  ctx.fill();
  ctx.strokeStyle = state.phase === 0 ? "#5A5A66" : "#2A2A33";
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(GO_X0, BTN_Y, GO_X1 - GO_X0, BTN_H, 12);
  ctx.fillStyle = canGo ? HOT_GOLD : "#15151F";
  ctx.fill();
  ctx.strokeStyle = canGo ? HOT_GOLD : "#2A2A33";
  ctx.stroke();
  ctx.font = "800 20px JetBrains Mono, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = state.phase === 0 ? "#E8E8ED" : "#55555F";
  ctx.fillText("CLEAR", (CLEAR_X0 + CLEAR_X1) / 2, BTN_Y + BTN_H / 2);
  ctx.fillStyle = canGo ? HOT_BG : "#55555F";
  ctx.fillText("GO", (GO_X0 + GO_X1) / 2, BTN_Y + BTN_H / 2);
  ctx.restore();
}

export const hotFloorGame: ArcadeGame<HotFloorState, ArcadeInputEvent | null> = {
  key: "hotfloor", runTicks: HOT_RUN_TICKS, init, step, isOver, score, draw, inputRanges: HOT_INPUT_RANGES,
};
