/**
 * Hover: a flappy-style tapper. A tap sets the disc's climb to a fixed kick, so
 * every arc rises ~63 px over ~18 ticks, and its top is nearly flat. A player
 * who knows the game threads each barrier near the top of an arc: they set up
 * a "key" tap about 18 ticks before the barrier's middle reaches the disc, made
 * from the height that puts the arc's top a little above the gap's middle (or
 * through a gold star they chose to go for: a high star wants the arc's top on
 * it, a low star wants the dip, i.e. the key tap, right on it). To arrive at
 * that height on time they place one set-up tap beforehand (the ideal set-up
 * tap is computed exactly, standing in for experience). Between barriers they
 * just keep the disc bobbing around the height they will need.
 *
 * Every tap is an anticipated moment: it is committed about a reaction time
 * before it is due and lands with the level's timing jitter, wider on the fast
 * late course and on sliding gaps. The barrier ahead is seen late (tracking
 * lag); a sliding gap is extrapolated from how it was moving, with an error
 * that grows with how far ahead it has to be judged (the extrapolation also
 * misses a reversal). Two-gap barriers: the nearer-looking gap (blurred pick).
 * Slips: now and then a tap goes well off its moment.
 */
import {
  HOVER_DISC_R,
  HOVER_DISC_X,
  HOVER_GRAVITY,
  HOVER_IMPULSE,
  HOVER_PILLAR_W,
  HOVER_SCROLL_MAX,
  HOVER_SCROLL_START,
  HOVER_TERMINAL,
  HOVER_WORLD_BOTTOM,
  hoverGapTop,
  hoverScroll,
  hoverStarY,
  pillarX,
  type HoverState,
} from "../../../src/lib/arcade/hover";
import { driveTaps, type SkillBot } from "../bot";

/** Chance of deciding to go for a gold star (each one sits near a lip: a risky line). */
const STAR_TRY: Record<string, number> = { average: 0.25, good: 0.5, great: 0.75, near: 0.9 };
/** Read error on where a sliding gap will be, px per tick ahead (1 world px = 1 phone px). */
const READ: Record<string, number> = { average: 0.3, good: 0.2, great: 0.13, near: 0.08 };
/** Fastest deliberate tapping: 8 ticks apart (7.5 taps a second). */
const MIN_TAP_GAP = 8;
/** The set-up/key pair is planned within this many ticks of the key tap. */
const APPROACH = 50;
/** How far (ticks) the key tap may slide off its ideal moment to suit the disc's height. */
const KEY_SLACK = 6;

const FP = 256;
const clampV = (v: number) => Math.max(-HOVER_TERMINAL, Math.min(HOVER_TERMINAL, v));

/** rise[j]: height change j+1 ticks into a tap (the tap tick is j = 0), fixed-point (negative = up). */
const RISE = (() => {
  const out: number[] = [];
  let v = HOVER_IMPULSE;
  let y = 0;
  for (let j = 0; j < 160; j++) {
    if (j > 0) v = clampV(v + HOVER_GRAVITY);
    y += v;
    out.push(y);
  }
  return out;
})();
/** Ticks from a tap to its arc's top, and the arc's height. */
const APEX_TICKS = RISE.indexOf(Math.min(...RISE));
const ARC = -Math.min(...RISE);

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  const lag = human.lagTicks();
  /** Commit point: a tap can no longer be corrected within about a reaction time of it. */
  const commitLead = Math.round(human.p.reactionMs[0] / (1000 / 60));
  const history: HoverState[] = [];
  /** Per barrier: chosen gap (0/1), star decision, and the slide-read error draw. */
  const choice = new Map<number, { gap: number; star: boolean; readErr: number }>();
  const keyDone = new Set<number>();
  const setupDone = new Set<number>();
  let pendingSetup = -1;
  let pending: number | null = null;
  let pendingKey = -1;
  let lastTap = -100;
  const init = game.init(seed) as HoverState;

  /** What the human wants for the barrier ahead, from the perceived state. */
  const target = (s: HoverState, seen: HoverState) => {
    let idx = -1;
    for (let i = seen.gates; i < seen.pillars.length; i++) {
      const p = seen.pillars[i]!;
      if (pillarX(p, seen.distance) + HOVER_PILLAR_W - (HOVER_DISC_X - HOVER_DISC_R) >= 0) {
        idx = i;
        break;
      }
    }
    const speedFrac = (hoverScroll(s.gates) - HOVER_SCROLL_START) / (HOVER_SCROLL_MAX - HOVER_SCROLL_START);
    if (idx < 0) return null;
    const p = seen.pillars[idx]!;
    let c = choice.get(idx);
    if (!c) {
      let gap = 0;
      if (p.gap2Top !== undefined) {
        const mid1 = p.gapTop + p.gapH / 2;
        const mid2 = p.gap2Top + (p.gap2H ?? 0) / 2;
        gap = human.pick([-Math.abs(mid1 - s.y), -Math.abs(mid2 - s.y)]);
      }
      c = { gap, star: p.starDy !== undefined && human.chance(STAR_TRY[level]!), readErr: human.normal() };
      choice.set(idx, c);
    }
    // When (as perceived) the barrier's middle reaches the disc.
    const speed = hoverScroll(seen.gates);
    const passTick = seen.tick + (pillarX(p, seen.distance) + HOVER_PILLAR_W / 2 - HOVER_DISC_X) / speed;
    let top: number;
    let h: number;
    let moving = false;
    if (c.gap === 1 && p.gap2Top !== undefined) {
      top = p.gap2Top;
      h = p.gap2H ?? 0;
    } else {
      h = p.gapH;
      top = hoverGapTop(p, seen.tick);
      if (p.movePhase !== undefined) {
        moving = true;
        // Linear extrapolation of the slide from the lagged view, plus a read error growing with time ahead.
        const v = hoverGapTop(p, seen.tick) - hoverGapTop(p, seen.tick - 1);
        const until = Math.max(0, passTick - seen.tick);
        top += v * until + c.readErr * READ[level]! * until * FP;
      }
    }
    const scale = 1 + 0.4 * speedFrac + (moving ? 0.3 : 0);
    // Default: the arc's top a few px above the gap's middle, key tap APEX_TICKS before the pass.
    let keyY = top + h / 2 - 3 * FP + ARC;
    let keyTick = passTick - APEX_TICKS;
    if (c.star && p.starDy !== undefined) {
      const starY = top + ((hoverStarY(p, seen.tick) ?? 0) - hoverGapTop(p, seen.tick));
      if (p.starDy < h / 2) keyY = Math.max(top + HOVER_DISC_R + 2 * FP, starY - 2 * FP) + ARC;
      else {
        // Dip onto the star: the key tap is made at the star as the barrier's middle arrives.
        keyY = Math.min(top + h - HOVER_DISC_R - 3 * FP, starY + 2 * FP);
        keyTick = passTick;
      }
    }
    return { idx, keyY, keyTick: Math.round(keyTick), scale };
  };

  /** The disc's height over the next n ticks without a tap, from the true state (own motion is predictable). */
  const fall = (y: number, vy: number, n: number): number[] => {
    const out: number[] = [];
    for (let k = 0; k < n; k++) {
      vy = clampV(vy + HOVER_GRAVITY);
      y += vy;
      out.push(y);
    }
    return out;
  };

  const commit = (due: number, t: number, scale: number) => {
    let err = human.timingTicks(scale);
    if (human.slip(0.2)) err += (human.chance(0.5) ? 1 : -1) * human.int(5, 12);
    return Math.max(t, due + err);
  };

  return driveTaps(game, (s: HoverState, t) => {
    history.push(s);
    const seen = history[Math.max(0, history.length - 1 - lag)]!;
    const tg = target(s, seen);
    if (tg && !keyDone.has(tg.idx) && tg.keyTick - t < -KEY_SLACK - 1 && pendingKey !== tg.idx) keyDone.add(tg.idx);
    if (pending === null && tg && t - lastTap >= MIN_TAP_GAP) {
      const untilKey = tg.keyTick - t;
      const traj = fall(s.y, s.vy, Math.max(60, untilKey + KEY_SLACK + 2));
      /** Ticks until the untouched disc dips to `low` (or is well below it and losing its climb). */
      const dipK = (low: number) => {
        for (let k = 0; k < traj.length; k++) {
          const y = k === 0 ? s.y : traj[k - 1]!;
          const vy = k === 0 ? s.vy : traj[k]! - traj[k - 1]!;
          if ((y >= low && vy >= 0) || (y >= low + 25 * FP && vy > -3 * FP)) return k;
        }
        return -1;
      };
      let due = -1;
      let key = false;
      let setup = false;
      if (!keyDone.has(tg.idx) && untilKey <= APPROACH) {
        // Approach: the ideal (set-up tap, key tick) pair. The key may slide a few ticks off the
        // barrier's middle; one set-up tap brings the disc to the key height on time.
        const floor = HOVER_WORLD_BOTTOM - HOVER_DISC_R - 8 * FP;
        let safeUntil = 0;
        while (safeUntil < traj.length && traj[safeUntil]! < floor) safeUntil++;
        const heightBefore = (P: number, u: number) => {
          if (P < 0) return u <= 0 ? s.y : traj[u - 1]!;
          return (P === 0 ? s.y : traj[P - 1]!) + RISE[u - 1 - P]!;
        };
        let best = { P: -1, u: -1, cost: Infinity };
        for (let u = Math.max(0, untilKey - KEY_SLACK); u <= untilKey + KEY_SLACK; u++) {
          const shift = Math.abs(u - untilKey) * 1.5 * FP;
          if (safeUntil >= u) {
            const c = Math.abs(heightBefore(-1, u) - tg.keyY) + shift;
            if (c < best.cost) best = { P: -1, u, cost: c };
          }
          if (setupDone.has(tg.idx)) continue;
          for (let P = 0; P <= Math.min(u - MIN_TAP_GAP, safeUntil); P++) {
            const c = Math.abs(heightBefore(P, u) - tg.keyY) + shift;
            if (c < best.cost) best = { P, u, cost: c };
          }
        }
        const climb = best.u < 0 || (best.cost > 25 * FP && (best.P < 0 ? heightBefore(-1, Math.max(0, best.u)) : heightBefore(best.P, best.u)) > tg.keyY);
        if (climb && !setupDone.has(tg.idx)) {
          // Too low for one set-up tap: keep climbing first.
          const k = dipK(Math.min(tg.keyY, floor - 20 * FP));
          if (k >= 0) due = t + k;
        } else if (best.P >= 0) {
          due = t + best.P;
          setup = true;
        } else {
          due = t + Math.max(0, best.u);
          key = true;
        }
      } else if (!keyDone.has(tg.idx)) {
        // Cruise: keep bobbing so the dips sit at the key height.
        const k = dipK(tg.keyY);
        if (k >= 0) due = t + k;
      } else if (s.vy > 0) {
        // After the key tap: only catch the disc if it would drop out through the gap.
        const k = dipK(tg.keyY + 10 * FP);
        if (k >= 0) due = t + k;
      }
      if (due >= 0 && due - t <= commitLead) {
        pending = commit(due, t, tg.scale);
        pendingKey = key ? tg.idx : -1;
        pendingSetup = setup ? tg.idx : -1;
      }
    }
    if (pending !== null && t >= pending && t - lastTap >= MIN_TAP_GAP) {
      pending = null;
      if (pendingKey >= 0) keyDone.add(pendingKey);
      if (pendingSetup >= 0) setupDone.add(pendingSetup);
      pendingSetup = -1;
      pendingKey = -1;
      lastTap = t;
      return true;
    }
    return false;
  }, init);
};
