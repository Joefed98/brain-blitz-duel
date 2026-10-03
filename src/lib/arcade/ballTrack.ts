/**
 * Ball Track: a deterministic 60-tick sim. A 7×7 grid of tube tiles forms one
 * snaking track from the entry above column 4 down to five trays and two pits.
 * Balls drop every 10 s and move one tile per BT_STEP_TICKS; the player taps
 * gold-outlined tiles to rotate them. The server replays the tap log.
 */

import { inputRange, type ArcadeGame, type ArcadeInputEvent } from "./engine";

/* ================================ Config ================================ */

export const BT_COLS = 7;
export const BT_ROWS = 7;
export const BT_BALLS = 8;
export const BT_COLOURS = 5;
export const BT_STEP_TICKS = 20;
export const BT_DROP_TICKS = 600; // a ball every 10 s
export const BT_RUN_TICKS = 5400; // 90 s
export const BT_HOPPER_COL = 3;
export const BT_MAX_STEPS = 60;
export const BT_CHECKPOINT_INTERVAL = 300;

export const BT_K_ROTATE = 12;

/** Side bits. */
export const N = 1, E = 2, S = 4, W = 8;
/** Tube shapes at rotation 0: straight, corner, T. */
export const BT_PIPE_MASKS = [N | S, N | E, E | S | W] as const;

/** Game palette: RED, BLUE, GREEN, PURPLE, YELLOW. */
export const BT_PALETTE = ["#FF4D4D", "#4D8CFF", "#3DDC84", "#B26BFF", "#FFE600"] as const;
export const BT_COLOUR_NAMES = ["Red", "Blue", "Green", "Purple", "Yellow"] as const;

/* ================================ Course ================================ */

export interface BtTile { shape: number; rot: number }
export interface BtCourse {
  /** Colour per bottom column (7), -1 = pit. */
  trays: number[];
  /** Ball colours in drop order. */
  balls: number[];
  /** 49 tiles, row-major; rot is the starting (scrambled) rotation. */
  tiles: BtTile[];
  /** Rotatable cell indices (sorted). */
  rotatable: number[];
}

export const rotMask = (mask: number, rot: number) => {
  let m = mask;
  for (let i = 0; i < (rot & 3); i++) m = ((m << 1) | (m >> 3)) & 15;
  return m;
};
export const opposite = (side: number) => (side === N ? S : side === S ? N : side === E ? W : E);

/** Side a ball leaves through after entering via `inlet`: gravity first, then straight on, then E, W, N. -1 = not connected. */
export function exitSide(mask: number, inlet: number): number {
  if (!(mask & inlet)) return -1;
  const rest = mask & ~inlet;
  if (rest & S) return S;
  const opp = opposite(inlet);
  if (rest & opp) return opp;
  for (const side of [E, W, N]) if (rest & side) return side;
  return -1;
}

const LOST = -2;
const SLOT = 100;

/** Next step from `cell` leaving via `side`: neighbour cell, SLOT + column, or LOST. */
export function stepFrom(cell: number, side: number): number {
  const r = Math.floor(cell / BT_COLS), c = cell % BT_COLS;
  if (side === S) return r === BT_ROWS - 1 ? SLOT + c : cell + BT_COLS;
  if (side === N) return r === 0 ? LOST : cell - BT_COLS;
  if (side === E) return c === BT_COLS - 1 ? LOST : cell + 1;
  if (side === W) return c === 0 ? LOST : cell - 1;
  return LOST;
}

/** Static route with the given rotations (indexed per cell): column landed in, or -1 lost. */
export function btRoute(course: BtCourse, rots: number[]): { col: number; steps: number } {
  let cell = BT_HOPPER_COL, inlet = N;
  for (let steps = 1; steps <= BT_MAX_STEPS; steps++) {
    const t = course.tiles[cell]!;
    const out = exitSide(rotMask(BT_PIPE_MASKS[t.shape]!, rots[cell]!), inlet);
    if (out < 0) return { col: -1, steps };
    const next = stepFrom(cell, out);
    if (next === LOST) return { col: -1, steps };
    if (next >= SLOT) return { col: next - SLOT, steps };
    cell = next;
    inlet = opposite(out);
  }
  return { col: -1, steps: BT_MAX_STEPS };
}

/* ================================ State ================================ */

export interface BtBall {
  id: number;
  colour: number;
  /** -1 = hopper, 0..48 cell, 100+col = dropping into a tray. */
  cell: number;
  from: number;
  inlet: number;
  arrived: number;
  /** Earliest tick the ball may move on. */
  at: number;
  steps: number;
  /** 1 = reached a tile that doesn't connect; it is lost there. */
  dead: number;
}

export interface BtMark { cell: number; colour: number; tick: number; ok: number }

export interface BtState {
  tick: number;
  rot: number[];
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

export const btMask = (course: BtCourse, s: BtState, cell: number) =>
  rotMask(BT_PIPE_MASKS[course.tiles[cell]!.shape]!, s.rot[cell]!);

export function btInit(course: BtCourse): BtState {
  return {
    tick: 0,
    rot: course.tiles.map((t) => t.rot & 3),
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

export function btStep(course: BtCourse, rotatable: Set<number>, prev: BtState, input: ArcadeInputEvent | null): BtState {
  const s: BtState = { ...prev, tick: prev.tick + 1, rot: [...prev.rot], balls: prev.balls.map((b) => ({ ...b })) };
  const t = s.tick;

  if (input && input.k === BT_K_ROTATE && rotatable.has(input.a) && !s.balls.some((b) => b.cell === input.a)) {
    s.rot[input.a] = (s.rot[input.a]! + 1) & 3;
    s.actions++;
  }

  if (s.next < BT_BALLS && (t - 1) % BT_DROP_TICKS === 0) {
    s.balls.push({ id: s.next, colour: course.balls[s.next]!, cell: -1, from: -1, inlet: N, arrived: t, at: t + BT_STEP_TICKS, steps: 0, dead: 0 });
    s.next++;
  }

  const removed = new Set<number>();
  const lose = (ball: BtBall, cell: number) => {
    s.falls = keep(s.falls, { cell, colour: ball.colour, tick: t, ok: 0 });
    s.lost++;
    s.lastLand = t;
    removed.add(ball.id);
  };
  for (const ball of s.balls) {
    if (t < ball.at) continue;
    if (ball.dead) { lose(ball, ball.cell); continue; }
    if (ball.cell >= SLOT) {
      const col = ball.cell - SLOT;
      const tray = course.trays[col]!;
      if (tray === ball.colour) s.home++;
      else if (tray < 0) s.lost++;
      else s.wrong++;
      s.lastLand = t;
      s.landings = keep(s.landings, { cell: col, colour: ball.colour, tick: t, ok: tray === ball.colour ? 1 : 0 });
      removed.add(ball.id);
      continue;
    }
    let target: number, entry = N;
    if (ball.cell < 0) target = BT_HOPPER_COL;
    else {
      const out = exitSide(btMask(course, s, ball.cell), ball.inlet);
      target = out < 0 ? LOST : stepFrom(ball.cell, out);
      entry = out < 0 ? N : opposite(out);
    }
    if (target === LOST || ball.steps >= BT_MAX_STEPS) { lose(ball, ball.cell); continue; }
    if (target < SLOT && s.balls.some((b) => b.id !== ball.id && !removed.has(b.id) && b.cell === target)) continue; // waits behind
    ball.from = ball.cell;
    ball.cell = target;
    ball.inlet = entry;
    ball.arrived = t;
    ball.at = t + BT_STEP_TICKS;
    ball.steps++;
    if (target < SLOT && !(btMask(course, s, target) & entry)) ball.dead = 1;
  }
  if (removed.size) s.balls = s.balls.filter((b) => !removed.has(b.id));
  return s;
}

export function btOver(s: BtState): boolean {
  return s.tick >= BT_RUN_TICKS || (s.next >= BT_BALLS && s.balls.length === 0);
}

/** round(150 × home ÷ 8) − 5 per wrong tray, 0–150. */
export function btScoreOf(home: number, wrong: number): number {
  const base = Math.floor((300 * home + BT_BALLS) / (2 * BT_BALLS));
  return Math.max(0, Math.min(150, base - 5 * wrong));
}

export function btScore(s: BtState): number {
  return btScoreOf(s.home, s.wrong);
}

/* ============================= Checkpoints ============================= */

export const BT_CHECKPOINT_KEYS = ["tick", "next", "home", "wrong", "lost", "flying", "checksum"] as const;
export interface BtCheckpoint {
  tick: number; next: number; home: number; wrong: number; lost: number; flying: number; checksum: number;
}

export function btCheckpoint(s: BtState): BtCheckpoint {
  const snap = { tick: s.tick, next: s.next, home: s.home, wrong: s.wrong, lost: s.lost, flying: s.balls.length };
  const values: number[] = [...Object.values(snap), s.actions, s.lastLand, ...s.rot];
  for (const b of s.balls) values.push(b.id, b.cell, b.at, b.inlet, b.steps, b.dead);
  let checksum = 0x811c9dc5;
  for (const v of values) {
    checksum ^= v | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snap, checksum };
}

/* ================================ Drawing ================================ */

export const BT_TILE = 100;
export const BT_HOPPER_H = 80;
export const BT_TRAY_H = 70;
export const BT_W = BT_COLS * BT_TILE;
export const BT_H = BT_HOPPER_H + BT_ROWS * BT_TILE + BT_TRAY_H;
const BALL_R = 20;
const BG = "#12161C";
const TUBE = "#5A6270";
const GOLD = "#F5B82E";

const cellCentre = (cell: number) => ({
  x: (cell % BT_COLS) * BT_TILE + BT_TILE / 2,
  y: BT_HOPPER_H + Math.floor(cell / BT_COLS) * BT_TILE + BT_TILE / 2,
});
const pointOf = (cell: number) => {
  if (cell < 0) return { x: BT_HOPPER_COL * BT_TILE + BT_TILE / 2, y: BT_HOPPER_H / 2 };
  if (cell >= SLOT) return { x: (cell - SLOT) * BT_TILE + BT_TILE / 2, y: BT_HOPPER_H + BT_ROWS * BT_TILE + BT_TRAY_H / 2 };
  return cellCentre(cell);
};

export function btBallPoint(s: BtState, b: BtBall) {
  const a = pointOf(b.from), z = pointOf(b.cell);
  const k = Math.max(0, Math.min(1, (s.tick - b.arrived) / BT_STEP_TICKS));
  return { x: a.x + (z.x - a.x) * k, y: a.y + (z.y - a.y) * k };
}

function tubePath(ctx: CanvasRenderingContext2D, cell: number, mask: number) {
  const { x, y } = cellCentre(cell);
  const h = BT_TILE / 2;
  const end = (side: number) => ({ x: x + (side === E ? h : side === W ? -h : 0), y: y + (side === S ? h : side === N ? -h : 0) });
  const sides = [N, E, S, W].filter((side) => mask & side);
  if (sides.length === 2 && !(mask === (N | S) || mask === (E | W))) {
    const a = end(sides[0]!), b = end(sides[1]!);
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(x, y, b.x, b.y);
  } else if (sides.length === 2) {
    const a = end(sides[0]!), b = end(sides[1]!);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  } else {
    for (const side of sides) {
      const p = end(side);
      ctx.moveTo(x, y);
      ctx.lineTo(p.x, p.y);
    }
  }
}

export function btDraw(ctx: CanvasRenderingContext2D, course: BtCourse, s: BtState) {
  const gridY = BT_HOPPER_H;
  ctx.fillStyle = BG;
  ctx.fillRect(0, gridY, BT_W, BT_ROWS * BT_TILE);
  // Tubes: a wide grey stroke with a background stroke inside leaves two parallel lines.
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";
  for (const [width, colour] of [[BALL_R * 3 + 6, TUBE], [BALL_R * 3, BG]] as const) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let cell = 0; cell < course.tiles.length; cell++) tubePath(ctx, cell, btMask(course, s, cell));
    ctx.stroke();
  }
  // Rotatable tiles.
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  for (const cell of course.rotatable) {
    const x = (cell % BT_COLS) * BT_TILE, y = gridY + Math.floor(cell / BT_COLS) * BT_TILE;
    ctx.strokeRect(x + 3, y + 3, BT_TILE - 6, BT_TILE - 6);
  }
  // Trays and pits.
  const trayY = gridY + BT_ROWS * BT_TILE + 6;
  course.trays.forEach((tray, col) => {
    const x = col * BT_TILE + 6, w = BT_TILE - 12, h = BT_TRAY_H - 10;
    const flash = s.landings.some((m) => m.cell === col && s.tick - m.tick < 30);
    if (tray < 0) {
      ctx.fillStyle = "#07090C";
      ctx.fillRect(x, trayY, w, h);
    } else {
      ctx.globalAlpha = flash ? 0.6 : 0.22;
      ctx.fillStyle = BT_PALETTE[tray]!;
      ctx.fillRect(x, trayY, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = BT_PALETTE[tray]!;
      ctx.lineWidth = 4;
      ctx.strokeRect(x, trayY, w, h);
    }
  });
  // Lost balls fade where they fell.
  for (const m of s.falls) {
    const age = s.tick - m.tick;
    if (age >= 40) continue;
    const p = pointOf(m.cell);
    ctx.globalAlpha = 1 - age / 40;
    ctx.strokeStyle = BT_PALETTE[m.colour]!;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, BALL_R + age / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Hopper: the next ball above column 4, the rest queued to its left.
  const hy = BT_HOPPER_H / 2;
  for (let i = s.next; i < BT_BALLS; i++) {
    const x = BT_HOPPER_COL * BT_TILE + BT_TILE / 2 - (i - s.next) * 50 - (i > s.next ? 20 : 0);
    ctx.fillStyle = BT_PALETTE[course.balls[i]!]!;
    ctx.globalAlpha = i === s.next ? 1 : 0.55;
    ctx.beginPath();
    ctx.arc(x, hy, i === s.next ? BALL_R : BALL_R * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (i === s.next) {
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, hy, BALL_R + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // Balls in play.
  for (const b of s.balls) {
    const p = btBallPoint(s, b);
    ctx.fillStyle = BT_PALETTE[b.colour]!;
    ctx.beginPath();
    ctx.arc(p.x, p.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ================================ Game ================================= */

export const BT_INPUT_RANGES = [inputRange(BT_K_ROTATE, [0, BT_COLS * BT_ROWS - 1])] as const;

export type BtGame = ArcadeGame<BtState, ArcadeInputEvent | null> & { course: BtCourse; rotatable: Set<number> };

/** One game per stored course; the seed is unused because the course is the content. */
export function makeBallTrackGame(course: BtCourse): BtGame {
  const rotatable = new Set(course.rotatable);
  return {
    key: "balltrack",
    runTicks: BT_RUN_TICKS,
    course,
    rotatable,
    init: () => btInit(course),
    step: (state, input) => btStep(course, rotatable, state, input),
    isOver: btOver,
    score: btScore,
    draw: (ctx, state) => btDraw(ctx, course, state),
    inputRanges: BT_INPUT_RANGES,
  };
}
