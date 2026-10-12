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
  bullseyeBalloonAt,
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
  if (balloons && balloon) return { ...bullseyeBalloonAt(balloon, land), kind: "pop" };
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
