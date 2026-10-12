/**
 * Self-replay proof for every arcade-engine game: all 22 active arcade games
 * (each on the revision live rooms stamp today, plus the legacy rules stored
 * rounds still replay on), Colour Clash, and the retired games kept for practice. Each run drives the sim exactly the
 * way the phone does — random candidate inputs (many deliberately out of range)
 * go through recordInput/recordTap, and the sim reads its input for each tick
 * from the recorded log only. The submitted string is that log, unmodified.
 * The server replay of it must reach the identical final state and score, with
 * no repaired events and no checkpoint mismatch. Also reports replay wall time.
 *
 *   bun scripts/arcade-self-replay-check.ts [runsPerGame]
 */

import {
  inputAt,
  recordInput,
  recordTap,
  tapAt,
  type ArcadeInputEvent,
  type InputRange,
} from "@/lib/arcade/engine";
import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import { beatCheckpoint, beatGame } from "@/lib/arcade/beat";
import { binTossCheckpoint, binTossGame } from "@/lib/arcade/binToss";
import { brkCheckpoint, breakerGame, breakerGameFor, BRK_REV } from "@/lib/arcade/breaker";
import { bubCheckpoint, bubbleGame, bubbleGameFor, BUB_REV } from "@/lib/arcade/bubble";
import {
  bullseyeCheckpoint,
  bullseyeGame,
  bullseyeInit,
  bullseyeWinds,
} from "@/lib/arcade/bullseye";
import { crossCheckpoint, crossGame, crossGameFor, CROSS_REV, CROSS_REV2 } from "@/lib/arcade/cross";
import { dualCheckpoint, dualGame } from "@/lib/arcade/dual";
import { hoverCheckpoint, hoverGame, hoverGameFor, HOVER_REV } from "@/lib/arcade/hover";
import { matchupCheckpoint, matchupGame, matchupGameFor, MATCHUP_REV, MATCHUP_REV2 } from "@/lib/arcade/matchup";
import { rallyCheckpoint, rallyGame } from "@/lib/arcade/rally";
import { ricoCheckpoint, ricoGame } from "@/lib/arcade/ricochet";
import { skylineCheckpoint, skylineGame } from "@/lib/arcade/skyline";
import { sliceCheckpoint, sliceGame, sliceGameFor, SLICE_REV } from "@/lib/arcade/slice";
import { snakeCheckpoint, snakeGame, snakeGameFor, SNAKE_REV, SNAKE_REV2 } from "@/lib/arcade/snake";
import { stdCheckpoint, steadyGame } from "@/lib/arcade/steady";
import { swerveCheckpoint, swerveGame, type SwerveInput } from "@/lib/arcade/swerve";
import { encodeBeatRun, replayBeatRun } from "@/lib/duel/beat";
import { encodeBinTossRun, replayBinTossRun } from "@/lib/duel/binToss";
import { encodeBreakerRun, replayBreakerRun } from "@/lib/duel/breaker";
import { encodeBubbleRun, replayBubbleRun } from "@/lib/duel/bubble";
import { encodeBullseyeRun, replayBullseyeRun } from "@/lib/duel/bullseye";
import { encodeCrossRun, replayCrossRun } from "@/lib/duel/cross";
import { encodeDualRun, replayDualRun } from "@/lib/duel/dual";
import { encodeHoverRun, replayHoverRun } from "@/lib/duel/hover";
import { encodeMatchupRun, replayMatchupRun } from "@/lib/duel/matchup";
import { encodeRallyRun, replayRallyRun } from "@/lib/duel/rally";
import { encodeRicoRun, replayRicoRun } from "@/lib/duel/ricochet";
import { encodeSkylineRun, replaySkylineRun } from "@/lib/duel/skyline";
import { encodeSliceRun, replaySliceRun } from "@/lib/duel/slice";
import { encodeSnakeRun, replaySnakeRun } from "@/lib/duel/snake";
import { encodeSteadyRun, replaySteadyRun } from "@/lib/duel/steady";
import { encodeSwerveRun, replaySwerveRun } from "@/lib/duel/swerve";
import { wavCheckpoint, wavefrontGame, wavefrontGameFor, WAV_REV } from "@/lib/arcade/wavefront";
import { basCheckpoint, bastionGame } from "@/lib/arcade/bastion";
import { encodeWavefrontRun, replayWavefrontRun } from "@/lib/duel/wavefront";
import { encodeBastionRun, replayBastionRun } from "@/lib/duel/bastion";
import { roofCheckpoint, rooftopGame } from "@/lib/arcade/rooftop";
import { encodeRooftopRun, replayRooftopRun } from "@/lib/duel/rooftop";
import { sortCheckpoint, sortRushGame } from "@/lib/arcade/sortRush";
import { encodeSortRushRun, replaySortRushRun } from "@/lib/duel/sortRush";
import { flipCheckpoint, flipGame, flipGameFor, FLIP_REV } from "@/lib/arcade/flip";
import { encodeFlipRun, replayFlipRun } from "@/lib/duel/flip";
import { parryCheckpoint, parryGame } from "@/lib/arcade/parry";
import { encodeParryRun, replayParryRun } from "@/lib/duel/parry";
import { juncCheckpoint, junctionGame } from "@/lib/arcade/junction";
import { encodeJunctionRun, replayJunctionRun } from "@/lib/duel/junction";
import { inkBridgeGame, inkCheckpoint } from "@/lib/arcade/inkBridge";
import { encodeInkBridgeRun, replayInkBridgeRun } from "@/lib/duel/inkBridge";
import { burstCheckpoint, burstGame, burstGameFor, BURST_REV } from "@/lib/arcade/burst";
import { encodeBurstRun, replayBurstRun } from "@/lib/duel/burst";
import { orbitCheckpoint, orbitGame } from "@/lib/arcade/orbit";
import { encodeOrbitRun, replayOrbitRun } from "@/lib/duel/orbit";
import { swingCheckpoint, swingGame } from "@/lib/arcade/swing";
import { tiltCheckpoint, tiltGame } from "@/lib/arcade/tilt";
import { encodeTiltRun, replayTiltRun } from "@/lib/duel/tilt";
import { hotfloorCheckpoint, hotFloorGame } from "@/lib/arcade/hotFloor";
import { encodeHotFloorRun, replayHotFloorRun } from "@/lib/duel/hotFloor";
import { encodeSwingRun, replaySwingRun } from "@/lib/duel/swing";
import { clashCheckpoint, colourClashGame, colourClashRev3Game } from "@/lib/arcade/colourClash";
import { encodeColourClashRun, replayColourClashRun } from "@/lib/duel/colourClash";
import { snipCheckpoint, snipGameFor, SNIP_REV } from "@/lib/arcade/snip";
import { encodeSnipRun, replaySnipRun } from "@/lib/duel/snip";
import { btCheckpoint, makeBallTrackGame, BT_REV } from "@/lib/arcade/ballTrack";
import { encodeBallTrackRun, replayBallTrackRun } from "@/lib/duel/ballTrack";
import { BALL_TRACK_BANK } from "@/lib/duel/ballTrackBank.server";
import { ORBIT_REV3 } from "@/lib/arcade/orbit";
import { encodeRev3Planets, initRev3From, orbitRev3Game, ORBIT_REV3_WORLD_W } from "@/lib/arcade/orbitRev3";
import { ORBIT_REV3_BANK } from "@/lib/duel/orbitRev3Bank.server";
import { orbitRev3PlanetsForSeed } from "@/lib/duel/orbitRev3Course.server";
import { binTossGameFor, BINTOSS_REV } from "@/lib/arcade/binToss";
import { inkBridgeGameFor, INK_REV3 } from "@/lib/arcade/inkBridge";
import { swingGameFor, SWING_REV } from "@/lib/arcade/swing";

/* eslint-disable @typescript-eslint/no-explicit-any */
const RUNS = Number(process.argv[2] ?? 40);
const INTERVAL = 300;

let rng = 12345;
const rand = (n: number) => {
  rng = (Math.imul(rng, 1103515245) + 12345) >>> 0;
  return rng % Math.max(1, n);
};
const between = (lo: number, hi: number) => lo + rand(hi - lo + 1);

interface Game {
  key: string;
  game: any;
  checkpoint: (s: any) => any;
  init?: (seed: number) => any;
  mode: "events" | "taps" | "swerve";
  /** Chance per tick (out of 1000) that a candidate input is produced. */
  rate: number;
  encode: (run: any) => string;
  replay: (seed: number, raw: string) => any;
  /** Per-seed game, for games whose rules depend on stored puzzle data (course, planets). */
  gameFor?: (seed: number) => any;
  /** Picks a seed live rooms could actually be dealt (e.g. a bank entry); default random. */
  seedFor?: (n: number) => number;
}

/** Ball Tracker: the server deals a bank course; the replay is against that stored course. */
const btCourse = (seed: number) => BALL_TRACK_BANK[seed % BALL_TRACK_BANK.length]!.course;
/** Orbit rev 3: rooms only deal bank seeds, with the proved planets stored in the puzzle. */
const orbitPlanets = (seed: number) => {
  const planets = orbitRev3PlanetsForSeed(seed);
  if (!planets) throw new Error(`orbit rev3: seed ${seed} is not a bank seed`);
  return planets;
};

const GAMES: Game[] = [
  {
    key: "hover",
    game: hoverGame,
    checkpoint: hoverCheckpoint,
    mode: "taps",
    rate: 60,
    encode: encodeHoverRun,
    replay: replayHoverRun,
  },
  {
    key: "swerve",
    game: swerveGame,
    checkpoint: swerveCheckpoint,
    mode: "swerve",
    rate: 40,
    encode: encodeSwerveRun,
    replay: replaySwerveRun,
  },
  {
    key: "skyline",
    game: skylineGame,
    checkpoint: skylineCheckpoint,
    mode: "taps",
    rate: 15,
    encode: encodeSkylineRun,
    replay: replaySkylineRun,
  },
  {
    key: "ricochet",
    game: ricoGame,
    checkpoint: ricoCheckpoint,
    mode: "taps",
    rate: 30,
    encode: encodeRicoRun,
    replay: replayRicoRun,
  },
  {
    key: "bintoss",
    game: binTossGame,
    checkpoint: binTossCheckpoint,
    mode: "events",
    rate: 20,
    encode: encodeBinTossRun,
    replay: replayBinTossRun,
  },
  {
    key: "bullseye",
    game: bullseyeGame,
    checkpoint: bullseyeCheckpoint,
    init: (seed) => bullseyeInit(seed, bullseyeWinds(seed)),
    mode: "events",
    rate: 20,
    encode: encodeBullseyeRun,
    replay: (seed, raw) => replayBullseyeRun(seed, raw, bullseyeWinds(seed)),
  },
  {
    key: "matchup",
    game: matchupGame,
    checkpoint: matchupCheckpoint,
    mode: "events",
    rate: 40,
    encode: encodeMatchupRun,
    replay: replayMatchupRun,
  },
  {
    key: "snake",
    game: snakeGame,
    checkpoint: snakeCheckpoint,
    mode: "events",
    rate: 40,
    encode: encodeSnakeRun,
    replay: replaySnakeRun,
  },
  {
    key: "cross",
    game: crossGame,
    checkpoint: crossCheckpoint,
    mode: "events",
    rate: 40,
    encode: encodeCrossRun,
    replay: replayCrossRun,
  },
  {
    key: "dual",
    game: dualGame,
    checkpoint: dualCheckpoint,
    mode: "events",
    rate: 50,
    encode: encodeDualRun,
    replay: replayDualRun,
  },
  {
    key: "breaker",
    game: breakerGame,
    checkpoint: brkCheckpoint,
    mode: "events",
    rate: 950,
    encode: encodeBreakerRun,
    replay: replayBreakerRun,
  },
  { key: "breaker/v2", game: breakerGameFor(BRK_REV), checkpoint: brkCheckpoint, mode: "events", rate: 950, encode: encodeBreakerRun, replay: (seed: number, raw: string) => replayBreakerRun(seed, raw, BRK_REV) },
  {
    key: "rally",
    game: rallyGame,
    checkpoint: rallyCheckpoint,
    mode: "events",
    rate: 900,
    encode: encodeRallyRun,
    replay: replayRallyRun,
  },
  {
    key: "steady",
    game: steadyGame,
    checkpoint: stdCheckpoint,
    mode: "events",
    rate: 900,
    encode: encodeSteadyRun,
    replay: replaySteadyRun,
  },
  {
    key: "slice",
    game: sliceGame,
    checkpoint: sliceCheckpoint,
    mode: "events",
    rate: 1000,
    encode: encodeSliceRun,
    replay: replaySliceRun,
  },
  {
    key: "bubble",
    game: bubbleGame,
    checkpoint: bubCheckpoint,
    mode: "events",
    rate: 15,
    encode: encodeBubbleRun,
    replay: replayBubbleRun,
  },
  {
    key: "beat",
    game: beatGame,
    checkpoint: beatCheckpoint,
    mode: "events",
    rate: 80,
    encode: encodeBeatRun,
    replay: replayBeatRun,
  },
  {
    key: "wavefront",
    game: wavefrontGame,
    checkpoint: wavCheckpoint,
    mode: "events",
    rate: 300,
    encode: encodeWavefrontRun,
    replay: replayWavefrontRun,
  },
  { key: "wavefront/v2", game: wavefrontGameFor(WAV_REV), checkpoint: wavCheckpoint, mode: "events", rate: 300, encode: encodeWavefrontRun, replay: (seed: number, raw: string) => replayWavefrontRun(seed, raw, WAV_REV) },
  {
    key: "bastion",
    game: bastionGame,
    checkpoint: basCheckpoint,
    mode: "events",
    rate: 300,
    encode: encodeBastionRun,
    replay: replayBastionRun,
  },
  {
    key: "rooftop",
    game: rooftopGame,
    checkpoint: roofCheckpoint,
    mode: "events",
    rate: 60,
    encode: encodeRooftopRun,
    replay: replayRooftopRun,
  },
  { key: "sortrush", game: sortRushGame, checkpoint: sortCheckpoint, mode: "events", rate: 60, encode: encodeSortRushRun, replay: replaySortRushRun },
  { key: "flip", game: flipGame, checkpoint: flipCheckpoint, mode: "events", rate: 50, encode: encodeFlipRun, replay: replayFlipRun },
  { key: "parry", game: parryGame, checkpoint: parryCheckpoint, mode: "events", rate: 120, encode: encodeParryRun, replay: replayParryRun },
  { key: "junction", game: junctionGame, checkpoint: juncCheckpoint, mode: "events", rate: 15, encode: encodeJunctionRun, replay: replayJunctionRun },
  { key: "inkbridge", game: inkBridgeGame, checkpoint: inkCheckpoint, mode: "events", rate: 400, encode: encodeInkBridgeRun, replay: replayInkBridgeRun },
  { key: "burst", game: burstGame, checkpoint: burstCheckpoint, mode: "events", rate: 120, encode: encodeBurstRun, replay: replayBurstRun },
  { key: "burst/v2", game: burstGameFor(BURST_REV), checkpoint: burstCheckpoint, mode: "events", rate: 120, encode: encodeBurstRun, replay: (seed: number, raw: string) => replayBurstRun(seed, raw, BURST_REV) },
  { key: "orbit", game: orbitGame, checkpoint: orbitCheckpoint, mode: "events", rate: 25, encode: encodeOrbitRun, replay: replayOrbitRun },
  { key: "swing", game: swingGame, checkpoint: swingCheckpoint, mode: "events", rate: 30, encode: encodeSwingRun, replay: replaySwingRun },
  { key: "tilt", game: tiltGame, checkpoint: tiltCheckpoint, mode: "events", rate: 500, encode: encodeTiltRun, replay: replayTiltRun },
  // Active games missing until Oct 2026: Scrumper and Ball Tracker.
  { key: "snip", game: snipGameFor(SNIP_REV), checkpoint: snipCheckpoint, mode: "events", rate: 40, encode: encodeSnipRun, replay: (seed: number, raw: string) => replaySnipRun(seed, raw, SNIP_REV) },
  { key: "snip/v1", game: snipGameFor(null), checkpoint: snipCheckpoint, mode: "events", rate: 40, encode: encodeSnipRun, replay: (seed: number, raw: string) => replaySnipRun(seed, raw, null) },
  {
    key: "balltrack",
    game: makeBallTrackGame(btCourse(0)),
    gameFor: (seed: number) => makeBallTrackGame(btCourse(seed)),
    checkpoint: btCheckpoint,
    mode: "events",
    rate: 30,
    encode: (run: any) => encodeBallTrackRun(btCourse(run.seed), run),
    replay: (seed: number, raw: string) => replayBallTrackRun(btCourse(seed), seed, raw),
  },
  {
    key: "balltrack/v2",
    game: makeBallTrackGame(btCourse(0), BT_REV),
    gameFor: (seed: number) => makeBallTrackGame(btCourse(seed), BT_REV),
    checkpoint: btCheckpoint,
    mode: "events",
    rate: 30,
    encode: (run: any) => encodeBallTrackRun(btCourse(run.seed), run, BT_REV),
    replay: (seed: number, raw: string) => replayBallTrackRun(btCourse(seed), seed, raw, BT_REV),
  },
  // Current stamped revisions of games whose entries above replay their legacy (unstamped) rules.
  {
    key: "orbit/v3",
    game: orbitRev3Game,
    gameFor: (seed: number) => ({ ...orbitRev3Game, init: () => initRev3From(orbitPlanets(seed), ORBIT_REV3_WORLD_W) }),
    seedFor: (n: number) => ORBIT_REV3_BANK[n % ORBIT_REV3_BANK.length]!.seed,
    checkpoint: orbitCheckpoint,
    mode: "events",
    rate: 25,
    encode: encodeOrbitRun,
    replay: (seed: number, raw: string) => replayOrbitRun(seed, raw, ORBIT_REV3, encodeRev3Planets(orbitPlanets(seed))),
  },
  { key: "cross/v2", game: crossGameFor(CROSS_REV2), checkpoint: crossCheckpoint, mode: "events", rate: 60, encode: encodeCrossRun, replay: (seed: number, raw: string) => replayCrossRun(seed, raw, CROSS_REV2) },
  { key: "cross/v3", game: crossGameFor(CROSS_REV), checkpoint: crossCheckpoint, mode: "events", rate: 60, encode: encodeCrossRun, replay: (seed: number, raw: string) => replayCrossRun(seed, raw, CROSS_REV) },
  { key: "flip/v2", game: flipGameFor(FLIP_REV), checkpoint: flipCheckpoint, mode: "events", rate: 50, encode: encodeFlipRun, replay: (seed: number, raw: string) => replayFlipRun(seed, raw, FLIP_REV) },
  { key: "slice/v2", game: sliceGameFor(SLICE_REV), checkpoint: sliceCheckpoint, mode: "events", rate: 1000, encode: encodeSliceRun, replay: (seed: number, raw: string) => replaySliceRun(seed, raw, SLICE_REV) },
  { key: "matchup/v2", game: matchupGameFor(MATCHUP_REV2), checkpoint: matchupCheckpoint, mode: "events", rate: 40, encode: encodeMatchupRun, replay: (seed: number, raw: string) => replayMatchupRun(seed, raw, MATCHUP_REV2) },
  { key: "matchup/v3", game: matchupGameFor(MATCHUP_REV), checkpoint: matchupCheckpoint, mode: "events", rate: 40, encode: encodeMatchupRun, replay: (seed: number, raw: string) => replayMatchupRun(seed, raw, MATCHUP_REV) },
  { key: "bubble/v2", game: bubbleGameFor(BUB_REV), checkpoint: bubCheckpoint, mode: "events", rate: 15, encode: encodeBubbleRun, replay: (seed: number, raw: string) => replayBubbleRun(seed, raw, BUB_REV) },
  { key: "hover/v2", game: hoverGameFor(HOVER_REV), checkpoint: hoverCheckpoint, mode: "taps", rate: 60, encode: encodeHoverRun, replay: (seed: number, raw: string) => replayHoverRun(seed, raw, HOVER_REV) },
  { key: "snake/v2", game: snakeGameFor(SNAKE_REV2), checkpoint: snakeCheckpoint, mode: "events", rate: 40, encode: encodeSnakeRun, replay: (seed: number, raw: string) => replaySnakeRun(seed, raw, SNAKE_REV2) },
  { key: "snake/v3", game: snakeGameFor(SNAKE_REV), checkpoint: snakeCheckpoint, mode: "events", rate: 40, encode: encodeSnakeRun, replay: (seed: number, raw: string) => replaySnakeRun(seed, raw, SNAKE_REV) },
  { key: "bintoss/v2", game: binTossGameFor(BINTOSS_REV), checkpoint: binTossCheckpoint, mode: "events", rate: 15, encode: encodeBinTossRun, replay: (seed: number, raw: string) => replayBinTossRun(seed, raw, BINTOSS_REV) },
  { key: "ink/v3", game: inkBridgeGameFor(INK_REV3), checkpoint: inkCheckpoint, mode: "events", rate: 400, encode: encodeInkBridgeRun, replay: (seed: number, raw: string) => replayInkBridgeRun(seed, raw, INK_REV3) },
  { key: "swing/v3", game: swingGameFor(SWING_REV), checkpoint: swingCheckpoint, mode: "events", rate: 30, encode: encodeSwingRun, replay: (seed: number, raw: string) => replaySwingRun(seed, raw, SWING_REV) },
  { key: "hotfloor", game: hotFloorGame, checkpoint: hotfloorCheckpoint, mode: "events", rate: 60, encode: encodeHotFloorRun, replay: replayHotFloorRun },
  { key: "stroop", game: colourClashRev3Game, checkpoint: clashCheckpoint, mode: "events", rate: 18, encode: encodeColourClashRun, replay: (seed: number, raw: string) => replayColourClashRun(seed, raw, 3) },
  { key: "stroop", game: colourClashGame, checkpoint: clashCheckpoint, mode: "events", rate: 18, encode: encodeColourClashRun, replay: (seed: number, raw: string) => replayColourClashRun(seed, raw, 0) },
];

/** A random candidate event, often outside the declared range (a finger off the edge). */
function candidate(ranges: readonly InputRange[], t: number): ArcadeInputEvent {
  const range = ranges[rand(ranges.length)]!;
  const pick = (bound: readonly [number, number]) => {
    const span = bound[1] - bound[0];
    return between(bound[0] - Math.ceil(span / 4) - 2, bound[1] + Math.ceil(span / 4) + 2);
  };
  return { t, k: range.k, a: pick(range.a), b: pick(range.b), c: pick(range.c), d: pick(range.d) };
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

let failures = 0;
const ONLY = process.argv[3]?.split(",");
for (const spec of GAMES.filter((g) => !ONLY || ONLY.includes(g.key))) {
  let worstMs = 0;
  let maxEvents = 0;
  let failed = 0;
  let reason = "";
  for (let run = 0; run < RUNS; run++) {
    const seed = spec.seedFor ? spec.seedFor(run) : between(1, 0x7ffffffe);
    const game = spec.gameFor ? spec.gameFor(seed) : spec.game;
    let state = spec.init ? spec.init(seed) : game.init(seed);
    const events: ArcadeInputEvent[] = [];
    const taps: number[] = [];
    const swerve: { tick: number; dir: 1 | -1 }[] = [];
    const checkpoints: any[] = [];
    const ranges: readonly InputRange[] = game.inputRanges ?? [];
    while (!game.isOver(state) && state.tick < game.runTicks) {
      const t = state.tick + 1;
      const wants = rand(1000) < spec.rate;
      let input: any;
      if (spec.mode === "taps") {
        if (wants) recordTap(taps, t);
        input = tapAt(taps, t);
      } else if (spec.mode === "swerve") {
        if (wants) swerve.push({ tick: t, dir: rand(2) ? 1 : -1 });
        const last = swerve[swerve.length - 1];
        input = (last && last.tick === t ? last.dir : 0) as SwerveInput;
      } else {
        if (wants) recordInput(events, candidate(ranges, t), ranges);
        input = inputAt(events, t);
      }
      state = game.step(state, input);
      if (state.tick % INTERVAL === 0) checkpoints.push(spec.checkpoint(state));
    }
    const score = game.score(state);
    const body = {
      seed,
      claimedScore: score,
      events,
      inputs: taps,
      taps: swerve,
      endTick: state.tick,
      checkpoints,
    };
    const raw = appendClientCounters(spec.encode(body), arcadeCounters(spec.key, state, score));
    maxEvents = Math.max(maxEvents, events.length + taps.length + swerve.length);
    const started = performance.now();
    const result = spec.replay(seed, raw);
    worstMs = Math.max(worstMs, performance.now() - started);
    const problems: string[] = [];
    if (result.score !== score) problems.push(`score ${score} vs ${result.score}`);
    if (!same(result.state, state)) problems.push("full final state");
    if (!same(result.checkpoints, checkpoints)) problems.push("full checkpoint list");
    if (!same(spec.checkpoint(result.state), spec.checkpoint(state))) problems.push("final state");
    if (result.desyncTick !== null) problems.push(`checkpoint desync at ${result.desyncTick}`);
    if (result.inputDiag.clamped || result.inputDiag.dropped)
      problems.push("server repaired a clean log");
    if (result.flagged) problems.push(`flagged ${result.reason ?? ""}`);
    if (problems.length) {
      failed += 1;
      reason ||= `seed ${seed}: ${problems.join(", ")}`;
    }
  }
  if (failed) failures += 1;
  console.log(
    `${spec.key.padEnd(9)} ${failed ? `FAIL ${failed}/${RUNS} — ${reason}` : `ok ${RUNS}/${RUNS}`} · max events ${maxEvents} · worst replay ${worstMs.toFixed(1)}ms`,
  );
}

// Run the unrelated repair check only when Breaker is selected.
if (!ONLY || ONLY.includes("breaker")) {
  const seed = 777;
  const events: ArcadeInputEvent[] = [
    { t: 10, k: 7, a: 200, b: 0, c: 0, d: 0 },
    { t: 5, k: 7, a: -40, b: 0, c: 0, d: 0 },
    { t: 20, k: 7, a: 9999, b: 0, c: 0, d: 0 },
  ];
  const raw = encodeBreakerRun({ seed, claimedScore: 0, events, endTick: 0, checkpoints: [] });
  const result = replayBreakerRun(seed, raw);
  const first = result.inputDiag.first;
  if (result.inputDiag.clamped !== 2 || !first || first.index !== 1 || first.t !== 5) {
    failures += 1;
    console.log("repair: FAIL", result.inputDiag);
  } else {
    console.log(
      `repair: 2 of 3 events clamped, first #${first.index} at tick ${first.t} (${first.reason}); replay ran to tick ${result.replayTick}`,
    );
  }
}

if (failures) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log(`self-replay checks passed for ${GAMES.filter((g) => !ONLY || ONLY.includes(g.key)).length} selected games`);
