/**
 * Appends runs for a stamp the skins replay check has none of (scripts/fixtures/skins-replay-runs.json), the way
 * record-runs.ts records them (two runs played as the phone plays them, random inputs on dealt seeds, each with the
 * server replay's score), without touching a single stored run (Working rule 2: never rebuild a fixture over existing
 * runs). First used for racingRev 4 (the Sports overhaul, 15 Nov 2026).
 *
 *   bun scripts/skins/append-runs.ts <game> <rev>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { playRun, prng, runSpecs } from "./runs";

const [game, revArg] = process.argv.slice(2);
const rev = Number(revArg);
const path = "scripts/fixtures/skins-replay-runs.json";
const fixture = JSON.parse(readFileSync(path, "utf8")) as { recorded: string; runs: { game: string; rev: number; seed: number; raw: string; score: number }[] };
if (fixture.runs.some((r) => r.game === game && r.rev === rev)) throw new Error(`${game} rev ${rev} already has runs: nothing appended`);
const specs = await runSpecs();
const i = specs.findIndex((s) => s.game === game && s.rev === rev);
if (i < 0) throw new Error(`no run spec for ${game} rev ${rev}`);
const spec = specs[i]!;
const rand = prng(0x5c1e + i * 977);
for (let n = 0; n < 2; n++) {
  const seed = spec.seedFor(n * 5 + 1);
  const { raw, score } = playRun(spec, seed, rand);
  const server = spec.replay(seed, raw).score;
  if (server !== score) throw new Error(`${game} rev ${rev} seed ${seed}: sim ${score}, replay ${server}`);
  fixture.runs.push({ game, rev, seed, raw, score });
  console.log(`  appended ${game} rev ${rev} seed ${seed}: ${score}`);
}
fixture.recorded += `; ${game} rev ${rev} appended 15 Nov 2026 (the Sports overhaul)`;
writeFileSync(path, JSON.stringify(fixture) + "\n");
