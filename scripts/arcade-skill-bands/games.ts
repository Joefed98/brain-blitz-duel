/**
 * The 22 active arcade games as the skill-band runner sees them: how a live room
 * deals a seed, the game object for a revision, and the server's encode/replay
 * path for that revision. `live` is the revision rooms stamped before the
 * Oct 2026 score-band pass; `next` (when set) is the revision stamped after it.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ArcadeGame } from "../../src/lib/arcade/engine";
import type { PuzzleType } from "../../src/lib/duel/types";
import { btCheckpoint, makeBallTrackGame, BT_REV } from "../../src/lib/arcade/ballTrack";
import { encodeBallTrackRun, replayBallTrackRun } from "../../src/lib/duel/ballTrack";
import { BALL_TRACK_BANK } from "../../src/lib/duel/ballTrackBank.server";
import { wavCheckpoint, wavefrontGameFor, WAV_REV } from "../../src/lib/arcade/wavefront";
import { encodeWavefrontRun, replayWavefrontRun } from "../../src/lib/duel/wavefront";
import { flipCheckpoint, flipGameFor, FLIP_REV } from "../../src/lib/arcade/flip";
import { encodeFlipRun, replayFlipRun } from "../../src/lib/duel/flip";
import { inkBridgeGameFor, inkCheckpoint, INK_REV4 } from "../../src/lib/arcade/inkBridge";
import { encodeInkBridgeRun, replayInkBridgeRun } from "../../src/lib/duel/inkBridge";
import { matchupCheckpoint, matchupGameFor, MATCHUP_REV } from "../../src/lib/arcade/matchup";
import { encodeMatchupRun, replayMatchupRun } from "../../src/lib/duel/matchup";
import { bubCheckpoint, bubbleGameFor, BUB_REV } from "../../src/lib/arcade/bubble";
import { encodeBubbleRun, replayBubbleRun } from "../../src/lib/duel/bubble";
import { crossCheckpoint, crossGameFor, CROSS_REV } from "../../src/lib/arcade/cross";
import { encodeCrossRun, replayCrossRun } from "../../src/lib/duel/cross";
import { rallyCheckpoint, rallyGameFor, RALLY_REV } from "../../src/lib/arcade/rally";
import { encodeRallyRun, replayRallyRun } from "../../src/lib/duel/rally";
import { snakeCheckpoint, snakeGameFor, SNAKE_REV } from "../../src/lib/arcade/snake";
import { encodeSnakeRun, replaySnakeRun } from "../../src/lib/duel/snake";
import { binTossCheckpoint, binTossGameFor, BINTOSS_REV3 } from "../../src/lib/arcade/binToss";
import { encodeBinTossRun, replayBinTossRun } from "../../src/lib/duel/binToss";
import { snipCheckpoint, snipGameFor, SNIP_REV3 } from "../../src/lib/arcade/snip";
import { encodeSnipRun, replaySnipRun } from "../../src/lib/duel/snip";
import { hoverCheckpoint, hoverGameFor, HOVER_REV } from "../../src/lib/arcade/hover";
import { encodeHoverRun, replayHoverRun } from "../../src/lib/duel/hover";
import { skylineCheckpoint, skylineGameFor, SKYLINE_REV } from "../../src/lib/arcade/skyline";
import { encodeSkylineRun, replaySkylineRun } from "../../src/lib/duel/skyline";
import { juncCheckpoint, junctionGameFor, JUNC_REV } from "../../src/lib/arcade/junction";
import { encodeJunctionRun, replayJunctionRun } from "../../src/lib/duel/junction";
import { brkCheckpoint, breakerGameFor, BRK_REV } from "../../src/lib/arcade/breaker";
import { encodeBreakerRun, replayBreakerRun } from "../../src/lib/duel/breaker";
import { tiltCheckpoint, tiltGameFor, TILT_REV } from "../../src/lib/arcade/tilt";
import { encodeTiltRun, replayTiltRun } from "../../src/lib/duel/tilt";
import { orbitCheckpoint, ORBIT_REV4 } from "../../src/lib/arcade/orbit";
import { decodeOrbitHoles, decodeRev3Planets, encodeRev3Planets, initRev4From, orbitRev3Game, ORBIT_REV3_WORLD_W } from "../../src/lib/arcade/orbitRev3";
import { encodeOrbitRun, replayOrbitRun } from "../../src/lib/duel/orbit";
import { ORBIT_HOLE_BANK } from "../../src/lib/duel/orbitHoleBank.server";
import { ORBIT_REV3_BANK } from "../../src/lib/duel/orbitRev3Bank.server";
import { beatCheckpoint, beatGameFor, BEAT_REV } from "../../src/lib/arcade/beat";
import { encodeBeatRun, replayBeatRun } from "../../src/lib/duel/beat";
import { sliceCheckpoint, sliceGameFor, SLICE_REV } from "../../src/lib/arcade/slice";
import { encodeSliceRun, replaySliceRun } from "../../src/lib/duel/slice";
import { burstCheckpoint, burstGameFor, BURST_REV } from "../../src/lib/arcade/burst";
import { encodeBurstRun, replayBurstRun } from "../../src/lib/duel/burst";
import { swingCheckpoint, swingGameFor, SWING_REV } from "../../src/lib/arcade/swing";
import { encodeSwingRun, replaySwingRun } from "../../src/lib/duel/swing";
import { SWING_V4_BANK } from "../../src/lib/duel/swingBankV4.server";
import { bullseyeCheckpoint, bullseyeGameFor, bullseyeInitRev2, bullseyeWinds, BULLSEYE_REV } from "../../src/lib/arcade/bullseye";
import { encodeBullseyeRun, replayBullseyeRun } from "../../src/lib/duel/bullseye";

export interface GameSpec {
  type: PuzzleType;
  /** Revision stamped by live rooms before the score-band pass. */
  live: number | null;
  /** Revision stamped after it (undefined while the pass is being measured). */
  next?: number;
  /** The seed a live room would store for the n-th sample. */
  seedFor: (n: number) => number;
  /** The game (sim + score) for a revision and stored seed. */
  gameFor: (rev: number | null, seed: number) => ArcadeGame<any, any>;
  checkpoint: (state: any) => unknown;
  encode: (run: any, rev: number | null, seed: number) => string;
  replay: (seed: number, raw: string, rev: number | null) => any;
  /** Whether the run is a tap list (input: boolean) rather than events. */
  taps?: boolean;
}

/** A spread of 32-bit room seeds (fixed, so the table reproduces). */
export function roomSeed(n: number): number {
  let x = (n + 1) * 0x9e3779b1;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return ((x >>> 0) % 0x7ffffffe) + 1;
}

const plain = (n: number) => roomSeed(n);
const btCourse = (seed: number) => BALL_TRACK_BANK[seed % BALL_TRACK_BANK.length]!.course;
const orbitEntry = (seed: number) => ORBIT_HOLE_BANK.find((e) => e.seed === seed)!;
const orbitPlanets = (seed: number) => decodeRev3Planets(ORBIT_REV3_BANK.find((e) => e.seed === seed)!.planets);

const simple = (
  type: PuzzleType,
  live: number,
  next: number | undefined,
  gameFor: (rev: number | null) => ArcadeGame<any, any>,
  checkpoint: (s: any) => unknown,
  encode: (run: any) => string,
  replay: (seed: number, raw: string, rev: number | null) => any,
  taps = false,
): GameSpec => ({ type, live, next, seedFor: plain, gameFor: (rev) => gameFor(rev), checkpoint, encode: (run) => encode(run), replay, taps });

export const GAMES: GameSpec[] = [
  {
    type: "balltrack",
    live: BT_REV,
    // Rooms deal a bank course; the stored seed picks it.
    seedFor: (n) => roomSeed(n) % BALL_TRACK_BANK.length,
    gameFor: (rev, seed) => makeBallTrackGame(btCourse(seed), rev),
    checkpoint: btCheckpoint,
    encode: (run, rev, seed) => encodeBallTrackRun(btCourse(seed), run, rev),
    replay: (seed, raw, rev) => replayBallTrackRun(btCourse(seed), seed, raw, rev),
  },
  simple("wavefront", WAV_REV, undefined, wavefrontGameFor, wavCheckpoint, encodeWavefrontRun, replayWavefrontRun),
  simple("flip", FLIP_REV, undefined, flipGameFor, flipCheckpoint, encodeFlipRun, replayFlipRun),
  simple("inkbridge", INK_REV4, undefined, inkBridgeGameFor, inkCheckpoint, encodeInkBridgeRun, replayInkBridgeRun),
  simple("matchup", MATCHUP_REV, undefined, matchupGameFor, matchupCheckpoint, encodeMatchupRun, replayMatchupRun),
  simple("bubble", BUB_REV, undefined, bubbleGameFor, bubCheckpoint, encodeBubbleRun, replayBubbleRun),
  simple("cross", CROSS_REV, undefined, crossGameFor, crossCheckpoint, encodeCrossRun, replayCrossRun),
  simple("rally", RALLY_REV, undefined, rallyGameFor, rallyCheckpoint, encodeRallyRun, replayRallyRun),
  simple("snake", SNAKE_REV, undefined, snakeGameFor, snakeCheckpoint, encodeSnakeRun, replaySnakeRun),
  simple("bintoss", BINTOSS_REV3, undefined, binTossGameFor, binTossCheckpoint, encodeBinTossRun, replayBinTossRun),
  simple("snip", SNIP_REV3, undefined, snipGameFor, snipCheckpoint, encodeSnipRun, replaySnipRun),
  simple("hover", HOVER_REV, undefined, hoverGameFor, hoverCheckpoint, encodeHoverRun, replayHoverRun, true),
  simple("skyline", SKYLINE_REV, undefined, skylineGameFor, skylineCheckpoint, encodeSkylineRun, replaySkylineRun, true),
  simple("junction", JUNC_REV, undefined, junctionGameFor, juncCheckpoint, encodeJunctionRun, replayJunctionRun),
  simple("breaker", BRK_REV, undefined, breakerGameFor, brkCheckpoint, encodeBreakerRun, replayBreakerRun),
  simple("tilt", TILT_REV, undefined, tiltGameFor, tiltCheckpoint, encodeTiltRun, replayTiltRun),
  {
    type: "orbit",
    live: ORBIT_REV4,
    // Rooms deal bank courses with proved black holes (rev 4); the planets and holes ride in the puzzle.
    seedFor: (n) => ORBIT_HOLE_BANK[roomSeed(n) % ORBIT_HOLE_BANK.length]!.seed,
    gameFor: (rev, seed) => {
      void rev;
      return { ...orbitRev3Game, init: () => initRev4From(orbitPlanets(seed), ORBIT_REV3_WORLD_W, decodeOrbitHoles(orbitEntry(seed).holes)) };
    },
    checkpoint: orbitCheckpoint,
    encode: (run) => encodeOrbitRun(run),
    replay: (seed, raw, rev) => replayOrbitRun(seed, raw, rev ?? undefined, encodeRev3Planets(orbitPlanets(seed)), orbitEntry(seed).holes),
  },
  simple("beat", BEAT_REV, undefined, beatGameFor, beatCheckpoint, encodeBeatRun, replayBeatRun),
  simple("slice", SLICE_REV, undefined, sliceGameFor, sliceCheckpoint, encodeSliceRun, replaySliceRun),
  simple("burst", BURST_REV, undefined, burstGameFor, burstCheckpoint, encodeBurstRun, replayBurstRun),
  {
    type: "swing",
    live: SWING_REV,
    // Rooms pick a proved course from the bank by the room seed.
    seedFor: (n) => SWING_V4_BANK[roomSeed(n) % SWING_V4_BANK.length]!.seed,
    gameFor: (rev) => swingGameFor(rev ?? undefined),
    checkpoint: swingCheckpoint,
    encode: (run) => encodeSwingRun(run),
    replay: (seed, raw, rev) => replaySwingRun(seed, raw, rev ?? undefined),
  },
  {
    type: "bullseye",
    live: BULLSEYE_REV,
    seedFor: plain,
    gameFor: (rev, seed) => ({ ...bullseyeGameFor(rev), init: () => bullseyeInitRev2(seed, bullseyeWinds(seed)) }),
    checkpoint: bullseyeCheckpoint,
    encode: (run) => encodeBullseyeRun(run),
    replay: (seed, raw, rev) => replayBullseyeRun(seed, raw, bullseyeWinds(seed), rev),
  },
];

export const GAME_BY_TYPE = new Map(GAMES.map((g) => [g.type, g]));
