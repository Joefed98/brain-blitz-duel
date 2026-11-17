/**
 * Records scripts/retro-demos.json (the Retro overhaul, stage 3): one Near-perfect bot run per Retro game on its intro
 * example deal and dealt stamp (scripts/retro-demos-lib.ts). Re-run it after a Retro game's stamp or example deal changes;
 * retro-demos-check fails until then. Writes the file only; never a database.
 *
 *   bun scripts/retro-demos-record.ts [games…]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { FIXTURE_PATH, RETRO_DEMO_GAMES, recordDemo, type RetroDemoFixture, type RetroDemoGame } from "./retro-demos-lib";

const asked = process.argv.slice(2).filter((a) => !a.startsWith("--")) as RetroDemoGame[];
const games = asked.length ? asked : [...RETRO_DEMO_GAMES];
const prior: RetroDemoFixture | null = existsSync(FIXTURE_PATH) ? (JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as RetroDemoFixture) : null;
const byType = new Map((prior?.demos ?? []).map((d) => [d.type, d]));
for (const type of games) {
  const demo = await recordDemo(type);
  byType.set(type, demo);
  console.log(`${type.padEnd(10)} ${demo.field} ${demo.rev}  score ${demo.score}  ${demo.run.length} chars`);
}
const fixture: RetroDemoFixture = {
  note: "Retro intro demos (the Retro overhaul, stage 3): Near-perfect bot runs on each game's intro example deal and dealt stamp. Recorded by scripts/retro-demos-record.ts; proved by retro-demos-check; saved by scripts/retro-demos-save.ts.",
  demos: RETRO_DEMO_GAMES.filter((t) => byType.has(t)).map((t) => byType.get(t)!),
};
writeFileSync(FIXTURE_PATH, `${JSON.stringify(fixture, null, 1)}\n`);
console.log(`wrote ${FIXTURE_PATH} (${fixture.demos.length} demos)`);
