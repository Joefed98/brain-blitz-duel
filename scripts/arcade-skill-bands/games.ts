/**
 * The 22 active arcade games as the skill-band runner sees them: how a live room
 * deals a seed, the game object for a revision, and the server's encode/replay
 * path for that revision. `live` is the revision rooms stamped before the
 * Oct 2026 score-band pass; `next` (when set) is the revision stamped after it.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ArcadeGame } from "../../src/lib/arcade/engine";
import type { PuzzleType } from "../../src/lib/duel/types";
import { btCheckpoint, makeBallTrackGame, BT_REV, BT_REV_BAND, BT_REV_TALL, BT_REV_TARGET, BT_REV_STRICT } from "../../src/lib/arcade/ballTrack";
import { encodeBallTrackRun, replayBallTrackRun } from "../../src/lib/duel/ballTrack";
import { BALL_TRACK_BANK } from "../../src/lib/duel/ballTrackBank.server";
import { BALL_TRACK_BANK_TALL } from "../../src/lib/duel/ballTrackBankTall.server";
import { wavCheckpoint, wavefrontGameFor, WAV_REV, WAV_REV_BAND, WAV_REV_SHAPES, WAV_REV_TALL, WAV_REV_TUNEC } from "../../src/lib/arcade/wavefront";
import { encodeWavefrontRun, replayWavefrontRun } from "../../src/lib/duel/wavefront";
import { flipCheckpoint, flipGameFor, FLIP_REV, FLIP_REV_BAND, FLIP_REV_TUNEC } from "../../src/lib/arcade/flip";
import { encodeFlipRun, replayFlipRun } from "../../src/lib/duel/flip";
import { inkBridgeGameFor, inkCheckpoint, INK_REV4, INK_REV_BAND, INK_REV_TUNEC } from "../../src/lib/arcade/inkBridge";
import { encodeInkBridgeRun, replayInkBridgeRun } from "../../src/lib/duel/inkBridge";
import { matchupCheckpoint, matchupGameFor, MATCHUP_REV, MATCHUP_REV_BAND, MATCHUP_REV_PAR, MATCHUP_REV_WAIT } from "../../src/lib/arcade/matchup";
import { encodeMatchupRun, replayMatchupRun } from "../../src/lib/duel/matchup";
import { bubCheckpoint, bubbleGameFor, BUB_REV, BUB_REV_BAND, BUB_REV_TALL, BUB_REV_TORPEDO } from "../../src/lib/arcade/bubble";
import { encodeBubbleRun, replayBubbleRun } from "../../src/lib/duel/bubble";
import { crossCheckpoint, crossGameFor, CROSS_REV, CROSS_REV_BAND, CROSS_REV_SMALL } from "../../src/lib/arcade/cross";
import { encodeCrossRun, replayCrossRun } from "../../src/lib/duel/cross";
import { rallyCheckpoint, rallyGameFor, RALLY_REV, RALLY_REV_BAND, RALLY_REV_TALL, RALLY_REV_TUNED, RALLY_REV_TUNEF } from "../../src/lib/arcade/rally";
import { encodeRallyRun, replayRallyRun } from "../../src/lib/duel/rally";
import { snakeCheckpoint, snakeGameFor, SNAKE_REV, SNAKE_REV_BAND, SNAKE_REV_TALL, SNAKE_REV_ROCKS } from "../../src/lib/arcade/snake";
import { encodeSnakeRun, replaySnakeRun } from "../../src/lib/duel/snake";
import { binTossCheckpoint, binTossGameFor, BINTOSS_REV3, BINTOSS_REV_BAND } from "../../src/lib/arcade/binToss";
import { encodeBinTossRun, replayBinTossRun } from "../../src/lib/duel/binToss";
import { snipCheckpoint, snipGameFor, SNIP_REV3, SNIP_REV_BAND, SNIP_REV_BANK6, SNIP_REV_EXPAND, SNIP_REV_PROVEN, SNIP_REV_TALL } from "../../src/lib/arcade/snip";
import { encodeSnipRun, replaySnipRun } from "../../src/lib/duel/snip";
import { hoverCheckpoint, hoverGameFor, HOVER_REV, HOVER_REV_BAND, HOVER_REV_TUNEC, HOVER_REV_TALL } from "../../src/lib/arcade/hover";
import { encodeHoverRun, replayHoverRun } from "../../src/lib/duel/hover";
import { skylineCheckpoint, skylineGameFor, SKYLINE_REV, SKYLINE_REV_BAND, SKYLINE_REV_TALL } from "../../src/lib/arcade/skyline";
import { encodeSkylineRun, replaySkylineRun } from "../../src/lib/duel/skyline";
import { juncCheckpoint, junctionGameFor, JUNC_REV, JUNC_REV_BAND } from "../../src/lib/arcade/junction";
import { encodeJunctionRun, replayJunctionRun } from "../../src/lib/duel/junction";
import { brkCheckpoint, breakerGameFor, BRK_REV, BRK_REV_BAND, BRK_REV_TALL, BRK_REV_TUNED, BRK_REV_TUNEF } from "../../src/lib/arcade/breaker";
import { encodeBreakerRun, replayBreakerRun } from "../../src/lib/duel/breaker";
import { tiltCheckpoint, tiltGameFor, TILT_REV, TILT_REV_BAND, TILT_REV_TUNEC } from "../../src/lib/arcade/tilt";
import { encodeTiltRun, replayTiltRun } from "../../src/lib/duel/tilt";
import { orbitCheckpoint, ORBIT_REV4, ORBIT_REV_BAND, ORBIT_REV_SWEPT, ORBIT_REV_TALL, ORBIT_REV_TUNED } from "../../src/lib/arcade/orbit";
import { decodeOrbitHoles, decodeRev3Planets, encodeRev3Planets, initRev4From, orbitRev3Game, orbitRev3StartFor, ORBIT_REV3_WORLD_W } from "../../src/lib/arcade/orbitRev3";
import { encodeOrbitRun, replayOrbitRun } from "../../src/lib/duel/orbit";
import { ORBIT_HOLE_BANK } from "../../src/lib/duel/orbitHoleBank.server";
import { ORBIT_REV3_BANK } from "../../src/lib/duel/orbitRev3Bank.server";
import { beatCheckpoint, beatGameFor, BEAT_REV, BEAT_REV_BAND, BEAT_REV_TALL, BEAT_REV_TUNEC, BEAT_REV_TUNEF } from "../../src/lib/arcade/beat";
import { encodeBeatRun, replayBeatRun } from "../../src/lib/duel/beat";
import { sliceCheckpoint, sliceGameFor, SLICE_REV, SLICE_REV_BAND, SLICE_REV_LONG, SLICE_REV_TALL, SLICE_REV_TUNEC } from "../../src/lib/arcade/slice";
import { encodeSliceRun, replaySliceRun } from "../../src/lib/duel/slice";
import { burstCheckpoint, burstGameFor, BURST_REV, BURST_REV_BAND, BURST_REV_TALL } from "../../src/lib/arcade/burst";
import { encodeBurstRun, replayBurstRun } from "../../src/lib/duel/burst";
import { swingCheckpoint, swingGameFor, SWING_REV, SWING_REV_BAND, SWING_REV_TUNED, SWING_REV_TUNEC, SWING_REV_SPREAD, SWING_REV_TALL } from "../../src/lib/arcade/swing";
import { encodeSwingRun, replaySwingRun } from "../../src/lib/duel/swing";
import { SWING_V4_BANK } from "../../src/lib/duel/swingBankV4.server";
import { SWING_V9_BANK } from "../../src/lib/duel/swingBankV9.server";
import { bullseyeCheckpoint, bullseyeGameFor, bullseyeInitFor, bullseyeWinds, BULLSEYE_REV, BULLSEYE_REV_BAND, BULLSEYE_REV_TUNED } from "../../src/lib/arcade/bullseye";
import { encodeBullseyeRun, replayBullseyeRun } from "../../src/lib/duel/bullseye";
import { pinCheckpoint, pinballGameFor, PIN_REV } from "../../src/lib/arcade/pinball";
import { encodePinballRun, replayPinballRun } from "../../src/lib/duel/pinball";

export interface GameSpec {
  type: PuzzleType;
  /** Revision stamped by live rooms before the score-band pass. */
  live: number | null;
  /** Revision stamped after it (undefined while the pass is being measured). */
  next?: number;
  /** A later revision on the same band curve that changed play (Tuning A), when there is one. */
  tuned?: number;
  /**
   * Revision rooms stamp today, when a later gameplay change (Tuning B, Oct 2026)
   * moved past `next`; `--rev=current` measures it against `next`.
   */
  current?: number;
  /** The Tuning C revision (Oct 2026), measured with `--rev=c` against the one rooms stamped before it. */
  tunec?: number;
  /** The Tuning E revision (Oct 2026, taller worlds), measured with `--rev=e` against the one rooms stamped before it. */
  tunee?: number;
  /** A later bank-only revision (Scrumper snipRev 6, Oct 2026), measured with `--rev=bank` against `tunee`. */
  bank?: number;
  /** The Tuning F revision (Oct 2026), measured with `--rev=f` against liveBefore(spec). */
  tunef?: number;
  /** The taller-worlds batch 1 revision (Oct 2026: Breaker, Rally, Wavefront, Fission), measured with `--rev=g1` against liveBeforeG1(spec). */
  tuneg?: number;
  /** The taller-worlds batch 2 revision (Oct 2026: Tempo, Slice, Coral Pop), measured with `--rev=g2` against liveBeforeG1(spec). */
  tuneg2?: number;
  /** The taller-worlds batch 3 revision (Oct 2026: Grappler, Orbit, Ball Tracker), measured with `--rev=g3` against liveBeforeG1(spec). */
  tuneg3?: number;
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

/** The revision rooms stamped before Tuning F (the latest earlier slot that is set). */
export const liveBefore = (spec: GameSpec): number | null | undefined =>
  spec.bank ?? spec.tunee ?? spec.tunec ?? spec.tuned ?? spec.current ?? spec.next ?? spec.live;

/** The revision rooms stamped before taller worlds batch 1 (Tuning F's when set, else liveBefore). */
export const liveBeforeG1 = (spec: GameSpec): number | null | undefined => spec.tunef ?? liveBefore(spec);

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
/** btRev 4 deals from the 12-row bank (the same seed picks a course there). */
const btCourseFor = (rev: number | null, seed: number) => (rev === BT_REV_TALL || rev === BT_REV_TARGET || rev === BT_REV_STRICT ? BALL_TRACK_BANK_TALL[seed % BALL_TRACK_BANK_TALL.length]!.course : btCourse(seed));
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
    next: BT_REV_BAND,
    tuneg3: BT_REV_TALL,
    // Rooms deal a bank course; the stored seed picks it.
    seedFor: (n) => roomSeed(n) % BALL_TRACK_BANK.length,
    gameFor: (rev, seed) => makeBallTrackGame(btCourseFor(rev, seed), rev),
    checkpoint: btCheckpoint,
    encode: (run, rev, seed) => encodeBallTrackRun(btCourseFor(rev, seed), run, rev),
    replay: (seed, raw, rev) => replayBallTrackRun(btCourseFor(rev, seed), seed, raw, rev),
  },
  { ...simple("wavefront", WAV_REV, WAV_REV_BAND, wavefrontGameFor, wavCheckpoint, encodeWavefrontRun, replayWavefrontRun), tuned: WAV_REV_SHAPES, tunec: WAV_REV_TUNEC, tuneg: WAV_REV_TALL },
  { ...simple("flip", FLIP_REV, FLIP_REV_BAND, flipGameFor, flipCheckpoint, encodeFlipRun, replayFlipRun), tunec: FLIP_REV_TUNEC },
  { ...simple("inkbridge", INK_REV4, INK_REV_BAND, inkBridgeGameFor, inkCheckpoint, encodeInkBridgeRun, replayInkBridgeRun), tunec: INK_REV_TUNEC },
  { ...simple("matchup", MATCHUP_REV, MATCHUP_REV_BAND, matchupGameFor, matchupCheckpoint, encodeMatchupRun, replayMatchupRun), tunec: MATCHUP_REV_WAIT, tunef: MATCHUP_REV_PAR },
  { ...simple("bubble", BUB_REV, BUB_REV_BAND, bubbleGameFor, bubCheckpoint, encodeBubbleRun, replayBubbleRun), tunef: BUB_REV_TORPEDO, tuneg2: BUB_REV_TALL },
  { ...simple("cross", CROSS_REV, CROSS_REV_BAND, crossGameFor, crossCheckpoint, encodeCrossRun, replayCrossRun), tunef: CROSS_REV_SMALL },
  { ...simple("rally", RALLY_REV, RALLY_REV_BAND, rallyGameFor, rallyCheckpoint, encodeRallyRun, replayRallyRun), current: RALLY_REV_TUNED, tunef: RALLY_REV_TUNEF, tuneg: RALLY_REV_TALL },
  { ...simple("snake", SNAKE_REV, SNAKE_REV_BAND, snakeGameFor, snakeCheckpoint, encodeSnakeRun, replaySnakeRun), tunee: SNAKE_REV_TALL, tunef: SNAKE_REV_ROCKS },
  simple("bintoss", BINTOSS_REV3, BINTOSS_REV_BAND, binTossGameFor, binTossCheckpoint, encodeBinTossRun, replayBinTossRun),
  { ...simple("snip", SNIP_REV3, SNIP_REV_BAND, snipGameFor, snipCheckpoint, encodeSnipRun, replaySnipRun), tunee: SNIP_REV_TALL, bank: SNIP_REV_BANK6, tunef: SNIP_REV_PROVEN, expand: SNIP_REV_EXPAND },
  { ...simple("hover", HOVER_REV, HOVER_REV_BAND, hoverGameFor, hoverCheckpoint, encodeHoverRun, replayHoverRun, true), tunec: HOVER_REV_TUNEC, tunee: HOVER_REV_TALL },
  { ...simple("skyline", SKYLINE_REV, SKYLINE_REV_BAND, skylineGameFor, skylineCheckpoint, encodeSkylineRun, replaySkylineRun, true), tunee: SKYLINE_REV_TALL },
  simple("junction", JUNC_REV, JUNC_REV_BAND, junctionGameFor, juncCheckpoint, encodeJunctionRun, replayJunctionRun),
  { ...simple("breaker", BRK_REV, BRK_REV_BAND, breakerGameFor, brkCheckpoint, encodeBreakerRun, replayBreakerRun), current: BRK_REV_TUNED, tunef: BRK_REV_TUNEF, tuneg: BRK_REV_TALL },
  { ...simple("tilt", TILT_REV, TILT_REV_BAND, tiltGameFor, tiltCheckpoint, encodeTiltRun, replayTiltRun), tunec: TILT_REV_TUNEC },
  {
    type: "orbit",
    live: ORBIT_REV4,
    next: ORBIT_REV_BAND,
    tuned: ORBIT_REV_TUNED,
    tunef: ORBIT_REV_SWEPT,
    tuneg3: ORBIT_REV_TALL,
    // Rooms deal bank courses with proved black holes (rev 4); the planets and holes ride in the puzzle.
    seedFor: (n) => ORBIT_HOLE_BANK[roomSeed(n) % ORBIT_HOLE_BANK.length]!.seed,
    gameFor: (rev, seed) => {
      const start = orbitRev3StartFor(rev) ?? initRev4From;
      return { ...orbitRev3Game, init: () => start(orbitPlanets(seed), ORBIT_REV3_WORLD_W, decodeOrbitHoles(orbitEntry(seed).holes)) };
    },
    checkpoint: orbitCheckpoint,
    encode: (run) => encodeOrbitRun(run),
    replay: (seed, raw, rev) => replayOrbitRun(seed, raw, rev ?? undefined, encodeRev3Planets(orbitPlanets(seed)), orbitEntry(seed).holes),
  },
  { ...simple("beat", BEAT_REV, BEAT_REV_BAND, beatGameFor, beatCheckpoint, encodeBeatRun, replayBeatRun), tunec: BEAT_REV_TUNEC, tunef: BEAT_REV_TUNEF, tuneg2: BEAT_REV_TALL },
  { ...simple("slice", SLICE_REV, SLICE_REV_BAND, sliceGameFor, sliceCheckpoint, encodeSliceRun, replaySliceRun), tunec: SLICE_REV_TUNEC, tunef: SLICE_REV_LONG, tuneg2: SLICE_REV_TALL },
  { ...simple("burst", BURST_REV, BURST_REV_BAND, burstGameFor, burstCheckpoint, encodeBurstRun, replayBurstRun), tuneg: BURST_REV_TALL },
  {
    type: "swing",
    live: SWING_REV,
    next: SWING_REV_BAND,
    tuned: SWING_REV_TUNED,
    tunec: SWING_REV_TUNEC,
    tunef: SWING_REV_SPREAD,
    tuneg3: SWING_REV_TALL,
    // Rooms pick a proved course from the bank by the room seed (swingRev 9: from the 298 re-proved on the taller cavern,
    // which keep SWING_V4_BANK's order, so a seed that is in both is the same course on both revisions).
    seedFor: (n) => SWING_V4_BANK[roomSeed(n) % SWING_V4_BANK.length]!.seed,
    gameFor: (rev) => swingGameFor(rev ?? undefined),
    checkpoint: swingCheckpoint,
    encode: (run) => encodeSwingRun(run),
    replay: (seed, raw, rev) => replaySwingRun(seed, raw, rev ?? undefined),
  },
  {
    type: "bullseye",
    live: BULLSEYE_REV,
    next: BULLSEYE_REV_BAND,
    current: BULLSEYE_REV_TUNED,
    seedFor: plain,
    gameFor: (rev, seed) => ({ ...bullseyeGameFor(rev), init: () => bullseyeInitFor(seed, bullseyeWinds(seed), rev) }),
    checkpoint: bullseyeCheckpoint,
    encode: (run) => encodeBullseyeRun(run),
    replay: (seed, raw, rev) => replayBullseyeRun(seed, raw, bullseyeWinds(seed), rev),
  },
  // Pinball (practice only until PINBALL_IN_ROOMS): born on the bands, so its one revision is both `live` and `next`.
  simple("pinball", PIN_REV, PIN_REV, pinballGameFor, pinCheckpoint, encodePinballRun, replayPinballRun),
];

export const GAME_BY_TYPE = new Map(GAMES.map((g) => [g.type, g]));
