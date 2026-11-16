/**
 * The Number overhaul's effects (stage 2, 15 Nov 2026): pure, display-only helpers the effects read. Nothing here is
 * used by grading, a stored answer or a clock (number-overhaul-equation-pyramid-check proves no grader imports it).
 */
import type { EquationStage } from "./types";
import { gapSlots } from "./operatorGaps";
import { npIndex } from "./numberPyramid";

/**
 * Operator's running total under the line: the equation worked left to right over its filled prefix, as far as it
 * goes before the first empty gap. Null (blank) when not even one step can be worked out (fewer than two numbers
 * known) or a step can't be (a non-whole result, below 0, or division by 0): the line's own rules.
 */
export function gapRunningTotal(stage: EquationStage, fills: readonly (string | null | undefined)[]): number | null {
  const slots = gapSlots(stage);
  const numberAt = (i: number): number | null => {
    const k = slots.findIndex((s) => s.kind === "number" && s.index === i);
    if (k < 0) return stage.numbers[i] ?? null;
    const f = fills[k];
    return f && /^\d+$/.test(f) ? Number(f) : null;
  };
  const signAt = (i: number): string | null => {
    const k = slots.findIndex((s) => s.kind === "sign" && s.index === i);
    if (k < 0) return stage.signs?.[i] ?? null;
    return fills[k] || null;
  };
  let total = numberAt(0);
  if (total === null) return null;
  let steps = 0;
  for (let i = 0; i < stage.numbers.length - 1; i++) {
    const op = signAt(i);
    const n = numberAt(i + 1);
    if (op === null || n === null) break;
    let next: number;
    if (op === "+") next = total + n;
    else if (op === "-" || op === "−") next = total - n;
    else if (op === "×" || op === "*") next = total * n;
    else if (op === "÷" || op === "/") {
      if (n === 0 || total % n !== 0) return null;
      next = total / n;
    } else return null;
    if (next < 0 || !Number.isInteger(next)) return null;
    total = next;
    steps++;
  }
  return steps > 0 ? total : null;
}

/**
 * Operator's "four right first time": every equation solved with exactly one try (the solving fill). Only with a try
 * limit (gapsRev and the move-limit stamp); `tries` is the count each equation used, `solved` whether it is right.
 */
export function operatorAllFirstTime(tries: readonly number[], solved: readonly boolean[], total: number): boolean {
  if (solved.length < total || tries.length < total) return false;
  for (let i = 0; i < total; i++) if (!solved[i] || tries[i] !== 1) return false;
  return true;
}

/**
 * Integer Pyramid's rows that are full and right: a row with sums under it (every row but the bottom) whose stones are
 * all filled, each the sum of the two below, and that the player had a hand in (a placed stone in the row or the row
 * under it). Returns the row indices, top first.
 */
export function npRowsRight(givens: readonly (number | null)[], values: readonly (number | null)[], rows: number): number[] {
  const out: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    let ok = true;
    let placed = false;
    for (let c = 0; c <= r && ok; c++) {
      const top = npIndex(r, c), left = npIndex(r + 1, c), right = npIndex(r + 1, c + 1);
      const t = values[top], a = values[left], b = values[right];
      if (t == null || a == null || b == null || t !== a + b) ok = false;
      if (givens[top] == null || givens[left] == null || givens[right] == null) placed = true;
    }
    if (ok && placed) out.push(r);
  }
  return out;
}
