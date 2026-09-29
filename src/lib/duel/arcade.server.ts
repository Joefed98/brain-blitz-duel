/**
 * Server-only seeds for the arcade rounds. One seed per round drives the whole
 * course, so everyone in the room plays the identical run; practice draws a
 * fresh seed each time it starts a round.
 */

import { randomBelow } from "./random";
import { bullseyeWinds } from "@/lib/arcade/bullseye";
import type {
  BinTossPuzzleData,
  BullseyePuzzleData,
  MatchupPuzzleData,
  CrossPuzzleData,
  DualPuzzleData,
  RicoPuzzleData,
  SkylinePuzzleData,
  SnakePuzzleData,
  SwervePuzzleData,
  BreakerPuzzleData,
  RallyPuzzleData,
  SteadyPuzzleData,
  SlicePuzzleData,
  BubblePuzzleData,
  BeatPuzzleData,
  WhackPuzzleData,
  WavefrontPuzzleData,
  BastionPuzzleData,
  RooftopPuzzleData,
  SortRushPuzzleData,
  FlipPuzzleData,
  ParryPuzzleData,
  JunctionPuzzleData,
  InkBridgePuzzleData,
  BurstPuzzleData,
  OrbitPuzzleData,
  SwingPuzzleData,
  TiltPuzzleData,
  HotFloorPuzzleData,
} from "./types";

/** A fresh 32-bit seed from the platform CSPRNG. */
export function arcadeSeed(): number {
  return randomBelow(0x7fff_ffff) + 1;
}

export function generateSwerve(): SwervePuzzleData {
  return { type: "swerve", seed: arcadeSeed() };
}

export function generateSkyline(): SkylinePuzzleData {
  return { type: "skyline", seed: arcadeSeed() };
}

export function generateBinToss(): BinTossPuzzleData {
  return { type: "bintoss", seed: arcadeSeed() };
}

export function generateBullseye(): BullseyePuzzleData {
  const seed = arcadeSeed();
  return { type: "bullseye", seed, winds: bullseyeWinds(seed) };
}

export function generateMatchup(): MatchupPuzzleData {
  return { type: "matchup", seed: arcadeSeed() };
}

export function generateSnake(): SnakePuzzleData {
  return { type: "snake", seed: arcadeSeed() };
}

export function generateCross(): CrossPuzzleData {
  return { type: "cross", seed: arcadeSeed() };
}

export function generateDual(): DualPuzzleData {
  return { type: "dual", seed: arcadeSeed() };
}

export function generateRicochet(): RicoPuzzleData {
  return { type: "ricochet", seed: arcadeSeed() };
}

export function generateBreaker(): BreakerPuzzleData {
  return { type: "breaker", seed: arcadeSeed() };
}

export function generateRally(): RallyPuzzleData {
  return { type: "rally", seed: arcadeSeed() };
}

export function generateSteady(): SteadyPuzzleData {
  return { type: "steady", seed: arcadeSeed() };
}

export function generateSlice(): SlicePuzzleData {
  return { type: "slice", seed: arcadeSeed() };
}

export function generateBubble(): BubblePuzzleData {
  return { type: "bubble", seed: arcadeSeed() };
}

export function generateBeat(): BeatPuzzleData {
  return { type: "beat", seed: arcadeSeed() };
}

export function generateWhack(): WhackPuzzleData {
  return { type: "whack", seed: arcadeSeed() };
}

export function generateWavefront(): WavefrontPuzzleData {
  return { type: "wavefront", seed: arcadeSeed() };
}

export function generateBastion(): BastionPuzzleData {
  return { type: "bastion", seed: arcadeSeed() };
}

export function generateRooftop(): RooftopPuzzleData {
  return { type: "rooftop", seed: arcadeSeed() };
}

export function generateSortRush(): SortRushPuzzleData {
  return { type: "sortrush", seed: arcadeSeed() };
}

export function generateFlip(): FlipPuzzleData {
  return { type: "flip", seed: arcadeSeed() };
}

export function generateParry(): ParryPuzzleData {
  return { type: "parry", seed: arcadeSeed() };
}

export function generateJunction(): JunctionPuzzleData {
  return { type: "junction", seed: arcadeSeed() };
}

export function generateInkBridge(): InkBridgePuzzleData {
  return { type: "inkbridge", seed: arcadeSeed() };
}

export function generateBurst(): BurstPuzzleData {
  return { type: "burst", seed: arcadeSeed() };
}

export function generateOrbit(): OrbitPuzzleData {
  return { type: "orbit", seed: arcadeSeed() };
}

export function generateSwing(): SwingPuzzleData {
  return { type: "swing", seed: arcadeSeed() };
}

export function generateTilt(): TiltPuzzleData {
  return { type: "tilt", seed: arcadeSeed() };
}

export function generateHotFloor(): HotFloorPuzzleData {
  return { type: "hotfloor", seed: arcadeSeed() };
}
