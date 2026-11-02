import { NINJA_REV } from "@/lib/arcade/ricochetNinja";
import { TEN_DROP_DEPTH_REV } from "@/lib/arcade/tenDrop";
import { SLICE_REV_TARGET, SLICE_REV_STRICT, SLICE_REV_STANDARD } from "@/lib/arcade/slice";
import { FLIP_REV_TARGET, FLIP_REV_STRICT, FLIP_REV_STD } from "@/lib/arcade/flip";
import { CROSS_REV_STD } from "@/lib/arcade/cross";
import { INK_REV_STD } from "@/lib/arcade/inkBridge";
import { SNAKE_REV_TARGET, SNAKE_REV_STD } from "@/lib/arcade/snake";
import { BUB_REV_STD } from "@/lib/arcade/bubble";
import { MATCHUP_REV_STD } from "@/lib/arcade/matchup";
import { minesBoard, minesSolve, MINES_REV_STD } from "@/lib/arcade/minesweeper";
import { mahjongBuildClears, MAHJONG_REV_DEALT } from "@/lib/arcade/mahjong";
import { SNIP_REV_TARGET, SNIP_REV_EXPAND } from "@/lib/arcade/snip";
import { SKYLINE_REV_TARGET, SKYLINE_REV_STRICT, SKYLINE_REV_STD } from "@/lib/arcade/skyline";
import { TILT_REV_STD } from "@/lib/arcade/tilt";
import { TILT_BANK } from "./tiltBank.server";
import { JUNC_REV_BAND } from "@/lib/arcade/junction";
import { BINTOSS_REV_TARGET, BINTOSS_REV_STRICT, BINTOSS_REV_STD } from "@/lib/arcade/binToss";
import { SWING_REV_TALL, SWING_REV_TARGET, SWING_REV_STRICT, SWING_REV_EXPAND, SWING_REV_ASSAULT, SWING_REV_REWORK } from "@/lib/arcade/swing";
import { BURST_REV_TARGET, BURST_REV_STRICT, BURST_REV_STD } from "@/lib/arcade/burst";
import { BRK_REV_TARGET, BRK_REV_STRICT, BRK_REV_DEEP, BRK_REV_PHONE, BRK_REV_STD } from "@/lib/arcade/breaker";
import { PIN_REV_TARGET, PIN_REV_STRICT, PIN_REV_EXPAND, PIN_REV_LONG, PIN_REV_STD } from "@/lib/arcade/pinball";
import { WHACK_REV_DEPTH, WHACK_REV_NOTES } from "@/lib/arcade/whack";
import { dealtNotesRev } from "./phoneNotes";
import { WAV_REV_TARGET, WAV_REV_STRICT, WAV_REV_STD } from "@/lib/arcade/wavefront";
import { ORBIT_REV_TARGET, ORBIT_REV_STRICT, ORBIT_REV_STD } from "@/lib/arcade/orbit";
import { RALLY_REV_TARGET, RALLY_REV_STRICT, RALLY_REV_STD } from "@/lib/arcade/rally";
import { BEAT_REV_TARGET, BEAT_REV_STD } from "@/lib/arcade/beat";
import { orbitXpCourseForSeed, orbitHolesForBankSeed, orbitRev3BankEntryForSeed, orbitRev3PlanetsForSeed, encodeRev3Planets } from "./orbitRev3Course.server";
import { proveSwingSeed } from "./swingProof.server";
import { SWING_V9_BANK } from "./swingBankV9.server";
import { SWING_V13_BANK } from "./swingBankV13.server";
import { CLAY_REV_DEPTH } from "@/lib/arcade/clayShoot";
import { WORDFALL_REV_BANDS } from "@/lib/arcade/wordfall";
import { dealtTopupRev } from "./depthTopup";
import { CLASH_QUEUE, CLASH_REV_TALL, CLASH_REV_DEPTH, CLASH_REV_TOPUP } from "@/lib/arcade/colourClash";
/**
 * Server-only seeds for the arcade rounds. One seed per round drives the whole
 * course, so everyone in the room plays the identical run; practice draws a
 * fresh seed each time it starts a round.
 */

import { randomBelow } from "./random";
import { FC_REV } from "@/lib/arcade/cards/freecell";
import { FC_DEALS } from "@/lib/arcade/cards/freecellDeals.data";
import { TP_REV } from "@/lib/arcade/cards/tripeaks";
import { TP_DEALS } from "@/lib/arcade/cards/tripeaksDeals.data";
import { PS_REV } from "@/lib/arcade/cards/pokerSquares";
import { FH_REV } from "@/lib/arcade/cards/fiveHands";
import { BLOCKFALL_REV } from "@/lib/arcade/blockfall";
import { blockfallDealSeed } from "./blockfallDeal.server";
import type { BlockfallPuzzleData, FiveHandsPuzzleData, FreecellPuzzleData, PokerSquaresPuzzleData, TripeaksPuzzleData } from "./types";
import { bullseyeWinds, BULLSEYE_REV_TARGET, BULLSEYE_REV_STRICT, BULLSEYE_REV_STD } from "@/lib/arcade/bullseye";
import type {
  BinTossPuzzleData,
  BullseyePuzzleData,
  MatchupPuzzleData,
  CrossPuzzleData,
  DualPuzzleData,
  RicoPuzzleData,
  SkylinePuzzleData,
  SnakePuzzleData,
  SwervePuzzleData,
  BreakerPuzzleData,
  PinballPuzzleData,
  MinesweeperPuzzleData,
  MahjongPuzzleData,
  RallyPuzzleData,
  SteadyPuzzleData,
  SlicePuzzleData,
  BubblePuzzleData,
  BeatPuzzleData,
  WhackPuzzleData,
  TenDropPuzzleData,
  WordfallPuzzleData,
  ClayShootPuzzleData,
  WavefrontPuzzleData,
  BastionPuzzleData,
  RooftopPuzzleData,
  FlipPuzzleData,
  JunctionPuzzleData,
  InkBridgePuzzleData,
  BurstPuzzleData,
  OrbitPuzzleData,
  SwingPuzzleData,
  SnipPuzzleData,
  TiltPuzzleData,
  HotFloorPuzzleData,
  StroopPuzzleData,
} from "./types";

/** A fresh 32-bit seed from the platform CSPRNG. */
export function arcadeSeed(): number {
  return randomBelow(0x7fff_ffff) + 1;
}

/* Cards & Board (30 Oct 2026): the arcade scoring standard from revision 1. */

/** FreeCell: a bank deal (its index), proved solvable with a known par. */
export function generateFreecell(): FreecellPuzzleData {
  return { type: "freecell", seed: randomBelow(FC_DEALS.length), freecellRev: FC_REV };
}

/** TriPeaks: a bank deal (its index), proved clearable with a run of ten. */
export function generateTripeaks(): TripeaksPuzzleData {
  return { type: "tripeaks", seed: randomBelow(TP_DEALS.length), tripeaksRev: TP_REV };
}

/** Poker Squares: any seed; the sim builds the target grid and dealing order from it. */
export function generatePokerSquares(): PokerSquaresPuzzleData {
  return { type: "pokersquares", seed: arcadeSeed(), pokerSquaresRev: PS_REV };
}

/** Five Hands: any seed; the sim shuffles the deck and proves its witness (perfect play reaches 200). */
export function generateFiveHands(): FiveHandsPuzzleData {
  return { type: "fivehands", seed: arcadeSeed(), fiveHandsRev: FH_REV };
}

/** Blockfall (Retro, 1 Nov 2026): a seed from the proved deal (the oracle took it to 200 through the server replay). */
export function generateBlockfall(): BlockfallPuzzleData {
  return { type: "blockfall", seed: blockfallDealSeed(arcadeSeed()), blockfallRev: BLOCKFALL_REV };
}

export function generateSwerve(): SwervePuzzleData {
  return { type: "swerve", seed: arcadeSeed() };
}

export function generateSkyline(): SkylinePuzzleData {
  // skylineRev 9: skylineRev 8's play on the arcade scoring standard (29 Oct 2026, docs/arcade-standard/skyline.md).
  return { type: "skyline", seed: arcadeSeed(), skylineRev: SKYLINE_REV_STD };
}

export function generateBinToss(): BinTossPuzzleData {
  // binRev 9: binRev 8's play with exactly three hoops, scored on the arcade standard (docs/arcade-standard/bintoss.md).
  return { type: "bintoss", seed: arcadeSeed(), binRev: BINTOSS_REV_STD };
}

export function generateBullseye(): BullseyePuzzleData {
  const seed = arcadeSeed();
  return { type: "bullseye", seed, winds: bullseyeWinds(seed), bullRev: BULLSEYE_REV_STD };
}

export function generateMatchup(): MatchupPuzzleData {
  // matchupRev 10 (27 Oct 2026, phone-test notes): matchupRev 9's taller board with goals, ice and treasure, over 90 s,
  // with swaps into and out of ice that make a line, and the ice laid once. matchupRev 11 (the arcade scoring standard,
  // docs/arcade-standard/matchup.md): four treasures that may swap with a gem that then makes a line, four goal
  // levels, and the score as fixed parts to 200.
  return { type: "matchup", seed: arcadeSeed(), matchupRev: MATCHUP_REV_STD };
}

export function generateSnake(): SnakePuzzleData {
  // snakeRev 10 (Joe's phone notes, 27 Oct 2026): longer gold stars, a third wormhole pair, a second vertical lane, 2 × 2 rocks.
  // snakeRev 11 (the arcade scoring standard, 29 Oct 2026): snakeRev 10's play, scored in straight-line parts to 200.
  return { type: "snake", seed: arcadeSeed(), snakeRev: SNAKE_REV_STD };
}

export function generateCross(): CrossPuzzleData {
  return { type: "cross", seed: arcadeSeed(), crossRev: CROSS_REV_STD };
}

export function generateDual(): DualPuzzleData {
  return { type: "dual", seed: arcadeSeed() };
}

/** Ricochet deals the ninja wall-climb (ricoRev 2, 1 Nov 2026); unstamped rounds keep the old shaft. */
export function generateRicochet(): RicoPuzzleData {
  return { type: "ricochet", seed: arcadeSeed(), ricoRev: NINJA_REV };
}

export function generateBreaker(): BreakerPuzzleData {
  // brkRev 10 (phone notes, 27 Oct 2026): brkRev 9 with gold bricks broken by any 4 hits and a second double-ball brick.
  // brkRev 11 (the arcade scoring standard, 29 Oct 2026): brkRev 10's play scored in fixed parts to 200.
  return { type: "breaker", seed: arcadeSeed(), brkRev: BRK_REV_STD };
}

export function generatePinball(): PinballPuzzleData {
  // pinRev 5 (27 Oct 2026, Joe's phone notes): pinRev 4's table for 90 s (PIN_REV_LONG).
  // pinRev 6 (29 Oct 2026): pinRev 5's play on the arcade scoring standard (docs/arcade-standard/pinball.md).
  return { type: "pinball", seed: arcadeSeed(), pinRev: PIN_REV_STD };
}

/**
 * Cards & Board (30 Oct 2026). Minesweeper deals its board in the sim from the seed, always one the logic solver clears
 * from its opening; a seed whose tries all failed (it would fall back to MINES_FALLBACK_SEED's board) is dropped here,
 * so every dealt seed is proved by its own solve (minesweeper-check plays each proof to 200).
 */
export function generateMinesweeper(): MinesweeperPuzzleData {
  for (;;) {
    const seed = arcadeSeed();
    const board = minesBoard(seed);
    if (board.tries >= 0 && minesSolve(board.mines, board.start).solved) return { type: "minesweeper", seed, minesRev: MINES_REV_STD };
  }
}

/**
 * Mahjong Solitaire deals its faces in the sim by building the stack backwards; the build's own order is the proof it
 * clears, checked here before the seed is dealt (mahjong-check plays it to 200).
 */
export function generateMahjong(): MahjongPuzzleData {
  for (;;) {
    const seed = arcadeSeed();
    if (mahjongBuildClears(seed)) return { type: "mahjong", seed, mahjongRev: MAHJONG_REV_DEALT };
  }
}

export function generateRally(): RallyPuzzleData {
  return { type: "rally", seed: arcadeSeed(), rallyRev: RALLY_REV_STD };
}

export function generateSteady(): SteadyPuzzleData {
  return { type: "steady", seed: arcadeSeed() };
}

export function generateSlice(): SlicePuzzleData {
  // sliceRev 10: sliceRev 9 (expansion E5) with onions and golden fruit 1.2× the size (Joe's phone notes, 27 Oct 2026).
  // sliceRev 11: sliceRev 10's play on the arcade scoring standard (29 Oct 2026, docs/arcade-standard/slice.md).
  return { type: "slice", seed: arcadeSeed(), sliceRev: SLICE_REV_STANDARD };
}

export function generateBubble(): BubblePuzzleData {
  // bubbleRev 9: bubbleRev 8's deeper reef (expansion E6) with credit for bubbles burst (no zero for a played run).
  // bubbleRev 10 (phone notes, 27 Oct 2026): bubbleRev 9 with the mine's bigger blast (two rings).
  // bubbleRev 11 (the arcade scoring standard, 29 Oct 2026): the mine pops the 4 nearest bubbles; scored on the standard.
  return { type: "bubble", seed: arcadeSeed(), bubbleRev: BUB_REV_STD };
}

export function generateBeat(): BeatPuzzleData {
  // beatRev 10 (phone notes, 27 Oct 2026): beatRev 9's song with wider windows and a lighter chart, easiest from the fifth lane.
  // beatRev 11 (the arcade scoring standard, 29 Oct 2026): beatRev 10's play scored on the standard (docs/arcade-standard/beat.md).
  return { type: "beat", seed: arcadeSeed(), beatRev: BEAT_REV_STD };
}

export function generateTenDrop(): TenDropPuzzleData {
  return { type: "tendrop", seed: arcadeSeed(), tenRev: TEN_DROP_DEPTH_REV };
}

/** Letterfall: the seed draws the letter queue and drop columns; stamped WORDFALL_REV_BANDS (3: rev-2 play on the score bands) and speed-par 1. */
export function generateWordfall(): WordfallPuzzleData {
  return { type: "wordfall", seed: arcadeSeed(), wordfallRev: WORDFALL_REV_BANDS, speedPar: 1 };
}

export function generateClayShoot(): ClayShootPuzzleData {
  return { type: "clayshoot", seed: arcadeSeed(), clayRev: CLAY_REV_DEPTH };
}

export function generateWhack(): WhackPuzzleData {
  // Joe's phone notes (27 Oct 2026): whackRev 4, whackRev 3 with the diamond up 450 ms instead of 300 ms.
  return { type: "whack", seed: arcadeSeed(), whackRev: dealtNotesRev(WHACK_REV_NOTES, WHACK_REV_DEPTH) };
}

export function generateWavefront(): WavefrontPuzzleData {
  // wavRev 11 (Joe's phone notes, 27 Oct 2026): power-ups from carrier ships and saucers, no streak, the mothership after wave 5.
  // wavRev 12 (the arcade scoring standard, 29 Oct 2026): wavRev 11 play scored in fixed parts that total 200.
  return { type: "wavefront", seed: arcadeSeed(), wavRev: WAV_REV_STD };
}

export function generateBastion(): BastionPuzzleData {
  return { type: "bastion", seed: arcadeSeed() };
}

export function generateRooftop(): RooftopPuzzleData {
  return { type: "rooftop", seed: arcadeSeed() };
}

export function generateColourClash(): StroopPuzzleData {
  return { type: "stroop", seed: arcadeSeed(), queue: CLASH_QUEUE, clashRev: dealtTopupRev(CLASH_REV_TOPUP, CLASH_REV_DEPTH) };
}

export function generateFlip(): FlipPuzzleData {
  // flipRev 9: flipRev 8's taller cave, features and sweet spots (expansion E7, docs/expansions/x200-flip.md), scored to 200
  // on the lifted curves (Joe's phone notes, 27 Oct 2026). flipRev 10 (29 Oct 2026): the same play on the arcade scoring
  // standard (time survived 150, gold stars 15, star trails 15, sweet landings 10, double flips 10; docs/arcade-standard/flip.md).
  return { type: "flip", seed: arcadeSeed(), flipRev: FLIP_REV_STD };
}

export function generateJunction(): JunctionPuzzleData {
  return { type: "junction", seed: arcadeSeed(), junctionRev: JUNC_REV_BAND };
}

export function generateInkBridge(): InkBridgePuzzleData {
  // inkRev 11 (phone notes, 27 Oct 2026): no wind zones, fewer silver coins, the pickups spread out.
  // inkRev 12 (the arcade scoring standard, 29 Oct 2026): inkRev 11's play scored on straight lines and fixed shares.
  return { type: "inkbridge", seed: arcadeSeed(), inkRev: INK_REV_STD };
}

export function generateBurst(): BurstPuzzleData {
  // burstRev 9 (phone-test notes, docs/phone-notes-oct-2026/fission.md): power-ups carried by seeded atoms, a bouncing golden atom, BURST shots, the wave-clear bonus.
  // burstRev 10 (the arcade scoring standard, docs/arcade-standard/burst.md): five waves, the golden atom hurts, straight-line parts to 200.
  return { type: "burst", seed: arcadeSeed(), burstRev: BURST_REV_STD };
}

export function generateOrbit(): OrbitPuzzleData {
  const seed = arcadeSeed();
  // Rev 12 (the expansion to 200, 26 Oct 2026): one of the bank courses with proved holes and features
  // (scripts/orbit-xp-bank.ts), picked by the seed, in the bigger view. Every room deals it while the bank has courses.
  const xp = orbitXpCourseForSeed(seed);
  // Rev 13 (the arcade scoring standard, 29 Oct 2026): rev 12's course, features and play, scored on the standard.
  if (xp) return { type: "orbit", seed, orbitRev: ORBIT_REV_STD, planets: xp.planets, holes: xp.holes, extras: xp.extras };
  // Rev 3 only from the proved bank: live proof is too slow for a room start, so an empty bank keeps rev 2.
  const bankPlanets = orbitRev3PlanetsForSeed(seed);
  if (!bankPlanets) return { type: "orbit", seed };
  // Rev 6 (Tuning A): the rev-5 band rules with the course's proved black holes
  // (scripts/orbit-hole-bank.ts), or none, plus the 1 s fly-in after a hole and a quicker end to a miss.
  // Rev 7 (Tuning F): the same with swept black holes (every hole ahead swallows the rocket's whole body).
  // Rev 8 (taller worlds, batch 3): rev-7 play framed in a taller 390 × 650 view.
  const bankSeed = orbitRev3BankEntryForSeed(seed)?.seed;
  const holes = bankSeed === undefined ? null : orbitHolesForBankSeed(bankSeed);
  return { type: "orbit", seed, orbitRev: ORBIT_REV_STRICT, planets: encodeRev3Planets(bankPlanets), holes: holes ?? [] };
}

export function generateSnip(): SnipPuzzleData {
  return { type: "snip", seed: arcadeSeed(), snipRev: SNIP_REV_EXPAND };
}

/**
 * swingRev 15 (29 Oct 2026, the swinging course) and swingRev 14 (27 Oct 2026, the assault course) need no bank: its sim builds every section from the seed and proves it
 * as it goes. Before it (pinSwingPreAssault): room/practice generation picks a proved course from the bank by the room
 * seed; on-the-spot proving is only a fallback if the bank is empty or unlucky.
 * swingRev 8 (Tuning F) only moves the touch stars, which never steer or end a run, so any input log plays a course the same on rev 7 and rev 8 (swing-rev8-check).
 */
let swingPreAssault = false;
/**
 * Checks written for swingRev 13 (the 200 expansion) and earlier: deal the bank courses rooms dealt before the
 * assault course (returns the previous setting), so they keep proving what they were written for.
 */
export function pinSwingPreAssault(on: boolean): boolean {
  const prev = swingPreAssault;
  swingPreAssault = on;
  return prev;
}

let swingPreRework = false;
/**
 * Checks written for swingRev 14 (the assault course): deal it as rooms did before the swinging course (returns the
 * previous setting), so they keep proving what they were written for.
 */
export function pinSwingPreRework(on: boolean): boolean {
  const prev = swingPreRework;
  swingPreRework = on;
  return prev;
}

export function generateSwing(): SwingPuzzleData {
  const roomSeed = arcadeSeed();
  // swingRev 15 (the swinging course) and 14 (the assault course): any seed; the course is built and proved from it in the sim.
  if (!swingPreAssault && !swingPreRework) return { type: "swing", seed: roomSeed, swingRev: SWING_REV_REWORK };
  if (!swingPreAssault) return { type: "swing", seed: roomSeed, swingRev: SWING_REV_ASSAULT };
  // swingRev 13 (the 200 expansion): from the bank courses re-proved with every feature (scripts/swing-bank.ts --expand).
  if (SWING_V13_BANK.length > 0) {
    const index = ((roomSeed % SWING_V13_BANK.length) + SWING_V13_BANK.length) % SWING_V13_BANK.length;
    return { type: "swing", seed: SWING_V13_BANK[index]!.seed, swingRev: SWING_REV_EXPAND };
  }
  // swingRev 9 (taller worlds, batch 3): from the bank courses re-proved on the taller cavern (scripts/swing-bank.ts --tall).
  if (SWING_V9_BANK.length > 0) {
    const index = ((roomSeed % SWING_V9_BANK.length) + SWING_V9_BANK.length) % SWING_V9_BANK.length;
    return { type: "swing", seed: SWING_V9_BANK[index]!.seed, swingRev: SWING_REV_STRICT };
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const seed = attempt === 0 ? roomSeed : arcadeSeed();
    if (proveSwingSeed(seed, SWING_REV_TALL)) return { type: "swing", seed, swingRev: SWING_REV_STRICT };
  }
  throw new Error("Could not verify a safe Grappler course; try again.");
}

export function generateTilt(): TiltPuzzleData {
  // tiltRev 9: tiltRev 8's play (the expansion) on the lifted curves (Joe's phone notes, 27 Oct 2026). A seed from the
  // bank (TILT_BANK, scripts/tilt-bank.ts): every maze fully dealt (tiltDealableX) and played to 200 by the oracle
  // through the server's replay (tilt-expand-check replays each).
  // tiltRev 10 (the arcade scoring standard, 29 Oct 2026): the same bank; mazes 1–3 are tiltRev 9's less the quick stars,
  // and the fourth maze is carved from the seed in the sim (a spanning tree, so always passable; tilt-standard-check).
  const pick = arcadeSeed();
  const seed = TILT_BANK[((pick % TILT_BANK.length) + TILT_BANK.length) % TILT_BANK.length]!;
  return { type: "tilt", seed, tiltRev: TILT_REV_STD };
}

export function generateHotFloor(): HotFloorPuzzleData {
  return { type: "hotfloor", seed: arcadeSeed() };
}
