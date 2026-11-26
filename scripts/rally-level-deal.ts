/**
 * Rally's rallyRev 14 deal (D5's ladder, 23 Nov 2026; docs/arcade-standard/rally.md "Levels (D5, 23 Nov 2026)"): writes
 * src/lib/duel/rallyLevelDeals.server.ts, the seeds each level deals on rallyRev 14 (Normal too), and the witnesses that
 * prove them, scripts/fixtures/rally-level-deal-witness.json.gz.
 *
 * The D5 proof standard: a seed is dealt at a level only when the return-and-spin planner held to the human limits
 * (scripts/rally-oracle.ts: the flawless player seeing 0.15 s late and reacting no sooner than 0.25 s) scores exactly
 * 200 on it through the server's replay at that level, unflagged; up to RALLY_DEAL_TRIES draws of its reactions are
 * tried. Candidates are the skill-band room seeds n = 0, 1, 2… (tuning first, then fresh from 10000), in order, until
 * RALLY_DEAL_KEEP are kept a level.
 *
 *   bun scripts/rally-level-deal.ts [--levels=easy,hard]   (writes both files; levels not named keep their witnesses)
 *   bun scripts/rally-level-deal.ts --check                (replays every stored witness and rebuilds the deal file in
 *                                                           memory; fails unless every witness scores 200 and the file
 *                                                           is identical)
 */
import { RALLY_REV_LADDER } from "../src/lib/arcade/rally";
import { roomSeed } from "./arcade-skill-bands/games";
import { levelDealSource, runLevelDeal, type LevelDealPlan } from "./ladder-deal-lib";

export const RALLY_DEAL_KEEP = 100;
export const RALLY_DEAL_TRIES = 6;

export const RALLY_DEAL_PLAN: LevelDealPlan = {
  type: "rally",
  field: "rallyRev",
  rev: RALLY_REV_LADDER,
  keep: RALLY_DEAL_KEEP,
  seedFor: (n) => roomSeed(n),
  candidates: [...Array.from({ length: 60 }, (_, i) => i), ...Array.from({ length: 2000 }, (_, i) => 10000 + i)],
  dealFile: "src/lib/duel/rallyLevelDeals.server.ts",
  witnessFile: "scripts/fixtures/rally-level-deal-witness.json.gz",
  source: (kept, tried) =>
    levelDealSource(
      {
        title: "Rally",
        exportName: "RALLY_LEVEL_DEALS",
        fnName: "rallyLevelDealSeed",
        builder: "bun scripts/rally-level-deal.ts",
        witness: "scripts/fixtures/rally-level-deal-witness.json.gz",
        rev: "rallyRev 14",
        prover: "the return-and-spin planner held to the human limits (scripts/rally-oracle.ts)",
      },
      kept,
      tried,
    ),
};

if (import.meta.main) {
  const { rallyProof } = await import("./rally-oracle");
  await runLevelDeal(RALLY_DEAL_PLAN, async (puzzle) => rallyProof(puzzle, RALLY_DEAL_TRIES), process.argv.slice(2));
}
