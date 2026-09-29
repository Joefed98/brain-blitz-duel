/**
 * Self-replay proof for all 18 arcade games. Each run drives the sim exactly the
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
import { brkCheckpoint, breakerGame } from "@/lib/arcade/breaker";
import { bubCheckpoint, bubbleGame } from "@/lib/arcade/bubble";
import {
  bullseyeCheckpoint,
  bullseyeGame,
  bullseyeInit,
  bullseyeWinds,
} from "@/lib/arcade/bullseye";
import { crossCheckpoint, crossGame } from "@/lib/arcade/cross";
import { dualCheckpoint, dualGame } from "@/lib/arcade/dual";
import { hoverCheckpoint, hoverGame } from "@/lib/arcade/hover";
import { matchupCheckpoint, matchupGame } from "@/lib/arcade/matchup";
import { rallyCheckpoint, rallyGame } from "@/lib/arcade/rally";
import { ricoCheckpoint, ricoGame } from "@/lib/arcade/ricochet";
import { skylineCheckpoint, skylineGame } from "@/lib/arcade/skyline";
import { sliceCheckpoint, sliceGame } from "@/lib/arcade/slice";
import { snakeCheckpoint, snakeGame } from "@/lib/arcade/snake";
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
import { wavCheckpoint, wavefrontGame } from "@/lib/arcade/wavefront";
import { basCheckpoint, bastionGame } from "@/lib/arcade/bastion";
import { encodeWavefrontRun, replayWavefrontRun } from "@/lib/duel/wavefront";
import { encodeBastionRun, replayBastionRun } from "@/lib/duel/bastion";

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
}

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
  {
    key: "bastion",
    game: bastionGame,
    checkpoint: basCheckpoint,
    mode: "events",
    rate: 300,
    encode: encodeBastionRun,
    replay: replayBastionRun,
  },
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
    const seed = between(1, 0x7ffffffe);
    let state = spec.init ? spec.init(seed) : spec.game.init(seed);
    const events: ArcadeInputEvent[] = [];
    const taps: number[] = [];
    const swerve: { tick: number; dir: 1 | -1 }[] = [];
    const checkpoints: any[] = [];
    const ranges: readonly InputRange[] = spec.game.inputRanges ?? [];
    while (!spec.game.isOver(state) && state.tick < spec.game.runTicks) {
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
      state = spec.game.step(state, input);
      if (state.tick % INTERVAL === 0) checkpoints.push(spec.checkpoint(state));
    }
    const score = spec.game.score(state);
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

// Server repair: a bad log is clamped and replayed, never thrown away.
{
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
console.log("self-replay checks passed for all 16 games");
