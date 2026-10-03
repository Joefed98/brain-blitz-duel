/** Clay Shoot schedule, aiming-bot, and client/server identity proof only. */
import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import { inputAt, recordInput, rngBelow, type ArcadeInputEvent } from "@/lib/arcade/engine";
import {
  clayCheckpoint,
  clayGame,
  clayScore,
  CLAY_CHECKPOINT_INTERVAL,
  CLAY_CONFIG,
  CLAY_COUNT,
  CLAY_FLYING,
  CLAY_INPUT_SHOT,
  CLAY_KIND_GOLD,
  CLAY_KIND_ORANGE,
} from "@/lib/arcade/clayShoot";
import { encodeClayRun, replayClayRun } from "@/lib/duel/clayShoot";
import { gradeAnswer } from "@/lib/duel/generate.server";

const RUNS = Number(process.argv[2] ?? 200);
let failures = 0;
const fail = (message: string) => {
  failures += 1;
  console.error("FAIL", message);
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
if (clayScore(22, 3) !== 150 || clayScore(22, 2) !== 130 || clayScore(0, 0) !== 0) fail("score boundaries");

let slowest = 0;
let perfectRuns = 0;
let goldHits = 0;
let maxEarly = 0;
let maxLate = 0;
let nearTop = 0;
let left = 0;
let right = 0;
for (let run = 0; run < RUNS; run++) {
  const seed = (run * 40503 + 17) | 0;
  let rng = seed ^ 0x1234567;
  const draw = (bound: number) => {
    const result = rngBelow(rng, bound);
    rng = result.state;
    return result.value;
  };
  let state = clayGame.init(seed);
  if (state.schedule.kind.filter((kind) => kind === CLAY_KIND_ORANGE).length !== CLAY_CONFIG.orangeClays) fail(`run ${run}: orange count`);
  if (state.schedule.kind.filter((kind) => kind === CLAY_KIND_GOLD).length !== CLAY_CONFIG.goldClays) fail(`run ${run}: gold count`);
  if (state.schedule.launch[state.schedule.launch.length - 1]! >= CLAY_CONFIG.runSeconds * 60) fail(`run ${run}: launch after run`);
  const ys = state.schedule.launchY;
  const mid = ys.filter((y) => y >= 100 && y < 200).length;
  if (ys.some((y) => y < CLAY_CONFIG.worldH / 4 || y > CLAY_CONFIG.worldH * 0.95)) fail(`run ${run}: launch outside bands`);
  if (state.schedule.kind.some((k, i) => k === CLAY_KIND_GOLD && (ys[i]! < 100 || ys[i]! > 300))) fail(`run ${run}: gold outside middle band`);
  nearTop += mid;
  left += state.schedule.side.filter((side) => side === 0).length;
  right += state.schedule.side.filter((side) => side === 1).length;

  let idle = clayGame.init(seed);
  let idleGoldOverlap = false;
  while (!clayGame.isOver(idle)) {
    idle = clayGame.step(idle, null);
    const flying = idle.status.map((status, i) => ({ status, i })).filter(({ status }) => status === CLAY_FLYING);
    const airborneGold = flying.filter(({ i }) => idle.schedule.kind[i] === CLAY_KIND_GOLD).length;
    if (airborneGold > 1) idleGoldOverlap = true;
    if (idle.tick < CLAY_CONFIG.runSeconds * 30) maxEarly = Math.max(maxEarly, flying.length);
    else maxLate = Math.max(maxLate, flying.length);
  }
  if (idleGoldOverlap) fail(`run ${run}: gold overlap`);
  if (idle.missed !== CLAY_COUNT) fail(`run ${run}: idle run resolved ${idle.missed}/${CLAY_COUNT}`);

  const events: ArcadeInputEvent[] = [];
  const checkpoints: ReturnType<typeof clayCheckpoint>[] = [];
  while (!clayGame.isOver(state)) {
    const flying = state.status.map((status, i) => ({ status, i })).filter(({ status }) => status === CLAY_FLYING);

    let candidate: ArcadeInputEvent | null = null;
    const target = flying[0]?.i;
    if (target !== undefined) {
      const x = Math.round((state.x[target]! + state.schedule.vx[target]!) / 256);
      const y = Math.round((state.y[target]! + state.vy[target]! + CLAY_CONFIG.gravity) / 256);
      candidate = { t: state.tick + 1, k: CLAY_INPUT_SHOT, a: x, b: y, c: 0, d: 0 };
    } else if (draw(200) === 0) {
      candidate = { t: state.tick + 1, k: CLAY_INPUT_SHOT, a: draw(CLAY_CONFIG.worldW + 1), b: draw(CLAY_CONFIG.worldH + 1), c: 0, d: 0 };
    }
    recordInput(events, candidate, clayGame.inputRanges);
    state = clayGame.step(state, inputAt(events, state.tick + 1));
    if (state.tick % CLAY_CHECKPOINT_INTERVAL === 0) checkpoints.push(clayCheckpoint(state));
  }
  if (state.hits !== CLAY_COUNT || state.goldHits !== CLAY_CONFIG.goldClays) fail(`run ${run}: aiming bot hit ${state.hits}/${CLAY_COUNT}, gold ${state.goldHits}`);
  else {
    perfectRuns += 1;
    goldHits += state.goldHits;
  }
  const score = clayGame.score(state);
  const raw = appendClientCounters(
    encodeClayRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints }),
    arcadeCounters("clayshoot", state, score),
  );
  const started = performance.now();
  const replay = replayClayRun(seed, raw);
  slowest = Math.max(slowest, performance.now() - started);
  const graded = gradeAnswer({ type: "clayshoot", seed }, raw, 0);
  if (!same(replay.state, state) || replay.score !== score || graded.score !== score || replay.flagged || replay.desyncTick !== null) {
    fail(`run ${run}: replay mismatch ${replay.reason ?? ""}`);
  }
}
if (maxEarly > 1 || maxLate > 2) fail(`airborne limits ${maxEarly}/${maxLate}`);
if (nearTop === 0 || Math.abs(left - right) > RUNS || left === 0 || right === 0) fail("trajectory variety missing");
console.log(`clay self-replay ${RUNS}/${RUNS}; aiming bot ${perfectRuns}/${RUNS}; gold ${goldHits}/${RUNS * CLAY_CONFIG.goldClays}; slowest ${slowest.toFixed(1)}ms`);
console.log(`clay airborne max ${maxEarly}/${maxLate}; upper-middle ${nearTop}; edges ${left}/${right}`);
console.log(failures ? `${failures} FAILURES` : "ALL OK");

// Trajectory guard: every clay covers ⅔ width and stays ≥ 1 s on screen.
{
  const { clayGame: g, clayFlight: fl, CLAY_CONFIG: cc } = await import("@/lib/arcade/clayShoot");
  let bad = 0, minCov = 1e9, minT = 1e9;
  for (let r = 0; r < 2000; r++) {
    const s = g.init((r * 2654435761 + 13) | 0).schedule;
    for (let i = 0; i < s.vx.length; i++) {
      const f = fl(s.side[i]!, s.launchY[i]!, s.vx[i]!, s.vy[i]!);
      minCov = Math.min(minCov, f.coverage); minT = Math.min(minT, f.ticks);
      if (f.coverage < cc.minCoverage || f.ticks < cc.minOnScreenTicks) bad++;
    }
  }
  console.log(`trajectory guard 2000 seeds: ${bad} failing clays; min coverage ${minCov}px/${cc.worldW}; min on-screen ${minT} ticks`);
  if (bad) process.exitCode = 1;
}
process.exit(failures || process.exitCode ? 1 : 0);
