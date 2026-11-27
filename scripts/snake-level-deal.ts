/**
 * Meteor's snakeRev 16 deal (D5's ladder, 23 Nov 2026; docs/arcade-standard/snake.md "Levels (D5, 23 Nov 2026)"): writes
 * src/lib/duel/snakeLevelDeals.server.ts, the seeds each level deals on snakeRev 16 (Normal too), and the witnesses that
 * prove them, scripts/fixtures/snake-level-deal-witness.json.gz.
 *
 * The D5 proof standard: a seed is dealt at a level only when the comet planner held to the human limits
 * (scripts/snake-oracle.ts: the flawless player reacting no sooner than 0.25 s and swiping no closer than 0.15 s) scores
 * exactly 200 on it through the server's replay at that level, unflagged; up to SNAKE_DEAL_TRIES draws of its think
 * times are tried. Candidates are the skill-band room seeds n = 0, 1, 2… (tuning first, then fresh from 10000), in
 * order, until SNAKE_DEAL_KEEP are kept a level.
 *
 *   bun scripts/snake-level-deal.ts [--levels=easy,hard]   (writes both files; levels not named keep their witnesses)
 *   bun scripts/snake-level-deal.ts --check                (replays every stored witness and rebuilds the deal file in
 *                                                           memory; fails unless every witness scores 200 and the file
 *                                                           is identical)
 */
import { SNAKE_REV_LADDER } from "../src/lib/arcade/snake";
import { roomSeed } from "./arcade-skill-bands/games";
import { levelDealSource, runLevelDeal, type LevelDealPlan } from "./ladder-deal-lib";

export const SNAKE_DEAL_KEEP = 100;
export const SNAKE_DEAL_TRIES = 8;

export const SNAKE_DEAL_PLAN: LevelDealPlan = {
  type: "snake",
  field: "snakeRev",
  rev: SNAKE_REV_LADDER,
  keep: SNAKE_DEAL_KEEP,
  seedFor: (n) => roomSeed(n),
  candidates: [...Array.from({ length: 60 }, (_, i) => i), ...Array.from({ length: 1000 }, (_, i) => 10000 + i)],
  dealFile: "src/lib/duel/snakeLevelDeals.server.ts",
  witnessFile: "scripts/fixtures/snake-level-deal-witness.json.gz",
  source: (kept, tried) =>
    levelDealSource(
      {
        title: "Meteor",
        exportName: "SNAKE_LEVEL_DEALS",
        fnName: "snakeLevelDealSeed",
        builder: "bun scripts/snake-level-deal.ts",
        witness: "scripts/fixtures/snake-level-deal-witness.json.gz",
        rev: "snakeRev 16",
        prover: "the comet planner held to the human limits (scripts/snake-oracle.ts)",
      },
      kept,
      tried,
    ),
};

if (import.meta.main) {
  const { snakeProof } = await import("./snake-oracle");
  await runLevelDeal(SNAKE_DEAL_PLAN, async (puzzle) => snakeProof(puzzle, SNAKE_DEAL_TRIES), process.argv.slice(2));
}
