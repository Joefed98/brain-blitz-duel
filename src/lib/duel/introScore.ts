import { CLASH_QUEUE } from "@/lib/arcade/colourClash";
import { MOVES_SHAPE } from "./scoring";
import { CROSS_LANE_POINTS, CROSS_CROSSING_POINTS } from "@/lib/arcade/cross";
import { BULLSEYE_RING_VALUES } from "@/lib/arcade/bullseye";
import { BT_BALLS } from "@/lib/arcade/ballTrack";
import { MATCHUP_PAR_RAW } from "@/lib/arcade/matchup";
import { RALLY_GOLD_POINTS } from "@/lib/arcade/rally";
import { SKYLINE_BLOCK_POINTS, SKYLINE_PERFECT_POINTS } from "@/lib/arcade/skyline";
import { EQUATION_STAGE_POINTS, CHAIN_LENGTH, CHAIN_LINK_POINTS, CHAIN_FINISH_BONUS, type PuzzleType } from "./types";

/**
 * Plain-English SCORE lines for the round intro. Built from one template per
 * scoring shape so the wording follows the scoring numbers; the exact formula
 * stays in the "?" help (instructions.ts).
 */
const COMPLETE = 130;
const SPEED = 20;

/** Standard: 130 + up to 20 for speed; flat points otherwise. */
const standard = (finish: string, notFinished: string) =>
  `${finish}: ${COMPLETE} points, plus up to ${SPEED} more for finishing fast. Not finished: ${notFinished}.`;

/** Fixed links with a completion-only speed bonus. */
const linkedFinish = (length: number, points: number, bonus: number) =>
  `Complete all ${length} links: ${length * points} points, plus up to ${bonus} more for finishing fast. Not finished: ${points} per link, rounded down. A wrong or missed tap ends your run.`;

/** Standard staged: solved weights total 130, plus completion-only SPEED(20). */
const standardStaged = (weights: readonly number[]) =>
  `Stages score ${weights.join(" / ")} points. All ${weights.length} correct: ${weights.reduce((sum, n) => sum + n, 0)} points, plus up to ${SPEED} more for finishing fast. Not finished: add the points for stages solved.`;

/** Fewest moves: 100 + moves points + speed points. */
const fewestMoves = (finish: string, notFinished: string, shape: "B" | "C" = "B") => {
  const w = MOVES_SHAPE[shape];
  return `${finish}: 100 points, plus up to ${w.moves} for using few moves and up to ${w.speed} for being quick. Not finished: ${notFinished}.`;
};

/** Arcade with a finish state. */
const arcadeFinish = (progress: string, finish: string) =>
  `Points for ${progress}. ${finish} for ${COMPLETE}, plus up to ${SPEED} for getting there fast.`;

/** Arcade open-ended. */
const arcadeOpen = (counts: string, penalty?: string) =>
  `Points for ${counts}.${penalty ? ` ${penalty}.` : ""}`;

/** Converted raw totals and weighted counters, rounded down and capped. */
const arcadeConverted = (counts: string) => `${counts}. Round down to a whole point, up to 150.`;
const arcadePar = (par: number) => `Bigger lines score far more match points. ${par.toLocaleString("en-GB")} match points earn 150; fewer earn a proportional share, rounded down.`;
const arcadeTraffic = (car: number, ambulance: number) => `${car} points per car through, ${ambulance} per ambulance through, and 40 for lasting the minute. A car that gives up: lose 1. A stopped ambulance: lose ${ambulance}. Minimum 0, maximum 150.`;

export const INTRO_SCORE: Record<PuzzleType, string> = {
  // Word
  wordsmith: "Longer words score more: 8 letters earn 11 word points; 9-11 letters earn 15. Round down 2.5 × your word points, up to 150.",
  wordhunt: "Longer words score more. Your word points count double, up to 150.",
  tilegrid: "Use all fifteen tiles in a valid grid: 130 points, plus up to 20 more for finishing fast. Not finished: 8 points for each tile inside a real word.",
  wordslide: "Make all five rows words: 100 points, plus up to 30 for being quick and up to 20 for using few moves. Not finished: 22 points for each row that is a word.",
  wordsearch: standard("Find all six words", "20 points for each word found"),
  letterwheel: "Find every word: 130 points, plus up to 20 more for finishing fast. Not finished: 15 points a word, or 13 on nine-word puzzles.",
  ladder: "Finish the ladder quickly for the most points. Getting close still scores.",
  groups: "More groups means more points. Find all four for a speed bonus.",
  wordmatch: "Get all eight right: 100 points, plus more for being quick. Otherwise 13 points for each correct pair.",

  // Number
  target: "Hit the target exactly: 130 points, plus up to 20 more for finishing fast. One off scores 120, and it drops faster the further away you are.",
  equation: standardStaged(EQUATION_STAGE_POINTS),
  balance: "Balance the three scales for 20, 40 and 60 points. Balance all three: 120 points, plus up to 30 more for finishing fast.",
  numpyramid: "Each finished pyramid scores 30, and all four earn up to 30 more for finishing fast. The pyramid you're on scores for the bricks you've got right.",
  trail: standard("Complete the path", "5 for each tile in the right place") + " Wrong tiles cost nothing.",
  tendrop: "13 points for each target you hit. Clear all ten for up to 20 more for clearing them early.",
  numseq: "Twenty points for each sequence. Get all five right for a speed bonus.",
  chaincalc: "Get it right quickly for the most points.",
  pctsprint: "More correct answers means more points. Get all five for a speed bonus.",
  sumhunt: "10 points for each stage. Clear the whole grid for a time bonus.",
  numclimb: "Each digit you recall in order raises your score.",

  // Attention
  reaction: "Average 200 ms or faster for 150 points; slower reactions score less. A miss counts as a very slow tap. Tapping too early: lose 8.",
  stopwatch: "Stop within 20 ms of the zone on average for 150 points; bigger misses score less. A watch you never stop counts as a big miss.",
  numhunt: "Tap all 24 in order: 130 points, plus up to 20 more for finishing fast. Not finished: 5 points for each number. Wrong tap: lose 5.",
  chain: linkedFinish(CHAIN_LENGTH, CHAIN_LINK_POINTS, CHAIN_FINISH_BONUS),
  whack: "Points for the share of targets you hit, up to 135, plus 15 if you hit them all. Wrong colour or empty tap: lose 3. Bomb: lose 5.",
  clayshoot: "5 points for each orange clay and 10 for each gold one. Hit all 25 for 10 more.",
  symscan: "The three grids are worth 30, 45 and 55 points, scored by how many arrows you find. Wrong tap: lose 3. Get all three perfect for up to 20 more for speed.",
  countup: "The three scenes are worth 30, 45 and 55 points; one off still earns some. Get all three exact for up to 20 more for speed.",
  spotdiff: standard("Find all six differences", "20 points for each difference found"),
  pairmatch: standard("Find all fifteen pairs", "8 points for each pair found"),
  maze: standard("Reach the exit", "points for how far along the route you got"),
  intruder: standard("Get all five boards right", "24 points for each board right, or 12 for half of one"),
  stroop: `${arcadeFinish(`the share of the ${CLASH_QUEUE} words you sort correctly, rounded to the nearest whole point`, `Sort all ${CLASH_QUEUE}`)} Wrong gate: lose 2.`,
  sortrush: "Points for the share you sort correctly. Wrong gate: lose 2.",
  gonogo: "More correct choices means more points. A perfect run earns a speed bonus.",
  sequence: "Repeat the whole sequence quickly for the most points.",
  reverse: "Repeat the whole sequence quickly for the most points.",
  spatial: "Find every tile quickly for the most points.",
  spin: "More correct answers means more points. A perfect run earns a speed bonus.",
  mirmatch: "More correct answers means more points. Get all five for a speed bonus.",
  patcomp: "Each correct pattern scores. Get all three for a speed bonus.",

  // Logic and pattern
  unblock: fewestMoves("Free the gold car", "up to 70 points for clearing its lane"),
  lightsout: fewestMoves("Turn every light off", "up to 85 points if only a few lights are left on"),
  pipes: standard("Connect every pipe", "points for how many tiles are connected"),
  sudoku: standard("Fill the grid", "points for each correct cell, up to 110"),
  flow: "Connect every pair: 130 points, plus up to 20 more for finishing fast. Run out of time: 10 points for each pair you connected.",
  iceslide: fewestMoves("Reach the exit", "up to 90 points for how close you got"),
  push: fewestMoves("Get every crate home", "points for each crate on a target, up to 110"),
  laser: "Light every gem on your first shot: 130 points, plus up to 20 more for finishing fast. Second shot 115, third 100. Not finished: 15 points for each gem lit.",
  tower: fewestMoves("Move the whole tower", "points for each disc in place from the bottom, up to 110"),
  tubes: fewestMoves("Sort every tube", "22 points for each single-colour tube, up to 110"),
  safe: "Open the safe on your first try: 130 points, plus up to 20 more for finishing fast. Second try 115, third 100. Not opened: 15 points for each dial right.",
  bomb: standard("Defuse the bomb", "25 points for each correct step before a strike"),
  gravity: fewestMoves("Park all four balls", "30 points for each ball on its target"),
  nonogram: standard("Complete the picture", "points for each correct cell, up to 110. Wrong cell: lose 5"),
  flood: fewestMoves("Flood the board", "points for how much of the board you flooded", "C"),
  tiles: fewestMoves("Put the tiles in order", "14 points for each tile in place"),
  rings: fewestMoves("Line up every spoke", "12 points for each matching spoke"),
  blockparty: standard("Place all nine pieces", "12 points for each piece placed"),
  shikaku: standard("Fill the grid", "points for each cell covered, up to 110"),
  lightup: standard("Light every cell", "points for each lit cell, up to 110. Clashing bulbs: lose 5"),
  tents: standard("Place every tent", "10 points for each correct tent, up to 110"),
  stroke: "Finish on your first try for a bonus.",
  dig: "Fill the drain with clean water: 100 points plus a time bonus, and 20 more if you stay within the planned digs. Otherwise points for clean water drained.",

  // Arcade
  hover: arcadeOpen("each gate you fly through; all of them scores 150"),
  skyline: arcadeConverted(`${SKYLINE_BLOCK_POINTS} points per block stacked, plus ${SKYLINE_PERFECT_POINTS} per perfect drop`),
  bintoss: arcadeFinish("each bucket, 10 a time", "Sink all ten"),
  bullseye: `Rings: ${BULLSEYE_RING_VALUES.join(", ")} from the centre out. ${arcadeConverted("Multiply your ring total by 1.7, then subtract 20")} Minimum 0. Missed or unfired darts add nothing to the ring total.`,
  matchup: arcadePar(MATCHUP_PAR_RAW),
  snake: arcadeOpen("each star you eat"),
  cross: `${CROSS_LANE_POINTS} points for each lane crossed, plus ${CROSS_CROSSING_POINTS} for each full crossing, up to 150. Being hit costs a life, not points.`,
  breaker: arcadeFinish("each brick destroyed", "Clear all 80"),
  rally: `${arcadeConverted(`${RALLY_GOLD_POINTS} points per gold-ball hit`)} The blue ball scores nothing.`,
  slice: "Points for each food you slice, and cutting three or more at once boosts your multiplier. Chilli: lose 10.",
  bubble: arcadeFinish("the share of bubbles you clear", "Clear the whole field"),
  beat: "Points for each note: most for perfect timing, less for good or OK. Missed note: lose 2. Holds count only if you press and let go in time.",
  wavefront: "Points for ships, armour hits, saucers and waves cleared. Clear all five waves perfectly for 150.",
  flip: "The longer you last, the more you score. Survive the full minute for 150.",
  junction: arcadeTraffic(2, 4),
  inkbridge: arcadeFinish("each level you finish", "Finish all ten"),
  burst: "Points for each atom you destroy or split. Losing a life costs 9. Clear four waves without losing a life for 150.",
  orbit: arcadeFinish("each planet you reach", "Reach the sun"),
  snip: arcadeFinish("each apple you collect, with extra for each leaf", "Collect all ten apples"),
  swing: arcadeFinish("how far you swing", "Reach 500 metres"),
  tilt: arcadeFinish("each maze you finish", "Finish all four"),
  balltrack: `${arcadeFinish(`the share of ${BT_BALLS} marbles you get home, rounded to the nearest whole point`, `Get all ${BT_BALLS} home`)} Wrong trays cost nothing.`,
  swerve: arcadeOpen("each coin you collect"),
  dual: "The longer both runners survive, the more you score. The full minute is 150.",
  steady: "Start on 150. Touching the edge: lose 5.",
  ricochet: arcadeOpen("each metre you climb"),
  rooftop: "The longer you last, the more you score. The full minute is 150.",
  parry: arcadeOpen("each arrow you deflect", "Losing a life costs 10"),
  bastion: arcadeOpen("each shape you destroy, with a bonus for keeping the base alive"),
  hotfloor: arcadeOpen("each stage you survive"),
};
