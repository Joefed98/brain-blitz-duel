/**
 * Ricochet (ricoRev 2, the ninja wall-climb): a player clinging to a wall chooses when to leap and whether (and when)
 * to double jump, reading the tower on screen. At each landing the player weighs a handful of plans (leap after a
 * short wait, with or without a double jump at some point of the arc) by looking at the screen the way a player
 * does (each plan is tried on the real sim, standing in for experience): height gained against the time it takes
 * (about 4 px a tick is the climb's pace), the coins, lanterns and scrolls the plan takes (if the player wants them:
 * weaker players chase fewer), and a hit costs a lot. The pick is blurred by the level's judgement; then the taps
 * go through the Human: the leap no sooner than a reaction-limited moment after landing, each tap with the level's
 * timing error, and the odd slip (a stray tap in the air). Flawless (perfect) has no error at all: its plan is the
 * best of the plans it weighs.
 */
import {
  MODE_CLING,
  MODE_FLIGHT,
  NINJA_INPUT_TAP,
  type NinjaState,
} from "../../../src/lib/arcade/ricochetNinja";
import type { SkillLevel } from "../human";
import { driveEvents, type SkillBot } from "../bot";

const TAP = { k: NINJA_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 };
const WAITS = [0, 1, 2, 3, 4, 6, 8, 10, 13, 16, 20, 25, 30];
const DJS = [-1, 6, 8, 10, 12, 14, 16, 18];
/** Climb pace (px a tick) the plans are judged against. */
const PACE = 4;
/** How many of the best first plans are looked at a leap further. */
const LOOK = 10;
const COIN_V = 22;
const LANTERN_V = 60;
const SCROLL_V = 110;
/** Elite and flawless players know height past the core's full mark pays nothing, so they weigh the items higher. */
const ITEM_WEIGHT: Record<SkillLevel, number> = { weak: 1, average: 1, good: 1, great: 1, near: 1, elite: 2.3, perfect: 3 };
const ITEM_TRY: Record<SkillLevel, number> = { weak: 0.25, average: 0.5, good: 0.7, great: 0.85, near: 0.95, elite: 1, perfect: 1 };

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level as SkillLevel;
  const itemTry = ITEM_TRY[level] ?? 0.5;
  const perfect = level === "perfect";
  const weight = ITEM_WEIGHT[level] ?? 1;
  let leapAt = -1;
  let djAt = -1;
  let planned = false;
  let lastMode = MODE_CLING;
  let landedAt = 0;

  /** Tries a plan from state `s` (before tick t): leap after `w` ticks, double jump `d` ticks into the leap (-1 none). */
  const tryPlan = (s0: NinjaState, t: number, w: number, d: number, items: boolean): { v: number; s: NinjaState; hit: boolean } => {
    let s = s0;
    const la = t + w;
    const da = d < 0 ? -1 : la + d;
    let flew = false;
    let after = -1;
    for (let k = t; k < t + w + 26 + 12 + 4 && !game.isOver(s); k++) {
      s = game.step(s, k === la || k === da ? { ...TAP, t: k } : null) as NinjaState;
      if (s.hits > s0.hits) return { v: -2000 - (k - t), s, hit: true };
      if (s.mode === MODE_FLIGHT) flew = true;
      if (flew && s.mode === MODE_CLING && after < 0) after = k;
      if (after >= 0 && k >= after + 1) break;
    }
    const gained = (s.y - s0.y) / 256;
    const took = s.tick - s0.tick;
    const got = items ? weight * ((s.coins - s0.coins) * COIN_V + (s.lanterns - s0.lanterns) * LANTERN_V + (s.scrolls - s0.scrolls) * SCROLL_V) : 0;
    return { v: gained - PACE * took + got, s, hit: false };
  };
  /** The best follow-up leap from a landing (a short list of plans): what the next landing leaves open. */
  const FOLLOW: [number, number][] = [[0, -1], [0, 8], [0, 12], [0, 16], [3, -1], [6, -1], [10, -1], [16, -1], [24, -1], [4, 10], [10, 10], [30, -1]];
  const follow = (s: NinjaState, items: boolean): number => {
    let best = -4000;
    for (const [w, d] of FOLLOW) best = Math.max(best, tryPlan(s, s.tick + 1, w, d, items).v);
    return best;
  };

  const { events } = driveEvents(
    game as never,
    (state: NinjaState, t: number) => {
      if (state.mode === MODE_CLING && lastMode !== MODE_CLING) {
        landedAt = t;
        planned = false;
      }
      lastMode = state.mode;
      if (state.mode === MODE_CLING && planned && t > leapAt) planned = false;
      if (state.mode === MODE_CLING && !planned) {
        planned = true;
        const items = human.chance(itemTry);
        const options: { w: number; d: number }[] = [];
        const first: { v: number; s: NinjaState; hit: boolean }[] = [];
        for (const w of WAITS) for (const d of DJS) {
          options.push({ w, d });
          first.push(tryPlan(state, t, w, d, items));
        }
        // The better first plans are looked at one leap further (what the landing leaves open).
        const order = first.map((_, j) => j).sort((a, b) => first[b]!.v - first[a]!.v);
        const values = first.map((f) => f.v - 1000);
        for (const j of order.slice(0, LOOK)) {
          const f = first[j]!;
          values[j] = f.hit ? f.v : f.v + 0.5 * follow(f.s, items);
        }
        let i = 0;
        if (perfect) {
          for (let j = 1; j < values.length; j++) if (values[j]! > values[i]!) i = j;
        } else i = Math.max(0, human.pick(values.map((v) => Math.max(v, -600))));
        const o = options[i]!;
        // The leap: no sooner than the level allows after landing, then the timing error.
        const earliest = landedAt + Math.max(0, human.reactTicks() - 12);
        leapAt = Math.max(t, earliest, t + o.w + (perfect ? 0 : human.timingTicks()));
        djAt = o.d < 0 ? -1 : leapAt + o.d + (perfect ? 0 : human.timingTicks(1.2));
        if (djAt >= 0 && djAt <= leapAt) djAt = leapAt + 1;
        // A slip: a stray tap in the air (it uses the double jump).
        if (djAt < 0 && !perfect && human.slip(0.5)) djAt = leapAt + human.int(3, 20);
      }
      if (t === leapAt && state.mode === MODE_CLING) return TAP;
      if (t === djAt && state.mode === MODE_FLIGHT) return TAP;
      return null;
    },
    game.init(seed) as NinjaState,
  );
  void seed;
  return { events };
};
