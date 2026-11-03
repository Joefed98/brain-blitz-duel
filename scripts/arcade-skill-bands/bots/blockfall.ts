/**
 * Blockfall: a player stacking pieces in a 10 × 20 well for 60 s (Blockzone, blockfallRev 2: 90 s and no hold, so
 * nobody holds there).
 *
 * Each piece: the player sees it arrive, thinks (a base 900 ms, the level's think scale), then makes the inputs a
 * phone takes: a tap on the hold box, taps to turn, one drag to the column, a flick down. Each input is a separate
 * gesture with its own human time (taps about 200 ms, the drag about 230 ms, the flick about 180 ms, each scaled by
 * the level). The choice of landing goes through the shared planner (scripts/blockfall/planner.ts): the best few
 * landings are blurred by the level's judgement before the pick, and a slip lands one column out. Weak and average
 * players play flat and never hold; good players hold when it pays; great and better keep a well for fours until the
 * multi-line part is full (great ones until about half of it) and play the last 10 s low. The perfect level is the
 * oracle (scripts/blockfall-oracle.ts).
 */
import { BF_INPUT_DROP, BF_INPUT_HOLD, BF_INPUT_MOVE, BF_MULTI_MAX, bfMultiPoints, bfRunTicksFor, bfStackHeight, BLOCKFALL_REV_ZONE, type BfState } from "../../../src/lib/arcade/blockfall";
import { blockfallOracleEvents } from "../../blockfall-oracle";
import { bfCandidates, bfValue, type BfCandidate, type BfMode, type BfMove } from "../../blockfall/planner";
import { driveEvents, type SkillBot } from "../bot";
import type { Human } from "../human";

const THINK_MS = 1100;
/** How many of the best landings a player weighs up (a weaker player sees fewer good ones, but no wild ones). */
const POOL: Record<string, number> = { weak: 4, average: 5, good: 6 };

function gestureMs(m: BfMove): number {
  return m.k === BF_INPUT_MOVE ? 230 : m.k === BF_INPUT_DROP ? 180 : 200;
}

function choose(s: BfState, human: Human): BfCandidate | null {
  const level = human.level;
  const strong = level === "great" || level === "near" || level === "elite";
  // Blockzone (blockfallRev 2) has no hold.
  const hold = level !== "weak" && level !== "average" && s.rev !== BLOCKFALL_REV_ZONE;
  const BF_RUN_TICKS = bfRunTicksFor(s.rev);
  const multiAim = level === "great" ? BF_MULTI_MAX / 2 : BF_MULTI_MAX;
  let mode: BfMode = "flat";
  if (strong && s.tick >= BF_RUN_TICKS - 600) mode = "low";
  else if (strong && bfMultiPoints(s) < multiAim && bfStackHeight(s.board) <= 9) mode = "well";
  const all = bfCandidates(s, hold).filter((c) => c.after.ended !== 2);
  if (!all.length) return null;
  const scored = all.map((c) => ({ c, v: bfValue(c, mode) })).sort((a, b) => b.v - a.v).slice(0, POOL[level] ?? 8);
  const i = human.pick(scored.map((x) => x.v), 0.6);
  return scored[Math.max(0, i)]!.c;
}

export const bot: SkillBot = ({ game, seed, human, rev }) => {
  if (human.level === "perfect") return { events: blockfallOracleEvents(seed, rev ?? 1).events };
  let planFor = -1;
  let queue: { t: number; k: number; a: number }[] = [];
  let thinkUntil = -1;
  const { events } = driveEvents<BfState>(game, (s, t) => {
    const id = s.pieces * 2 + s.held;
    if (id !== planFor) {
      // A new piece: notice it, think, then plan from where it has fallen to.
      planFor = id;
      queue = [];
      thinkUntil = t + human.thinkTicks(THINK_MS);
    }
    if (thinkUntil >= 0 && t >= thinkUntil) {
      thinkUntil = -1;
      const pick = choose(s, human);
      if (pick) {
        let at = t;
        queue = pick.moves.map((m) => {
          let a = m.a;
          // A slip: the drag ends a column out.
          if (m.k === BF_INPUT_MOVE && human.slip()) a += human.chance(0.5) ? 1 : -1;
          const ev = { t: at, k: m.k, a };
          // A gesture is mostly the hand's own time: only part of it shrinks with skill.
          at += Math.max(4, Math.round(human.thinkTicks(gestureMs(m), 0.25) * (0.6 + 0.4 * human.p.thinkScale) / human.p.thinkScale));
          return ev;
        });
        // A short drag that slipped to nothing is still a gesture with no move.
        queue = queue.filter((e) => e.k !== BF_INPUT_MOVE || e.a !== 0);
      }
    }
    if (queue.length && queue[0]!.t <= t) {
      const e = queue.shift()!;
      // A hold brings the next piece: the rest of the plan is for it.
      if (e.k === BF_INPUT_HOLD) planFor = s.pieces * 2 + 1;
      return { k: e.k, a: e.a, b: 0, c: 0, d: 0 };
    }
    return null;
  }, game.init(seed) as BfState);
  return { events };
};
