/**
 * Roofbound flipRev 8 (expansion E7, 26 Oct 2026; docs/expansions/x200-flip.md): proves
 *   1. every recorded run on the revisions before it (unstamped, 2, 4 and 6; scripts/fixtures/flip-legacy-runs.json.gz,
 *      recorded on the tree before the expansion) replays to its stored score and final checkpoint, and earlier states
 *      never carry an expansion field; a round stamped 7 (the parked stamp, never dealt) plays as flipRev 6;
 *   2. rooms deal flipRev 8 (LIVE_BANDS keeps flipRev 6 as its strict revision), the stamp gates the taller 730 px
 *      world and every new rule;
 *   3. the course: three cave heights (flips of 9 to 16 ticks), two speed zones, moving spikes, four trails, ten gold
 *      stars and eight sweet spots, built the same every time;
 *   4. the guarantee (the arcade rule): on every tuning and fresh seed (260) the course carries the full set of
 *      opportunities, all on one route the builder proved, so the perfect-play ceiling is 200 (base 150 at 150 units,
 *      skill 50 at FLIP_V8_SKILL_FULL raw); a stored planned route on each of those seeds scores exactly 200 through
 *      the server's encode + replay;
 *   5. sweet spots: a sweet landing is exactly the tick a flip ends with the runner's centre inside an untaken strip on
 *      its surface (every landing of every stored run checked), each counts once, standing or running over one never
 *      counts;
 *   6. scoring: base ≤ 150, skill ≤ 50 on the rising scale, total ≤ 200; no input and random play score near 0;
 *      checkpoint saves (the saved-crash rule kept from the parked expansion);
 *   7. stored flipRev 8 runs replay to their stored score and checkpoint (scripts/fixtures/flip-x200-runs.json.gz);
 *   8. the texts: intro HOW in three lines, the SCORE line states 200, the "?" help explains every feature.
 *
 *   bun scripts/flip-x200-check.ts        (~1 min)
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  bandPoints,
} from "../src/lib/arcade/scoreBands";
import {
  flipBandParts,
  flipCheckpoint,
  flipCourseV8,
  flipGameFor,
  flipStarsTaken,
  flipSweetLanding,
  flipSweetsTaken,
  flipTrailStars,
  flipV8Arc,
  flipV8Features,
  flipV8HeightAt,
  flipV8Opportunities,
  flipV8Units,
  flipWorldHFor,
  FLIP_REV_EXPAND,
  FLIP_REV_STRICT,
  FLIP_RUN_TICKS,
  FLIP_STARS,
  FLIP_V8_BAND_CURVE,
  FLIP_V8_CHECKPOINTS,
  FLIP_V8_FEATURE_CAP,
  FLIP_V8_H_NORMAL,
  FLIP_V8_H_TALL,
  FLIP_V8_H_TIGHT,
  FLIP_V8_SAVE_PAUSE,
  FLIP_V8_SHIELD_TICKS,
  FLIP_V8_SKILL_FULL,
  FLIP_V8_SKILL_PAY,
  FLIP_V8_SWEETS,
  FLIP_V8_SWEET_TICKS,
  FLIP_V8_TRAILS,
  FLIP_V8_WORLD_H,
  FLIP_WORLD_H,
  type FlipState,
} from "../src/lib/arcade/flip";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { decodeFlipRun, replayFlipRun } from "../src/lib/duel/flip";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { LIVE_BANDS, liveStrictRev } from "../src/lib/arcade/liveBands";
import { randomBot } from "./arcade-skill-bands/bots/flip";
import { Human } from "./arcade-skill-bands/human";
import {
  encodeFlipLog,
  FLIP_FRESH_SEEDS,
  FLIP_LEGACY_FIXTURE,
  FLIP_RUNS_FIXTURE,
  FLIP_TUNING_SEEDS,
  FLIP_WITNESS_FIXTURE,
  type FlipLegacyRun,
  type FlipWitness,
} from "./flip-x200-record";
import { flipTap as TAP } from "./flip-x200-plan";

let checks = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const t0 = performance.now();
const EXPANSION_FIELDS = ["exp", "v8", "v7", "arcN", "trailGot", "saves", "comboPts", "lost", "sweetGot", "sweetT"] as const;
const gz = <T>(url: URL): T => JSON.parse(gunzipSync(readFileSync(url)).toString()) as T;

/* 1. Legacy runs. */
{
  const runs = gz<FlipLegacyRun[]>(FLIP_LEGACY_FIXTURE);
  ok(runs.length === 48, `48 recorded legacy runs (got ${runs.length})`);
  const revs = new Set(runs.map((r) => r.rev));
  ok(revs.has(null) && revs.has(2) && revs.has(4) && revs.has(FLIP_REV_STRICT), "unstamped, 2, 4 and 6 recorded");
  for (const run of runs) {
    const tag = `flipRev ${run.rev ?? "none"} ${run.level} ${run.seed}`;
    const now = replayFlipRun(run.seed, run.raw, run.rev);
    ok(!now.flagged && now.desyncTick == null, `${tag}: replays unflagged`);
    ok(now.score === run.score, `${tag}: replays to its stored ${run.score} (got ${now.score})`);
    ok(JSON.stringify(flipCheckpoint(now.state)) === JSON.stringify(run.checkpoint), `${tag}: same final checkpoint`);
    ok(EXPANSION_FIELDS.every((k) => !(k in now.state)), `${tag}: no expansion field on the state`);
  }
  // The parked stamp 7 was never dealt: a round stamped 7 would play and score as flipRev 6.
  for (const run of runs.filter((r) => r.rev === FLIP_REV_STRICT).slice(0, 4)) {
    const as7 = replayFlipRun(run.seed, run.raw, FLIP_REV_STRICT + 1);
    ok(as7.score === run.score && JSON.stringify(flipCheckpoint(as7.state)) === JSON.stringify(run.checkpoint), `a flipRev 7 stamp plays as flipRev 6 (seed ${run.seed})`);
  }
  ok(JSON.stringify(flipGameFor(FLIP_REV_STRICT + 1).init(9)) === JSON.stringify(flipGameFor(FLIP_REV_STRICT).init(9)), "flipGameFor(7) is flipRev 6's game");
}

/* 2. Stamp and wiring. */
ok(LIVE_BANDS.flip.rev === FLIP_REV_EXPAND && liveStrictRev("flip") === FLIP_REV_STRICT, "LIVE_BANDS deals flipRev 8 and keeps flipRev 6 as its strict revision");
ok(LIVE_BANDS.flip.curve === FLIP_V8_BAND_CURVE, "LIVE_BANDS' curve is flipRev 8's base curve");
ok((generatePuzzle("flip") as { flipRev?: number }).flipRev === FLIP_REV_EXPAND, "rooms deal flipRev 8");
ok(roundMaxFor("flip") === 200, "Roofbound's round maximum is 200");
ok(flipWorldHFor(FLIP_REV_EXPAND) === FLIP_V8_WORLD_H && FLIP_V8_WORLD_H === 730, "flipRev 8: the 730 px world");
ok(flipWorldHFor(FLIP_REV_STRICT) === FLIP_WORLD_H && flipWorldHFor(undefined) === FLIP_WORLD_H, "earlier revisions keep 620 px");
ok(!("exp" in flipGameFor(FLIP_REV_STRICT).init(9)), "flipRev 6 states carry no expansion fields");
ok(flipGameFor(FLIP_REV_EXPAND).init(9).exp === 1, "flipRev 8 states are stamped");
ok(flipV8Arc(FLIP_V8_H_TIGHT) === 9 && flipV8Arc(FLIP_V8_H_NORMAL) === 12 && flipV8Arc(FLIP_V8_H_TALL) === 16, "flips take 9 / 12 / 16 ticks in tight / normal / tall caves");

/* 3. Courses. */
for (const seed of [11, 4242, -77, 123456789, 99, 2026]) {
  const c = flipCourseV8(seed);
  const tag = `seed ${seed}`;
  ok(JSON.stringify(flipCourseV8(seed)) === JSON.stringify(c), `${tag}: the same course every time`);
  const heights = new Set<number>();
  for (let i = 1; i < c.course.hts.length; i += 2) heights.add(c.course.hts[i]!);
  ok(heights.size === 3, `${tag}: tight, normal and tall stretches`);
  ok(c.segs.some((s) => s.amp), `${tag}: moving spikes`);
  ok(c.segs.every((s, i) => i === 0 || s.x0 >= c.segs[i - 1]!.x0), `${tag}: hazards in order`);
  const arcs = new Set<number>();
  for (let t = 0; t <= FLIP_RUN_TICKS; t += 30) arcs.add(flipV8Arc(flipV8HeightAt(c.course, c.course.xs[t]!)));
  ok(arcs.has(9) && arcs.has(16), `${tag}: flips of 9 and 16 ticks both occur`);
  // Each sweet spot is FLIP_V8_SWEET_TICKS ticks of travel long, on a stretch of its surface with no hazard.
  for (const sw of c.course.sweets) {
    let t = 0;
    while (c.course.xs[t]! < sw.x0) t++;
    ok(sw.x1 - sw.x0 === c.course.xs[t + FLIP_V8_SWEET_TICKS]! - c.course.xs[t]!, `${tag}: a sweet spot is ${FLIP_V8_SWEET_TICKS} ticks of travel long`);
    ok(!c.segs.some((s) => s.side === sw.side && s.x0 - (s.amp ?? 0) <= sw.x1 && s.x1 + (s.amp ?? 0) >= sw.x0), `${tag}: a sweet spot lies on clear roof`);
  }
}

/* 4. The guarantee: every tuning and fresh seed, from the counts and a stored witness through the server. */
const CEILING = (() => {
  // A route the builder proved: every gold star and the full minute (units), every trail, sweet spot, clean zone and
  // clean checkpoint (no crash on it), combos aside.
  const units = FLIP_RUN_TICKS / 30 + 3 * FLIP_STARS;
  const raw = FLIP_V8_SKILL_FULL;
  return Math.min(200, bandPoints(FLIP_V8_BAND_CURVE, units) + 10 + Math.min(FLIP_V8_FEATURE_CAP, bandPoints(FLIP_V8_SKILL_PAY, raw)));
})();
ok(CEILING === 200, `the ceiling from the full counts is 200 (${CEILING})`);
{
  const want = { goldStars: FLIP_STARS, trails: FLIP_V8_TRAILS, trailStars: 5 * FLIP_V8_TRAILS, sweetSpots: FLIP_V8_SWEETS, speedZones: 2, checkpoints: 3 };
  const witnesses = new Map(gz<FlipWitness[]>(FLIP_WITNESS_FIXTURE).map((w) => [w.seed, w.taps]));
  const sets: [string, number[]][] = [["tuning", FLIP_TUNING_SEEDS], ["fresh", FLIP_FRESH_SEEDS]];
  const game = flipGameFor(FLIP_REV_EXPAND);
  for (const [name, seeds] of sets) {
    let full = 0;
    let lowest = 200;
    for (const seed of seeds) {
      const opp = flipV8Opportunities(game.init(seed));
      if (JSON.stringify(opp) === JSON.stringify(want)) full++;
      else failures.push(`${name} seed ${seed}: opportunities ${JSON.stringify(opp)}`);
      const taps = witnesses.get(seed);
      if (!taps) {
        ok(false, `${name} seed ${seed}: a stored witness route`);
        lowest = 0;
        continue;
      }
      const { raw, local, state } = encodeFlipLog(FLIP_REV_EXPAND, seed, taps.map(TAP));
      const server = replayFlipRun(seed, raw, FLIP_REV_EXPAND);
      ok(!server.flagged && server.score === local && state.ended === 1 && (state.saves ?? 0) === 0, `${name} seed ${seed}: the witness lasts the minute with no crash, the server agrees`);
      lowest = Math.min(lowest, server.score);
    }
    ok(full === seeds.length, `${name}: every course has the full opportunities (${full} of ${seeds.length})`);
    ok(lowest === 200, `${name}: the lowest witness score through the server is 200 (${lowest})`);
    console.log(`  ${name}: ${seeds.length} seeds, full opportunities on ${full}, lowest witness ${lowest}`);
  }
}

/* 5. Sweet spots, on every landing of every stored run (witness routes, flipRev 8 bot runs). */
type Run = { seed: number; events: ArcadeInputEvent[] };
const v8Runs = gz<FlipLegacyRun[]>(FLIP_RUNS_FIXTURE);
{
  const runs: Run[] = [
    ...gz<FlipWitness[]>(FLIP_WITNESS_FIXTURE).slice(0, 12).map((w) => ({ seed: w.seed, events: w.taps.map(TAP) })),
  ];
  for (const r of v8Runs) runs.push({ seed: r.seed, events: decodeFlipRun(r.raw).events });
  const game = flipGameFor(FLIP_REV_EXPAND);
  let landings = 0;
  let sweet = 0;
  let overs = 0;
  let bad = 0;
  for (const run of runs) {
    const byTick = new Map(run.events.map((e) => [e.t, e]));
    let s = game.init(run.seed) as FlipState;
    const sweets = s.v8!.sweets;
    while (!game.isOver(s)) {
      const prev = s;
      s = game.step(s, byTick.get(s.tick + 1) ?? null) as FlipState;
      const landed = prev.flipT === 1 && s.flipT === 0;
      const should = landed ? sweets.reduce((m, sw, i) => (!((prev.sweetGot ?? 0) & (1 << i)) && flipSweetLanding(sw, s.side, 1, 0, s.x) ? m | (1 << i) : m), 0) : 0;
      if (landed) landings++;
      if (should) sweet++;
      if (!landed && s.flipT === 0 && sweets.some((sw) => sw.side === s.side && s.x >= sw.x0 && s.x <= sw.x1)) overs++;
      if ((s.sweetGot ?? 0) !== ((prev.sweetGot ?? 0) | should)) bad++;
      if (should && s.sweetT !== s.tick) bad++;
    }
  }
  ok(bad === 0, `sweet landings are exactly the landings inside an untaken strip (${bad} wrong ticks)`);
  ok(sweet > 0 && overs > 0, `checked ${landings} landings, ${sweet} sweet, and ${overs} ticks running over a strip that never count`);
  console.log(`  sweet spots: ${runs.length} runs, ${landings} landings, ${sweet} sweet landings, ${overs} ticks running over a strip`);
  // One spot pays once: a whole witness takes each of the eight once.
  const w = gz<FlipWitness[]>(FLIP_WITNESS_FIXTURE)[0]!;
  const end = encodeFlipLog(FLIP_REV_EXPAND, w.seed, w.taps.map(TAP)).state;
  ok(flipSweetsTaken(end) === FLIP_V8_SWEETS && flipV8Features(end).sweets === 3 * FLIP_V8_SWEETS, "a perfect route lands on every sweet spot once");
}

/* 6. Scoring, saves, idle and random play. */
{
  const game = flipGameFor(FLIP_REV_EXPAND);
  const seed = FLIP_TUNING_SEEDS[0]!;
  let s = game.init(seed) as FlipState;
  while (!game.isOver(s)) s = game.step(s, null);
  ok(s.ended === 2 && s.tick < FLIP_V8_CHECKPOINTS[0]!, "no input: the first hazard ends the run");
  ok(game.score(s) === 0, "no input scores 0");
  // Random play (taps at random, no aim) stays near 0 on every tuning seed.
  let worst = 0;
  for (const rs of FLIP_TUNING_SEEDS.slice(0, 30)) {
    const out = randomBot({ game, seed: rs, rev: FLIP_REV_EXPAND, human: new Human("flip", rs, "weak") });
    const { raw } = encodeFlipLog(FLIP_REV_EXPAND, rs, out.events ?? []);
    worst = Math.max(worst, replayFlipRun(rs, raw, FLIP_REV_EXPAND).score);
  }
  ok(worst <= 10, `random play scores at most 10 on 30 seeds (${worst})`);
  // The witness route to the first checkpoint, then no input: the next crash is saved once.
  const w = gz<FlipWitness[]>(FLIP_WITNESS_FIXTURE)[0]!;
  const taps = new Set(w.taps);
  s = game.init(w.seed) as FlipState;
  while (s.tick < FLIP_V8_CHECKPOINTS[0]!) s = game.step(s, taps.has(s.tick + 1) ? TAP(s.tick + 1) : null) as FlipState;
  ok(s.save === 1 && s.cpPassed === 1 && s.cleanCps === 1, "the first checkpoint: a save ready, a clean checkpoint");
  let savedAt = -1;
  while (!game.isOver(s)) {
    const prev = s;
    s = game.step(s, null) as FlipState;
    if ((s.saves ?? 0) > (prev.saves ?? 0)) {
      savedAt = s.tick;
      ok(s.ended === 0 && s.inv === FLIP_V8_SHIELD_TICKS && s.save === 0, "a crash after a checkpoint is saved: the shield is up");
      ok(s.chain === 0, "a save loses the combo");
    }
  }
  ok(savedAt > 0 && s.ended === 2 && s.tick > savedAt + FLIP_V8_SHIELD_TICKS - 1, "a second crash with no save ends the run, after the shield");
  ok((s.lost ?? 0) === Math.min(FLIP_V8_SAVE_PAUSE, s.tick - savedAt), `the survival count paused after the save (${s.lost})`);
  ok(game.score(s) > 0 && game.score(s) <= 200, "a saved run still scores");
  // Caps on every stored flipRev 8 run and witness: base ≤ 150, skill ≤ 50 and paid on the rising scale, total ≤ 200.
  const states: FlipState[] = v8Runs.map((r) => replayFlipRun(r.seed, r.raw, FLIP_REV_EXPAND).state);
  for (const st of states) {
    const p = flipBandParts(st);
    const f = flipV8Features(st);
    const base = p.points + (p.finished ? 10 : 0);
    ok(base <= 150 && f.total <= 50 && f.total === bandPoints(FLIP_V8_SKILL_PAY, f.raw) && game.score(st) === Math.min(200, base + f.total), "base ≤ 150, skill paid on the rising scale ≤ 50, the total their sum ≤ 200");
    ok(flipV8Units(st) <= 150, "units ≤ 150");
  }
  // The rising scale: a little feature play pays little, the full 50 only at FLIP_V8_SKILL_FULL.
  ok(bandPoints(FLIP_V8_SKILL_PAY, 15) <= 6 && bandPoints(FLIP_V8_SKILL_PAY, FLIP_V8_SKILL_FULL - 1) < 50 && bandPoints(FLIP_V8_SKILL_PAY, FLIP_V8_SKILL_FULL) === 50, "skill pays on a rising scale, 50 only at the full raw");
  ok(flipTrailStars({ trailGot: [31, 31, 31, 31] }).full === 4, "four full trails count 4");
}

/* 7. Stored flipRev 8 runs. */
{
  ok(v8Runs.length >= 12, `stored flipRev 8 runs (${v8Runs.length})`);
  for (const run of v8Runs) {
    const now = replayFlipRun(run.seed, run.raw, FLIP_REV_EXPAND);
    ok(!now.flagged && now.score === run.score, `flipRev 8 ${run.level} ${run.seed}: replays to its stored ${run.score} (got ${now.score})`);
    ok(JSON.stringify(flipCheckpoint(now.state)) === JSON.stringify(run.checkpoint), `flipRev 8 ${run.level} ${run.seed}: same final checkpoint`);
  }
}

/* 8. Texts. */
{
  const help = PUZZLE_INSTRUCTIONS.flip;
  const intro = help.how.filter((l) => !l.helpOnly);
  ok(intro.length <= 3, "intro HOW in at most three lines");
  for (const l of intro) ok(`${l.action} ${l.detail}`.length <= 110, `short intro line "${l.action}"`);
  ok(intro.some((l) => /sweet spot/i.test(`${l.action} ${l.detail}`)), "the intro names the sweet spots");
  const all = help.how.map((l) => `${l.action} ${l.detail}`).join(" ");
  for (const word of ["double flip", "trail", "Checkpoint", "Speed zone", "slide", "tall", "sweet spot", "sweet landing"])
    ok(new RegExp(word, "i").test(all), `the help explains ${word}`);
  ok(/\b200\b/.test(INTRO_SCORE.flip) && INTRO_SCORE.flip.length <= 90 && /sweet spots/.test(INTRO_SCORE.flip), `intro SCORE states 200 and the sweet spots: ${INTRO_SCORE.flip}`);
  ok(/Up to 200\.$/.test(help.score) && /sweet landing/.test(help.score) && /rising scale/.test(help.score), `"?" score help: ${help.score}`);
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
  console.log(`FAIL flip-x200-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS flip-x200-check: ${checks} checks (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
