/**
 * Apex's oracle (a perfect driver, racingRev 1 and 2): plays a seed to exactly 200 through the real sim when the seed
 * allows it (both laps, every sector clean, home before RACING_PAR_TICKS). scripts/racing-deal.ts keeps only the
 * seeds it proves through the server replay.
 *
 * The driver is a speed profile and a lateral controller: each segment's highest speed (`share` of the speed at which
 * the curve's push needs full lock), with braking zones worked backwards at `brakeShare` of full braking; each tick it
 * picks the pedal that meets the profile and the steer that holds the car on its line one tick ahead. The skill-band
 * bots (scripts/arcade-skill-bands/bots/racing.ts) drive the same controller through a Human's errors.
 *
 * racingRev 2 (31 Oct 2026): the same controller; the steer it wants is the front wheels' steer, so the stick sent
 * is the value whose dead zone + expo target gives it (racingV2StickFor), and the wheels reach it at the smoothing
 * rate; the throttle is held through the lights, so the car leaves on lights out.
 *
 * Script-only (floats are fine: the result is an input log the sim replays).
 *
 *   bun scripts/racing-oracle.ts [--rev=1] [seed…]
 */
import { inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  racingBalanceSpeed,
  racingGameFor,
  racingGoTick,
  racingV2SteerTarget,
  racingPush,
  racingSegAt,
  racingTrack,
  RACING_ACCEL,
  RACING_BRAKE,
  RACING_COAST,
  RACING_INPUT_RANGES,
  RACING_INPUT_STICK,
  RACING_LAP_SEGS,
  RACING_REV_2,
  RACING_REV_DEALT,
  RACING_SEG,
  RACING_STEER_K,
  RACING_STICK_MAX,
  RACING_VMAX,
  type RacingState,
  type RacingTrack,
} from "../src/lib/arcade/racing";

/** Each lap segment's highest speed, as a cyclic profile (index by lap segment). */
export function racingSpeedProfile(track: RacingTrack, share: number, brakeShare: number): Int32Array {
  const n = RACING_LAP_SEGS;
  const cap = new Int32Array(n);
  for (let i = 0; i < n; i++) cap[i] = Math.floor(racingBalanceSpeed(track.curve[i]!) * share);
  const lim = Int32Array.from(cap);
  const dec = 2 * RACING_BRAKE * brakeShare * RACING_SEG;
  // Two passes backwards round the loop settle the wrap-around.
  for (let pass = 0; pass < 2; pass++)
    for (let k = 2 * n - 1; k >= 0; k--) {
      const i = k % n;
      const next = lim[(i + 1) % n]!;
      const v = Math.floor(Math.sqrt(next * next + dec));
      if (v < lim[i]!) lim[i] = v;
    }
  return lim;
}

/** The speed the next tick gives for a pedal (mirrors racingStep's on-track rule). */
function nextSpeed(v: number, pedal: number): number {
  let n = v;
  if (pedal > 0) n += Math.floor((RACING_ACCEL * pedal * (RACING_VMAX - v)) / (RACING_STICK_MAX * RACING_VMAX));
  else if (pedal < 0) n -= Math.floor((RACING_BRAKE * -pedal) / RACING_STICK_MAX);
  else n -= RACING_COAST;
  return Math.max(0, Math.min(RACING_VMAX, n));
}

export interface DriveTuning {
  /** Share of the balance speed the profile allows. */
  share: number;
  /** Share of full braking the braking zones assume. */
  brakeShare: number;
  /** Segments of look-ahead on the profile (the brake point). */
  look: number;
  /** Lateral line to hold (lateral units). */
  line: number;
  /** Lateral correction gain (share of the error closed a tick). */
  gain: number;
}

export const ORACLE_TUNING: DriveTuning = { share: 0.995, brakeShare: 0.99, look: 1, line: 0, gain: 0.25 };

/** One tick of the driver: the joystick for the state about to step (pedal, steer). */
export function racingDriverInput(state: RacingState, profile: Int32Array, tune: DriveTuning, view?: { x: number; v: number; s: number }): { steer: number; pedal: number } {
  const track = racingTrack(state.seed);
  const seen = view ?? state;
  // The profile is indexed by race segment modulo its length (a lap's, or the whole race's for the bots).
  const seg = Math.floor(seen.s / RACING_SEG);
  // The profile at the segments the car reaches over the look-ahead.
  let target = RACING_VMAX;
  const reach = Math.max(1, Math.ceil((seen.v * Math.max(1, tune.look)) / RACING_SEG) + 1);
  for (let k = 0; k <= reach; k++) target = Math.min(target, profile[(seg + k) % profile.length]!);
  let pedal: number;
  if (nextSpeed(seen.v, 100) <= target) pedal = 100;
  else if (seen.v > target) pedal = -Math.min(100, Math.ceil(((seen.v - target) * 100) / RACING_BRAKE));
  else {
    // Partial throttle to sit on the target.
    pedal = 0;
    for (let p = 100; p >= 0; p -= 5)
      if (nextSpeed(seen.v, p) <= target) {
        pedal = p;
        break;
      }
  }
  const v1 = nextSpeed(seen.v, pedal);
  const c = track.curve[racingSegAt(seen.s)]!;
  const want = (tune.line - seen.x) * tune.gain + racingPush(c, v1);
  let steer = v1 > 0 ? Math.round((want * RACING_STICK_MAX * RACING_VMAX) / (RACING_STEER_K * v1)) : 0;
  steer = Math.max(-RACING_STICK_MAX, Math.min(RACING_STICK_MAX, steer));
  return { steer, pedal: Math.max(-RACING_STICK_MAX, Math.min(RACING_STICK_MAX, pedal)) };
}

/** racingRev 2: the stick value (0…100 each way) whose target is nearest the steer wanted (ties: the smaller stick). */
const V2_TARGETS = Array.from({ length: RACING_STICK_MAX + 1 }, (_, a) => racingV2SteerTarget(a));
export function racingV2StickFor(steer: number): number {
  const m = Math.min(RACING_STICK_MAX, Math.abs(steer));
  let best = 0;
  for (let a = 1; a <= RACING_STICK_MAX; a++) if (Math.abs(V2_TARGETS[a]! - m) < Math.abs(V2_TARGETS[best]! - m)) best = a;
  return steer < 0 ? -best : best;
}

/** The stick the controller's steer asks for on a revision (racingRev 1 is linear). */
export function racingStickFor(rev: number, steer: number): number {
  return rev >= RACING_REV_2 ? racingV2StickFor(steer) : steer;
}

/** Plays a seed with the driver, recording the phone's log (one event a tick, only on a change). */
export function racingDrive(seed: number, tune: DriveTuning, quant = 1, rev = 1): { events: ArcadeInputEvent[]; state: RacingState } {
  const game = racingGameFor(rev);
  const profile = racingSpeedProfile(racingTrack(seed), tune.share, tune.brakeShare);
  let state = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  let last = "";
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    const ctl = racingDriverInput(state, profile, tune);
    const a = Math.round(racingStickFor(rev, ctl.steer) / quant) * quant;
    const b = Math.round(ctl.pedal / quant) * quant;
    const key = `${a},${b}`;
    if (key !== last) {
      last = key;
      recordInput(events, { t, k: RACING_INPUT_STICK, a, b, c: 0, d: 0 }, RACING_INPUT_RANGES);
    }
    state = game.step(state, inputAt(events, t));
  }
  return { events, state };
}

/** The oracle's log for a seed (racingRev 1 unless a revision is given). */
export function oracleRun(seed: number, rev = 1): ArcadeInputEvent[] {
  return racingDrive(seed, ORACLE_TUNING, 1, rev).events;
}

if (import.meta.main) {
  const { roomSeed } = await import("./arcade-skill-bands/games");
  const revArg = process.argv.find((a) => a.startsWith("--rev="));
  const rev = revArg ? Number(revArg.slice(6)) : RACING_REV_DEALT;
  const seeds = process.argv.slice(2).filter((a) => !a.startsWith("--")).map(Number).filter(Number.isFinite);
  const list = seeds.length ? seeds : Array.from({ length: 12 }, (_, n) => roomSeed(n));
  for (const seed of list) {
    const { events, state } = racingDrive(seed, ORACLE_TUNING, 1, rev);
    const race = state.finishTick ? state.finishTick - racingGoTick(rev) : 0;
    console.log(`seed ${seed} rev ${rev}: score ${racingGameFor(rev).score(state)} race ${(race / 60).toFixed(2)} s clean ${state.clean}/8 off ${state.offTicks} walls ${state.wallHits} events ${events.length}`);
  }
}
