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
  SkylinePuzzleData,
  SwervePuzzleData,
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
