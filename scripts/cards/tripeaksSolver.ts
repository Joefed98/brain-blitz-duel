/**
 * TriPeaks' bank solver (scripts/tripeaks-bank.ts, the checks and the bots): a depth-first search over the sim's own
 * rules (tpApply in src/lib/arcade/cards/tripeaks.ts) for a line that clears all 28 cards with a run of at least
 * `minRun` (10: the longest-run part's full figure). A move is a tap: a peak card's index or TP_STOCK_PILE.
 */
import { TP_CARDS, TP_STOCK_PILE, tpApply, tpPlayable, type TpState } from "../../src/lib/arcade/cards/tripeaks";

export function tpSolve(start: TpState, minRun = 10, limit = 2_000_000, maxTurns = Infinity): number[] | null {
  const dead = new Set<string>();
  const path: number[] = [];
  let visited = 0;
  const key = (s: TpState) => `${s.cleared.join("")}:${s.stockPos}:${s.top}:${Math.min(s.run, minRun)}:${s.bestRun >= minRun ? 1 : 0}`;
  const dfs = (s: TpState): boolean => {
    if (s.clearedCount === TP_CARDS) return s.bestRun >= minRun;
    if (++visited > limit) return false;
    const k = key(s);
    if (dead.has(k)) return false;
    // Plays first (lower rows last: tops and inner cards open the board), then the stock.
    const plays: number[] = [];
    for (let i = 0; i < TP_CARDS; i++) if (tpPlayable(s, i)) plays.push(i);
    for (const i of plays) {
      const next = tpApply(s, i)!;
      path.push(i);
      if (dfs(next)) return true;
      path.pop();
    }
    const turned = s.turns < maxTurns ? tpApply(s, TP_STOCK_PILE) : null;
    if (turned) {
      path.push(TP_STOCK_PILE);
      if (dfs(turned)) return true;
      path.pop();
    }
    dead.add(k);
    return false;
  };
  return dfs(start) ? path.slice() : null;
}

/**
 * The fewest stock turns any clearing line with a run of `minRun` needs (Summit's stock par, tripeaksRev 2) and that
 * line: the search above with the stock capped, the cap raised one turn at a time from 0. Null when none is found.
 */
export function tpFewestTurns(start: TpState, minRun = 10, limit = 2_000_000): { turns: number; line: number[] } | null {
  for (let cap = 0; cap <= 23; cap++) {
    const line = tpSolve(start, minRun, limit, cap);
    if (line) return { turns: line.filter((t) => t === TP_STOCK_PILE).length, line };
  }
  return null;
}
