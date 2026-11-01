/**
 * Matchup — an arcade game on the shared engine.
 *
 * A 7×8 board of six symbols. A swap that makes a line of three or more clears
 * it, everything above falls, and new symbols enter from the top. Refills never
 * draw fresh randomness during play: every column has a fixed queue built at
 * init, so the whole room sees the identical board and the identical incoming
 * symbols. The only PRNG call after init is a deterministic reshuffle when the
 * board has no valid swap left.
 *
 * Every value in the state is an integer; a swap, its clears, falls, refills
 * and cascades all resolve inside the tick the swap event applies on.
 *
 * Specials (all revisions): a line of 4 makes a Bomb (3×3 blast), a line of 5+
 * a white four-point star (MATCHUP_CROSS: its row and column), and an L or T
 * (a row and a column line sharing a gem) a six-point star (MATCHUP_STAR: both
 * diagonals). Swapping a special, or catching it in a clear, sets it off.
 *
 * matchupRev 2 (stamped on the puzzle) adds:
 *  - the Jackpot gem (MATCHUP_JACKPOT + colour): made where one swap's own
 *    clear makes an L or T one of whose lines is 5 or longer. Set off, it clears
 *    every gem of its colour plus its whole row and column (10 points a gem).
 *  - constant play: a swap resolves only its own clear at once; each cascade
 *    after it resolves MATCHUP_V2_STEP_TICKS later, and the player may keep
 *    swapping meanwhile. Refills still come from the fixed column queues, every
 *    step happens on a sim tick, and the server replay is identical.
 *  - its own par (MATCHUP_V2_PAR_RAW), since faster play scores more points.
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
import { stdFinal } from "./arcadeStandard";
import { bandStrictGame, bandStrict, bandRetarget, bandTargetGame, bandCurveOf, bandCurve, bandInit, bandPoints, bandTop, bandScoreOf, bandStep, bandTotal, type BandCurve, type BandFields, type BandParts } from "./scoreBands";

/* ============================== Constants ============================== */

export const MATCHUP_WORLD_W = 390;
export const MATCHUP_WORLD_H = 560;

export const MATCHUP_RUN_SECONDS = 60;
export const MATCHUP_RUN_TICKS = MATCHUP_RUN_SECONDS * TICKS_PER_SECOND;
/** matchupRev 10 (27 Oct 2026, Joe's phone-test notes): a 90 s run; every earlier revision keeps 60 s. */
export const MATCHUP_V10_RUN_SECONDS = 90;
export const MATCHUP_V10_RUN_TICKS = MATCHUP_V10_RUN_SECONDS * TICKS_PER_SECOND;
/** The run length (ticks) a state plays: 90 s on matchupRev 10, else 60 s. */
export function matchupRunTicksOf(state: { iceSwap?: number }): number {
  return state.iceSwap ? MATCHUP_V10_RUN_TICKS : MATCHUP_RUN_TICKS;
}

export const MATCHUP_SIZE = 7;
export const MATCHUP_ROWS = 8;
export const MATCHUP_CELLS = MATCHUP_SIZE * MATCHUP_ROWS;
/** Rows a board holds (MATCHUP_ROWS on every revision before matchupRev 9's taller board). */
export function matchupRowsOf(cells: readonly number[]): number {
  return Math.trunc(cells.length / MATCHUP_SIZE) || MATCHUP_ROWS;
}
export const MATCHUP_KINDS = 6;
export const MATCHUP_BOMB = 6;
export const MATCHUP_CROSS = 7;
/** Made by a T or L swap (two lines at once); clears both diagonals. */
export const MATCHUP_STAR = 8;
/** Raw points for a perfect-feeling run: 2500 raw = 150. Tune here. */
export const MATCHUP_PAR_RAW = 2500;

/**
 * Rule revision stamped on new rounds (puzzle.matchupRev); absent = original rules.
 * 2 = Jackpot gem + constant play with fast 18-tick cascade steps (shipped in #15).
 * 3 = the same, but every step falls and refills at the original speed: the next
 *     cascade step waits for the previous step's full original-speed animation.
 */
export const MATCHUP_REV = 3;
export const MATCHUP_REV2 = 2;
/** matchupRev 2 Jackpot gem: kinds MATCHUP_JACKPOT + colour (10…15). */
export const MATCHUP_JACKPOT = 10;
/** matchupRev 2: ticks between one cascade step and the next (the swap's own clear is immediate). */
export const MATCHUP_V2_STEP_TICKS = 18;
/**
 * matchupRev 2 par: raw points for 150. Constant play removes the wait for each
 * cascade animation, so the same player makes far more swaps: a full-board swap
 * bot at a 1 s think time scored 2.2× the raw points of the original rules.
 * Doubling the par keeps scores level at about a 1.2 s pace.
 */
export const MATCHUP_V2_PAR_RAW = 5000;
/**
 * matchupRev 3 par, re-measured with the same swap bot at the original fall speed:
 * against the original rules it needs 5,350 (1.2 s a swap) to 5,960 (1.1 s) for level
 * scores, so 5,500 (rev 2 used 5,000).
 */
export const MATCHUP_V3_PAR_RAW = 5500;

/** True for the constant-play revisions (2 and 3). */
export function matchupConstantPlay(state: Pick<MatchupState, "rev">): boolean {
  return state.rev === MATCHUP_REV2 || state.rev === MATCHUP_REV;
}

/**
 * matchupRev 3: ticks from a resolution step to the next cascade step, which is
 * the step's own original-speed animation (MATCHUP_CLEAR_MS + rows × MATCHUP_DROP_MS),
 * plus the 150 ms swap tween when the step is the swap's own clear.
 */
export function matchupV3StepTicks(dropRows: number, fromSwap: boolean): number {
  const ms = (fromSwap ? MATCHUP_V3_SWAP_MS : 0) + MATCHUP_CLEAR_MS + Math.max(1, dropRows) * MATCHUP_DROP_MS;
  return Math.ceil((ms * TICKS_PER_SECOND) / 1000);
}
/** The phone's swap tween (matchup.renderer MATCHUP_SWAP_MS). */
export const MATCHUP_V3_SWAP_MS = 150;

/** True for a Jackpot gem (matchupRev 2) of any colour. */
export function matchupIsJackpot(kind: number): boolean {
  return kind >= MATCHUP_JACKPOT && kind < MATCHUP_JACKPOT + MATCHUP_KINDS;
}

/** Cells are 50 px; symbols are drawn at 70% of the cell. */
export const MATCHUP_CELL_PX = 50;
export const MATCHUP_SYMBOL_PCT = 70;
export const MATCHUP_BOARD_W = MATCHUP_SIZE * MATCHUP_CELL_PX;
export const MATCHUP_BOARD_H = MATCHUP_ROWS * MATCHUP_CELL_PX;
export const MATCHUP_BOARD_X = Math.round((MATCHUP_WORLD_W - MATCHUP_BOARD_W) / 2);
export const MATCHUP_BOARD_Y = 100;
/** The next-symbol strip: the board's width, 6 px above the board. */
export const MATCHUP_NEXT_H = 34;
export const MATCHUP_NEXT_Y = MATCHUP_BOARD_Y - 6 - MATCHUP_NEXT_H;

/** Fixed refill queue per column, built once at init. */
export const MATCHUP_QUEUE_LEN = 70;

/** Line length to points: 3 = 10, 4 = 25, 5 or more = 50. */
export function matchupLinePoints(length: number): number {
  if (length >= 5) return 50;
  if (length === 4) return 25;
  if (length === 3) return 10;
  return 0;
}

/** Ticks of no scoring swap before the hint appears (five seconds). */
export const MATCHUP_HINT_TICKS = 5 * TICKS_PER_SECOND;

/** A swap: a = row1, b = col1, c = row2, d = col2. */
export const MATCHUP_INPUT_SWAP = 3;
export const MATCHUP_INPUT_RANGES: readonly InputRange[] = [
  inputRange(
    MATCHUP_INPUT_SWAP,
    [0, MATCHUP_ROWS - 1],
    [0, MATCHUP_SIZE - 1],
    [0, MATCHUP_ROWS - 1],
    [0, MATCHUP_SIZE - 1],
  ),
];

export const MATCHUP_SHAPES = [
  "circle",
  "square",
  "triangle",
  "diamond",
  "star",
  "hexagon",
] as const;
export type MatchupShape = (typeof MATCHUP_SHAPES)[number];

function isNormal(kind: number): boolean {
  return kind >= 0 && kind < MATCHUP_KINDS;
}

function isSpecial(kind: number): boolean {
  // Jackpots only ever exist on matchupRev 2 boards, so original boards behave as before.
  return kind === MATCHUP_BOMB || kind === MATCHUP_CROSS || kind === MATCHUP_STAR || matchupIsJackpot(kind);
}

/** One game colour per symbol kind. */
export const MATCHUP_COLOURS = [
  "#F5B82E",
  "#FF4D4D",
  "#4D8CFF",
  "#3DDC84",
  "#B26BFF",
  "#FF6BD6",
] as const;

/* ============================ Board helpers ============================ */

export function matchupIndex(row: number, col: number): number {
  return row * MATCHUP_SIZE + col;
}

function adjacent(r1: number, c1: number, r2: number, c2: number): boolean {
  const dr = Math.abs(r1 - r2);
  const dc = Math.abs(c1 - c2);
  return dr + dc === 1;
}

export interface MatchupRun {
  /** Cell indices in this line, in board order. */
  cells: number[];
  length: number;
  points: number;
}

/** Every maximal run of three or more, rows then columns. An L or T yields two. */
export function matchupRuns(cells: readonly number[]): MatchupRun[] {
  const runs: MatchupRun[] = [];
  const push = (group: number[]) => {
    if (group.length >= 3) {
      runs.push({ cells: group, length: group.length, points: matchupLinePoints(group.length) });
    }
  };
  const rows = matchupRowsOf(cells);
  for (let row = 0; row < rows; row++) {
    let group: number[] = [];
    for (let col = 0; col < MATCHUP_SIZE; col++) {
      const index = matchupIndex(row, col);
      const lastIndex = group.length > 0 ? group[group.length - 1] : undefined;
      const previous = lastIndex === undefined ? -1 : (cells[lastIndex] ?? -1);
      const current = cells[index] ?? -1;
      if (isNormal(current) && current === previous) group.push(index);
      else {
        push(group);
        group = isNormal(current) ? [index] : [];
      }
    }
    push(group);
  }
  for (let col = 0; col < MATCHUP_SIZE; col++) {
    let group: number[] = [];
    for (let row = 0; row < rows; row++) {
      const index = matchupIndex(row, col);
      const lastIndex = group.length > 0 ? group[group.length - 1] : undefined;
      const previous = lastIndex === undefined ? -1 : (cells[lastIndex] ?? -1);
      const current = cells[index] ?? -1;
      if (isNormal(current) && current === previous) group.push(index);
      else {
        push(group);
        group = isNormal(current) ? [index] : [];
      }
    }
    push(group);
  }
  return runs;
}

export function matchupHasLine(cells: readonly number[]): boolean {
  return matchupRuns(cells).length > 0;
}

export interface MatchupSwap {
  row1: number;
  col1: number;
  row2: number;
  col2: number;
}

/**
 * The first swap that would make a line, scanning rows then columns — used for
 * the render-only hint and for the "is this board playable" test. Derived from
 * the state, so every player is shown the same hint.
 */
export function matchupFindSwap(cells: readonly number[]): MatchupSwap | null {
  const board = [...cells];
  const test = (row1: number, col1: number, row2: number, col2: number): MatchupSwap | null => {
    const a = matchupIndex(row1, col1);
    const b = matchupIndex(row2, col2);
    if (isSpecial(board[a] ?? -1) || isSpecial(board[b] ?? -1)) return { row1, col1, row2, col2 };
    if (board[a] === board[b]) return null;
    const av = board[a] ?? 0;
    const bv = board[b] ?? 0;
    board[a] = bv;
    board[b] = av;
    const made = matchupHasLine(board);
    board[a] = av;
    board[b] = bv;
    return made ? { row1, col1, row2, col2 } : null;
  };
  const rows = matchupRowsOf(cells);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < MATCHUP_SIZE; col++) {
      if (col + 1 < MATCHUP_SIZE) {
        const found = test(row, col, row, col + 1);
        if (found) return found;
      }
      if (row + 1 < rows) {
        const found = test(row, col, row + 1, col);
        if (found) return found;
      }
    }
  }
  return null;
}

/* ================================ State ================================ */

export interface MatchupAnimMove {
  kind: number;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

export interface MatchupAnimSpecial {
  index: number;
  kind: number;
}

export interface MatchupAnimStep {
  before: number[];
  after: number[];
  cleared: number[];
  detonated: number[];
  created: MatchupAnimSpecial[];
  specialIndex: number;
  specialKind: number;
  moves: MatchupAnimMove[];
  ticks: number;
}

export interface MatchupState extends BandFields {
  tick: number;
  rng: number;
  /** Row-major, row 0 at the top. */
  cells: number[];
  /** One fixed refill queue per column, drawn at init only. */
  queues: number[][];
  /** How far into each column's queue the refills have reached. */
  heads: number[];
  /** Scoring swaps made. */
  swaps: number;
  /** Raw points earned; the round score is this divided by eight. */
  raw: number;
  /** The longest line cleared so far. */
  bestLine: number;
  /** Cascade steps resolved across the whole run. */
  cascades: number;
  /** Deterministic reshuffles because no valid swap was left. */
  reshuffles: number;
  /** Tick of the last scoring swap — the hint waits five seconds after it. */
  lastScoreTick: number;
  /** The last swap's result, for the client's animation. Render only. */
  lastGain: number;
  lastSteps: number;
  lastCleared: number[];
  lastAnimation: MatchupAnimStep[];
  lastAnimTicks: number;
  /** A swap that made no line, so it swaps back. Render only. */
  lastInvalidA: number;
  lastInvalidB: number;
  lastInvalidTick: number;
  endedTick: number;
  /** matchupRev 2 only; absent on unstamped rounds. */
  rev?: number;
  /** The tick the next cascade step resolves on, or 0 when the board is settled. */
  pendingTick?: number;
  /** Resolution steps so far; the phone animates each new one. */
  resolveSerial?: number;
  /** Jackpot gems made and set off. */
  jackpots?: number;
  jackpotsFired?: number;
  /**
   * matchupRev 5 only (Tuning C): swaps are refused before this tick, while the
   * last swap's gems clear and fall at the original speed. Absent on every earlier round.
   */
  busyUntil?: number;
  /** matchupRev 6 only (Tuning F): rev-5 play scored on the 2,800 par curve. Absent on every earlier round. */
  tunef?: number;
  /**
   * matchupRev 9 only (expansion E6; absent on every earlier round): the goals mark, the level being
   * played and its gems still to collect (one count per colour, 0 for colours not in the goal), levels
   * completed, the frozen cells (1 = iced, per board cell), ice broken, treasure gems collected and placed,
   * the cascade multiplier's extra match points, the last swap's deepest multiplier, and the seeded plan.
   */
  goals?: number;
  level?: number;
  goalLeft?: number[];
  levels?: number;
  ice?: number[];
  iceBroken?: number;
  treasures?: number;
  treasurePlaced?: number;
  cascadeExtra?: number;
  lastMult?: number;
  plan?: MatchupV9Plan;
  /**
   * matchupRev 10 only (absent on every earlier round): the 90 s run, a gem may be swapped into or out of an
   * iced cell when the swap makes a line of three, and the ice is laid once at the start (never refreshed).
   */
  iceSwap?: number;
  /**
   * matchupRev 11 only (the arcade scoring standard, absent on every earlier round): the standard mark, gems cleared
   * (every cleared cell but a treasure collected) and lines of 4 or 5 made by a swap's own match.
   */
  std?: number;
  gemsCleared?: number;
  bigLines?: number;
  /**
   * matchupRev 12 only (six goals and six treasures, absent on every earlier round): the mark, and each colour's goal
   * (gems of that colour to clear, from MATCHUP_V12_GOAL_LADDER in a seeded order). All six goals are shown at once;
   * `goalLeft` counts down to 0 per colour and `levels` counts the goals met.
   */
  six?: number;
  goalNeed?: number[];
}

/** matchupRev 9: the run's seeded levels (goal colours and counts, ice cells) and treasure columns, drawn at init. */
export interface MatchupV9Plan {
  colours: number[][];
  need: number[];
  ice: number[][];
  treasureCols: number[];
}

function drawSymbol(rng: number): { state: number; value: number } {
  return rngBelow(rng, MATCHUP_KINDS);
}

/** A board with no line already on it and at least one valid swap. */
function rollBoard(rng: number, count = MATCHUP_CELLS): { state: number; cells: number[] } {
  let state = rng;
  for (let attempt = 0; attempt < 400; attempt++) {
    const cells: number[] = [];
    for (let index = 0; index < count; index++) {
      const drawn = drawSymbol(state);
      state = drawn.state;
      cells.push(drawn.value);
    }
    if (!matchupHasLine(cells) && matchupFindSwap(cells)) return { state, cells };
  }
  // Unreachable in practice; a fixed fallback keeps the sim total.
  const cells = Array.from({ length: count }, (_, index) => index % MATCHUP_KINDS);
  return { state, cells };
}

function init(seed: number): MatchupState {
  const rolled = rollBoard(seed | 0);
  let rng = rolled.state;
  const queues: number[][] = [];
  for (let col = 0; col < MATCHUP_SIZE; col++) {
    const queue: number[] = [];
    for (let slot = 0; slot < MATCHUP_QUEUE_LEN; slot++) {
      const drawn = drawSymbol(rng);
      rng = drawn.state;
      queue.push(drawn.value);
    }
    queues.push(queue);
  }
  return {
    tick: 0,
    rng,
    cells: rolled.cells,
    queues,
    heads: Array.from({ length: MATCHUP_SIZE }, () => 0),
    swaps: 0,
    raw: 0,
    bestLine: 0,
    cascades: 0,
    reshuffles: 0,
    lastScoreTick: 0,
    lastGain: 0,
    lastSteps: 0,
    lastCleared: [],
    lastAnimation: [],
    lastAnimTicks: 0,
    lastInvalidA: -1,
    lastInvalidB: -1,
    lastInvalidTick: 0,
    endedTick: 0,
  };
}

function isHorizontal(run: MatchupRun): boolean {
  const first = run.cells[0] ?? 0;
  const second = run.cells[1] ?? first;
  return second - first === 1;
}

function middleCell(run: MatchupRun): number {
  return run.cells[run.cells.length >> 1] ?? run.cells[0] ?? 0;
}

function lineSpecialIndex(run: MatchupRun, preferred: number | null): number {
  return preferred !== null && run.cells.includes(preferred) ? preferred : middleCell(run);
}

function addBlast(index: number, kind: number, gone: Set<number>, cells: readonly number[] = []): number {
  let gained = 0;
  const row = Math.trunc(index / MATCHUP_SIZE);
  const col = index % MATCHUP_SIZE;
  const rows = cells.length ? matchupRowsOf(cells) : MATCHUP_ROWS;
  const add = (target: number) => {
    if (!gone.has(target)) {
      gone.add(target);
      gained += 10;
    }
  };
  if (kind === MATCHUP_BOMB) {
    for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
      for (let c = Math.max(0, col - 1); c <= Math.min(MATCHUP_SIZE - 1, col + 1); c++) {
        add(matchupIndex(r, c));
      }
    }
  } else if (kind === MATCHUP_CROSS) {
    for (let c = 0; c < MATCHUP_SIZE; c++) add(matchupIndex(row, c));
    for (let r = 0; r < rows; r++) add(matchupIndex(r, col));
  } else if (matchupIsJackpot(kind)) {
    // Every gem of its colour, then its whole row and column.
    const colour = kind - MATCHUP_JACKPOT;
    for (let target = 0; target < rows * MATCHUP_SIZE; target++) if (cells[target] === colour) add(target);
    for (let c = 0; c < MATCHUP_SIZE; c++) add(matchupIndex(row, c));
    for (let r = 0; r < rows; r++) add(matchupIndex(r, col));
  } else if (kind === MATCHUP_STAR) {
    for (let d = -(MATCHUP_SIZE - 1); d <= MATCHUP_SIZE - 1; d++) {
      const r1 = row + d;
      const c1 = col + d;
      const c2 = col - d;
      if (r1 < 0 || r1 >= rows) continue;
      if (c1 >= 0 && c1 < MATCHUP_SIZE) add(matchupIndex(r1, c1));
      if (c2 >= 0 && c2 < MATCHUP_SIZE) add(matchupIndex(r1, c2));
    }
  }
  return gained;
}

function expandSpecials(
  cells: readonly number[],
  gone: Set<number>,
  initial: readonly number[],
): { gained: number; detonated: number[] } {
  let gained = 0;
  const detonated: number[] = [];
  const queue = [...initial];
  for (const index of gone)
    if (isSpecial(cells[index] ?? -1) && !queue.includes(index)) queue.push(index);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor] ?? -1;
    if (detonated.includes(index)) continue;
    const kind = cells[index] ?? -1;
    if (!isSpecial(kind)) continue;
    detonated.push(index);
    gained += addBlast(index, kind, gone, cells);
    for (const target of gone) {
      if (
        isSpecial(cells[target] ?? -1) &&
        !detonated.includes(target) &&
        !queue.includes(target)
      ) {
        queue.push(target);
      }
    }
  }
  return { gained, detonated };
}

function fallAndRefill(
  cells: number[],
  queues: readonly number[][],
  heads: number[],
  gone: Set<number>,
): { moves: MatchupAnimMove[] } {
  const moves: MatchupAnimMove[] = [];
  const rows = matchupRowsOf(cells);
  for (let col = 0; col < MATCHUP_SIZE; col++) {
    const kept: { kind: number; row: number }[] = [];
    for (let row = rows - 1; row >= 0; row--) {
      const index = matchupIndex(row, col);
      if (!gone.has(index)) kept.push({ kind: cells[index] ?? 0, row });
    }
    const queue = queues[col] ?? [];
    for (let row = rows - 1; row >= 0; row--) {
      const depth = rows - 1 - row;
      const target = matchupIndex(row, col);
      if (depth < kept.length) {
        const item = kept[depth];
        if (!item) continue;
        cells[target] = item.kind;
        if (item.row !== row)
          moves.push({ kind: item.kind, fromRow: item.row, fromCol: col, toRow: row, toCol: col });
      } else {
        const head = heads[col] ?? 0;
        const slot = head % MATCHUP_QUEUE_LEN;
        heads[col] = head + 1;
        const kind = queue[slot] ?? 0;
        const fromRow = -(depth - kept.length + 1);
        cells[target] = kind;
        moves.push({ kind, fromRow, fromCol: col, toRow: row, toCol: col });
      }
    }
  }
  return { moves };
}

/** Clears, falls and refills until nothing more lines up. Mutates its inputs. */
function resolveBoard(
  cells: number[],
  queues: readonly number[][],
  heads: number[],
  preferredSpecial: number | null,
  detonations: readonly number[] = [],
  otherSwapped: number | null = null,
  /**
   * matchupRev 2: resolve at most this many steps, and allow a Jackpot on the first. matchupRev 9 (`treasure`):
   * treasure gems are never cleared by a blast, and one in the bottom row is collected as a step of its own.
   */
  v2: { maxSteps: number; jackpot: boolean; treasure?: boolean } | null = null,
): { gain: number; steps: number; best: number; cleared: number[]; animation: MatchupAnimStep[]; jackpots: number; fired: number; treasures: number; stepGains: number[] } {
  let gain = 0;
  let steps = 0;
  let best = 0;
  let preferred = preferredSpecial;
  const cleared: number[] = [];
  const animation: MatchupAnimStep[] = [];
  let jackpots = 0;
  let fired = 0;
  let treasures = 0;
  const stepGains: number[] = [];

  for (;;) {
    if (v2 && steps >= v2.maxSteps) break;
    const activeDetonations = steps === 0 ? detonations : [];
    const runs = matchupRuns(cells);
    const collected = v2?.treasure ? bottomTreasures(cells) : [];
    if (runs.length === 0 && activeDetonations.length === 0 && collected.length === 0) break;
    const gainBefore = gain;

    const before = [...cells];
    const gone = new Set<number>();
    const created = new Map<number, number>();

    // Every horizontal/vertical intersection makes an L/T special, including refills.
    // Prefer the swapped cells on the first resolution, then scan in board order.
    const starRuns = new Set<MatchupRun>();
    const candidates = [...new Set([
      ...(steps === 0 ? [preferred, otherSwapped].filter((cell): cell is number => cell !== null) : []),
      ...runs.flatMap((run) => run.cells),
    ])];
    for (const cell of candidates) {
      const through = runs.filter((run) => run.cells.includes(cell));
      const horizontal = through.find((run) => isHorizontal(run));
      const vertical = through.find((run) => !isHorizontal(run));
      if (horizontal && vertical && !starRuns.has(horizontal) && !starRuns.has(vertical)) {
        starRuns.add(horizontal);
        starRuns.add(vertical);
        // matchupRev 2: the swap's own L/T with a line of 5+ makes a Jackpot in that colour.
        const jackpot = v2?.jackpot && steps === 0 && (horizontal.length >= 5 || vertical.length >= 5);
        created.set(cell, jackpot ? MATCHUP_JACKPOT + (cells[cell] ?? 0) : MATCHUP_STAR);
        if (jackpot) jackpots += 1;
      }
    }

    for (const run of runs) {
      gain += run.points;
      if (starRuns.has(run)) {
        if (run.length > best) best = run.length;
        for (const index of run.cells) if (!created.has(index)) gone.add(index);
        continue;
      }
      if (run.length > best) best = run.length;
      let specialIndex = -1;
      let specialKind = -1;
      if (run.length === 4) {
        specialIndex = lineSpecialIndex(run, preferred);
        specialKind = MATCHUP_BOMB;
      } else if (run.length >= 5) {
        specialIndex = lineSpecialIndex(run, preferred);
        specialKind = MATCHUP_CROSS;
      }
      if (specialIndex >= 0 && !created.has(specialIndex)) created.set(specialIndex, specialKind);
      for (const index of run.cells) if (index !== specialIndex) gone.add(index);
    }

    for (const [index, kind] of created) cells[index] = kind;
    for (const index of created.keys()) gone.delete(index);

    const special = expandSpecials(cells, gone, activeDetonations);
    gain += special.gained;
    for (const index of special.detonated) if (matchupIsJackpot(cells[index] ?? -1)) fired += 1;
    for (const index of special.detonated) gone.add(index);
    if (v2?.treasure) {
      // matchupRev 9: a blast passes over a treasure gem (and scores nothing for it); one on the bottom row is collected.
      for (const index of [...gone]) {
        if (cells[index] !== MATCHUP_TREASURE) continue;
        gone.delete(index);
        gain -= 10;
      }
      for (const index of collected) gone.add(index);
      treasures += collected.length;
    }

    if (gone.size === 0) break;
    const stepCleared = [...gone].sort((a, b) => a - b);
    for (const index of stepCleared) cleared.push(index);

    const { moves } = fallAndRefill(cells, queues, heads, gone);
    const maxDrop = moves.reduce((max, move) => Math.max(max, move.toRow - move.fromRow), 1);
    const specialEntry = [...created.entries()][0];
    animation.push({
      before,
      after: [...cells],
      cleared: stepCleared,
      detonated: special.detonated,
      created: [...created.entries()].map(([index, kind]) => ({ index, kind })),
      specialIndex: specialEntry?.[0] ?? -1,
      specialKind: specialEntry?.[1] ?? -1,
      moves,
      ticks: maxDrop,
    });

    stepGains.push(gain - gainBefore);
    steps += 1;
    preferred = null;
    if (steps > 64) break;
  }

  return { gain, steps, best, cleared, animation, jackpots, fired, treasures, stepGains };
}

/** A board with no valid swap is reshuffled with the state's own PRNG. */
function reshuffle(cells: number[], rng: number): { state: number; cells: number[] } {
  let state = rng;
  for (let attempt = 0; attempt < 200; attempt++) {
    const next = [...cells];
    for (let i = next.length - 1; i > 0; i--) {
      const drawn = rngBelow(state, i + 1);
      state = drawn.state;
      const j = drawn.value;
      const iv = next[i] ?? 0;
      const jv = next[j] ?? 0;
      next[i] = jv;
      next[j] = iv;
    }
    if (!matchupHasLine(next) && matchupFindSwap(next)) return { state, cells: next };
  }
  return { state, cells };
}

function isOver(state: MatchupState): boolean {
  return state.tick >= matchupRunTicksOf(state);
}

function initRev2(seed: number): MatchupState {
  return { ...init(seed), rev: MATCHUP_REV2, pendingTick: 0, resolveSerial: 0, jackpots: 0, jackpotsFired: 0 };
}

function initRev3(seed: number): MatchupState {
  return { ...initRev2(seed), rev: MATCHUP_REV };
}

/** matchupRev 2: true while cascade steps are still to resolve (the board is not settled). */
export function matchupPending(state: MatchupState): boolean {
  return (state.pendingTick ?? 0) > 0;
}

/**
 * matchupRev 2 step. A valid swap resolves its own clear on this tick; each
 * cascade after it resolves MATCHUP_V2_STEP_TICKS later, one step at a time,
 * while further swaps are accepted on any tick. A swap is valid when it puts
 * one of its two gems in a line, or moves a special.
 */
function stepRev2(state: MatchupState, input: ArcadeInputEvent | null): MatchupState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const done = (next: MatchupState) => (isOver(next) ? { ...next, endedTick: tick } : next);
  /** Settled after this step: reshuffle a board with no valid swap left. */
  const settle = (next: MatchupState, fromSwap: boolean): MatchupState => {
    // Rev 2: a fixed 18-tick gap. Rev 3: wait for the step's original-speed fall.
    const gap = state.rev === MATCHUP_REV ? matchupV3StepTicks(next.lastAnimation[0]?.ticks ?? 1, fromSwap) : MATCHUP_V2_STEP_TICKS;
    if (matchupHasLine(next.cells)) return { ...next, pendingTick: tick + gap };
    if (matchupFindSwap(next.cells)) return { ...next, pendingTick: 0 };
    const shuffled = reshuffle([...next.cells], next.rng);
    return { ...next, pendingTick: 0, rng: shuffled.state, cells: shuffled.cells, reshuffles: next.reshuffles + 1 };
  };

  if (input && input.k === MATCHUP_INPUT_SWAP) {
    const row1 = clampInt(input.a, 0, MATCHUP_ROWS - 1);
    const col1 = clampInt(input.b, 0, MATCHUP_SIZE - 1);
    const row2 = clampInt(input.c, 0, MATCHUP_ROWS - 1);
    const col2 = clampInt(input.d, 0, MATCHUP_SIZE - 1);
    if (adjacent(row1, col1, row2, col2)) {
      const a = matchupIndex(row1, col1);
      const b = matchupIndex(row2, col2);
      const cells = [...state.cells];
      const av = cells[a] ?? 0;
      const bv = cells[b] ?? 0;
      cells[a] = bv;
      cells[b] = av;
      const specialSeeds = [a, b].filter((index) => isSpecial(cells[index] ?? -1));
      const own = matchupRuns(cells).some((run) => run.cells.includes(a) || run.cells.includes(b));
      if (!own && specialSeeds.length === 0) {
        return done({
          ...state,
          tick,
          lastInvalidA: a,
          lastInvalidB: b,
          lastInvalidTick: tick,
          lastGain: 0,
          lastCleared: [],
          lastAnimation: [],
          lastAnimTicks: 0,
        });
      }
      const heads = [...state.heads];
      const resolved = resolveBoard(cells, state.queues, heads, b, specialSeeds, a, { maxSteps: 1, jackpot: true });
      return done(
        settle({
          ...state,
          tick,
          cells,
          heads,
          swaps: state.swaps + 1,
          raw: state.raw + resolved.gain,
          bestLine: Math.max(state.bestLine, resolved.best),
          lastScoreTick: tick,
          lastGain: resolved.gain,
          lastSteps: 1,
          lastCleared: resolved.cleared,
          lastAnimation: resolved.animation,
          lastAnimTicks: MATCHUP_V2_STEP_TICKS,
          lastInvalidA: -1,
          lastInvalidB: -1,
          resolveSerial: (state.resolveSerial ?? 0) + 1,
          jackpots: (state.jackpots ?? 0) + resolved.jackpots,
          jackpotsFired: (state.jackpotsFired ?? 0) + resolved.fired,
        }, true),
      );
    }
  }

  if (matchupPending(state) && tick >= (state.pendingTick ?? 0)) {
    const cells = [...state.cells];
    const heads = [...state.heads];
    const resolved = resolveBoard(cells, state.queues, heads, null, [], null, { maxSteps: 1, jackpot: false });
    return done(
      settle({
        ...state,
        tick,
        cells,
        heads,
        raw: state.raw + resolved.gain,
        bestLine: Math.max(state.bestLine, resolved.best),
        cascades: state.cascades + resolved.steps,
        lastGain: resolved.gain,
        lastSteps: state.lastSteps + 1,
        lastCleared: resolved.cleared,
        lastAnimation: resolved.animation,
        lastAnimTicks: MATCHUP_V2_STEP_TICKS,
        resolveSerial: (state.resolveSerial ?? 0) + 1,
        jackpotsFired: (state.jackpotsFired ?? 0) + resolved.fired,
      }, false),
    );
  }

  return done({ ...state, tick });
}

function step(state: MatchupState, input: ArcadeInputEvent | null): MatchupState {
  if (state.rev === MATCHUP_REV_WAIT) return state.goals ? stepGoals(state, input) : stepWait(state, input);
  if (matchupConstantPlay(state)) return stepRev2(state, input);
  if (isOver(state)) return state;
  const tick = state.tick + 1;

  if (input && input.k === MATCHUP_INPUT_SWAP) {
    const row1 = clampInt(input.a, 0, MATCHUP_ROWS - 1);
    const col1 = clampInt(input.b, 0, MATCHUP_SIZE - 1);
    const row2 = clampInt(input.c, 0, MATCHUP_ROWS - 1);
    const col2 = clampInt(input.d, 0, MATCHUP_SIZE - 1);
    if (adjacent(row1, col1, row2, col2)) {
      const a = matchupIndex(row1, col1);
      const b = matchupIndex(row2, col2);
      const movedIndex = b;
      const cells = [...state.cells];
      const av = cells[a] ?? 0;
      const bv = cells[b] ?? 0;
      cells[a] = bv;
      cells[b] = av;
      const specialSeeds = [a, b].filter((index) => isSpecial(cells[index] ?? -1));
      if (!matchupHasLine(cells) && specialSeeds.length === 0) {
        // No line: it swaps back (the client animates it) and costs nothing.
        const next: MatchupState = {
          ...state,
          tick,
          lastInvalidA: a,
          lastInvalidB: b,
          lastInvalidTick: tick,
          lastGain: 0,
          lastSteps: 0,
          lastCleared: [],
          lastAnimation: [],
          lastAnimTicks: 0,
        };
        return isOver(next) ? { ...next, endedTick: tick } : next;
      }
      const heads = [...state.heads];
      const resolved = resolveBoard(cells, state.queues, heads, movedIndex, specialSeeds, a);
      let rng = state.rng;
      let board = cells;
      let reshuffles = state.reshuffles;
      if (!matchupFindSwap(board)) {
        const shuffled = reshuffle(board, rng);
        rng = shuffled.state;
        board = shuffled.cells;
        reshuffles += 1;
      }
      const next: MatchupState = {
        ...state,
        tick,
        rng,
        cells: board,
        heads,
        swaps: state.swaps + 1,
        raw: state.raw + resolved.gain,
        bestLine: Math.max(state.bestLine, resolved.best),
        cascades: state.cascades + Math.max(0, resolved.steps - 1),
        reshuffles,
        lastScoreTick: tick,
        lastGain: resolved.gain,
        lastSteps: resolved.steps,
        lastCleared: resolved.cleared,
        lastAnimation: resolved.animation,
        lastAnimTicks: resolved.animation.reduce(
          (total, item) => total + 12 + Math.max(1, item.ticks) * 7 + 15,
          0,
        ),
        lastInvalidA: -1,
        lastInvalidB: -1,
      };
      return isOver(next) ? { ...next, endedTick: tick } : next;
    }
  }

  const next: MatchupState = { ...state, tick };
  return isOver(next) ? { ...next, endedTick: tick } : next;
}

/** The par a round scores against: matchupRev 2 has its own. */
export function matchupParRaw(state: Pick<MatchupState, "rev" | "band" | "goals" | "iceSwap" | "std" | "six">): number {
  // matchupRev 11 scores gems cleared, not match points: its par is the gems that fill the core.
  if (state.std) return matchupCoreGemsOf(state);
  if (state.iceSwap) return bandTop(MATCHUP_V10_BAND_CURVE);
  if (state.goals) return bandTop(MATCHUP_V9_BAND_CURVE);
  // Score-band rounds (matchupRev 4) reach 150 at the band curve's top; matchupRev 5 at 2,500.
  if (state.band) return bandTop(matchupBandCurve(state));
  if (state.rev === MATCHUP_REV) return MATCHUP_V3_PAR_RAW;
  return state.rev === MATCHUP_REV2 ? MATCHUP_V2_PAR_RAW : MATCHUP_PAR_RAW;
}

function score(state: MatchupState): number {
  return clampInt(Math.floor((150 * state.raw) / matchupParRaw(state)), 0, 150);
}

/** True once the hint should be shown. Derived from the sim, so it is shared. */
export function matchupShowHint(state: MatchupState): boolean {
  return state.tick - state.lastScoreTick >= MATCHUP_HINT_TICKS;
}

/* =========================== Integrity checks ========================== */

export const MATCHUP_CHECKPOINT_INTERVAL = 300;

export interface MatchupCheckpointState {
  tick: number;
  swaps: number;
  raw: number;
  bestLine: number;
  cascades: number;
  reshuffles: number;
  /** FNV-1a over the board and the queue heads. */
  board: number;
}

export interface MatchupCheckpoint extends MatchupCheckpointState {
  checksum: number;
}

function fnv(values: readonly number[]): number {
  let sum = 0x811c9dc5;
  for (const value of values) {
    sum ^= value | 0;
    sum = Math.imul(sum, 0x01000193) >>> 0;
  }
  return sum;
}

export function matchupCheckpointState(state: MatchupState): MatchupCheckpointState {
  return {
    tick: state.tick,
    swaps: state.swaps,
    raw: state.raw,
    bestLine: state.bestLine,
    cascades: state.cascades,
    reshuffles: state.reshuffles,
    board: fnv([...state.cells, ...state.heads]),
  };
}

export function matchupCheckpoint(state: MatchupState): MatchupCheckpoint {
  const snapshot = matchupCheckpointState(state);
  // matchupRev 2 folds its pending step and jackpots into the checksum; the encoded fields stay the same.
  const extra = matchupConstantPlay(state) ? [state.pendingTick ?? 0, state.resolveSerial ?? 0, state.jackpots ?? 0, state.jackpotsFired ?? 0] : [];
  // matchupRev 5 folds its wait and jackpots in after the unchanged fields.
  if (state.busyUntil !== undefined) extra.push(state.busyUntil, state.jackpots ?? 0, state.jackpotsFired ?? 0);
  // matchupRev 6 (tunef) changes only the curve, so its checksum is matchupRev 5's: the same play replays without desync.
  // matchupRev 9 (goals): its level, goals, ice, treasure and cascade counters, last.
  if (state.goals) extra.push(state.goals, state.level ?? 0, state.levels ?? 0, state.iceBroken ?? 0, state.treasures ?? 0, state.treasurePlaced ?? 0, state.cascadeExtra ?? 0, fnv(state.ice ?? []), fnv(state.goalLeft ?? []));
  // matchupRev 11 (std): its gem and big-line counters, last.
  if (state.std) extra.push(state.std, state.gemsCleared ?? 0, state.bigLines ?? 0);
  // matchupRev 12 (six): its mark and the six goals' targets, last.
  if (state.six) extra.push(state.six, fnv(state.goalNeed ?? []));
  return { ...snapshot, checksum: fnv([...Object.values(snapshot), ...extra]) };
}

/* ================================ Drawing ============================== */

export const MATCHUP_BG = "#0B0B0F";
export const MATCHUP_GOLD = "#F5B82E";
export const MATCHUP_TEXT = "#F7F7F8";

export interface MatchupTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function matchupTransform(size: CanvasSize, worldH = MATCHUP_WORLD_H): MatchupTransform {
  const scale = Math.min(size.width / MATCHUP_WORLD_W, size.height / worldH);
  return {
    scale,
    offsetX: (size.width - MATCHUP_WORLD_W * scale) / 2,
    offsetY: (size.height - worldH * scale) / 2,
  };
}

/** Canvas point to a board cell, or null outside the board. */
export function matchupCellAt(
  size: CanvasSize,
  x: number,
  y: number,
  /** matchupRev 9: the taller board's rows and world height. */
  rows = MATCHUP_ROWS,
  worldH = MATCHUP_WORLD_H,
): { row: number; col: number } | null {
  const { scale, offsetX, offsetY } = matchupTransform(size, worldH);
  const divisor = Math.max(scale, 0.0001);
  const wx = (x - offsetX) / divisor - MATCHUP_BOARD_X;
  const wy = (y - offsetY) / divisor - MATCHUP_BOARD_Y;
  const col = Math.floor(wx / MATCHUP_CELL_PX);
  const row = Math.floor(wy / MATCHUP_CELL_PX);
  if (row < 0 || col < 0 || row >= rows || col >= MATCHUP_SIZE) return null;
  return { row, col };
}

export const MATCHUP_CLEAR_MS = 200;
export const MATCHUP_DROP_MS = 120;
export const MATCHUP_DETONATE_MS = 250;
/** matchupRev 2 step animation: 110 ms clear, then 45 ms a row of drop, at most 180 ms (fits in 18 ticks). */
export const MATCHUP_V2_CLEAR_MS = 110;
export const MATCHUP_V2_DROP_MS = 45;
export const MATCHUP_V2_DROP_MAX_MS = 180;

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

/** One symbol, centred on (cx, cy), at the given radius. */
export function matchupDrawSymbol(
  ctx: CanvasRenderingContext2D,
  kind: number,
  cx: number,
  cy: number,
  radius: number,
): void {
  if (kind === MATCHUP_BOMB) {
    ctx.save();
    ctx.fillStyle = "#000000";
    ctx.strokeStyle = "#D9D9D9";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy + radius * 0.12, radius * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + radius * 0.3, cy - radius * 0.5);
    ctx.quadraticCurveTo(cx + radius * 0.3, cy - radius, cx + radius * 0.7, cy - radius * 0.9);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (kind === MATCHUP_STAR) {
    ctx.save();
    ctx.fillStyle = "#F7F7F8";
    ctx.strokeStyle = MATCHUP_GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let point = 0; point < 12; point++) {
      const r = point % 2 === 0 ? radius : radius * 0.42;
      const angle = (Math.PI / 6) * point - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (point === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (kind === MATCHUP_CROSS) {
    ctx.save();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    for (let point = 0; point < 8; point++) {
      const r = point % 2 === 0 ? radius * 1.12 : radius * 0.4;
      const angle = point * Math.PI / 4 - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (point === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  const shape = MATCHUP_SHAPES[kind] ?? "circle";
  ctx.fillStyle = MATCHUP_COLOURS[kind] ?? MATCHUP_GOLD;
  ctx.beginPath();
  if (shape === "circle") {
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  } else if (shape === "square") {
    ctx.rect(cx - radius * 0.88, cy - radius * 0.88, radius * 1.76, radius * 1.76);
  } else if (shape === "triangle") {
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx + radius, cy + radius * 0.8);
    ctx.lineTo(cx - radius, cy + radius * 0.8);
    ctx.closePath();
  } else if (shape === "diamond") {
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx + radius, cy);
    ctx.lineTo(cx, cy + radius);
    ctx.lineTo(cx - radius, cy);
    ctx.closePath();
  } else if (shape === "star") {
    for (let point = 0; point < 10; point++) {
      const r = point % 2 === 0 ? radius : radius * 0.45;
      const angle = (Math.PI / 5) * point - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (point === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else {
    for (let point = 0; point < 6; point++) {
      const angle = (Math.PI / 3) * point - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (point === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  ctx.fill();
}

function cellCentre(row: number, col: number): { x: number; y: number } {
  return {
    x: MATCHUP_BOARD_X + col * MATCHUP_CELL_PX + MATCHUP_CELL_PX / 2,
    y: MATCHUP_BOARD_Y + row * MATCHUP_CELL_PX + MATCHUP_CELL_PX / 2,
  };
}

function drawGrid(ctx: CanvasRenderingContext2D): void {
  for (let row = 0; row < MATCHUP_ROWS; row++) {
    for (let col = 0; col < MATCHUP_SIZE; col++) {
      const x = MATCHUP_BOARD_X + col * MATCHUP_CELL_PX;
      const y = MATCHUP_BOARD_Y + row * MATCHUP_CELL_PX;
      ctx.fillStyle = (row + col) % 2 === 0 ? "#15151C" : "#101017";
      ctx.fillRect(x, y, MATCHUP_CELL_PX, MATCHUP_CELL_PX);
    }
  }
}

function drawNextStrip(ctx: CanvasRenderingContext2D, state: MatchupState): void {
  roundedRect(ctx, MATCHUP_BOARD_X, MATCHUP_NEXT_Y, MATCHUP_BOARD_W, MATCHUP_NEXT_H, 12);
  ctx.fillStyle = "rgba(247, 247, 248, 0.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(247, 247, 248, 0.14)";
  ctx.lineWidth = 1;
  ctx.stroke();
  // One slot per column, exactly as wide as the column it feeds.
  for (let col = 0; col < MATCHUP_SIZE; col++) {
    const cx = MATCHUP_BOARD_X + col * MATCHUP_CELL_PX + MATCHUP_CELL_PX / 2;
    const cy = MATCHUP_NEXT_Y + MATCHUP_NEXT_H / 2;
    const queue = state.queues[col] ?? [];
    const head = state.heads[col] ?? 0;
    const kind = queue[head % MATCHUP_QUEUE_LEN] ?? 0;
    matchupDrawSymbol(ctx, kind, cx, cy, 9);
  }
}

function drawSettledBoard(ctx: CanvasRenderingContext2D, cells: readonly number[]): void {
  const radius = (MATCHUP_CELL_PX * MATCHUP_SYMBOL_PCT) / 200;
  drawGrid(ctx);
  for (let row = 0; row < MATCHUP_ROWS; row++) {
    for (let col = 0; col < MATCHUP_SIZE; col++) {
      const index = matchupIndex(row, col);
      const { x, y } = cellCentre(row, col);
      matchupDrawSymbol(ctx, cells[index] ?? 0, x, y, radius);
    }
  }
}

function animatedKind(step: MatchupAnimStep, index: number): number {
  const created = step.created.find((item) => item.index === index);
  return created?.kind ?? step.before[index] ?? 0;
}

/**
 * Clear and drop times for one animated step. matchupRev 2 (constant play)
 * squeezes each step into the MATCHUP_V2_STEP_TICKS gap before the next one.
 */
export function matchupStepTiming(step: MatchupAnimStep, state?: Pick<MatchupState, "rev">): { clear: number; drop: number } {
  if (state?.rev === MATCHUP_REV2) return { clear: MATCHUP_V2_CLEAR_MS, drop: Math.min(MATCHUP_V2_DROP_MAX_MS, Math.max(1, step.ticks) * MATCHUP_V2_DROP_MS) };
  return { clear: MATCHUP_CLEAR_MS, drop: Math.max(1, step.ticks) * MATCHUP_DROP_MS };
}

export function matchupAnimationDuration(steps: readonly MatchupAnimStep[], state?: Pick<MatchupState, "rev">): number {
  return steps.reduce((total, item) => {
    const timing = matchupStepTiming(item, state);
    return total + timing.clear + timing.drop;
  }, 0);
}

function drawDetonations(
  ctx: CanvasRenderingContext2D,
  step: MatchupAnimStep,
  progress: number,
): void {
  for (const index of step.detonated) {
    const kind = step.before[index] ?? -1;
    const row = Math.trunc(index / MATCHUP_SIZE);
    const col = index % MATCHUP_SIZE;
    const { x, y } = cellCentre(row, col);
    ctx.save();
    ctx.globalAlpha = 1 - progress * 0.7;
    ctx.strokeStyle = MATCHUP_GOLD;
    ctx.lineWidth = 2;
    if (kind === MATCHUP_STAR) {
      // Render-only burst along both diagonals.
      const spread = MATCHUP_CELL_PX * (0.5 + progress * MATCHUP_SIZE);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - spread, y - spread);
      ctx.lineTo(x + spread, y + spread);
      ctx.moveTo(x + spread, y - spread);
      ctx.lineTo(x - spread, y + spread);
      ctx.stroke();
      ctx.fillStyle = "rgba(247, 247, 248, 0.5)";
      ctx.beginPath();
      ctx.arc(x, y, 6 + progress * MATCHUP_CELL_PX, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === MATCHUP_CROSS) {
      const spread = MATCHUP_CELL_PX * (0.5 + progress * MATCHUP_SIZE);
      ctx.fillStyle = "rgba(245, 184, 46, 0.18)";
      ctx.fillRect(MATCHUP_BOARD_X, y - 3, MATCHUP_BOARD_W, 6);
      ctx.fillRect(x - 3, MATCHUP_BOARD_Y, 6, MATCHUP_BOARD_H);
      ctx.beginPath();
      ctx.moveTo(x - spread, y);
      ctx.lineTo(x + spread, y);
      ctx.moveTo(x, y - spread);
      ctx.lineTo(x, y + spread);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 8 + progress * MATCHUP_CELL_PX * 1.8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawAnimatedBoard(
  ctx: CanvasRenderingContext2D,
  state: MatchupState,
  elapsedMs: number,
): void {
  let remaining = elapsedMs;
  const radius = (MATCHUP_CELL_PX * MATCHUP_SYMBOL_PCT) / 200;
  for (const step of state.lastAnimation) {
    const dropMs = Math.max(1, step.ticks) * MATCHUP_DROP_MS;
    const total = MATCHUP_CLEAR_MS + dropMs;
    if (remaining >= total) {
      remaining -= total;
      continue;
    }

    drawGrid(ctx);
    const cleared = new Set(step.cleared);
    if (remaining < MATCHUP_CLEAR_MS) {
      const p = remaining / MATCHUP_CLEAR_MS;
      for (let row = 0; row < MATCHUP_ROWS; row++) {
        for (let col = 0; col < MATCHUP_SIZE; col++) {
          const index = matchupIndex(row, col);
          const { x, y } = cellCentre(row, col);
          if (cleared.has(index)) {
            ctx.save();
            ctx.globalAlpha = 1 - p;
            matchupDrawSymbol(ctx, animatedKind(step, index), x, y, radius * (1 - p * 0.65));
            ctx.restore();
          } else {
            matchupDrawSymbol(ctx, animatedKind(step, index), x, y, radius);
          }
        }
      }
      drawDetonations(ctx, step, Math.min(1, remaining / MATCHUP_DETONATE_MS));
      return;
    }

    const p = Math.min(1, (remaining - MATCHUP_CLEAR_MS) / dropMs);
    for (let row = 0; row < MATCHUP_ROWS; row++) {
      for (let col = 0; col < MATCHUP_SIZE; col++) {
        const index = matchupIndex(row, col);
        if (cleared.has(index)) continue;
        if (step.moves.some((move) => move.fromRow === row && move.fromCol === col)) continue;
        const { x, y } = cellCentre(row, col);
        matchupDrawSymbol(ctx, animatedKind(step, index), x, y, radius);
      }
    }
    for (const move of step.moves) {
      const from = cellCentre(move.fromRow, move.fromCol);
      const to = cellCentre(move.toRow, move.toCol);
      const x = from.x + (to.x - from.x) * p;
      const y = from.y + (to.y - from.y) * p;
      matchupDrawSymbol(ctx, move.kind, x, y, radius);
    }
    return;
  }
  drawSettledBoard(ctx, state.cells);
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  state: MatchupState,
  size: CanvasSize,
  animationElapsedMs: number | null,
): void {
  const { scale, offsetX, offsetY } = matchupTransform(size);
  ctx.save();
  ctx.fillStyle = MATCHUP_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  drawNextStrip(ctx, state);
  if (animationElapsedMs !== null && state.lastAnimation.length > 0) {
    drawAnimatedBoard(ctx, state, animationElapsedMs);
  } else {
    drawSettledBoard(ctx, state.cells);
  }

  // A subtle hint after five seconds without a scoring swap.
  if (matchupShowHint(state) && animationElapsedMs === null) {
    const hint = matchupFindSwap(state.cells);
    if (hint) {
      ctx.strokeStyle = MATCHUP_GOLD;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      const cells = [
        { row: hint.row1, col: hint.col1 },
        { row: hint.row2, col: hint.col2 },
      ];
      for (const cell of cells) {
        ctx.strokeRect(
          MATCHUP_BOARD_X + cell.col * MATCHUP_CELL_PX + 3,
          MATCHUP_BOARD_Y + cell.row * MATCHUP_CELL_PX + 3,
          MATCHUP_CELL_PX - 6,
          MATCHUP_CELL_PX - 6,
        );
      }
      ctx.globalAlpha = 1;
    }
  }

  ctx.font = "600 15px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = MATCHUP_TEXT;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(`${state.raw} pts`, 12, 12);
  ctx.textAlign = "right";
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, state: MatchupState, size: CanvasSize): void {
  drawScene(ctx, state, size, null);
}

export function matchupDrawAnimated(
  ctx: CanvasRenderingContext2D,
  state: MatchupState,
  size: CanvasSize,
  elapsedMs: number,
): void {
  drawScene(ctx, state, size, elapsedMs);
}

/** The selected cell's outline, drawn while a swap is being made. Render only. */
export function matchupDrawSelection(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  row: number,
  col: number,
): void {
  const { scale, offsetX, offsetY } = matchupTransform(size);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.strokeStyle = MATCHUP_GOLD;
  ctx.lineWidth = 3;
  ctx.strokeRect(
    MATCHUP_BOARD_X + col * MATCHUP_CELL_PX + 2,
    MATCHUP_BOARD_Y + row * MATCHUP_CELL_PX + 2,
    MATCHUP_CELL_PX - 4,
    MATCHUP_CELL_PX - 4,
  );
  ctx.restore();
}

export const matchupGame: ArcadeGame<MatchupState, ArcadeInputEvent | null> = {
  key: "matchup",
  runTicks: MATCHUP_RUN_TICKS,
  init,
  step: bandStep(step),
  isOver,
  score: bandScoreOf(score, scoreBand),
  draw,
  inputRanges: MATCHUP_INPUT_RANGES,
};

/** matchupRev 2 (Jackpot gem, constant play, own par). Same step/score dispatch; init stamps the state. */
export const matchupRev2Game: ArcadeGame<MatchupState, ArcadeInputEvent | null> = { ...matchupGame, init: initRev2 };
/** matchupRev 3 (constant play at the original fall speed). */
export const matchupRev3Game: ArcadeGame<MatchupState, ArcadeInputEvent | null> = { ...matchupGame, init: initRev3 };

/** The game for a stored round: its matchupRev picks the rules (absent = original). */
export function matchupGameFor(rev?: number | null): ArcadeGame<MatchupState, ArcadeInputEvent | null> {
  if (rev === MATCHUP_REV_SIX) return matchupSixGame;
  if (rev === MATCHUP_REV_STD) return matchupStdGame;
  if (rev === MATCHUP_REV_ICE) return matchupIceGame;
  if (rev === MATCHUP_REV_GOALS) return matchupGoalsGame;
  if (rev === MATCHUP_REV_STRICT) return matchupStrictGame;
  if (rev === MATCHUP_REV_TARGET) return matchupTargetGame;
  if (rev === MATCHUP_REV_PAR) return matchupParGame;
  if (rev === MATCHUP_REV_WAIT) return matchupWaitGame;
  if (rev === MATCHUP_REV_BAND) return matchupBandGame;
  if (rev === MATCHUP_REV) return matchupRev3Game;
  return rev === MATCHUP_REV2 ? matchupRev2Game : matchupGame;
}

/* ================= Oct 2026 score bands (matchupRev 4) ================= */

/** Score-band revision (puzzle.matchupRev = 4): rev-3 play unchanged, scored on the shared band curve (scoreBands.ts). */
export const MATCHUP_REV_BAND = 4;
/** Match points; 150 at 1,300 (rev 3 needed 5,500). */
export const MATCHUP_BAND_CURVE = bandCurve([0, 560, 760, 980, 1150, 1300], [0, 70, 100, 125, 145, 150]);

export function matchupBandParts(state: MatchupState): BandParts {
  // matchupRev 11 (the arcade scoring standard): its own parts (the reveal and the skill-band tool read them here).
  if (state.std) return matchupStdBandParts(state);
  const units = Math.max(0, state.raw);
  return { units, points: bandPoints(bandCurveOf(state, matchupBandCurve(state)), units), bonus: 0, penalty: 0, finished: false, text: `${units.toLocaleString("en-GB")} match points` };
}

function scoreBand(state: MatchupState): number {
  return bandTotal(matchupBandParts(state), Boolean(state.acted));
}

export const matchupBandGame: ArcadeGame<MatchupState, ArcadeInputEvent | null> = { ...matchupRev3Game, init: (seed) => bandInit(matchupRev3Game.init(seed)) };

/* ============ Tuning C (matchupRev 5): wait for the gems to fall ============ */

/**
 * matchupRev 5 (Tuning C, Oct 2026): constant play is reverted. A swap resolves
 * its whole cascade on the tick it applies (as the original rules did), keeps
 * the Jackpot gem, and the sim refuses further swaps until the swap tween and
 * every step's original-speed clear and fall (MATCHUP_CLEAR_MS + rows ×
 * MATCHUP_DROP_MS) are over, so the wait is the same on every phone and in the
 * server replay. A swap that makes no line swaps back and waits out both tweens.
 * Scored on the band shape with 150 at 2,500 match points (Joe's par).
 */
export const MATCHUP_REV_WAIT = 5;
/**
 * matchupRev 5 band knots: Joe's par fixes 150 at 2,500 match points (the original
 * rules' par); the lower knots keep the simulated average player near 70, and good
 * and great runs need more than on rev 4 (scripts/arcade-skill-bands.ts --rev=c).
 */
export const MATCHUP_V5_BAND_CURVE = bandCurve([0, 620, 900, 1300, 2000, 2500], [0, 70, 100, 125, 145, 150]);

/** The band curve a banded state scores on. */
export function matchupBandCurve(state: Pick<MatchupState, "rev" | "tunef">): BandCurve {
  if (state.tunef) return MATCHUP_V6_BAND_CURVE;
  return state.rev === MATCHUP_REV_WAIT ? MATCHUP_V5_BAND_CURVE : MATCHUP_BAND_CURVE;
}

/** matchupRev 5: ticks a swap keeps the board busy (swap tween plus every step's original-speed clear and fall). */
export function matchupWaitTicks(animation: readonly MatchupAnimStep[]): number {
  const ms = animation.reduce((total, item) => total + MATCHUP_CLEAR_MS + Math.max(1, item.ticks) * MATCHUP_DROP_MS, MATCHUP_V3_SWAP_MS);
  return Math.ceil((ms * TICKS_PER_SECOND) / 1000);
}
/** matchupRev 5: ticks an invalid swap keeps the board busy (out and back). */
export const MATCHUP_V5_INVALID_TICKS = Math.ceil((2 * MATCHUP_V3_SWAP_MS * TICKS_PER_SECOND) / 1000);

/** matchupRev 5: true while the board is still clearing and falling (swaps are refused). */
export function matchupBusy(state: MatchupState): boolean {
  return state.tick + 1 < (state.busyUntil ?? 0);
}

function stepWait(state: MatchupState, input: ArcadeInputEvent | null): MatchupState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const done = (next: MatchupState) => (isOver(next) ? { ...next, endedTick: tick } : next);
  if (input && input.k === MATCHUP_INPUT_SWAP && tick >= (state.busyUntil ?? 0)) {
    const row1 = clampInt(input.a, 0, MATCHUP_ROWS - 1);
    const col1 = clampInt(input.b, 0, MATCHUP_SIZE - 1);
    const row2 = clampInt(input.c, 0, MATCHUP_ROWS - 1);
    const col2 = clampInt(input.d, 0, MATCHUP_SIZE - 1);
    if (adjacent(row1, col1, row2, col2)) {
      const a = matchupIndex(row1, col1);
      const b = matchupIndex(row2, col2);
      const cells = [...state.cells];
      const av = cells[a] ?? 0;
      const bv = cells[b] ?? 0;
      cells[a] = bv;
      cells[b] = av;
      const specialSeeds = [a, b].filter((index) => isSpecial(cells[index] ?? -1));
      const own = matchupRuns(cells).some((run) => run.cells.includes(a) || run.cells.includes(b));
      if (!own && specialSeeds.length === 0) {
        return done({
          ...state,
          tick,
          lastInvalidA: a,
          lastInvalidB: b,
          lastInvalidTick: tick,
          lastGain: 0,
          lastSteps: 0,
          lastCleared: [],
          lastAnimation: [],
          lastAnimTicks: 0,
          busyUntil: tick + MATCHUP_V5_INVALID_TICKS,
        });
      }
      const heads = [...state.heads];
      const resolved = resolveBoard(cells, state.queues, heads, b, specialSeeds, a, { maxSteps: Number.MAX_SAFE_INTEGER, jackpot: true });
      let rng = state.rng;
      let board = cells;
      let reshuffles = state.reshuffles;
      if (!matchupFindSwap(board)) {
        const shuffled = reshuffle(board, rng);
        rng = shuffled.state;
        board = shuffled.cells;
        reshuffles += 1;
      }
      const wait = matchupWaitTicks(resolved.animation);
      return done({
        ...state,
        tick,
        rng,
        cells: board,
        heads,
        swaps: state.swaps + 1,
        raw: state.raw + resolved.gain,
        bestLine: Math.max(state.bestLine, resolved.best),
        cascades: state.cascades + Math.max(0, resolved.steps - 1),
        reshuffles,
        lastScoreTick: tick,
        lastGain: resolved.gain,
        lastSteps: resolved.steps,
        lastCleared: resolved.cleared,
        lastAnimation: resolved.animation,
        lastAnimTicks: wait,
        lastInvalidA: -1,
        lastInvalidB: -1,
        busyUntil: tick + wait,
        jackpots: (state.jackpots ?? 0) + resolved.jackpots,
        jackpotsFired: (state.jackpotsFired ?? 0) + resolved.fired,
      });
    }
  }
  return done({ ...state, tick });
}

function initWait(seed: number): MatchupState {
  return bandInit({ ...init(seed), rev: MATCHUP_REV_WAIT, busyUntil: 0, jackpots: 0, jackpotsFired: 0 });
}

export const matchupWaitGame: ArcadeGame<MatchupState, ArcadeInputEvent | null> = { ...matchupGame, init: initWait };

/* ============ Tuning F (matchupRev 6): par 2,800 ============ */

/**
 * matchupRev 6 (Tuning F, Oct 2026): matchupRev 5's play unchanged (the state
 * keeps rev 5 and adds `tunef: 1`), scored on a curve with 150 at 2,800 match
 * points (Joe found 2,500 slightly generous). The knots from 100 up move up
 * in the same proportion, so the same good-or-better run scores a little less.
 */
export const MATCHUP_REV_PAR = 6;
/**
 * matchupRev 6 band knots: from 100 up, matchupRev 5's knots × 1.12 (2,500 → 2,800);
 * the 70 knot stays at 620 so the simulated average player stays near 70.
 */
export const MATCHUP_V6_BAND_CURVE = bandCurve([0, 620, 1008, 1456, 2240, 2800], [0, 70, 100, 125, 145, 150]);

export const matchupParGame: ArcadeGame<MatchupState, ArcadeInputEvent | null> = { ...matchupWaitGame, init: (seed) => ({ ...initWait(seed), tunef: 1 }) };

/* ================= Scoring targets (matchupRev 7, 18 Oct 2026) ================= */

/**
 * matchupRev 7 (scoring targets, docs/scoring-targets.md): matchupRev 6 play unchanged, each band
 * knot's points lifted through BAND_TARGET_MAP (about 100 / 120 / 135 / 140–150 for
 * the average / good / great / near-perfect players that scored 70 / 100 / 125 / 140).
 */
export const MATCHUP_REV_TARGET = 7;
export const matchupTargetGame = bandTargetGame(matchupParGame);
/** The curve new rounds score on: MATCHUP_V6_BAND_CURVE lifted through BAND_TARGET_MAP (what bandCurveOf gives a target-stamped state). */
export const MATCHUP_V7_BAND_CURVE = bandRetarget(MATCHUP_V6_BAND_CURVE);


/* ================= Score bands (matchupRev 8, 19 Oct 2026) ================= */

/**
 * matchupRev 8 (score bands, docs/scoring-targets.md): matchupRev 7 play unchanged, scored on its strict curve (band 3,
 * src/lib/arcade/strictBands.data.ts) so the simulated average / good / great / near-perfect players land about
 * 70 / 100 / 120 / 140.
 */
export const MATCHUP_REV_STRICT = 8;
export const matchupStrictGame = bandStrictGame(matchupTargetGame);
/** The curve new rounds score on: MATCHUP_V6_BAND_CURVE's strict curve (what bandCurveOf gives a band-3 state). */
export const MATCHUP_V8_BAND_CURVE = bandStrict(MATCHUP_V6_BAND_CURVE);


/* ================= Expansion E6 (matchupRev 9, 25 Oct 2026): goals, ice and treasure ================= */

/**
 * matchupRev 9 (docs/expansions/e6.md, docs/scoring-200.md): matchupRev 8's play (each swap resolves its
 * whole cascade and the board waits for the gems to fall; Bomb, cross star, six-point star and Jackpot gem
 * unchanged, gems drawn exactly as before) on a taller board, MATCHUP_V9_ROWS rows of the same seven 50 px
 * columns (world 390 × MATCHUP_V9_WORLD_H), with four skill features worth up to MATCHUP_V9_FEATURE_MAX more,
 * so the round tops out at 200:
 *  - Gem goals per level: each level asks for a set of colours (2, then 3) and a count of each; every gem
 *    of a goal colour cleared counts. A level done starts the next one at once, with more ice.
 *  - Frozen tiles: ice sits on board cells (seeded per level, rows 4–9). The gem in an iced cell cannot be
 *    swapped; clearing the gem there (in a line, a cascade or a blast) breaks the ice. Gems fall through.
 *  - The cascade multiplier: each cascade step after a swap's own clear counts ×2, ×3 … ; the extra match
 *    points (Σ (k − 1) × step points) earn feature points (the base keeps the plain match points).
 *  - Treasure gems (MATCHUP_TREASURE): one is placed in row MATCHUP_V9_TREASURE_ROW (seeded column) whenever none is on the
 *    board, up to MATCHUP_V9_TREASURES a run. It can't be matched, swapped or blasted; it falls as gems
 *    beneath it clear and is collected when it reaches the bottom row.
 * Base points: the match points on MATCHUP_V9_BAND_CURVE (to 150); the features add matchupV9FeatureBonus
 * (to 50). States keep rev 5 (the wait rules) and add the `goals` fields (folded into the checksum last).
 */
export const MATCHUP_REV_GOALS = 9;
export const MATCHUP_V9_ROWS = 10;
export const MATCHUP_V9_CELLS = MATCHUP_SIZE * MATCHUP_V9_ROWS;
/** The taller world: the next strip and board where they were, then the goals panel under the board. */
export const MATCHUP_V9_WORLD_H = 720;
export const MATCHUP_V9_BOARD_H = MATCHUP_V9_ROWS * MATCHUP_CELL_PX;
/** The goals panel's top (world px), under the board's frame. */
export const MATCHUP_V9_PANEL_Y = MATCHUP_BOARD_Y + MATCHUP_V9_BOARD_H + 18;
export const MATCHUP_TREASURE = 20;
/** A treasure gem is placed in this row (near the top of the ten). */
export const MATCHUP_V9_TREASURE_ROW = 3;
export const MATCHUP_V9_TREASURES = 8;
export const MATCHUP_V9_LEVELS = 12;
/** Ice is seeded in these rows (the lower part of the board). */
export const MATCHUP_V9_ICE_FROM_ROW = 4;
/** Feature points: a level done, a frozen tile broken, a treasure collected, and every this many extra cascade points. */
export const MATCHUP_V9_LEVEL_FP = 6;
export const MATCHUP_V9_ICE_FP = 1;
export const MATCHUP_V9_TREASURE_FP = 12;
export const MATCHUP_V9_CASCADE_PER_FP = 40;
export const MATCHUP_V9_FEATURE_MAX = 50;
/** Feature points → bonus (fitted by scripts/e6-bands.ts). */
export const MATCHUP_V9_FEATURE_CURVE = bandCurve([0, 22, 26, 30, 35, 47, 52], [0, 7, 11, 16, 22, 42, 50]);
/** matchupRev 9 base knots: match points on the taller board; 150 at the top (fitted by scripts/e6-bands.ts). */
export const MATCHUP_V9_BAND_CURVE = bandCurve([0, 650, 870, 1150, 1600, 2400, 3200], [0, 62, 76, 100, 125, 145, 150]);
/** matchupRev 9's round maximum (ROUND_MAX.matchup). */
export const MATCHUP_V9_MAX = 200;

export const MATCHUP_V9_INPUT_RANGES: readonly InputRange[] = [
  inputRange(MATCHUP_INPUT_SWAP, [0, MATCHUP_V9_ROWS - 1], [0, MATCHUP_SIZE - 1], [0, MATCHUP_V9_ROWS - 1], [0, MATCHUP_SIZE - 1]),
];

/** The world height (px) a state plays in. */
export function matchupWorldH(state: { goals?: number }): number {
  return state.goals ? MATCHUP_V9_WORLD_H : MATCHUP_WORLD_H;
}
/** The world height (px) a stored round's matchupRev plays in. */
export function matchupWorldHFor(rev?: number | null): number {
  return rev === MATCHUP_REV_GOALS || rev === MATCHUP_REV_ICE || rev === MATCHUP_REV_STD || rev === MATCHUP_REV_SIX ? MATCHUP_V9_WORLD_H : MATCHUP_WORLD_H;
}
/** The board rows a stored round's matchupRev plays on. */
export function matchupRowsFor(rev?: number | null): number {
  return rev === MATCHUP_REV_GOALS || rev === MATCHUP_REV_ICE || rev === MATCHUP_REV_STD || rev === MATCHUP_REV_SIX ? MATCHUP_V9_ROWS : MATCHUP_ROWS;
}

/** matchupRev 9: the treasure gems in the bottom row (collected this step). */
function bottomTreasures(cells: readonly number[]): number[] {
  const bottom = (matchupRowsOf(cells) - 1) * MATCHUP_SIZE;
  const out: number[] = [];
  for (let col = 0; col < MATCHUP_SIZE; col++) if (cells[bottom + col] === MATCHUP_TREASURE) out.push(bottom + col);
  return out;
}

/** matchupRev 9: a cell the player may move (not iced, not a treasure gem). */
function movable(cells: readonly number[], ice: readonly number[], index: number): boolean {
  return !ice[index] && cells[index] !== MATCHUP_TREASURE;
}

/** matchupRev 9: the first swap that makes a line (or moves a special) without touching ice or treasure. */
export function matchupFindSwapV9(cells: readonly number[], ice: readonly number[]): MatchupSwap | null {
  const board = [...cells];
  const rows = matchupRowsOf(cells);
  const test = (row1: number, col1: number, row2: number, col2: number): MatchupSwap | null => {
    const a = matchupIndex(row1, col1);
    const b = matchupIndex(row2, col2);
    if (!movable(board, ice, a) || !movable(board, ice, b)) return null;
    if (isSpecial(board[a] ?? -1) || isSpecial(board[b] ?? -1)) return { row1, col1, row2, col2 };
    if (board[a] === board[b]) return null;
    const av = board[a] ?? 0;
    const bv = board[b] ?? 0;
    board[a] = bv;
    board[b] = av;
    const made = matchupRuns(board).some((run) => run.cells.includes(a) || run.cells.includes(b));
    board[a] = av;
    board[b] = bv;
    return made ? { row1, col1, row2, col2 } : null;
  };
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < MATCHUP_SIZE; col++) {
      if (col + 1 < MATCHUP_SIZE) {
        const found = test(row, col, row, col + 1);
        if (found) return found;
      }
      if (row + 1 < rows) {
        const found = test(row, col, row + 1, col);
        if (found) return found;
      }
    }
  return null;
}

/**
 * matchupRev 10: the first swap that makes a line (or moves a special) without touching treasure. A gem may
 * move into or out of an iced cell, but only by a swap that makes a line of three (a special alone won't do).
 */
export function matchupFindSwapV10(cells: readonly number[], ice: readonly number[]): MatchupSwap | null {
  const board = [...cells];
  const rows = matchupRowsOf(cells);
  const test = (row1: number, col1: number, row2: number, col2: number): MatchupSwap | null => {
    const a = matchupIndex(row1, col1);
    const b = matchupIndex(row2, col2);
    if (board[a] === MATCHUP_TREASURE || board[b] === MATCHUP_TREASURE) return null;
    const iced = Boolean(ice[a] || ice[b]);
    if (!iced && (isSpecial(board[a] ?? -1) || isSpecial(board[b] ?? -1))) return { row1, col1, row2, col2 };
    if (board[a] === board[b]) return null;
    const av = board[a] ?? 0;
    const bv = board[b] ?? 0;
    board[a] = bv;
    board[b] = av;
    const made = matchupRuns(board).some((run) => run.cells.includes(a) || run.cells.includes(b));
    board[a] = av;
    board[b] = bv;
    return made ? { row1, col1, row2, col2 } : null;
  };
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < MATCHUP_SIZE; col++) {
      if (col + 1 < MATCHUP_SIZE) {
        const found = test(row, col, row, col + 1);
        if (found) return found;
      }
      if (row + 1 < rows) {
        const found = test(row, col, row + 1, col);
        if (found) return found;
      }
    }
  return null;
}

/**
 * matchupRev 11: matchupRev 10's finder, plus a treasure gem swapped with a plain gem when that gem then makes a line
 * of three (the treasure takes the gem's old cell). A treasure never swaps with a special or another treasure.
 */
export function matchupFindSwapV11(cells: readonly number[], ice: readonly number[]): MatchupSwap | null {
  const board = [...cells];
  const rows = matchupRowsOf(cells);
  const test = (row1: number, col1: number, row2: number, col2: number): MatchupSwap | null => {
    const a = matchupIndex(row1, col1);
    const b = matchupIndex(row2, col2);
    const treasure = board[a] === MATCHUP_TREASURE || board[b] === MATCHUP_TREASURE;
    if (treasure && !isNormal(board[a] === MATCHUP_TREASURE ? (board[b] ?? -1) : (board[a] ?? -1))) return null;
    const iced = Boolean(ice[a] || ice[b]);
    if (!treasure && !iced && (isSpecial(board[a] ?? -1) || isSpecial(board[b] ?? -1))) return { row1, col1, row2, col2 };
    if (board[a] === board[b]) return null;
    const av = board[a] ?? 0;
    const bv = board[b] ?? 0;
    board[a] = bv;
    board[b] = av;
    const made = matchupRuns(board).some((run) => run.cells.includes(a) || run.cells.includes(b));
    board[a] = av;
    board[b] = bv;
    return made ? { row1, col1, row2, col2 } : null;
  };
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < MATCHUP_SIZE; col++) {
      if (col + 1 < MATCHUP_SIZE) {
        const found = test(row, col, row, col + 1);
        if (found) return found;
      }
      if (row + 1 < rows) {
        const found = test(row, col, row + 1, col);
        if (found) return found;
      }
    }
  return null;
}

/** The swap finder a state's rules use (matchupRev 9 minds ice; matchupRev 10 lets a matching swap through it; 11 the treasure too). */
function findSwapFor(state: Pick<MatchupState, "iceSwap" | "std">): (cells: readonly number[], ice: readonly number[]) => MatchupSwap | null {
  if (state.std) return matchupFindSwapV11;
  return state.iceSwap ? matchupFindSwapV10 : matchupFindSwapV9;
}

/** The hint a state shows (the shared first-swap scan, minding ice and treasure on matchupRev 9 and 10). */
export function matchupHintSwap(state: MatchupState): MatchupSwap | null {
  return state.goals ? findSwapFor(state)(state.cells, state.ice ?? []) : matchupFindSwap(state.cells);
}

/** matchupRev 9: shuffles the gems among the cells that hold no treasure until no line stands and a swap is open. */
function reshuffleV9(cells: number[], ice: readonly number[], rng: number, find = matchupFindSwapV9): { state: number; cells: number[] } {
  let state = rng;
  const free = cells.flatMap((kind, index) => (kind === MATCHUP_TREASURE ? [] : [index]));
  for (let attempt = 0; attempt < 200; attempt++) {
    const next = [...cells];
    for (let i = free.length - 1; i > 0; i--) {
      const drawn = rngBelow(state, i + 1);
      state = drawn.state;
      const a = free[i]!;
      const b = free[drawn.value]!;
      const av = next[a] ?? 0;
      next[a] = next[b] ?? 0;
      next[b] = av;
    }
    if (!matchupHasLine(next) && find(next, ice)) return { state, cells: next };
  }
  return { state, cells };
}

function planV9(rng: number): { state: number; plan: MatchupV9Plan } {
  let state = rng;
  const draw = (n: number) => {
    const d = rngBelow(state, n);
    state = d.state;
    return d.value;
  };
  const colours: number[][] = [];
  const need: number[] = [];
  const ice: number[][] = [];
  for (let level = 0; level < MATCHUP_V9_LEVELS; level++) {
    const count = level < 2 ? 2 : 3;
    const pool = [0, 1, 2, 3, 4, 5];
    const set: number[] = [];
    for (let k = 0; k < count; k++) set.push(pool.splice(draw(pool.length), 1)[0]!);
    colours.push(set.sort((a, b) => a - b));
    need.push(8 + 2 * Math.min(level, 6));
    const cells: number[] = [];
    const want = 4 + Math.min(level, 6);
    const span = (MATCHUP_V9_ROWS - MATCHUP_V9_ICE_FROM_ROW) * MATCHUP_SIZE;
    for (let guard = 0; cells.length < want && guard < 200; guard++) {
      const cell = MATCHUP_V9_ICE_FROM_ROW * MATCHUP_SIZE + draw(span);
      if (!cells.includes(cell)) cells.push(cell);
    }
    ice.push(cells.sort((a, b) => a - b));
  }
  const treasureCols: number[] = [];
  for (let k = 0; k < MATCHUP_V9_TREASURES; k++) treasureCols.push(draw(MATCHUP_SIZE));
  return { state, plan: { colours, need, ice, treasureCols } };
}

function goalFor(plan: MatchupV9Plan, level: number): number[] {
  const at = Math.min(level, MATCHUP_V9_LEVELS - 1);
  const left = [0, 0, 0, 0, 0, 0];
  for (const colour of plan.colours[at] ?? []) left[colour] = plan.need[at] ?? 0;
  return left;
}

/** matchupRev 9: lays a level's ice (cells not already iced and holding no treasure). */
function layIce(ice: number[], cells: readonly number[], plan: MatchupV9Plan, level: number): number[] {
  const next = [...ice];
  for (const cell of plan.ice[Math.min(level, MATCHUP_V9_LEVELS - 1)] ?? []) if (cells[cell] !== MATCHUP_TREASURE) next[cell] = 1;
  return next;
}

/** The treasure gems a run places: MATCHUP_V9_TREASURES (8), matchupRev 11 MATCHUP_V11_TREASURES (4), matchupRev 12 MATCHUP_V12_TREASURES (6). */
export function matchupTreasuresOf(state: Pick<MatchupState, "std" | "six">): number {
  if (state.six) return MATCHUP_V12_TREASURES;
  return state.std ? MATCHUP_V11_TREASURES : MATCHUP_V9_TREASURES;
}

/** matchupRev 9: places the next treasure gem in the top row when none is on the board. */
function placeTreasure(state: MatchupState, cells: number[]): number {
  const placed = state.treasurePlaced ?? 0;
  if (placed >= matchupTreasuresOf(state) || cells.includes(MATCHUP_TREASURE)) return placed;
  const col = state.plan?.treasureCols[placed] ?? 0;
  cells[matchupIndex(MATCHUP_V9_TREASURE_ROW, col)] = MATCHUP_TREASURE;
  return placed + 1;
}

function initGoals(seed: number, iceSwap = false, std = false, six = false): MatchupState {
  const rolled = rollBoard(seed | 0, MATCHUP_V9_CELLS);
  let rng = rolled.state;
  const queues: number[][] = [];
  for (let col = 0; col < MATCHUP_SIZE; col++) {
    const queue: number[] = [];
    for (let slot = 0; slot < MATCHUP_QUEUE_LEN; slot++) {
      const drawn = drawSymbol(rng);
      rng = drawn.state;
      queue.push(drawn.value);
    }
    queues.push(queue);
  }
  const planned = planV9(rng);
  rng = planned.state;
  const base = init(seed);
  const state: MatchupState = {
    ...base,
    rng,
    cells: rolled.cells,
    queues,
    rev: MATCHUP_REV_WAIT,
    busyUntil: 0,
    jackpots: 0,
    jackpotsFired: 0,
    goals: 1,
    level: 0,
    goalLeft: goalFor(planned.plan, 0),
    levels: 0,
    ice: new Array<number>(MATCHUP_V9_CELLS).fill(0),
    iceBroken: 0,
    treasures: 0,
    treasurePlaced: 0,
    cascadeExtra: 0,
    lastMult: 0,
    plan: planned.plan,
  };
  if (iceSwap) state.iceSwap = 1;
  if (std) {
    state.std = 1;
    state.gemsCleared = 0;
    state.bigLines = 0;
  }
  // matchupRev 12: six goals at once, one a colour, from their own seeded stream (state.rng is untouched, so the
  // board, queues, plan, treasure columns and ice equal matchupRev 11's for the same seed).
  if (six) {
    state.six = 1;
    state.goalNeed = matchupV12GoalNeed(seed);
    state.goalLeft = [...state.goalNeed];
  }
  const find = findSwapFor(state);
  const cells = [...state.cells];
  state.treasurePlaced = placeTreasure(state, cells);
  // matchupRev 10 lays its ice once, at the start: the plan's largest set (the last level's, MATCHUP_V10_ICE cells).
  state.ice = layIce(state.ice!, cells, planned.plan, iceSwap ? MATCHUP_V9_LEVELS - 1 : 0);
  // matchupRev 11: exactly MATCHUP_V10_ICE cells (should the seeded draw ever fall short, the first free cells from
  // row MATCHUP_V9_ICE_FROM_ROW on make it up; no PRNG is drawn, so the board and queues are matchupRev 10's).
  if (std) {
    let count = state.ice.reduce((n, v) => n + (v ? 1 : 0), 0);
    for (let index = MATCHUP_V9_ICE_FROM_ROW * MATCHUP_SIZE; index < MATCHUP_V9_CELLS && count < MATCHUP_V10_ICE; index++)
      if (!state.ice[index] && cells[index] !== MATCHUP_TREASURE) {
        state.ice[index] = 1;
        count += 1;
      }
  }
  state.cells = cells;
  if (!find(cells, state.ice) || matchupHasLine(cells)) {
    const shuffled = reshuffleV9(cells, state.ice, state.rng, find);
    state.rng = shuffled.state;
    state.cells = shuffled.cells;
  }
  return bandInit(state);
}

function stepGoals(state: MatchupState, input: ArcadeInputEvent | null): MatchupState {
  if (isOver(state)) return state;
  const tick = state.tick + 1;
  const done = (next: MatchupState) => (isOver(next) ? { ...next, endedTick: tick } : next);
  if (input && input.k === MATCHUP_INPUT_SWAP && tick >= (state.busyUntil ?? 0)) {
    const row1 = clampInt(input.a, 0, MATCHUP_V9_ROWS - 1);
    const col1 = clampInt(input.b, 0, MATCHUP_SIZE - 1);
    const row2 = clampInt(input.c, 0, MATCHUP_V9_ROWS - 1);
    const col2 = clampInt(input.d, 0, MATCHUP_SIZE - 1);
    if (adjacent(row1, col1, row2, col2)) {
      const a = matchupIndex(row1, col1);
      const b = matchupIndex(row2, col2);
      const ice = state.ice ?? [];
      const cells = [...state.cells];
      const av = cells[a] ?? 0;
      const bv = cells[b] ?? 0;
      cells[a] = bv;
      cells[b] = av;
      const specialSeeds = [a, b].filter((index) => isSpecial(cells[index] ?? -1));
      const own = matchupRuns(cells).some((run) => run.cells.includes(a) || run.cells.includes(b));
      // Ice and treasure never move: such a swap is refused like one that makes no line. matchupRev 10: treasure
      // never moves, and a gem may go into or out of ice only when the swap makes a line of three.
      // matchupRev 11: a treasure gem may swap with a plain gem when that gem then makes a line of three.
      const treasureA = state.cells[a] === MATCHUP_TREASURE;
      const treasureB = state.cells[b] === MATCHUP_TREASURE;
      const refused = state.std
        ? treasureA || treasureB
          ? !own || !isNormal((treasureA ? state.cells[b] : state.cells[a]) ?? -1)
          : ((ice[a] || ice[b]) && !own) || (!own && specialSeeds.length === 0)
        : state.iceSwap
          ? state.cells[a] === MATCHUP_TREASURE || state.cells[b] === MATCHUP_TREASURE || ((ice[a] || ice[b]) && !own) || (!own && specialSeeds.length === 0)
          : !movable(state.cells, ice, a) || !movable(state.cells, ice, b) || (!own && specialSeeds.length === 0);
      if (refused) {
        return done({
          ...state,
          tick,
          lastInvalidA: a,
          lastInvalidB: b,
          lastInvalidTick: tick,
          lastGain: 0,
          lastSteps: 0,
          lastCleared: [],
          lastAnimation: [],
          lastAnimTicks: 0,
          lastMult: 0,
          busyUntil: tick + MATCHUP_V5_INVALID_TICKS,
        });
      }
      const heads = [...state.heads];
      const resolved = resolveBoard(cells, state.queues, heads, b, specialSeeds, a, { maxSteps: Number.MAX_SAFE_INTEGER, jackpot: true, treasure: true });
      // Gems collected per colour, and the ice under every cleared cell.
      const counts = [0, 0, 0, 0, 0, 0];
      let iceNow = [...ice];
      let broken = 0;
      for (const anim of resolved.animation)
        for (const index of anim.cleared) {
          const kind = anim.before[index] ?? -1;
          if (kind >= 0 && kind < MATCHUP_KINDS) counts[kind] = (counts[kind] ?? 0) + 1;
          if (iceNow[index]) {
            iceNow[index] = 0;
            broken += 1;
          }
        }
      let extra = 0;
      resolved.stepGains.forEach((gain, k) => (extra += k * gain));
      // matchupRev 11: gems cleared (a treasure collected is not a gem) and the swap's own lines of 4 or 5.
      let gemsNow = 0;
      let bigNow = 0;
      if (state.std) {
        for (const anim of resolved.animation) for (const index of anim.cleared) if (anim.before[index] !== MATCHUP_TREASURE) gemsNow += 1;
        const first = resolved.animation[0];
        if (first) bigNow = matchupRuns(first.before).filter((run) => run.length >= 4).length;
      }
      // Goals: a finished level starts the next one at once (more gems, more ice).
      let level = state.level ?? 0;
      let levels = state.levels ?? 0;
      let goalLeft = (state.goalLeft ?? []).map((left, colour) => Math.max(0, left - (counts[colour] ?? 0)));
      // matchupRev 12: the six goals are all shown from the start; `levels` counts those met, no level follows.
      if (state.six) levels = goalLeft.reduce((n, left) => n + (left === 0 ? 1 : 0), 0);
      // matchupRev 11: the run's goals are its first MATCHUP_V11_GOAL_LEVELS levels; once they are met none follow.
      else if (goalLeft.every((left) => left === 0) && !(state.std && level >= MATCHUP_V11_GOAL_LEVELS)) {
        levels += 1;
        level += 1;
        goalLeft = state.std && level >= MATCHUP_V11_GOAL_LEVELS ? [0, 0, 0, 0, 0, 0] : goalFor(state.plan!, level);
        // matchupRev 10: the ice never refreshes (it was all laid at the start).
        if (!state.iceSwap) iceNow = layIce(iceNow, cells, state.plan!, level);
      }
      const placed = placeTreasure(state, cells);
      let rng = state.rng;
      let board = cells;
      let reshuffles = state.reshuffles;
      const find = findSwapFor(state);
      if (!find(board, iceNow) || matchupHasLine(board)) {
        const shuffled = reshuffleV9(board, iceNow, rng, find);
        rng = shuffled.state;
        board = shuffled.cells;
        reshuffles += 1;
      }
      const wait = matchupWaitTicks(resolved.animation);
      return done({
        ...state,
        tick,
        rng,
        cells: board,
        heads,
        swaps: state.swaps + 1,
        raw: state.raw + resolved.gain,
        bestLine: Math.max(state.bestLine, resolved.best),
        cascades: state.cascades + Math.max(0, resolved.steps - 1),
        reshuffles,
        lastScoreTick: tick,
        lastGain: resolved.gain,
        lastSteps: resolved.steps,
        lastCleared: resolved.cleared,
        lastAnimation: resolved.animation,
        lastAnimTicks: wait,
        lastInvalidA: -1,
        lastInvalidB: -1,
        busyUntil: tick + wait,
        jackpots: (state.jackpots ?? 0) + resolved.jackpots,
        jackpotsFired: (state.jackpotsFired ?? 0) + resolved.fired,
        level,
        levels,
        goalLeft,
        ice: iceNow,
        iceBroken: (state.iceBroken ?? 0) + broken,
        treasures: (state.treasures ?? 0) + resolved.treasures,
        treasurePlaced: placed,
        cascadeExtra: (state.cascadeExtra ?? 0) + extra,
        lastMult: resolved.steps,
        ...(state.std ? { gemsCleared: (state.gemsCleared ?? 0) + gemsNow, bigLines: (state.bigLines ?? 0) + bigNow } : {}),
      });
    }
  }
  return done({ ...state, tick });
}

/** matchupRev 9 feature points so far. */
export function matchupV9FeaturePoints(state: MatchupState): number {
  return (
    (state.levels ?? 0) * MATCHUP_V9_LEVEL_FP +
    (state.iceBroken ?? 0) * MATCHUP_V9_ICE_FP +
    (state.treasures ?? 0) * MATCHUP_V9_TREASURE_FP +
    Math.floor((state.cascadeExtra ?? 0) / MATCHUP_V9_CASCADE_PER_FP)
  );
}

/** matchupRev 9 feature bonus, 0…MATCHUP_V9_FEATURE_MAX. */
export function matchupV9FeatureBonus(state: MatchupState): number {
  return clampInt(bandPoints(MATCHUP_V9_FEATURE_CURVE, matchupV9FeaturePoints(state)), 0, MATCHUP_V9_FEATURE_MAX);
}

export function matchupGoalsParts(state: MatchupState): BandParts {
  const units = Math.max(0, state.raw);
  const levels = state.levels ?? 0;
  const treasures = state.treasures ?? 0;
  return {
    units,
    points: bandPoints(MATCHUP_V9_BAND_CURVE, units),
    bonus: matchupV9FeatureBonus(state),
    penalty: 0,
    finished: false,
    text: `${units.toLocaleString("en-GB")} match points`,
    bonusText: `${levels} goal${levels === 1 ? "" : "s"} · ${state.iceBroken ?? 0} ice · ${treasures} treasure${treasures === 1 ? "" : "s"} · cascades +${state.cascadeExtra ?? 0}`,
  };
}

function scoreGoals(state: MatchupState): number {
  return bandTotal(matchupGoalsParts(state), Boolean(state.acted), MATCHUP_V9_MAX);
}

export const matchupGoalsGame: ArcadeGame<MatchupState, ArcadeInputEvent | null> = {
  ...matchupGame,
  init: (seed) => initGoals(seed),
  score: (state) => (state.goals ? scoreGoals(state) : matchupGame.score(state)),
  inputRanges: MATCHUP_V9_INPUT_RANGES,
};

/* ================= Phone-test notes (matchupRev 10, 27 Oct 2026): 90 s, ice swaps, ice laid once ================= */

/**
 * matchupRev 10 (docs/phone-notes-oct-2026/gemstone.md): matchupRev 9's board, goals, treasure and cascade
 * multiplier, with three rule changes (states add `iceSwap: 1`):
 *  - the run lasts MATCHUP_V10_RUN_SECONDS (90 s; every earlier revision keeps 60 s);
 *  - a gem may be swapped into or out of an iced cell when the swap makes a line of three (a special swapped
 *    with an iced gem needs a line too); the ice stays on its cell and breaks when the gem there is cleared;
 *  - the ice is laid once, at the start (the plan's largest set, MATCHUP_V10_ICE cells in rows 4–9), and never
 *    refreshes: a level done brings new goals but no new ice.
 * Base points: the match points on MATCHUP_V10_BAND_CURVE (to 150); the features add matchupV10FeatureBonus
 * (to 50), both refitted for the longer run with the skill-band bots (scripts/arcade-skill-bands.ts).
 */
export const MATCHUP_REV_ICE = 10;
/** The ice matchupRev 10 lays at the start (the plan's last level's set: 4 + 6 cells). */
export const MATCHUP_V10_ICE = 10;
/**
 * matchupRev 10 feature points → bonus (the feature points are matchupRev 9's, matchupV9FeaturePoints), refitted with
 * the skill-band bots for the 90 s run (more levels and cascades) so each level's median stays about where it was.
 */
export const MATCHUP_V10_FEATURE_CURVE = bandCurve([0, 30, 40, 50, 60, 72, 82], [0, 5, 8, 14, 24, 40, 50]);
/**
 * matchupRev 10 base knots: match points over the 90 s run; 150 at the top. Fitted with the skill-band bots
 * (docs/phone-notes-oct-2026/gemstone.md) so an ordinary player's score stays where matchupRev 9 put it.
 */
export const MATCHUP_V10_BAND_CURVE = bandCurve([0, 1100, 1300, 1650, 2000, 2400, 3200, 4200], [0, 62, 73, 82, 106, 123, 140, 150]);

/** matchupRev 10 feature bonus, 0…MATCHUP_V9_FEATURE_MAX. */
export function matchupV10FeatureBonus(state: MatchupState): number {
  return clampInt(bandPoints(MATCHUP_V10_FEATURE_CURVE, matchupV9FeaturePoints(state)), 0, MATCHUP_V9_FEATURE_MAX);
}

export function matchupIceParts(state: MatchupState): BandParts {
  const parts = matchupGoalsParts(state);
  return { ...parts, points: bandPoints(MATCHUP_V10_BAND_CURVE, parts.units), bonus: matchupV10FeatureBonus(state) };
}

export const matchupIceGame: ArcadeGame<MatchupState, ArcadeInputEvent | null> = {
  ...matchupGoalsGame,
  runTicks: MATCHUP_V10_RUN_TICKS,
  init: (seed) => initGoals(seed, true),
  score: (state) => (state.iceSwap ? bandTotal(matchupIceParts(state), Boolean(state.acted), MATCHUP_V9_MAX) : matchupGoalsGame.score(state)),
};

/* ======== The arcade scoring standard (matchupRev 11, docs/arcade-standard/matchup.md) ======== */

/**
 * matchupRev 11: matchupRev 10's 90 s board (ice swaps that make a line, ice laid once), with three rule changes
 * (states add `std: 1`, `gemsCleared` and `bigLines`, folded into the checksum last):
 *  - four treasure gems a run (MATCHUP_V11_TREASURES, the plan's first four seeded columns), not eight;
 *  - a treasure gem may be swapped with a plain gem when that gem then makes a line of three (the treasure takes the
 *    gem's old cell); never with a special or another treasure;
 *  - the goals are the run's first MATCHUP_V11_GOAL_LEVELS levels (2 + 2 + 3 + 3 = 10 colour goals); once all are
 *    met no more follow. The ice is exactly MATCHUP_V10_ICE cells.
 * Score (the arcade standard: straight lines and fixed amounts, no curve or rising scale; parts total 200):
 *  - core: gems cleared, a straight line to MATCHUP_V11_CORE_MAX at MATCHUP_V11_CORE_GEMS (the skill-band tool's
 *    near-flawless median);
 *  - treasure: MATCHUP_V11_TREASURE_PTS for each brought down (up to 40);
 *  - goals: MATCHUP_V11_GOAL_PTS for each colour goal met (10 goals, up to 30);
 *  - ice: MATCHUP_V11_ICE_PTS a frozen cell broken (10 cells, up to 10);
 *  - big lines: MATCHUP_V11_BIG_PTS for each line of 4 or 5 a swap's own match makes (up to 10).
 * Anyone who plays (any input) scores at least 1; nothing costs points.
 */
export const MATCHUP_REV_STD = 11;
export const MATCHUP_V11_TREASURES = 4;
export const MATCHUP_V11_GOAL_LEVELS = 4;
/** Colour goals over the four levels (two colours on levels 1–2, three on 3–4). */
export const MATCHUP_V11_GOALS = 10;
export const MATCHUP_V11_CORE_MAX = 110;
/** Gems cleared for the full core: the near-flawless level's median over 90 s (376 on room seeds 0–29 with scripts/arcade-skill-bands.ts, rounded to 375). */
export const MATCHUP_V11_CORE_GEMS = 375;
export const MATCHUP_V11_TREASURE_PTS = 10;
export const MATCHUP_V11_TREASURE_MAX = 40;
export const MATCHUP_V11_GOAL_PTS = 3;
export const MATCHUP_V11_GOALS_MAX = 30;
export const MATCHUP_V11_ICE_PTS = 1;
export const MATCHUP_V11_ICE_MAX = 10;
export const MATCHUP_V11_BIG_PTS = 2;
export const MATCHUP_V11_BIG_MAX = 10;
export const MATCHUP_V11_MAX = 200;
/** The core: gems cleared on one straight line, 0 → MATCHUP_V11_CORE_MAX at MATCHUP_V11_CORE_GEMS (the help reads it). */
export const MATCHUP_V11_BAND_CURVE = bandCurve([0, MATCHUP_V11_CORE_GEMS], [0, MATCHUP_V11_CORE_MAX]);

/** matchupRev 11: colour goals met (every goal of a finished level, and this level's colours already collected). */
export function matchupGoalsMet(state: MatchupState): number {
  // matchupRev 12: one goal a colour, all shown at once; a goal is met once its colour has none left to clear.
  if (state.six) return Math.min(MATCHUP_V12_GOALS, (state.goalLeft ?? []).reduce((n, left) => n + (left === 0 ? 1 : 0), 0));
  const plan = state.plan;
  if (!plan) return 0;
  const level = state.level ?? 0;
  let met = 0;
  for (let l = 0; l < Math.min(level, MATCHUP_V11_GOAL_LEVELS); l++) met += plan.colours[l]?.length ?? 0;
  if (level < MATCHUP_V11_GOAL_LEVELS) for (const colour of plan.colours[level] ?? []) if ((state.goalLeft?.[colour] ?? 1) === 0) met += 1;
  return Math.min(MATCHUP_V11_GOALS, met);
}

export interface MatchupStdParts {
  core: number;
  treasure: number;
  goals: number;
  ice: number;
  big: number;
}

/** matchupRev 11's parts (each capped at its maximum; they total at most 200). matchupRev 12 has its own amounts. */
export function matchupStdParts(state: MatchupState): MatchupStdParts {
  if (state.six) return matchupSixParts(state);
  return {
    core: bandPoints(MATCHUP_V11_BAND_CURVE, state.gemsCleared ?? 0),
    treasure: Math.min(MATCHUP_V11_TREASURE_MAX, (state.treasures ?? 0) * MATCHUP_V11_TREASURE_PTS),
    goals: Math.min(MATCHUP_V11_GOALS_MAX, matchupGoalsMet(state) * MATCHUP_V11_GOAL_PTS),
    ice: Math.min(MATCHUP_V11_ICE_MAX, (state.iceBroken ?? 0) * MATCHUP_V11_ICE_PTS),
    big: Math.min(MATCHUP_V11_BIG_MAX, (state.bigLines ?? 0) * MATCHUP_V11_BIG_PTS),
  };
}

/** matchupRev 11's score: the parts' sum; a run with any input scores at least 1, one with none 0. */
export function matchupStdScore(state: MatchupState): number {
  const p = matchupStdParts(state);
  return stdFinal(p.core + p.treasure + p.goals + p.ice + p.big, Boolean(state.acted));
}

/** matchupRev 11 as a band breakdown (the reveal's lines): the core, then the features as one bonus line. */
export function matchupStdBandParts(state: MatchupState): BandParts {
  const p = matchupStdParts(state);
  const gems = state.gemsCleared ?? 0;
  const treasures = state.treasures ?? 0;
  return {
    units: gems,
    points: p.core,
    bonus: p.treasure + p.goals + p.ice + p.big,
    penalty: 0,
    finished: false,
    text: `${gems.toLocaleString("en-GB")} gems cleared`,
    bonusText: `Treasure ${treasures} +${p.treasure} · goals ${matchupGoalsMet(state)}/${matchupGoalsOf(state)} +${p.goals} · ice ${state.iceBroken ?? 0} +${p.ice} · big lines ${state.bigLines ?? 0} +${p.big}`,
  };
}

export const matchupStdGame: ArcadeGame<MatchupState, ArcadeInputEvent | null> = {
  ...matchupIceGame,
  init: (seed) => initGoals(seed, true, true),
  score: (state) => (state.std ? matchupStdScore(state) : matchupIceGame.score(state)),
};

/* ======== Six goals and six treasures (matchupRev 12, Nov 2026, docs/arcade-standard/matchup.md) ======== */

/**
 * matchupRev 12 (Joe's notes, Nov 2026: too easy to score high, more goals and treasure): matchupRev 11's play (90 s,
 * the 7 × 10 board, ice swaps that make a line, a treasure swapping with a gem that then makes a line of three, exactly
 * 10 frozen cells), with two rule changes (states add `six: 1` and `goalNeed`, folded into the checksum last):
 *  - six goals at once, one a colour (every colour on the board), shown in the panel under the board from the start:
 *    clear `goalNeed[colour]` gems of that colour. The targets are MATCHUP_V12_GOAL_LADDER in a seeded order (their own
 *    stream from the seed, so the board, queues, plan and ice are matchupRev 11's), so every run's six goals are the
 *    same six sizes and everyone in a room has the same goals;
 *  - six treasure gems a run (MATCHUP_V12_TREASURES, the plan's first six seeded columns), still one at a time.
 * Score (the arcade standard, parts total 200): core = gems cleared, a straight line to MATCHUP_V12_CORE_MAX at
 * MATCHUP_V12_CORE_GEMS; treasure MATCHUP_V12_TREASURE_PTS each (6, up to 36); goals MATCHUP_V12_GOAL_PTS each (6, up
 * to 36); ice 1 a cell (10); big lines 2 each (up to 10). Anyone who plays scores at least 1; nothing costs points.
 */
export const MATCHUP_REV_SIX = 12;
export const MATCHUP_V12_TREASURES = 6;
export const MATCHUP_V12_GOALS = 6;
/** The six goals' sizes (gems of one colour), dealt to the six colours in a seeded order. */
export const MATCHUP_V12_GOAL_LADDER: readonly number[] = [20, 28, 36, 44, 52, 60];
export const MATCHUP_V12_CORE_MAX = 108;
/**
 * Gems cleared for the full core: the near-flawless level's median over 90 s on matchupRev 12 (361 on room seeds 0–59
 * with scripts/arcade-skill-bands.ts' fixed bots, rounded to 360; docs/arcade-standard/matchup.md).
 */
export const MATCHUP_V12_CORE_GEMS = 360;
export const MATCHUP_V12_TREASURE_PTS = 6;
export const MATCHUP_V12_TREASURE_MAX = 36;
export const MATCHUP_V12_GOAL_PTS = 6;
export const MATCHUP_V12_GOALS_MAX = 36;
export const MATCHUP_V12_ICE_PTS = MATCHUP_V11_ICE_PTS;
export const MATCHUP_V12_ICE_MAX = MATCHUP_V11_ICE_MAX;
export const MATCHUP_V12_BIG_PTS = MATCHUP_V11_BIG_PTS;
export const MATCHUP_V12_BIG_MAX = MATCHUP_V11_BIG_MAX;
export const MATCHUP_V12_MAX = 200;
/** The core: gems cleared on one straight line, 0 → MATCHUP_V12_CORE_MAX at MATCHUP_V12_CORE_GEMS (the help reads it). */
export const MATCHUP_V12_BAND_CURVE = bandCurve([0, MATCHUP_V12_CORE_GEMS], [0, MATCHUP_V12_CORE_MAX]);

/** matchupRev 12: each colour's goal, the ladder in a seeded order (a stream of its own; draws nothing from the state). */
export function matchupV12GoalNeed(seed: number): number[] {
  let rng = (seed ^ 0x6e57a11d) | 0;
  const need = [...MATCHUP_V12_GOAL_LADDER];
  for (let i = need.length - 1; i > 0; i--) {
    const drawn = rngBelow(rng, i + 1);
    rng = drawn.state;
    const j = drawn.value;
    const v = need[i]!;
    need[i] = need[j]!;
    need[j] = v;
  }
  return need;
}

/** The colour goals a standard run holds: 10 on matchupRev 11 (over four levels), 6 on matchupRev 12 (all at once). */
export function matchupGoalsOf(state: Pick<MatchupState, "six">): number {
  return state.six ? MATCHUP_V12_GOALS : MATCHUP_V11_GOALS;
}

/** The gems cleared that fill a standard run's core. */
export function matchupCoreGemsOf(state: Pick<MatchupState, "six">): number {
  return state.six ? MATCHUP_V12_CORE_GEMS : MATCHUP_V11_CORE_GEMS;
}

/** matchupRev 12's parts (each capped at its maximum; they total at most 200). */
export function matchupSixParts(state: MatchupState): MatchupStdParts {
  return {
    core: bandPoints(MATCHUP_V12_BAND_CURVE, state.gemsCleared ?? 0),
    treasure: Math.min(MATCHUP_V12_TREASURE_MAX, (state.treasures ?? 0) * MATCHUP_V12_TREASURE_PTS),
    goals: Math.min(MATCHUP_V12_GOALS_MAX, matchupGoalsMet(state) * MATCHUP_V12_GOAL_PTS),
    ice: Math.min(MATCHUP_V12_ICE_MAX, (state.iceBroken ?? 0) * MATCHUP_V12_ICE_PTS),
    big: Math.min(MATCHUP_V12_BIG_MAX, (state.bigLines ?? 0) * MATCHUP_V12_BIG_PTS),
  };
}

export const matchupSixGame: ArcadeGame<MatchupState, ArcadeInputEvent | null> = {
  ...matchupStdGame,
  init: (seed) => initGoals(seed, true, true, true),
  score: (state) => (state.six ? matchupStdScore(state) : matchupStdGame.score(state)),
};
