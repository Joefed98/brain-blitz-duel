/**
 * Per-game sound observers. They read sim state after each frame and play
 * manifest sounds on transitions; they never feed anything back to the sim.
 */
import { ensureLoop, playSound, stopLoop } from "@/lib/sound";
import type { OrbitState } from "@/lib/arcade/orbit";
import type { SwingState } from "@/lib/arcade/swing";

export interface GameSounds<S> {
  frame: (state: S, running: boolean) => void;
  stop: () => void;
}

const AMBIENCE_VOLUME = 0.22;
const HISS_VOLUME = 0.18;

export function orbitSounds(): GameSounds<OrbitState> {
  let prev: OrbitState | null = null;
  return {
    frame(state, running) {
      if (running) ensureLoop("arc_space_ambience", AMBIENCE_VOLUME);
      else stopLoop("arc_space_ambience");
      if (prev && state.tick > prev.tick) {
        if (state.releaseTick !== prev.releaseTick && state.flying > 0) playSound("arc_thruster");
        if (prev.checkpoint < 0 && state.checkpoint >= 0) playSound("arc_pickup");
        if (state.respawnTick !== prev.respawnTick || (state.ended === 2 && prev.ended !== 2)) playSound("arc_crash");
      }
      prev = state;
    },
    stop: () => stopLoop("arc_space_ambience"),
  };
}

export function swingSounds(): GameSounds<SwingState> {
  let prev: SwingState | null = null;
  return {
    frame(state, running) {
      if (running) ensureLoop("arc_lava_hiss", HISS_VOLUME);
      else stopLoop("arc_lava_hiss");
      if (prev && state.tick > prev.tick) {
        if (state.ended === 2 && prev.ended !== 2) playSound("arc_crash");
        else if (prev.rope >= 0 && state.rope < 0) playSound("arc_swoosh");
      }
      prev = state;
    },
    stop: () => stopLoop("arc_lava_hiss"),
  };
}

/** Gem chime for cascade step n: up one semitone per step. */
export function playGemChime(step: number): void {
  playSound("arc_gem_chime", 1, Math.pow(2, Math.min(step, 12) / 12));
}
