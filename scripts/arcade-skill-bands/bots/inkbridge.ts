/**
 * Rainbow Bridge (inkbridge, inkRev 4).
 *
 * What a skilled player figures out: a line that pots the coin *when drawn by
 * hand* (a phone sends a point every 12 px, so the proved two-segment reference
 * is not drawable as is — a near-vertical stretch breaks into wall pieces). The
 * bot works that line out on the noise-free sim before any noise is drawn,
 * starting from the proved reference (or the proved gold-star line) and then the
 * generator's own family of ramps (spout → optional waypoint → over the pot),
 * preferring lines that still pot when shifted a few px (a careful player's
 * margin). On a moving pot it also finds the release phase; on live levels
 * (9–10) the short pre-release line plus the catch ramp drawn as soon as the
 * hand can get to the screen after RELEASE.
 *
 * What the human then does: thinks before each fresh level (less on a retry);
 * a weaker player sometimes misjudges where the line should end on a first
 * look; traces the line at a human drawing speed with a steady offset and a
 * wobble (aim error), so a good plan can still fail; presses RELEASE after a
 * short look, on a moving pot at the read moment (timing error plus a read error
 * that grows with the coin's flight time); on live levels moves the finger to
 * the screen one reaction after RELEASE and draws the ramp with a larger aim
 * error (judging where the coin will fall), lifting to commit it. A failed drop
 * resets the level (redrawn after a short rethink, no star try); three
 * failures end the run. Only the better players go for the gold stars.
 */
import { inputAt, recordInput, type ArcadeGame, type ArcadeInputEvent } from "../../../src/lib/arcade/engine";
import {
  INK_FAILS,
  INK_INPUT_LIFT,
  INK_INPUT_RELEASE,
  INK_INPUT_STROKE,
  INK_STEP_PX,
  INK_WORLD_H,
  INK_WORLD_W,
  inkIsLive,
  type InkLevel,
  type InkState,
} from "../../../src/lib/arcade/inkBridge";
import { driveEvents, Plan, type SkillBot } from "../bot";
import type { Human, SkillLevel } from "../human";

/** World px per phone px (the 390-wide world fills a ~390-px phone). */
const WORLD_PER_PX = INK_WORLD_W / 390;
/** Careful tracing speed for a pre-release line, px a tick. */
const DRAW: Record<SkillLevel, number> = { weak: 5, average: 6, good: 7, great: 8, near: 9, elite: 10, perfect: 10 };
/** Quick live-ramp stroke speed, px a tick. */
const DRAW_LIVE: Record<SkillLevel, number> = { weak: 8, average: 10, good: 12, great: 14, near: 16, elite: 17, perfect: 17 };
/** Moving pot: release read error per tick of coin flight (ticks of error per tick ahead). */
const READ: Record<SkillLevel, number> = { weak: 0.115, average: 0.09, good: 0.065, great: 0.045, near: 0.03, elite: 0.025, perfect: 0 };
/** Chance of going for the gold star on a level that has one (first attempt only). */
const STAR_GO: Record<SkillLevel, number> = { weak: 0, average: 0.1, good: 0.35, great: 0.6, near: 0.85, elite: 0.95, perfect: 1 };
/** The ideal live ramp is worked out for a hand that starts this many ticks after RELEASE. */
const IDEAL_LIVE_DELAY = 18;
const IDEAL_LIVE_SPEED = 12;
const SPOUT_Y = 50;
const SIM_BUDGET = 140;
const REFINE_BUDGET = 60;
/** Wobbled copies tried when judging how reliable a line is. */
const PROBES = 6;

type Ev = Omit<ArcadeInputEvent, "t">;

interface Ideal {
  strokes: number[][];
  /** Moving pot: release when (tick − phase) % period === 0. */
  phase: number;
  period: number;
  live: number[][];
  /** Ticks from release to potting (for the read error). */
  flight: number;
  ok: boolean;
  /** Wobbled copies (of PROBES) that still pot. */
  rel?: number;
}

/** The points a phone sends for a straight-segment polyline drawn steadily: every 12 px, rounded. */
function phonePoints(pts: readonly number[]): [number, number][] {
  // A finger moving steadily along the polyline: the phone sends a point whenever it is
  // 12 px from the last one sent, and the lift point.
  const out: [number, number][] = [[Math.round(pts[0]!), Math.round(pts[1]!)]];
  let lx = pts[0]!;
  let ly = pts[1]!;
  for (let i = 2; i < pts.length; i += 2) {
    const x0 = pts[i - 2]!;
    const y0 = pts[i - 1]!;
    const x1 = pts[i]!;
    const y1 = pts[i + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let k = 1; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n;
      const y = y0 + ((y1 - y0) * k) / n;
      if (Math.hypot(x - lx, y - ly) >= INK_STEP_PX) {
        out.push([Math.round(x), Math.round(y)]);
        lx = x;
        ly = y;
      }
    }
  }
  const ex = Math.round(pts[pts.length - 2]!);
  const ey = Math.round(pts[pts.length - 1]!);
  const last = out[out.length - 1]!;
  if (last[0] !== ex || last[1] !== ey) out.push([ex, ey]);
  return out;
}

/**
 * A live stroke as the phone sends it while the coin falls (inkInputQueue: the newest finger point
 * each tick, once it is 12 px from the last one sent): [ticks after the finger goes down, x, y],
 * for a finger moving `speed` px a tick along the polyline.
 */
function fingerPoints(pts: readonly number[], speed: number): [number, number, number][] {
  const out: [number, number, number][] = [[0, Math.round(pts[0]!), Math.round(pts[1]!)]];
  const legs: number[] = [];
  let total = 0;
  for (let i = 2; i < pts.length; i += 2) {
    const l = Math.hypot(pts[i]! - pts[i - 2]!, pts[i + 1]! - pts[i - 1]!);
    legs.push(l);
    total += l;
  }
  const at = (d: number): [number, number] => {
    for (let i = 0; i < legs.length; i++) {
      if (d <= legs[i]! || i === legs.length - 1) {
        const u = legs[i]! > 0 ? Math.min(1, d / legs[i]!) : 1;
        return [pts[2 * i]! + (pts[2 * i + 2]! - pts[2 * i]!) * u, pts[2 * i + 1]! + (pts[2 * i + 3]! - pts[2 * i + 1]!) * u];
      }
      d -= legs[i]!;
    }
    return [pts[pts.length - 2]!, pts[pts.length - 1]!];
  };
  let lx = pts[0]!;
  let ly = pts[1]!;
  for (let j = 1; ; j++) {
    const d = Math.min(total, j * speed);
    const [x, y] = at(d);
    const end = d >= total;
    if (Math.hypot(x - lx, y - ly) >= INK_STEP_PX || (end && (Math.round(x) !== out[out.length - 1]![1] || Math.round(y) !== out[out.length - 1]![2]))) {
      out.push([j, Math.round(x), Math.round(y)]);
      lx = x;
      ly = y;
    }
    if (end) break;
  }
  return out;
}

/** A polyline with every corner rounded off over `r` px (a hand rounds corners). */
function rounded(pts: readonly number[], r: number): number[] {
  const out = [pts[0]!, pts[1]!];
  for (let i = 2; i + 2 < pts.length; i += 2) {
    const [px, py, wx, wy, nx, ny] = [pts[i - 2]!, pts[i - 1]!, pts[i]!, pts[i + 1]!, pts[i + 2]!, pts[i + 3]!];
    const l1 = Math.max(1, Math.hypot(wx - px, wy - py));
    const l2 = Math.max(1, Math.hypot(nx - wx, ny - wy));
    const r1 = Math.min(r, l1 / 2);
    const r2 = Math.min(r, l2 / 2);
    const ax = wx - ((wx - px) * r1) / l1;
    const ay = wy - ((wy - py) * r1) / l1;
    const bx = wx + ((nx - wx) * r2) / l2;
    const by = wy + ((ny - wy) * r2) / l2;
    for (let k = 0; k <= 4; k++) {
      const u = k / 4;
      out.push(Math.round((1 - u) * (1 - u) * ax + 2 * (1 - u) * u * wx + u * u * bx), Math.round((1 - u) * (1 - u) * ay + 2 * (1 - u) * u * wy + u * u * by));
    }
  }
  out.push(pts[pts.length - 2]!, pts[pts.length - 1]!);
  return out;
}

function steep(pts: readonly number[]): boolean {
  for (let i = 2; i < pts.length; i += 2) {
    const dx = Math.abs(pts[i]! - pts[i - 2]!);
    const len = Math.hypot(pts[i]! - pts[i - 2]!, pts[i + 1]! - pts[i - 1]!);
    if (dx < 0.22 * len) return true;
  }
  return false;
}

const idealCache = new Map<string, Ideal>();

const clampX = (x: number) => Math.max(0, Math.min(INK_WORLD_W, Math.round(x)));
const clampY = (y: number) => Math.max(0, Math.min(INK_WORLD_H, Math.round(y)));

/**
 * Schedules one hand-drawn stroke from tick `t0`; returns the tick after its last point.
 * The finger moves `speed` px a tick; a point goes out each time it is 12 px from the last.
 */
function drawStroke(plan: Plan, human: Human, pts: number[], t0: number, speed: number, offScale = 1): number {
  // The planned points (as a phone samples the line), moved by the hand: a steady offset
  // for the whole stroke, a small error in its angle, and a slow smooth drift.
  const base = phonePoints(pts);
  const ox = human.aim(WORLD_PER_PX, offScale);
  const oy = human.aim(WORLD_PER_PX, offScale);
  const rot = (human.aim(WORLD_PER_PX, offScale) / 150);
  const [x0, y0] = base[0]!;
  let dx = 0;
  let dy = 0;
  const at = (p: [number, number]) => {
    dx = dx * 0.95 + human.aim(WORLD_PER_PX, 0.06);
    dy = dy * 0.95 + human.aim(WORLD_PER_PX, 0.06);
    const rx = x0 + (p[0] - x0) * Math.cos(rot) - (p[1] - y0) * Math.sin(rot);
    const ry = y0 + (p[0] - x0) * Math.sin(rot) + (p[1] - y0) * Math.cos(rot);
    return [clampX(rx + ox + dx), clampY(ry + oy + dy)] as const;
  };
  let t = t0;
  const first = at(base[0]!);
  plan.at(t, { k: INK_INPUT_STROKE, a: first[0], b: first[1], c: 1, d: 0 });
  let last = first;
  let travelled = 0;
  for (let i = 1; i < base.length; i++) {
    travelled += Math.hypot(base[i]![0] - base[i - 1]![0], base[i]![1] - base[i - 1]![1]);
    const p = at(base[i]!);
    if (p[0] === last[0] && p[1] === last[1]) continue;
    t = plan.at(Math.max(t + 1, t0 + Math.round(travelled / speed)), { k: INK_INPUT_STROKE, a: p[0], b: p[1], c: 0, d: 0 });
    last = p;
  }
  return t + 1;
}

/** Fixed bots: a live stroke flicked at `speed` px a tick, sent as the phone sends it (fingerPoints), moved by the hand as drawStroke. */
function drawLive(plan: Plan, human: Human, pts: number[], t0: number, speed: number, offScale = 1): number {
  const fp = fingerPoints(pts, speed);
  const ox = human.aim(WORLD_PER_PX, offScale);
  const oy = human.aim(WORLD_PER_PX, offScale);
  const rot = human.aim(WORLD_PER_PX, offScale) / 150;
  const [, x0, y0] = fp[0]!;
  let dx = 0;
  let dy = 0;
  let t = t0;
  let last: readonly [number, number] | null = null;
  for (let i = 0; i < fp.length; i++) {
    const [dt, px, py] = fp[i]!;
    dx = dx * 0.95 + human.aim(WORLD_PER_PX, 0.06);
    dy = dy * 0.95 + human.aim(WORLD_PER_PX, 0.06);
    const rx = x0 + (px - x0) * Math.cos(rot) - (py - y0) * Math.sin(rot);
    const ry = y0 + (px - x0) * Math.sin(rot) + (py - y0) * Math.cos(rot);
    const p = [clampX(rx + ox + dx), clampY(ry + oy + dy)] as const;
    if (last && p[0] === last[0] && p[1] === last[1]) continue;
    t = plan.at(Math.max(i ? t + 1 : t, t0 + dt), { k: INK_INPUT_STROKE, a: p[0], b: p[1], c: i === 0 ? 1 : 0, d: 0 });
    last = p;
  }
  return t + 1;
}

type Game = ArcadeGame<InkState, ArcadeInputEvent | null>;

/**
 * Noise-free drop from a fresh level state: lines drawn as a phone sends them, RELEASE at
 * `rel` (absolute tick, or as soon as drawn), live ramps from IDEAL_LIVE_DELAY after it.
 */
export function simulate(game: Game, from: InkState, strokes: number[][], rel: number | null, live: number[][], still = false, wantTrace = false, perturb = 0, liveDelay = IDEAL_LIVE_DELAY, liveSpeed = 0): { potted: boolean; star: boolean; flight: number; trace: { x: number; y: number; on: number }[] } {
  const trace: { x: number; y: number; on: number }[] = [];
  let s: InkState = from;
  if (still) {
    const list = [...s.list];
    list[s.level] = { ...list[s.level]!, slideAmp: 0 };
    s = { ...s, list };
  }
  const log: ArcadeInputEvent[] = [];
  const q: Ev[] = [];
  // A fixed, deterministic hand-like perturbation (pattern `perturb`, 0 = none) for reliability tests.
  let h = (perturb * 2654435761) >>> 0;
  const r = () => {
    h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    return (h / 4294967296) * 2 - 1;
  };
  const jig = (pts: [number, number][]): [number, number][] => {
    if (!perturb) return pts;
    const ox = r() * 4.5;
    const oy = r() * 4.5;
    const rot = r() * 0.03;
    const [x0, y0] = pts[0]!;
    return pts.map(([x, y]) => {
      const rx = x0 + (x - x0) * Math.cos(rot) - (y - y0) * Math.sin(rot);
      const ry = y0 + (x - x0) * Math.sin(rot) + (y - y0) * Math.cos(rot);
      return [clampX(rx + ox + r() * 0.5), clampY(ry + oy + r() * 0.5)];
    });
  };
  for (const st of strokes) {
    const pts = jig(phonePoints(st));
    q.push({ k: INK_INPUT_STROKE, a: pts[0]![0], b: pts[0]![1], c: 1, d: 0 });
    for (let i = 1; i < pts.length; i++) q.push({ k: INK_INPUT_STROKE, a: pts[i]![0], b: pts[i]![1], c: 0, d: 0 });
  }
  const liveQ: { at: number; ev: Ev }[] = [];
  let la = liveDelay;
  for (const st of live) {
    if (liveSpeed > 0) {
      // As the phone sends a live stroke: the finger's newest point each tick (fingerPoints).
      const fp = fingerPoints(st, liveSpeed);
      const pts = jig(fp.map(([, x, y]) => [x, y] as [number, number]));
      for (let i = 0; i < fp.length; i++) liveQ.push({ at: la + fp[i]![0], ev: { k: INK_INPUT_STROKE, a: pts[i]![0], b: pts[i]![1], c: i === 0 ? 1 : 0, d: 0 } });
      la += fp[fp.length - 1]![0] + 1;
      liveQ.push({ at: la, ev: { k: INK_INPUT_LIFT, a: 1, b: 0, c: 0, d: 0 } });
      la += 6;
      continue;
    }
    const pts = jig(phonePoints(st));
    liveQ.push({ at: la, ev: { k: INK_INPUT_STROKE, a: pts[0]![0], b: pts[0]![1], c: 1, d: 0 } });
    for (let i = 1; i < pts.length; i++) liveQ.push({ at: (la += Math.ceil(INK_STEP_PX / IDEAL_LIVE_SPEED)), ev: { k: INK_INPUT_STROKE, a: pts[i]![0], b: pts[i]![1], c: 0, d: 0 } });
    liveQ.push({ at: ++la, ev: { k: INK_INPUT_LIFT, a: 1, b: 0, c: 0, d: 0 } });
    la += 6;
  }
  const lvl = s.level;
  const fails = s.fails;
  let released = -1;
  while (!game.isOver(s) && s.level === lvl && s.fails === fails) {
    let ev: Ev | null = null;
    if (q.length) ev = q.shift()!;
    else if (released < 0 && (rel === null || s.tick + 1 >= rel)) {
      ev = { k: INK_INPUT_RELEASE, a: 1, b: 0, c: 0, d: 0 };
      released = s.tick + 1;
    } else if (released >= 0 && liveQ.length && s.dropTicks >= liveQ[0]!.at) ev = liveQ.shift()!.ev;
    if (ev) recordInput(log, { ...ev, t: s.tick + 1 }, game.inputRanges);
    s = game.step(s, inputAt(log, s.tick + 1));
    if (wantTrace && s.dropping) trace.push({ x: s.ball.x / 256, y: s.ball.y / 256, on: s.ball.on });
  }
  return { potted: s.levels > from.levels, star: (s.stars ?? 0) > (from.stars ?? 0), flight: released >= 0 ? s.tick - released : 0, trace };
}

/** The line (and release phase / live ramp) an experienced player would use on this level. */
export function inkIdeal(game: Game, seed: number, s: InkState, wantStar: boolean): Ideal {
  const key = `${seed}:${s.level}:${wantStar ? 1 : 0}:${s.rev}`;
  const hit = idealCache.get(key);
  if (hit) return hit;
  const lvl: InkLevel = s.list[s.level]!;
  const live = inkIsLive(s.level, s.rev);
  const moving = lvl.slideAmp > 0;
  let sims = 0;
  let budget = SIM_BUDGET;
  const shift = (st: number[][], dx: number) => st.map((p) => p.map((v, i) => (i % 2 === 0 && i > 0 ? v + dx : v)));
  const tryLine = (strokes: number[][], liveSt: number[][], needStar: boolean): Ideal | null => {
    if (sims >= budget) return null;
    sims += 1;
    const base = simulate(game, s, strokes, null, liveSt, moving);
    if (!base.potted || (needStar && !base.star)) return null;
    let phase = 0;
    let flight = base.flight;
    if (moving) {
      // The release moment: the first of 12 over a slide period that pots with the pot moving.
      let found = -1;
      for (let k = 0; k < 12 && found < 0 && sims < budget; k++) {
        const rel = s.tick + 400 + Math.trunc((k * lvl.slidePeriod) / 12);
        sims += 1;
        const r = simulate(game, s, strokes, rel, liveSt);
        if (r.potted && (!needStar || r.star)) {
          found = rel;
          flight = r.flight;
        }
      }
      if (found < 0) return null;
      phase = found % lvl.slidePeriod;
    }
    return { strokes, phase, period: moving ? lvl.slidePeriod : 0, live: liveSt, flight, ok: true };
  };
  /** How many of PROBES hand-like wobbles of the line still pot (a careful player's sense of a reliable line). */
  const reliability = (cand: Ideal, needStar: boolean): number => {
    let ok = 0;
    for (let k = 1; k <= PROBES; k++) {
      if (sims >= budget) break;
      sims += 1;
      const r = simulate(game, s, cand.strokes, null, cand.live, true, false, k + 17 * s.level);
      if (r.potted && (!needStar || r.star)) ok += 1;
    }
    return ok;
  };
  let fallback: Ideal | null = null;
  let fallbackScore = -1;
  const consider = (strokes: number[][], liveSt: number[][], needStar: boolean): Ideal | null => {
    const c = tryLine(strokes, liveSt, needStar);
    if (!c) return null;
    const score = reliability(c, needStar);
    c.rel = score;
    if (score >= PROBES) return c;
    if (score > fallbackScore) {
      fallback = c;
      fallbackScore = score;
    }
    return null;
  };
  let found: Ideal | null = null;
  const liveRamps = (lvl.liveRef ?? []).map((l) => [...l.pts]);
  if (wantStar && lvl.starRef) {
    // The proved star line, then small reshapes of it that still take the star.
    const sr = lvl.starRef.map((p) => [...p]);
    found = consider(sr, [], true);
    for (const [dx, dy] of [[0, 10], [0, -10], [12, 0], [-12, 0], [8, 8], [-8, 8], [0, 20], [16, 10]] as const) {
      if (found || sims >= budget) break;
      found = consider(sr.map((p) => p.map((v, i) => (i < 2 || i >= p.length - 2 ? v : i % 2 === 0 ? v + dx : v + dy))), [], true);
    }
    if (!found && fallback) found = fallback;
    const out = found ?? { strokes: [], phase: 0, period: 0, live: [], flight: 0, ok: false };
    idealCache.set(key, out);
    return out;
  }
  const dir = lvl.bucketX > lvl.spoutX ? 1 : -1;
  // A backstop wall just past the pot: a drawn vertical line kills the coin's run and drops it in.
  const wall = (top: number, k = 12): number[] => {
    const x = lvl.bucketX + dir * k;
    return [x, Math.max(SPOUT_Y + 40, top), x, lvl.bucketY - 14];
  };
  const ref = lvl.ref.map((p) => [...p]);
  const cands: (() => [number[][], number[][]])[] = [];
  if (live) {
    // Live: the proved pre-release line (as drawn by hand); the catch ramp as proved, moved,
    // or re-aimed lower at the pot, alone or followed by a backstop wall.
    const ramps: number[][] = [];
    // Where the coin actually leaves the hand-drawn pre-release line, and falls from there.
    const trace = simulate(game, s, ref, null, [], false, true).trace;
    let leave = -1;
    for (let t = 1; t < trace.length; t++) if (trace[t - 1]!.on >= 0 && trace[t]!.on < 0) {
      leave = t;
      break;
    }
    if (leave > 0)
      for (const d of [4, 10, 18])
        for (const dy0 of [26, 44]) {
          const p = trace[Math.min(trace.length - 1, leave + d)]!;
          const cx = Math.round(p.x) + dir * 6;
          const cy = Math.round(p.y) + dy0;
          for (const off of [0, -16, 16]) for (const lift of [30, 60]) if (cy < lvl.bucketY - lift - 10) ramps.push([cx, cy, lvl.bucketX - dir * off, lvl.bucketY - lift]);
        }
    for (const r of liveRamps) ramps.push(r, [r[0]!, r[1]! + 14, ...r.slice(2)]);
    for (const withWall of [false, true]) for (const ramp of ramps) cands.push(() => [ref, withWall ? [ramp, wall(ramp[1]! + 20)] : [ramp]]);
  } else {
    cands.push(() => [ref, []]);
    for (const r of [12, 24]) cands.push(() => [ref.map((p) => rounded(p, r)), []]);
    const top = Math.min(...ref.map((p) => Math.min(...p.filter((_, i) => i % 2 === 1))));
    for (const k of [12, 24]) cands.push(() => [[...ref, wall(top + 60, k)], []]);
    // The shallow first leg only (the coin flies off its end), with the backstop.
    for (const k of [12, 24, 30]) for (const p of ref) if (p.length >= 6) cands.push(() => [[p.slice(0, 4), wall(p[3]! - 30, k)], []]);
    cands.push(() => [[...ref.map((p) => rounded(p, 16)), wall(top + 60)], []]);
    for (const off of [10, -10, 20, -20]) cands.push(() => [ref.map((p) => [...p.slice(0, -2), p[p.length - 2]! - dir * off, p[p.length - 1]!]), []]);
    // The generator's family of ramps (steep ones skipped: they break into wall pieces when drawn),
    // then the same with the backstop.
    const sx = lvl.spoutX - dir * 24;
    const sy = SPOUT_Y + 28;
    const way: ([number, number] | null)[] = [null];
    for (const fy of [25, 45, 65]) for (const fx of [-60, -20, 20, 60, 110]) way.push([lvl.spoutX + dir * fx, sy + Math.trunc(((lvl.bucketY - sy) * fy) / 100)]);
    for (const withWall of [false, true])
      for (const w of way)
        for (const lift of [26, 70])
          for (const off of [0, -24, 24]) {
            const ex = lvl.bucketX - dir * off;
            const ey = lvl.bucketY - lift;
            if (w && (w[0] < 4 || w[0] > INK_WORLD_W - 4 || w[1] >= ey - 10)) continue;
            const pts = w ? [sx, sy, w[0], w[1], ex, ey] : [sx, sy, ex, ey];
            if (steep(pts)) continue;
            cands.push(() => [withWall ? [pts, wall((w?.[1] ?? sy) - 20)] : [pts], []]);
          }
  }
  for (const c of cands) {
    if (found || sims >= budget) break;
    const [st, lv] = c();
    found = consider(st, lv, false);
  }
  // A shaky line gets refined: nudge its points until a version holds up to the wobble test.
  let h = (seed ^ Math.imul(s.level + 1, 7919)) >>> 0;
  const rr = () => {
    h = (Math.imul(h ^ (h >>> 13), 1274126177) + 0x6d2b79f5) >>> 0;
    return (h / 4294967296) * 2 - 1;
  };
  budget = SIM_BUDGET + REFINE_BUDGET;
  sims = Math.max(sims, SIM_BUDGET - 20);
  while (!found && fallback && sims < budget) {
    const best: Ideal = fallback;
    const nudge = (p: number[]) => p.map((v, i) => Math.round(v + rr() * (i < 2 ? 4 : 12)));
    found = consider(live ? best.strokes : best.strokes.map(nudge), best.live.map(nudge), false);
  }
  found ??= fallback;
  const out = found ?? { strokes: lvl.ref.map((p) => [...p]), phase: (lvl.refT0 + 1) % Math.max(1, lvl.slidePeriod), period: lvl.slideAmp ? lvl.slidePeriod : 0, live: liveRamps, flight: 150, ok: false };
  idealCache.set(key, out);
  return out;
}

/* ======================= Oct 2026 competence fixes (BotCtx.fixes) =======================
 *
 * The v1 planner (inkIdeal) stops at its first line that survives six wobbles and otherwise falls
 * back on its least shaky line, or the proved reference, which a phone often cannot draw (a
 * near-vertical leg breaks into wall pieces): even the flawless bot potted only ~9 of 10 levels,
 * and on some levels nothing it tried potted at all, so every retry dropped the same failing line.
 * The fixed planner (inkPlan) is what a strong player works out:
 *  - many more lines: the reference and its reshapes, the generator's family of ramps, and a seeded
 *    spread of one- and two-leg ramps from under the spout to over the pot, each with and without a
 *    backstop wall, plus no line at all (a spout over the pot);
 *  - each line that pots is judged by how many of eight hand-like wobbles still pot it, and on a
 *    moving pot by how wide its window of good release moments is (the middle of it is aimed at);
 *  - on live levels the catch ramp is judged for a hand that arrives anywhere from 12 to 24 ticks
 *    after RELEASE, the spread of real reactions, not for one fixed delay;
 *  - the lines are ranked, and after a failed drop the player moves to the next line once the one
 *    that failed no longer looks better than it (a line that fails twice is dropped for a fresh one);
 *  - gold stars (and trick shots) are tried only on a line that holds up to the wobbles: a failed
 *    drop is a third of the run.
 */
const PROBES2 = 8;
/** Hand arrival (ticks after RELEASE) the live-ramp plan is judged over. */
const LIVE_DELAYS = [12, 16, 20, 24, 14, 18, 22, 26];
const PLAN_DELAY = 17;
/** Live-ramp finger speeds (px a tick) the plan is judged over, and the one it is found with. */
const LIVE_SPEEDS = [20, 28, 36];
const PLAN_LIVE_SPEED = 28;
/** Fixed bots: a quick, decisive live stroke, px a tick (a 250-px ramp in about 0.15 s at near-perfect). */
const DRAW_LIVE2: Record<SkillLevel, number> = { weak: 16, average: 20, good: 24, great: 28, near: 32, elite: 34, perfect: 36 };
/** Noise-free drops per level plan (the plan is cached per seed and level, shared by every skill level). */
const PLAN_BUDGET = 900;
/** Lines that pot noise-free, judged for reliability (and release window). */
const PLAN_JUDGE = 16;
/** Release moments tried over a slide period. */
const PHASES = 16;
/** Nudges tried when refining a shaky line. */
const CLIMB = 60;
/**
 * A gold-star line must survive this many of PROBES2 wobbles (a near-perfect hand's size) before a
 * fixed player risks a drop on it. A star pays 2 units here (a level 10), so even the steadiest hands
 * want every wobble to hold (measured: near at 7 of 8 potted 0.3 fewer levels for 0.2 more stars);
 * the flawless player, with no hand error, takes any line that pots. (inkRev 9's stars and trick
 * shots pay far more, so its near/elite take 7 of 8.)
 */
const STAR_MIN_REL: Record<SkillLevel, number> = { weak: PROBES2, average: PROBES2, good: PROBES2, great: PROBES2, near: PROBES2, elite: PROBES2, perfect: 1 };

export interface PlanLine {
  strokes: number[][];
  live: number[][];
  /** Wobbled copies (of PROBES2) that still pot. */
  rel: number;
  /** Moving pot: release when (tick − phase) % period === 0; `window` good moments of PHASES around it. */
  phase: number;
  period: number;
  window: number;
  flight: number;
  ink: number;
}

const planCache = new Map<string, PlanLine[]>();

function inkLen(strokes: number[][]): number {
  let n = 0;
  for (const p of strokes) for (let i = 2; i < p.length; i += 2) n += Math.hypot(p[i]! - p[i - 2]!, p[i + 1]! - p[i - 1]!);
  return n;
}

/**
 * The ranked lines a strong player would consider on this level (best first). `need`: "pot", "star"
 * (pots through the gold star) or, on branches that have them, "trick".
 */
export function inkPlan(game: Game, seed: number, s: InkState, need: "pot" | "star"): PlanLine[] {
  const key = `${seed}:${s.level}:${need}:${s.rev}`;
  const hit = planCache.get(key);
  if (hit) return hit;
  const lvl: InkLevel = s.list[s.level]!;
  const live = inkIsLive(s.level, s.rev);
  const moving = lvl.slideAmp > 0;
  let sims = 0;
  const wants = (r: { potted: boolean; star: boolean }) => r.potted && (need === "pot" || r.star);
  const run = (strokes: number[][], liveSt: number[][], rel: number | null, still: boolean, perturb = 0, delay = PLAN_DELAY, speed = PLAN_LIVE_SPEED) => {
    sims += 1;
    return simulate(game, s, strokes, rel, liveSt, still, false, perturb, delay, speed);
  };
  const dir = lvl.bucketX > lvl.spoutX ? 1 : -1;
  const wall = (top: number, k = 12): number[] => {
    const x = lvl.bucketX + dir * k;
    return [x, Math.max(SPOUT_Y + 40, top), x, lvl.bucketY - 14];
  };
  // A seeded stream for the spread of lines (the plan is the same for every skill level).
  let h = (seed ^ Math.imul(s.level + 1, 40503) ^ (need === "pot" ? 0 : 0x5bd1e995)) >>> 0;
  const rr = () => {
    h = (Math.imul(h ^ (h >>> 13), 1274126177) + 0x6d2b79f5) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const cands: [number[][], number[][]][] = [];
  const ref = lvl.ref.map((p) => [...p]);
  if (need !== "pot") {
    const sr = (lvl.starRef ?? []).map((p) => [...p]);
    if (sr.length) {
      cands.push([sr, []]);
      for (const r of [8, 16]) cands.push([sr.map((p) => rounded(p, r)), []]);
      for (const [dx, dy] of [[0, 10], [0, -10], [12, 0], [-12, 0], [8, 8], [-8, 8], [0, 20], [16, 10], [-16, 10], [0, -20], [24, 0], [-24, 0]] as const)
        cands.push([sr.map((p) => p.map((v, i) => (i < 2 || i >= p.length - 2 ? v : i % 2 === 0 ? v + dx : v + dy))), []]);
      for (let k = 0; k < 40; k++) {
        const nudge = (p: number[]) => p.map((v, i) => Math.round(v + (rr() * 2 - 1) * (i < 2 ? 4 : 14)));
        cands.push([sr.map(nudge), []]);
      }
    }
  } else if (live) {
    // Live: a pre-release line (the proved one, rounded, or re-aimed), then catch ramps judged
    // from where the coin actually leaves it.
    const pres: number[][][] = [ref, ref.map((p) => rounded(p, 12))];
    for (const off of [10, -10, 20]) pres.push(ref.map((p) => [...p.slice(0, -2), p[p.length - 2]! + dir * off, p[p.length - 1]!]));
    // Shorter (a slower coin off its end) and flatter versions.
    for (const cut of [0.8, 0.65])
      pres.push(ref.map((p) => [...p.slice(0, -2), Math.round(p[p.length - 4]! + (p[p.length - 2]! - p[p.length - 4]!) * cut), Math.round(p[p.length - 3]! + (p[p.length - 1]! - p[p.length - 3]!) * cut)]));
    pres.push(ref.map((p) => [...p.slice(0, -2), p[p.length - 2]!, p[p.length - 1]! - 20]));
    for (const pre of pres) {
      const ramps: number[][] = [];
      const trace = simulate(game, s, pre, null, [], false, true).trace;
      sims += 1;
      let leave = -1;
      for (let t = 1; t < trace.length; t++)
        if (trace[t - 1]!.on >= 0 && trace[t]!.on < 0) {
          leave = t;
          break;
        }
      if (leave > 0)
        for (const d of [4, 10, 18, 28])
          for (const dy0 of [18, 30, 44, 64])
            for (const dx0 of [6, 20]) {
              const p = trace[Math.min(trace.length - 1, leave + d)]!;
              const cx = Math.round(p.x) + dir * dx0;
              const cy = Math.round(p.y) + dy0;
              for (const off of [0, -16, 16, 32])
                for (const lift of [30, 60, 90]) {
                  if (cy >= lvl.bucketY - lift - 10) continue;
                  ramps.push([cx, cy, lvl.bucketX - dir * off, lvl.bucketY - lift]);
                  // A shallow catch first, then down to the pot.
                  ramps.push([cx, cy, cx + dir * 40, cy + 16, lvl.bucketX - dir * off, lvl.bucketY - lift]);
                }
            }
      for (const l of lvl.liveRef ?? []) ramps.push([...l.pts], [l.pts[0]!, l.pts[1]! + 14, ...l.pts.slice(2)], [l.pts[0]!, l.pts[1]! + 28, ...l.pts.slice(2)]);
      for (const ramp of ramps) {
        cands.push([pre, [ramp]]);
        cands.push([pre, [ramp, wall(ramp[1]! + 20)]]);
      }
    }
    // The proved live strokes as they are, after the proved pre-release line.
    if (lvl.liveRef?.length) cands.unshift([ref, lvl.liveRef.map((l) => [...l.pts])]);
  } else {
    cands.push([ref, []]);
    for (const r of [12, 24]) cands.push([ref.map((p) => rounded(p, r)), []]);
    const top = Math.min(...ref.map((p) => Math.min(...p.filter((_, i) => i % 2 === 1))));
    for (const k of [12, 24]) cands.push([[...ref, wall(top + 60, k)], []]);
    for (const k of [12, 24, 30]) for (const p of ref) if (p.length >= 6) cands.push([[p.slice(0, 4), wall(p[3]! - 30, k)], []]);
    cands.push([[...ref.map((p) => rounded(p, 16)), wall(top + 60)], []]);
    for (const off of [10, -10, 20, -20]) cands.push([ref.map((p) => [...p.slice(0, -2), p[p.length - 2]! - dir * off, p[p.length - 1]!]), []]);
    cands.push([[], []]);
    const sx = lvl.spoutX - dir * 24;
    const sy = SPOUT_Y + 28;
    const way: ([number, number] | null)[] = [null];
    for (const fy of [25, 45, 65]) for (const fx of [-60, -20, 20, 60, 110]) way.push([lvl.spoutX + dir * fx, sy + Math.trunc(((lvl.bucketY - sy) * fy) / 100)]);
    for (const withWall of [false, true])
      for (const w of way)
        for (const lift of [26, 70])
          for (const off of [0, -24, 24]) {
            const ex = lvl.bucketX - dir * off;
            const ey = lvl.bucketY - lift;
            if (w && (w[0] < 4 || w[0] > INK_WORLD_W - 4 || w[1] >= ey - 10)) continue;
            const pts = w ? [sx, sy, w[0], w[1], ex, ey] : [sx, sy, ex, ey];
            if (steep(pts)) continue;
            cands.push([withWall ? [pts, wall((w?.[1] ?? sy) - 20)] : [pts], []]);
          }
    // A seeded spread of ramps: a start under the spout, up to two bends, an end over or near the pot.
    for (let k = 0; k < 500; k++) {
      const x0 = lvl.spoutX + (rr() * 2 - 1) * 14 - dir * (8 + rr() * 30);
      const y0 = SPOUT_Y + 18 + rr() * 60;
      const ex = lvl.bucketX - dir * (rr() * 70 - 25);
      const ey = lvl.bucketY - 18 - rr() * 120;
      if (ey <= y0 + 20) continue;
      const pts = [x0, y0];
      const bends = rr() < 0.35 ? 0 : rr() < 0.7 ? 1 : 2;
      for (let b = 1; b <= bends; b++) {
        const f = b / (bends + 1);
        const wx = x0 + (ex - x0) * f + (rr() * 2 - 1) * 120;
        const wy = y0 + (ey - y0) * f + (rr() * 2 - 1) * 60;
        pts.push(wx, wy);
      }
      pts.push(ex, ey);
      const P = pts.map((v, i) => (i % 2 === 0 ? clampX(v) : clampY(v)));
      let ok = true;
      for (let i = 3; i < P.length; i += 2) if (P[i]! <= P[i - 2]!) ok = false; // always downhill
      if (!ok || steep(P)) continue;
      const r = rr();
      cands.push([r < 0.45 ? [P] : [P, wall(P[P.length - 1]! - 30 - rr() * 60, 8 + Math.round(rr() * 14))], []]);
    }
    // A short ramp the coin flies off into a steep chute that drops it over the pot (threading
    // birds a plain ramp can't): the chute starts just past the ramp's end, a little above it.
    const legs: number[][] = ref.filter((p) => p.length >= 4).map((p) => p.slice(0, 4));
    for (let k = 0; k < 300; k++) {
      let leg: number[];
      if (legs.length && rr() < 0.4) leg = [...legs[Math.floor(rr() * legs.length)]!];
      else {
        const x0 = lvl.spoutX + (rr() * 2 - 1) * 14 - dir * (8 + rr() * 30);
        const y0 = SPOUT_Y + 18 + rr() * 50;
        leg = [x0, y0, x0 + dir * (40 + rr() * 200), y0 + 20 + rr() * 160];
      }
      const ex = leg[2]!;
      const ey = leg[3]!;
      const qx = ex + dir * (8 + rr() * 36);
      const qy = ey - 10 - rr() * 40;
      const rx = lvl.bucketX + (rr() * 2 - 1) * 18;
      const ry = lvl.bucketY - 10 - rr() * 40;
      if (ry <= qy + 40) continue;
      const P = leg.map((v, i) => (i % 2 === 0 ? clampX(v) : clampY(v)));
      if (P[3]! <= P[1]!) continue;
      cands.push([[P, [clampX(qx), clampY(qy), clampX(rx), clampY(ry)]], []]);
    }
  }
  // 1. Lines that pot noise-free (a moving pot judged standing at its middle), each judged at once by
  // how many wobbled copies still pot; enough once two hold up to every wobble.
  const lines: PlanLine[] = [];
  const probe = (st: number[][], lv: number[][], relAt: number | null, still: boolean, stopAfter = PROBES2 + 1): number => {
    let ok = 0;
    for (let k = 1; k <= PROBES2; k++) {
      if (k - 1 - ok >= stopAfter) break;
      const r = run(st, lv, relAt, still, k + 17 * s.level, LIVE_DELAYS[(k - 1) % LIVE_DELAYS.length], LIVE_SPEEDS[(k - 1) % LIVE_SPEEDS.length]);
      if (wants(r)) ok += 1;
    }
    return ok;
  };
  const mk = (st: number[][], lv: number[][], rel: number, flight: number): PlanLine => ({ strokes: st, live: lv, rel, phase: 0, period: 0, window: PHASES, flight: flight || 150, ink: inkLen(st) + inkLen(lv) });
  let pottable = 0;
  for (const [st, lv] of cands) {
    if (pottable >= (need === "pot" ? PLAN_JUDGE : PLAN_JUDGE / 2) || sims >= PLAN_BUDGET) break;
    const r = run(st, lv, null, moving);
    if (!wants(r)) continue;
    pottable += 1;
    // (Probing stops once the line can no longer beat the best so far.)
    const bestRel = lines.reduce((m, l) => Math.max(m, l.rel), 0);
    lines.push(mk(st, lv, probe(st, lv, null, moving, PROBES2 - bestRel + 1), r.flight));
    if (lines.filter((l) => l.rel >= PROBES2).length >= (moving ? 4 : 2)) break;
  }
  lines.sort((a, b) => b.rel - a.rel || a.ink - b.ink);
  // 2. A shaky line is refined: its points nudged (and a backstop added or moved) while the nudged
  // line holds up to at least as many wobbles (released at `relAt`, or as soon as drawn).
  const climb = (best: PlanLine, relAt: number | null, still: boolean): PlanLine[] => {
    const out: PlanLine[] = [];
    let cur = best.strokes.map((p) => [...p]);
    let curLive = best.live.map((p) => [...p]);
    let curRel = best.rel;
    for (let it = 0; it < CLIMB && curRel < PROBES2 && sims < 2 * PLAN_BUDGET; it++) {
      const st = cur.map((p) => [...p]);
      const lv = curLive.map((p) => [...p]);
      const m = rr();
      if (live) {
        const p = lv[Math.floor(rr() * lv.length)] ?? null;
        if (!p) break;
        const i = 2 * Math.floor(rr() * (p.length / 2));
        p[i] = clampX(p[i]! + (rr() * 2 - 1) * 10);
        p[i + 1] = clampY(p[i + 1]! + (rr() * 2 - 1) * 10);
      } else if (m < 0.2) {
        // A backstop added, moved or re-sized (the last stroke, when it is one).
        const last = st[st.length - 1]!;
        const isWall = st.length > 1 && last.length === 4 && last[0] === last[2];
        const top = Math.min(...st[0]!.filter((_, i) => i % 2 === 1)) + 10 + rr() * 60;
        const w = wall(top, 4 + Math.round(rr() * 26));
        if (isWall) st[st.length - 1] = w;
        else st.push(w);
      } else if (m < 0.45) {
        // A whole stroke moved a little.
        const p = st[Math.floor(rr() * st.length)]!;
        const dx = (rr() * 2 - 1) * 8;
        const dy = (rr() * 2 - 1) * 8;
        for (let i = 0; i < p.length; i += 2) {
          p[i] = clampX(p[i]! + dx);
          p[i + 1] = clampY(p[i + 1]! + dy);
        }
      } else {
        const p = st[Math.floor(rr() * st.length)]!;
        const i = m < 0.65 ? 2 * Math.floor(rr() * (p.length / 2)) : p.length - 2;
        p[i] = clampX(p[i]! + (rr() * 2 - 1) * 10);
        p[i + 1] = clampY(p[i + 1]! + (rr() * 2 - 1) * 10);
      }
      const r = run(st, lv, relAt, still);
      if (!wants(r)) continue;
      const rel = probe(st, lv, relAt, still, PROBES2 - curRel);
      if (rel >= curRel) {
        if (rel > curRel) out.push({ ...best, strokes: st, live: lv, rel, flight: r.flight || best.flight, ink: inkLen(st) + inkLen(lv) });
        cur = st;
        curLive = lv;
        curRel = rel;
      }
    }
    return out;
  };
  // (A star or trick line is refined from its best version only.)
  for (let k = 0; k < (need === "pot" ? 2 : 1) && lines.length > k && lines[0]!.rel < PROBES2; k++) {
    lines.push(...climb(lines[k]!, null, moving));
    lines.sort((a, b) => b.rel - a.rel || a.ink - b.ink);
  }
  // 3. Moving pot: the release window of the best few lines; the middle of the widest is aimed at.
  if (moving) {
    const judged: PlanLine[] = [];
    for (const l of lines.slice(0, 4)) {
      const good: boolean[] = [];
      const fls: number[] = [];
      const base = s.tick + 400;
      for (let k = 0; k < PHASES; k++) {
        const r = run(l.strokes, l.live, base + Math.trunc((k * lvl.slidePeriod) / PHASES), false);
        good.push(wants(r));
        fls.push(r.flight);
      }
      let bestN = 0;
      let bestMid = -1;
      if (good.every(Boolean)) {
        bestN = PHASES;
        bestMid = 0;
      } else
        for (let a = 0; a < PHASES; a++) {
          if (!good[a] || good[(a + PHASES - 1) % PHASES]) continue;
          let n = 0;
          while (n < PHASES && good[(a + n) % PHASES]) n++;
          if (n > bestN) {
            bestN = n;
            bestMid = (a + Math.trunc((n - 1) / 2)) % PHASES;
          }
        }
      if (bestN === 0) continue;
      const relAt = base + Math.trunc((bestMid * lvl.slidePeriod) / PHASES);
      // The wobbles again, now released at that moment onto the moving pot.
      judged.push({ ...l, rel: probe(l.strokes, l.live, relAt, false), phase: relAt % lvl.slidePeriod, period: lvl.slidePeriod, window: bestN, flight: fls[bestMid]! || 150 });
    }
    lines.length = 0;
    lines.push(...judged);
    const value = (l: PlanLine) => l.rel + Math.min(l.window, 8) / 2;
    lines.sort((a, b) => value(b) - value(a) || a.ink - b.ink);
    // A best line that the moving pot makes shaky is refined at its release moment too.
    const top = lines[0];
    if (top && top.rel < PROBES2 - 1) {
      let relAt = s.tick + 400 - ((s.tick + 400) % top.period) + top.phase;
      if (relAt < s.tick + 400) relAt += top.period;
      lines.push(...climb(top, relAt, false));
      lines.sort((a, b) => value(b) - value(a) || a.ink - b.ink);
    }
  }
  planCache.set(key, lines);
  return lines;
}

export const bot: SkillBot = ({ game, seed, human, fixes }) => {
  const level = human.level;
  const init = game.init(seed) as InkState;

  const plan = new Plan();
  let key = -1;
  let lastLevel = -1;
  let attempt = 0;
  let presses = 0;
  const starTried = new Set<number>();
  let liveRamps: number[][] = [];
  let liveQueued = true;
  let flight = 150;

  const press = (k: number): Ev => {
    presses = (presses + 1) % 256;
    return { k, a: presses, b: 0, c: 0, d: 0 };
  };
  // Fixed bots (ctx.fixes): failed drops per (level, line), and the line the current drop uses.
  const failsOn = new Map<string, number>();
  let curLine = "";

  const planAttemptFixed = (s: InkState, t: number) => {
    plan.clear();
    const lvl = s.list[s.level]!;
    const live = inkIsLive(s.level, s.rev);
    const first = attempt === 0;
    let at = t + (first ? human.thinkTicks(2800 + 250 * s.level + (live ? 1500 : 0)) : human.thinkTicks(1300));
    let line: PlanLine | null = null;
    curLine = "";
    // The star only on a line that holds up, and never with one failure left: a failed drop
    // costs a third of the run.
    if (first && s.fails < INK_FAILS - 1 && lvl.star && !starTried.has(s.level) && human.chance(STAR_GO[level])) {
      starTried.add(s.level);
      const st = inkPlan(game, seed, s, "star")[0];
      if (st && st.rel >= STAR_MIN_REL[level]) line = st;
    }
    if (!line) {
      const lines = inkPlan(game, seed, s, "pot");
      // The best line, judged by its steadiness less what the player has seen go wrong with it:
      // after a failed drop they keep a clearly better line, else move on to the next one.
      let bi = -1;
      let bv = -Infinity;
      lines.forEach((l, i) => {
        const v = l.rel + (l.period ? Math.min(l.window, 8) / 2 : 0) - 2.5 * (failsOn.get(`${s.level}:${i}`) ?? 0);
        if (v > bv) {
          bv = v;
          bi = i;
        }
      });
      // A first-timer can't tell which line holds up: any of the few that look as if they could work.
      if (level === "weak" && lines.length) bi = human.int(0, Math.min(3, lines.length) - 1);
      if (bi >= 0) {
        line = lines[bi]!;
        curLine = `${s.level}:${bi}`;
      } else {
        const id = inkIdeal(game, seed, s, false);
        line = { strokes: id.strokes, live: id.live, rel: 0, phase: id.phase, period: id.period, window: 1, flight: id.flight, ink: 0 };
      }
    }
    let strokes = line.strokes.map((p) => [...p]);
    if (human.chance(human.p.judgement * (first ? 0.7 : 0.2)) || human.slip()) {
      const sx = human.normal() * 22;
      const sy = human.normal() * 18;
      strokes = strokes.map((p) => p.map((v, i) => (i < 2 ? v : i % 2 === 0 ? v + sx : v + sy)));
    }
    for (const pts of strokes) {
      at = drawStroke(plan, human, pts, at, DRAW[level], first ? 1 : 0.65);
      at += human.int(6, 12);
    }
    at += human.thinkTicks(500, 0.4);
    flight = line.flight || 150;
    if (line.period) {
      let rel = line.phase;
      while (rel < at) rel += line.period;
      at = Math.max(at, Math.round(rel + human.timingTicks() + human.normal() * READ[level] * flight));
    }
    plan.at(at, press(INK_INPUT_RELEASE));
    liveRamps = live ? line.live.map((p) => [...p]) : [];
    liveQueued = !live;
  };

  const planAttempt = (s: InkState, t: number) => {
    plan.clear();
    const lvl = s.list[s.level]!;
    const live = inkIsLive(s.level, s.rev);
    const first = attempt === 0;
    // Look at the level (a fresh level takes longer than a retry).
    let at = t + (first ? human.thinkTicks(2800 + 250 * s.level + (live ? 1500 : 0)) : human.thinkTicks(1300));
    let ideal: Ideal | null = null;
    if (first && lvl.star && !starTried.has(s.level) && human.chance(STAR_GO[level])) {
      starTried.add(s.level);
      const st = inkIdeal(game, seed, s, true);
      if (st.ok) ideal = st;
    }
    ideal ??= inkIdeal(game, seed, s, false);
    let strokes = ideal.strokes.map((p) => [...p]);
    // Misjudging where the line should end on a first look (less so on a retry).
    if (human.chance(human.p.judgement * (first ? 0.7 : 0.2)) || human.slip()) {
      const sx = human.normal() * 22;
      const sy = human.normal() * 18;
      strokes = strokes.map((p) => p.map((v, i) => (i < 2 ? v : i % 2 === 0 ? v + sx : v + sy)));
    }
    for (const pts of strokes) {
      // After a failed drop the player corrects most of what they saw go wrong.
      at = drawStroke(plan, human, pts, at, DRAW[level], first ? 1 : 0.65);
      at += human.int(6, 12); // lift and set the finger down again
    }
    // A short look at the line, then RELEASE.
    at += human.thinkTicks(500, 0.4);
    flight = ideal.flight || 150;
    if (ideal.period) {
      // Moving pot: wait for the moment the pot will be under the coin when it arrives.
      let rel = ideal.phase;
      while (rel < at) rel += ideal.period;
      at = Math.max(at, Math.round(rel + human.timingTicks() + human.normal() * READ[level] * flight));
    }
    plan.at(at, press(INK_INPUT_RELEASE));
    liveRamps = live ? ideal.live.map((p) => [...p]) : [];
    liveQueued = !live;
  };

  return driveEvents(
    game,
    (s: InkState, t) => {
      const k = s.level * 10 + s.fails;
      if (k !== key) {
        attempt = s.level === lastLevel ? attempt + 1 : 0;
        if (fixes && attempt > 0 && curLine) failsOn.set(curLine, (failsOn.get(curLine) ?? 0) + 1);
        lastLevel = s.level;
        key = k;
        if (fixes) planAttemptFixed(s, t);
        else planAttempt(s, t);
      }
      if (fixes && s.dropping && !liveQueued) {
        // Live level: one reaction after RELEASE the finger is on the screen and flicks the catch
        // ramp in (the phone sends its newest point each tick), lifting to commit it.
        liveQueued = true;
        let at = t + human.reactTicks() + human.int(3, 8);
        for (const ramp of liveRamps) {
          at = drawLive(plan, human, ramp, at, DRAW_LIVE2[level], 1.6);
          plan.at(at, press(INK_INPUT_LIFT));
          at += human.int(5, 10);
        }
      }
      if (s.dropping && !liveQueued) {
        // Live level: RELEASE is in; the hand goes to the screen and draws the catch ramp.
        liveQueued = true;
        let at = t + human.reactTicks() + human.int(3, 8);
        for (const ramp of liveRamps) {
          // Where the coin will fall is judged ahead of time: a bigger aim error than a static line.
          at = drawStroke(plan, human, ramp, at, DRAW_LIVE[level], 1.6);
          plan.at(at, press(INK_INPUT_LIFT));
          at += human.int(5, 10);
        }
      }
      return plan.take(t);
    },
    init,
  );
};
