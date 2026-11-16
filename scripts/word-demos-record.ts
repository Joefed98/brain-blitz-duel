/**
 * Records scripts/fixtures/word-demos.json: the nine Word games' intro-demo runs (scripts/word-demos-lib.ts). Re-run after
 * a Word stamp changes, then word-demos-check. Writes nothing anywhere else (no database).
 *
 *   bun scripts/word-demos-record.ts
 */
import { writeFileSync } from "node:fs";
import { WORD_DEMO_LEVEL, WORD_DEMO_TYPES, playWordDemo } from "./word-demos-lib";

const runs = WORD_DEMO_TYPES.map((type) => playWordDemo(type));
writeFileSync(new URL("./fixtures/word-demos.json", import.meta.url), `{"level":${JSON.stringify(WORD_DEMO_LEVEL)},"runs":[\n${runs.map((r) => JSON.stringify(r)).join(",\n")}\n]}\n`);
for (const r of runs) console.log(`${r.type.padEnd(12)} ${String(r.score).padStart(3)} ${r.isCorrect ? "finished" : "unfinished"} in ${r.seconds.toFixed(1)} s  ${JSON.stringify(r.stamps)}`);
