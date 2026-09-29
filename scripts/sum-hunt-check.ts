import {
  applySumPath,
  countValidPaths,
  initSumHunt,
  SH_STAGES,
  SH_TWO_DIGIT_CELLS,
  sumHuntBoard,
  sumHuntTargets,
} from "../src/lib/duel/sumHunt";

function fail(message: string): never {
  throw new Error(message);
}

function neighbours(cell: number): number[] {
  const row = Math.floor(cell / 5);
  const col = cell % 5;
  return [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
    .filter(([r, c]) => r !== undefined && c !== undefined && r >= 0 && r < 5 && c >= 0 && c < 5)
    .map(([r, c]) => (r ?? 0) * 5 + (c ?? 0));
}

function findPath(board: number[], target: number): number[] | null {
  const walk = (cell: number, sum: number, path: number[]): number[] | null => {
    if (sum === target && path.length >= 2) return path;
    if (sum >= target || path.length >= 6) return null;
    for (const next of neighbours(cell)) {
      if (path.includes(next)) continue;
      const found = walk(next, sum + (board[next] ?? 0), [...path, next]);
      if (found) return found;
    }
    return null;
  };
  for (let cell = 0; cell < board.length; cell++) {
    const found = walk(cell, board[cell] ?? 0, [cell]);
    if (found) return found;
  }
  return null;
}

for (let seed = 1; seed <= 40; seed++) {
  const targets = sumHuntTargets(seed);
  if (targets.length !== SH_STAGES - 1 || targets[0]! < 20 || targets[0]! > 25) fail(`targets ${seed}`);
  let state = initSumHunt(seed, targets[0]!);
  for (let stage = 1; stage < SH_STAGES; stage++) {
    const board = sumHuntBoard(seed, stage, targets[stage - 1]!);
    const count = countValidPaths(board, targets[stage - 1]!, 4);
    if (count < 1 || count > 3) fail(`path count ${seed}/${stage}: ${count}`);
    if (board.filter((value) => value >= 10).length !== SH_TWO_DIGIT_CELLS) fail(`two-digit mix ${seed}/${stage}`);
    const path = findPath(state.board, state.target);
    if (!path) fail(`missing replay path ${seed}/${stage}`);
    state = applySumPath(state, state.target, path, seed) ?? fail(`replay rejected ${seed}/${stage}`);
  }
  const snake = Array.from({ length: 25 }, (_, index) => {
    const row = Math.floor(index / 5);
    const col = index % 5;
    return row * 5 + (row % 2 === 0 ? col : 4 - col);
  });
  state = applySumPath(state, state.target, snake, seed) ?? fail(`final clear ${seed}`);
  if (state.stage !== SH_STAGES + 1) fail(`completion ${seed}`);
}

console.log("Sum Hunt: 40 seeded nine-stage replays passed");