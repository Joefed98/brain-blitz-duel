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
import { fkFly, oracleRun, oracleShots, playShots } from "./freekick-oracle";
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
  ok(FREEKICK_REV_DEALT === FREEKICK_REV_2, "rooms deal freekickRev 2");
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

if (failures.length) {
  console.log(`FAIL freekick-check: ${failures.length} of ${checks} checks failed`);
  for (const f of failures.slice(0, 30)) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS freekick-check: ${checks} checks (${FULL ? "full" : "quick"} depth)`);
