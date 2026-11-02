/**
 * Golf Solitaire's solver (checks, the bank builder and bots; never shipped): a depth-first search for a line that
 * clears all 35 tableau cards with at least `minRuns` runs of five (so perfect play reaches 200). Plays are tried before
 * drawing, longer reachable chains first; positions already seen are skipped. Returns the taps the phone sends (a
 * column, or GS_STOCK_PILE), or null when no line is found within the node budget.
 */
import { rankOf } from "../../src/lib/arcade/cards/cards";
import { GS_CARDS, GS_COLS, GS_DEPTH, GS_RUN_LEN, GS_STOCK, GS_STOCK_PILE, type GsState } from "../../src/lib/arcade/cards/golfSol";

export function gsSolve(state: GsState, minRuns = 5, budget = 300_000): number[] | null {
  const ranks = state.tab.map((c) => rankOf(c));
  const stock = state.stock.map((c) => rankOf(c));
  const seen = new Set<number>();
  let nodes = 0;
  const taps: number[] = [];
  const h = state.heights.slice();

  function dfs(stockPos: number, top: number, run: number, runs: number, cleared: number): boolean {
    if (cleared === GS_CARDS) return runs >= minRuns;
    if (++nodes > budget) return false;
    // Runs still possible: one per draw left plus the current, each needing five cards.
    const draws = GS_STOCK - stockPos;
    const cardsLeft = GS_CARDS - cleared;
    const maxMore = Math.min(draws + (run < GS_RUN_LEN ? 1 : 0), Math.floor((cardsLeft + (run < GS_RUN_LEN ? run : 0)) / GS_RUN_LEN));
    if (runs + maxMore < minRuns) return false;
    let key = 0;
    for (let c = 0; c < GS_COLS; c++) key = key * 6 + h[c]!;
    key = ((key * 17 + stockPos) * 14 + top) * 6 + Math.min(run, GS_RUN_LEN);
    key = key * 6 + Math.min(runs, minRuns);
    if (seen.has(key)) return false;
    seen.add(key);
    for (let c = 0; c < GS_COLS; c++) {
      if (h[c]! === 0) continue;
      const r = ranks[c * GS_DEPTH + h[c]! - 1]!;
      if (Math.abs(r - top) !== 1) continue;
      h[c]!--;
      taps.push(c);
      const nr = run + 1;
      if (dfs(stockPos, r, nr, runs + (nr === GS_RUN_LEN ? 1 : 0), cleared + 1)) return true;
      taps.pop();
      h[c]!++;
    }
    if (stockPos < GS_STOCK) {
      taps.push(GS_STOCK_PILE);
      if (dfs(stockPos + 1, stock[stockPos]!, 0, runs, cleared)) return true;
      taps.pop();
    }
    return false;
  }

  return dfs(state.stockPos, rankOf(state.top), state.run, state.runs, state.cleared) ? taps.slice() : null;
}
