/**
 * Grappler's difficulty levels' deals (swingRev 18; built by `bun scripts/swing-slide-deal.ts --rev=18 --level=<level>`,
 * do not edit): 24 course seeds a level, each proved at its level: the oracle (the flawless-level skill-band bot)
 * plays the course built from the seed at the level and its log replays through replaySwingRun at that level to exactly
 * 200 (witnesses in scripts/fixtures/swing-level-<level>-witness.json.gz).
 * easy: 55 of the first 79 candidates dropped.
 * hard: 24 of the first 48 candidates dropped.
 * expert: 20 of the first 44 candidates dropped.
 */
import type { SwingLevel } from "@/lib/arcade/swing";

export const SWING_LEVEL_DEAL: Readonly<Record<SwingLevel, readonly number[]>> = {"easy":[1854138862,80672385,973907887,1174098453,527841388,671179766,2037254900,1116863695,2136570838,454425630,225645145,978677670,818620931,709200764,1914043140,1264209231,1873965341,998092032,1601196427,898678825,1804475811,734537111,634897610,2009611715],"hard":[973907887,382021995,484615669,564527562,671179766,1476148260,2037254900,1116863695,1129120656,1322507854,2136570838,225645145,1899625500,286650877,122758846,818620931,1264059962,239897140,709200764,1492875028,1110877598,1089691770,238037073,2002583748],"expert":[1560728537,80672385,973907887,382021995,527841388,564527562,975730039,671179766,1476148260,843969757,1116863695,1322507854,416796831,2136570838,225645145,1899625500,286650877,519412512,818620931,979042426,1492875028,1110877598,1201639661,1914043140]};

/** The course a room seed deals at a level on swingRev 18. */
export function swingLevelDealSeed(level: SwingLevel, roomSeed: number): number {
  const list = SWING_LEVEL_DEAL[level];
  const n = list.length;
  return list[((Math.trunc(roomSeed) % n) + n) % n]!;
}
