/**
 * Orbit legacy replay check (fixture-only, no git history): re-scores every frozen legacy run
 * (puzzles without orbitRev) through today's replayOrbitRun and requires exact score and scored
 * counters. Fixtures in scripts/fixtures/orbit-legacy/:
 *  - stored-rounds.json: real rounds copied from the database, with the server's stored score.
 *  - bot-runs.json: 40 recorded tap logs (20 careful, 20 random-tap) with frozen results.
 * The older single-file scripts/fixtures/orbit-legacy.json (score/extra per seed) is also pinned.
 *   bun scripts/orbit-legacy-replay-check.ts
 */
import { readFileSync } from "node:fs";
import { replayOrbitRun } from "../src/lib/duel/orbit";
import { orbitExtra } from "../src/lib/arcade/orbit";

const KEYS = ["passed", "captured", "total", "survived", "survivedSeconds", "finished", "secondsLeft"] as const;
const load = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const stored: any[] = load("scripts/fixtures/orbit-legacy/stored-rounds.json");
const bots: any[] = load("scripts/fixtures/orbit-legacy/bot-runs.json");
const fails: string[] = [];
let n = 0;
for (const f of [...stored, ...bots]) {
  n++;
  const r = replayOrbitRun(f.seed, f.raw);
  const extra = orbitExtra(r.state) as Record<string, unknown>;
  if (r.flagged) fails.push(`${f.source} seed ${f.seed}: flagged ${r.reason ?? ""}`);
  if (r.score !== f.score) fails.push(`${f.source} seed ${f.seed}: score ${r.score} ≠ ${f.score}`);
  for (const k of KEYS) {
    if (f.extra && k in f.extra && JSON.stringify(extra[k]) !== JSON.stringify(f.extra[k]))
      fails.push(`${f.source} seed ${f.seed}: ${k} ${JSON.stringify(extra[k])} ≠ ${JSON.stringify(f.extra[k])}`);
  }
}
// The per-seed legacy pins recorded on 9 Oct (careful bot over 20 seeds) must equal the matching bot runs.
const pins: any[] = load("scripts/fixtures/orbit-legacy.json");
for (const p of pins) {
  const b = bots.find((x) => x.source === "bot-careful" && x.seed === p.seed);
  if (!b) fails.push(`pin seed ${p.seed}: no recorded run`);
  else if (b.score !== p.score || JSON.stringify(b.extra) !== JSON.stringify(p.extra)) fails.push(`pin seed ${p.seed}: differs from 9 Oct pin`);
}
console.log(`Orbit legacy replay: ${n} runs (${stored.length} stored rounds, ${bots.length} bot runs), ${pins.length} pins`);
if (fails.length) {
  console.log(`FAIL\n${fails.join("\n")}`);
  process.exit(1);
}
console.log("PASS — every legacy run re-scores exactly");
