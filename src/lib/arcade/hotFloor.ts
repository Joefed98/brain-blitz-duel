/**
 * Hot Floor — a 6-wide climbing grid. Swipes (k = 4, a = direction) hop to the
 * next tile in 8 ticks (one swipe queues during a hop). A tile crumbles 60
 * ticks after it is left; brittle tiles 30 ticks after being stepped on. Rows
 * scroll in from the top on a schedule and the bottom row drops away. Every
 * row is built at init and checked to be reachable with perfect play.
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

/* ============================== Constants ============================== */

export const HOT_WORLD_W = 390;
export const HOT_WORLD_H = 620;
export const HOT_RUN_TICKS = 60 * TICKS_PER_SECOND;
export const HOT_INPUT_SWIPE = 4;
export const HOT_LEFT = 0;
export const HOT_RIGHT = 1;
export const HOT_DOWN = 2;
export const HOT_UP = 3;
export const HOT_SWIPE_PX = 24;
export const HOT_COLS = 6;
export const HOT_ROWS = 8;
const HOP_TICKS = 8;
const CRUMBLE_AFTER_LEAVE = 60;
const CRACK_AT = 30;
const BRITTLE_AFTER = 30;
const BRITTLE_FROM = 20 * TICKS_PER_SECOND;
const SCROLL_START = 180;
const SCROLL_END = 120;
const SURVIVE_BONUS = 30;
const NEVER = 1 << 30;
const START_COL = 2;
const START_ROW = 1;

export const HOT_INPUT_RANGES: readonly InputRange[] = [inputRange(HOT_INPUT_SWIPE, [0, 3])];

/* ================================ Course =============================== */

/** Tick of each row scroll, from the start interval down to the end one. */
const SCROLLS: readonly number[] = (() => {
  const out: number[] = [];
  let t = 0;
  for (;;) {
    t += SCROLL_START - Math.trunc(((SCROLL_START - SCROLL_END) * t) / HOT_RUN_TICKS);
    if (t > HOT_RUN_TICKS) break;
    out.push(t);
  }
  return out;
})();
const TOTAL_ROWS = SCROLLS.length + HOT_ROWS;

interface Course {
  dark: number[];
  brittle: number[];
  pickup: number[];
  total: number;
  rng: number;
}

/** Tick the row first shows on screen. */
function rowAppears(r: number): number {
  return r < HOT_ROWS ? 0 : SCROLLS[r - HOT_ROWS]!;
}

function buildCourse(seed: number): Course {
  let rng = seed | 0;
  const draw = (bound: number) => {
    const res = rngBelow(rng, bound);
    rng = res.state;
    return res.value;
  };
  const dark: number[] = [];
  const brittle: number[] = [];
  const pickup: number[] = [];
  let reach = new Array<boolean>(HOT_COLS).fill(false);
  let total = 0;
  for (let r = 0; r < TOTAL_ROWS; r++) {
    const pct = r < 2 ? 0 : 15 + Math.trunc((20 * r) / TOTAL_ROWS);
    const late = rowAppears(r) >= BRITTLE_FROM;
    let row: { d: number[]; b: number[]; next: boolean[] } | null = null;
    for (let attempt = 0; attempt < 30 && !row; attempt++) {
      const pctNow = attempt < 20 ? pct : 0;
      const d = Array.from({ length: HOT_COLS }, () => (draw(100) < pctNow ? 1 : 0));
      const b = d.map((g) => (!g && late && draw(100) < 15 ? 1 : 0));
      // Reachable: straight up from a reachable tile, then sideways over solid tiles.
      const next = d.map((g, c) => !g && (r === 0 ? c === START_COL : reach[c]!));
      for (let pass = 0; pass < HOT_COLS; pass++)
        for (let c = 0; c < HOT_COLS; c++) {
          if (d[c] || next[c]) continue;
          if ((c > 0 && next[c - 1]) || (c < HOT_COLS - 1 && next[c + 1])) next[c] = true;
        }
      // A reachable tile that is safe to wait on must exist.
      if (next.some((ok, c) => ok && !b[c])) row = { d, b, next };
    }
    if (!row) {
      const next = new Array<boolean>(HOT_COLS).fill(true);
      row = { d: new Array<number>(HOT_COLS).fill(0), b: new Array<number>(HOT_COLS).fill(0), next };
    }
    for (let c = 0; c < HOT_COLS; c++) {
      dark.push(row.d[c]!);
      brittle.push(row.b[c]!);
      const gets = r >= HOT_ROWS && !row.d[c] && draw(100) < 30 ? 1 : 0;
      pickup.push(gets);
      total += gets;
    }
    reach = row.next.map((ok, c) => ok && !row!.d[c]);
  }
  return { dark, brittle, pickup, total, rng };
}

/* ================================ State ================================ */

export interface HotFloorState {
  tick: number;
  rng: number;
  col: number;
  row: number;
  fromCol: number;
  fromRow: number;
  hopT: number;
  queued: number;
  scrolled: number;
  pickups: number;
  ended: number;
  endedTick: number;
  crumble: number[];
  taken: number[];
  course: Course;
}

const cache = new Map<number, Course>();

function init(seed: number): HotFloorState {
  let course = cache.get(seed | 0);
  if (!course) {
    course = buildCourse(seed);
    if (cache.size > 16) cache.clear();
    cache.set(seed | 0, course);
  }
  return {
    tick: 0,
    rng: course.rng,
    col: START_COL,
    row: START_ROW,
    fromCol: START_COL,
    fromRow: START_ROW,
    hopT: 0,
    queued: -1,
    scrolled: 0,
    pickups: 0,
    ended: 0,
    endedTick: 0,
    crumble: new Array<number>(TOTAL_ROWS * HOT_COLS).fill(NEVER),
    taken: [],
    course,
  };
}

function isOver(state: HotFloorState): boolean {
  return state.ended !== 0;
}

function startHop(s: HotFloorState, dir: number): void {
  const dc = dir === HOT_LEFT ? -1 : dir === HOT_RIGHT ? 1 : 0;
  const dr = dir === HOT_UP ? 1 : dir === HOT_DOWN ? -1 : 0;
  const col = s.col + dc;
  const row = s.row + dr;
  if (col < 0 || col >= HOT_COLS || row < s.scrolled || row >= s.scrolled + HOT_ROWS || row >= TOTAL_ROWS) return;
  const here = s.row * HOT_COLS + s.col;
  if (s.crumble === undefined) return;
  s.crumble = s.crumble.slice();
  s.crumble[here] = Math.min(s.crumble[here]!, s.tick + CRUMBLE_AFTER_LEAVE);
  s.fromCol = s.col;
  s.fromRow = s.row;
  s.col = col;
  s.row = row;
  s.hopT = HOP_TICKS;
}

function step(state: HotFloorState, input: ArcadeInputEvent | null): HotFloorState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const s: HotFloorState = { ...state, tick };
  const die = () => {
    s.ended = 2;
    s.endedTick = tick;
  };
  const swipe = input !== null && input.k === HOT_INPUT_SWIPE ? clampInt(input.a, 0, 3) : -1;
  if (swipe >= 0) {
    if (s.hopT > 0) s.queued = swipe;
    else startHop(s, swipe);
  }
  if (s.hopT > 0) {
    s.hopT -= 1;
    if (s.hopT === 0) {
      const i = s.row * HOT_COLS + s.col;
      if (s.course.dark[i] || s.crumble[i]! <= tick) return die(), s;
      if (s.course.brittle[i] && s.crumble[i] === NEVER) {
        s.crumble = s.crumble.slice();
        s.crumble[i] = tick + BRITTLE_AFTER;
      }
      if (s.course.pickup[i] && !s.taken.includes(i)) {
        s.taken = [...s.taken, i];
        s.pickups += 1;
      }
      if (s.queued >= 0) {
        const q = s.queued;
        s.queued = -1;
        startHop(s, q);
      }
    }
  }
  if (s.scrolled < SCROLLS.length && SCROLLS[s.scrolled] === tick) s.scrolled += 1;
  if (s.hopT === 0) {
    const i = s.row * HOT_COLS + s.col;
    if (s.crumble[i]! <= tick || s.row < s.scrolled) return die(), s;
  }
  if (tick >= HOT_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

function score(state: HotFloorState): number {
  return clampInt(2 * state.pickups + (state.ended === 1 ? SURVIVE_BONUS : 0), 0, 150);
}

export function hotfloorExtra(s: HotFloorState) {
  return { pickups: s.pickups, total: s.course.total, survived: s.ended !== 2, survivedSeconds: s.tick / 60 };
}

/* ============================= Checkpoints ============================= */

export const HOTFLOOR_CHECKPOINT_INTERVAL = 300;
export const HOTFLOOR_CHECKPOINT_KEYS = [
  "tick",
  "col",
  "row",
  "hopT",
  "queued",
  "scrolled",
  "pickups",
  "ended",
  "rng",
  "checksum",
] as const;

export interface HotFloorCheckpoint {
  tick: number;
  col: number;
  row: number;
  hopT: number;
  queued: number;
  scrolled: number;
  pickups: number;
  ended: number;
  rng: number;
  checksum: number;
}

export function hotfloorCheckpoint(state: HotFloorState): HotFloorCheckpoint {
  const snap = {
    tick: state.tick,
    col: state.col,
    row: state.row,
    hopT: state.hopT,
    queued: state.queued,
    scrolled: state.scrolled,
    pickups: state.pickups,
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

export const HOT_BG = "#07070D";
export const HOT_GOLD = "#F5B82E";
export const HOT_TEAL = "#2EC4B6";
export const HOT_RED = "#FF4D5E";
const TILE = 60;
const BOARD_X = 15;
const BOARD_Y = 80;

function draw(ctx: CanvasRenderingContext2D, state: HotFloorState, size: CanvasSize): void {
  const scale = Math.min(size.width / HOT_WORLD_W, size.height / HOT_WORLD_H);
  const ox = (size.width - HOT_WORLD_W * scale) / 2;
  const oy = (size.height - HOT_WORLD_H * scale) / 2;
  ctx.save();
  ctx.fillStyle = HOT_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  const { course } = state;
  const at = (r: number, c: number) => ({
    x: BOARD_X + c * TILE,
    y: BOARD_Y + (HOT_ROWS - 1 - (r - state.scrolled)) * TILE,
  });
  for (let r = state.scrolled; r < Math.min(TOTAL_ROWS, state.scrolled + HOT_ROWS); r++) {
    for (let c = 0; c < HOT_COLS; c++) {
      const i = r * HOT_COLS + c;
      if (course.dark[i]) continue;
      const left = state.crumble[i]! - state.tick;
      if (left <= 0) continue;
      const { x, y } = at(r, c);
      ctx.fillStyle = "#15151F";
      ctx.beginPath();
      ctx.roundRect(x + 3, y + 3, TILE - 6, TILE - 6, 8);
      ctx.fill();
      ctx.strokeStyle = course.brittle[i] ? HOT_TEAL : HOT_GOLD;
      ctx.lineWidth = course.brittle[i] ? 2.5 : 1;
      ctx.globalAlpha = course.brittle[i] ? 1 : 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (left <= CRUMBLE_AFTER_LEAVE - CRACK_AT || (course.brittle[i] && left <= BRITTLE_AFTER / 2)) {
        ctx.strokeStyle = HOT_RED;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 12, y + 14);
        ctx.lineTo(x + 28, y + 30);
        ctx.lineTo(x + 22, y + 44);
        ctx.moveTo(x + 28, y + 30);
        ctx.lineTo(x + 46, y + 24);
        ctx.stroke();
      }
      if (course.pickup[i] && !state.taken.includes(i)) {
        ctx.fillStyle = HOT_GOLD;
        ctx.beginPath();
        ctx.arc(x + TILE / 2, y + TILE / 2, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const to = at(state.row, state.col);
  const from = at(state.fromRow, state.fromCol);
  const f = state.hopT > 0 ? state.hopT / HOP_TICKS : 0;
  const rx = to.x + (from.x - to.x) * f + TILE / 2;
  const ry = to.y + (from.y - to.y) * f + TILE / 2 - Math.sin(f * Math.PI) * 8;
  ctx.fillStyle = state.ended === 2 ? HOT_RED : HOT_GOLD;
  ctx.beginPath();
  ctx.roundRect(rx - 10, ry - 15, 20, 30, 10);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 16px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Pickups ${state.pickups}`, 14, 40);
  ctx.restore();
}

export const hotFloorGame: ArcadeGame<HotFloorState, ArcadeInputEvent | null> = {
  key: "hotfloor",
  runTicks: HOT_RUN_TICKS,
  init,
  step,
  isOver,
  score,
  draw,
  inputRanges: HOT_INPUT_RANGES,
};
