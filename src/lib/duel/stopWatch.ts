/**
 * Bang On (stopwatch) marker rules, shared by the phone and the server. The
 * phone draws the marker from these; the server works out where the marker and
 * the target were at each tap from the same functions.
 */
import { STOPWATCH_MISS_MS, type StopWatchSpec } from "./types";

/** Marker position, completed right-edge count, direction and current traversal duration. */
export function markerState(
  spec: StopWatchSpec,
  elapsed: number,
): { pos: number; pass: number; dir: 1 | -1; sweepMs: number } {
  const durations = spec.passSweepMs ?? Array.from({ length: spec.passes }, () => spec.sweepMs);
  let remaining = Math.max(0, elapsed);
  let pass = 0;
  if (spec.wrap) {
    while (pass < spec.passes && remaining >= (durations[pass] ?? spec.sweepMs)) {
      remaining -= durations[pass] ?? spec.sweepMs;
      pass += 1;
    }
    const sweepMs = durations[Math.min(pass, spec.passes - 1)] ?? spec.sweepMs;
    const frac = pass >= spec.passes ? 1 : Math.min(1, remaining / sweepMs);
    return { pos: frac, pass, dir: 1, sweepMs };
  }
  while (pass < spec.passes) {
    const sweepMs = durations[pass] ?? spec.sweepMs;
    if (remaining < sweepMs) return { pos: remaining / sweepMs, pass, dir: 1, sweepMs };
    remaining -= sweepMs;
    pass += 1;
    if (pass >= spec.passes) return { pos: 1, pass, dir: 1, sweepMs };
    if (remaining < sweepMs) return { pos: 1 - remaining / sweepMs, pass, dir: -1, sweepMs };
    remaining -= sweepMs;
  }
  return { pos: 1, pass, dir: 1, sweepMs: durations.at(-1) ?? spec.sweepMs };
}

export function targetCentre(spec: StopWatchSpec, elapsed: number): number {
  if (!spec.moving) return spec.centre;
  const angle = 2 * Math.PI * (elapsed / spec.moving.cycleMs + spec.moving.phase);
  return spec.centre + Math.sin(angle) * spec.moving.amplitude;
}

/**
 * How long a watch stays live: the first elapsed ms at which its passes have
 * run out (markerState(...).pass reaches `passes`). Bouncing watches sweep out
 * and back on every pass but the last; wrapping watches sweep out only.
 */
export function watchLifeMs(spec: StopWatchSpec): number {
  const durations = spec.passSweepMs ?? Array.from({ length: spec.passes }, () => spec.sweepMs);
  let total = 0;
  for (let pass = 0; pass < spec.passes; pass++) {
    const sweep = durations[pass] ?? spec.sweepMs;
    total += spec.wrap || pass === spec.passes - 1 ? sweep : 2 * sweep;
  }
  return total;
}

/** How far a stop at `elapsed` ms into the watch lands from the target line, in ms of marker travel. */
export function watchStop(
  spec: StopWatchSpec,
  elapsed: number,
): { distance: number; signed: number } {
  const { pos, dir, sweepMs } = markerState(spec, elapsed);
  const centre = targetCentre(spec, elapsed);
  const offset = (pos - centre) * dir * sweepMs;
  return {
    distance: Math.min(STOPWATCH_MISS_MS, Math.round(Math.abs(offset))),
    signed: Math.round(offset),
  };
}
