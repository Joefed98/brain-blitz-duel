import { INK_REV3 } from "@/lib/arcade/inkBridge";
import { SNIP_REV } from "@/lib/arcade/snip";
import { BINTOSS_REV } from "@/lib/arcade/binToss";
import { SWING_REV } from "@/lib/arcade/swing";
import { proveSwingSeed } from "./swingProof.server";
import { SWING_V3_BANK } from "./swingBank.server";
import { CLAY_REV } from "@/lib/arcade/clayShoot";
import { CLASH_QUEUE, CLASH_REV } from "@/lib/arcade/colourClash";
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
  TenDropPuzzleData,
  ClayShootPuzzleData,
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
  SnipPuzzleData,
  TiltPuzzleData,
  HotFloorPuzzleData,
  StroopPuzzleData,
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
  return { type: "bintoss", seed: arcadeSeed(), binRev: BINTOSS_REV };
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

export function generateTenDrop(): TenDropPuzzleData {
  return { type: "tendrop", seed: arcadeSeed() };
}

export function generateClayShoot(): ClayShootPuzzleData {
  return { type: "clayshoot", seed: arcadeSeed(), clayRev: CLAY_REV };
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

export function generateColourClash(): StroopPuzzleData {
  return { type: "stroop", seed: arcadeSeed(), queue: CLASH_QUEUE, clashRev: CLASH_REV };
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
  return { type: "inkbridge", seed: arcadeSeed(), inkRev: INK_REV3 };
}

export function generateBurst(): BurstPuzzleData {
  return { type: "burst", seed: arcadeSeed() };
}

export function generateOrbit(): OrbitPuzzleData {
  return { type: "orbit", seed: arcadeSeed() };
}

export function generateSnip(): SnipPuzzleData {
  return { type: "snip", seed: arcadeSeed(), snipRev: SNIP_REV };
}

/** Room/practice generation picks a proved course from the bank by the room seed; on-the-spot proving is only a fallback if the bank is empty or unlucky. */
export function generateSwing(): SwingPuzzleData {
  const roomSeed = arcadeSeed();
  if (SWING_V3_BANK.length > 0) {
    const index = ((roomSeed % SWING_V3_BANK.length) + SWING_V3_BANK.length) % SWING_V3_BANK.length;
    return { type: "swing", seed: SWING_V3_BANK[index]!.seed, swingRev: SWING_REV };
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const seed = attempt === 0 ? roomSeed : arcadeSeed();
    if (proveSwingSeed(seed)) return { type: "swing", seed, swingRev: SWING_REV };
  }
  throw new Error("Could not verify a safe Grappler course; try again.");
}

export function generateTilt(): TiltPuzzleData {
  return { type: "tilt", seed: arcadeSeed() };
}

export function generateHotFloor(): HotFloorPuzzleData {
  return { type: "hotfloor", seed: arcadeSeed() };
}
