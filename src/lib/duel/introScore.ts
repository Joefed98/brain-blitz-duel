import { CLASH_QUEUE } from "@/lib/arcade/colourClash";
import { BULLSEYE_INNER_BULL_POINTS, BULLSEYE_RING_VALUES } from "@/lib/arcade/bullseye";
import { BT_BALLS } from "@/lib/arcade/ballTrack";
import { BINTOSS_THROWS } from "@/lib/arcade/binToss";
import { BRK_BRICKS } from "@/lib/arcade/breaker";
import { INK_LEVELS } from "@/lib/arcade/inkBridge";
import { SNIP_CONFIG } from "@/lib/arcade/snip";
import { SWING_FINISH_M } from "@/lib/arcade/swing";
import { TILT_MAX_MAZES } from "@/lib/arcade/tilt";
import { bandsIntro } from "./puzzleBandsText";
import type { PuzzleType } from "./types";

/**
 * Plain-English SCORE lines for the round intro: at most two short lines on a phone,
 * no scoring terms; the exact formula stays in the "?" help (instructions.ts).
 * intro-score-text-check guards the length and wording. Puzzles follow the Oct
 * 2026 puzzle score shape (puzzleScoreRev.ts): a finish scores 120 plus up to 30.
 */

/** Arcade open-ended. */
const arcadeOpen = (counts: string, penalty?: string) =>
  `Points for ${counts}.${penalty ? ` ${penalty}.` : ""}`;

export const INTRO_SCORE: Record<PuzzleType, string> = {
  // Word
  wordsmith: "Longer words score much more. 150 for a big haul of words.",
  wordhunt: "Longer words score more. 150 for a big haul of words.",
  tilegrid: bandsIntro("tilegrid"),
  wordslide: bandsIntro("wordslide"),
  wordsearch: bandsIntro("wordsearch"),
  letterwheel: bandsIntro("letterwheel"),
  strikeout: bandsIntro("strikeout"),
  codeword: bandsIntro("codeword"),
  swapword: bandsIntro("swapword"),
  wordfall: "Longer words score more; Qu counts as two letters. 150 for a big haul of words.",

  // Number
  target: bandsIntro("target"),
  equation: bandsIntro("equation"),
  balance: bandsIntro("balance"),
  numpyramid: bandsIntro("numpyramid"),
  trail: bandsIntro("trail"),
  measure: bandsIntro("measure"),
  // "board" for the brief's "stage": the intro wording check rejects "stage".
  checkout: bandsIntro("checkout"),
  // "speed points" for the brief's "speed bonus": the intro wording check rejects "speed bonus".
  numline: "Up to 8 per number, more if quick and close; far-off ones lose 1. 150 is perfect.",
  tendrop: "Points for each target you hit. Clear all ten for more, earlier for more still.",

  // Attention
  reaction: "Tap fast: 150 ms or quicker on average scores 150. Early taps cost 8, then 11 after two.",
  stopwatch: "Stop on the line: about 20 ms off or closer on average scores 150. Far off drops fast.",
  numhunt: bandsIntro("numhunt"),
  chain: bandsIntro("chain"),
  whack: "Points for each target you hit; all of them scores 150. Wrong taps lose points.",
  clayshoot: "5 per orange clay, 10 per gold. A bird costs 10; past 30 empty shots, each 20 cost 1.",
  symscan: bandsIntro("symscan"),
  countup: bandsIntro("countup"),
  spotdiff: bandsIntro("spotdiff"),
  pairmatch: bandsIntro("pairmatch"),
  maze: bandsIntro("maze"),
  stroop: `Sort all ${CLASH_QUEUE} with 2 wrong at most, quicker for more; else right less wrong words.`,

  // Logic and pattern
  unblock: bandsIntro("unblock"),
  lightsout: bandsIntro("lightsout"),
  pipes: bandsIntro("pipes"),
  sudoku: bandsIntro("sudoku"),
  flow: bandsIntro("flow"),
  iceslide: bandsIntro("iceslide"),
  push: bandsIntro("push"),
  laser: bandsIntro("laser"),
  tower: bandsIntro("tower"),
  tubes: bandsIntro("tubes"),
  safe: bandsIntro("safe"),
  bomb: bandsIntro("bomb"),
  gravity: bandsIntro("gravity"),
  nonogram: bandsIntro("nonogram"),
  flood: bandsIntro("flood"),
  tiles: bandsIntro("tiles"),
  rings: bandsIntro("rings"),
  blockparty: bandsIntro("blockparty"),
  shikaku: bandsIntro("shikaku"),
  lightup: bandsIntro("lightup"),
  tents: bandsIntro("tents"),
  dig: "Fill the drain with clean water for 100, more if you're quick and use few digs.",

  // Arcade
  hover: "Points for each barrier and gold star. Last the whole minute for 10 more.",
  skyline: "Points for each block and perfect drop, more for perfects in a row. Up to 150.",
  bintoss: `Points for each bucket and hoop. All ${BINTOSS_THROWS} in for 10 more, up to 150.`,
  bullseye: `Rings ${BULLSEYE_RING_VALUES.join(" / ")}, inner bull ${BULLSEYE_INNER_BULL_POINTS}; balloons +1 to +3. Up to 150.`,
  matchup: "Match lines of three or more; longer lines score far more. Up to 150.",
  snake: "Points for each star you eat. Up to 150.",
  cross: "Points for each lane crossed, more for each full crossing. Up to 150.",
  breaker: `Points for each brick. Clear all ${BRK_BRICKS} quickly for up to 150.`,
  rally: "Points for each gold-ball hit and pink target. Blue scores nothing. Up to 150.",
  pinball: "Table points from bumpers, targets, the spinner and lit lanes. Up to 150.",
  bubble: "Points for each bubble cleared. Clear the whole field quickly for up to 150.",
  slice: "Points for each food sliced; cut several at once for more. Chilli: lose 10. Up to 150.",
  beat: "Points for each note hit in time; every note Perfect for 150. A miss costs a little.",
  wavefront: "Ships, armour hits, saucers, waves, boss hits. Destroy the boss fast for up to 10 more.",
  flip: "Points for every second you last and each gold star. Last the minute for 10 more.",
  junction: "Points for each car and bus through, ± for ambulances. Last the minute for 10 more.",
  inkbridge: `Points for each level and gold star. All ${INK_LEVELS} levels quickly: up to 150.`,
  burst: "Points for each atom hit; a lost life takes 5 hits off. Last the 90 s for 10 more.",
  orbit: "Points for each planet you reach. Reach the sun quickly for up to 150.",
  snip: `Points for each apple and leaf. All ${SNIP_CONFIG.levels} apples quickly: up to 150.`,
  swing: `Points for distance and stars. Reach ${SWING_FINISH_M} metres for 10 more.`,
  tilt: `Points for each maze, how close you get, and stars. All ${TILT_MAX_MAZES} quickly: up to 150.`,
  balltrack: `Points for each marble home. Get all ${BT_BALLS} home quickly for up to 150.`,
  swerve: arcadeOpen("each coin you collect"),
  dual: "The longer both runners survive, the more you score. The full minute is 150.",
  steady: "Start on 150. Touching the edge: lose 5.",
  ricochet: arcadeOpen("each metre you climb"),
  rooftop: "The longer you last, the more you score. The full minute is 150.",
  bastion: arcadeOpen("each shape you destroy, with a bonus for keeping the base alive"),
  hotfloor: arcadeOpen("each stage you survive"),
};
