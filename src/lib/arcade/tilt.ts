/**
 * Tilt — a rotating disc maze. Dragging (k = 7, a = x, c = touch id) turns the
 * maze 0.5° per px; gravity always points down the screen, so in the maze's own
 * frame it is rotated by the maze angle. The ball moves on the maze's square
 * cell grid with per-axis wall stops (integer maths). Out through the exit gap
 * brings the next, larger maze; a red pit ends the run.
 */

import {
  clampInt,
  finishScore,
  inputRange,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";
import { icos, isin, TRIG_ONE } from "./trig";
import { speedBonusCurve } from "../duel/speedPar";
import { bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, BAND_FINISH_BONUS, type BandFields, type BandParts } from "./scoreBands";

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
export const TILT_MAX_MAZES = 4;
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
  /** From maze 2: the chaser's crevice cell, the gated side out of it, and the padlock cell (or -1). */
  crevice: number;
  gateDir: number;
  lock: number;
  /** tiltRev 2 only: bonus-star cells (dead-end detours off every route). */
  stars?: number[];
  /** tiltRev 2, maze 3 on: the amber marble's start cell and its own exit (cup) side; -1 when one marble. */
  start2?: number;
  exit2?: number;
  exitDir2?: number;
  /**
   * tiltRev 4 only: each star's exact point (x, y in FP, the maze frame), flattened.
   * Stars there sit at the mouth of a black hole beside a route; `stars` keeps the cell each point is in.
   */
  starXY?: number[];
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
  const route: number[] = [];
  for (let c = far.c; c >= 0; c = parent[c]!) route.unshift(c);
  let crevice = -1;
  let gateDir = -1;
  let lock = -1;
  const ends: number[] = [];
  if (level >= 1) {
    for (let c = 0; c < n * n; c++) {
      if (!inside[c] || path.has(c) || dist[c]! < 3) continue;
      let open = 0;
      for (let d = 0; d < 4; d++) if (openNeighbour(n, inside, wallR, wallD, c, d) >= 0) open += 1;
      if (open === 1) ends.push(c);
    }
  }
  if (level >= 2 && ends.length > 0) {
    // Crevice: the dead end whose branch leaves the route earliest past its first third,
    // nearest the route; the padlock sits two route cells past that junction.
    let best = -1;
    let bestScore = Infinity;
    let bestLock = -1;
    for (const e of ends) {
      let c = e;
      let hops = 0;
      while (!path.has(c) && c >= 0) {
        c = parent[c]!;
        hops += 1;
      }
      const at = route.indexOf(c);
      if (at < Math.trunc(route.length / 3) || at + 2 >= route.length - 1) continue;
      const score = hops * 1000 + at;
      if (score < bestScore) {
        bestScore = score;
        best = e;
        bestLock = route[at + 2]!;
      }
    }
    if (best >= 0) {
      crevice = best;
      ends.splice(ends.indexOf(best), 1);
      for (let d = 0; d < 4; d++) if (openNeighbour(n, inside, wallR, wallD, best, d) >= 0) gateDir = d;
      lock = bestLock;
    }
  }
  if (level >= 1) {
    const count = Math.min(ends.length, Math.min(level, 4));
    for (let k = 0; k < count; k++) pits.push(ends.splice(draw(ends.length), 1)[0]!);
  }
  const oldCs = Math.trunc(INNER / OLD_SIZES[Math.min(level, OLD_SIZES.length - 1)]!) * FP;
  const br = Math.min(Math.trunc((oldCs * 21) / 100), Math.trunc((cs * 4) / 10));
  return { n, cs, inside, wallR, wallD, pits, start, exit: far.c, exitDir: far.d, br, crevice, gateDir, lock };
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

function canPass(m: Maze, c: number, d: number, gateShut = false, which = 0): boolean {
  if (gateShut && m.crevice >= 0) {
    const nb = cellStep(m, m.crevice, m.gateDir);
    if ((c === m.crevice && d === m.gateDir) || (c === nb && d === (m.gateDir + 2) % 4)) return false;
  }
  const i = (c % m.n) + DX[d]!;
  const j = Math.trunc(c / m.n) + DY[d]!;
  const outside = i < 0 || j < 0 || i >= m.n || j >= m.n || !m.inside[j * m.n + i];
  // Each marble leaves only through its own cup's exit (the amber one, which = 1, through exit2).
  if (outside) return which === 1 ? c === m.exit2 && d === m.exitDir2 : c === m.exit && d === m.exitDir;
  return openNeighbour(m.n, m.inside, m.wallR, m.wallD, c, d) >= 0;
}

function cellStep(m: Maze, c: number, d: number): number {
  return (Math.trunc(c / m.n) + DY[d]!) * m.n + (c % m.n) + DX[d]!;
}

/* ================================ State ================================ */

export interface TiltChaser {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface TiltState extends BandFields {
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
  /** The red chaser in this maze (null when none or gone), and whether its gate is open. */
  chaser: TiltChaser | null;
  gate: number;
  caught: number;
  ended: number;
  endedTick: number;
  list: Maze[];
  /** tiltRev 2 only (absent on stored original rounds). */
  rev?: number;
  /** The blue marble is in its cup (two-marble mazes); the amber marble (null when none) and whether it is in its cup. */
  aHome?: number;
  b?: TiltChaser | null;
  bHome?: number;
  /** Bonus stars collected over the run, and this maze's star flags. */
  stars?: number;
  starGot?: number[];
  /** Tick the last star was taken (render only reads it). */
  starTick?: number;
  /** Marbles that reached their own cup (both colours, every maze). */
  cupped?: number;
  /** tiltRev 3 (score bands) only: best progress towards the exit(s) in the maze being played (0–29) and which maze that was. */
  prog?: number;
  progMaze?: number;
  /** tiltRev 4 only (Tuning C): 1 = mazes decorated by decorateV4. Absent on every earlier round. */
  tunec?: number;
}

const cache = new Map<number, { list: Maze[]; rng: number }>();

function startPos(m: Maze) {
  return {
    x: (m.start % m.n) * m.cs + Math.trunc(m.cs / 2),
    y: Math.trunc(m.start / m.n) * m.cs + Math.trunc(m.cs / 2),
  };
}

function cellCentre(m: Maze, c: number) {
  return { x: (c % m.n) * m.cs + Math.trunc(m.cs / 2), y: Math.trunc(c / m.n) * m.cs + Math.trunc(m.cs / 2) };
}

function chaserFor(m: Maze): TiltChaser | null {
  if (m.crevice < 0) return null;
  return { ...cellCentre(m, m.crevice), vx: 0, vy: 0 };
}

/** One tick of tilt physics with per-axis wall stops; returns the body's cell afterwards. */
function moveBody(m: Maze, b: { x: number; y: number; vx: number; vy: number }, angle: number, gateShut: boolean, which = 0): number {
  const r = m.br;
  b.vx += Math.trunc((GRAVITY * isin(angle)) / TRIG_ONE);
  b.vy += Math.trunc((GRAVITY * icos(angle)) / TRIG_ONE);
  b.vx = clampInt(b.vx - Math.trunc(b.vx / 64), -SPEED_CAP, SPEED_CAP);
  b.vy = clampInt(b.vy - Math.trunc(b.vy / 64), -SPEED_CAP, SPEED_CAP);
  let c = cellOf(m, b.x, b.y);
  if (c >= 0) {
    const i = c % m.n;
    let nx = b.x + b.vx;
    if (b.vx > 0 && nx + r > (i + 1) * m.cs && !canPass(m, c, 0, gateShut, which)) {
      nx = (i + 1) * m.cs - r;
      b.vx = 0;
    } else if (b.vx < 0 && nx - r < i * m.cs && !canPass(m, c, 2, gateShut, which)) {
      nx = i * m.cs + r;
      b.vx = 0;
    }
    b.x = nx;
  } else b.x += b.vx;
  c = cellOf(m, b.x, b.y);
  if (c >= 0) {
    const j = Math.trunc(c / m.n);
    let ny = b.y + b.vy;
    if (b.vy > 0 && ny + r > (j + 1) * m.cs && !canPass(m, c, 1, gateShut, which)) {
      ny = (j + 1) * m.cs - r;
      b.vy = 0;
    } else if (b.vy < 0 && ny - r < j * m.cs && !canPass(m, c, 3, gateShut, which)) {
      ny = j * m.cs + r;
      b.vy = 0;
    }
    b.y = ny;
  } else b.y += b.vy;
  return cellOf(m, b.x, b.y);
}

function inPit(m: Maze, c: number, x: number, y: number): boolean {
  if (!m.pits.includes(c)) return false;
  const p = cellCentre(m, c);
  const q = Math.trunc(m.cs / 4);
  return Math.abs(x - p.x) < q && Math.abs(y - p.y) < q;
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
    chaser: chaserFor(built.list[0]!),
    gate: 0,
    caught: 0,
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
  const gateShut = s.gate === 0;
  const ball = { x: s.x, y: s.y, vx: s.vx, vy: s.vy };
  moveBody(m, ball, s.angle, gateShut);
  s.x = ball.x;
  s.y = ball.y;
  s.vx = ball.vx;
  s.vy = ball.vy;
  if (s.chaser && s.gate) {
    const ch = { ...s.chaser };
    const cc = moveBody(m, ch, s.angle, false);
    s.chaser = cc < 0 || inPit(m, cc, ch.x, ch.y) ? null : ch;
  }

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
    s.chaser = chaserFor(s.list[s.level]!);
    s.gate = 0;
    return endAtTime(s, tick);
  } else if (inPit(m, now, s.x, s.y)) {
    s.ended = 2;
    s.endedTick = tick;
    return s;
  }
  if (now === m.lock && s.gate === 0) s.gate = 1;
  if (s.chaser) {
    const dx = s.chaser.x - s.x;
    const dy = s.chaser.y - s.y;
    const reach = 2 * m.br;
    if (Math.abs(dx) < reach && Math.abs(dy) < reach && (dx / 16) ** 2 + (dy / 16) ** 2 < (reach / 16) ** 2) {
      s.caught = 1;
      s.ended = 2;
      s.endedTick = tick;
      return s;
    }
  }
  return endAtTime(s, tick);
}

function endAtTime(s: TiltState, tick: number): TiltState {
  if (tick >= TILT_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

/** 30 per maze; all four = 130 + round(20 × ticks left ÷ run). */
function score(state: TiltState): number {
  if (state.mazes >= TILT_MAX_MAZES) return finishScore(TILT_RUN_TICKS, state.endedTick);
  return clampInt(MAZE_POINTS * state.mazes, 0, 130);
}

export function tiltExtra(s: TiltState) {
  return {
    mazes: s.mazes,
    survived: s.ended !== 2,
    survivedSeconds: s.tick / 60,
    caught: s.caught === 1,
    secondsLeft: s.mazes >= TILT_MAX_MAZES ? Math.max(0, TILT_RUN_TICKS - s.endedTick) / 60 : 0,
    stars: s.stars ?? 0,
    totalStars: tiltTotalStars(s),
  };
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
  "gate",
  "chaser",
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
  gate: number;
  chaser: number;
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
    gate: state.gate,
    chaser: state.chaser ? (state.chaser.x ^ Math.imul(state.chaser.y, 31)) | 0 : 0,
    ended: state.ended,
    rng: state.rng | 0,
  };
  let checksum = 0x811c9dc5;
  const values = Object.values(snap);
  // tiltRev 2: the amber marble, cups and stars fold into the checksum; encoded fields are unchanged.
  if (state.rev === TILT_REV) values.push(state.b ? (state.b.x ^ Math.imul(state.b.y, 31)) | 0 : 0, state.aHome ?? 0, state.bHome ?? 0, state.stars ?? 0);
  // tiltRev 4 adds its marker last.
  if (state.tunec) values.push(state.tunec);
  for (const value of values) {
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
  ctx.fillText(`Maze ${Math.min(TILT_MAX_MAZES, state.mazes + 1)} / ${TILT_MAX_MAZES}`, 14, 26);

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
    const radius = cs * 0.28; // Small six-pointed fixed spike; collision is unchanged.
    for (let point = 0; point < 12; point++) {
      const r = point % 2 === 0 ? radius : radius * 0.4;
      const angle = point * Math.PI / 6 - Math.PI / 2;
      const sx = x + Math.cos(angle) * r;
      const sy = y + Math.sin(angle) * r;
      if (point === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
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
      if (c === m.exit2 && d === m.exitDir2) continue;
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

  if (m.crevice >= 0) {
    // Silver gate across the crevice mouth until the padlock is passed.
    if (state.gate === 0) {
      ctx.strokeStyle = "#C9CED6";
      ctx.lineWidth = 5;
      ctx.beginPath();
      edge(ctx, m, m.crevice, m.gateDir, o);
      ctx.stroke();
      const lx = (m.lock % m.n) * cs + cs / 2 - o;
      const ly = Math.trunc(m.lock / m.n) * cs + cs / 2 - o;
      const w = Math.max(6, cs * 0.34);
      ctx.strokeStyle = "#C9CED6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(lx, ly - w * 0.25, w * 0.32, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = "#C9CED6";
      ctx.fillRect(lx - w / 2, ly - w * 0.25, w, w * 0.7);
    }
    if (state.chaser) {
      ctx.fillStyle = TILT_RED;
      ctx.beginPath();
      ctx.arc(state.chaser.x / FP - o, state.chaser.y / FP - o, m.br / FP, 0, Math.PI * 2);
      ctx.fill();
    }
  }

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
  step: bandStep(step),
  isOver,
  score: bandScoreOf(score, scoreBand),
  draw,
  inputRanges: TILT_INPUT_RANGES,
};

/* ====================== tiltRev 2: stars and two marbles ====================== */

/**
 * Stored as puzzle.tiltRev. The same seeded mazes as the original, then (from
 * its own PRNG stream) two bonus stars per maze in dead-end detours off every
 * route, and from maze 3 an amber marble with its own amber cup at a second
 * exit: each marble leaves only through its own cup, and the maze is done when
 * both are in. The red chaser stays in maze 2 only. Unstamped rounds keep the
 * original rules and score.
 */
export const TILT_REV = 2;
export const TILT_STARS_PER_MAZE = 2;
/** The amber marble joins from this maze (1-based). */
export const TILT_TWO_FROM = 3;
/** Rev-2 scoring: per maze, per star, and the finish bonus (full with half the time left). */
export const TILT_V2_MAZE_POINTS = 25;
export const TILT_V2_STAR_POINTS = 5;
export const TILT_V2_FINISH_BONUS = 30;
export const TILT_V2_STARS = TILT_MAX_MAZES * TILT_STARS_PER_MAZE;
/** Most a run that does not finish all four mazes can score: three mazes and every star. */
export const TILT_V2_PARTIAL_MAX = TILT_V2_MAZE_POINTS * (TILT_MAX_MAZES - 1) + TILT_V2_STAR_POINTS * TILT_V2_STARS;

export function tiltRev2Score(mazes: number, stars: number, finishTick: number): number {
  const bonus = mazes >= TILT_MAX_MAZES ? speedBonusCurve(TILT_V2_FINISH_BONUS, TILT_RUN_TICKS - finishTick, TILT_RUN_TICKS) : 0;
  return clampInt(TILT_V2_MAZE_POINTS * mazes + TILT_V2_STAR_POINTS * stars + bonus, 0, 150);
}

function bfsFrom(m: Maze, from: number): { dist: number[]; parent: number[] } {
  const dist = new Array<number>(m.n * m.n).fill(-1);
  const parent = new Array<number>(m.n * m.n).fill(-1);
  dist[from] = 0;
  const queue = [from];
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q]!;
    for (let d = 0; d < 4; d++) {
      const nc = openNeighbour(m.n, m.inside, m.wallR, m.wallD, c, d);
      if (nc >= 0 && dist[nc]! < 0) {
        dist[nc] = dist[c]! + 1;
        parent[nc] = c;
        queue.push(nc);
      }
    }
  }
  return { dist, parent };
}

function routeCells(parent: number[], to: number): Set<number> {
  const out = new Set<number>();
  for (let c = to; c >= 0; c = parent[c]!) out.add(c);
  return out;
}

/** Integer angle of a cell centre about the disc centre, in 1/360 turns (for spacing the two cups). */
function cellBearing(m: Maze, c: number): number {
  const x = 2 * (c % m.n) + 1 - m.n;
  const y = 2 * Math.trunc(c / m.n) + 1 - m.n;
  // Octant-based pseudo-angle, integer only: 0..359 increasing clockwise from +x.
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const t = ax + ay === 0 ? 0 : Math.trunc((90 * ay) / (ax + ay));
  if (x >= 0 && y >= 0) return t;
  if (x < 0 && y >= 0) return 180 - t;
  if (x < 0) return 180 + t;
  return 360 - t;
}

function decorate(m: Maze, index: number, draw: (n: number) => number): Maze {
  const out: Maze = { ...m, stars: [], start2: -1, exit2: -1, exitDir2: -1 };
  const a = bfsFrom(m, m.start);
  const routes = routeCells(a.parent, m.exit);
  const used = new Set<number>([m.start, m.exit, ...m.pits]);
  if (index + 1 >= TILT_TWO_FROM) {
    // No chaser once the amber marble joins: two marbles and two cups are enough to read.
    out.crevice = -1;
    out.gateDir = -1;
    out.lock = -1;
    const n = m.n;
    const inCell = (i: number, j: number) => i >= 0 && j >= 0 && i < n && j < n && m.inside[j * n + i] === 1;
    // The amber marble starts off the blue route, among the nearest such cells to the centre.
    let near = Infinity;
    for (let c = 0; c < n * n; c++) if (m.inside[c] && !used.has(c) && !routes.has(c) && a.dist[c]! >= 2) near = Math.min(near, a.dist[c]!);
    const starts: number[] = [];
    for (let c = 0; c < n * n; c++) {
      if (!m.inside[c] || used.has(c) || routes.has(c)) continue;
      if (a.dist[c]! >= 2 && a.dist[c]! <= near + 3) starts.push(c);
    }
    const start2 = starts.length ? starts[draw(starts.length)]! : m.start;
    const b = bfsFrom(m, start2);
    const exitBearing = cellBearing(m, m.exit);
    let best = -1;
    let bestDir = -1;
    let bestScore = -1;
    for (let c = 0; c < n * n; c++) {
      if (!m.inside[c] || used.has(c) || c === start2) continue;
      for (let d = 0; d < 4; d++) {
        if (inCell((c % n) + DX[d]!, Math.trunc(c / n) + DY[d]!)) continue;
        let sep = Math.abs(cellBearing(m, c) - exitBearing);
        if (sep > 180) sep = 360 - sep;
        // At least a quarter turn from the blue cup, then the shortest trip from the amber start.
        const score = Math.min(sep, 90) * 1000 - b.dist[c]!;
        if (score > bestScore) {
          bestScore = score;
          best = c;
          bestDir = d;
        }
        break;
      }
    }
    out.start2 = start2;
    out.exit2 = best;
    out.exitDir2 = bestDir;
    for (const c of routeCells(b.parent, best)) routes.add(c);
    used.add(start2);
    used.add(best);
  }
  if (m.crevice >= 0 && out.crevice >= 0) {
    used.add(m.crevice);
    used.add(m.lock);
  }
  // Stars: dead ends off every route, the longest detours first among a seeded pick.
  const ends: { c: number; hops: number }[] = [];
  for (let c = 0; c < m.n * m.n; c++) {
    if (!m.inside[c] || used.has(c) || routes.has(c)) continue;
    let open = 0;
    for (let d = 0; d < 4; d++) if (openNeighbour(m.n, m.inside, m.wallR, m.wallD, c, d) >= 0) open += 1;
    if (open !== 1) continue;
    let hops = 0;
    for (let x = c; x >= 0 && !routes.has(x); x = a.parent[x]!) hops += 1;
    ends.push({ c, hops });
  }
  // Short real detours: two or more cells off the route, the shortest few first.
  const far = ends.filter((e) => e.hops >= 2).sort((x, y) => x.hops - y.hops || x.c - y.c);
  const pool = (far.length >= TILT_STARS_PER_MAZE ? far : ends).slice(0, 4);
  for (let k = 0; k < TILT_STARS_PER_MAZE && pool.length; k++) out.stars!.push(pool.splice(draw(pool.length), 1)[0]!.c);
  return out;
}

const cacheRev2 = new Map<number, Maze[]>();

function startPos2(m: Maze) {
  return cellCentre(m, m.start2!);
}

function initRev2(seed: number): TiltState {
  const s = init(seed);
  let list = cacheRev2.get(seed | 0);
  if (!list) {
    let rng = (seed ^ 0x7a11_5eed) | 0;
    const draw = (bound: number) => {
      const r = rngBelow(rng, bound);
      rng = r.state;
      return r.value;
    };
    list = s.list.map((m, i) => decorate(m, i, draw));
    if (cacheRev2.size > 16) cacheRev2.clear();
    cacheRev2.set(seed | 0, list);
  }
  return enterMaze({ ...s, rev: TILT_REV, list, stars: 0, cupped: 0, starTick: -1000 }, 0);
}

/** Puts the marbles at a maze's starts (rev 2). */
function enterMaze(s: TiltState, level: number): TiltState {
  const m = s.list[level]!;
  const pos = startPos(m);
  const two = (m.start2 ?? -1) >= 0;
  return {
    ...s,
    level,
    x: pos.x,
    y: pos.y,
    vx: 0,
    vy: 0,
    aHome: 0,
    b: two ? { ...startPos2(m), vx: 0, vy: 0 } : null,
    bHome: 0,
    chaser: chaserFor(m),
    gate: 0,
    starGot: (m.stars ?? []).map(() => 0),
  };
}

function touches(m: Maze, body: { x: number; y: number }, other: { x: number; y: number }): boolean {
  const dx = other.x - body.x;
  const dy = other.y - body.y;
  const reach = 2 * m.br;
  return Math.abs(dx) < reach && Math.abs(dy) < reach && (dx / 16) ** 2 + (dy / 16) ** 2 < (reach / 16) ** 2;
}

function stepRev2(state: TiltState, input: ArcadeInputEvent | null): TiltState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  let s: TiltState = { ...state, tick };
  if (input !== null && input.k === TILT_INPUT_DRAG) {
    if (input.c !== s.lastC) s.lastC = input.c;
    else s.angle = (s.angle + (input.a - s.lastA) * ANG_PER_PX) & 65535;
    s.lastA = input.a;
  }
  const m = s.list[s.level]!;
  const gateShut = s.gate === 0;
  const end = () => {
    s.ended = 2;
    s.endedTick = tick;
    return s;
  };
  // Blue marble (the original ball fields), then the amber one; each leaves only through its own cup.
  const live: { x: number; y: number }[] = [];
  if (!s.aHome) {
    const ball = { x: s.x, y: s.y, vx: s.vx, vy: s.vy };
    moveBody(m, ball, s.angle, gateShut, 0);
    s.x = ball.x;
    s.y = ball.y;
    s.vx = ball.vx;
    s.vy = ball.vy;
  }
  if (s.b && !s.bHome) {
    const ball = { ...s.b };
    moveBody(m, ball, s.angle, gateShut, 1);
    s.b = ball;
  }
  if (s.chaser && s.gate) {
    const ch = { ...s.chaser };
    const cc = moveBody(m, ch, s.angle, false);
    s.chaser = cc < 0 || inPit(m, cc, ch.x, ch.y) ? null : ch;
  }
  if (!s.aHome) {
    const now = cellOf(m, s.x, s.y);
    if (now < 0) {
      s.aHome = 1;
      s.cupped = (s.cupped ?? 0) + 1;
    } else if (inPit(m, now, s.x, s.y)) return end();
    else {
      live.push({ x: s.x, y: s.y });
      if (now === m.lock && s.gate === 0) s.gate = 1;
    }
  }
  if (s.b && !s.bHome) {
    const now = cellOf(m, s.b.x, s.b.y);
    if (now < 0) {
      s.bHome = 1;
      s.cupped = (s.cupped ?? 0) + 1;
    } else if (inPit(m, now, s.b.x, s.b.y)) return end();
    else live.push({ x: s.b.x, y: s.b.y });
  }
  // Stars: a live marble's centre within a third of a cell of the star's cell centre.
  const stars = m.stars ?? [];
  if (stars.length) {
    const got = [...(s.starGot ?? [])];
    const q = Math.trunc(m.cs / 3);
    for (let k = 0; k < stars.length; k++) {
      if (got[k]) continue;
      const p = tiltStarPoint(m, k);
      if (live.some((ball) => Math.abs(ball.x - p.x) < q && Math.abs(ball.y - p.y) < q)) {
        got[k] = 1;
        s.stars = (s.stars ?? 0) + 1;
        s.starTick = tick;
      }
    }
    s.starGot = got;
  }
  if (s.chaser && live.some((ball) => touches(m, ball, s.chaser!))) {
    s.caught = 1;
    return end();
  }
  if (s.aHome && (!s.b || s.bHome)) {
    s.mazes += 1;
    if (s.mazes >= TILT_MAX_MAZES) {
      s.ended = 1;
      s.endedTick = tick;
      return s;
    }
    s = enterMaze(s, s.level + 1);
  }
  return endAtTime(s, tick);
}

function scoreRev2(state: TiltState): number {
  return tiltRev2Score(state.mazes, state.stars ?? 0, state.endedTick);
}

/** Bonus stars on the four mazes of a rev-2 state (0 on original rounds). */
export function tiltTotalStars(state: TiltState): number {
  return state.rev === TILT_REV ? state.list.reduce((n, m) => n + (m.stars?.length ?? 0), 0) : 0;
}

/** A star's point in the maze frame, FP: its stored point (tiltRev 4) or its cell's centre. */
export function tiltStarPoint(m: Maze, k: number): { x: number; y: number } {
  if (m.starXY) return { x: m.starXY[2 * k]!, y: m.starXY[2 * k + 1]! };
  return cellCentre(m, m.stars![k]!);
}

/** Render/bots: cell-centre position of a cell in a maze, FP. */
export function tiltCellCentre(m: Maze, c: number): { x: number; y: number } {
  return cellCentre(m, c);
}

export const tiltRev2Game: ArcadeGame<TiltState, ArcadeInputEvent | null> = { ...tiltGame, init: initRev2, step: bandStep(stepRev2, tiltTrack), score: bandScoreOf(scoreRev2, scoreBand) };
export function tiltGameFor(rev?: number | null): ArcadeGame<TiltState, ArcadeInputEvent | null> {
  if (rev === TILT_REV_TUNEC) return tiltTunecGame;
  if (rev === TILT_REV_BAND) return tiltBandGame;
  return rev === TILT_REV ? tiltRev2Game : tiltGame;
}

/* ================= Oct 2026 score bands (tiltRev 3) ================= */

/** Score-band revision (puzzle.tiltRev = 3): rev-2 play unchanged, scored on the shared band curve (scoreBands.ts). */
export const TILT_REV_BAND = 3;
/** Progress through the maze being played counts up to 29 (each finished maze 30); stars 5. */
export const TILT_BAND_PROGRESS = 29;
/** Mazes 30, progress in the current maze up to 29, stars 5; 140 at all four mazes and eight stars; finishing adds up to 10 for speed. */
export const TILT_BAND_CURVE = bandCurve([0, 60, 102, 120, 130, 145, 160], [0, 35, 70, 95, 110, 135, 140]);

/** Distances to each marble's exit and from its start, per maze (mazes are fixed per seed). */
const exitDist = new WeakMap<Maze, { a: number[]; a0: number; b: number[] | null; b0: number }>();
function tiltExitDist(m: Maze) {
  let d = exitDist.get(m);
  if (!d) {
    const a = bfsFrom(m, m.exit).dist;
    const two = (m.start2 ?? -1) >= 0 && (m.exit2 ?? -1) >= 0;
    const b = two ? bfsFrom(m, m.exit2!).dist : null;
    d = { a, a0: Math.max(1, a[m.start] ?? 1), b, b0: b ? Math.max(1, b[m.start2!] ?? 1) : 1 };
    exitDist.set(m, d);
  }
  return d;
}

/** Progress (0–29) of the marbles in the maze being played: share of the start-to-exit distance covered, averaged over marbles. */
export function tiltMazeProgress(s: TiltState): number {
  const m = s.list[s.level];
  if (!m || s.mazes >= TILT_MAX_MAZES) return 0;
  const d = tiltExitDist(m);
  const share = (home: number | undefined, x: number, y: number, dist: number[], d0: number) => {
    if (home) return 1;
    const c = cellOf(m, x, y);
    const left = c >= 0 ? dist[c]! : 0;
    return left < 0 ? 0 : Math.max(0, Math.min(1, (d0 - left) / d0));
  };
  const pa = share(s.aHome, s.x, s.y, d.a, d.a0);
  const pb = d.b && s.b ? share(s.bHome, s.b.x, s.b.y, d.b, d.b0) : null;
  const p = pb === null ? pa : (pa + pb) / 2;
  return Math.max(0, Math.min(TILT_BAND_PROGRESS, Math.floor(TILT_BAND_PROGRESS * p)));
}

/** Keeps the best progress in the current maze (reset when a maze is finished). */
function tiltTrack(_prev: TiltState, next: TiltState): TiltState {
  const same = next.progMaze === next.mazes;
  const best = same ? (next.prog ?? 0) : 0;
  const now = tiltMazeProgress(next);
  if (same && now <= best) return next;
  return { ...next, prog: Math.max(best, now), progMaze: next.mazes };
}

export function tiltBandParts(state: TiltState): BandParts {
  const mazes = clampInt(state.mazes, 0, TILT_MAX_MAZES);
  const prog = mazes < TILT_MAX_MAZES && state.progMaze === mazes ? clampInt(state.prog ?? 0, 0, TILT_BAND_PROGRESS) : 0;
  const stars = clampInt(state.stars ?? 0, 0, TILT_V2_STARS);
  const units = 30 * mazes + prog + TILT_V2_STAR_POINTS * stars;
  const finished = mazes >= TILT_MAX_MAZES;
  return {
    units,
    points: bandPoints(state.tunec ? TILT_V4_BAND_CURVE : TILT_BAND_CURVE, units),
    bonus: finished ? speedBonusCurve(BAND_FINISH_BONUS, TILT_RUN_TICKS - clampInt(state.endedTick, 0, TILT_RUN_TICKS), TILT_RUN_TICKS) : 0,
    penalty: 0,
    finished,
    text: `${mazes} / ${TILT_MAX_MAZES} mazes${finished ? "" : ` + ${Math.round((100 * prog) / TILT_BAND_PROGRESS)}% of the next`} · ${stars} stars`,
    bonusText: "All four mazes",
  };
}

function scoreBand(state: TiltState): number {
  return bandTotal(tiltBandParts(state), Boolean(state.acted));
}

export const tiltBandGame: ArcadeGame<TiltState, ArcadeInputEvent | null> = { ...tiltRev2Game, init: (seed) => bandInit(initRev2(seed)) };

/* ============== Tuning A: every cup reachable (Oct 2026) ============== */

/**
 * Can this marble (0 blue, 1 amber) roll from its start to its own cup? A
 * breadth-first search over the maze's cells with the sim's own canPass (the
 * chaser's gate counted shut, pits avoided), leaving the maze only through the
 * marble's own exit. Mazes without an amber marble pass for it.
 */
export function tiltCupReachable(m: Maze, which: 0 | 1): boolean {
  const start = which === 1 ? (m.start2 ?? -1) : m.start;
  if (start < 0) return which === 1;
  const seen = new Set<number>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const c = queue.shift()!;
    for (let d = 0; d < 4; d++) {
      if (!canPass(m, c, d, true, which)) continue;
      const i = (c % m.n) + DX[d]!;
      const j = Math.trunc(c / m.n) + DY[d]!;
      // canPass only lets a marble out of the maze through its own cup's exit.
      if (i < 0 || j < 0 || i >= m.n || j >= m.n || !m.inside[j * m.n + i]) return true;
      const nc = j * m.n + i;
      if (seen.has(nc) || m.pits.includes(nc)) continue;
      seen.add(nc);
      queue.push(nc);
    }
  }
  return false;
}

/** True when every maze a seed deals on the live revision has both cups reachable (the server deals only such seeds). */
export function tiltSeedCupsReachable(seed: number): boolean {
  return tiltTunecGame.init(seed).list.every((m) => tiltCupReachable(m, 0) && tiltCupReachable(m, 1));
}

/* ============== Tuning C (tiltRev 4, Oct 2026) ============== */

/**
 * tiltRev 4 (Tuning C): the same seeded mazes, walls, holes and blue cup as
 * tiltRev 3, decorated from the same separate stream with two changes:
 *  - the amber cup is picked first (a quarter turn or more round the rim from
 *    the blue cup, the shortest route from the maze centre, as before), then
 *    the amber marble starts at least TILT_AMBER_MIN_HOPS(n) cells along the
 *    maze's paths from its own cup (a seeded pick among the nearest such cells
 *    to the centre, off the blue route), so it never starts near its cup;
 *  - each star sits at the mouth of a black hole whose dead end opens on, or
 *    one cell off, a marble's route to its cup: inside the cell in front of the
 *    hole, TILT_STAR_MOUTH of a cell toward it. Taking it means leaning toward
 *    the hole as you pass; overshoot and the marble drops in. Mazes with too few
 *    such holes (most holes sit deeper in side passages) put the rest on dead ends one cell off a route.
 * Scored on the tiltRev 3 band curve. States add `tunec: 1`.
 */
export const TILT_REV_TUNEC = 4;
/**
 * tiltRev 4 band knots: the amber marble's longer trip and the riskier stars make
 * the same players reach less (scripts/arcade-skill-bands.ts tilt --rev=c), so the
 * knots are refitted to keep each level in its band; all four mazes and eight
 * stars still reach 140, plus up to 10 for speed.
 */
export const TILT_V4_BAND_CURVE = bandCurve([0, 50, 86, 100, 114, 140, 160], [0, 35, 70, 100, 125, 137, 140]);
/** Minimum path distance (cells) from the amber cup's cell to the amber start: the maze's width in cells. */
export function tiltAmberMinHops(m: Maze): number {
  return m.n;
}
/** How far from the front cell's centre toward the hole a mouth star sits, in 1/100 of a cell. */
export const TILT_STAR_MOUTH = 45;

function decorateV4(m: Maze, index: number, draw: (n: number) => number): Maze {
  const out: Maze = { ...m, stars: [], starXY: [], start2: -1, exit2: -1, exitDir2: -1 };
  const a = bfsFrom(m, m.start);
  const routes = routeCells(a.parent, m.exit);
  const used = new Set<number>([m.start, m.exit, ...m.pits]);
  const n = m.n;
  if (index + 1 >= TILT_TWO_FROM) {
    out.crevice = -1;
    out.gateDir = -1;
    out.lock = -1;
    const inCell = (i: number, j: number) => i >= 0 && j >= 0 && i < n && j < n && m.inside[j * n + i] === 1;
    // The amber cup first: a quarter turn or more from the blue cup, then the shortest trip from the centre.
    const exitBearing = cellBearing(m, m.exit);
    let best = -1;
    let bestDir = -1;
    let bestScore = -1;
    for (let c = 0; c < n * n; c++) {
      if (!m.inside[c] || used.has(c)) continue;
      for (let d = 0; d < 4; d++) {
        if (inCell((c % n) + DX[d]!, Math.trunc(c / n) + DY[d]!)) continue;
        let sep = Math.abs(cellBearing(m, c) - exitBearing);
        if (sep > 180) sep = 360 - sep;
        const score = Math.min(sep, 90) * 1000 - a.dist[c]!;
        if (score > bestScore) {
          bestScore = score;
          best = c;
          bestDir = d;
        }
        break;
      }
    }
    // Then the amber start: off the blue route, at least the minimum path distance from its own cup,
    // among the nearest such cells to the centre (a seeded pick of up to four).
    const fromCup = bfsFrom(m, best).dist;
    const minHops = tiltAmberMinHops(m);
    let cands: number[] = [];
    for (let c = 0; c < n * n; c++) {
      if (!m.inside[c] || used.has(c) || routes.has(c) || c === best || a.dist[c]! < 2) continue;
      if (fromCup[c]! >= minHops) cands.push(c);
    }
    if (!cands.length) {
      // No cell that far (never seen on the live sizes): the farthest cell from the cup off the blue route.
      let far = -1;
      for (let c = 0; c < n * n; c++) if (m.inside[c] && !used.has(c) && !routes.has(c) && c !== best && (far < 0 || fromCup[c]! > fromCup[far]!)) far = c;
      cands = far >= 0 ? [far] : [m.start];
    }
    cands.sort((x, y) => a.dist[x]! - a.dist[y]! || x - y);
    const pool = cands.slice(0, 4);
    const start2 = pool[draw(pool.length)]!;
    out.start2 = start2;
    out.exit2 = best;
    out.exitDir2 = bestDir;
    for (const c of routeCells(bfsFrom(m, start2).parent, best)) routes.add(c);
    used.add(start2);
    used.add(best);
  }
  if (m.crevice >= 0 && out.crevice >= 0) {
    used.add(m.crevice);
    used.add(m.lock);
  }
  // Hops from a cell to the nearest route cell (0 on a route).
  const toRoute = new Array<number>(n * n).fill(-1);
  const queue: number[] = [];
  for (const c of routes) {
    toRoute[c] = 0;
    queue.push(c);
  }
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q]!;
    for (let d = 0; d < 4; d++) {
      const nc = openNeighbour(n, m.inside, m.wallR, m.wallD, c, d);
      if (nc >= 0 && toRoute[nc]! < 0) {
        toRoute[nc] = toRoute[c]! + 1;
        queue.push(nc);
      }
    }
  }
  const put = (cell: number, x: number, y: number) => {
    out.stars!.push(cell);
    out.starXY!.push(x, y);
  };
  // Mouth stars: holes whose front cell is on a route or one cell off it, nearest first, seeded order within a distance.
  const mouths: { pit: number; front: number; d: number; hops: number }[] = [];
  for (const pit of m.pits) {
    for (let d = 0; d < 4; d++) {
      const front = openNeighbour(n, m.inside, m.wallR, m.wallD, pit, d);
      if (front < 0 || m.pits.includes(front) || front === out.start2 || front === m.start) continue;
      const hops = toRoute[front]!;
      if (hops >= 0 && hops <= 1) mouths.push({ pit, front, d: (d + 2) % 4, hops });
    }
  }
  for (const hops of [0, 1]) {
    const tier = mouths.filter((e) => e.hops === hops);
    while (tier.length && out.stars!.length < TILT_STARS_PER_MAZE) {
      const e = tier.splice(draw(tier.length), 1)[0]!;
      const p = cellCentre(m, e.front);
      // From the front cell's centre toward the hole (e.d points from the front cell to the pit).
      const off = Math.trunc((m.cs * TILT_STAR_MOUTH) / 100);
      put(e.front, p.x + DX[e.d]! * off, p.y + DY[e.d]! * off);
    }
  }
  // The rest: dead ends one cell off a route (their centre), then the shortest dead-end detours.
  if (out.stars!.length < TILT_STARS_PER_MAZE) {
    const ends: { c: number; hops: number }[] = [];
    for (let c = 0; c < n * n; c++) {
      if (!m.inside[c] || used.has(c) || routes.has(c) || out.stars!.includes(c)) continue;
      let open = 0;
      for (let d = 0; d < 4; d++) if (openNeighbour(n, m.inside, m.wallR, m.wallD, c, d) >= 0) open += 1;
      if (open === 1 && toRoute[c]! > 0) ends.push({ c, hops: toRoute[c]! });
    }
    ends.sort((x, y) => x.hops - y.hops || x.c - y.c);
    const nearest = ends.length ? ends[0]!.hops : 0;
    const pool = ends.filter((e) => e.hops === nearest);
    const rest = ends.filter((e) => e.hops !== nearest);
    while (out.stars!.length < TILT_STARS_PER_MAZE && (pool.length || rest.length)) {
      const e = pool.length ? pool.splice(draw(pool.length), 1)[0]! : rest.shift()!;
      const p = cellCentre(m, e.c);
      put(e.c, p.x, p.y);
    }
  }
  return out;
}

const cacheV4 = new Map<number, Maze[]>();

function initV4(seed: number): TiltState {
  const s = init(seed);
  let list = cacheV4.get(seed | 0);
  if (!list) {
    let rng = (seed ^ 0x7a11_5eed) | 0;
    const draw = (bound: number) => {
      const r = rngBelow(rng, bound);
      rng = r.state;
      return r.value;
    };
    list = s.list.map((m, i) => decorateV4(m, i, draw));
    if (cacheV4.size > 16) cacheV4.clear();
    cacheV4.set(seed | 0, list);
  }
  return bandInit({ ...enterMaze({ ...s, rev: TILT_REV, list, stars: 0, cupped: 0, starTick: -1000 }, 0), tunec: 1 });
}

export const tiltTunecGame: ArcadeGame<TiltState, ArcadeInputEvent | null> = { ...tiltRev2Game, init: initV4 };
