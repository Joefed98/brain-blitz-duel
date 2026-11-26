/**
 * Builds Top Bins' D6 level deal, src/lib/duel/freekickDealV7.server.ts (freekickRev 7, 23 Nov 2026; level deals only,
 * Normal keeps freekickRev 6's): FK5_DEAL_SIZE seeds for each of Easy, Hard and Expert, every one proved by the oracle
 * (scripts/freekick-oracle.ts oracleRunV5 on rev 7's level table, FK_LEVEL_SETTINGS_V7) to score exactly 200 at that
 * level through the server's own encode + replay path, and with every target hit and ten skill shots made (Normal's
 * figures, stricter than any level's FK_V7_FULL), so the list doesn't move when a level's figures are tuned; a seed the
 * oracle cannot take there is dropped. The same candidate seeds as freekick-layered-deal.ts (hashSeed, salted by level).
 *
 *   bun scripts/freekick-d6-deal.ts           # rebuild the file
 *   bun scripts/freekick-d6-deal.ts --check   # prove the file is what this script builds, without writing
 */
import { readFileSync, writeFileSync } from "node:fs";
import { freekickCheckpoint, freekickGameFor, FREEKICK_REV_7, FREEKICK_TARGETS, type FkLevel } from "../src/lib/arcade/freekick";
import { encodeFreekickRun, replayFreekickRun } from "../src/lib/duel/freekick";
import { FK5_DEAL_SIZE } from "./freekick-layered-deal";
import { oracleRunV5 } from "./freekick-oracle";
import { hashSeed } from "./freekick-deal";

const SALT: Record<FkLevel, number> = { easy: 50_000, normal: 0, hard: 100_000, expert: 150_000 };
/** Normal's skill-shot figure (ten), the strict bar every listed seed's oracle run clears. */
const STRICT_SKILL = 10;

/** The oracle's run at a level on rev 7 through the server replay: its stored score, targets and skill shots. */
function proveSeed(seed: number, level: FkLevel): { score: number; targets: number; skill: number } {
  const game = freekickGameFor(FREEKICK_REV_7, level);
  const events = oracleRunV5(seed, level, FREEKICK_REV_7);
  const at = new Map(events.map((e) => [e.t, e]));
  const checkpoints = [];
  let s = game.init(seed);
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 60 === 0) checkpoints.push(freekickCheckpoint(s));
  }
  const raw = encodeFreekickRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
  const r = replayFreekickRun(seed, raw, FREEKICK_REV_7, level);
  return { score: r.flagged ? -1 : r.score, targets: r.state.targets, skill: r.state.skill ?? 0 };
}

function buildDeal(level: FkLevel): { seeds: number[]; dropped: number } {
  const seeds: number[] = [];
  let dropped = 0;
  for (let n = 0; seeds.length < FK5_DEAL_SIZE; n++) {
    const seed = hashSeed(SALT[level] + n);
    const p = proveSeed(seed, level);
    if (p.score === 200 && p.targets >= FREEKICK_TARGETS && p.skill >= STRICT_SKILL) seeds.push(seed);
    else dropped++;
  }
  return { seeds, dropped };
}

const LEVELS: FkLevel[] = ["easy", "hard", "expert"];
const PATH = "src/lib/duel/freekickDealV7.server.ts";

if (import.meta.main) {
  console.error = () => {};
  const built = LEVELS.map((l) => ({ l, ...buildDeal(l) }));
  const file = `/**
 * Top Bins' D6 level deal (freekickRev 7, 23 Nov 2026; level deals only): ${FK5_DEAL_SIZE} seeds a level, each proved by
 * the oracle (scripts/freekick-oracle.ts oracleRunV5) to score exactly 200 at that level through the server replay,
 * with every target and ten skill shots (Normal's figures).
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
