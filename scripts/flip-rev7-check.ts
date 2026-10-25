/**
 * Roofbound flipRev 7 (the expansion, 25 Oct 2026; docs/expansions/e7.md): proves
 *   1. every recorded run on the revisions before it (unstamped, 2, 4 and 6; scripts/fixtures/flip-legacy-runs.json.gz,
 *      recorded on the tree before the change by scripts/flip-rev7-record.ts) replays to its stored score and final
 *      checkpoint, and earlier states never carry a rev-7 field;
 *   2. rooms deal flipRev 7, the stamp gates the taller 730 px world and every new rule;
 *   3. the course: three cave heights (flips of 9 to 16 ticks), two speed zones, moving spikes, four trails and ten
 *      gold stars, built the same every time, with one route the course builder proved;
 *   4. a planned route (an exact search on the sim) lasts the minute with every gold star, every trail, clean zones,
 *      clean checkpoints and the combo cap, and scores 200 through the server's encode + replay;
 *   5. checkpoint saves (a crash after a checkpoint is saved once: a second of shield, the survival count paused) and
 *      scoring (no input scores 0, the features cap at 50, never above 200);
 *   6. the texts: intro HOW in three lines, the SCORE line states 200, the "?" help explains every feature.
 *
 *   bun scripts/flip-rev7-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  flipCheckpoint,
  flipCourseV7,
  flipGameFor,
  flipStarsTaken,
  flipTrailStars,
  flipV7Arc,
  flipV7Features,
  flipV7HeightAt,
  flipWorldHFor,
  FLIP_REV_EXPAND,
  FLIP_REV_STRICT,
  FLIP_RUN_TICKS,
  FLIP_V7_CHECKPOINTS,
  FLIP_V7_H_NORMAL,
  FLIP_V7_H_TALL,
  FLIP_V7_H_TIGHT,
  FLIP_V7_SAVE_PAUSE,
  FLIP_V7_SHIELD_TICKS,
  FLIP_V7_WORLD_H,
  FLIP_WORLD_H,
  type FlipState,
} from "../src/lib/arcade/flip";
import { encodeFlipRun, replayFlipRun } from "../src/lib/duel/flip";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { FLIP_LEGACY_FIXTURE, type FlipLegacyRun } from "./flip-rev7-record";
import { flipTap as TAP, planFlipRoute } from "./flip-rev7-plan";

let checks = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const V7_FIELDS = ["exp", "v7", "arcN", "trailGot", "saves", "comboPts", "lost"] as const;

/* 1. Legacy runs. */
{
  const runs = JSON.parse(gunzipSync(readFileSync(FLIP_LEGACY_FIXTURE)).toString()) as FlipLegacyRun[];
  ok(runs.length === 48, `48 recorded legacy runs (got ${runs.length})`);
  const revs = new Set(runs.map((r) => r.rev));
  ok(revs.has(null) && revs.has(2) && revs.has(4) && revs.has(FLIP_REV_STRICT), "unstamped, 2, 4 and 6 recorded");
  for (const run of runs) {
    const tag = `flipRev ${run.rev ?? "none"} ${run.level} ${run.seed}`;
    const now = replayFlipRun(run.seed, run.raw, run.rev);
    ok(!now.flagged && now.desyncTick == null, `${tag}: replays unflagged`);
    ok(now.score === run.score, `${tag}: replays to its stored ${run.score} (got ${now.score})`);
    ok(JSON.stringify(flipCheckpoint(now.state)) === JSON.stringify(run.checkpoint), `${tag}: same final checkpoint`);
    ok(V7_FIELDS.every((k) => !(k in now.state)), `${tag}: no rev-7 field on the state`);
  }
}

/* 2. Stamp and wiring. */
ok(LIVE_BANDS.flip.rev === FLIP_REV_EXPAND, "LIVE_BANDS deals flipRev 7");
ok((generatePuzzle("flip") as { flipRev?: number }).flipRev === FLIP_REV_EXPAND, "rooms deal flipRev 7");
ok(roundMaxFor("flip") === 200, "Roofbound's round maximum is 200");
ok(flipWorldHFor(FLIP_REV_EXPAND) === FLIP_V7_WORLD_H && FLIP_V7_WORLD_H === 730, "rev 7: the 730 px world");
ok(flipWorldHFor(FLIP_REV_STRICT) === FLIP_WORLD_H && flipWorldHFor(undefined) === FLIP_WORLD_H, "earlier revisions keep 620 px");
ok(!("exp" in flipGameFor(FLIP_REV_STRICT).init(9)), "rev 6 states carry no rev-7 fields");
ok(flipGameFor(FLIP_REV_EXPAND).init(9).exp === 1, "rev 7 states are stamped");
ok(flipV7Arc(FLIP_V7_H_TIGHT) === 9 && flipV7Arc(FLIP_V7_H_NORMAL) === 12 && flipV7Arc(FLIP_V7_H_TALL) === 16, "flips take 9 / 12 / 16 ticks in tight / normal / tall caves");

/* 3. Courses. */
const SEEDS = [11, 4242, -77, 123456789, 99, 2026];
for (const seed of SEEDS) {
  const c = flipCourseV7(seed);
  const tag = `seed ${seed}`;
  const again = JSON.stringify(flipCourseV7(seed));
  ok(again === JSON.stringify(c), `${tag}: the same course every time`);
  ok(c.stars.length === 10, `${tag}: ten gold stars (${c.stars.length})`);
  ok(c.course.trails.length === 4, `${tag}: four star trails (${c.course.trails.length})`);
  ok(c.course.zones.length === 4, `${tag}: two speed zones`);
  const heights = new Set<number>();
  for (let i = 1; i < c.course.hts.length; i += 2) heights.add(c.course.hts[i]!);
  ok(heights.size === 3, `${tag}: tight, normal and tall stretches`);
  ok(c.segs.some((s) => s.amp), `${tag}: moving spikes`);
  ok(c.segs.every((s, i) => i === 0 || s.x0 >= c.segs[i - 1]!.x0), `${tag}: hazards in order`);
  const arcs = new Set<number>();
  for (let t = 0; t <= FLIP_RUN_TICKS; t += 30) arcs.add(flipV7Arc(flipV7HeightAt(c.course, c.course.xs[t]!)));
  ok(arcs.has(9) && arcs.has(16), `${tag}: flips of 9 and 16 ticks both occur`);
}

/* 4. A planned perfect route, scored through the server. */
function plan(seed: number): FlipState & { taps: number[] } {
  const route = planFlipRoute(flipGameFor(FLIP_REV_EXPAND), flipGameFor(FLIP_REV_EXPAND).init(seed));
  if (!route) throw new Error(`seed ${seed}: no route lasts the minute`);
  return Object.assign(route.state, { taps: route.taps });
}
function serverScore(seed: number, taps: number[]) {
  const game = flipGameFor(FLIP_REV_EXPAND);
  const events = taps.map((t) => TAP(t));
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const checkpoints: unknown[] = [];
  while (!game.isOver(s)) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.tick % 300 === 0) checkpoints.push(flipCheckpoint(s));
  }
  const raw = encodeFlipRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints } as never);
  return { raw, local: game.score(s), result: replayFlipRun(seed, raw, FLIP_REV_EXPAND) };
}
let perfect = 0;
let routeTaps: number[] = [];
const ROUTE_SEED = SEEDS[0]!;
for (const seed of SEEDS.slice(0, 3)) {
  const best = plan(seed);
  const f = flipV7Features(best);
  const { result, local } = serverScore(seed, best.taps);
  if (seed === ROUTE_SEED) routeTaps = best.taps;
  ok(best.ended === 1, `seed ${seed}: the planned route lasts the minute`);
  ok(flipStarsTaken(best) === 10, `seed ${seed}: every gold star (${flipStarsTaken(best)})`);
  ok(flipTrailStars(best).full === 4, `seed ${seed}: every trail (${flipTrailStars(best).full})`);
  ok(f.zones === 6 && f.checkpoints === 9, `seed ${seed}: clean zones and checkpoints`);
  ok(!result.flagged && result.desyncTick == null, `seed ${seed}: the server replay agrees`);
  ok(result.score === local, `seed ${seed}: server score = sim score`);
  if (result.score === 200) perfect++;
  console.log(`  seed ${seed}: ${result.score} (combo ${f.combo}, trails ${f.trails}, ${best.taps.length} taps)`);
}
ok(perfect >= 2, `200 reached through the server replay on at least two of three planned routes (${perfect})`);

/* 5. Saves and scoring. */
{
  const game = flipGameFor(FLIP_REV_EXPAND);
  // Idle from the start: dies before the first checkpoint with no save, and no input scores 0.
  let s = game.init(ROUTE_SEED);
  while (!game.isOver(s)) s = game.step(s, null);
  ok(s.ended === 2 && s.tick < FLIP_V7_CHECKPOINTS[0]!, "no input: the first hazard ends the run");
  ok(game.score(s) === 0, "no input scores 0");
  // The planned route to the first checkpoint, then no input: the next crash is saved once.
  const taps = new Set(routeTaps);
  s = game.init(ROUTE_SEED);
  while (s.tick < FLIP_V7_CHECKPOINTS[0]!) s = game.step(s, taps.has(s.tick + 1) ? TAP(s.tick + 1) : null);
  ok(s.save === 1 && s.cpPassed === 1 && s.cleanCps === 1, "the first checkpoint: a save ready, a clean checkpoint");
  let savedAt = -1;
  while (!game.isOver(s)) {
    const prev = s;
    s = game.step(s, null);
    if ((s.saves ?? 0) > (prev.saves ?? 0)) {
      savedAt = s.tick;
      ok(s.ended === 0 && s.inv === FLIP_V7_SHIELD_TICKS && s.save === 0, "a crash after a checkpoint is saved: the shield is up");
      ok(s.chain === 0, "a save loses the combo");
    }
  }
  ok(savedAt > 0 && s.ended === 2 && s.tick > savedAt + FLIP_V7_SHIELD_TICKS - 1, "a second crash with no save ends the run, after the shield");
  ok((s.lost ?? 0) === Math.min(FLIP_V7_SAVE_PAUSE, s.tick - savedAt), `the survival count paused after the save (${s.lost})`);
  ok(game.score(s) > 0 && game.score(s) <= 200, "a saved run still scores");
  // Scoring never above 200 and the features never above 50 on any planned route.
  const best = plan(ROUTE_SEED);
  ok(flipV7Features(best).total <= 50 && game.score(best) <= 200, "features cap at 50, the total at 200");
}

/* 6. Texts. */
{
  const help = PUZZLE_INSTRUCTIONS.flip;
  const intro = help.how.filter((l) => !l.helpOnly);
  ok(intro.length <= 3, "intro HOW in at most three lines");
  for (const l of intro) ok(`${l.action} ${l.detail}`.length <= 110, `short intro line "${l.action}"`);
  const all = help.how.map((l) => `${l.action} ${l.detail}`).join(" ");
  for (const word of ["double flip", "trail", "Checkpoint", "Speed zone", "slide", "tall"])
    ok(new RegExp(word, "i").test(all), `the help explains ${word}`);
  ok(/\b200\b/.test(INTRO_SCORE.flip) && INTRO_SCORE.flip.length <= 90, `intro SCORE states 200: ${INTRO_SCORE.flip}`);
  ok(/Up to 200\.$/.test(help.score) && /trails/.test(help.score), `"?" score help: ${help.score}`);
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
  console.log(`FAIL flip-rev7-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS flip-rev7-check: ${checks} checks`);
