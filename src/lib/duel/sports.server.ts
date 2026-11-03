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
import { homerunDealSeedV3 } from "./homerunDealV3.server";
import { freekickDealSeedV4 } from "./freekickDealV4.server";
import { racingDealSeedV2 } from "./racingDealV2.server";
import { MINIGOLF_REV } from "@/lib/arcade/minigolf";
import { POOL_REV } from "@/lib/arcade/pool";
import { CURLING_REV } from "@/lib/arcade/curling";
import { CURLING_BANK_V3 } from "./curlingBankV3.server";
import { MINIGOLF_BANK_V2 } from "./minigolfBankV2.server";
import { POOL_BANK_V3 } from "./poolBankV3.server";
import { ALLEYROLL_REV } from "@/lib/arcade/alleyroll";
import type { AlleyRollPuzzleData, CurlingPuzzleData, FreekickPuzzleData, HomerunPuzzleData, MinigolfPuzzleData, PoolPuzzleData, RacingPuzzleData } from "./types";

export function generateHomerun(): HomerunPuzzleData {
  // homerunRev 3 (1 Nov 2026, the swing choice and the pitcher's tell): rev 3's own proved deal (homerunDealV3.server.ts);
  // rev-2 rounds replay on rev 2 (homerunDealV2.server.ts stays as it was).
  return { type: "homerun", seed: homerunDealSeedV3(arcadeSeed()), homerunRev: HOMERUN_REV_DEALT };
}

export function generateFreekick(): FreekickPuzzleData {
  // Top Bins deals freekickRev 4 (3 Nov 2026, the drawn shot) from its own proved deal; rev-1 to rev-3 rounds replay on their own.
  return { type: "freekick", seed: freekickDealSeedV4(arcadeSeed()), freekickRev: FREEKICK_REV_DEALT };
}

export function generateRacing(): RacingPuzzleData {
  // Apex deals racingRev 2 (31 Oct 2026: the lights start, the softer joystick) from its own proved deal.
  return { type: "racing", seed: racingDealSeedV2(arcadeSeed()), racingRev: RACING_REV_DEALT };
}

export function generateMinigolf(): MinigolfPuzzleData {
  // golfRev 2 (crazy golf, 31 Oct 2026) deals from its own proven bank; golfRev 1's bank (minigolfBank.server.ts) still replays.
  const entry = MINIGOLF_BANK_V2[arcadeSeed() % MINIGOLF_BANK_V2.length]!;
  return { type: "minigolf", seed: entry.seed, golfRev: MINIGOLF_REV, pars: [...entry.pars] };
}

export function generatePool(): PoolPuzzleData {
  // poolRev 3 (1 Nov 2026) deals from its own proved bank; poolRev 2 and 1 rounds replay on theirs (poolBankV2 / poolBank).
  return { type: "pool", seed: POOL_BANK_V3[arcadeSeed() % POOL_BANK_V3.length]!, poolRev: POOL_REV };
}

export function generateCurling(): CurlingPuzzleData {
  // curlRev 3 (1 Nov 2026): its own bank, proved on the gentler weight line (curlingBankV3.server.ts); curlRev 2 rounds
  // replay on curlingBankV2.server.ts's sheets, curlRev 1 on curlingBank.server.ts's.
  return { type: "curling", seed: CURLING_BANK_V3[arcadeSeed() % CURLING_BANK_V3.length]!, curlRev: CURLING_REV };
}

export function generateAlleyRoll(): AlleyRollPuzzleData {
  // Alley Roll (1 Nov 2026): the lane is the same for every seed (the oracle's line scores 200 on any), so any seed.
  return { type: "alleyroll", seed: arcadeSeed(), alleyRollRev: ALLEYROLL_REV };
}
