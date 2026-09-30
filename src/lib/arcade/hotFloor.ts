/**
 * Hot Floor — ten deterministic route-planning stages. Each 6×8 board has a
 * verified route from its bottom-row start to its top-row exit. Tiles disappear
 * at seeded deadlines; three failed routes end the run.
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
export const HOT_INPUT_SWIPE = 4;
export const HOT_LEFT = 0;
export const HOT_RIGHT = 1;
export const HOT_DOWN = 2;
export const HOT_UP = 3;
export const HOT_SWIPE_PX = 24;
export const HOT_COLS = 6;
export const HOT_ROWS = 8;
export const HOT_STAGES = 10;
const HOP_TICKS = 6;
const START_LIVES = 3;
const NEVER = 1 << 30;

export const HOT_INPUT_RANGES: readonly InputRange[] = [inputRange(HOT_INPUT_SWIPE, [0, 3])];

export interface HotFloorStage {
  start: number;
  exit: number;
  missing: number[];
  /** Tile lifetime in ticks from the start of this attempt. */
  deadlines: number[];
  /** One stored route proven by the time-expanded search. */
  route: number[];
  /** A shorter-looking upward route which cannot reach the exit in time. */
  decoy: number[];
  fingerprint: number;
}

function seededStageSeed(seed: number, stage: number, attempt: number): number {
  return (seed ^ Math.imul(stage + 1, 0x45d9f3b) ^ Math.imul(attempt + 1, 0x27d4eb2d)) | 0;
}

function neighbours(cell: number): number[] {
  const row = Math.trunc(cell / HOT_COLS);
  const col = cell % HOT_COLS;
  const out: number[] = [];
  if (col > 0) out.push(cell - 1);
  if (col + 1 < HOT_COLS) out.push(cell + 1);
  if (row > 0) out.push(cell - HOT_COLS);
  if (row + 1 < HOT_ROWS) out.push(cell + HOT_COLS);
  return out;
}

/** Verify a board with a (tile,tick) search; waiting is legal while a tile lives. */
export function hotfloorStageRoute(stage: HotFloorStage): number[] | null {
  const parent = new Map<string, string>();
  const queue: { cell: number; tick: number }[] = [{ cell: stage.start, tick: 0 }];
  const seen = new Set<string>([`0:${stage.start}`]);
  for (let q = 0; q < queue.length; q++) {
    const cur = queue[q]!;
    if (cur.cell === stage.exit) {
      const route: number[] = [];
      let key = `${cur.tick}:${cur.cell}`;
      for (;;) {
        route.push(Number(key.split(":")[1]));
        const prev = parent.get(key);
        if (!prev) break;
        key = prev;
      }
      return route.reverse().filter((cell, index, all) => index === 0 || cell !== all[index - 1]);
    }
    const nextTick = cur.tick + HOP_TICKS;
    for (const cell of neighbours(cur.cell)) {
      if (stage.missing[cell] || stage.deadlines[cell]! <= nextTick) continue;
      const key = `${nextTick}:${cell}`;
      if (seen.has(key)) continue;
      seen.add(key);
      parent.set(key, `${cur.tick}:${cur.cell}`);
      queue.push({ cell, tick: nextTick });
    }
    // Waiting is included so the verifier matches the live simulation exactly.
    if (stage.deadlines[cur.cell]! > cur.tick + 1) {
      const key = `${cur.tick + 1}:${cur.cell}`;
      if (!seen.has(key) && cur.tick < 20 * TICKS_PER_SECOND) {
        seen.add(key);
        parent.set(key, `${cur.tick}:${cur.cell}`);
        queue.push({ cell: cur.cell, tick: cur.tick + 1 });
      }
    }
  }
  return null;
}

function pathFromColumns(columns: number[]): number[] {
  const path = [(HOT_ROWS - 1) * HOT_COLS + columns[0]!];
  let col = columns[0]!;
  for (let row = HOT_ROWS - 2; row >= 0; row--) {
    const target = columns[HOT_ROWS - 1 - row]!;
    while (col !== target) {
      col += target > col ? 1 : -1;
      path.push((row + 1) * HOT_COLS + col);
    }
    path.push(row * HOT_COLS + col);
  }
  return path;
}

export function buildHotFloorStage(seed: number, stageIndex: number, attempt = 0): HotFloorStage {
  let rng = seededStageSeed(seed, stageIndex, attempt);
  const draw = (bound: number) => {
    const result = rngBelow(rng, bound);
    rng = result.state;
    return result.value;
  };
  const startCol = draw(HOT_COLS);
  const columns = [startCol];
  for (let row = 1; row < HOT_ROWS; row++) {
    const previous = columns[row - 1]!;
    const options = [previous];
    if (previous > 0) options.push(previous - 1);
    if (previous + 1 < HOT_COLS) options.push(previous + 1);
    columns.push(options[draw(options.length)]!);
  }
  const route = pathFromColumns(columns);
  const routeSet = new Set(route);
  const start = route[0]!;
  const exit = route[route.length - 1]!;
  const missing = new Array<number>(HOT_COLS * HOT_ROWS).fill(0);
  const missingCount = Math.min(10, 2 + Math.floor((stageIndex * 8) / 7));
  const candidates = Array.from({ length: HOT_COLS * HOT_ROWS }, (_, cell) => cell)
    .filter((cell) => !routeSet.has(cell));
  for (let n = 0; n < missingCount && candidates.length; n++) {
    const at = draw(candidates.length);
    missing[candidates.splice(at, 1)[0]!] = 1;
  }

  const minSeconds = stageIndex >= 7 ? 2 : Math.max(3, 8 - stageIndex);
  const maxSeconds = stageIndex >= 7 ? 6 : Math.max(minSeconds + 3, 15 - stageIndex);
  const deadlines = Array.from({ length: HOT_COLS * HOT_ROWS }, (_, cell) =>
    missing[cell] ? 0 : (minSeconds + draw(maxSeconds - minSeconds + 1)) * TICKS_PER_SECOND,
  );
  // Every safe-route tile retains at least a full second after its earliest arrival.
  for (let i = 0; i < route.length; i++) {
    const cell = route[i]!;
    deadlines[cell] = Math.max(deadlines[cell]!, i * HOP_TICKS + TICKS_PER_SECOND);
  }

  // The direct upward line looks shorter, but one late tile expires just before arrival.
  const decoyCol = start % HOT_COLS;
  const decoy = Array.from({ length: HOT_ROWS }, (_, i) => (HOT_ROWS - 1 - i) * HOT_COLS + decoyCol);
  for (const cell of decoy) if (!routeSet.has(cell)) missing[cell] = 0;
  const trapIndex = Math.max(2, decoy.findIndex((cell) => !routeSet.has(cell)));
  const trap = decoy[Math.min(decoy.length - 2, trapIndex)]!;
  if (!routeSet.has(trap)) deadlines[trap] = Math.max(1, trapIndex * HOP_TICKS - 1);

  let fingerprint = 0x811c9dc5;
  for (const value of [start, exit, ...missing, ...deadlines]) {
    fingerprint ^= value | 0;
    fingerprint = Math.imul(fingerprint, 0x01000193) >>> 0;
  }
  const generated = { start, exit, missing, deadlines, route, decoy, fingerprint };
  // The constructed route is authoritative, but retain the independent search proof.
  if (!hotfloorStageRoute(generated)) throw new Error("Hot Floor generated an unreachable stage");
  return generated;
}

export function hotfloorCourseSurvivable(seed: number): boolean {
  return Array.from({ length: HOT_STAGES }, (_, stage) =>
    hotfloorStageRoute(buildHotFloorStage(seed, stage)) !== null).every(Boolean);
}

/** Stages are built directly from a guaranteed route, so no whole-course reroll is needed. */
export function hotfloorCourseRerolls(_seed: number): number { return 0; }

export interface HotFloorState {
  tick: number;
  rng: number;
  seed: number;
  stage: number;
  attempts: number;
  lives: number;
  cell: number;
  fromCell: number;
  hopT: number;
  queued: number;
  stageTick: number;
  ended: number;
  endedTick: number;
  board: HotFloorStage;
}

function init(seed: number): HotFloorState {
  const board = buildHotFloorStage(seed, 0, 0);
  return {
    tick: 0, rng: board.fingerprint | 0, seed: seed | 0, stage: 0, attempts: 0,
    lives: START_LIVES, cell: board.start, fromCell: board.start, hopT: 0,
    queued: -1, stageTick: 0, ended: 0, endedTick: 0, board,
  };
}

function isOver(state: HotFloorState): boolean { return state.ended !== 0; }

function loseLife(s: HotFloorState): void {
  s.lives -= 1;
  if (s.lives <= 0) {
    s.ended = 2;
    s.endedTick = s.tick;
    return;
  }
  s.attempts += 1;
  s.board = buildHotFloorStage(s.seed, s.stage, s.attempts);
  s.rng = s.board.fingerprint | 0;
  s.cell = s.board.start;
  s.fromCell = s.board.start;
  s.hopT = 0;
  s.queued = -1;
  s.stageTick = 0;
}

function startHop(s: HotFloorState, dir: number): void {
  const row = Math.trunc(s.cell / HOT_COLS);
  const col = s.cell % HOT_COLS;
  const dc = dir === HOT_LEFT ? -1 : dir === HOT_RIGHT ? 1 : 0;
  const dr = dir === HOT_UP ? -1 : dir === HOT_DOWN ? 1 : 0;
  const nr = row + dr;
  const nc = col + dc;
  if (nr < 0 || nr >= HOT_ROWS || nc < 0 || nc >= HOT_COLS) return loseLife(s);
  s.fromCell = s.cell;
  s.cell = nr * HOT_COLS + nc;
  s.hopT = HOP_TICKS;
}

function completeStage(s: HotFloorState): void {
  s.stage += 1;
  s.attempts = 0;
  if (s.stage >= HOT_STAGES) {
    s.ended = 1;
    s.endedTick = s.tick;
    return;
  }
  s.board = buildHotFloorStage(s.seed, s.stage, 0);
  s.rng = s.board.fingerprint | 0;
  s.cell = s.board.start;
  s.fromCell = s.board.start;
  s.hopT = 0;
  s.queued = -1;
  s.stageTick = 0;
}

function step(state: HotFloorState, input: ArcadeInputEvent | null): HotFloorState {
  if (isOver(state)) return state;
  const s: HotFloorState = { ...state, tick: state.tick + 1, stageTick: state.stageTick + 1 };
  const swipe = input?.k === HOT_INPUT_SWIPE ? clampInt(input.a, 0, 3) : -1;
  if (swipe >= 0) {
    if (s.hopT > 0) s.queued = swipe;
    else startHop(s, swipe);
  }
  if (s.ended) return s;
  if (s.hopT > 0) {
    s.hopT -= 1;
    if (s.hopT === 0) {
      if (s.board.missing[s.cell] || s.board.deadlines[s.cell]! <= s.stageTick) {
        loseLife(s);
      } else if (s.cell === s.board.exit) {
        completeStage(s);
      } else if (s.queued >= 0) {
        const queued = s.queued;
        s.queued = -1;
        startHop(s, queued);
      }
    }
  } else if (s.board.deadlines[s.cell]! <= s.stageTick) {
    loseLife(s);
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
  "tick", "stage", "attempts", "lives", "cell", "hopT", "queued", "stageTick", "ended", "rng", "checksum",
] as const;

export interface HotFloorCheckpoint {
  tick: number; stage: number; attempts: number; lives: number; cell: number;
  hopT: number; queued: number; stageTick: number; ended: number; rng: number; checksum: number;
}

export function hotfloorCheckpoint(state: HotFloorState): HotFloorCheckpoint {
  const snap = {
    tick: state.tick, stage: state.stage, attempts: state.attempts, lives: state.lives,
    cell: state.cell, hopT: state.hopT, queued: state.queued, stageTick: state.stageTick,
    ended: state.ended, rng: state.rng | 0,
  };
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snap)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snap, checksum };
}

export const HOT_BG = "#07070D";
export const HOT_GOLD = "#F5B82E";
export const HOT_TEAL = "#2EC4B6";
export const HOT_RED = "#FF4D5E";
const HOT_ORANGE = "#F28C28";
const TILE = 56;
const BOARD_X = 27;
const BOARD_Y = 92;

function draw(ctx: CanvasRenderingContext2D, state: HotFloorState, size: CanvasSize): void {
  const scale = Math.min(size.width / HOT_WORLD_W, size.height / HOT_WORLD_H);
  const ox = (size.width - HOT_WORLD_W * scale) / 2;
  const oy = (size.height - HOT_WORLD_H * scale) / 2;
  ctx.save();
  ctx.fillStyle = HOT_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  ctx.font = "700 18px JetBrains Mono, monospace";
  ctx.textAlign = "left";
  ctx.fillStyle = HOT_GOLD;
  ctx.fillText(`Stage ${Math.min(HOT_STAGES, state.stage + 1)}`, BOARD_X, 48);
  for (let life = 0; life < START_LIVES; life++) {
    ctx.globalAlpha = life < state.lives ? 1 : 0.2;
    ctx.beginPath();
    ctx.arc(HOT_WORLD_W - BOARD_X - life * 22, 42, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (let cell = 0; cell < HOT_COLS * HOT_ROWS; cell++) {
    const row = Math.trunc(cell / HOT_COLS);
    const col = cell % HOT_COLS;
    const x = BOARD_X + col * TILE;
    const y = BOARD_Y + row * TILE;
    if (state.board.missing[cell]) {
      ctx.fillStyle = "#0D0D13";
      ctx.beginPath();
      ctx.roundRect(x + 4, y + 4, TILE - 8, TILE - 8, 7);
      ctx.fill();
      continue;
    }
    const left = state.board.deadlines[cell]! - state.stageTick;
    const fallen = left <= 0;
    ctx.fillStyle = fallen ? "#09090E" : cell === state.board.exit ? HOT_GOLD : "#171720";
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 4, TILE - 8, TILE - 8, 7);
    ctx.fill();
    if (cell === state.board.exit && !fallen) {
      ctx.strokeStyle = HOT_GOLD;
      ctx.globalAlpha = 0.45 + 0.25 * Math.sin(state.tick / 8);
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (fallen) {
      ctx.strokeStyle = HOT_RED;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 12, y + 12); ctx.lineTo(x + 30, y + 29); ctx.lineTo(x + 22, y + 45);
      ctx.moveTo(x + 30, y + 29); ctx.lineTo(x + 44, y + 18);
      ctx.stroke();
      continue;
    }
    const seconds = Math.max(1, Math.ceil(left / TICKS_PER_SECOND));
    ctx.fillStyle = left < TICKS_PER_SECOND ? HOT_RED : left < 3 * TICKS_PER_SECOND ? HOT_ORANGE : cell === state.board.exit ? HOT_BG : "#E8E8ED";
    ctx.font = "700 18px JetBrains Mono, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(cell === state.board.exit ? "EXIT" : String(seconds), x + TILE / 2, y + TILE / 2);
  }

  const toPoint = (cell: number) => ({
    x: BOARD_X + (cell % HOT_COLS) * TILE + TILE / 2,
    y: BOARD_Y + Math.trunc(cell / HOT_COLS) * TILE + TILE / 2,
  });
  const to = toPoint(state.cell);
  const from = toPoint(state.fromCell);
  const f = state.hopT > 0 ? state.hopT / HOP_TICKS : 0;
  const x = to.x + (from.x - to.x) * f;
  const y = to.y + (from.y - to.y) * f - Math.sin(f * Math.PI) * 8;
  ctx.fillStyle = state.ended === 2 ? HOT_RED : HOT_GOLD;
  ctx.beginPath();
  ctx.roundRect(x - 9, y - 14, 18, 28, 9);
  ctx.fill();
  ctx.restore();
}

export const hotFloorGame: ArcadeGame<HotFloorState, ArcadeInputEvent | null> = {
  key: "hotfloor", runTicks: HOT_RUN_TICKS, init, step, isOver, score, draw, inputRanges: HOT_INPUT_RANGES,
};