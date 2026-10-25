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
import { fillMax, liveRecord } from "./roundMax";
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

function introScoreTemplates(): Record<PuzzleType, string> {
  return {
    // Word
    wordsmith: "Longer words score much more. {max} only with the word that uses every tile.",
    wordhunt: "Longer words score more. {max} for a big haul of words.",
    tilegrid: bandsIntro("tilegrid"),
    wordslide: bandsIntro("wordslide"),
    wordsearch: bandsIntro("wordsearch"),
    letterwheel: bandsIntro("letterwheel"),
    strikeout: bandsIntro("strikeout"),
    codeword: bandsIntro("codeword"),
    swapword: bandsIntro("swapword"),
    wordfall: "Longer words score more; Qu counts as two letters. {max} for a big haul of words.",

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
    numline: "Up to 8 per number, more if quick and close; far-off ones lose 1. {max} is perfect.",
    tendrop: "Points for each target you hit. Clear all ten for more, earlier for more still.",

    // Attention
    reaction: "Tap fast: 150 ms or quicker on average scores {max}. Early taps cost 8, then 11 after two.",
    stopwatch: "Stop on the line: about 5 ms off or closer on average scores {max}. Far off drops fast.",
    numhunt: bandsIntro("numhunt"),
    chain: bandsIntro("chain"),
    whack: "Points for each target you hit; all of them scores {max}. Wrong taps lose points.",
    clayshoot: "5 per orange, 10 per gold; quick hits score more. A bird costs 10; spraying shots costs.",
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
    skyline: "Points for each block and perfect drop, more for perfects in a row. Up to {max}.",
    bintoss: `Points for each bucket and hoop. All ${BINTOSS_THROWS} in for 10 more, up to {max}.`,
    bullseye: `Rings ${BULLSEYE_RING_VALUES.join(" / ")}, inner bull ${BULLSEYE_INNER_BULL_POINTS}; balloons +1 to +3. Up to {max}.`,
    matchup: "Match lines of three or more; longer lines score far more. Up to {max}.",
    snake: "Points per star; gold stars, combos, lane rides and warps add bonus. Up to {max}.",
    cross: "Points for each lane crossed, more for each full crossing. Up to {max}.",
    breaker: `Points for each brick. Clear all ${BRK_BRICKS} quickly for up to {max}.`,
    rally: "Points for each gold-ball hit and pink target. Blue scores nothing. Up to {max}.",
    pinball: "Table points from bumpers, targets, the spinner and lit lanes. Up to {max}.",
    bubble: "Points for each bubble cleared. Clear the whole field quickly for up to {max}.",
    slice: "Points for each food sliced; cut several at once for more. Chilli: lose 10. Up to {max}.",
    beat: "Notes hit in time score; fever, gold notes, double taps and streaks add bonus. Up to {max}.",
    wavefront: "Ships, armour hits, saucers, waves, boss hits. Destroy the boss fast for up to 10 more.",
    flip: "Points for every second you last and each gold star. Last the minute for 10 more.",
    junction: "Points for each car and bus through, ± for ambulances. Last the minute for 10 more.",
    inkbridge: `Points for each level and gold star. All ${INK_LEVELS} levels quickly: up to {max}.`,
    burst: "Points per atom, 5 off a lost life; chains, gold atoms, fast waves add bonus. Up to {max}.",
    orbit: "Points for each planet you reach. Reach the sun quickly for up to {max}.",
    snip: `Points for each apple and leaf. All ${SNIP_CONFIG.levels} apples quickly: up to {max}.`,
    swing: `Points for distance and stars. Reach ${SWING_FINISH_M} metres for 10 more.`,
    tilt: `Points for each maze, how close you get, and stars. All ${TILT_MAX_MAZES} quickly: up to {max}.`,
    balltrack: `Points for each marble home. Get all ${BT_BALLS} home quickly for up to {max}.`,
    swerve: arcadeOpen("each coin you collect"),
    dual: "The longer both runners survive, the more you score. The full minute is {max}.",
    steady: "Start on {max}. Touching the edge: lose 5.",
    ricochet: arcadeOpen("each metre you climb"),
    rooftop: "The longer you last, the more you score. The full minute is {max}.",
    bastion: arcadeOpen("each shape you destroy, with a bonus for keeping the base alive"),
    hotfloor: arcadeOpen("each stage you survive"),
  };
}

/**
 * The SCORE lines, `{max}` filled with each game's round maximum (roundMax.ts), so a game raised
 * to 200 states its own top without touching this file.
 */
export const INTRO_SCORE: Record<PuzzleType, string> = liveRecord(() => {
  const templates = introScoreTemplates();
  const filled = {} as Record<PuzzleType, string>;
  for (const type of Object.keys(templates) as PuzzleType[]) filled[type] = fillMax(templates[type], type);
  return filled;
});
