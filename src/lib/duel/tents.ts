/**
 * Tents and Trees rules, shared by the phone (live feedback, auto-lock) and the
 * server (grading, generation). A layout is valid when every row and column
 * count matches, no tent sits on a tree, no two tents touch (diagonals too) and
 * the tents can be paired one-to-one with orthogonally adjacent trees.
 */

export const TENTS_SIZE = 8;
export const TENTS_CELLS = TENTS_SIZE * TENTS_SIZE;

export function tentsRowCol(cell: number, size = TENTS_SIZE): { r: number; c: number } {
  return { r: Math.floor(cell / size), c: cell % size };
}

export function orthNeighbours(cell: number, size = TENTS_SIZE): number[] {
  const { r, c } = tentsRowCol(cell, size);
  const out: number[] = [];
  if (r > 0) out.push(cell - size);
  if (r < size - 1) out.push(cell + size);
  if (c > 0) out.push(cell - 1);
  if (c < size - 1) out.push(cell + 1);
  return out;
}

export function tentsTouch(a: number, b: number, size = TENTS_SIZE): boolean {
  if (a === b) return false;
  const p = tentsRowCol(a, size);
  const q = tentsRowCol(b, size);
  return Math.abs(p.r - q.r) <= 1 && Math.abs(p.c - q.c) <= 1;
}

export function encodeTents(tents: readonly number[]): string {
  return [...new Set(tents)].sort((a, b) => a - b).join(",");
}

export function decodeTents(raw: string, size = TENTS_SIZE): number[] {
  const cells = String(raw ?? "")
    .split(",")
    .map((part) => Number.parseInt(part, 10))
    .filter((cell) => Number.isInteger(cell) && cell >= 0 && cell < size * size);
  return [...new Set(cells)].slice(0, size * size);
}

/** True when every tent can be paired with its own orthogonally adjacent tree. */
export function tentsMatchTrees(
  trees: readonly number[],
  tents: readonly number[],
  size = TENTS_SIZE,
): boolean {
  if (trees.length !== tents.length) return false;
  const treeIndex = new Map(trees.map((cell, index) => [cell, index]));
  const options = tents.map((tent) =>
    orthNeighbours(tent, size)
      .map((cell) => treeIndex.get(cell))
      .filter((index): index is number => index !== undefined),
  );
  const owner = new Array<number>(trees.length).fill(-1);
  const augment = (tent: number, seen: boolean[]): boolean => {
    for (const tree of options[tent]!) {
      if (seen[tree]) continue;
      seen[tree] = true;
      if (owner[tree] === -1 || augment(owner[tree]!, seen)) {
        owner[tree] = tent;
        return true;
      }
    }
    return false;
  };
  for (let tent = 0; tent < tents.length; tent++) {
    if (!augment(tent, new Array<boolean>(trees.length).fill(false))) return false;
  }
  return true;
}

export function lineCounts(tents: readonly number[], size = TENTS_SIZE) {
  const rows = new Array<number>(size).fill(0);
  const cols = new Array<number>(size).fill(0);
  for (const tent of tents) {
    const { r, c } = tentsRowCol(tent, size);
    rows[r]! += 1;
    cols[c]! += 1;
  }
  return { rows, cols };
}

export interface TentsBoard {
  size: number;
  trees: readonly number[];
  rowCounts: readonly number[];
  colCounts: readonly number[];
}

export function tentsLayoutValid(board: TentsBoard, tents: readonly number[]): boolean {
  const { size, trees } = board;
  const treeSet = new Set(trees);
  if (tents.length !== trees.length) return false;
  if (tents.some((tent) => treeSet.has(tent))) return false;
  for (let i = 0; i < tents.length; i++) {
    for (let j = i + 1; j < tents.length; j++) {
      if (tentsTouch(tents[i]!, tents[j]!, size)) return false;
    }
  }
  const { rows, cols } = lineCounts(tents, size);
  for (let i = 0; i < size; i++) {
    if ((board.rowCounts[i] ?? -1) >= 0 && rows[i] !== board.rowCounts[i]) return false;
    if ((board.colCounts[i] ?? -1) >= 0 && cols[i] !== board.colCounts[i]) return false;
  }
  return tentsMatchTrees(trees, tents, size);
}

/** Counts valid layouts up to `limit` by backtracking over tree-adjacent cells. */
export function countTentSolutions(board: TentsBoard, limit = 2): number {
  const { size, trees, rowCounts, colCounts } = board;
  const treeSet = new Set(trees);
  const candidateSet = new Set<number>();
  for (const tree of trees) {
    for (const cell of orthNeighbours(tree, size)) if (!treeSet.has(cell)) candidateSet.add(cell);
  }
  const candidates = [...candidateSet].sort((a, b) => a - b);
  const rowLeft = new Array<number>(size).fill(0);
  const colLeft = new Array<number>(size).fill(0);
  for (const cell of candidates) {
    const { r, c } = tentsRowCol(cell, size);
    rowLeft[r]! += 1;
    colLeft[c]! += 1;
  }
  const rowUsed = new Array<number>(size).fill(0);
  const colUsed = new Array<number>(size).fill(0);
  const chosen: number[] = [];
  let found = 0;

  const walk = (index: number): void => {
    if (found >= limit) return;
    if (index === candidates.length) {
      for (let i = 0; i < size; i++) {
        if ((rowCounts[i] ?? -1) >= 0 && rowUsed[i] !== rowCounts[i]) return;
        if ((colCounts[i] ?? -1) >= 0 && colUsed[i] !== colCounts[i]) return;
      }
      if (tentsMatchTrees(trees, chosen, size)) found += 1;
      return;
    }
    const cell = candidates[index]!;
    const { r, c } = tentsRowCol(cell, size);
    rowLeft[r]! -= 1;
    colLeft[c]! -= 1;
    // Place a tent here.
    if (
      ((rowCounts[r] ?? -1) < 0 || rowUsed[r]! < rowCounts[r]!) &&
      ((colCounts[c] ?? -1) < 0 || colUsed[c]! < colCounts[c]!) &&
      !chosen.some((tent) => tentsTouch(tent, cell, size))
    ) {
      rowUsed[r]! += 1;
      colUsed[c]! += 1;
      chosen.push(cell);
      walk(index + 1);
      chosen.pop();
      rowUsed[r]! -= 1;
      colUsed[c]! -= 1;
    }
    // Leave it empty — only if the line can still reach its count.
    if (
      ((rowCounts[r] ?? -1) < 0 || rowUsed[r]! + rowLeft[r]! >= rowCounts[r]!) &&
      ((colCounts[c] ?? -1) < 0 || colUsed[c]! + colLeft[c]! >= colCounts[c]!)
    ) {
      walk(index + 1);
    }
    rowLeft[r]! += 1;
    colLeft[c]! += 1;
  };
  walk(0);
  return found;
}

/** Solved = 100 + time bonus; otherwise 70 × right ÷ trees − 5 per wrong tent. */
export function scoreTents(
  solved: boolean,
  msRemaining: number,
  timeLimitMs: number,
  correct: number,
  wrong: number,
  trees: number,
): number {
  if (solved) {
    return Math.min(150, 100 + Math.round((50 * Math.max(0, msRemaining)) / timeLimitMs));
  }
  if (trees <= 0) return 0;
  return Math.max(0, Math.round((70 * correct) / trees) - 5 * wrong);
}
