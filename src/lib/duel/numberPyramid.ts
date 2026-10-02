/**
 * Number Pyramid — shared rules for the phone, the grader and the bank script.
 *
 * Cells are numbered top to bottom, left to right: row r (0–4) holds r+1 cells
 * starting at index r(r+1)/2. Every cell above the bottom row is the sum of the
 * two cells directly below it. The answer is a list of (cell, tray index)
 * placements; the server reads tile values from the stored tray itself.
 */

export const NP_ROWS = 5;
export const NP_CELLS = (NP_ROWS * (NP_ROWS + 1)) / 2;
export const NP_DECOYS = 2;
export const NP_MIN_EMPTY = 6;
export const NP_MAX_EMPTY = 9;

export function npIndex(row: number, col: number): number {
  return (row * (row + 1)) / 2 + col;
}

export function npRowOf(cell: number): { row: number; col: number } {
  let row = 0;
  while (npIndex(row + 1, 0) <= cell) row++;
  return { row, col: cell - npIndex(row, 0) };
}

/** Every sum rule as [above, below-left, below-right]. */
export const NP_RULES: readonly (readonly [number, number, number])[] = (() => {
  const out: [number, number, number][] = [];
  for (let r = 0; r < NP_ROWS - 1; r++)
    for (let c = 0; c <= r; c++) out.push([npIndex(r, c), npIndex(r + 1, c), npIndex(r + 1, c + 1)]);
  return out;
})();

export function npBuild(bottom: readonly number[]): number[] {
  const v = new Array<number>(NP_CELLS).fill(0);
  for (let c = 0; c < NP_ROWS; c++) v[npIndex(NP_ROWS - 1, c)] = bottom[c]!;
  for (let r = NP_ROWS - 2; r >= 0; r--)
    for (let c = 0; c <= r; c++) v[npIndex(r, c)] = v[npIndex(r + 1, c)]! + v[npIndex(r + 1, c + 1)]!;
  return v;
}

/** True when every sum rule holds on a fully known pyramid. */
export function npRulesHold(values: readonly (number | null)[]): boolean {
  return NP_RULES.every(([a, b, c]) => values[a] != null && values[a] === values[b]! + values[c]!);
}

/**
 * Counts distinct value fillings of the empty cells using tiles from the tray
 * (each tile at most once) that satisfy every sum rule. Stops at `cap`.
 */
export function npCountSolutions(givens: readonly (number | null)[], tray: readonly number[], cap = 2): number {
  const empties: number[] = [];
  // Bottom rows first so rules close early.
  for (let r = NP_ROWS - 1; r >= 0; r--) for (let c = 0; c <= r; c++) if (givens[npIndex(r, c)] == null) empties.push(npIndex(r, c));
  const counts = new Map<number, number>();
  for (const t of tray) counts.set(t, (counts.get(t) ?? 0) + 1);
  const values = [...givens];
  const rulesOf = new Map<number, (readonly [number, number, number])[]>();
  for (const rule of NP_RULES) for (const cell of rule) rulesOf.set(cell, [...(rulesOf.get(cell) ?? []), rule]);
  let found = 0;
  const ok = (cell: number) =>
    (rulesOf.get(cell) ?? []).every(([a, b, c]) => values[a] == null || values[b] == null || values[c] == null || values[a] === values[b]! + values[c]!);
  const walk = (i: number) => {
    if (found >= cap) return;
    if (i === empties.length) {
      found++;
      return;
    }
    const cell = empties[i]!;
    for (const [value, n] of counts) {
      if (n <= 0) continue;
      values[cell] = value;
      if (ok(cell)) {
        counts.set(value, n - 1);
        walk(i + 1);
        counts.set(value, n);
      }
      values[cell] = null;
      if (found >= cap) return;
    }
  };
  walk(0);
  return found;
}

export type NpPlacements = Record<number, number>;

/** "cell:tray,cell:tray" */
export function npEncode(placements: NpPlacements): string {
  return Object.entries(placements)
    .map(([cell, tray]) => `${cell}:${tray}`)
    .join(",");
}

/** Decodes and sanitises: empty cells only, real tray indices, each tile once. */
export function npDecode(raw: string, givens: readonly (number | null)[], trayLength: number): NpPlacements {
  const out: NpPlacements = {};
  const used = new Set<number>();
  for (const part of String(raw ?? "").split(",").slice(0, NP_CELLS)) {
    const [a, b] = part.split(":").map((x) => Number.parseInt(x, 10));
    if (!Number.isInteger(a) || !Number.isInteger(b)) continue;
    if (a! < 0 || a! >= NP_CELLS || givens[a!] != null || b! < 0 || b! >= trayLength) continue;
    if (used.has(b!) || out[a!] !== undefined) continue;
    used.add(b!);
    out[a!] = b!;
  }
  return out;
}

/** The pyramid as the player has it filled: givens plus placed tile values. */
export function npFilled(givens: readonly (number | null)[], tray: readonly number[], placements: NpPlacements): (number | null)[] {
  return givens.map((g, cell) => (g != null ? g : placements[cell] !== undefined ? tray[placements[cell]!]! : null));
}

export function npComplete(givens: readonly (number | null)[], tray: readonly number[], placements: NpPlacements): boolean {
  const filled = npFilled(givens, tray, placements);
  return filled.every((v) => v != null) && npRulesHold(filled);
}

/** Complete: 100 + time bonus up to 50. Otherwise 60 × share of empty cells placed correctly. */
export function scoreNumberPyramid(complete: boolean, msRemaining: number, timeLimitMs: number, correct: number, empties: number): number {
  if (complete) {
    const ms = Math.max(0, Math.min(msRemaining, timeLimitMs));
    return Math.min(150, 100 + Math.round((50 * ms) / timeLimitMs));
  }
  if (empties <= 0) return 0;
  return Math.round((60 * Math.max(0, Math.min(correct, empties))) / empties);
}
