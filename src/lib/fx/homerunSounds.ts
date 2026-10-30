/**
 * Home Run Derby's sound observer (display side only): it reads the sim state after each frame and plays manifest
 * cues on transitions (`homerun.<event>`, docs/sound-cues/arcade.md); each falls back to an existing shared sound
 * until its own recording is set. It never feeds anything back to the sim.
 */
import { playSlotOr } from "@/lib/sound";
import { OUT_FAIR, OUT_FOUL, OUT_HOMER, OUT_TAKEN, OUT_WHIFF, type HomerunState } from "@/lib/arcade/homerun";
import type { GameSounds } from "@/lib/fx/gameSounds";

export function homerunSounds(): GameSounds<HomerunState> {
  let prev: HomerunState | null = null;
  return {
    frame(state) {
      if (prev && state.tick > prev.tick) {
        if (state.swingTick >= 0 && prev.swingTick < 0) playSlotOr("homerun.swing", "arc_hover_tap", 0.5, 1.4);
        if (state.hits.length > prev.hits.length) {
          const hit = state.hits[state.hits.length - 1]!;
          if (hit.out === OUT_HOMER || hit.out === OUT_FAIR) playSlotOr("homerun.crack", "arc_wood_knock", 1, hit.q >= 900 ? 1.15 : 1);
          if (hit.out === OUT_HOMER) playSlotOr("homerun.homer", "arc_fair_sting", 0.9);
          if (hit.sign >= 0) playSlotOr("homerun.sign", "arc_fair_bell", 0.9);
          if (hit.out === OUT_FOUL) playSlotOr("homerun.foul", "arc_bounce", 0.7);
          if (hit.out === OUT_WHIFF || hit.out === OUT_TAKEN) playSlotOr("homerun.strike", "arc_fair_thud", 0.6);
        }
      }
      prev = state;
    },
    stop() {
      prev = null;
    },
  };
}
