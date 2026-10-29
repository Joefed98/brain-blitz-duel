/**
 * The arcade scoring standard (29 Oct 2026; src/lib/arcade/arcadeStandard.ts, docs/arcade-standard-oct-2026.md).
 * For every game moved onto it (one file per game in scripts/arcade-standard/, `entry`):
 *  1. The parts' maximums (core + features) sum to exactly 200, and every part's maximum is positive.
 *  2. Rooms deal the standard's revision (generatePuzzle), LIVE_BANDS lists it and it is the stamp above `before`.
 *  3. A perfect run scores exactly 200 (replayed oracle logs or built states, per game).
 *  4. Anyone who plays scores at least 1; a run with no input scores 0.
 *  5. The help's SCORE text states every part's label, its maximum and that the parts total 200.
 *  6. stdLine / stdSpeed are straight lines: each step adds the same points (± the floor), full at the full figure.
 *
 *   bun scripts/arcade-standard-check.ts [types…]
 */
import { readdirSync } from "node:fs";
import { stdLine, stdSpecMax, stdSpeed, STD_MAX } from "../src/lib/arcade/arcadeStandard";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import type { PuzzleType } from "../src/lib/duel/types";
import type { StdEntry } from "./arcade-standard/entry";

const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}

/* 6. The shared lines. */
for (const [max, of] of [[150, 90], [140, 10], [130, 7], [30, 20], [20, 6], [15, 4], [10, 8], [8, 16]] as const) {
  ok(stdLine(max, 0, of) === 0 && stdLine(max, of, of) === max && stdLine(max, of + 5, of) === max, `stdLine(${max}, ·, ${of}): 0 at 0, ${max} at ${of} and beyond`);
  for (let g = 1; g <= of; g++) {
    const step = stdLine(max, g, of) - stdLine(max, g - 1, of);
    ok(Math.abs(step - max / of) < 1, `stdLine(${max}, ${g}, ${of}): each step adds about ${(max / of).toFixed(2)} (${step})`);
  }
}
ok(stdSpeed(10, 20, 20, 40) === 10 && stdSpeed(10, 40, 20, 40) === 0 && stdSpeed(10, 30, 20, 40) === 5 && stdSpeed(10, 10, 20, 40) === 10, "stdSpeed: full at the full mark, 0 at the zero mark, even between (time taken)");
ok(stdSpeed(20, 45, 45, 0) === 20 && stdSpeed(20, 0, 45, 0) === 0 && stdSpeed(20, 30, 45, 0) === 13, "stdSpeed: time left");

const dir = new URL("./arcade-standard/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && f !== "entry.ts").sort();
const entries: StdEntry[] = [];
for (const f of files) entries.push(((await import(new URL(f, dir).href)) as { entry: StdEntry }).entry);
ok(entries.length > 0, "at least one game is on the standard");

for (const e of entries) {
  if (only.length && !only.includes(e.type)) continue;
  const t = e.type;
  /* 1. */
  ok(stdSpecMax(e.spec) === STD_MAX, `${t}: the parts' maximums sum to ${STD_MAX} (${stdSpecMax(e.spec)})`);
  ok([e.spec.core, ...e.spec.features].every((p) => p.max > 0 && p.of > 0), `${t}: every part has a positive maximum and item count`);
  ok(new Set(e.spec.features.map((f) => f.key)).size === e.spec.features.length, `${t}: feature keys are unique`);
  /* 2. */
  const dealt = (generatePuzzle(t as PuzzleType) as unknown as Record<string, unknown>)[e.field];
  ok(dealt === e.rev, `${t}: rooms deal ${e.field} ${e.rev} (got ${String(dealt)})`);
  ok(e.rev === e.before + 1, `${t}: ${e.field} ${e.rev} is one above the stamp dealt before it (${e.before})`);
  const live = (LIVE_BANDS as Record<string, { field: string; rev: number }>)[t];
  ok(live?.field === e.field && live.rev === e.rev, `${t}: LIVE_BANDS lists ${e.field} ${e.rev}`);
  /* 3. */
  const perfect = await e.perfect();
  ok(perfect.length > 0, `${t}: at least one perfect run`);
  for (const r of perfect) ok(r.score === STD_MAX, `${t}: perfect run ${r.label} scores ${STD_MAX} (${r.score})`);
  /* 4. */
  const played = await e.played();
  ok(played.length > 0, `${t}: at least one played run that earned nothing`);
  for (const r of played) ok(r.score >= 1, `${t}: ${r.label} played and scores at least 1 (${r.score})`);
  for (const r of await e.idle()) ok(r.score === 0, `${t}: ${r.label} had no input and scores 0 (${r.score})`);
  /* 5. */
  const help = PUZZLE_INSTRUCTIONS[t as PuzzleType]?.score ?? "";
  ok(help.includes(`total ${STD_MAX}`), `${t}: the help says the parts total ${STD_MAX}: ${help}`);
  for (const p of [e.spec.core, ...e.spec.features]) ok(help.includes(String(p.max)), `${t}: the help states ${p.label}'s maximum ${p.max}`);
  for (const f of e.spec.features) ok(help.includes(f.label), `${t}: the help names ${f.label}`);
  for (const term of e.helpTerms ?? []) ok(help.includes(term), `${t}: the help says "${term}"`);
  console.log(`  ${t}: ${e.field} ${e.rev} · ${e.spec.core.label} ${e.spec.core.max} (full at ${e.spec.core.of}) + ${e.spec.features.map((f) => `${f.label} ${f.max}`).join(" + ")} = ${stdSpecMax(e.spec)}`);
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} arcade standard checks`);
  process.exit(1);
}
console.log(`PASS: ${checks} arcade standard checks — ${entries.length} game(s) score core + features = ${STD_MAX}, a perfect run 200, any played run at least 1`);
