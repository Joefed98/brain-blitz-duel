import { TEN_DROP_DEPTH_REV } from "@/lib/arcade/tenDrop";
import { SLICE_REV_TARGET, SLICE_REV_STRICT, SLICE_REV_EXPAND } from "@/lib/arcade/slice";
import { FLIP_REV_TARGET, FLIP_REV_STRICT, FLIP_REV_LIFT } from "@/lib/arcade/flip";
import { CROSS_REV_EXPAND } from "@/lib/arcade/cross";
import { INK_REV_EXPAND } from "@/lib/arcade/inkBridge";
import { SNAKE_REV_TARGET, SNAKE_REV_200 } from "@/lib/arcade/snake";
import { BUB_REV_CREDIT } from "@/lib/arcade/bubble";
import { MATCHUP_REV_GOALS } from "@/lib/arcade/matchup";
import { SNIP_REV_TARGET, SNIP_REV_EXPAND } from "@/lib/arcade/snip";
import { SKYLINE_REV_TARGET, SKYLINE_REV_STRICT, SKYLINE_REV_EXPAND } from "@/lib/arcade/skyline";
import { TILT_REV_LIFT } from "@/lib/arcade/tilt";
import { TILT_BANK } from "./tiltBank.server";
import { JUNC_REV_BAND } from "@/lib/arcade/junction";
import { BINTOSS_REV_TARGET, BINTOSS_REV_STRICT, BINTOSS_REV_EXPAND } from "@/lib/arcade/binToss";
import { SWING_REV_TALL, SWING_REV_TARGET, SWING_REV_STRICT, SWING_REV_EXPAND } from "@/lib/arcade/swing";
import { BURST_REV_TARGET, BURST_REV_STRICT, BURST_REV_CLEAN } from "@/lib/arcade/burst";
import { BRK_REV_TARGET, BRK_REV_STRICT, BRK_REV_DEEP } from "@/lib/arcade/breaker";
import { PIN_REV_TARGET, PIN_REV_STRICT, PIN_REV_EXPAND } from "@/lib/arcade/pinball";
import { WHACK_REV_DEPTH } from "@/lib/arcade/whack";
import { WAV_REV_TARGET, WAV_REV_STRICT, WAV_REV_EXPAND } from "@/lib/arcade/wavefront";
import { ORBIT_REV_TARGET, ORBIT_REV_STRICT, ORBIT_REV_XP } from "@/lib/arcade/orbit";
import { RALLY_REV_TARGET, RALLY_REV_STRICT, RALLY_REV_BONUS } from "@/lib/arcade/rally";
import { BEAT_REV_TARGET, BEAT_REV_200 } from "@/lib/arcade/beat";
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
import { bullseyeWinds, BULLSEYE_REV_TARGET, BULLSEYE_REV_STRICT, BULLSEYE_REV_EXPAND } from "@/lib/arcade/bullseye";
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

export function generateSwerve(): SwervePuzzleData {
  return { type: "swerve", seed: arcadeSeed() };
}

export function generateSkyline(): SkylinePuzzleData {
  return { type: "skyline", seed: arcadeSeed(), skylineRev: SKYLINE_REV_EXPAND };
}

export function generateBinToss(): BinTossPuzzleData {
  return { type: "bintoss", seed: arcadeSeed(), binRev: BINTOSS_REV_EXPAND };
}

export function generateBullseye(): BullseyePuzzleData {
  const seed = arcadeSeed();
  return { type: "bullseye", seed, winds: bullseyeWinds(seed), bullRev: BULLSEYE_REV_EXPAND };
}

export function generateMatchup(): MatchupPuzzleData {
  // matchupRev 9 (expansion E6): the taller board with goals, ice and treasure.
  return { type: "matchup", seed: arcadeSeed(), matchupRev: MATCHUP_REV_GOALS };
}

export function generateSnake(): SnakePuzzleData {
  return { type: "snake", seed: arcadeSeed(), snakeRev: SNAKE_REV_200 };
}

export function generateCross(): CrossPuzzleData {
  return { type: "cross", seed: arcadeSeed(), crossRev: CROSS_REV_EXPAND };
}

export function generateDual(): DualPuzzleData {
  return { type: "dual", seed: arcadeSeed() };
}

export function generateRicochet(): RicoPuzzleData {
  return { type: "ricochet", seed: arcadeSeed() };
}

export function generateBreaker(): BreakerPuzzleData {
  return { type: "breaker", seed: arcadeSeed(), brkRev: BRK_REV_DEEP };
}

export function generatePinball(): PinballPuzzleData {
  return { type: "pinball", seed: arcadeSeed(), pinRev: PIN_REV_EXPAND };
}

export function generateRally(): RallyPuzzleData {
  return { type: "rally", seed: arcadeSeed(), rallyRev: RALLY_REV_BONUS };
}

export function generateSteady(): SteadyPuzzleData {
  return { type: "steady", seed: arcadeSeed() };
}

export function generateSlice(): SlicePuzzleData {
  return { type: "slice", seed: arcadeSeed(), sliceRev: SLICE_REV_EXPAND };
}

export function generateBubble(): BubblePuzzleData {
  // bubbleRev 9: bubbleRev 8's deeper reef (expansion E6) with credit for bubbles burst (no zero for a played run).
  return { type: "bubble", seed: arcadeSeed(), bubbleRev: BUB_REV_CREDIT };
}

export function generateBeat(): BeatPuzzleData {
  return { type: "beat", seed: arcadeSeed(), beatRev: BEAT_REV_200 };
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
  return { type: "whack", seed: arcadeSeed(), whackRev: WHACK_REV_DEPTH };
}

export function generateWavefront(): WavefrontPuzzleData {
  return { type: "wavefront", seed: arcadeSeed(), wavRev: WAV_REV_EXPAND };
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
  // on the lifted curves (Joe's phone notes, 27 Oct 2026).
  return { type: "flip", seed: arcadeSeed(), flipRev: FLIP_REV_LIFT };
}

export function generateJunction(): JunctionPuzzleData {
  return { type: "junction", seed: arcadeSeed(), junctionRev: JUNC_REV_BAND };
}

export function generateInkBridge(): InkBridgePuzzleData {
  return { type: "inkbridge", seed: arcadeSeed(), inkRev: INK_REV_EXPAND };
}

export function generateBurst(): BurstPuzzleData {
  return { type: "burst", seed: arcadeSeed(), burstRev: BURST_REV_CLEAN };
}

export function generateOrbit(): OrbitPuzzleData {
  const seed = arcadeSeed();
  // Rev 12 (the expansion to 200, 26 Oct 2026): one of the bank courses with proved holes and features
  // (scripts/orbit-xp-bank.ts), picked by the seed, in the bigger view. Every room deals it while the bank has courses.
  const xp = orbitXpCourseForSeed(seed);
  if (xp) return { type: "orbit", seed, orbitRev: ORBIT_REV_XP, planets: xp.planets, holes: xp.holes, extras: xp.extras };
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
 * Room/practice generation picks a proved course from the bank by the room seed; on-the-spot proving is only a fallback if the bank is empty or unlucky.
 * swingRev 8 (Tuning F) only moves the touch stars, which never steer or end a run, so any input log plays a course the same on rev 7 and rev 8 (swing-rev8-check).
 */
export function generateSwing(): SwingPuzzleData {
  const roomSeed = arcadeSeed();
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
  const pick = arcadeSeed();
  const seed = TILT_BANK[((pick % TILT_BANK.length) + TILT_BANK.length) % TILT_BANK.length]!;
  return { type: "tilt", seed, tiltRev: TILT_REV_LIFT };
}

export function generateHotFloor(): HotFloorPuzzleData {
  return { type: "hotfloor", seed: arcadeSeed() };
}
