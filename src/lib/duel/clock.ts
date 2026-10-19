/**
 * Shared clock. All round deadlines derive from the server-stamped
 * `phase_started_at`, so every phone needs to agree on "now". We ask the server
 * for its time a few times, keep the sample with the shortest round trip, and
 * store offset = server_time − (client_time − rtt / 2).
 */

import { serverTimeFn } from "./time.functions";

/**
 * Re-measured at every round (19 Oct 2026, #115's audit item 7): a device clock that moved after the
 * last measurement (an automatic time update, a phone asleep in a pocket) left `serverNow` reading
 * ahead, and a phone more than 1.5 s ahead had the last taps of Flash, Bang On, Ascend and
 * Lightbender dropped by the room's receipt check (grade.ts latestTapMs). The room page re-measures
 * at each new round and whenever the app comes back to the foreground; clock-round-check proves it.
 */
let deviceNow: () => number = () => Date.now();
let fetchServerTime: () => Promise<{ now: number }> = () => serverTimeFn();

/** Checks only: stand-ins for the device clock and the server's time. */
export function setClockSourcesForCheck(sources: {
  deviceNow?: () => number;
  serverTime?: () => Promise<{ now: number }>;
}): void {
  if (sources.deviceNow) deviceNow = sources.deviceNow;
  if (sources.serverTime) fetchServerTime = sources.serverTime;
}

let offsetMs = 0;
let calibrating: Promise<void> | null = null;
let calibrated = false;

export function serverNow(): number {
  return deviceNow() + offsetMs;
}

export function clockOffsetMs(): number {
  return offsetMs;
}

async function sample(): Promise<{ offset: number; rtt: number } | null> {
  try {
    const before = deviceNow();
    const { now } = await fetchServerTime();
    const after = deviceNow();
    if (!Number.isFinite(now)) return null;
    const rtt = after - before;
    return { offset: now - (after - rtt / 2), rtt };
  } catch {
    return null;
  }
}

/** Measures the offset afresh. Called on load, at room start, at every round and on returning to the app. */
export async function calibrateServerClock(): Promise<void> {
  if (typeof window === "undefined") return;
  if (calibrating) return calibrating;
  calibrating = (async () => {
    let best: { offset: number; rtt: number } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const taken = await sample();
      if (taken && (!best || taken.rtt < best.rtt)) best = taken;
    }
    if (best) {
      offsetMs = Math.round(best.offset);
      calibrated = true;
    }
  })();
  try {
    await calibrating;
  } finally {
    calibrating = null;
  }
}

/** Calibrates once per page load. */
export async function initServerClock(): Promise<void> {
  if (calibrated) return;
  await calibrateServerClock();
}

export function toMs(timestamp: string | null | undefined): number | null {
  if (!timestamp) return null;
  const value = new Date(timestamp).getTime();
  return Number.isFinite(value) ? value : null;
}
