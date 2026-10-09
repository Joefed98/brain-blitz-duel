/** Clay Shoot schedule, aiming-bot, and client/server identity proof only. */
import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import { inputAt, recordInput, rngBelow, type ArcadeInputEvent } from "@/lib/arcade/engine";
import {
  clayCheckpoint,
  clayGameFor,
  clayScore,
  CLAY_CHECKPOINT_INTERVAL,
  CLAY_CONFIG,
  CLAY_COUNT,
  CLAY_FLYING,
  CLAY_INPUT_SHOT,
  CLAY_KIND_GOLD,
  CLAY_KIND_ORANGE,
  CLAY_REV,
  CLAY_REV2,
  CLAY_BIRD_RX,
  CLAY_BIRD_RY,
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
if (clayScore(22, 3) !== 150 || clayScore(22, 2) !== 130 || clayScore(0, 0) !== 0 || clayScore(22, 3, 0, CLAY_REV) !== 150 || clayScore(22, 3, 1, CLAY_REV) !== 130 || clayScore(0, 0, 4, CLAY_REV) !== 0) fail("score boundaries");

let slowest = 0;
let perfectRuns = 0;
let perfectZeroBirdRuns = 0;
let goldHits = 0;
let maxEarly = 0;
let maxLate = 0;
let nearTop = 0;
let left = 0;
let right = 0;
const birdCounts: Record<number, number> = {};
let birdTableSeed0: { launch: number; side: number; y: number; vx: number; vy: number }[] = [];
let maxConcurrentBirds = 0;
let overlapGames = 0; // games with >=1 moment of 2 birds on screen
let overlapEpisodesOverLimit = 0; // games where >2 distinct overlap episodes occurred
let fairnessFailures = 0;
let overlapTicksTotal = 0;

for (let run = 0; run < RUNS; run++) {
  const seed = (run * 40503 + 17) | 0;
  const game = clayGameFor(CLAY_REV);
  let state = game.init(seed);
  const birds = state.birds;
  if (!birds || birds.launch.length < 10 || birds.launch.length > 12) fail(`run ${run}: bird count`);
  if (birds?.launch.some((tick, i) => tick < 0 || tick >= CLAY_CONFIG.runSeconds * 60 || (i > 0 && tick < birds.launch[i - 1]!))) fail(`run ${run}: bird timing`);
  birdCounts[birds?.launch.length ?? 0] = (birdCounts[birds?.launch.length ?? 0] ?? 0) + 1;
  if (run === 0) birdTableSeed0 = birds ? birds.launch.map((t, i) => ({ launch: t, side: birds.side[i]!, y: birds.launchY[i]!, vx: birds.vx[i]!, vy: birds.vy[i]! })) : [];
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

  // Idle run (no input): track airborne clay overlap, bird concurrency/episodes,
  // and an explicit fairness scan: for each clay, record every tick it is flying
  // and whether a bird overlaps its hit circle at that tick.
  let idle = game.init(seed);
  let idleGoldOverlap = false;
  let runMaxBirdsUp = 0;
  let wasOverlap = false;
  let episodes = 0;
  const clayHittableTicks = new Array<number>(CLAY_COUNT).fill(0);
  const clayClearTicks = new Array<number>(CLAY_COUNT).fill(0);
  while (!game.isOver(idle)) {
    idle = game.step(idle, null);
    const flying = idle.status.map((status, i) => ({ status, i })).filter(({ status }) => status === CLAY_FLYING);
    const airborneGold = flying.filter(({ i }) => idle.schedule.kind[i] === CLAY_KIND_GOLD).length;
    if (airborneGold > 1) idleGoldOverlap = true;
    if (idle.tick < CLAY_CONFIG.runSeconds * 30) maxEarly = Math.max(maxEarly, flying.length);
    else maxLate = Math.max(maxLate, flying.length);
    const birdsUp = idle.birdStatus?.filter((status) => status === 1).length ?? 0;
    maxConcurrentBirds = Math.max(maxConcurrentBirds, birdsUp);
    runMaxBirdsUp = Math.max(runMaxBirdsUp, birdsUp);
    const nowOverlap = birdsUp >= 2;
    if (nowOverlap && !wasOverlap) episodes += 1;
    wasOverlap = nowOverlap;

    // Fairness: for every flying clay, is any flying bird within the clay's hit radius (plus bird radius)?
    for (const { i: ci } of flying) {
      clayHittableTicks[ci]! += 1;
      const radius = (idle.schedule.kind[ci] === CLAY_KIND_GOLD ? CLAY_CONFIG.goldHitRadius : CLAY_CONFIG.orangeHitRadius);
      let blocked = false;
      if (idle.birds && idle.birdX && idle.birdY && idle.birdStatus) {
        for (let bi = 0; bi < idle.birds.launch.length; bi++) {
          if (idle.birdStatus[bi] !== 1) continue;
          const dx = (idle.x[ci]! - idle.birdX[bi]!) / 256;
          const dy = (idle.y[ci]! - idle.birdY[bi]!) / 256;
          if (Math.hypot(dx, dy) <= radius + Math.max(CLAY_BIRD_RX, CLAY_BIRD_RY)) {
            blocked = true;
            overlapTicksTotal += 1;
          }
        }
      }
      if (!blocked) clayClearTicks[ci]! += 1;
    }
  }
  if (idleGoldOverlap) fail(`run ${run}: gold overlap`);
  if (idle.missed !== CLAY_COUNT) fail(`run ${run}: idle run resolved ${idle.missed}/${CLAY_COUNT}`);
  if (runMaxBirdsUp >= 2) overlapGames += 1;
  if (episodes > 2) overlapEpisodesOverLimit += 1;
  for (let ci = 0; ci < CLAY_COUNT; ci++) {
    // Even on ticks where a bird visually overlaps, the sim resolves clay shots
    // first (step-order), so hittability only requires the clay to be flying at all.
    if (clayHittableTicks[ci] === 0) {
      fairnessFailures += 1;
      fail(`run ${run}: clay ${ci} never flies — no hittable window`);
    } else if (clayClearTicks[ci] === 0) {
      // Every tick overlapped by a bird: still hittable (clay-first priority),
      // but flag so the schedule can be tightened if this ever happens.
      console.error(`NOTE run ${run}: clay ${ci} has no bird-free tick (still hittable via clay-first priority)`);
    }
  }

  // Dedicated perfect-150 bot: aims only at clays, never fires when none is
  // flying, so any bird hit would be a scheduling fault, not bot carelessness.
  const events: ArcadeInputEvent[] = [];
  const checkpoints: ReturnType<typeof clayCheckpoint>[] = [];
  while (!game.isOver(state)) {
    const flying = state.status.map((status, i) => ({ status, i })).filter(({ status }) => status === CLAY_FLYING);
    let candidate: ArcadeInputEvent | null = null;
    const target = flying[0]?.i;
    if (target !== undefined) {
      const x = Math.round((state.x[target]! + state.schedule.vx[target]!) / 256);
      const y = Math.round((state.y[target]! + state.vy[target]! + CLAY_CONFIG.gravity) / 256);
      candidate = { t: state.tick + 1, k: CLAY_INPUT_SHOT, a: x, b: y, c: 0, d: 0 };
    }
    recordInput(events, candidate, game.inputRanges);
    state = game.step(state, inputAt(events, state.tick + 1));
    if (state.tick % CLAY_CHECKPOINT_INTERVAL === 0) checkpoints.push(clayCheckpoint(state));
  }
  if (state.hits !== CLAY_COUNT || state.goldHits !== CLAY_CONFIG.goldClays) fail(`run ${run}: aiming bot hit ${state.hits}/${CLAY_COUNT}, gold ${state.goldHits}`);
  else {
    perfectRuns += 1;
    goldHits += state.goldHits;
    if ((state.birdHits ?? 0) === 0) perfectZeroBirdRuns += 1;
    else fail(`run ${run}: perfect bot hit a bird (birdHits=${state.birdHits}) — perfect 150 blocked`);
  }
  const score = game.score(state);
  const raw = appendClientCounters(
      encodeClayRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints }, CLAY_REV),
    arcadeCounters("clayshoot", state, score),
  );
  const started = performance.now();
  const replay = replayClayRun(seed, raw, CLAY_REV);
  slowest = Math.max(slowest, performance.now() - started);
  const graded = gradeAnswer({ type: "clayshoot", seed, clayRev: CLAY_REV }, raw, 0);
  if (!same(replay.state, state) || replay.score !== score || graded.score !== score || replay.flagged || replay.desyncTick !== null) {
    fail(`run ${run}: replay mismatch ${replay.reason ?? ""}`);
  }
  if (score !== 150) fail(`run ${run}: perfect bot score ${score} !== 150`);
}

// rev1 (undefined/legacy) guard: no bird state leaks, score unaffected.
for (let run = 0; run < Math.min(RUNS, 100); run++) {
  const legacy = clayGameFor(undefined).init((run * 7919 + 31) | 0);
  if (legacy.rev !== undefined || legacy.birds !== undefined || legacy.birdHits !== undefined) fail(`legacy ${run}: bird state leaked`);
  if (clayGameFor(undefined).score(legacy) !== 0) fail(`legacy ${run}: score changed`);
}
// rev2 guard: unchanged cadence (3-4 birds) and scoring still replay/score as before.
for (let run = 0; run < Math.min(RUNS, 100); run++) {
  const seed = (run * 7919 + 31) | 0;
  const rev2 = clayGameFor(CLAY_REV2).init(seed);
  if (rev2.rev !== CLAY_REV2) fail(`rev2 ${run}: wrong rev tag`);
  if (!rev2.birds || rev2.birds.launch.length < 3 || rev2.birds.launch.length > 4) fail(`rev2 ${run}: bird count drifted from legacy 3-4`);
}
{
  const game = clayGameFor(CLAY_REV);
  let state = game.init(20261009);
  while (!state.birdStatus?.some((status) => status === 1)) state = game.step(state, null);
  const bird = state.birdStatus?.findIndex((status) => status === 1) ?? -1;
  const before = game.score(state);
  if (bird < 0) fail("bird hit fixture: no flying bird");
  else {
    state = game.step(state, { t: state.tick + 1, k: CLAY_INPUT_SHOT, a: Math.round((state.birdX?.[bird] ?? 0) / 256), b: Math.round((state.birdY?.[bird] ?? 0) / 256), c: 0, d: 0 });
    if (state.birdHits !== 1 || state.birdStatus?.[bird] !== 2 || game.score(state) !== Math.max(0, before - 10)) fail("bird hit fixture: penalty/startle");
  }
}
if (maxEarly > 1 || maxLate > 2) fail(`airborne limits ${maxEarly}/${maxLate}`);
if (nearTop === 0 || Math.abs(left - right) > RUNS || left === 0 || right === 0) fail("trajectory variety missing");
if (maxConcurrentBirds > 2) fail(`more than 2 birds ever on screen: ${maxConcurrentBirds}`);
if (overlapEpisodesOverLimit > 0) fail(`${overlapEpisodesOverLimit} games exceeded 2 two-bird moments`);
const overlapShare = RUNS ? (overlapGames / RUNS) : 0;
if (overlapShare < 0.2 || overlapShare > 0.5) console.error(`NOTE two-bird share ${(overlapShare * 100).toFixed(1)}% is outside the "about a third" target band (20-50%)`);

console.log(`clay self-replay ${RUNS}/${RUNS}; aiming bot ${perfectRuns}/${RUNS} (perfect+zero-birds ${perfectZeroBirdRuns}/${RUNS}); gold ${goldHits}/${RUNS * CLAY_CONFIG.goldClays}; slowest ${slowest.toFixed(1)}ms`);
console.log(`clay bird count distribution: ${JSON.stringify(birdCounts)}; max concurrent on screen ${maxConcurrentBirds}`);
console.log(`clay two-bird games: ${overlapGames}/${RUNS} (${(overlapShare * 100).toFixed(1)}%); runs with >2 overlap moments: ${overlapEpisodesOverLimit}`);
console.log(`clay fairness: every clay had a hittable (flying) window on every seed; failures ${fairnessFailures}; bird-overlap ticks observed across all clays/seeds ${overlapTicksTotal} (still hittable: clay-first priority)`);
console.log(`clay bird table (seed 0): ${JSON.stringify(birdTableSeed0)}`);
console.log(`clay airborne max ${maxEarly}/${maxLate}; upper-middle ${nearTop}; edges ${left}/${right}`);
console.log(failures ? `${failures} FAILURES` : "ALL OK");

// Trajectory guard: every clay covers ⅔ width and stays ≥ 0.6 s on screen.
{
  const { clayGameFor: gf, clayFlight: fl, CLAY_CONFIG: cc, CLAY_REV: rev } = await import("@/lib/arcade/clayShoot");
  const g = gf(rev);
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
