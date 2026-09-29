/**
 * Sum Hunt rules, shared by the phone and server. Every stage board is derived
 * only from the round seed and stage number, so both players see identical play.
 */

export const SH_SIZE = 5;
export const SH_CELLS = SH_SIZE * SH_SIZE;
export const SH_TIME_MS = 90_000;
export const SH_REVEAL_MS = 6_000;
export const SH_STAGES = 9;
export const SH_TWO_DIGIT_CELLS = 10;

export interface SumHuntState {
  board: number[];
  stage: number;
  paths: number;
  reshuffles: number;
  target: number;
}

function step(state: number): { state: number; value: number } {
  const next = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return { state: next, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

function drawInt(rng: { value: number }, min: number, max: number): number {
  const draw = step(rng.value);
  rng.value = draw.state;
  return min + Math.floor(draw.value * (max - min + 1));
}

export function sumHuntRoundScore(stage: number, msRemaining: number): number {
  return stage > SH_STAGES
    ? 100 + Math.round(50 * Math.max(0, Math.min(SH_TIME_MS, msRemaining)) / SH_TIME_MS)
    : Math.min(80, 10 * Math.max(0, stage - 1));
}

/** Independent seed stream: the same rising targets for both players. */
export function sumHuntTargets(seed: number): number[] {
  const rng = { value: (seed ^ 0x3a951d07) | 0 };
  const targets = [drawInt(rng, 20, 25)];
  for (let i = 1; i < SH_STAGES - 1; i++) targets.push(targets[i - 1]! + drawInt(rng, 8, 14));
  return targets;
}

function neighbours(cell: number): number[] {
  const row = Math.floor(cell / SH_SIZE);
  const col = cell % SH_SIZE;
  const out: number[] = [];
  const directions: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of directions) {
    if (row + dr >= 0 && row + dr < SH_SIZE && col + dc >= 0 && col + dc < SH_SIZE)
      out.push((row + dr) * SH_SIZE + col + dc);
  }
  return out;
}

/** Distinct valid paths, treating a path and its reverse as one, capped at `limit`. */
export function countValidPaths(board: number[], target: number, limit = 4): number {
  let directed = 0;
  const used = new Set<number>();
  const walk = (cell: number, sum: number, length: number): void => {
    if (directed >= limit * 2) return;
    if (sum === target && length >= 2) {
      directed++;
      return;
    }
    if (sum >= target || length >= 6) return;
    for (const next of neighbours(cell)) {
      if (used.has(next) || sum + board[next]! > target) continue;
      used.add(next);
      walk(next, sum + board[next]!, length + 1);
      used.delete(next);
    }
  };
  for (let cell = 0; cell < SH_CELLS && directed < limit * 2; cell++) {
    used.add(cell);
    walk(cell, board[cell]!, 1);
    used.delete(cell);
  }
  return Math.floor(directed / 2);
}

function shuffle<T>(items: T[], rng: { value: number }): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = drawInt(rng, 0, i);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

/** A deterministic fresh board with exactly ten two-digit cells and 1–3 solutions. */
export function sumHuntBoard(seed: number, stage: number, target: number): number[] {
  const rng = { value: (seed ^ Math.imul(stage + 1, 0x51ed270b)) | 0 };
  for (let attempt = 0; attempt < 100_000; attempt++) {
    const lowMin = Math.max(1, Math.min(9, Math.floor(target / 6)));
    const highMin = Math.max(10, Math.min(20, Math.floor(target / 6)));
    const board = shuffle([
      ...Array.from({ length: SH_TWO_DIGIT_CELLS }, () => drawInt(rng, highMin, 20)),
      ...Array.from({ length: SH_CELLS - SH_TWO_DIGIT_CELLS }, () => drawInt(rng, lowMin, 9)),
    ], rng);
    const count = countValidPaths(board, target, 4);
    if (count >= 1 && count <= 3) return board;
  }
  throw new Error(`Unable to generate Sum Hunt stage ${stage}`);
}

/** Stage nine only needs a fresh deterministic board; its total becomes the target. */
function finalBoard(seed: number): number[] {
  const rng = { value: (seed ^ Math.imul(SH_STAGES + 1, 0x51ed270b)) | 0 };
  return shuffle([
    ...Array.from({ length: SH_TWO_DIGIT_CELLS }, () => drawInt(rng, 10, 20)),
    ...Array.from({ length: SH_CELLS - SH_TWO_DIGIT_CELLS }, () => drawInt(rng, 1, 9)),
  ], rng);
}

export function initSumHunt(seed: number, target: number): SumHuntState {
  const firstTarget = sumHuntTargets(seed)[0] ?? target;
  return { board: sumHuntBoard(seed, 1, firstTarget), stage: 1, paths: 0, reshuffles: 0, target: firstTarget };
}

export function pathSum(board: number[], path: number[]): number {
  return path.reduce((sum, cell) => sum + (board[cell] ?? 0), 0);
}

export function pathShapeValid(path: number[]): boolean {
  if (path.length < 2 || new Set(path).size !== path.length) return false;
  return path.every((cell, i) => cell >= 0 && cell < SH_CELLS && (i === 0 || neighbours(path[i - 1]!).includes(cell)));
}

/** Accepts one stage path and swaps in the next deterministic board. */
export function applySumPath(state: SumHuntState, target: number, path: number[], seed: number): SumHuntState | null {
  if (state.stage > SH_STAGES || target !== state.target || !pathShapeValid(path) || pathSum(state.board, path) !== target) return null;
  if (state.stage === SH_STAGES) {
    return path.length === SH_CELLS ? { ...state, board: Array(SH_CELLS).fill(0), stage: SH_STAGES + 1, paths: state.paths + 1 } : null;
  }
  const nextStage = state.stage + 1;
  const targets = sumHuntTargets(seed);
  const provisionalTarget = targets[nextStage - 1];
  const board = nextStage === SH_STAGES
    ? finalBoard(seed)
    : sumHuntBoard(seed, nextStage, provisionalTarget ?? state.target);
  const nextTarget = nextStage === SH_STAGES
    ? board.reduce((sum, value) => sum + value, 0)
    : provisionalTarget ?? state.target;
  return { ...state, board, stage: nextStage, paths: state.paths + 1, target: nextTarget };
}

export function encodeSumPaths(paths: number[][]): string {
  return paths.map((path) => path.join(".")).join(";");
}

export function decodeSumPaths(raw: string): number[][] {
  if (typeof raw !== "string" || !raw) return [];
  return raw.split(";").slice(0, SH_STAGES).map((path) => path.split(".").slice(0, SH_CELLS).map((value) => Number.parseInt(value, 10))).filter((path) => path.every(Number.isInteger));
}

export function replaySumHunt(seed: number, target: number, paths: number[][]): SumHuntState {
  let state = initSumHunt(seed, target);
  for (const path of paths) state = applySumPath(state, state.target, path, seed) ?? state;
  return state;
}

export function sumHuntText(state: SumHuntState): string {
  return state.stage > SH_STAGES ? "Cleared the grid" : `Stage ${state.stage} of ${SH_STAGES}`;
}
