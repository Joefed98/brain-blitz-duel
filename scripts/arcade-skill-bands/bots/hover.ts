/**
 * Hover: a flappy-style tapper. A tap sets the disc's climb to a fixed kick, so
 * every arc rises ~63 px over ~18 ticks and its top is nearly flat. A player
 * who knows the game threads each barrier on one arc: as a barrier comes up
 * they settle on their last one or two taps before it (a set-up tap and the
 * key tap) so that the arc carries the disc through the gap with the most room
 * (or through a gold star they chose to go for). That plan is the ideal one
 * for the barrier as they see it, computed exactly from the disc's own
 * (predictable) motion; it stands in for experience. Far from a barrier they
 * just keep the disc bobbing around the height they will need.
 *
 * Every tap is an anticipated moment: it is committed about a reaction time
 * before it is due and lands with the level's timing jitter, wider on the fast
 * late course and on sliding gaps. The barrier ahead is seen late (tracking
 * lag); where a sliding gap will be at the pass is judged with an error that
 * grows with how far ahead it has to be judged. Two-gap barriers: the nearer-looking gap (blurred pick).
 * Slips: now and then a tap goes well off its moment.
 */
import type { SkillLevel } from "../human";
import {
  HOVER_DISC_R,
  HOVER_DISC_X,
  HOVER_GRAVITY,
  HOVER_IMPULSE,
  HOVER_PILLAR_W,
  HOVER_SCROLL_MAX,
  HOVER_SCROLL_START,
  HOVER_STAR_R,
  HOVER_TERMINAL,
  hoverBottom,
  hoverGapTop,
  hoverScroll,
  hoverStarY,
  pillarX,
  type HoverState,
} from "../../../src/lib/arcade/hover";
import { driveTaps, type SkillBot } from "../bot";

/** Chance of deciding to go for a gold star (each one sits near a lip: a risky line). */
const STAR_TRY: Record<SkillLevel, number> = { weak: 0, average: 0.25, good: 0.5, great: 0.75, near: 0.9, elite: 0.975, perfect: 0.975 };
/** Least room (px) to the gap's edges a player accepts to brush a star (risk appetite). */
const STAR_ROOM: Record<SkillLevel, number> = { weak: 10, average: 10, good: 10, great: 10, near: 10, elite: 10, perfect: 10 };
/** Read error on where a sliding gap will be, px per tick ahead (1 world px = 1 phone px). */
const READ: Record<SkillLevel, number> = { weak: 0.4, average: 0.3, good: 0.2, great: 0.13, near: 0.08, elite: 0.055, perfect: 0.055 };
/** Fastest deliberate tapping: 8 ticks apart (7.5 taps a second). */
const MIN_TAP_GAP = 8;
/** The last taps before a barrier are planned once its entry is this close (ticks). */
const APPROACH = 50;

const FP = 256;
const clampV = (v: number) => Math.max(-HOVER_TERMINAL, Math.min(HOVER_TERMINAL, v));

/** RISE[j]: height change j+1 ticks into a tap (the tap tick is j = 0), fixed-point (negative = up). */
const RISE = (() => {
  const out: number[] = [];
  let v = HOVER_IMPULSE;
  let y = 0;
  for (let j = 0; j < 200; j++) {
    if (j > 0) v = clampV(v + HOVER_GRAVITY);
    y += v;
    out.push(y);
  }
  return out;
})();
const ARC = -Math.min(...RISE);
/** The floor margin line; set per run from the world being played (Tuning E's taller world or 560). */
let FLOOR = 0;
const CEIL = HOVER_DISC_R + 6 * FP;

interface Target {
  idx: number;
  /** Ticks from now until the disc overlaps the barrier, until its middle, until it is clear. */
  entry: number;
  centre: number;
  exit: number;
  /** Allowed disc-centre range in the gap (as perceived at the pass). */
  lo: number;
  hi: number;
  /** How fast a sliding gap moves through the pass (fixed-point per tick; 0 when still). */
  slope: number;
  /** A star being chased: its height at the pass. */
  star: number | null;
  scale: number;
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  const lag = human.lagTicks();
  /** Commit point: a tap can no longer be corrected within about a reaction time of it. */
  const commitLead = Math.round(human.p.reactionMs[0] / (1000 / 60));
  const history: HoverState[] = [];
  /** Per barrier: chosen gap (0/1), star decision, and the slide-read error draw. */
  const choice = new Map<number, { gap: number; star: boolean; readErr: number }>();
  let pending: number | null = null;
  let lastTap = -100;
  const init = game.init(seed) as HoverState;
  FLOOR = hoverBottom(init) - HOVER_DISC_R - 6 * FP;

  const target = (s: HoverState, seen: HoverState, t: number): Target | null => {
    let idx = -1;
    for (let i = seen.gates; i < seen.pillars.length; i++) {
      const p = seen.pillars[i]!;
      if (pillarX(p, seen.distance) + HOVER_PILLAR_W - (HOVER_DISC_X - HOVER_DISC_R) >= 0) {
        idx = i;
        break;
      }
    }
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
      c = {
        gap,
        star: p.starDy !== undefined && human.chance(STAR_TRY[level]!),
        readErr: human.normal(),
      };
      choice.set(idx, c);
    }
    // Timing of the pass as perceived (lagged view, scrolled on at the speed seen); offsets from now.
    const speed = hoverScroll(seen.gates);
    const left = pillarX(p, seen.distance);
    const at = (dx: number) => seen.tick + dx / speed - t;
    const entry = Math.ceil(at(left - (HOVER_DISC_X + HOVER_DISC_R)));
    const exit = Math.floor(at(left + HOVER_PILLAR_W - (HOVER_DISC_X - HOVER_DISC_R)));
    const centre = Math.round(at(left + HOVER_PILLAR_W / 2 - HOVER_DISC_X));
    let top: number;
    let h: number;
    let moving = false;
    let slope = 0;
    if (c.gap === 1 && p.gap2Top !== undefined) {
      top = p.gap2Top;
      h = p.gap2H ?? 0;
    } else {
      h = p.gapH;
      top = hoverGapTop(p, seen.tick);
      if (p.movePhase !== undefined) {
        moving = true;
        // The slide is regular and in view, so its position at the pass is judged from the
        // lagged view, with a read error growing with how far ahead that is.
        const until = Math.max(0, centre + t - seen.tick);
        top = hoverGapTop(p, seen.tick + until) + c.readErr * READ[level]! * until * FP;
        slope = (hoverGapTop(p, seen.tick + until + 3) - hoverGapTop(p, seen.tick + until - 3)) / 6;
      }
    }
    const star =
      c.star && p.starDy !== undefined
        ? top + ((hoverStarY(p, seen.tick) ?? 0) - hoverGapTop(p, seen.tick))
        : null;
    const speedFrac =
      (hoverScroll(s.gates) - HOVER_SCROLL_START) / (HOVER_SCROLL_MAX - HOVER_SCROLL_START);
    return {
      idx,
      entry,
      centre,
      exit,
      lo: top + HOVER_DISC_R,
      hi: top + h - HOVER_DISC_R,
      slope,
      star,
      scale: 1 + 0.4 * speedFrac + (moving ? 0.3 : 0),
    };
  };

  /**
   * The ideal plan for the barrier ahead: no tap, one tap at u, or a set-up tap at P then
   * the key tap at u, scored by the least room to the gap's edges while overlapping (and,
   * when chasing a star, whether the disc touches it). Returns the first tap's offset
   * (-1: no tap needed yet) and the plan's room.
   */
  const plan = (s: HoverState, tg: Target): { first: number; room: number } => {
    const N = Math.max(tg.exit + 2, 2);
    const traj: number[] = [];
    let y = s.y;
    let vy = s.vy;
    for (let k = 0; k < N; k++) {
      vy = clampV(vy + HOVER_GRAVITY);
      y += vy;
      traj.push(y);
    }
    const before = (k: number) => (k === 0 ? s.y : traj[k - 1]!);
    const reach = HOVER_DISC_R + HOVER_STAR_R - 2 * FP;
    const E = Math.max(0, tg.entry);
    const value = (room: number, starY: number | null, taps: number) =>
      room -
      taps * 0.3 * FP +
      (tg.star !== null &&
      starY !== null &&
      Math.abs(starY - tg.star) <= reach &&
      room > STAR_ROOM[level]! * FP
        ? 1000 * FP
        : 0);
    // Room along an explicit path over the overlap window.
    const roomOf = (path: (k: number) => number) => {
      let r = Infinity;
      for (let k = E; k <= tg.exit; k++) {
        const yk = path(k) - tg.slope * (k - tg.centre);
        r = Math.min(r, yk - tg.lo, tg.hi - yk);
      }
      return r;
    };
    let floorOk = N;
    for (let k = 0; k < N; k++)
      if (traj[k]! > FLOOR) {
        floorOk = k;
        break;
      }
    let best = { first: -1, v: -Infinity, room: -Infinity };
    // A: no tap.
    const noTapRoom = floorOk >= N ? roomOf((k) => traj[k]!) : -Infinity;
    if (floorOk >= N) {
      const room = noTapRoom;
      best = {
        first: -1,
        v: value(room, tg.centre >= 0 ? traj[Math.min(N - 1, tg.centre)]! : null, 0),
        room,
      };
    }
    // Window extremes of an arc started at u (relative), for u at or before entry.
    const ext = (u: number) => {
      let mn = Infinity;
      let mx = -Infinity;
      for (let k = E; k <= tg.exit; k++) {
        const r = RISE[k - u]! - tg.slope * (k - tg.centre);
        if (r < mn) mn = r;
        if (r > mx) mx = r;
      }
      return { mn, mx };
    };
    const uMax = Math.min(tg.exit, floorOk);
    for (let u = 0; u <= uMax; u++) {
      const inside = u > E;
      const { mn, mx } = inside ? { mn: 0, mx: 0 } : ext(u);
      const starAt = (yu: number) => (tg.centre >= u ? yu + RISE[tg.centre - u]! : null);
      // B: one tap at u.
      const yu1 = before(u);
      // Inside the barrier a tap is only made to save the pass (it would throw the disc high for the next one).
      if (yu1 - ARC > CEIL && (!inside || noTapRoom < 3 * FP)) {
        const room = inside
          ? roomOf((k) => (k < u ? traj[k]! : yu1 + RISE[k - u]!))
          : Math.min(yu1 + mn - tg.lo, tg.hi - (yu1 + mx));
        // A tap inside the barrier only ever saves the pass; nobody hops up mid-gap for a star.
        const v = value(room, inside ? null : starAt(yu1), 1);
        if (v > best.v) best = { first: u, v, room };
      }
      // C: set-up at P, key at u (key at or before entry).
      if (inside) continue;
      for (let P = 0; P <= u - MIN_TAP_GAP; P++) {
        const yp = before(P);
        if (yp - ARC <= CEIL) continue;
        const yu = yp + RISE[u - 1 - P]!;
        if (yu > FLOOR || yu - ARC <= CEIL) continue;
        const room = Math.min(yu + mn - tg.lo, tg.hi - (yu + mx));
        const v = value(room, starAt(yu), 2);
        if (v > best.v) best = { first: P, v, room };
      }
    }
    return { first: best.first, room: best.room };
  };

  const commit = (due: number, t: number, scale: number) => {
    let err = human.timingTicks(scale);
    if (human.slip(0.2)) err += (human.chance(0.5) ? 1 : -1) * human.int(5, 12);
    return Math.max(t, due + err);
  };

  return driveTaps(
    game,
    (s: HoverState, t) => {
      history.push(s);
      const seen = history[Math.max(0, history.length - 1 - lag)]!;
      if (pending === null && t - lastTap >= MIN_TAP_GAP) {
        const tg = target(s, seen, t);
        let due = -1;
        if (tg) {
          // Cruise height: dips where the arc's top would sit a little above the gap's middle (or on the star).
          const apex = tg.star ?? (tg.lo + tg.hi) / 2 - 3 * FP;
          const low = Math.min(FLOOR - 20 * FP, apex + ARC);
          let cruise = false;
          if (tg.entry <= APPROACH) {
            const p = plan(s, tg);
            if (p.room < -10 * FP && tg.entry > 2) cruise = true;
            else due = p.first >= 0 ? t + p.first : -1;
          } else cruise = true;
          if (cruise) {
            let y = s.y;
            let vy = s.vy;
            for (let k = 0; k <= commitLead; k++) {
              if ((y >= low && vy >= 0) || (y >= low + 25 * FP && vy > -3 * FP)) {
                due = t + k;
                break;
              }
              vy = clampV(vy + HOVER_GRAVITY);
              y += vy;
            }
          }
          if (due >= 0 && due - t <= commitLead) pending = commit(due, t, tg.scale);
        }
      }
      if (pending !== null && t >= pending && t - lastTap >= MIN_TAP_GAP) {
        pending = null;
        lastTap = t;
        return true;
      }
      return false;
    },
    init,
  );
};
