/**
 * Minesweeper (`minesweeper`, Cards & Board, 30 Oct 2026; docs/arcade-standard/minesweeper.md): a 10 × 16 board with
 * 25 mines, played for 90 s on the deterministic arcade engine.
 *
 * The board is built in the sim from the room seed (`minesBoard`): a seeded start square in the middle of the board,
 * no mine on it or its eight neighbours (so the opening is revealed for you as a cascade), and the 25 mines placed
 * from the seed until the logic solver (`minesSolve`: single-square counts, overlapping pairs of counts and the mine
 * total, never a guess) clears every safe square from that opening (and the opening is 20–60 squares). Every board a seed deals is therefore solvable by
 * logic alone; everyone in a room plays the identical board and nothing random happens after the deal.
 *
 * Inputs (one a tick, kind MINES_INPUT_TAP): `a` the square, `b` 0 = reveal, 1 = flag. Revealing a mine costs 5,
 * marks it and play goes on; tapping a revealed number whose flags are all placed reveals its other neighbours (in
 * either mode). The run ends when every safe square is revealed or the 90 s are up.
 *
 * Score (the arcade scoring standard, `minesRev` 1): Safe squares 150 (a straight line on the safe squares you
 * revealed beyond the opening), No mines hit 20 (on the same line, only while no mine has been hit), Speed 30
 * (board cleared only: full by MINES_SPEED_FULL_TICKS, 0 at the buzzer); −5 a mine hit. Together 200.
 *
 * Integer maths only; the state is never mutated (arrays are copied when a move changes them).
 */
import { type ArcadeGame, type ArcadeInputEvent, type CanvasSize, inputRange, type InputRange, rngBelow, rngStep, rngValue, TICKS_PER_SECOND } from "./engine";
import { stdFinal, stdLine, stdPart, stdSpeed, stdBandParts, type StdPart, type StdSpec } from "./arcadeStandard";
import { bandCurve, type BandParts } from "./scoreBands";

/* ================================ Board ================================ */

export const MINES_COLS = 10;
export const MINES_ROWS = 16;
export const MINES_CELLS = MINES_COLS * MINES_ROWS;
export const MINES_COUNT = 25;
export const MINES_SAFE = MINES_CELLS - MINES_COUNT;

export const MINES_RUN_SECONDS = 90;
export const MINES_RUN_TICKS = MINES_RUN_SECONDS * TICKS_PER_SECOND;

/** The one revision so far (the arcade scoring standard from the start). */
export const MINES_REV_STD = 1;

/* ================================ World ================================ */

/** World units: a 36 px square, the board in a metal frame under a 44 px HUD row. */
export const MINES_WORLD_W = 390;
export const MINES_CELL = 36;
export const MINES_BOARD_W = MINES_COLS * MINES_CELL;
export const MINES_BOARD_H = MINES_ROWS * MINES_CELL;
export const MINES_BOARD_X = Math.round((MINES_WORLD_W - MINES_BOARD_W) / 2);
export const MINES_HUD_H = 44;
export const MINES_FRAME = 12;
export const MINES_BOARD_Y = MINES_HUD_H + MINES_FRAME;
/** The world ends 18 px below the frame (the hex background runs on), so the frame never lines the world's edge. */
export const MINES_WORLD_H = MINES_BOARD_Y + MINES_BOARD_H + MINES_FRAME + 18;

/** The square under a world point, or −1 off the board. */
export function minesCellAt(x: number, y: number): number {
  const col = Math.floor((x - MINES_BOARD_X) / MINES_CELL);
  const row = Math.floor((y - MINES_BOARD_Y) / MINES_CELL);
  if (col < 0 || col >= MINES_COLS || row < 0 || row >= MINES_ROWS) return -1;
  return row * MINES_COLS + col;
}

export function minesCellX(cell: number): number {
  return MINES_BOARD_X + (cell % MINES_COLS) * MINES_CELL;
}

export function minesCellY(cell: number): number {
  return MINES_BOARD_Y + Math.floor(cell / MINES_COLS) * MINES_CELL;
}

/* ================================ Inputs ================================ */

export const MINES_INPUT_TAP = 1;
export const MINES_MODE_REVEAL = 0;
export const MINES_MODE_FLAG = 1;
export const MINES_INPUT_RANGES: readonly InputRange[] = [inputRange(MINES_INPUT_TAP, [0, MINES_CELLS - 1], [0, 1])];

/* ================================ Neighbours ================================ */

const NEIGHBOURS: readonly (readonly number[])[] = Array.from({ length: MINES_CELLS }, (_, cell) => {
  const row = Math.floor(cell / MINES_COLS);
  const col = cell % MINES_COLS;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < MINES_ROWS && c >= 0 && c < MINES_COLS) out.push(r * MINES_COLS + c);
    }
  }
  return out;
});

export function minesNeighbours(cell: number): readonly number[] {
  return NEIGHBOURS[cell] ?? [];
}

/** Each square's count of neighbouring mines (9 on a mine itself). */
export function minesNumbers(mines: readonly number[]): number[] {
  const nums = new Array<number>(MINES_CELLS).fill(0);
  for (let cell = 0; cell < MINES_CELLS; cell++) {
    if (mines[cell]) {
      nums[cell] = 9;
      continue;
    }
    let n = 0;
    for (const nb of NEIGHBOURS[cell]!) n += mines[nb] ? 1 : 0;
    nums[cell] = n;
  }
  return nums;
}

/* ================================ Logic solver ================================ */

/** The squares a reveal of `cell` opens: the square, and the cascade through every 0 it reaches. */
function floodFrom(cell: number, nums: readonly number[], known: Uint8Array, out: number[]): void {
  const stack = [cell];
  while (stack.length > 0) {
    const c = stack.pop()!;
    if (known[c] !== 0) continue;
    known[c] = 1;
    out.push(c);
    if (nums[c] === 0) for (const nb of NEIGHBOURS[c]!) if (known[nb] === 0) stack.push(nb);
  }
}

export interface MinesSolve {
  /** True when logic alone revealed every safe square from the opening. */
  solved: boolean;
  /** Safe squares revealed (the opening included). */
  revealed: number;
  /**
   * The order a logical player could reveal the board in, the opening's cascade first: each step the squares it
   * opened (a step's first square is the one tapped). The perfect bots and the checks play it.
   */
  steps: number[][];
}

/**
 * The logic solver: from the opening, reveals what the counts prove safe and marks what they prove mined, using
 * (1) a single count (all its mines found → the rest are safe; as many hidden as mines left → all mines),
 * (2) two overlapping counts (the difference of their mines left equals the hidden squares only one of them sees →
 * those are mines and the other's own squares safe) and (3) the mine total (none left → all safe; as many hidden as
 * left → all mines). Never a guess. Deterministic (fixed scan order).
 */
export function minesSolve(mines: readonly number[], start: number): MinesSolve {
  const nums = minesNumbers(mines);
  const known = new Uint8Array(MINES_CELLS); // 0 hidden, 1 safe (revealed), 2 mine (proved)
  const steps: number[][] = [];
  let revealed = 0;
  let minesKnown = 0;
  const reveal = (cell: number) => {
    if (known[cell] !== 0 || mines[cell]) return;
    const opened: number[] = [];
    floodFrom(cell, nums, known, opened);
    revealed += opened.length;
    steps.push(opened);
  };
  const mark = (cell: number) => {
    if (known[cell] !== 0) return;
    known[cell] = 2;
    minesKnown += 1;
  };
  reveal(start);
  const hiddenOf = (cell: number): number[] => NEIGHBOURS[cell]!.filter((nb) => known[nb] === 0);
  const leftOf = (cell: number): number => nums[cell]! - NEIGHBOURS[cell]!.filter((nb) => known[nb] === 2).length;
  for (let guard = 0; guard < 4 * MINES_CELLS && revealed < MINES_SAFE; guard++) {
    let progress = false;
    // (1) single counts.
    for (let cell = 0; cell < MINES_CELLS; cell++) {
      if (known[cell] !== 1 || nums[cell] === 0) continue;
      const hidden = hiddenOf(cell);
      if (hidden.length === 0) continue;
      const left = leftOf(cell);
      if (left === 0) {
        for (const h of hidden) reveal(h);
        progress = true;
      } else if (left === hidden.length) {
        for (const h of hidden) mark(h);
        progress = true;
      }
    }
    if (progress) continue;
    // (2) overlapping pairs of counts.
    const front: { cell: number; hidden: number[]; left: number }[] = [];
    for (let cell = 0; cell < MINES_CELLS; cell++) {
      if (known[cell] !== 1 || nums[cell] === 0) continue;
      const hidden = hiddenOf(cell);
      if (hidden.length > 0) front.push({ cell, hidden, left: leftOf(cell) });
    }
    for (let i = 0; i < front.length && !progress; i++) {
      const a = front[i]!;
      for (let j = 0; j < front.length && !progress; j++) {
        if (i === j) continue;
        const b = front[j]!;
        const ar = Math.floor(a.cell / MINES_COLS), ac = a.cell % MINES_COLS;
        const br = Math.floor(b.cell / MINES_COLS), bc = b.cell % MINES_COLS;
        if (Math.abs(ar - br) > 2 || Math.abs(ac - bc) > 2) continue;
        const onlyA = a.hidden.filter((h) => !b.hidden.includes(h));
        const onlyB = b.hidden.filter((h) => !a.hidden.includes(h));
        if (onlyA.length === a.hidden.length) continue; // no overlap
        if (onlyB.length > 0 && b.left - a.left === onlyB.length) {
          for (const h of onlyB) mark(h);
          for (const h of onlyA) reveal(h);
          progress = true;
        } else if (onlyA.length === 0 && onlyB.length > 0 && b.left === a.left) {
          for (const h of onlyB) reveal(h);
          progress = true;
        }
      }
    }
    if (progress) continue;
    // (3) the mine total.
    const hiddenAll: number[] = [];
    for (let cell = 0; cell < MINES_CELLS; cell++) if (known[cell] === 0) hiddenAll.push(cell);
    const minesLeft = MINES_COUNT - minesKnown;
    if (minesLeft === 0) {
      for (const h of hiddenAll) reveal(h);
      progress = hiddenAll.length > 0;
    } else if (minesLeft === hiddenAll.length) {
      for (const h of hiddenAll) mark(h);
      progress = true;
    }
    if (!progress) break;
  }
  return { solved: revealed === MINES_SAFE, revealed, steps };
}

/* ================================ The deal ================================ */

/** Boards tried per seed before the fallback (the check finds the first solvable try well within this). */
export const MINES_MAX_TRIES = 600;
/** The opening a deal reveals for you, in safe squares: boards outside this range are dealt again, so rooms feel alike. */
export const MINES_OPENING_MIN = 20;
export const MINES_OPENING_MAX = 60;

/** The seed whose board stands in if a seed's tries all fail (never seen; minesweeper-check proves it solvable). */
export const MINES_FALLBACK_SEED = 1;

export interface MinesBoard {
  mines: number[];
  start: number;
  /** The try that gave the board (0-based), for the checks. */
  tries: number;
}

function mixSeed(seed: number): number {
  let x = (seed | 0) ^ 0x6d696e65;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) | 0;
}

function tryBoard(rng: number): { rng: number; mines: number[]; start: number } {
  let r = rngBelow(rng, MINES_ROWS - 10);
  const row = 5 + r.value;
  r = rngBelow(r.state, MINES_COLS - 4);
  const col = 2 + r.value;
  const start = row * MINES_COLS + col;
  const banned = new Set<number>([start, ...NEIGHBOURS[start]!]);
  const pool: number[] = [];
  for (let cell = 0; cell < MINES_CELLS; cell++) if (!banned.has(cell)) pool.push(cell);
  const mines = new Array<number>(MINES_CELLS).fill(0);
  let state = r.state;
  for (let i = 0; i < MINES_COUNT; i++) {
    const pick = rngBelow(state, pool.length - i);
    state = pick.state;
    const j = i + pick.value;
    const t = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = t;
    mines[pool[i]!] = 1;
  }
  return { rng: state, mines, start };
}

const BOARD_CACHE = new Map<number, MinesBoard>();

/** The seed's board: the first try the logic solver clears (cached; the same on every device and the server). */
export function minesBoard(seed: number): MinesBoard {
  const hit = BOARD_CACHE.get(seed);
  if (hit) return hit;
  let rng = mixSeed(seed);
  let found: MinesBoard | null = null;
  for (let tries = 0; tries < MINES_MAX_TRIES; tries++) {
    const t = tryBoard(rng);
    rng = rngStep(t.rng ^ rngValue(t.rng));
    const proof = minesSolve(t.mines, t.start);
    const opening = proof.steps[0]?.length ?? 0;
    if (proof.solved && opening >= MINES_OPENING_MIN && opening <= MINES_OPENING_MAX) {
      found = { mines: t.mines, start: t.start, tries };
      break;
    }
  }
  if (!found) found = seed === MINES_FALLBACK_SEED ? { ...tryBoard(mixSeed(seed)), tries: -1 } : { ...minesBoard(MINES_FALLBACK_SEED), tries: -1 };
  if (BOARD_CACHE.size > 64) BOARD_CACHE.clear();
  BOARD_CACHE.set(seed, found);
  return found;
}

/* ================================ State ================================ */

/** A square as the player sees it. */
export const MINES_HIDDEN = 0;
export const MINES_OPEN = 1;
export const MINES_FLAG = 2;
/** A mine the player revealed (it cost 5 and stays shown). */
export const MINES_BOOM = 3;

export interface MinesState {
  rev: number;
  tick: number;
  seed: number;
  mines: readonly number[];
  nums: readonly number[];
  /** Each square: hidden, open, flagged or a revealed mine. */
  open: readonly number[];
  start: number;
  /** Safe squares open, and how many the opening revealed for you. */
  revealed: number;
  opening: number;
  hits: number;
  flags: number;
  /** Taps that opened at least one square, and chords played (counters for the reveal). */
  reveals: number;
  chords: number;
  /** The tick the last safe square opened (0 until cleared). */
  clearedTick: number;
  /** The last square that opened and when (the renderer's gold ripple on the last one), the last mine hit. */
  lastOpen: number;
  lastOpenTick: number;
  lastHit: number;
  lastHitTick: number;
  /** Any input at all (a run without input scores 0). */
  acted: number;
}

function init(seed: number): MinesState {
  const board = minesBoard(seed);
  const nums = minesNumbers(board.mines);
  const known = new Uint8Array(MINES_CELLS);
  const opened: number[] = [];
  floodFrom(board.start, nums, known, opened);
  const open = new Array<number>(MINES_CELLS).fill(MINES_HIDDEN);
  for (const c of opened) open[c] = MINES_OPEN;
  return {
    rev: MINES_REV_STD,
    tick: 0,
    seed,
    mines: board.mines,
    nums,
    open,
    start: board.start,
    revealed: opened.length,
    opening: opened.length,
    hits: 0,
    flags: 0,
    reveals: 0,
    chords: 0,
    clearedTick: 0,
    lastOpen: -1,
    lastOpenTick: 0,
    lastHit: -1,
    lastHitTick: 0,
    acted: 0,
  };
}

/** Opens `cell` on a copied board (a mine is marked and counted; a 0 cascades). Returns safe squares opened. */
function openSquare(s: MinesState, open: number[], cell: number, tick: number, out: { hits: number; last: number; hit: number }): number {
  if (open[cell] !== MINES_HIDDEN) return 0;
  if (s.mines[cell]) {
    open[cell] = MINES_BOOM;
    out.hits += 1;
    out.hit = cell;
    return 0;
  }
  let count = 0;
  const stack = [cell];
  while (stack.length > 0) {
    const c = stack.pop()!;
    if (open[c] !== MINES_HIDDEN || s.mines[c]) continue;
    open[c] = MINES_OPEN;
    count += 1;
    out.last = c;
    if (s.nums[c] === 0) for (const nb of NEIGHBOURS[c]!) if (open[nb] === MINES_HIDDEN) stack.push(nb);
  }
  void tick;
  return count;
}

/** Flags and revealed mines round a square (what a chord counts). */
export function minesMarkedAround(open: readonly number[], cell: number): number {
  let n = 0;
  for (const nb of NEIGHBOURS[cell]!) if (open[nb] === MINES_FLAG || open[nb] === MINES_BOOM) n += 1;
  return n;
}

function applyTap(s: MinesState, cell: number, mode: number, tick: number): MinesState {
  const state = s.open[cell];
  if (state === MINES_OPEN) {
    // A chord: a revealed number whose flags (and revealed mines) are all placed opens its other neighbours.
    const n = s.nums[cell]!;
    if (n === 0 || minesMarkedAround(s.open, cell) !== n) return s;
    const hidden = NEIGHBOURS[cell]!.filter((nb) => s.open[nb] === MINES_HIDDEN);
    if (hidden.length === 0) return s;
    const open = s.open.slice();
    const out = { hits: 0, last: -1, hit: -1 };
    let count = 0;
    for (const nb of hidden) count += openSquare(s, open, nb, tick, out);
    return settle(s, open, count, out, tick, 1);
  }
  if (mode === MINES_MODE_FLAG) {
    if (state === MINES_HIDDEN || state === MINES_FLAG) {
      const open = s.open.slice();
      open[cell] = state === MINES_HIDDEN ? MINES_FLAG : MINES_HIDDEN;
      return { ...s, open, flags: s.flags + (state === MINES_HIDDEN ? 1 : -1) };
    }
    return s;
  }
  if (state !== MINES_HIDDEN) return s; // a flag protects its square from a reveal tap
  const open = s.open.slice();
  const out = { hits: 0, last: -1, hit: -1 };
  const count = openSquare(s, open, cell, tick, out);
  return settle(s, open, count, out, tick, 0);
}

function settle(s: MinesState, open: number[], count: number, out: { hits: number; last: number; hit: number }, tick: number, chord: number): MinesState {
  const revealed = s.revealed + count;
  return {
    ...s,
    open,
    revealed,
    hits: s.hits + out.hits,
    reveals: s.reveals + (count > 0 && !chord ? 1 : 0),
    chords: s.chords + chord,
    clearedTick: revealed >= MINES_SAFE && s.clearedTick === 0 ? tick : s.clearedTick,
    lastOpen: out.last >= 0 ? out.last : s.lastOpen,
    lastOpenTick: out.last >= 0 ? tick : s.lastOpenTick,
    lastHit: out.hit >= 0 ? out.hit : s.lastHit,
    lastHitTick: out.hit >= 0 ? tick : s.lastHitTick,
  };
}

function step(s: MinesState, input: ArcadeInputEvent | null): MinesState {
  if (isOver(s)) return s;
  const tick = s.tick + 1;
  let next: MinesState = s;
  if (input && input.k === MINES_INPUT_TAP) {
    const cell = input.a;
    if (cell >= 0 && cell < MINES_CELLS) next = applyTap(s, cell, input.b === MINES_MODE_FLAG ? MINES_MODE_FLAG : MINES_MODE_REVEAL, tick);
    if (!next.acted) next = { ...next, acted: 1 };
  }
  return next === s ? { ...s, tick } : { ...next, tick };
}

export function minesCleared(s: Pick<MinesState, "revealed">): boolean {
  return s.revealed >= MINES_SAFE;
}

function isOver(s: MinesState): boolean {
  return minesCleared(s) || s.tick >= MINES_RUN_TICKS;
}

/* ================================ Score ================================ */

export const MINES_CORE_MAX = 150;
export const MINES_CLEAN_MAX = 20;
export const MINES_SPEED_MAX = 30;
export const MINES_HIT_COST = 5;
/**
 * Speed is full for a board cleared within this many seconds and falls in a straight line to 0 at the buzzer. Set
 * from the near-perfect skill-band level's median clear time on the tuning seeds (docs/arcade-standard/minesweeper.md).
 */
export const MINES_SPEED_FULL_S = 50;
export const MINES_SPEED_FULL_TICKS = MINES_SPEED_FULL_S * TICKS_PER_SECOND;

/** The core's straight line for the help and LIVE_BANDS, in per mille of the safe squares beyond the opening (150 at all). */
export const MINES_V1_BAND_CURVE = bandCurve([0, 1000], [0, MINES_CORE_MAX]);

export const MINES_STD_SPEC: StdSpec = {
  field: "minesRev",
  rev: MINES_REV_STD,
  parts: [
    { key: "core", label: "Safe squares", max: MINES_CORE_MAX, item: "safe square", how: "a share of the safe squares you reveal beyond the opening" },
    { key: "clean", label: "No mines hit", max: MINES_CLEAN_MAX, how: "the same share, while no mine has been hit" },
    { key: "speed", label: "Speed", max: MINES_SPEED_MAX, how: `board cleared only: full by ${MINES_SPEED_FULL_S} s, 0 at the buzzer` },
  ],
};

/** The safe squares the player must reveal (beyond the opening), and how many they have. */
export function minesProgress(s: Pick<MinesState, "revealed" | "opening">): { got: number; of: number } {
  return { got: Math.max(0, s.revealed - s.opening), of: Math.max(1, MINES_SAFE - s.opening) };
}

export function minesParts(s: MinesState): { core: number; clean: number; speed: number; penalty: number; total: number } {
  const { got, of } = minesProgress(s);
  const core = stdLine(MINES_CORE_MAX, got, of);
  const clean = s.hits === 0 ? stdLine(MINES_CLEAN_MAX, got, of) : 0;
  const speed = minesCleared(s) && s.clearedTick > 0 ? stdSpeed(MINES_SPEED_MAX, s.clearedTick, MINES_SPEED_FULL_TICKS, MINES_RUN_TICKS) : 0;
  const penalty = MINES_HIT_COST * s.hits;
  return { core, clean, speed, penalty, total: core + clean + speed - penalty };
}

export function minesScore(s: MinesState): number {
  return stdFinal(minesParts(s).total, Boolean(s.acted));
}

const secs = (ticks: number) => `${(ticks / TICKS_PER_SECOND).toFixed(1)} s`;

/** The standard's parts list (the reveal's lines and arcade-standard-check). */
export function minesStdParts(state: unknown): StdPart[] | null {
  const s = state as Partial<MinesState> | null;
  if (!s || s.rev !== MINES_REV_STD || !Array.isArray(s.open)) return null;
  const st = s as MinesState;
  const p = minesParts(st);
  const { got, of } = minesProgress(st);
  return [
    stdPart(MINES_STD_SPEC, "core", p.core, `${got} of ${of} revealed`),
    stdPart(MINES_STD_SPEC, "clean", p.clean, st.hits === 0 ? "no mine hit" : `${st.hits} ${st.hits === 1 ? "mine" : "mines"} hit (−${p.penalty})`),
    stdPart(MINES_STD_SPEC, "speed", p.speed, minesCleared(st) ? `cleared in ${secs(st.clearedTick)}` : "not cleared"),
  ];
}

/** BandParts for the band tables and bots (the skill-band tool's units). */
export function minesBandParts(s: MinesState): BandParts {
  const p = minesParts(s);
  const { got, of } = minesProgress(s);
  return stdBandParts(MINES_STD_SPEC, { core: p.core, features: { clean: p.clean, speed: p.speed }, penalty: p.penalty }, got, `${got} of ${of} safe squares`, minesCleared(s), `${s.hits} mines hit`);
}

/* ================================ Checkpoints ================================ */

export const MINES_CHECKPOINT_INTERVAL = 300;

export interface MinesCheckpoint {
  tick: number;
  revealed: number;
  hits: number;
  flags: number;
  checksum: number;
}

export function minesCheckpoint(s: MinesState): MinesCheckpoint {
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < MINES_CELLS; i++) h = Math.imul(h ^ (s.open[i]! + 1), 0x01000193);
  h = Math.imul(h ^ s.revealed, 0x01000193);
  h = Math.imul(h ^ s.hits, 0x01000193);
  h = Math.imul(h ^ s.tick, 0x01000193);
  return { tick: s.tick, revealed: s.revealed, hits: s.hits, flags: s.flags, checksum: h >>> 0 };
}

/* ================================ The game ================================ */

export const minesweeperGame: ArcadeGame<MinesState, ArcadeInputEvent | null> = {
  key: "minesweeper",
  runTicks: MINES_RUN_TICKS,
  init,
  step,
  isOver,
  score: minesScore,
  // The phone draws with minesweeper.renderer.ts; the sim never draws.
  draw: (_ctx: CanvasRenderingContext2D, _state: MinesState, _size: CanvasSize) => {},
  inputRanges: MINES_INPUT_RANGES,
};

export function minesweeperGameFor(_rev?: number | null): ArcadeGame<MinesState, ArcadeInputEvent | null> {
  return minesweeperGame;
}
