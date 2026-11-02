/**
 * Golf Solitaire's strong human line (the bank's filter; scripts only): what a careful player who can't see the stock
 * does. Each turn it plays the exposed card that starts the longest chain of plays in view (look-ahead `depth` cards over
 * the columns, ties to the taller column), and draws only when nothing plays. Returns its taps and whether it cleared.
 */
import { GS_CARDS, GS_COLS, GS_STOCK_PILE, gsApply, gsPlayable, type GsState } from "../../src/lib/arcade/cards/golfSol";

function chain(s: GsState, depth: number): number {
  if (depth === 0) return 0;
  let best = 0;
  for (let c = 0; c < GS_COLS; c++) {
    if (!gsPlayable(s, c)) continue;
    best = Math.max(best, 1 + chain(gsApply(s, c)!, depth - 1));
    if (best >= depth) break;
  }
  return best;
}

export function gsHumanLine(start: GsState, depth = 6): { taps: number[]; cleared: boolean } {
  let s = start;
  const taps: number[] = [];
  for (let guard = 0; guard < 200; guard++) {
    if (s.cleared === GS_CARDS) break;
    let pick = -1;
    let best = -1;
    for (let c = 0; c < GS_COLS; c++) {
      if (!gsPlayable(s, c)) continue;
      const v = (1 + chain(gsApply(s, c)!, depth - 1)) * 10 + s.heights[c]!;
      if (v > best) {
        best = v;
        pick = c;
      }
    }
    const next = gsApply(s, pick >= 0 ? pick : GS_STOCK_PILE);
    if (!next) break;
    taps.push(pick >= 0 ? pick : GS_STOCK_PILE);
    s = next;
  }
  return { taps, cleared: s.cleared === GS_CARDS };
}
