/**
 * Server-only generation for Hover. One seed per round drives every pillar, so
 * everyone in the room flies the identical course; practice draws a fresh seed
 * each time it starts a round.
 */

import { HOVER_REV_TUNEC } from "@/lib/arcade/hover";

import { randomBelow } from "./random";
import type { HoverPuzzleData } from "./types";

/** A fresh 32-bit seed from the platform CSPRNG. */
export function hoverSeed(): number {
  return randomBelow(0x7fff_ffff) + 1;
}

export function generateHover(): HoverPuzzleData {
  return { type: "hover", seed: hoverSeed(), hoverRev: HOVER_REV_TUNEC };
}
