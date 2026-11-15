/**
 * Shikaku's jewel panes (the Logic overhaul, 15 Nov 2026): every rectangle takes one of four colours so that no two
 * rectangles sharing a side ever match. Display only (pure, deterministic: the same rectangles always colour the
 * same way, whatever order they were drawn in).
 */
import type { ShikakuRect } from "@/lib/duel/shikaku";

export const SHIKAKU_JEWELS = ["sapphire", "emerald", "amber", "ruby"] as const;
export type ShikakuJewel = (typeof SHIKAKU_JEWELS)[number];

/** True when two rectangles share part of a side (corners alone don't count). */
export function rectsTouch(a: ShikakuRect, b: ShikakuRect): boolean {
  const rowsOverlap = a.r0 <= b.r1 && b.r0 <= a.r1;
  const colsOverlap = a.c0 <= b.c1 && b.c0 <= a.c1;
  if (rowsOverlap && (a.c1 + 1 === b.c0 || b.c1 + 1 === a.c0)) return true;
  if (colsOverlap && (a.r1 + 1 === b.r0 || b.r1 + 1 === a.r0)) return true;
  return false;
}

/**
 * A colour index (0–3) for each rectangle, in the order given. Rectangles are coloured top-left first with a small
 * backtracking search (planar maps always have a 4-colouring); a map it can't finish within its budget falls back to
 * the least-used colour among neighbours, so the call always returns.
 */
export function shikakuColours(rects: readonly ShikakuRect[]): number[] {
  const n = rects.length;
  const order = rects.map((_, i) => i).sort((i, j) => rects[i]!.r0 - rects[j]!.r0 || rects[i]!.c0 - rects[j]!.c0);
  const nb: number[][] = rects.map(() => []);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rectsTouch(rects[i]!, rects[j]!)) {
    nb[i]!.push(j);
    nb[j]!.push(i);
  }
  const colour = new Array<number>(n).fill(-1);
  let budget = 20_000;
  const solve = (k: number): boolean => {
    if (k === n) return true;
    if (--budget < 0) return false;
    const i = order[k]!;
    for (let c = 0; c < 4; c++) {
      if (nb[i]!.some((j) => colour[j] === c)) continue;
      colour[i] = c;
      if (solve(k + 1)) return true;
    }
    colour[i] = -1;
    return false;
  };
  if (!solve(0)) {
    for (const i of order) {
      if (colour[i]! >= 0) continue;
      const used = [0, 0, 0, 0];
      for (const j of nb[i]!) if (colour[j]! >= 0) used[colour[j]!]!++;
      colour[i] = used.indexOf(Math.min(...used));
    }
  }
  return colour;
}
