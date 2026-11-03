/**
 * Home Run (homerunRev 1, 30 Oct 2026; homerunRev 2, 31 Oct 2026; docs/arcade-standard/homerun.md):
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
 *  6. the help states every part and "Together 200 points.";
 *  7. homerunRev 1 replays as before: 54 runs recorded on main b154694 (scripts/fixtures/homerun-rev1-legacy.json, the
 *     skill-band bots at every level, random swipes and edge swings) give the same score, final checksum and end tick;
 *  8. homerunRev 2 (rooms deal it): the finer aim (spray = 9/16 of the swipe, fair to ±80°), everything else rev 1's;
 *     the rev-2 deal (300 seeds, proved at 200 on rev 2 like section 3) is what `homerun-deal.ts --rev=2` builds;
 *     rooms dealt rev 2 from it (31 Oct 2026); the help names no pitch before it is thrown;
 *  9. homerunRev 3 (rooms deal it since 1 Nov 2026): rev 2's runs replay as before (54 runs recorded on main ae1efbe,
 *     scripts/fixtures/homerun-rev2-legacy.json); the swing choice (Contact at first, carried, locked at the release);
 *     each kind's perfect tick and window (fastball tightest), Contact's wide window and short carry (never a sign),
 *     Power's narrow window and 480 ft; the core full at 460 ft a pitch; the rev-3 deal (300 seeds, proved at 200 on
 *     rev 3) is what `homerun-deal.ts --rev=3` builds;
 * 10. homerunRev 4 (rooms deal it since 3 Nov 2026, "pick your spot"): rev 3's runs replay as before (the homerun runs
 *     of scripts/fixtures/sports-nov3-legacy.json, recorded on main 6326101); rev 4's plan (4 fastballs, 3 curves, 3
 *     changeups, six fielders a pitch, a lit sign a pitch, never the same twice running; rev 1–3's plan unchanged); the
 *     spot (inside its area, locked at the release, carried) and the tap (from 12 ticks before the release); contact:
 *     on the spot within a tick (a sign: its own tolerance), early pulls left and late pushes right, short in proportion,
 *     a miss past 7 ticks, a fielder's catch scores no distance, the bonus only on the lit sign; the perfect streak;
 *     the four parts summing to 200; the rev-4 deal (300 seeds, the oracle at 200 through the server replay) is what
 *     `homerun-deal.ts --rev=4` builds and rooms deal from it; the help names the spot, the ring and the fielders.
 *     (3 Nov 2026: the brief removes the Contact / Power choice and the tell from what rooms deal, so the help
 *     assertions on them and on rev 1–3's part names now read rev 4's help; rev 3's own rules are still proved above.)
 *
 *   bun scripts/homerun-check.ts
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  homerunCheckpoint,
  homerunContact,
  homerunFence,
  homerunGame,
  homerunGameFor,
  homerunPlan,
  homerunSpray,
  homerunStdParts,
  HOMERUN_FAIR_ANGLE,
  HOMERUN_FAIR_ANGLE_V2,
  HOMERUN_REV_2,
  HOMERUN_REV_3,
  HOMERUN_FULL_AT_V3,
  HOMERUN_INPUT_MODE,
  HOMERUN_INPUT_RANGES_V3,
  HOMERUN_MODE_CONTACT,
  HOMERUN_MODE_POWER,
  HOMERUN_V3_FEET_BASE,
  HOMERUN_V3_FEET_SPAN,
  HOMERUN_V3_PERFECT,
  HOMERUN_V3_WINDOW,
  homerunPerfectOffset,
  PITCH_CHANGEUP,
  PITCH_FASTBALL,
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
  OUT_CAUGHT,
  PITCH_CURVE,
  HOMERUN_REV_4,
  HOMERUN_INPUT_RANGES_V4,
  HOMERUN_INPUT_SPOT,
  HOMERUN_INPUT_TAP,
  HOMERUN_STD_SPEC_V4,
  HOMERUN_V4_DRIFT,
  HOMERUN_V4_FALL,
  HOMERUN_V4_FULL_AT,
  HOMERUN_V4_MISS,
  HOMERUN_V4_SIGNS,
  HOMERUN_V4_SPOT_START,
  HOMERUN_V4_TAP_EARLY,
  homerunContactV4,
  homerunGroundY,
  homerunPlanV4,
  homerunV4Counted,
  homerunV4Perfect,
  homerunV4SpotOk,
  homerunV4Target,
  homerunV4XOf,
} from "../src/lib/arcade/homerun";
import { encodeHomerunRun, replayHomerunRun } from "../src/lib/duel/homerun";
import { HOMERUN_DEAL } from "../src/lib/duel/homerunDeal.server";
import { HOMERUN_DEAL_V2 } from "../src/lib/duel/homerunDealV2.server";
import { HOMERUN_DEAL_V3 } from "../src/lib/duel/homerunDealV3.server";
import { HOMERUN_DEAL_V4 } from "../src/lib/duel/homerunDealV4.server";
import { generateHomerun } from "../src/lib/duel/sports.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { oracleRun, playLog } from "./homerun-oracle";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const FULL = process.env["CHECKS_FULL"] === "1";

function serve(seed: number, events: ArcadeInputEvent[], claim?: number, rev = 1) {
  const game = homerunGameFor(rev);
  const s = playLog(seed, events, rev);
  const at = new Map(events.map((e) => [e.t, e]));
  let r = game.init(seed);
  const cps = [];
  while (!game.isOver(r)) {
    r = game.step(r, at.get(r.tick + 1) ?? null);
    if (r.tick % 60 === 0) cps.push(homerunCheckpoint(r));
  }
  const raw = encodeHomerunRun({ seed, claimedScore: claim ?? game.score(s), events, endTick: s.tick, checkpoints: cps });
  const quiet = console.error;
  const quietWarn = console.warn;
  console.error = () => {};
  console.warn = () => {};
  const out = replayHomerunRun(seed, raw, rev);
  console.error = quiet;
  console.warn = quietWarn;
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
  // The help states the dealt revision's parts (homerunRev 4 since 3 Nov 2026).
  for (const part of ["Distance up to 120", "Home runs up to 40", "Bonus signs up to 20", "Perfect streak up to 20"]) ok(help.includes(part), `the help states "${part}"`);
}

/* 7. homerunRev 1 replays exactly as before. */
{
  const fx = JSON.parse(readFileSync("scripts/fixtures/homerun-rev1-legacy.json", "utf8")) as { runs: { seed: number; label: string; events: ArcadeInputEvent[]; score: number; checksum: number; tick: number }[] };
  let same = 0;
  for (const run of fx.runs) {
    const s = playLog(run.seed, run.events, 1);
    const { out } = serve(run.seed, run.events, undefined, 1);
    const good = s.rev === 1 && homerunGame.score(s) === run.score && homerunCheckpoint(s).checksum === run.checksum && s.tick === run.tick && out.score === run.score && !out.flagged;
    if (good) same++;
    else failures.push(`rev-1 legacy run ${run.label} on ${run.seed}: ${out.score} (was ${run.score})`);
  }
  ok(fx.runs.length === 54 && same === fx.runs.length, `homerunRev 1: ${same} of ${fx.runs.length} recorded runs replay to the same score, checksum and end tick`);
}

/* 8. homerunRev 2. */
{
  ok(homerunGameFor(2).init(5).rev === HOMERUN_REV_2 && homerunGameFor(1).init(5).rev === 1 && homerunGameFor(undefined).init(5).rev === 1, "homerunGameFor: rev 2 on 2, rev 1 otherwise");
  ok(HOMERUN_DEAL_V2.every((seed) => homerunGameFor(2).init(seed).rev === 2), "rev 2's proved deal plays on rev 2 (rooms dealt it until 1 Nov 2026)");
  // The finer aim: 9/16 of the swipe; fair to ±80° (rev 1: three quarters, ±60°).
  let fine = true;
  for (let b = -900; b <= 900; b++) if (homerunSpray(b, 2) !== Math.trunc((b * 9) / 16) || homerunSpray(b, 1) !== Math.trunc((b * 3) / 4)) fine = false;
  ok(fine, "spray: 9/16 of the swipe on rev 2, three quarters on rev 1");
  const plan = homerunPlan(99);
  const p = plan.pitches[0]!;
  const at = p.arrive - HOMERUN_SWING_TICKS;
  ok(homerunContact(plan, p, at, p.plateY, 700, 2).out === OUT_HOMER && homerunContact(plan, p, at, p.plateY, 700, 1).out === OUT_FOUL, "a 70° swipe is fair on rev 2, foul on rev 1");
  ok(homerunContact(plan, p, at, p.plateY, HOMERUN_FAIR_ANGLE_V2 + 1, 2).out === OUT_FOUL && homerunContact(plan, p, at, p.plateY, -HOMERUN_FAIR_ANGLE_V2 - 1, 2).out === OUT_FOUL, "past ±80° is foul on rev 2");
  ok(homerunContact(plan, p, at, p.plateY, 400, 2).spray === 225 && homerunContact(plan, p, at, p.plateY, 400, 1).spray === 300, "a 40° swipe sprays 22.5° on rev 2 (30° on rev 1)");
  // Timing, height and distance are rev 1's.
  let sameContact = true;
  for (let i = 0; i < 2000; i++) {
    const pl = homerunPlan(i * 17 + 3);
    const q = pl.pitches[i % 10]!;
    const st = q.arrive - HOMERUN_SWING_TICKS + ((i * 7) % 17) - 8;
    const a = q.plateY + ((i * 13) % 41) - 20;
    const h1 = homerunContact(pl, q, st, a, 0, 1);
    const h2 = homerunContact(pl, q, st, a, 0, 2);
    if (h1.q !== h2.q || h1.feet !== h2.feet || h1.out !== h2.out || h1.at !== h2.at) sameContact = false;
  }
  ok(sameContact, "rev 2's timing, height, carry and outcome on a level swing are rev 1's");
  // The rev-2 deal.
  ok(HOMERUN_DEAL_V2.length === 300 && new Set(HOMERUN_DEAL_V2).size === 300, "the rev-2 deal holds 300 distinct seeds");
  const provedV2 = FULL ? HOMERUN_DEAL_V2 : HOMERUN_DEAL_V2.filter((_, i) => i % 13 === 0);
  let v2at200 = 0;
  for (const seed of provedV2) {
    const { out } = serve(seed, oracleRun(seed, 2), undefined, 2);
    if (!out.flagged && out.score === 200 && out.state.rev === 2) v2at200++;
    else failures.push(`rev-2 deal seed ${seed}: the oracle scores ${out.score}${out.flagged ? " (flagged)" : ""}`);
  }
  ok(v2at200 === provedV2.length, `the oracle takes ${v2at200} of ${provedV2.length} rev-2 deal seeds to exactly 200 on rev 2 through the server replay`);
  try {
    execFileSync("bun", ["scripts/homerun-deal.ts", "--rev=2", "--check"], { stdio: "pipe" });
    ok(true, "the rev-2 deal file is what homerun-deal.ts --rev=2 builds");
  } catch {
    ok(false, "the rev-2 deal file is what homerun-deal.ts --rev=2 builds");
  }
  // Rev 2's replay path agrees with its sim, flags tampering and keeps the rev in the state.
  const seed = HOMERUN_DEAL_V2[5]!;
  const ev = oracleRun(seed, 2);
  const r2 = serve(seed, ev, undefined, 2);
  ok(!r2.out.flagged && r2.out.score === homerunGameFor(2).score(r2.sim) && r2.out.desyncTick === null, "rev 2: the server replay agrees with the sim");
  ok(serve(seed, ev, 150, 2).out.flagged, "rev 2: a claimed score the replay does not give is flagged");
  ok(serve(seed, ev, undefined, 1).out.score < 200, "the rev-2 oracle's aim is not rev 1's (the same log on rev 1 misses signs)");
  const help = `${PUZZLE_INSTRUCTIONS.homerun?.goal ?? ""} ${(PUZZLE_INSTRUCTIONS.homerun?.how ?? []).map((h) => `${h.action} ${h.detail}`).join(" ")}`;
  // homerunRev 4 (3 Nov 2026) shows every pitch plainly in flight with no tell: the help says so (rev 2's radar wording is gone).
  ok(!/chip at the top names/i.test(help) && /no tells/i.test(help), "the help says the pitches are read from the ball itself, with no tells");
}

/* 9. homerunRev 3. */
{
  const g3 = homerunGameFor(3);
  ok(g3.init(5).rev === HOMERUN_REV_3 && homerunGameFor(2).init(5).rev === 2, "homerunGameFor: rev 3 on 3, rev 2 on 2");
  ok(HOMERUN_DEAL_V3.length === 300, "rev 3's deal is kept");
  // Rev 2's runs replay exactly as before.
  const fx = JSON.parse(readFileSync("scripts/fixtures/homerun-rev2-legacy.json", "utf8")) as { runs: { seed: number; label: string; events: ArcadeInputEvent[]; score: number; checksum: number; tick: number }[] };
  let same = 0;
  for (const run of fx.runs) {
    const g2 = homerunGameFor(2);
    const st = playLog(run.seed, run.events, 2);
    const { out } = serve(run.seed, run.events, undefined, 2);
    // The edge runs with kind-2 events: the sim ignores them on rev 2 and the server drops them (an unknown kind, so
    // the log is flagged as repaired), the score unchanged.
    const unknown = run.events.some((e) => e.k === HOMERUN_INPUT_MODE);
    const good = st.rev === 2 && g2.score(st) === run.score && homerunCheckpoint(st).checksum === run.checksum && st.tick === run.tick && out.score === run.score && out.flagged === unknown;
    if (good) same++;
    else failures.push(`rev-2 legacy run ${run.label} on ${run.seed}: ${out.score} (was ${run.score})`);
  }
  ok(fx.runs.length === 54 && same === fx.runs.length, `homerunRev 2: ${same} of ${fx.runs.length} recorded runs replay to the same score, checksum and end tick`);
  ok(fx.runs.filter((r) => r.events.some((e) => e.k === HOMERUN_INPUT_MODE)).length === 3, "three rev-2 legacy runs carry kind-2 events");
  // Input ranges: rev 3 declares the swing choice; rev 1 and 2 do not.
  ok(HOMERUN_INPUT_RANGES_V3.some((r) => r.k === HOMERUN_INPUT_MODE) && !HOMERUN_INPUT_RANGES.some((r) => r.k === HOMERUN_INPUT_MODE), "the swing choice is rev 3's input kind only");
  ok(homerunGameFor(2).inputRanges === HOMERUN_INPUT_RANGES && homerunGameFor(1).inputRanges === HOMERUN_INPUT_RANGES, "rev 1 and 2 keep their input ranges");
  const clamp: ArcadeInputEvent[] = [];
  recordInput(clamp, { t: 3, k: HOMERUN_INPUT_MODE, a: 7, b: 9, c: 0, d: 0 }, HOMERUN_INPUT_RANGES_V3);
  ok(clamp[0]!.a === 1 && clamp[0]!.b === 0, "the swing choice is clamped to 0 / 1");
  // Rev 2's contact is unchanged whatever swing is passed.
  let rev2Same = true;
  for (let i = 0; i < 1000; i++) {
    const pl = homerunPlan(i * 23 + 1);
    const q = pl.pitches[i % 10]!;
    const st = q.arrive - HOMERUN_SWING_TICKS + ((i * 5) % 13) - 6;
    const a = q.plateY + ((i * 11) % 31) - 15;
    if (JSON.stringify(homerunContact(pl, q, st, a, 100, 2)) !== JSON.stringify(homerunContact(pl, q, st, a, 100, 2, HOMERUN_MODE_POWER))) rev2Same = false;
  }
  ok(rev2Same, "rev 2's contact ignores the swing choice");
  // Each kind's perfect tick, windows and carry.
  const plan = homerunPlan(HOMERUN_DEAL_V3[0]!);
  let perfect = true;
  let tighter = true;
  for (const p of plan.pitches) {
    const st = p.arrive + HOMERUN_V3_PERFECT[p.kind]! - HOMERUN_SWING_TICKS;
    for (const m of [HOMERUN_MODE_CONTACT, HOMERUN_MODE_POWER]) {
      const h = homerunContact(plan, p, st, p.plateY, 0, 3, m);
      if (h.q !== 1000 || h.feet !== HOMERUN_V3_FEET_BASE[m]! + HOMERUN_V3_FEET_SPAN[m]! || h.m !== m) perfect = false;
      const off = homerunContact(plan, p, st + 1, p.plateY, 0, 3, m);
      if (off.q !== 1000 - Math.floor(10000 / HOMERUN_V3_WINDOW[m]![p.kind]!)) perfect = false;
    }
    const c2 = homerunContact(plan, p, st + 2, p.plateY, 0, 3, HOMERUN_MODE_CONTACT);
    const p2 = homerunContact(plan, p, st + 2, p.plateY, 0, 3, HOMERUN_MODE_POWER);
    if (!(c2.q > p2.q)) tighter = false;
  }
  ok(perfect, "rev 3: each pitch met on its kind's perfect tick at its height is quality 1000 (Contact 414 ft, Power 480 ft); a tick off loses 1000 / window");
  ok(tighter, "rev 3: two ticks off, Contact keeps more quality than Power");
  ok(homerunPerfectOffset(PITCH_FASTBALL, 3) < homerunPerfectOffset(PITCH_CHANGEUP, 3) && homerunPerfectOffset(PITCH_CHANGEUP, 2) === 0, "rev 3: the fastball's perfect tick is earliest, the changeup's latest (rev 2: the arrival)");
  ok(HOMERUN_V3_WINDOW.every((w) => w[PITCH_FASTBALL]! === Math.min(...w)), "rev 3: the fastball's window is the tightest on either swing");
  ok(HOMERUN_V3_FEET_BASE[0] + HOMERUN_V3_FEET_SPAN[0] < 415 && HOMERUN_V3_FEET_BASE[1] + HOMERUN_V3_FEET_SPAN[1] >= 445, "rev 3: Contact never carries to a sign (≤ 414 ft), Power reaches every one");
  let contactNoSign = true;
  for (let i = 0; i < 3000; i++) {
    const pl = homerunPlan(i * 41 + 9);
    const q = pl.pitches[i % 10]!;
    const h = homerunContact(pl, q, q.arrive + homerunPerfectOffset(q.kind, 3) - HOMERUN_SWING_TICKS + ((i * 3) % 5) - 2, q.plateY + ((i * 7) % 9) - 4, ((i * 37) % 1600) - 800, 3, HOMERUN_MODE_CONTACT);
    if (h.sign >= 0) contactNoSign = false;
  }
  ok(contactNoSign, "rev 3: a Contact swing never hits a sign");
  // The swing choice: Contact at first, carried, locked at the release.
  const seed = HOMERUN_DEAL_V3[4]!;
  const pl = homerunPlan(seed);
  const p0 = pl.pitches[0]!;
  const p1 = pl.pitches[1]!;
  const swingAt = (p: typeof p0) => p.arrive + homerunPerfectOffset(p.kind, 3) - HOMERUN_SWING_TICKS;
  const two = (extra: ArcadeInputEvent[]) => {
    const ev: ArcadeInputEvent[] = [];
    const all = [...extra, { t: swingAt(p0), k: HOMERUN_INPUT_SWING, a: p0.plateY, b: 0, c: 0, d: 0 }, { t: swingAt(p1), k: HOMERUN_INPUT_SWING, a: p1.plateY, b: 0, c: 0, d: 0 }].sort((x, y) => x.t - y.t);
    for (const e of all) recordInput(ev, e, HOMERUN_INPUT_RANGES_V3);
    return playLog(seed, ev, 3);
  };
  const none = two([]);
  ok(none.hits[0]!.m === HOMERUN_MODE_CONTACT && none.hits[1]!.m === HOMERUN_MODE_CONTACT && none.hits[0]!.feet === 414, "rev 3: with no choice made, every pitch is a Contact swing");
  const before = two([{ t: p0.release, k: HOMERUN_INPUT_MODE, a: 1, b: 0, c: 0, d: 0 }]);
  ok(before.hits[0]!.m === HOMERUN_MODE_POWER && before.hits[1]!.m === HOMERUN_MODE_POWER && before.hits[0]!.feet === 480, "rev 3: Power chosen by the release plays that pitch and carries to the next");
  const after = two([{ t: p0.release + 1, k: HOMERUN_INPUT_MODE, a: 1, b: 0, c: 0, d: 0 }]);
  ok(after.hits[0]!.m === HOMERUN_MODE_CONTACT && after.hits[1]!.m === HOMERUN_MODE_POWER, "rev 3: a choice after the release waits for the next pitch");
  ok(homerunCheckpoint(before).checksum !== homerunCheckpoint(none).checksum, "rev 3: the checksum carries the swing choices");
  ok(serve(seed, [{ t: 9, k: HOMERUN_INPUT_MODE, a: 1, b: 0, c: 0, d: 0 }], undefined, 3).out.score === 1, "rev 3: choosing a swing and never swinging scores 1");
  ok(serve(seed, [], undefined, 3).out.score === 0, "rev 3: no input scores 0");
  // The parts: the core on a straight line to 130 at 4,600 ft.
  const s0 = { ...g3.init(seed), acted: 1 };
  let line = true;
  for (let f = 0; f <= 4700; f += 7) if (homerunStdParts({ ...s0, feet: f })!.find((x) => x.key === "core")!.points !== Math.floor((130 * Math.min(f, HOMERUN_FULL_AT_V3)) / HOMERUN_FULL_AT_V3)) line = false;
  ok(line, "rev 3: distance a straight line to 130 at 4,600 ft (460 a pitch)");
  // The rev-3 deal.
  ok(HOMERUN_DEAL_V3.length === 300 && new Set(HOMERUN_DEAL_V3).size === 300, "the rev-3 deal holds 300 distinct seeds");
  const provedV3 = FULL ? HOMERUN_DEAL_V3 : HOMERUN_DEAL_V3.filter((_, i) => i % 13 === 0);
  let v3at200 = 0;
  for (const sd of provedV3) {
    const { out } = serve(sd, oracleRun(sd, 3), undefined, 3);
    if (!out.flagged && out.score === 200 && out.state.rev === 3) v3at200++;
    else failures.push(`rev-3 deal seed ${sd}: the oracle scores ${out.score}${out.flagged ? " (flagged)" : ""}`);
  }
  ok(v3at200 === provedV3.length, `the oracle takes ${v3at200} of ${provedV3.length} rev-3 deal seeds to exactly 200 on rev 3 through the server replay`);
  try {
    execFileSync("bun", ["scripts/homerun-deal.ts", "--rev=3", "--check"], { stdio: "pipe" });
    ok(true, "the rev-3 deal file is what homerun-deal.ts --rev=3 builds");
  } catch {
    ok(false, "the rev-3 deal file is what homerun-deal.ts --rev=3 builds");
  }
  const ev = oracleRun(HOMERUN_DEAL_V3[5]!, 3);
  const r3 = serve(HOMERUN_DEAL_V3[5]!, ev, undefined, 3);
  ok(!r3.out.flagged && r3.out.score === g3.score(r3.sim) && r3.out.desyncTick === null, "rev 3: the server replay agrees with the sim");
  ok(serve(HOMERUN_DEAL_V3[5]!, ev, 150, 3).out.flagged, "rev 3: a claimed score the replay does not give is flagged");
  ok(playLog(HOMERUN_DEAL_V3[5]!, ev.filter((e) => e.k === HOMERUN_INPUT_SWING), 3).hits.every((h) => h.m === HOMERUN_MODE_CONTACT), "rev 3: the oracle's swings without its Power choice are Contact swings");
}

/* 10. homerunRev 4: pick your spot. */
{
  const g4 = homerunGameFor(4);
  ok(g4.init(5).rev === HOMERUN_REV_4 && homerunGameFor(3).init(5).rev === 3, "homerunGameFor: rev 4 on 4, rev 3 on 3");
  const dealt = generateHomerun();
  ok(dealt.homerunRev === 4 && HOMERUN_DEAL_V4.includes(dealt.seed), "rooms deal homerunRev 4 from rev 4's proved deal");
  // Rev 3's runs replay exactly as before (recorded on main 6326101 before rev 4).
  const fx = JSON.parse(readFileSync("scripts/fixtures/sports-nov3-legacy.json", "utf8")) as { runs: { type: string; rev: number; seed: number; label: string; raw: string; score: number; checksum: number; tick: number }[] };
  const runs = fx.runs.filter((r) => r.type === "homerun");
  let same = 0;
  for (const run of runs) {
    const quiet = [console.error, console.warn, console.log] as const;
    console.error = console.warn = console.log = () => {};
    const out = replayHomerunRun(run.seed, run.raw, 3);
    [console.error, console.warn, console.log] = quiet;
    const good = out.state.rev === 3 && out.score === run.score && homerunCheckpoint(out.state).checksum === run.checksum && out.state.tick === run.tick;
    if (good) same++;
    else failures.push(`rev-3 legacy run ${run.label} on ${run.seed}: ${out.score} (was ${run.score})`);
  }
  ok(runs.length === 44 && same === runs.length, `homerunRev 3: ${same} of ${runs.length} recorded runs replay to the same score, checksum and end tick`);
  // The plan: rev 1–3's is untouched; rev 4's has its own pitches, fielders and lit signs.
  let planOk = true;
  let plan3Same = true;
  for (let i = 0; i < 400; i++) {
    const seed = i * 7919 + 3;
    if (JSON.stringify(homerunPlan(seed)) !== JSON.stringify(homerunPlan(seed, 3))) plan3Same = false;
    const pl = homerunPlan(seed, 4);
    const kinds = [0, 1, 3].map((k) => pl.pitches.filter((p) => p.kind === k).length);
    if (kinds.join() !== "4,3,3" || pl.pitches.length !== 10) planOk = false;
    if (pl.fielders!.length !== 10 || pl.fielders!.some((fs) => fs.length !== 6 || fs.filter((f) => f.out).length !== 3)) planOk = false;
    if (pl.lit!.length !== 10 || pl.lit!.some((k, j) => k < 0 || k >= HOMERUN_V4_SIGNS.length || (j > 0 && k === pl.lit![j - 1]))) planOk = false;
    for (const p of pl.pitches) {
      const flight = p.arrive - p.release;
      if (p.kind === PITCH_FASTBALL && (flight < 36 || flight > 41 || p.breakX !== 0)) planOk = false;
      if (p.kind === PITCH_CURVE && (flight < 48 || flight > 54 || Math.abs(p.breakX) < 30)) planOk = false;
      if (p.kind === PITCH_CHANGEUP && (flight < 62 || flight > 70)) planOk = false;
      if (p.arrive - HOMERUN_SWING_TICKS < p.release) planOk = false;
    }
  }
  ok(plan3Same, "rev 1–3's plan is unchanged (homerunPlan(seed) is homerunPlan(seed, 3))");
  ok(planOk, "rev 4's plan: 4 fastballs (quick, straight), 3 curveballs (bending), 3 changeups (slow), six fielders a pitch (three out), a lit sign a pitch never the same twice running");
  ok(JSON.stringify(homerunPlan(77, 4)) === JSON.stringify(homerunPlanV4(77)), "rev 4's plan is the same every time");
  // Every sign is beyond the fence on its own target, and fair.
  ok(HOMERUN_V4_SIGNS.every((sg) => {
    const t = homerunV4Target(sg.x + sg.w / 2, sg.y + sg.h / 2);
    return t.sign >= 0 && t.feet > homerunFence(t.spray) && Math.abs(t.spray) < 450 && homerunV4SpotOk(sg.x + sg.w / 2, sg.y + sg.h / 2);
  }), "every sign's centre is a legal spot beyond the fence");
  ok(HOMERUN_V4_SIGNS.filter((sg) => sg.tier === "fence").every((sg) => sg.tol === 2) && HOMERUN_V4_SIGNS.filter((sg) => sg.tier === "board").every((sg) => sg.tol === 1) && HOMERUN_V4_SIGNS.filter((sg) => sg.tier === "upper").every((sg) => sg.tol === 0), "far and high signs time tighter: fence ±2 ticks, scoreboard ±1, upper deck exact");
  // Contact.
  const seed = HOMERUN_DEAL_V4[7]!;
  const pl = homerunPlan(seed, 4);
  const gap = { x: 150, y: 200 };
  const tgt = homerunV4Target(gap.x, gap.y);
  let rules = true;
  for (let i = 0; i < 10; i++) {
    const p = pl.pitches[i]!;
    const at = (dt: number) => homerunContactV4(pl, i, p.arrive - HOMERUN_SWING_TICKS + dt, gap.x, gap.y);
    for (const dt of [-1, 0, 1]) {
      const h = at(dt);
      if (h.out === OUT_WHIFF || h.spray !== tgt.spray || (h.out !== OUT_CAUGHT && h.feet !== tgt.feet) || h.dt !== dt) rules = false;
    }
    const early = at(-3);
    const late = at(3);
    if (early.spray !== tgt.spray + 3 * HOMERUN_V4_DRIFT || late.spray !== tgt.spray - 3 * HOMERUN_V4_DRIFT) rules = false;
    if (early.feet !== Math.floor((tgt.feet * (1000 - 3 * HOMERUN_V4_FALL)) / 1000)) rules = false;
    if (at(HOMERUN_V4_MISS + 1).out !== OUT_WHIFF || at(-HOMERUN_V4_MISS - 1).out !== OUT_WHIFF || at(HOMERUN_V4_MISS).out === OUT_WHIFF) rules = false;
  }
  ok(rules, "rev 4: within a tick the ball lands on the spot; early pulls left, late pushes right (2.5° a tick) and short in proportion; past 7 ticks a miss");
  // Signs: only the lit one pays, within its tolerance.
  let signRules = true;
  for (let i = 0; i < 10; i++) {
    const p = pl.pitches[i]!;
    HOMERUN_V4_SIGNS.forEach((sg, k) => {
      const cx = sg.x + sg.w / 2;
      const cy = sg.y + sg.h / 2;
      for (let dt = -3; dt <= 3; dt++) {
        const h = homerunContactV4(pl, i, p.arrive - HOMERUN_SWING_TICKS + dt, cx, cy);
        const want = k === pl.lit![i] && Math.abs(dt) <= sg.tol ? k : -1;
        if (h.sign !== want) signRules = false;
        if (Math.abs(dt) <= sg.tol && h.out !== OUT_HOMER) signRules = false;
      }
    });
  }
  ok(signRules, "rev 4: a sign struck pays only when it is the pitch's lit sign and the swing is within its tolerance (always a home run)");
  // Fielders catch what lands in their areas, short of the fence; a caught ball counts no distance.
  let catches = 0;
  let catchRules = true;
  for (let i = 0; i < 10; i++) {
    const p = pl.pitches[i]!;
    for (const f of pl.fielders![i]!) {
      const x = Math.round(homerunV4XOf(f.spray));
      const y = Math.round(homerunGroundY(f.feet));
      const t = homerunV4Target(x, y);
      const h = homerunContactV4(pl, i, p.arrive - HOMERUN_SWING_TICKS, x, y);
      const inArea = pl.fielders![i]!.some((g) => Math.abs(t.spray - g.spray) <= g.half && Math.abs(t.feet - g.feet) <= g.depth);
      if (inArea !== (h.out === OUT_CAUGHT)) catchRules = false;
      if (h.out === OUT_CAUGHT) {
        catches++;
        if (homerunV4Counted(h) !== 0) catchRules = false;
      }
    }
  }
  ok(catchRules && catches > 20, `rev 4: a ball landing in a fielder's area is caught and counts no distance (${catches} of 60 hit at the fielders caught)`);
  // The spot and the tap.
  const p0 = pl.pitches[0]!;
  const p1 = pl.pitches[1]!;
  const play = (extra: ArcadeInputEvent[]) => {
    const ev: ArcadeInputEvent[] = [];
    const all = [...extra, { t: p0.arrive - HOMERUN_SWING_TICKS, k: HOMERUN_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 }, { t: p1.arrive - HOMERUN_SWING_TICKS, k: HOMERUN_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 }].sort((x, y) => x.t - y.t);
    for (const e of all) recordInput(ev, e, HOMERUN_INPUT_RANGES_V4);
    return playLog(seed, ev, 4);
  };
  const none = play([]);
  ok(none.hits[0]!.a === HOMERUN_V4_SPOT_START.x && none.hits[0]!.b === HOMERUN_V4_SPOT_START.y, "rev 4: with no spot tapped, the pitch goes to the starting spot (straightaway centre)");
  const before = play([{ t: p0.release, k: HOMERUN_INPUT_SPOT, a: 100, b: 150, c: 0, d: 0 }]);
  ok(before.hits[0]!.a === 100 && before.hits[1]!.a === 100, "rev 4: a spot tapped by the release plays that pitch and stays for the next");
  const after = play([{ t: p0.release + 1, k: HOMERUN_INPUT_SPOT, a: 100, b: 150, c: 0, d: 0 }]);
  ok(after.hits[0]!.a === HOMERUN_V4_SPOT_START.x && after.hits[1]!.a === 100, "rev 4: a spot after the release waits for the next pitch");
  const outside = play([{ t: 20, k: HOMERUN_INPUT_SPOT, a: 100, b: 600, c: 0, d: 0 }]);
  ok(outside.hits[0]!.a === HOMERUN_V4_SPOT_START.x && outside.acted > 0, "rev 4: a spot outside the field and stands is ignored (but counts as playing)");
  const tooEarly = playLog(seed, [{ t: p0.release - HOMERUN_V4_TAP_EARLY - 1, k: HOMERUN_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 }], 4);
  ok(tooEarly.hits[0]!.out === OUT_TAKEN, "rev 4: a tap before the pitch is near swings at nothing (the pitch is taken)");
  ok(homerunCheckpoint(before).checksum !== homerunCheckpoint(none).checksum, "rev 4: the checksum carries the spots");
  // The perfect streak.
  const oracle = playLog(seed, oracleRun(seed, 4), 4);
  ok(oracle.best === 10 && oracle.perfects === 10 && oracle.bonus === 10 && oracle.homers === 10, "rev 4: the oracle's run is ten perfect swings in a row, ten home runs on the lit signs");
  const broken = oracleRun(seed, 4).map((e, j) => (e.k === HOMERUN_INPUT_TAP && j === 9 ? { ...e, t: e.t + 1 } : e));
  const b5 = playLog(seed, broken, 4);
  ok(b5.best === 5 && b5.perfects === 9, `rev 4: a swing a tick late on the fifth pitch breaks the streak (best ${b5.best}, perfect ${b5.perfects})`);
  ok(homerunV4Perfect({ ...b5.hits[4]! }) === false && homerunV4Perfect(b5.hits[0]!) === true, "rev 4: PERFECT is the arrival tick exactly");
  // The parts: 120 + 40 + 20 + 20.
  const s0 = { ...g4.init(seed), acted: 1 };
  let line = true;
  for (let f = 0; f <= 3100; f += 7) if (homerunStdParts({ ...s0, feet: f })!.find((x) => x.key === "core")!.points !== Math.floor((120 * Math.min(f, HOMERUN_V4_FULL_AT)) / HOMERUN_V4_FULL_AT)) line = false;
  ok(line, "rev 4: distance a straight line to 120 at 3,000 ft (300 a pitch)");
  ok(HOMERUN_STD_SPEC_V4.parts.reduce((a, p) => a + p.max, 0) === 200 && HOMERUN_STD_SPEC_V4.parts.map((p) => p.max).join() === "120,40,20,20", "rev 4's parts: distance 120, home runs 40, bonus signs 20, perfect streak 20 = 200");
  ok(serve(seed, [{ t: 9, k: HOMERUN_INPUT_SPOT, a: 120, b: 190, c: 0, d: 0 }], undefined, 4).out.score === 1, "rev 4: a spot tapped and never a swing scores 1");
  ok(serve(seed, [], undefined, 4).out.score === 0, "rev 4: no input scores 0");
  // The rev-4 deal.
  ok(HOMERUN_DEAL_V4.length === 300 && new Set(HOMERUN_DEAL_V4).size === 300, "the rev-4 deal holds 300 distinct seeds");
  const provedV4 = FULL ? HOMERUN_DEAL_V4 : HOMERUN_DEAL_V4.filter((_, i) => i % 13 === 0);
  let v4at200 = 0;
  for (const sd of provedV4) {
    const { out } = serve(sd, oracleRun(sd, 4), undefined, 4);
    if (!out.flagged && out.score === 200 && out.state.rev === 4) v4at200++;
    else failures.push(`rev-4 deal seed ${sd}: the oracle scores ${out.score}${out.flagged ? " (flagged)" : ""}`);
  }
  ok(v4at200 === provedV4.length, `the oracle takes ${v4at200} of ${provedV4.length} rev-4 deal seeds to exactly 200 on rev 4 through the server replay`);
  try {
    execFileSync("bun", ["scripts/homerun-deal.ts", "--rev=4", "--check"], { stdio: "pipe" });
    ok(true, "the rev-4 deal file is what homerun-deal.ts --rev=4 builds");
  } catch {
    ok(false, "the rev-4 deal file is what homerun-deal.ts --rev=4 builds");
  }
  const ev = oracleRun(HOMERUN_DEAL_V4[5]!, 4);
  const r4 = serve(HOMERUN_DEAL_V4[5]!, ev, undefined, 4);
  ok(!r4.out.flagged && r4.out.score === g4.score(r4.sim) && r4.out.desyncTick === null, "rev 4: the server replay agrees with the sim");
  ok(serve(HOMERUN_DEAL_V4[5]!, ev, 150, 4).out.flagged, "rev 4: a claimed score the replay does not give is flagged");
  ok(serve(HOMERUN_DEAL_V4[5]!, ev, undefined, 3).out.score < 50, "the rev-4 oracle's log means nothing on rev 3 (its kinds are not rev 3's)");
  const help = `${PUZZLE_INSTRUCTIONS.homerun?.goal ?? ""} ${(PUZZLE_INSTRUCTIONS.homerun?.how ?? []).map((h) => `${h.action} ${h.detail}`).join(" ")}`;
  ok(/spot/i.test(help) && /ring/i.test(help) && /fielder/i.test(help) && /lit sign/i.test(help) && !/Contact/.test(help), "the help names the spot, the ring, the fielders and the lit sign (and no Contact / Power)");
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  console.log(`FAIL homerun-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS homerun-check: ${checks} checks — plans, replay, rev 1's 300-seed deal (${proved.length} proved at 200) and recorded runs, rev 2's finer aim, deal and recorded runs, rev 3's swing choice, timing, deal and recorded runs, rev 4's spot, tap, fielders, lit signs, streak, parts and deal, and help`);
