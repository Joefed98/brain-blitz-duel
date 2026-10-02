/**
 * Dig — a deterministic cell-grid water sim shared by the phone, the server
 * grader and the bank script.
 *
 * Tiles, one character per cell: `#` rock, `s` sand (diggable), `.` empty,
 * `D` drain (collects), `G` side gap (water entering it is lost). Water is
 * integer units per cell, 0–4. Each step (10 per second) the player's digs for
 * that step apply first, then water flows: bottom row first, left to right.
 * A cell moves only the water it held at the start of the step: down first
 * (as much as fits), then sideways toward lower neighbours, half the level
 * difference at a time (at least 1). Integer maths only.
 */

export const DIG_COLS = 12;
export const DIG_ROWS = 16;
export const DIG_STEPS_PER_SECOND = 10;
export const DIG_STEPS = 600;
export const DIG_STEP_MS = 1000 / DIG_STEPS_PER_SECOND;
export const DIG_MAX_UNITS = 4;
/** Target = 80% of the pool; full marks need 90%. */
export const DIG_TARGET_PCT = 80;
export const DIG_FULL_PCT = 90;
/** Most digs one step can carry (a fast drag). */
export const DIG_MAX_PER_STEP = 8;
export const DIG_MAX_ACTIONS = 400;

export const T_ROCK = "#";
export const T_SAND = "s";
export const T_EMPTY = ".";
export const T_DRAIN = "D";
export const T_GAP = "G";

export interface DigBoard {
  cols: number;
  rows: number;
  tiles: string;
  /** Starting units per cell, one digit per cell. */
  water: string;
}

export interface DigAction {
  step: number;
  cell: number;
}

export interface DigState {
  step: number;
  tiles: string[];
  water: number[];
  collected: number;
  lost: number;
  pool: number;
  target: number;
  full: number;
  /** First step collected reached the target, or 0. */
  targetStep: number;
}

export function digPoolUnits(board: DigBoard): number {
  let n = 0;
  for (const ch of board.water) n += ch.charCodeAt(0) - 48;
  return n;
}

export function digTarget(pool: number): number {
  return Math.floor((pool * DIG_TARGET_PCT + 50) / 100);
}

export function digFull(pool: number): number {
  return Math.floor((pool * DIG_FULL_PCT + 99) / 100);
}

export function digInit(board: DigBoard): DigState {
  const pool = digPoolUnits(board);
  return {
    step: 0,
    tiles: [...board.tiles],
    water: [...board.water].map((ch) => ch.charCodeAt(0) - 48),
    collected: 0,
    lost: 0,
    pool,
    target: digTarget(pool),
    full: digFull(pool),
    targetStep: 0,
  };
}

/** Applies one step: `digs` are the cells dug on this step, in order. */
export function digStep(board: DigBoard, state: DigState, digs: readonly number[]): DigState {
  const { cols, rows } = board;
  const tiles = state.tiles.slice();
  for (const cell of digs) if (tiles[cell] === T_SAND) tiles[cell] = T_EMPTY;
  const step = state.step + 1;
  const avail = state.water.slice();
  const next = state.water.slice();
  let collected = state.collected;
  let lost = state.lost;

  for (let r = rows - 1; r >= 0; r--) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      let w = avail[i]!;
      if (w <= 0) continue;
      if (r + 1 < rows) {
        const j = i + cols;
        const below = tiles[j];
        if (below === T_DRAIN) {
          next[i] = next[i]! - w;
          collected += w;
          continue;
        }
        if (below === T_GAP) {
          next[i] = next[i]! - w;
          lost += w;
          continue;
        }
        if (below === T_EMPTY) {
          const m = Math.min(w, DIG_MAX_UNITS - next[j]!);
          if (m > 0) {
            next[i] = next[i]! - m;
            next[j] = next[j]! + m;
            w -= m;
          }
        }
      }
      if (w <= 0) continue;
      // Sideways: left then right (alternating which goes first each step).
      const sides = step % 2 === 0 ? [-1, 1] : [1, -1];
      for (const d of sides) {
        if (w <= 0) break;
        const cc = c + d;
        if (cc < 0 || cc >= cols) continue;
        const n = i + d;
        const t = tiles[n];
        const level = next[i]!;
        if (t === T_GAP || t === T_DRAIN) {
          const m = Math.max(1, level >> 1) > w ? w : Math.max(1, level >> 1);
          next[i] = level - m;
          if (t === T_GAP) lost += m;
          else collected += m;
          w -= m;
          continue;
        }
        if (t !== T_EMPTY) continue;
        const nl = next[n]!;
        if (nl >= level) continue;
        let m = Math.max(1, (level - nl) >> 1);
        if (m > w) m = w;
        if (m > DIG_MAX_UNITS - nl) m = DIG_MAX_UNITS - nl;
        if (m <= 0) continue;
        next[i] = level - m;
        next[n] = nl + m;
        w -= m;
      }
    }
  }
  const targetStep = state.targetStep || (collected >= state.target ? step : 0);
  return { ...state, step, tiles, water: next, collected, lost, targetStep };
}

export function digWaterLeft(state: DigState): number {
  let n = 0;
  for (const w of state.water) n += w;
  return n;
}

/** Nothing left to flow: every unit is collected or lost. */
export function digSettled(state: DigState): boolean {
  return state.collected + state.lost >= state.pool;
}

/* ============================== Action log ============================== */

export function digEncode(actions: readonly DigAction[]): string {
  return actions.map((a) => `${a.step}:${a.cell}`).join(",");
}

/** Sanitised: steps 1…600 non-decreasing, real cells, capped per step and overall. */
export function digDecode(raw: string, cells: number): DigAction[] {
  const out: DigAction[] = [];
  let last = 1;
  const perStep = new Map<number, number>();
  for (const part of String(raw ?? "").split(",").slice(0, DIG_MAX_ACTIONS)) {
    const [a, b] = part.split(":").map((x) => Number.parseInt(x, 10));
    if (!Number.isInteger(a) || !Number.isInteger(b)) continue;
    if (a! < last || a! > DIG_STEPS || b! < 0 || b! >= cells) continue;
    const n = perStep.get(a!) ?? 0;
    if (n >= DIG_MAX_PER_STEP) continue;
    perStep.set(a!, n + 1);
    last = a!;
    out.push({ step: a!, cell: b! });
  }
  return out;
}

export interface DigReplay {
  state: DigState;
  /** Sand cells actually dug. */
  dug: number;
}

/** Runs the full 60 s (or until settled) with the given dig log. */
export function digReplay(board: DigBoard, actions: readonly DigAction[]): DigReplay {
  let state = digInit(board);
  let k = 0;
  let dug = 0;
  while (state.step < DIG_STEPS && !digSettled(state)) {
    const s = state.step + 1;
    const digs: number[] = [];
    while (k < actions.length && actions[k]!.step <= s) {
      const cell = actions[k]!.cell;
      if (state.tiles[cell] === T_SAND && !digs.includes(cell)) {
        digs.push(cell);
        dug++;
      }
      k++;
    }
    state = digStep(board, state, digs);
  }
  return { state, dug };
}

/** Full: 100 + time bonus at the step the target was reached. Else 100 × collected ÷ target, cap 90. */
export function scoreDig(state: DigState): number {
  if (state.collected >= state.full) {
    const at = state.targetStep || state.step;
    const msLeft = Math.max(0, (DIG_STEPS - at) * DIG_STEP_MS);
    return Math.min(150, 100 + Math.round((50 * msLeft) / (DIG_STEPS * DIG_STEP_MS)));
  }
  if (state.target <= 0) return 0;
  return Math.min(90, Math.round((100 * state.collected) / state.target));
}
