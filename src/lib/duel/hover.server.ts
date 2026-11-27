/**
 * Server-only generation for Hover. One seed per round drives every pillar, so
 * everyone in the room flies the identical course; practice draws a fresh seed
 * each time it starts a round.
 */

import { HOVER_REV_FIT, HOVER_REV_SHIELD, HOVER_REV_STANDARD } from "@/lib/arcade/hover";
import type { Level } from "@/lib/levels/levels";
import { dealPinned } from "./dealEra";
import { hoverLevelDealSeed } from "./hoverLevelDeals.server";

import { randomBelow } from "./random";
import type { HoverPuzzleData } from "./types";

/** A fresh 32-bit seed from the platform CSPRNG. */
export function hoverSeed(): number {
  return randomBelow(0x7fff_ffff) + 1;
}

export function generateHover(level?: Level): HoverPuzzleData {
  // hoverRev 10 (the arcade scoring standard, 29 Oct 2026): hoverRev 9's play, scored in fixed parts to 200.
  // hoverRev 11 (the Retro overhaul, stage 3, 16 Nov 2026): hoverRev 10 starting shielded (preRetro: hoverRev 10).
  if (dealPinned("preRetro")) return { type: "hover", seed: hoverSeed(), hoverRev: HOVER_REV_STANDARD };
  // hoverRev 12 (D5, 23 Nov 2026): Normal's fitted full lines and the gap ladder, each level (Normal included) dealt only
  // on the seeds whose proof run, the flawless player held to the human limits, scores exactly 200
  // (hoverLevelDeals.server.ts); hoverPreFit: hoverRev 11 as rooms dealt it before.
  if (dealPinned("hoverPreFit")) return { type: "hover", seed: hoverSeed(), hoverRev: HOVER_REV_SHIELD };
  return { type: "hover", seed: hoverLevelDealSeed(level ?? "normal", hoverSeed()), hoverRev: HOVER_REV_FIT };
}
