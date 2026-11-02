/**
 * The 22 active arcade games as the skill-band runner sees them: how a live room
 * deals a seed, the game object for a revision, and the server's encode/replay
 * path for that revision. `live` is the revision rooms stamped before the
 * Oct 2026 score-band pass; `next` (when set) is the revision stamped after it.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ArcadeGame } from "../../src/lib/arcade/engine";
import type { PuzzleType } from "../../src/lib/duel/types";
import { btCheckpoint, btIsV7Play, makeBallTrackGame, BT_REV, BT_REV_BAND, BT_REV_TALL, BT_REV_TARGET, BT_REV_STRICT, BT_REV_STD } from "../../src/lib/arcade/ballTrack";
import { encodeBallTrackRun, replayBallTrackRun } from "../../src/lib/duel/ballTrack";
import { BALL_TRACK_BANK } from "../../src/lib/duel/ballTrackBank.server";
import { BALL_TRACK_BANK_TALL } from "../../src/lib/duel/ballTrackBankTall.server";
import { BALL_TRACK_BANK_V7 } from "../../src/lib/duel/ballTrackBankV7.server";
import { btV8DealIndex } from "../../src/lib/duel/ballTrackDealV8.server";
import { wavCheckpoint, wavefrontGameFor, WAV_REV, WAV_REV_BAND, WAV_REV_SHAPES, WAV_REV_TALL, WAV_REV_TUNEC } from "../../src/lib/arcade/wavefront";
import { encodeWavefrontRun, replayWavefrontRun } from "../../src/lib/duel/wavefront";
import { flipCheckpoint, flipGameFor, FLIP_REV, FLIP_REV_BAND, FLIP_REV_TUNEC } from "../../src/lib/arcade/flip";
import { encodeFlipRun, replayFlipRun } from "../../src/lib/duel/flip";
import { ninjaCheckpoint, ninjaGame, NINJA_REV } from "../../src/lib/arcade/ricochetNinja";
import { encodeNinjaRun, replayNinjaRun } from "../../src/lib/duel/ricochet";
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
import { snipCheckpoint, snipGameFor, SNIP_REV3, SNIP_REV_BAND, SNIP_REV_BANK6, SNIP_REV_PROVEN, SNIP_REV_TALL } from "../../src/lib/arcade/snip";
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
import { tiltBankSeedFor } from "../../src/lib/duel/tiltBank.server";
import { orbitCheckpoint, ORBIT_REV4, ORBIT_REV_BAND, ORBIT_REV_SWEPT, ORBIT_REV_TALL, ORBIT_REV_TUNED, ORBIT_REV_STD, ORBIT_REV_FUEL, orbitXpRev } from "../../src/lib/arcade/orbit";
import { decodeOrbitExtras, decodeOrbitHoles, decodeRev3Planets, encodeRev3Planets, initRev4From, orbitRev3Game, orbitRev3StartFor, ORBIT_REV3_WORLD_W } from "../../src/lib/arcade/orbitRev3";
import { ORBIT_XP_BANK } from "../../src/lib/duel/orbitXpBank.server";
import { ORBIT_FUEL_BANK } from "../../src/lib/duel/orbitFuelBank.server";
import { encodeOrbitRun, replayOrbitRun } from "../../src/lib/duel/orbit";
import { ORBIT_HOLE_BANK } from "../../src/lib/duel/orbitHoleBank.server";
import { ORBIT_REV3_BANK } from "../../src/lib/duel/orbitRev3Bank.server";
import { beatCheckpoint, beatGameFor, BEAT_REV, BEAT_REV_BAND, BEAT_REV_TALL, BEAT_REV_TUNEC, BEAT_REV_TUNEF } from "../../src/lib/arcade/beat";
import { encodeBeatRun, replayBeatRun } from "../../src/lib/duel/beat";
import { sliceCheckpoint, sliceGameFor, SLICE_REV, SLICE_REV_BAND, SLICE_REV_LONG, SLICE_REV_TALL, SLICE_REV_TUNEC } from "../../src/lib/arcade/slice";
import { encodeSliceRun, replaySliceRun } from "../../src/lib/duel/slice";
import { burstCheckpoint, burstGameFor, BURST_REV, BURST_REV_BAND, BURST_REV_TALL } from "../../src/lib/arcade/burst";
import { encodeBurstRun, replayBurstRun } from "../../src/lib/duel/burst";
import { swingCheckpoint, swingGameFor, SWING_REV, SWING_REV_BAND, SWING_REV_TUNED, SWING_REV_TUNEC, SWING_REV_SPREAD, SWING_REV_TALL, SWING_REV_STRICT, SWING_REV_EXPAND, SWING_REV_ASSAULT, SWING_REV_REWORK, SWING_REV_DARK } from "../../src/lib/arcade/swing";
import { encodeSwingRun, replaySwingRun } from "../../src/lib/duel/swing";
import { SWING_V4_BANK } from "../../src/lib/duel/swingBankV4.server";
import { SWING_V9_BANK } from "../../src/lib/duel/swingBankV9.server";
import { SWING_V13_BANK } from "../../src/lib/duel/swingBankV13.server";
import { bullseyeCheckpoint, bullseyeGameFor, bullseyeInitFor, bullseyeWinds, BULLSEYE_REV, BULLSEYE_REV_BAND, BULLSEYE_REV_TUNED } from "../../src/lib/arcade/bullseye";
import { encodeBullseyeRun, replayBullseyeRun } from "../../src/lib/duel/bullseye";
import { PIN_REV } from "../../src/lib/arcade/pinball";
import { pinballGameForAny, pinCheckpointAny } from "../../src/lib/arcade/pinball4";
import { encodePinballRun, replayPinballRun } from "../../src/lib/duel/pinball";
import { minesCheckpoint, minesweeperGameFor, MINES_REV_STD } from "../../src/lib/arcade/minesweeper";
import { encodeMinesweeperRun, replayMinesweeperRun } from "../../src/lib/duel/minesweeper";
import { mahjongCheckpoint, mahjongGameFor, MAHJONG_REV_STD } from "../../src/lib/arcade/mahjong";
import { encodeMahjongRun, replayMahjongRun } from "../../src/lib/duel/mahjong";
import { homerunCheckpoint, homerunGameFor, HOMERUN_REV_DEALT } from "../../src/lib/arcade/homerun";
import { encodeHomerunRun, replayHomerunRun } from "../../src/lib/duel/homerun";
import { homerunDealSeedV3 } from "../../src/lib/duel/homerunDealV3.server";
import { freekickCheckpoint, freekickGameFor, FREEKICK_REV_DEALT } from "../../src/lib/arcade/freekick";
import { encodeFreekickRun, replayFreekickRun } from "../../src/lib/duel/freekick";
import { freekickDealSeedV2 } from "../../src/lib/duel/freekickDealV2.server";
import { racingCheckpoint, racingGameFor, RACING_REV_DEALT } from "../../src/lib/arcade/racing";
import { encodeRacingRun, replayRacingRun } from "../../src/lib/duel/racing";
import { racingDealSeedV2 } from "../../src/lib/duel/racingDealV2.server";
import { fcCheckpoint, freecellGameFor, FC_REV } from "../../src/lib/arcade/cards/freecell";
import { FC_DEALS } from "../../src/lib/arcade/cards/freecellDeals.data";
import { tpCheckpoint, tripeaksGameFor, TP_REV } from "../../src/lib/arcade/cards/tripeaks";
import { TP_DEALS } from "../../src/lib/arcade/cards/tripeaksDeals.data";
import { psCheckpoint, pokerSquaresGameFor, PS_REV } from "../../src/lib/arcade/cards/pokerSquares";
import { fhCheckpoint, fiveHandsGameFor, FH_REV } from "../../src/lib/arcade/cards/fiveHands";
import { pyCheckpoint, pyramidGameFor, PY_REV } from "../../src/lib/arcade/cards/pyramid";
import { gsCheckpoint, golfSolGameFor, GS_REV } from "../../src/lib/arcade/cards/golfSol";
import { GS_DEALS } from "../../src/lib/arcade/cards/golfSolDeals.data";
import { mgCheckpoint, mugginsGameFor, MG_REV } from "../../src/lib/arcade/cards/muggins";
import { bfCheckpoint, blockfallGameFor, BLOCKFALL_REV } from "../../src/lib/arcade/blockfall";
import { encodeBlockfallRun, replayBlockfallRun } from "../../src/lib/duel/blockfall";
import { blockfallDealSeed } from "../../src/lib/duel/blockfallDeal.server";
import { alleyRollGameFor, arCheckpoint, ALLEYROLL_REV } from "../../src/lib/arcade/alleyroll";
import { encodeAlleyRollRun, replayAlleyRollRun } from "../../src/lib/duel/alleyroll";
import { bastionTankCheckpoint, bastionTankGame, BASTION_REV_TANK } from "../../src/lib/arcade/bastionTank";
import { encodeBastionTankRun, replayBastionTankRun } from "../../src/lib/duel/bastion";
import { encodeFiveHandsRun, encodeFreecellRun, encodePokerSquaresRun, encodeTripeaksRun, replayFiveHandsRun, replayFreecellRun, replayPokerSquaresRun, replayTripeaksRun } from "../../src/lib/duel/cards";
import { encodeGolfSolRun, encodeMugginsRun, encodePyramidRun, replayGolfSolRun, replayMugginsRun, replayPyramidRun } from "../../src/lib/duel/cards";
import { minigolfCheckpoint, minigolfGameFor, MINIGOLF_REV, MINIGOLF_REV_CLASSIC } from "../../src/lib/arcade/minigolf";
import { encodeMinigolfRun, replayMinigolfRun } from "../../src/lib/duel/minigolf";
import { MINIGOLF_BANK, minigolfBankEntryFor } from "../../src/lib/duel/minigolfBank.server";
import { MINIGOLF_BANK_V2, minigolfBankV2EntryFor } from "../../src/lib/duel/minigolfBankV2.server";
import { poolCheckpoint, poolGameFor, POOL_REV } from "../../src/lib/arcade/pool";
import { encodePoolRun, replayPoolRun } from "../../src/lib/duel/pool";
import { poolBankV2SeedFor } from "../../src/lib/duel/poolBankV2.server";
import { poolBankV3SeedFor } from "../../src/lib/duel/poolBankV3.server";
import { curlingCheckpoint, curlingGameFor, CURLING_REV } from "../../src/lib/arcade/curling";
import { encodeCurlingRun, replayCurlingRun } from "../../src/lib/duel/curling";
import { curlingBankSeedFor } from "../../src/lib/duel/curlingBank.server";
import { curlingBankV2SeedFor } from "../../src/lib/duel/curlingBankV2.server";
import { curlingBankV3SeedFor } from "../../src/lib/duel/curlingBankV3.server";

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
  /**
   * The seed the skill-band tool plays for a revision, when a game's expansion deals from its own bank (Grappler
   * swingRev 13): returned for the expansion and for the revision `--rev=x` compares it with, so both play the same
   * courses (paired). Checks keep reading `seedFor`.
   */
  seedForRev?: (n: number, rev: number | null) => number | undefined;
  /** `--rev=x` only: the seeds a world expansion deals from its own bank (both revisions measured on them, paired). */
  seedForX?: (n: number) => number;
  /** The seed index → seed the older checks' fixtures were recorded with, when `seedFor` has since moved on (Tilt's bank). */
  fixtureSeedFor?: (n: number) => number;
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
/** Minigolf's stored pars for a bank seed (the puzzle carries them). */
const minigolfParsOf = (seed: number) => (MINIGOLF_BANK_V2.find((e) => e.seed === seed) ?? MINIGOLF_BANK.find((e) => e.seed === seed))?.pars;
/** The stamp a Minigolf seed plays on: the one asked for, else the bank it comes from (no seed is in both). */
const minigolfRevOf = (rev: number | null, seed: number) => rev ?? (MINIGOLF_BANK_V2.some((e) => e.seed === seed) ? MINIGOLF_REV : MINIGOLF_REV_CLASSIC);
const btCourse = (seed: number) => BALL_TRACK_BANK[seed % BALL_TRACK_BANK.length]!.course;
/** btRev 4 deals from the 12-row bank (the same seed picks a course there); btRev 8 from its deal list (courses that reach 200). */
const btCourseFor = (rev: number | null, seed: number) => (rev === BT_REV_STD ? BALL_TRACK_BANK_V7[btV8DealIndex(seed)]!.course : btIsV7Play(rev) ? BALL_TRACK_BANK_V7[seed % BALL_TRACK_BANK_V7.length]!.course : rev === BT_REV_TALL || rev === BT_REV_TARGET || rev === BT_REV_STRICT ? BALL_TRACK_BANK_TALL[seed % BALL_TRACK_BANK_TALL.length]!.course : btCourse(seed));
const orbitEntry = (seed: number) => ORBIT_HOLE_BANK.find((e) => e.seed === seed)!;
const orbitPlanets = (seed: number) => decodeRev3Planets(ORBIT_REV3_BANK.find((e) => e.seed === seed)!.planets);
/** orbitRev 12 (the expansion to 200): the course's features, from the feature bank rooms deal. */
const orbitXpExtras = (seed: number) => ORBIT_XP_BANK.find((e) => e.seed === seed)?.extras;
/** orbitRev 14 (the fuel meter): the fuel bank's course for its bank seed (planets, holes and features ride in the entry). */
const orbitFuelEntry = (seed: number) => ORBIT_FUEL_BANK.find((e) => e.seed === seed)!;

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
  { ...simple("snip", SNIP_REV3, SNIP_REV_BAND, snipGameFor, snipCheckpoint, encodeSnipRun, replaySnipRun), tunee: SNIP_REV_TALL, bank: SNIP_REV_BANK6, tunef: SNIP_REV_PROVEN },
  { ...simple("hover", HOVER_REV, HOVER_REV_BAND, hoverGameFor, hoverCheckpoint, encodeHoverRun, replayHoverRun, true), tunec: HOVER_REV_TUNEC, tunee: HOVER_REV_TALL },
  { ...simple("skyline", SKYLINE_REV, SKYLINE_REV_BAND, skylineGameFor, skylineCheckpoint, encodeSkylineRun, replaySkylineRun, true), tunee: SKYLINE_REV_TALL },
  simple("junction", JUNC_REV, JUNC_REV_BAND, junctionGameFor, juncCheckpoint, encodeJunctionRun, replayJunctionRun),
  { ...simple("breaker", BRK_REV, BRK_REV_BAND, breakerGameFor, brkCheckpoint, encodeBreakerRun, replayBreakerRun), current: BRK_REV_TUNED, tunef: BRK_REV_TUNEF, tuneg: BRK_REV_TALL },
  // Rooms deal tiltRev 8's bank (seeds the oracle played to 200), so every revision is measured on those (paired). The
  // tuning seeds 0–59 are the bank's first 60; the fresh seeds 10000– start at its 61st, so the two sets never share one.
  { ...simple("tilt", TILT_REV, TILT_REV_BAND, tiltGameFor, tiltCheckpoint, encodeTiltRun, replayTiltRun), tunec: TILT_REV_TUNEC, seedFor: tiltBankSeedFor, fixtureSeedFor: plain },
  {
    type: "orbit",
    live: ORBIT_REV4,
    next: ORBIT_REV_BAND,
    tuned: ORBIT_REV_TUNED,
    tunef: ORBIT_REV_SWEPT,
    tuneg3: ORBIT_REV_TALL,
    // Rooms deal bank courses with proved black holes (rev 4); the planets and holes ride in the puzzle.
    seedFor: (n) => ORBIT_HOLE_BANK[roomSeed(n) % ORBIT_HOLE_BANK.length]!.seed,
    // orbitRev 12 (the expansion to 200) rooms deal a feature-bank course (room seed mod its length); --rev=x plays
    // both revisions on it.
    seedForX: (n) => ORBIT_XP_BANK[roomSeed(n) % ORBIT_XP_BANK.length]!.seed,
    // orbitRev 13 (the arcade scoring standard): measured on the feature-bank course rooms deal for the n-th room seed,
    // whatever the mode (--rev=now included); every earlier revision keeps its seeds.
    // orbitRev 14 (the fuel meter): the fuel-bank course rooms deal for the n-th room seed.
    seedForRev: (n, rev) => (rev === ORBIT_REV_FUEL ? ORBIT_FUEL_BANK[roomSeed(n) % ORBIT_FUEL_BANK.length]!.seed : rev === ORBIT_REV_STD ? ORBIT_XP_BANK[roomSeed(n) % ORBIT_XP_BANK.length]!.seed : undefined),
    gameFor: (rev, seed) => {
      if (rev === ORBIT_REV_FUEL) {
        const e = orbitFuelEntry(seed);
        const start = orbitRev3StartFor(rev, decodeOrbitExtras(e.extras))!;
        return { ...orbitRev3Game, init: () => start(decodeRev3Planets(e.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(e.holes)) };
      }
      const start = orbitRev3StartFor(rev, orbitXpRev(rev) ? decodeOrbitExtras(orbitXpExtras(seed)) : null) ?? initRev4From;
      return { ...orbitRev3Game, init: () => start(orbitPlanets(seed), ORBIT_REV3_WORLD_W, decodeOrbitHoles(orbitEntry(seed).holes)) };
    },
    checkpoint: orbitCheckpoint,
    encode: (run) => encodeOrbitRun(run),
    replay: (seed, raw, rev) =>
      rev === ORBIT_REV_FUEL
        ? replayOrbitRun(seed, raw, rev, orbitFuelEntry(seed).planets, orbitFuelEntry(seed).holes, orbitFuelEntry(seed).extras)
        : replayOrbitRun(seed, raw, rev ?? undefined, encodeRev3Planets(orbitPlanets(seed)), orbitEntry(seed).holes, orbitXpRev(rev) ? orbitXpExtras(seed) : undefined),
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
    // swingRev 13 (the 200 expansion) rooms deal from SWING_V13_BANK; --rev=x plays swingRev 11 on the same courses
    // (all of them in SWING_V9_BANK, which swingRev 11 rooms dealt), so the two revisions are paired.
    // swingRev 14 (the assault course), 15 (the swinging course) and 16 (its dark ledge runs) rooms deal any seed (generateSwing): the room seed itself.
    seedForRev: (n, rev) => (rev === SWING_REV_ASSAULT || rev === SWING_REV_REWORK || rev === SWING_REV_DARK ? roomSeed(n) : rev === SWING_REV_EXPAND || rev === SWING_REV_STRICT ? SWING_V13_BANK[roomSeed(n) % SWING_V13_BANK.length]!.seed : undefined),
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
  // pinRev 4 (E4, 25 Oct 2026): the taller table's game and checkpoint (pinball4.ts) through the same replay path.
  simple("pinball", PIN_REV, PIN_REV, pinballGameForAny, pinCheckpointAny, encodePinballRun, replayPinballRun),
  // Cards & Board (30 Oct 2026): born on the arcade scoring standard (one revision each, measured with --rev=now).
  simple("minesweeper", MINES_REV_STD, MINES_REV_STD, minesweeperGameFor, minesCheckpoint, encodeMinesweeperRun, replayMinesweeperRun),
  simple("mahjong", MAHJONG_REV_STD, MAHJONG_REV_STD, mahjongGameFor, mahjongCheckpoint, encodeMahjongRun, replayMahjongRun),
  // The Sports group (30 Oct 2026): born on the arcade scoring standard (rev 1 is live and next); rooms deal a seed from
  // each game's proved deal (the oracle took it to 200 through the server replay), picked by the room seed.
  // homerunRev 3 (1 Nov 2026): the swing choice and the pitcher's tell, on rev 3's own proved deal.
  { ...simple("homerun", HOMERUN_REV_DEALT, HOMERUN_REV_DEALT, homerunGameFor, homerunCheckpoint, encodeHomerunRun, replayHomerunRun), seedFor: (n) => homerunDealSeedV3(roomSeed(n)) },
  { ...simple("freekick", FREEKICK_REV_DEALT, FREEKICK_REV_DEALT, freekickGameFor, freekickCheckpoint, encodeFreekickRun, replayFreekickRun), seedFor: (n) => freekickDealSeedV2(roomSeed(n)) },
  // Apex (racing) deals racingRev 2 from its own proved deal since 31 Oct 2026.
  { ...simple("racing", RACING_REV_DEALT, RACING_REV_DEALT, racingGameFor, racingCheckpoint, encodeRacingRun, replayRacingRun), seedFor: (n) => racingDealSeedV2(roomSeed(n)) },
  // Cards & Board (30 Oct 2026): born on the arcade standard, one revision each. FreeCell and TriPeaks deal a bank
  // index (the room seed modulo the bank); Poker Squares any seed.
  { ...simple("freecell", FC_REV, FC_REV, freecellGameFor, fcCheckpoint, encodeFreecellRun, replayFreecellRun), seedFor: (n) => roomSeed(n) % FC_DEALS.length },
  { ...simple("tripeaks", TP_REV, TP_REV, tripeaksGameFor, tpCheckpoint, encodeTripeaksRun, replayTripeaksRun), seedFor: (n) => roomSeed(n) % TP_DEALS.length },
  simple("pokersquares", PS_REV, PS_REV, pokerSquaresGameFor, psCheckpoint, encodePokerSquaresRun, replayPokerSquaresRun),
  // Five Hands (31 Oct 2026): born on the arcade standard; any seed (the sim deals the deck and proves its witness).
  simple("fivehands", FH_REV, FH_REV, fiveHandsGameFor, fhCheckpoint, encodeFiveHandsRun, replayFiveHandsRun),
  // Pyramid and Muggins (1 Nov 2026): any seed (the sim builds and proves the deal); Golf Solitaire a bank index.
  simple("pyramid", PY_REV, PY_REV, pyramidGameFor, pyCheckpoint, encodePyramidRun, replayPyramidRun),
  { ...simple("golfsol", GS_REV, GS_REV, golfSolGameFor, gsCheckpoint, encodeGolfSolRun, replayGolfSolRun), seedFor: (n) => roomSeed(n) % GS_DEALS.length },
  simple("muggins", MG_REV, MG_REV, mugginsGameFor, mgCheckpoint, encodeMugginsRun, replayMugginsRun),
  // Blockfall (Retro, 1 Nov 2026): born on the arcade standard; rooms deal a seed from its proved deal.
  { ...simple("blockfall", BLOCKFALL_REV, BLOCKFALL_REV, blockfallGameFor, bfCheckpoint, encodeBlockfallRun, replayBlockfallRun), seedFor: (n) => blockfallDealSeed(roomSeed(n)) },
  // Alley Roll (Sports, 1 Nov 2026): born on the arcade standard; one lane for every seed (rooms deal any seed).
  simple("alleyroll", ALLEYROLL_REV, ALLEYROLL_REV, alleyRollGameFor, arCheckpoint, encodeAlleyRollRun, replayAlleyRollRun),
  // Ricochet (1 Nov 2026): the ninja wall-climb, born on the arcade standard at ricoRev 2; any seed (the sim deals the tower and proves its witness).
  simple("ricochet", NINJA_REV, NINJA_REV, () => ninjaGame, ninjaCheckpoint, encodeNinjaRun, (seed, raw) => replayNinjaRun(seed, raw)),
  // Bastion bastionRev 2 (1 Nov 2026): the tank-defence shooter, born on the arcade scoring standard; any seed.
  simple("bastion", BASTION_REV_TANK, BASTION_REV_TANK, () => bastionTankGame, bastionTankCheckpoint, encodeBastionTankRun, (seed, raw) => replayBastionTankRun(seed, raw)),
  // The Sports group (30 Oct 2026): Minigolf deals a bank course (seed and pars); golfRev 2 (crazy golf, 31 Oct 2026)
  // from its own bank, golfRev 1 (`seedForRev`) from the first.
  {
    type: "minigolf",
    live: MINIGOLF_REV,
    seedFor: (n) => minigolfBankV2EntryFor(n).seed,
    seedForRev: (n, rev) => (rev === MINIGOLF_REV_CLASSIC ? minigolfBankEntryFor(n).seed : minigolfBankV2EntryFor(n).seed),
    gameFor: (rev, seed) => minigolfGameFor(minigolfParsOf(seed), minigolfRevOf(rev, seed)),
    checkpoint: minigolfCheckpoint,
    encode: (run) => encodeMinigolfRun(run),
    replay: (seed, raw, rev) => replayMinigolfRun(seed, raw, minigolfParsOf(seed), minigolfRevOf(rev ?? null, seed)),
  },
  // Cue Ball deals a bank layout (proved clearable without a miss), poolRev 3 from its own bank (1 Nov 2026).
  {
    type: "pool",
    live: POOL_REV,
    seedFor: poolBankV3SeedFor,
    // poolRev 2 measures on its own bank's layouts.
    seedForRev: (n, rev) => (rev === 2 ? poolBankV2SeedFor(n) : undefined),
    gameFor: (rev) => poolGameFor(rev),
    checkpoint: poolCheckpoint,
    encode: (run) => encodePoolRun(run),
    replay: (seed, raw, rev) => replayPoolRun(seed, raw, rev),
  },
  // Curling deals a bank sheet (opponent stones the oracle took out with every stone on the button), curlRev 2 since 31
  // Oct 2026, curlRev 3 since 1 Nov 2026.
  {
    type: "curling",
    live: CURLING_REV,
    seedFor: curlingBankV3SeedFor,
    // curlRev 1 and 2 measure on their own banks' sheets.
    seedForRev: (n, rev) => (rev === 1 ? curlingBankSeedFor(n) : rev === 2 ? curlingBankV2SeedFor(n) : undefined),
    gameFor: (rev) => curlingGameFor(rev ?? 1),
    checkpoint: curlingCheckpoint,
    encode: (run) => encodeCurlingRun(run),
    replay: (seed, raw, rev) => replayCurlingRun(seed, raw, rev),
  },
];

export const GAME_BY_TYPE = new Map(GAMES.map((g) => [g.type, g]));
