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
export const HOT_RUN_TICKS = 90 * TICKS_PER_SECOND;
export const HOT_INPUT_TILE = 11;
export const HOT_INPUT_CLEAR = 12;
export const HOT_INPUT_GO = 13;
export const HOT_COLS = 6;
export const HOT_MAX_ROWS = 8;
export const HOT_STAGES = 10;
export const HOT_HOP_TICKS = 20;
const FALL_PAUSE = 40;
const EXIT_PAUSE = 30;
const START_LIVES = 3;
const MAX_ROUTE = 48;
/** Number stored for START/EXIT: they never fall. */
export const HOT_FOREVER = 99;

export const HOT_INPUT_RANGES: readonly InputRange[] = [
  inputRange(HOT_INPUT_TILE, [0, HOT_COLS * HOT_MAX_ROWS - 1]),
  inputRange(HOT_INPUT_CLEAR),
  inputRange(HOT_INPUT_GO),
];

export interface HotFloorStage {
  rows: number;
  start: number;
  exit: number;
  missing: number[];
  /** Hops each tile survives after GO (HOT_FOREVER on start/exit, 0 on missing). */
  numbers: number[];
  /** The stored route, verified to succeed. */
  route: number[];
  /** Maximum hops accepted by GO. */
  hopBudget: number;
  /** The first of at least two plausible routes that fail. */
  decoy: number[];
  decoys: number[][];
  fingerprint: number;
}

export function hotNeighbours(cell: number, rows: number): number[] {
  const row = Math.trunc(cell / HOT_COLS);
  const col = cell % HOT_COLS;
  const out: number[] = [];
  if (col > 0) out.push(cell - 1);
  if (col + 1 < HOT_COLS) out.push(cell + 1);
  if (row > 0) out.push(cell - HOT_COLS);
  if (row + 1 < rows) out.push(cell + HOT_COLS);
  return out;
}

function adjacent(a: number, b: number): boolean {
  const d = Math.abs(a - b);
  return (d === 1 && Math.trunc(a / HOT_COLS) === Math.trunc(b / HOT_COLS)) || d === HOT_COLS;
}

/** Hop index at which a route first fails, or -1 if it reaches the exit. */
export function hotRouteFailure(stage: HotFloorStage, route: readonly number[]): number {
  if (route[0] !== stage.start) return 0;
  for (let hop = 1; hop < route.length; hop++) {
    const cell = route[hop]!;
    if (!adjacent(route[hop - 1]!, cell)) return hop;
    if (stage.missing[cell] || stage.numbers[cell]! < hop) return hop;
    if (cell === stage.exit) return hop === route.length - 1 ? -1 : hop;
  }
  return route.length;
}

/** Breadth-first search over (tile, hop): the shortest surviving route within budget, if any. */
export function hotfloorStageRoute(stage: HotFloorStage): number[] | null {
  const key = (cell: number, hop: number) => hop * 64 + cell;
  const parent = new Map<number, number>();
  let layer = [stage.start];
  parent.set(key(stage.start, 0), -1);
  for (let hop = 1; hop <= stage.hopBudget && layer.length; hop++) {
    const next: number[] = [];
    for (const from of layer) {
      for (const cell of hotNeighbours(from, stage.rows)) {
        if (stage.missing[cell] || stage.numbers[cell]! < hop) continue;
        const k = key(cell, hop);
        if (parent.has(k)) continue;
        parent.set(k, key(from, hop - 1));
        if (cell === stage.exit) {
          const route: number[] = [];
          for (let at = k; at >= 0; at = parent.get(at)!) route.push(at % 64);
          return route.reverse();
        }
        next.push(cell);
      }
    }
    layer = next;
  }
  return null;
}

function stageSeed(seed: number, stage: number, attempt: number): number {
  return (seed ^ Math.imul(stage + 1, 0x45d9f3b) ^ Math.imul(attempt + 1, 0x27d4eb2d)) | 0;
}

export function hotRowsFor(stageIndex: number): number {
  return stageIndex < 3 ? 6 : stageIndex < 7 ? 7 : 8;
}

/** A monotone route whose horizontal steps happen on the requested rows. */
function routedPath(rows: number, startCol: number, exitCol: number, horizontalRows: readonly number[]): number[] {
  const route = [(rows - 1) * HOT_COLS + startCol];
  let col = startCol;
  let horizontal = 0;
  for (let row = rows - 1; row > 0; row--) {
    while (horizontalRows[horizontal] === row && col !== exitCol) {
      col += exitCol > col ? 1 : -1;
      route.push(row * HOT_COLS + col);
      horizontal += 1;
    }
    route.push((row - 1) * HOT_COLS + col);
  }
  while (col !== exitCol) {
    col += exitCol > col ? 1 : -1;
    route.push(col);
  }
  return route;
}

function tryStage(seed: number, stageIndex: number, attempt: number): HotFloorStage | null {
  let rng = stageSeed(seed, stageIndex, attempt);
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const rows = hotRowsFor(stageIndex);
  const total = HOT_COLS * rows;
  const left = draw(2) === 0;
  const startCol = left ? draw(HOT_COLS - 2) : 2 + draw(HOT_COLS - 2);
  const exitCol = startCol + (left ? 2 : -2);
  const middleA = Math.max(2, Math.trunc(rows / 2));
  const middleB = Math.max(1, middleA - 1);
  const route = routedPath(rows, startCol, exitCol, [middleA, middleB]);
  const start = route[0]!;
  const exit = route[route.length - 1]!;
  const decoys = [
    routedPath(rows, startCol, exitCol, [rows - 1, rows - 1]),
    routedPath(rows, startCol, exitCol, [1, 1]),
  ];
  const decoy = decoys[0]!;
  const hopBudget = route.length - 1 + (stageIndex < 3 ? 1 : 0);
  const routeIndex = new Map<number, number>();
  route.forEach((cell, i) => routeIndex.set(cell, i));
  const numbers = new Array<number>(total).fill(0);
  const missing = new Array<number>(total).fill(0);
  // Stored route: at least half are exact, and all values stay in 1–9.
  for (let i = 1; i < route.length - 1; i++) {
    const exact = i % 2 === 1 || draw(4) !== 0;
    numbers[route[i]!] = Math.min(9, i + (exact ? 0 : 1));
  }
  // Off-route tiles: low values near the exit; high values mainly lure away from it.
  for (let cell = 0; cell < total; cell++) {
    if (routeIndex.has(cell)) continue;
    const fromExit = Math.abs(Math.trunc(cell / HOT_COLS)) + Math.abs((cell % HOT_COLS) - exitCol);
    numbers[cell] = fromExit >= rows - 2 ? 7 + draw(3) : 1 + draw(6);
  }
  // Each plausible alternative gets a distinct off-route trap one hop too early.
  for (const candidate of decoys) {
    let trapAt = -1;
    for (let i = candidate.length - 2; i >= 2; i--) {
      if (!routeIndex.has(candidate[i]!)) { trapAt = i; break; }
    }
    if (trapAt < 0) return null;
    for (let i = 1; i < candidate.length - 1; i++) {
      const cell = candidate[i]!;
      if (routeIndex.has(cell)) continue;
      numbers[cell] = i === trapAt ? Math.max(1, i - 1) : Math.min(9, Math.max(numbers[cell]!, i));
    }
  }
  numbers[start] = HOT_FOREVER;
  numbers[exit] = HOT_FOREVER;

  const missingCount = stageIndex < 2 ? 2 + stageIndex : Math.min(12, 6 + stageIndex - 2);
  const protectedCells = new Set<number>([...route, ...decoys.flat()]);
  const candidates: number[] = [];
  for (let cell = 0; cell < total; cell++) if (!protectedCells.has(cell)) candidates.push(cell);
  for (let n = 0; n < missingCount && candidates.length; n++) {
    const cell = candidates.splice(draw(candidates.length), 1)[0]!;
    missing[cell] = 1;
    numbers[cell] = 0;
  }

  let fingerprint = 0x811c9dc5;
  for (const value of [rows, start, exit, ...missing, ...numbers]) {
    fingerprint ^= value | 0;
    fingerprint = Math.imul(fingerprint, 0x01000193) >>> 0;
  }
  const stage: HotFloorStage = { rows, start, exit, missing, numbers, route, hopBudget, decoy, decoys, fingerprint };
  if (hotRouteFailure(stage, route) !== -1) return null;
  if (decoys.filter((candidate) => hotRouteFailure(stage, candidate) > 0).length < 2) return null;
  if (!hotfloorStageRoute(stage)) return null;
  return stage;
}

const stageCache = new Map<string, HotFloorStage>();

export function buildHotFloorStage(seed: number, stageIndex: number): HotFloorStage {
  const id = `${seed | 0}:${stageIndex}`;
  const hit = stageCache.get(id);
  if (hit) return hit;
  for (let attempt = 0; attempt < 400; attempt++) {
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
  } else if (input.k === HOT_INPUT_GO) {
    if (last === s.board.exit && s.route.length > 1 && s.route.length - 1 <= s.board.hopBudget) {
      s.phase = 1;
      s.hop = 0;
      s.pause = HOT_HOP_TICKS;
    }
  } else if (input.k === HOT_INPUT_TILE) {
    const cell = clampInt(input.a, 0, HOT_COLS * HOT_MAX_ROWS - 1);
    if (cell >= HOT_COLS * s.board.rows) return;
    if (cell === last && s.route.length > 1) s.route = s.route.slice(0, -1);
    else if (last !== s.board.exit && adjacent(last, cell) && !s.board.missing[cell] && s.route.length <= s.board.hopBudget)
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
const TILE = 56;
const BOARD_X = 27;
const BOARD_Y = 80;
const BTN_Y = 540;
const BTN_H = 56;
const CLEAR_X0 = 27;
const CLEAR_X1 = 183;
const GO_X0 = 207;
const GO_X1 = 363;

/** World point to the input it means (tile, CLEAR or GO), or null. */
export function hotfloorHit(x: number, y: number): { k: number; a: number } | null {
  if (y >= BTN_Y && y <= BTN_Y + BTN_H) {
    if (x >= CLEAR_X0 && x <= CLEAR_X1) return { k: HOT_INPUT_CLEAR, a: 0 };
    if (x >= GO_X0 && x <= GO_X1) return { k: HOT_INPUT_GO, a: 0 };
    return null;
  }
  const col = Math.floor((x - BOARD_X) / TILE);
  const row = Math.floor((y - BOARD_Y) / TILE);
  if (col < 0 || col >= HOT_COLS || row < 0 || row >= HOT_MAX_ROWS) return null;
  return { k: HOT_INPUT_TILE, a: row * HOT_COLS + col };
}

function draw(ctx: CanvasRenderingContext2D, state: HotFloorState, size: CanvasSize): void {
  const scale = Math.min(size.width / HOT_WORLD_W, size.height / HOT_WORLD_H);
  ctx.save();
  ctx.fillStyle = HOT_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate((size.width - HOT_WORLD_W * scale) / 2, (size.height - HOT_WORLD_H * scale) / 2);
  ctx.scale(scale, scale);
  const board = state.board;

  ctx.font = "700 18px JetBrains Mono, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = HOT_GOLD;
  ctx.fillText(`Stage ${Math.min(HOT_STAGES, state.stage + 1)}`, BOARD_X, 46);
  ctx.font = "700 14px JetBrains Mono, monospace";
  ctx.fillStyle = "#E8E8ED";
  ctx.fillText(`Max ${board.hopBudget} hops`, BOARD_X + 112, 46);
  for (let life = 0; life < START_LIVES; life++) {
    ctx.globalAlpha = life < state.lives ? 1 : 0.2;
    ctx.beginPath();
    ctx.arc(HOT_WORLD_W - BOARD_X - 6 - life * 22, 40, 6, 0, Math.PI * 2);
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
        ctx.moveTo(x + 12, y + 12); ctx.lineTo(x + 30, y + 29); ctx.lineTo(x + 22, y + 45);
        ctx.moveTo(x + 30, y + 29); ctx.lineTo(x + 44, y + 18);
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
      ctx.font = "700 20px JetBrains Mono, monospace";
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
      const x = BOARD_X + (cell % HOT_COLS) * TILE + 13;
      const y = BOARD_Y + Math.trunc(cell / HOT_COLS) * TILE + 13;
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
