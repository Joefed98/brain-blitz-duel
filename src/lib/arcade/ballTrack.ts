/**
 * Ball Track: a deterministic 60-tick sim. A fixed 7×9 serpentine of straights
 * and corners; tapping a gold straight toggles it vertical so balls drop through
 * to the next row (or the tray in the fixed bottom row). Balls drop every 103 ticks. The server replays the tap log.
 */

import { clampInt, finishScore, inputRange, type ArcadeGame, type ArcadeInputEvent } from "./engine";
import { speedBonusCurve } from "../duel/speedPar";
import { bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, BAND_FINISH_BONUS, type BandFields, type BandParts } from "./scoreBands";

/* ================================ Config ================================ */

export const BT_COLS = 7;
export const BT_ROWS = 9;
export const BT_BALLS = 30;
export const BT_COLOURS = 4;
export const BT_STEP_TICKS = 16;
/** Tray colours slide to their shuffled columns over this many ticks (~0.5 s). */
export const BT_SHUFFLE_TICKS = 30;
export const BT_DROP_TICKS = 103; // last of 30 releases at tick 2988 (49.8 s)
export const BT_RUN_TICKS = 3600; // 60 s
export const BT_HOPPER_COL = 3;
export const BT_CHECKPOINT_INTERVAL = 300;

export const BT_K_ROTATE = 12;

/**
 * btRev 2 (stored as puzzle.btRev): tubes turn even with a marble inside (it
 * rides the turn and leaves by the new exit), and every tray drop in the bottom
 * row is a switch point: tap it to send marbles on along the row instead. Same
 * tap input (cell index); rounds without btRev replay on the original rules.
 */
export const BT_REV = 2;
/** Render only: a turned tube (and any marble in it) swings round over this many ticks. */
export const BT_TURN_TICKS = 8;

/** Side bits. */
export const N = 1, E = 2, S = 4, W = 8;

/** Game palette: RED, BLUE, GREEN, YELLOW. */
export const BT_PALETTE = ["#FF4D4D", "#4D8CFF", "#3DDC84", "#FFE600"] as const;
export const BT_COLOUR_NAMES = ["Red", "Blue", "Green", "Yellow"] as const;

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
    if (r === BT_ROWS - 1) { kind = c === 0 ? 2 : 1; mask = c === 0 ? N | E : 0; } // entry corner + six fixed straights
    else if (onRow && c === start) { kind = 2; mask = N | (d > 0 ? E : W); }
    else if (onRow && c === end && r < BT_ROWS - 1) { kind = 2; mask = S | (d > 0 ? W : E); }
    BT_KIND.push(kind);
    BT_CORNER.push(mask);
  }
/** Straights fixed in every course: column 4, rows 1–6. */
export const BT_ALWAYS_FIXED = Array.from({ length: 6 }, (_, r) => r * BT_COLS + BT_HOPPER_COL).filter((c) => BT_KIND[c] === 1);

/* ================================ Course ================================ */

export interface BtCourse {
  /** Colour per bottom column (7), -1 = no drop. */
  trays: number[];
  /** Seeded bottom-row re-lay (40–30 s left): drops move to new columns, each tray moving with its drop. */
  relay: { tick: number; trays: number[] };
  /** Seeded tray colour shuffle (20–15 s left) over the re-laid drop columns. */
  shuffle: { tick: number; trays: number[] };
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

/** Bottom-row layout (drop columns and their tray colours) live at tick `t`. */
export function btTraysAt(course: BtCourse, t: number): number[] {
  return t >= course.shuffle.tick ? course.shuffle.trays : t >= course.relay.tick ? course.relay.trays : course.trays;
}

/** Render-only warning from stored event ticks; never changes replay state. */
export function btEventCountdown(course: BtCourse, tick: number): number | null {
  for (const event of [course.relay, course.shuffle]) {
    const remaining = event.tick - tick;
    if (remaining > 0 && remaining <= 5 * 60) return Math.ceil(remaining / 60);
  }
  return null;
}
const SLOT = 100;

/** Rev 2: true when the switch point at this bottom-row column sends marbles on (its tray drop is shut). */
export function btSwitchedOn(sw: number | undefined, col: number): boolean {
  return ((sw ?? 0) >> col) & 1 ? true : false;
}

/** Next cell for a ball in `cell` (arrived from above if `fromAbove`): neighbour, SLOT + column, or PIT. */
export function btNext(cell: number, fromAbove: boolean, vertical: boolean, course?: BtCourse, tick = 0, sw = 0): { cell: number; fromAbove: boolean } {
  const r = Math.floor(cell / BT_COLS), c = cell % BT_COLS;
  const down = r === BT_ROWS - 1
    ? c > 0 && (course ? btTraysAt(course, tick)[c]! : -1) >= 0 && !btSwitchedOn(sw, c)
    : BT_KIND[cell] === 2 ? !fromAbove : vertical;
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
  /** btRev 2: 1 = rode a tube turn, 2 = passed a switch point (absent on original rounds). */
  via?: number;
}

export interface BtMark { cell: number; colour: number; tick: number; ok: number }

export interface BtState extends BandFields {
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
  /** btRev 2 only (absent on original rounds): the stamp, switch-point bits per bottom column, last turn tick per cell. */
  rev?: number;
  sw?: number;
  turned?: number[];
  /** Rev 2 success counters: marbles home after riding a turn / after passing a switch point. */
  rideHomes?: number;
  switchHomes?: number;
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

const BOTTOM = (BT_ROWS - 1) * BT_COLS;

export function btStep(course: BtCourse, rotatable: Set<number>, prev: BtState, input: ArcadeInputEvent | null): BtState {
  const s: BtState = { ...prev, tick: prev.tick + 1, vert: [...prev.vert], balls: prev.balls.map((b) => ({ ...b })) };
  const t = s.tick;
  const v2 = s.rev === BT_REV;

  if (input && input.k === BT_K_ROTATE && rotatable.has(input.a) && (v2 || !s.balls.some((b) => b.cell === input.a))) {
    s.vert[input.a] = s.vert[input.a] ? 0 : 1;
    s.actions++;
    if (v2) {
      s.turned = [...(s.turned ?? [])];
      s.turned[input.a] = t;
      for (const b of s.balls) if (b.cell === input.a) b.via = (b.via ?? 0) | 1;
    }
  } else if (v2 && input && input.k === BT_K_ROTATE && input.a > BOTTOM && input.a < BOTTOM + BT_COLS &&
      (btTraysAt(course, t)[input.a - BOTTOM] ?? -1) >= 0) {
    // A switch point: only where a tray drop is live right now.
    s.sw = (s.sw ?? 0) ^ (1 << (input.a - BOTTOM));
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
      const tray = btTraysAt(course, t)[col]!;
      if (tray === ball.colour) {
        s.home++;
        if (v2 && (ball.via ?? 0) & 1) s.rideHomes = (s.rideHomes ?? 0) + 1;
        if (v2 && (ball.via ?? 0) & 2) s.switchHomes = (s.switchHomes ?? 0) + 1;
      }
      else if (tray < 0) s.lost++;
      else s.wrong++;
      s.lastLand = t;
      s.landings = keep(s.landings, { cell: col, colour: ball.colour, tick: t, ok: tray === ball.colour ? 1 : 0 });
      removed.add(ball.id);
      continue;
    }
    const next = ball.cell < 0 ? { cell: BT_HOPPER_COL, fromAbove: true } : btNext(ball.cell, ball.above === 1, s.vert[ball.cell] === 1, course, t, s.sw);
    if (next.cell === PIT) {
      s.falls = keep(s.falls, { cell: ball.cell, colour: ball.colour, tick: t, ok: 0 });
      s.lost++;
      s.lastLand = t;
      removed.add(ball.id);
      continue;
    }
    if (next.cell < SLOT && s.balls.some((b) => b.id !== ball.id && !removed.has(b.id) && b.cell === next.cell)) continue; // waits behind
    if (v2 && ball.cell > BOTTOM && ball.cell < BOTTOM + BT_COLS && next.cell < SLOT &&
        (btTraysAt(course, t)[ball.cell - BOTTOM] ?? -1) >= 0) ball.via = (ball.via ?? 0) | 2;
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

/** Perfect-run speed bonus: round(20 × (run ticks − last landing) ÷ run ticks). */
export function btSpeedBonus(home: number, lastLand: number, rev?: number | null): number {
  if (home !== BT_BALLS) return 0;
  if (rev === BT_REV) return btScoreOfV2(home, lastLand) - 130;
  return finishScore(BT_RUN_TICKS, lastLand) - 130;
}

/**
 * The earliest tick the last marble can land: it is released at tick 2988 and
 * needs at least 12 sixteen-tick steps (hopper, row 1, down column 5 to its cup).
 * Under the original rules the speed bonus is measured against the 60 s run, so a
 * perfect run tops out at 130 + 5 (BT_LEGACY_PERFECT_MAX). arcade-batch1-check
 * proves both figures.
 */
export const BT_LAST_LAND_MIN = 3180;
export const BT_LEGACY_PERFECT_MAX = 135;

/**
 * btRev 2: all home = 130 + the 50 % par speed bonus measured over the window the
 * last marble can actually land in (tick 3180 to the buzzer): the full 20 if it
 * lands within the first half of that window, then an even fall to 0 at 60 s.
 */
export function btScoreOfV2(home: number, lastLand = BT_RUN_TICKS): number {
  if (home < BT_BALLS) return Math.max(0, Math.min(130, Math.round((130 * home) / BT_BALLS)));
  const window = BT_RUN_TICKS - BT_LAST_LAND_MIN;
  const left = BT_RUN_TICKS - Math.max(BT_LAST_LAND_MIN, Math.min(BT_RUN_TICKS, lastLand));
  return clampInt(130 + speedBonusCurve(20, left, window), 0, 150);
}

/** round(130 × home ÷ ball count); all home = 130 + speed bonus; wrong trays have no penalty. */
export function btScoreOf(home: number, _wrong: number, lastLand = BT_RUN_TICKS): number {
  if (home >= BT_BALLS) return finishScore(BT_RUN_TICKS, lastLand);
  return Math.max(0, Math.min(130, Math.round((130 * home) / BT_BALLS)));
}

export function btScore(s: BtState): number {
  if (s.rev === BT_REV) return btScoreOfV2(s.home, s.lastLand);
  return btScoreOf(s.home, s.wrong, s.lastLand);
}

/* ============================= Checkpoints ============================= */

export const BT_CHECKPOINT_KEYS = ["tick", "next", "home", "wrong", "lost", "flying", "checksum"] as const;
export interface BtCheckpoint {
  tick: number; next: number; home: number; wrong: number; lost: number; flying: number; checksum: number;
}

export function btCheckpoint(s: BtState): BtCheckpoint {
  const snap = { tick: s.tick, next: s.next, home: s.home, wrong: s.wrong, lost: s.lost, flying: s.balls.length };
  const values: number[] = [...Object.values(snap), s.actions, s.lastLand, ...s.vert];
  // Rev 2 also folds the switch points in (same encoded keys).
  if (s.rev === BT_REV) values.push(s.sw ?? 0);
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
  const maskOf = (cell: number) => (cell >= (BT_ROWS - 1) * BT_COLS && (btTraysAt(course, s.tick)[cell % BT_COLS] ?? -1) >= 0 && !btSwitchedOn(s.sw, cell % BT_COLS) ? N | S : BT_KIND[cell] === 2 ? BT_CORNER[cell]! : s.vert[cell] ? N | S : E | W);
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
  // Trays: after the shuffle each colour flashes and slides from its old column to its new one.
  const trayY = gridY + BT_ROWS * BT_TILE + 6;
  // Latest bottom-row event (re-lay or colour shuffle) animates from the layout before it.
  const event = s.tick >= course.shuffle.tick ? course.shuffle : s.tick >= course.relay.tick ? course.relay : null;
  const prior = event ? btTraysAt(course, event.tick - 1) : course.trays;
  const since = event ? s.tick - event.tick : -1;
  const k = since < 0 ? 0 : Math.min(1, since / BT_SHUFFLE_TICKS);
  const ease = k * k * (3 - 2 * k);
  const shuffleFlash = since >= 0 && since < BT_SHUFFLE_TICKS + 20 && Math.floor(since / 5) % 2 === 0;
  const now = btTraysAt(course, s.tick);
  prior.forEach((tray, from) => {
    if (tray < 0) return;
    const to = event ? event.trays.indexOf(tray) : from;
    const col = from + (to - from) * ease;
    const x = col * BT_TILE + 6, w = BT_TILE - 12, h = BT_TRAY_H - 10;
    const landed = now.indexOf(tray);
    const flash = shuffleFlash || s.landings.some((m) => m.cell === landed && s.tick - m.tick < 30);
    ctx.globalAlpha = flash ? 0.6 : 0.22;
    ctx.fillStyle = BT_PALETTE[tray]!;
    ctx.fillRect(x, trayY, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = shuffleFlash ? "#FFFFFF" : BT_PALETTE[tray]!;
    ctx.lineWidth = 4;
    ctx.strokeRect(x, trayY, w, h);
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
  // Show six upcoming balls, keeping the lead ball full-sized above column 4.
  const hy = BT_HOPPER_H / 2;
  const countdown = btEventCountdown(course, s.tick);
  if (countdown !== null) {
    ctx.save();
    ctx.fillStyle = TUBE;
    ctx.font = '24px "JetBrains Mono", monospace';
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(String(countdown), BT_W - 12, hy);
    ctx.restore();
  }
  const leadX = BT_HOPPER_COL * BT_TILE + BT_TILE / 2;
  const queueGap = BALL_R; // half a full ball diameter of clear space; never compress it
  const leadOutline = BALL_R + 6 + 1.5;
  const queuedRadius = Math.min(BALL_R, (leadX - 4 - leadOutline - 5 * queueGap) / 10);
  for (let i = s.next; i < Math.min(BT_BALLS, s.next + 6); i++) {
    const offset = i - s.next;
    const x = offset === 0 ? leadX : leadX - leadOutline - queueGap - queuedRadius - (offset - 1) * (queuedRadius * 2 + queueGap);
    ctx.fillStyle = BT_PALETTE[course.balls[i]!]!;
    ctx.globalAlpha = i === s.next ? 1 : 0.55;
    ctx.beginPath();
    ctx.arc(x, hy, offset === 0 ? BALL_R : queuedRadius, 0, Math.PI * 2);
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

/** One game per stored course (and puzzle.btRev); the seed is unused because the course is the content. */
export function makeBallTrackGame(course: BtCourse, rev?: number | null): BtGame {
  const rotatable = new Set(btRotatable(course));
  return {
    key: "balltrack",
    runTicks: BT_RUN_TICKS,
    course,
    rotatable,
    init: () => {
      // btRev 3 (score bands) plays the rev-2 rules.
      const state = rev === BT_REV || rev === BT_REV_BAND
        ? { ...btInit(course), rev: BT_REV, sw: 0, turned: BT_KIND.map(() => -1000), rideHomes: 0, switchHomes: 0 }
        : btInit(course);
      return rev === BT_REV_BAND ? bandInit(state) : state;
    },
    step: bandStep((state, input) => btStep(course, rotatable, state, input)),
    isOver: btOver,
    score: bandScoreOf(btScore, scoreBand),
    draw: (ctx, state) => btDraw(ctx, course, state, rotatable),
    inputRanges: BT_INPUT_RANGES,
  };
}

/* ================= Oct 2026 score bands (btRev 3) ================= */

/** Score-band revision (puzzle.btRev = 3): rev-2 play unchanged, scored on the shared band curve (scoreBands.ts). */
export const BT_REV_BAND = 3;
/** Marbles home; 140 at all 30 (the 126 partial cap is gone); all home adds up to 10 for speed over the landing window. */
export const BT_BAND_CURVE = bandCurve([0, 10, 19, 26, 28, 29, 30], [0, 32, 70, 104, 126, 138, 140]);

export function btBandParts(state: BtState): BandParts {
  const units = clampInt(state.home, 0, BT_BALLS);
  const finished = units >= BT_BALLS;
  const window = BT_RUN_TICKS - BT_LAST_LAND_MIN;
  const left = BT_RUN_TICKS - Math.max(BT_LAST_LAND_MIN, Math.min(BT_RUN_TICKS, state.lastLand));
  return {
    units,
    points: bandPoints(BT_BAND_CURVE, units),
    bonus: finished ? speedBonusCurve(BAND_FINISH_BONUS, left, window) : 0,
    penalty: 0,
    finished,
    text: `${units} / ${BT_BALLS} marbles home`,
    bonusText: "All home",
  };
}

function scoreBand(state: BtState): number {
  return bandTotal(btBandParts(state), Boolean(state.acted));
}
