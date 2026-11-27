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

import { bastionIronGame, bastionTankCheckpoint, bastionTankGame, bastionTankGameFor, BT2_CHECKPOINT_INTERVAL } from "../src/lib/arcade/bastionTank";
import { BT_EASY_DEAL } from "../src/lib/duel/ballTrackDealEasy.server";
import { BT_HARD_DEAL } from "../src/lib/duel/ballTrackDealHard.server";
import { BT_EXPERT_DEAL } from "../src/lib/duel/ballTrackDealExpert.server";
import { MINIGOLF_HOLES_BANK } from "../src/lib/duel/minigolfHolesBank.server";
import { MG_LEVEL_NAMES } from "../src/lib/arcade/minigolf";
import { homerunDealSeedV5 } from "../src/lib/duel/homerunDealV5.server";
import { freekickDealSeedV5 } from "../src/lib/duel/freekickDealV5.server";
import { freekickDealSeedV6 } from "../src/lib/duel/freekickDealV6.server";
import { encodeBastionTankRun, replayBastionTankRun } from "../src/lib/duel/bastion";
import { homerunCheckpoint, homerunGameFor, HOMERUN_CHECKPOINT_INTERVAL, HOMERUN_REV_2, HOMERUN_REV_3, HOMERUN_REV_4, HOMERUN_REV_STD } from "../src/lib/arcade/homerun";
import { encodeHomerunRun, replayHomerunRun } from "../src/lib/duel/homerun";
import { HOMERUN_DEAL } from "../src/lib/duel/homerunDeal.server";
import { HOMERUN_DEAL_V2 } from "../src/lib/duel/homerunDealV2.server";
import { HOMERUN_DEAL_V3 } from "../src/lib/duel/homerunDealV3.server";
import { HOMERUN_DEAL_V4 } from "../src/lib/duel/homerunDealV4.server";
import { freekickCheckpoint, freekickGameFor, FREEKICK_CHECKPOINT_INTERVAL, FREEKICK_REV_2, FREEKICK_REV_3, FREEKICK_REV_STD } from "../src/lib/arcade/freekick";
import { encodeFreekickRun, replayFreekickRun } from "../src/lib/duel/freekick";
import { FREEKICK_DEAL } from "../src/lib/duel/freekickDeal.server";
import { FREEKICK_DEAL_V2 } from "../src/lib/duel/freekickDealV2.server";
import { FREEKICK_DEAL_V3 } from "../src/lib/duel/freekickDealV3.server";
import { racingCheckpoint, racingGameFor, RACING_CHECKPOINT_INTERVAL, RACING_REV_2, RACING_REV_3, RACING_REV_4, RACING_REV_STD } from "../src/lib/arcade/racing";
import { FREEKICK_DEAL_V4 } from "../src/lib/duel/freekickDealV4.server";
import { encodeRacingRun, replayRacingRun } from "../src/lib/duel/racing";
import { RACING_DEAL } from "../src/lib/duel/racingDeal.server";
import { RACING_DEAL_V2 } from "../src/lib/duel/racingDealV2.server";
import { RACING_DEAL_V3 } from "../src/lib/duel/racingDealV3.server";
import { RACING_DEAL_V4 } from "../src/lib/duel/racingDealV4.server";
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
import { encodeMoonRun, encodeNinjaRun, encodeRicoRun, replayMoonRun, replayNinjaRun, replayRicoRun } from "@/lib/duel/ricochet";
import { moonCheckpoint, moonGame, moonGameFor, ninjaCheckpoint, ninjaGame, NINJA_CHECKPOINT_INTERVAL } from "@/lib/arcade/ricochetNinja";
import { encodeSkylineRun, replaySkylineRun } from "@/lib/duel/skyline";
import { encodeSliceRun, replaySliceRun } from "@/lib/duel/slice";
import { FLIP_DEAL } from "@/lib/duel/flipDeal.server";
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
import { tiltCheckpoint, tiltGame, tiltGameFor, tiltLevelGame, TILT_REV } from "@/lib/arcade/tilt";
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
import { BALL_TRACK_BANK_V7 } from "@/lib/duel/ballTrackBankV7.server";
import { BT_REV_STD } from "@/lib/arcade/ballTrack";
import { ORBIT_REV3, ORBIT_REV4 } from "@/lib/arcade/orbit";
import { decodeOrbitHoles, decodeRev3Planets, encodeRev3Planets, initRev3From, initRev4From, orbitRev3Game, ORBIT_REV3_WORLD_W } from "@/lib/arcade/orbitRev3";
import { ORBIT_HOLE_BANK } from "@/lib/duel/orbitHoleBank.server";
import { ORBIT_REV3_BANK } from "@/lib/duel/orbitRev3Bank.server";
import { orbitRev3PlanetsForSeed } from "@/lib/duel/orbitRev3Course.server";
import { binTossGameFor, BINTOSS_REV2, BINTOSS_REV3 } from "@/lib/arcade/binToss";
import { inkBridgeGameFor, INK_REV3, INK_REV4, INK_REV_EXPAND, INK_REV_SPREAD, INK_REV_STD, INK_REV_CLOVER, INK_REV_BIG } from "@/lib/arcade/inkBridge";
import { INK_BIG_DEAL } from "@/lib/duel/inkBigDeal.server";
import { swingGameFor, SWING_REV, SWING_REV_V3 } from "@/lib/arcade/swing";
import { wordfallCheckpoint, wordfallGame, wordfallGameFor } from "@/lib/arcade/wordfall";
import { encodeWordfallRun, replayWordfallRun } from "@/lib/duel/wordfall";
// Letterfall's replay checks words: install the same list the server grades with.
import "@/lib/duel/wordfallDict.server";

import { BT_REV_BAND, BT_REV_TALL } from "@/lib/arcade/ballTrack";
import { WAV_REV_BAND, WAV_REV_PHONE, WAV_REV_SHAPES, WAV_REV_TALL, WAV_REV_TUNEC } from "@/lib/arcade/wavefront";
import { FLIP_REV_BAND, FLIP_REV_EXPAND, FLIP_REV_FLOW, FLIP_REV_LIFT, FLIP_REV_STD, FLIP_REV_TUNEC } from "@/lib/arcade/flip";
import { WAV_REV_BAND, WAV_REV_PHONE, WAV_REV_SHAPES, WAV_REV_STD, WAV_REV_TALL, WAV_REV_TUNEC } from "@/lib/arcade/wavefront";
import { FLIP_REV_BAND, FLIP_REV_EXPAND, FLIP_REV_LIFT, FLIP_REV_TUNEC } from "@/lib/arcade/flip";
import { INK_REV_BAND, INK_REV_TUNEC } from "@/lib/arcade/inkBridge";
import { MATCHUP_REV_BAND, MATCHUP_REV_ICE2, MATCHUP_REV_PAR, MATCHUP_REV_SIX, MATCHUP_REV_STD, MATCHUP_REV_WAIT } from "@/lib/arcade/matchup";
import { BUB_REV_BAND, BUB_REV_TALL, BUB_REV_TORPEDO } from "@/lib/arcade/bubble";
import { CROSS_REV_BAND, CROSS_REV_EXPAND, CROSS_REV_FLOW, CROSS_REV_SMALL, CROSS_REV_STD } from "@/lib/arcade/cross";
import { RALLY_REV_BAND, RALLY_REV_TALL, RALLY_REV_TUNED, RALLY_REV_TUNEF } from "@/lib/arcade/rally";
import { SNAKE_REV_BAND, SNAKE_REV_ROCKS, SNAKE_REV_TALL, SNAKE_REV_10, SNAKE_REV_STD, SNAKE_REV_12, SNAKE_REV_WRAP } from "@/lib/arcade/snake";
import { BINTOSS_REV_BAND } from "@/lib/arcade/binToss";
import { SNIP_REV_BAND, SNIP_REV_BANK6, SNIP_REV_EXPAND, SNIP_REV_PROVEN, SNIP_REV_TALL } from "@/lib/arcade/snip";
import { SKYLINE_REV_BAND, SKYLINE_REV_TALL } from "@/lib/arcade/skyline";
import { HOVER_REV_BAND, HOVER_REV_EXPAND, HOVER_REV_STANDARD, HOVER_REV_TALL, HOVER_REV_TUNEC } from "@/lib/arcade/hover";
import { JUNC_REV_BAND } from "@/lib/arcade/junction";
import { BRK_REV_BAND, BRK_REV_CLEAR, BRK_REV_STD, BRK_REV_TALL, BRK_REV_TUNED, BRK_REV_TUNEF } from "@/lib/arcade/breaker";
import { pinballGameFor, pinCheckpoint, PIN_REV } from "@/lib/arcade/pinball";
import { pin4Checkpoint, pinball5Game, pinball6Game, pinball7Game, pinball8Game, PIN_REV_LONG } from "@/lib/arcade/pinball4";
// The arcade scoring standard, batch B (29 Oct 2026): each game's standard stamp.
import { SKYLINE_REV_STD } from "@/lib/arcade/skyline";
import { BINTOSS_REV_STD } from "@/lib/arcade/binToss";
import { BULLSEYE_REV_STD } from "@/lib/arcade/bullseye";
import { PIN_REV_JOULZ, PIN_REV_STD } from "@/lib/arcade/pinball";
import { RALLY_REV_LIVES, RALLY_REV_STD } from "@/lib/arcade/rally";
import { BUB_REV_FAST, BUB_REV_STD } from "@/lib/arcade/bubble";
import { BEAT_REV_FLOOR, BEAT_REV_STD } from "@/lib/arcade/beat";
import { encodePinballRun, replayPinballRun } from "@/lib/duel/pinball";
import { minesCheckpoint, minesweeperGameFor, MINES_REV_EXPERT_D4, MINES_REV_HARD_D4, MINES_REV_LOGIC, MINES_REV_STD } from "@/lib/arcade/minesweeper"; // Changed with Joe's approval, 22 Nov 2026
import { encodeMinesweeperRun, replayMinesweeperRun } from "@/lib/duel/minesweeper";
import { mahjongCheckpoint, mahjongGameFor, MAHJONG_REV_STD, MAHJONG_REV_UNDO } from "@/lib/arcade/mahjong";
import { encodeMahjongRun, replayMahjongRun } from "@/lib/duel/mahjong";
import { fcCheckpoint, freecellGame, freecellGameFor } from "@/lib/arcade/cards/freecell";
import { tpCheckpoint, tripeaksGame, tripeaksGameFor } from "@/lib/arcade/cards/tripeaks";
import { psCheckpoint, pokerSquaresGame, pokerSquaresGameFor } from "@/lib/arcade/cards/pokerSquares";
import { fhCheckpoint, fiveHandsGame, fiveHandsGameFor } from "@/lib/arcade/cards/fiveHands";
import { pyCheckpoint, pyramidGame, pyramidGameFor } from "@/lib/arcade/cards/pyramid";
import { gsCheckpoint, golfSolGame } from "@/lib/arcade/cards/golfSol";
import { mgCheckpoint, mugginsGame } from "@/lib/arcade/cards/muggins";
import { encodeGolfSolRun, encodeMugginsRun, encodePyramidRun, replayGolfSolRun, replayMugginsRun, replayPyramidRun } from "@/lib/duel/cards";
import { bfCheckpoint, blockfallGame, blockzoneGame } from "@/lib/arcade/blockfall";
import { arCheckpoint, alleyRollGame, ringerGame } from "@/lib/arcade/alleyroll";
import { encodeBlockfallRun, replayBlockfallRun } from "@/lib/duel/blockfall";
import { encodeAlleyRollRun, replayAlleyRollRun } from "@/lib/duel/alleyroll";
import { BLOCKFALL_DEAL } from "@/lib/duel/blockfallDeal.server";
import { BLOCKFALL_DEAL_V2 } from "@/lib/duel/blockfallDealV2.server";
import { encodeFiveHandsRun, encodeFreecellRun, encodePokerSquaresRun, encodeTripeaksRun, replayFiveHandsRun, replayFreecellRun, replayPokerSquaresRun, replayTripeaksRun } from "@/lib/duel/cards";
import { minigolfCheckpoint, minigolfGameFor } from "@/lib/arcade/minigolf";
import { encodeMinigolfRun, replayMinigolfRun } from "@/lib/duel/minigolf";
import { MINIGOLF_BANK } from "@/lib/duel/minigolfBank.server";
import { poolCheckpoint, poolGameFor, POOL_REV_V1 } from "@/lib/arcade/pool";
import { encodePoolRun, replayPoolRun } from "@/lib/duel/pool";
import { POOL_BANK } from "@/lib/duel/poolBank.server";
import { POOL_BANK_V2 } from "@/lib/duel/poolBankV2.server";
import { POOL_BANK_V3 } from "@/lib/duel/poolBankV3.server";
import { curlingCheckpoint, curlingGameFor, CURLING_REV } from "@/lib/arcade/curling";
import { encodeCurlingRun, replayCurlingRun } from "@/lib/duel/curling";
import { CURLING_BANK } from "@/lib/duel/curlingBank.server";
import { CURLING_BANK_V2 } from "@/lib/duel/curlingBankV2.server";
import { CURLING_BANK_V3 } from "@/lib/duel/curlingBankV3.server";
import { CURLING_BANK_V4 } from "@/lib/duel/curlingBankV4.server";
import { MINIGOLF_BANK_V2 } from "@/lib/duel/minigolfBankV2.server";
import { TILT_REV_BAND, TILT_REV_BIG, TILT_REV_EXPAND, TILT_REV_LIFT, TILT_REV_PAR, TILT_REV_STD, TILT_REV_TUNEC } from "@/lib/arcade/tilt";
// Changed with Joe's approval, 23 Nov 2026 (routine consequence of D5's orbitRev 17): ORBIT_REV_LOST and initLostFrom for the orbit/lost entries.
import { ORBIT_REV_BAND, ORBIT_REV_SWEPT, ORBIT_REV_TALL, ORBIT_REV_TUNED, ORBIT_REV_XP, ORBIT_REV_STD, ORBIT_REV_FUEL, ORBIT_REV_GRACE, ORBIT_REV_BIG, ORBIT_REV_LOST } from "@/lib/arcade/orbit";
import { decodeOrbitExtras, initBandFrom, initSweptFrom, initTallFrom, initTunedFrom, initXpFrom, initStdFrom, initFuelFrom, initGraceFrom, initBigFrom, initLevelFrom, initLostFrom } from "@/lib/arcade/orbitRev3"; // Changed with Joe's approval, 23 Nov 2026 (D5's orbitRev 17: initLostFrom)
import { ORBIT_XP_BANK } from "@/lib/duel/orbitXpBank.server";
import { ORBIT_FUEL_BANK } from "@/lib/duel/orbitFuelBank.server";
import { ORBIT_FUEL_BANK_EASY } from "@/lib/duel/orbitFuelBankEasy.server";
import { ORBIT_FUEL_BANK_HARD } from "@/lib/duel/orbitFuelBankHard.server";
import { ORBIT_FUEL_BANK_EXPERT } from "@/lib/duel/orbitFuelBankExpert.server";
import { BEAT_REV_BAND, BEAT_REV_TALL, BEAT_REV_TUNEC, BEAT_REV_TUNEF } from "@/lib/arcade/beat";
import { SLICE_REV_BAND, SLICE_REV_LONG, SLICE_REV_TALL, SLICE_REV_TUNEC } from "@/lib/arcade/slice";
import { BURST_REV_BAND, BURST_REV_TALL } from "@/lib/arcade/burst";
import { SWING_REV_BAND, SWING_REV_TUNED, SWING_REV_TUNEC, SWING_REV_SPREAD, SWING_REV_TALL, SWING_REV_EXPAND, SWING_REV_ASSAULT, SWING_REV_REWORK, SWING_REV_DARK, SWING_REV_SLIDE, SWING_REV_BIG, SWING_REV_LADDER } from "@/lib/arcade/swing"; // Changed with Joe's approval, 26 Nov 2026 (SWING_REV_LADDER, D5's swingRev 19)
import { SWING_BIG_DEAL } from "@/lib/duel/swingBigDeal.server";
import { SWING_LADDER_DEAL } from "@/lib/duel/swingLadderDeal.server"; // Changed with Joe's approval, 26 Nov 2026 (D5's swingRev 19 deal)
// Changed with Joe's approval, 26 Nov 2026, second set (D5's six stamps: the entries appended at the end of the list).
import { BEAT_REV_LANES } from "@/lib/arcade/beat"; // Changed with Joe's approval, 26 Nov 2026
import { BEAT_DEAL_V13 } from "@/lib/duel/beatDealV13.server"; // Changed with Joe's approval, 26 Nov 2026
import { blockfallGameFor, BLOCKFALL_REV_LEVELS } from "@/lib/arcade/blockfall"; // Changed with Joe's approval, 26 Nov 2026
import { BLOCKFALL_LEVEL_DEALS } from "@/lib/duel/blockfallLevelDeals.server"; // Changed with Joe's approval, 26 Nov 2026
import { hoverLevelDealSeed } from "@/lib/duel/hoverLevelDeals.server"; // Changed with Joe's approval, 26 Nov 2026
import { crossLevelDealSeed } from "@/lib/duel/crossLevelDeals.server"; // Changed with Joe's approval, 26 Nov 2026
// Changed with Joe's approval, 27 Nov 2026 (D5's orbitRev 17 ladder banks, brkRev 13, pinRev 9, skylineRev 12's and flipRev 14's level deals: the entries appended at the end of the list).
import { ORBIT_LADDER_BANKS } from "@/lib/duel/orbitRev3Course.server"; // Changed with Joe's approval, 27 Nov 2026
import { BRK_REV_LADDER } from "@/lib/arcade/breaker"; // Changed with Joe's approval, 27 Nov 2026
import { breakerLevelDealSeed } from "@/lib/duel/breakerLevelDeals.server"; // Changed with Joe's approval, 27 Nov 2026
import { PIN_REV_LADDER } from "@/lib/arcade/pinball"; // Changed with Joe's approval, 27 Nov 2026
import { pinball9For } from "@/lib/arcade/pinball4"; // Changed with Joe's approval, 27 Nov 2026
import { pinballLevelDealSeed } from "@/lib/duel/pinballLevelDeals.server"; // Changed with Joe's approval, 27 Nov 2026
import { SKYLINE_V12_DEAL } from "@/lib/duel/skylineDealV12.server"; // Changed with Joe's approval, 27 Nov 2026
import { FLIP_LADDER_DEALS } from "@/lib/duel/flipLadderDeals.server"; // Changed with Joe's approval, 27 Nov 2026
import { SWING_LEVEL_DEAL } from "@/lib/duel/swingLevelDeal.server";
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
  /** The game's checkpoint interval in ticks, when it is not INTERVAL (the run's server replay checks at its own). */
  interval?: number;
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
  // Pinball (dealt in rooms since 14 Oct 2026): held-flipper changes, often both at once.
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
  // Joe's phone notes (27 Oct 2026), appended so every earlier entry keeps its index: Meteor snakeRev 10 (2 × 2 rocks, a third wormhole pair, a second lane, longer gold stars).
  { key: "snake/v10", game: snakeGameFor(SNAKE_REV_10), checkpoint: snakeCheckpoint, mode: "events", rate: 40, encode: encodeSnakeRun, replay: (seed: number, raw: string) => replaySnakeRun(seed, raw, SNAKE_REV_10) },
  // Grappler's assault course (swingRev 14, 27 Oct 2026), appended so every earlier entry keeps its index: any seed.
  { key: "swing/assault", game: swingGameFor(SWING_REV_ASSAULT), checkpoint: swingCheckpoint, mode: "events", rate: 30, encode: encodeSwingRun, replay: (seed: number, raw: string) => replaySwingRun(seed, raw, SWING_REV_ASSAULT) },
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
  // Joe's phone notes (27 Oct 2026, docs/arcade-phone-notes-oct-2026.md), appended so every earlier entry keeps its index:
  // Roofbound flipRev 9 and Tilt tiltRev 9, flipRev 8's and tiltRev 8's play on lifted curves.
  { key: "flip/lift", game: flipGameFor(FLIP_REV_LIFT), checkpoint: flipCheckpoint, mode: "events", rate: 50, encode: encodeFlipRun, replay: (seed: number, raw: string) => replayFlipRun(seed, raw, FLIP_REV_LIFT) },
  { key: "tilt/lift", game: tiltGameFor(TILT_REV_LIFT), checkpoint: tiltCheckpoint, mode: "events", rate: 500, encode: encodeTiltRun, replay: (seed: number, raw: string) => replayTiltRun(seed, raw, TILT_REV_LIFT) },
  // The arcade scoring standard (29 Oct 2026, docs/arcade-standard/breaker.md), appended so every earlier entry
  // keeps its index: Breaker brkRev 11, brkRev 10's play scored in fixed parts.
  { key: "breaker/std", game: breakerGameFor(BRK_REV_STD), checkpoint: brkCheckpoint, mode: "events", rate: 950, encode: encodeBreakerRun, replay: (seed: number, raw: string) => replayBreakerRun(seed, raw, BRK_REV_STD) },
  // The arcade scoring standard (29 Oct 2026, docs/arcade-standard/hover.md), appended so every earlier entry
  // keeps its index: Hover hoverRev 10, hoverRev 9's play in fixed parts to 200.
  { key: "hover/std", game: hoverGameFor(HOVER_REV_STANDARD), checkpoint: hoverCheckpoint, mode: "taps", rate: 60, encode: encodeHoverRun, replay: (seed: number, raw: string) => replayHoverRun(seed, raw, HOVER_REV_STANDARD) },
  // The arcade scoring standard (Oct 2026, docs/arcade-standard/matchup.md), appended so every earlier entry keeps
  // its index: Gemstone matchupRev 11 (four treasures that swap with a gem making a line, four goal levels, parts to 200).
  { key: "matchup/std", game: matchupGameFor(MATCHUP_REV_STD), checkpoint: matchupCheckpoint, mode: "events", rate: 40, encode: encodeMatchupRun, replay: (seed: number, raw: string) => replayMatchupRun(seed, raw, MATCHUP_REV_STD) },
  // The arcade scoring standard (29 Oct 2026, docs/arcade-standard/snake.md), appended so every earlier entry keeps
  // its index: Meteor snakeRev 11, snakeRev 10's play scored in straight-line parts to 200.
  { key: "snake/std", game: snakeGameFor(SNAKE_REV_STD), checkpoint: snakeCheckpoint, mode: "events", rate: 40, encode: encodeSnakeRun, replay: (seed: number, raw: string) => replaySnakeRun(seed, raw, SNAKE_REV_STD) },
  // The arcade scoring standard (29 Oct 2026, docs/arcade-standard/tilt.md), appended: Tilt tiltRev 10, four mazes.
  { key: "tilt/std", game: tiltGameFor(TILT_REV_STD), checkpoint: tiltCheckpoint, mode: "events", rate: 500, encode: encodeTiltRun, replay: (seed: number, raw: string) => replayTiltRun(seed, raw, TILT_REV_STD) },
  // The arcade scoring standard, batch B (29 Oct 2026, docs/arcade-standard/README.md), appended so every earlier entry keeps its
  // index: High Rise skylineRev 9, Swish binRev 9, Flightpath bullRev 9, Pinball pinRev 6, Rally rallyRev 12 (the spin
  // reversed), Coral Pop bubbleRev 11 (the four-bubble mine) and Tempo beatRev 11.
  { key: "skyline/std", game: skylineGameFor(SKYLINE_REV_STD), checkpoint: skylineCheckpoint, mode: "taps", rate: 15, encode: encodeSkylineRun, replay: (seed: number, raw: string) => replaySkylineRun(seed, raw, SKYLINE_REV_STD) },
  { key: "bintoss/std", game: binTossGameFor(BINTOSS_REV_STD), checkpoint: binTossCheckpoint, mode: "events", rate: 15, encode: encodeBinTossRun, replay: (seed: number, raw: string) => replayBinTossRun(seed, raw, BINTOSS_REV_STD) },
  {
    key: "bullseye/std",
    game: bullseyeGameFor(BULLSEYE_REV_STD),
    checkpoint: bullseyeCheckpoint,
    init: (seed: number) => bullseyeInitFor(seed, bullseyeWinds(seed), BULLSEYE_REV_STD),
    mode: "events",
    rate: 25,
    encode: encodeBullseyeRun,
    replay: (seed: number, raw: string) => replayBullseyeRun(seed, raw, bullseyeWinds(seed), BULLSEYE_REV_STD),
  },
  { key: "pinball/std", game: pinball6Game, checkpoint: pin4Checkpoint, mode: "events", rate: 120, encode: encodePinballRun, replay: (seed: number, raw: string) => replayPinballRun(seed, raw, PIN_REV_STD) },
  { key: "rally/std", game: rallyGameFor(RALLY_REV_STD), checkpoint: rallyCheckpoint, mode: "events", rate: 120, encode: encodeRallyRun, replay: (seed: number, raw: string) => replayRallyRun(seed, raw, RALLY_REV_STD) },
  { key: "bubble/std", game: bubbleGameFor(BUB_REV_STD), checkpoint: bubCheckpoint, mode: "events", rate: 15, encode: encodeBubbleRun, replay: (seed: number, raw: string) => replayBubbleRun(seed, raw, BUB_REV_STD) },
  { key: "beat/std", game: beatGameFor(BEAT_REV_STD), checkpoint: beatCheckpoint, mode: "events", rate: 200, encode: encodeBeatRun, replay: (seed: number, raw: string) => replayBeatRun(seed, raw, BEAT_REV_STD) },
  // The arcade scoring standard (29 Oct 2026, docs/arcade-standard/balltrack.md), appended so every earlier entry keeps its
  // index: Ball Tracker btRev 8, btRev 7's play on its 13-row bank courses, scored on the standard.
  {
    key: "balltrack/std",
    game: makeBallTrackGame(BALL_TRACK_BANK_V7[0]!.course, BT_REV_STD),
    gameFor: (seed: number) => makeBallTrackGame(BALL_TRACK_BANK_V7[seed % BALL_TRACK_BANK_V7.length]!.course, BT_REV_STD),
    checkpoint: btCheckpoint,
    mode: "events",
    rate: 30,
    encode: (run: any) => encodeBallTrackRun(BALL_TRACK_BANK_V7[run.seed % BALL_TRACK_BANK_V7.length]!.course, run, BT_REV_STD),
    replay: (seed: number, raw: string) => replayBallTrackRun(BALL_TRACK_BANK_V7[seed % BALL_TRACK_BANK_V7.length]!.course, seed, raw, BT_REV_STD),
  },
  // The arcade scoring standard (29 Oct 2026, docs/arcade-standard/inkbridge.md), appended so every earlier entry keeps
  // its index: Rainbow Bridge inkRev 12, inkRev 11's play on the standard. Eight seeds in turn, as ink/v11.
  {
    key: "ink/std",
    game: inkBridgeGameFor(INK_REV_STD),
    seedFor: (n: number) => 9_000_001 + 7_919 * (n % 8),
    checkpoint: inkCheckpoint,
    mode: "events",
    rate: 400,
    encode: encodeInkBridgeRun,
    replay: (seed: number, raw: string) => replayInkBridgeRun(seed, raw, INK_REV_STD),
  },
  // The arcade scoring standard (29 Oct 2026), appended so every earlier entry keeps its index: Orbit orbitRev 13,
  // orbitRev 12's play on its feature-bank courses scored on the standard.
  {
    key: "orbit/std",
    game: orbitRev3Game,
    gameFor: (seed: number) => ({ ...orbitRev3Game, init: () => initStdFrom(orbitCourse(seed), ORBIT_REV3_WORLD_W, decodeOrbitHoles(orbitHoles(seed)), decodeOrbitExtras(ORBIT_XP_BANK.find((e) => e.seed === seed)!.extras)) }),
    seedFor: (n: number) => ORBIT_XP_BANK[n % ORBIT_XP_BANK.length]!.seed,
    checkpoint: orbitCheckpoint,
    mode: "events",
    rate: 25,
    encode: encodeOrbitRun,
    replay: (seed: number, raw: string) => replayOrbitRun(seed, raw, ORBIT_REV_STD, encodeRev3Planets(orbitCourse(seed)), orbitHoles(seed), ORBIT_XP_BANK.find((e) => e.seed === seed)!.extras),
  },
  // The arcade scoring standard (29 Oct 2026, docs/arcade-standard/flip.md), appended: Roofbound flipRev 10, flipRev 8's play.
  { key: "flip/std", game: flipGameFor(FLIP_REV_STD), checkpoint: flipCheckpoint, mode: "events", rate: 50, encode: encodeFlipRun, replay: (seed: number, raw: string) => replayFlipRun(seed, raw, FLIP_REV_STD) },
  // The arcade scoring standard (29 Oct 2026, docs/arcade-standard/wavefront.md), appended so every earlier entry keeps its
  // index: Wavefront wavRev 12, wavRev 11's play scored in fixed parts that total 200.
  { key: "wavefront/std", game: wavefrontGameFor(WAV_REV_STD), checkpoint: wavCheckpoint, mode: "events", rate: 300, encode: encodeWavefrontRun, replay: (seed: number, raw: string) => replayWavefrontRun(seed, raw, WAV_REV_STD) },
  // The arcade scoring standard (29 Oct 2026, docs/arcade-standard/cross.md), appended: Jaywalk crossRev 10, busier crossings.
  { key: "cross/std", game: crossGameFor(CROSS_REV_STD), checkpoint: crossCheckpoint, mode: "events", rate: 60, encode: encodeCrossRun, replay: (seed: number, raw: string) => replayCrossRun(seed, raw, CROSS_REV_STD) },
  // Grappler's swinging course (swingRev 15, 29 Oct 2026, docs/arcade-standard/swing.md), appended so every earlier entry keeps its index.
  { key: "swing/rework", game: swingGameFor(SWING_REV_REWORK), checkpoint: swingCheckpoint, mode: "events", rate: 30, encode: encodeSwingRun, replay: (seed: number, raw: string) => replaySwingRun(seed, raw, SWING_REV_REWORK) },
  // Cards & Board (30 Oct 2026, docs/arcade-standard/minesweeper.md and mahjong.md), appended so every earlier entry keeps
  // its index: Minesweeper minesRev 1 (random reveals and flags) and Mahjong Solitaire mahjongRev 1 (random taps and Shuffles).
  { key: "minesweeper", game: minesweeperGameFor(MINES_REV_STD), checkpoint: minesCheckpoint, mode: "events", rate: 60, encode: encodeMinesweeperRun, replay: (seed: number, raw: string) => replayMinesweeperRun(seed, raw, MINES_REV_STD) },
  { key: "mahjong", game: mahjongGameFor(MAHJONG_REV_STD), checkpoint: mahjongCheckpoint, mode: "events", rate: 80, encode: encodeMahjongRun, replay: (seed: number, raw: string) => replayMahjongRun(seed, raw, MAHJONG_REV_STD) },
  // The Sports group (30 Oct 2026, docs/arcade-standard/homerun.md, freekick.md, racing.md), appended so every earlier
  // entry keeps its index: each on its proved deal's seeds.
  { key: "homerun", interval: HOMERUN_CHECKPOINT_INTERVAL, game: homerunGameFor(HOMERUN_REV_STD), checkpoint: homerunCheckpoint, mode: "events", rate: 20, encode: encodeHomerunRun, replay: (seed: number, raw: string) => replayHomerunRun(seed, raw, HOMERUN_REV_STD), seedFor: (n: number) => HOMERUN_DEAL[n % HOMERUN_DEAL.length]! },
  { key: "freekick", interval: FREEKICK_CHECKPOINT_INTERVAL, game: freekickGameFor(FREEKICK_REV_STD), checkpoint: freekickCheckpoint, mode: "events", rate: 20, encode: encodeFreekickRun, replay: (seed: number, raw: string) => replayFreekickRun(seed, raw, FREEKICK_REV_STD), seedFor: (n: number) => FREEKICK_DEAL[n % FREEKICK_DEAL.length]! },
  { key: "racing", interval: RACING_CHECKPOINT_INTERVAL, game: racingGameFor(RACING_REV_STD), checkpoint: racingCheckpoint, mode: "events", rate: 120, encode: encodeRacingRun, replay: (seed: number, raw: string) => replayRacingRun(seed, raw, RACING_REV_STD), seedFor: (n: number) => RACING_DEAL[n % RACING_DEAL.length]! },
  // Cards & Board (30 Oct 2026), appended so every earlier entry keeps its index: FreeCell, TriPeaks and Poker Squares at
  // revision 1. FreeCell and TriPeaks deal a bank index (any seed maps onto the bank).
  { key: "freecell", game: freecellGame, checkpoint: fcCheckpoint, mode: "events", rate: 120, encode: encodeFreecellRun, replay: (seed: number, raw: string) => replayFreecellRun(seed, raw, 1), seedFor: (n: number) => n % 300 },
  { key: "tripeaks", game: tripeaksGame, checkpoint: tpCheckpoint, mode: "events", rate: 120, encode: encodeTripeaksRun, replay: (seed: number, raw: string) => replayTripeaksRun(seed, raw, 1), seedFor: (n: number) => n % 300 },
  { key: "pokersquares", game: pokerSquaresGame, checkpoint: psCheckpoint, mode: "events", rate: 60, encode: encodePokerSquaresRun, replay: (seed: number, raw: string) => replayPokerSquaresRun(seed, raw, 1) },
  // The Sports group (30 Oct 2026), appended so every earlier entry keeps its index: Minigolf golfRev 1 (bank courses and
  // their stored pars) and Speed Pool poolRev 1 (bank layouts).
  {
    key: "minigolf",
    game: minigolfGameFor(MINIGOLF_BANK[0]!.pars),
    gameFor: (seed: number) => minigolfGameFor(MINIGOLF_BANK.find((e) => e.seed === seed)!.pars),
    seedFor: (n: number) => MINIGOLF_BANK[n % MINIGOLF_BANK.length]!.seed,
    checkpoint: minigolfCheckpoint,
    mode: "events",
    rate: 40,
    encode: encodeMinigolfRun,
    replay: (seed: number, raw: string) => replayMinigolfRun(seed, raw, MINIGOLF_BANK.find((e) => e.seed === seed)!.pars),
  },
  { key: "pool", game: poolGameFor(POOL_REV_V1), seedFor: (n: number) => POOL_BANK[n % POOL_BANK.length]!, checkpoint: poolCheckpoint, mode: "events", rate: 40, encode: encodePoolRun, replay: (seed: number, raw: string) => replayPoolRun(seed, raw, POOL_REV_V1) },
  // Curling curlRev 1 (bank sheets), appended after them.
  { key: "curling", game: curlingGameFor(1), seedFor: (n: number) => CURLING_BANK[n % CURLING_BANK.length]!, checkpoint: curlingCheckpoint, mode: "events", rate: 40, encode: encodeCurlingRun, replay: (seed: number, raw: string) => replayCurlingRun(seed, raw, 1) },
  // Mahjong mahjongRev 2 (31 Oct 2026: Undo and Reset), appended so every earlier entry keeps its index: random taps,
  // Shuffles, Undos and Resets.
  { key: "mahjong/undo", game: mahjongGameFor(MAHJONG_REV_UNDO), checkpoint: mahjongCheckpoint, mode: "events", rate: 80, encode: encodeMahjongRun, replay: (seed: number, raw: string) => replayMahjongRun(seed, raw, MAHJONG_REV_UNDO) },
  // Free Cell freecellRev 2 (Undo and Reset), Full House pokerSquaresRev 2 (full at the elite median) and Five Hands
  // fiveHandsRev 1 (31 Oct 2026), appended so every earlier entry keeps its index.
  { key: "freecell", game: freecellGameFor(2), checkpoint: fcCheckpoint, mode: "events", rate: 120, encode: encodeFreecellRun, replay: (seed: number, raw: string) => replayFreecellRun(seed, raw, 2), seedFor: (n: number) => n % 300 },
  { key: "pokersquares", game: pokerSquaresGameFor(2), checkpoint: psCheckpoint, mode: "events", rate: 60, encode: encodePokerSquaresRun, replay: (seed: number, raw: string) => replayPokerSquaresRun(seed, raw, 2) },
  { key: "fivehands", game: fiveHandsGame, checkpoint: fhCheckpoint, mode: "events", rate: 60, encode: encodeFiveHandsRun, replay: (seed: number, raw: string) => replayFiveHandsRun(seed, raw, 1) },
  // The Sports tuning (31 Oct 2026; Home Run homerunRev 2, Top Bins freekickRev 2, Apex racingRev 2), appended so every
  // earlier entry keeps its index: each on its rev-2 proved deal's seeds.
  { key: "homerun/v2", interval: HOMERUN_CHECKPOINT_INTERVAL, game: homerunGameFor(HOMERUN_REV_2), checkpoint: homerunCheckpoint, mode: "events", rate: 20, encode: encodeHomerunRun, replay: (seed: number, raw: string) => replayHomerunRun(seed, raw, HOMERUN_REV_2), seedFor: (n: number) => HOMERUN_DEAL_V2[n % HOMERUN_DEAL_V2.length]! },
  { key: "freekick/v2", interval: FREEKICK_CHECKPOINT_INTERVAL, game: freekickGameFor(FREEKICK_REV_2), checkpoint: freekickCheckpoint, mode: "events", rate: 20, encode: encodeFreekickRun, replay: (seed: number, raw: string) => replayFreekickRun(seed, raw, FREEKICK_REV_2), seedFor: (n: number) => FREEKICK_DEAL_V2[n % FREEKICK_DEAL_V2.length]! },
  { key: "racing/v2", interval: RACING_CHECKPOINT_INTERVAL, game: racingGameFor(RACING_REV_2), checkpoint: racingCheckpoint, mode: "events", rate: 120, encode: encodeRacingRun, replay: (seed: number, raw: string) => replayRacingRun(seed, raw, RACING_REV_2), seedFor: (n: number) => RACING_DEAL_V2[n % RACING_DEAL_V2.length]! },
  // Cue Ball poolRev 2 (the V2 bank, power and spin dot as separate fields), appended 31 Oct 2026.
  { key: "pool", game: poolGameFor(2), seedFor: (n: number) => POOL_BANK_V2[n % POOL_BANK_V2.length]!, checkpoint: poolCheckpoint, mode: "events", rate: 40, encode: encodePoolRun, replay: (seed: number, raw: string) => replayPoolRun(seed, raw, 2) },
  // Curl Champ curlRev 2 (the V2 bank, the start along the hog line, side brushing), appended 31 Oct 2026; pinned to
  // curlRev 2 since curlRev 3 became the dealt stamp (1 Nov 2026), so it plays exactly what it always did.
  { key: "curling", game: curlingGameFor(2), seedFor: (n: number) => CURLING_BANK_V2[n % CURLING_BANK_V2.length]!, checkpoint: curlingCheckpoint, mode: "events", rate: 40, encode: encodeCurlingRun, replay: (seed: number, raw: string) => replayCurlingRun(seed, raw, 2) },
  // Crazy Golf golfRev 2 (windmills, tunnels, sand, hills, banked curves, castle gates; 31 Oct 2026): its own bank courses and stored pars.
  {
    key: "minigolf",
    game: minigolfGameFor(MINIGOLF_BANK_V2[0]!.pars, 2),
    gameFor: (seed: number) => minigolfGameFor(MINIGOLF_BANK_V2.find((e) => e.seed === seed)!.pars, 2),
    seedFor: (n: number) => MINIGOLF_BANK_V2[n % MINIGOLF_BANK_V2.length]!.seed,
    checkpoint: minigolfCheckpoint,
    mode: "events",
    rate: 40,
    encode: encodeMinigolfRun,
    replay: (seed: number, raw: string) => replayMinigolfRun(seed, raw, MINIGOLF_BANK_V2.find((e) => e.seed === seed)!.pars, 2),
  },
  // Blockfall blockfallRev 1 (its proved deal's seeds) and Alley Roll alleyRollRev 1 (any seed), 1 Nov 2026, appended
  // so every earlier entry keeps its index.
  { key: "blockfall", game: blockfallGame, checkpoint: bfCheckpoint, mode: "events", rate: 120, encode: encodeBlockfallRun, replay: (seed: number, raw: string) => replayBlockfallRun(seed, raw, 1), seedFor: (n: number) => BLOCKFALL_DEAL[n % BLOCKFALL_DEAL.length]! },
  { key: "alleyroll", game: alleyRollGame, checkpoint: arCheckpoint, mode: "events", rate: 40, encode: encodeAlleyRollRun, replay: (seed: number, raw: string) => replayAlleyRollRun(seed, raw, 1) },
  // The 1 Nov 2026 tuning, appended so every earlier entry keeps its index: Cue Ball poolRev 3 (its own bank; more power
  // and spin, a miss a foul), Free Cell freecellRev 3 (the core full sooner, auto moves animated) and Five Hands
  // fiveHandsRev 2 (the steep hand table, its own witness deals).
  { key: "pool/v3", game: poolGameFor(3), seedFor: (n: number) => POOL_BANK_V3[n % POOL_BANK_V3.length]!, checkpoint: poolCheckpoint, mode: "events", rate: 40, encode: encodePoolRun, replay: (seed: number, raw: string) => replayPoolRun(seed, raw, 3) },
  { key: "freecell/v3", game: freecellGameFor(3), checkpoint: fcCheckpoint, mode: "events", rate: 120, encode: encodeFreecellRun, replay: (seed: number, raw: string) => replayFreecellRun(seed, raw, 3), seedFor: (n: number) => n % 300 },
  { key: "fivehands/v2", game: fiveHandsGameFor(2), checkpoint: fhCheckpoint, mode: "events", rate: 60, encode: encodeFiveHandsRun, replay: (seed: number, raw: string) => replayFiveHandsRun(seed, raw, 2) },
  // Ricochet ricoRev 2 (the ninja wall-climb, 1 Nov 2026), appended so every earlier entry keeps its index.
  { key: "ricochet/ninja", interval: NINJA_CHECKPOINT_INTERVAL, game: ninjaGame, checkpoint: ninjaCheckpoint, mode: "events", rate: 30, encode: encodeNinjaRun, replay: (seed: number, raw: string) => replayNinjaRun(seed, raw) },
  // The prepared shot (1 Nov 2026; Home Run homerunRev 3, Top Bins freekickRev 3, Curl Champ curlRev 3), appended so
  // every earlier entry keeps its index: each on its rev-3 proved deal's seeds.
  { key: "homerun/v3", interval: HOMERUN_CHECKPOINT_INTERVAL, game: homerunGameFor(HOMERUN_REV_3), checkpoint: homerunCheckpoint, mode: "events", rate: 20, encode: encodeHomerunRun, replay: (seed: number, raw: string) => replayHomerunRun(seed, raw, HOMERUN_REV_3), seedFor: (n: number) => HOMERUN_DEAL_V3[n % HOMERUN_DEAL_V3.length]! },
  { key: "freekick/v3", interval: FREEKICK_CHECKPOINT_INTERVAL, game: freekickGameFor(FREEKICK_REV_3), checkpoint: freekickCheckpoint, mode: "events", rate: 20, encode: encodeFreekickRun, replay: (seed: number, raw: string) => replayFreekickRun(seed, raw, FREEKICK_REV_3), seedFor: (n: number) => FREEKICK_DEAL_V3[n % FREEKICK_DEAL_V3.length]! },
  { key: "curling/v3", game: curlingGameFor(3), seedFor: (n: number) => CURLING_BANK_V3[n % CURLING_BANK_V3.length]!, checkpoint: curlingCheckpoint, mode: "events", rate: 40, encode: encodeCurlingRun, replay: (seed: number, raw: string) => replayCurlingRun(seed, raw, 3) },
  // Bastion bastionRev 2 (the tank-defence shooter, 1 Nov 2026), appended so every earlier entry keeps its stream.
  { key: "bastion/v2", interval: BT2_CHECKPOINT_INTERVAL, game: bastionTankGame, checkpoint: bastionTankCheckpoint, mode: "events", rate: 30, encode: encodeBastionTankRun, replay: (seed: number, raw: string) => replayBastionTankRun(seed, raw) },
  // Meteor snakeRev 12 (1 Nov 2026, docs/arcade-standard/snake.md), appended so every earlier entry keeps its index:
  // snakeRev 11's play, the core counting a gold star as 2 stars and full at 28.
  { key: "snake/v12", game: snakeGameFor(SNAKE_REV_12), checkpoint: snakeCheckpoint, mode: "events", rate: 40, encode: encodeSnakeRun, replay: (seed: number, raw: string) => replaySnakeRun(seed, raw, SNAKE_REV_12) },
  // Gemstone matchupRev 12 (six goals shown at once, six treasures; Nov 2026), appended at the end.
  { key: "matchup/six", game: matchupGameFor(MATCHUP_REV_SIX), checkpoint: matchupCheckpoint, mode: "events", rate: 40, encode: encodeMatchupRun, replay: (seed: number, raw: string) => replayMatchupRun(seed, raw, MATCHUP_REV_SIX) },
  // The fuel meter (1 Nov 2026, docs/arcade-standard/orbit.md), appended so every earlier entry keeps its index: Orbit
  // orbitRev 14 on its fuel-bank courses (fuel, any planet catches).
  {
    key: "orbit/fuel",
    game: orbitRev3Game,
    gameFor: (seed: number) => {
      const e = ORBIT_FUEL_BANK.find((x) => x.seed === seed)!;
      return { ...orbitRev3Game, init: () => initFuelFrom(decodeRev3Planets(e.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(e.holes), decodeOrbitExtras(e.extras)) };
    },
    seedFor: (n: number) => ORBIT_FUEL_BANK[n % ORBIT_FUEL_BANK.length]!.seed,
    checkpoint: orbitCheckpoint,
    mode: "events",
    rate: 25,
    encode: encodeOrbitRun,
    replay: (seed: number, raw: string) => {
      const e = ORBIT_FUEL_BANK.find((x) => x.seed === seed)!;
      return replayOrbitRun(seed, raw, ORBIT_REV_FUEL, e.planets, e.holes, e.extras);
    },
  },
  // Grappler swingRev 16 (1 Nov 2026: the dark ledge runs, 90 s, a longer course), appended so every earlier entry keeps its index.
  { key: "swing/dark", game: swingGameFor(SWING_REV_DARK), checkpoint: swingCheckpoint, mode: "events", rate: 30, encode: encodeSwingRun, replay: (seed: number, raw: string) => replaySwingRun(seed, raw, SWING_REV_DARK) },
  // Pyramid pyramidRev 1, Golf Solitaire golfSolRev 1 and Muggins mugginsRev 1 (1 Nov 2026), appended so every earlier
  // entry keeps its index: random taps, plays, draws, Undos and Resets.
  { key: "pyramid", game: pyramidGame, checkpoint: pyCheckpoint, mode: "events", rate: 80, encode: encodePyramidRun, replay: (seed: number, raw: string) => replayPyramidRun(seed, raw, 1) },
  { key: "golfsol", game: golfSolGame, checkpoint: gsCheckpoint, mode: "events", rate: 80, encode: encodeGolfSolRun, replay: (seed: number, raw: string) => replayGolfSolRun(seed, raw, 1), seedFor: (n: number) => n % 300 },
  { key: "muggins", game: mugginsGame, checkpoint: mgCheckpoint, mode: "events", rate: 60, encode: encodeMugginsRun, replay: (seed: number, raw: string) => replayMugginsRun(seed, raw, 1) },
  // Ringer (Alley Roll alleyRollRev 2, 3 Nov 2026: the cup stack and the seeded gold cup), appended so every earlier
  // entry keeps its index; the rev-1 entry above stays pinned to rev 1.
  { key: "alleyroll/ringer", game: ringerGame, checkpoint: arCheckpoint, mode: "events", rate: 40, encode: encodeAlleyRollRun, replay: (seed: number, raw: string) => replayAlleyRollRun(seed, raw, 2) },
  // Apex racingRev 3 (3 Nov 2026: the softer gravel, corner speed signs, the pace score), appended at the end.
  { key: "racing/v3", interval: RACING_CHECKPOINT_INTERVAL, game: racingGameFor(RACING_REV_3), checkpoint: racingCheckpoint, mode: "events", rate: 120, encode: encodeRacingRun, replay: (seed: number, raw: string) => replayRacingRun(seed, raw, RACING_REV_3), seedFor: (n: number) => RACING_DEAL_V3[n % RACING_DEAL_V3.length]! },
  // Home Run homerunRev 4 (3 Nov 2026: a spot and a tap) and Cue Ball poolRev 4 (3 Nov 2026: a seeded set, 90 s), appended
  // so every earlier entry keeps its index: random spots and taps; random shots on the poolRev 4 bank's layouts.
  { key: "homerun/v4", interval: HOMERUN_CHECKPOINT_INTERVAL, game: homerunGameFor(HOMERUN_REV_4), checkpoint: homerunCheckpoint, mode: "events", rate: 20, encode: encodeHomerunRun, replay: (seed: number, raw: string) => replayHomerunRun(seed, raw, HOMERUN_REV_4), seedFor: (n: number) => HOMERUN_DEAL_V4[n % HOMERUN_DEAL_V4.length]! },
  { key: "pool/v4", game: poolGameFor(4), seedFor: (n: number) => POOL_BANK_V3[n % POOL_BANK_V3.length]!, checkpoint: poolCheckpoint, mode: "events", rate: 40, encode: encodePoolRun, replay: (seed: number, raw: string) => replayPoolRun(seed, raw, 4) },
  // Iron Wall bastionRev 3 (3 Nov 2026: eased waves 4–5, the 90 ms zone, the drones), appended at the end so every
  // earlier entry keeps its index and stream.
  { key: "bastion/v3", interval: BT2_CHECKPOINT_INTERVAL, game: bastionIronGame, checkpoint: bastionTankCheckpoint, mode: "events", rate: 30, encode: encodeBastionTankRun, replay: (seed: number, raw: string) => replayBastionTankRun(seed, raw, 3) },
  // Moon Climb ricoRev 3 and Blockzone blockfallRev 2 (3 Nov 2026), appended so every earlier entry keeps its index:
  // random taps (with leap-off directions) and random moves, turns, drops and soft drops.
  { key: "ricochet/moon", interval: NINJA_CHECKPOINT_INTERVAL, game: moonGame, checkpoint: moonCheckpoint, mode: "events", rate: 30, encode: encodeMoonRun, replay: (seed: number, raw: string) => replayMoonRun(seed, raw) },
  { key: "blockfall/zone", game: blockzoneGame, checkpoint: bfCheckpoint, mode: "events", rate: 120, encode: encodeBlockfallRun, replay: (seed: number, raw: string) => replayBlockfallRun(seed, raw, 2), seedFor: (n: number) => BLOCKFALL_DEAL_V2[n % BLOCKFALL_DEAL_V2.length]! },
  // Tilt tiltRev 11 (3 Nov 2026, docs/arcade-standard/tilt.md), appended so every earlier entry keeps its index:
  // tiltRev 10's mazes with no gold stars, scored on par times and a clean run.
  { key: "tilt/rev11", game: tiltGameFor(TILT_REV_PAR), checkpoint: tiltCheckpoint, mode: "events", rate: 500, encode: encodeTiltRun, replay: (seed: number, raw: string) => replayTiltRun(seed, raw, TILT_REV_PAR) },
  // Jaywalk crossRev 11 (3 Nov 2026, docs/arcade-standard/cross.md "crossRev 11"), appended so every earlier entry keeps
  // its index: crossRev 10's courses without coins, the no-stop streak and a cost a hit.
  { key: "cross/rev11", game: crossGameFor(CROSS_REV_FLOW), checkpoint: crossCheckpoint, mode: "events", rate: 60, encode: encodeCrossRun, replay: (seed: number, raw: string) => replayCrossRun(seed, raw, CROSS_REV_FLOW) },
  // Roofbound flipRev 11 (3 Nov 2026, docs/arcade-standard/flip.md "flipRev 11"), appended so every earlier entry keeps its
  // index: flipRev 8's course and moves with no star pickups, the flow streak counted.
  { key: "flip/rev11", game: flipGameFor(FLIP_REV_FLOW), checkpoint: flipCheckpoint, mode: "events", rate: 50, encode: encodeFlipRun, replay: (seed: number, raw: string) => replayFlipRun(seed, raw, FLIP_REV_FLOW) },
  // Rainbow Bridge inkRev 13 (Nov 2026: clovers, ink par, more birds; failed drops never end the run), appended so every
  // earlier entry keeps its index. Eight seeds in turn, as ink/std.
  {
    key: "ink/clover",
    game: inkBridgeGameFor(INK_REV_CLOVER),
    seedFor: (n: number) => 9_000_001 + 7_919 * (n % 8),
    checkpoint: inkCheckpoint,
    mode: "events",
    rate: 400,
    encode: encodeInkBridgeRun,
    replay: (seed: number, raw: string) => replayInkBridgeRun(seed, raw, INK_REV_CLOVER),
  },
  // Grappler swingRev 17 (3 Nov 2026: the sliding hooks and the clean-swing streak), appended so every earlier entry keeps its index.
  { key: "swing/slide", game: swingGameFor(SWING_REV_SLIDE), checkpoint: swingCheckpoint, mode: "events", rate: 30, encode: encodeSwingRun, replay: (seed: number, raw: string) => replaySwingRun(seed, raw, SWING_REV_SLIDE) },
  // The Sports batch (3 Nov 2026; Top Bins freekickRev 4, the drawn shot; Curl Champ curlRev 4, the power bar and three
  // reds), appended so every earlier entry keeps its stream: each on its rev-4 proved deal's seeds.
  { key: "freekick/v4", interval: FREEKICK_CHECKPOINT_INTERVAL, game: freekickGameFor(4), checkpoint: freekickCheckpoint, mode: "events", rate: 20, encode: encodeFreekickRun, replay: (seed: number, raw: string) => replayFreekickRun(seed, raw, 4), seedFor: (n: number) => FREEKICK_DEAL_V4[n % FREEKICK_DEAL_V4.length]! },
  { key: "curling/v4", game: curlingGameFor(4), seedFor: (n: number) => CURLING_BANK_V4[n % CURLING_BANK_V4.length]!, checkpoint: curlingCheckpoint, mode: "events", rate: 40, encode: encodeCurlingRun, replay: (seed: number, raw: string) => replayCurlingRun(seed, raw, 4) },
  // The Cards & Board batch (3 Nov 2026), appended so every earlier entry keeps its index: Free Cell freecellRev 4 (the
  // 40-card deal from its own bank), Summit tripeaksRev 2 (the stock par) and Five Hands fiveHandsRev 3 (the flat table,
  // the hand points summed to 200).
  { key: "freecell/v4", game: freecellGameFor(4), checkpoint: fcCheckpoint, mode: "events", rate: 120, encode: encodeFreecellRun, replay: (seed: number, raw: string) => replayFreecellRun(seed, raw, 4), seedFor: (n: number) => n % 300 },
  { key: "tripeaks/v2", game: tripeaksGameFor(2), checkpoint: tpCheckpoint, mode: "events", rate: 120, encode: encodeTripeaksRun, replay: (seed: number, raw: string) => replayTripeaksRun(seed, raw, 2), seedFor: (n: number) => n % 300 },
  { key: "fivehands/v3", game: fiveHandsGameFor(3), checkpoint: fhCheckpoint, mode: "events", rate: 60, encode: encodeFiveHandsRun, replay: (seed: number, raw: string) => replayFiveHandsRun(seed, raw, 3) },
  // Tilt tiltRev 12 (3 Nov 2026, docs/arcade-standard/tilt.md "tiltRev 12": tiltRev 11 with bigger marbles and keys),
  // appended so every earlier entry keeps its index.
  { key: "tilt/big", game: tiltGameFor(TILT_REV_BIG), checkpoint: tiltCheckpoint, mode: "events", rate: 500, encode: encodeTiltRun, replay: (seed: number, raw: string) => replayTiltRun(seed, raw, TILT_REV_BIG) },
  // Rainbow Bridge inkRev 14 (3 Nov 2026: inkRev 13's rules with a bigger coin, clovers and birds), appended so every
  // earlier entry keeps its index: on its proved deal's seeds.
  {
    key: "ink/big",
    game: inkBridgeGameFor(INK_REV_BIG),
    seedFor: (n: number) => INK_BIG_DEAL[(n * 7) % INK_BIG_DEAL.length]!,
    checkpoint: inkCheckpoint,
    mode: "events",
    rate: 400,
    encode: encodeInkBridgeRun,
    replay: (seed: number, raw: string) => replayInkBridgeRun(seed, raw, INK_REV_BIG),
  },
  // Slice sliceRev 12 (3 Nov 2026, the Action polish): bigger, recognisable food and chillies.
  { key: "slice/food", game: sliceGameFor(12), checkpoint: sliceCheckpoint, mode: "events", rate: 1000, encode: encodeSliceRun, replay: (seed: number, raw: string) => replaySliceRun(seed, raw, 12) },
  // Roofbound flipRev 12 (3 Nov 2026): flipRev 11's game dealt from its proved courses (seeds from the deal).
  { key: "flip/deal", game: flipGameFor(12), checkpoint: flipCheckpoint, mode: "events", rate: 50, encode: encodeFlipRun, replay: (seed: number, raw: string) => replayFlipRun(seed, raw, 12), seedFor: (n: number) => FLIP_DEAL[n % FLIP_DEAL.length]! },
  // The scoring audit's arcade fixes (Nov 2026; scoring-audit-arcade-check): each keeps the previous stamp's play.
  { key: "cross/keep", game: crossGameFor(12), checkpoint: crossCheckpoint, mode: "events", rate: 60, encode: encodeCrossRun, replay: (seed: number, raw: string) => replayCrossRun(seed, raw, 12) },
  { key: "wavefront/keep", game: wavefrontGameFor(13), checkpoint: wavCheckpoint, mode: "events", rate: 300, encode: encodeWavefrontRun, replay: (seed: number, raw: string) => replayWavefrontRun(seed, raw, 13) },
  { key: "burst/aim", game: burstGameFor(11), checkpoint: burstCheckpoint, mode: "events", rate: 120, encode: encodeBurstRun, replay: (seed: number, raw: string) => replayBurstRun(seed, raw, 11) },
  { key: "skyline/count", game: skylineGameFor(10), checkpoint: skylineCheckpoint, mode: "taps", rate: 15, encode: encodeSkylineRun, replay: (seed: number, raw: string) => replaySkylineRun(seed, raw, 10) },
  { key: "slice/line", game: sliceGameFor(13), checkpoint: sliceCheckpoint, mode: "events", rate: 1000, encode: encodeSliceRun, replay: (seed: number, raw: string) => replaySliceRun(seed, raw, 13) },
  // The cards partial-credit stamps (7 Nov 2026, scoring audit issue 6), appended so every earlier entry keeps its index:
  // Free Cell freecellRev 5, Summit tripeaksRev 3 and Thirteen pyramidRev 2 (the same deals and play, new parts).
  { key: "freecell/v5", game: freecellGameFor(5), checkpoint: fcCheckpoint, mode: "events", rate: 120, encode: encodeFreecellRun, replay: (seed: number, raw: string) => replayFreecellRun(seed, raw, 5), seedFor: (n: number) => n % 300 },
  { key: "tripeaks/v3", game: tripeaksGameFor(3), checkpoint: tpCheckpoint, mode: "events", rate: 120, encode: encodeTripeaksRun, replay: (seed: number, raw: string) => replayTripeaksRun(seed, raw, 3), seedFor: (n: number) => n % 300 },
  { key: "pyramid/v2", game: pyramidGameFor(2), checkpoint: pyCheckpoint, mode: "events", rate: 80, encode: encodePyramidRun, replay: (seed: number, raw: string) => replayPyramidRun(seed, raw, 2) },
  // Minefield minesRev 2 (13 Nov 2026: a Logic game with 20 mines), appended so every earlier entry keeps its stream.
  { key: "minesweeper/v2", game: minesweeperGameFor(MINES_REV_LOGIC), checkpoint: minesCheckpoint, mode: "events", rate: 60, encode: encodeMinesweeperRun, replay: (seed: number, raw: string) => replayMinesweeperRun(seed, raw, MINES_REV_LOGIC) },  // Thirteen pyramidRev 3 (15 Nov 2026: a dead end waits for Undo), appended so every earlier entry keeps its stream.
  { key: "pyramid/v3", game: pyramidGameFor(3), checkpoint: pyCheckpoint, mode: "events", rate: 80, encode: encodePyramidRun, replay: (seed: number, raw: string) => replayPyramidRun(seed, raw, 3) },
  // Tempo beatRev 12 (15 Nov 2026, the Retro overhaul: a missed note scores 0), appended so every earlier entry keeps its stream.
  { key: "beat/floor", game: beatGameFor(BEAT_REV_FLOOR), checkpoint: beatCheckpoint, mode: "events", rate: 200, encode: encodeBeatRun, replay: (seed: number, raw: string) => replayBeatRun(seed, raw, BEAT_REV_FLOOR) },
  // Rally rallyRev 13 (15 Nov 2026, the Retro overhaul: two lives, spin shots), appended so every earlier entry keeps its stream.
  { key: "rally/lives", game: rallyGameFor(RALLY_REV_LIVES), checkpoint: rallyCheckpoint, mode: "events", rate: 120, encode: encodeRallyRun, replay: (seed: number, raw: string) => replayRallyRun(seed, raw, RALLY_REV_LIVES) },
  // Pinball pinRev 7 (15 Nov 2026, the Retro overhaul: one J-O-U-L-Z set), appended so every earlier entry keeps its stream.
  { key: "pinball/joulz", game: pinball7Game, checkpoint: pin4Checkpoint, mode: "events", rate: 120, encode: encodePinballRun, replay: (seed: number, raw: string) => replayPinballRun(seed, raw, PIN_REV_JOULZ) },
  // Meteor snakeRev 13 (15 Nov 2026, the Retro overhaul: wrap-around edges), appended so every earlier entry keeps its stream.
  { key: "snake/wrap", game: snakeGameFor(SNAKE_REV_WRAP), checkpoint: snakeCheckpoint, mode: "events", rate: 60, encode: encodeSnakeRun, replay: (seed: number, raw: string) => replaySnakeRun(seed, raw, SNAKE_REV_WRAP) },
  // Breaker brkRev 12 (15 Nov 2026, the Retro overhaul: the clearable wall), appended so every earlier entry keeps its stream.
  { key: "breaker/clear", game: breakerGameFor(BRK_REV_CLEAR), checkpoint: brkCheckpoint, mode: "events", rate: 950, encode: encodeBreakerRun, replay: (seed: number, raw: string) => replayBreakerRun(seed, raw, BRK_REV_CLEAR) },
  // Wavefront wavRev 14 (15 Nov 2026, the Retro overhaul: the charged shot), appended so every earlier entry keeps its stream.
  { key: "wavefront/charge", game: wavefrontGameFor(14), checkpoint: wavCheckpoint, mode: "events", rate: 300, encode: encodeWavefrontRun, replay: (seed: number, raw: string) => replayWavefrontRun(seed, raw, 14) },
  // Meteor snakeRev 14 (15 Nov 2026, the Retro overhaul: rocks in three sizes), appended so every earlier entry keeps its stream.
  { key: "snake/sizes", game: snakeGameFor(14), checkpoint: snakeCheckpoint, mode: "events", rate: 60, encode: encodeSnakeRun, replay: (seed: number, raw: string) => replaySnakeRun(seed, raw, 14) },
  // Fission burstRev 13 (15 Nov 2026, the Retro overhaul: bigger atoms), appended so every earlier entry keeps its stream.
  { key: "burst/big", game: burstGameFor(13), checkpoint: burstCheckpoint, mode: "events", rate: 120, encode: encodeBurstRun, replay: (seed: number, raw: string) => replayBurstRun(seed, raw, 13) },
  // Meteor snakeRev 15 (16 Nov 2026, the Retro overhaul stage 3: the first crash forgiven), appended so every earlier entry keeps its stream.
  // Spacewalk crossRev 13 (16 Nov 2026, the Retro overhaul stage 3: lighter traffic), appended so every earlier entry keeps its stream.
  { key: "cross/light", game: crossGameFor(13), checkpoint: crossCheckpoint, mode: "events", rate: 60, encode: encodeCrossRun, replay: (seed: number, raw: string) => replayCrossRun(seed, raw, 13) },
  // Wavefront wavRev 15 (16 Nov 2026, the Retro overhaul stage 3: larger hit cells), appended so every earlier entry keeps its stream.
  { key: "wavefront/big", game: wavefrontGameFor(15), checkpoint: wavCheckpoint, mode: "events", rate: 300, encode: encodeWavefrontRun, replay: (seed: number, raw: string) => replayWavefrontRun(seed, raw, 15) },
  // Pinball pinRev 8 (16 Nov 2026, the Retro overhaul stage 3: outlane saves counted), appended so every earlier entry keeps its stream.
  { key: "pinball/save", game: pinball8Game, checkpoint: pin4Checkpoint, mode: "events", rate: 120, encode: encodePinballRun, replay: (seed: number, raw: string) => replayPinballRun(seed, raw, 8) },
  // Hover hoverRev 11 (16 Nov 2026, the Retro overhaul stage 3: starting shielded), appended so every earlier entry keeps its stream.
  { key: "hover/shield", game: hoverGameFor(11), checkpoint: hoverCheckpoint, mode: "taps", rate: 60, encode: encodeHoverRun, replay: (seed: number, raw: string) => replayHoverRun(seed, raw, 11) },
  { key: "snake/grace", game: snakeGameFor(15), checkpoint: snakeCheckpoint, mode: "events", rate: 60, encode: encodeSnakeRun, replay: (seed: number, raw: string) => replaySnakeRun(seed, raw, 15) },
  // Orbit orbitRev 15 (the Action overhaul, 15 Nov 2026: grace, a slip respawns after a 3 s hold), appended so every
  // earlier entry keeps its stream: random taps and checkpoints on the fuel-bank courses.
  {
    key: "orbit/grace",
    game: orbitRev3Game,
    gameFor: (seed: number) => {
      const e = ORBIT_FUEL_BANK.find((x) => x.seed === seed)!;
      return { ...orbitRev3Game, init: () => initGraceFrom(decodeRev3Planets(e.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(e.holes), decodeOrbitExtras(e.extras)) };
    },
    seedFor: (n: number) => ORBIT_FUEL_BANK[n % ORBIT_FUEL_BANK.length]!.seed,
    checkpoint: orbitCheckpoint,
    mode: "events",
    rate: 25,
    encode: encodeOrbitRun,
    replay: (seed: number, raw: string) => {
      const e = ORBIT_FUEL_BANK.find((x) => x.seed === seed)!;
      return replayOrbitRun(seed, raw, ORBIT_REV_GRACE, e.planets, e.holes, e.extras);
    },
  },
  // High Rise skylineRev 11 (15 Nov 2026, the Action overhaul: lives and the wide-block rescue), appended so every earlier
  // entry keeps its stream.
  { key: "skyline/lives", game: skylineGameFor(11), checkpoint: skylineCheckpoint, mode: "taps", rate: 15, encode: encodeSkylineRun, replay: (seed: number, raw: string) => replaySkylineRun(seed, raw, 11) },
  // Roofbound flipRev 13 (15 Nov 2026, the Action overhaul: grace), appended so every earlier entry keeps its stream.
  { key: "flip/grace", game: flipGameFor(13), checkpoint: flipCheckpoint, mode: "events", rate: 50, encode: encodeFlipRun, replay: (seed: number, raw: string) => replayFlipRun(seed, raw, 13), seedFor: (n: number) => FLIP_DEAL[n % FLIP_DEAL.length]! },
  // Moon Climb ricoRev 4 (15 Nov 2026, the Action overhaul's stage 2: the bigger ninja), appended so every earlier entry
  // keeps its stream.
  { key: "ricochet/big", interval: NINJA_CHECKPOINT_INTERVAL, game: moonGameFor(4), checkpoint: moonCheckpoint, mode: "events", rate: 30, encode: encodeMoonRun, replay: (seed: number, raw: string) => replayMoonRun(seed, raw, 4) },
  // Grappler swingRev 18 (15 Nov 2026, the Action overhaul's stage 2: the bigger hero), appended so every earlier entry
  // keeps its stream: on its proved deal's courses.
  { key: "swing/big", game: swingGameFor(SWING_REV_BIG), checkpoint: swingCheckpoint, mode: "events", rate: 30, encode: encodeSwingRun, replay: (seed: number, raw: string) => replaySwingRun(seed, raw, SWING_REV_BIG), seedFor: (n: number) => SWING_BIG_DEAL[n % SWING_BIG_DEAL.length]! },
  // Orbit orbitRev 16 (15 Nov 2026, the Action overhaul's stage 3: bigger planets on grace's play), appended so every
  // earlier entry keeps its stream: random taps and checkpoints on the fuel-bank courses.
  {
    key: "orbit/big",
    game: orbitRev3Game,
    gameFor: (seed: number) => {
      const e = ORBIT_FUEL_BANK.find((x) => x.seed === seed)!;
      return { ...orbitRev3Game, init: () => initBigFrom(decodeRev3Planets(e.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(e.holes), decodeOrbitExtras(e.extras)) };
    },
    seedFor: (n: number) => ORBIT_FUEL_BANK[n % ORBIT_FUEL_BANK.length]!.seed,
    checkpoint: orbitCheckpoint,
    mode: "events",
    rate: 25,
    encode: encodeOrbitRun,
    replay: (seed: number, raw: string) => {
      const e = ORBIT_FUEL_BANK.find((x) => x.seed === seed)!;
      return replayOrbitRun(seed, raw, ORBIT_REV_BIG, e.planets, e.holes, e.extras);
    },
  },
  // Iron Wall bastionRev 4 (15 Nov 2026, the levels: Normal, Easy and Hard; Expert is bastionRev 3's entry), appended so
  // every earlier entry keeps its stream.
  ...(["normal", "easy", "hard"] as const).map((level) => ({ key: `bastion/v4-${level}`, interval: BT2_CHECKPOINT_INTERVAL, game: bastionTankGameFor(4, level), checkpoint: bastionTankCheckpoint, mode: "events" as const, rate: 30, encode: encodeBastionTankRun, replay: (seed: number, raw: string) => replayBastionTankRun(seed, raw, 4, level) })),
  // Moon Climb ricoRev 4's and Grappler swingRev 18's difficulty levels (15 Nov 2026, the Action overhaul), appended so
  // every earlier entry keeps its stream: each level's own towers and courses (Grappler's from the level's proved deal).
  ...(["easy", "hard", "expert"] as const).map((lv) => ({ key: `ricochet/${lv}`, interval: NINJA_CHECKPOINT_INTERVAL, game: moonGameFor(4, lv), checkpoint: moonCheckpoint, mode: "events" as const, rate: 30, encode: encodeMoonRun, replay: (seed: number, raw: string) => replayMoonRun(seed, raw, 4, lv) })),
  ...(["easy", "hard", "expert"] as const).map((lv) => ({ key: `swing/${lv}`, game: swingGameFor(SWING_REV_BIG, lv), checkpoint: swingCheckpoint, mode: "events" as const, rate: 30, encode: encodeSwingRun, replay: (seed: number, raw: string) => replaySwingRun(seed, raw, SWING_REV_BIG, undefined, lv), seedFor: (n: number) => SWING_LEVEL_DEAL[lv][n % SWING_LEVEL_DEAL[lv].length]! })),
  // Orbit's easy level (the Action overhaul, stage 3, 16 Nov 2026; docs/arcade-standard/orbit.md "Levels"): random taps and
  // checkpoints on the easy bank's courses with the level's rules, appended last so every earlier entry keeps its stream.
  {
    key: "orbit/easy",
    game: orbitRev3Game,
    gameFor: (seed: number) => {
      const e = ORBIT_FUEL_BANK_EASY.find((x) => x.seed === seed)!;
      return { ...orbitRev3Game, init: () => initLevelFrom(decodeRev3Planets(e.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(e.holes), decodeOrbitExtras(e.extras), "easy") };
    },
    seedFor: (n: number) => ORBIT_FUEL_BANK_EASY[n % ORBIT_FUEL_BANK_EASY.length]!.seed,
    checkpoint: orbitCheckpoint,
    mode: "events",
    rate: 25,
    encode: encodeOrbitRun,
    replay: (seed: number, raw: string) => {
      const e = ORBIT_FUEL_BANK_EASY.find((x) => x.seed === seed)!;
      return replayOrbitRun(seed, raw, ORBIT_REV_BIG, e.planets, e.holes, e.extras, undefined, "easy");
    },
  },
  // Orbit's hard level (the Action overhaul, stage 3, 16 Nov 2026; docs/arcade-standard/orbit.md "Levels"): random taps and
  // checkpoints on the hard bank's courses with the level's rules, appended last so every earlier entry keeps its stream.
  {
    key: "orbit/hard",
    game: orbitRev3Game,
    gameFor: (seed: number) => {
      const e = ORBIT_FUEL_BANK_HARD.find((x) => x.seed === seed)!;
      return { ...orbitRev3Game, init: () => initLevelFrom(decodeRev3Planets(e.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(e.holes), decodeOrbitExtras(e.extras), "hard") };
    },
    seedFor: (n: number) => ORBIT_FUEL_BANK_HARD[n % ORBIT_FUEL_BANK_HARD.length]!.seed,
    checkpoint: orbitCheckpoint,
    mode: "events",
    rate: 25,
    encode: encodeOrbitRun,
    replay: (seed: number, raw: string) => {
      const e = ORBIT_FUEL_BANK_HARD.find((x) => x.seed === seed)!;
      return replayOrbitRun(seed, raw, ORBIT_REV_BIG, e.planets, e.holes, e.extras, undefined, "hard");
    },
  },
  // Orbit's expert level (the Action overhaul, stage 3, 16 Nov 2026; docs/arcade-standard/orbit.md "Levels"): random taps and
  // checkpoints on the expert bank's courses with the level's rules, appended last so every earlier entry keeps its stream.
  {
    key: "orbit/expert",
    game: orbitRev3Game,
    gameFor: (seed: number) => {
      const e = ORBIT_FUEL_BANK_EXPERT.find((x) => x.seed === seed)!;
      return { ...orbitRev3Game, init: () => initLevelFrom(decodeRev3Planets(e.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(e.holes), decodeOrbitExtras(e.extras), "expert") };
    },
    seedFor: (n: number) => ORBIT_FUEL_BANK_EXPERT[n % ORBIT_FUEL_BANK_EXPERT.length]!.seed,
    checkpoint: orbitCheckpoint,
    mode: "events",
    rate: 25,
    encode: encodeOrbitRun,
    replay: (seed: number, raw: string) => {
      const e = ORBIT_FUEL_BANK_EXPERT.find((x) => x.seed === seed)!;
      return replayOrbitRun(seed, raw, ORBIT_REV_BIG, e.planets, e.holes, e.extras, undefined, "expert");
    },
  },
  // Coral Pop bubbleRev 12 (the Strategy overhaul, 15 Nov 2026: the fast shot), appended so every earlier entry keeps its stream.
  { key: "bubble/fast", game: bubbleGameFor(BUB_REV_FAST), checkpoint: bubCheckpoint, mode: "events", rate: 15, encode: encodeBubbleRun, replay: (seed: number, raw: string) => replayBubbleRun(seed, raw, BUB_REV_FAST) },
  // Ball Tracker's levels (the Strategy overhaul stage 3, 15 Nov 2026: Easy, Hard and Expert courses from their own proved
  // lists, btRev 8), appended so every earlier entry keeps its stream.
  {
    key: "balltrack/easy",
    game: makeBallTrackGame(BT_EASY_DEAL[0]!, BT_REV_STD),
    gameFor: (seed: number) => makeBallTrackGame(BT_EASY_DEAL[seed % BT_EASY_DEAL.length]!, BT_REV_STD),
    checkpoint: btCheckpoint,
    mode: "events",
    rate: 30,
    encode: (run: any) => encodeBallTrackRun(BT_EASY_DEAL[run.seed % BT_EASY_DEAL.length]!, run, BT_REV_STD),
    replay: (seed: number, raw: string) => replayBallTrackRun(BT_EASY_DEAL[seed % BT_EASY_DEAL.length]!, seed, raw, BT_REV_STD),
  },
  {
    key: "balltrack/hard",
    game: makeBallTrackGame(BT_HARD_DEAL[0]!, BT_REV_STD),
    gameFor: (seed: number) => makeBallTrackGame(BT_HARD_DEAL[seed % BT_HARD_DEAL.length]!, BT_REV_STD),
    checkpoint: btCheckpoint,
    mode: "events",
    rate: 30,
    encode: (run: any) => encodeBallTrackRun(BT_HARD_DEAL[run.seed % BT_HARD_DEAL.length]!, run, BT_REV_STD),
    replay: (seed: number, raw: string) => replayBallTrackRun(BT_HARD_DEAL[seed % BT_HARD_DEAL.length]!, seed, raw, BT_REV_STD),
  },
  {
    key: "balltrack/expert",
    game: makeBallTrackGame(BT_EXPERT_DEAL[0]!, BT_REV_STD),
    gameFor: (seed: number) => makeBallTrackGame(BT_EXPERT_DEAL[seed % BT_EXPERT_DEAL.length]!, BT_REV_STD),
    checkpoint: btCheckpoint,
    mode: "events",
    rate: 30,
    encode: (run: any) => encodeBallTrackRun(BT_EXPERT_DEAL[run.seed % BT_EXPERT_DEAL.length]!, run, BT_REV_STD),
    replay: (seed: number, raw: string) => replayBallTrackRun(BT_EXPERT_DEAL[seed % BT_EXPERT_DEAL.length]!, seed, raw, BT_REV_STD),
  },
  // Gemstone matchupRev 13 (the Strategy overhaul stage 3, 15 Nov 2026: two-hit ice and levels), appended so every
  // earlier entry keeps its stream: Normal, Easy (five colours) and Expert (seven, the heart).
  { key: "matchup/ice2", game: matchupGameFor(MATCHUP_REV_ICE2), checkpoint: matchupCheckpoint, mode: "events", rate: 40, encode: encodeMatchupRun, replay: (seed: number, raw: string) => replayMatchupRun(seed, raw, MATCHUP_REV_ICE2) },
  { key: "matchup/ice2-easy", game: matchupGameFor(MATCHUP_REV_ICE2, "easy"), checkpoint: matchupCheckpoint, mode: "events", rate: 40, encode: encodeMatchupRun, replay: (seed: number, raw: string) => replayMatchupRun(seed, raw, MATCHUP_REV_ICE2, "easy") },
  { key: "matchup/ice2-expert", game: matchupGameFor(MATCHUP_REV_ICE2, "expert"), checkpoint: matchupCheckpoint, mode: "events", rate: 40, encode: encodeMatchupRun, replay: (seed: number, raw: string) => replayMatchupRun(seed, raw, MATCHUP_REV_ICE2, "expert") },
  // Tilt's Expert level (stage 3, 15 Nov 2026: tiltRev 12 at expert), appended so every earlier entry keeps its stream.
  { key: "tilt/expert", game: tiltLevelGame("expert"), checkpoint: tiltCheckpoint, mode: "events", rate: 500, encode: encodeTiltRun, replay: (seed: number, raw: string) => replayTiltRun(seed, raw, TILT_REV_BIG, "expert") },
  // Crazy Golf golfRev 3 (15 Nov 2026, the overhaul: the proven hole bank, chips, swells, levels), appended so every
  // earlier entry keeps its stream: seed n is course n (each slot's hole by a spread of n) at level n mod 4. The random
  // events include chips (kind 2).
  {
    key: "minigolf/v3",
    game: minigolfGameFor(...mgV3(0)),
    gameFor: (seed: number) => minigolfGameFor(...mgV3(seed)),
    seedFor: (n: number) => n,
    checkpoint: minigolfCheckpoint,
    mode: "events",
    rate: 40,
    encode: encodeMinigolfRun,
    replay: (seed: number, raw: string) => replayMinigolfRun(seed, raw, ...mgV3(seed)),
  },
  // Home Run homerunRev 5 (the innings) and Top Bins freekickRev 5 (the layered kick), 15 Nov 2026, at Normal on their
  // proved deals; appended so every earlier entry keeps its stream.
  { key: "homerun/v5", interval: HOMERUN_CHECKPOINT_INTERVAL, game: homerunGameFor(5), checkpoint: homerunCheckpoint, mode: "events", rate: 20, encode: encodeHomerunRun, replay: (seed: number, raw: string) => replayHomerunRun(seed, raw, 5), seedFor: (n: number) => homerunDealSeedV5(n) },
  { key: "freekick/v5", interval: FREEKICK_CHECKPOINT_INTERVAL, game: freekickGameFor(5), checkpoint: freekickCheckpoint, mode: "events", rate: 20, encode: encodeFreekickRun, replay: (seed: number, raw: string) => replayFreekickRun(seed, raw, 5), seedFor: (n: number) => freekickDealSeedV5(n) },
  // freekickRev 6 (16 Nov 2026: Easy and Normal eased, Hard and Expert harder) and both games' Expert (appended, never mid-list).
  { key: "freekick/v6", interval: FREEKICK_CHECKPOINT_INTERVAL, game: freekickGameFor(6), checkpoint: freekickCheckpoint, mode: "events", rate: 20, encode: encodeFreekickRun, replay: (seed: number, raw: string) => replayFreekickRun(seed, raw, 6), seedFor: (n: number) => freekickDealSeedV6(n) },
  { key: "freekick/v6-expert", interval: FREEKICK_CHECKPOINT_INTERVAL, game: freekickGameFor(6, "expert"), checkpoint: freekickCheckpoint, mode: "events", rate: 20, encode: encodeFreekickRun, replay: (seed: number, raw: string) => replayFreekickRun(seed, raw, 6, "expert"), seedFor: (n: number) => freekickDealSeedV6(n, "expert") },
  { key: "homerun/v5-expert", interval: HOMERUN_CHECKPOINT_INTERVAL, game: homerunGameFor(5, "expert"), checkpoint: homerunCheckpoint, mode: "events", rate: 20, encode: encodeHomerunRun, replay: (seed: number, raw: string) => replayHomerunRun(seed, raw, 5, "expert"), seedFor: (n: number) => homerunDealSeedV5(n, "expert") },
  // Apex racingRev 4 (15 Nov 2026, the Sports overhaul: three named circuits), appended at the end so every earlier
  // entry keeps its index and stream.
  { key: "racing/v4", interval: RACING_CHECKPOINT_INTERVAL, game: racingGameFor(RACING_REV_4), checkpoint: racingCheckpoint, mode: "events", rate: 120, encode: encodeRacingRun, replay: (seed: number, raw: string) => replayRacingRun(seed, raw, RACING_REV_4), seedFor: (n: number) => RACING_DEAL_V4[n % RACING_DEAL_V4.length]! },
  // Changed with Joe's approval, 22 Nov 2026: Minefield's D4 Hard and Expert (minesRev 6 and 7), appended so every earlier entry keeps its stream.
  { key: "minesweeper/hard-d4", game: minesweeperGameFor(MINES_REV_HARD_D4), checkpoint: minesCheckpoint, mode: "events", rate: 60, encode: encodeMinesweeperRun, replay: (seed: number, raw: string) => replayMinesweeperRun(seed, raw, MINES_REV_HARD_D4) }, // Changed with Joe's approval, 22 Nov 2026
  { key: "minesweeper/expert-d4", game: minesweeperGameFor(MINES_REV_EXPERT_D4), checkpoint: minesCheckpoint, mode: "events", rate: 60, encode: encodeMinesweeperRun, replay: (seed: number, raw: string) => replayMinesweeperRun(seed, raw, MINES_REV_EXPERT_D4) }, // Changed with Joe's approval, 22 Nov 2026
  // D5's entries (not yet on main) follow main's at the 27 Nov 2026 merge, so every entry already on main keeps its index and stream.
  // Changed with Joe's approval, 23 Nov 2026 (routine consequence of D5's five stamps): the entries below, appended in this order.
  // Moon Climb ricoRev 5 (22 Nov 2026, D5: the 30 × 60 ninja, Joe's approval of 20 Nov 2026), Normal and its three
  // levels, appended at the end so every earlier entry keeps its index and stream.
  { key: "ricochet/mid", interval: NINJA_CHECKPOINT_INTERVAL, game: moonGameFor(5), checkpoint: moonCheckpoint, mode: "events", rate: 30, encode: encodeMoonRun, replay: (seed: number, raw: string) => replayMoonRun(seed, raw, 5) },
  ...(["easy", "hard", "expert"] as const).map((lv) => ({ key: `ricochet/mid-${lv}`, interval: NINJA_CHECKPOINT_INTERVAL, game: moonGameFor(5, lv), checkpoint: moonCheckpoint, mode: "events" as const, rate: 30, encode: encodeMoonRun, replay: (seed: number, raw: string) => replayMoonRun(seed, raw, 5, lv) })),
  // Fission burstRev 14 (22 Nov 2026, D5: the middle atoms; Easy's atoms touch at their drawn size), at Normal and Easy,
  // appended at the end so every earlier entry keeps its index and stream.
  { key: "burst/small", game: burstGameFor(14), checkpoint: burstCheckpoint, mode: "events", rate: 120, encode: encodeBurstRun, replay: (seed: number, raw: string) => replayBurstRun(seed, raw, 14) },
  { key: "burst/small-easy", game: burstGameFor(14, "easy"), checkpoint: burstCheckpoint, mode: "events", rate: 120, encode: encodeBurstRun, replay: (seed: number, raw: string) => replayBurstRun(seed, raw, 14, "easy") },
  // Wavefront wavRev 16 (22 Nov 2026, D5: the wider formation), appended so every earlier entry keeps its stream.
  { key: "wavefront/wide", game: wavefrontGameFor(16), checkpoint: wavCheckpoint, mode: "events", rate: 300, encode: encodeWavefrontRun, replay: (seed: number, raw: string) => replayWavefrontRun(seed, raw, 16) },
  // High Rise skylineRev 12 (22 Nov 2026, D5 item I5: skylineRev 11's play, floors full at 45, perfect drops at 30) at
  // every level, appended at the end so every earlier entry keeps its index and stream.
  { key: "skyline/floors", game: skylineGameFor(12), checkpoint: skylineCheckpoint, mode: "taps", rate: 15, encode: encodeSkylineRun, replay: (seed: number, raw: string) => replaySkylineRun(seed, raw, 12) },
  ...(["easy", "hard", "expert"] as const).map((lv) => ({ key: `skyline/floors-${lv}`, game: skylineGameFor(12, lv), checkpoint: skylineCheckpoint, mode: "taps" as const, rate: 15, encode: encodeSkylineRun, replay: (seed: number, raw: string) => replaySkylineRun(seed, raw, 12, lv) })),
  // Orbit orbitRev 17 (22 Nov 2026, D5 item H4: the lost flight) at every level, random taps and checkpoints on each
  // level's bank (Normal's the fuel bank), appended at the end so every earlier entry keeps its stream.
  ...([["normal", ORBIT_FUEL_BANK], ["easy", ORBIT_FUEL_BANK_EASY], ["hard", ORBIT_FUEL_BANK_HARD], ["expert", ORBIT_FUEL_BANK_EXPERT]] as const).map(([lv, bank]) => ({
    key: `orbit/lost-${lv}`,
    game: orbitRev3Game,
    gameFor: (seed: number) => {
      const e = bank.find((x) => x.seed === seed)!;
      return { ...orbitRev3Game, init: () => initLostFrom(decodeRev3Planets(e.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(e.holes), decodeOrbitExtras(e.extras), lv === "normal" ? undefined : lv) };
    },
    seedFor: (n: number) => bank[n % bank.length]!.seed,
    checkpoint: orbitCheckpoint,
    mode: "events" as const,
    rate: 25,
    encode: encodeOrbitRun,
    replay: (seed: number, raw: string) => {
      const e = bank.find((x) => x.seed === seed)!;
      return replayOrbitRun(seed, raw, ORBIT_REV_LOST, e.planets, e.holes, e.extras, undefined, lv === "normal" ? undefined : lv);
    },
  })),
  // Grappler swingRev 19 (D5, 23 Nov 2026: the ladder), appended so every earlier entry keeps its index. Changed with Joe's approval, 26 Nov 2026.
  ...(["normal", "easy", "hard", "expert"] as const).map((lv) => ({ key: `swing/ladder-${lv}`, game: swingGameFor(SWING_REV_LADDER, lv), checkpoint: swingCheckpoint, mode: "events" as const, rate: 30, encode: encodeSwingRun, replay: (seed: number, raw: string) => replaySwingRun(seed, raw, SWING_REV_LADDER, undefined, lv), seedFor: (n: number) => SWING_LADDER_DEAL[lv][n % SWING_LADDER_DEAL[lv].length]! })), // Changed with Joe's approval, 26 Nov 2026
  // Changed with Joe's approval, 26 Nov 2026, second set: D5's six stamps, appended at the very end in this order so every earlier entry keeps its index.
  // Iron Wall bastionRev 5 (D5: the ladder) at every level.
  ...(["normal", "easy", "hard", "expert"] as const).map((level) => ({ key: `bastion/v5-${level}`, interval: BT2_CHECKPOINT_INTERVAL, game: bastionTankGameFor(5, level), checkpoint: bastionTankCheckpoint, mode: "events" as const, rate: 30, encode: encodeBastionTankRun, replay: (seed: number, raw: string) => replayBastionTankRun(seed, raw, 5, level) })), // Changed with Joe's approval, 26 Nov 2026
  // Tempo beatRev 13 (D5: the lanes ladder) at every level on its proved deals.
  ...(["normal", "easy", "hard", "expert"] as const).map((lv) => ({ key: `beat/lanes-${lv}`, game: beatGameFor(BEAT_REV_LANES, lv), checkpoint: beatCheckpoint, mode: "events" as const, rate: 200, encode: encodeBeatRun, replay: (seed: number, raw: string) => replayBeatRun(seed, raw, BEAT_REV_LANES, lv === "normal" ? null : lv), seedFor: (n: number) => BEAT_DEAL_V13[lv][n % BEAT_DEAL_V13[lv].length]! })), // Changed with Joe's approval, 26 Nov 2026
  // Blockzone blockfallRev 3 (D5: the levels) on their proved deals.
  ...(["easy", "hard", "expert"] as const).map((lv) => ({ key: `blockfall/levels-${lv}`, game: blockfallGameFor(BLOCKFALL_REV_LEVELS, lv), checkpoint: bfCheckpoint, mode: "events" as const, rate: 120, encode: encodeBlockfallRun, replay: (seed: number, raw: string) => replayBlockfallRun(seed, raw, BLOCKFALL_REV_LEVELS, lv), seedFor: (n: number) => BLOCKFALL_LEVEL_DEALS[lv][n % BLOCKFALL_LEVEL_DEALS[lv].length]! })), // Changed with Joe's approval, 26 Nov 2026
  // Wavefront wavRev 16 (D5: the wider formation) at its levels.
  ...(["easy", "hard", "expert"] as const).map((lv) => ({ key: `wavefront/wide-${lv}`, game: wavefrontGameFor(16, lv), checkpoint: wavCheckpoint, mode: "events" as const, rate: 300, encode: encodeWavefrontRun, replay: (seed: number, raw: string) => replayWavefrontRun(seed, raw, 16, lv) })), // Changed with Joe's approval, 26 Nov 2026
  // Fission burstRev 14 (D5: the smaller atoms) at Hard and Expert.
  ...(["hard", "expert"] as const).map((lv) => ({ key: `burst/small-${lv}`, game: burstGameFor(14, lv), checkpoint: burstCheckpoint, mode: "events" as const, rate: 120, encode: encodeBurstRun, replay: (seed: number, raw: string) => replayBurstRun(seed, raw, 14, lv) })), // Changed with Joe's approval, 26 Nov 2026
  // Hover hoverRev 12 (D5, 23 Nov 2026: Normal's fitted lines and the gap ladder), at Normal and Expert on their proved
  // deals; appended so every earlier entry keeps its stream.
  { key: "hover/fit", game: hoverGameFor(12), checkpoint: hoverCheckpoint, mode: "taps", rate: 60, encode: encodeHoverRun, replay: (seed: number, raw: string) => replayHoverRun(seed, raw, 12), seedFor: (n: number) => hoverLevelDealSeed("normal", n) }, // Changed with Joe's approval, 26 Nov 2026
  { key: "hover/fit-easy", game: hoverGameFor(12, "easy"), checkpoint: hoverCheckpoint, mode: "taps", rate: 60, encode: encodeHoverRun, replay: (seed: number, raw: string) => replayHoverRun(seed, raw, 12, "easy"), seedFor: (n: number) => hoverLevelDealSeed("easy", n) }, // Changed with Joe's approval, 26 Nov 2026
  { key: "hover/fit-expert", game: hoverGameFor(12, "expert"), checkpoint: hoverCheckpoint, mode: "taps", rate: 60, encode: encodeHoverRun, replay: (seed: number, raw: string) => replayHoverRun(seed, raw, 12, "expert"), seedFor: (n: number) => hoverLevelDealSeed("expert", n) }, // Changed with Joe's approval, 26 Nov 2026
  // Spacewalk crossRev 14 (D5, 23 Nov 2026: the traffic ladder from the first crossing), Hard and Expert on their proved
  // deals; appended so every earlier entry keeps its stream.
  { key: "cross/dense-hard", game: crossGameFor(14, "hard"), checkpoint: crossCheckpoint, mode: "events", rate: 60, encode: encodeCrossRun, replay: (seed: number, raw: string) => replayCrossRun(seed, raw, 14, "hard"), seedFor: (n: number) => crossLevelDealSeed("hard", n) }, // Changed with Joe's approval, 26 Nov 2026
  { key: "cross/dense-expert", game: crossGameFor(14, "expert"), checkpoint: crossCheckpoint, mode: "events", rate: 60, encode: encodeCrossRun, replay: (seed: number, raw: string) => replayCrossRun(seed, raw, 14, "expert"), seedFor: (n: number) => crossLevelDealSeed("expert", n) }, // Changed with Joe's approval, 26 Nov 2026
  // Meteor snakeRev 16 and Rally rallyRev 14 (D5: the ladders), at Normal and Expert. Changed with Joe's approval, 26 Nov 2026.
  { key: "snake/ladder", game: snakeGameFor(16), checkpoint: snakeCheckpoint, mode: "events", rate: 60, encode: encodeSnakeRun, replay: (seed: number, raw: string) => replaySnakeRun(seed, raw, 16) }, // Changed with Joe's approval, 26 Nov 2026
  { key: "snake/ladder-expert", game: snakeGameFor(16, "expert"), checkpoint: snakeCheckpoint, mode: "events", rate: 60, encode: encodeSnakeRun, replay: (seed: number, raw: string) => replaySnakeRun(seed, raw, 16, "expert") }, // Changed with Joe's approval, 26 Nov 2026
  { key: "rally/ladder", game: rallyGameFor(14), checkpoint: rallyCheckpoint, mode: "events", rate: 120, encode: encodeRallyRun, replay: (seed: number, raw: string) => replayRallyRun(seed, raw, 14) }, // Changed with Joe's approval, 26 Nov 2026
  { key: "rally/ladder-expert", game: rallyGameFor(14, "expert"), checkpoint: rallyCheckpoint, mode: "events", rate: 120, encode: encodeRallyRun, replay: (seed: number, raw: string) => replayRallyRun(seed, raw, 14, "expert") }, // Changed with Joe's approval, 26 Nov 2026
  // Changed with Joe's approval, 27 Nov 2026: D5's orbitRev 17, brkRev 13, pinRev 9, skylineRev 12 and flipRev 14, appended at the very end in this order so every earlier entry keeps its index.
  // Orbit orbitRev 17 (D5: the ladder banks) at every level, random taps and checkpoints on each level's ladder bank.
  ...(["normal", "easy", "hard", "expert"] as const).map((lv) => ({
    key: lv === "normal" ? "orbit/ladder" : `orbit/ladder-${lv}`,
    game: orbitRev3Game,
    gameFor: (seed: number) => {
      const e = ORBIT_LADDER_BANKS[lv].find((x) => x.seed === seed)!;
      return { ...orbitRev3Game, init: () => initLostFrom(decodeRev3Planets(e.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(e.holes), decodeOrbitExtras(e.extras), lv === "normal" ? undefined : lv) };
    },
    seedFor: (n: number) => ORBIT_LADDER_BANKS[lv][n % ORBIT_LADDER_BANKS[lv].length]!.seed,
    checkpoint: orbitCheckpoint,
    mode: "events" as const,
    rate: 25,
    encode: encodeOrbitRun,
    replay: (seed: number, raw: string) => {
      const e = ORBIT_LADDER_BANKS[lv].find((x) => x.seed === seed)!;
      return replayOrbitRun(seed, raw, ORBIT_REV_LOST, e.planets, e.holes, e.extras, undefined, lv === "normal" ? undefined : lv);
    },
  })), // Changed with Joe's approval, 27 Nov 2026
  // Breaker brkRev 13 and Pinball pinRev 9 (D5: the ladders), at Normal and Expert on their level deals.
  { key: "breaker/ladder", game: breakerGameFor(BRK_REV_LADDER), checkpoint: brkCheckpoint, mode: "events", rate: 950, encode: encodeBreakerRun, replay: (seed: number, raw: string) => replayBreakerRun(seed, raw, BRK_REV_LADDER), seedFor: (n: number) => breakerLevelDealSeed("normal", n) }, // Changed with Joe's approval, 27 Nov 2026
  { key: "breaker/ladder-expert", game: breakerGameFor(BRK_REV_LADDER, "expert"), checkpoint: brkCheckpoint, mode: "events", rate: 950, encode: encodeBreakerRun, replay: (seed: number, raw: string) => replayBreakerRun(seed, raw, BRK_REV_LADDER, "expert"), seedFor: (n: number) => breakerLevelDealSeed("expert", n) }, // Changed with Joe's approval, 27 Nov 2026
  { key: "pinball/ladder", game: pinball9For(), checkpoint: pin4Checkpoint, mode: "events", rate: 120, encode: encodePinballRun, replay: (seed: number, raw: string) => replayPinballRun(seed, raw, PIN_REV_LADDER), seedFor: (n: number) => pinballLevelDealSeed("normal", n) }, // Changed with Joe's approval, 27 Nov 2026
  { key: "pinball/ladder-expert", game: pinball9For("expert"), checkpoint: pin4Checkpoint, mode: "events", rate: 120, encode: encodePinballRun, replay: (seed: number, raw: string) => replayPinballRun(seed, raw, PIN_REV_LADDER, "expert"), seedFor: (n: number) => pinballLevelDealSeed("expert", n) }, // Changed with Joe's approval, 27 Nov 2026
  // High Rise skylineRev 12 (D5: the refit level lines) at its levels on their proved deals.
  ...(["easy", "hard", "expert"] as const).map((level) => ({ key: `skyline/v12-${level}`, game: skylineGameFor(12, level), checkpoint: skylineCheckpoint, mode: "taps" as const, rate: 15, encode: encodeSkylineRun, replay: (seed: number, raw: string) => replaySkylineRun(seed, raw, 12, level), seedFor: (n: number) => SKYLINE_V12_DEAL[level][n % SKYLINE_V12_DEAL[level].length]! })), // Changed with Joe's approval, 27 Nov 2026
  // Roofbound flipRev 14 (D5: the running-speed ladder) at its levels on their proved deals.
  ...(["easy", "hard", "expert"] as const).map((level) => ({ key: `flip/v14-${level}`, game: flipGameFor(14, level), checkpoint: flipCheckpoint, mode: "events" as const, rate: 50, encode: encodeFlipRun, replay: (seed: number, raw: string) => replayFlipRun(seed, raw, 14, level), seedFor: (n: number) => FLIP_LADDER_DEALS[level][n % FLIP_LADDER_DEALS[level].length]! })), // Changed with Joe's approval, 27 Nov 2026
];

/** golfRev 3's course for a self-replay seed: each slot's hole by a spread of the seed, the level seed mod 4. */
function mgV3(seed: number): [number[], number, { holes: number[]; level: (typeof MG_LEVEL_NAMES)[number] }] {
  const level = MG_LEVEL_NAMES[Math.abs(seed) % 4]!;
  const picks = MINIGOLF_HOLES_BANK.map((slot, i) => slot[(Math.abs(seed) * 7 + i * 31) % slot.length]!);
  return [picks.map((e) => e.pars[MG_LEVEL_NAMES.indexOf(level)]!), 3, { holes: picks.map((e) => e.id), level }];
}

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
  // Grappler's swinging course (29 Oct 2026, swing/rework: 3.9 s at 40 runs locally).
  144: 3.9,
  // The 1 Nov 2026 tuning's Cue Ball poolRev 3 (pool/v3: 29.2 s at 40 runs locally).
  184: 29.2,
  // Cue Ball poolRev 4 (3 Nov 2026, pool/v4: 17.0 s at 40 runs locally).
  202: 17.0,
  // Changed with Joe's approval, 27 Nov 2026 (routine consequence of D5's ladder entries): every entry over 1.5 s that
  // wasn't listed, measured locally at 40 runs on polish/d5 afad946e, so the three parts balance (~180–220 s each here).
  113: 2.6, 114: 2.8, 130: 7.5, 131: 4.9, 132: 3.2, 138: 1.9, 140: 2.0, 141: 3.9, 142: 4.9, 152: 1.6,
  159: 5.2, 161: 9.8, 162: 4.5, 172: 16.0, 181: 17.7, 186: 16.4, 197: 6.8, 204: 12.4, 209: 12.0, 210: 6.3,
  211: 8.8, 212: 8.8, 219: 37.7, 221: 4.4, 222: 12.5, 234: 1.8, 240: 18.1, 242: 1.8, 247: 4.1, 249: 15.5,
  257: 10.7, 258: 13.1, 259: 14.0, 279: 2.6, 295: 13.5, 296: 9.6, 297: 11.7, 298: 17.7, 318: 5.5, 319: 5.1,
  330: 2.1, 335: 2.1, 336: 9.1, 337: 35.6,
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
      if (state.tick % (spec.interval ?? INTERVAL) === 0) checkpoints.push(spec.checkpoint(state));
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
