/**
 * Pyramid (1 Nov 2026): a player scanning the uncovered cards for pairs adding to 13. Flawless plays the deal's witness
 * (a clear with ten pyramid pairs) at the fastest human pace. Every other level picks as it goes: a pick is valued by what it uncovers, a King
 * first, pairs of two pyramid cards above pairs with the waste, blurred by the level's judgement (searching the deal
 * was tried for elite and near-perfect: its lines turn the stock more and finish later than a quick eye). Slips: now and then a
 * hasty pick, or turning the stock with a pair still showing.
 */
import { PY_CARDS, PY_INPUT_TAP, PY_STOCK_PILE, PY_WASTE_PILE, pyCanDraw, pyDeal, pyFree, pyMoves, type PyState } from "../../../src/lib/arcade/cards/pyramid";
import { driveEvents, type SkillBot } from "../bot";

/**
 * Average thinking time (ms), before the level's thinkScale: spotting a pair adding to 13 among the uncovered cards and
 * the waste (sums take longer to see than TriPeaks' one-away), the second tap of a pair, and a stock turn.
 */
const THINK_MS = 3200;
const SECOND_MS = 450;
const DRAW_MS = 700;

function uncovers(s: PyState, move: number[]): number {
  const gone = s.gone.slice();
  for (const a of move) if (a < PY_CARDS) gone[a] = 1;
  let n = 0;
  for (let j = 0; j < PY_CARDS; j++) if (!s.gone[j] && !pyFree(s, j) && pyFree({ gone }, j)) n++;
  return n;
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  const init = game.init(seed) as PyState;
  const plan: number[] | null = level === "perfect" ? pyDeal(seed).witness.slice() : null;
  const queue: number[] = [];
  let nextAt = human.thinkTicks(THINK_MS * 1.5);
  const { events } = driveEvents<PyState>(game, (s, t) => {
    if (t < nextAt) return null;
    let tap = -1;
    if (queue.length) {
      tap = queue.shift()!;
    } else {
      if (plan && plan.length) tap = plan.shift()!;
      if (tap < 0) {
        const moves = pyMoves(s);
        if (moves.length === 0 || (pyCanDraw(s) && human.slip(0.4))) tap = PY_STOCK_PILE;
        else {
          const values = moves.map((m) => (m.length === 1 ? 6 : m.includes(PY_WASTE_PILE) ? 2 : 3) + uncovers(s, m) * (level === "weak" ? 0.3 : 1));
          const m = moves[human.pick(values)]!;
          tap = m[0]!;
          if (m.length === 2) queue.push(m[1]!);
        }
      }
    }
    nextAt = t + human.thinkTicks(queue.length ? SECOND_MS : tap === PY_STOCK_PILE ? DRAW_MS : THINK_MS);
    return { k: PY_INPUT_TAP, a: tap, b: 0, c: 0, d: 0 };
  }, init);
  return { events };
};
