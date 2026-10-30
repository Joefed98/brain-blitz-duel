/**
 * Free Kick's sound observer (display side only): it reads the sim state after each frame and plays manifest cues on
 * transitions (`freekick.<event>`); each falls back to an existing shared sound until its own recording is set. It
 * never feeds anything back to the sim.
 *
 *   freekick.kick    the strike (aim → flight)
 *   freekick.post    the ball hits a post or the crossbar
 *   freekick.save    the keeper saves it (also the wall's block, a little quieter)
 *   freekick.goal    a goal
 *   freekick.target  a target scored through
 *   freekick.net     the ball reaches the back of the net
 */
import { playSlotOr } from "@/lib/sound";
import type { SoundId } from "@/lib/fx/manifest";
import { FK_FLIGHT, FK_NET_Z, FK_OUT_GOAL, FK_OUT_SAVED, FK_OUT_WALL, type FreekickState } from "@/lib/arcade/freekick";
import type { GameSounds } from "@/lib/fx/gameSounds";

const cue = (id: string) => id as SoundId;

export function freekickSounds(): GameSounds<FreekickState> {
  let prev: FreekickState | null = null;
  return {
    frame(state) {
      if (prev && state.tick > prev.tick) {
        const f = state.fl;
        const was = prev.fl;
        if (prev.phase !== FK_FLIGHT && state.phase === FK_FLIGHT) playSlotOr(cue("freekick.kick"), cue("arc_fair_thud"), 0.9, 1.1);
        if (f && was && state.kickTick === prev.kickTick) {
          if ((f.post && !was.post) || (f.bar && !was.bar)) playSlotOr(cue("freekick.post"), cue("arc_clank"), 0.9);
          if (f.out === FK_OUT_SAVED && was.out !== FK_OUT_SAVED) playSlotOr(cue("freekick.save"), cue("arc_wood_knock"), 0.9);
          if (f.out === FK_OUT_WALL && was.out !== FK_OUT_WALL) playSlotOr(cue("freekick.save"), cue("arc_wood_knock"), 0.65, 0.85);
          if (f.out === FK_OUT_GOAL && was.out !== FK_OUT_GOAL) playSlotOr(cue("freekick.goal"), cue("arc_fair_sting"), 0.95);
          if (f.out === FK_OUT_GOAL && f.z >= FK_NET_Z && was.z < FK_NET_Z) playSlotOr(cue("freekick.net"), cue("arc_bounce"), 0.6, 0.8);
        }
        if (state.targets > prev.targets) playSlotOr(cue("freekick.target"), cue("arc_fair_bell"), 0.9);
      }
      prev = state;
    },
    stop() {
      prev = null;
    },
  };
}
