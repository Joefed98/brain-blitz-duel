/**
 * Tempo: a player reading falling notes and tapping them on the line.
 *
 * Every note is an anticipated moment (it falls for 1.5 s in view), so each
 * touch lands with the human's timing error plus a personal early/late bias
 * for the run. The phone sends what a finger does: a touch is a TAP, lifting is
 * a RELEASE (after a short press, or at the hold's tail with its own timing
 * error), and a swipe note is a touch followed a couple of ticks later by the
 * sideways flick. Busy passages (many notes in a short window, chords, a hold
 * already under one finger) widen the timing error and bring lapses (a note
 * simply not played), more so for weaker players. Slips put the finger in the
 * neighbouring lane, flick the wrong way, or tap an arrow note instead of
 * swiping it. The bot never looks at the score; it only plays the chart.
 */
import { BEAT_INPUT_RELEASE, BEAT_INPUT_SWIPE, BEAT_INPUT_TAP, BEAT_LANES, type BeatState } from "../../../src/lib/arcade/beat";
import { msToTicks } from "../human";
import { driveEvents, Plan, type SkillBot } from "../bot";

/**
 * Notes a second this player reads and plays comfortably (a perception/motor
 * constant). Above about 70 % of it the passage starts to overload them.
 */
const CAPACITY: Record<string, number> = { average: 4.5, good: 5.5, great: 6.5, near: 8 };

export const bot: SkillBot = ({ game, seed, human }) => {
  const init = game.init(seed) as BeatState;
  const chart = init.chart;
  const p = human.p;
  const cap = CAPACITY[human.level]!;
  // A personal early/late tendency for the run (latency feel), ms.
  const bias = p.timingSdMs * 0.4 * human.normal();
  const n = chart.ticks.length;
  // Local note rate (notes a second) in a one-second window centred on each note,
  // counting a held tail as extra load while it lasts.
  const rate = chart.ticks.map((t) => {
    let count = 0;
    for (let j = 0; j < n; j++) {
      const tj = chart.ticks[j]!;
      if (Math.abs(tj - t) <= 30) count++;
      else if ((chart.holds[j] ?? 0) > 0 && tj < t && tj + chart.holds[j]! >= t) count += 0.5;
    }
    return count;
  });
  type Want = { t: number; k: number; a: number; b: number; order: number; after?: Want; actual?: number };
  const wants: Want[] = [];
  let order = 0;
  for (let i = 0; i < n; i++) {
    const t = chart.ticks[i]!;
    const lane = chart.lanes[i]!;
    const swipe = chart.swipes?.[i] ?? 0;
    const hold = chart.holds[i] ?? 0;
    const chord = chart.ticks[i - 1] === t || chart.ticks[i + 1] === t;
    const load = rate[i]! / cap;
    const over = Math.max(0, load - 0.7);
    // Lapse: the note is simply not played (looked at the wrong lane, lost the count).
    const lapse = p.lapse * 0.3 + over * 0.6 + (chord ? p.mistake * 0.4 : 0);
    if (human.chance(lapse)) continue;
    const scale = 1 + 0.4 * load + (chord ? 0.3 : 0);
    const err = msToTicks(bias + human.timingMs(scale));
    let playLane = lane;
    if (human.slip(0.3)) {
      const d = human.chance(0.5) ? 1 : -1;
      playLane = lane + d >= 0 && lane + d < BEAT_LANES ? lane + d : lane - d;
    }
    if (swipe) {
      // Reading the arrow: now and then tapped instead of swiped, or flicked the wrong way.
      if (human.slip(0.5)) {
        const at = t + err;
        const tap: Want = { t: at, k: BEAT_INPUT_TAP, a: playLane, b: 0, order: order++ };
        wants.push(tap, { t: at + human.int(5, 9), k: BEAT_INPUT_RELEASE, a: playLane, b: 0, order: order++, after: tap });
        continue;
      }
      let right = swipe > 0 ? 1 : 0;
      if (human.slip(0.6)) right = 1 - right;
      // The finger goes down a couple of ticks before the flick crosses 24 px, timed to the line.
      const flick = t + err;
      const down = flick - human.int(2, 4);
      const tap: Want = { t: down, k: BEAT_INPUT_TAP, a: playLane, b: 0, order: order++ };
      const sw: Want = { t: flick, k: BEAT_INPUT_SWIPE, a: playLane, b: right, order: order++, after: tap };
      wants.push(tap, sw, { t: flick + human.int(2, 5), k: BEAT_INPUT_RELEASE, a: playLane, b: 0, order: order++, after: sw });
      continue;
    }
    const at = t + err;
    const tap: Want = { t: at, k: BEAT_INPUT_TAP, a: playLane, b: 0, order: order++ };
    wants.push(tap);
    if (hold > 0 && playLane === lane) {
      // Lift at the tail: another anticipated moment, a little looser than a touch.
      const lift = t + hold + msToTicks(bias * 0.5 + human.timingMs(1.2 * scale));
      // Occasionally the finger comes off early (lost track of the hold).
      const early = human.chance(p.lapse * 0.5 + over * 0.3) ? human.int(10, Math.max(11, hold - 5)) : 0;
      wants.push({ t: Math.max(at + 2, lift - early), k: BEAT_INPUT_RELEASE, a: playLane, b: 0, order: order++, after: tap });
    } else {
      wants.push({ t: at + human.int(5, 9), k: BEAT_INPUT_RELEASE, a: playLane, b: 0, order: order++, after: tap });
    }
  }
  // One event a tick, as the phone's queue applies them: clashes slide to the next free tick.
  wants.sort((x, y) => x.t - y.t || x.order - y.order);
  const plan = new Plan();
  // A lift or flick never comes before its own touch (a touch slid late drags them with it).
  for (const w of wants) w.actual = plan.at(Math.max(w.t, (w.after?.actual ?? 0) + 1), { k: w.k, a: w.a, b: w.b, c: 0, d: 0 });
  return driveEvents(game, (_s: BeatState, t) => plan.take(t), init);
};
