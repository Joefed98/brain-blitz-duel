/**
 * Pyramid (1 Nov 2026; one pass through the stock): a player scanning the uncovered cards for pairs adding to 13. The
 * stock is face down, so no level knows what is coming. Flawless plays the deal's witness at the fastest human pace.
 * Every other level picks among the removals open now (a King, two pyramid cards, a pyramid card with the waste) by a
 * look-ahead over the cards it can see: the cards each line removes and the free cards it leaves (more free cards, more
 * chances for the waste's next card), searched 0 (weak: the pair it spots first) to 5 removals deep (elite), blurred by
 * the level's judgement. It draws only when nothing pairs, or on a slip.
 */
import { PY_CARDS, PY_INPUT_TAP, PY_STOCK_PILE, PY_WASTE_PILE, pyApply, pyCanDraw, pyDeal, pyFree, pyMoves, type PyState } from "../../../src/lib/arcade/cards/pyramid";
import type { SkillLevel } from "../human";
import { driveEvents, type SkillBot } from "../bot";

/**
 * Average thinking time (ms), before the level's thinkScale: spotting a pair adding to 13 among the uncovered cards and
 * the waste, the second tap of a pair, and a stock turn.
 */
const THINK_MS = 3200;
const SECOND_MS = 450;
const DRAW_MS = 700;
const DEPTH: Record<SkillLevel, number> = { weak: 0, average: 1, good: 2, great: 3, near: 4, elite: 5, perfect: 5 };

function freeCount(s: PyState): number {
  let n = 0;
  for (let i = 0; i < PY_CARDS; i++) if (pyFree(s, i)) n++;
  return n;
}

function after(s: PyState, move: number[]): PyState | null {
  let t: PyState = { ...s, sel: -1 };
  for (const a of move) {
    const r = pyApply(t, a);
    if (!r) return null;
    t = r.state;
  }
  return t;
}

/** The best visible line from `s`, `depth` removals deep: cards removed plus a little for each free card left. */
function look(s: PyState, depth: number): number {
  if (depth === 0) return 0.3 * freeCount(s);
  let best = 0.3 * freeCount(s);
  for (const m of pyMoves(s)) {
    const t = after(s, m);
    if (t) best = Math.max(best, m.length + look(t, depth - 1));
  }
  return best;
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  const init = game.init(seed) as PyState;
  const plan: number[] | null = level === "perfect" ? pyDeal(seed).witness.slice() : null;
  const depth = DEPTH[level];
  const queue: number[] = [];
  let nextAt = human.thinkTicks(THINK_MS * 1.5);
  const { events } = driveEvents<PyState>(game, (s, t) => {
    if (t < nextAt) return null;
    let tap = -1;
    if (queue.length) tap = queue.shift()!;
    else if (plan) tap = plan.length ? plan.shift()! : -1;
    else {
      const moves = pyMoves(s);
      if (moves.length === 0 || (pyCanDraw(s) && human.slip(0.4))) tap = pyCanDraw(s) ? PY_STOCK_PILE : -1;
      else {
        const values = moves.map((m) => {
          const next = after(s, m);
          return depth === 0 ? 0 : m.length + (next ? look(next, depth - 1) : 0) + (m.includes(PY_WASTE_PILE) ? 0.5 : 0);
        });
        const m = moves[depth === 0 ? 0 : human.pick(values)]!;
        tap = m[0]!;
        if (m.length === 2) queue.push(m[1]!);
      }
    }
    if (tap < 0) return null;
    nextAt = t + human.thinkTicks(queue.length ? SECOND_MS : tap === PY_STOCK_PILE ? DRAW_MS : THINK_MS);
    return { k: PY_INPUT_TAP, a: tap, b: 0, c: 0, d: 0 };
  }, init);
  return { events };
};
