/**
 * The arcade scoring standard (src/lib/arcade/arcadeStandard.ts, docs/arcade-standard.md), batch B: High Rise, Swish,
 * Flightpath, Pinball, Rally, Coral Pop and Tempo. For every game on it:
 *
 *  1. its spec's parts (core first) have maximums summing to exactly 200, and rooms deal the spec's revision
 *     (generatePuzzle, LIVE_BANDS);
 *  2. a run that earned every part in full scores exactly 200, every part at its maximum, the parts the spec's;
 *  3. a run that played but earned nothing scores 1, a run with no input 0;
 *  4. the core is a straight line: `max × value ÷ fullAt` rounded down for every value up to its full-at figure, full
 *     beyond it (no curve, knots or rising scale);
 *  5. a state on the revision before the standard has no standard parts (older rounds score as before);
 *  6. the game's own assertions (feature amounts, mistakes, gameplay changes).
 *
 *   bun scripts/arcade-standard-check.ts [types…]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ARCADE_STANDARD } from "../src/lib/arcade/standard";
import { STD_TOTAL, stdMaxSum, stdSum } from "../src/lib/arcade/arcadeStandard";
import { LIVE_BANDS, type LiveBand } from "../src/lib/arcade/liveBands";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import type { PuzzleType } from "../src/lib/duel/types";
import type { StdCase } from "./arcade-standard/case";
import { stdCase as skyline } from "./arcade-standard/skyline";
import { stdCase as bintoss } from "./arcade-standard/bintoss";
import { stdCase as bullseye } from "./arcade-standard/bullseye";
import { stdCase as pinball } from "./arcade-standard/pinball";
import { stdCase as rally } from "./arcade-standard/rally";
import { stdCase as bubble } from "./arcade-standard/bubble";
import { stdCase as beat } from "./arcade-standard/beat";

const CASES: Record<string, StdCase | null> = { skyline, bintoss, bullseye, pinball, rally, bubble, beat };
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith("--"));

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}

const summary: string[] = [];
for (const [type, entry] of Object.entries(ARCADE_STANDARD)) {
  if (ONLY.length && !ONLY.includes(type)) continue;
  const c = CASES[type];
  const spec = entry.spec;
  ok(spec !== null, `${type}: no standard spec`);
  ok(c !== null && c !== undefined, `${type}: no arcade-standard-check case`);
  if (!spec || !c) continue;

  /* 1. The spec. */
  ok(stdMaxSum(spec.parts) === STD_TOTAL, `${type}: the parts' maximums sum to ${stdMaxSum(spec.parts)}, not ${STD_TOTAL}`);
  ok(spec.parts[0]?.key === "core", `${type}: the first part is the core`);
  ok(new Set(spec.parts.map((p) => p.key)).size === spec.parts.length, `${type}: part keys are unique`);
  ok(spec.parts.every((p) => Number.isInteger(p.max) && p.max > 0), `${type}: every maximum is a positive whole number`);
  const dealt = (generatePuzzle(type as PuzzleType) as unknown as Record<string, unknown>)[spec.field];
  ok(dealt === spec.rev, `${type}: rooms deal ${spec.field} ${String(dealt)}, the standard is ${spec.rev}`);
  const live = (LIVE_BANDS as Record<string, LiveBand>)[type];
  ok(live?.rev === spec.rev && live?.std === spec, `${type}: LIVE_BANDS lists the standard revision and spec`);
  ok(roundMaxFor(type as PuzzleType) === STD_TOTAL, `${type}: ROUND_MAX is ${STD_TOTAL}`);

  /* 2. A perfect run. */
  const perfect = c.perfect();
  const pParts = entry.parts(perfect);
  ok(pParts !== null, `${type}: a perfect state has standard parts`);
  if (pParts) {
    ok(JSON.stringify(pParts.map((p) => [p.key, p.max])) === JSON.stringify(spec.parts.map((p) => [p.key, p.max])), `${type}: the parts are the spec's, in order`);
    for (const p of pParts) ok(p.points === p.max, `${type}: perfect run's ${p.key} is ${p.points} of ${p.max}`);
    ok(stdSum(pParts) === STD_TOTAL, `${type}: perfect parts sum to ${stdSum(pParts)}`);
  }
  ok(c.game.score(perfect) === STD_TOTAL, `${type}: a perfect run scores ${c.game.score(perfect)}, not ${STD_TOTAL}`);

  /* 3. Played but earned nothing; no input. */
  ok(c.game.score(c.idle()) === 1, `${type}: a run that played and earned nothing scores ${c.game.score(c.idle())}, not 1`);
  const untouched = c.game.init(12345);
  ok(c.game.score(untouched) === 0, `${type}: a run with no input scores ${c.game.score(untouched)}, not 0`);

  /* 4. The core's straight line. */
  const coreMax = spec.parts[0]!.max;
  let lineOk = true;
  for (let v = 0; v <= c.fullAt + 3; v++) {
    const parts = entry.parts(c.core(v));
    const core = parts?.find((p) => p.key === "core");
    const want = Math.floor((coreMax * Math.min(v, c.fullAt)) / c.fullAt);
    if (!core || core.points !== want) {
      lineOk = false;
      failures.push(`${type}: core at ${v} is ${core?.points ?? "missing"}, the straight line gives ${want}`);
      break;
    }
    // A finish part (c.finishParts) comes with a full core: 0 below fullAt, allowed from it on.
    const finish = new Set(c.finishParts ?? []);
    const features = parts!.filter((p) => p.key !== "core" && (v < c.fullAt || !finish.has(p.key))).reduce((t, p) => t + p.points, 0);
    if (features !== 0) {
      lineOk = false;
      failures.push(`${type}: a core-only state at ${v} earned ${features} feature points`);
      break;
    }
  }
  ok(lineOk, `${type}: the core is a straight line to ${coreMax} at ${c.fullAt}`);

  /* 5. Older revisions. */
  ok(entry.parts(c.older()) === null, `${type}: a state on the revision before the standard has standard parts`);

  /* 6. The game's own. */
  await c.extra?.(ok);
  summary.push(`${type} ${spec.field} ${spec.rev}: ${spec.parts.map((p) => `${p.key} ${p.max}`).join(" + ")} = ${stdMaxSum(spec.parts)} (core full at ${c.fullAt})`);
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} arcade scoring standard checks`);
  process.exit(1);
}
console.log(`PASS: ${checks} arcade scoring standard checks — ${summary.join("; ")}`);
