/**
 * Slice: the human draws swipes through foods as they fly.
 *
 * Perception: a food (or chilli, or special) is noticed one reaction after it
 * comes on screen, and the screen is read with the tracking lag. Where a food
 * will be when the finger reaches it is a prediction whose error grows with how
 * far ahead it is (lag + finger travel).
 *
 * Each swipe is planned once and drawn ballistically: pick the most urgent
 * noticed food (specials first, then the one about to fall away), chain in
 * nearby foods, and draw a path through where they will be, at a human finger
 * speed, with aim error at every waypoint and timing error on the touch-down.
 * Between swipes the finger lifts, travels to the next start and the player
 * picks the next target (a short think). Chillis the player has noticed are
 * steered round (dropping the food nearest one, or waiting); the check is
 * sometimes skipped (a slip), and a chilli not yet noticed is not avoided.
 * Combo play (holding off until three foods line up, reaching further to
 * string them) belongs to the better levels only.
 */
import {
  sliceMultiplier,
  sliceObjectAt,
  sliceSuppressed,
  sliceV9Bonus,
  SLICE_COMBO_MAX,
  SLICE_V9_BONUS_CAP,
  SLICE_HUD_H,
  SLICE_INPUT_BEGIN,
  SLICE_INPUT_END,
  SLICE_INPUT_SWIPE,
  sliceMaxPath,
  sliceRadius,
  sliceTicketAt,
  sliceWorldW,
  SLICE_V9_GOLD,
  SLICE_V11_CLOSE,
  SLICE_V11_DODGE_CAP,
  SLICE_V11_DODGE_POINTS,
  SLICE_R,
  sliceWorldH,
  type SliceObject,
  type SliceState,
} from "../../../src/lib/arcade/slice";
import type { SkillLevel } from "../human";
import { driveEvents, type SkillBot } from "../bot";
import { sliceOracleEvents } from "../../slice-standard-oracle";

/** Finger top speed while swiping, px a tick (world px are phone px here). */
const FINGER: Record<SkillLevel, number> = { weak: 20, average: 26, good: 32, great: 38, near: 44, elite: 46, perfect: 48 };
/** Prediction error per tick of look-ahead, px. */
const READ: Record<SkillLevel, number> = { weak: 0.65, average: 0.5, good: 0.35, great: 0.25, near: 0.15, elite: 0.12, perfect: 0 };
/** Chance per swipe decision of playing for a combo (waiting for three, reaching further). */
const COMBO: Record<SkillLevel, number> = { weak: 0, average: 0, good: 0.35, great: 0.65, near: 0.85, elite: 0.92, perfect: 1 };
/**
 * Competence fix (ctx.fixes, Oct 2026): the multiplier stays live for 10 s after each triple and
 * every cut in that time earns it, so a player who knows this stops holding off for triples while
 * ×3 is live with time to spare and cuts everything (the v1 bot held off on ~90 % of swipes and
 * let a sixth of the foods fall, even flawless). The chance a swipe decision uses that knowledge.
 */
const COMBO_KEEP: Record<SkillLevel, number> = { weak: 0, average: 0, good: 0.3, great: 0.6, near: 0.85, elite: 0.95, perfect: 1 };
/** Combo time (ticks) a player leaves before going for the next triple to renew it. */
const RENEW_TICKS = 240;
/**
 * Elite and flawless feature policy (base scoring first): a golden fruit or the ticket's food goes
 * first, and a ticket narrows the swipe to its food, only when no other food is about to fall away
 * (within this many ticks); and features stop once the bonus is at its cap.
 */
const SAFE_FEATURE: Record<SkillLevel, boolean> = { weak: false, average: false, good: false, great: false, near: false, elite: true, perfect: true };
const SAFE_EXIT = 60;
/** How far (px) a player will stretch a swipe to take in another food: casual, and when playing for a combo. */
const REACH = 110;
const COMBO_REACH = 200;
/** Clearance a careful player keeps from a noticed chilli, px beyond the two radii. */
const BOMB_MARGIN = 18;
/** A fast stroke at a moving target is less precise than a tap: aim error multiplier. */
const SWIPE_AIM = 1.8;
/** Base time to choose the next target between swipes, ms. */
const NEXT_MS = 260;
/** sliceRev 9: the chance a swipe goes after a golden fruit or the ticket's food first, by level. */
const FEATURE: Record<SkillLevel, number> = { weak: 0.05, average: 0.15, good: 0.35, great: 0.6, near: 0.75, elite: 0.85, perfect: 1 };

/**
 * sliceRev 11 (the arcade scoring standard): the chance a swipe goes first for a food close to a noticed chilli
 * (a dodge: the food's skin within SLICE_V11_CLOSE px of the chilli's), by level, until the dodges are full. Only
 * sliceRev 11 states read it, so every earlier revision plays as before.
 */
const DODGE: Record<SkillLevel, number> = { weak: 0, average: 0, good: 0.1, great: 0.3, near: 0.5, elite: 0.75, perfect: 1 };
/** A dodge target keeps at least this much (px) between its centre and the chilli's, past the bomb clearance. */
const DODGE_SAFE = SLICE_R * 2 + BOMB_MARGIN + 6;
/** sliceRev 11: an elite player also reads that a food drifting off a side is about to be lost (its urgency). */
const SIDES: Record<SkillLevel, boolean> = { weak: false, average: false, good: false, great: false, near: false, elite: true, perfect: true };

interface Pt {
  x: number;
  y: number;
}

export const bot: SkillBot = ({ game, seed, human, fixes }) => {
  // sliceRev 11: the flawless level (no error, each seed's ceiling) is the oracle player of the scoring standard
  // (scripts/slice-standard-oracle.ts): every food cut, the combo kept live, golden fruit, tickets and dodges full.
  if (human.level === "perfect" && (game.init(seed) as SliceState).v11) return { events: sliceOracleEvents(seed) };
  const level = human.level;
  // sliceRev 6: the taller board (the bot reads the stored round's own world).
  const SLICE_WORLD_H = sliceWorldH(game.init(seed) as SliceState);
  // sliceRev 9: the larger board's width.
  const SLICE_WORLD_W = sliceWorldW(game.init(seed) as SliceState);
  const speed = FINGER[level]!;
  const lag = human.lagTicks();
  const history: SliceState[] = [];
  /** Tick each object was noticed (index into state.objects). */
  const noticed = new Map<number, number>();
  /** The stroke being drawn: remaining points, one per tick. */
  let stroke: Pt[] = [];
  let pending: "begin" | "draw" | "end" | null = null;
  let finger: Pt = { x: SLICE_WORLD_W / 2, y: SLICE_WORLD_H - 80 };
  let readyAt = human.reactTicks();
  let comboIntent: boolean | null = null;

  const posAt = (s: SliceState, i: number, tick: number): Pt | null => {
    const at = sliceObjectAt(s.objects[i]!, tick, s.slowFrom, s.mayo);
    return at ? { x: at.x / 256, y: at.y / 256 } : null;
  };
  const onScreen = (p: Pt | null, r: number) => !!p && p.y - r <= SLICE_WORLD_H && p.y + r >= SLICE_HUD_H;
  const radius = (o: SliceObject) => sliceRadius(o);

  /** Ticks until a food can no longer be cut (falls off or leaves). */
  const exitIn = (s: SliceState, i: number, t: number): number => {
    const o = s.objects[i]!;
    for (let k = 0; k <= 180; k += 3) {
      const p = posAt(s, i, t + k);
      if (!p) return k;
      // sliceRev 11, elite: a food drifting off a side can no longer be cut either.
      if (s.v11 && SIDES[level] && (p.x - radius(o) > SLICE_WORLD_W || p.x + radius(o) < 0)) return k;
      if (k > 0 && p.y - radius(o) > SLICE_WORLD_H - 10) {
        const prev = posAt(s, i, t + k - 3);
        if (prev && p.y > prev.y) return k; // on its way down and out
      }
    }
    return 180;
  };

  /** Plans a path through the foods `ids` starting at tick `t0`; returns the points and pass times. */
  const route = (s: SliceState, ids: number[], t0: number, now: number) => {
    // Predicted positions, refined once for the finger's travel time.
    let pts = ids.map((i) => posAt(s, i, t0));
    if (pts.some((p) => !p)) return null;
    const order = ids.map((_, k) => k).sort((a, b) => pts[a]!.x - pts[b]!.x);
    const firstNear = Math.hypot(pts[order[0]!]!.x - finger.x, pts[order[0]!]!.y - finger.y) <= Math.hypot(pts[order.at(-1)!]!.x - finger.x, pts[order.at(-1)!]!.y - finger.y);
    if (!firstNear) order.reverse();
    let times: number[] = [];
    for (let pass = 0; pass < 2; pass++) {
      times = [];
      let tt = t0 + 35 / speed;
      let prev: Pt | null = null;
      for (const k of order) {
        const p = pts[k]!;
        if (prev) tt += Math.hypot(p.x - prev.x, p.y - prev.y) / speed;
        times.push(tt);
        prev = p;
      }
      const next = order.map((k, j) => posAt(s, ids[k]!, Math.round(times[j]!)));
      if (next.some((p) => !p)) return null;
      const re: (Pt | null)[] = [...pts];
      order.forEach((k, j) => (re[k] = next[j]!));
      pts = re;
    }
    const way = order.map((k) => pts[k]!);
    // Lead in and out along the line through the first and last foods.
    const dir = (a: Pt, b: Pt) => {
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      return d < 1 ? { x: 1, y: 0 } : { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
    };
    const d0 = way.length > 1 ? dir(way[0]!, way[1]!) : { x: finger.x <= way[0]!.x ? 1 : -1, y: 0.25 };
    const d1 = way.length > 1 ? dir(way.at(-2)!, way.at(-1)!) : d0;
    const lead = way.length > 1 ? 35 : 45;
    const start = { x: way[0]!.x - d0.x * lead, y: way[0]!.y - d0.y * lead };
    const end = { x: way.at(-1)!.x + d1.x * lead, y: way.at(-1)!.y + d1.y * lead };
    let length = Math.hypot(way[0]!.x - start.x, way[0]!.y - start.y) + Math.hypot(end.x - way.at(-1)!.x, end.y - way.at(-1)!.y);
    for (let j = 1; j < way.length; j++) length += Math.hypot(way[j]!.x - way[j - 1]!.x, way[j]!.y - way[j - 1]!.y);
    void now;
    return { pts: [start, ...way, end], times, length };
  };

  /** Densifies a path into one finger position per tick at the finger speed. */
  const sample = (pts: Pt[]): Pt[] => {
    const out: Pt[] = [];
    let cur = pts[0]!;
    let carry = 0;
    for (let j = 1; j < pts.length; j++) {
      const b = pts[j]!;
      const d = Math.hypot(b.x - cur.x, b.y - cur.y);
      let along = speed - carry;
      while (along <= d) {
        out.push({ x: cur.x + ((b.x - cur.x) * along) / d, y: cur.y + ((b.y - cur.y) * along) / d });
        along += speed;
      }
      carry = d - (along - speed);
      cur = b;
      if (j === pts.length - 1 && carry > 0.5) out.push(b);
    }
    return out;
  };

  /** Closest approach (px) between the drawn path and a chilli over the stroke's ticks. */
  const bombGap = (s: SliceState, path: Pt[], t0: number, b: number): number => {
    let best = Infinity;
    path.forEach((p, k) => {
      const q = posAt(s, b, t0 + 1 + k);
      if (q) best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y));
    });
    return best;
  };

  const clampPt = (p: Pt): Pt => ({ x: Math.max(0, Math.min(SLICE_WORLD_W, Math.round(p.x))), y: Math.max(0, Math.min(SLICE_WORLD_H, Math.round(p.y))) });

  const plan = (s: SliceState, seen: SliceState, t: number): boolean => {
    const foods: { i: number; exit: number; special: boolean }[] = [];
    const bombs: number[] = [];
    seen.objects.forEach((o, i) => {
      if (seen.slicedAt[i] || sliceSuppressed(seen, o)) return;
      const at = noticed.get(i);
      if (at === undefined || at > t) return;
      if (!onScreen(posAt(s, i, t), radius(o))) return;
      if (o.bomb) bombs.push(i);
      else foods.push({ i, exit: exitIn(s, i, t), special: o.special !== 0 });
    });
    if (foods.length === 0) return false;
    // Attention: one target at a time — specials first, then whatever leaves soonest.
    // sliceRev 9: a player using the features puts a golden fruit, then the ticket's food, first.
    const ticket = s.v9 ? sliceTicketAt(s, t) : -1;
    let want = s.v9 && human.chance(FEATURE[level]!);
    // sliceRev 11: a golden fruit (worth over three foods) is never left for the base.
    if (want && SAFE_FEATURE[level] && !s.v11) {
      // Base first: leave the features while another food is about to fall, or once the bonus is full.
      const isFeature = (i: number) => {
        const o = s.objects[i]!;
        if (o.special) return false;
        if (o.colour === SLICE_V9_GOLD) return true;
        return ticket >= 0 && o.colour === s.tickets![ticket]!.kind;
      };
      const urgent = foods.some((f) => !isFeature(f.i) && !s.objects[f.i]!.special && f.exit < SAFE_EXIT);
      if (urgent || (!s.v11 && sliceV9Bonus(s) >= SLICE_V9_BONUS_CAP)) want = false;
    }
    // sliceRev 11: a food close to (but safely clear of) a noticed chilli goes first, for a dodge.
    const dodgeFor = new Set<number>();
    if (s.v11 && SLICE_V11_DODGE_POINTS * (s.dodges ?? 0) < SLICE_V11_DODGE_CAP && bombs.length && human.chance(DODGE[level]!)) {
      for (const f of foods) {
        const o = s.objects[f.i]!;
        if (o.special) continue;
        const p = posAt(s, f.i, t + 8);
        if (!p) continue;
        const close = bombs.some((b) => {
          const q = posAt(s, b, t + 8);
          if (!q) return false;
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          return d >= DODGE_SAFE && d <= radius(o) + radius(s.objects[b]!) + SLICE_V11_CLOSE - 4;
        });
        if (close) dodgeFor.add(f.i);
      }
    }
    const rank = (i: number) => {
      const o = s.objects[i]!;
      if (dodgeFor.has(i)) return 3;
      if (!want) return 0;
      if (o.colour === SLICE_V9_GOLD && !o.special) return 2;
      return ticket >= 0 && !o.special && o.colour === s.tickets![ticket]!.kind ? 1 : 0;
    };
    foods.sort((a, b) => Number(b.special) - Number(a.special) || rank(b.i) - rank(a.i) || a.exit - b.exit);
    if (dodgeFor.size) {
      // A dodge target leads the swipe (bottles still first).
      const k = foods.findIndex((f) => dodgeFor.has(f.i));
      if (k > 0 && !foods[0]!.special) foods.unshift(...foods.splice(k, 1));
    }
    // Working a ticket: only its food (and golden fruit, bottles) go in the swipe, so the count isn't reset.
    const open = ticket >= 0 && (s.ticketCuts?.[ticket] ?? 0) < s.tickets![ticket]!.count;
    const focus = want && open && foods.some((f) => rank(f.i) >= 1 && s.objects[f.i]!.colour !== SLICE_V9_GOLD);
    if (focus) foods.splice(0, foods.length, ...foods.filter((f) => f.special || rank(f.i) >= 1 || s.objects[f.i]!.colour === SLICE_V9_GOLD));
    let anchor = foods[0]!;
    if (human.slip()) anchor = foods[human.int(0, foods.length - 1)]!;
    // Whether to play for a combo is decided once per swipe, and held while waiting for it.
    // ×3 live with time to spare: no holding off, but still a long stroke through everything near.
    let keep = false;
    if (comboIntent === null && fixes && s.comboLive && sliceMultiplier(s.streak) >= SLICE_COMBO_MAX && s.comboUntil - t > RENEW_TICKS && human.chance(COMBO_KEEP[level]!)) {
      comboIntent = false;
      keep = true;
    }
    comboIntent ??= human.chance(COMBO[level]!);
    const combo = comboIntent;
    const reach = combo || keep ? COMBO_REACH : REACH;
    // Touch-down: travel from where the finger is, plus timing error.
    const a0 = posAt(s, anchor.i, t + 6);
    if (!a0) return false;
    const travel = Math.ceil(Math.hypot(a0.x - finger.x, a0.y - finger.y) / (speed * 1.3));
    const t0 = t + Math.max(2, travel) + Math.max(-2, human.timingTicks());
    const ids = [anchor.i];
    // Chain in other noticed foods near the anchor (as they will be around then).
    const near = foods
      .filter((f) => f.i !== anchor.i)
      .map((f) => {
        const p = posAt(s, f.i, t0 + 4);
        const q = posAt(s, anchor.i, t0 + 4);
        return { f, d: p && q ? Math.hypot(p.x - q.x, p.y - q.y) : Infinity };
      })
      .filter((x) => x.d <= reach)
      .sort((a, b) => a.d - b.d);
    for (const n of near) {
      const trial = route(s, [...ids, n.f.i], t0, t);
      if (trial && trial.length <= sliceMaxPath(s) - 25) ids.push(n.f.i);
    }
    // A combo player holds off for three in a line while nothing is about to drop.
    if (combo && ids.length < 3 && anchor.exit > 45 && !anchor.special && !dodgeFor.has(anchor.i)) {
      readyAt = t + 4;
      return false;
    }
    let r = route(s, ids, t0, t);
    if (!r) return false;
    let path = sample(r.pts);
    // Steer round noticed chillis (unless the check is skipped this time).
    if (bombs.length && !human.slip(1.5)) {
      for (let guard = 0; guard < 4; guard++) {
        const hit = bombs.find((b) => bombGap(s, path, t0, b) < SLICE_R * 2 + BOMB_MARGIN);
        if (hit === undefined) break;
        if (ids.length === 1) {
          readyAt = t + 5;
          return false;
        }
        // Drop the chained food nearest the chilli.
        const q = posAt(s, hit, t0 + 4)!;
        let worst = 1;
        let wd = Infinity;
        for (let k = 1; k < ids.length; k++) {
          const p = posAt(s, ids[k]!, t0 + 4);
          const d = p ? Math.hypot(p.x - q.x, p.y - q.y) : 0;
          if (d < wd) {
            wd = d;
            worst = k;
          }
        }
        ids.splice(worst, 1);
        r = route(s, ids, t0, t);
        if (!r) return false;
        path = sample(r.pts);
      }
    }
    // Execution: each waypoint carries aim error plus a read error that grows with look-ahead.
    const noisy = r.pts.map((p, k) => {
      const ahead = lag + (k === 0 ? t0 - t : (r!.times[Math.min(k - 1, r!.times.length - 1)] ?? t0) - t);
      const e = READ[level]! * Math.max(0, ahead);
      return clampPt({ x: p.x + human.aim(1, SWIPE_AIM) + e * human.normal(), y: p.y + human.aim(1, SWIPE_AIM) + e * human.normal() });
    });
    stroke = sample(noisy).map(clampPt);
    stroke.unshift(noisy[0]!);
    beginAt = t0;
    pending = "begin";
    comboIntent = null;
    return true;
  };

  let beginAt = 0;
  const init = game.init(seed) as SliceState;
  const { events } = driveEvents(game, (s: SliceState, t) => {
    history.push(s);
    const seen = history[Math.max(0, history.length - 1 - lag)]!;
    // Notice objects one reaction after they come on screen.
    for (let i = 0; i < s.objects.length; i++) {
      if (noticed.has(i)) continue;
      const o = s.objects[i]!;
      if (onScreen(posAt(s, i, s.tick), radius(o))) noticed.set(i, t + human.reactTicks());
    }
    if (pending === "begin") {
      if (t < beginAt) return null;
      const p = stroke.shift()!;
      finger = p;
      pending = "draw";
      return { k: SLICE_INPUT_BEGIN, a: p.x, b: p.y, c: 0, d: 0 };
    }
    if (pending === "draw") {
      let p = stroke.shift();
      while (p && p.x === finger.x && p.y === finger.y) p = stroke.shift();
      if (!p) {
        pending = null;
        readyAt = t + human.thinkTicks(NEXT_MS);
        return { k: SLICE_INPUT_END, a: 0, b: 0, c: 0, d: 0 };
      }
      const ev = { k: SLICE_INPUT_SWIPE, a: finger.x, b: finger.y, c: p.x, d: p.y };
      finger = p;
      return ev;
    }
    if (t >= readyAt && plan(s, seen, t) && t >= beginAt) {
      const p = stroke.shift()!;
      finger = p;
      pending = "draw";
      return { k: SLICE_INPUT_BEGIN, a: p.x, b: p.y, c: 0, d: 0 };
    }
    return null;
  }, init);
  return { events };
};
