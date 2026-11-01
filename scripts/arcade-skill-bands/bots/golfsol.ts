/**
 * Golf Solitaire (1 Nov 2026): a player scanning the seven bottom cards for one a step from the foundation. Flawless
 * plays the bank's proved line (a clear with five runs of five) at the fastest human pace. Near-perfect and elite
 * players search the deal from where they stand (elite for five runs first, then any clear; near-perfect for any clear)
 * and play that line; otherwise each playable card is valued by the chain it starts (plays before the stock is needed),
 * looked ahead a few plays by level, blurred by judgement. Slips: a hasty pick, or drawing with a play still showing.
 */
import { GS_COLS, GS_INPUT_TAP, GS_STOCK, GS_STOCK_PILE, gsApply, gsPlayable, type GsState } from "../../../src/lib/arcade/cards/golfSol";
import { driveEvents, type SkillBot } from "../bot";
import { golfSolSolution } from "../../cards/solutions";
import { gsSolve } from "../../cards/golfSolSolver";

const THINK_MS = 1300;

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

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  const init = game.init(seed) as GsState;
  let plan: number[] | null = level === "perfect" ? golfSolSolution(init.deal).slice() : null;
  let searched = false;
  const depth = level === "weak" ? 1 : level === "average" ? 2 : level === "good" ? 3 : 5;
  let nextAt = human.thinkTicks(THINK_MS * 1.5);
  const { events } = driveEvents<GsState>(game, (s, t) => {
    if (t < nextAt) return null;
    nextAt = t + human.thinkTicks(THINK_MS);
    let tap = -1;
    if (plan && plan.length) tap = plan.shift()!;
    else if ((level === "near" || level === "elite") && !searched) {
      searched = true;
      plan = (level === "elite" ? gsSolve(s, 5, 15_000) : null) ?? gsSolve(s, 0, level === "elite" ? 15_000 : 5_000);
      if (plan && plan.length) tap = plan.shift()!;
    }
    if (tap < 0) {
      const options: number[] = [];
      for (let c = 0; c < GS_COLS; c++) if (gsPlayable(s, c)) options.push(c);
      if (options.length === 0 || (s.stockPos < GS_STOCK && human.slip(0.4))) tap = GS_STOCK_PILE;
      else tap = options[human.pick(options.map((c) => 1 + chain(gsApply(s, c)!, depth) + 0.3 * s.heights[c]!))]!;
    }
    if (tap !== GS_STOCK_PILE && !gsPlayable(s, tap)) {
      plan = null;
      return null;
    }
    return { k: GS_INPUT_TAP, a: tap, b: 0, c: 0, d: 0 };
  }, init);
  return { events };
};
