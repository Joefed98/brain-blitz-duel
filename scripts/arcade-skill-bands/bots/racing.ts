/**
 * Racing: drive the oracle's controller (scripts/racing-oracle.ts) through a Human. The player sees the car late
 * (the tracking lag: every decision reads the car as it was that many ticks ago), moves the thumb only every few
 * ticks, rests the stick a little off where they meant (aim error, in joystick units: the stick's full throw is
 * about 60 phone px), corners at a share of the limit that rises with skill, judges each corner's braking point
 * with an error (a late brake runs wide onto the kerb or the grass), and now and then slips (a corner taken far too
 * fast). The flawless level is the oracle itself.
 *
 * racingRev 2 (31 Oct 2026): the controller's steer is the front wheels' steer; the thumb goes where the dead zone and
 * expo give it (racingStickFor), off by the aim error and held at the level's resolution, and the wheels follow at the
 * smoothing rate. The throttle goes down a reaction time after lights out (the oracle holds it through the lights).
 *
 * racingRev 3 (3 Nov 2026): driven exactly as racingRev 2. The bots do not read the corner speed signs (each level's
 * corner judgement is its share of the limit, as before), so the bands measure the gravel and the pace score alone.
 */
import { inputAt, recordInput, type ArcadeInputEvent } from "../../../src/lib/arcade/engine";
import {
  racingBalanceSpeed,
  racingGoTick,
  racingTrack,
  RACING_BRAKE,
  RACING_INPUT_RANGES,
  RACING_INPUT_STICK,
  RACING_LAP_SEGS,
  RACING_LAPS,
  RACING_SEG,
  type RacingState,
} from "../../../src/lib/arcade/racing";
import { oracleRun, racingDriverInput, racingStickFor, type DriveTuning } from "../../racing-oracle";
import type { SkillBot } from "../bot";
import type { SkillLevel } from "../human";

interface Style {
  /** Corner speed share of the limit, and its spread corner to corner. */
  share: number;
  spread: number;
  brakeShare: number;
  /** Ticks between thumb moves. */
  every: number;
  /** Lateral correction gain. */
  gain: number;
  /** Stick resolution the player holds (units). */
  quant: number;
}

const STYLE: Record<Exclude<SkillLevel, "perfect">, Style> = {
  weak: { share: 0.66, spread: 0.24, brakeShare: 0.6, every: 7, gain: 0.08, quant: 20 },
  average: { share: 0.76, spread: 0.17, brakeShare: 0.7, every: 5, gain: 0.1, quant: 10 },
  good: { share: 0.83, spread: 0.11, brakeShare: 0.78, every: 4, gain: 0.13, quant: 10 },
  great: { share: 0.88, spread: 0.075, brakeShare: 0.84, every: 3, gain: 0.16, quant: 5 },
  near: { share: 0.92, spread: 0.05, brakeShare: 0.88, every: 2, gain: 0.2, quant: 5 },
  elite: { share: 0.94, spread: 0.035, brakeShare: 0.91, every: 2, gain: 0.22, quant: 5 },
};

/** A profile with a per-corner share (each corner's judgement drawn once, a slip taking one far too fast). */
function humanProfile(seed: number, st: Style, human: Parameters<SkillBot>[0]["human"]): Int32Array {
  const track = racingTrack(seed);
  // Both laps (each corner judged afresh on each lap).
  const lapN = RACING_LAP_SEGS;
  const n = lapN * RACING_LAPS;
  const share = new Float64Array(n).fill(st.share);
  for (let lap = 0; lap < RACING_LAPS; lap++)
    for (const c of track.corners) {
      let m = st.share * (1 + st.spread * human.normal());
      if (human.slip(4)) m = Math.max(m, 1.06 + 0.14 * human.u());
      m = Math.min(1.2, Math.max(0.45, m));
      for (let k = -4; k < c.len + 4; k++) share[(lap * lapN + c.start + k + n) % n] = m;
    }
  const lim = new Int32Array(n);
  for (let i = 0; i < n; i++) lim[i] = Math.floor(racingBalanceSpeed(track.curve[i % lapN]!) * share[i]!);
  const dec = 2 * RACING_BRAKE * st.brakeShare * RACING_SEG;
  for (let pass = 0; pass < 2; pass++)
    for (let k = 2 * n - 1; k >= 0; k--) {
      const i = k % n;
      const next = lim[(i + 1) % n]!;
      const v = Math.floor(Math.sqrt(next * next + dec));
      if (v < lim[i]!) lim[i] = v;
    }
  return lim;
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const rev = (game.init(seed) as RacingState).rev;
  if (human.level === "perfect") return { events: oracleRun(seed, rev) };
  const st = STYLE[human.level];
  const profile = humanProfile(seed, st, human);
  const tune: DriveTuning = { share: st.share, brakeShare: st.brakeShare, look: 1, line: 0, gain: st.gain };
  // racingRev 2: nothing moves before lights out; the thumb goes down a reaction after it.
  const go = racingGoTick(rev) > 0 ? racingGoTick(rev) + human.reactTicks() : 0;
  let state = game.init(seed) as RacingState;
  const events: ArcadeInputEvent[] = [];
  const history: { s: number; x: number; v: number }[] = [];
  let lag = human.lagTicks();
  let nextMove = 1 + human.reactTicks();
  let held = { a: 0, b: 0 };
  let sent = "";
  if (go) nextMove = go;
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    history.push({ s: state.s, x: state.x, v: state.v });
    if (t >= nextMove) {
      const seen = history[Math.max(0, history.length - 1 - lag)]!;
      const ctl = racingDriverInput(state, profile, tune, seen);
      // The same thumb error over racingRev 2's longer steering throw (64 world px for full lock, not 46) moves the stick less.
      const aim = human.aim(rev >= 2 ? (100 / 60) * (46 / 64) : 100 / 60);
      const q = st.quant;
      held = {
        a: Math.max(-100, Math.min(100, Math.round((racingStickFor(rev, ctl.steer) + aim) / q) * q)),
        b: Math.max(-100, Math.min(100, Math.round(ctl.pedal / q) * q)),
      };
      nextMove = t + Math.max(1, st.every + human.int(-1, 1));
      lag = human.lagTicks();
    }
    const key = `${held.a},${held.b}`;
    if (key !== sent) {
      sent = key;
      recordInput(events, { t, k: RACING_INPUT_STICK, a: held.a, b: held.b, c: 0, d: 0 }, RACING_INPUT_RANGES);
    }
    state = game.step(state, inputAt(events, t)) as RacingState;
  }
  return { events };
};

/** A random player: the stick thrown somewhere new every half second or so. */
export const randomBot: SkillBot = ({ game, seed, human }) => {
  let state = game.init(seed) as RacingState;
  const events: ArcadeInputEvent[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    if (human.chance(1 / 30)) recordInput(events, { t, k: RACING_INPUT_STICK, a: human.int(-100, 100), b: human.int(-100, 100), c: 0, d: 0 }, RACING_INPUT_RANGES);
    state = game.step(state, inputAt(events, t)) as RacingState;
  }
  return { events };
};
