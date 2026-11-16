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
import { homerunDealSeedV4 } from "./homerunDealV4.server";
import { freekickDealSeedV4 } from "./freekickDealV4.server";
import { racingDealSeedV3 } from "./racingDealV3.server";
import { MINIGOLF_REV, MINIGOLF_REV_COURSE, mgLevelOf, MG_LEVELS, MG_LEVEL_NAMES, type MgLevel } from "@/lib/arcade/minigolf";
import { dealPinned } from "./dealEra";
import { MINIGOLF_HOLES_BANK, type MinigolfHoleEntry } from "./minigolfHolesBank.server";
import { POOL_REV } from "@/lib/arcade/pool";
import { CURLING_REV } from "@/lib/arcade/curling";
import { CURLING_BANK_V4 } from "./curlingBankV4.server";
import { MINIGOLF_BANK_V2 } from "./minigolfBankV2.server";
import { POOL_BANK_V3 } from "./poolBankV3.server";
import { ALLEYROLL_REV_DEALT } from "@/lib/arcade/alleyroll";
import type { AlleyRollPuzzleData, CurlingPuzzleData, FreekickPuzzleData, HomerunPuzzleData, MinigolfPuzzleData, PoolPuzzleData, RacingPuzzleData } from "./types";

export function generateHomerun(): HomerunPuzzleData {
  // homerunRev 4 (3 Nov 2026, pick your spot): rev 4's own proved deal (homerunDealV4.server.ts); rev-3, rev-2 and rev-1
  // rounds replay on their own revisions (their deal files stay as they were).
  return { type: "homerun", seed: homerunDealSeedV4(arcadeSeed()), homerunRev: HOMERUN_REV_DEALT };
}

export function generateFreekick(): FreekickPuzzleData {
  // Top Bins deals freekickRev 4 (3 Nov 2026, the drawn shot) from its own proved deal; rev-1 to rev-3 rounds replay on their own.
  return { type: "freekick", seed: freekickDealSeedV4(arcadeSeed()), freekickRev: FREEKICK_REV_DEALT };
}

export function generateRacing(): RacingPuzzleData {
  // Apex deals racingRev 3 (3 Nov 2026: the softer gravel, corner speed signs, the pace score) from its own proved deal;
  // racingRev 2 and 1 rounds replay on theirs (racingDealV2.server.ts, racingDeal.server.ts).
  return { type: "racing", seed: racingDealSeedV3(arcadeSeed()), racingRev: RACING_REV_DEALT };
}

/**
 * golfRev 3's five holes at a level, one per slot, drawn with `draw` (the server's CSPRNG; checks pass a seeded one):
 * five whose witnesses fit the level's Speed time together (their worst times summed, the bank's `t`), so a perfect run
 * always scores 200. A fresh draw until one fits (at least half of all draws do at every level), else each slot's
 * quickest hole, which always fits (crazy-golf-v3-check).
 */
export function pickMinigolfHoles(level: MgLevel, draw: () => number): MinigolfHoleEntry[] {
  const at = MG_LEVEL_NAMES.indexOf(level);
  const budget = MG_LEVELS[level].fullByS * 60;
  const sum = (p: readonly MinigolfHoleEntry[]) => p.reduce((a, e) => a + e.t[at]!, 0);
  let picks = MINIGOLF_HOLES_BANK.map((slot) => slot[draw() % slot.length]!);
  for (let tries = 0; tries < 64 && sum(picks) > budget; tries++) picks = MINIGOLF_HOLES_BANK.map((slot) => slot[draw() % slot.length]!);
  if (sum(picks) > budget) picks = MINIGOLF_HOLES_BANK.map((slot) => slot.reduce((a, e) => (e.t[at]! < a.t[at]! ? e : a)));
  return picks;
}

export function generateMinigolf(level: unknown = "normal"): MinigolfPuzzleData {
  if (dealPinned("minigolfPreCourse")) {
    // golfRev 2 (crazy golf, 31 Oct 2026) deals from its own proven bank; golfRev 1's bank (minigolfBank.server.ts) still replays.
    const entry = MINIGOLF_BANK_V2[arcadeSeed() % MINIGOLF_BANK_V2.length]!;
    return { type: "minigolf", seed: entry.seed, golfRev: MINIGOLF_REV, pars: [...entry.pars] };
  }
  // golfRev 3 (the Crazy Golf overhaul, 15 Nov 2026): one hole from each slot of the proven hole bank, with its par at the
  // dealt level (a level the deal doesn't know is Normal). Stored once, so a room's players all play the same five.
  const lv: MgLevel = mgLevelOf(level);
  const at = MG_LEVEL_NAMES.indexOf(lv);
  const seed = arcadeSeed();
  const picks = pickMinigolfHoles(lv, arcadeSeed);
  return {
    type: "minigolf",
    seed,
    golfRev: MINIGOLF_REV_COURSE,
    holes: picks.map((e) => e.id),
    pars: picks.map((e) => e.pars[at]!),
    ...(lv === "normal" ? {} : { level: lv }),
  };
}

export function generatePool(): PoolPuzzleData {
  // poolRev 4 (3 Nov 2026) deals from poolRev 3's proved bank, every layout re-proved at 200 on poolRev 4
  // (pool-bank.ts --rev=4, pool-check); poolRev 2 and 1 rounds replay on theirs (poolBankV2 / poolBank).
  return { type: "pool", seed: POOL_BANK_V3[arcadeSeed() % POOL_BANK_V3.length]!, poolRev: POOL_REV };
}

export function generateCurling(): CurlingPuzzleData {
  // curlRev 4 (3 Nov 2026): its own bank, proved with three reds and curling's count (curlingBankV4.server.ts); curlRev 3
  // rounds replay on curlingBankV3.server.ts's sheets, curlRev 2 on curlingBankV2's, curlRev 1 on curlingBank's.
  return { type: "curling", seed: CURLING_BANK_V4[arcadeSeed() % CURLING_BANK_V4.length]!, curlRev: CURLING_REV };
}

export function generateAlleyRoll(): AlleyRollPuzzleData {
  // Alley Roll (1 Nov 2026): the lane is the same for every seed (the oracle's line scores 200 on any), so any seed.
  // Ringer (alleyRollRev 2, 3 Nov 2026): the seed sets the gold cup's path; the oracle times it to 200 on any seed.
  return { type: "alleyroll", seed: arcadeSeed(), alleyRollRev: ALLEYROLL_REV_DEALT };
}
