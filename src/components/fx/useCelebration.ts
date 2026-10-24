import { useEffect, useRef, useState } from "react";

import {
  COUNT_UP_MS,
  COUNT_UP_SLIDE_MS,
  celebrationScope,
  celebrationSound,
  celebrationsOn,
  clearCelebrations,
  movedUp,
  sparkBurstOn,
} from "@/lib/fx/celebrations";

/**
 * One screen's celebration scope (src/lib/fx/celebrations.ts): every effect sent under it ends
 * when the screen unmounts, so a screen that moves on never leaves a burst, banner or hero behind.
 */
export function useCelebrationScope(): number {
  const scope = useRef(0);
  if (scope.current === 0) scope.current = celebrationScope();
  useEffect(() => {
    const id = scope.current;
    return () => clearCelebrations(id);
  }, []);
  return scope.current;
}

/** Whether celebrations are on, read once per mount (client-rendered screens: rooms, practice, daily). */
export function useCelebrationsOn(): boolean {
  return useState(celebrationsOn)[0];
}

/**
 * The results count-up's skip: true once the player taps anywhere while it runs (`active`, for
 * `windowMs` from mount). The listener never stops the tap, so it still reaches whatever was under it.
 */
export function useTapToSkip(active: boolean, windowMs = COUNT_UP_MS + 100): boolean {
  const [skipped, setSkipped] = useState(false);
  useEffect(() => {
    if (!active || skipped) return;
    const skip = () => setSkipped(true);
    window.addEventListener("pointerdown", skip, { capture: true, passive: true });
    const stop = window.setTimeout(() => window.removeEventListener("pointerdown", skip, { capture: true }), windowMs);
    return () => {
      window.clearTimeout(stop);
      window.removeEventListener("pointerdown", skip, { capture: true });
    };
  }, [active, skipped]); // eslint-disable-line react-hooks/exhaustive-deps
  return skipped;
}

/**
 * Celebrations: once the rows have slid into their new order, every player who climbed gets a
 * small spark burst along their row, and the climb one overtake zap (whoever climbed).
 */
export function useCountUpClimbs(
  on: boolean,
  scope: number,
  rows: { slot: number; position: number; previousPosition: number | null }[],
  nodes: ReadonlyMap<number, HTMLElement>,
): void {
  useEffect(() => {
    if (!on) return;
    const climbers = rows.filter(movedUp).map((row) => row.slot);
    if (!climbers.length) return;
    const timer = window.setTimeout(() => {
      for (const slot of climbers) sparkBurstOn(scope, nodes.get(slot) ?? null, { row: true, count: 16 });
      celebrationSound("overtake");
    }, COUNT_UP_SLIDE_MS + 60);
    return () => window.clearTimeout(timer);
  }, [on]); // eslint-disable-line react-hooks/exhaustive-deps
}
