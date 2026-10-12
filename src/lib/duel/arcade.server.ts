import { SLICE_REV } from "@/lib/arcade/slice";
import { FLIP_REV } from "@/lib/arcade/flip";
import { CROSS_REV } from "@/lib/arcade/cross";
import { INK_REV3 } from "@/lib/arcade/inkBridge";
import { SNAKE_REV } from "@/lib/arcade/snake";
import { BUB_REV } from "@/lib/arcade/bubble";
import { MATCHUP_REV } from "@/lib/arcade/matchup";
import { SNIP_REV } from "@/lib/arcade/snip";
import { SKYLINE_REV } from "@/lib/arcade/skyline";
import { TILT_REV } from "@/lib/arcade/tilt";
import { JUNC_REV } from "@/lib/arcade/junction";
import { BINTOSS_REV } from "@/lib/arcade/binToss";
import { SWING_REV } from "@/lib/arcade/swing";
import { ORBIT_REV3 } from "@/lib/arcade/orbit";
import { orbitRev3PlanetsForSeed, encodeRev3Planets } from "./orbitRev3Course.server";
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
  return { type: "skyline", seed: arcadeSeed(), skylineRev: SKYLINE_REV };
}

export function generateBinToss(): BinTossPuzzleData {
  return { type: "bintoss", seed: arcadeSeed(), binRev: BINTOSS_REV };
}

export function generateBullseye(): BullseyePuzzleData {
  const seed = arcadeSeed();
  return { type: "bullseye", seed, winds: bullseyeWinds(seed) };
}

export function generateMatchup(): MatchupPuzzleData {
  return { type: "matchup", seed: arcadeSeed(), matchupRev: MATCHUP_REV };
}

export function generateSnake(): SnakePuzzleData {
  return { type: "snake", seed: arcadeSeed(), snakeRev: SNAKE_REV };
}

export function generateCross(): CrossPuzzleData {
  return { type: "cross", seed: arcadeSeed(), crossRev: CROSS_REV };
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
  return { type: "slice", seed: arcadeSeed(), sliceRev: SLICE_REV };
}

export function generateBubble(): BubblePuzzleData {
  return { type: "bubble", seed: arcadeSeed(), bubbleRev: BUB_REV };
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
  return { type: "flip", seed: arcadeSeed(), flipRev: FLIP_REV };
}

export function generateParry(): ParryPuzzleData {
  return { type: "parry", seed: arcadeSeed() };
}

export function generateJunction(): JunctionPuzzleData {
  return { type: "junction", seed: arcadeSeed(), junctionRev: JUNC_REV };
}

export function generateInkBridge(): InkBridgePuzzleData {
  return { type: "inkbridge", seed: arcadeSeed(), inkRev: INK_REV3 };
}

export function generateBurst(): BurstPuzzleData {
  return { type: "burst", seed: arcadeSeed() };
}

export function generateOrbit(): OrbitPuzzleData {
  const seed = arcadeSeed();
  // Rev 3 only from the proved bank: live proof is too slow for a room start, so an empty bank keeps rev 2.
  const bankPlanets = orbitRev3PlanetsForSeed(seed);
  if (!bankPlanets) return { type: "orbit", seed };
  return { type: "orbit", seed, orbitRev: ORBIT_REV3, planets: encodeRev3Planets(bankPlanets) };
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
  return { type: "tilt", seed: arcadeSeed(), tiltRev: TILT_REV };
}

export function generateHotFloor(): HotFloorPuzzleData {
  return { type: "hotfloor", seed: arcadeSeed() };
}
