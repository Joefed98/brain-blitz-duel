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
 * Competence fix (ctx.fixes, Oct 2026): a player who knows the game flies the line that forgives
 * their own timing, not the one with the most room only if every tap lands on its tick. Among the
 * best plans by room, the one whose room stays largest with each of its taps a timing error (one sd
 * of the level's jitter at this barrier) early or late is flown. (Without it the bot often keyed a
 * barrier on a hard-falling tap just before the entry, the line a few ticks of lateness ruins: the
 * slow, wide first barriers crashed average players about as often as the fast narrow ones.) A gold
 * star is then gone for only when that forgiving room still keeps the player's margin: the base
 * score is protected first. When no one- or two-tap line keeps room (a far climb at speed, a
 * sliding gap), every tap sequence through the pass is weighed (dpPlan), as a player hammers or
 * holds off to make a gap they can see they otherwise miss; and the line through a barrier must
 * leave the next barrier's gap within reach (lookAhead), as a player looks one barrier further.
 * elite and perfect always plan this way (perfect's jitter is 0); weak, a first-timer who doesn't
 * know the lines yet, never does.
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
const STAR_TRY: Record<SkillLevel, number> = { weak: 0.1, average: 0.25, good: 0.5, great: 0.75, near: 0.9, elite: 1, perfect: 1 };
/** Least room (px) to the gap's edges a player accepts to brush a star (risk appetite). */
const STAR_ROOM: Record<SkillLevel, number> = { weak: 10, average: 10, good: 10, great: 10, near: 10, elite: 10, perfect: 10 };
/** Read error on where a sliding gap will be, px per tick ahead (1 world px = 1 phone px). */
const READ: Record<SkillLevel, number> = { weak: 0.4, average: 0.3, good: 0.2, great: 0.13, near: 0.08, elite: 0.06, perfect: 0 };
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

export const bot: SkillBot = ({ game, seed, human, fixes }) => {
  const level = human.level;
  /** The forgiving-line fix (see above): the core levels only with ctx.fixes; elite and perfect always; never weak (a first-timer doesn't know the lines). */
  const ROBUST = level !== "weak" && (Boolean(fixes) || level === "elite" || level === "perfect");
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

  const target = (s: HoverState, seen: HoverState, t: number, from = -1): Target | null => {
    let idx = from >= 0 && from < seen.pillars.length ? from : -1;
    for (let i = seen.gates; from < 0 && i < seen.pillars.length; i++) {
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
  type Ranked = { taps: number[]; v: number; room: number };
  const plan = (s: HoverState, tg: Target): { first: number; room: number; ranked: Ranked[] } => {
    const ranked: Ranked[] = [];
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
    /** Every plan considered (ROBUST): its taps (offsets), nominal value and the star height it passes at. */
    const cands: { taps: number[]; v: number; starY: number | null }[] = [];
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
    const noTap = { ...best };
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
        if (ROBUST) cands.push({ taps: [u], v, starY: inside ? null : starAt(yu1) });
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
        if (ROBUST) cands.push({ taps: [P, u], v, starY: starAt(yu) });
        if (v > best.v) best = { first: P, v, room };
      }
    }
    if (ROBUST && cands.length) {
      // The forgiving line: of the best plans, the one whose room holds up with each tap a timing sd early or late.
      const D = Math.round((human.p.timingSdMs * tg.scale) / (1000 / 60));
      const pathRoom = (taps: number[]) => {
        let yy = s.y;
        let vv = s.vy;
        let r = Infinity;
        for (let k = 0; k <= tg.exit; k++) {
          vv = taps.includes(k) ? HOVER_IMPULSE : clampV(vv + HOVER_GRAVITY);
          yy += vv;
          if (yy < CEIL - 4 * FP || yy > FLOOR + 4 * FP) return -100 * FP;
          if (k >= E) {
            const yk = yy - tg.slope * (k - tg.centre);
            r = Math.min(r, yk - tg.lo, tg.hi - yk);
          }
        }
        return r;
      };
      const robustRoom = (taps: number[]) => {
        let r = pathRoom(taps);
        if (D > 0)
          for (let i = 0; i < taps.length; i++)
            for (const d of [-D, D]) {
              const shifted = taps.slice();
              shifted[i] = Math.max(0, shifted[i]! + d);
              r = Math.min(r, pathRoom(shifted));
            }
        return r;
      };
      cands.sort((a, b) => b.v - a.v);
      // The no-tap line has no timing to get wrong: its room as planned. The best plans with and without the star are weighed.
      let rb = noTap;
      if (noTap.v > -Infinity) ranked.push({ taps: [], v: noTap.v, room: noTap.room });
      const starred = cands.filter((c) => c.v >= 500 * FP);
      for (const c of [...starred.slice(0, 16), ...cands.filter((c) => c.v < 500 * FP).slice(0, 16)]) {
        const room = robustRoom(c.taps);
        const v = value(room, c.v >= 500 * FP ? c.starY : null, c.taps.length);
        ranked.push({ taps: c.taps, v, room });
        if (v > rb.v) rb = { first: c.taps[0]!, v, room };
      }
      if (rb.v > -Infinity) best = rb;
    }
    ranked.sort((a, b) => b.v - a.v);
    return { first: best.first, room: best.room, ranked };
  };

  /**
   * ROBUST: when no one- or two-tap line keeps room, every tap sequence through the pass (taps at least
   * MIN_TAP_GAP apart, the floor and ceiling kept), as a dynamic programme over the disc's height,
   * speed and time since the last tap: the sequence with the most room (maximin), and its first tap.
   */
  /** A rescue plan stands until a tap is made (the flight to its first tap is the one it planned). */
  const rescueCache = new Map<string, { at: number; room: number }>();
  const dpPlan = (s: HoverState, tg: Target, t: number) => {
    const key = `${tg.idx}:${lastTap}`;
    let hit = rescueCache.get(key);
    if (!hit || (hit.at >= 0 && hit.at < t)) {
      const r = dpCore(s.y, s.vy, Math.min(MIN_TAP_GAP, t - lastTap), 0, tg);
      hit = { at: r.first >= 0 ? t + r.first : -1, room: r.room };
      rescueCache.set(key, hit);
    }
    return { first: hit.at >= t ? hit.at - t : -1, room: hit.room };
  };
  const dpCore = (y0: number, vy0: number, since0: number, k0: number, tg: Target): { first: number; room: number } => {
    const E = Math.max(0, tg.entry);
    type Node = { y: number; vy: number; since: number; acc: number; first: number };
    let layer = new Map<number, Node>();
    layer.set(0, { y: y0, vy: vy0, since: since0, acc: Infinity, first: -1 });
    for (let k = k0; k <= tg.exit; k++) {
      const next = new Map<number, Node>();
      for (const n of layer.values()) {
        for (const tap of n.since >= MIN_TAP_GAP ? [false, true] : [false]) {
          const v = tap ? HOVER_IMPULSE : clampV(n.vy + HOVER_GRAVITY);
          const y = n.y + v;
          if (y < CEIL || y > FLOOR) continue;
          let acc = n.acc;
          if (k >= E) {
            const yk = y - tg.slope * (k - tg.centre);
            acc = Math.min(acc, yk - tg.lo, tg.hi - yk);
          }
          const since = tap ? 1 : Math.min(MIN_TAP_GAP, n.since + 1);
          // (After a tap the speed fixes the time since it until the next tap is allowed, so height (to 4 px) and speed key a node.)
          const key = (y >> 10) * 8192 + (v + 4096);
          const old = next.get(key);
          if (!old || acc > old.acc || (acc === old.acc && since > old.since)) next.set(key, { y, vy: v, since, acc, first: n.first < 0 && tap ? k : n.first });
        }
      }
      layer = next;
    }
    let best = { first: -1, room: -Infinity };
    for (const n of layer.values()) if (n.acc > best.room) best = { first: n.first, room: n.acc };
    return best;
  };

  /**
   * ROBUST: a player looks one barrier further. The line chosen for this barrier must leave the next one's
   * gap within the heights the disc can reach by its entry (falling, or tapping as fast as allowed); if it
   * doesn't, the plan that best keeps room in both is flown (the least of the two, the larger the better).
   */
  const reachCache = new Map<string, number>();
  const lookAhead = (s: HoverState, seen: HoverState, t: number, tg: Target, p: ReturnType<typeof plan>): { first: number; room: number } => {
    const nx = target(s, seen, t, tg.idx + 1);
    if (!nx || nx.exit <= tg.exit || p.ranked.length === 0) return p;
    const reach = (taps: number[]) => {
      const key = `${tg.idx}:${lastTap}:${taps.map((k) => k + t).join(",")}`;
      const hit = reachCache.get(key);
      if (hit !== undefined) return hit;
      let y = s.y;
      let vy = s.vy;
      let since = Math.min(MIN_TAP_GAP, t - lastTap);
      for (let k = 0; k <= tg.exit; k++) {
        const tap = taps.includes(k);
        vy = tap ? HOVER_IMPULSE : clampV(vy + HOVER_GRAVITY);
        y += vy;
        since = tap ? 1 : Math.min(MIN_TAP_GAP, since + 1);
      }
      // The band of heights the disc can be at by the next entry: falling all the way, or tapping as fast as allowed.
      let yf = y;
      let vf = vy;
      let yu = y;
      let vu = vy;
      let su = since;
      for (let k = tg.exit + 1; k <= Math.max(tg.exit + 1, nx.entry); k++) {
        vf = clampV(vf + HOVER_GRAVITY);
        yf = Math.min(FLOOR, yf + vf);
        const tap = su >= MIN_TAP_GAP && yu - ARC > CEIL;
        vu = tap ? HOVER_IMPULSE : clampV(vu + HOVER_GRAVITY);
        yu = Math.min(FLOOR, Math.max(CEIL, yu + vu));
        su = tap ? 1 : su + 1;
      }
      const r = Math.min(yf - nx.lo, nx.hi - yu);
      reachCache.set(key, r);
      return r;
    };
    const top = p.ranked[0]!;
    if (reach(top.taps) >= 4 * FP) return p;
    let best = { first: p.first, room: p.room, score: -Infinity };
    for (const c of p.ranked.slice(0, 12)) {
      const score = Math.min(c.room, reach(c.taps));
      if (score > best.score) best = { first: c.taps.length ? c.taps[0]! : -1, room: c.room, score };
    }
    return best;
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
            let p: { first: number; room: number } = plan(s, tg);
            if (ROBUST && p.room < 4 * FP) {
              const q = dpPlan(s, tg, t);
              if (q.room > p.room) p = q;
            } else if (ROBUST && p.room >= 0 && p.first <= commitLead) p = lookAhead(s, seen, t, tg, p as ReturnType<typeof plan>);
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
