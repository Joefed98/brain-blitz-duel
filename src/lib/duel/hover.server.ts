/**
 * Server-only generation for Hover. One seed per round drives every pillar, so
 * everyone in the room flies the identical course; practice draws a fresh seed
 * each time it starts a round.
 */

import { HOVER_REV_SHIELD, HOVER_REV_STANDARD } from "@/lib/arcade/hover";
import { dealPinned } from "./dealEra";

import { randomBelow } from "./random";
import type { HoverPuzzleData } from "./types";

/** A fresh 32-bit seed from the platform CSPRNG. */
export function hoverSeed(): number {
  return randomBelow(0x7fff_ffff) + 1;
}

export function generateHover(): HoverPuzzleData {
  // hoverRev 10 (the arcade scoring standard, 29 Oct 2026): hoverRev 9's play, scored in fixed parts to 200.
  // hoverRev 11 (the Retro overhaul, stage 3, 16 Nov 2026): hoverRev 10 starting shielded (preRetro: hoverRev 10).
  return { type: "hover", seed: hoverSeed(), hoverRev: dealPinned("preRetro") ? HOVER_REV_STANDARD : HOVER_REV_SHIELD };
}
