import { gameDisplayName } from "./gameNames";
/**
 * Server-only generation for the logic types. Minimum press counts, solved
 * pipe orientations and Sudoku solutions are worked out here and stored in the
 * private half of the puzzle, so no phone can ever read them during a round.
 */

import {
  decodeSudoku,
  lightsNeighbourhood,
  lightsOnCount,
  pipeNeighbour,
  pipesState,
  pressLights,
  rotateMask,
  shapeForMask,
  sudokuBox,
  tileOpenings,
  PIPE_BITS,
} from "./logic";
import { pick, shuffled } from "./random";
import type { SudokuLevel } from "./logicLevels";
import { sudokuLogicGrade, sudokuLogicSolve } from "./sudokuLogic";
import { countPipesSolutions, deducePipes } from "./pipesSolve.server";
import type { PipesLevelSettings } from "@/lib/levels/pattern/pipes.levels";
import {
  LIGHTS_CELLS,
  LIGHTS_MAX_BUILD,
  LIGHTS_MIN_BUILD,
  LIGHTS_MIN_ON,
  PIPES_CELLS,
  PIPES_COLS,
  SUDOKU_BOX_COLS,
  SUDOKU_BOX_ROWS,
  SUDOKU_CELLS,
  SUDOKU_COLS,
  SUDOKU_MAX_GIVENS,
  SUDOKU_MIN_GIVENS,
  SUDOKU_REV1_MAX_GIVENS,
  SUDOKU_REV1_MIN_GIVENS,
  SUDOKU_REV_FEWER,
  type LightsOutPuzzleData,
  type PipeTile,
  type PipesPuzzleData,
  type SudokuPuzzleData,
} from "./types";

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

/* -------------------------------------------------------------------------- */
/*  Lights Out                                                                 */
/* -------------------------------------------------------------------------- */

interface Row {
  mask: bigint;
  rhs: number;
}

const ONE = BigInt(1);
const ZERO = BigInt(0);
const bit = (i: number) => ONE << BigInt(i);

function popcount(value: bigint): number {
  let count = 0;
  let v = value;
  while (v) {
    v &= v - ONE;
    count += 1;
  }
  return count;
}

/**
 * Solves the pattern over GF(2) (bigint rows, since a 6x6 board has 36 cells).
 * The nullspace (the "quiet patterns") is enumerated to find a shortest set.
 */
export function minimalPressSet(lights: boolean[]): number[] {
  const rows: Row[] = lights.map((on, cell) => ({
    mask: lightsNeighbourhood(cell).reduce((mask, press) => mask | bit(press), ZERO),
    rhs: on ? 1 : 0,
  }));

  const pivotOf = new Array<number>(LIGHTS_CELLS).fill(-1);
  let rank = 0;
  for (let col = 0; col < LIGHTS_CELLS && rank < rows.length; col++) {
    let pivot = -1;
    for (let row = rank; row < rows.length; row++) {
      if (rows[row]!.mask & bit(col)) { pivot = row; break; }
    }
    if (pivot < 0) continue;
    const swap = rows[rank]!;
    rows[rank] = rows[pivot]!;
    rows[pivot] = swap;
    for (let row = 0; row < rows.length; row++) {
      if (row === rank) continue;
      if (rows[row]!.mask & bit(col)) {
        rows[row]!.mask ^= rows[rank]!.mask;
        rows[row]!.rhs ^= rows[rank]!.rhs;
      }
    }
    pivotOf[col] = rank;
    rank += 1;
  }

  for (const row of rows) if (row.mask === ZERO && row.rhs === 1) return [];

  const freeCols: number[] = [];
  for (let col = 0; col < LIGHTS_CELLS; col++) if (pivotOf[col] === -1) freeCols.push(col);

  let base = ZERO;
  for (let col = 0; col < LIGHTS_CELLS; col++) {
    const row = pivotOf[col]!;
    if (row >= 0 && rows[row]!.rhs === 1) base |= bit(col);
  }
  const basis = freeCols.map((free) => {
    let x = bit(free);
    for (let col = 0; col < LIGHTS_CELLS; col++) {
      const row = pivotOf[col]!;
      if (row >= 0 && rows[row]!.mask & bit(free)) x |= bit(col);
    }
    return x;
  });

  let best = base;
  const combos = 1 << Math.min(basis.length, 12);
  for (let combo = 1; combo < combos; combo++) {
    let candidate = base;
    for (let b = 0; b < basis.length; b++) if (combo & (1 << b)) candidate ^= basis[b]!;
    if (popcount(candidate) < popcount(best)) best = candidate;
  }

  const presses: number[] = [];
  for (let cell = 0; cell < LIGHTS_CELLS; cell++) if (best & bit(cell)) presses.push(cell);
  return presses;
}

/** 6x6 board whose proven minimum is 8–12 presses. */
export function generateLightsOut(): LightsOutPuzzleData {
  for (let attempt = 0; attempt < 500; attempt++) {
    const count = LIGHTS_MIN_BUILD + randomInt(LIGHTS_MAX_BUILD - LIGHTS_MIN_BUILD + 1);
    const built = shuffled(Array.from({ length: LIGHTS_CELLS }, (_, i) => i)).slice(0, count);
    let lights = new Array<boolean>(LIGHTS_CELLS).fill(false);
    for (const cell of built) lights = pressLights(lights, cell);
    if (lightsOnCount(lights) < LIGHTS_MIN_ON) continue;
    const solution = minimalPressSet(lights);
    if (solution.length < LIGHTS_MIN_BUILD || solution.length > LIGHTS_MAX_BUILD) continue;
    return { type: "lightsout", lights, minPresses: solution.length, solution };
  }
  throw new Error(`${gameDisplayName("lightsout")} generator could not build an 8–12 press board`);
}

/* -------------------------------------------------------------------------- */
/*  Pipes                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A random spanning tree over all 36 cells. Every cell is a node and edges only
 * join orthogonal neighbours, so a cell's open sides are exactly the tree edges
 * touching it — the board is solvable by construction.
 */
function spanningTree(cols: number = PIPES_COLS, rows: number = cols): { masks: number[]; root: number } {
  // Today's 7 × 7 when called with no size (Normal: the same random draws in the same order as before levels).
  const cells = cols === PIPES_COLS && rows === PIPES_COLS ? PIPES_CELLS : cols * rows;
  const masks = new Array<number>(cells).fill(0);
  const visited = new Array<boolean>(cells).fill(false);
  const root = randomInt(cells);
  visited[root] = true;

  let frontier: { from: number; bit: number }[] = PIPE_BITS.map((bit) => ({ from: root, bit }));

  while (frontier.length) {
    frontier = frontier.filter(({ from, bit }) => {
      const to = pipeNeighbour(from, bit, cols, rows);
      return to !== null && !visited[to];
    });
    if (!frontier.length) break;
    const choice = frontier[randomInt(frontier.length)]!;
    const to = pipeNeighbour(choice.from, choice.bit, cols, rows)!;
    masks[choice.from]! |= choice.bit;
    masks[to]! |= rotateMask(choice.bit, 2);
    visited[to] = true;
    for (const bit of PIPE_BITS) frontier.push({ from: to, bit });
  }

  return { masks, root };
}

/** Turns each tile 1–3 quarter turns, never landing back on its solved sides. */
function scramble(masks: number[]): { tiles: PipeTile[]; wrong: number } {
  let wrong = 0;
  const tiles = masks.map((solved) => {
    const options = [1, 2, 3]
      .map((turns) => rotateMask(solved, turns))
      .filter((sides) => sides !== solved);
    if (!options.length) return { sides: solved };
    wrong += 1;
    return { sides: pick(options) };
  });
  return { tiles, wrong };
}

export function generatePipes(): PipesPuzzleData {
  for (let attempt = 0; attempt < 200; attempt++) {
    const { masks, root } = spanningTree();
    const solved: PipeTile[] = masks.map((sides) => ({ sides }));

    // Never ship a board the solved side-sets do not actually solve.
    if (!pipesState(solved, root).solved) continue;

    const { tiles, wrong } = scramble(masks);
    // Cross tiles look the same in every orientation, so keep them rare.
    if (wrong / PIPES_CELLS < 0.8) continue;

    return { type: "pipes", tiles, source: root, solution: masks };
  }
  throw new Error(`${gameDisplayName("pipes")} generator could not build a proven-solvable board`);
}

/**
 * pipesRev 5's Normal board has exactly one solution (Joe, 16 Nov 2026): about 4 % of today's 7 × 7 deals have two
 * layouts that both join every pipe (the grader accepts either, so the board has no single answer). On pipesRev 5
 * (the patternNov15 layer, generate.server.ts) such a board is dealt again from the same seeded stream, the next
 * draw in line, until the searching solver (`countPipesSolutions`, stopping at 2) finds exactly one layout. A board
 * that already has one is returned untouched (the same object), so 96 % of Normal deals are byte for byte the board
 * before. Level boards (`cols` set) are proved one-solution when built (`generatePipesLevel`) and pass through.
 * pipesRev 4 and below never reach this (the layer only moves a pipesRev 4 deal up).
 */
export function withPipesOneLayout<T extends { type: string }>(puzzle: T): T {
  const q = puzzle as unknown as PipesPuzzleData;
  if (q.type !== "pipes" || q.cols !== undefined || q.rows !== undefined) return puzzle;
  const oneLayout = (p: PipesPuzzleData) => countPipesSolutions(p.tiles.map(tileOpenings), PIPES_COLS, PIPES_COLS, 2) === 1;
  if (oneLayout(q)) return puzzle;
  for (let attempt = 0; attempt < 200; attempt++) {
    const next = generatePipes();
    if (oneLayout(next)) return { ...puzzle, tiles: next.tiles, source: next.source, solution: next.solution } as T;
  }
  throw new Error(`${gameDisplayName("pipes")} generator could not build a one-solution board`);
}

/**
 * A level's board (difficulty levels, 15 Nov 2026; src/lib/levels/pattern/pipes.levels.ts): the same spanning-tree
 * build on the level's size, kept only when the person-like solver (`deducePipes`) fixes every tile from the dealt
 * shapes alone, which proves the board has exactly one solution and that a person can reason it out without
 * guessing. Then turned: exactly the level's share of tiles (`exact`, Easy; the rest dealt right) or every tile with
 * at least that share of them looking wrong (as Normal). The board carries its size (`cols`, `rows`) and, where the
 * level hides them, `hideLeaks`.
 */
export function generatePipesLevel(settings: PipesLevelSettings): PipesPuzzleData {
  const { cols, rows } = settings;
  const cells = cols * rows;
  for (let attempt = 0; attempt < 500; attempt++) {
    const { masks, root } = spanningTree(cols, rows);
    if (!pipesState(masks.map((sides) => ({ sides })), root, cols).solved) continue;
    const proved = deducePipes(masks, cols, rows);
    if (!proved || proved.some((m, i) => m !== masks[i])) continue;
    let tiles: PipeTile[];
    if (settings.exact) {
      const want = Math.round(settings.scrambled * cells);
      const turnable = masks.flatMap((m, i) => (rotateMask(m, 1) !== m ? [i] : []));
      if (turnable.length < want) continue;
      const turned = new Set(shuffled(turnable).slice(0, want));
      tiles = masks.map((solved, i) => {
        if (!turned.has(i)) return { sides: solved };
        const options = [1, 2, 3].map((t) => rotateMask(solved, t)).filter((m) => m !== solved);
        return { sides: pick(options) };
      });
    } else {
      const { tiles: dealt, wrong } = scramble(masks);
      if (wrong / cells < settings.scrambled) continue;
      tiles = dealt;
    }
    return {
      type: "pipes",
      tiles,
      source: root,
      solution: masks,
      cols,
      rows,
      ...(settings.leaks ? {} : { hideLeaks: true }),
    };
  }
  throw new Error(`${gameDisplayName("pipes")} generator could not build a proven one-solution board at ${cols} × ${rows}`);
}

/* -------------------------------------------------------------------------- */
/*  Mini Sudoku                                                                */
/* -------------------------------------------------------------------------- */

const BANDS = SUDOKU_COLS / SUDOKU_BOX_ROWS;
const STACKS = SUDOKU_COLS / SUDOKU_BOX_COLS;

function baseSolution(): number[] {
  const grid = new Array<number>(SUDOKU_CELLS).fill(0);
  for (let row = 0; row < SUDOKU_COLS; row++) {
    for (let col = 0; col < SUDOKU_COLS; col++) {
      const value = (col + SUDOKU_BOX_COLS * (row % 2) + Math.floor(row / 2)) % SUDOKU_COLS;
      grid[row * SUDOKU_COLS + col] = value + 1;
    }
  }
  return grid;
}

/** Shuffles digits, rows within bands, columns within stacks, bands and stacks. */
function shuffledSolution(): number[] {
  const base = baseSolution();
  const digits = shuffled([1, 2, 3, 4, 5, 6]);

  const rowOrder: number[] = [];
  for (const band of shuffled(Array.from({ length: BANDS }, (_, i) => i))) {
    for (const offset of shuffled(Array.from({ length: SUDOKU_BOX_ROWS }, (_, i) => i))) {
      rowOrder.push(band * SUDOKU_BOX_ROWS + offset);
    }
  }
  const colOrder: number[] = [];
  for (const stack of shuffled(Array.from({ length: STACKS }, (_, i) => i))) {
    for (const offset of shuffled(Array.from({ length: SUDOKU_BOX_COLS }, (_, i) => i))) {
      colOrder.push(stack * SUDOKU_BOX_COLS + offset);
    }
  }

  const grid = new Array<number>(SUDOKU_CELLS).fill(0);
  for (let row = 0; row < SUDOKU_COLS; row++) {
    for (let col = 0; col < SUDOKU_COLS; col++) {
      const value = base[rowOrder[row]! * SUDOKU_COLS + colOrder[col]!]!;
      grid[row * SUDOKU_COLS + col] = digits[value - 1]!;
    }
  }
  return grid;
}

function candidates(grid: number[], cell: number): number[] {
  const row = Math.floor(cell / SUDOKU_COLS);
  const col = cell % SUDOKU_COLS;
  const box = sudokuBox(cell);
  const used = new Set<number>();
  for (let i = 0; i < SUDOKU_CELLS; i++) {
    const value = grid[i]!;
    if (!value) continue;
    if (Math.floor(i / SUDOKU_COLS) === row || i % SUDOKU_COLS === col || sudokuBox(i) === box) {
      used.add(value);
    }
  }
  return [1, 2, 3, 4, 5, 6].filter((value) => !used.has(value));
}

/** Counts solutions, stopping at two — all we need for uniqueness. */
export function countSudokuSolutions(puzzle: number[], limit = 2): number {
  const grid = [...puzzle];
  let found = 0;

  const search = (): void => {
    if (found >= limit) return;
    let best = -1;
    let bestOptions: number[] = [];
    for (let cell = 0; cell < SUDOKU_CELLS; cell++) {
      if (grid[cell]) continue;
      const options = candidates(grid, cell);
      if (options.length === 0) return;
      if (best === -1 || options.length < bestOptions.length) {
        best = cell;
        bestOptions = options;
        if (options.length === 1) break;
      }
    }
    if (best === -1) {
      found += 1;
      return;
    }
    for (const value of bestOptions) {
      grid[best] = value;
      search();
      grid[best] = 0;
      if (found >= limit) return;
    }
  };

  search();
  return found;
}

/**
 * New rounds (sudokuRev 1, 14 Oct 2026) keep 13–15 givens; `generateClassicSudoku`
 * is the stored rounds' 14–16. Givens are removed one at a time from a full grid
 * and a removal is kept only while the board still has exactly one solution.
 */
export function generateSudoku(): SudokuPuzzleData {
  return { ...buildSudoku(SUDOKU_REV1_MIN_GIVENS, SUDOKU_REV1_MAX_GIVENS), sudokuRev: SUDOKU_REV_FEWER };
}

/**
 * A level's board (the Logic overhaul's levels, logicLevels.ts): givens in the level's band, removed one at a time from
 * a full grid while the board keeps exactly one solution, and kept only when the human-style grader (sudokuLogic.ts)
 * solves it with the level's steps: Easy by singles alone, Hard and Expert needing at least one advanced step. The
 * level's clash and keypad rules ride on the puzzle (`clashes`, `hideUsed`) for the stage; `sudokuRev` stays 1 (the
 * grade reads only the givens), and the dealt `level` says which level it is.
 */
export function generateSudokuLevel(level: SudokuLevel): SudokuPuzzleData {
  const [lo, hi] = level.givens;
  for (let attempt = 0; attempt < 4000; attempt++) {
    const solution = shuffledSolution();
    const givens = [...solution];
    const target = lo + randomInt(hi - lo + 1);
    let remaining = SUDOKU_CELLS;
    for (const cell of shuffled(Array.from({ length: SUDOKU_CELLS }, (_, i) => i))) {
      if (remaining <= target) break;
      const kept = givens[cell]!;
      givens[cell] = 0;
      if (countSudokuSolutions(givens) === 1) remaining -= 1;
      else givens[cell] = kept;
    }
    if (remaining < lo || remaining > hi) continue;
    const grade = sudokuLogicGrade(givens);
    if (grade !== level.steps) continue;
    if ((level.minAdvanced ?? 0) > 0 && sudokuLogicSolve(givens).advanced < level.minAdvanced!) continue;
    return {
      type: "sudoku",
      givens,
      solution,
      sudokuRev: SUDOKU_REV_FEWER,
      timeLimitMs: level.timeMs,
      ...(level.clashes === "check" ? { clashes: "check" as const } : {}),
      ...(level.hideUsed ? { hideUsed: true } : {}),
    };
  }
  throw new Error(`${gameDisplayName("sudoku")} generator could not build a ${level.steps} board with ${lo}–${hi} givens`);
}

export function generateClassicSudoku(): SudokuPuzzleData {
  return buildSudoku(SUDOKU_MIN_GIVENS, SUDOKU_MAX_GIVENS);
}

function buildSudoku(minGivens: number, maxGivens: number): SudokuPuzzleData {
  for (let attempt = 0; attempt < 40; attempt++) {
    const solution = shuffledSolution();
    const givens = [...solution];
    const target = minGivens + randomInt(maxGivens - minGivens + 1);
    let remaining = SUDOKU_CELLS;

    for (const cell of shuffled(Array.from({ length: SUDOKU_CELLS }, (_, i) => i))) {
      if (remaining <= target) break;
      const kept = givens[cell]!;
      givens[cell] = 0;
      if (countSudokuSolutions(givens) === 1) remaining -= 1;
      else givens[cell] = kept;
    }

    if (remaining >= minGivens && remaining <= maxGivens) {
      return { type: "sudoku", givens, solution };
    }
  }

  const solution = shuffledSolution();
  const givens = [...solution];
  for (const cell of shuffled(Array.from({ length: SUDOKU_CELLS }, (_, i) => i))) {
    if (givens.filter(Boolean).length <= maxGivens) break;
    const kept = givens[cell]!;
    givens[cell] = 0;
    if (countSudokuSolutions(givens) !== 1) givens[cell] = kept;
  }
  return { type: "sudoku", givens, solution };
}

/** Server-side check of a Sudoku submission against the rules themselves. */
export function gradeSudokuGrid(
  givens: number[],
  solution: number[],
  raw: string,
): { solved: boolean; correct: number; total: number; wrong: number } {
  const grid = decodeSudoku(raw);
  const blanks: number[] = [];
  for (let cell = 0; cell < SUDOKU_CELLS; cell++) if (!(givens[cell] ?? 0)) blanks.push(cell);

  let correct = 0;
  let wrong = 0;
  for (const cell of blanks) {
    if (grid[cell] && grid[cell] === solution[cell]) correct += 1;
    else if (grid[cell]) wrong += 1;
  }

  const respectsGivens = givens.every((given, cell) => !given || grid[cell] === given);
  const solved = respectsGivens && correct === blanks.length;
  return { solved, correct, total: blanks.length, wrong };
}

/**
 * Server-side check of a Pipes submission — the same flood-fill the phone runs
 * live, never a diff against the stored solution.
 */
export function gradePipesBoard(
  source: number,
  board: PipeTile[],
  cols: number = PIPES_COLS,
): { solved: boolean; connected: number } {
  // `cols`: a level board's width (pipesDims); left out, today's 7 × 7.
  const state = pipesState(board, source, cols);
  return { solved: state.solved, connected: state.connected.size };
}
