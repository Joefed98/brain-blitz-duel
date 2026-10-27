/**
 * Self-replay proof for every arcade-engine game: all 22 active arcade games and practice-only Pinball
 * (each on the revision live rooms stamp today, plus the legacy rules stored
 * rounds still replay on), Colour Clash, Letterfall, and the retired games kept for practice. Each run drives the sim exactly the
 * way the phone does — random candidate inputs (many deliberately out of range)
 * go through recordInput/recordTap, and the sim reads its input for each tick
 * from the recorded log only. The submitted string is that log, unmodified.
 * The server replay of it must reach the identical final state and score, with
 * no repaired events and no checkpoint mismatch. Also reports replay wall time.
 *
 * Each GAMES entry draws from its own PRNG stream (seeded from its index), so an entry's
 * seeds and inputs are the same whether it runs alone, in a part or in a whole run.
 * --part=k/n runs one of n disjoint groups of entries, balanced by ENTRY_COST (CI shards
 * split the check this way); together the n parts check exactly what one whole run does.
 *
 *   bun scripts/arcade-self-replay-check.ts [runsPerGame] [keys,…] [--part=k/n]
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
import { beatCheckpoint, beatGame, beatGameFor, BEAT_REV } from "@/lib/arcade/beat";
import { binTossCheckpoint, binTossGame } from "@/lib/arcade/binToss";
import { brkCheckpoint, breakerGame, breakerGameFor, BRK_REV } from "@/lib/arcade/breaker";
import { bubCheckpoint, bubbleGame, bubbleGameFor, BUB_REV } from "@/lib/arcade/bubble";
import {
  bullseyeCheckpoint,
  bullseyeGame,
  bullseyeGameFor,
  bullseyeInit,
  bullseyeInitRev2,
  bullseyeWinds,
  BULLSEYE_REV,
} from "@/lib/arcade/bullseye";
import { crossCheckpoint, crossGame, crossGameFor, CROSS_REV, CROSS_REV2 } from "@/lib/arcade/cross";
import { dualCheckpoint, dualGame } from "@/lib/arcade/dual";
import { hoverCheckpoint, hoverGame, hoverGameFor, HOVER_REV } from "@/lib/arcade/hover";
import { matchupCheckpoint, matchupGame, matchupGameFor, MATCHUP_REV, MATCHUP_REV2 } from "@/lib/arcade/matchup";
import { rallyCheckpoint, rallyGame, rallyGameFor, RALLY_REV } from "@/lib/arcade/rally";
import { ricoCheckpoint, ricoGame } from "@/lib/arcade/ricochet";
import { skylineCheckpoint, skylineGame, skylineGameFor, SKYLINE_REV } from "@/lib/arcade/skyline";
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
import { flipCheckpoint, flipGame, flipGameFor, FLIP_REV } from "@/lib/arcade/flip";
import { encodeFlipRun, replayFlipRun } from "@/lib/duel/flip";
import { juncCheckpoint, junctionGame, junctionGameFor, JUNC_REV } from "@/lib/arcade/junction";
import { encodeJunctionRun, replayJunctionRun } from "@/lib/duel/junction";
import { inkBridgeGame, inkCheckpoint } from "@/lib/arcade/inkBridge";
import { encodeInkBridgeRun, replayInkBridgeRun } from "@/lib/duel/inkBridge";
import { burstCheckpoint, burstGame, burstGameFor, BURST_REV } from "@/lib/arcade/burst";
import { encodeBurstRun, replayBurstRun } from "@/lib/duel/burst";
import { orbitCheckpoint, orbitGame } from "@/lib/arcade/orbit";
import { encodeOrbitRun, replayOrbitRun } from "@/lib/duel/orbit";
import { swingCheckpoint, swingGame } from "@/lib/arcade/swing";
import { tiltCheckpoint, tiltGame, tiltGameFor, TILT_REV } from "@/lib/arcade/tilt";
import { encodeTiltRun, replayTiltRun } from "@/lib/duel/tilt";
import { hotfloorCheckpoint, hotFloorGame } from "@/lib/arcade/hotFloor";
import { encodeHotFloorRun, replayHotFloorRun } from "@/lib/duel/hotFloor";
import { encodeSwingRun, replaySwingRun } from "@/lib/duel/swing";
import { clashCheckpoint, colourClashGame, colourClashRev3Game, colourClashRev4Game, colourClashRev5Game } from "@/lib/arcade/colourClash";
import { encodeColourClashRun, replayColourClashRun } from "@/lib/duel/colourClash";
import { snipCheckpoint, snipGameFor, SNIP_REV, SNIP_REV3 } from "@/lib/arcade/snip";
import { encodeSnipRun, replaySnipRun } from "@/lib/duel/snip";
import { btCheckpoint, makeBallTrackGame, BT_REV } from "@/lib/arcade/ballTrack";
import { encodeBallTrackRun, replayBallTrackRun } from "@/lib/duel/ballTrack";
import { BALL_TRACK_BANK } from "@/lib/duel/ballTrackBank.server";
import { BALL_TRACK_BANK_TALL } from "@/lib/duel/ballTrackBankTall.server";
import { ORBIT_REV3, ORBIT_REV4 } from "@/lib/arcade/orbit";
import { decodeOrbitHoles, decodeRev3Planets, encodeRev3Planets, initRev3From, initRev4From, orbitRev3Game, ORBIT_REV3_WORLD_W } from "@/lib/arcade/orbitRev3";
import { ORBIT_HOLE_BANK } from "@/lib/duel/orbitHoleBank.server";
import { ORBIT_REV3_BANK } from "@/lib/duel/orbitRev3Bank.server";
import { orbitRev3PlanetsForSeed } from "@/lib/duel/orbitRev3Course.server";
import { binTossGameFor, BINTOSS_REV2, BINTOSS_REV3 } from "@/lib/arcade/binToss";
import { inkBridgeGameFor, INK_REV3, INK_REV4, INK_REV_EXPAND, INK_REV_SPREAD } from "@/lib/arcade/inkBridge";
import { swingGameFor, SWING_REV, SWING_REV_V3 } from "@/lib/arcade/swing";
import { wordfallCheckpoint, wordfallGame, wordfallGameFor } from "@/lib/arcade/wordfall";
import { encodeWordfallRun, replayWordfallRun } from "@/lib/duel/wordfall";
// Letterfall's replay checks words: install the same list the server grades with.
import "@/lib/duel/wordfallDict.server";

import { BT_REV_BAND, BT_REV_TALL } from "@/lib/arcade/ballTrack";
import { WAV_REV_BAND, WAV_REV_PHONE, WAV_REV_SHAPES, WAV_REV_TALL, WAV_REV_TUNEC } from "@/lib/arcade/wavefront";
import { FLIP_REV_BAND, FLIP_REV_EXPAND, FLIP_REV_TUNEC } from "@/lib/arcade/flip";
import { INK_REV_BAND, INK_REV_TUNEC } from "@/lib/arcade/inkBridge";
import { MATCHUP_REV_BAND, MATCHUP_REV_PAR, MATCHUP_REV_WAIT } from "@/lib/arcade/matchup";
import { BUB_REV_BAND, BUB_REV_TALL, BUB_REV_TORPEDO } from "@/lib/arcade/bubble";
import { CROSS_REV_BAND, CROSS_REV_EXPAND, CROSS_REV_SMALL } from "@/lib/arcade/cross";
import { RALLY_REV_BAND, RALLY_REV_TALL, RALLY_REV_TUNED, RALLY_REV_TUNEF } from "@/lib/arcade/rally";
import { SNAKE_REV_BAND, SNAKE_REV_ROCKS, SNAKE_REV_TALL, SNAKE_REV_10 } from "@/lib/arcade/snake";
import { BINTOSS_REV_BAND } from "@/lib/arcade/binToss";
import { SNIP_REV_BAND, SNIP_REV_BANK6, SNIP_REV_EXPAND, SNIP_REV_PROVEN, SNIP_REV_TALL } from "@/lib/arcade/snip";
import { SKYLINE_REV_BAND, SKYLINE_REV_TALL } from "@/lib/arcade/skyline";
import { HOVER_REV_BAND, HOVER_REV_EXPAND, HOVER_REV_TALL, HOVER_REV_TUNEC } from "@/lib/arcade/hover";
import { JUNC_REV_BAND } from "@/lib/arcade/junction";
import { BRK_REV_BAND, BRK_REV_TALL, BRK_REV_TUNED, BRK_REV_TUNEF } from "@/lib/arcade/breaker";
import { pinballGameFor, pinCheckpoint, PIN_REV } from "@/lib/arcade/pinball";
import { pin4Checkpoint, pinball5Game, PIN_REV_LONG } from "@/lib/arcade/pinball4";
import { encodePinballRun, replayPinballRun } from "@/lib/duel/pinball";
import { TILT_REV_BAND, TILT_REV_EXPAND, TILT_REV_TUNEC } from "@/lib/arcade/tilt";
import { ORBIT_REV_BAND, ORBIT_REV_SWEPT, ORBIT_REV_TALL, ORBIT_REV_TUNED, ORBIT_REV_XP } from "@/lib/arcade/orbit";
import { decodeOrbitExtras, initBandFrom, initSweptFrom, initTallFrom, initTunedFrom, initXpFrom } from "@/lib/arcade/orbitRev3";
import { ORBIT_XP_BANK } from "@/lib/duel/orbitXpBank.server";
import { BEAT_REV_BAND, BEAT_REV_TALL, BEAT_REV_TUNEC, BEAT_REV_TUNEF } from "@/lib/arcade/beat";
import { SLICE_REV_BAND, SLICE_REV_LONG, SLICE_REV_TALL, SLICE_REV_TUNEC } from "@/lib/arcade/slice";
import { BURST_REV_BAND, BURST_REV_TALL } from "@/lib/arcade/burst";
import { SWING_REV_BAND, SWING_REV_TUNED, SWING_REV_TUNEC, SWING_REV_SPREAD, SWING_REV_TALL, SWING_REV_EXPAND } from "@/lib/arcade/swing";
import { SWING_V13_BANK } from "@/lib/duel/swingBankV13.server";
import { BULLSEYE_REV_BAND, BULLSEYE_REV_TUNED, bullseyeInitFor } from "@/lib/arcade/bullseye";

/* eslint-disable @typescript-eslint/no-explicit-any */
const POSITIONAL = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const RUNS = Number(POSITIONAL[0] ?? 40);
const PART_ARG = process.argv.find((a) => a.startsWith("--part="))?.slice(7);
const INTERVAL = 300;

let rng = 12345;
/** Entry i's own stream; entry 0 starts where the single shared stream used to (12345). */
const seedStream = (i: number) => {
  rng = (12345 + Math.imul(i, 0x9e3779b9)) >>> 0;
};
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
const btCourseTall = (seed: number) => BALL_TRACK_BANK_TALL[seed % BALL_TRACK_BANK_TALL.length]!.course;
/** Orbit rev 3: rooms only deal bank seeds, with the proved planets stored in the puzzle. */
const orbitPlanets = (seed: number) => {
  const planets = orbitRev3PlanetsForSeed(seed);
  if (!planets) throw new Error(`orbit rev3: seed ${seed} is not a bank seed`);
  return planets;
};

/** Orbit rev 4: rooms only deal bank courses that have proved holes, shipped in the puzzle. */
const orbitHoles = (seed: number) => {
  const entry = ORBIT_HOLE_BANK.find((e) => e.seed === seed);
  if (!entry) throw new Error(`orbit rev4: seed ${seed} has no holes`);
  return entry.holes;
};
/** The bank course with exactly this seed (its holes were proved on it). */
const orbitCourse = (seed: number) => decodeRev3Planets(ORBIT_REV3_BANK.find((e) => e.seed === seed)!.planets);

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
  { key: "flip", game: flipGame, checkpoint: flipCheckpoint, mode: "events", rate: 50, encode: encodeFlipRun, replay: replayFlipRun },
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
  {
    key: "orbit/v4",
    game: orbitRev3Game,
    gameFor: (seed: number) => ({ ...orbitRev3Game, init: () => initRev4From(orbitCourse(seed), ORBIT_REV3_WORLD_W, decodeOrbitHoles(orbitHoles(seed))) }),
    seedFor: (n: number) => ORBIT_HOLE_BANK[n % ORBIT_HOLE_BANK.length]!.seed,
    checkpoint: orbitCheckpoint,
    mode: "events",
    rate: 25,
    encode: encodeOrbitRun,
    replay: (seed: number, raw: string) => replayOrbitRun(seed, raw, ORBIT_REV4, encodeRev3Planets(orbitCourse(seed)), orbitHoles(seed)),
  },
  { key: "cross/v2", game: crossGameFor(CROSS_REV2), checkpoint: crossCheckpoint, mode: "events", rate: 60, encode: encodeCrossRun, replay: (seed: number, raw: string) => replayCrossRun(seed, raw, CROSS_REV2) },
  { key: "cross/v3", game: crossGameFor(CROSS_REV), checkpoint: crossCheckpoint, mode: "events", rate: 60, encode: encodeCrossRun, replay: (seed: number, raw: string) => replayCrossRun(seed, raw, CROSS_REV) },
  { key: "flip/v2", game: flipGameFor(FLIP_REV), checkpoint: flipCheckpoint, mode: "events", rate: 50, encode: encodeFlipRun, replay: (seed: number, raw: string) => replayFlipRun(seed, raw, FLIP_REV) },
  { key: "slice/v2", game: sliceGameFor(SLICE_REV), checkpoint: sliceCheckpoint, mode: "events", rate: 1000, encode: encodeSliceRun, replay: (seed: number, raw: string) => replaySliceRun(seed, raw, SLICE_REV) },
  { key: "matchup/v2", game: matchupGameFor(MATCHUP_REV2), checkpoint: matchupCheckpoint, mode: "events", rate: 40, encode: encodeMatchupRun, replay: (seed: number, raw: string) => replayMatchupRun(seed, raw, MATCHUP_REV2) },
  { key: "matchup/v3", game: matchupGameFor(MATCHUP_REV), checkpoint: matchupCheckpoint, mode: "events", rate: 40, encode: encodeMatchupRun, replay: (seed: number, raw: string) => replayMatchupRun(seed, raw, MATCHUP_REV) },
  { key: "bubble/v2", game: bubbleGameFor(BUB_REV), checkpoint: bubCheckpoint, mode: "events", rate: 15, encode: encodeBubbleRun, replay: (seed: number, raw: string) => replayBubbleRun(seed, raw, BUB_REV) },
  { key: "snip/v3", game: snipGameFor(SNIP_REV3), checkpoint: snipCheckpoint, mode: "events", rate: 40, encode: encodeSnipRun, replay: (seed: number, raw: string) => replaySnipRun(seed, raw, SNIP_REV3) },
  { key: "junction/v2", game: junctionGameFor(JUNC_REV), checkpoint: juncCheckpoint, mode: "events", rate: 15, encode: encodeJunctionRun, replay: (seed: number, raw: string) => replayJunctionRun(seed, raw, JUNC_REV) },
  { key: "tilt/v2", game: tiltGameFor(TILT_REV), checkpoint: tiltCheckpoint, mode: "events", rate: 500, encode: encodeTiltRun, replay: (seed: number, raw: string) => replayTiltRun(seed, raw, TILT_REV) },
  { key: "skyline/v2", game: skylineGameFor(SKYLINE_REV), checkpoint: skylineCheckpoint, mode: "taps", rate: 15, encode: encodeSkylineRun, replay: (seed: number, raw: string) => replaySkylineRun(seed, raw, SKYLINE_REV) },
  { key: "hover/v2", game: hoverGameFor(HOVER_REV), checkpoint: hoverCheckpoint, mode: "taps", rate: 60, encode: encodeHoverRun, replay: (seed: number, raw: string) => replayHoverRun(seed, raw, HOVER_REV) },
  { key: "snake/v2", game: snakeGameFor(SNAKE_REV2), checkpoint: snakeCheckpoint, mode: "events", rate: 40, encode: encodeSnakeRun, replay: (seed: number, raw: string) => replaySnakeRun(seed, raw, SNAKE_REV2) },
  { key: "snake/v3", game: snakeGameFor(SNAKE_REV), checkpoint: snakeCheckpoint, mode: "events", rate: 40, encode: encodeSnakeRun, replay: (seed: number, raw: string) => replaySnakeRun(seed, raw, SNAKE_REV) },
  { key: "bintoss/v2", game: binTossGameFor(BINTOSS_REV2), checkpoint: binTossCheckpoint, mode: "events", rate: 15, encode: encodeBinTossRun, replay: (seed: number, raw: string) => replayBinTossRun(seed, raw, BINTOSS_REV2) },
  {
    key: "bullseye/v2",
    game: bullseyeGameFor(BULLSEYE_REV),
    checkpoint: bullseyeCheckpoint,
    init: (seed: number) => bullseyeInitRev2(seed, bullseyeWinds(seed)),
    mode: "events",
    rate: 25,
    encode: encodeBullseyeRun,
    replay: (seed: number, raw: string) => replayBullseyeRun(seed, raw, bullseyeWinds(seed), BULLSEYE_REV),
  },
  { key: "rally/v2", game: rallyGameFor(RALLY_REV), checkpoint: rallyCheckpoint, mode: "events", rate: 120, encode: encodeRallyRun, replay: (seed: number, raw: string) => replayRallyRun(seed, raw, RALLY_REV) },
  { key: "beat/v2", game: beatGameFor(BEAT_REV), checkpoint: beatCheckpoint, mode: "events", rate: 200, encode: encodeBeatRun, replay: (seed: number, raw: string) => replayBeatRun(seed, raw, BEAT_REV) },
  { key: "bintoss/v3", game: binTossGameFor(BINTOSS_REV3), checkpoint: binTossCheckpoint, mode: "events", rate: 15, encode: encodeBinTossRun, replay: (seed: number, raw: string) => replayBinTossRun(seed, raw, BINTOSS_REV3) },
  { key: "ink/v3", game: inkBridgeGameFor(INK_REV3), checkpoint: inkCheckpoint, mode: "events", rate: 400, encode: encodeInkBridgeRun, replay: (seed: number, raw: string) => replayInkBridgeRun(seed, raw, INK_REV3) },
  { key: "ink/v4", game: inkBridgeGameFor(INK_REV4), checkpoint: inkCheckpoint, mode: "events", rate: 400, encode: encodeInkBridgeRun, replay: (seed: number, raw: string) => replayInkBridgeRun(seed, raw, INK_REV4) },
  { key: "swing/v3", game: swingGameFor(SWING_REV_V3), checkpoint: swingCheckpoint, mode: "events", rate: 30, encode: encodeSwingRun, replay: (seed: number, raw: string) => replaySwingRun(seed, raw, SWING_REV_V3) },
  { key: "swing/v4", game: swingGameFor(SWING_REV), checkpoint: swingCheckpoint, mode: "events", rate: 30, encode: encodeSwingRun, replay: (seed: number, raw: string) => replaySwingRun(seed, raw, SWING_REV) },
  // Oct 2026 score bands: every active arcade game's band revision (same play as the live revision, new score).
  { key: "wavefront/band", game: wavefrontGameFor(WAV_REV_BAND), checkpoint: wavCheckpoint, mode: "events", rate: 300, encode: encodeWavefrontRun, replay: (seed: number, raw: string) => replayWavefrontRun(seed, raw, WAV_REV_BAND) },
  { key: "flip/band", game: flipGameFor(FLIP_REV_BAND), checkpoint: flipCheckpoint, mode: "events", rate: 50, encode: encodeFlipRun, replay: (seed: number, raw: string) => replayFlipRun(seed, raw, FLIP_REV_BAND) },
  { key: "ink/band", game: inkBridgeGameFor(INK_REV_BAND), checkpoint: inkCheckpoint, mode: "events", rate: 400, encode: encodeInkBridgeRun, replay: (seed: number, raw: string) => replayInkBridgeRun(seed, raw, INK_REV_BAND) },
  { key: "matchup/band", game: matchupGameFor(MATCHUP_REV_BAND), checkpoint: matchupCheckpoint, mode: "events", rate: 40, encode: encodeMatchupRun, replay: (seed: number, raw: string) => replayMatchupRun(seed, raw, MATCHUP_REV_BAND) },
  { key: "bubble/band", game: bubbleGameFor(BUB_REV_BAND), checkpoint: bubCheckpoint, mode: "events", rate: 15, encode: encodeBubbleRun, replay: (seed: number, raw: string) => replayBubbleRun(seed, raw, BUB_REV_BAND) },
  { key: "bubble/torpedo", game: bubbleGameFor(BUB_REV_TORPEDO), checkpoint: bubCheckpoint, mode: "events", rate: 15, encode: encodeBubbleRun, replay: (seed: number, raw: string) => replayBubbleRun(seed, raw, BUB_REV_TORPEDO) },
  { key: "cross/band", game: crossGameFor(CROSS_REV_BAND), checkpoint: crossCheckpoint, mode: "events", rate: 60, encode: encodeCrossRun, replay: (seed: number, raw: string) => replayCrossRun(seed, raw, CROSS_REV_BAND) },
  { key: "rally/band", game: rallyGameFor(RALLY_REV_BAND), checkpoint: rallyCheckpoint, mode: "events", rate: 120, encode: encodeRallyRun, replay: (seed: number, raw: string) => replayRallyRun(seed, raw, RALLY_REV_BAND) },
  { key: "rally/tuned", game: rallyGameFor(RALLY_REV_TUNED), checkpoint: rallyCheckpoint, mode: "events", rate: 120, encode: encodeRallyRun, replay: (seed: number, raw: string) => replayRallyRun(seed, raw, RALLY_REV_TUNED) },
  { key: "snake/band", game: snakeGameFor(SNAKE_REV_BAND), checkpoint: snakeCheckpoint, mode: "events", rate: 40, encode: encodeSnakeRun, replay: (seed: number, raw: string) => replaySnakeRun(seed, raw, SNAKE_REV_BAND) },
  { key: "bintoss/band", game: binTossGameFor(BINTOSS_REV_BAND), checkpoint: binTossCheckpoint, mode: "events", rate: 15, encode: encodeBinTossRun, replay: (seed: number, raw: string) => replayBinTossRun(seed, raw, BINTOSS_REV_BAND) },
  { key: "snip/band", game: snipGameFor(SNIP_REV_BAND), checkpoint: snipCheckpoint, mode: "events", rate: 40, encode: encodeSnipRun, replay: (seed: number, raw: string) => replaySnipRun(seed, raw, SNIP_REV_BAND) },
  { key: "skyline/band", game: skylineGameFor(SKYLINE_REV_BAND), checkpoint: skylineCheckpoint, mode: "taps", rate: 15, encode: encodeSkylineRun, replay: (seed: number, raw: string) => replaySkylineRun(seed, raw, SKYLINE_REV_BAND) },
  { key: "hover/band", game: hoverGameFor(HOVER_REV_BAND), checkpoint: hoverCheckpoint, mode: "taps", rate: 60, encode: encodeHoverRun, replay: (seed: number, raw: string) => replayHoverRun(seed, raw, HOVER_REV_BAND) },
  { key: "junction/band", game: junctionGameFor(JUNC_REV_BAND), checkpoint: juncCheckpoint, mode: "events", rate: 15, encode: encodeJunctionRun, replay: (seed: number, raw: string) => replayJunctionRun(seed, raw, JUNC_REV_BAND) },
  { key: "breaker/band", game: breakerGameFor(BRK_REV_BAND), checkpoint: brkCheckpoint, mode: "events", rate: 950, encode: encodeBreakerRun, replay: (seed: number, raw: string) => replayBreakerRun(seed, raw, BRK_REV_BAND) },
  { key: "breaker/tuned", game: breakerGameFor(BRK_REV_TUNED), checkpoint: brkCheckpoint, mode: "events", rate: 950, encode: encodeBreakerRun, replay: (seed: number, raw: string) => replayBreakerRun(seed, raw, BRK_REV_TUNED) },
  { key: "tilt/band", game: tiltGameFor(TILT_REV_BAND), checkpoint: tiltCheckpoint, mode: "events", rate: 500, encode: encodeTiltRun, replay: (seed: number, raw: string) => replayTiltRun(seed, raw, TILT_REV_BAND) },
  { key: "beat/band", game: beatGameFor(BEAT_REV_BAND), checkpoint: beatCheckpoint, mode: "events", rate: 200, encode: encodeBeatRun, replay: (seed: number, raw: string) => replayBeatRun(seed, raw, BEAT_REV_BAND) },
  { key: "slice/band", game: sliceGameFor(SLICE_REV_BAND), checkpoint: sliceCheckpoint, mode: "events", rate: 1000, encode: encodeSliceRun, replay: (seed: number, raw: string) => replaySliceRun(seed, raw, SLICE_REV_BAND) },
  { key: "burst/band", game: burstGameFor(BURST_REV_BAND), checkpoint: burstCheckpoint, mode: "events", rate: 120, encode: encodeBurstRun, replay: (seed: number, raw: string) => replayBurstRun(seed, raw, BURST_REV_BAND) },
  { key: "swing/band", game: swingGameFor(SWING_REV_BAND), checkpoint: swingCheckpoint, mode: "events", rate: 30, encode: encodeSwingRun, replay: (seed: number, raw: string) => replaySwingRun(seed, raw, SWING_REV_BAND) },
  {
    key: "balltrack/band",
    game: makeBallTrackGame(btCourse(0), BT_REV_BAND),
    gameFor: (seed: number) => makeBallTrackGame(btCourse(seed), BT_REV_BAND),
    checkpoint: btCheckpoint,
    mode: "events",
    rate: 30,
    encode: (run: any) => encodeBallTrackRun(btCourse(run.seed), run, BT_REV_BAND),
    replay: (seed: number, raw: string) => replayBallTrackRun(btCourse(seed), seed, raw, BT_REV_BAND),
  },
  {
    key: "orbit/band",
    game: orbitRev3Game,
    gameFor: (seed: number) => ({ ...orbitRev3Game, init: () => initBandFrom(orbitCourse(seed), ORBIT_REV3_WORLD_W, decodeOrbitHoles(orbitHoles(seed))) }),
    seedFor: (n: number) => ORBIT_HOLE_BANK[n % ORBIT_HOLE_BANK.length]!.seed,
    checkpoint: orbitCheckpoint,
    mode: "events",
    rate: 25,
    encode: encodeOrbitRun,
    replay: (seed: number, raw: string) => replayOrbitRun(seed, raw, ORBIT_REV_BAND, encodeRev3Planets(orbitCourse(seed)), orbitHoles(seed)),
  },
  // Tuning A (Oct 2026): the revisions that changed play on the band curve.
  { key: "wavefront/shapes", game: wavefrontGameFor(WAV_REV_SHAPES), checkpoint: wavCheckpoint, mode: "events", rate: 300, encode: encodeWavefrontRun, replay: (seed: number, raw: string) => replayWavefrontRun(seed, raw, WAV_REV_SHAPES) },
  { key: "swing/tuned", game: swingGameFor(SWING_REV_TUNED), checkpoint: swingCheckpoint, mode: "events", rate: 30, encode: encodeSwingRun, replay: (seed: number, raw: string) => replaySwingRun(seed, raw, SWING_REV_TUNED) },
  {
    key: "orbit/tuned",
    game: orbitRev3Game,
    gameFor: (seed: number) => ({ ...orbitRev3Game, init: () => initTunedFrom(orbitCourse(seed), ORBIT_REV3_WORLD_W, decodeOrbitHoles(orbitHoles(seed))) }),
    seedFor: (n: number) => ORBIT_HOLE_BANK[n % ORBIT_HOLE_BANK.length]!.seed,
    checkpoint: orbitCheckpoint,
    mode: "events",
    rate: 25,
    encode: encodeOrbitRun,
    replay: (seed: number, raw: string) => replayOrbitRun(seed, raw, ORBIT_REV_TUNED, encodeRev3Planets(orbitCourse(seed)), orbitHoles(seed)),
  },
  {
    key: "bullseye/band",
    game: bullseyeGameFor(BULLSEYE_REV_BAND),
    checkpoint: bullseyeCheckpoint,
    init: (seed: number) => bullseyeInitFor(seed, bullseyeWinds(seed), BULLSEYE_REV_BAND),
    mode: "events",
    rate: 25,
    encode: encodeBullseyeRun,
    replay: (seed: number, raw: string) => replayBullseyeRun(seed, raw, bullseyeWinds(seed), BULLSEYE_REV_BAND),
  },
  {
    // Tuning B: value balloons across the board (bullRev 4).
    key: "bullseye/tuned",
    game: bullseyeGameFor(BULLSEYE_REV_TUNED),
    checkpoint: bullseyeCheckpoint,
    init: (seed: number) => bullseyeInitFor(seed, bullseyeWinds(seed), BULLSEYE_REV_TUNED),
    mode: "events",
    rate: 25,
    encode: encodeBullseyeRun,
    replay: (seed: number, raw: string) => replayBullseyeRun(seed, raw, bullseyeWinds(seed), BULLSEYE_REV_TUNED),
  },
  // Tuning C (Oct 2026): every revision it stamps.
  { key: "matchup/wait", game: matchupGameFor(MATCHUP_REV_WAIT), checkpoint: matchupCheckpoint, mode: "events", rate: 40, encode: encodeMatchupRun, replay: (seed: number, raw: string) => replayMatchupRun(seed, raw, MATCHUP_REV_WAIT) },
  // Tuning F (Oct 2026).
  { key: "slice/long", game: sliceGameFor(SLICE_REV_LONG), checkpoint: sliceCheckpoint, mode: "events", rate: 1000, encode: encodeSliceRun, replay: (seed: number, raw: string) => replaySliceRun(seed, raw, SLICE_REV_LONG) },
  { key: "cross/small", game: crossGameFor(CROSS_REV_SMALL), checkpoint: crossCheckpoint, mode: "events", rate: 60, encode: encodeCrossRun, replay: (seed: number, raw: string) => replayCrossRun(seed, raw, CROSS_REV_SMALL) },
  { key: "matchup/par", game: matchupGameFor(MATCHUP_REV_PAR), checkpoint: matchupCheckpoint, mode: "events", rate: 40, encode: encodeMatchupRun, replay: (seed: number, raw: string) => replayMatchupRun(seed, raw, MATCHUP_REV_PAR) },
  { key: "swing/tunec", game: swingGameFor(SWING_REV_TUNEC), checkpoint: swingCheckpoint, mode: "events", rate: 30, encode: encodeSwingRun, replay: (seed: number, raw: string) => replaySwingRun(seed, raw, SWING_REV_TUNEC) },
  // Tuning F (Oct 2026): Grappler's evenly spread stars.
  { key: "swing/spread", game: swingGameFor(SWING_REV_SPREAD), checkpoint: swingCheckpoint, mode: "events", rate: 30, encode: encodeSwingRun, replay: (seed: number, raw: string) => replaySwingRun(seed, raw, SWING_REV_SPREAD) },
  { key: "hover/tunec", game: hoverGameFor(HOVER_REV_TUNEC), checkpoint: hoverCheckpoint, mode: "taps", rate: 60, encode: encodeHoverRun, replay: (seed: number, raw: string) => replayHoverRun(seed, raw, HOVER_REV_TUNEC) },
  { key: "inkbridge/tunec", game: inkBridgeGameFor(INK_REV_TUNEC), checkpoint: inkCheckpoint, mode: "events", rate: 400, encode: encodeInkBridgeRun, replay: (seed: number, raw: string) => replayInkBridgeRun(seed, raw, INK_REV_TUNEC) },
  { key: "flip/tunec", game: flipGameFor(FLIP_REV_TUNEC), checkpoint: flipCheckpoint, mode: "events", rate: 50, encode: encodeFlipRun, replay: (seed: number, raw: string) => replayFlipRun(seed, raw, FLIP_REV_TUNEC) },
  { key: "beat/tunec", game: beatGameFor(BEAT_REV_TUNEC), checkpoint: beatCheckpoint, mode: "events", rate: 200, encode: encodeBeatRun, replay: (seed: number, raw: string) => replayBeatRun(seed, raw, BEAT_REV_TUNEC) },
  { key: "wavefront/tunec", game: wavefrontGameFor(WAV_REV_TUNEC), checkpoint: wavCheckpoint, mode: "events", rate: 300, encode: encodeWavefrontRun, replay: (seed: number, raw: string) => replayWavefrontRun(seed, raw, WAV_REV_TUNEC) },
  { key: "tilt/tunec", game: tiltGameFor(TILT_REV_TUNEC), checkpoint: tiltCheckpoint, mode: "events", rate: 500, encode: encodeTiltRun, replay: (seed: number, raw: string) => replayTiltRun(seed, raw, TILT_REV_TUNEC) },
  { key: "slice/tunec", game: sliceGameFor(SLICE_REV_TUNEC), checkpoint: sliceCheckpoint, mode: "events", rate: 1000, encode: encodeSliceRun, replay: (seed: number, raw: string) => replaySliceRun(seed, raw, SLICE_REV_TUNEC) },
  // Tuning E (Oct 2026): the taller worlds' revisions.
  { key: "hover/tall", game: hoverGameFor(HOVER_REV_TALL), checkpoint: hoverCheckpoint, mode: "taps", rate: 60, encode: encodeHoverRun, replay: (seed: number, raw: string) => replayHoverRun(seed, raw, HOVER_REV_TALL) },
  { key: "skyline/tall", game: skylineGameFor(SKYLINE_REV_TALL), checkpoint: skylineCheckpoint, mode: "taps", rate: 15, encode: encodeSkylineRun, replay: (seed: number, raw: string) => replaySkylineRun(seed, raw, SKYLINE_REV_TALL) },
  { key: "snake/tall", game: snakeGameFor(SNAKE_REV_TALL), checkpoint: snakeCheckpoint, mode: "events", rate: 40, encode: encodeSnakeRun, replay: (seed: number, raw: string) => replaySnakeRun(seed, raw, SNAKE_REV_TALL) },
  { key: "snip/tall", game: snipGameFor(SNIP_REV_TALL), checkpoint: snipCheckpoint, mode: "events", rate: 40, encode: encodeSnipRun, replay: (seed: number, raw: string) => replaySnipRun(seed, raw, SNIP_REV_TALL) },
  // Tuning F (Oct 2026): Breaker's 2.5 s Fireball, Rally's second bumper, Tempo's thinner chart, Meteor's extra rocks, Orbit's swept holes.
  { key: "breaker/tunef", game: breakerGameFor(BRK_REV_TUNEF), checkpoint: brkCheckpoint, mode: "events", rate: 950, encode: encodeBreakerRun, replay: (seed: number, raw: string) => replayBreakerRun(seed, raw, BRK_REV_TUNEF) },
  { key: "rally/tunef", game: rallyGameFor(RALLY_REV_TUNEF), checkpoint: rallyCheckpoint, mode: "events", rate: 120, encode: encodeRallyRun, replay: (seed: number, raw: string) => replayRallyRun(seed, raw, RALLY_REV_TUNEF) },
  { key: "beat/tunef", game: beatGameFor(BEAT_REV_TUNEF), checkpoint: beatCheckpoint, mode: "events", rate: 200, encode: encodeBeatRun, replay: (seed: number, raw: string) => replayBeatRun(seed, raw, BEAT_REV_TUNEF) },
  { key: "snake/rocks", game: snakeGameFor(SNAKE_REV_ROCKS), checkpoint: snakeCheckpoint, mode: "events", rate: 40, encode: encodeSnakeRun, replay: (seed: number, raw: string) => replaySnakeRun(seed, raw, SNAKE_REV_ROCKS) },
  // Joe's phone notes (27 Oct 2026): Meteor snakeRev 10 (2 × 2 rocks, a third wormhole pair, a second lane, longer gold stars).
  { key: "snake/v10", game: snakeGameFor(SNAKE_REV_10), checkpoint: snakeCheckpoint, mode: "events", rate: 40, encode: encodeSnakeRun, replay: (seed: number, raw: string) => replaySnakeRun(seed, raw, SNAKE_REV_10) },
  // Taller worlds batch 1 (Oct 2026): Breaker's and Rally's taller courts, Wavefront's taller world, Fission's taller arena.
  { key: "breaker/tall", game: breakerGameFor(BRK_REV_TALL), checkpoint: brkCheckpoint, mode: "events", rate: 950, encode: encodeBreakerRun, replay: (seed: number, raw: string) => replayBreakerRun(seed, raw, BRK_REV_TALL) },
  { key: "rally/tall", game: rallyGameFor(RALLY_REV_TALL), checkpoint: rallyCheckpoint, mode: "events", rate: 120, encode: encodeRallyRun, replay: (seed: number, raw: string) => replayRallyRun(seed, raw, RALLY_REV_TALL) },
  { key: "wavefront/tall", game: wavefrontGameFor(WAV_REV_TALL), checkpoint: wavCheckpoint, mode: "events", rate: 300, encode: encodeWavefrontRun, replay: (seed: number, raw: string) => replayWavefrontRun(seed, raw, WAV_REV_TALL) },
  { key: "burst/tall", game: burstGameFor(BURST_REV_TALL), checkpoint: burstCheckpoint, mode: "events", rate: 120, encode: encodeBurstRun, replay: (seed: number, raw: string) => replayBurstRun(seed, raw, BURST_REV_TALL) },
  {
    key: "orbit/swept",
    game: orbitRev3Game,
    gameFor: (seed: number) => ({ ...orbitRev3Game, init: () => initSweptFrom(orbitCourse(seed), ORBIT_REV3_WORLD_W, decodeOrbitHoles(orbitHoles(seed))) }),
    seedFor: (n: number) => ORBIT_HOLE_BANK[n % ORBIT_HOLE_BANK.length]!.seed,
    checkpoint: orbitCheckpoint,
    mode: "events",
    rate: 25,
    encode: encodeOrbitRun,
    replay: (seed: number, raw: string) => replayOrbitRun(seed, raw, ORBIT_REV_SWEPT, encodeRev3Planets(orbitCourse(seed)), orbitHoles(seed)),
  },
  { key: "snip/bank6", game: snipGameFor(SNIP_REV_BANK6), checkpoint: snipCheckpoint, mode: "events", rate: 40, encode: encodeSnipRun, replay: (seed: number, raw: string) => replaySnipRun(seed, raw, SNIP_REV_BANK6) },
  { key: "snip/proven", game: snipGameFor(SNIP_REV_PROVEN), checkpoint: snipCheckpoint, mode: "events", rate: 40, encode: encodeSnipRun, replay: (seed: number, raw: string) => replaySnipRun(seed, raw, SNIP_REV_PROVEN) },
  { key: "hotfloor", game: hotFloorGame, checkpoint: hotfloorCheckpoint, mode: "events", rate: 60, encode: encodeHotFloorRun, replay: replayHotFloorRun },
  { key: "stroop", game: colourClashRev4Game, checkpoint: clashCheckpoint, mode: "events", rate: 18, encode: encodeColourClashRun, replay: (seed: number, raw: string) => replayColourClashRun(seed, raw, 4) },
  { key: "stroop", game: colourClashRev3Game, checkpoint: clashCheckpoint, mode: "events", rate: 18, encode: encodeColourClashRun, replay: (seed: number, raw: string) => replayColourClashRun(seed, raw, 3) },
  { key: "stroop", game: colourClashGame, checkpoint: clashCheckpoint, mode: "events", rate: 18, encode: encodeColourClashRun, replay: (seed: number, raw: string) => replayColourClashRun(seed, raw, 0) },
  // Pinball (practice only until PINBALL_IN_ROOMS): held-flipper changes, often both at once.
  { key: "pinball", game: pinballGameFor(PIN_REV), checkpoint: pinCheckpoint, mode: "events", rate: 120, encode: encodePinballRun, replay: (seed: number, raw: string) => replayPinballRun(seed, raw, PIN_REV) },
  // Letterfall (Word category, engine sim): taps and Enter presses, words checked by the shared list.
  { key: "wordfall", game: wordfallGame, checkpoint: wordfallCheckpoint, mode: "events", rate: 120, encode: encodeWordfallRun, replay: (seed: number, raw: string) => replayWordfallRun(seed, raw) },
  // wordfallRev 2: slower drops, fewer vowels, the Enter box in a taller world.
  { key: "wordfall", game: wordfallGameFor(2), checkpoint: wordfallCheckpoint, mode: "events", rate: 120, encode: (run: Parameters<typeof encodeWordfallRun>[0]) => encodeWordfallRun(run, 2), replay: (seed: number, raw: string) => replayWordfallRun(seed, raw, 2) },  // Taller worlds batch 2 (16 Oct 2026), appended so every earlier entry keeps its index (ENTRY_COST, --part):
  // Tempo's longer lanes, Slice's taller board, Coral Pop's deeper tank, Mixed Signals' taller board.
  { key: "beat/tall", game: beatGameFor(BEAT_REV_TALL), checkpoint: beatCheckpoint, mode: "events", rate: 200, encode: encodeBeatRun, replay: (seed: number, raw: string) => replayBeatRun(seed, raw, BEAT_REV_TALL) },
  { key: "slice/tall", game: sliceGameFor(SLICE_REV_TALL), checkpoint: sliceCheckpoint, mode: "events", rate: 1000, encode: encodeSliceRun, replay: (seed: number, raw: string) => replaySliceRun(seed, raw, SLICE_REV_TALL) },
  { key: "bubble/tall", game: bubbleGameFor(BUB_REV_TALL), checkpoint: bubCheckpoint, mode: "events", rate: 15, encode: encodeBubbleRun, replay: (seed: number, raw: string) => replayBubbleRun(seed, raw, BUB_REV_TALL) },
  { key: "stroop", game: colourClashRev5Game, checkpoint: clashCheckpoint, mode: "events", rate: 18, encode: encodeColourClashRun, replay: (seed: number, raw: string) => replayColourClashRun(seed, raw, 5) },
  // Taller worlds batch 3 (16 Oct 2026), appended: Grappler's taller cavern, Orbit's taller view, Ball Tracker's 12-row board.
  { key: "swing/tall", game: swingGameFor(SWING_REV_TALL), checkpoint: swingCheckpoint, mode: "events", rate: 30, encode: encodeSwingRun, replay: (seed: number, raw: string) => replaySwingRun(seed, raw, SWING_REV_TALL) },
  {
    key: "orbit/tall",
    game: orbitRev3Game,
    gameFor: (seed: number) => ({ ...orbitRev3Game, init: () => initTallFrom(orbitCourse(seed), ORBIT_REV3_WORLD_W, decodeOrbitHoles(orbitHoles(seed))) }),
    seedFor: (n: number) => ORBIT_HOLE_BANK[n % ORBIT_HOLE_BANK.length]!.seed,
    checkpoint: orbitCheckpoint,
    mode: "events",
    rate: 25,
    encode: encodeOrbitRun,
    replay: (seed: number, raw: string) => replayOrbitRun(seed, raw, ORBIT_REV_TALL, encodeRev3Planets(orbitCourse(seed)), orbitHoles(seed)),
  },
  {
    key: "balltrack/tall",
    game: makeBallTrackGame(btCourseTall(0), BT_REV_TALL),
    gameFor: (seed: number) => makeBallTrackGame(btCourseTall(seed), BT_REV_TALL),
    checkpoint: btCheckpoint,
    mode: "events",
    rate: 30,
    encode: (run: any) => encodeBallTrackRun(btCourseTall(run.seed), run, BT_REV_TALL),
    replay: (seed: number, raw: string) => replayBallTrackRun(btCourseTall(seed), seed, raw, BT_REV_TALL),
  },
  // The 200 expansion (26 Oct 2026): Hover hoverRev 9 (tight gates, centre lines, star chains, shields).
  { key: "hover/x200", game: hoverGameFor(HOVER_REV_EXPAND), checkpoint: hoverCheckpoint, mode: "taps", rate: 60, encode: encodeHoverRun, replay: (seed: number, raw: string) => replayHoverRun(seed, raw, HOVER_REV_EXPAND) },
  // Grappler's 200 expansion (swingRev 13, 26 Oct 2026), appended so every earlier entry keeps its index: its bank courses.
  {
    key: "swing/expand",
    game: swingGameFor(SWING_REV_EXPAND),
    seedFor: (n: number) => SWING_V13_BANK[n % SWING_V13_BANK.length]!.seed,
    checkpoint: swingCheckpoint,
    mode: "events",
    rate: 30,
    encode: encodeSwingRun,
    replay: (seed: number, raw: string) => replaySwingRun(seed, raw, SWING_REV_EXPAND),
  },
  // Roofbound's expansion (flipRev 8, docs/expansions/x200-flip.md), appended so every earlier entry keeps its index.
  { key: "flip/x200", game: flipGameFor(FLIP_REV_EXPAND), checkpoint: flipCheckpoint, mode: "events", rate: 50, encode: encodeFlipRun, replay: (seed: number, raw: string) => replayFlipRun(seed, raw, FLIP_REV_EXPAND) },
  // The 200-point expansion (snipRev 11, 26 Oct 2026; appended so every earlier entry keeps its index): the tall
  // courses, several fruits, wind, rings, par times.
  { key: "snip/expand", game: snipGameFor(SNIP_REV_EXPAND), checkpoint: snipCheckpoint, mode: "events", rate: 40, encode: encodeSnipRun, replay: (seed: number, raw: string) => replaySnipRun(seed, raw, SNIP_REV_EXPAND) },
  // The expansion to 200 (docs/expansions/x200-orbit.md), appended: Orbit orbitRev 12 on its feature-bank courses.
  {
    key: "orbit/xp",
    game: orbitRev3Game,
    gameFor: (seed: number) => ({ ...orbitRev3Game, init: () => initXpFrom(orbitCourse(seed), ORBIT_REV3_WORLD_W, decodeOrbitHoles(orbitHoles(seed)), decodeOrbitExtras(ORBIT_XP_BANK.find((e) => e.seed === seed)!.extras)) }),
    seedFor: (n: number) => ORBIT_XP_BANK[n % ORBIT_XP_BANK.length]!.seed,
    checkpoint: orbitCheckpoint,
    mode: "events",
    rate: 25,
    encode: encodeOrbitRun,
    replay: (seed: number, raw: string) => replayOrbitRun(seed, raw, ORBIT_REV_XP, encodeRev3Planets(orbitCourse(seed)), orbitHoles(seed), ORBIT_XP_BANK.find((e) => e.seed === seed)!.extras),
  },
  // x200 (26 Oct 2026): Rainbow Bridge inkRev 10 (clouds, wind, ink stars, silver coins, the shamrock), appended so
  // every earlier entry keeps its index. Eight seeds in turn: a level build takes a few seconds, and the sim caches 16.
  {
    key: "ink/v10",
    game: inkBridgeGameFor(INK_REV_EXPAND),
    seedFor: (n: number) => 9_000_001 + 7_919 * (n % 8),
    checkpoint: inkCheckpoint,
    mode: "events",
    rate: 400,
    encode: encodeInkBridgeRun,
    replay: (seed: number, raw: string) => replayInkBridgeRun(seed, raw, INK_REV_EXPAND),
  },
  // Expansion x200 (docs/expansions/x200-tilt.md): tiltRev 8, its bigger mazes, keys, quick stars and falls back to the start.
  { key: "tilt/expand", game: tiltGameFor(TILT_REV_EXPAND), checkpoint: tiltCheckpoint, mode: "events", rate: 500, encode: encodeTiltRun, replay: (seed: number, raw: string) => replayTiltRun(seed, raw, TILT_REV_EXPAND) },
  // x200 (26 Oct 2026, docs/expansions/x200-cross.md), appended so every earlier entry keeps its index: Jaywalk crossRev 9,
  // the taller world with the island, coins, buses, motorbikes and the streak.
  { key: "cross/expand", game: crossGameFor(CROSS_REV_EXPAND), checkpoint: crossCheckpoint, mode: "events", rate: 60, encode: encodeCrossRun, replay: (seed: number, raw: string) => replayCrossRun(seed, raw, CROSS_REV_EXPAND) },
  // Joe's phone notes (27 Oct 2026, docs/phone-notes-oct-2026/wavefront.md), appended so every earlier entry keeps its index:
  // Wavefront wavRev 11, power-ups from carriers and saucers, no streak, the mothership after wave 5.
  { key: "wavefront/phone", game: wavefrontGameFor(WAV_REV_PHONE), checkpoint: wavCheckpoint, mode: "events", rate: 300, encode: encodeWavefrontRun, replay: (seed: number, raw: string) => replayWavefrontRun(seed, raw, WAV_REV_PHONE) },
  // Pinball pinRev 5 (27 Oct 2026, Joe's phone notes), appended so every earlier entry keeps its index: the table for 90 s.
  { key: "pinball/90", game: pinball5Game, checkpoint: pin4Checkpoint, mode: "events", rate: 120, encode: encodePinballRun, replay: (seed: number, raw: string) => replayPinballRun(seed, raw, PIN_REV_LONG) },
  // Phone notes (27 Oct 2026), appended so every earlier entry keeps its index: Rainbow Bridge inkRev 11 (no wind, two
  // silver coins a level, the pickups spread out). Eight seeds in turn, as ink/v10.
  {
    key: "ink/v11",
    game: inkBridgeGameFor(INK_REV_SPREAD),
    seedFor: (n: number) => 9_000_001 + 7_919 * (n % 8),
    checkpoint: inkCheckpoint,
    mode: "events",
    rate: 400,
    encode: encodeInkBridgeRun,
    replay: (seed: number, raw: string) => replayInkBridgeRun(seed, raw, INK_REV_SPREAD),
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

/**
 * Seconds per entry at 40 runs (local whole run, 15 Oct 2026: 346 s), only to balance
 * --part groups; keyed by the entry's index in GAMES. Unlisted entries count 0.2.
 */
const ENTRY_COST: Record<number, number> = {
  8: 1.6, 10: 1.2, 11: 1.1, 14: 1.0, 15: 0.8, 19: 0.5, 20: 2.6, 21: 0.6, 23: 59.4, 26: 56.9,
  29: 2.8, 30: 2.8, 35: 4.2, 36: 4.2, 37: 1.3, 38: 0.7, 41: 1.2, 42: 3.7, 44: 1.1, 54: 32.1,
  55: 32.8, 56: 0.5, 57: 3.1, 58: 0.5, 59: 1.2, 60: 33.6, 62: 1.2, 63: 1.3, 64: 3.8, 69: 4.1,
  73: 1.1, 74: 1.1, 75: 0.7, 77: 0.9, 79: 3.2, 82: 0.5, 83: 3.5, 88: 0.9, 89: 3.7, 91: 3.4,
  92: 3.6, 94: 33.8, 95: 1.2, 97: 0.6, 98: 0.7, 99: 0.9, 103: 4.9, 104: 1.1, 109: 3.7, 110: 4.0,
  115: 2.1,
  // Taller worlds batch 3 (16 Oct 2026, measured locally at 40 runs).
  126: 2.2, 128: 0.6,
  // x200 Rainbow Bridge (26 Oct 2026, measured locally at 40 runs beside #23; #133 is Orbit's orbit/xp).
  134: 14.0,
  // x200 Jaywalk crossRev 9 (26 Oct 2026, measured locally at 40 runs; #136 after Orbit, Rainbow Bridge and Tilt).
  136: 16.9,
  // Grappler's 200 expansion (26 Oct 2026, swing/expand: about 10 s at 40 runs on a loaded machine).
  129: 8.0,
};

/** Entry indexes of group k of n (1-based): costliest first onto the lightest group, ties by index. */
function partOf(indexes: number[], k: number, n: number): number[] {
  const load = Array.from({ length: n }, () => 0);
  const groups: number[][] = Array.from({ length: n }, () => []);
  const cost = (i: number) => ENTRY_COST[i] ?? 0.2;
  for (const i of [...indexes].sort((a, b) => cost(b) - cost(a) || a - b)) {
    const g = load.indexOf(Math.min(...load));
    load[g] += cost(i);
    groups[g]!.push(i);
  }
  return groups[k - 1]!.sort((a, b) => a - b);
}

let failures = 0;
const ONLY = POSITIONAL[1]?.split(",");
let selected = GAMES.map((_, i) => i).filter((i) => !ONLY || ONLY.includes(GAMES[i]!.key));
let [PART, PARTS] = [1, 1];
if (PART_ARG) {
  [PART, PARTS] = PART_ARG.split("/").map(Number) as [number, number];
  if (!(PARTS >= 1 && PART >= 1 && PART <= PARTS)) {
    console.log(`FAIL: bad --part=${PART_ARG} (expected k/n with 1 <= k <= n)`);
    process.exit(1);
  }
  selected = partOf(selected, PART, PARTS);
  console.log(`part ${PART}/${PARTS}: entries ${selected.join(", ")}`);
}
for (const index of selected) {
  const spec = GAMES[index]!;
  seedStream(index);
  const entryStarted = performance.now();
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
    `#${String(index).padEnd(3)} ${spec.key.padEnd(9)} ${failed ? `FAIL ${failed}/${RUNS} — ${reason}` : `ok ${RUNS}/${RUNS}`} · max events ${maxEvents} · worst replay ${worstMs.toFixed(1)}ms · ${((performance.now() - entryStarted) / 1000).toFixed(1)} s`,
  );
}

// Run the unrelated repair check only when Breaker is selected, in part 1.
if ((!ONLY || ONLY.includes("breaker")) && PART === 1) {
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
console.log(`self-replay checks passed for ${selected.length} selected entries${PARTS > 1 ? ` (part ${PART}/${PARTS})` : ""}`);
