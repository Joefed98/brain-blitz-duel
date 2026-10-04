/**
 * Tilt — a rotating disc maze. Dragging (k = 7, a = x, c = touch id) turns the
 * maze 0.5° per px; gravity always points down the screen, so in the maze's own
 * frame it is rotated by the maze angle. The ball moves on the maze's square
 * cell grid with per-axis wall stops (integer maths). Out through the exit gap
 * brings the next, larger maze; a red pit ends the run.
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
import { icos, isin, TRIG_ONE } from "./trig";

/* ============================== Constants ============================== */

const FP = 256;
/** Everything is 1.2× the original layout; the world is sized so the disc fills the width with 16 px gutters. */
export const TILT_WORLD_W = 440;
export const TILT_WORLD_H = 470;
export const TILT_RUN_TICKS = 90 * TICKS_PER_SECOND;
export const TILT_INPUT_DRAG = 7;
const CX = 220;
const CY = 254;
export const TILT_DISC_R = 204;
const INNER = 360;
const INSIDE_R = 180;
/** 0.5° in angle units (65536 per turn). */
const ANG_PER_PX = 91;
const GRAVITY = 58;
const SPEED_CAP = Math.trunc(3.6 * FP);
export const TILT_MAX_MAZES = 10;
/** Grid sizes per level: about 1.5× the wall segments of the previous layout (OLD_SIZES). */
const SIZES = [9, 11, 11, 13, 13, 16, 16, 16, 16, 16];
const OLD_SIZES = [7, 9, 9, 11, 11, 13, 13, 13, 13, 13];
const MAZE_POINTS = 30;

export const TILT_INPUT_RANGES: readonly InputRange[] = [
  inputRange(TILT_INPUT_DRAG, [0, TILT_WORLD_W], [0, 0], [0, 255]),
];

/* ================================= Mazes ================================ */

/** Directions: 0 right, 1 down, 2 left, 3 up. */
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

export interface Maze {
  n: number;
  /** Cell size in FP. */
  cs: number;
  inside: number[];
  /** Wall on the right of / below each cell. */
  wallR: number[];
  wallD: number[];
  pits: number[];
  start: number;
  exit: number;
  exitDir: number;
  /** Ball radius in FP: 70% of the previous layout's ball. */
  br: number;
}

function buildMaze(level: number, draw: (n: number) => number): Maze {
  const n = SIZES[Math.min(level, SIZES.length - 1)]!;
  const csPx = Math.trunc(INNER / n);
  const cs = csPx * FP;
  const half = Math.trunc((n * csPx) / 2);
  const lim = INSIDE_R - Math.trunc(csPx / 2);
  const inside: number[] = [];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = i * csPx + Math.trunc(csPx / 2) - half;
      const y = j * csPx + Math.trunc(csPx / 2) - half;
      inside.push(x * x + y * y <= lim * lim ? 1 : 0);
    }
  const wallR = new Array<number>(n * n).fill(1);
  const wallD = new Array<number>(n * n).fill(1);
  const inCell = (i: number, j: number) => i >= 0 && j >= 0 && i < n && j < n && inside[j * n + i] === 1;
  const mid = Math.trunc(n / 2);
  const start = mid * n + mid;
  // Iterative depth-first carve.
  const seen = new Array<number>(n * n).fill(0);
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const c = stack[stack.length - 1]!;
    const ci = c % n;
    const cj = Math.trunc(c / n);
    const options: number[] = [];
    for (let d = 0; d < 4; d++) {
      const ni = ci + DX[d]!;
      const nj = cj + DY[d]!;
      if (inCell(ni, nj) && !seen[nj * n + ni]) options.push(d);
    }
    if (!options.length) {
      stack.pop();
      continue;
    }
    const d = options[draw(options.length)]!;
    const nc = (cj + DY[d]!) * n + ci + DX[d]!;
    if (d === 0) wallR[c] = 0;
    else if (d === 1) wallD[c] = 0;
    else if (d === 2) wallR[nc] = 0;
    else wallD[nc] = 0;
    seen[nc] = 1;
    stack.push(nc);
  }
  // Distances and parents from the start.
  const dist = new Array<number>(n * n).fill(-1);
  const parent = new Array<number>(n * n).fill(-1);
  dist[start] = 0;
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q]!;
    for (let d = 0; d < 4; d++) {
      const nc = openNeighbour(n, inside, wallR, wallD, c, d);
      if (nc >= 0 && dist[nc]! < 0) {
        dist[nc] = dist[c]! + 1;
        parent[nc] = c;
        queue.push(nc);
      }
    }
  }
  // Rim cells with an outward side.
  const rim: { c: number; d: number }[] = [];
  for (let c = 0; c < n * n; c++) {
    if (!inside[c]) continue;
    for (let d = 0; d < 4; d++) {
      if (!inCell((c % n) + DX[d]!, Math.trunc(c / n) + DY[d]!)) {
        rim.push({ c, d });
        break;
      }
    }
  }
  let far = rim[0]!;
  for (const r of rim) if (dist[r.c]! > dist[far.c]!) far = r;
  const path = new Set<number>();
  for (let c = far.c; c >= 0; c = parent[c]!) path.add(c);
  const pits: number[] = [];
  if (level >= 1) {
    const ends: number[] = [];
    for (let c = 0; c < n * n; c++) {
      if (!inside[c] || path.has(c) || dist[c]! < 3) continue;
      let open = 0;
      for (let d = 0; d < 4; d++) if (openNeighbour(n, inside, wallR, wallD, c, d) >= 0) open += 1;
      if (open === 1) ends.push(c);
    }
    const count = Math.min(ends.length, Math.min(level, 4));
    for (let k = 0; k < count; k++) pits.push(ends.splice(draw(ends.length), 1)[0]!);
  }
  const oldCs = Math.trunc(INNER / OLD_SIZES[Math.min(level, OLD_SIZES.length - 1)]!) * FP;
  const br = Math.min(Math.trunc((oldCs * 21) / 100), Math.trunc((cs * 4) / 10));
  return { n, cs, inside, wallR, wallD, pits, start, exit: far.c, exitDir: far.d, br };
}

function openNeighbour(n: number, inside: number[], wallR: number[], wallD: number[], c: number, d: number): number {
  const i = (c % n) + DX[d]!;
  const j = Math.trunc(c / n) + DY[d]!;
  if (i < 0 || j < 0 || i >= n || j >= n) return -1;
  const nc = j * n + i;
  if (!inside[nc]) return -1;
  const wall = d === 0 ? wallR[c] : d === 1 ? wallD[c] : d === 2 ? wallR[nc] : wallD[nc];
  return wall ? -1 : nc;
}

function canPass(m: Maze, c: number, d: number): boolean {
  const i = (c % m.n) + DX[d]!;
  const j = Math.trunc(c / m.n) + DY[d]!;
  const outside = i < 0 || j < 0 || i >= m.n || j >= m.n || !m.inside[j * m.n + i];
  if (outside) return c === m.exit && d === m.exitDir;
  return openNeighbour(m.n, m.inside, m.wallR, m.wallD, c, d) >= 0;
}

/* ================================ State ================================ */

export interface TiltState {
  tick: number;
  rng: number;
  level: number;
  mazes: number;
  angle: number;
  /** Ball position in the maze frame, FP, origin at the grid's top-left. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  lastA: number;
  lastC: number;
  ended: number;
  endedTick: number;
  list: Maze[];
}

const cache = new Map<number, { list: Maze[]; rng: number }>();

function startPos(m: Maze) {
  return {
    x: (m.start % m.n) * m.cs + Math.trunc(m.cs / 2),
    y: Math.trunc(m.start / m.n) * m.cs + Math.trunc(m.cs / 2),
  };
}

function init(seed: number): TiltState {
  let built = cache.get(seed | 0);
  if (!built) {
    let rng = seed | 0;
    const draw = (bound: number) => {
      const r = rngBelow(rng, bound);
      rng = r.state;
      return r.value;
    };
    const list: Maze[] = [];
    // The former level 1 was retired; begin at its level-2 difficulty and
    // continue the same progression beyond the old tenth maze.
    for (let l = 0; l < TILT_MAX_MAZES; l++) list.push(buildMaze(l + 1, draw));
    built = { list, rng };
    if (cache.size > 16) cache.clear();
    cache.set(seed | 0, built);
  }
  const pos = startPos(built.list[0]!);
  return {
    tick: 0,
    rng: built.rng,
    level: 0,
    mazes: 0,
    angle: 0,
    x: pos.x,
    y: pos.y,
    vx: 0,
    vy: 0,
    lastA: 0,
    lastC: -1,
    ended: 0,
    endedTick: 0,
    list: built.list,
  };
}

function isOver(state: TiltState): boolean {
  return state.ended !== 0;
}

function cellOf(m: Maze, x: number, y: number): number {
  const i = Math.floor(x / m.cs);
  const j = Math.floor(y / m.cs);
  if (i < 0 || j < 0 || i >= m.n || j >= m.n) return -1;
  return m.inside[j * m.n + i] ? j * m.n + i : -1;
}

function step(state: TiltState, input: ArcadeInputEvent | null): TiltState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const s: TiltState = { ...state, tick };
  if (input !== null && input.k === TILT_INPUT_DRAG) {
    if (input.c !== s.lastC) s.lastC = input.c;
    else s.angle = (s.angle + (input.a - s.lastA) * ANG_PER_PX) & 65535;
    s.lastA = input.a;
  }
  const m = s.list[s.level]!;
  const r = m.br;
  s.vx += Math.trunc((GRAVITY * isin(s.angle)) / TRIG_ONE);
  s.vy += Math.trunc((GRAVITY * icos(s.angle)) / TRIG_ONE);
  s.vx = clampInt(s.vx - Math.trunc(s.vx / 64), -SPEED_CAP, SPEED_CAP);
  s.vy = clampInt(s.vy - Math.trunc(s.vy / 64), -SPEED_CAP, SPEED_CAP);

  // X then Y, each against the walls of the current cell.
  let c = cellOf(m, s.x, s.y);
  if (c >= 0) {
    const i = c % m.n;
    let nx = s.x + s.vx;
    if (s.vx > 0 && nx + r > (i + 1) * m.cs && !canPass(m, c, 0)) {
      nx = (i + 1) * m.cs - r;
      s.vx = 0;
    } else if (s.vx < 0 && nx - r < i * m.cs && !canPass(m, c, 2)) {
      nx = i * m.cs + r;
      s.vx = 0;
    }
    s.x = nx;
  } else s.x += s.vx;
  c = cellOf(m, s.x, s.y);
  if (c >= 0) {
    const j = Math.trunc(c / m.n);
    let ny = s.y + s.vy;
    if (s.vy > 0 && ny + r > (j + 1) * m.cs && !canPass(m, c, 1)) {
      ny = (j + 1) * m.cs - r;
      s.vy = 0;
    } else if (s.vy < 0 && ny - r < j * m.cs && !canPass(m, c, 3)) {
      ny = j * m.cs + r;
      s.vy = 0;
    }
    s.y = ny;
  } else s.y += s.vy;

  const now = cellOf(m, s.x, s.y);
  if (now < 0) {
    // Only the exit leads out of the grid.
    s.mazes += 1;
    if (s.mazes >= TILT_MAX_MAZES) {
      s.ended = 1;
      s.endedTick = tick;
      return s;
    }
    s.level += 1;
    const pos = startPos(s.list[s.level]!);
    s.x = pos.x;
    s.y = pos.y;
    s.vx = 0;
    s.vy = 0;
  } else if (m.pits.includes(now)) {
    const px = (now % m.n) * m.cs + Math.trunc(m.cs / 2);
    const py = Math.trunc(now / m.n) * m.cs + Math.trunc(m.cs / 2);
    const q = Math.trunc(m.cs / 4);
    if (Math.abs(s.x - px) < q && Math.abs(s.y - py) < q) {
      s.ended = 2;
      s.endedTick = tick;
      return s;
    }
  }
  if (tick >= TILT_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

function score(state: TiltState): number {
  return clampInt(MAZE_POINTS * state.mazes, 0, 150);
}

export function tiltExtra(s: TiltState) {
  return { mazes: s.mazes, survived: s.ended !== 2, survivedSeconds: s.tick / 60 };
}

/* ============================= Checkpoints ============================= */

export const TILT_CHECKPOINT_INTERVAL = 300;
export const TILT_CHECKPOINT_KEYS = [
  "tick",
  "level",
  "mazes",
  "angle",
  "x",
  "y",
  "vx",
  "vy",
  "ended",
  "rng",
  "checksum",
] as const;

export interface TiltCheckpoint {
  tick: number;
  level: number;
  mazes: number;
  angle: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ended: number;
  rng: number;
  checksum: number;
}

export function tiltCheckpoint(state: TiltState): TiltCheckpoint {
  const snap = {
    tick: state.tick,
    level: state.level,
    mazes: state.mazes,
    angle: state.angle,
    x: state.x,
    y: state.y,
    vx: state.vx,
    vy: state.vy,
    ended: state.ended,
    rng: state.rng | 0,
  };
  let checksum = 0x811c9dc5;
  for (const value of Object.values(snap)) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snap, checksum };
}

/* =============================== Drawing =============================== */

export const TILT_BG = "#07070D";
export const TILT_GOLD = "#F5B82E";
export const TILT_TEAL = "#2EC4B6";
export const TILT_RED = "#FF4D5E";

function edge(ctx: CanvasRenderingContext2D, m: Maze, c: number, d: number, o: number) {
  const cs = m.cs / FP;
  const x = (c % m.n) * cs - o;
  const y = Math.trunc(c / m.n) * cs - o;
  if (d === 0) {
    ctx.moveTo(x + cs, y);
    ctx.lineTo(x + cs, y + cs);
  } else if (d === 1) {
    ctx.moveTo(x, y + cs);
    ctx.lineTo(x + cs, y + cs);
  } else if (d === 2) {
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + cs);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + cs, y);
  }
}

function draw(ctx: CanvasRenderingContext2D, state: TiltState, size: CanvasSize): void {
  const scale = Math.min(size.width / TILT_WORLD_W, size.height / TILT_WORLD_H);
  const ox = (size.width - TILT_WORLD_W * scale) / 2;
  const oy = (size.height - TILT_WORLD_H * scale) / 2;
  ctx.save();
  ctx.fillStyle = TILT_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 16px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Completed ${state.mazes}`, 14, 26);

  const m = state.list[Math.min(state.level, state.list.length - 1)]!;
  const cs = m.cs / FP;
  const o = (m.n * cs) / 2;
  ctx.translate(CX, CY);
  // Screen = rotate(angle) · maze; the sim turns gravity into the maze frame by the same angle.
  ctx.beginPath();
  ctx.arc(0, 0, TILT_DISC_R + 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.rotate((state.angle / 65536) * Math.PI * 2);
  ctx.fillStyle = "#11111B";
  ctx.beginPath();
  ctx.arc(0, 0, TILT_DISC_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = TILT_GOLD;
  ctx.lineWidth = 2.4;
  ctx.globalAlpha = 0.5;
  ctx.stroke();
  ctx.globalAlpha = 1;

  for (const p of m.pits) {
    ctx.fillStyle = TILT_RED;
    ctx.beginPath();
    const x = (p % m.n) * cs + cs / 2 - o;
    const y = Math.trunc(p / m.n) * cs + cs / 2 - o;
    const radius = cs * 0.32;
    ctx.moveTo(x, y - radius);
    ctx.lineTo(x + radius * Math.sqrt(3) / 2, y + radius / 2);
    ctx.lineTo(x - radius * Math.sqrt(3) / 2, y + radius / 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = TILT_GOLD;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let c = 0; c < m.n * m.n; c++) {
    if (!m.inside[c]) continue;
    for (let d = 0; d < 4; d++) {
      if (c === m.exit && d === m.exitDir) continue;
      const open = openNeighbour(m.n, m.inside, m.wallR, m.wallD, c, d) >= 0;
      if (open) continue;
      const i = (c % m.n) + DX[d]!;
      const j = Math.trunc(c / m.n) + DY[d]!;
      const neighbourInside = i >= 0 && j >= 0 && i < m.n && j < m.n && m.inside[j * m.n + i] === 1;
      // Shared walls are drawn once, from the right/down side.
      if (neighbourInside && d >= 2) continue;
      edge(ctx, m, c, d, o);
    }
  }
  ctx.stroke();
  ctx.strokeStyle = TILT_TEAL;
  ctx.lineWidth = 6;
  ctx.beginPath();
  edge(ctx, m, m.exit, m.exitDir, o);
  ctx.stroke();

  const bx = state.x / FP - o;
  const by = state.y / FP - o;
  const r = m.br / FP;
  ctx.fillStyle = TILT_GOLD;
  for (let k = 3; k >= 1; k--) {
    ctx.globalAlpha = 0.1 * (4 - k);
    ctx.beginPath();
    ctx.arc(bx - (state.vx / FP) * k * 2, by - (state.vy / FP) * k * 2, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = state.ended === 2 ? TILT_RED : TILT_GOLD;
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export const tiltGame: ArcadeGame<TiltState, ArcadeInputEvent | null> = {
  key: "tilt",
  runTicks: TILT_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: TILT_INPUT_RANGES,
};
