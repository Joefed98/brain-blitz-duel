/**
 * Records scripts/fixtures/breaker-ladder-perfect.json (D5's ladder, 23 Nov 2026): a brkRev 13 Normal run that scores 200
 * through the server replay, every part at its maximum, in breaker-clear-perfect.json's format ({ rev, seed, raw }), for
 * arcade-standard-check's breaker entry once it moves to the dealt stamp (the line is Joe's to approve). The run is the
 * first stored Normal witness of scripts/fixtures/breaker-level-deal-witness.json.gz (the flawless player held to the
 * human limits) whose parts are all full.
 *
 *   bun scripts/breaker-ladder-perfect-record.ts
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { breakerStdParts, BRK_REV_LADDER } from "../src/lib/arcade/breaker";
import { replayBreakerRun } from "../src/lib/duel/breaker";
import { proveBreakerWitness, readBreakerWitnesses } from "./breaker-level-deal";

const normal = readBreakerWitnesses().find((s) => s.level === "normal")!;
for (const w of normal.witnesses) {
  const p = proveBreakerWitness(w.seed, "normal", w.events);
  const run = replayBreakerRun(w.seed, p.raw, BRK_REV_LADDER);
  const parts = breakerStdParts(run.state);
  if (run.flagged || run.score !== 200 || parts.core !== 140 || parts.clear !== 10 || parts.speed !== 20 || parts.gold !== 30) continue;
  writeFileSync("scripts/fixtures/breaker-ladder-perfect.json", JSON.stringify({ rev: BRK_REV_LADDER, seed: w.seed, raw: gzipSync(p.raw).toString("base64") }) + "\n");
  console.log(`recorded seed ${w.seed} (candidate ${w.n}): 200 through the server replay, every part full`);
  process.exit(0);
}
console.log("no full run found");
process.exit(1);
