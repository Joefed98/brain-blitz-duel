/**
 * The scoring standard (docs/scoring-standard.md): every puzzle dealt before it grades exactly as before. Regrades the
 * 5,400 cases recorded on main 158fd83 (scripts/standard-legacy-record.ts: the 45 games' room and live deals, kit
 * answers from nothing to near-perfect) and fails on any difference in score, verdict or stored extra.
 *
 *   bun scripts/standard-legacy-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { isDeepStrictEqual } from "node:util";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { usesStandard } from "../src/lib/duel/standard/stamps";
import type { LegacyCase } from "./standard-legacy-record";

const cases = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/standard-legacy.json.gz")).toString()) as LegacyCase[];
/** Drops wall-clock figures (engine replays store how long they took: `replayMs`). */
function steady(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value ?? null), (k, v) => (k === "replayMs" ? undefined : v));
}
let fail = 0;
let checked = 0;
for (const c of cases) {
  if (usesStandard(c.puzzle)) {
    fail++;
    console.log(`FAIL ${c.type}: a recorded puzzle reads as a standard stamp`);
    continue;
  }
  const g = gradeAnswer(c.puzzle, c.answer, c.ms);
  checked++;
  const same = g.score === c.score && g.isCorrect === c.isCorrect && isDeepStrictEqual(steady(g.extra), steady(c.extra));
  if (!same && fail++ < 20) console.log(`FAIL ${c.type}: ${c.score} → ${g.score} (${c.isCorrect} → ${g.isCorrect})`);
}
console.log(`${checked} legacy cases regraded, ${fail} differ`);
if (fail > 0) {
  console.log("FAIL standard-legacy-check");
  process.exit(1);
}
console.log("PASS standard-legacy-check");
