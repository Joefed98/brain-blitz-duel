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
 *     rev 3) is what `homerun-deal.ts --rev=3` builds and rooms deal from it; the help names the swing choice and the tell.
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
} from "../src/lib/arcade/homerun";
import { encodeHomerunRun, replayHomerunRun } from "../src/lib/duel/homerun";
import { HOMERUN_DEAL } from "../src/lib/duel/homerunDeal.server";
import { HOMERUN_DEAL_V2 } from "../src/lib/duel/homerunDealV2.server";
import { HOMERUN_DEAL_V3 } from "../src/lib/duel/homerunDealV3.server";
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
  for (const part of ["Distance up to 130", "Home runs up to 50", "Sign hits up to 20"]) ok(help.includes(part), `the help states "${part}"`);
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
  ok(!/chip at the top names/i.test(help) && /radar/i.test(help), "the help says the pitch is shown on the radar board after it is thrown, never named before");
}

/* 9. homerunRev 3. */
{
  const g3 = homerunGameFor(3);
  ok(g3.init(5).rev === HOMERUN_REV_3 && homerunGameFor(2).init(5).rev === 2, "homerunGameFor: rev 3 on 3, rev 2 on 2");
  const dealt = generateHomerun();
  ok(dealt.homerunRev === 3 && HOMERUN_DEAL_V3.includes(dealt.seed), "rooms deal homerunRev 3 from rev 3's proved deal");
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
  const help = `${PUZZLE_INSTRUCTIONS.homerun?.goal ?? ""} ${(PUZZLE_INSTRUCTIONS.homerun?.how ?? []).map((h) => `${h.action} ${h.detail}`).join(" ")}`;
  ok(/Contact/.test(help) && /Power/.test(help) && /tell/i.test(help), "the help names the Contact and Power swings and the pitcher's tell");
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  console.log(`FAIL homerun-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS homerun-check: ${checks} checks — plans, replay, rev 1's 300-seed deal (${proved.length} proved at 200) and recorded runs, rev 2's finer aim, deal and recorded runs, rev 3's swing choice, timing and deal, parts, contact and help`);
