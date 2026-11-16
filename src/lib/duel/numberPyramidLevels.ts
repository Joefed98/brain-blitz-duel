/**
 * Integer Pyramid's levels (stage 3 of the Number overhaul, 15 Nov 2026; docs/number-overhaul.md "Stage 3"). Shared and
 * pure: the level bank's builder, its check and the server read the same rules. Normal is today's game (no level, the
 * NUMBER_PYRAMID_BANK draw, untouched); Easy, Hard and Expert deal from their own proved banks
 * (numberPyramidLevelsBank.server.ts, built by scripts/number-pyramid-levels-bank.ts).
 *
 * The settings are the registry's (src/lib/levels/gameLevels.ts, plain data): four rising stages (rows, empty stones
 * and the bottom row's values) and the tray's decoys.
 */
import { npCells, npIndex } from "./numberPyramid";

export interface NpLevelStage {
  rows: 4 | 5 | 6;
  minEmpty: number;
  maxEmpty: number;
  bottomLo: number;
  bottomHi: number;
}

export interface NpLevelSettings {
  stages: readonly NpLevelStage[];
  decoys: number;
}

type Rule = readonly [number, number, number];

function rulesFor(rows: number): Rule[] {
  const out: Rule[] = [];
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c <= r; c++) out.push([npIndex(r, c), npIndex(r + 1, c), npIndex(r + 1, c + 1)]);
  return out;
}

/**
 * The number of tray assignments (up to `cap`) that make the board true: every empty stone takes one tray tile, decoys
 * left over. The same answer as npCountSolutions, found by choosing the bottom row left to right (every stone above is
 * then worked out and must match its given or take a tile still in the tray), so a six-row board is proved in
 * milliseconds.
 */
export function npCountSolutionsFast(givens: readonly (number | null)[], tray: readonly number[], rows: number, cap = 2): number {
  const counts = new Map<number, number>();
  for (const t of tray) counts.set(t, (counts.get(t) ?? 0) + 1);
  const v: (number | null)[] = new Array(npCells(rows)).fill(null);
  let found = 0;
  const take = (cell: number, value: number): boolean => {
    const g = givens[cell];
    if (g != null) return g === value;
    const n = counts.get(value) ?? 0;
    if (n <= 0) return false;
    counts.set(value, n - 1);
    return true;
  };
  const give = (cell: number, value: number) => {
    if (givens[cell] == null) counts.set(value, (counts.get(value) ?? 0) + 1);
  };
  const walk = (k: number) => {
    if (found >= cap) return;
    if (k === rows) { found++; return; }
    const bottom = npIndex(rows - 1, k);
    const options = givens[bottom] != null ? [givens[bottom]!] : [...counts.entries()].filter(([, n]) => n > 0).map(([value]) => value);
    for (const b of options) {
      if (!take(bottom, b)) continue;
      v[bottom] = b;
      // The new diagonal above: row r's stone at column k - (rows - 1 - r).
      const placed: number[] = [];
      let ok = true;
      for (let r = rows - 2; r >= 0; r--) {
        const c = k - (rows - 1 - r);
        if (c < 0) break;
        const cell = npIndex(r, c);
        const value = v[npIndex(r + 1, c)]! + v[npIndex(r + 1, c + 1)]!;
        if (!take(cell, value)) { ok = false; break; }
        v[cell] = value;
        placed.push(cell);
      }
      if (ok) walk(k + 1);
      for (const cell of placed) { give(cell, v[cell]!); v[cell] = null; }
      give(bottom, b);
      v[bottom] = null;
      if (found >= cap) return;
    }
  };
  walk(0);
  return found;
}

/** One step a person can take from the screen alone. */
export type NpPersonStep = { cell: number; value: number; why: "sum" | "only-tile" };

/**
 * The person-like solver (Joe's rule for Expert, 15 Nov 2026): it fills a stone only when the screen forces it,
 * never guessing:
 *  - "sum": a stone and the two under it with two of the three known (given or already filled): the third is their sum
 *    or difference, and that tile is in the tray;
 *  - "only-tile": exactly one tile left in the tray fits the stone: bigger than every known stone under it, smaller
 *    than every known stone over it, and, where a sum's other stone is still empty, leaving that stone a tile that is
 *    still in the tray (the check a person makes in their head: "if this were 5 the other would be 8, and there's no 8").
 * Returns the steps taken and whether the board was completed (and matches `solution` when given).
 */
export function npPersonSolve(
  givens: readonly (number | null)[],
  tray: readonly number[],
  rows: number,
  solution?: readonly number[],
): { solved: boolean; steps: NpPersonStep[] } {
  const v = [...givens];
  const counts = new Map<number, number>();
  for (const t of tray) counts.set(t, (counts.get(t) ?? 0) + 1);
  const rules = rulesFor(rows);
  const steps: NpPersonStep[] = [];
  const has = (value: number) => (counts.get(value) ?? 0) > 0;
  const place = (cell: number, value: number, why: NpPersonStep["why"]) => {
    v[cell] = value;
    counts.set(value, (counts.get(value) ?? 0) - 1);
    steps.push({ cell, value, why });
  };
  for (;;) {
    if (v.every((x) => x != null)) break;
    let moved = false;
    // Sums first: the deduction a person reaches for.
    for (const [a, b, c] of rules) {
      const known = [a, b, c].filter((x) => v[x] != null).length;
      if (known !== 2) continue;
      const cell = [a, b, c].find((x) => v[x] == null)!;
      const value = cell === a ? v[b]! + v[c]! : cell === b ? v[a]! - v[c]! : v[a]! - v[b]!;
      if (value < 1 || !has(value)) return { solved: false, steps };
      place(cell, value, "sum");
      moved = true;
      break;
    }
    if (moved) continue;
    // Then a stone only one tile fits.
    for (let cell = 0; cell < v.length && !moved; cell++) {
      if (v[cell] != null) continue;
      const fits = [...counts.entries()].filter(([value, n]) => n > 0 && rules.every(([a, b, c]) => {
        if (a === cell) {
          if (v[b] != null && value <= v[b]!) return false;
          if (v[c] != null && value <= v[c]!) return false;
          const other = v[b] != null ? c : v[c] != null ? b : -1;
          if (other >= 0 && v[other] == null && !has(value - v[other === b ? c : b]!)) return false;
          return true;
        }
        if (b === cell || c === cell) {
          const sib = b === cell ? c : b;
          if (v[a] != null && value >= v[a]!) return false;
          if (v[a] != null && v[sib] == null) {
            const need = v[a]! - value;
            if (need < 1 || !(need === value ? (counts.get(value) ?? 0) > 1 : has(need))) return false;
          }
          if (v[a] == null && v[sib] != null && !has(value + v[sib]!)) return false;
          return true;
        }
        return true;
      }));
      if (fits.length === 1) {
        place(cell, fits[0]![0], "only-tile");
        moved = true;
      }
    }
    if (!moved) return { solved: false, steps };
  }
  const solved = v.every((x, i) => x != null && (solution ? x === solution[i] : true));
  return { solved, steps };
}
