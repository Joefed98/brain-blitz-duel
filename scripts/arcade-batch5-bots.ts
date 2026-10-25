/**
 * Bots for the batch-5 arcade check: each plays a revision through the real
 * sim (forking the state to try a move before committing it) and returns the
 * input log, so the check can replay it through the server path.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { inputAt, recordInput, type ArcadeGame, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  binTossCentreAt,
  binTossPredict,
  binTossWindAcc,
  binTossWindSub,
  BINTOSS_AIM,
  BINTOSS_FLY,
  BINTOSS_INPUT_FLICK,
  BINTOSS_VX_MAX,
  type BinTossState,
} from "../src/lib/arcade/binToss";

import {
  bullseyeBalloonPos,
  bullseyeRingValues,
  bullseyeScalePct,
  bullseyeSway,
  bullseyeTargetDx,
  bullseyeWindShiftPx,
  BULLSEYE_BOW_X,
  BULLSEYE_BOW_Y,
  BULLSEYE_CX,
  BULLSEYE_CY,
  BULLSEYE_FLIGHT_NUM,
  BULLSEYE_FLIGHT_DEN,
  BULLSEYE_FLIGHT_TICKS,
  BULLSEYE_INPUT_SHOT,
  BULLSEYE_RING_STEP,
  type BullseyeState,
} from "../src/lib/arcade/bullseye";

import { ARCADE_INPUT_DRAG } from "../src/lib/arcade/engine";
import { rallyPaddleW, rallyTotalHits, RALLY_BALL_R, RALLY_PADDLE_Y, RALLY_WALL, RALLY_WORLD_W, type RallyState } from "../src/lib/arcade/rally";
import { BEAT_INPUT_RELEASE, BEAT_INPUT_SWIPE, BEAT_INPUT_TAP, type BeatState } from "../src/lib/arcade/beat";
import {
  INK_INPUT_DROP_AGAIN,
  INK_INPUT_LIFT,
  INK_INPUT_RELEASE,
  INK_INPUT_STROKE,
  type InkState,
} from "../src/lib/arcade/inkBridge";
export interface BotRun<S> {
  events: ArcadeInputEvent[];
  state: S;
  checkpoints: unknown[];
}

/** Steps a game to its end with a per-tick event picker, recording the log. */
export function runWith<S extends { tick: number }>(
  game: ArcadeGame<S, ArcadeInputEvent | null>,
  seed: number,
  pick: (state: S, t: number) => ArcadeInputEvent | null,
  checkpoint: (s: S) => unknown,
  init?: S,
): BotRun<S> {
  let state = init ?? game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: unknown[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    const ev = pick(state, t);
    if (ev) recordInput(events, { ...ev, t }, game.inputRanges ?? []);
    state = game.step(state, inputAt(events, t));
    if (state.tick % 300 === 0) checkpoints.push(checkpoint(state));
  }
  return { events, state, checkpoints };
}

/* ================================== Swish ================================== */

/** Plays one throw from an AIM state: waits `delay` ticks, flicks, returns the state once it resolves. */
function swishTry(game: ArcadeGame<BinTossState, ArcadeInputEvent | null>, from: BinTossState, delay: number, vx: number, vy: number): BinTossState {
  let s = from;
  for (let k = 0; k < delay; k++) s = game.step(s, null);
  s = game.step(s, { t: s.tick + 1, k: BINTOSS_INPUT_FLICK, a: vx, b: vy, c: 0, d: 0 });
  let guard = 0;
  while (s.phase === BINTOSS_FLY && guard++ < 600) s = game.step(s, null);
  return s;
}

/**
 * Finds the earliest throw (delay, vx, vy) that scores from this AIM state —
 * through the hoop too when `hoop` is set and the throw has one. Null if none.
 */
export function swishPlan(
  game: ArcadeGame<BinTossState, ArcadeInputEvent | null>,
  state: BinTossState,
  hoop: boolean,
): { delay: number; vx: number; vy: number } | null {
  const index = state.throwIndex;
  const wind = state.winds[index] ?? 0;
  const acc = binTossWindAcc(index, state.rev);
  const sub = binTossWindSub(state.rev);
  const wantHoop = hoop && Boolean(state.hoops?.[index]);
  for (let delay = 0; delay <= 180; delay += 3) {
    for (let vy = -900; vy >= -3_800; vy -= 100) {
      // Bisection on the obstacle-free flight, aimed at where the bucket will be on landing.
      let lo = -BINTOSS_VX_MAX;
      let hi = BINTOSS_VX_MAX;
      const flightTicks = Math.round((2 * -vy) / 22) + 4;
      const centre = binTossCentreAt(state, index, state.tick + delay + flightTicks) / 256;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (binTossPredict(mid, vy, wind, acc, sub).x < centre) lo = mid;
        else hi = mid;
      }
      for (const off of [0, -6, 6, -14, 14, -24, 24]) {
        const vx = hi + off;
        const out = swishTry(game, state, delay, vx, vy);
        const scored = out.baskets > state.baskets;
        if (!scored) continue;
        if (wantHoop && (out.swishes ?? 0) <= (state.swishes ?? 0)) continue;
        return { delay, vx, vy };
      }
    }
  }
  return null;
}

/** A full Swish run: every throw that can be made is made (through every hoop when `hoop`). */
export function playSwish(
  game: ArcadeGame<BinTossState, ArcadeInputEvent | null>,
  seed: number,
  checkpoint: (s: BinTossState) => unknown,
  opts: { hoop: boolean; missThrow?: number },
): BotRun<BinTossState> & { unmade: number[] } {
  let plan: { at: number; vx: number; vy: number } | null = null;
  const unmade: number[] = [];
  let planned = -1;
  const run = runWith(game, seed, (s, t) => {
    if (s.phase !== BINTOSS_AIM) return null;
    if (planned !== s.throwIndex) {
      planned = s.throwIndex;
      if (opts.missThrow === s.throwIndex) {
        plan = { at: t, vx: -BINTOSS_VX_MAX, vy: -900 };
      } else {
        const found = swishPlan(game, s, opts.hoop);
        if (!found) unmade.push(s.throwIndex);
        plan = found ? { at: t + found.delay, vx: found.vx, vy: found.vy } : { at: t, vx: -BINTOSS_VX_MAX, vy: -900 };
      }
    }
    if (plan && t === plan.at) return { t, k: BINTOSS_INPUT_FLICK, a: plan.vx, b: plan.vy, c: 0, d: 0 };
    return null;
  }, checkpoint);
  return { ...run, unmade };
}

/* ================================ Flightpath ================================ */


/** The launch that lands a dart released on tick `t` at world point (x, y), sway and wind allowed for. */
function dartFor(state: BullseyeState, t: number, x: number, y: number): { vx: number; vy: number } {
  const arrow = state.arrowIndex;
  const sway = bullseyeSway(arrow, t);
  const wind = bullseyeWindShiftPx(arrow, state.winds[arrow] ?? 0);
  const reachX = x - wind - sway.dx - BULLSEYE_BOW_X;
  const reachY = BULLSEYE_BOW_Y - (y - sway.dy);
  return {
    vx: Math.round((reachX * BULLSEYE_FLIGHT_DEN) / BULLSEYE_FLIGHT_NUM),
    vy: -Math.round((reachY * BULLSEYE_FLIGHT_DEN) / BULLSEYE_FLIGHT_NUM),
  };
}

/**
 * Where a perfect dart goes: the balloon when `balloons` and this dart has one,
 * else the inner bull when the 10 is in the middle, else the middle of the 10
 * ring. Returns the aim point for a release on tick t.
 */
function dartTarget(state: BullseyeState, t: number, balloons: boolean): { x: number; y: number; kind: "pop" | "bull" | "ten" } {
  const arrow = state.arrowIndex;
  const land = t + BULLSEYE_FLIGHT_TICKS;
  const balloon = state.balloons?.[arrow] ?? null;
  if (balloons && balloon) return { ...bullseyeBalloonPos(state, arrow, land)!, kind: "pop" };
  const tdx = bullseyeTargetDx(arrow, land, state.driftPhase, state.driftDir);
  const values = bullseyeRingValues(state, arrow);
  const ring = values.indexOf(10);
  if (ring <= 0) return { x: BULLSEYE_CX + tdx, y: BULLSEYE_CY, kind: values[0] === 10 ? "bull" : "ten" };
  // The middle of the 10 annulus, straight above the centre.
  const r = (BULLSEYE_RING_STEP * (ring + 0.5) * bullseyeScalePct(arrow)) / 100;
  return { x: BULLSEYE_CX + tdx, y: Math.round(BULLSEYE_CY - r), kind: "ten" };
}

/** Every dart thrown at its best target (forking the sim to confirm the hit), as soon as it can be. */
export function playFlightpath(
  game: ArcadeGame<BullseyeState, ArcadeInputEvent | null>,
  seed: number,
  checkpoint: (s: BullseyeState) => unknown,
  opts: { balloons: boolean; init?: BullseyeState; noise?: () => number },
): BotRun<BullseyeState> {
  return runWith(game, seed, (s, t) => {
    if (s.flightTick > 1 || s.arrowIndex >= 10) return null;
    if (s.flightTick === 1) return null;
    const goal = dartTarget(s, t, opts.balloons);
    const base = dartFor(s, t, goal.x, goal.y);
    if (opts.noise) return { t, k: BULLSEYE_INPUT_SHOT, a: base.vx + opts.noise(), b: Math.min(0, base.vy + opts.noise()), c: 0, d: 0 };
    for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [-3, 0], [0, 3], [0, -3]] as const) {
      const ev = { t, k: BULLSEYE_INPUT_SHOT, a: base.vx + ox, b: base.vy + oy, c: 0, d: 0 };
      const hit = game.step(s, ev).hits.at(-1);
      if (!hit) continue;
      const good = goal.kind === "pop" ? hit.pop === 1 : goal.kind === "bull" ? hit.bull === 1 : hit.value === 10;
      if (good) return ev;
    }
    return null; // try again next tick (the sway moves on)
  }, checkpoint, opts.init);
}

/* ================================== Rally ================================== */


/** Where a falling ball meets the paddle line (walls folded in), and how many ticks away. */
function rallyLanding(b: { x: number; y: number; vx: number; vy: number }): { x: number; t: number } | null {
  if (b.vy <= 0) return null;
  const t = ((RALLY_PADDLE_Y - RALLY_BALL_R) * 256 - b.y) / b.vy;
  if (t < 0) return null;
  const lo = (RALLY_WALL + RALLY_BALL_R) * 256;
  const w = (RALLY_WORLD_W - RALLY_WALL - RALLY_BALL_R) * 256 - lo;
  let x = b.x + b.vx * t - lo;
  x = ((x % (2 * w)) + 2 * w) % (2 * w);
  if (x > w) x = 2 * w - x;
  return { x: (x + lo) / 256, t };
}

/**
 * A tracking paddle: meets whichever ball lands first (the blue one when both
 * are close), hitting gold balls a little off-centre (`steer`, in paddle
 * half-widths) to send them back at an angle.
 */
export function playRally(
  game: ArcadeGame<RallyState, ArcadeInputEvent | null>,
  seed: number,
  checkpoint: (s: RallyState) => unknown,
  steer = 0,
): BotRun<RallyState> {
  return runWith(game, seed, (s, t) => {
    const cands: { x: number; t: number; blue: boolean }[] = [];
    const main = rallyLanding(s);
    if (main) cands.push({ ...main, blue: true });
    for (const g of s.golds) {
      const l = rallyLanding(g);
      if (l) cands.push({ ...l, blue: false });
    }
    cands.sort((a, b) => a.t - b.t);
    let aim = cands[0];
    const blue = cands.find((c) => c.blue);
    if (aim && !aim.blue && blue && blue.t - aim.t < 25) aim = blue;
    if (!aim) return null;
    const half = rallyPaddleW(rallyTotalHits(s)) / 2;
    const off = aim.blue ? 0 : steer * half * (aim.x < RALLY_WORLD_W / 2 ? -1 : 1);
    return { t, k: ARCADE_INPUT_DRAG, a: Math.round(aim.x + off), b: 0, c: 0, d: 0 };
  }, checkpoint);
}

/* ================================== Tempo ================================== */


/**
 * A perfect player: taps each note on its tick, releases each hold on its
 * tail tick, swipes each swipe note the right way on its tick. One input per
 * tick, so a clash moves the later input on by a tick (still Perfect).
 * `wrongSwipes` swipes the wrong way instead, `tapSwipes` taps swipe notes.
 */
export function playTempo(
  game: ArcadeGame<BeatState, ArcadeInputEvent | null>,
  seed: number,
  checkpoint: (s: BeatState) => unknown,
  opts: { wrongSwipes?: boolean; tapSwipes?: boolean } = {},
): BotRun<BeatState> {
  const chart = game.init(seed).chart;
  const plan = new Map<number, ArcadeInputEvent>();
  const put = (t: number, k: number, a: number, b = 0) => {
    let at = t;
    while (plan.has(at)) at++;
    plan.set(at, { t: at, k, a, b, c: 0, d: 0 });
  };
  const wants: { t: number; k: number; a: number; b: number }[] = [];
  chart.ticks.forEach((t, i) => {
    const lane = chart.lanes[i]!;
    const swipe = chart.swipes?.[i] ?? 0;
    if (swipe && !opts.tapSwipes) {
      const right = swipe > 0 ? 1 : 0;
      wants.push({ t, k: BEAT_INPUT_SWIPE, a: lane, b: opts.wrongSwipes ? 1 - right : right });
    } else wants.push({ t, k: BEAT_INPUT_TAP, a: lane, b: 0 });
    if ((chart.holds[i] ?? 0) > 0) wants.push({ t: t + chart.holds[i]!, k: BEAT_INPUT_RELEASE, a: lane, b: 0 });
  });
  wants.sort((x, y) => x.t - y.t || x.k - y.k);
  for (const w of wants) put(w.t, w.k, w.a, w.b);
  return runWith(game, seed, (_s, t) => plan.get(t) ?? null, checkpoint);
}

/* ============================== Rainbow Bridge ============================== */


/**
 * Draws each level's proved line — the gold-star line when `stars` and the level
 * has one, else the reference — releases on its proved tick (a moving pot waits
 * for its phase), and draws the live strokes on live levels. `failFrom` drops
 * the coin away (DROP AGAIN) from that level on.
 */
export function playInk(
  game: ArcadeGame<InkState, ArcadeInputEvent | null>,
  seed: number,
  checkpoint: (s: InkState) => unknown,
  opts: { stars: boolean; failFrom?: number; /** inkRev 9: draw each cloud level's trick line (it carries that level's star, if any). */ tricks?: boolean },
): BotRun<InkState> {
  type Step = { ev: Omit<ArcadeInputEvent, "t">; after?: number; release?: { t0: number; period: number } };
  let queue: Step[] = [];
  let planned = -1;
  return runWith(game, seed, (s) => {
    const failing = opts.failFrom !== undefined && s.level >= opts.failFrom;
    if (s.dropping) {
      if (failing) return { t: 0, k: INK_INPUT_DROP_AGAIN, a: 1, b: 0, c: 0, d: 0 };
      const next = queue[0];
      if (!next || s.dropTicks < (next.after ?? 0)) return null;
      queue.shift();
      return { t: 0, ...next.ev };
    }
    const key = s.level * 10 + s.fails;
    if (planned !== key) {
      planned = key;
      const lvl = s.list[s.level]!;
      const useTrick = opts.tricks && lvl.trickRef;
      const useStar = !useTrick && opts.stars && lvl.star && lvl.starRef;
      const lines = useTrick ? lvl.trickRef! : useStar ? lvl.starRef! : lvl.ref;
      const t0 = useTrick ? (lvl.trickT0 ?? 0) : useStar ? (lvl.starT0 ?? 0) : lvl.refT0;
      queue = [];
      for (const pts of lines) {
        queue.push({ ev: { k: INK_INPUT_STROKE, a: pts[0]!, b: pts[1]!, c: 1, d: 0 } });
        for (let i = 2; i < pts.length; i += 2) queue.push({ ev: { k: INK_INPUT_STROKE, a: pts[i]!, b: pts[i + 1]!, c: 0, d: 0 } });
      }
      queue.push({ ev: { k: INK_INPUT_RELEASE, a: 1, b: 0, c: 0, d: 0 }, release: { t0, period: lvl.slideAmp ? lvl.slidePeriod : 0 } });
      for (const live of lvl.liveRef ?? []) {
        queue.push({ after: live.tick, ev: { k: INK_INPUT_STROKE, a: live.pts[0]!, b: live.pts[1]!, c: 1, d: 0 } });
        for (let i = 2; i < live.pts.length; i += 2) queue.push({ after: live.tick, ev: { k: INK_INPUT_STROKE, a: live.pts[i]!, b: live.pts[i + 1]!, c: 0, d: 0 } });
        queue.push({ after: live.tick, ev: { k: INK_INPUT_LIFT, a: 1, b: 0, c: 0, d: 0 } });
      }
    }
    const next = queue[0];
    if (!next) return null;
    if (next.release && next.release.period > 0 && (s.tick + 1 - (next.release.t0 + 1)) % next.release.period !== 0) return null;
    queue.shift();
    return { t: 0, ...next.ev };
  }, checkpoint);
}
