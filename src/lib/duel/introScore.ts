import { SWING_V17_CORE, SWING_V17_GATES, SWING_V17_GATE_POINTS, SWING_V17_PAR_POINTS, SWING_V17_STREAK_MAX } from "@/lib/arcade/swing";
import { PS_CORE_FULL_V2 } from "@/lib/arcade/cards/pokerSquares";
import { FC_CORE_UNITS_V4, FC_SPEED_FULL_S_V4 } from "@/lib/arcade/cards/freecell";
import { BF_ZONE_CORE_FULL } from "@/lib/arcade/blockfall";
import { AR2_CORE_FULL } from "@/lib/arcade/alleyroll";
import { MOON_CORE_FULL_M } from "@/lib/arcade/ricochetNinja";
import { MG_CORE_FULL } from "@/lib/arcade/cards/muggins";
import { BULLSEYE_INNER_BULL_POINTS, BULLSEYE_RING_VALUES } from "@/lib/arcade/bullseye";
import { BINTOSS_THROWS, BINTOSS_V9_BUCKET, BINTOSS_V9_FAR, BINTOSS_V9_FINISH, BINTOSS_V9_HOOP } from "@/lib/arcade/binToss";
import { INK_V13_CLOVER_MAX, INK_V13_CORE_MAX, INK_V13_PAR_MAX, INK_V13_TRICK_MAX } from "@/lib/arcade/inkBridge";
import { TILT_P_CLEAN_POINTS, TILT_P_MAZE_POINTS, TILT_P_PAR_POINTS, TILT_P_PROGRESS_POINTS, TILT_S_MAZES } from "@/lib/arcade/tilt";
import { bandsIntro } from "./puzzleBandsText";
import { logicStandardIntro } from "./standard/logicText";
import { gridStandardIntro } from "./standard/gridText";
import { wordSearchBonusIntro } from "./wordSearchText";
import { letterWheelJarIntro } from "./letterWheelText";
import { CODEWORD_STRETCH, TILEGRID_STRETCH_TOPUP, stretchIntro, strikeoutDepthIntro } from "./depth/stretchShapes";
import { parBonusIntro } from "./parBonusText";
import { WORD_STANDARD_INTRO } from "./standard/word";
import { preStandardPinned } from "./standard/stamps";
import { PAR_MOVES_MAZE_INTRO, STANDARD_ATTENTION_INTRO } from "./standard/attentionTexts";
import { parMovesDealt } from "./parMoves";
import { BANGON_DEPTH_INTRO, FLASH_DEPTH_INTRO } from "./depth/speedTexts";
import { PAR_MOVES_PATTERN_INTRO, PATTERN_STD_INTRO } from "./standard/patternText";
import { standardNumberIntro } from "./standard/numberText";
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
    wordsmith: "Longer words score more. The word using every tile adds a big bonus; {max} only with it.",
    wordhunt: "Longer words score more; 6+ letters and the gold tile add extra. {max} needs both.",
    // The scoring standard (standard/word.ts); a check that pins the standard off reads the texts of the stamps before it.
    tilegrid: preStandardPinned() ? stretchIntro("tilegrid", TILEGRID_STRETCH_TOPUP) : WORD_STANDARD_INTRO.tilegrid,
    wordslide: preStandardPinned() ? parBonusIntro("wordslide", "moves") : WORD_STANDARD_INTRO.wordslide,
    wordsearch: preStandardPinned() ? wordSearchBonusIntro() : WORD_STANDARD_INTRO.wordsearch,
    letterwheel: preStandardPinned() ? letterWheelJarIntro() : WORD_STANDARD_INTRO.letterwheel,
    strikeout: preStandardPinned() ? strikeoutDepthIntro() : WORD_STANDARD_INTRO.strikeout,
    codeword: preStandardPinned() ? stretchIntro("codeword", CODEWORD_STRETCH) : WORD_STANDARD_INTRO.codeword,
    swapword: preStandardPinned() ? parBonusIntro("swapword", "swaps") : WORD_STANDARD_INTRO.swapword,
    wordfall: "Longer words score more; Qu counts as two letters. {max} for a big haul of words.",

    // Number
    target: standardNumberIntro("target"),
    equation: standardNumberIntro("equation"),
    balance: standardNumberIntro("balance"),
    numpyramid: standardNumberIntro("numpyramid"),
    trail: standardNumberIntro("trail"),
    measure: standardNumberIntro("measure"),
    // "board" for the brief's "stage": the intro wording check rejects "stage".
    checkout: standardNumberIntro("checkout"),
    // "speed points" for the brief's "speed bonus": the intro wording check rejects "speed bonus".
    numline: standardNumberIntro("numline"),
    kakuro: gridStandardIntro("kakuro"),
    tendrop: "Points per target. Clear all ten fast, hitting targets with gold tiles, for up to {max}.",

    // Attention
    // Depth to 200 (tapRev 5): depth/speedTexts.ts.
    reaction: FLASH_DEPTH_INTRO,
    stopwatch: BANGON_DEPTH_INTRO,
    // The scoring standard (27 Oct 2026): standard/attentionTexts.ts.
    numhunt: STANDARD_ATTENTION_INTRO.numhunt,
    chain: STANDARD_ATTENTION_INTRO.chain,
    whack: "Points per target hit; combos and diamonds add more, up to {max}. Wrong taps cost.",
    clayshoot: "Points per clay, more for quick hits; doubles and streaks add up to {max}. Birds cost.",
    symscan: STANDARD_ATTENTION_INTRO.symscan,
    countup: STANDARD_ATTENTION_INTRO.countup,
    spotdiff: STANDARD_ATTENTION_INTRO.spotdiff,
    pairmatch: STANDARD_ATTENTION_INTRO.pairmatch,
    // The puzzle batch of 3 Nov 2026 (parMoves.ts): no stars, par moves.
    maze: parMovesDealt() ? PAR_MOVES_MAZE_INTRO : STANDARD_ATTENTION_INTRO.maze,
    stroop: STANDARD_ATTENTION_INTRO.stroop,

    // Logic and pattern
    unblock: PATTERN_STD_INTRO.unblock,
    lightsout: logicStandardIntro("lightsout"),
    pipes: PATTERN_STD_INTRO.pipes,
    sudoku: logicStandardIntro("sudoku"),
    flow: PATTERN_STD_INTRO.flow,
    iceslide: parMovesDealt() ? PAR_MOVES_PATTERN_INTRO.iceslide : PATTERN_STD_INTRO.iceslide,
    push: PATTERN_STD_INTRO.push,
    laser: PATTERN_STD_INTRO.laser,
    tower: logicStandardIntro("tower"),
    tubes: logicStandardIntro("tubes"),
    safe: logicStandardIntro("safe"),
    bomb: logicStandardIntro("bomb"),
    gravity: parMovesDealt() ? PAR_MOVES_PATTERN_INTRO.gravity : PATTERN_STD_INTRO.gravity,
    nonogram: logicStandardIntro("nonogram"),
    flood: logicStandardIntro("flood"),
    tiles: PATTERN_STD_INTRO.tiles,
    rings: PATTERN_STD_INTRO.rings,
    blockparty: PATTERN_STD_INTRO.blockparty,
    shikaku: logicStandardIntro("shikaku"),
    fences: gridStandardIntro("fences"),
    fillomino: gridStandardIntro("fillomino"),
    bridges: gridStandardIntro("bridges"),
    lightup: logicStandardIntro("lightup"),
    tents: logicStandardIntro("tents"),
    dig: "Fill the drain with clean water for 100, more if you're quick and use few digs.",

    // Arcade
    // hoverRev 10 (the arcade scoring standard): the five parts and their maximums.
    hover: "Points: barriers 120, chains 30, gold stars 20, tight gates 20, centre lines 10 = {max}.",
    skyline: "Floors, perfect drops, a perfect streak and gold blocks. Up to {max}.",
    bintoss: `Buckets ${BINTOSS_V9_BUCKET}, far buckets +${BINTOSS_V9_FAR}, hoops +${BINTOSS_V9_HOOP}. All ${BINTOSS_THROWS} in for ${BINTOSS_V9_FINISH} more: up to {max}.`,
    bullseye: `Rings ${BULLSEYE_RING_VALUES.join(" / ")}, inner bull ${BULLSEYE_INNER_BULL_POINTS}; streaks, dead-centre add more. Up to {max}.`,
    // matchupRev 12 (the arcade scoring standard, six goals and six treasures): gems cleared, then treasure, goals, ice
    // and big lines, each part's maximum.
    matchup: "Gems 108; treasure, goals, ice and lines of 4 or 5 add 92. Up to {max}.",
    snake: "Stars to 120 at 28 (gold stars count 2); gold, combos, lanes, warps add 80. Up to {max}.",
    // crossRev 11 (3 Nov 2026): no coins; the no-stop streak; a hit costs 15.
    cross: "150 for rows and crossings, a no-stop streak 40, close calls 10; hits cost 15. Up to {max}.",
    breaker: "Every brick scores; gold bricks add 30. Clear all 105 quickly for up to {max}.",
    rally: "Gold-ball hits, pink targets and gold targets. Up to {max}.",
    // Cards & Board (30 Oct 2026), on the arcade scoring standard.
    minesweeper: "Safe squares 150, no mines hit 20, a fast clear 30; a mine costs 5. Up to {max}.",
    mahjong: "Pairs 150, no shuffles 20, a fast clear 30; a Shuffle costs 5. Up to {max}.",
    minigolf: "Holes 120, few putts 40, birdies 20, speed 20: up to {max}.",
    pool: "Your set 140 (full at 5), black 10, pots in a row 30, speed 20; fouls −10. Up to {max}.",
    curling: "Stones nearer than the reds 150, takeouts 20, the 4-foot 20, shot stone 10: {max}.",
    pinball: "Table points, plus J-O-U-L-Z sets, multiball, jackpots and ramp combos. Up to {max}.",
    homerun: "Distance not caught, home runs, lit signs and your perfect streak. Up to {max}.",
    freekick: "Goals, targets, curls round the wall, a bonus for bent goals, five in a row. Up to {max}.",
    racing: "Pace (your average speed) 160, clean sectors 40 (5 each). Together {max}.",
    // Cards & Board (the arcade scoring standard from their first revision).
    freecell: `Cards 60 (full at ${FC_CORE_UNITS_V4} units); finished: few moves 50, speed 90 (by ${FC_SPEED_FULL_S_V4} s). Together {max}.`,
    tripeaks: "Cards 80, peak tops 30, run 10; cleared: 10, few stock cards 20, speed 50. Together {max}.",
    pokersquares: `Hand points 160 (full at ${PS_CORE_FULL_V2}); made hands 40 (4 a line). Together {max}.`,
    fivehands: "Five rows plus the column you pick, times 1.4, up to {max}. Pair 15 … straight flush 50.",
    blockfall: `Lines 95 (full at ${BF_ZONE_CORE_FULL}); pieces 65; multi-line clears 24; low stack 16: {max}.`,
    alleyroll: `Ring points 140 (full at ${AR2_CORE_FULL}); gold cup 30; roll streak 20; pockets 10. Total {max}.`,
    pyramid: "Cards 120; cleared 10 and speed 50; pyramid pairs 20 (2 each). Together {max}.",
    golfsol: "Cards 140; all cleared 20 and speed 20; runs of four 20 (4 each). Together {max}.",
    muggins: `Points 150 (full at ${MG_CORE_FULL}); hand cleared 20 and speed 20; big plays 10. Together {max}.`,
    bubble: "Bubbles cleared, a fast clear, falling chests, bank shots and combos. Up to {max}.",
    slice: "Food 120, combos 40, gold fruit 20, tickets 10, dodges 10. Chilli: lose 10. Up to {max}.",
    beat: "Notes hit in time, fevers, golden notes, double taps and a Perfect streak. Up to {max}.",
    wavefront: "Ships, hits, waves, a fast boss kill, saucers, cannons, cores; a lost life −5. Total {max}.",
    flip: "Clean time 100; landing on sweet spots 60; double flips, flow streak 40: total {max}.",
    junction: "Points for each car and bus through, ± for ambulances. Last the minute for 10 more.",
    inkbridge: `Levels ${INK_V13_CORE_MAX}; little ink ${INK_V13_PAR_MAX}, tricks ${INK_V13_TRICK_MAX}, clovers ${INK_V13_CLOVER_MAX}. All 10 levels quickly: up to {max}.`,
    burst: "Atoms up to 140, fast waves 35, golden atoms 25; a lost life costs 5. Up to {max}.",
    orbit: "Planets 130 + sun speed, stardust, slings, fields, perfect orbits. Mind fuel: up to {max}.",
    snip: "Points for fruit fed and leaves; golden apples, few cuts and speed add more. Up to {max}.",
    swing: `90 s. Course (${SWING_V17_CORE}), pars (${SWING_V17_PAR_POINTS}), gates (${SWING_V17_GATES * SWING_V17_GATE_POINTS}), clean-swing streak (${SWING_V17_STREAK_MAX}): up to {max}.`,
    // tiltRev 11 (3 Nov 2026): no gold stars; par times and a clean run.
    tilt: `${TILT_P_MAZE_POINTS + TILT_P_PROGRESS_POINTS} a maze, +${TILT_P_PAR_POINTS} a maze beaten in time, clean run ${TILT_P_CLEAN_POINTS}. All ${TILT_S_MAZES} quickly: up to {max}.`,
    balltrack: `Marbles home 140; gold, boosted and in-a-row marbles add 60: they total up to {max}.`,
    swerve: arcadeOpen("each coin you collect"),
    dual: "The longer both runners survive, the more you score. The full minute is {max}.",
    steady: "Start on {max}. Touching the edge: lose 5.",
    ricochet: `Height 125 (full at ${MOON_CORE_FULL_M} m); flow 30, lantern rides 30, scrolls 15: {max}.`,
    rooftop: "The longer you last, the more you score. The full minute is {max}.",
    bastion: "Armour 110, weak spots 30, fast reloads 20, drones 30, base intact 10: up to {max}.",
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
