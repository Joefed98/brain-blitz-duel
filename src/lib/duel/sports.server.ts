/**
 * Server-only deals for the Sports group (30 Oct 2026): Home Run Derby, Free Kick and Racing. Each round stores one
 * seed from the game's proved deal (`<game>Deal.server.ts`: seeds the oracle took to exactly 200 through the server
 * replay), picked by a fresh CSPRNG seed, so everyone in the room plays the identical run and every dealt run can
 * reach 200. Each is stamped on its first revision, on the arcade scoring standard.
 */
import { HOMERUN_REV_STD } from "@/lib/arcade/homerun";
import { FREEKICK_REV_STD } from "@/lib/arcade/freekick";
import { RACING_REV_STD } from "@/lib/arcade/racing";
import { arcadeSeed } from "./arcade.server";
import { homerunDealSeed } from "./homerunDeal.server";
import { freekickDealSeed } from "./freekickDeal.server";
import { racingDealSeed } from "./racingDeal.server";
import type { FreekickPuzzleData, HomerunPuzzleData, RacingPuzzleData } from "./types";

export function generateHomerun(): HomerunPuzzleData {
  return { type: "homerun", seed: homerunDealSeed(arcadeSeed()), homerunRev: HOMERUN_REV_STD };
}

export function generateFreekick(): FreekickPuzzleData {
  return { type: "freekick", seed: freekickDealSeed(arcadeSeed()), freekickRev: FREEKICK_REV_STD };
}

export function generateRacing(): RacingPuzzleData {
  return { type: "racing", seed: racingDealSeed(arcadeSeed()), racingRev: RACING_REV_STD };
}
