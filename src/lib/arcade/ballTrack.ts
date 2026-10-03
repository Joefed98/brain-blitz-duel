/**
 * Ball Track: a deterministic 60-tick sim. Balls leave a hopper above the
 * centre column, move one tile every BT_STEP_TICKS and land in a tray or pit
 * under the 7×7 grid. Pieces (pipes, flippers, sliders, wheels) are changed by
 * recorded input events; the server replays the log against the stored course.
 */

import { inputRange, type ArcadeGame, type ArcadeInputEvent } from "./engine";

/* ================================ Config ================================ */

export const BT_COLS = 7;
export const BT_ROWS = 7;
export const BT_BALLS = 15;
export const BT_COLOURS = 5;
export const BT_STEP_TICKS = 20;
export const BT_SLIDE_TICKS = 10;
export const BT_WHEEL_TICKS = 15;
export const BT_RUN_TICKS = 5400; // 90 s
export const BT_HOPPER_COL = 3;
export const BT_CHECKPOINT_INTERVAL = 300;

export const BT_K_ROTATE = 12;
export const BT_K_FLIP = 13;
export const BT_K_SLIDE = 14;
export const BT_K_WHEEL = 15;
export const BT_K_RELEASE = 16;

/** Side bits. */
export const N = 1, E = 2, S = 4, W = 8;
/** Pipe shapes at rotation 0: straight, corner, T. */
export const BT_PIPE_MASKS = [N | S, N | E, E | S | W] as const;

/** Game palette: RED, BLUE, GREEN, PURPLE, YELLOW. */
export const BT_PALETTE = ["#FF4D4D", "#4D8CFF", "#3DDC84", "#B26BFF", "#FFE600"] as const;
export const BT_COLOUR_NAMES = ["Red", "Blue", "Green", "Purple", "Yellow"] as const;

/* ================================ Course ================================ */

export interface BtPipe { cell: number; shape: number; rot: number }
export interface BtFlipper { cell: number; dir: number } // 0 = bottom-left, 1 = bottom-right
export interface BtSlider { row: number; col: number; len: number; slot: number; pos: number }
export interface BtWheel { cell: number; pocket: number } // pocket 0 TL, 1 TR, 2 BR, 3 BL
export interface BtCourse {
  /** Colour per bottom slot (7), -1 = pit. */
  trays: number[];
  /** Ball colours in release order. */
  balls: number[];
  pipes: BtPipe[];
  flippers: BtFlipper[];
  sliders: BtSlider[];
  wheels: BtWheel[];
}

/** What sits on each cell: kind 0 plain, 1 pipe, 2 flipper, 3 slider, 4 wheel; idx; sub (slider tile / wheel quadrant). */
export interface BtCellInfo { kind: number; idx: number; sub: number }

export function btCellMap(course: BtCourse): BtCellInfo[] {
  const map: BtCellInfo[] = Array.from({ length: BT_COLS * BT_ROWS }, () => ({ kind: 0, idx: -1, sub: 0 }));
  course.pipes.forEach((p, idx) => (map[p.cell] = { kind: 1, idx, sub: 0 }));
  course.flippers.forEach((f, idx) => (map[f.cell] = { kind: 2, idx, sub: 0 }));
  course.sliders.forEach((s, idx) => {
    for (let i = 0; i < s.len; i++) map[s.row * BT_COLS + s.col + i] = { kind: 3, idx, sub: i };
  });
  course.wheels.forEach((w, idx) => {
    const quads = [w.cell, w.cell + 1, w.cell + BT_COLS + 1, w.cell + BT_COLS];
    quads.forEach((cell, sub) => (map[cell] = { kind: 4, idx, sub }));
  });
  return map;
}

/* ================================ State ================================ */

export interface BtBall {
  id: number;
  colour: number;
  /** -1 = hopper. */
  cell: number;
  /** Previous cell for drawing (-1 hopper). */
  from: number;
  arrived: number;
  /** Earliest tick the ball may move again. */
  at: number;
  /** Planned next move: target cell, 100 + slot column, or -2 lost. */
  target: number;
  entry: number;
  /** Side through which the ball entered its current tile (render-only path metadata). */
  inlet: number;
  /** Wheel index holding this ball, or -1. */
  held: number;
}

export interface BtMark { cell: number; colour: number; tick: number; ok: number }

export interface BtState {
  tick: number;
  pipeRot: number[];
  flip: number[];
  slFrom: number[];
  slTo: number[];
  slUntil: number[];
  whPocket: number[];
  whDir: number[];
  whUntil: number[];
  whHeld: number[];
  balls: BtBall[];
  next: number;
  home: number;
  wrong: number;
  lost: number;
  lastLand: number;
  actions: number;
  landings: BtMark[];
  falls: BtMark[];
}

export const rotMask = (mask: number, rot: number) => {
  let m = mask;
  for (let i = 0; i < (rot & 3); i++) m = ((m << 1) | (m >> 3)) & 15;
  return m;
};

export const sliderPos = (state: BtState, i: number) =>
  state.tick >= (state.slUntil[i] ?? 0) ? (state.slTo[i] ?? 0) : (state.slFrom[i] ?? 0);

const LOST = -2;
const SLOT = 100;

/** Where a ball entering `cell` through `entry` goes next, given the current pieces. */
export function btExit(
  course: BtCourse,
  map: BtCellInfo[],
  state: BtState,
  cell: number,
  entry: number,
): { target: number; entry: number } {
  const r = Math.floor(cell / BT_COLS), c = cell % BT_COLS;
  const info = map[cell]!;
  let dr = 1, dc = 0, nextEntry = N;
  if (info.kind === 1) {
    const pipe = course.pipes[info.idx]!;
    const mask = rotMask(BT_PIPE_MASKS[pipe.shape]!, state.pipeRot[info.idx]!);
    if (!(mask & entry)) return { target: LOST, entry: 0 };
    const cands = mask & ~entry & ~N;
    const opposite = entry === N ? S : entry === E ? W : entry === W ? E : N;
    const out = cands & opposite ? opposite : cands & S ? S : cands & E ? E : cands & W ? W : 0;
    if (!out) return { target: LOST, entry: 0 };
    if (out === E) { dr = 0; dc = 1; nextEntry = W; }
    else if (out === W) { dr = 0; dc = -1; nextEntry = E; }
  } else if (info.kind === 2) {
    dc = state.flip[info.idx] ? 1 : -1;
  } else if (info.kind === 3) {
    const pos = sliderPos(state, info.idx);
    const slider = course.sliders[info.idx]!;
    if (info.sub === pos && slider.slot === 1) dc = 1;
    else if (info.sub === pos + 1 && slider.slot === 0) dc = -1;
  }
  const nr = r + dr, nc = c + dc;
  if (nc < 0 || nc >= BT_COLS) return { target: LOST, entry: 0 };
  if (nr >= BT_ROWS) return { target: SLOT + nc, entry: N };
  return { target: nr * BT_COLS + nc, entry: nextEntry };
}

export function btInit(course: BtCourse): BtState {
  return {
    tick: 0,
    pipeRot: course.pipes.map((p) => p.rot & 3),
    flip: course.flippers.map((f) => f.dir & 1),
    slFrom: course.sliders.map((s) => s.pos),
    slTo: course.sliders.map((s) => s.pos),
    slUntil: course.sliders.map(() => 0),
    whPocket: course.wheels.map((w) => w.pocket & 3),
    whDir: course.wheels.map(() => 1),
    whUntil: course.wheels.map(() => 0),
    whHeld: course.wheels.map(() => -1),
    balls: [],
    next: 0,
    home: 0,
    wrong: 0,
    lost: 0,
    lastLand: 0,
    actions: 0,
    landings: [],
    falls: [],
  };
}

const keep = <T,>(list: T[], item: T) => [...list.slice(-11), item];

export function btStep(course: BtCourse, map: BtCellInfo[], prev: BtState, input: ArcadeInputEvent | null): BtState {
  const s: BtState = {
    ...prev,
    tick: prev.tick + 1,
    pipeRot: [...prev.pipeRot],
    flip: [...prev.flip],
    slFrom: [...prev.slFrom],
    slTo: [...prev.slTo],
    slUntil: [...prev.slUntil],
    whPocket: [...prev.whPocket],
    whDir: [...prev.whDir],
    whUntil: [...prev.whUntil],
    whHeld: [...prev.whHeld],
    balls: prev.balls.map((b) => ({ ...b })),
  };
  const t = s.tick;

  if (input) {
    const cellInfo = map[input.a];
    if (input.k === BT_K_ROTATE && cellInfo?.kind === 1) {
      s.pipeRot[cellInfo.idx] = (s.pipeRot[cellInfo.idx]! + 1) & 3;
      s.actions++;
    } else if (input.k === BT_K_FLIP && cellInfo?.kind === 2) {
      s.flip[cellInfo.idx] = s.flip[cellInfo.idx] ? 0 : 1;
      s.actions++;
    } else if (input.k === BT_K_SLIDE && input.a < course.sliders.length) {
      const slider = course.sliders[input.a]!;
      const to = Math.max(0, Math.min(slider.len - 2, input.b));
      const now = sliderPos(s, input.a);
      if (to !== s.slTo[input.a] || to !== now) {
        s.slFrom[input.a] = now;
        s.slTo[input.a] = to;
        s.slUntil[input.a] = t + BT_SLIDE_TICKS;
        s.actions++;
      }
    } else if (input.k === BT_K_WHEEL && input.a < course.wheels.length) {
      if (t >= s.whUntil[input.a]!) {
        const direction = input.b === 0 ? -1 : 1;
        s.whDir[input.a] = direction;
        s.whPocket[input.a] = ((s.whPocket[input.a] ?? 0) + direction + 4) & 3;
        s.whUntil[input.a] = t + BT_WHEEL_TICKS;
        s.actions++;
      }
    } else if (input.k === BT_K_RELEASE) {
      if (s.next < BT_BALLS && !s.balls.some((b) => b.cell === -1)) {
        s.balls.push({
          id: s.next,
          colour: course.balls[s.next]!,
          cell: -1,
          from: -1,
          arrived: t,
          at: t,
          target: BT_HOPPER_COL,
          entry: N,
          inlet: N,
          held: -1,
        });
        s.next++;
      }
    }
  }

  const occupied = (cell: number, self: number) => s.balls.some((b) => b.id !== self && b.held < 0 && b.cell === cell);
  const removed = new Set<number>();
  for (const ball of s.balls) {
    if (t < ball.at) continue;
    let target = ball.target, entry = ball.entry, fromCell = ball.cell;
    if (ball.held >= 0) {
      const w = ball.held;
      const q = s.whPocket[w]!;
      if (t < s.whUntil[w]! || (q !== 2 && q !== 3)) continue;
      const wc = course.wheels[w]!.cell;
      const below = wc + 2 * BT_COLS + (q === 2 ? 1 : 0);
      fromCell = below - BT_COLS;
      const col = below % BT_COLS;
      target = below >= BT_COLS * BT_ROWS ? SLOT + col : below;
      entry = N;
    }
    if (target === LOST) {
      s.falls = keep(s.falls, { cell: ball.cell, colour: ball.colour, tick: t, ok: 0 });
      s.lost++;
      s.lastLand = t;
      if (ball.held >= 0) s.whHeld[ball.held] = -1;
      removed.add(ball.id);
      continue;
    }
    if (target >= SLOT) {
      const col = target - SLOT;
      const tray = course.trays[col]!;
      if (tray === ball.colour) s.home++;
      else if (tray < 0) s.lost++;
      else s.wrong++;
      s.lastLand = t;
      s.landings = keep(s.landings, { cell: col, colour: ball.colour, tick: t, ok: tray === ball.colour ? 1 : 0 });
      if (ball.held >= 0) s.whHeld[ball.held] = -1;
      removed.add(ball.id);
      continue;
    }
    const info = map[target]!;
    if (info.kind === 4) {
      const w = info.idx;
      const top = info.sub === 0 || info.sub === 1;
      if (entry !== N || !top) {
        ball.target = LOST;
        continue;
      }
      if (s.whHeld[w]! >= 0 || t < s.whUntil[w]! || s.whPocket[w] !== info.sub) continue; // waits above
      if (ball.held >= 0) s.whHeld[ball.held] = -1;
      ball.from = ball.cell;
      ball.cell = target;
      ball.inlet = entry;
      ball.arrived = t;
      ball.at = t + BT_STEP_TICKS;
      ball.held = w;
      s.whHeld[w] = ball.id;
      continue;
    }
    if (occupied(target, ball.id)) continue;
    if (ball.held >= 0) s.whHeld[ball.held] = -1;
    ball.held = -1;
    ball.from = fromCell;
    ball.cell = target;
    ball.inlet = entry;
    ball.arrived = t;
    ball.at = t + BT_STEP_TICKS;
    const exit = btExit(course, map, s, target, entry);
    ball.target = exit.target;
    ball.entry = exit.entry;
  }
  if (removed.size) s.balls = s.balls.filter((b) => !removed.has(b.id));
  return s;
}

export function btOver(s: BtState): boolean {
  return s.tick >= BT_RUN_TICKS || (s.next >= BT_BALLS && s.balls.length === 0);
}

/** 15/15: 100 + round(50 × time left ÷ 90 s) + 20 clean, cap 150; otherwise round(100 × home ÷ 15) − 5 per wrong, 0–90. */
export function btScoreOf(home: number, wrong: number, lost: number, lastLand: number): number {
  if (home >= BT_BALLS) {
    const left = Math.max(0, BT_RUN_TICKS - lastLand);
    const speed = Math.floor((100 * left + BT_RUN_TICKS) / (2 * BT_RUN_TICKS));
    return Math.min(150, 100 + speed + (wrong === 0 && lost === 0 ? 20 : 0));
  }
  const base = Math.floor((200 * home + BT_BALLS) / (2 * BT_BALLS));
  return Math.max(0, Math.min(90, base - 5 * wrong));
}

export function btScore(s: BtState): number {
  return btScoreOf(s.home, s.wrong, s.lost, s.lastLand);
}

/* ============================= Checkpoints ============================= */

export const BT_CHECKPOINT_KEYS = ["tick", "next", "home", "wrong", "lost", "flying", "checksum"] as const;
export interface BtCheckpoint {
  tick: number; next: number; home: number; wrong: number; lost: number; flying: number; checksum: number;
}

export function btCheckpoint(s: BtState): BtCheckpoint {
  const snap = { tick: s.tick, next: s.next, home: s.home, wrong: s.wrong, lost: s.lost, flying: s.balls.length };
  const values: number[] = [...Object.values(snap), s.actions, s.lastLand, ...s.pipeRot, ...s.flip, ...s.slFrom, ...s.slTo, ...s.slUntil, ...s.whPocket, ...s.whDir, ...s.whUntil, ...s.whHeld];
  for (const b of s.balls) values.push(b.id, b.cell, b.at, b.target, b.entry, b.inlet, b.held);
  let checksum = 0x811c9dc5;
  for (const v of values) {
    checksum ^= v | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snap, checksum };
}

/* =============================== Drawing =============================== */

export const BT_TILE = 100;
export const BT_HOPPER_H = 90;
export const BT_TRAY_H = 80;
export const BT_W = BT_COLS * BT_TILE;
export const BT_H = BT_HOPPER_H + BT_ROWS * BT_TILE + BT_TRAY_H;

const centre = (cell: number) => ({
  x: (cell % BT_COLS) * BT_TILE + BT_TILE / 2,
  y: BT_HOPPER_H + Math.floor(cell / BT_COLS) * BT_TILE + BT_TILE / 2,
});
const HOPPER = { x: BT_HOPPER_COL * BT_TILE + BT_TILE / 2, y: BT_HOPPER_H - 30 };
const QUAD = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;

function pocketPoint(course: BtCourse, s: BtState, w: number, tick: number) {
  const wc = centre(course.wheels[w]!.cell);
  const cx = wc.x + BT_TILE / 2, cy = wc.y + BT_TILE / 2;
  const q = s.whPocket[w]!;
  const left = s.whUntil[w]! - tick;
  const frac = left > 0 ? left / BT_WHEEL_TICKS : 0;
  const base = Math.atan2(QUAD[q]![1], QUAD[q]![0]) - frac * (s.whDir[w] ?? 1) * (Math.PI / 2);
  const rad = BT_TILE * 0.62;
  return { x: cx + Math.cos(base) * rad, y: cy + Math.sin(base) * rad, cx, cy, angle: base };
}

export function btBallPoint(course: BtCourse, s: BtState, b: BtBall) {
  if (b.held >= 0) return pocketPoint(course, s, b.held, s.tick);
  const to = b.cell < 0 ? HOPPER : centre(b.cell);

  const k = Math.min(1, (s.tick - b.arrived) / BT_STEP_TICKS);
  const pipe = course.pipes.find((p) => p.cell === b.cell);
  if (pipe) {
    const inlet = b.inlet;
    const start = { x: to.x + (inlet === W ? -50 : inlet === E ? 50 : 0), y: to.y + (inlet === N ? -50 : 50) };
    const next = b.target >= 100 ? { x: (b.target - 100) * BT_TILE + 50, y: to.y + BT_TILE } : b.target >= 0 ? centre(b.target) : to;
    const end = { x: to.x + Math.sign(next.x - to.x) * 50, y: to.y + Math.sign(next.y - to.y) * 50 };
    const startPoint = k < 0.5 ? start : to, endPoint = k < 0.5 ? to : end;
    const f = k < 0.5 ? k * 2 : (k - 0.5) * 2;
    return { x: startPoint.x + (endPoint.x - startPoint.x) * f, y: startPoint.y + (endPoint.y - startPoint.y) * f };
  }
  const slider = course.sliders.find((sl) => Math.floor(b.cell / BT_COLS) === sl.row && b.cell % BT_COLS >= sl.col && b.cell % BT_COLS < sl.col + sl.len);
  if (slider && b.target >= 0) {
    const exitCol = b.target >= 100 ? b.target - 100 : b.target % BT_COLS;
    const exitX = exitCol * BT_TILE + 50;
    if (exitX !== to.x) {
      if (k < 0.3) return { x: to.x, y: to.y - 50 + k / 0.3 * 50 };
      if (k < 0.7) return { x: to.x + (exitX - to.x) * (k - 0.3) / 0.4, y: to.y };
      return { x: exitX, y: to.y + (k - 0.7) / 0.3 * 50 };
    }
    return { x: to.x, y: to.y - 50 + k * 100 };
  }
  if (b.cell < 0) return HOPPER;
  const next = b.target >= 100 ? { x: (b.target - 100) * BT_TILE + 50, y: to.y + BT_TILE } : b.target >= 0 ? centre(b.target) : to;
  const startX = to.x + (b.inlet === W ? -50 : b.inlet === E ? 50 : 0);
  const startY = to.y + (b.inlet === N ? -50 : b.inlet === W || b.inlet === E ? 0 : 50);
  const endX = next.x;
  const endY = to.y + 50;
  return { x: startX + (endX - startX) * k, y: startY + (endY - startY) * k };
}

/** Outline of the union of pipe arms: two continuous walls, including corners/Ts. */
function drawPipe(ctx: CanvasRenderingContext2D, x: number, y: number, mask: number) {
  const half = BT_TILE / 2, gap = BT_TILE * 0.375;
  ctx.beginPath();
  for (let turn = 0; turn < 4; turn++) {
    const a = [N, E, S, W][turn] ?? N;
    const b = [E, S, W, N][turn] ?? E;
    const rotate = (px: number, py: number) => {
      for (let i = 0; i < turn; i++) [px, py] = [-py, px];
      return [x + px, y + py];
    };
    const line = (ax: number, ay: number, bx: number, by: number) => {
      const start = rotate(ax, ay), end = rotate(bx, by);
      ctx.moveTo(start[0] ?? x, start[1] ?? y);
      ctx.lineTo(end[0] ?? x, end[1] ?? y);
    };
    if (mask & a) line(gap, -half, gap, -gap);
    if (mask & b) line(gap, -gap, half, -gap);
    if (!(mask & a) && !(mask & b)) continue;
    if (!(mask & a)) line(-gap, -gap, gap, -gap);
    if (!(mask & b)) line(gap, -gap, gap, gap);
  }
  ctx.stroke();
}

const trackInks = new WeakMap<CanvasRenderingContext2D, Record<string, string>>();
function drawingInks(ctx: CanvasRenderingContext2D) {
  const cached = trackInks.get(ctx);
  if (cached) return cached;
  const styles = getComputedStyle(ctx.canvas);
  const inks: Record<string, string> = {};
  for (const key of ['background','cell','cell-alt','solid','guide','frame','rail','pipe','label','gold','pit','pit-border','error']) {
    inks[key] = styles.getPropertyValue(`--track-${key}`).trim();
  }
  trackInks.set(ctx, inks);
  return inks;
}

export function btDraw(ctx: CanvasRenderingContext2D, course: BtCourse, map: BtCellInfo[], s: BtState, preview?: { slider: number; pos: number }) {
  const T = BT_TILE;
  const ink = drawingInks(ctx);
  ctx.fillStyle = (ink["background"] ?? "transparent");
  ctx.fillRect(0, 0, BT_W, BT_H);
  // The queue approaches the central release track from the left.
  ctx.strokeStyle = (ink["rail"] ?? "transparent");
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(HOPPER.x - 270, 10);
  ctx.lineTo(HOPPER.x + 34, 10);
  ctx.lineTo(HOPPER.x + 34, 70);
  ctx.lineTo(HOPPER.x + 28, BT_HOPPER_H);
  ctx.moveTo(HOPPER.x - 270, 70);
  ctx.lineTo(HOPPER.x - 34, 70);
  ctx.lineTo(HOPPER.x - 28, BT_HOPPER_H);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const colour = course.balls[s.next + i];
    if (colour === undefined) continue;
    ctx.globalAlpha = i === 0 ? 1 : 0.65;
    ctx.fillStyle = BT_PALETTE[colour] ?? BT_PALETTE[0];
    ctx.beginPath();
    ctx.arc(HOPPER.x - i * 80, HOPPER.y, 25, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Grid cells.
  for (let cell = 0; cell < BT_COLS * BT_ROWS; cell++) {
    const { x, y } = centre(cell);
    const info = map[cell]!;
    ctx.fillStyle = (Math.floor(cell / BT_COLS) + cell) % 2 ? (ink["cell-alt"] ?? "transparent") : (ink["cell"] ?? "transparent");
    ctx.fillRect(x - T / 2, y - T / 2, T, T);
    if (info.kind === 0) {
      ctx.strokeStyle = (ink["guide"] ?? "transparent");
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 10]);
      ctx.beginPath();
      ctx.moveTo(x, y - T / 2 + 10);
      ctx.lineTo(x, y + T / 2 - 10);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (info.kind === 1) {
      const pipe = course.pipes[info.idx]!;
      const mask = rotMask(BT_PIPE_MASKS[pipe.shape]!, s.pipeRot[info.idx]!);
      ctx.lineCap = "butt";
      ctx.strokeStyle = (ink["pipe"] ?? "transparent");
      ctx.lineWidth = 3;
      drawPipe(ctx, x, y, mask);
    } else if (info.kind === 2) {
      const dir = s.flip[info.idx] ? 1 : -1;
      ctx.strokeStyle = (ink["frame"] ?? "transparent");
      ctx.lineWidth = 4;
      ctx.strokeRect(x - T / 2 + 8, y - T / 2 + 8, T - 16, T - 16);
      ctx.fillStyle = (ink["frame"] ?? "transparent");
      ctx.beginPath();
      ctx.arc(x, y - 18, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = (ink["gold"] ?? "transparent");
      ctx.lineWidth = 18;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y - 32);
      ctx.lineTo(x + dir * 40, y + 30);
      ctx.stroke();
      ctx.fillStyle = (ink["gold"] ?? "transparent");
      ctx.beginPath();
      ctx.moveTo(x + dir * 34, y + 44);
      ctx.lineTo(x + dir * 20, y + 36);
      ctx.lineTo(x + dir * 38, y + 28);
      ctx.fill();
    }
  }
  // Sliders.
  course.sliders.forEach((slider, i) => {
    const left = centre(slider.row * BT_COLS + slider.col);
    const y = left.y;
    ctx.strokeStyle = (ink["rail"] ?? "transparent");
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(left.x - T / 2 + 6, y + 30);
    ctx.lineTo(left.x - T / 2 + slider.len * T - 6, y + 30);
    ctx.stroke();
    const remaining = s.slUntil[i]! - s.tick;
    const frac = remaining > 0 ? 1 - remaining / BT_SLIDE_TICKS : 1;
    const pos = s.slFrom[i]! + (s.slTo[i]! - s.slFrom[i]!) * frac;
    const bx = left.x - T / 2 + pos * T;
    const slotX = bx + slider.slot * T + T / 2;
    const solidX = bx + (1 - slider.slot) * T;
    ctx.fillStyle = (ink["solid"] ?? "transparent");
    ctx.fillRect(solidX + 3, y - 26, T - 6, 52);
    ctx.strokeStyle = (ink["pipe"] ?? "transparent");
    ctx.lineWidth = 4;
    ctx.strokeRect(bx + 3, y - 26, 2 * T - 6, 52);
    ctx.beginPath();
    ctx.arc(slotX, y, 36, 0, Math.PI * 2);
    ctx.stroke();
    const dir = slider.slot === 1 ? 1 : -1, chevronX = solidX + T / 2;
    ctx.beginPath();
    ctx.moveTo(chevronX - dir * 10, y - 13);
    ctx.lineTo(chevronX + dir * 10, y);
    ctx.lineTo(chevronX - dir * 10, y + 13);
    ctx.stroke();
    if (preview?.slider === i) {
      ctx.globalAlpha = 0.3;
      ctx.setLineDash([8, 8]);
      ctx.strokeRect((slider.col + preview.pos + slider.slot) * T + 5, y + T / 2, T - 10, (BT_ROWS - slider.row - 1) * T);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  });
  // Paddle wheels: a rotating cross, circular rim and marked pocket.
  course.wheels.forEach((_, w) => {
    const p = pocketPoint(course, s, w, s.tick);
    ctx.strokeStyle = (ink["pipe"] ?? "transparent");
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.cx, p.cy, T * 0.95, 0, Math.PI * 2);
    ctx.stroke();
    for (let k = 0; k < 2; k++) {
      const a = p.angle + Math.PI / 4 + k * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(p.cx - Math.cos(a) * T * 0.9, p.cy - Math.sin(a) * T * 0.9);
      ctx.lineTo(p.cx + Math.cos(a) * T * 0.9, p.cy + Math.sin(a) * T * 0.9);
      ctx.stroke();
    }
    ctx.strokeStyle = (ink["gold"] ?? "transparent");
    ctx.beginPath();
    ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = (ink["label"] ?? "transparent");
    ctx.font = "32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("↺", p.cx - 65, p.cy + 11);
    ctx.fillText("↻", p.cx + 65, p.cy + 11);
  });
  // Trays and pits.
  const ty = BT_HOPPER_H + BT_ROWS * T;
  course.trays.forEach((tray, col) => {
    const x = col * T;
    if (tray < 0) {
      ctx.fillStyle = (ink["pit"] ?? "transparent");
      ctx.fillRect(x + 6, ty + 8, T - 12, BT_TRAY_H - 14);
      ctx.strokeStyle = (ink["pit-border"] ?? "transparent");
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 6, ty + 8, T - 12, BT_TRAY_H - 14);
    } else {
      ctx.fillStyle = BT_PALETTE[tray]!;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(x + 6, ty + 8, T - 12, BT_TRAY_H - 14);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = BT_PALETTE[tray]!;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x + 8, ty + 8);
      ctx.lineTo(x + 8, ty + BT_TRAY_H - 8);
      ctx.lineTo(x + T - 8, ty + BT_TRAY_H - 8);
      ctx.lineTo(x + T - 8, ty + 8);
      ctx.stroke();
    }
  });
  for (const mark of s.landings) {
    const age = s.tick - mark.tick;
    if (age > 40) continue;
    const x = mark.cell * T;
    ctx.globalAlpha = 1 - age / 40;
    ctx.fillStyle = mark.ok ? (ink["gold"] ?? "transparent") : (ink["error"] ?? "transparent");
    ctx.fillRect(x + 6, ty + 8, T - 12, BT_TRAY_H - 14);
    ctx.globalAlpha = 1;
  }
  // Falling (lost) balls.
  for (const mark of s.falls) {
    const age = s.tick - mark.tick;
    if (age > 30) continue;
    const p = mark.cell < 0 ? HOPPER : centre(mark.cell);
    ctx.globalAlpha = 1 - age / 30;
    ctx.fillStyle = BT_PALETTE[mark.colour]!;
    ctx.beginPath();
    ctx.arc(p.x + age * 1.5, p.y + age * age * 0.12, 25 * (1 - age / 45), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Balls.
  for (const b of s.balls) {
    const p = btBallPoint(course, s, b);
    ctx.fillStyle = BT_PALETTE[b.colour]!;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 25, 0, Math.PI * 2);
    ctx.fill();

  }
}

/* ================================ Game ================================= */

export const BT_INPUT_RANGES = [
  inputRange(BT_K_ROTATE, [0, BT_COLS * BT_ROWS - 1]),
  inputRange(BT_K_FLIP, [0, BT_COLS * BT_ROWS - 1]),
  inputRange(BT_K_SLIDE, [0, 3], [0, 2]),
  inputRange(BT_K_WHEEL, [0, 3], [0, 1]),
  inputRange(BT_K_RELEASE),
] as const;

export type BtGame = ArcadeGame<BtState, ArcadeInputEvent | null> & { course: BtCourse; map: BtCellInfo[] };

/** One game per stored course; the seed is unused because the course is the content. */
export function makeBallTrackGame(course: BtCourse): BtGame {
  const map = btCellMap(course);
  return {
    key: "balltrack",
    runTicks: BT_RUN_TICKS,
    course,
    map,
    init: () => btInit(course),
    step: (state, input) => btStep(course, map, state, input),
    isOver: btOver,
    score: btScore,
    draw: (ctx, state) => btDraw(ctx, course, map, state),
    inputRanges: BT_INPUT_RANGES,
  };
}
