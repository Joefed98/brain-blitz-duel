/**
 * Shared clock. All round deadlines derive from the server-stamped
 * `phase_started_at`, so every phone needs to agree on "now". We ask the server
 * for its time a few times, keep the sample with the shortest round trip, and
 * store offset = server_time − (client_time − rtt / 2).
 */

import { serverTimeFn } from "./time.functions";

let offsetMs = 0;
let calibrating: Promise<void> | null = null;
let calibrated = false;

export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function clockOffsetMs(): number {
  return offsetMs;
}

async function sample(): Promise<{ offset: number; rtt: number } | null> {
  try {
    const before = Date.now();
    const { now } = await serverTimeFn();
    const after = Date.now();
    if (!Number.isFinite(now)) return null;
    const rtt = after - before;
    return { offset: now - (after - rtt / 2), rtt };
  } catch {
    return null;
  }
}

/** Measures the offset afresh. Called on load and again at room start. */
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
