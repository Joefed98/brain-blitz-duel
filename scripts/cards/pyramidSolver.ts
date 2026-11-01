/**
 * Pyramid's solver (checks, the bank builder and bots; never shipped): a depth-first search over removals and stock
 * turns for a line that removes all 28 pyramid cards with at least `minPp` pairs made of two pyramid cards (so perfect
 * play reaches 200). Kings are removed as soon as they are free (never a loss); pairs are tried pyramid–pyramid first,
 * then with the waste, then the stock is drawn or turned. Returns the taps the phone sends (a pyramid index,
 * PY_STOCK_PILE or PY_WASTE_PILE), or null when no line is found within the node budget.
 */
import { rankOf } from "../../src/lib/arcade/cards/cards";
import { PY_CARDS, PY_PASSES, PY_STOCK_PILE, PY_WASTE_PILE, pyCoveredBy, type PyState } from "../../src/lib/arcade/cards/pyramid";

const COVERS = Array.from({ length: PY_CARDS }, (_, i) => pyCoveredBy(i));

export function pySolve(state: PyState, minPp = 10, budget = 400_000): number[] | null {
  const ranks = state.tab.map((c) => rankOf(c));
  const seen = new Set<string>();
  let nodes = 0;
  const taps: number[] = [];

  const free = (mask: number, i: number) => {
    if ((mask >>> i) & 1) return false;
    for (const c of COVERS[i]!) if (!((mask >>> c) & 1)) return false;
    return true;
  };

  function dfs(mask: number, pile: number[], pos: number, pass: number, pp: number, removed: number): boolean {
    if (++nodes > budget) return false;
    // Kings first: free pyramid Kings, then a King on the waste (always safe).
    const undo = taps.length;
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < PY_CARDS; i++)
        if (ranks[i] === 13 && free(mask, i)) {
          mask |= 1 << i;
          removed++;
          taps.push(i);
          changed = true;
        }
      if (pos > 0 && rankOf(pile[pos - 1]!) === 13) {
        pile = pile.slice();
        pile.splice(pos - 1, 1);
        pos--;
        taps.push(PY_WASTE_PILE);
        changed = true;
      }
    }
    if (removed === PY_CARDS) {
      if (pp >= minPp) return true;
      taps.length = undo;
      return false;
    }
    // Not enough pyramid cards left to pair for the pairs part.
    let left = 0;
    for (let i = 0; i < PY_CARDS; i++) if (!((mask >>> i) & 1) && ranks[i] !== 13) left++;
    if (pp + (left >> 1) < minPp) {
      taps.length = undo;
      return false;
    }
    const key = `${mask},${pos},${pass},${pp},${pile.join(".")}`;
    if (seen.has(key)) {
      taps.length = undo;
      return false;
    }
    seen.add(key);
    const fr: number[] = [];
    for (let i = 0; i < PY_CARDS; i++) if (free(mask, i)) fr.push(i);
    for (let x = 0; x < fr.length; x++)
      for (let y = x + 1; y < fr.length; y++) {
        const a = fr[x]!;
        const b = fr[y]!;
        if (ranks[a]! + ranks[b]! !== 13) continue;
        taps.push(a, b);
        if (dfs(mask | (1 << a) | (1 << b), pile, pos, pass, pp + 1, removed + 2)) return true;
        taps.length -= 2;
      }
    if (pos > 0) {
      const w = rankOf(pile[pos - 1]!);
      for (const a of fr) {
        if (ranks[a]! + w !== 13) continue;
        const np = pile.slice();
        np.splice(pos - 1, 1);
        taps.push(a, PY_WASTE_PILE);
        if (dfs(mask | (1 << a), np, pos - 1, pass, pp, removed + 1)) return true;
        taps.length -= 2;
      }
    }
    if (pos < pile.length) {
      taps.push(PY_STOCK_PILE);
      if (dfs(mask, pile, pos + 1, pass, pp, removed)) return true;
      taps.length--;
    } else if (pass < PY_PASSES && pile.length > 0) {
      taps.push(PY_STOCK_PILE);
      if (dfs(mask, pile, 0, pass + 1, pp, removed)) return true;
      taps.length--;
    }
    taps.length = undo;
    return false;
  }

  let mask = 0;
  for (let i = 0; i < PY_CARDS; i++) if (state.gone[i]) mask |= 1 << i;
  return dfs(mask, state.pile.slice(), state.pos, state.pass, state.ppPairs, state.removed) ? taps.slice() : null;
}
