/**
 * Scrumper (snip): each level the player first studies the ropes (think time,
 * longer for more ropes and harder bands), then works out a cut plan. The plan
 * shape (which rope first, roughly when) is the proved reference plan for the
 * level's template (fixtures/snip-rev3-proofs.json, the nearest pin wobble) —
 * what a player who has figured the level out would do; a weaker player on a
 * multi-rope level sometimes misreads the order and cuts in a wrong one.
 * Timing is chosen the way a careful player waits for the swing: the first
 * moment from when they are ready at which the plan feeds the apple, taken in
 * the middle of that window (the window is found on the noise-free sim before
 * any noise is drawn). Execution is human: each cut moment carries a reading
 * error and a timing error, the swipe is a ~45-px stroke across the rope at a
 * point clear of the other ropes with aim and angle error (so it can miss, or
 * catch a neighbouring rope), a missed swipe is retried one reaction later,
 * and after each cut the player re-times the rest from what the apple is now
 * doing. Only the better players go for the golden leaf. A failed level is
 * gone (the game moves straight on), so mistakes cost apples, not time.
 */
import { readFileSync } from "node:fs";
import { inputAt, recordInput, type ArcadeInputEvent } from "../../../src/lib/arcade/engine";
import { SNIP_BANDS_V3, SNIP_BANDS_V6, SNIP_BANDS_V7, SNIP_CONFIG, SNIP_PROVEN_FIRST, SNIP_INPUT_CUT, SNIP_LEVEL_TICKS, type SnipState } from "../../../src/lib/arcade/snip";
import { driveEvents, type SkillBot } from "../bot";
import type { SkillLevel } from "../human";

type Plan = [number, number][];
interface Proof {
  fast: { plan: Plan } | null;
  leaf: { plan: Plan } | null;
}
const PROOFS: Record<string, Record<string, Proof>> = {
  ...JSON.parse(readFileSync(new URL("../../fixtures/snip-rev3-proofs.json", import.meta.url), "utf8")),
  // Tuning E's tall templates (snipRev 5).
  ...JSON.parse(readFileSync(new URL("../../fixtures/snip-rev5-proofs.json", import.meta.url), "utf8")),
  // snipRev 6's new tall templates.
  ...JSON.parse(readFileSync(new URL("../../fixtures/snip-rev6-proofs.json", import.meta.url), "utf8")),
};
// snipRev 7's fixed copies (SNIP_PROVEN_FIRST on) have only per-deal plans (fixtures/snip-rev7-proofs.json):
// their reference plans at wobble −10, 0 and +10 are the plans proven for those deals with every pin moved alike.
{
  const symbols = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const deals: Record<string, { pins: number; plans: Plan[]; deal: string }> = JSON.parse(readFileSync(new URL("../../fixtures/snip-rev7-proofs.json", import.meta.url), "utf8"));
  for (const [t, d] of Object.entries(deals)) {
    if (Number(t) < SNIP_PROVEN_FIRST) continue;
    const at = (w: number) => {
      const idx = Array.from({ length: d.pins }, () => w / 5 + 2).reduce((a, k) => a * 5 + k, 0);
      return { fast: { plan: d.plans[symbols.indexOf(d.deal[idx]!)]! }, leaf: null };
    };
    PROOFS[t] = { "-10": at(-10), "0": at(0), "10": at(10) };
  }
}

/** World px per phone px (a 360-px-wide view on a ~390-px phone). */
const WORLD_PER_PX = SNIP_CONFIG.viewW / 390;
/** Reading error on the right cut moment (ticks sd): judging where the swing is. */
const READ: Record<SkillLevel, number> = { average: 5, good: 3.5, great: 2.5, near: 1.5 };
/** Shortest gap between two deliberate swipes (ticks). */
const GAP: Record<SkillLevel, number> = { average: 20, good: 16, great: 14, near: 12 };
/** Chance of going for the golden leaf on a level. */
const LEAF_GO: Record<SkillLevel, number> = { average: 0.1, good: 0.35, great: 0.6, near: 0.85 };

function bandOf(template: number): number {
  if ((SNIP_BANDS_V3.hard as readonly number[]).includes(template) || SNIP_BANDS_V6.hard.includes(template) || SNIP_BANDS_V7.hard.includes(template)) return 2;
  if ((SNIP_BANDS_V3.medium as readonly number[]).includes(template) || SNIP_BANDS_V6.medium.includes(template) || SNIP_BANDS_V7.medium.includes(template)) return 1;
  return 0;
}

/** The ideal swipe the checks use: short, across the rope next to its pin. */
function idealCut(s: SnipState, i: number): Omit<ArcadeInputEvent, "t"> {
  const r = s.ropes[i]!;
  const x = (r.x[0]! + r.x[1]!) / 512;
  const y = (r.y[0]! + r.y[1]!) / 512;
  const dx = (r.y[1]! - r.y[0]!) / 256;
  const dy = (r.x[0]! - r.x[1]!) / 256;
  const L = Math.max(1, Math.hypot(dx, dy));
  return { k: SNIP_INPUT_CUT, a: Math.round(x - (dx / L) * 15), b: Math.round(y - (dy / L) * 15), c: Math.round(x + (dx / L) * 15), d: Math.round(y + (dy / L) * 15) };
}

function permutations(n: number): number[][] {
  if (n <= 1) return [[0]];
  const out: number[][] = [];
  for (const p of permutations(n - 1)) for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), n - 1, ...p.slice(i)]);
  return out;
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  const init = game.init(seed) as SnipState;
  const history: SnipState[] = [];
  const lag = human.lagTicks();

  /** Noise-free: does this plan (level ticks) feed the apple from `from`, and take the leaf? */
  const tryPlan = (from: SnipState, plan: Plan): { fed: boolean; leaf: boolean } => {
    let s = from;
    const log: ArcadeInputEvent[] = [];
    const lvl = s.level;
    const eaten = s.eaten;
    const stars = s.stars;
    while (!game.isOver(s) && s.level === lvl) {
      const due = plan.find(([, at]) => at === s.levelTick + 1);
      if (due && s.ropes[due[0]]?.alive) recordInput(log, { ...idealCut(s, due[0]), t: s.tick + 1 }, game.inputRanges);
      s = game.step(s, inputAt(log, s.tick + 1));
    }
    return { fed: s.eaten > eaten, leaf: s.stars > stars };
  };

  /**
   * The first window (scanning start shifts in `stepT` ticks from `lo`) in which
   * the plan shape works, and its middle; null when none within `span`.
   */
  const timeShape = (from: SnipState, shape: Plan, lo: number, span: number, needLeaf: boolean, stepT = 3): Plan | null => {
    const first = shape[0]![1];
    const ok = (d: number) => {
      const plan = shape.map(([r, at]) => [r, at + d] as [number, number]);
      if (plan.some(([, at]) => at > SNIP_LEVEL_TICKS - 2)) return false;
      const res = tryPlan(from, plan);
      return res.fed && (!needLeaf || res.leaf);
    };
    const d0 = lo - first;
    let start: number | null = null;
    for (let d = d0; d <= d0 + span; d += stepT) {
      if (ok(d)) {
        start = d;
        break;
      }
    }
    if (start === null) return null;
    let end = start;
    for (let k = 0; k < 6; k++) {
      if (!ok(end + stepT)) break;
      end += stepT;
    }
    const mid = Math.round((start + end) / 2);
    return shape.map(([r, at]) => [r, at + mid] as [number, number]);
  };

  // Per-level plan state.
  let levelSeen = -1;
  let plan: Plan = [];
  let next = 0;
  let fireAt = Infinity;
  let believe = false; // a misread plan: no re-timing (the player thinks it is right)
  let wantLeaf = false;
  let retryAt = -1;
  let pendingCheck: { rope: number; at: number } | null = null;

  const scheduleNext = (s: SnipState) => {
    if (next >= plan.length) {
      fireAt = Infinity;
      return;
    }
    const [, at] = plan[next]!;
    const moving = Math.abs(s.sx - s.sox) + Math.abs(s.sy - s.soy) > 256;
    const err = human.normal() * READ[level] + human.timingTicks(moving ? 1.5 : 1);
    fireAt = Math.max(s.levelTick + 1, Math.round(at + err));
  };

  const planLevel = (s: SnipState) => {
    const tpl = SNIP_CONFIG.templates[s.template]!;
    const n = s.ropes.length;
    const crooks = tpl.hooks?.length ?? 0;
    const band = bandOf(s.template);
    const ready = human.thinkTicks(1400 + 900 * band + 500 * (n - 1) + 600 * crooks);
    // Nearest proved wobble (the mean pin offset).
    let jit = 0;
    for (let i = 0; i < n; i++) jit += s.ropes[i]!.x[0]! / 256 - tpl.pins[i]![0];
    jit /= n;
    const key = jit < -5 ? "-10" : jit > 5 ? "10" : "0";
    const proof = PROOFS[String(s.template)]?.[key] ?? { fast: null, leaf: null };
    wantLeaf = !!proof.leaf && human.chance(LEAF_GO[level]);
    let shape: Plan = (wantLeaf ? proof.leaf!.plan : proof.fast?.plan ?? proof.leaf?.plan ?? []).map(([r, at]) => [r, at] as [number, number]);
    if (!shape.length) shape = Array.from({ length: n }, (_, i) => [i, 30 + 20 * i] as [number, number]);
    // Order: a weaker player can misread which rope goes first.
    believe = false;
    // (A crook's vine, rope n or later, is cut after its catch; only the pins' ropes can be misordered.)
    const slots = shape.map(([r], i) => (r < n ? i : -1)).filter((i) => i >= 0);
    if (n >= 2 && slots.length === n) {
      const right = slots.map((i) => shape[i]![0]);
      const orders = permutations(n);
      const values = orders.map((p) => (p.every((r, i) => r === right[i]) ? 1 : 0));
      const k = human.pick(values, 0.6 + 0.5 * band + 0.25 * (n - 2));
      if (values[k] === 0) {
        const swapped = shape.map(([r, at]) => [r, at] as [number, number]);
        slots.forEach((i, j) => (swapped[i]![0] = orders[k]![j]!));
        shape = swapped;
        believe = true;
      }
    }
    const lo = Math.max(ready, s.levelTick + 1);
    let timed = believe ? null : timeShape(s, shape, lo, 150, wantLeaf);
    if (!timed && wantLeaf && proof.fast && !believe) {
      wantLeaf = false;
      shape = proof.fast.plan.map(([r, at]) => [r, at] as [number, number]);
      timed = timeShape(s, shape, lo, 150, false);
    }
    if (!timed && !believe) {
      // The remembered shape does not fit this swing: work out another (other proved
      // shapes for the level, then the same order with the later cuts spaced differently).
      const alts: Plan[] = [];
      for (const p of Object.values(PROOFS[String(s.template)] ?? {})) for (const q of [p.fast, p.leaf]) if (q) alts.push(q.plan);
      for (const f of [0.5, 1.6, 2.4]) alts.push(shape.map(([r, at], i) => [r, Math.round(shape[0]![1] + (at - shape[0]![1]) * f) + i * 2] as [number, number]));
      for (const alt of alts) {
        timed = timeShape(s, alt, lo, 120, false, 4);
        if (timed) break;
      }
      wantLeaf = false;
    }
    // Spread cuts to the player's own pace.
    plan = timed ?? shape.map(([r, at]) => [r, at + Math.max(0, lo - shape[0]![1])] as [number, number]);
    for (let i = 1; i < plan.length; i++) if (plan[i]![1] - plan[i - 1]![1] < GAP[level]) plan[i]![1] = plan[i - 1]![1] + GAP[level];
    next = 0;
    retryAt = -1;
    pendingCheck = null;
    scheduleNext(s);
  };

  /** After a cut: re-time the rest of the plan from what the apple is doing now. */
  const retime = (s: SnipState) => {
    if (believe || next >= plan.length) return;
    const rest = plan.slice(next);
    const lo = Math.max(s.levelTick + GAP[level], rest[0]![1] - 12);
    const timed = timeShape(s, rest, lo, 60, wantLeaf, 3) ?? (wantLeaf ? timeShape(s, rest, lo, 60, false, 3) : null);
    if (timed) plan = [...plan.slice(0, next), ...timed];
  };

  /** The swipe a hand makes across rope i, as seen: a stroke through a point clear of the other ropes. */
  const swipe = (seen: SnipState, i: number): Omit<ArcadeInputEvent, "t"> => {
    const rope = seen.ropes[i]!;
    const n = rope.x.length;
    const pts = (k: number) => (k < n ? [rope.x[k]! / 256, rope.y[k]! / 256] : [seen.sx / 256, seen.sy / 256]) as [number, number];
    let bestK = 1;
    let bestD = -1;
    let clear = 80;
    for (let k = 1; k < n - 1; k++) {
      const [x0, y0] = pts(k);
      const [x1, y1] = pts(k + 1);
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      let dmin = 1e9;
      seen.ropes.forEach((o, j) => {
        if (j === i || !o.alive) return;
        for (let q = 0; q < o.x.length; q++) dmin = Math.min(dmin, Math.hypot(o.x[q]! / 256 - mx, o.y[q]! / 256 - my));
        dmin = Math.min(dmin, Math.hypot(seen.sx / 256 - mx, seen.sy / 256 - my) + 10);
      });
      // Prefer the clear middle of the rope; a little weight against the apple end.
      const score = Math.min(dmin, 80) - Math.abs(k - (n - 1) / 2) * 2;
      if (score > bestD) {
        bestD = score;
        bestK = k;
        clear = Math.min(dmin, 80);
      }
    }
    const [x0, y0] = pts(bestK);
    const [x1, y1] = pts(bestK + 1);
    const cx = (x0 + x1) / 2 + human.aim(WORLD_PER_PX);
    const cy = (y0 + y1) / 2 + human.aim(WORLD_PER_PX);
    let ang = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2 + human.normal() * 0.25;
    if (Math.cos(ang) < 0) ang += Math.PI; // swipe left-to-right-ish
    // A firm stroke across it, kept short of any other rope nearby.
    const half = Math.max(16, Math.min(50, clear - 10)) * (0.85 + 0.3 * human.u());
    return {
      k: SNIP_INPUT_CUT,
      a: Math.round(cx - Math.cos(ang) * half),
      b: Math.round(cy - Math.sin(ang) * half),
      c: Math.round(cx + Math.cos(ang) * half),
      d: Math.round(cy + Math.sin(ang) * half),
    };
  };

  return driveEvents(
    game,
    (s: SnipState) => {
      history.push(s);
      if (s.level !== levelSeen) {
        levelSeen = s.level;
        planLevel(s);
      }
      const seen = history[Math.max(0, history.length - 1 - lag)]!;
      const view = seen.level === s.level ? seen : s;
      // Did the last swipe cut its rope? (Noticed one reaction later.)
      if (pendingCheck && s.levelTick >= pendingCheck.at) {
        const rope = pendingCheck.rope;
        pendingCheck = null;
        if (s.ropes[rope]?.alive) retryAt = s.levelTick + 1;
        else {
          next += 1;
          retime(s);
          scheduleNext(s);
        }
      }
      if (next >= plan.length) return null;
      const rope = plan[next]![0];
      // A crook's vine not there yet (no catch so far): wait for it.
      if (rope >= s.ropes.length) return null;
      if (!s.ropes[rope]?.alive && !pendingCheck) {
        // Already gone (cut along with another): move on.
        next += 1;
        retime(s);
        scheduleNext(s);
        return null;
      }
      const due = s.levelTick + 1 >= fireAt && !pendingCheck;
      const retry = retryAt >= 0 && s.levelTick + 1 >= retryAt && !pendingCheck;
      if (!due && !retry) return null;
      if (human.slip(0.5) && !retry) {
        // Fumbled the swipe: nothing this time, notice and go again.
        retryAt = s.levelTick + human.reactTicks();
        fireAt = Infinity;
        return null;
      }
      retryAt = -1;
      fireAt = Infinity;
      pendingCheck = { rope, at: s.levelTick + human.reactTicks() };
      // A vine the lagged view has not seen yet is swiped where it is now.
      return swipe(view.ropes[rope] ? view : s, rope);
    },
    init,
  );
};
