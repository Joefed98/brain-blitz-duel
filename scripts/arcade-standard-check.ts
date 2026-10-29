/**
 * arcade-standard-check (29 Oct 2026, the arcade scoring standard, batch A; docs/arcade-standard-oct-2026/).
 *
 * Every game on the arcade scoring standard has a module in scripts/arcade-standard/<type>.ts naming its stamp and its
 * parts (core and features, each with a maximum). For each game this proves:
 *   1. the parts' maximums sum to exactly 200 (the game's round maximum, ROUND_MAX), each a positive whole number;
 *   2. the stamp is the one rooms deal today (LIVE_BANDS);
 *   3. a perfect run, scored through the game's real scoring path, scores 200 with every part at its maximum.
 * Each game's own `<game>-standard-check` proves its rules; this check holds the shared sum.
 *
 *   bun scripts/arcade-standard-check.ts
 */
import { readdirSync } from "node:fs";

import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import type { PuzzleType } from "../src/lib/duel/types";

interface StandardPart {
  key: string;
  label: string;
  max: number;
}
interface StandardGame {
  id: string;
  stampKey: string;
  stamp: number;
  parts: StandardPart[];
  perfect(): { score: number; parts: Record<string, number> };
}

/** The games batch A put on the standard; a module missing for one of them fails. */
const BATCH_A = ["slice", "breaker", "tilt", "burst", "matchup", "snake", "hover"];

const failures: string[] = [];
let passes = 0;
function ok(cond: boolean, message: string): void {
  if (cond) passes++;
  else failures.push(message);
}

const dir = new URL("./arcade-standard/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".ts")).sort();
const seen = new Set<string>();
for (const file of files) {
  const mod = (await import(new URL(file, dir).href)) as { STANDARD: StandardGame };
  const g = mod.STANDARD;
  ok(!!g && file === `${g.id}.ts`, `${file}: exports STANDARD for its own game`);
  if (!g) continue;
  seen.add(g.id);
  const sum = g.parts.reduce((s, p) => s + p.max, 0);
  ok(sum === 200, `${g.id}: the parts' maximums sum to 200 (got ${sum})`);
  ok(roundMaxFor(g.id as PuzzleType) === 200, `${g.id}: the round maximum is 200`);
  ok(g.parts.every((p) => Number.isInteger(p.max) && p.max > 0), `${g.id}: every part's maximum is a positive whole number`);
  ok(new Set(g.parts.map((p) => p.key)).size === g.parts.length, `${g.id}: part keys are unique`);
  const live = (LIVE_BANDS as Record<string, { field: string; rev: number }>)[g.id];
  ok(!!live && live.field === g.stampKey && live.rev === g.stamp, `${g.id}: rooms deal ${g.stampKey} ${g.stamp} (LIVE_BANDS has ${live?.field} ${live?.rev})`);
  const t0 = Date.now();
  const run = g.perfect();
  ok(run.score === 200, `${g.id}: a perfect run scores 200 (got ${run.score})`);
  for (const p of g.parts) {
    ok(run.parts[p.key] === p.max, `${g.id}: a perfect run's ${p.key} is its maximum ${p.max} (got ${run.parts[p.key]})`);
  }
  console.log(`  ${g.id} ${g.stampKey} ${g.stamp}: ${g.parts.map((p) => `${p.key} ${p.max}`).join(" + ")} = ${sum}; perfect ${run.score} (${Date.now() - t0} ms)`);
}
for (const id of BATCH_A) ok(seen.has(id), `${id}: has a module in scripts/arcade-standard/`);

if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL arcade-standard-check: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS arcade-standard-check: ${passes} checks — ${seen.size} games' parts sum to 200 and a perfect run scores 200 with every part at its maximum`);
