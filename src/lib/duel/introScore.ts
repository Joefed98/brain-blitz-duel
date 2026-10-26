import { CLASH_DEPTH_MAX_WRONG, CLASH_QUEUE } from "@/lib/arcade/colourClash";
import { BULLSEYE_INNER_BULL_POINTS, BULLSEYE_RING_VALUES } from "@/lib/arcade/bullseye";
import { BINTOSS_FAR_POINTS, BINTOSS_THROWS } from "@/lib/arcade/binToss";
import { INK_LEVELS } from "@/lib/arcade/inkBridge";
import { SWING_FINISH_M } from "@/lib/arcade/swing";
import { TILT_MAX_MAZES } from "@/lib/arcade/tilt";
import { bandsIntro } from "./puzzleBandsText";
import { depthIntro as logicDepthIntro } from "./logicDepthText";
import { wordSearchBonusIntro } from "./wordSearchText";
import { letterWheelJarIntro } from "./letterWheelText";
import { CODEWORD_STRETCH, TILEGRID_STRETCH, stretchIntro, strikeoutDepthIntro } from "./depth/stretchShapes";
import { parBonusIntro } from "./parBonusText";
import { doubleTakeDepthIntro, eagleEyeDepthIntro, tallyDepthIntro } from "./depth/attentionTexts";
import { ASCEND_DEPTH_INTRO, BANGON_DEPTH_INTRO, FLASH_DEPTH_INTRO } from "./depth/speedTexts";
import { depthIntro } from "./numberDepthText";
import { d4IntroTemplate } from "./depth4/text";
import { fillMax, liveRecord } from "./roundMax";
import { CHAIN_DEPTH_INTRO } from "./depth/chain";
import { PAIR_DEPTH_INTRO } from "./depth/matchmaker";
import { labyrinthDepthIntro } from "./depth/labyrinth";
import { TOPSY_INTRO_SCORE } from "./topsy";
import { JUMBLED_INTRO_SCORE } from "./jumbled";
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
    wordsmith: "Longer words score more. The word using every tile adds a big bonus; {max} only with it.",
    wordhunt: "Longer words score more; 6+ letters and the gold tile add extra. {max} needs both.",
    tilegrid: stretchIntro("tilegrid", TILEGRID_STRETCH),
    wordslide: parBonusIntro("wordslide", "moves"),
    wordsearch: wordSearchBonusIntro(),
    letterwheel: letterWheelJarIntro(),
    strikeout: strikeoutDepthIntro(),
    codeword: stretchIntro("codeword", CODEWORD_STRETCH),
    swapword: parBonusIntro("swapword", "swaps"),
    wordfall: "Longer words score more; Qu counts as two letters. {max} for a big haul of words.",

    // Number
    target: depthIntro("target"),
    equation: depthIntro("equation"),
    balance: depthIntro("balance"),
    numpyramid: depthIntro("numpyramid"),
    trail: depthIntro("trail"),
    measure: depthIntro("measure"),
    // "board" for the brief's "stage": the intro wording check rejects "stage".
    checkout: depthIntro("checkout"),
    // "speed points" for the brief's "speed bonus": the intro wording check rejects "speed bonus".
    numline: depthIntro("numline"),
    tendrop: "Points per target. Clear all ten fast, hitting targets with gold tiles, for up to {max}.",

    // Attention
    // Depth to 200 (tapRev 5): depth/speedTexts.ts.
    reaction: FLASH_DEPTH_INTRO,
    stopwatch: BANGON_DEPTH_INTRO,
    numhunt: ASCEND_DEPTH_INTRO,
    chain: CHAIN_DEPTH_INTRO,
    whack: "Points per target hit; combos and diamonds add more, up to {max}. Wrong taps cost.",
    clayshoot: "Points per clay, more for quick hits; doubles and streaks add up to {max}. Birds cost.",
    symscan: eagleEyeDepthIntro(),
    countup: tallyDepthIntro(),
    spotdiff: doubleTakeDepthIntro(),
    pairmatch: PAIR_DEPTH_INTRO,
    maze: labyrinthDepthIntro(),
    stroop: `Sort all ${CLASH_QUEUE}, ${CLASH_DEPTH_MAX_WRONG} wrong at most; gold words and a long streak on a quick run reach {max}.`,

    // Logic and pattern
    unblock: d4IntroTemplate("unblock"),
    lightsout: logicDepthIntro("lightsout"),
    pipes: d4IntroTemplate("pipes"),
    sudoku: logicDepthIntro("sudoku"),
    flow: d4IntroTemplate("flow"),
    iceslide: d4IntroTemplate("iceslide"),
    push: d4IntroTemplate("push"),
    laser: d4IntroTemplate("laser"),
    tower: logicDepthIntro("tower"),
    tubes: logicDepthIntro("tubes"),
    safe: logicDepthIntro("safe"),
    bomb: logicDepthIntro("bomb"),
    gravity: TOPSY_INTRO_SCORE,
    nonogram: logicDepthIntro("nonogram"),
    flood: logicDepthIntro("flood"),
    tiles: JUMBLED_INTRO_SCORE,
    rings: d4IntroTemplate("rings"),
    blockparty: d4IntroTemplate("blockparty"),
    shikaku: logicDepthIntro("shikaku"),
    lightup: logicDepthIntro("lightup"),
    tents: logicDepthIntro("tents"),
    dig: "Fill the drain with clean water for 100, more if you're quick and use few digs.",

    // Arcade
    hover: "Points for each barrier and gold star. Last the whole minute for 10 more.",
    skyline: "Points for blocks, perfects in a row, gold blocks and every 10 floors. Up to {max}.",
    bintoss: `Buckets, hoops, All ${BINTOSS_THROWS} in for 10 more: up to 150. Far buckets +${BINTOSS_FAR_POINTS} each: up to {max}.`,
    bullseye: `Rings ${BULLSEYE_RING_VALUES.join(" / ")}, inner bull ${BULLSEYE_INNER_BULL_POINTS}; balloons +1 to +3. Up to {max}.`,
    matchup: "Longer lines score more; goals, ice, treasure and cascades add more. Up to {max}.",
    snake: "Points per star; gold stars, combos, lane rides and warps add bonus. Up to {max}.",
    cross: "Points for each lane crossed, more for each full crossing. Up to {max}.",
    breaker: "Bricks score; gold and combos add up to 50. Clear all 105 quickly for up to {max}.",
    rally: "Points for each gold-ball hit and pink target. Blue scores nothing. Up to {max}.",
    pinball: "Table points: ramps, J-O-U-L-Z, jackpots and skill shots score big. Up to {max}.",
    bubble: "Clear bubbles; falling chests, bank shots and combos add more. Up to {max}.",
    slice: "Food by combo; gold fruit, tickets and dodges add more. Chilli: lose 10. Up to {max}.",
    beat: "Notes hit in time score; fever, gold notes, double taps and streaks add bonus. Up to {max}.",
    wavefront: "Ships, armour hits, saucers, waves, boss hits. Destroy the boss fast for up to 10 more.",
    flip: "Points for every second you last and each gold star. Last the minute for 10 more.",
    junction: "Points for each car and bus through, ± for ambulances. Last the minute for 10 more.",
    inkbridge: `Points for each level and gold star. All ${INK_LEVELS} levels quickly: up to {max}.`,
    burst: "Points for each atom hit; a lost life takes 5 hits off. Last the 90 s for 10 more.",
    orbit: "Points for each planet you reach. Reach the sun quickly for up to {max}.",
    snip: "Points for fruit fed and leaves; golden apples, par cuts and times add more. Up to {max}.",
    swing: `Points for distance and stars. Reach ${SWING_FINISH_M} metres for 10 more.`,
    tilt: `Points for each maze, how close you get, and stars. All ${TILT_MAX_MAZES} quickly: up to {max}.`,
    balltrack: `Points per marble home; gold, boosted and in-a-row marbles add more. Up to {max}.`,
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
