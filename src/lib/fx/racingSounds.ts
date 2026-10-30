/**
 * Racing's sound observer (display side only): it reads the sim state after each frame and plays manifest cues on
 * transitions (`racing.<event>`); each falls back to an existing shared sound until its own recording is set. It
 * never feeds anything back to the sim.
 *
 * Cues: racing.go (the first throttle), racing.sector (a clean sector), racing.lap (lap 1 done), racing.wall (a
 * tyre-wall impact), racing.grass (a wheel onto the grass or gravel), racing.finish (the flag after lap 2).
 */
import { playSlotOr } from "@/lib/sound";
import type { SoundId } from "@/lib/fx/manifest";
import { RACING_LAP, type RacingState } from "@/lib/arcade/racing";
import type { GameSounds } from "@/lib/fx/gameSounds";

const cue = (id: string) => id as SoundId;

export function racingSounds(): GameSounds<RacingState> {
  let prev: RacingState | null = null;
  let went = false;
  return {
    frame(state) {
      if (prev && state.tick > prev.tick) {
        if (!went && state.pedal > 0) {
          went = true;
          playSlotOr(cue("racing.go"), "arc_horn", 0.5);
        }
        if (state.wallHits > prev.wallHits) playSlotOr(cue("racing.wall"), "arc_crash", 0.8);
        else if (state.off && !prev.off) playSlotOr(cue("racing.grass"), "arc_bounce", 0.6, 0.8);
        if (state.clean > prev.clean) playSlotOr(cue("racing.sector"), "arc_retro_coin", 0.6);
        if (state.finishTick > 0 && prev.finishTick === 0) playSlotOr(cue("racing.finish"), "arc_fair_sting", 0.9);
        else if (Math.floor(state.s / RACING_LAP) > Math.floor(prev.s / RACING_LAP)) playSlotOr(cue("racing.lap"), "arc_fair_bell", 0.8);
      }
      prev = state;
    },
    stop() {
      prev = null;
      went = false;
    },
  };
}
