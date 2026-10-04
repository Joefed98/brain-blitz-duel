/**
 * Ball Track: a deterministic 60-tick sim. A fixed 7×9 serpentine of straights
 * and corners; tapping a gold straight toggles it vertical so balls drop through
 * to the next row (or the tray in the fixed bottom row). Balls drop every 2 s. The server replays the tap log.
 */

import { inputRange, type ArcadeGame, type ArcadeInputEvent } from "./engine";

/* ================================ Config ================================ */

export const BT_COLS = 7;
export const BT_ROWS = 9;
export const BT_BALLS = 20;
export const BT_COLOURS = 5;
export const BT_STEP_TICKS = 10;
export const BT_DROP_TICKS = 120; // a ball every 2 s
export const BT_RUN_TICKS = 3600; // 60 s
export const BT_HOPPER_COL = 3;
export const BT_CHECKPOINT_INTERVAL = 300;

export const BT_K_ROTATE = 12;

/** Side bits. */
export const N = 1, E = 2, S = 4, W = 8;

/** Game palette: RED, BLUE, GREEN, PURPLE, YELLOW. */
export const BT_PALETTE = ["#FF4D4D", "#4D8CFF", "#3DDC84", "#B26BFF", "#FFE600"] as const;
export const BT_COLOUR_NAMES = ["Red", "Blue", "Green", "Purple", "Yellow"] as const;

/* ================================ Track ================================= */

/** Row direction: row 1 runs right, row 2 left, and so on. */
export const rowDir = (row: number) => (row % 2 === 0 ? 1 : -1);
/** Tile kind per cell: 0 empty, 1 straight, 2 corner. Fixed serpentine. */
export const BT_KIND: number[] = [];
/** Corner side masks (0 for non-corners). */
export const BT_CORNER: number[] = [];
for (let r = 0; r < BT_ROWS; r++)
  for (let c = 0; c < BT_COLS; c++) {
    const d = rowDir(r);
    const start = r === 0 ? BT_HOPPER_COL : d > 0 ? 0 : BT_COLS - 1;
    const end = d > 0 ? BT_COLS - 1 : 0;
    const onRow = d > 0 ? c >= start : c <= start;
    let kind = onRow ? 1 : 0, mask = 0;
    if (r === BT_ROWS - 1) { kind = c === end ? 2 : 1; mask = c === end ? W | S : 0; }
    else if (onRow && c === start) { kind = 2; mask = N | (d > 0 ? E : W); }
    else if (onRow && c === end && r < BT_ROWS - 1) { kind = 2; mask = S | (d > 0 ? W : E); }
    BT_KIND.push(kind);
    BT_CORNER.push(mask);
  }
/** Straights fixed in every course: column 4, rows 1–6. */
export const BT_ALWAYS_FIXED = Array.from({ length: 6 }, (_, r) => r * BT_COLS + BT_HOPPER_COL).filter((c) => BT_KIND[c] === 1);

/* ================================ Course ================================ */

export interface BtCourse {
  /** Colour per bottom column (7), -1 = pit. */
  trays: number[];
  /** Ball colours in drop order. */
  balls: number[];
  /** Seeded extra fixed straights (rows 1–8; bottom row is always fixed). */
  fixed: number[];
}

/** Rotatable straights: every straight not in column 4 rows 1–6 and not a seeded fixed tile. */
export function btRotatable(course: BtCourse): number[] {
  const fixed = new Set([...BT_ALWAYS_FIXED, ...course.fixed]);
  return BT_KIND.flatMap((k, cell) => (k === 1 && cell < (BT_ROWS - 1) * BT_COLS && !fixed.has(cell) ? [cell] : []));
}

const PIT = -2;
const SLOT = 100;

/** Next cell for a ball in `cell` (arrived from above if `fromAbove`): neighbour, SLOT + column, or PIT. */
export function btNext(cell: number, fromAbove: boolean, vertical: boolean, course?: BtCourse): { cell: number; fromAbove: boolean } {
  const r = Math.floor(cell / BT_COLS), c = cell % BT_COLS;
  const down = r === BT_ROWS - 1 ? (course?.trays[c] ?? -1) >= 0 || c === BT_COLS - 1 : BT_KIND[cell] === 2 ? !fromAbove : vertical;
  if (down) return r === BT_ROWS - 1 ? { cell: SLOT + c, fromAbove: true } : { cell: cell + BT_COLS, fromAbove: true };
  const nc = c + rowDir(r);
  if (nc < 0 || nc >= BT_COLS) return { cell: PIT, fromAbove: false };
  return { cell: cell + rowDir(r), fromAbove: false };
}

/* ================================ State ================================ */

export interface BtBall {
  id: number;
  colour: number;
  /** -1 = hopper, 0..62 cell, 100+col = dropping into a tray. */
  cell: number;
  from: number;
  /** 1 = entered its tile from above. */
  above: number;
  arrived: number;
  /** Earliest tick the ball may move on. */
  at: number;
  steps: number;
}

export interface BtMark { cell: number; colour: number; tick: number; ok: number }

export interface BtState {
  tick: number;
  /** Per cell: 1 = straight turned vertical. */
  vert: number[];
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

export function btInit(_course: BtCourse): BtState {
  return {
    tick: 0,
    vert: BT_KIND.map(() => 0),
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
  const s: BtState = { ...prev, tick: prev.tick + 1, vert: [...prev.vert], balls: prev.balls.map((b) => ({ ...b })) };
  const t = s.tick;

  if (input && input.k === BT_K_ROTATE && rotatable.has(input.a) && !s.balls.some((b) => b.cell === input.a)) {
    s.vert[input.a] = s.vert[input.a] ? 0 : 1;
    s.actions++;
  }

  if (s.next < BT_BALLS && (t - 1) % BT_DROP_TICKS === 0) {
    s.balls.push({ id: s.next, colour: course.balls[s.next]!, cell: -1, from: -1, above: 1, arrived: t, at: t + BT_STEP_TICKS, steps: 0 });
    s.next++;
  }

  const removed = new Set<number>();
  for (const ball of s.balls) {
    if (t < ball.at) continue;
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
    const next = ball.cell < 0 ? { cell: BT_HOPPER_COL, fromAbove: true } : btNext(ball.cell, ball.above === 1, s.vert[ball.cell] === 1, course);
    if (next.cell === PIT) {
      s.falls = keep(s.falls, { cell: ball.cell, colour: ball.colour, tick: t, ok: 0 });
      s.lost++;
      s.lastLand = t;
      removed.add(ball.id);
      continue;
    }
    if (next.cell < SLOT && s.balls.some((b) => b.id !== ball.id && !removed.has(b.id) && b.cell === next.cell)) continue; // waits behind
    ball.from = ball.cell;
    ball.cell = next.cell;
    ball.above = next.fromAbove ? 1 : 0;
    ball.arrived = t;
    ball.at = t + BT_STEP_TICKS;
    ball.steps++;
  }
  if (removed.size) s.balls = s.balls.filter((b) => !removed.has(b.id));
  return s;
}

export function btOver(s: BtState): boolean {
  return s.tick >= BT_RUN_TICKS || (s.next >= BT_BALLS && s.balls.length === 0);
}

/** round(150 × home ÷ ball count) − 5 per wrong tray, 0–150. */
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
  const values: number[] = [...Object.values(snap), s.actions, s.lastLand, ...s.vert];
  for (const b of s.balls) values.push(b.id, b.cell, b.at, b.above, b.steps);
  let checksum = 0x811c9dc5;
  for (const v of values) {
    checksum ^= v | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snap, checksum };
}

/* ================================ Drawing ================================ */

export const BT_TILE = 100;
export const BT_HOPPER_H = 58;
export const BT_TRAY_H = 42;
export const BT_W = BT_COLS * BT_TILE;
export const BT_H = BT_HOPPER_H + BT_ROWS * BT_TILE + BT_TRAY_H;
const BALL_R = 22.5;
const BG = "#12161C";
const TUBE = "#F5B82E";
const TUBE_FIXED = "#6A7280";

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
  const h = BT_TILE / 2 - 2; // paired insets give about a 2 px gap at phone scale
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

export function btDraw(ctx: CanvasRenderingContext2D, course: BtCourse, s: BtState, rotatable?: Set<number>) {
  const gridY = BT_HOPPER_H;
  const rot = rotatable ?? new Set(btRotatable(course));
  ctx.fillStyle = BG;
  ctx.fillRect(0, gridY, BT_W, BT_ROWS * BT_TILE);
  const maskOf = (cell: number) => (cell >= (BT_ROWS - 1) * BT_COLS && (course.trays[cell % BT_COLS] ?? -1) >= 0 ? N | S : BT_KIND[cell] === 2 ? BT_CORNER[cell]! : s.vert[cell] ? N | S : E | W);
  // Two parallel lines per piece: gold rotatable tubes and grey fixed tubes.
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";
  for (const movable of [false, true]) {
    for (const [width, colour] of [[BALL_R * 3 + 6, movable ? TUBE : TUBE_FIXED], [BALL_R * 3, BG]] as const) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let cell = 0; cell < BT_KIND.length; cell++) if (BT_KIND[cell] && rot.has(cell) === movable) tubePath(ctx, cell, maskOf(cell));
      ctx.stroke();
    }
  }
  // Trays and pits.
  const trayY = gridY + BT_ROWS * BT_TILE + 6;
  course.trays.forEach((tray, col) => {
    const x = col * BT_TILE + 6, w = BT_TILE - 12, h = BT_TRAY_H - 10;
    const flash = s.landings.some((m) => m.cell === col && s.tick - m.tick < 30);
    if (tray < 0) {
      // No tray below a non-drop column.
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
  const queueGap = Math.min(50, (BT_HOPPER_COL * BT_TILE + BT_TILE / 2 - 20 - BALL_R * 0.7) / (BT_BALLS - 1));
  for (let i = s.next; i < BT_BALLS; i++) {
    const x = BT_HOPPER_COL * BT_TILE + BT_TILE / 2 - (i - s.next) * queueGap - (i > s.next ? 20 : 0);
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
  const rotatable = new Set(btRotatable(course));
  return {
    key: "balltrack",
    runTicks: BT_RUN_TICKS,
    course,
    rotatable,
    init: () => btInit(course),
    step: (state, input) => btStep(course, rotatable, state, input),
    isOver: btOver,
    score: btScore,
    draw: (ctx, state) => btDraw(ctx, course, state, rotatable),
    inputRanges: BT_INPUT_RANGES,
  };
}
