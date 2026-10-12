/**
 * Scripted honest players for Flash (reaction), Bang On (stopwatch) and Ascend
 * (numhunt). Each one plays as a person would: human reaction times, the odd
 * miss, false starts on decoys and dark screens, wrong taps, slow runs that
 * never finish. Every choice comes from a seed, so a run can be played again
 * against any build of the Stage and land on the same physical taps.
 */
import { seededRng } from "./tap-log-driver";
import { markerState, targetCentre } from "../src/puzzles/stopWatch";
import type { NumberHuntPuzzleData, ReactionPuzzleData, StopWatchSpec } from "../src/lib/duel/types";

export const FLASH_SELECTOR = '[aria-label="Reaction area"]';
export const WATCH_SELECTOR = '[aria-label="Stop the marker"]';
export const circleSelector = (n: number) => `[aria-label="Circle ${n}"]`;

/** Every honest tap on the round clock (ms), sorted. */
export function planFlash(puzzle: ReactionPuzzleData, seed: number): number[] {
  const rng = seededRng(seed);
  const taps: number[] = [];
  let segmentStart = 0;
  for (const flash of puzzle.flashes) {
    // A dark-screen false start now and then, well before anything shows.
    if (rng() < 0.08) taps.push(segmentStart + 300 + Math.floor(rng() * 400));
    for (const decoy of puzzle.decoys.filter((d) => d.at >= segmentStart && d.at < flash)) {
      if (rng() < 0.18) taps.push(decoy.at + 150 + Math.floor(rng() * 250));
    }
    const roll = rng();
    if (roll < 0.08) {
      // Missed: no tap at all.
    } else {
      const reaction =
        roll < 0.16 ? 700 + Math.floor(rng() * 700) : 160 + Math.floor(rng() * 420);
      taps.push(flash + reaction);
      // An excited double tap.
      if (rng() < 0.06) taps.push(flash + reaction + 110 + Math.floor(rng() * 150));
    }
    segmentStart = flash + 1_500;
  }
  return [...new Set(taps)].sort((a, b) => a - b);
}

/** The ms a watch stays live: the first elapsed at which its passes run out. */
export function watchLife(spec: StopWatchSpec): number {
  let e = 0;
  while (markerState(spec, e).pass < spec.passes) e += 1;
  return e;
}

/** One watch: when to stop it (ms after it starts, or null to miss) and a stray gap tap. */
export function planWatch(spec: StopWatchSpec, index: number, seed: number): { e: number | null; gap: number | null } {
  const rng = seededRng(seed * 31 + index * 7_919 + 1);
  const life = watchLife(spec);
  const gap = rng() < 0.2 ? 100 + Math.floor(rng() * 380) : null;
  if (rng() < 0.07) return { e: null, gap };
  // Centre-line crossings in the order they happen.
  const crossings: number[] = [];
  let previous = 0;
  for (let e = 0; e < life; e += 1) {
    const state = markerState(spec, e);
    const offset = (state.pos - targetCentre(spec, e)) * state.dir;
    if (e > 0 && Math.sign(offset) !== Math.sign(previous) && offset !== 0) crossings.push(e);
    previous = offset;
  }
  const roll = rng();
  const pick = roll < 0.55 ? 0 : roll < 0.85 ? 1 : 2;
  const aim = crossings[Math.min(pick, crossings.length - 1)] ?? Math.floor(life / 2);
  // Roughly normal human error, 10–60 ms spread.
  const spread = 10 + rng() * 50;
  const noise = ((rng() + rng() + rng() - 1.5) / 0.5) * spread;
  return { e: Math.max(0, Math.min(life - 1, Math.round(aim + noise))), gap };
}

/** Bang On's lead-in: sometimes a nervous tap before the first watch. */
export function planWatchLeadIn(seed: number): number | null {
  const rng = seededRng(seed * 13 + 5);
  return rng() < 0.3 ? 100 + Math.floor(rng() * 600) : null;
}

/**
 * Ascend: a stream of taps by number. `slow` runs take too long to finish.
 * Wrong taps hit a later number; a stray tap on a finished disc is ignored.
 */
export function planAscend(puzzle: NumberHuntPuzzleData, seed: number, slow: boolean): { n: number; t: number }[] {
  const rng = seededRng(seed);
  const values = puzzle.spots.map((s) => s.n);
  const taps: { n: number; t: number }[] = [];
  let t = 300 + Math.floor(rng() * 500);
  for (let next = 0; next < values.length; next++) {
    if (rng() < 0.12 && next + 1 < values.length) {
      const wrong = Math.min(values.length - 1, next + 1 + Math.floor(rng() * 3));
      taps.push({ n: values[wrong]!, t });
      t += 250 + Math.floor(rng() * 500);
    }
    if (rng() < 0.05 && next > 0) {
      taps.push({ n: values[next - 1]!, t });
      t += 200 + Math.floor(rng() * 300);
    }
    taps.push({ n: values[next]!, t });
    t += slow ? 2_100 + Math.floor(rng() * 1_400) : 650 + Math.floor(rng() * 1_500);
  }
  return taps;
}
