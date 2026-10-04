/**
 * Dig — a deterministic cell-grid water sim shared by the phone, the server
 * grader and the bank script.
 *
 * Tiles, one character per cell: `#` rock, `s` sand (diggable), `.` empty,
 * `D` drain (collects; boards may have one or two), `G` side gap (water
 * entering it is lost), `L` lava (water entering it is destroyed), `a` buried
 * acid (looks like sand, cannot be dug) which becomes `A` once revealed.
 * Acid is open: water entering it turns toxic. Toxic spreads to every cell it
 * flows into and never becomes clean again.
 *
 * Sand obeys gravity: each step (bottom-up) loose or falling sand drops into an
 * empty cell below, or sinks through water (the water rises). Sand that has
 * fallen packs (`P`) when it comes to rest: undiggable and solid. Each step runs
 * sand, then water, then the digs recorded for that step.
 *
 * Water is integer units per cell, 0–4. Water flows: bottom row first, left to right.
 * A cell moves only the water it held at the start of the step: down first (as
 * much as fits). Water that cannot fall heads one cell toward the nearest drop
 * along its row (a cell with room below, or a sink), ties left, at most 2 units
 * a step. With no reachable drop it levels: into a lower neighbour, left then
 * right, floor((a − b) ÷ 2) at a time.
 *
 * Water that has flowed and then sits unchanged for 15 steps is evaporating
 * (drawn flickering); at 30 steps it settles (dimmed) and counts as lost. Pool
 * water that has never moved does not evaporate.
 */

export const DIG_COLS = 12;
export const DIG_ROWS = 16;
export const DIG_STEPS_PER_SECOND = 10;
export const DIG_STEPS = 600;
export const DIG_STEP_MS = 1000 / DIG_STEPS_PER_SECOND;
export const DIG_MAX_UNITS = 4;
/** Most units a cell sends sideways toward a drop each step. */
export const DIG_SIDE_MAX = 2;
/** Standard boards: one drain, target 80% of the pool. */
export const DIG_TARGET_PCT = 80;
/** Most digs one step can carry (a fast interpolated drag). */
export const DIG_MAX_PER_STEP = 16;
export const DIG_MAX_ACTIONS = 400;
export const DIG_EVAP_STEPS = 15;
export const DIG_SETTLE_STEPS = 30;
export const DIG_BUDGET_SLACK = 2;
export const DIG_MIN_BONUS = 20;

export const T_ROCK = "#";
export const T_SAND = "s";
export const T_EMPTY = ".";
export const T_DRAIN = "D";
export const T_GAP = "G";
export const T_LAVA = "L";
export const T_ACID_HIDDEN = "a";
export const T_ACID = "A";
/** Sand in mid-fall (solid, not diggable). */
export const T_FALLING = "f";
/** Sand that fell and came to rest: undiggable, solid to water and sand. */
export const T_PACKED = "P";

export interface DigBoard {
  cols: number;
  rows: number;
  tiles: string;
  /** Starting units per cell, one digit per cell. */
  water: string;
  /** Most sand cells the player may remove. */
  budget: number;
  /** Fewest digs that complete the board (the +20 bonus). */
  minDigs: number;
  /** Clean units each drain needs, in drain-cell order. */
  targets: number[];
}

export interface DigAction {
  step: number;
  cell: number;
}

export interface DigState {
  step: number;
  tiles: string[];
  water: number[];
  /** 1 where the cell's water is toxic. */
  tox: number[];
  /** Steps the cell's water has sat unchanged since it last flowed (−1 = never flowed). */
  age: number[];
  /** Settled units left in each cell (drawn dimmed; they block the cell). */
  settled: number[];
  /** Drain cell indices, in tile order. */
  drains: number[];
  /** Clean units per drain (toxic arrivals subtract, floor 0). */
  drained: number[];
  targets: number[];
  toxicIn: number;
  lost: number;
  settledUnits: number;
  /** [cell, step] each time a cell settled. */
  settledLog: [number, number][];
  pool: number;
  dug: number;
  budget: number;
  /** Sand cell moves (falls and sink-swaps) this round. */
  sandFallen: number;
  /** Step all drains reached their targets, or 0. */
  completeStep: number;
}

export function digPoolUnits(board: Pick<DigBoard, "water">): number {
  let n = 0;
  for (const ch of board.water) n += ch.charCodeAt(0) - 48;
  return n;
}

export function digTarget(pool: number): number {
  return Math.floor((pool * DIG_TARGET_PCT + 50) / 100);
}

export function digDrains(tiles: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < tiles.length; i++) if (tiles[i] === T_DRAIN) out.push(i);
  return out;
}

export function digInit(board: DigBoard): DigState {
  const pool = digPoolUnits(board);
  const drains = digDrains(board.tiles);
  return {
    step: 0,
    tiles: [...board.tiles],
    water: [...board.water].map((ch) => ch.charCodeAt(0) - 48),
    tox: new Array(board.tiles.length).fill(0),
    age: new Array(board.tiles.length).fill(-1),
    settled: new Array(board.tiles.length).fill(0),
    drains,
    drained: drains.map(() => 0),
    targets: drains.map((_, k) => board.targets[k] ?? 0),
    toxicIn: 0,
    lost: 0,
    settledUnits: 0,
    settledLog: [],
    pool,
    dug: 0,
    budget: board.budget,
    sandFallen: 0,
    completeStep: 0,
  };
}

export function digComplete(state: DigState): boolean {
  return state.drains.length > 0 && state.drains.every((_, k) => state.drained[k]! >= state.targets[k]!);
}

function revealAround(tiles: string[], cols: number, rows: number, cell: number) {
  const r = Math.floor(cell / cols);
  const c = cell % cols;
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
    const rr = r + dr;
    const cc = c + dc;
    if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
    const n = rr * cols + cc;
    if (tiles[n] === T_ACID_HIDDEN) tiles[n] = T_ACID;
  }
}

/** Can water enter this cell as ordinary flow (not a sink)? */
function isOpen(t: string | undefined): boolean {
  return t === T_EMPTY || t === T_ACID || t === T_ACID_HIDDEN;
}

/** Applies one step: `digs` are the cells dug on this step, in order (budget enforced). */
export function digStep(board: DigBoard, state: DigState, digs: readonly number[]): DigState {
  const { cols, rows } = board;
  const tiles = state.tiles.slice();
  const water0 = state.water.slice();
  const tox = state.tox.slice();
  const age0 = state.age.slice();
  let sandFallen = state.sandFallen;
  // Sand first, bottom-up: fall into an empty cell, or sink through water (water rises).
  for (let r = rows - 2; r >= 0; r--) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const t = tiles[i];
      if (t !== T_SAND && t !== T_FALLING) continue;
      const j = i + cols;
      if (tiles[j] === T_EMPTY && state.settled[j] === 0) {
        tiles[j] = T_FALLING;
        tiles[i] = T_EMPTY;
        water0[i] = water0[j]!;
        tox[i] = tox[j]!;
        age0[i] = water0[j]! > 0 ? 0 : -1;
        water0[j] = 0;
        tox[j] = 0;
        age0[j] = -1;
        sandFallen++;
      } else if (t === T_FALLING) tiles[i] = T_PACKED;
    }
  }
  const step = state.step + 1;
  const avail = water0.slice();
  const next = water0.slice();
  const settled = state.settled.slice();
  const changed = new Array<boolean>(next.length).fill(false);
  const flowedIn = new Array<boolean>(next.length).fill(false);
  const drained = state.drained.slice();
  const drainIdx = new Map(state.drains.map((d, k) => [d, k]));
  let lost = state.lost;
  let toxicIn = state.toxicIn;

  const sink = (from: number, to: number, units: number) => {
    const t = tiles[to];
    if (t === T_DRAIN) {
      const k = drainIdx.get(to)!;
      if (tox[from]) {
        toxicIn += units;
        drained[k] = Math.max(0, drained[k]! - units);
      } else {
        const room = Math.max(0, state.targets[k]! - drained[k]!);
        const take = Math.min(room, units);
        drained[k] = drained[k]! + take;
        lost += units - take;
      }
    } else lost += units; // gap or lava
  };
  const isSink = (t: string | undefined) => t === T_DRAIN || t === T_GAP || t === T_LAVA;
  const move = (from: number, to: number, units: number) => {
    next[from] = next[from]! - units;
    changed[from] = true;
    if (isSink(tiles[to])) {
      sink(from, to, units);
      return;
    }
    next[to] = next[to]! + units;
    changed[to] = true;
    flowedIn[to] = true;
    if (tox[from] || tiles[to] === T_ACID || tiles[to] === T_ACID_HIDDEN) tox[to] = 1;
    if (tiles[to] === T_ACID_HIDDEN) tiles[to] = T_ACID;
  };
  const canEnter = (n: number) => isOpen(tiles[n]) && settled[n] === 0;
  /** A cell water could fall from: open, with room (or a sink) directly below. */
  const isDrop = (n: number) => {
    const j = n + cols;
    if (j >= tiles.length) return false;
    return isSink(tiles[j]) || (canEnter(j) && next[j]! < DIG_MAX_UNITS);
  };
  /** Steps along the row to the nearest drop (an in-row sink counts), or −1. */
  const dropDist = (r: number, c: number, d: number) => {
    for (let k = 1, cc = c + d; cc >= 0 && cc < cols; k++, cc += d) {
      const n = r * cols + cc;
      if (isSink(tiles[n])) return k;
      if (!canEnter(n)) return -1;
      if (isDrop(n)) return k;
    }
    return -1;
  };

  for (let r = rows - 1; r >= 0; r--) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      let w = Math.min(avail[i]!, next[i]!);
      if (w <= 0) continue;
      if (r + 1 < rows) {
        const j = i + cols;
        if (isSink(tiles[j])) {
          move(i, j, w);
          continue;
        }
        if (canEnter(j)) {
          const m = Math.min(w, DIG_MAX_UNITS - next[j]!);
          if (m > 0) {
            move(i, j, m);
            w -= m;
          }
        }
      }
      if (w <= 0) continue;
      // Hole-seeking: head one cell toward the nearest drop in this row (ties left), at most 2 units.
      const dl = dropDist(r, c, -1);
      const dr = dropDist(r, c, 1);
      if (dl >= 0 || dr >= 0) {
        const d = dl >= 0 && (dr < 0 || dl <= dr) ? -1 : 1;
        const n = i + d;
        let m = Math.min(w, DIG_SIDE_MAX);
        if (!isSink(tiles[n])) m = Math.min(m, DIG_MAX_UNITS - next[n]!);
        if (m > 0) move(i, n, m);
        continue;
      }
      for (const d of [-1, 1]) {
        if (w <= 0) break;
        const cc = c + d;
        if (cc < 0 || cc >= cols) continue;
        const n = i + d;
        const level = next[i]!;
        if (!canEnter(n)) continue;
        const nl = next[n]!;
        if (nl >= level) continue;
        let m = (level - nl) >> 1;
        if (m > w) m = w;
        if (m > DIG_MAX_UNITS - nl) m = DIG_MAX_UNITS - nl;
        if (m <= 0) continue;
        move(i, n, m);
        w -= m;
      }
    }
  }

  const age = age0;
  let settledUnits = state.settledUnits;
  let settledLog = state.settledLog;
  for (let i = 0; i < next.length; i++) {
    if (next[i]! <= 0) {
      age[i] = -1;
      if (tiles[i] !== T_ACID) tox[i] = 0;
      continue;
    }
    if (flowedIn[i]) age[i] = 0;
    else if (changed[i]) age[i] = age[i]! < 0 ? -1 : 0;
    else if (age[i]! >= 0) age[i] = age[i]! + 1;
    if (age[i]! >= DIG_SETTLE_STEPS) {
      settled[i] = settled[i]! + next[i]!;
      settledUnits += next[i]!;
      next[i] = 0;
      age[i] = -1;
      settledLog = [...settledLog, [i, step]];
    }
  }

  // Digs recorded for this step apply last; only loose sand can be dug.
  let dug = state.dug;
  for (const cell of digs) {
    if (dug >= state.budget) break;
    if (tiles[cell] !== T_SAND) continue;
    tiles[cell] = T_EMPTY;
    dug++;
    revealAround(tiles, cols, rows, cell);
  }
  const out: DigState = {
    ...state,
    sandFallen,
    step,
    tiles,
    water: next,
    tox,
    age,
    settled,
    drained,
    toxicIn,
    lost,
    settledUnits,
    settledLog,
    dug,
  };
  if (!out.completeStep && digComplete(out)) out.completeStep = step;
  return out;
}

export function digWaterLeft(state: DigState): number {
  let n = 0;
  for (const w of state.water) n += w;
  return n;
}

export function digCleanCollected(state: DigState): number {
  return state.drained.reduce((a, b) => a + b, 0);
}

/** Round over: complete, or every unit is collected, lost or settled. */
export function digSettled(state: DigState): boolean {
  return state.completeStep > 0 || digWaterLeft(state) === 0;
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

/** Orthogonally connected cells from `a` to `b` (exclusive of `a`), Bresenham-style. */
export function digLine(a: number, b: number, cols: number): number[] {
  let r = Math.floor(a / cols);
  let c = a % cols;
  const r1 = Math.floor(b / cols);
  const c1 = b % cols;
  const dr = Math.abs(r1 - r);
  const dc = Math.abs(c1 - c);
  const sr = r1 > r ? 1 : -1;
  const sc = c1 > c ? 1 : -1;
  let err = dc - dr;
  const out: number[] = [];
  while (r !== r1 || c !== c1) {
    // One axis at a time, so consecutive cells always share an edge.
    if (2 * err > -dr && c !== c1) {
      err -= dr;
      c += sc;
    } else {
      err += dc;
      r += sr;
    }
    out.push(r * cols + c);
  }
  return out;
}

export interface DigReplay {
  state: DigState;
  dug: number;
}

/** Runs the 60 s (or until over) with the given dig log. */
export function digReplay(board: DigBoard, actions: readonly DigAction[]): DigReplay {
  let state = digInit(board);
  let k = 0;
  while (state.step < DIG_STEPS && !digSettled(state)) {
    const s = state.step + 1;
    const digs: number[] = [];
    while (k < actions.length && actions[k]!.step <= s) {
      const cell = actions[k]!.cell;
      if (!digs.includes(cell)) digs.push(cell);
      k++;
    }
    state = digStep(board, state, digs);
  }
  return { state, dug: state.dug };
}

/**
 * Complete: 100 + round(50 × ms left at completion ÷ 60 000), +20 at the
 * minimum dig count, cap 150. Else round(100 × clean ÷ total target), cap 90.
 */
export function scoreDig(state: DigState, minDigs: number): number {
  if (state.completeStep > 0) {
    const msLeft = Math.max(0, (DIG_STEPS - state.completeStep) * DIG_STEP_MS);
    const bonus = state.dug <= minDigs ? DIG_MIN_BONUS : 0;
    return Math.min(150, 100 + Math.round((50 * msLeft) / (DIG_STEPS * DIG_STEP_MS)) + bonus);
  }
  const total = state.targets.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  return Math.min(90, Math.round((100 * digCleanCollected(state)) / total));
}
