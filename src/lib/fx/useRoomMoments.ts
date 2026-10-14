import { useEffect, useMemo } from "react";
import { serverNow } from "@/lib/duel/clock";
import { ROOM_CUE_LATE_MS, type MomentSpec } from "./roomMoments";
import { soundCue } from "./soundCues";

/** Shared-clock ms since the moment began, read once per moment (late arrivals resume mid-effect). */
export function useMomentElapsed(startedAt: number): number {
  return useMemo(() => Math.max(0, serverNow() - startedAt), [startedAt]);
}

/**
 * The moment's named sound cues (no audio yet): each fires once at its time on
 * the shared clock, and is skipped when the player arrives more than
 * ROOM_CUE_LATE_MS after it.
 */
export function useRoomMomentCues(spec: MomentSpec, startedAt: number): void {
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const { cue, atMs } of spec.cues) {
      if (serverNow() - startedAt > atMs + ROOM_CUE_LATE_MS) continue;
      const fire = () => {
        const remaining = startedAt + atMs - serverNow();
        if (remaining > 0) timers.push(setTimeout(fire, remaining));
        else if (-remaining <= ROOM_CUE_LATE_MS) soundCue(cue);
      };
      timers.push(setTimeout(fire, Math.max(0, startedAt + atMs - serverNow())));
    }
    return () => timers.forEach(clearTimeout);
  }, [spec, startedAt]);
}
