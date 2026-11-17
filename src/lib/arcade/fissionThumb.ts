/**
 * Fission's one-thumb controls (the Retro overhaul, stage 3, 16 Nov 2026; input mapping only, no stamp): off by default
 * (the two arrow buttons and a tap anywhere to fire). On, the arrow row goes and the arena plays with one thumb: touching
 * it fires and slides the cannon towards the thumb's x, dragging keeps it following, lifting stops it where it is. Every
 * touch sends exactly the events the arrows and the fire tap send (BURST_INPUT_MOVE with a target x, BURST_INPUT_FIRE),
 * so the input log, the replay and the score are the same kind of thing either way. Kept on this device.
 */
import { useSyncExternalStore } from "react";

export const FISSION_THUMB_KEY = "duelz-fission-thumb:v1";

let cached: boolean | null = null;
const listeners = new Set<() => void>();

export function fissionThumbOn(): boolean {
  if (cached !== null) return cached;
  try {
    cached = typeof window !== "undefined" && window.localStorage.getItem(FISSION_THUMB_KEY) === "1";
  } catch {
    cached = false;
  }
  return cached;
}

export function setFissionThumb(on: boolean): void {
  cached = on;
  try {
    window.localStorage.setItem(FISSION_THUMB_KEY, on ? "1" : "0");
  } catch {
    /* device storage unavailable: kept for this visit */
  }
  for (const l of listeners) l();
}

export function useFissionThumb(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    fissionThumbOn,
    () => false,
  );
}
