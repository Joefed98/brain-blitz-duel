/**
 * Ball Track: a deterministic 60-tick sim. A fixed 7×9 serpentine of straights
 * and corners; tapping a gold straight toggles it vertical so balls drop through
 * to the next row (or the tray in the fixed bottom row). Balls drop every 103 ticks. The server replays the tap log.
 */

import { clampInt, finishScore, inputRange, type ArcadeGame, type ArcadeInputEvent } from "./engine";
import { speedBonusCurve } from "../duel/speedPar";
import { stdBandParts, stdLine, stdTotal, type StdScore, type StdSpec } from "./arcadeStandard";
import { BAND_STRICT_MARK, bandStrict, bandRetarget, bandCurveOf, BAND_TARGET_MARK, bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, BAND_FINISH_BONUS, type BandFields, type BandParts } from "./scoreBands";

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

/** Board geometry (world px): square tiles under a hopper strip, over a tray shelf. */
export const BT_TILE = 100;
export const BT_HOPPER_H = 58;
export const BT_TRAY_H = 42;

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

/**
 * A fixed serpentine of `rows` rows: tile kinds, corner masks and the straights
 * fixed in every course (the hopper column down to three rows above the
 * bottom). The original board has 9 rows; btRev 4 (taller worlds) has
 * BT_TALL_ROWS, picked by the stored course's `rows`.
 */
export interface BtLayout {
  rows: number;
  /** Tile kind per cell: 0 empty, 1 straight, 2 corner. */
  kind: number[];
  /** Corner side masks (0 for non-corners). */
  corner: number[];
  /** Straights fixed in every course: the hopper column, rows 1 to rows − 3. */
  alwaysFixed: number[];
  /** First cell of the bottom (tray) row. */
  bottom: number;
  /** World height (px): hopper, rows, tray shelf. */
  h: number;
}

function buildLayout(rows: number): BtLayout {
  const kinds: number[] = [];
  const corners: number[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < BT_COLS; c++) {
      const d = rowDir(r);
      const start = r === 0 ? BT_HOPPER_COL : d > 0 ? 0 : BT_COLS - 1;
      const end = d > 0 ? BT_COLS - 1 : 0;
      const onRow = d > 0 ? c >= start : c <= start;
      let kind = onRow ? 1 : 0, mask = 0;
      if (r === rows - 1) { kind = c === 0 ? 2 : 1; mask = c === 0 ? N | E : 0; } // entry corner + six fixed straights
      else if (onRow && c === start) { kind = 2; mask = N | (d > 0 ? E : W); }
      else if (onRow && c === end && r < rows - 1) { kind = 2; mask = S | (d > 0 ? W : E); }
      kinds.push(kind);
      corners.push(mask);
    }
  const alwaysFixed = Array.from({ length: rows - 3 }, (_, r) => r * BT_COLS + BT_HOPPER_COL).filter((c) => kinds[c] === 1);
  return { rows, kind: kinds, corner: corners, alwaysFixed, bottom: (rows - 1) * BT_COLS, h: BT_HOPPER_H + rows * BT_TILE + BT_TRAY_H };
}

/** The original 7 × 9 board. */
export const BT_LAYOUT = buildLayout(BT_ROWS);
/** Tile kind per cell: 0 empty, 1 straight, 2 corner. Fixed serpentine. */
export const BT_KIND: number[] = BT_LAYOUT.kind;
/** Corner side masks (0 for non-corners). */
export const BT_CORNER: number[] = BT_LAYOUT.corner;
/** Straights fixed in every course: column 4, rows 1–6. */
export const BT_ALWAYS_FIXED = BT_LAYOUT.alwaysFixed;

/**
 * btRev 4 (taller worlds, batch 3): the same 700-wide board with BT_TALL_ROWS
 * rows, 700 × BT_TALL_H (the shape of a 390 × 730 arena). Tall courses carry
 * `rows: BT_TALL_ROWS`; every other course plays the 9-row board.
 */
export const BT_TALL_ROWS = 12;
export const BT_LAYOUT_TALL = buildLayout(BT_TALL_ROWS);

/** btRev 7 (expansion E6): BT_V7_ROWS rows, 700 × BT_V7_H. */
export const BT_V7_ROWS = 13;
export const BT_LAYOUT_V7 = buildLayout(BT_V7_ROWS);

/** The board a course plays on (its stored `rows`, else the original 9). */
export function btLayout(course?: { rows?: number } | null): BtLayout {
  return course?.rows === BT_TALL_ROWS ? BT_LAYOUT_TALL : course?.rows === BT_V7_ROWS ? BT_LAYOUT_V7 : BT_LAYOUT;
}

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
  /** btRev 4 tall courses only: BT_TALL_ROWS. Absent = the original 9-row board. */
  rows?: number;
  /** btRev 7 courses only (BT_V7_ROWS rows): gold marbles (ball indices), speed boosters and crossovers (fixed cells). */
  gold?: number[];
  boost?: number[];
  cross?: number[];
}

/** Rotatable straights: every straight not in column 4 rows 1–6 and not a seeded fixed tile. */
export function btRotatable(course: BtCourse): number[] {
  const layout = btLayout(course);
  const fixed = new Set([...layout.alwaysFixed, ...course.fixed]);
  return layout.kind.flatMap((k, cell) => (k === 1 && cell < layout.bottom && !fixed.has(cell) ? [cell] : []));
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
  const { rows, kind } = btLayout(course);
  const r = Math.floor(cell / BT_COLS), c = cell % BT_COLS;
  // btRev 7: a crossover passes a marble straight on, down if it came from above, along the row otherwise.
  const down = r === rows - 1
    ? c > 0 && (course ? btTraysAt(course, tick)[c]! : -1) >= 0 && !btSwitchedOn(sw, c)
    : kind[cell] === 2 ? !fromAbove : course?.cross?.includes(cell) ? fromAbove : vertical;
  if (down) return r === rows - 1 ? { cell: SLOT + c, fromAbove: true } : { cell: cell + BT_COLS, fromAbove: true };
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
  /** btRev 2: 1 = rode a tube turn, 2 = passed a switch point (absent on original rounds); btRev 7: 4 = boosted. */
  via?: number;
  /** btRev 7 only: fast steps left after a speed booster. */
  bst?: number;
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
  /** btRev 4 only (taller worlds): the world height in px (BT_TALL_H). Absent = BT_H. */
  worldH?: number;
  /**
   * btRev 7 only (absent otherwise): the expansion's mark, the correct-landing streak now and at best, combo
   * landings (each correct one at a streak of BT_V7_COMBO_FROM or more), gold marbles home, boosted marbles
   * home, and marbles knocked astray at a crossover.
   */
  r7?: number;
  streak?: number;
  bestStreak?: number;
  combos?: number;
  golds?: number;
  boosts?: number;
  crashes?: number;
  /** btRev 8 only (the arcade scoring standard): btRev 7's play scored on BT_STD; not in the checkpoint checksum. */
  std?: number;
}

export function btInit(course: BtCourse): BtState {
  return {
    tick: 0,
    vert: btLayout(course).kind.map(() => 0),
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
  const BOTTOM = btLayout(course).bottom;
  const s: BtState = { ...prev, tick: prev.tick + 1, vert: [...prev.vert], balls: prev.balls.map((b) => ({ ...b })) };
  const t = s.tick;
  const v2 = s.rev === BT_REV;
  const v7 = s.r7 === 1;

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

  if (s.next < (v7 ? BT_V7_BALLS : BT_BALLS) && (t - 1) % (v7 ? BT_V7_DROP_TICKS : BT_DROP_TICKS) === 0) {
    s.balls.push({ id: s.next, colour: course.balls[s.next]!, cell: -1, from: -1, above: 1, arrived: t, at: t + BT_STEP_TICKS, steps: 0, ...(v7 ? { bst: 0 } : {}) });
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
        if (v7) btV7Home(course, s, ball);
      }
      else if (tray < 0) s.lost++;
      else s.wrong++;
      if (v7 && tray !== ball.colour) s.streak = 0;
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
      if (v7) s.streak = 0;
      continue;
    }
    // btRev 7: two marbles meeting at a crossover from different directions knock each other astray (both lost).
    if (v7 && next.cell < SLOT && course.cross?.includes(next.cell)) {
      const other = s.balls.find((b) => b.id !== ball.id && !removed.has(b.id) && b.cell === next.cell);
      if (other && (other.above === 1) !== next.fromAbove) {
        for (const lost of [ball, other]) {
          s.falls = keep(s.falls, { cell: next.cell, colour: lost.colour, tick: t, ok: 0 });
          removed.add(lost.id);
        }
        s.lost += 2;
        s.lastLand = t;
        s.crashes = (s.crashes ?? 0) + 1;
        s.streak = 0;
        continue;
      }
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
    if (v7) {
      // btRev 7: a speed booster sends the marble on at double speed for its next BT_V7_BOOST_STEPS steps.
      if (course.boost?.includes(ball.cell)) {
        ball.bst = BT_V7_BOOST_STEPS;
        ball.via = (ball.via ?? 0) | 4;
      }
      if ((ball.bst ?? 0) > 0) {
        ball.at = t + BT_V7_BOOST_TICKS;
        ball.bst = (ball.bst ?? 0) - 1;
      }
    }
  }
  if (removed.size) s.balls = s.balls.filter((b) => !removed.has(b.id));
  return s;
}

export function btOver(s: BtState): boolean {
  return s.tick >= BT_RUN_TICKS || (s.next >= (s.r7 ? BT_V7_BALLS : BT_BALLS) && s.balls.length === 0);
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
  // btRev 4 (taller worlds): the world height, last.
  if (s.worldH) values.push(s.worldH);
  // btRev 7: its feature counters and each marble's boost, after that.
  if (s.r7) {
    values.push(s.r7, s.streak ?? 0, s.combos ?? 0, s.golds ?? 0, s.boosts ?? 0, s.crashes ?? 0);
    for (const b of s.balls) values.push(b.bst ?? 0);
  }
  let checksum = 0x811c9dc5;
  for (const v of values) {
    checksum ^= v | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snap, checksum };
}

/* ================================ Drawing ================================ */

export const BT_W = BT_COLS * BT_TILE;
export const BT_H = BT_HOPPER_H + BT_ROWS * BT_TILE + BT_TRAY_H;
/** btRev 4: the taller board's height (58 + 12 × 100 + 42). */
export const BT_TALL_H = BT_LAYOUT_TALL.h;
/** btRev 7: the 13-row board's height (58 + 13 × 100 + 42). */
export const BT_V7_H = BT_LAYOUT_V7.h;
const BALL_R = 22.5;
const BG = "#12161C";
const TUBE = "#F5B82E";
const TUBE_FIXED = "#6A7280";

const cellCentre = (cell: number) => ({
  x: (cell % BT_COLS) * BT_TILE + BT_TILE / 2,
  y: BT_HOPPER_H + Math.floor(cell / BT_COLS) * BT_TILE + BT_TILE / 2,
});
const pointOf = (cell: number, rows = BT_ROWS) => {
  if (cell < 0) return { x: BT_HOPPER_COL * BT_TILE + BT_TILE / 2, y: BT_HOPPER_H / 2 };
  if (cell >= SLOT) return { x: (cell - SLOT) * BT_TILE + BT_TILE / 2, y: BT_HOPPER_H + rows * BT_TILE + BT_TRAY_H / 2 };
  return cellCentre(cell);
};

/** The world height (px) a state plays in: btRev 4's taller board, or the original 1000. */
export function btWorldH(state: { worldH?: number }): number {
  return state.worldH ?? BT_H;
}
/** The rows of the board a state plays on. */
export function btRowsOf(state: { worldH?: number }): number {
  return state.worldH === BT_TALL_H ? BT_TALL_ROWS : state.worldH === BT_V7_H ? BT_V7_ROWS : BT_ROWS;
}

export function btBallPoint(s: BtState, b: BtBall) {
  const rows = btRowsOf(s);
  const a = pointOf(b.from, rows), z = pointOf(b.cell, rows);
  // A step lasts until the marble may move on (btRev 7's boosted steps are shorter; every other step is BT_STEP_TICKS).
  const k = Math.max(0, Math.min(1, (s.tick - b.arrived) / Math.max(1, b.at - b.arrived)));
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
  // btRev 4: the taller board's rows and tiles (the original 9 otherwise).
  const { rows: BT_ROWS, kind: BT_KIND, corner: BT_CORNER } = btLayout(course);
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
    const p = pointOf(m.cell, BT_ROWS);
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
/** btRev 4: a tap may name any cell of the taller board. */
export const BT_INPUT_RANGES_TALL = [inputRange(BT_K_ROTATE, [0, BT_COLS * BT_TALL_ROWS - 1])] as const;
/** btRev 7: any cell of the 13-row board. */
export const BT_INPUT_RANGES_V7 = [inputRange(BT_K_ROTATE, [0, BT_COLS * BT_V7_ROWS - 1])] as const;

export type BtGame = ArcadeGame<BtState, ArcadeInputEvent | null> & { course: BtCourse; rotatable: Set<number> };

/** One game per stored course (and puzzle.btRev); the seed is unused because the course is the content. */
export function makeBallTrackGame(course: BtCourse, rev?: number | null): BtGame {
  const rotatable = new Set(btRotatable(course));
  const layout = btLayout(course);
  return {
    key: "balltrack",
    runTicks: BT_RUN_TICKS,
    course,
    rotatable,
    init: () => {
      // btRev 3 (score bands) and btRev 4 (taller worlds) play the rev-2 rules.
      const state = rev === BT_REV || rev === BT_REV_BAND || rev === BT_REV_TALL || rev === BT_REV_TARGET || rev === BT_REV_STRICT || btIsV7Play(rev)
        ? { ...btInit(course), rev: BT_REV, sw: 0, turned: layout.kind.map(() => -1000), rideHomes: 0, switchHomes: 0 }
        : btInit(course);
      // btRev 4 adds the board's height (folded into the checkpoint checksum last).
      if (rev === BT_REV_TALL) return bandInit({ ...state, worldH: layout.h });
      // btRev 5 (scoring targets): btRev 4 play on the lifted curve.
      if (rev === BT_REV_TARGET) return { ...bandInit({ ...state, worldH: layout.h }), band: BAND_TARGET_MARK };
      // btRev 6 (score bands): the same play on its strict curve.
      if (rev === BT_REV_STRICT) return { ...bandInit({ ...state, worldH: layout.h }), band: BAND_STRICT_MARK };
      // btRev 7 (expansion E6): the rev-2 rules on the 13-row board with the expansion's features.
      if (rev === BT_REV_RUSH) return bandInit({ ...state, worldH: layout.h, r7: 1, streak: 0, bestStreak: 0, combos: 0, golds: 0, boosts: 0, crashes: 0 });
      // btRev 8 (the arcade scoring standard): btRev 7's play exactly, scored on BT_STD (`std` stays out of the checksum).
      if (rev === BT_REV_STD) return { ...bandInit({ ...state, worldH: layout.h, r7: 1, streak: 0, bestStreak: 0, combos: 0, golds: 0, boosts: 0, crashes: 0 }), std: 1 };
      return rev === BT_REV_BAND ? bandInit(state) : state;
    },
    step: bandStep((state, input) => btStep(course, rotatable, state, input)),
    isOver: btOver,
    score: (state) => (state.std ? btStdTotal(state) : state.r7 ? btV7Score(state) : bandScoreOf(btScore, scoreBand)(state)),
    draw: (ctx, state) => btDraw(ctx, course, state, rotatable),
    inputRanges: layout.rows === BT_TALL_ROWS ? BT_INPUT_RANGES_TALL : layout.rows === BT_V7_ROWS ? BT_INPUT_RANGES_V7 : BT_INPUT_RANGES,
  };
}

/* ================= Oct 2026 score bands (btRev 3) ================= */

/** Score-band revision (puzzle.btRev = 3): rev-2 play unchanged, scored on the shared band curve (scoreBands.ts). */
export const BT_REV_BAND = 3;
/** Marbles home; 140 at all 30 (the 126 partial cap is gone); all home adds up to 10 for speed over the landing window. */
export const BT_BAND_CURVE = bandCurve([0, 10, 19, 26, 28, 29, 30], [0, 32, 70, 104, 126, 138, 140]);

export function btBandParts(state: BtState): BandParts {
  // btRev 8 (the arcade scoring standard) has its own parts.
  if (state.std) return btStdParts(state);
  const units = clampInt(state.home, 0, BT_BALLS);
  const finished = units >= BT_BALLS;
  // btRev 4: the last marble has three more rows to fall, so its landing window starts later.
  const landMin = state.worldH ? BT_LAST_LAND_MIN_TALL : BT_LAST_LAND_MIN;
  const window = BT_RUN_TICKS - landMin;
  const left = BT_RUN_TICKS - Math.max(landMin, Math.min(BT_RUN_TICKS, state.lastLand));
  return {
    units,
    points: bandPoints(bandCurveOf(state, state.worldH ? BT_V4_BAND_CURVE : BT_BAND_CURVE), units),
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

/* ================= Taller worlds (btRev 4, Oct 2026) ================= */

/**
 * btRev 4 (taller worlds, batch 3): btRev 3 play (the rev-2 rules: tubes turn
 * with a marble inside, switch points on the bottom row) and the same 30
 * marbles, four colours, release pace, re-lay, colour shuffle and scoring
 * rules, on a taller board: BT_TALL_ROWS rows of the same 100 px tiles,
 * 700 × BT_TALL_H, so the board fills a 390 × 730 arena. Courses come from
 * their own proved bank (src/lib/duel/ballTrackBankTall.server.ts,
 * scripts/ball-track-bank.ts --tall) and carry `rows`; states add `worldH`,
 * folded into the checkpoint checksum last. Scored on BT_V4_BAND_CURVE.
 */
export const BT_REV_TALL = 4;
/**
 * The earliest tick the last marble can land on the taller board: released at
 * tick 2988, it needs at least 15 sixteen-tick steps (three rows more than the
 * original 12). arcade-tuning-g3-check proves it.
 */
export const BT_LAST_LAND_MIN_TALL = 3228;
/**
 * btRev 4 band knots (marbles home), refitted on the taller board with
 * scripts/arcade-skill-bands.ts --rev=g3 (60 seeds: unit medians 20 / 26 / 28 /
 * 28; great and near-perfect players both bring 28 home at the median, near-
 * perfect ones 29 almost as often); 140 at all 30, all home adds up to 10 for speed.
 */
export const BT_V4_BAND_CURVE = bandCurve([0, 10, 20, 26, 28, 29, 30], [0, 32, 70, 100, 130, 139, 140]);

/** The world height (px) a stored round's btRev plays in. */
export function ballTrackWorldHFor(rev?: number | null): number {
  if (btIsV7Play(rev)) return BT_V7_H;
  return rev === BT_REV_TALL || rev === BT_REV_TARGET || rev === BT_REV_STRICT ? BT_TALL_H : BT_H;
}

/* ================= Scoring targets (btRev 5, 18 Oct 2026) ================= */

/**
 * btRev 5 (scoring targets, docs/scoring-targets.md): btRev 4 play on the same
 * 12-row bank, each band knot's points lifted through BAND_TARGET_MAP.
 */
export const BT_REV_TARGET = 5;
/** The curve new rounds score on: BT_V4_BAND_CURVE lifted through BAND_TARGET_MAP (what bandCurveOf gives a target-stamped state). */
export const BT_V5_BAND_CURVE = bandRetarget(BT_V4_BAND_CURVE);


/* ================= Score bands (btRev 6, 19 Oct 2026) ================= */

/**
 * btRev 6 (score bands, docs/scoring-targets.md): btRev 5 play unchanged, scored on its strict curve (band 3,
 * src/lib/arcade/strictBands.data.ts) so the simulated average / good / great / near-perfect players land about
 * 70 / 100 / 120 / 140.
 */
export const BT_REV_STRICT = 6;
/** The curve new rounds score on: BT_V4_BAND_CURVE's strict curve (what bandCurveOf gives a band-3 state). */
export const BT_V6_BAND_CURVE = bandStrict(BT_V4_BAND_CURVE);


/* ================= Expansion E6 (btRev 7, 25 Oct 2026): rush hour ================= */

/**
 * btRev 7 (docs/expansions/e6.md, docs/scoring-200.md): btRev 6's rules (tubes turn with a marble inside,
 * switch points on the bottom row, the re-lay and the colour shuffle) on a 13-row board (700 × BT_V7_H) with
 * BT_V7_BALLS marbles released every BT_V7_DROP_TICKS, and four skill features worth up to
 * BT_V7_FEATURE_MAX more, so the round tops out at 200:
 *  - Speed boosters (course.boost: fixed straights with chevrons): a marble leaving one takes its next
 *    BT_V7_BOOST_STEPS steps at double speed, so the tubes ahead must be set sooner. Home after a boost: a
 *    boosted marble.
 *  - Gold marbles (course.gold): their colour's cup as usual; home is worth more.
 *  - The combo: every correct landing at a streak of BT_V7_COMBO_FROM or more; a wrong cup, a lost marble
 *    or a crash ends the streak.
 *  - Crossovers (course.cross: X tiles): a marble from above passes straight down, one along the row passes
 *    straight on. Two marbles meeting in one from different directions knock each other astray (both lost),
 *    so when marbles drop through it matters.
 * Courses come from their own proved bank (src/lib/duel/ballTrackBankV7.server.ts, scripts/ball-track-bank.ts
 * --v7). Base points: marbles home on BT_V7_BAND_CURVE plus, with all home, up to 10 for speed (to 150);
 * the features add btV7FeatureBonus (to 50). States keep rev 2 and add the `r7` fields (folded last).
 */
export const BT_REV_RUSH = 7;
export const BT_V7_BALLS = 36;
export const BT_V7_DROP_TICKS = 84; // last of 36 releases at tick 2941 (49 s)
export const BT_V7_GOLDS = 6;
export const BT_V7_BOOST_STEPS = 3;
export const BT_V7_BOOST_TICKS = 8;
export const BT_V7_COMBO_FROM = 3;
/** The earliest the last marble can land on the 13-row board (released at 2941; e6-check proves it by search). */
export const BT_V7_LAST_LAND_MIN = 3189;
/** Feature points: a gold marble home, a boosted marble home, a combo landing. */
export const BT_V7_GOLD_FP = 4;
export const BT_V7_BOOST_FP = 1;
export const BT_V7_COMBO_FP = 1;
export const BT_V7_FEATURE_MAX = 50;
/** Feature points → bonus (fitted by scripts/e6-bands.ts). */
export const BT_V7_FEATURE_CURVE = bandCurve([0, 22, 54, 64, 78, 90], [0, 5, 12, 18, 38, 50]);
/** btRev 7 base knots: marbles home of 36; 140 at all of them, all home adds up to 10 for speed (fitted by scripts/e6-bands.ts). */
export const BT_V7_BAND_CURVE = bandCurve([0, 8, 16, 25, 33, 35, 36], [0, 30, 65, 91, 112, 128, 140]);
/** btRev 7's round maximum (ROUND_MAX.balltrack). */
export const BT_V7_MAX = 200;

/** True for a btRev 7 gold marble. */
export function btIsGold(course: BtCourse, id: number): boolean {
  return course.gold?.includes(id) ?? false;
}

/** btRev 7: a marble just landed in its own cup (in place on `s`). */
function btV7Home(course: BtCourse, s: BtState, ball: BtBall): void {
  const streak = (s.streak ?? 0) + 1;
  s.streak = streak;
  if (streak > (s.bestStreak ?? 0)) s.bestStreak = streak;
  if (streak >= BT_V7_COMBO_FROM) s.combos = (s.combos ?? 0) + 1;
  if (btIsGold(course, ball.id)) s.golds = (s.golds ?? 0) + 1;
  if ((ball.via ?? 0) & 4) s.boosts = (s.boosts ?? 0) + 1;
}

/** btRev 7 feature points so far. */
export function btV7FeaturePoints(state: BtState): number {
  return (state.golds ?? 0) * BT_V7_GOLD_FP + (state.boosts ?? 0) * BT_V7_BOOST_FP + (state.combos ?? 0) * BT_V7_COMBO_FP;
}

/** btRev 7 feature bonus, 0…BT_V7_FEATURE_MAX. */
export function btV7FeatureBonus(state: BtState): number {
  return clampInt(bandPoints(BT_V7_FEATURE_CURVE, btV7FeaturePoints(state)), 0, BT_V7_FEATURE_MAX);
}

export function btV7Parts(state: BtState): BandParts {
  const units = clampInt(state.home, 0, BT_V7_BALLS);
  const finished = units >= BT_V7_BALLS;
  const window = BT_RUN_TICKS - BT_V7_LAST_LAND_MIN;
  const left = BT_RUN_TICKS - Math.max(BT_V7_LAST_LAND_MIN, Math.min(BT_RUN_TICKS, state.lastLand));
  const speed = finished ? speedBonusCurve(BAND_FINISH_BONUS, left, window) : 0;
  const golds = state.golds ?? 0;
  return {
    units,
    points: bandPoints(BT_V7_BAND_CURVE, units),
    bonus: speed + btV7FeatureBonus(state),
    penalty: 0,
    finished,
    text: `${units} / ${BT_V7_BALLS} marbles home`,
    bonusText: `${finished ? `All home +${speed} · ` : ""}${golds} gold · ${state.boosts ?? 0} boosted · ${state.combos ?? 0} combo`,
  };
}

function btV7Score(state: BtState): number {
  return bandTotal(btV7Parts(state), Boolean(state.acted), BT_V7_MAX);
}


/* ================= The arcade scoring standard (btRev 8, 29 Oct 2026) ================= */

/**
 * btRev 8 (docs/arcade-standard/balltrack.md, src/lib/arcade/arcadeStandard.ts): btRev 7's course, rules, features
 * and play exactly (the same bank, less course 56 in the deal), so a btRev 7 log replays tick for tick; only the scoring changes. States
 * add `std: 1` (outside the checkpoint checksum). Parts, totalling 200:
 *  - Marbles home (core) 140 on a straight line: 140 × home ÷ 36 (a fixed maximum: all 36 home).
 *  - Gold marbles 25: an equal share for each of the course's BT_V7_GOLDS gold marbles home.
 *  - Combos 20: 1 for each combo landing (a correct landing at a streak of BT_V7_COMBO_FROM or more in a row; a
 *    wrong cup, a lost marble or a crash ends the streak), up to 20.
 *  - Boosted marbles 15: an equal share (15 ÷ 36) for each marble home after a speed booster. Whether a marble
 *    passes a booster depends on the route its player sets, and any of the 36 can be routed through one, so the
 *    part is shared over all BT_V8_BOOSTS_FULL marbles (docs/arcade-standard/balltrack.md: an oracle brings all 36
 *    home boosted on 299 of the 300 bank courses; btRev 8 deals only those, BT_V8_DEAL).
 * No speed part and no all-home bonus; wrong cups and lost marbles cost nothing beyond what they don't earn.
 * Every feature counts only marbles home, so none asks a player to give up a marble.
 */
export const BT_REV_STD = 8;
/** Boosted marbles home that fill the boost part: every marble of the run (15 ÷ 36 each). */
export const BT_V8_BOOSTS_FULL = BT_V7_BALLS;
/** Combo landings that fill the combo part (1 point each). */
export const BT_V8_COMBOS_FULL = 20;
/** The arcade standard's parts for btRev 8 (core 140 + gold 25 + combos 20 + boosted 15 = 200). */
export const BT_STD: StdSpec = {
  core: { key: "home", label: "Marbles home", max: 140, of: BT_V7_BALLS, item: "marble" },
  features: [
    { key: "gold", label: "Gold marbles", max: 25, of: BT_V7_GOLDS, item: "gold marble" },
    { key: "combo", label: "Combos", max: 20, of: BT_V8_COMBOS_FULL, item: "combo landing" },
    { key: "boost", label: "Boosted marbles", max: 15, of: BT_V8_BOOSTS_FULL, item: "boosted marble" },
  ],
};
/** btRev 8's core line: marbles home of 36 → 0…140, straight. */
export const BT_V8_BAND_CURVE = bandCurve([0, BT_V7_BALLS], [0, 140]);

/** True for the revisions that play btRev 7's rules on its 13-row board (7, and 8 scored on the standard). */
export function btIsV7Play(rev?: number | null): boolean {
  return rev === BT_REV_RUSH || rev === BT_REV_STD;
}

/** btRev 8's breakdown on the standard. */
export function btStdScore(state: BtState): StdScore {
  const [gold, combo, boost] = BT_STD.features;
  return {
    core: stdLine(BT_STD.core.max, state.home, BT_STD.core.of),
    features: {
      gold: stdLine(gold!.max, state.golds ?? 0, gold!.of),
      combo: stdLine(combo!.max, state.combos ?? 0, combo!.of),
      boost: stdLine(boost!.max, state.boosts ?? 0, boost!.of),
    },
    penalty: 0,
  };
}

/** btRev 8's breakdown as BandParts (the reveal, the bands): core as the points, the features as one bonus line. */
export function btStdParts(state: BtState): BandParts {
  const units = clampInt(state.home, 0, BT_V7_BALLS);
  return stdBandParts(BT_STD, btStdScore(state), units, `${units} / ${BT_V7_BALLS} marbles home`, units >= BT_V7_BALLS);
}

function btStdTotal(state: BtState): number {
  return stdTotal(btStdScore(state), Boolean(state.acted));
}
