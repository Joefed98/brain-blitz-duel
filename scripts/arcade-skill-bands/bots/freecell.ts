/**
 * FreeCell: a player who plans. Flawless plays the bank's proved line (par moves) at the fastest human pace; every
 * other level thinks before each move (an average player about 3 s a move), slips now and then into a move off the
 * plan (a card parked in a free cell, a run moved to the wrong column) and then plans again from where the cards lie.
 * Weaker players plan worse: their plans come from a quicker, greedier search with a smaller budget, so they are
 * longer, and a player who cannot see a way through plays the move that looks best and tries again a few moves on.
 */
import { FC_INPUT_MOVE, fcAllHome, fcApply, fcCoreUnits, type FcState } from "../../../src/lib/arcade/cards/freecell";
import { driveEvents, type SkillBot } from "../bot";
import { fcMoves, fcSolve, type FcMove } from "../../cards/freecellSolver";
import { freecellSolution } from "../../cards/solutions";
import type { SkillLevel } from "../human";

/** Average thinking time per move (ms), before the level's thinkScale. */
const THINK_MS = 3000;
/** How a level plans: the search's weight (higher = greedier, longer plans) and its node budget. */
const PLAN: Record<SkillLevel, readonly [number, number]> = {
  weak: [6, 1500],
  average: [5, 4000],
  good: [4, 10_000],
  great: [3, 20_000],
  near: [2.5, 40_000],
  elite: [2, 60_000],
  perfect: [1.8, 60_000],
};

function greedy(s: FcState): FcMove | null {
  let best: FcMove | null = null;
  let bestV = -Infinity;
  for (const m of fcMoves(s)) {
    const next = fcApply(s, m[0], m[1], m[2]);
    if (!next) continue;
    const v = fcCoreUnits(next) * 4 - next.cells.filter((c) => c >= 0).length - (m[2] >= 8 && m[2] < 12 ? 2 : 0);
    if (v > bestV) {
      bestV = v;
      best = m;
    }
  }
  return best;
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  let plan: FcMove[] | null = null;
  let nextAt = 0;
  let stuckFor = 0;
  const replan = (s: FcState) => {
    const [w, limit] = PLAN[level];
    plan = fcSolve(s, w, limit);
  };
  const init = game.init(seed) as FcState;
  if (level === "perfect") plan = freecellSolution(init.deal, init.rev).slice();
  else replan(init);
  nextAt = human.thinkTicks(THINK_MS * 1.5);
  const { events } = driveEvents<FcState>(game, (s, t) => {
    if (t < nextAt || fcAllHome(s)) return null;
    nextAt = t + human.thinkTicks(THINK_MS);
    let move: FcMove | null = null;
    if (human.slip(level === "perfect" ? 0 : 1.6)) {
      // A move off the plan: any legal move (parking a card, a run to another column), then plan again.
      const moves = fcMoves(s).filter((m) => fcApply(s, m[0], m[1], m[2]) !== null);
      move = moves.length ? moves[human.int(0, moves.length - 1)]! : null;
      plan = null;
    } else if (plan && plan.length) {
      move = plan.shift()!;
      if (!fcApply(s, move[0], move[1], move[2])) {
        plan = null;
        move = null;
      }
    }
    if (!move) {
      if (!plan) replan(s);
      if (plan && plan.length) move = plan.shift()!;
      else {
        move = greedy(s);
        stuckFor++;
        if (stuckFor % 4 === 0) replan(s);
      }
    }
    if (!move) return null;
    return { k: FC_INPUT_MOVE, a: move[0], b: move[1], c: move[2], d: 0 };
  }, init);
  return { events };
};
