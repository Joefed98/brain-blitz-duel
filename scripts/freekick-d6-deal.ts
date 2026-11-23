/**
 * Builds Top Bins' D6 level deal, src/lib/duel/freekickDealV7.server.ts (freekickRev 7, 23 Nov 2026; level deals only,
 * Normal keeps freekickRev 6's): FK5_DEAL_SIZE seeds for each of Easy, Hard and Expert, every one proved by the oracle
 * (scripts/freekick-oracle.ts oracleRunV5 on rev 7's level table, FK_LEVEL_SETTINGS_V7) to score exactly 200 at that
 * level through the server's own encode + replay path; a seed the oracle cannot take to 200 is dropped. The same
 * candidate seeds and rule as freekick-layered-deal.ts (its exported buildDeal, here at rev 7).
 *
 *   bun scripts/freekick-d6-deal.ts           # rebuild the file
 *   bun scripts/freekick-d6-deal.ts --check   # prove the file is what this script builds, without writing
 */
import { readFileSync, writeFileSync } from "node:fs";
import { FREEKICK_REV_7, type FkLevel } from "../src/lib/arcade/freekick";
import { buildDeal, FK5_DEAL_SIZE } from "./freekick-layered-deal";

const LEVELS: FkLevel[] = ["easy", "hard", "expert"];
const PATH = "src/lib/duel/freekickDealV7.server.ts";

if (import.meta.main) {
  console.error = () => {};
  const built = LEVELS.map((l) => ({ l, ...buildDeal(l, FREEKICK_REV_7) }));
  const file = `/**
 * Top Bins' D6 level deal (freekickRev 7, 23 Nov 2026; level deals only): ${FK5_DEAL_SIZE} seeds a level, each proved by
 * the oracle (scripts/freekick-oracle.ts oracleRunV5) to score exactly 200 at that level through the server replay.
 * Built by \`bun scripts/freekick-d6-deal.ts\` (dropped: ${built.map((b) => `${b.l} ${b.dropped}`).join(", ")}). Rooms deal
 * FREEKICK_DEAL_V7[level][room seed % length].
 */
export const FREEKICK_DEAL_V7: Readonly<Record<"easy" | "hard" | "expert", readonly number[]>> = {
${built.map((b) => `  ${b.l}: [${b.seeds.join(", ")}],`).join("\n")}
};

/** The deal for room seed \`n\` at a level. */
export function freekickDealSeedV7(n: number, level: "easy" | "hard" | "expert"): number {
  const list = FREEKICK_DEAL_V7[level];
  return list[((n % list.length) + list.length) % list.length]!;
}
`;
  if (process.argv.includes("--check")) {
    const same = readFileSync(PATH, "utf8") === file;
    console.log(same ? `PASS ${PATH} rebuilt byte for byte` : `FAIL ${PATH} is not what freekick-d6-deal.ts builds`);
    process.exit(same ? 0 : 1);
  }
  writeFileSync(PATH, file);
  console.log(`wrote ${PATH}: ${built.map((b) => `${b.l} ${b.seeds.length} (${b.dropped} dropped)`).join(", ")}`);
}
