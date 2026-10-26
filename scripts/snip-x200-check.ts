/**
 * Scrumper's 200-point expansion (snipRev 11, 26 Oct 2026; docs/expansions/x200-snip.md):
 *
 *  1. Old rounds unchanged: 16 snipRev 9 runs recorded on main before the expansion
 *     (fixtures/snip-x200-legacy.json.gz) replay through the server path to the identical score and final
 *     state, unflagged; snipRev 1–9 states (and a round stamped with the never-dealt parked 10) carry none
 *     of the new fields.
 *  2. Rooms deal snipRev 11 (generatePuzzle, the puzzle definition, LIVE_BANDS with strictRev 9), 200 is
 *     the maximum, the six-level order draws 2 easy, 2 medium and 2 hard courses.
 *  3. Every course in SNIP_COURSES, every deal (3 pin shifts × 3 wind presets) and every golden choice:
 *     a stored human-paced plan that feeds every fruit, and a perfect one (every fruit at par cuts, both
 *     leaves, the golden fruit while golden) that ends inside the full par-time credit; each course's par
 *     time is exactly its slowest deal's perfect plan plus SNIP_X_PAR_MARGIN (course data only).
 *  4. The ceiling: on every possible deal of the bank, perfect play scores 200. Proved from the counts
 *     (every level offers the full units, par cuts, a second leaf and full par-time credit; three golden
 *     apples a run; the slowest six-course run of perfect plans the bank can deal finishes inside the
 *     full speed bonus), and witnessed through the server replay on the 60 tuning seeds (room seed indices
 *     0–59) and the 200 fresh ones (10000–10199): the stored perfect plans score 200 on every one.
 *  5. The par time's rules on real levels: full credit on the perfect plan, less when it is played late,
 *     none past par time or off par cuts, never more than the margin; the score's caps (base ≤ 150,
 *     skill ≤ 50, total ≤ 200).
 *  6. Recorded snipRev 11 runs (fixtures/snip-x200-runs.json.gz, the skill-band bots and a perfect run)
 *     replay to their stored scores; no input scores 0; random play stays near 0.
 *
 *   bun scripts/snip-x200-check.ts        (~40 s)
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  snipCourseParts,
  snipFeatureBonus,
  snipFeatureRaw,
  snipGameFor,
  snipLevelOrderX,
  SNIP_COURSES,
  SNIP_REV_EXPAND,
  SNIP_REV_STRICT,
  SNIP_RUN_TICKS,
  SNIP_V11_BAND_CURVE,
  SNIP_X_FEATURE_MAX,
  SNIP_X_FINISH_MIN,
  SNIP_X_GOLD_LEVELS,
  SNIP_X_LEVELS,
  SNIP_X_MAX,
  SNIP_X_PAR_MARGIN,
  SNIP_X_RAW_TOP,
  SNIP_X_SKILL_PAY,
  SNIP_X_UNITS_TOP,
  type SnipState,
} from "../src/lib/arcade/snip";
import { LIVE_BANDS, liveStrictRev } from "../src/lib/arcade/liveBands";
import { bandPoints } from "../src/lib/arcade/scoreBands";
import { replaySnipRun } from "../src/lib/duel/snip";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { snipPuzzle } from "../src/puzzles/snip";
import { Human } from "./arcade-skill-bands/human";
import { randomBot } from "./arcade-skill-bands/bots/snip";
import { roomSeed } from "./arcade-skill-bands/games";
import { snipStateDigest, xDeals, xPaced, xPlannedRun, xPlayLevel, xStrokes, type XPlan, type XProofs } from "./snip-x200-lib";

let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond && failures.length < 80) failures.push(label);
};
const t0 = performance.now();

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
for (let rev = 0; rev <= SNIP_REV_STRICT + 1; rev++) {
  const s = snipGameFor(rev === 0 ? undefined : rev).init(roomSeed(3)) as unknown as Record<string, unknown>;
  ok(!("course" in s) && !("fruits" in s) && !("camY" in s) && !("quickTicks" in s), `snipRev ${rev}: no snipRev 11 fields`);
}
// The parked stamp (10) was never dealt: a round stamped with it would play as snipGameFor's unstamped default, as on main.
ok(snipGameFor(SNIP_REV_EXPAND - 1) === snipGameFor(undefined), "snipRev 10 (never dealt) plays as on main");

/* 2. Dealing. */
ok((generatePuzzle("snip") as { snipRev?: number }).snipRev === SNIP_REV_EXPAND, "rooms deal snipRev 11");
ok((snipPuzzle.generate() as { snipRev?: number }).snipRev === SNIP_REV_EXPAND, "the puzzle definition deals snipRev 11");
ok(LIVE_BANDS.snip.rev === SNIP_REV_EXPAND && liveStrictRev("snip") === SNIP_REV_STRICT && LIVE_BANDS.snip.curve === SNIP_V11_BAND_CURVE, "LIVE_BANDS: snipRev 11 on its curve, strictRev 9");
ok(roundMaxFor("snip") === 200 && SNIP_X_MAX === 200, "Scrumper's maximum is 200");
for (let n = 0; n < 40; n++) {
  const order = snipLevelOrderX(roomSeed(n));
  ok(order.length === SNIP_X_LEVELS && new Set(order).size === SNIP_X_LEVELS, `seed #${n}: six distinct courses`);
  ok(JSON.stringify(order.map((t) => SNIP_COURSES[t]!.band)) === "[0,0,1,1,2,2]", `seed #${n}: 2 easy, 2 medium, 2 hard`);
}

/* 3. Every course, every deal, every golden choice. */
const proofs = JSON.parse(readFileSync("scripts/fixtures/snip-x200-proofs.json", "utf8")) as XProofs;
ok(SNIP_COURSES.length >= 30, `at least 30 courses (got ${SNIP_COURSES.length})`);
let deals = 0;
/** Per course: the slowest perfect plan's level tick with no golden fruit, and with one. */
const slowest: { plain: number; gold: number }[] = [];
SNIP_COURSES.forEach((course, t) => {
  const p = proofs[String(t)];
  ok(p?.name === course.name, `course ${t} (${course.name}): its proofs are stored`);
  const nums: number[] = [];
  JSON.stringify(course, (_k, v) => (typeof v === "number" && nums.push(v), v));
  ok(nums.every(Number.isInteger), `course ${t}: whole numbers only (the sim is integer)`);
  ok(course.h <= 1400 && course.mouth[1] < course.h, `course ${t}: fits the input range`);
  ok(course.stars.length === 2 && course.winds.length === 3 && course.fruits.length >= 1 && course.fruits.length <= 3, `course ${t}: two leaves, three winds, 1–3 fruits`);
  const golds = course.golds ?? course.fruits.map((_, k) => k);
  ok(golds.length >= 1 && golds.every((g) => g >= 0 && g < course.fruits.length), `course ${t}: golden fruits listed`);
  const worst = { plain: 0, gold: 0 };
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
    for (const g of [-1, ...golds]) {
      const plan: XPlan | undefined = d.best[String(g)];
      if (!plan) {
        ok(false, `course ${t} deal ${wob}:${wind}: no perfect plan for golden choice ${g}`);
        continue;
      }
      ok(xPaced(plan) && xStrokes(plan) <= course.par, `course ${t} deal ${wob}:${wind} gold ${g}: keeps human pace, at most par strokes`);
      const best = xPlayLevel(t, wob, wind, g, plan);
      const goldOk = g < 0 || (best.golden === 1 && best.fedAt[g]! >= 0);
      ok(best.valid && best.all && best.stars >= 2 && best.strokes <= course.par && best.perfect && goldOk, `course ${t} deal ${wob}:${wind} gold ${g}: a perfect level (${best.fed}/${best.fruits}, ${best.stars} leaves, ${best.strokes}/${course.par} cuts, golden ${best.golden})`);
      ok(best.tick + SNIP_X_PAR_MARGIN <= course.parT, `course ${t} deal ${wob}:${wind} gold ${g}: the perfect plan earns full par-time credit (ends ${best.tick}, par ${course.parT})`);
      if (g < 0) worst.plain = Math.max(worst.plain, best.tick);
      else worst.gold = Math.max(worst.gold, best.tick);
    }
  }
  ok(course.parT === Math.max(worst.plain, worst.gold) + SNIP_X_PAR_MARGIN, `course ${t}: par time ${course.parT} = its slowest perfect plan ${Math.max(worst.plain, worst.gold)} + ${SNIP_X_PAR_MARGIN}`);
  slowest.push(worst);
});

/* 4. The ceiling. */
{
  // (a) From the counts: a perfect level is 18 + 2 units, par cuts, a second leaf and the full par-time
  // credit; three golden apples a run; then the skill raw is at its top and the units at theirs.
  const perfect = {
    units: SNIP_X_UNITS_TOP,
    golden: SNIP_X_GOLD_LEVELS.length,
    parLevels: SNIP_X_LEVELS,
    stars2: SNIP_X_LEVELS,
    perfect: SNIP_X_LEVELS,
    quickTicks: SNIP_X_LEVELS * SNIP_X_PAR_MARGIN,
  } as unknown as SnipState;
  ok(snipFeatureRaw(perfect) === SNIP_X_RAW_TOP && bandPoints(SNIP_X_SKILL_PAY, SNIP_X_RAW_TOP) === SNIP_X_FEATURE_MAX, `a perfect run's skill raw is the top (${snipFeatureRaw(perfect)}) and pays ${SNIP_X_FEATURE_MAX}`);
  ok(bandPoints(SNIP_V11_BAND_CURVE, SNIP_X_UNITS_TOP) === 140, "every fruit and a leaf on all six levels is 140 base points");
  // (b) The slowest run of perfect plans the bank can deal: levels 1, 3 and 5 (0-based) are golden, each band's two
  // courses distinct; the full speed bonus needs the finish by the run's end less half the speed window.
  const fullBy = SNIP_RUN_TICKS - (SNIP_RUN_TICKS - SNIP_X_FINISH_MIN) / 2;
  let worstRun = 0;
  for (const band of [0, 1, 2]) {
    const cs = SNIP_COURSES.map((c, i) => (c.band === band ? i : -1)).filter((i) => i >= 0);
    let w = 0;
    for (const a of cs) for (const b of cs) if (a !== b) w = Math.max(w, slowest[a]!.plain + slowest[b]!.gold);
    worstRun += w;
  }
  ok(worstRun <= fullBy, `the slowest bank deal of perfect plans finishes at tick ${worstRun}, inside the full speed bonus (by ${fullBy})`);
  // (c) Witnesses through the server replay: the tuning seeds and the fresh seeds.
  const sets = [
    { name: "tuning", from: 0, n: 60 },
    { name: "fresh", from: 10000, n: 200 },
  ];
  for (const set of sets) {
    let lowest = Infinity;
    for (let i = set.from; i < set.from + set.n; i++) {
      const seed = roomSeed(i);
      const { raw } = xPlannedRun(seed, proofs, "best");
      const r = replaySnipRun(seed, raw, SNIP_REV_EXPAND);
      lowest = Math.min(lowest, r.flagged ? -1 : r.score);
    }
    ok(lowest === 200, `${set.name} seeds ${set.from}–${set.from + set.n - 1}: the stored perfect plans score 200 on every one through the server replay (lowest ${lowest})`);
    console.log(`  ceiling, ${set.name} seeds (${set.n}): lowest ${lowest}`);
  }
}

/* 5. Par time and caps on real levels. */
{
  let probed = 0;
  for (const t of [0, 12, 23, 35]) {
    const course = SNIP_COURSES[t]!;
    const golds = course.golds ?? course.fruits.map((_, k) => k);
    const d = proofs[String(t)]!.deals["0:1"]!;
    const plan = d.best["-1"]!;
    const quickOf = (p: XPlan) => {
      const play = xPlayLevel(t, 0, 1, -1, p);
      // The sim's own credit, against the rule read independently: ticks under par time, capped, par levels only.
      ok(play.quick === (play.par ? Math.max(0, Math.min(SNIP_X_PAR_MARGIN, course.parT - play.tick)) : 0), `course ${t}: the sim credits ${play.quick} par-time ticks for a level ended at ${play.tick} (par ${course.parT}, par cuts ${play.par})`);
      return { play, quick: play.quick };
    };
    const base = quickOf(plan);
    ok(base.quick === SNIP_X_PAR_MARGIN, `course ${t}: the perfect plan earns the full ${SNIP_X_PAR_MARGIN} ticks of par-time credit`);
    // The same plan shifted later: fed later (if at all) means less credit, never more.
    for (const late of [20, 45, 90]) {
      const p = plan.map(([r, at]) => [r, at + late] as [number, number]);
      const q = quickOf(p);
      ok(q.quick <= base.quick, `course ${t}: ${late} ticks late earns no more (${q.quick})`);
      probed++;
    }
    void golds;
  }
  ok(probed >= 12, "par time probed on four courses");
  // A wasted swipe takes a par-1 level off par cuts: fed as before, but no par-time credit (quick and clean only).
  for (const t of SNIP_COURSES.map((c, i) => (c.par === 1 ? i : -1)).filter((i) => i >= 0).slice(0, 4)) {
    const plan = proofs[String(t)]!.deals["0:0"]!.best["-1"]!;
    const clean = xPlayLevel(t, 0, 0, -1, plan);
    const wasted = xPlayLevel(t, 0, 0, -1, plan, false, plan[0]![1] - 20);
    ok(clean.quick === SNIP_X_PAR_MARGIN && wasted.all && wasted.strokes === 2 && !wasted.par && wasted.quick === 0, `course ${t}: a wasted swipe costs the par-time credit (${clean.quick} → ${wasted.quick}, ${wasted.strokes} cuts)`);
  }
  // Through the sim's own counters: a level fed off par cuts earns no par-time credit; credit per level ≤ margin.
  for (let n = 0; n < 4; n++) {
    const seed = roomSeed(n);
    const { state } = xPlannedRun(seed, proofs, "win");
    ok((state.quickTicks ?? 0) <= (state.quickLevels ?? 0) * SNIP_X_PAR_MARGIN && (state.quickLevels ?? 0) <= (state.parLevels ?? 0), `seed #${n}: par-time credit only on par levels, at most the margin each`);
    const parts = snipCourseParts(state);
    ok(parts.points <= 140 && parts.bonus - snipFeatureBonus(state) <= 10 && snipFeatureBonus(state) <= SNIP_X_FEATURE_MAX, `seed #${n}: base ≤ 150 and skill ≤ 50`);
  }
}

/* 6. Recorded runs and bounds. */
const runs = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/snip-x200-runs.json.gz")).toString()) as { runs: { level: string; n: number; seed: number; score: number; raw: string }[] };
ok(runs.runs.length >= 12, `recorded snipRev 11 runs (got ${runs.runs.length})`);
ok(runs.runs.some((r) => r.score === 200), "a recorded run reaches 200");
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
  const game = snipGameFor(SNIP_REV_EXPAND);
  const scores: number[] = [];
  for (let n = 0; n < 20; n++) {
    const seed = roomSeed(n);
    const { state } = randomBot({ game, seed, human: new Human("snip", seed, "weak") } as never);
    scores.push(game.score(state as never));
  }
  scores.sort((a, b) => a - b);
  ok(scores[10]! <= 15 && scores[19]! <= 60, `random play stays near 0 (median ${scores[10]}, max ${scores[19]})`);
  console.log(`  random play, 20 seeds: median ${scores[10]}, max ${scores[19]}`);
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL snip-x200-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS snip-x200-check: ${checks} checks in ${((performance.now() - t0) / 1000).toFixed(0)} s — 16 snipRev 9 runs unchanged, rooms deal snipRev 11, ${SNIP_COURSES.length} courses × every deal and golden choice proved (${deals} deals), 200 on all 260 tuning and fresh seeds, ${runs.runs.length} recorded runs`);
