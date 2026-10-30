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
import { stdSpecMax } from "../src/lib/arcade/arcadeStandard";
import { encodeFreekickRun, replayFreekickRun } from "../src/lib/duel/freekick";
import { FREEKICK_DEAL } from "../src/lib/duel/freekickDeal.server";
import { fkFly, oracleRun, oracleShots, playShots } from "./freekick-oracle";

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

if (failures.length) {
  console.log(`FAIL freekick-check: ${failures.length} of ${checks} checks failed`);
  for (const f of failures.slice(0, 30)) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS freekick-check: ${checks} checks (${FULL ? "full" : "quick"} depth)`);
