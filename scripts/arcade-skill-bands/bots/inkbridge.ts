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
import { inputAt, recordInput, type ArcadeInputEvent } from "../../../src/lib/arcade/engine";
import {
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
const DRAW: Record<SkillLevel, number> = { average: 6, good: 7, great: 8, near: 9 };
/** Quick live-ramp stroke speed, px a tick. */
const DRAW_LIVE: Record<SkillLevel, number> = { average: 10, good: 12, great: 14, near: 16 };
/** Moving pot: release read error per tick of coin flight (ticks of error per tick ahead). */
const READ: Record<SkillLevel, number> = { average: 0.09, good: 0.065, great: 0.045, near: 0.03 };
/** Chance of going for the gold star on a level that has one (first attempt only). */
const STAR_GO: Record<SkillLevel, number> = { average: 0.1, good: 0.35, great: 0.6, near: 0.85 };
/** The ideal live ramp is worked out for a hand that starts this many ticks after RELEASE. */
const IDEAL_LIVE_DELAY = 22;
const IDEAL_LIVE_SPEED = 12;
const SPOUT_Y = 50;
const SIM_BUDGET = 70;

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
}

/** The points a phone sends for a straight-segment polyline drawn steadily: every 12 px, rounded. */
function phonePoints(pts: readonly number[]): [number, number][] {
  const out: [number, number][] = [[Math.round(pts[0]!), Math.round(pts[1]!)]];
  for (let i = 2; i < pts.length; i += 2) {
    const x0 = pts[i - 2]!;
    const y0 = pts[i - 1]!;
    const x1 = pts[i]!;
    const y1 = pts[i + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / INK_STEP_PX));
    for (let k = 1; k <= n; k++) out.push([Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n)]);
  }
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
  const fine: [number, number][] = [[pts[0]!, pts[1]!]];
  for (let i = 2; i < pts.length; i += 2) {
    const x0 = pts[i - 2]!;
    const y0 = pts[i - 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(pts[i]! - x0, pts[i + 1]! - y0) / 2));
    for (let k = 1; k <= n; k++) fine.push([x0 + ((pts[i]! - x0) * k) / n, y0 + ((pts[i + 1]! - y0) * k) / n]);
  }
  // A steady offset for the whole stroke, a slow drift, and a little wobble.
  const ox = human.aim(WORLD_PER_PX, offScale);
  const oy = human.aim(WORLD_PER_PX, offScale);
  let dx = 0;
  let dy = 0;
  const at = (p: [number, number]) => {
    dx = dx * 0.92 + human.aim(WORLD_PER_PX, 0.1);
    dy = dy * 0.92 + human.aim(WORLD_PER_PX, 0.1);
    return [clampX(p[0] + ox + dx), clampY(p[1] + oy + dy)] as const;
  };
  let t = t0;
  const first = at(fine[0]!);
  plan.at(t, { k: INK_INPUT_STROKE, a: first[0], b: first[1], c: 1, d: 0 });
  let last = first;
  let travelled = 0;
  for (let i = 1; i < fine.length; i++) {
    travelled += Math.hypot(fine[i]![0] - fine[i - 1]![0], fine[i]![1] - fine[i - 1]![1]);
    const p = at(fine[i]!);
    const end = i === fine.length - 1;
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= INK_STEP_PX || (end && (p[0] !== last[0] || p[1] !== last[1]))) {
      t = plan.at(Math.max(t + 1, t0 + Math.round(travelled / speed)), { k: INK_INPUT_STROKE, a: p[0], b: p[1], c: 0, d: 0 });
      last = p;
    }
  }
  return t + 1;
}

const state0Segs = (s: InkState) => s.segs.length;
export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  const init = game.init(seed) as InkState;

  /**
   * Noise-free drop from a fresh level state: lines drawn as a phone sends them, RELEASE at
   * `rel` (absolute tick, or as soon as drawn), live ramps from IDEAL_LIVE_DELAY after it.
   */
  const simulate = (from: InkState, strokes: number[][], rel: number | null, live: number[][], still = false): { potted: boolean; star: boolean; flight: number } => {
    let s: InkState = from;
    if (still) {
      const list = [...s.list];
      list[s.level] = { ...list[s.level]!, slideAmp: 0 };
      s = { ...s, list };
    }
    const log: ArcadeInputEvent[] = [];
    const q: Ev[] = [];
    for (const st of strokes) {
      const pts = phonePoints(st);
      q.push({ k: INK_INPUT_STROKE, a: pts[0]![0], b: pts[0]![1], c: 1, d: 0 });
      for (let i = 1; i < pts.length; i++) q.push({ k: INK_INPUT_STROKE, a: pts[i]![0], b: pts[i]![1], c: 0, d: 0 });
    }
    const liveQ: { at: number; ev: Ev }[] = [];
    let la = IDEAL_LIVE_DELAY;
    for (const st of live) {
      const pts = phonePoints(st);
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
    }
    return { potted: s.levels > from.levels, star: (s.stars ?? 0) > (from.stars ?? 0), flight: released >= 0 ? s.tick - released : 0 };
  };

  /** The line (and release phase / live ramp) an experienced player would use on this level. */
  const idealFor = (s: InkState, wantStar: boolean): Ideal => {
    const key = `${seed}:${s.level}:${wantStar ? 1 : 0}:${s.rev}`;
    const hit = idealCache.get(key);
    if (hit) return hit;
    const lvl: InkLevel = s.list[s.level]!;
    const live = inkIsLive(s.level, s.rev);
    const moving = lvl.slideAmp > 0;
    let sims = 0;
    const shift = (st: number[][], dx: number) => st.map((p) => p.map((v, i) => (i % 2 === 0 && i > 0 ? v + dx : v)));
    const tryLine = (strokes: number[][], liveSt: number[][], needStar: boolean): Ideal | null => {
      if (sims >= SIM_BUDGET) return null;
      sims += 1;
      const base = simulate(s, strokes, null, liveSt, moving);
      if (!base.potted || (needStar && !base.star)) return null;
      let phase = 0;
      let flight = base.flight;
      if (moving) {
        // The release moment: the first of 12 over a slide period that pots with the pot moving.
        let found = -1;
        for (let k = 0; k < 12 && found < 0 && sims < SIM_BUDGET; k++) {
          const rel = s.tick + 400 + Math.trunc((k * lvl.slidePeriod) / 12);
          sims += 1;
          const r = simulate(s, strokes, rel, liveSt);
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
    const robust = (cand: Ideal | null, needStar: boolean): boolean => {
      if (!cand || sims + 2 > SIM_BUDGET) return false;
      for (const dx of [-5, 5]) {
        sims += 1;
        const r = simulate(s, shift(cand.strokes, dx), null, cand.live, true);
        if (!r.potted || (needStar && !r.star)) return false;
      }
      return true;
    };
    let fallback: Ideal | null = null;
    const consider = (strokes: number[][], liveSt: number[][], needStar: boolean): Ideal | null => {
      const c = tryLine(strokes, liveSt, needStar);
      if (!c) return null;
      if (robust(c, needStar)) return c;
      fallback ??= c;
      return null;
    };
    let found: Ideal | null = null;
    const liveRamps = (lvl.liveRef ?? []).map((l) => [...l.pts]);
    if (wantStar && lvl.starRef) {
      // The proved star line, then small reshapes of it that still take the star.
      const sr = lvl.starRef.map((p) => [...p]);
      found = consider(sr, [], true);
      for (const [dx, dy] of [[0, 10], [0, -10], [12, 0], [-12, 0], [8, 8], [-8, 8], [0, 20], [16, 10]]) {
        if (found || sims >= SIM_BUDGET) break;
        found = consider(sr.map((p) => p.map((v, i) => (i < 2 || i >= p.length - 2 ? v : i % 2 === 0 ? v + dx : v + dy))), [], true);
      }
      if (!found && fallback) found = fallback;
      const out = found ?? { strokes: [], phase: 0, period: 0, live: [], flight: 0, ok: false };
      idealCache.set(key, out);
      return out;
    }
    found = consider(lvl.ref.map((p) => [...p]), liveRamps, false);
    if (!found) {
      // The generator's family of ramps, steep ones skipped (they break into wall pieces when drawn).
      const dir = lvl.bucketX > lvl.spoutX ? 1 : -1;
      const sx = lvl.spoutX - dir * 24;
      const sy = SPOUT_Y + 28;
      const way: ([number, number] | null)[] = [null];
      for (const fy of [25, 45, 65]) for (const fx of [-60, -20, 20, 60, 110]) way.push([lvl.spoutX + dir * fx, sy + Math.trunc(((lvl.bucketY - sy) * fy) / 100)]);
      if (live) {
        // Live: keep the proved pre-release line, move the catch ramp.
        const pre = lvl.ref.map((p) => [...p]);
        for (const ramp of liveRamps)
          for (const [dx, dy] of [[0, 12], [0, 24], [dir * 12, 12], [-dir * 12, 12], [0, -10], [dir * 20, 24]]) {
            if (found || sims >= SIM_BUDGET) break;
            found = consider(pre, [[ramp[0]! + dx, ramp[1]! + dy, ...ramp.slice(2)]], false);
          }
      } else {
        outer: for (const w of way)
          for (const lift of [14, 26, 44, 70])
            for (const off of [0, -12, 12, -24, 24, -36, 36]) {
              if (found || sims >= SIM_BUDGET) break outer;
              const ex = lvl.bucketX - dir * off;
              const ey = lvl.bucketY - lift;
              if (w && (w[0] < 4 || w[0] > INK_WORLD_W - 4 || w[1] >= ey - 10)) continue;
              const pts = w ? [sx, sy, w[0], w[1], ex, ey] : [sx, sy, ex, ey];
              if (steep(pts)) continue;
              found = consider([pts], [], false);
            }
      }
    }
    found ??= fallback;
    const out = found ?? { strokes: lvl.ref.map((p) => [...p]), phase: (lvl.refT0 + 1) % Math.max(1, lvl.slidePeriod), period: lvl.slideAmp ? lvl.slidePeriod : 0, live: liveRamps, flight: 150, ok: false };
    idealCache.set(key, out);
    if ((globalThis as any).IDBG) console.log("ideal", key, "ok", out.ok, "sims", sims, JSON.stringify(out.strokes), out.phase, out.period, JSON.stringify(out.live));
    return out;
  };

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
    if (first && lvl.star && !starTried.has(s.level) && human.chance(STAR_GO[level])) {
      starTried.add(s.level);
      const st = idealFor(s, true);
      if (st.ok) ideal = st;
    }
    ideal ??= idealFor(s, false);
    let strokes = ideal.strokes.map((p) => [...p]);
    // Misjudging where the line should end on a first look (less so on a retry).
    if (human.chance(human.p.judgement * (first ? 0.7 : 0.2)) || human.slip()) {
      const sx = human.normal() * 22;
      const sy = human.normal() * 18;
      strokes = strokes.map((p) => p.map((v, i) => (i < 2 ? v : i % 2 === 0 ? v + sx : v + sy)));
    }
    for (const pts of strokes) {
      at = drawStroke(plan, human, pts, at, DRAW[level]);
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
        if ((globalThis as any).IDBG) console.log("t", t, "level", s.level, "fails", s.fails, s.failedBall ? [s.failedBall.x >> 8, s.failedBall.y >> 8] : "", "segs", JSON.stringify(state0Segs(s)));
        attempt = s.level === lastLevel ? attempt + 1 : 0;
        lastLevel = s.level;
        key = k;
        planAttempt(s, t);
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
