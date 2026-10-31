/**
 * Server-only deals for the Sports group (30 Oct 2026). Home Run Derby, Free Kick and Racing store one seed from the
 * game's proved deal (`<game>Deal.server.ts`: seeds the oracle took to exactly 200 through the server replay), picked by
 * a fresh CSPRNG seed; Minigolf, Speed Pool and Curling deal from their banks of proven courses, tables and sheets
 * (every one played to 200 by its oracle through the server's replay; minigolf-check, pool-check and curling-check
 * replay the proofs). Everyone in a room plays the identical run and a perfect run is always there; each is stamped
 * on its first revision, on the arcade scoring standard.
 */
import { HOMERUN_REV_STD } from "@/lib/arcade/homerun";
import { FREEKICK_REV_STD } from "@/lib/arcade/freekick";
import { RACING_REV_STD } from "@/lib/arcade/racing";
import { arcadeSeed } from "./arcade.server";
import { homerunDealSeed } from "./homerunDeal.server";
import { freekickDealSeed } from "./freekickDeal.server";
import { racingDealSeed } from "./racingDeal.server";
import { MINIGOLF_REV } from "@/lib/arcade/minigolf";
import { POOL_REV } from "@/lib/arcade/pool";
import { CURLING_REV } from "@/lib/arcade/curling";
import { CURLING_BANK_V2 } from "./curlingBankV2.server";
import { MINIGOLF_BANK_V2 } from "./minigolfBankV2.server";
import { POOL_BANK_V2 } from "./poolBankV2.server";
import type { CurlingPuzzleData, FreekickPuzzleData, HomerunPuzzleData, MinigolfPuzzleData, PoolPuzzleData, RacingPuzzleData } from "./types";

export function generateHomerun(): HomerunPuzzleData {
  return { type: "homerun", seed: homerunDealSeed(arcadeSeed()), homerunRev: HOMERUN_REV_STD };
}

export function generateFreekick(): FreekickPuzzleData {
  return { type: "freekick", seed: freekickDealSeed(arcadeSeed()), freekickRev: FREEKICK_REV_STD };
}

export function generateRacing(): RacingPuzzleData {
  return { type: "racing", seed: racingDealSeed(arcadeSeed()), racingRev: RACING_REV_STD };
}

export function generateMinigolf(): MinigolfPuzzleData {
  // golfRev 2 (crazy golf, 31 Oct 2026) deals from its own proven bank; golfRev 1's bank (minigolfBank.server.ts) still replays.
  const entry = MINIGOLF_BANK_V2[arcadeSeed() % MINIGOLF_BANK_V2.length]!;
  return { type: "minigolf", seed: entry.seed, golfRev: MINIGOLF_REV, pars: [...entry.pars] };
}

export function generatePool(): PoolPuzzleData {
  // poolRev 2 (31 Oct 2026) deals from its own proved bank; poolRev 1 rounds replay on theirs (poolBank.server.ts).
  return { type: "pool", seed: POOL_BANK_V2[arcadeSeed() % POOL_BANK_V2.length]!, poolRev: POOL_REV };
}

export function generateCurling(): CurlingPuzzleData {
  // curlRev 2 (31 Oct 2026): its own bank, proved with the start along the hog line (curlingBankV2.server.ts).
  return { type: "curling", seed: CURLING_BANK_V2[arcadeSeed() % CURLING_BANK_V2.length]!, curlRev: CURLING_REV };
}
