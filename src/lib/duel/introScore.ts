import { CLASH_QUEUE } from "@/lib/arcade/colourClash";
import { BULLSEYE_INNER_BULL_POINTS, BULLSEYE_RING_VALUES } from "@/lib/arcade/bullseye";
import { BT_BALLS } from "@/lib/arcade/ballTrack";
import { BINTOSS_THROWS } from "@/lib/arcade/binToss";
import { BRK_BRICKS } from "@/lib/arcade/breaker";
import { INK_LEVELS } from "@/lib/arcade/inkBridge";
import { SNIP_CONFIG } from "@/lib/arcade/snip";
import { SWING_FINISH_M } from "@/lib/arcade/swing";
import { TILT_MAX_MAZES } from "@/lib/arcade/tilt";
import { PUZZLE_FINISH_BASE } from "./puzzleScoreRev";
import type { PuzzleType } from "./types";

/**
 * Plain-English SCORE lines for the round intro: at most two short lines on a phone,
 * no scoring terms; the exact formula stays in the "?" help (instructions.ts).
 * intro-score-text-check guards the length and wording. Puzzles follow the Oct
 * 2026 puzzle score shape (puzzleScoreRev.ts): a finish scores 120 plus up to 30.
 */

/** Interloper is retiring on its own formula: finish for 130 plus a speed bonus; partial credit otherwise. */
const legacyStandard = (finish: string, notFinished: string) =>
  `${finish} for 130, more if you're quick. Otherwise ${notFinished}.`;

/** Arcade open-ended. */
const arcadeOpen = (counts: string, penalty?: string) =>
  `Points for ${counts}.${penalty ? ` ${penalty}.` : ""}`;

export const INTRO_SCORE: Record<PuzzleType, string> = {
  // Word
  wordsmith: "Longer words score much more. Up to 150.",
  wordhunt: "Longer words score more. Up to 150.",
  tilegrid: "Use all 15 tiles for 120, more if you're quick. Otherwise about 7 per tile in a word.",
  wordslide: "Make all five rows words for 120, more for few moves and speed. Otherwise 27 per row.",
  wordsearch: "Find all six words for 120, more if you're quick. Otherwise 22 per word.",
  letterwheel: "Find every word for 120, more if you're quick. Otherwise points for each word.",
  strikeout: "27 per word solved; solve all five for 120 + 3 per strike left + speed",
  codeword: "Credit per letter decoded; crack the whole grid for 120 + speed",
  swapword: "Solve it for 120, more for few swaps and speed. Otherwise points per tile placed.",
  ladder: "Finish the ladder quickly for the most points. Getting close still scores.",
  groups: "Points for each group. Find all four quickly for extra points.",
  wordfall: "Longer words score more; Qu counts as two letters. Reach the target for 150.",
  wordmatch: "Get all eight right for 100, more if you're quick. Otherwise 13 per pair.",

  // Number
  target: "Hit the target exactly for 120, more if you're quick. Close answers still score.",
  equation: "Points for each part you solve, 3 tries each. Solve all 4 for 120, more if you're quick.",
  balance: "Scales score 15, 25, 30 and 55; hangs are limited. All four for 120, more if you're quick.",
  numpyramid: "27 for each pyramid you finish. All four for 120, more if you're quick.",
  trail: "Complete the path for 120, more if you're quick. Otherwise about 4 per tile in place.",
  measure: "30, 35, 45 for puzzles 1-3, moves limited; all four for 120, more for few moves and speed",
  // "board" for the brief's "stage": the intro wording check rejects "stage".
  checkout: "22-32 per board; all five for 120, more for fewest darts and speed",
  // "speed points" for the brief's "speed bonus": the intro wording check rejects "speed bonus".
  numline: "Up to 8 per number (120 for all 15), more if quick and close; far-off ones lose 1",
  tendrop: "12 points for each target you hit. Clear all ten for 120, more if you're quick.",
  numseq: "20 points for each sequence. Get all five quickly for extra points.",
  chaincalc: "Get it right quickly for the most points.",
  pctsprint: "Points for each right answer. Get all five quickly for extra points.",
  sumhunt: "10 points for each board you clear. Clear the whole grid quickly for extra points.",
  numclimb: "Each digit you recall in order raises your score.",

  // Attention
  reaction: "Tap fast: 200 ms or quicker on average scores 150. Early taps cost 8, then 11 after two.",
  stopwatch: "Stop each watch as close to the zone as you can, up to 150. Over 200 ms off drops fast.",
  numhunt: "Tap all 24 in order for 120, more if you're quick. Wrong taps lose 5.",
  chain: "About 3 points per link. Finish all 40 for 120, more if you're quick.",
  whack: "Points for each target you hit; all of them scores 150. Wrong taps lose points.",
  clayshoot: "5 per orange clay, 10 per gold. A bird costs 10; past 30 empty shots, each 20 cost 1.",
  symscan: "Points for each eagle you find. All three grids perfect: 120, more if you're quick.",
  countup: "Points for each tray; one off still scores. All three exact: 120, more if quick.",
  spotdiff: "Find all six for 120, more if you're quick. Otherwise 22 each; wrong taps lose 5.",
  pairmatch: "Find all fifteen pairs for 120, more if you're quick. Otherwise about 8 per pair.",
  maze: "Reach the exit for 120, more if you're quick. Otherwise points for how far you got.",
  intruder: legacyStandard("Get all five boards right", "24 per board"),
  stroop: `Sort all ${CLASH_QUEUE}, 2 wrong at most, for ${PUZZLE_FINISH_BASE}, more if quick. Otherwise points per word right.`,
  sortrush: "Points for each one you sort correctly. Wrong gate: lose 2.",
  gonogo: "Points for each right choice. A perfect run scores extra if you're quick.",
  sequence: "Repeat the whole sequence quickly for the most points.",
  reverse: "Repeat the whole sequence quickly for the most points.",
  spatial: "Find every tile quickly for the most points.",
  spin: "Points for each right answer. A perfect run scores extra if you're quick.",
  mirmatch: "Points for each right answer. Get all five quickly for extra points.",
  patcomp: "Points for each right pattern. Get all three quickly for extra points.",

  // Logic and pattern
  unblock: "Free the gold block for 120, more for few moves and speed. Clearing its lane scores.",
  lightsout: "Turn every light off for 120, more for few moves and speed. A few left on scores.",
  pipes: "Connect every pipe for 120, more if you're quick. Otherwise points per joined tile.",
  sudoku: "Fill the grid for 120, more if you're quick. Otherwise points per right cell.",
  flow: "Connect every pair for 120, more if you're quick. Otherwise points per right pair.",
  iceslide: "Reach the exit for 120, more for few moves and speed. Getting close still scores.",
  push: "Get every crate home for 120, more for few moves and speed. Each crate home scores.",
  laser: "Light every gem for 120, more on your first shot and if you're quick.",
  tower: "Move the whole tower for 120, more for few moves and speed. Rings you stack score.",
  tubes: "Cork every flask within the pours for 120, more if few and quick. Each corked one scores.",
  safe: "Open the safe for 120, more on your first try and if you're quick.",
  bomb: "Defuse the bomb for 120, more if you're quick. Otherwise 22 per right step.",
  gravity: "Park all four within the tilts for 120, more if few and quick. Each parked ball scores.",
  nonogram: "Complete the picture for 120, more if you're quick. Otherwise points per right cell.",
  flood: "Flood it within the moves for 120, more if few and quick. Out of moves scores nothing.",
  tiles: "Put the tiles in order for 120, more for few moves and speed. Tiles you place score.",
  rings: "Line up every spoke for 120, more for few moves and speed. Spokes you match score.",
  blockparty: "Place all nine pieces for 120, more if you're quick. Otherwise 14 per right piece.",
  shikaku: "Fill the grid for 120, more if you're quick. Otherwise points per right rectangle.",
  lightup: "Light every cell for 120, more if you're quick. Otherwise points per right bulb.",
  tents: "Place every tent for 120, more if you're quick. Otherwise 10 per right tent, −10 wrong.",
  stroke: "Finish on your first try for a bonus.",
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
  parry: arcadeOpen("each arrow you deflect", "Losing a life costs 10"),
  bastion: arcadeOpen("each shape you destroy, with a bonus for keeping the base alive"),
  hotfloor: arcadeOpen("each stage you survive"),
};
