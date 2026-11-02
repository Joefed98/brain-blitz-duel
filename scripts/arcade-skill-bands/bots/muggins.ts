/**
 * Muggins (1 Nov 2026): a player looking at the hand against the two open ends. Flawless plays the deal's witness (a
 * cleared hand with at least the core's points and two big plays, knowing the pile) at the fastest human pace: the
 * ceiling, not a player. Everyone else sees only the pile's face-up next tile (a draw is final and Undo stops at it), so
 * every other level looks ahead through its own hand and that one tile: weak players lay the first tile that fits half the time and otherwise the play that
 * scores most at once; average one play, good and great two, near-perfect and elite four plays ahead, for
 * points, big plays and an emptied hand, blurred by judgement. Draw when nothing fits.
 */
import {
  MG_BIG_AT, MG_INPUT_DRAW, MG_INPUT_PLAY, mgApply, mgDeal, mgPlays, type MgState,
} from "../../../src/lib/arcade/cards/muggins";
import { driveEvents, type SkillBot } from "../bot";

const THINK_MS = 1700;
/** What emptying the hand is worth, in Muggins points: the clear and most of the speed (35 of the score) at 150 ÷ 65 a point. */
const CLEAR_VALUE = 15;
/** What a forced draw is worth to a player who looks for it (the extra tile's plays to come), in Muggins points. */
const STUCK_VALUE = 8;
/** After this tick (60 s in) a player stops angling for draws and plays the hand out for the clear. */
const LATE_TICK = 60 * 60;

/**
 * The best value reachable from `s` in `depth` plays (points, big plays, an emptied hand), seeing the pile's face-up next
 * tile: when nothing fits it is drawn and the line goes on (the tile after it is still face down, so a second forced draw
 * is only valued, never seen).
 */
function look(s: MgState, depth: number, known = 1): number {
  if (s.hand.length === 0) return CLEAR_VALUE;
  if (depth === 0) return 0;
  const plays = mgPlays(s);
  if (plays.length === 0) {
    if (s.pilePos >= s.pile.length) return 0;
    if (known > 0) {
      const drawn = mgApply(s, -1, 0);
      return drawn ? look(drawn, depth - 1, known - 1) : 0;
    }
    // A draw keeps the round (and the scoring) going, worth it while time is left.
    return s.tick < LATE_TICK ? STUCK_VALUE : 0;
  }
  let best = 0;
  for (const [t, e] of plays) {
    const n = mgApply(s, t, e)!;
    best = Math.max(best, n.lastScore + (n.lastScore >= MG_BIG_AT ? 4 : 0) + look(n, depth - 1, known));
  }
  return best;
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  const init = game.init(seed) as MgState;
  const plan: [number, number][] | null = level === "perfect" ? mgDeal(seed).witness.slice() : null;
  const depth = level === "weak" || level === "average" ? 1 : level === "good" ? 2 : level === "great" ? 2 : 4;
  let nextAt = human.thinkTicks(THINK_MS * 1.3);
  const { events } = driveEvents<MgState>(game, (s, t) => {
    if (t < nextAt) return null;
    nextAt = t + human.thinkTicks(THINK_MS);
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
