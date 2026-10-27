/**
 * Grappler's assault course (swingRev 14, docs/grappler-assault-oct-2026.md): a person playing one section at a
 * time. Standing on a ledge they look at the section (reaction and thinking time), press, and play a line they
 * chose: a release from the first hook (with a quick swipe up to reel in when they go for a star), then for a
 * two-hook section or a squeeze a grab of the far hook in flight and a second release. Every moment is an
 * anticipated one, hit with the Human's timing error; after each of their own actions they look again (the flight
 * they actually got) and re-pick the next moment.
 *
 * The "right" moments come from forking the real sim (each candidate line played to its landing or miss), standing
 * in for a player's feel. A level picks the line worth most to it: the chance its own timing spread lands it (the
 * neighbouring ticks weighted by that spread), times what it is worth: getting through, sooner (the better levels
 * chase par), and the pickups on it (how keen a level is on gates, gems and stars). Never the score itself.
 */
import { SWING_INPUT_HOLD, SWING_INPUT_REEL, SWING_REEL_UP, type SwingState } from "../../../src/lib/arcade/swing";
import type { SkillLevel } from "../human";
import { driveEvents, Plan, type BotCtx, type BotResult } from "../bot";

type Ev = { k: number; a: number; b: number; c: number; d: number };
const hold = (a: number): Ev => ({ k: SWING_INPUT_HOLD, a, b: 0, c: 0, d: 0 });
const reel: Ev = { k: SWING_INPUT_REEL, a: SWING_REEL_UP, b: 0, c: 0, d: 0 };

/**
 * Each level's appetite: `pickup` is what a gate, gem or star on a line is worth (in landings), `speed` what a tick
 * sooner is worth (par), `reel` whether it tries the reeled-in star lines at all, `wait` the extra ticks (on top of
 * reaction) it looks at a new section before pressing.
 */
interface Cfg { pickup: number; speed: number; reel: boolean; wait: number }
const CFG: Record<SkillLevel, Cfg> = {
  weak: { pickup: 0, speed: 0, reel: false, wait: 500 },
  average: { pickup: 0.04, speed: 0, reel: false, wait: 380 },
  good: { pickup: 0.12, speed: 0.002, reel: false, wait: 300 },
  great: { pickup: 0.25, speed: 0.004, reel: true, wait: 240 },
  near: { pickup: 0.4, speed: 0.006, reel: true, wait: 200 },
  elite: { pickup: 0.5, speed: 0.008, reel: true, wait: 170 },
  perfect: { pickup: 0.6, speed: 0.01, reel: true, wait: 120 },
};

const bits = (n: number) => {
  let c = 0;
  for (let b = n; b; b &= b - 1) c++;
  return c;
};
const got = (s: SwingState) => bits(s.gatesLit ?? 0) + bits(s.gemsTaken ?? 0) + (s.starsTaken ?? []).length;

export function assaultBot({ game, seed, human }: BotCtx): BotResult {
  const level = human.level;
  const cfg = CFG[level];
  const sd = human.p.timingSdMs / (1000 / 60);
  const step = (s: SwingState, ev: Ev | null) => game.step(s, ev ? { ...ev, t: s.tick + 1 } : null) as SwingState;
  /** Plays `events` (offset from now → event) on a fork until the section is cleared or missed: [cleared, ticks, pickups]. */
  const play = (from: SwingState, events: Map<number, Ev>, max = 200): [boolean, number, number] => {
    const sec = from.sec ?? 0;
    const restarts = from.restarts ?? 0;
    const p0 = got(from);
    let s = from;
    for (let i = 1; i <= max; i++) {
      s = step(s, events.get(i) ?? null);
      if ((s.sec ?? 0) > sec) return [true, i, got(s) - p0];
      if ((s.restarts ?? 0) > restarts || game.isOver(s)) return [false, i, 0];
    }
    return [false, max, 0];
  };
  /** Weights of a timing error of d ticks (d = −6…6) for this player. */
  const spread: [number, number][] = [];
  if (sd <= 0.05) spread.push([0, 1]);
  else {
    let total = 0;
    for (let d = -6; d <= 6; d++) {
      const w = Math.exp(-(d * d) / (2 * sd * sd));
      if (w > 0.01) {
        spread.push([d, w]);
        total += w;
      }
    }
    for (const e of spread) e[1] /= total;
  }
  /** Value of each candidate tick (by its own landing outcome), smoothed over the player's spread: the best target. */
  const choose = (outcome: (t: number) => number, lo: number, hi: number): number | null => {
    const memo = new Map<number, number>();
    const at = (t: number) => {
      if (t < lo || t > hi) return 0;
      let v = memo.get(t);
      if (v === undefined) memo.set(t, (v = outcome(t)));
      return v;
    };
    const values: number[] = [];
    const ticks: number[] = [];
    for (let t = lo; t <= hi; t++) {
      if (at(t) <= 0) continue;
      ticks.push(t);
      values.push(spread.reduce((sum, [d, w]) => sum + w * at(t + d), 0));
    }
    if (ticks.length === 0) return null;
    const i = human.pick(values);
    return ticks[i]!;
  };
  const worth = ([ok, ticks, picks]: [boolean, number, number]) => (ok ? 1 + cfg.pickup * picks + cfg.speed * Math.max(0, 200 - ticks) : 0);
  const err = () => human.timingTicks() + (human.slip() ? human.int(-4, 4) : 0);

  const plan = new Plan();
  /** The stage a plan was made for (section, attempt, stage); a new stage gets a new plan. */
  let planned = "";
  let pressAt = 0;
  let waitKey = "";

  /** Release from the hook the hero is on now: the best tick for a one-hook line or the far hook's swing. */
  const planLand = (s: SwingState) => {
    const r = choose((t) => worth(play(s, new Map([[t, hold(0)]]), 200)), 1, 110);
    // Nothing they can see lands it: they let go on the upswing anyway (a guess), as anyone would.
    plan.at(s.tick + Math.max(1, (r ?? guess()) + err()), hold(0));
  };
  /** A release or grab guessed when no line looks good: somewhere in the first upswing. */
  const guess = () => human.int(18, 34);
  /** How good the far hook's releases are from a state just after its grab (their landings, the window closed early). */
  const leave = (onB: SwingState): number => {
    let total = 0;
    let seen = false;
    let misses = 0;
    for (let t = 1; t <= 70; t += 3) {
      const v = worth(play(onB, new Map([[t, hold(0)]]), 160));
      total += v;
      if (v > 0) {
        seen = true;
        misses = 0;
      } else if (seen && ++misses >= 3) break;
    }
    return Math.min(1.5, total / 1.5);
  };
  /** For a flight from `from`: the value of a grab of the far hook g ticks in, for g = 1…max (0: lost or the wrong hook). */
  const grabs = (from: SwingState, max: number, every = 1): number[] => {
    const out: number[] = [0];
    let f = from;
    for (let g = 1; g <= max; g++) {
      if (g % every === 0) {
        const s2 = step(f, hold(1));
        out.push(s2.rope === s2.sections![s2.sec ?? 0]!.hook0 + 1 && (s2.restarts ?? 0) === (from.restarts ?? 0) ? leave(s2) : 0);
      } else out.push(0);
      f = step(f, null);
      if ((f.restarts ?? 0) > (from.restarts ?? 0) || game.isOver(f)) break;
    }
    return out;
  };
  const caught = (from: SwingState, g: number): number => grabs(from, g)[g] ?? 0;
  void caught;

  return driveEvents(game, (s: SwingState, t) => {
    const k = s.sec ?? 0;
    const sec = s.sections![Math.min(k, s.sections!.length - 1)]!;
    const standing = (s.ledgeOn ?? -1) >= 0;
    const reeled = s.rope >= 0 && s.len < s.grabLen;
    const stage = standing ? "ledge" : s.rope === sec.hook0 ? (reeled ? "rope1r" : "rope1") : s.rope === sec.hook0 + 1 ? "rope2" : sec.kind !== 0 && s.rope < 0 && s.grabTick > 0 && s.anchors[sec.hook0] && s.x < s.anchors[sec.hook0 + 1]!.x ? "fly" : "air";
    const key = `${k}:${s.restarts ?? 0}:${stage}`;
    if (stage === "ledge" && (s.respawn ?? 0) === 0 && s.x === s.ledges![s.ledgeOn!]!.x && planned !== key) {
      // Looking at the section, then the press.
      if (waitKey !== key) {
        waitKey = key;
        pressAt = t + human.reactTicks() + human.thinkTicks(cfg.wait);
        plan.clear();
      }
      if (t >= pressAt) {
        planned = key;
        plan.at(t, hold(1));
        // A one-hook section with a star: a keen player may play the reeled-in line (press, swipe up, release).
        if (sec.kind === 0 && cfg.reel && (s.starSpots ?? []).length > (s.starsTaken ?? []).length) {
          const plainR = choose((r) => worth(play(s, new Map([[1, hold(1)], [r, hold(0)]]))), 2, 110);
          const plainV = plainR === null ? 0 : worth(play(s, new Map([[1, hold(1)], [plainR, hold(0)]])));
          let best: [number, number] | null = null;
          for (const u of [6, 8, 10, 12, 14, 16, 18]) {
            const r = choose((rr) => (rr <= u + 1 ? 0 : worth(play(s, new Map([[1, hold(1)], [u + 1, reel], [rr, hold(0)]])))), u + 2, 110);
            if (r === null) continue;
            const v = worth(play(s, new Map([[1, hold(1)], [u + 1, reel], [r, hold(0)]])));
            if (v > plainV + 0.05 && (!best || v > best[1])) best = [u, v];
          }
          if (best) plan.at(t + Math.max(2, best[0] + err()), reel);
        }
      }
    } else if (stage !== "ledge" && stage !== "air" && planned !== key) {
      planned = key;
      if (stage === "rope1r" || (stage === "rope1" && sec.kind === 0) || stage === "rope2") {
        // The release on to the landing ledge (re-picked after a reel: the tighter swing). A reel planned at the
        // press stays queued; the release is planned now and re-planned once the reel takes hold.
        const queuedReel = stage === "rope1";
        if (!queuedReel) plan.dropAfter(s.tick);
        planLand(s);
      } else if (stage === "rope1") {
        // Two hooks or a squeeze: the release whose flight lets the far hook be caught and left well.
        // The rope's states tick by tick, so each candidate release forks one (no replay from the press).
        const rope: SwingState[] = [s];
        for (let i = 1; i <= 70; i++) {
          const last = rope[i - 1]!;
          if ((last.restarts ?? 0) > (s.restarts ?? 0) || game.isOver(last)) break;
          rope.push(step(last, null));
        }
        const r1 = choose((rr) => {
          const before = rope[rr - 1];
          if (!before) return 0;
          const s1 = step(before, hold(0));
          // Only a forward release can carry on to the far hook.
          if ((s1.restarts ?? 0) > (s.restarts ?? 0) || s1.vx <= 0) return 0;
          return Math.max(0, ...grabs(s1, 28, 4));
        }, 1, 70);
        plan.at(s.tick + Math.max(1, (r1 ?? guess()) + err()), hold(0));
      } else if (stage === "fly") {
        const table = grabs(s, 40);
        const g = choose((gg) => table[gg] ?? 0, 1, 40);
        plan.at(s.tick + Math.max(1, (g ?? human.int(6, 14)) + Math.round(err() * 1.3)), hold(1));
      }
    }
    return plan.take(t);
  }, game.init(seed) as SwingState);
}
