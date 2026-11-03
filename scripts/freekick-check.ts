/**
 * Free Kick (freekickRev 1, 30 Oct 2026; docs/arcade-standard/freekick.md):
 *
 *  1. the plan comes from the seed alone: ten kicks, each 17.5–25 m out, a wall of 3–5 covering the near post, the
 *     keeper on the far side, wind −5…5; exactly four targets on four different kicks (a corner behind the wall or
 *     the crossbar);
 *  2. a replay is deterministic (twice → the same final state and checkpoints) and the server path
 *     (replayFreekickRun) agrees with the sim; a tampered claimed score is flagged; out-of-range payloads are
 *     clamped (and flagged); a flight is the same whatever tick the kick is taken on (the keeper reacts to the flight
 *     alone);
 *  3. the deal: 300 seeds, all distinct, and the oracle takes each to exactly 200 through the server replay, every
 *     part at its maximum (quick depth 24 spread through the deal, CHECKS_FULL=1 all 300); the deal file is what
 *     freekick-deal.ts builds (CHECKS_FULL=1);
 *  4. the parts: maximums 130 + 40 + 20 + 10 = 200; core 10 a goal + 3 placement (straight line), targets 10 each,
 *     round the wall 2 each, five in a row 10; no input scores 0, a kick that did nothing scores 1; untaken kicks are
 *     misses and the run still ends within 75 s;
 *  5. rules: a bar target counts only on a goal; a corner target only through its hoop; curled round the wall only
 *     beside the wall's end with the curl's own displacement back across at least FREEKICK_CURL_MIN.
 *
 * freekickRev 2 (Top Bins, 31 Oct 2026; sections 1–5 above prove rev 1 and are unchanged):
 *
 *  6. legacy identity: 48 rev-1 runs recorded before rev 2 (scripts/fixtures/freekick-rev1-legacy.json, by
 *     scripts/freekick-legacy-record.ts) replay to the same score, final state and checkpoints, through the sim and
 *     the server (stamped 1 and unstamped);
 *  7. the rev-2 plan: every spot 18–32 yards from the goal's centre at up to 35° either side (both ends of the range
 *     reached), no wind, a wall of 3–5 set by the spot (4–5 central inside 25 yards, 3 wide or beyond 30 yards),
 *     covering the near post; the keeper inside ±3 m, beyond the posts' bisector away from the wall; four targets;
 *  8. rev 2's replay: deterministic, the server agrees (stamped 2), a kick's flight and the keeper's dive are the
 *     same whatever tick it is taken on, and a stamp of 1 or none replays the same log as rev 1;
 *  9. the rev-2 deal: 300 distinct seeds, the oracle takes each to exactly 200 with every part full through the
 *     server replay (24 at quick depth, all 300 with CHECKS_FULL=1, plus the file's rebuild); rev 2's parts are
 *     rev 1's (130 / 40 / 20 / 10) on their own stamp.
 *
 * freekickRev 3 (the prepared shot, 1 Nov 2026; sections 1–9 above prove revs 1 and 2 and are unchanged but for which
 * stamp rooms deal):
 *
 * 10. legacy identity: 80 rev-2 runs recorded on main before rev 3 (scripts/fixtures/freekick-rev2-legacy.json, by
 *     `bun scripts/freekick-legacy-record.ts --rev=2`: the oracle, random strokes and the skill-band bot at good and
 *     great) replay to the same score, final state and checkpoints through the sim and the server (stamped 2);
 * 11. rev 3's inputs and rules: its own input kinds (AIM, CURL, POWER, STRIKE; kind 1 has no range there, and earlier
 *     revisions have none for the new kinds, so they never reach those sims); the meter a triangle of the ticks since
 *     POWER; a strike in the sweet zone flies the solved shot exactly (crossing the goal plane within 3 cm of the
 *     target on clean ghost flights); too much arrives higher, too little lower and slower, both by how far off; aim
 *     and curl redone freely until POWER and ignored after it; POWER before an aim, STRIKE before POWER and anything
 *     outside the aim phase do nothing; an untaken kick is a miss; the run is 90 s (ten 540-tick slots); deterministic,
 *     the server agrees (stamped 3), a tampered claim is flagged, a kick is the same whatever tick it is set on;
 * 12. the rev-3 deal: 300 distinct seeds, the oracle takes each to exactly 200 with every part full through the server
 *     replay (24 at quick depth, all 300 with CHECKS_FULL=1, plus the file's rebuild);
 * 13. rev 3's parts: rev 2's (130 / 40 / 20 / 10) on their own stamp, the core a straight line full at
 *     FREEKICK_V3_CORE_FULL; no input 0, a kick that did nothing 1 (rooms dealt freekickRev 3 until 3 Nov 2026).
 *
 * freekickRev 4 (the drawn shot, 3 Nov 2026; sections 1–13 above prove revs 1–3 and are unchanged but for which stamp
 * rooms deal):
 *
 * 14. legacy identity: 112 rev-3 runs recorded on main 6326101 before rev 4 (scripts/fixtures/freekick-rev3-legacy.json,
 *     by `bun scripts/freekick-legacy-record.ts --rev=3`: the oracle, random prepared shots and the skill-band bot at
 *     weak, good, great and elite) replay to the same score, final state and checkpoints through the sim and the server
 *     (stamped 3), and no rev-3 state carries rev 4's Curl bonus count;
 * 15. rev 4's inputs and rules: SHOT (kind 6) with POWER and STRIKE (no AIM or CURL range on rev 4; no SHOT range
 *     before it); a SHOT sets the target and the curl together, redrawn freely until POWER and ignored after it; POWER
 *     needs a shot; the meter, the solver and the strike are rev 3's; the corner hoop shrinks evenly from FK_HOOP_R on
 *     the first kick to 70 % on the last, tucked in its corner, judged on the kick's own radius (rev 1–3 keep the full
 *     hoop); a goal from a shot bent at least FK_V4_BENT counts for the Curl bonus, a gentler one or a miss does not;
 *     deterministic, the server agrees (stamped 4), a tampered claim is flagged, the checksum carries the Curl bonus;
 * 16. the rev-4 deal: 300 distinct seeds, the oracle takes each to exactly 200 with every part full through the server
 *     replay (24 at quick depth, all 300 with CHECKS_FULL=1, plus the file's rebuild), every oracle goal bent;
 * 17. rev 4's parts: Goals 120 (full at FREEKICK_V4_CORE_FULL), Targets 40, Round the wall 10, Curl bonus 20, Five in a
 *     row 10 = 200; the features never cost core; no input 0, a kick that did nothing 1; rooms deal freekickRev 4.
 *
 *   bun scripts/freekick-check.ts
 */
import { execFileSync } from "node:child_process";
import { recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  FK_AIM,
  FK_M,
  FK_OUT_GOAL,
  FK_OUT_UNTAKEN,
  FK_TARGET_BAR,
  FK_TARGET_LEFT,
  FK_TARGET_NONE,
  FK_TARGET_RIGHT,
  FREEKICK_CORE_MAX,
  FREEKICK_CURL_MIN,
  FREEKICK_INPUT_KICK,
  FREEKICK_INPUT_RANGES,
  FREEKICK_KICKS,
  FREEKICK_RUN_TICKS,
  FREEKICK_STD_SPEC,
  FREEKICK_TARGETS,
  fkFlightStep,
  fkJudge,
  fkLaunch,
  fkSeedPlan,
  freekickCheckpoint,
  freekickGame,
  freekickStdParts,
  type FreekickCheckpoint,
  type FreekickState,
} from "../src/lib/arcade/freekick";
import { readFileSync } from "node:fs";
import { stdSpecMax } from "../src/lib/arcade/arcadeStandard";
import {
  FK_GOAL_HALF_W,
  FK_V2_ANGLE_MAX,
  FK_V2_DIST_MAX,
  FK_V2_DIST_MIN,
  FK_V2_YARD,
  FREEKICK_REV_2,
  FREEKICK_REV_DEALT,
  FREEKICK_V2_STD_SPEC,
  fkLocal,
  freekickGameFor,
  freekickGameV2,
} from "../src/lib/arcade/freekick";
import { encodeFreekickRun, replayFreekickRun } from "../src/lib/duel/freekick";
import { FREEKICK_DEAL } from "../src/lib/duel/freekickDeal.server";
import { FREEKICK_DEAL_V2 } from "../src/lib/duel/freekickDealV2.server";
import { fkFly, FK_V3_CLEAN_TICKS, oracleRun, oracleShots, oracleShotsV3, playShots, playShotsV3 } from "./freekick-oracle";
import {
  FK_FLIGHT,
  FK_V3_AIM_X_MAX,
  FK_V3_AIM_Y_MIN,
  FK_V3_METER_PERIOD,
  FK_V3_ZONE_HI,
  FK_V3_ZONE_LO,
  FREEKICK_CORE_FULL,
  FREEKICK_INPUT_AIM,
  FREEKICK_INPUT_CURL,
  FREEKICK_INPUT_POWER,
  FREEKICK_INPUT_RANGES_V3,
  FREEKICK_INPUT_STRIKE,
  FREEKICK_REV_3,
  FREEKICK_V3_CORE_FULL,
  FREEKICK_V3_RUN_TICKS,
  FREEKICK_V3_STD_SPEC,
  fkDeadline,
  fkDeadlineFor,
  fkGhostCross,
  fkRunTicksFor,
  fkV3Launch,
  fkV3Meter,
  fkV3MeterError,
  fkV3Solve,
  freekickGameV3,
} from "../src/lib/arcade/freekick";
import { FREEKICK_DEAL_V3 } from "../src/lib/duel/freekickDealV3.server";
import { FREEKICK_DEAL_V4 } from "../src/lib/duel/freekickDealV4.server";
import { generateFreekick } from "../src/lib/duel/sports.server";
import { oracleShotsV4, playShotsV4 } from "./freekick-oracle";
import {
  FK_GOAL_H,
  FK_HOOP_R,
  FK_V4_BENT,
  FK_V4_HOOP_LAST_PERMILLE,
  FREEKICK_INPUT_RANGES_V4,
  FREEKICK_INPUT_SHOT,
  FREEKICK_REV_4,
  FREEKICK_V4_CORE_FULL,
  FREEKICK_V4_STD_SPEC,
  fkHoopRFor,
  freekickGameV4,
} from "../src/lib/arcade/freekick";
import { FREEKICK_TIME_MS } from "../src/lib/duel/types";

const cmOf = (u: number) => Math.round((u * 100) / FK_M);
import { playRev1, type FkLegacyRun } from "./freekick-legacy-record";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const FULL = process.env["CHECKS_FULL"] === "1";

function play(seed: number, events: ArcadeInputEvent[]): { state: FreekickState; cps: FreekickCheckpoint[] } {
  const at = new Map(events.map((e) => [e.t, e]));
  let s = freekickGame.init(seed);
  const cps: FreekickCheckpoint[] = [];
  while (!freekickGame.isOver(s)) {
    s = freekickGame.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 60 === 0) cps.push(freekickCheckpoint(s));
  }
  return { state: s, cps };
}

function serve(seed: number, events: ArcadeInputEvent[], claim?: number) {
  const { state, cps } = play(seed, events);
  const raw = encodeFreekickRun({ seed, claimedScore: claim ?? freekickGame.score(state), events, endTick: state.tick, checkpoints: cps });
  return { state, result: replayFreekickRun(seed, raw, 1) };
}

/* 1. The plan. */
for (const seed of [1, 2, 77, 12345, 987654321]) {
  const plan = fkSeedPlan(seed);
  ok(plan.kicks.length === FREEKICK_KICKS, `plan ${seed}: ten kicks`);
  ok(plan.kicks.filter((k) => k.target !== FK_TARGET_NONE).length === FREEKICK_TARGETS, `plan ${seed}: four targets on four kicks`);
  for (const k of plan.kicks) {
    const d = Math.hypot(k.bx, k.bz) / FK_M;
    ok(-k.bz >= 17.5 * FK_M && -k.bz <= 25 * FK_M, `plan ${seed}: distance ${d.toFixed(1)}`);
    ok(k.wallN >= 3 && k.wallN <= 5, `plan ${seed}: wall of ${k.wallN}`);
    ok(k.wind >= -5 && k.wind <= 5, `plan ${seed}: wind ${k.wind}`);
    ok(Math.sign(k.keeperX) === -k.side, `plan ${seed}: keeper on the far side`);
    if (k.target === FK_TARGET_LEFT || k.target === FK_TARGET_RIGHT) ok((k.target === FK_TARGET_LEFT ? -1 : 1) === k.side, `plan ${seed}: corner target behind the wall`);
  }
  ok(JSON.stringify(fkSeedPlan(seed)) === JSON.stringify(plan), `plan ${seed}: same twice`);
}

/* 2. Determinism, the server path, tampering, clamping, flights independent of the tick. */
{
  const seed = FREEKICK_DEAL[3]!;
  const events = oracleRun(seed);
  const a = play(seed, events);
  const b = play(seed, events);
  ok(JSON.stringify(a.state) === JSON.stringify(b.state), "replay: deterministic final state");
  ok(a.cps.map((c) => c.checksum).join() === b.cps.map((c) => c.checksum).join(), "replay: deterministic checkpoints");
  const served = serve(seed, events);
  ok(!served.result.flagged && served.result.score === freekickGame.score(a.state), "server: agrees with the sim, unflagged");
  ok(served.result.std === true && served.result.finished && served.result.parts.length === 4, "server: std result, finished, four parts");
  const tampered = serve(seed, events, 199);
  ok(tampered.result.flagged && tampered.result.score === 200, "server: a tampered claimed score is flagged and the replay keeps its own");
  // Clamping: an out-of-range kick replays as the clamped one, flagged.
  const t0 = 31;
  const wild: ArcadeInputEvent[] = [{ t: t0, k: FREEKICK_INPUT_KICK, a: 9999, b: -9999, c: 5000, d: 7 }];
  const clamped: ArcadeInputEvent[] = [{ t: t0, k: FREEKICK_INPUT_KICK, a: 500, b: -100, c: 1000, d: 0 }];
  const rw = serve(1, wild);
  const rc = serve(1, clamped);
  ok(rw.result.flagged && rw.result.inputDiag.clamped === 1, "clamp: out-of-range payload repaired and flagged");
  ok(JSON.stringify(rw.result.state) === JSON.stringify(rc.result.state), "clamp: replays as the clamped kick");
  ok(FREEKICK_INPUT_RANGES.length === 1 && FREEKICK_INPUT_RANGES[0]!.k === FREEKICK_INPUT_KICK, "ranges: one kind");
  // The same kick on different ticks flies (and the keeper reacts) the same.
  const shot = oracleShots(seed)[0]!;
  const early = playShots(seed, [shot], [0]).state;
  const late = playShots(seed, [shot], [150]).state;
  ok(early.outs[0] === late.outs[0] && early.places[0] === late.places[0] && early.flags[0] === late.flags[0], "flight: independent of the kick's tick");
}

/* 3. The deal. */
{
  ok(FREEKICK_DEAL.length === 300, `deal: 300 seeds (${FREEKICK_DEAL.length})`);
  ok(new Set(FREEKICK_DEAL).size === FREEKICK_DEAL.length, "deal: distinct");
  ok(FREEKICK_DEAL.every((s) => Number.isInteger(s) && s > 0 && s < 0x7fffffff), "deal: valid seeds");
  const idx = FULL ? FREEKICK_DEAL.map((_, i) => i) : Array.from({ length: 24 }, (_, i) => Math.floor((i * FREEKICK_DEAL.length) / 24));
  let full = 0;
  for (const i of idx) {
    const seed = FREEKICK_DEAL[i]!;
    const { result } = serve(seed, oracleRun(seed));
    const maxed = result.parts.every((p) => p.points === p.max);
    if (result.score === 200 && !result.flagged && maxed) full++;
    else failures.push(`deal: seed ${seed} (#${i}) oracle scored ${result.score}${result.flagged ? " flagged" : ""}`);
  }
  checks++;
  console.log(`  deal: ${full}/${idx.length} oracle runs at 200 with every part full`);
  if (FULL) {
    try {
      execFileSync("bun", ["scripts/freekick-deal.ts", "--check"], { stdio: "pipe" });
      ok(true, "deal file");
    } catch {
      ok(false, "deal: the file is not what freekick-deal.ts builds");
    }
  }
}

/* 4. The parts. */
{
  ok(stdSpecMax(FREEKICK_STD_SPEC) === 200, "spec: maximums sum to 200");
  ok(FREEKICK_STD_SPEC.parts.map((p) => p.max).join() === "130,40,20,10", "spec: 130 / 40 / 20 / 10");
  ok(FREEKICK_STD_SPEC.parts.every((p) => (p.how ?? "").length > 0), "spec: every part says how");
  const seed = FREEKICK_DEAL[0]!;
  const idle = serve(seed, []);
  ok(idle.result.score === 0 && idle.state.acted === 0, "idle: no input scores 0");
  ok(idle.state.outs.every((o) => o === FK_OUT_UNTAKEN), "idle: every kick untaken");
  ok(idle.state.tick <= FREEKICK_RUN_TICKS, "idle: the run ends within 75 s");
  // One wasted kick (straight into the ground at no power).
  const waste = playShots(seed, [{ a: 0, b: 0, c: 0 }]).events;
  const w = serve(seed, waste);
  ok(w.state.acted === 1 && w.result.score >= 1, `waste: one kick that did nothing scores ${w.result.score} (≥ 1)`);
  ok(w.result.goals === 0 && w.result.score === 1, "waste: exactly 1");
  // Fixed amounts on synthetic states.
  const base = freekickGame.init(seed);
  const mk = (o: Partial<FreekickState>) => freekickStdParts({ ...base, ...o })!;
  const p1 = mk({ goals: 1, units: 100 });
  ok(p1[0]!.points === 10, "core: a goal with no placement is 10");
  const p2 = mk({ goals: 1, units: 130 });
  ok(p2[0]!.points === 13, "core: a goal placed in full is 13");
  const p3 = mk({ goals: 10, units: 1300 });
  ok(p3[0]!.points === FREEKICK_CORE_MAX, "core: ten placed goals are 130");
  const p4 = mk({ goals: 3, units: 345 });
  ok(p4[0]!.points === 34, "core: straight line (345 units → 34)");
  ok(mk({ targets: 3 })[1]!.points === 30 && mk({ targets: 4 })[1]!.points === 40, "targets: 10 each");
  ok(mk({ curled: 7 })[2]!.points === 14 && mk({ curled: 10 })[2]!.points === 20, "round the wall: 2 each");
  ok(mk({ best: 4 })[3]!.points === 0 && mk({ best: 5 })[3]!.points === 10 && mk({ best: 9 })[3]!.points === 10, "five in a row: 10 at five");
}

/* 5. Rules. */
{
  let barChecked = 0;
  let cornerChecked = 0;
  let curlChecked = 0;
  for (const seed of FREEKICK_DEAL.slice(0, 12)) {
    const plan = fkSeedPlan(seed);
    const shots = oracleShots(seed);
    plan.kicks.forEach((k, i) => {
      const f = fkFly(k, shots[i]!);
      const j = fkJudge(k, f);
      if (k.target === FK_TARGET_BAR) {
        barChecked++;
        ok(j.target && f.bar === 1 && j.goal, `rules: bar target in off the bar (${seed}/${i})`);
        // The same flight judged as not a goal earns no target.
        ok(!fkJudge(k, { ...f, out: 4 }).target, "rules: a bar target needs the goal");
      }
      if (k.target === FK_TARGET_LEFT || k.target === FK_TARGET_RIGHT) {
        cornerChecked++;
        const hx = (k.target === FK_TARGET_LEFT ? -1 : 1) * 3.11 * FK_M;
        ok(Math.hypot(f.crossX - hx, f.crossY - 1.89 * FK_M) <= 0.56 * FK_M, `rules: corner target through its hoop (${seed}/${i})`);
      }
      if (j.curled) {
        curlChecked++;
        ok((f.wallSide === -1 && f.cu >= FREEKICK_CURL_MIN) || (f.wallSide === 1 && f.cu <= -FREEKICK_CURL_MIN), "rules: curled beside the wall's end, curl back ≥ the minimum");
        ok(!fkJudge(k, { ...f, wallSide: 2 }).curled, "rules: over the wall is not round it");
        ok(!fkJudge(k, { ...f, cu: Math.trunc(f.cu / 4) }).curled || Math.abs(f.cu / 4) >= FREEKICK_CURL_MIN, "rules: too little curl is not round it");
      }
    });
  }
  ok(barChecked > 0 && cornerChecked > 0 && curlChecked > 0, "rules: each rule exercised");
  // The keeper reacts to the flight alone: a flight stepped twice from the same launch is identical.
  const k = fkSeedPlan(FREEKICK_DEAL[5]!).kicks[0]!;
  const f1 = fkLaunch(k, 40, 60, 520);
  const f2 = fkLaunch(k, 40, 60, 520);
  for (let i = 0; i < 90; i++) {
    fkFlightStep(k, f1);
    fkFlightStep(k, f2);
  }
  ok(JSON.stringify(f1) === JSON.stringify(f2), "keeper: same flight, same dive");
  // A kick taken outside the aim window does nothing.
  const s0 = freekickGame.init(1);
  const s1 = freekickGame.step(s0, { t: 1, k: FREEKICK_INPUT_KICK, a: 0, b: 0, c: 500, d: 0 });
  ok(s1.acted === 0 && s1.phase !== FK_AIM, "input: a kick during the whistle is ignored");
  void recordInput;
  void FK_OUT_GOAL;
}

/* 6. Legacy identity (rev 1 runs recorded before rev 2). */
{
  const runs = JSON.parse(readFileSync("scripts/fixtures/freekick-rev1-legacy.json", "utf8")) as FkLegacyRun[];
  ok(runs.length === 48, `legacy: 48 recorded rev-1 runs (${runs.length})`);
  let same = 0;
  for (const r of runs) {
    const now = playRev1(r.seed, r.events);
    const sim = now.score === r.score && now.digest === r.digest && now.checksums.join() === r.checksums.join();
    const { state, cps } = play(r.seed, r.events);
    const raw = encodeFreekickRun({ seed: r.seed, claimedScore: r.score, events: r.events, endTick: state.tick, checkpoints: cps });
    const quiet = console.error;
    console.error = () => {};
    const stamped = replayFreekickRun(r.seed, raw, 1);
    const unstamped = replayFreekickRun(r.seed, raw, undefined);
    console.error = quiet;
    const server = !stamped.flagged && stamped.score === r.score && unstamped.score === r.score && JSON.stringify(stamped.state) === JSON.stringify(unstamped.state);
    if (sim && server) same++;
    else failures.push(`legacy: seed ${r.seed} ${r.label} replays to ${now.score} (recorded ${r.score})${sim ? "" : " sim differs"}${server ? "" : " server differs"}`);
  }
  checks++;
  console.log(`  legacy: ${same}/${runs.length} rev-1 runs identical (sim and server, stamped 1 and unstamped)`);
  ok(freekickGameFor(undefined) === freekickGame && freekickGameFor(1) === freekickGame && freekickGameFor(2) === freekickGameV2, "games: unstamped and 1 play rev 1, 2 plays rev 2");
}

/* 7. The rev-2 plan. */
{
  let far = 0;
  let near = 0;
  let wideL = 0;
  let wideR = 0;
  const walls = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 400; i++) {
    const seed = (i * 7919 + 13) | 0;
    const plan = fkSeedPlan(seed, FREEKICK_REV_2);
    ok(plan.kicks.length === FREEKICK_KICKS, `v2 plan ${seed}: ten kicks`);
    ok(plan.kicks.filter((k) => k.target !== FK_TARGET_NONE).length === FREEKICK_TARGETS, `v2 plan ${seed}: four targets`);
    for (const k of plan.kicks) {
      const d = Math.hypot(k.bx, k.bz);
      const deg = (Math.atan2(k.bx, -k.bz) * 180) / Math.PI;
      ok(d >= FK_V2_DIST_MIN - 2 && d <= FK_V2_DIST_MAX + 2, `v2 plan ${seed}: ${(d / FK_V2_YARD).toFixed(2)} yards`);
      ok(Math.abs(deg) <= 35.01, `v2 plan ${seed}: ${deg.toFixed(2)}°`);
      ok(k.wind === 0, `v2 plan ${seed}: no wind`);
      ok(k.wallN >= 3 && k.wallN <= 5, `v2 plan ${seed}: wall of ${k.wallN}`);
      const yards = d / FK_V2_YARD;
      if (Math.abs(deg) * 1000 <= (210 * 180) / Math.PI && yards <= 25) ok(k.wallN >= 4, `v2 plan ${seed}: central inside 25 yards → 4–5 (${k.wallN})`);
      if (Math.abs(deg) >= (436 * 180) / Math.PI / 1000 + 0.01 || yards >= 30.01) ok(k.wallN === 3, `v2 plan ${seed}: wide or beyond 30 yards → 3 (${k.wallN}, ${yards.toFixed(1)} yd ${deg.toFixed(1)}°)`);
      // The wall covers the near post (its line crosses the near post's ray inside the wall's span).
      const post = fkLocal(k, k.side * FK_GOAL_HALF_W, 0);
      const uAt = (post.u * 9.15 * FK_M) / post.w;
      ok(uAt > k.wallL && uAt < k.wallR, `v2 plan ${seed}: the wall covers the near post`);
      // The keeper: inside ±3 m, beyond the posts' bisector away from the wall.
      const dL = Math.hypot(k.bx + FK_GOAL_HALF_W, k.bz);
      const dR = Math.hypot(k.bx - FK_GOAL_HALF_W, k.bz);
      const xb = -FK_GOAL_HALF_W + (2 * FK_GOAL_HALF_W * dL) / (dL + dR);
      ok(Math.abs(k.keeperX) <= 3 * FK_M, `v2 plan ${seed}: keeper inside ±3 m`);
      ok(Math.abs(k.keeperX) === 3 * FK_M || (-k.side * (k.keeperX - xb) >= 0.3 * FK_M - 2 && -k.side * (k.keeperX - xb) <= 1.0 * FK_M + 2), `v2 plan ${seed}: keeper 0.3–1.0 m beyond the bisector, away from the wall`);
      if (k.target === FK_TARGET_LEFT || k.target === FK_TARGET_RIGHT) ok((k.target === FK_TARGET_LEFT ? -1 : 1) === k.side, `v2 plan ${seed}: corner target behind the wall`);
      if (yards >= 31) far++;
      if (yards <= 19) near++;
      if (deg <= -32) wideL++;
      if (deg >= 32) wideR++;
      walls[k.wallN]!++;
    }
    ok(JSON.stringify(fkSeedPlan(seed, FREEKICK_REV_2)) === JSON.stringify(plan), `v2 plan ${seed}: same twice`);
  }
  ok(far > 0 && near > 0 && wideL > 0 && wideR > 0, `v2 plan: the range's ends are reached (${near} near, ${far} far, ${wideL} wide left, ${wideR} wide right)`);
  ok(walls[3]! > 0 && walls[4]! > 0 && walls[5]! > 0, `v2 plan: walls of 3, 4 and 5 all occur (${walls.slice(3).join(" / ")})`);
  ok(FK_V2_ANGLE_MAX === 611 && Math.round(FK_V2_DIST_MIN / FK_V2_YARD) === 18 && Math.round(FK_V2_DIST_MAX / FK_V2_YARD) === 32, "v2 plan: the range is 18–32 yards, 35°");
}

/* 8. Rev 2's replay. */
function play2(seed: number, events: ArcadeInputEvent[]) {
  const at = new Map(events.map((e) => [e.t, e]));
  let s = freekickGameV2.init(seed);
  const cps: FreekickCheckpoint[] = [];
  while (!freekickGameV2.isOver(s)) {
    s = freekickGameV2.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 60 === 0) cps.push(freekickCheckpoint(s));
  }
  return { state: s, cps };
}
function serve2(seed: number, events: ArcadeInputEvent[], rev: number | null = FREEKICK_REV_2, claim?: number) {
  const { state, cps } = play2(seed, events);
  const raw = encodeFreekickRun({ seed, claimedScore: claim ?? freekickGameV2.score(state), events, endTick: state.tick, checkpoints: cps });
  const quiet = console.error;
  console.error = () => {};
  const result = replayFreekickRun(seed, raw, rev);
  console.error = quiet;
  return { state, result };
}
{
  const seed = FREEKICK_DEAL_V2[3]!;
  const events = oracleRun(seed, FREEKICK_REV_2);
  const a = play2(seed, events);
  const b = play2(seed, events);
  ok(a.state.freekickRev === FREEKICK_REV_2, "v2 replay: the state carries freekickRev 2");
  ok(JSON.stringify(a.state) === JSON.stringify(b.state) && a.cps.map((c) => c.checksum).join() === b.cps.map((c) => c.checksum).join(), "v2 replay: deterministic");
  const served = serve2(seed, events);
  ok(!served.result.flagged && served.result.score === freekickGameV2.score(a.state) && served.result.score === 200, `v2 server: agrees with the sim (${served.result.score})`);
  ok(serve2(seed, events, FREEKICK_REV_2, 150).result.flagged, "v2 server: a tampered claimed score is flagged");
  const asV1 = serve2(seed, events, 1);
  const v1 = serve(seed, events);
  ok(asV1.result.state.freekickRev === 1 && asV1.result.score === v1.result.score, "v2 server: the same log stamped 1 replays as rev 1");
  ok(serve2(seed, events, null).result.state.freekickRev === 1, "v2 server: an unstamped log replays as rev 1");
  const shot = oracleShots(seed, FREEKICK_REV_2)[0]!;
  const early = playShots(seed, [shot], [0], FREEKICK_REV_2).state;
  const late = playShots(seed, [shot], [150], FREEKICK_REV_2).state;
  ok(early.outs[0] === late.outs[0] && early.places[0] === late.places[0] && early.flags[0] === late.flags[0], "v2 flight: independent of the kick's tick");
  // The keeper: still until he reacts, then the same dive for the same flight.
  const k = fkSeedPlan(FREEKICK_DEAL_V2[5]!, FREEKICK_REV_2).kicks[2]!;
  const f1 = fkLaunch(k, 40, 60, 620);
  const f2 = fkLaunch(k, 40, 60, 620);
  let still = true;
  for (let i = 0; i < 110; i++) {
    fkFlightStep(k, f1);
    fkFlightStep(k, f2);
    if ((f1.react < 0 || f1.t < f1.react) && f1.kx !== k.keeperX) still = false;
  }
  ok(JSON.stringify(f1) === JSON.stringify(f2), "v2 keeper: same flight, same dive");
  ok(still && f1.react > 0, "v2 keeper: stands still until he reacts");
}

/* 9. The rev-2 deal and parts. */
{
  // Rooms dealt freekickRev 2 until 1 Nov 2026; rev 3 is dealt now (section 13), rev 2 still replays on its own.
  ok(FREEKICK_REV_DEALT > FREEKICK_REV_2 && freekickGameFor(FREEKICK_REV_2) === freekickGameV2, "rooms deal a stamp after freekickRev 2, which still replays as rev 2");
  ok(FREEKICK_DEAL_V2.length === 300 && new Set(FREEKICK_DEAL_V2).size === 300, `v2 deal: 300 distinct seeds (${FREEKICK_DEAL_V2.length})`);
  const idx = FULL ? FREEKICK_DEAL_V2.map((_, i) => i) : Array.from({ length: 24 }, (_, i) => Math.floor((i * FREEKICK_DEAL_V2.length) / 24));
  let full = 0;
  for (const i of idx) {
    const seed = FREEKICK_DEAL_V2[i]!;
    const { result } = serve2(seed, oracleRun(seed, FREEKICK_REV_2));
    if (result.score === 200 && !result.flagged && result.parts.every((p) => p.points === p.max)) full++;
    else failures.push(`v2 deal: seed ${seed} (#${i}) oracle scored ${result.score}${result.flagged ? " flagged" : ""}`);
  }
  checks++;
  console.log(`  v2 deal: ${full}/${idx.length} oracle runs at 200 with every part full`);
  if (FULL) {
    try {
      execFileSync("bun", ["scripts/freekick-deal.ts", "--rev=2", "--check"], { stdio: "pipe" });
      ok(true, "v2 deal file");
    } catch {
      ok(false, "v2 deal: the file is not what freekick-deal.ts --rev=2 builds");
    }
  }
  ok(stdSpecMax(FREEKICK_V2_STD_SPEC) === 200 && FREEKICK_V2_STD_SPEC.rev === FREEKICK_REV_2, "v2 spec: 200 on freekickRev 2");
  ok(JSON.stringify(FREEKICK_V2_STD_SPEC.parts) === JSON.stringify(FREEKICK_STD_SPEC.parts), "v2 spec: rev 1's parts exactly");
  const s0 = { ...freekickGameV2.init(FREEKICK_DEAL_V2[0]!), acted: 1 };
  const p = freekickStdParts({ ...s0, goals: 3, units: 345, targets: 2, curled: 3, best: 5 })!;
  ok(p.map((x) => x.points).join() === "34,20,6,10", `v2 parts: as rev 1 (${p.map((x) => x.points).join()})`);
  ok(serve2(FREEKICK_DEAL_V2[0]!, []).result.score === 0, "v2 idle: no input scores 0");
  const waste = playShots(FREEKICK_DEAL_V2[0]!, [{ a: 0, b: 0, c: 0 }], [], FREEKICK_REV_2).events;
  ok(serve2(FREEKICK_DEAL_V2[0]!, waste).result.score === 1, "v2 waste: one kick that did nothing scores 1");
}

/* 10. Legacy identity (rev 2 runs recorded before rev 3). */
{
  const runs = JSON.parse(readFileSync("scripts/fixtures/freekick-rev2-legacy.json", "utf8")) as FkLegacyRun[];
  ok(runs.length === 80, `legacy v2: 80 recorded rev-2 runs (${runs.length})`);
  ok(new Set(runs.map((r) => r.score)).size > 10, "legacy v2: the runs cover a spread of scores");
  let same = 0;
  for (const r of runs) {
    const now = playRev1(r.seed, r.events, FREEKICK_REV_2);
    const sim = now.score === r.score && now.digest === r.digest && now.checksums.join() === r.checksums.join();
    const { state, cps } = play2(r.seed, r.events);
    const raw = encodeFreekickRun({ seed: r.seed, claimedScore: r.score, events: r.events, endTick: state.tick, checkpoints: cps });
    const quiet = console.error;
    console.error = () => {};
    const served = replayFreekickRun(r.seed, raw, FREEKICK_REV_2);
    console.error = quiet;
    const server = !served.flagged && served.score === r.score && JSON.stringify(served.state) === JSON.stringify(state) && !("aimX" in served.state);
    if (sim && server) same++;
    else failures.push(`legacy v2: seed ${r.seed} ${r.label} replays to ${now.score} (recorded ${r.score})${sim ? "" : " sim differs"}${server ? "" : " server differs"}`);
  }
  checks++;
  console.log(`  legacy v2: ${same}/${runs.length} rev-2 runs identical (sim and server, stamped 2)`);
}

/* 11. Rev 3's inputs and rules. */
function play3(seed: number, events: ArcadeInputEvent[]) {
  const at = new Map(events.map((e) => [e.t, e]));
  let s = freekickGameV3.init(seed);
  const cps: FreekickCheckpoint[] = [];
  while (!freekickGameV3.isOver(s)) {
    s = freekickGameV3.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 60 === 0) cps.push(freekickCheckpoint(s));
  }
  return { state: s, cps };
}
function serve3(seed: number, events: ArcadeInputEvent[], claim?: number) {
  const { state, cps } = play3(seed, events);
  const raw = encodeFreekickRun({ seed, claimedScore: claim ?? freekickGameV3.score(state), events, endTick: state.tick, checkpoints: cps });
  const quiet = console.error;
  console.error = () => {};
  const result = replayFreekickRun(seed, raw, FREEKICK_REV_3);
  console.error = quiet;
  return { state, result };
}
/** Steps a rev-3 game to its first aim phase, then applies `inputs` (each on its own tick, in order). */
function stepInputs(seed: number, inputs: { k: number; a?: number; b?: number }[], idleBetween = 0): FreekickState {
  let s = freekickGameV3.init(seed);
  while (s.phase !== FK_AIM) s = freekickGameV3.step(s, null);
  for (const inp of inputs) {
    for (let i = 0; i < idleBetween; i++) s = freekickGameV3.step(s, null);
    s = freekickGameV3.step(s, { t: s.tick + 1, k: inp.k, a: inp.a ?? 0, b: inp.b ?? 0, c: 0, d: 0 });
  }
  return s;
}
{
  // Input ranges: rev 3 has the four new kinds and not kind 1; earlier revisions have only kind 1.
  ok(FREEKICK_INPUT_RANGES_V3.map((r) => r.k).join() === [FREEKICK_INPUT_AIM, FREEKICK_INPUT_CURL, FREEKICK_INPUT_POWER, FREEKICK_INPUT_STRIKE].join(), "v3 ranges: AIM, CURL, POWER, STRIKE");
  ok(freekickGameV3.inputRanges === FREEKICK_INPUT_RANGES_V3 && freekickGameV2.inputRanges === FREEKICK_INPUT_RANGES && freekickGame.inputRanges === FREEKICK_INPUT_RANGES, "v3 ranges: rev 3's own; revs 1 and 2 keep kind 1 alone");
  const log: ArcadeInputEvent[] = [];
  ok(recordInput(log, { t: 40, k: FREEKICK_INPUT_AIM, a: 100, b: 100, c: 0, d: 0 }, FREEKICK_INPUT_RANGES) === null && log.length === 0, "v3 ranges: an AIM is never recorded on rev 1 or 2");
  ok(recordInput(log, { t: 40, k: FREEKICK_INPUT_KICK, a: 0, b: 0, c: 500, d: 0 }, FREEKICK_INPUT_RANGES_V3) === null && log.length === 0, "v3 ranges: a rev-1 stroke is never recorded on rev 3");
  const rec = recordInput(log, { t: 41, k: FREEKICK_INPUT_AIM, a: 9999, b: -50, c: 7, d: 7 }, FREEKICK_INPUT_RANGES_V3);
  ok(rec !== null && rec.a === FK_V3_AIM_X_MAX && rec.b === FK_V3_AIM_Y_MIN && rec.c === 0 && rec.d === 0, "v3 ranges: an AIM is clamped onto the frame");
  // The new kinds do nothing on rev 2's sim (its step reads kind 1 only).
  let s2 = freekickGameV2.init(FREEKICK_DEAL_V2[0]!);
  while (s2.phase !== FK_AIM) s2 = freekickGameV2.step(s2, null);
  const s2b = freekickGameV2.step(s2, { t: s2.tick + 1, k: FREEKICK_INPUT_STRIKE, a: 0, b: 0, c: 0, d: 0 });
  ok(s2b.acted === 0 && s2b.phase === FK_AIM && !("aimX" in s2b), "v3 kinds: a STRIKE does nothing on rev 2");

  // The meter: a triangle of the ticks since POWER.
  ok(fkV3Meter(0) === 0 && fkV3Meter(FK_V3_METER_PERIOD / 2) === 1000 && fkV3Meter(FK_V3_METER_PERIOD) === 0 && fkV3Meter(FK_V3_METER_PERIOD / 4) === 500 && fkV3Meter((3 * FK_V3_METER_PERIOD) / 4) === 500, "meter: 0 → 1000 → 0 every period");
  let mono = true;
  for (let t = 1; t <= FK_V3_METER_PERIOD / 2; t++) if (fkV3Meter(t) < fkV3Meter(t - 1)) mono = false;
  ok(mono && fkV3Meter(FK_V3_METER_PERIOD + 7) === fkV3Meter(7), "meter: rises over the first half, repeats each period");
  ok(fkV3MeterError(FK_V3_ZONE_LO) === 0 && fkV3MeterError(FK_V3_ZONE_HI) === 0 && fkV3MeterError(FK_V3_ZONE_HI + 30) === 30 && fkV3MeterError(FK_V3_ZONE_LO - 40) === -40, "meter: the sweet zone, and how far past it");
  ok(fkV3Meter(FK_V3_CLEAN_TICKS) >= FK_V3_ZONE_LO && fkV3Meter(FK_V3_CLEAN_TICKS) <= FK_V3_ZONE_HI, "meter: the oracle's strike tick is in the zone");

  // The solver: oracle shots cross the goal plane within 3 cm of the target (clean ghost flights).
  let solved = 0;
  let near = 0;
  for (const seed of FREEKICK_DEAL_V3.slice(0, 6)) {
    const plan = fkSeedPlan(seed, FREEKICK_REV_3);
    oracleShotsV3(seed).forEach((shot, i) => {
      const k = plan.kicks[i]!;
      const sol = fkV3Solve(k, shot.x, shot.y, shot.b);
      const c = fkGhostCross(k, sol.a, shot.b, sol.c);
      solved++;
      if (c && Math.abs((c.x * 100) / FK_M - shot.x) <= 3 && Math.abs((c.y * 100) / FK_M - shot.y) <= 3) near++;
    });
  }
  ok(near === solved, `solver: ${near}/${solved} oracle targets met within 3 cm`);
  ok(JSON.stringify(fkV3Solve(fkSeedPlan(FREEKICK_DEAL_V3[2]!, 3).kicks[1]!, 250, 180, 40)) === JSON.stringify(fkV3Solve({ ...fkSeedPlan(FREEKICK_DEAL_V3[2]!, 3).kicks[1]! }, 250, 180, 40)), "solver: the same answer for the same kick");

  // The strike: clean flies the solved shot; too much rises; too little comes in lower and slower.
  const k = fkSeedPlan(FREEKICK_DEAL_V3[4]!, FREEKICK_REV_3).kicks[0]!;
  const sol = fkV3Solve(k, 200, 150, 50);
  const clean = fkV3Launch(k, 200, 150, 50, (FK_V3_ZONE_LO + FK_V3_ZONE_HI) >> 1);
  ok(JSON.stringify(clean) === JSON.stringify(fkLaunch(k, sol.a, 50, sol.c)), "strike: a clean strike launches the solved shot exactly");
  ok(JSON.stringify(fkV3Launch(k, 200, 150, 50, FK_V3_ZONE_LO)) === JSON.stringify(clean) && JSON.stringify(fkV3Launch(k, 200, 150, 50, FK_V3_ZONE_HI)) === JSON.stringify(clean), "strike: anywhere in the zone is the same strike");
  const ghostOf = (f: ReturnType<typeof fkLaunch>) => {
    const g = { ...f, wallSide: 2, kx: 1000 * FK_M };
    while (g.out === 0) fkFlightStep(k, g, false, false);
    return g;
  };
  const gClean = ghostOf(clean);
  const gOver1 = ghostOf(fkV3Launch(k, 200, 150, 50, FK_V3_ZONE_HI + 20));
  const gOver2 = ghostOf(fkV3Launch(k, 200, 150, 50, FK_V3_ZONE_HI + 60));
  const gUnder1 = ghostOf(fkV3Launch(k, 200, 150, 50, FK_V3_ZONE_LO - 20));
  const gUnder2 = ghostOf(fkV3Launch(k, 200, 150, 50, FK_V3_ZONE_LO - 60));
  ok(gOver1.crossY > gClean.crossY && gOver2.crossY > gOver1.crossY, `strike: too much rises, more by more (${cmOf(gClean.crossY)} → ${cmOf(gOver1.crossY)} → ${cmOf(gOver2.crossY)} cm)`);
  const under1 = fkV3Launch(k, 200, 150, 50, FK_V3_ZONE_LO - 20);
  ok(gUnder1.crossY < gClean.crossY && (gUnder2.crossY < gUnder1.crossY || gUnder2.out === 5) && under1.vz < clean.vz && gUnder1.t > gClean.t, `strike: too little comes in lower and slower (${cmOf(gClean.crossY)} → ${cmOf(gUnder1.crossY)} cm, ${gClean.t} → ${gUnder1.t} ticks)`);

  // Aim and curl redo until POWER; ignored after it; POWER needs an aim; STRIKE needs POWER.
  const seed = FREEKICK_DEAL_V3[3]!;
  const r1 = stepInputs(seed, [{ k: FREEKICK_INPUT_AIM, a: 100, b: 100 }, { k: FREEKICK_INPUT_AIM, a: -200, b: 180 }, { k: FREEKICK_INPUT_CURL, b: 40 }, { k: FREEKICK_INPUT_CURL, b: -30 }]);
  ok(r1.aimX === -200 && r1.aimY === 180 && r1.aimed === 1 && r1.curl === -30 && r1.meterAt === -1 && r1.phase === FK_AIM, "steps: aim and curl redone, the last ones kept");
  const r2 = stepInputs(seed, [{ k: FREEKICK_INPUT_POWER }, { k: FREEKICK_INPUT_STRIKE }]);
  ok(r2.meterAt === -1 && r2.acted === 0 && r2.phase === FK_AIM, "steps: POWER before an aim and STRIKE before POWER do nothing");
  const r3 = stepInputs(seed, [{ k: FREEKICK_INPUT_AIM, a: 150, b: 120 }, { k: FREEKICK_INPUT_POWER }, { k: FREEKICK_INPUT_AIM, a: -300, b: 50 }, { k: FREEKICK_INPUT_CURL, b: 90 }, { k: FREEKICK_INPUT_POWER }]);
  ok(r3.aimX === 150 && r3.aimY === 120 && r3.curl === 0 && r3.meterAt !== undefined && r3.meterAt > 0 && r3.acted === 0, "steps: aim, curl and a second POWER are ignored once the meter runs");
  const powerTick = r3.meterAt!;
  let r4 = r3;
  for (let i = 0; i < 20; i++) r4 = freekickGameV3.step(r4, null);
  r4 = freekickGameV3.step(r4, { t: r4.tick + 1, k: FREEKICK_INPUT_STRIKE, a: 0, b: 0, c: 0, d: 0 });
  ok(r4.phase === FK_FLIGHT && r4.acted === 1 && r4.strikeM === fkV3Meter(r4.tick - powerTick) && r4.kickTick === r4.tick, `steps: STRIKE takes the kick with the meter at its tick (${r4.strikeM})`);
  // Before the whistle: nothing.
  const w0 = freekickGameV3.step(freekickGameV3.init(seed), { t: 1, k: FREEKICK_INPUT_AIM, a: 0, b: 100, c: 0, d: 0 });
  ok(w0.aimed === 0 && w0.phase !== FK_AIM, "steps: an aim during the whistle is ignored");
  // The run: 90 s, ten 540-tick slots; idle → every kick missed, score 0; the next kick starts fresh.
  const idle = serve3(seed, []);
  ok(idle.result.score === 0 && idle.state.outs.every((o) => o === FK_OUT_UNTAKEN) && idle.state.tick <= FREEKICK_V3_RUN_TICKS && FREEKICK_V3_RUN_TICKS === 5400, "run: 90 s, an idle run misses every kick and scores 0");
  ok(fkDeadlineFor(3, 0) === 360 && fkDeadlineFor(3, 9) === 9 * 540 + 360 && fkDeadlineFor(2, 4) === fkDeadline(4) && fkRunTicksFor(2) === FREEKICK_RUN_TICKS && freekickGameV3.runTicks === 5400 && freekickGameV2.runTicks === FREEKICK_RUN_TICKS, "run: rev 3's slots and length; rev 1 and 2 keep 75 s");
  ok(FREEKICK_TIME_MS >= Math.ceil((FREEKICK_V3_RUN_TICKS / 60) * 1000) + 3000, `run: the round's clock (${FREEKICK_TIME_MS} ms) fits the 90 s run and the usual slack`);
  const after = playShotsV3(seed, [{ x: 200, y: 150, b: 40 }, null], [{}]).state;
  ok(after.outs[0]! >= 0 && after.k >= 1, "run: the first kick resolves");
  let fresh = freekickGameV3.init(seed);
  const ev = playShotsV3(seed, [{ x: 200, y: 150, b: 40 }]).events;
  const evAt = new Map(ev.map((e) => [e.t, e]));
  while (fresh.k === 0 && !freekickGameV3.isOver(fresh)) fresh = freekickGameV3.step(fresh, evAt.get(fresh.tick + 1) ?? null);
  ok(fresh.k === 1 && fresh.aimed === 0 && fresh.curl === 0 && fresh.meterAt === -1 && fresh.strikeM === -1, "run: each kick starts with no aim, no curl, the meter off");

  // Determinism and the server.
  const s3 = FREEKICK_DEAL_V3[5]!;
  const events = oracleRun(s3, FREEKICK_REV_3);
  const a = play3(s3, events);
  const b = play3(s3, events);
  ok(a.state.freekickRev === FREEKICK_REV_3 && JSON.stringify(a.state) === JSON.stringify(b.state) && a.cps.map((c) => c.checksum).join() === b.cps.map((c) => c.checksum).join(), "v3 replay: deterministic");
  const served = serve3(s3, events);
  ok(!served.result.flagged && served.result.score === 200 && served.result.score === freekickGameV3.score(a.state), `v3 server: agrees with the sim (${served.result.score})`);
  ok(serve3(s3, events, 150).result.flagged, "v3 server: a tampered claimed score is flagged");
  // A changed aim changes the checkpoints (the prepared shot is in the checksum).
  const moved = events.map((e) => (e.k === FREEKICK_INPUT_AIM && e === events[0] ? { ...e, a: e.a + (e.a > 0 ? -1 : 1) } : e));
  const pm = play3(s3, moved);
  ok(pm.cps.map((c) => c.checksum).join() !== a.cps.map((c) => c.checksum).join(), "v3 checkpoints: carry the prepared shot");
  // The same prepared shot set on different ticks plays the same.
  const shot = oracleShotsV3(s3)[0]!;
  const early = playShotsV3(s3, [shot], [{ think: 0 }]).state;
  const late = playShotsV3(s3, [shot], [{ think: 120, curlGap: 30, powerGap: 20 }]).state;
  ok(early.outs[0] === late.outs[0] && early.places[0] === late.places[0] && early.flags[0] === late.flags[0] && early.outs[0] === FK_OUT_GOAL, "v3 flight: independent of the tick the shot is set on");
}

/* 12. The rev-3 deal. */
{
  ok(FREEKICK_DEAL_V3.length === 300 && new Set(FREEKICK_DEAL_V3).size === 300 && FREEKICK_DEAL_V3.every((s) => Number.isInteger(s) && s > 0 && s < 0x7fffffff), `v3 deal: 300 distinct valid seeds (${FREEKICK_DEAL_V3.length})`);
  const idx = FULL ? FREEKICK_DEAL_V3.map((_, i) => i) : Array.from({ length: 24 }, (_, i) => Math.floor((i * FREEKICK_DEAL_V3.length) / 24));
  let full = 0;
  for (const i of idx) {
    const seed = FREEKICK_DEAL_V3[i]!;
    const { result } = serve3(seed, oracleRun(seed, FREEKICK_REV_3));
    if (result.score === 200 && !result.flagged && result.parts.every((p) => p.points === p.max)) full++;
    else failures.push(`v3 deal: seed ${seed} (#${i}) oracle scored ${result.score}${result.flagged ? " flagged" : ""}`);
  }
  checks++;
  console.log(`  v3 deal: ${full}/${idx.length} oracle runs at 200 with every part full`);
  if (FULL) {
    try {
      execFileSync("bun", ["scripts/freekick-deal.ts", "--rev=3", "--check"], { stdio: "pipe" });
      ok(true, "v3 deal file");
    } catch {
      ok(false, "v3 deal: the file is not what freekick-deal.ts --rev=3 builds");
    }
  }
}

/* 13. Rev 3's parts. */
{
  ok(FREEKICK_REV_DEALT > FREEKICK_REV_3 && freekickGameFor(3) === freekickGameV3 && freekickGameFor(2) === freekickGameV2, "rooms deal a stamp after freekickRev 3; 3 still plays rev 3, 2 rev 2");
  ok(stdSpecMax(FREEKICK_V3_STD_SPEC) === 200 && FREEKICK_V3_STD_SPEC.rev === FREEKICK_REV_3, "v3 spec: 200 on freekickRev 3");
  ok(FREEKICK_V3_STD_SPEC.parts.map((p) => `${p.key}:${p.label}:${p.max}`).join() === FREEKICK_STD_SPEC.parts.map((p) => `${p.key}:${p.label}:${p.max}`).join(), "v3 spec: rev 2's parts, keys and labels");
  const s0 = { ...freekickGameV3.init(FREEKICK_DEAL_V3[0]!), acted: 1 };
  const pts = (o: Partial<FreekickState>) => freekickStdParts({ ...s0, ...o })!.map((x) => x.points);
  ok(pts({ goals: 3, units: 345, targets: 2, curled: 3, best: 5 }).join() === `${Math.floor((130 * 345) / FREEKICK_V3_CORE_FULL)},20,6,10`, `v3 parts: the core on a straight line to ${FREEKICK_V3_CORE_FULL} (${pts({ goals: 3, units: 345, targets: 2, curled: 3, best: 5 }).join()})`);
  ok(pts({ goals: 9, units: FREEKICK_V3_CORE_FULL })[0] === 130 && pts({ goals: 10, units: 1300 })[0] === 130 && pts({ goals: 1, units: 100 })[0] === Math.floor(13000 / FREEKICK_V3_CORE_FULL), "v3 parts: full at the figure, held there");
  ok(FREEKICK_V3_CORE_FULL < FREEKICK_CORE_FULL && FREEKICK_V3_CORE_FULL >= 900, `v3 parts: the core's full figure (${FREEKICK_V3_CORE_FULL}) is under rev 2's 1,300`);
  // A played rev-2 state still scores on rev 2's line (the full figure follows the stamp).
  const v2 = { ...freekickGameV2.init(FREEKICK_DEAL_V2[0]!), acted: 1 };
  ok(freekickStdParts({ ...v2, goals: 3, units: 345 })![0]!.points === 34, "v3 parts: rev 2's core keeps its 1,300");
  const feeble = playShotsV3(FREEKICK_DEAL_V3[0]!, [{ x: 0, y: 11, b: 0 }], [{ strike: 1 }]).events;
  ok(serve3(FREEKICK_DEAL_V3[0]!, feeble).result.score === 1, "v3 waste: one kick that did nothing scores 1");
}

/* 14. Legacy identity (rev 3 runs recorded before rev 4). */
{
  const runs = JSON.parse(readFileSync("scripts/fixtures/freekick-rev3-legacy.json", "utf8")) as FkLegacyRun[];
  ok(runs.length === 112, `legacy v3: 112 recorded rev-3 runs (${runs.length})`);
  ok(new Set(runs.map((r) => r.score)).size > 10, "legacy v3: the runs cover a spread of scores");
  let same = 0;
  for (const r of runs) {
    const now = playRev1(r.seed, r.events, FREEKICK_REV_3);
    const sim = now.score === r.score && now.digest === r.digest && now.checksums.join() === r.checksums.join();
    const { state, result } = serve3(r.seed, r.events, r.score);
    const server = !result.flagged && result.score === r.score && JSON.stringify(result.state) === JSON.stringify(state) && !("bent" in result.state);
    if (sim && server) same++;
    else failures.push(`legacy v3: seed ${r.seed} ${r.label} replays to ${now.score} (recorded ${r.score})${sim ? "" : " sim differs"}${server ? "" : " server differs"}`);
  }
  checks++;
  console.log(`  legacy v3: ${same}/${runs.length} rev-3 runs identical (sim and server, stamped 3)`);
}

/* 15. Rev 4's inputs and rules. */
function play4(seed: number, events: ArcadeInputEvent[]) {
  const at = new Map(events.map((e) => [e.t, e]));
  let s = freekickGameV4.init(seed);
  const cps: FreekickCheckpoint[] = [];
  while (!freekickGameV4.isOver(s)) {
    s = freekickGameV4.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 60 === 0) cps.push(freekickCheckpoint(s));
  }
  return { state: s, cps };
}
function serve4(seed: number, events: ArcadeInputEvent[], claim?: number) {
  const { state, cps } = play4(seed, events);
  const raw = encodeFreekickRun({ seed, claimedScore: claim ?? freekickGameV4.score(state), events, endTick: state.tick, checkpoints: cps });
  const quiet = console.error;
  console.error = () => {};
  const result = replayFreekickRun(seed, raw, FREEKICK_REV_4);
  console.error = quiet;
  return { state, result };
}
function stepInputs4(seed: number, inputs: { k: number; a?: number; b?: number; c?: number }[]): FreekickState {
  let s = freekickGameV4.init(seed);
  while (s.phase !== FK_AIM) s = freekickGameV4.step(s, null);
  for (const inp of inputs) s = freekickGameV4.step(s, { t: s.tick + 1, k: inp.k, a: inp.a ?? 0, b: inp.b ?? 0, c: inp.c ?? 0, d: 0 });
  return s;
}
{
  ok(FREEKICK_INPUT_RANGES_V4.map((r) => r.k).join() === [FREEKICK_INPUT_POWER, FREEKICK_INPUT_STRIKE, FREEKICK_INPUT_SHOT].join() && freekickGameV4.inputRanges === FREEKICK_INPUT_RANGES_V4 && freekickGameV3.inputRanges === FREEKICK_INPUT_RANGES_V3, "v4 ranges: SHOT, POWER, STRIKE; rev 3 keeps its own");
  const log: ArcadeInputEvent[] = [];
  ok(recordInput(log, { t: 40, k: FREEKICK_INPUT_SHOT, a: 0, b: 100, c: 50, d: 0 }, FREEKICK_INPUT_RANGES_V3) === null && recordInput(log, { t: 40, k: FREEKICK_INPUT_AIM, a: 0, b: 100, c: 0, d: 0 }, FREEKICK_INPUT_RANGES_V4) === null && recordInput(log, { t: 40, k: FREEKICK_INPUT_CURL, a: 0, b: 50, c: 0, d: 0 }, FREEKICK_INPUT_RANGES_V4) === null && log.length === 0, "v4 ranges: no SHOT on rev 3, no AIM or CURL on rev 4");
  const rec = recordInput(log, { t: 41, k: FREEKICK_INPUT_SHOT, a: 9999, b: -50, c: 400, d: 7 }, FREEKICK_INPUT_RANGES_V4);
  ok(rec !== null && rec.a === FK_V3_AIM_X_MAX && rec.b === FK_V3_AIM_Y_MIN && rec.c === 100 && rec.d === 0, "v4 ranges: a SHOT is clamped onto the frame and the curl's reach");
  // A SHOT does nothing on rev 3's sim.
  let s3 = freekickGameV3.init(FREEKICK_DEAL_V3[0]!);
  while (s3.phase !== FK_AIM) s3 = freekickGameV3.step(s3, null);
  const s3b = freekickGameV3.step(s3, { t: s3.tick + 1, k: FREEKICK_INPUT_SHOT, a: 100, b: 100, c: 50, d: 0 });
  ok(s3b.aimed === 0 && s3b.curl === 0, "v4 kinds: a SHOT does nothing on rev 3");

  const seed = FREEKICK_DEAL_V4[3]!;
  const r1 = stepInputs4(seed, [{ k: FREEKICK_INPUT_SHOT, a: 100, b: 100, c: 40 }, { k: FREEKICK_INPUT_SHOT, a: -200, b: 180, c: -80 }]);
  ok(r1.aimX === -200 && r1.aimY === 180 && r1.curl === -80 && r1.aimed === 1 && r1.meterAt === -1, "v4 steps: the shot redrawn, the last one kept (target and curl together)");
  const r2 = stepInputs4(seed, [{ k: FREEKICK_INPUT_AIM, a: 100, b: 100 }, { k: FREEKICK_INPUT_CURL, b: 40 }, { k: FREEKICK_INPUT_POWER }, { k: FREEKICK_INPUT_STRIKE }]);
  ok(r2.aimed === 0 && r2.curl === 0 && r2.meterAt === -1 && r2.acted === 0, "v4 steps: AIM and CURL do nothing on rev 4; POWER needs a shot; STRIKE needs POWER");
  const r3 = stepInputs4(seed, [{ k: FREEKICK_INPUT_SHOT, a: 150, b: 120, c: 75 }, { k: FREEKICK_INPUT_POWER }, { k: FREEKICK_INPUT_SHOT, a: -300, b: 50, c: -90 }]);
  ok(r3.aimX === 150 && r3.aimY === 120 && r3.curl === 75 && (r3.meterAt ?? -1) > 0, "v4 steps: a shot drawn once the meter runs is ignored");
  // The shot's flight is rev 3's prepared shot exactly (the same solver and meter).
  let r4 = r3;
  for (let i = 0; i < FK_V3_CLEAN_TICKS - 1; i++) r4 = freekickGameV4.step(r4, null);
  r4 = freekickGameV4.step(r4, { t: r4.tick + 1, k: FREEKICK_INPUT_STRIKE, a: 0, b: 0, c: 0, d: 0 });
  ok(r4.phase === FK_FLIGHT && JSON.stringify(r4.fl) === JSON.stringify(fkV3Launch(fkSeedPlan(seed, 4).kicks[0]!, 150, 120, 75, r4.strikeM!)), "v4 strike: the drawn shot flies as rev 3's prepared shot");

  // The shrinking hoop: full on the first kick, 70 % on the last, an even line between; rev 1–3 the full hoop.
  const radii = Array.from({ length: FREEKICK_KICKS }, (_, i) => fkHoopRFor(FREEKICK_REV_4, i));
  let even = true;
  for (let i = 1; i < radii.length; i++) if (!(radii[i]! < radii[i - 1]!) || Math.abs(radii[i - 1]! - radii[i]! - (radii[0]! - radii[9]!) / 9) > FK_HOOP_R / 1000 + 1) even = false; // steps within a per-mille of the radius
  ok(radii[0] === FK_HOOP_R && radii[9] === Math.trunc((FK_HOOP_R * FK_V4_HOOP_LAST_PERMILLE) / 1000) && FK_V4_HOOP_LAST_PERMILLE === 700 && even, `v4 hoop: ${cmOf(radii[0]!)} cm → ${cmOf(radii[9]!)} cm, shrinking evenly`);
  ok([1, 2, 3].every((rev) => Array.from({ length: 10 }, (_, i) => fkHoopRFor(rev, i)).every((r) => r === FK_HOOP_R)), "v4 hoop: rev 1–3 keep the full hoop on every kick");
  // Judged on the kick's own radius, tucked in the corner: a crossing inside the full hoop's edge but outside the
  // shrunk one counts on rev 3's radius only; the shrunk hoop's own centre counts on both.
  const kL = { ...fkSeedPlan(FREEKICK_DEAL_V4[0]!, 4).kicks[0]!, target: FK_TARGET_RIGHT };
  const goalFlight = (x: number, y: number) => ({ ...fkLaunch(kL, 0, 0, 500), out: FK_OUT_GOAL, crossX: x, crossY: y, passX: 0, passY: 0, passK: 0 });
  const small = radii[9]!;
  const cx = FK_GOAL_HALF_W - small;
  const cy = FK_GOAL_H - small;
  ok(fkJudge(kL, goalFlight(cx, cy), small).target && fkJudge(kL, goalFlight(cx, cy)).target, "v4 hoop: the shrunk hoop sits in the corner, inside the full one");
  const outside = goalFlight(FK_GOAL_HALF_W - FK_HOOP_R, FK_GOAL_H - FK_HOOP_R - Math.trunc(FK_HOOP_R * 0.6));
  ok(fkJudge(kL, outside).target && !fkJudge(kL, outside, small).target, "v4 hoop: judged on the kick's own radius");

  // The Curl bonus: a goal from a shot bent at least FK_V4_BENT; not a gentler goal.
  const s4 = FREEKICK_DEAL_V4[5]!;
  const shots = oracleShotsV4(s4);
  ok(shots.every((x) => Math.abs(x.b) >= FK_V4_BENT), `v4 bent: every oracle shot is bent at least ${FK_V4_BENT}`);
  const bentRun = playShotsV4(s4, shots).state;
  ok(bentRun.bent === 10 && bentRun.flags.every((f) => (f & 4) === 4), "v4 bent: ten bent goals, flagged");
  const gentle = playShotsV4(s4, shots.map((x) => ({ ...x, b: Math.sign(x.b) * (FK_V4_BENT - 1) }))).state;
  const gentleBent = gentle.flags.filter((f) => (f & 4) === 4).length;
  ok(gentle.bent === 0 && gentleBent === 0, `v4 bent: a goal from a shot bent ${FK_V4_BENT - 1} earns no Curl bonus (${gentle.goals} goals)`);

  const events = oracleRun(s4, FREEKICK_REV_4);
  const a = play4(s4, events);
  const b = play4(s4, events);
  ok(a.state.freekickRev === FREEKICK_REV_4 && JSON.stringify(a.state) === JSON.stringify(b.state) && a.cps.map((c) => c.checksum).join() === b.cps.map((c) => c.checksum).join(), "v4 replay: deterministic");
  const served = serve4(s4, events);
  ok(!served.result.flagged && served.result.score === 200 && served.result.score === freekickGameV4.score(a.state), `v4 server: agrees with the sim (${served.result.score})`);
  ok(serve4(s4, events, 150).result.flagged, "v4 server: a tampered claimed score is flagged");
  const cpA = freekickCheckpoint({ ...a.state, bent: 3 }).checksum;
  const cpB = freekickCheckpoint({ ...a.state, bent: 4 }).checksum;
  ok(cpA !== cpB && freekickCheckpoint({ ...freekickGameV3.init(1), bent: 3 } as FreekickState).checksum === freekickCheckpoint({ ...freekickGameV3.init(1), bent: 4 } as FreekickState).checksum, "v4 checkpoints: carry the Curl bonus (rev 3's do not)");
  ok(freekickGameV4.runTicks === FREEKICK_V3_RUN_TICKS && fkRunTicksFor(4) === FREEKICK_V3_RUN_TICKS && fkDeadlineFor(4, 9) === fkDeadlineFor(3, 9), "v4 run: rev 3's 90 s and slots");
}

/* 16. The rev-4 deal. */
{
  ok(FREEKICK_DEAL_V4.length === 300 && new Set(FREEKICK_DEAL_V4).size === 300 && FREEKICK_DEAL_V4.every((s) => Number.isInteger(s) && s > 0 && s < 0x7fffffff), `v4 deal: 300 distinct valid seeds (${FREEKICK_DEAL_V4.length})`);
  const idx = FULL ? FREEKICK_DEAL_V4.map((_, i) => i) : Array.from({ length: 24 }, (_, i) => Math.floor((i * FREEKICK_DEAL_V4.length) / 24));
  let full = 0;
  for (const i of idx) {
    const seed = FREEKICK_DEAL_V4[i]!;
    const { result } = serve4(seed, oracleRun(seed, FREEKICK_REV_4));
    if (result.score === 200 && !result.flagged && result.parts.every((p) => p.points === p.max)) full++;
    else failures.push(`v4 deal: seed ${seed} (#${i}) oracle scored ${result.score}${result.flagged ? " flagged" : ""}`);
  }
  checks++;
  console.log(`  v4 deal: ${full}/${idx.length} oracle runs at 200 with every part full`);
  if (FULL) {
    try {
      execFileSync("bun", ["scripts/freekick-deal.ts", "--rev=4", "--check"], { stdio: "pipe" });
      ok(true, "v4 deal file");
    } catch {
      ok(false, "v4 deal: the file is not what freekick-deal.ts --rev=4 builds");
    }
  }
}

/* 17. Rev 4's parts. */
{
  ok(FREEKICK_REV_DEALT === FREEKICK_REV_4 && freekickGameFor(4) === freekickGameV4 && freekickGameFor(5) === freekickGameV4 && freekickGameFor(3) === freekickGameV3, "rooms deal freekickRev 4; 3 still plays rev 3");
  ok(stdSpecMax(FREEKICK_V4_STD_SPEC) === 200 && FREEKICK_V4_STD_SPEC.rev === FREEKICK_REV_4, "v4 spec: 200 on freekickRev 4");
  ok(FREEKICK_V4_STD_SPEC.parts.map((p) => `${p.key}:${p.label}:${p.max}`).join() === "core:Goals:120,targets:Targets:40,curl:Round the wall:10,bent:Curl bonus:20,streak:Five in a row:10", "v4 spec: Goals 120, Targets 40, Round the wall 10, Curl bonus 20, Five in a row 10");
  const s0 = { ...freekickGameV4.init(FREEKICK_DEAL_V4[0]!), acted: 1 };
  const pts = (o: Partial<FreekickState>) => freekickStdParts({ ...s0, ...o })!.map((x) => x.points);
  ok(pts({ goals: 3, units: 345, targets: 2, curled: 3, bent: 2, best: 5 }).join() === `${Math.floor((120 * 345) / FREEKICK_V4_CORE_FULL)},20,3,4,10`, `v4 parts: the core on a straight line to ${FREEKICK_V4_CORE_FULL} (${pts({ goals: 3, units: 345, targets: 2, curled: 3, bent: 2, best: 5 }).join()})`);
  ok(pts({ goals: 7, units: FREEKICK_V4_CORE_FULL })[0] === 120 && pts({ goals: 10, units: 1300 })[0] === 120, "v4 parts: full at the figure, held there");
  ok(pts({ goals: 5, units: 560, bent: 5, curled: 5, targets: 2, best: 5 })[0] === pts({ goals: 5, units: 560 })[0], "v4 parts: the features never cost core");
  ok(serve4(FREEKICK_DEAL_V4[0]!, []).result.score === 0, "v4 idle: no input scores 0");
  const feeble = playShotsV4(FREEKICK_DEAL_V4[0]!, [{ x: 0, y: 11, b: 0 }], [{ strike: 1 }]).events;
  ok(serve4(FREEKICK_DEAL_V4[0]!, feeble).result.score === 1, "v4 waste: one kick that did nothing scores 1");
  // Rooms deal it: generateFreekick stamps 4 on a proved rev-4 seed.
  const dealt = generateFreekick();
  ok(dealt.freekickRev === FREEKICK_REV_4 && FREEKICK_DEAL_V4.includes(dealt.seed), "v4 rooms: generateFreekick deals a proved freekickRev 4 seed");
}

if (failures.length) {
  console.log(`FAIL freekick-check: ${failures.length} of ${checks} checks failed`);
  for (const f of failures.slice(0, 30)) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS freekick-check: ${checks} checks (${FULL ? "full" : "quick"} depth)`);
