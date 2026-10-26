/**
 * D5 remodels, legacy identity (25 Oct 2026; docs/depth/d5-remodels.md). Every stored shape of Topsy-Turvy
 * (gravityRev absent / 1 / 2) and Jumbled (tilesRev 1 / 2) under score revs 0–3, with empty, spam, solver and
 * part-played answers, was graded on unmodified main (scripts/d5-remodels-legacy-record.ts) into
 * scripts/fixtures/d5-remodels-legacy.json.gz. This check grades every entry again on today's code and fails on
 * any difference in score, verdict, counts, stored time or stored extra.
 *
 *   bun scripts/d5-remodels-legacy-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { D5_LEGACY_FIXTURE } from "./d5-remodels-legacy-record";
import { stableExtra, type LegacyCase } from "./puzzle-score-legacy-record";

const fixture = JSON.parse(gunzipSync(readFileSync(D5_LEGACY_FIXTURE)).toString("utf8")) as { recordedOn: string; cases: LegacyCase[] };
const failures: string[] = [];
let entries = 0;
for (const c of fixture.cases) {
  for (const e of c.entries) {
    entries++;
    const g = gradeAnswer(c.puzzle, e.answer, e.ms);
    const same =
      g.score === e.score &&
      g.isCorrect === e.isCorrect &&
      g.correctCount === e.correctCount &&
      g.errors === e.errors &&
      g.storedMs === e.storedMs &&
      stableExtra(g.extra) === e.extra;
    if (!same && failures.length < 20) failures.push(`${c.type} ${c.label} "${e.answer.slice(0, 40)}" @${e.ms}: ${e.score} → ${g.score}`);
  }
}
const shapes = new Set(fixture.cases.map((c) => `${c.type}:${c.label.split(":")[1]}`));
console.log(`d5-remodels-legacy-check: ${fixture.cases.length} stored puzzles (${shapes.size} shapes), ${entries} answers, recorded on ${fixture.recordedOn}`);
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL d5-remodels-legacy-check: ${failures.length} answers grade differently`);
  process.exit(1);
}
console.log("PASS d5-remodels-legacy-check: every stored Topsy-Turvy and Jumbled answer grades exactly as on main");
