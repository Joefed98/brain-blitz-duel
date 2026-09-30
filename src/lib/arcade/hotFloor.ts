/**
 * Hot Floor — a 6-wide climbing grid, pure survival. Swipes (k = 4, a =
 * direction) hop to the next tile in 8 ticks (one swipe queues during a hop).
 * Tiles crumble after leaving; seeded unstable tiles crack and fall on their
 * own. Incoming and outgoing rows phase for 60 ticks. A time-expanded search
 * verifies that a forward path lasts the entire round.
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
const CRUMBLE_LEAVE_START = 60;
const CRUMBLE_LEAVE_END = 40;
const CRACK_AT = 30;
const BRITTLE_AFTER = 45;
const PHASE_TICKS = 60;
const SCROLL_START = 72;
const SCROLL_END = 36;
const NEVER = 1 << 30;
const START_COL = 2;
const START_ROW = 1;

export const HOT_INPUT_RANGES: readonly InputRange[] = [inputRange(HOT_INPUT_SWIPE, [0, 3])];

/* ================================ Course =============================== */

/** Ticks a tile lasts after being left, at this tick. */
function crumbleAfterLeave(tick: number): number {
  return CRUMBLE_LEAVE_START - Math.trunc(((CRUMBLE_LEAVE_START - CRUMBLE_LEAVE_END) * Math.min(tick, HOT_RUN_TICKS)) / HOT_RUN_TICKS);
}

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
  unstableAt: number[];
  rng: number;
  rerolls: number;
}

/** Tick the row first shows on screen. */
function rowAppears(r: number): number {
  return r < HOT_ROWS ? 0 : Math.max(0, SCROLLS[r - HOT_ROWS]! - PHASE_TICKS);
}

/** Tick the row drops off the bottom (the player must be off it by then). */
function rowDrops(r: number): number {
  return r < SCROLLS.length ? SCROLLS[r]! + PHASE_TICKS : NEVER;
}

function solid(course: Course, r: number, c: number, tick: number): boolean {
  if (r < 0 || r >= TOTAL_ROWS || c < 0 || c >= HOT_COLS) return false;
  const i = r * HOT_COLS + c;
  return !course.dark[i] && tick >= rowAppears(r) && tick < rowDrops(r) && tick < course.unstableAt[i]!;
}

/** Forward-only time-expanded BFS: waiting, lateral hops and climbing. No tile
 * is revisited, so every abandoned tile's leave-crumble deadline is respected. */
function courseReachable(course: Course): boolean {
  let frontier = new Set<number>([START_ROW * HOT_COLS + START_COL]);
  const arrivals = new Map<number, Set<number>>();
  for (let tick = 0; tick <= HOT_RUN_TICKS; tick++) {
    const next = new Set<number>();
    for (const i of frontier) {
      const r = Math.trunc(i / HOT_COLS), c = i % HOT_COLS;
      if (!solid(course, r, c, tick)) continue;
      if (tick === HOT_RUN_TICKS) return true;
      if (solid(course, r, c, tick + 1)) next.add(i);
      for (const [nr, nc] of [[r + 1, c], [r, c - 1], [r, c + 1]] as [number, number][]) {
        if (!solid(course, nr, nc, tick + HOP_TICKS)) continue;
        // Leave-crumble cannot catch a forward path; in-flight source remains
        // available through departure, while the landing tile must be intact.
        const target = nr * HOT_COLS + nc;
        const at = tick + HOP_TICKS;
        if (!arrivals.has(at)) arrivals.set(at, new Set());
        arrivals.get(at)?.add(target);
      }
    }
    for (const i of arrivals.get(tick + 1) ?? []) next.add(i);
    arrivals.delete(tick + 1);
    frontier = next;
    if (!frontier.size && !arrivals.size) return false;
  }
  return false;
}

function localSafe(course: Course): boolean {
  for (let r = HOT_ROWS; r < TOTAL_ROWS; r++) {
    const appears = rowAppears(r);
    if (appears > HOT_RUN_TICKS) break;
    for (let tick = appears; tick < Math.min(rowDrops(r - 1), HOT_RUN_TICKS); tick++) {
      for (let c = 0; c < HOT_COLS; c++) {
        if (!solid(course, r - 1, c, tick)) continue;
        if (![c - 1, c, c + 1].some((n) => solid(course, r, n, tick) && solid(course, r, n, tick + 30))) return false;
      }
    }
  }
  return true;
}

/**
 * Perfect-play earliest arrival tick on each tile of row r, given the previous
 * row's arrivals. Waiting is only allowed on solid (non-brittle) tiles; a
 * brittle tile must be left within its crumble window. NEVER = unreachable.
 */
function arrivals(r: number, d: number[], prev: number[], prevB: number[]): number[] {
  const arr = new Array<number>(HOT_COLS).fill(NEVER);
  for (let c = 0; c < HOT_COLS; c++) {
    if (d[c] || prev[c]! >= NEVER) continue;
    const leave = Math.max(prev[c]!, rowAppears(r));
    if (prevB[c] && leave > prev[c]! + BRITTLE_AFTER - 1) continue;
    if (leave >= rowDrops(r - 1)) continue;
    const land = leave + HOP_TICKS;
    if (land < rowDrops(r)) arr[c] = Math.min(arr[c]!, land);
  }
  relaxRow(r, d, arr);
  return arr;
}

function relaxRow(r: number, d: number[], arr: number[]): void {
  for (let pass = 0; pass < HOT_COLS; pass++)
    for (let c = 0; c < HOT_COLS; c++) {
      if (arr[c]! >= NEVER) continue;
      for (const n of [c - 1, c + 1]) {
        if (n < 0 || n >= HOT_COLS || d[n]) continue;
        const land = arr[c]! + HOP_TICKS;
        if (land < rowDrops(r) && land < arr[n]!) arr[n] = land;
      }
    }
}

function rowAt(list: readonly number[], r: number): number[] {
  return list.slice(r * HOT_COLS, (r + 1) * HOT_COLS);
}

function buildCourse(seed: number): Course {
  let rng = seed | 0;
  const draw = (bound: number) => {
    const res = rngBelow(rng, bound);
    rng = res.state;
    return res.value;
  };
  let rerolls = 0;
  for (;;) {
  const dark: number[] = [];
  const brittle: number[] = [];
  const unstableAt: number[] = [];
  const zeros = () => new Array<number>(HOT_COLS).fill(0);
  // Rows up to the start row are plain; the runner starts on it at tick 0.
  for (let r = 0; r <= START_ROW; r++) {
    dark.push(...zeros());
    brittle.push(...zeros());
    unstableAt.push(...new Array<number>(HOT_COLS).fill(NEVER));
  }
  let prevArr = new Array<number>(HOT_COLS).fill(NEVER);
  prevArr[START_COL] = 0;
  relaxRow(START_ROW, zeros(), prevArr);
  let prevB = zeros();
  for (let r = START_ROW + 1; r < TOTAL_ROWS; r++) {
    const pct = r < HOT_ROWS ? 0 : 8;
    const late = r > START_ROW + 1;
    let row: { d: number[]; b: number[]; arr: number[] } | null = null;
    for (let attempt = 0; attempt < 30 && !row; attempt++) {
      const pctNow = attempt < 20 ? pct : 0;
      const d = Array.from({ length: HOT_COLS }, () => (draw(100) < pctNow ? 1 : 0));
      const b = d.map((g) => (!g && late && draw(100) < 15 ? 1 : 0));
      const arr = arrivals(r, d, prevArr, prevB);
      // A reachable tile that is safe to wait on must exist.
      if (arr.some((t, c) => t < NEVER && !b[c])) row = { d, b, arr };
    }
    if (!row) {
      // A plain row is always reachable from a safe tile below.
      const d = zeros();
      row = { d, b: zeros(), arr: arrivals(r, d, prevArr, prevB) };
    }
    dark.push(...row.d);
    brittle.push(...row.b);
    unstableAt.push(...row.b.map((v) => v ? rowAppears(r) + BRITTLE_AFTER + 50 + draw(50) : NEVER));
    prevArr = row.arr;
    prevB = row.b;
  }
  const course = { dark, brittle, unstableAt, rng, rerolls };
  if (localSafe(course) && courseReachable(course)) return course;
  if (rerolls >= 30) {
    // A completely solid fallback keeps every incoming path open.
    return { dark: new Array(dark.length).fill(0), brittle: new Array(dark.length).fill(0), unstableAt: new Array(dark.length).fill(NEVER), rng, rerolls };
  }
  rerolls++;
  }
}

/** Test hook: re-runs the perfect-play timing check over a whole course. */
export function hotfloorCourseSurvivable(seed: number): boolean {
  const c = buildCourse(seed);
  return localSafe(c) && courseReachable(c);
}

export function hotfloorCourseRerolls(seed: number): number { return buildCourse(seed).rerolls; }

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
  ended: number;
  endedTick: number;
  crumble: number[];
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
    ended: 0,
    endedTick: 0,
    crumble: new Array<number>(TOTAL_ROWS * HOT_COLS).fill(NEVER),
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
  if (col < 0 || col >= HOT_COLS || !solid(s.course, row, col, s.tick + HOP_TICKS)) return;
  const here = s.row * HOT_COLS + s.col;
  if (s.crumble === undefined) return;
  s.crumble = s.crumble.slice();
  s.crumble[here] = Math.min(s.crumble[here]!, s.tick + crumbleAfterLeave(s.tick));
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
       if (!solid(s.course, s.row, s.col, tick) || s.crumble[i]! <= tick) return die(), s;
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
     if (s.crumble[i]! <= tick || !solid(s.course, s.row, s.col, tick)) return die(), s;
  }
  if (tick >= HOT_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  }
  return s;
}

function score(state: HotFloorState): number {
  // floor(150 × (seconds survived ÷ 60)²)
  const t = Math.min(state.tick, HOT_RUN_TICKS);
  return clampInt(Math.floor((150 * t * t) / (HOT_RUN_TICKS * HOT_RUN_TICKS)), 0, 150);
}

export function hotfloorExtra(s: HotFloorState) {
  return { survived: s.ended !== 2, survivedSeconds: s.tick / 60 };
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
  const phase = state.scrolled < SCROLLS.length ? Math.max(0, 1 - (SCROLLS[state.scrolled]! - state.tick) / PHASE_TICKS) : 0;
  const at = (r: number, c: number) => ({
    x: BOARD_X + c * TILE,
    y: BOARD_Y + (HOT_ROWS - 1 - (r - state.scrolled) + phase) * TILE,
  });
  for (let r = Math.max(0, state.scrolled - 1); r < Math.min(TOTAL_ROWS, state.scrolled + HOT_ROWS + 1); r++) {
    for (let c = 0; c < HOT_COLS; c++) {
      const i = r * HOT_COLS + c;
      if (course.dark[i]) continue;
       const left = Math.min(state.crumble[i]!, course.unstableAt[i]!) - state.tick;
      if (left <= 0) continue;
      const { x, y } = at(r, c);
       if (y < BOARD_Y - TILE || y > BOARD_Y + HOT_ROWS * TILE) continue;
       const fadeIn = Math.min(1, Math.max(0, (state.tick - rowAppears(r)) / PHASE_TICKS));
       const fadeOut = Math.min(1, Math.max(0, (rowDrops(r) - state.tick) / PHASE_TICKS));
       const alpha = Math.min(fadeIn, fadeOut);
       ctx.globalAlpha = alpha;
      ctx.fillStyle = "#15151F";
      ctx.beginPath();
      ctx.roundRect(x + 3, y + 3, TILE - 6, TILE - 6, 8);
      ctx.fill();
      ctx.strokeStyle = course.brittle[i] ? HOT_TEAL : HOT_GOLD;
      ctx.lineWidth = course.brittle[i] ? 2.5 : 1;
       ctx.globalAlpha = alpha * (course.brittle[i] ? 1 : 0.6);
      ctx.stroke();
      ctx.globalAlpha = 1;
       if (left <= CRACK_AT) {
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
