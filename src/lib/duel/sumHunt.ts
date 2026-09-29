/**
 * Sum Hunt rules, shared by the phone and the server. The seed draws the board
 * and each column's falling digits (everyone gets the same digits in the same
 * order). The answer is the list of paths drawn; the server replays it here.
 */

export const SH_SIZE = 5;
export const SH_CELLS = SH_SIZE * SH_SIZE;
export const SH_TIME_MS = 90_000;
export const SH_REVEAL_MS = 6_000;
export const SH_STAGES = 9;

export interface SumHuntState {
  board: number[];
  /** PRNG state per column queue. */
  cols: number[];
  /** PRNG state for reshuffles. */
  rng: number;
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

function digit(state: number): { state: number; value: number } {
  const r = step(state);
  return { state: r.state, value: 1 + Math.floor(r.value * 9) };
}

export function sumHuntRoundScore(stage: number, msRemaining: number): number {
  return stage > SH_STAGES
    ? 100 + Math.round(50 * Math.max(0, Math.min(SH_TIME_MS, msRemaining)) / SH_TIME_MS)
    : Math.min(80, 10 * Math.max(0, stage - 1));
}

/** Independent seed stream: the same rising targets for both players regardless of their clears. */
export function sumHuntTargets(seed: number): number[] {
  let rng = (seed ^ 0x3a951d07) | 0;
  let draw = step(rng); rng = draw.state;
  const targets = [10 + Math.floor(draw.value * 3)];
  for (let i = 1; i < SH_STAGES - 1; i++) {
    draw = step(rng); rng = draw.state;
    targets.push(targets[i - 1]! + 4 + Math.floor(draw.value * 4));
  }
  return targets;
}

function neighbours(cell: number): number[] {
  const r = Math.floor(cell / SH_SIZE);
  const c = cell % SH_SIZE;
  const out: number[] = [];
  const directions: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of directions) {
    if (r + dr >= 0 && r + dr < SH_SIZE && c + dc >= 0 && c + dc < SH_SIZE)
      out.push((r + dr) * SH_SIZE + c + dc);
  }
  return out;
}

/** Distinct valid paths (each counted once, not in both directions), up to `limit`. */
export function countValidPaths(board: number[], target: number, limit = 3): number {
  let count = 0;
  const used = new Set<number>();
  const walk = (cell: number, sum: number, length: number): void => {
    if (count >= limit * 2) return;
    if (sum === target && length >= 2) count++;
    if (sum >= target) return;
    for (const n of neighbours(cell)) {
      if (used.has(n)) continue;
      const value = board[n]!;
      if (sum + value > target) continue;
      used.add(n);
      walk(n, sum + value, length + 1);
      used.delete(n);
    }
  };
  for (let cell = 0; cell < SH_CELLS && count < limit * 2; cell++) {
    used.add(cell);
    walk(cell, board[cell]!, 1);
    used.delete(cell);
  }
  return Math.floor(count / 2);
}

function reshuffleIfStuck(state: SumHuntState, target: number): SumHuntState {
  if (countValidPaths(state.board, target, 1) > 0) return state;
  let board = [...state.board];
  let rng = state.rng;
  for (let attempt = 0; attempt < 100; attempt++) {
    for (let i = board.length - 1; i > 0; i--) {
      const r = step(rng);
      rng = r.state;
      const j = Math.floor(r.value * (i + 1));
      [board[i], board[j]] = [board[j]!, board[i]!];
    }
    if (countValidPaths(board, target, 1) > 0) break;
    if (attempt > 0 && attempt % 30 === 0) {
      // Still stuck: redraw from the deterministic PRNG and keep searching.
      board = board.map(() => {
        const d = digit(rng);
        rng = d.state;
        return d.value;
      });
    }
  }
  return { ...state, board, rng, reshuffles: state.reshuffles + 1 };
}

export function initSumHunt(seed: number, target: number): SumHuntState {
  const cols = Array.from({ length: SH_SIZE }, (_, c) => (seed ^ Math.imul(c + 1, 0x9e3779b1)) | 0);
  const board = Array.from({ length: SH_CELLS }, () => 0);
  for (let c = 0; c < SH_SIZE; c++) {
    for (let r = SH_SIZE - 1; r >= 0; r--) {
      const d = digit(cols[c]!);
      cols[c] = d.state;
      board[r * SH_SIZE + c] = d.value;
    }
  }
  return reshuffleIfStuck(
    { board, cols, rng: (seed ^ 0x51ed270b) | 0, stage: 1, paths: 0, reshuffles: 0, target },
    target,
  );
}

export function pathSum(board: number[], path: number[]): number {
  return path.reduce((sum, cell) => sum + (board[cell] ?? 0), 0);
}

export function pathShapeValid(path: number[]): boolean {
  if (path.length < 2 || new Set(path).size !== path.length) return false;
  return path.every((cell, i) => cell >= 0 && cell < SH_CELLS && (i === 0 || neighbours(path[i - 1]!).includes(cell)));
}

/** Clears a correct path, drops digits, fills from the column queues. Null if the path doesn't count. */
export function applySumPath(state: SumHuntState, target: number, path: number[], seed: number): SumHuntState | null {
  if (state.stage > SH_STAGES || target !== state.target || !pathShapeValid(path) || pathSum(state.board, path) !== target) return null;
  if (state.stage === SH_STAGES) {
    return path.length === SH_CELLS ? { ...state, board: Array(SH_CELLS).fill(0), stage: SH_STAGES + 1, paths: state.paths + 1 } : null;
  }
  const cleared = new Set(path);
  const board = [...state.board];
  const cols = [...state.cols];
  for (let c = 0; c < SH_SIZE; c++) {
    const kept: number[] = [];
    for (let r = SH_SIZE - 1; r >= 0; r--) {
      const index = r * SH_SIZE + c;
      if (!cleared.has(index)) kept.push(state.board[index]!);
    }
    for (let r = SH_SIZE - 1, k = 0; r >= 0; r--, k++) {
      if (k < kept.length) board[r * SH_SIZE + c] = kept[k]!;
      else {
        const d = digit(cols[c]!);
        cols[c] = d.state;
        board[r * SH_SIZE + c] = d.value;
      }
    }
  }
  const nextStage = state.stage + 1;
  const nextTarget = nextStage === SH_STAGES
    ? board.reduce((sum, digit) => sum + digit, 0)
    : sumHuntTargets(seed)[nextStage - 1]!;
  const next = {
    ...state,
    board,
    cols,
    paths: state.paths + 1,
    stage: nextStage,
    target: nextTarget,
  };
  // On the last stage a full-grid snake always exists; reshuffling would change the displayed total.
  if (nextStage === SH_STAGES) return next;
  return reshuffleIfStuck(
    next,
    nextTarget,
  );
}

export function encodeSumPaths(paths: number[][]): string {
  return paths.map((p) => p.join(".")).join(";");
}

export function decodeSumPaths(raw: string): number[][] {
  if (typeof raw !== "string" || !raw) return [];
  return raw
    .split(";")
    .slice(0, 300)
    .map((p) => p.split(".").slice(0, SH_CELLS).map((v) => Number.parseInt(v, 10)))
    .filter((p) => p.every(Number.isInteger));
}

export function replaySumHunt(seed: number, target: number, paths: number[][]): SumHuntState {
  let state = initSumHunt(seed, sumHuntTargets(seed)[0] ?? target);
  for (const path of paths) state = applySumPath(state, state.target, path, seed) ?? state;
  return state;
}

export function sumHuntText(state: SumHuntState): string {
  return state.stage > SH_STAGES ? "Cleared the grid" : `Stage ${state.stage} of ${SH_STAGES} · ${state.paths} paths`;
}
