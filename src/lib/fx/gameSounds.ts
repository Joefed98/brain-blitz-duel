/**
 * Per-game sound observers. They read sim state after each frame and play
 * manifest sounds on transitions; they never feed anything back to the sim.
 */
import { ensureLoop, playSound, stopLoop } from "@/lib/sound";
import type { OrbitState } from "@/lib/arcade/orbit";
import type { SwingState } from "@/lib/arcade/swing";
import type { WavState } from "@/lib/arcade/wavefront";
import type { CrossState } from "@/lib/arcade/cross";
import type { FlipState } from "@/lib/arcade/flip";

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

export function wavefrontSounds(): GameSounds<WavState> {
  let prev: WavState | null = null;
  return {
    frame(state) {
      if (prev && state.tick > prev.tick) {
        if (state.fireIn > prev.fireIn) playSound("arc_laser", 0.6, 1, true);
        // Shapes and the armour block destroyed this frame (bursts carry the kill tick).
        if (state.bursts.some((b) => b.t > prev!.tick && b.c !== 3)) playSound("arc_crash", 0.7);
        if (state.lives < prev.lives) playSound("arc_lose_life");
      }
      prev = state;
    },
    stop: () => {},
  };
}

export function crossSounds(): GameSounds<CrossState> {
  let prev: CrossState | null = null;
  return {
    frame(state) {
      if (prev && state.tick > prev.tick) {
        if (state.lives < prev.lives) playSound("arc_lose_life");
        else if (state.crossings > prev.crossings) playSound("stage_complete");
        else if (state.col !== prev.col || (state.hop > 0 && (prev.hop === 0 || state.hop > prev.hop))) playSound("arc_swoosh", 0.6);
      }
      prev = state;
    },
    stop: () => {},
  };
}

export function flipSounds(): GameSounds<FlipState> {
  let prev: FlipState | null = null;
  return {
    frame(state) {
      if (prev && state.tick > prev.tick) {
        if (state.ended === 2 && prev.ended !== 2) playSound("arc_crash");
        else if (state.flipT > prev.flipT) playSound("arc_swoosh", 0.7);
      }
      prev = state;
    },
    stop: () => {},
  };
}
