/**
 * Home Run Derby (homerunRev 1, 30 Oct 2026; docs/arcade-standard/homerun.md):
 *
 *  1. the plan comes from the seed alone: ten pitches (three fastballs, two each of curve, drop and changeup, one
 *     more), one about every 6 s, all inside the strike zone and the run; four signs, each beyond the fence;
 *  2. a replay is deterministic (twice → the same final state) and the server path (replayHomerunRun) agrees with
 *     the sim; a tampered claimed score is flagged; out-of-range payloads are clamped;
 *  3. the deal: 300 seeds, all distinct, and the oracle takes each to exactly 200 through the server replay (quick
 *     depth 24 spread through the deal, CHECKS_FULL=1 all 300); the deal file is what homerun-deal.ts builds;
 *  4. the parts: distance 130 on a straight line (13 a pitch, full at 450 ft), home runs 5 each to 50, signs 5 each
 *     to 20; no input scores 0, a swipe that did nothing 1; a sign hit is always a home run;
 *  5. contact rules: timing and height quality, foul beyond the fair angle, a pitch nobody swings at is taken;
 *  6. the help states every part and "Together 200 points.".
 *
 *   bun scripts/homerun-check.ts
 */
import { execFileSync } from "node:child_process";
import { recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  homerunCheckpoint,
  homerunContact,
  homerunFence,
  homerunGame,
  homerunPlan,
  homerunStdParts,
  HOMERUN_FAIR_ANGLE,
  HOMERUN_INPUT_RANGES,
  HOMERUN_INPUT_SWING,
  HOMERUN_PITCHES,
  HOMERUN_RUN_TICKS,
  HOMERUN_SWING_TICKS,
  HOMERUN_ZONE_Y0,
  HOMERUN_ZONE_Y1,
  OUT_FOUL,
  OUT_HOMER,
  OUT_TAKEN,
  OUT_WHIFF,
} from "../src/lib/arcade/homerun";
import { encodeHomerunRun, replayHomerunRun } from "../src/lib/duel/homerun";
import { HOMERUN_DEAL } from "../src/lib/duel/homerunDeal.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { oracleRun, playLog } from "./homerun-oracle";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const FULL = process.env["CHECKS_FULL"] === "1";

function serve(seed: number, events: ArcadeInputEvent[], claim?: number) {
  const s = playLog(seed, events);
  const at = new Map(events.map((e) => [e.t, e]));
  let r = homerunGame.init(seed);
  const cps = [];
  while (!homerunGame.isOver(r)) {
    r = homerunGame.step(r, at.get(r.tick + 1) ?? null);
    if (r.tick % 60 === 0) cps.push(homerunCheckpoint(r));
  }
  const raw = encodeHomerunRun({ seed, claimedScore: claim ?? homerunGame.score(s), events, endTick: s.tick, checkpoints: cps });
  const quiet = console.error;
  console.error = () => {};
  const out = replayHomerunRun(seed, raw, 1);
  console.error = quiet;
  return { sim: s, out };
}

/* 1. The plan. */
for (let i = 0; i < 400; i++) {
  const seed = (i * 7919 + 13) | 0;
  const plan = homerunPlan(seed);
  const kinds = [0, 0, 0, 0];
  for (const p of plan.pitches) kinds[p.kind]!++;
  ok(plan.pitches.length === HOMERUN_PITCHES, `seed ${seed}: ten pitches`);
  ok(kinds[0]! >= 3 && kinds[1]! >= 2 && kinds[2]! >= 2 && kinds[3]! >= 2, `seed ${seed}: at least 3 fastballs and 2 each of the others (${kinds})`);
  ok(plan.pitches.every((p, j) => j === 0 || p.release - plan.pitches[j - 1]!.release === 348), `seed ${seed}: one pitch every 348 ticks (5.8 s)`);
  ok(plan.pitches.every((p) => p.plateY > HOMERUN_ZONE_Y0 && p.plateY < HOMERUN_ZONE_Y1 && p.arrive < HOMERUN_RUN_TICKS - 120), `seed ${seed}: every pitch crosses inside the zone, with time to see it land`);
  ok(plan.signs.length === 4 && plan.signs.every((s) => s.feet > homerunFence(s.angle)), `seed ${seed}: four signs, each beyond the fence`);
  ok(JSON.stringify(homerunPlan(seed)) === JSON.stringify(plan), `seed ${seed}: the plan is the same every time`);
}

/* 2. Determinism, the server path, tampering, clamping. */
{
  const seed = HOMERUN_DEAL[3]!;
  const ev = oracleRun(seed);
  ok(JSON.stringify(playLog(seed, ev)) === JSON.stringify(playLog(seed, ev)), "the same log replays to the same final state");
  const { sim, out } = serve(seed, ev);
  ok(!out.flagged && out.score === homerunGame.score(sim) && out.desyncTick === null, `the server replay agrees with the sim (${out.score})`);
  ok(serve(seed, ev, 150).out.flagged, "a claimed score the replay does not give is flagged");
  const wild: ArcadeInputEvent[] = [];
  recordInput(wild, { t: 50, k: HOMERUN_INPUT_SWING, a: 99999, b: -99999, c: 0, d: 0 }, HOMERUN_INPUT_RANGES);
  ok(wild[0]!.a === 720 && wild[0]!.b === -900, "payloads are clamped to the declared ranges");
}

/* 3. The deal. */
ok(HOMERUN_DEAL.length === 300 && new Set(HOMERUN_DEAL).size === 300, "the deal holds 300 distinct seeds");
const proved = FULL ? HOMERUN_DEAL : HOMERUN_DEAL.filter((_, i) => i % 13 === 0);
let all200 = true;
for (const seed of proved) {
  const { out } = serve(seed, oracleRun(seed));
  if (out.flagged || out.score !== 200) {
    all200 = false;
    failures.push(`deal seed ${seed}: the oracle scores ${out.score}${out.flagged ? " (flagged)" : ""}`);
  }
}
ok(all200, `the oracle takes ${proved.length} deal seeds to exactly 200 through the server replay`);
try {
  execFileSync("bun", ["scripts/homerun-deal.ts", "--check"], { stdio: "pipe" });
  ok(true, "the deal file is what homerun-deal.ts builds");
} catch {
  ok(false, "the deal file is what homerun-deal.ts builds");
}

/* 4. The parts. */
{
  const seed = HOMERUN_DEAL[7]!;
  ok(serve(seed, []).out.score === 0, "no input scores 0");
  const one: ArcadeInputEvent[] = [];
  recordInput(one, { t: 3, k: HOMERUN_INPUT_SWING, a: 500, b: 0, c: 0, d: 0 }, HOMERUN_INPUT_RANGES);
  ok(serve(seed, one).out.score === 1, "one swipe that did nothing scores 1");
  const s0 = { ...homerunGame.init(seed), acted: 1 };
  const pts = (over: object, k: string) => homerunStdParts({ ...s0, ...over })!.find((p) => p.key === k)!.points;
  let line = true;
  for (let f = 0; f <= 4600; f++) if (pts({ feet: f }, "core") !== Math.floor((130 * Math.min(f, 4500)) / 4500)) line = false;
  ok(line, "distance: a straight line to 130 at 4,500 ft (450 a pitch)");
  ok(pts({ homers: 3 }, "homers") === 15 && pts({ homers: 12 }, "homers") === 50, "home runs: 5 each, up to 50");
  ok(pts({ signs: 0b0101 }, "signs") === 10 && pts({ signs: 0b1111 }, "signs") === 20, "signs: 5 each of the four");
  // Every sign hit in many random swings is a home run past 450 ft or more of the sign's distance.
  let signHomer = true;
  for (let i = 0; i < 3000; i++) {
    const plan = homerunPlan(i * 31 + 5);
    const p = plan.pitches[i % 10]!;
    const h = homerunContact(plan, p, p.arrive - HOMERUN_SWING_TICKS + ((i * 7) % 5) - 2, p.plateY + ((i * 13) % 11) - 5, ((i * 37) % 1200) - 600);
    if (h.sign >= 0 && (h.out !== OUT_HOMER || h.feet < plan.signs[h.sign]!.feet)) signHomer = false;
  }
  ok(signHomer, "a sign hit is always a home run (features never cost the core)");
}

/* 5. Contact rules. */
{
  const plan = homerunPlan(99);
  const p = plan.pitches[0]!;
  const sq = homerunContact(plan, p, p.arrive - HOMERUN_SWING_TICKS, p.plateY, 0);
  ok(sq.q === 1000 && sq.feet === 470 && sq.out === OUT_HOMER, "a square, on-time swing: quality 1000, 470 ft, a home run");
  ok(homerunContact(plan, p, p.arrive - HOMERUN_SWING_TICKS - 7, p.plateY, 0).out === OUT_WHIFF, "7 ticks early: a swing and a miss");
  ok(homerunContact(plan, p, p.arrive - HOMERUN_SWING_TICKS, p.plateY + 30, 0).out === OUT_WHIFF, "30 px off the ball: a miss");
  ok(homerunContact(plan, p, p.arrive - HOMERUN_SWING_TICKS, p.plateY, HOMERUN_FAIR_ANGLE + 1).out === OUT_FOUL, "past the fair angle: foul");
  const late = homerunContact(plan, p, p.arrive - HOMERUN_SWING_TICKS + 2, p.plateY, 0);
  ok(late.q === 820 && late.feet < sq.feet, "2 ticks late: a weaker hit");
  const taken = serve(99, []).sim;
  ok(taken.hits.length === 10 && taken.hits.every((h) => h.out === OUT_TAKEN), "with no swings, all ten pitches are taken");
}

/* 6. The help. */
{
  const help = PUZZLE_INSTRUCTIONS.homerun?.score ?? "";
  ok(help.includes("Together 200 points."), `the help ends "Together 200 points." (${help})`);
  for (const part of ["Distance up to 130", "Home runs up to 50", "Sign hits up to 20"]) ok(help.includes(part), `the help states "${part}"`);
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  console.log(`FAIL homerun-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS homerun-check: ${checks} checks — plans, replay, the 300-seed deal (${proved.length} proved at 200), parts, contact and help`);
