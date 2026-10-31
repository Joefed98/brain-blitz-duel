/**
 * Server-only deals for the Sports group (30 Oct 2026). Home Run Derby, Free Kick and Racing store one seed from the
 * game's proved deal (`<game>Deal.server.ts`: seeds the oracle took to exactly 200 through the server replay), picked by
 * a fresh CSPRNG seed; Minigolf, Speed Pool and Curling deal from their banks of proven courses, tables and sheets
 * (every one played to 200 by its oracle through the server's replay; minigolf-check, pool-check and curling-check
 * replay the proofs). Everyone in a room plays the identical run and a perfect run is always there; each is stamped
 * on its first revision, on the arcade scoring standard.
 */
import { HOMERUN_REV_DEALT } from "@/lib/arcade/homerun";
import { FREEKICK_REV_DEALT } from "@/lib/arcade/freekick";
import { RACING_REV_DEALT } from "@/lib/arcade/racing";
import { arcadeSeed } from "./arcade.server";
import { homerunDealSeedV2 } from "./homerunDealV2.server";
import { freekickDealSeedV2 } from "./freekickDealV2.server";
import { racingDealSeedV2 } from "./racingDealV2.server";
import { MINIGOLF_REV } from "@/lib/arcade/minigolf";
import { POOL_REV } from "@/lib/arcade/pool";
import { CURLING_REV } from "@/lib/arcade/curling";
import { CURLING_BANK } from "./curlingBank.server";
import { MINIGOLF_BANK } from "./minigolfBank.server";
import { POOL_BANK } from "./poolBank.server";
import type { CurlingPuzzleData, FreekickPuzzleData, HomerunPuzzleData, MinigolfPuzzleData, PoolPuzzleData, RacingPuzzleData } from "./types";

export function generateHomerun(): HomerunPuzzleData {
  // homerunRev 2 (31 Oct 2026): rev 2's own proved deal (homerunDealV2.server.ts).
  return { type: "homerun", seed: homerunDealSeedV2(arcadeSeed()), homerunRev: HOMERUN_REV_DEALT };
}

export function generateFreekick(): FreekickPuzzleData {
  // Top Bins deals freekickRev 2 (31 Oct 2026) from its own proved deal; rev-1 rounds replay on rev 1.
  return { type: "freekick", seed: freekickDealSeedV2(arcadeSeed()), freekickRev: FREEKICK_REV_DEALT };
}

export function generateRacing(): RacingPuzzleData {
  // Apex deals racingRev 2 (31 Oct 2026: the lights start, the softer joystick) from its own proved deal.
  return { type: "racing", seed: racingDealSeedV2(arcadeSeed()), racingRev: RACING_REV_DEALT };
}

export function generateMinigolf(): MinigolfPuzzleData {
  const entry = MINIGOLF_BANK[arcadeSeed() % MINIGOLF_BANK.length]!;
  return { type: "minigolf", seed: entry.seed, golfRev: MINIGOLF_REV, pars: [...entry.pars] };
}

export function generatePool(): PoolPuzzleData {
  return { type: "pool", seed: POOL_BANK[arcadeSeed() % POOL_BANK.length]!, poolRev: POOL_REV };
}

export function generateCurling(): CurlingPuzzleData {
  return { type: "curling", seed: CURLING_BANK[arcadeSeed() % CURLING_BANK.length]!, curlRev: CURLING_REV };
}
