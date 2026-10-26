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
 *
 * inkRev 10 (x200, the taller world with clouds, wind, ink stars, silver coins and a shamrock): on each of levels
 * 1–8 the player goes for the level's bonus line (its star, silver coins, the shamrock, a cloud's trick shot) on a
 * first attempt at their level's rate (BONUS_GO; elite players always), when the line holds up to the wobble test
 * (BONUS_MIN_REL); planned lines are sampled as the sim's inkPhoneLine; on a live level the catch ramp is aimed at
 * where the coin is seen to fall (liveRescue: the fall followed from the drop as it is, as an eye judges it, the
 * ramp then drawn with the live aim error); a warm-up miss on level 1 is a new attempt like any other.
 * INK_BOT_FEATURES=0 in the environment makes every player ignore the bonuses (the "no features" measurement).
 *
 * Fixes for every revision (26 Oct 2026, x200): a line's angle error leaves its far end about one aim error out
 * (it was swung about its start by aim/150 rad, so a long line's end strayed two to three aim errors), a moving
 * pot's release is the middle of the longest window that pots (it was the first of 12 tried), and the wobble test
 * on a moving pot releases at that moment with the pot moving (it tested a still pot).
 */
import { inputAt, recordInput, type ArcadeGame, type ArcadeInputEvent } from "../../../src/lib/arcade/engine";
import {
  INK_INPUT_LIFT,
  INK_INPUT_RELEASE,
  INK_INPUT_STROKE,
  INK_STEP_PX,
  INK_WORLD_H,
  INK_WORLD_W,
  INK_REV_EXPAND,
  inkIsLive,
  inkPhoneLine,
  inkWorldH,
  type InkLevel,
  type InkState,
} from "../../../src/lib/arcade/inkBridge";
import { driveEvents, Plan, type SkillBot } from "../bot";
import type { BandLevel, Human, SkillLevel } from "../human";

/** World px per phone px (the 390-wide world fills a ~390-px phone). */
const WORLD_PER_PX = INK_WORLD_W / 390;
/** Careful tracing speed for a pre-release line, px a tick. */
const DRAW: Record<SkillLevel, number> = { average: 6, good: 7, great: 8, near: 9 };
/** Quick live-ramp stroke speed, px a tick. */
const DRAW_LIVE: Record<SkillLevel, number> = { average: 10, good: 12, great: 14, near: 16 };
/** Moving pot: release read error per tick of coin flight (ticks of error per tick ahead). */
const READ: Record<SkillLevel, number> = { average: 0.09, good: 0.065, great: 0.045, near: 0.03 };
/** Chance of going for the gold star on a level that has one (first attempt only). */
const STAR_GO: Record<SkillLevel, number> = { average: 0.1, good: 0.35, great: 0.6, near: 0.85 };
/** inkRev 10: chance of going for the trick shot on a level with a bounce cloud (first attempt only). */
const TRICK_GO: Record<SkillLevel, number> = STAR_GO;
/** inkRev 10: chance of going for a level's bonus line (first attempt only), and the wobbled copies (of PROBES) it
 * must survive before the player risks a drop on it. Elite players go for every steady one. */
const BONUS_GO: Record<BandLevel, number> = { weak: 0.05, average: 0.1, good: 0.3, great: 0.6, near: 0.85, elite: 1 };
const BONUS_MIN_REL: Record<BandLevel, number> = { weak: 6, average: 6, good: 5, great: 5, near: 4, elite: 4 };
/** Wobbled copies (of PROBES) a trick line must survive before a player risks a drop on it. */
const TRICK_MIN_REL = 5;
/** INK_BOT_FEATURES=0: nobody goes for stars or trick shots. */
const FEATURES = process.env.INK_BOT_FEATURES !== "0";
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
  // inkRev 10: the sim's own model of a phone's points (the one its levels are proved with), in whole px.
  if (phoneExact) {
    const flat = inkPhoneLine(pts.map((v) => Math.round(v)));
    const out: [number, number][] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i]!, flat[i + 1]!]);
    return out;
  }
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
/** The world's height for the run being played (inkRev 10 is taller); set when a bot starts. */
let worldH = INK_WORLD_H;
/** inkRev 10 runs sample planned lines with the sim's inkPhoneLine; set when a bot starts. */
let phoneExact = false;
const clampY = (y: number) => Math.max(0, Math.min(worldH, Math.round(y)));

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
  // A hand aims at where the line should end, so the angle error leaves the far end about one aim error
  // out (a long line is not swung further than a short one).
  let reach = 0;
  for (let i = 2; i < pts.length; i += 2) reach += Math.hypot(pts[i]! - pts[i - 2]!, pts[i + 1]! - pts[i - 1]!);
  const rot = human.aim(WORLD_PER_PX, offScale) / Math.max(150, reach);
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

type Game = ArcadeGame<InkState, ArcadeInputEvent | null>;

/**
 * Noise-free drop from a fresh level state: lines drawn as a phone sends them, RELEASE at
 * `rel` (absolute tick, or as soon as drawn), live ramps from IDEAL_LIVE_DELAY after it.
 */
export function simulate(game: Game, from: InkState, strokes: number[][], rel: number | null, live: number[][], still = false, wantTrace = false, perturb = 0): { potted: boolean; star: boolean; trick: boolean; flight: number; trace: { x: number; y: number; on: number }[] } {
  const trace: { x: number; y: number; on: number }[] = [];
  phoneExact = from.rev === INK_REV_EXPAND;
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
  let la = IDEAL_LIVE_DELAY;
  for (const st of live) {
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
  return { potted: s.levels > from.levels, star: (s.stars ?? 0) > (from.stars ?? 0), trick: (s.tricks ?? 0) > (from.tricks ?? 0), flight: released >= 0 ? s.tick - released : 0, trace };
}

/** The line (and release phase / live ramp) an experienced player would use on this level. */
export function inkIdeal(game: Game, seed: number, s: InkState, wantStar: boolean | "trick"): Ideal {
  const key = `${seed}:${s.level}:${wantStar === "trick" ? 2 : wantStar ? 1 : 0}:${s.rev}`;
  const trickMode = wantStar === "trick";
  const hit = idealCache.get(key);
  if (hit) return hit;
  const lvl: InkLevel = s.list[s.level]!;
  const live = inkIsLive(s.level, s.rev);
  const moving = lvl.slideAmp > 0;
  let sims = 0;
  let budget = SIM_BUDGET;
  const shift = (st: number[][], dx: number) => st.map((p) => p.map((v, i) => (i % 2 === 0 && i > 0 ? v + dx : v)));
  // What "got the feature" means: the trick (older trick mode), else the star; on inkRev 10 a cloud level's bonus
  // line must also bounce (its star sits at the top of the bounce).
  const expandCloud = s.rev === INK_REV_EXPAND && Boolean(lvl.clouds?.length);
  const featOk = (r: { star: boolean; trick: boolean }) => (trickMode ? r.trick : r.star && (!expandCloud || r.trick));
  /** The absolute release tick for a slide phase (after the line is drawn). */
  const relAt = (phase: number) => {
    const r = s.tick + 400;
    return r + ((((phase - r) % lvl.slidePeriod) + lvl.slidePeriod) % lvl.slidePeriod);
  };
  const tryLine = (strokes: number[][], liveSt: number[][], needStar: boolean): Ideal | null => {
    if (sims >= budget) return null;
    sims += 1;
    const base = simulate(game, s, strokes, null, liveSt, moving);
    if (!base.potted || (needStar && !featOk(base))) return null;
    let phase = 0;
    let flight = base.flight;
    if (moving) {
      // The release moment: of 24 over a slide period, the middle of the longest run that pots with the pot
      // moving (a careful player releases in the middle of the window, not at its edge).
      const N = 24;
      const okAt: boolean[] = [];
      const flights: number[] = [];
      for (let k = 0; k < N; k++) {
        const rel = s.tick + 400 + Math.trunc((k * lvl.slidePeriod) / N);
        sims += 1;
        const r = simulate(game, s, strokes, rel, liveSt);
        okAt.push(r.potted && (!needStar || featOk(r)));
        flights.push(r.flight);
      }
      let bestStart = -1;
      let bestLen = 0;
      for (let k = 0; k < N; k++) {
        if (!okAt[k] || okAt[(k + N - 1) % N]) continue;
        let len = 0;
        while (len < N && okAt[(k + len) % N]) len++;
        if (len > bestLen) {
          bestLen = len;
          bestStart = k;
        }
      }
      if (bestStart < 0 && okAt.every(Boolean)) {
        bestStart = 0;
        bestLen = N;
      }
      if (bestStart < 0) return null;
      const mid = (bestStart + Math.trunc((bestLen - 1) / 2)) % N;
      const rel = s.tick + 400 + Math.trunc((mid * lvl.slidePeriod) / N);
      flight = flights[mid]!;
      phase = rel % lvl.slidePeriod;
    }
    return { strokes, phase, period: moving ? lvl.slidePeriod : 0, live: liveSt, flight, ok: true };
  };
  /** How many of PROBES hand-like wobbles of the line still pot (a careful player's sense of a reliable line). */
  const reliability = (cand: Ideal, needStar: boolean): number => {
    let ok = 0;
    for (let k = 1; k <= PROBES; k++) {
      if (sims >= budget) break;
      sims += 1;
      // On a moving pot the wobbled line is released at the chosen moment, with the pot moving.
      const r = moving ? simulate(game, s, cand.strokes, relAt(cand.phase), cand.live, false, false, k + 17 * s.level) : simulate(game, s, cand.strokes, null, cand.live, true, false, k + 17 * s.level);
      if (r.potted && (!needStar || featOk(r))) ok += 1;
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
  const featureRef = trickMode ? lvl.trickRef : lvl.starRef;
  if (wantStar && featureRef) {
    // The proved star (or trick) line, then small reshapes of it that still take the star (or bounce).
    const sr = featureRef.map((p) => [...p]);
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
    // inkRev 10: the level's own hand-drawn live stroke (proved drawn at a hand's pace) comes first.
    const ramps: number[][] = (lvl.liveHand ?? []).map((l) => [...l.pts]);
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


/**
 * inkRev 10 live levels: the catch ramp a player draws watching the coin fall. From the drop as it is (the
 * pre-release line as actually drawn), the coin's fall is followed noise-free (what the eye judges), and the first
 * ramp of the generator's family under it that pots when drawn from `startIn` ticks on at `speed` px a tick, and
 * still pots 3 px off either way, is the one drawn (with the live aim error). Null when none is found.
 */
function liveRescue(game: Game, s: InkState, startIn: number, speed: number): number[] | null {
  const lvl = s.list[s.level]!;
  const run = (ramp: number[] | null, ox = 0): { potted: boolean; trace: { x: number; y: number; on: number }[] } => {
    const at = new Map<number, Ev>();
    if (ramp) {
      const pts = phonePoints(ramp.map((v, i) => (i % 2 === 0 ? v + ox : v)));
      let travelled = 0;
      let t = s.tick + startIn;
      at.set(t, { k: INK_INPUT_STROKE, a: clampX(pts[0]![0]), b: clampY(pts[0]![1]), c: 1, d: 0 });
      for (let i = 1; i < pts.length; i++) {
        travelled += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
        t = Math.max(t + 1, s.tick + startIn + Math.round(travelled / speed));
        at.set(t, { k: INK_INPUT_STROKE, a: clampX(pts[i]![0]), b: clampY(pts[i]![1]), c: 0, d: 0 });
      }
      at.set(t + 1, { k: INK_INPUT_LIFT, a: 200, b: 0, c: 0, d: 0 });
    }
    const log: ArcadeInputEvent[] = [];
    const trace: { x: number; y: number; on: number }[] = [];
    let st = s;
    for (let k = 0; k < 400 && !game.isOver(st) && st.level === s.level && st.fails === s.fails && st.flashTick === s.flashTick; k++) {
      const ev = at.get(st.tick + 1);
      if (ev) recordInput(log, { ...ev, t: st.tick + 1 }, game.inputRanges);
      st = game.step(st, inputAt(log, st.tick + 1));
      trace.push({ x: st.ball.x / 256, y: st.ball.y / 256, on: st.ball.on });
    }
    return { potted: st.levels > s.levels, trace };
  };
  const trace = run(null).trace;
  let leave = trace.findIndex((p, i) => i > 0 && trace[i - 1]!.on >= 0 && p.on < 0);
  if (leave < 0 && trace[0]?.on === -1) leave = 0;
  if (leave < 0) return null;
  let tries = 0;
  for (const d of [Math.max(startIn, 8), startIn + 8, startIn + 16, 26, 38, 52])
    for (const dy0 of [40, 64, 90, 120]) {
      const p = trace[leave + d];
      if (!p) continue;
      const dir = lvl.bucketX >= p.x ? 1 : -1;
      const cx = Math.round(p.x) + dir * 8;
      const cy = Math.round(p.y) + dy0;
      if (cy >= lvl.bucketY - 40) continue;
      for (const lift of [30, 50, 70])
        for (const off of [0, -14, 14]) {
          if (++tries > 60) return null;
          const ramp = [cx, cy, lvl.bucketX - dir * off, lvl.bucketY - lift];
          if (steep(ramp)) continue;
          if (run(ramp).potted && run(ramp, 3).potted && run(ramp, -3).potted) return ramp;
        }
    }
  return null;
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  const init = game.init(seed) as InkState;
  worldH = inkWorldH(init);
  const expand = init.rev === INK_REV_EXPAND;
  phoneExact = expand;

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

  const planAttempt = (s: InkState, t: number) => {
    plan.clear();
    const lvl = s.list[s.level]!;
    const live = inkIsLive(s.level, s.rev);
    const first = attempt === 0;
    // Look at the level (a fresh level takes longer than a retry).
    let at = t + (first ? human.thinkTicks(2800 + 250 * s.level + (live ? 1500 : 0)) : human.thinkTicks(1300));
    let ideal: Ideal | null = null;
    if (expand) {
      // inkRev 10: every one of levels 1–8 has a bonus line (its star, silver coins, the shamrock, a cloud's trick
      // shot). A player goes for it at their level's rate, and only when the line looks steady enough to risk a drop.
      if (FEATURES && first && lvl.star && lvl.starRef && !starTried.has(s.level) && human.chance(BONUS_GO[human.band])) {
        starTried.add(s.level);
        const st = inkIdeal(game, seed, s, true);
        if (st.ok && (st.rel ?? 0) >= BONUS_MIN_REL[human.band]) ideal = st;
      }
    } else if (FEATURES && first && lvl.trickRef && !starTried.has(s.level) && human.chance(TRICK_GO[level])) {
      // inkRev 10: the trick shot off the bounce cloud (its line carries the level's star, if any).
      starTried.add(s.level);
      const st = inkIdeal(game, seed, s, "trick");
      // A trick line that rarely holds up to a wobble is not worth a failed drop: only a steady one is tried.
      if (st.ok && (st.rel ?? 0) >= TRICK_MIN_REL) ideal = st;
    } else if (FEATURES && first && lvl.star && !lvl.trickRef && !starTried.has(s.level) && human.chance(STAR_GO[level])) {
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
      // A new attempt after every missed drop (inkRev 10's warm-up misses keep the fail count, so the miss's tick says so).
      const k = s.level * 1_000_000 + s.fails * 100_000 + (s.flashKind === 2 ? s.flashTick : 0);
      if (k !== key) {
        attempt = s.level === lastLevel ? attempt + 1 : 0;
        lastLevel = s.level;
        key = k;
        planAttempt(s, t);
      }
      if (s.dropping && !liveQueued) {
        // Live level: RELEASE is in; the hand goes to the screen and draws the catch ramp.
        liveQueued = true;
        let at = t + human.reactTicks() + human.int(3, 8);
        // inkRev 10: the ramp is aimed at where the coin is seen to fall (the planned one if none is found).
        const seen = expand ? liveRescue(game, s, at - t, DRAW_LIVE[level]) : null;
        if (seen) liveRamps = [seen];
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
