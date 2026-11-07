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
    wordsmith: "Longer words score more; a bonus for the word using every tile. Up to {max}.",
    wordhunt: "Longer words score more; bonuses for 6+ letters and the gold tile. Up to {max}.",
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
    tendrop: "Hit all ten targets; bonuses for speed and gold tiles. Up to {max}.",

    // Attention
    // Depth to 200 (tapRev 5): depth/speedTexts.ts.
    reaction: FLASH_DEPTH_INTRO,
    stopwatch: BANGON_DEPTH_INTRO,
    // The scoring standard (27 Oct 2026): standard/attentionTexts.ts.
    numhunt: STANDARD_ATTENTION_INTRO.numhunt,
    chain: STANDARD_ATTENTION_INTRO.chain,
    whack: "Hit the targets; bonuses for quick combos and diamonds; wrong taps cost. Up to {max}.",
    clayshoot: "Hit the clays; bonuses for quick hits, doubles and streaks; birds cost. Up to {max}.",
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
    dig: "Fill the drain with clean water for 100, more if you’re quick and use few digs.",

    // Arcade
    // hoverRev 10 (the arcade scoring standard): the five parts and their maximums.
    hover: "Fly through barriers; bonuses for star chains, gold stars and tight gates. Up to {max}.",
    skyline: "Stack floors; bonuses for perfect drops, a perfect streak and gold blocks. Up to {max}.",
    bintoss: "Land throws in the bucket; bonuses for far buckets, hoops and all ten in. Up to {max}.",
    bullseye: "Throw close to the bull; bonuses for bull streaks and dead-centre darts. Up to {max}.",
    // matchupRev 12 (the arcade scoring standard, six goals and six treasures): gems cleared, then treasure, goals, ice
    // and big lines, each part's maximum.
    matchup: "Clear gems; bonuses for treasure, colour goals, ice and big lines. Up to {max}.",
    snake: "Eat stars; bonuses for gold stars, combos, lane rides and warps. Up to {max}.",
    // crossRev 11 (3 Nov 2026): no coins; the no-stop streak; a hit costs 15.
    cross: "Cross again and again; bonuses for no-stop streaks and close calls; hits cost. Up to {max}.",
    breaker: "Break bricks; gold bricks 10 each (30 for all three); a fast clear adds more. Up to {max}.",
    rally: "Hit gold balls back; bonuses for pink pads and gold targets. Up to {max}.",
    // Cards & Board (30 Oct 2026), on the arcade scoring standard.
    minesweeper: "Uncover safe squares; bonuses for no mines hit and a fast clear. Up to {max}.",
    mahjong: "Clear pairs; bonuses for no shuffles and a fast clear. Up to {max}.",
    minigolf: "Sink each hole; bonuses for few strokes, birdies and a fast finish. Up to {max}.",
    pool: "Pot your balls; bonuses for the black, pots in a row and speed; fouls cost. Up to {max}.",
    curling: "Stop stones near the button; bonuses for takeouts, the red ring and shot stone. Up to {max}.",
    pinball: "Score table points; bonuses for J-O-U-L-Z, multiball, jackpots, ramp combos. Up to {max}.",
    homerun: "Hit it far; bonuses for home runs, lit signs and a perfect streak. Up to {max}.",
    freekick: "Score goals; bonuses for targets, bent shots and five in a row. Up to {max}.",
    racing: "Keep your average speed high; a bonus for each clean sector. Up to {max}.",
    // Cards & Board (the arcade scoring standard from their first revision).
    freecell: "Move cards home; bonuses for few moves and speed. Up to {max}.",
    tripeaks: "Clear the peaks; bonuses for peak tops, runs, a clear, few stock cards, speed. Up to {max}.",
    pokersquares: "Make poker hands in every line; a bonus for each made hand. Up to {max}.",
    fivehands: "Make poker hands in five rows, then pick a bonus column. Up to {max}.",
    blockfall: "Clear lines; bonuses for pieces placed, multi-line clears and a low stack. Up to {max}.",
    alleyroll: "Roll into the high cups; bonuses for the gold cup, roll streaks, pockets. Up to {max}.",
    pyramid: "Remove cards in pairs of 13; bonuses for a clear, speed and pyramid pairs. Up to {max}.",
    golfsol: "Clear the cards; bonuses for a full clear, speed and runs of four. Up to {max}.",
    muggins: "Score with the ends; bonuses for clearing your hand, speed and big plays. Up to {max}.",
    bubble: "Clear the reef; bonuses for a fast clear, chests, bank shots and combos. Up to {max}.",
    slice: "Slice food; bonuses for combos, gold fruit, bread and dodges; chillies cost. Up to {max}.",
    beat: "Hit notes on the beat; bonuses for fevers, golden notes, double taps, streaks. Up to {max}.",
    wavefront: "Shoot ships, clear waves; bonuses for a fast boss kill, saucers and cannons. Up to {max}.",
    flip: "Last without crashing; bonuses for landing on sweet spots, double flips, flow. Up to {max}.",
    junction: "Points for each car and bus through, ± for ambulances. Last the minute for 10 more.",
    inkbridge: "Pot every level; bonuses for little ink, trick shots, clovers and speed. Up to {max}.",
    burst: "Pop the atoms; bonuses for fast wave clears and golden atoms; lives cost. Up to {max}.",
    orbit: "Reach planets; bonuses for speed, stardust, slingshots, fields and orbits. Up to {max}.",
    snip: "Points for fruit fed and leaves; golden apples, few cuts and speed add more. Up to {max}.",
    swing: "Swing along the course; bonuses for pars, gates and clean-swing streaks. Up to {max}.",
    // tiltRev 11 (3 Nov 2026): no gold stars; par times and a clean run.
    tilt: "Finish the mazes; bonuses for beating each maze’s time, a clean run and speed. Up to {max}.",
    balltrack: "Get marbles home; bonuses for gold marbles, combos and boosted marbles. Up to {max}.",
    swerve: arcadeOpen("each coin you collect"),
    dual: "The longer both runners survive, the more you score. The full minute is {max}.",
    steady: "Start on {max}. Touching the edge: lose 5.",
    ricochet: "Climb high; bonuses for flow, lantern rides and scrolls. Up to {max}.",
    rooftop: "The longer you last, the more you score. The full minute is {max}.",
    bastion: "Destroy tanks; bonuses for weak spots, fast reloads, drones, a safe base. Up to {max}.",
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
