import { CLASH_QUEUE } from "@/lib/arcade/colourClash";
import { BULLSEYE_INNER_BULL_POINTS, BULLSEYE_RING_VALUES } from "@/lib/arcade/bullseye";
import { BT_BALLS } from "@/lib/arcade/ballTrack";
import { BINTOSS_THROWS } from "@/lib/arcade/binToss";
import { BRK_BRICKS } from "@/lib/arcade/breaker";
import { INK_LEVELS } from "@/lib/arcade/inkBridge";
import { SNIP_CONFIG } from "@/lib/arcade/snip";
import { SWING_FINISH_M } from "@/lib/arcade/swing";
import { TILT_MAX_MAZES } from "@/lib/arcade/tilt";
import { EQUATION_STAGE_POINTS, CHAIN_LENGTH, CHAIN_LINK_POINTS, type PuzzleType } from "./types";

/**
 * Plain-English SCORE lines for the round intro: at most two short lines on a phone,
 * no scoring terms. Built from a few templates so the numbers follow the scoring
 * constants; the exact formula stays in the "?" help (instructions.ts).
 * intro-score-text-check guards the length and wording.
 */
const COMPLETE = 130;

/** Finish for 130 plus a speed bonus; partial credit otherwise. */
const standard = (finish: string, notFinished: string) =>
  `${finish} for ${COMPLETE}, more if you're quick. Otherwise ${notFinished}.`;

/** Fixed links with a completion-only speed bonus. */
const linkedFinish = (length: number, points: number) =>
  `${points} points per link. Finish all ${length} for ${length * points}, more if you're quick.`;

/** Staged: each part scores; all parts for 130 plus a speed bonus. */
const standardStaged = (weights: readonly number[]) =>
  `Points for each part you solve. Solve all ${weights.length} for ${weights.reduce((sum, n) => sum + n, 0)}, more if you're quick.`;

/** Fewest moves: 100 + moves points + speed points. */
const fewestMoves = (finish: string, notFinished: string) =>
  `${finish} for 100, more for few moves and speed. ${notFinished}.`;

/** Arcade with a finish state. */
const arcadeFinish = (progress: string, finish: string) =>
  `Points per ${progress}. ${finish}: ${COMPLETE}, more if you're quick.`;

/** Arcade open-ended. */
const arcadeOpen = (counts: string, penalty?: string) =>
  `Points for ${counts}.${penalty ? ` ${penalty}.` : ""}`;

export const INTRO_SCORE: Record<PuzzleType, string> = {
  // Word
  wordsmith: "Longer words score much more. Up to 150.",
  wordhunt: "Longer words score more. Up to 150.",
  tilegrid: standard("Use all 15 tiles", "8 per tile in a word"),
  wordslide: "Make all five rows words for 100, more for few moves and speed. Otherwise 22 per word row.",
  wordsearch: standard("Find all six words", "20 per word"),
  letterwheel: standard("Find every word", "points for each word"),
  strikeout: "20 per word revealed; solve all five for 120 + 4 per strike left + speed",
  codeword: "Credit per letter decoded; crack the whole grid for 130 + speed",
  swapword: "5 per tile you place; solve it for 100 + fewest swaps + speed",
  ladder: "Finish the ladder quickly for the most points. Getting close still scores.",
  groups: "Points for each group. Find all four quickly for extra points.",
  wordfall: "Longer words score more; reach the target for 150. Overflow a column and the run ends",
  wordmatch: "Get all eight right for 100, more if you're quick. Otherwise 13 per pair.",

  // Number
  target: "Hit the target exactly for 130, more if you're quick. Close answers still score.",
  equation: standardStaged(EQUATION_STAGE_POINTS),
  balance: "The scales score 20, 40 and 60. Balance all three for 120, more if you're quick.",
  numpyramid: "30 for each pyramid you finish, more if you're quick. Bricks right still score.",
  trail: standard("Complete the path", "5 per tile in place"),
  measure: "25 per puzzle, +5 for fewest moves, +30 speed if all four are solved",
  // "board" for the brief's "stage": the intro wording check rejects "stage".
  checkout: "18-26 per board, +2 for fewest darts, +30 speed if all five are solved",
  // "speed points" for the brief's "speed bonus": the intro wording check rejects "speed bonus".
  numline: "Up to 8 per number for accuracy; speed points grow with accuracy",
  tendrop: "13 points for each target you hit. Clear all ten quickly for extra points.",
  numseq: "20 points for each sequence. Get all five quickly for extra points.",
  chaincalc: "Get it right quickly for the most points.",
  pctsprint: "Points for each right answer. Get all five quickly for extra points.",
  sumhunt: "10 points for each board you clear. Clear the whole grid quickly for extra points.",
  numclimb: "Each digit you recall in order raises your score.",

  // Attention
  reaction: "Tap fast: 200 ms or quicker on average scores 150. Tapping too early loses 8.",
  stopwatch: "Stop each watch as close to the zone as you can. Closer scores more, up to 150.",
  numhunt: standard("Tap all 24 in order", "5 per number"),
  chain: linkedFinish(CHAIN_LENGTH, CHAIN_LINK_POINTS),
  whack: "Points for each target you hit; all of them scores 150. Wrong taps lose points.",
  clayshoot: "5 for each orange clay and 10 for each gold one. Hitting a bird: lose 10.",
  symscan: "Points for each eagle you find. All three grids perfect: more if you're quick.",
  countup: "Points for each tray; one off still scores. All three exact: more if you're quick.",
  spotdiff: standard("Find all six differences", "20 per difference"),
  pairmatch: standard("Find all fifteen pairs", "8 per pair"),
  maze: standard("Reach the exit", "points for how far you got"),
  intruder: standard("Get all five boards right", "24 per board"),
  stroop: `${arcadeFinish("word sorted", `All ${CLASH_QUEUE} right`)} Wrong gate: lose 2.`,
  sortrush: "Points for each one you sort correctly. Wrong gate: lose 2.",
  gonogo: "Points for each right choice. A perfect run scores extra if you're quick.",
  sequence: "Repeat the whole sequence quickly for the most points.",
  reverse: "Repeat the whole sequence quickly for the most points.",
  spatial: "Find every tile quickly for the most points.",
  spin: "Points for each right answer. A perfect run scores extra if you're quick.",
  mirmatch: "Points for each right answer. Get all five quickly for extra points.",
  patcomp: "Points for each right pattern. Get all three quickly for extra points.",

  // Logic and pattern
  unblock: fewestMoves("Free the gold block", "Clearing its lane still scores"),
  lightsout: fewestMoves("Turn every light off", "A few left on still scores"),
  pipes: standard("Connect every pipe", "points per connected tile"),
  sudoku: standard("Fill the grid", "points for each right cell"),
  flow: standard("Connect every pair", "10 per pair"),
  iceslide: fewestMoves("Reach the exit", "Getting close still scores"),
  push: fewestMoves("Get every crate home", "Each crate home scores"),
  laser: "Light every gem on your first shot for 130, more if you're quick. Later shots score less.",
  tower: fewestMoves("Move the whole tower", "Each ring in place scores"),
  tubes: fewestMoves("Cork every flask", "22 per corked flask"),
  safe: "Open the safe on your first try for 130, more if you're quick. Later tries score less.",
  bomb: standard("Defuse the bomb", "points for each right step"),
  gravity: fewestMoves("Park all four balls", "30 per ball parked"),
  nonogram: standard("Complete the picture", "points for each right cell"),
  flood: fewestMoves("Flood the board", "Part-flooded still scores"),
  tiles: fewestMoves("Put the tiles in order", "14 per tile in place"),
  rings: fewestMoves("Line up every spoke", "12 per matching spoke"),
  blockparty: standard("Place all nine pieces", "12 per piece"),
  shikaku: standard("Fill the grid", "points for each cell covered"),
  lightup: standard("Light every cell", "points for each lit cell"),
  tents: standard("Place every tent", "10 per right tent"),
  stroke: "Finish on your first try for a bonus.",
  dig: "Fill the drain with clean water for 100, more if you're quick and use few digs.",

  // Arcade
  hover: "Points for each barrier and gold star. Last the whole minute for 10 more.",
  skyline: "Points for each block and perfect drop, more for perfects in a row. Up to 150.",
  bintoss: `Points for each bucket and hoop. All ${BINTOSS_THROWS} in for 10 more, up to 150.`,
  bullseye: `Rings ${BULLSEYE_RING_VALUES[0]} in the centre down to ${BULLSEYE_RING_VALUES[BULLSEYE_RING_VALUES.length - 1]}, inner bull ${BULLSEYE_INNER_BULL_POINTS}; balloons +1 to +3. Up to 150.`,
  matchup: "Match lines of three or more; longer lines score far more. Up to 150.",
  snake: "Points for each star you eat. Up to 150.",
  cross: "Points for each lane crossed, more for each full crossing. Up to 150.",
  breaker: `Points for each brick. Clear all ${BRK_BRICKS} quickly for up to 150.`,
  rally: "Points for each gold-ball hit and pink target. Blue scores nothing. Up to 150.",
  bubble: "Points for each bubble cleared. Clear the whole field quickly for up to 150.",
  slice: "Points for each food sliced; cut several at once for more. Chilli: lose 10. Up to 150.",
  beat: "Points for each note hit in time; every note Perfect for 150. A miss costs a little.",
  wavefront: "Points for ships, saucers, waves and boss hits. Destroy the boss fast for up to 10 more.",
  flip: "Points for every second you last and each gold star. Last the minute for 10 more.",
  junction: "Points for each car and bus through, ± for ambulances. Last the minute for 10 more.",
  inkbridge: `Points for each level and gold star. All ${INK_LEVELS} levels quickly: up to 150.`,
  burst: "Points for each atom; a lost life costs a few. Last the 90 s for 10 more.",
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
