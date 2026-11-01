/**
 * Muggins (1 Nov 2026): a player looking at the hand against the two open ends. Flawless plays the deal's witness (a
 * cleared hand with at least the core's points and two big plays) at the fastest human pace.
 *
 * Near-perfect and elite players use Undo to explore: they draw, look and take it back, so they know the pile ahead
 * and search whole lines (plays and the draws they force) for the best score, within a budget (elite's larger), paying
 * for it in thinking time. Below that a player looks only through their own hand (no peeking at the pile): weak players
 * lay the first tile that fits half the time and otherwise the play that scores most at once; good and great players
 * search their next two or three plays for points, big plays and an emptied hand, blurred by judgement. Draw when
 * nothing fits. Slips: a hasty pick.
 */
import {
  MG_BIG_AT, MG_BIG_EACH, MG_BIG_FULL, MG_CLEAR_MAX, MG_CORE_FULL, MG_CORE_MAX, MG_INPUT_DRAW, MG_INPUT_PLAY, MG_RUN_TICKS, MG_SPEED_MAX, mgApply, mgDeal, mgPlays, type MgState,
} from "../../../src/lib/arcade/cards/muggins";
import { driveEvents, type SkillBot } from "../bot";

const THINK_MS = 1700;
/** What emptying the hand is worth to a player who sees it coming (the clear and most of the speed). */
const CLEAR_VALUE = 35;

/** The best value reachable from `s` in `depth` plays from the hand (no draws): points, big plays, an emptied hand. */
function look(s: MgState, depth: number): number {
  if (s.hand.length === 0) return CLEAR_VALUE;
  if (depth === 0) return 0;
  let best = 0;
  for (const [t, e] of mgPlays(s)) {
    const n = mgApply(s, t, e)!;
    best = Math.max(best, n.lastScore + (n.lastScore >= MG_BIG_AT ? 4 : 0) + look(n, depth - 1));
  }
  return best;
}

/** A finished line's worth on the scoring (speed guessed from the plays left at ~1 s each). */
function worth(s: MgState, extraTicks: number): number {
  const core = (MG_CORE_MAX * Math.min(s.points, MG_CORE_FULL)) / MG_CORE_FULL;
  const big = Math.min(s.bigs, MG_BIG_FULL) * MG_BIG_EACH;
  const clear = s.hand.length === 0 ? MG_CLEAR_MAX + (MG_SPEED_MAX * Math.max(0, MG_RUN_TICKS - s.tick - extraTicks)) / MG_RUN_TICKS : 0;
  return core + big + clear + s.points * 0.01;
}

/** The best whole line from `s` (knowing the pile), searched within `budget` nodes: [tile, end] plays, [-1, 0] draws. */
function bestLine(s0: MgState, budget: number): [number, number][] {
  let nodes = 0;
  let best: { v: number; line: [number, number][] } = { v: -1, line: [] };
  const line: [number, number][] = [];
  const go = (s: MgState) => {
    if (s.hand.length === 0 || ++nodes > budget) {
      const v = worth(s, line.length * 60);
      if (v > best.v) best = { v, line: line.slice() };
      return;
    }
    const plays = mgPlays(s);
    if (plays.length === 0) {
      const d = mgApply(s, -1, 0);
      if (!d) {
        const v = worth(s, line.length * 60);
        if (v > best.v) best = { v, line: line.slice() };
        return;
      }
      line.push([-1, 0]);
      go(d);
      line.pop();
      return;
    }
    const next = plays.map(([t, e]) => ({ t, e, n: mgApply(s, t, e)! })).sort((a, b) => b.n.lastScore - a.n.lastScore);
    for (const p of next) {
      line.push([p.t, p.e]);
      go(p.n);
      line.pop();
      if (nodes > budget) break;
    }
  };
  go(s0);
  return best.line;
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  const init = game.init(seed) as MgState;
  const peeks = level === "near" || level === "elite";
  let plan: [number, number][] | null = level === "perfect" ? mgDeal(seed).witness.slice() : null;
  const depth = level === "weak" || level === "average" ? 1 : level === "good" ? 2 : 3;
  let nextAt = human.thinkTicks(THINK_MS * (peeks ? 4 : 1.3));
  const { events } = driveEvents<MgState>(game, (s, t) => {
    if (t < nextAt) return null;
    nextAt = t + human.thinkTicks(THINK_MS);
    if (!plan && peeks) plan = bestLine(s, level === "elite" ? 10_000 : 1_000);
    if (plan && plan.length) {
      const [tile, end] = plan.shift()!;
      return tile < 0 ? { k: MG_INPUT_DRAW, a: 0, b: 0, c: 0, d: 0 } : { k: MG_INPUT_PLAY, a: tile, b: end, c: 0, d: 0 };
    }
    const plays = mgPlays(s);
    if (plays.length === 0) return { k: MG_INPUT_DRAW, a: 0, b: 0, c: 0, d: 0 };
    let pick: [number, number];
    if (level === "weak" && human.chance(0.5)) pick = plays[0]!;
    else {
      const values = plays.map(([tile, end]) => {
        const n = mgApply(s, tile, end)!;
        return n.lastScore + (depth > 1 && n.lastScore >= MG_BIG_AT ? 4 : 0) + look(n, depth - 1) + 0.5 * mgPlays(n).length;
      });
      pick = plays[human.pick(values)]!;
    }
    return { k: MG_INPUT_PLAY, a: pick[0], b: pick[1], c: 0, d: 0 };
  }, init);
  return { events };
};
