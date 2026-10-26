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
 *
 * hoverRev 9 (the 200 expansion): a player goes for a tight gate (the narrow gold gap) instead of the
 * main gap, for a star chain and for a shield bubble at level-dependent rates. Once past the
 * barrier before a chain or bubble they plan their next taps to sweep it (most chain stars
 * touched), the same way as for a gap, with the same timing error. The decisions are only drawn
 * where a course has the features, so every older revision plays exactly as before.
 */
import {
  HOVER_DISC_R,
  HOVER_DISC_X,
  HOVER_GRAVITY,
  HOVER_IMPULSE,
  HOVER_PILLAR_W,
  HOVER_SCROLL_MAX,
  HOVER_SCROLL_START,
  HOVER_SHIELD_R,
  HOVER_STAR_R,
  HOVER_TERMINAL,
  hoverBottom,
  hoverCentreY,
  hoverGapTop,
  hoverScroll,
  hoverStarY,
  pillarX,
  type HoverState,
} from "../../../src/lib/arcade/hover";
import { driveTaps, type SkillBot } from "../bot";

/** Chance of deciding to go for a gold star (each one sits near a lip: a risky line). */
const STAR_TRY: Record<string, number> = { average: 0.25, good: 0.5, great: 0.75, near: 0.9 };
/** Least room (px) to the gap's edges a player accepts to brush a star (risk appetite). */
const STAR_ROOM: Record<string, number> = { average: 10, good: 10, great: 10, near: 10 };
/** Read error on where a sliding gap will be, px per tick ahead (1 world px = 1 phone px). */
const READ: Record<string, number> = { average: 0.3, good: 0.2, great: 0.13, near: 0.08 };
/**
 * hoverRev 9: chance of going for a tight gate, a whole star chain, a shield bubble and (once in a tight
 * gate) its centre line, by tier: the elite player chases every feature, the near-perfect player most.
 */
const TIGHT_TRY: Record<string, number> = { weak: 0.02, average: 0.03, good: 0.1, great: 0.2, near: 0.85, elite: 1 };
const CHAIN_TRY: Record<string, number> = { weak: 0.05, average: 0.08, good: 0.15, great: 0.35, near: 0.9, elite: 1 };
const SHIELD_TRY: Record<string, number> = { weak: 0.15, average: 0.15, good: 0.4, great: 0.6, near: 0.7, elite: 0.7 };
const CENTRE_TRY: Record<string, number> = { weak: 0, average: 0, good: 0, great: 0.1, near: 0.3, elite: 1 };
// Measuring aid (scripts/hover-x200-bands.ts): HOVER_TRY="tight,chain,shield" scales the three rates.
if (typeof process !== "undefined" && process.env.HOVER_TRY) {
  const [t, c, sh] = process.env.HOVER_TRY.split(",").map(Number);
  for (const k of Object.keys(TIGHT_TRY)) {
    TIGHT_TRY[k]! *= t ?? 1;
    CHAIN_TRY[k]! *= c ?? 1;
    SHIELD_TRY[k]! *= sh ?? 1;
  }
}
/** hoverRev 9: a chain or bubble is planned for from this many ticks before the barrier ahead of it. */
const GOAL_LEAD = 30;
/** hoverRev 9: the least room (to a tight gate's edges) a centre-line chase keeps. */
const CTR_ROOM = 3 * 256;
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
  /** hoverRev 9: the gap aimed for is a tight gate. */
  tight?: boolean;
  /** hoverRev 9: the centre line being aimed for in that gate: its height and the depth window (tick offsets). */
  ctr?: { c: number; from: number; to: number };
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  const tier = human.tier;
  const lag = human.lagTicks();
  /** The flawless player of hover-x200-check's 200 proof (scripts/hover-x200-record.ts): also threads every gold star. */
  const FLAWLESS = (human as { flawless?: boolean }).flawless === true;
  /** hoverRev 9: the room a chase keeps to the barriers either side of it (a player leaves room for their own timing). */
  const GUARD = (FLAWLESS ? 2 : 10) * FP;
  /** Commit point: a tap can no longer be corrected within about a reaction time of it. */
  const commitLead = Math.round(human.p.reactionMs[0] / (1000 / 60));
  const history: HoverState[] = [];
  /** Per barrier: chosen gap (0/1), star decision, the slide-read error draw and (hoverRev 9) the tight-gate decision. */
  const choice = new Map<number, { gap: number; star: boolean; readErr: number; tight?: boolean; centre?: boolean }>();
  /** hoverRev 9: chains and shield bubbles to sweep, each decided once, when first planned for. */
  const goalChoice = new Map<string, boolean>();
  let pending: number | null = null;
  let lastTap = -100;
  /** hoverRev 9: the current goal's plan (its first tap's tick), kept until a tap or a new goal. */
  let goalCache: { key: string; lastTap: number; at: number } | null = null;
  /** The tick being decided (for the tap searches' spacing from the last tap). */
  let curT = 0;
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
      if (p.tightTop !== undefined) {
        c.tight = human.chance(TIGHT_TRY[tier]!);
        if (c.tight) c.centre = human.chance(CENTRE_TRY[tier]!);
      }
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
    if (c.tight && p.tightTop !== undefined) {
      top = p.tightTop;
      h = p.tightH ?? 0;
    } else if (c.gap === 1 && p.gap2Top !== undefined) {
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
      scale: 1 + 0.4 * speedFrac + (moving ? 0.3 : 0) + (c.tight ? 0.2 : 0),
      ...(c.tight ? { tight: true } : {}),
      ...(c.tight && c.centre && p.tightTop !== undefined
        ? { ctr: { c: hoverCentreY(p), from: Math.ceil(at(left - HOVER_DISC_X)), to: Math.floor(at(left + HOVER_PILLAR_W - HOVER_DISC_X)) } }
        : {}),
    };
  };

  /**
   * hoverRev 9: the chain or shield bubble being swept, once the barrier before it is behind:
   * each item's tick offset from now (as perceived) and height. Null when none is wanted.
   */
  type Goal = {
    key: string;
    items: { k: number; y: number }[];
    reach: number;
    /** The barrier before the goal, while it is still being passed. */
    guard: { from: number; to: number; lo: number; hi: number } | null;
    /** The barrier after it: the plan must still pass it (any of its gaps, as they will be). */
    next: { from: number; to: number; gaps: (k: number) => [number, number][] } | null;
  };
  const goalAhead = (s: HoverState, seen: HoverState, t: number, tg: Target | null): Goal | null => {
    if (!seen.xp) return null;
    const want = (key: string, rate: number) => {
      let w = goalChoice.get(key);
      if (w === undefined) {
        w = human.chance(rate);
        goalChoice.set(key, w);
      }
      return w;
    };
    // The open space after barrier `after` is planned for from just before the saucer reaches that
    // barrier (its pass kept as a hard limit), or once it is past it.
    const active = (after: number) => after === seen.gates - 1 || (tg !== null && tg.idx === after && tg.entry <= GOAL_LEAD);
    const guard = (after: number) => (tg && tg.idx === after ? { from: Math.max(0, tg.entry), to: tg.exit, lo: tg.lo, hi: tg.hi } : null);
    const at = (x0: number, after: number) => Math.round(seen.tick + (x0 - HOVER_DISC_X - seen.distance) / hoverScroll(after + 1) - t);
    const next = (after: number): Goal["next"] => {
      const p = seen.pillars[after + 1];
      if (!p) return null;
      const from = Math.max(0, at(p.x0 - HOVER_DISC_R, after));
      const to = at(p.x0 + HOVER_PILLAR_W + HOVER_DISC_R, after);
      return {
        from,
        to,
        gaps: (k) => {
          const list: [number, number][] = [[hoverGapTop(p, t + k) + HOVER_DISC_R, hoverGapTop(p, t + k) + p.gapH - HOVER_DISC_R]];
          if (p.gap2Top !== undefined) list.push([p.gap2Top + HOVER_DISC_R, p.gap2Top + (p.gap2H ?? 0) - HOVER_DISC_R]);
          return list;
        },
      };
    };
    for (const [c, chain] of (seen.chains ?? []).entries()) {
      if (!active(chain.after)) continue;
      const items = chain.stars.map((star, j) => ({ k: at(star.x0, chain.after), y: star.y, j })).filter((it) => it.k >= 0 && !(s.chainHits ?? []).includes(c * 8 + it.j));
      // A star already gone by: the chain is broken, so it is no longer worth chasing.
      if (items.length < chain.stars.length - (s.chainHits ?? []).filter((id) => id >> 3 === c).length) continue;
      if (items.length && want(`c${c}`, CHAIN_TRY[tier]!)) return { key: `c${c}`, items, reach: HOVER_DISC_R + HOVER_STAR_R - 2 * FP, guard: guard(chain.after), next: next(chain.after) };
    }
    if (!s.shield) {
      for (const [k, pickup] of (seen.pickups ?? []).entries()) {
        if (!active(pickup.after) || (s.pickupsTaken ?? []).includes(k)) continue;
        const off = at(pickup.x0, pickup.after);
        if (off >= 0 && want(`s${k}`, SHIELD_TRY[tier]!)) return { key: `s${k}`, items: [{ k: off, y: pickup.y }], reach: HOVER_DISC_R + HOVER_SHIELD_R - 2 * FP, guard: guard(pickup.after), next: next(pickup.after) };
      }
    }
    return null;
  };

  /** hoverRev 9: the tap sequence touching the most items (the barrier still being passed kept clear); the first tap's offset. */
  const goalPlan = (s: HoverState, goal: Goal): number | null => {
    const byTick = new Map<number, number[]>();
    for (const it of goal.items) byTick.set(it.k, [...(byTick.get(it.k) ?? []), it.y]);
    const n = goal.next;
    const horizon = Math.max(Math.max(...goal.items.map((it) => it.k)) + 2, n ? n.to + 1 : 0);
    const g = goal.guard;
    // Branch and bound: a path can at best still touch every item ahead of it.
    const ahead = Array.from({ length: horizon + 1 }, (_, k) => goal.items.filter((it) => it.k >= k).length * 1000);
    const found = searchTaps(
      s,
      horizon,
      (k, y, acc) => {
        if (g && k >= g.from && k <= g.to && Math.min(y - g.lo, g.hi - y) < GUARD) return -Infinity;
        if (n && k >= n.from && k <= n.to && !n.gaps(k).some(([lo, hi]) => y - lo >= GUARD && hi - y >= GUARD)) return -Infinity;
        return acc + 1000 * (byTick.get(k)?.filter((iy) => Math.abs(iy - y) <= goal.reach).length ?? 0);
      },
      0,
      false,
      (k, acc) => acc + (ahead[k + 1] ?? 0),
    );
    // Nothing touched, or no way through the barriers either side: not worth it (null).
    return found.v < 500 ? null : found.first;
  };

  /**
   * hoverRev 9: the best of every tap sequence over `horizon` ticks (taps at least MIN_TAP_GAP
   * apart, the floor and ceiling avoided), judged by folding `step` over the path from `start`
   * (pruned when the fold only ever falls). Returns the first tap's offset (-1: none) and the value.
   */
  const searchTaps = (
    s: HoverState,
    horizon: number,
    step: (k: number, y: number, acc: number) => number,
    start: number,
    prune: boolean,
    bound?: (k: number, acc: number) => number,
  ): { first: number; v: number } => {
    let best = -Infinity;
    let first = -1;
    const rec = (k: number, y: number, vy: number, last: number, acc: number, f: number) => {
      if (k >= horizon) {
        if (acc > best) {
          best = acc;
          first = f;
        }
        return;
      }
      for (const tap of [false, true]) {
        if (tap && k - last < MIN_TAP_GAP) continue;
        const v = clampV(tap ? HOVER_IMPULSE : vy + HOVER_GRAVITY);
        const ny = y + v;
        if (ny < CEIL || ny > FLOOR) continue;
        const a = step(k, ny, acc) - (tap ? 1 : 0);
        if (a === -Infinity || (prune && a <= best) || (bound && bound(k, a) <= best)) continue;
        rec(k + 1, ny, v, tap ? k : last, a, f < 0 && tap ? k : f);
      }
    };
    rec(0, s.y, s.vy, lastTap - curT, start, -1);
    return { first, v: best };
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
    // hoverRev 9: a centre-line chase scores a plan by how far it strays from the line over the gate's depth
    // (while it keeps CTR_ROOM of room to the gate's edges); otherwise by its room, as before.
    const ctr = tg.ctr;
    const devOf = (path: (k: number) => number) => {
      let d = 0;
      if (ctr) for (let k = Math.max(0, ctr.from); k <= ctr.to; k++) d = Math.max(d, Math.abs(path(k) - ctr.c));
      return d;
    };
    const value = (room: number, starY: number | null, taps: number, dev = 0) =>
      ctr ? (room >= CTR_ROOM ? 1000 * FP - dev : room) - taps * 0.3 * FP : room -
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
        v: value(room, tg.centre >= 0 ? traj[Math.min(N - 1, tg.centre)]! : null, 0, devOf((k) => traj[k]!)),
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
        const v = value(room, inside ? null : starAt(yu1), 1, devOf((k) => (k < u ? traj[k]! : yu1 + RISE[k - u]!)));
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
        const v = value(room, starAt(yu), 2, devOf((k) => (k < u ? yp + RISE[k - P]! : yu + RISE[k - u]!)));
        if (v > best.v) best = { first: P, v, room };
      }
    }
    // D (hoverRev 9, a tight gate only): every tap sequence over the pass, when two taps leave too little room.
    if (tg.tight && best.room < 8 * FP) {
      const found = searchTaps(s, tg.exit + 1, (k, y, acc) => (k >= E ? Math.min(acc, y - tg.lo, tg.hi - y) : acc), Infinity, true);
      if (found.v > best.room) best = { first: found.first, v: found.v, room: found.v };
    }
    // E (the flawless player of the 200 proof only): a gold star taken by any tap sequence that keeps 2 px of room.
    if (FLAWLESS && tg.star !== null && best.v < 1000 * FP && tg.centre >= 0) {
      const star = tg.star;
      const TOOK = 1e9;
      const found = searchTaps(
        s,
        tg.exit + 1,
        (k, y, acc) => {
          const took = acc >= TOOK / 2 ? 1 : 0;
          let room = acc - took * TOOK;
          if (k >= E) room = Math.min(room, y - tg.lo, tg.hi - y);
          if (room < 2 * FP) return -Infinity;
          return room + (took || (k === tg.centre && Math.abs(y - star) <= reach) ? TOOK : 0);
        },
        1e8,
        false,
        (k, acc) => (acc >= TOOK / 2 || k < tg.centre ? Infinity : acc),
      );
      if (found.v >= TOOK / 2) best = { first: found.first, v: found.v, room: found.v - TOOK };
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
      curT = t;
      const seen = history[Math.max(0, history.length - 1 - lag)]!;
      if (pending === null && t - lastTap >= MIN_TAP_GAP) {
        const tg = target(s, seen, t);
        let goal = goalAhead(s, seen, t, tg);
        let due = -1;
        // A plan stands until a tap is made or the goal changes (the flight in between is predictable);
        // a goal with no safe plan is given up, and the barrier ahead flown as usual.
        if (goal && (!goalCache || goalCache.key !== goal.key || goalCache.lastTap !== lastTap)) {
          const f = goalPlan(s, goal);
          if (f === null) {
            goalChoice.set(goal.key, false);
            goalCache = null;
            goal = null;
          } else goalCache = { key: goal.key, lastTap, at: f >= 0 ? t + f : -1 };
        }
        if (goal && goalCache) {
          const first = goalCache.at >= t ? goalCache.at - t : -1;
          due = first >= 0 ? t + first : -1;
          if (due >= 0 && due - t <= commitLead) pending = commit(due, t, 1);
        } else if (tg) {
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

/**
 * Random play (the arcade rule's floor): taps at random moments, 6 to 30 ticks apart, with no look at the
 * course at all. It must stay near 0.
 */
export const randomBot: SkillBot = ({ game, seed, human }) => {
  let next = human.int(6, 30);
  return driveTaps(
    game,
    (_s: HoverState, t) => {
      if (t < next) return false;
      next = t + human.int(6, 30);
      return true;
    },
    game.init(seed) as HoverState,
  );
};
