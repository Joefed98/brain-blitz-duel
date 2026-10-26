/**
 * Scrumper 200-point expansion (snipRev 11, 25 Oct 2026; docs/expansions/x200-snip.md):
 *
 *  1. Old rounds unchanged: 16 snipRev 9 runs recorded on the pre-expansion code
 *     (fixtures/snip-x200-legacy.json.gz) replay through the server path to the identical score and
 *     final state, unflagged; snipRev 1–9 states carry none of the new fields.
 *  2. Rooms deal snipRev 11 (generatePuzzle, the puzzle definition, LIVE_BANDS), 200 is the maximum,
 *     the six-level order draws 2 easy, 2 medium and 2 hard courses.
 *  3. Every course in SNIP_COURSES: every deal (3 pin shifts × 3 wind presets) has a stored
 *     human-paced plan that feeds every fruit, and one that does it at par with both leaves
 *     (fixtures/snip-x200-proofs.json); the golden fruit changes nothing in the physics.
 *  4. A perfect run: the stored best plans on a room seed score 200 through the server replay.
 *  5. Runs recorded on snipRev 11 (fixtures/snip-x200-runs.json.gz, the skill-band bots) replay to
 *     their stored scores, unflagged; no input scores 0; scores stay within 0–200 and the feature
 *     bonus within 0–50.
 *
 *   bun scripts/snip-x200-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  snipFeatureBonus,
  snipGameFor,
  snipLevelOrderX,
  SNIP_COURSES,
  SNIP_REV_EXPAND,
  SNIP_REV_STRICT,
  SNIP_X_LEVELS,
  SNIP_X_MAX,
} from "../src/lib/arcade/snip";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { replaySnipRun } from "../src/lib/duel/snip";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { snipPuzzle } from "../src/puzzles/snip";
import { roomSeed } from "./arcade-skill-bands/games";
import { snipStateDigest, xDeals, xPaced, xPlannedRun, xPlayLevel, type XProofs } from "./snip-x200-lib";

let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond && failures.length < 80) failures.push(label);
};

/* 1. Old rounds. */
const legacy = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/snip-x200-legacy.json.gz")).toString()) as {
  runs: { level: string; n: number; seed: number; rev: number; score: number; digest: string; raw: string }[];
};
ok(legacy.runs.length === 16, `16 snipRev 9 runs (got ${legacy.runs.length})`);
for (const run of legacy.runs) {
  const r = replaySnipRun(run.seed, run.raw, run.rev);
  ok(!r.flagged, `legacy ${run.level} #${run.n}: replays unflagged (${r.reason ?? ""})`);
  ok(r.score === run.score, `legacy ${run.level} #${run.n}: stored ${run.score}, replays ${r.score}`);
  ok(snipStateDigest(r.state) === run.digest, `legacy ${run.level} #${run.n}: final state changed`);
}
for (let rev = 0; rev <= SNIP_REV_STRICT; rev++) {
  const s = snipGameFor(rev === 0 ? undefined : rev).init(roomSeed(3)) as unknown as Record<string, unknown>;
  ok(!("course" in s) && !("fruits" in s) && !("camY" in s), `snipRev ${rev}: no snipRev 11 fields`);
}

/* 2. Dealing. */
ok((generatePuzzle("snip") as { snipRev?: number }).snipRev === SNIP_REV_EXPAND, "rooms deal snipRev 11");
ok((snipPuzzle.generate() as { snipRev?: number }).snipRev === SNIP_REV_EXPAND, "the puzzle definition deals snipRev 11");
ok(LIVE_BANDS.snip.rev === SNIP_REV_EXPAND && (LIVE_BANDS.snip as { bands?: { rev: number } }).bands?.rev === SNIP_REV_STRICT, "LIVE_BANDS: snipRev 11, its score-bands revision 9");
ok(roundMaxFor("snip") === 200 && SNIP_X_MAX === 200, "Scrumper's maximum is 200");
for (let n = 0; n < 40; n++) {
  const order = snipLevelOrderX(roomSeed(n));
  ok(order.length === SNIP_X_LEVELS && new Set(order).size === SNIP_X_LEVELS, `seed #${n}: six distinct courses`);
  ok(JSON.stringify(order.map((t) => SNIP_COURSES[t]!.band)) === "[0,0,1,1,2,2]", `seed #${n}: 2 easy, 2 medium, 2 hard`);
}

/* 3. Every course, every deal. */
const proofs = JSON.parse(readFileSync("scripts/fixtures/snip-x200-proofs.json", "utf8")) as XProofs;
ok(SNIP_COURSES.length >= 30, `at least 30 courses (got ${SNIP_COURSES.length})`);
let deals = 0;
SNIP_COURSES.forEach((course, t) => {
  const p = proofs[String(t)];
  ok(p?.name === course.name, `course ${t} (${course.name}): its proofs are stored`);
  const nums: number[] = [];
  JSON.stringify(course, (_k, v) => (typeof v === "number" && nums.push(v), v));
  ok(nums.every(Number.isInteger), `course ${t}: whole numbers only (the sim is integer)`);
  ok(course.h <= 1400 && course.mouth[1] < course.h, `course ${t}: fits the input range`);
  ok(course.stars.length === 2 && course.winds.length === 3 && course.fruits.length >= 1 && course.fruits.length <= 3, `course ${t}: two leaves, three winds, 1–3 fruits`);
  for (const [wob, wind] of xDeals(course)) {
    const d = p?.deals[`${wob}:${wind}`];
    deals++;
    if (!d) {
      ok(false, `course ${t} deal ${wob}:${wind}: no plan`);
      continue;
    }
    ok(xPaced(d.win), `course ${t} deal ${wob}:${wind}: the win plan keeps human pace`);
    const win = xPlayLevel(t, wob, wind, -1, d.win);
    ok(win.valid && win.all, `course ${t} deal ${wob}:${wind}: the win plan feeds every fruit (${win.fed}/${win.fruits})`);
    // Every fruit the deal may make golden has a perfect plan: every fruit fed, par, both leaves, golden in time.
    const golds = course.golds ?? course.fruits.map((_, k) => k);
    ok(golds.length >= 1 && golds.every((g) => g >= 0 && g < course.fruits.length), `course ${t}: golden fruits listed`);
    for (const g of golds) {
      const plan = d.best[String(g)];
      if (!plan) {
        ok(false, `course ${t} deal ${wob}:${wind}: no perfect plan with fruit ${g} golden`);
        continue;
      }
      ok(xPaced(plan), `course ${t} deal ${wob}:${wind} gold ${g}: keeps human pace`);
      const best = xPlayLevel(t, wob, wind, g, plan);
      ok(best.valid && best.all && best.stars >= 2 && best.strokes <= course.par && best.perfect && best.golden === 1, `course ${t} deal ${wob}:${wind} gold ${g}: a perfect level (${best.fed}/${best.fruits}, ${best.stars} leaves, ${best.strokes}/${course.par} cuts, golden ${best.golden})`);
    }
  }
});

/* 4. A perfect run. */
{
  let found = 0;
  for (let n = 0; n < 12; n++) {
    const seed = roomSeed(n);
    const { raw } = xPlannedRun(seed, proofs, "best");
    const r = replaySnipRun(seed, raw, SNIP_REV_EXPAND);
    // 190–200 on every seed (a slow mix of courses can finish past 48 s and lose a point or two of speed).
    ok(r.score >= 190 && !r.flagged, `room seed #${n}: the stored best plans score ${r.score} through the server replay (190–200 expected)${r.flagged ? ` flagged (${r.reason})` : ""}`);
    if (r.score === 200) found++;
  }
  ok(found >= 10, `a perfect 200 through the server replay on most room seeds (${found} of 12)`);
}

/* 5. Recorded runs and bounds. */
const runs = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/snip-x200-runs.json.gz")).toString()) as { runs: { level: string; n: number; seed: number; score: number; raw: string }[] };
ok(runs.runs.length >= 8, `recorded snipRev 11 runs (got ${runs.runs.length})`);
for (const run of runs.runs) {
  const r = replaySnipRun(run.seed, run.raw, SNIP_REV_EXPAND);
  ok(!r.flagged && r.score === run.score, `snipRev 11 ${run.level} #${run.n}: stored ${run.score}, replays ${r.score}${r.flagged ? ` flagged (${r.reason})` : ""}`);
  ok(r.score >= 0 && r.score <= 200 && snipFeatureBonus(r.state) <= 50, `snipRev 11 ${run.level} #${run.n}: within 0–200`);
}
{
  // (A log with no checkpoints is flagged as a desync; only the score matters here.)
  const error = console.error;
  console.error = () => {};
  const r = replaySnipRun(roomSeed(1), [roomSeed(1), 0, "", 0, ""].join("|"), SNIP_REV_EXPAND);
  console.error = error;
  ok(r.score === 0, `no input scores 0 (got ${r.score})`);
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL snip-x200-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS snip-x200-check: ${checks} checks — 16 snipRev 9 runs unchanged, rooms deal snipRev 11, ${SNIP_COURSES.length} courses × every deal proved (${deals} deals), a perfect 200, ${runs.runs.length} recorded runs`);
