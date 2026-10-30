/**
 * TriPeaks: a player scanning for a card one away from the discard. Flawless plays the bank's proved line (a full
 * clear with a run of ten) at the fastest human pace. Other levels look a few plays ahead: each playable card is
 * valued by the chain it starts (how many plays follow before the stock is needed) and by the face-down cards it
 * uncovers, blurred by the level's judgement; near-perfect and elite players also search the whole deal when it is
 * small enough to see through. Slips: now and then a hasty pick, or turning the stock with a play still showing.
 */
import { TP_CARDS, TP_INPUT_TAP, TP_STOCK_PILE, tpApply, tpFree, tpPlayable, type TpState } from "../../../src/lib/arcade/cards/tripeaks";
import { driveEvents, type SkillBot } from "../bot";
import { tripeaksSolution } from "../../cards/solutions";
import { tpSolve } from "../../cards/tripeaksSolver";

/** Average thinking time per tap (ms), before the level's thinkScale. */
const THINK_MS = 1300;

/** The longest chain of plays from a state without turning the stock (a short look ahead). */
function chain(s: TpState, depth: number): number {
  if (depth === 0) return 0;
  let best = 0;
  for (let i = 0; i < TP_CARDS; i++) {
    if (!tpPlayable(s, i)) continue;
    const next = tpApply(s, i)!;
    best = Math.max(best, 1 + chain(next, depth - 1));
    if (best >= depth) break;
  }
  return best;
}

function uncovers(s: TpState, i: number): number {
  const next = tpApply(s, i);
  if (!next) return 0;
  let n = 0;
  for (let j = 0; j < TP_CARDS; j++) if (!s.cleared[j] && !tpFree(s, j) && tpFree(next, j)) n++;
  return n;
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  const init = game.init(seed) as TpState;
  let plan: number[] | null = level === "perfect" ? tripeaksSolution(init.deal).slice() : null;
  const depth = level === "weak" ? 1 : level === "average" ? 2 : level === "good" ? 3 : 4;
  let nextAt = human.thinkTicks(THINK_MS * 1.5);
  const { events } = driveEvents<TpState>(game, (s, t) => {
    if (t < nextAt) return null;
    nextAt = t + human.thinkTicks(THINK_MS);
    let tap = -1;
    if (plan && plan.length) tap = plan.shift()!;
    else if ((level === "near" || level === "elite") && !plan) {
      plan = tpSolve(s, 0, 60_000);
      if (plan && plan.length) tap = plan.shift()!;
    }
    if (tap < 0) {
      const options: number[] = [];
      for (let i = 0; i < TP_CARDS; i++) if (tpPlayable(s, i)) options.push(i);
      if (options.length === 0 || human.slip(0.4)) tap = TP_STOCK_PILE;
      else {
        const values = options.map((i) => 1 + chain(tpApply(s, i)!, depth) + 0.6 * uncovers(s, i) + (i < 3 ? 2 : 0));
        tap = options[human.pick(values)]!;
      }
    }
    if (tap !== TP_STOCK_PILE && !tpPlayable(s, tap)) {
      plan = null;
      return null;
    }
    return { k: TP_INPUT_TAP, a: tap, b: 0, c: 0, d: 0 };
  }, init);
  return { events };
};
