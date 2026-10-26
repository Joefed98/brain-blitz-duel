import { bandsHelp, openBandsLine } from "./puzzleBandsText";
import { depthHelp as logicDepthHelp } from "./logicDepthText";
import { wordSearchBonusHelp } from "./wordSearchText";
import { letterWheelJarHelp } from "./letterWheelText";
import { CODEWORD_STRETCH, TILEGRID_STRETCH, stretchHelp, strikeoutDepthHelp } from "./depth/stretchShapes";
import { parBonusHelp } from "./parBonusText";
import { SLIDE_PAR_BONUS } from "./wordSlide";
import { SWAP_PAR_BONUS } from "./swapword";
import { doubleTakeDepthHelp, eagleEyeDepthHelp, tallyDepthHelp } from "./depth/attentionTexts";
import { depthHelp } from "./numberDepthText";
import {
  scoreWordHunt,
  WORDHUNT_FREE_MISSES,
  WORDHUNT_FREE_MISSES_PER_WORD,
  WORDHUNT_MISS_COST_PCT,
  WORDHUNT_REV_TARGET,
  WORDSMITH_V3_CAP,
  WORDSMITH_V3_PANGRAM_BONUS,
  wordsmithV3Words,
} from "./scoring";
import { withPuzzleScoreRev } from "./puzzleScoreRev";
import { WORDHUNT_DEPTH_BASE_MAX, WORDHUNT_DEPTH_BONUS_MAX, WORDHUNT_V3_BASE_CURVE, WORDHUNT_V3_BONUS_CURVE } from "./wordHunt";
import { ascendDepthHelp, bangOnDepthHelp, flashDepthHelp } from "./depth/speedTexts";
import { bandMapTotal, bandOpen, bandUnitsFor } from "@/lib/arcade/scoreBands";
import { TD_GOLD_MAX, TD_GOLD_POINTS, TD_REV3_FREE_RESETS, TD_REV3_RESET_COST, TD_RUN_TICKS, TD_STRETCH_FROM, TD_STRETCH_SPAN, TEN_DROP_DEPTH_REV, TEN_DROP_RAW_REV, tenDropScore } from "@/lib/arcade/tenDrop";
import { CLASH_DEPTH_MAX_WRONG, CLASH_GOLD_POINTS, CLASH_GOLD_STREAK, CLASH_GOLDS, CLASH_GREAT_MAP, CLASH_PACE_ZERO_TICK, CLASH_REV3_RUN_TICKS, CLASH_STREAK_POINTS, CLASH_STRETCH_POINTS } from "@/lib/arcade/colourClash";
import { WHACK_BANDS_MAP, WHACK_COMBO_POINTS, WHACK_DIAMOND_POINTS, WHACK_DIAMONDS, WHACK_QUICK_ZERO_TICKS } from "@/lib/arcade/whack";
import { CLAY_DOUBLE_POINTS, CLAY_DOUBLES, CLAY_QUICK_HIT_MAP, CLAY_QUICK_POINTS, CLAY_STREAK_POINTS } from "@/lib/arcade/clayShoot";
import { WORDFALL_BANDS_MAP } from "@/lib/arcade/wordfall";

/** Nucleus wordsmithRev 3's help numbers: the word points that first reach each score, then the curve's top. */
function wordsmithV3Line(): string {
  const first = (p: number) => RANGE_0_200.find((x) => wordsmithV3Words(x) >= p) ?? null;
  const parts = [70, 100, 130, 150, 165].map((p) => {
    const x = first(p);
    return x === null ? null : `${x} points ≈ ${wordsmithV3Words(x)}`;
  }).filter(Boolean);
  return `${parts.join(", ")}, up to ${WORDSMITH_V3_CAP} at ${first(WORDSMITH_V3_CAP)} points`;
}
const RANGE_0_200 = Array.from({ length: 201 }, (_, i) => i);

/** Search range for the open games' help numbers (word points rising). */
const RANGE_0_80 = Array.from({ length: 81 }, (_, i) => i);
import { CLASH_QUEUE } from "@/lib/arcade/colourClash";
import {
  SKYLINE_STREAK_FROM,
  SKYLINE_STREAK_POINTS,
  SKYLINE_V2_BLOCK_POINTS,
  SKYLINE_V2_PERFECT_POINTS,
  SKYLINE_WIND_FROM,
} from "@/lib/arcade/skyline";
import { JUNC_V2_BUS_POINTS, JUNC_V2_CAR_POINTS, JUNC_V2_SURVIVE_BONUS } from "@/lib/arcade/junction";
import {
  TILT_STARS_PER_MAZE,
  TILT_TWO_FROM,
  TILT_V2_FINISH_BONUS,
  TILT_V2_MAZE_POINTS,
  TILT_V2_PARTIAL_MAX,
  TILT_V2_STAR_POINTS,
} from "@/lib/arcade/tilt";
import { BUB_SPECIAL_BLOCK, BUB_TORPEDO_HITS, BUB_V3_JOKER_BLOCK, BUB_V8_CHESTS, BUB_V8_CHEST_FP, BUB_V8_FEATURE_MAX } from "@/lib/arcade/bubble";
import { MATCHUP_V3_PAR_RAW, MATCHUP_V9_FEATURE_MAX } from "@/lib/arcade/matchup";
import { BT_V7_BALLS, BT_V7_BOOST_STEPS, BT_V7_FEATURE_MAX, BT_V7_LAST_LAND_MIN } from "@/lib/arcade/ballTrack";
import { HOVER_REACHABLE_GATES, HOVER_STARS, HOVER_V2_GATES_SCORE, HOVER_V2_STARS_SCORE } from "@/lib/arcade/hover";
import { WAV_BOSS_HP } from "@/lib/arcade/wavefront";
import { SNAKE_COLS, SNAKE_TALL_ROWS } from "@/lib/arcade/snake";
import {
  PIN_MULT_MAX,
  PIN_PTS_BANK,
  PIN_PTS_BUMPER,
  PIN_PTS_LANE,
  PIN_PTS_LANE_SET,
  PIN_PTS_SLING,
  PIN_PTS_SPIN,
  PIN_PTS_SPIN_LIT,
  PIN_PTS_TARGET,
} from "@/lib/arcade/pinball";
import { BULLSEYE_INNER_BULL_POINTS, BULLSEYE_RING_VALUES } from "@/lib/arcade/bullseye";
import { liveBandHelp } from "@/lib/arcade/liveBands";
import { fillMax, liveRecord, roundMaxFor } from "./roundMax";
import { chainDepthHelp } from "./depth/chain";
import { pairDepthHelp } from "./depth/matchmaker";
import { labyrinthDepthHelp } from "./depth/labyrinth";
import { rev3UnfinishedScore } from "./puzzleScoreRev3";
import { topsyHelpScore } from "./topsy";
import { jumbledHelpScore } from "./jumbled";
import type { PuzzleType } from "./types";

export interface PuzzleInstructionLine {
  action: string;
  detail: string;
  /** Shown only in the "?" help, not on the round intro (keeps the intro to three lines). */
  helpOnly?: boolean;
}

export interface PuzzleInstructions {
  goal: string;
  how: [PuzzleInstructionLine, PuzzleInstructionLine, ...PuzzleInstructionLine[]];
  score: string;
}

function instructionTemplates(): Record<PuzzleType, PuzzleInstructions> {
  return {
    wordsmith: {
      goal: "Make words that use the centre letter.",
      how: [
        { action: "Tap letters,", detail: "then Enter. 4+ letters a word." },
        { action: "Use each tile once.", detail: "No plurals." },
        { action: "Shuffle", detail: "is free; the centre stays put." },
        { action: "Pangram bonus:", detail: `the word using every tile adds ${WORDSMITH_V3_PANGRAM_BONUS}. There's always one.`, helpOnly: true },
        { action: "Tap a selected letter again", detail: "to remove it. Clear empties the word; Enter checks it.", helpOnly: true },
        { action: "No plurals", detail: "or -s verb forms (FINDS, BOXES); words like GLASS are fine.", helpOnly: true },
        { action: "Words are checked", detail: "against a standard British English dictionary.", helpOnly: true },
      ],
      score: `Word points: 4 letters 1, 5 → 2, 6 → 4, 7 → 7, 8 → 11, 9+ → 15. More points, higher score: ${wordsmithV3Line()}. The word that uses every tile (the pangram) adds ${WORDSMITH_V3_PANGRAM_BONUS}: {max} only with it. The counter shows word points.`,
    },
    tilegrid: {
      goal: "Build a mini crossword from your tiles.",
      how: [
        { action: "Tap a tile,", detail: "then a cell to place it." },
        { action: "Every run", detail: "must be a real word of 3+ letters." },
        { action: "Tap Done", detail: "to check. All tiles must connect." },
        { action: "Double-tap a placed tile", detail: "to take it back. Clear empties the grid.", helpOnly: true },
        { action: "Red runs", detail: "need fixing.", helpOnly: true },
        { action: "Words are checked", detail: "against a standard British English dictionary.", helpOnly: true },
      ],
      score: stretchHelp("tilegrid", TILEGRID_STRETCH),
    },
    balance: {
      goal: "Balance each of the four scales.",
      how: [
        { action: "Tap a kettlebell,", detail: "then a notch on the beam." },
        { action: "Further out", detail: "counts for more." },
        { action: "Double-tap a kettlebell", detail: "to put it back." },
        { action: "A 2 on peg 3", detail: "equals a 3 on peg 2.", helpOnly: true },
        { action: "Dark iron weights", detail: "with a lock are fixed.", helpOnly: true },
        { action: "The fourth scale", detail: "is wider: 10 notches, 5 each side, and five weights to hang.", helpOnly: true },
        { action: "Hangs are limited:", detail: "6 / 8 / 10 / 12 hangs on the four scales (the counter). Out of hangs, the scale ends unbalanced and the next one starts.", helpOnly: true },
      ],
      score: depthHelp("balance"),
    },
    wordslide: {
      goal: "Slide rows and columns until every row is a word.",
      how: [
        { action: "Swipe a row or column;", detail: "letters wrap round." },
        { action: "Lock a finished word", detail: "with its padlock." },
        { action: "Finish within par", detail: "moves for a bonus; Undo and Reset count." },
        { action: "Par", detail: "is the number of slides that scrambled the board, shown beside your moves (gold while you are within it).", helpOnly: true },
        { action: "Words are 5 letters.", detail: "Column swipes go around a locked row.", helpOnly: true },
        { action: "Words are checked", detail: "against a standard British English dictionary.", helpOnly: true },
      ],
      score: parBonusHelp("wordslide", SLIDE_PAR_BONUS, "moves", "the par moves"),
    },
    target: {
      goal: "Use the six numbers to make the target.",
      how: [
        { action: "Tap two numbers,", detail: "then + − × or ÷." },
        { action: "Use each number", detail: "once at most." },
        { action: "Every step", detail: "must be a whole number." },
        { action: "Elegance bonus:", detail: "hit the target with 5 numbers, not all 6." },
      ],
      score: depthHelp("target"),
    },
    equation: {
      goal: "Fill the gaps so each equation is true.",
      how: [
        { action: "Tap a gap", detail: "to choose its sign." },
        { action: "Work left to right,", detail: "in the order shown." },
        { action: "Four equations,", detail: "each harder. Next skips." },
        { action: "A true equation", detail: "holds for 1 second, then moves on; the timer keeps running.", helpOnly: true },
        { action: "The last one", detail: "uses division in a harder mix. 90 seconds for all four.", helpOnly: true },
        { action: "3 tries each:", detail: "every full set of signs is a try. After the third wrong one the equation locks; tap Next.", helpOnly: true },
      ],
      score: depthHelp("equation"),
    },
    reaction: {
      goal: "Tap the instant the screen turns gold.",
      how: [
        { action: "Wait for gold;", detail: "it comes 5 to 8 times." },
        { action: "Only a full gold screen", detail: "counts: the rest are traps." },
        { action: "Don't guess:", detail: "early taps are false starts." },
        { action: "Steady hand:", detail: "every reaction close together scores extra." },
        { action: "Traps:", detail: "teal, red or blue; near-gold amber; a gold border only; the word GOLD on a dark screen; half the screen gold.", helpOnly: true },
        { action: "False starts:", detail: "a tap on a trap or the dark screen, or within 0.1 s of the gold (too fast to be real).", helpOnly: true },
      ],
      // Depth to 200 (tapRev 5): the stretched curve and the steady hand (depth/speedTexts.ts).
      score: flashDepthHelp(),
    },
    numhunt: {
      goal: "Tap all 24 numbers from smallest to largest.",
      how: [
        { action: "Find the smallest", detail: "number left and tap it." },
        { action: "Keep going", detail: "until every number is gone." },
        { action: "Untapped numbers", detail: "move every 15 seconds." },
        { action: "Flow:", detail: "quick right taps in a row build a bonus multiplier." },
        { action: "The timer above the board", detail: "counts up to 15 s, then the numbers move and it starts again from 0.", helpOnly: true },
      ],
      score: ascendDepthHelp(),
    },
    stroop: {
      goal: "Steer each falling word into the right gate.",
      how: [
        { action: "◀ ▶, joystick or tap a lane", detail: "to steer." },
        { action: "Swipe down or ▼", detail: "to drop it fast." },
        { action: "Watch the banner:", detail: "the rule swaps every 15 s." },
        { action: "The rule", detail: "is either the ink colour or what the word says.", helpOnly: true },
        { action: "Grey word in a dashed frame:", detail: "don't touch it – let it fall." },
        { action: "Gold-bordered word:", detail: "sort it right for a bonus, doubled on a streak." },
        { action: "Streak:", detail: "words right in a row; the lanes glow brighter as it grows.", helpOnly: true },
        { action: "Sort the last word", detail: `to finish – the run ends when all ${CLASH_QUEUE} are sorted, or at 75 seconds.`, helpOnly: true },
      ],
      score: `All ${CLASH_QUEUE} sorted (or let fall) with at most ${CLASH_DEPTH_MAX_WRONG} wrong is a finish: ${bandMapTotal(CLASH_GREAT_MAP, 120)} as time runs out, rising with the time left (5 off the speed part per wrong word; touching a grey word counts as wrong) to 150 for a quick finish with none wrong. A finish adds up to ${CLASH_GOLDS * CLASH_GOLD_POINTS * 2} for gold words (${CLASH_GOLD_POINTS} each, ${CLASH_GOLD_POINTS * 2} on a streak of ${CLASH_GOLD_STREAK}+), up to ${CLASH_STREAK_POINTS} for your longest streak (all ${CLASH_QUEUE} in a row for the lot) and up to ${CLASH_STRETCH_POINTS} for a clean finish quicker than ${CLASH_REV3_RUN_TICKS / 120} s; the gold and streak points count in full by ${CLASH_REV3_RUN_TICKS / 120} s and fade to none at ${CLASH_PACE_ZERO_TICK / 60} s. {max} only for a quick, clean run with every gold word on a streak. Otherwise words right less words wrong, ${bandMapTotal(CLASH_GREAT_MAP, 110)} at most: 20 scores ${bandMapTotal(CLASH_GREAT_MAP, 70)}, 40 scores ${bandMapTotal(CLASH_GREAT_MAP, 100)}, 46 or more ${bandMapTotal(CLASH_GREAT_MAP, 110)}.`,
    },
    symscan: {
      goal: "Find every eagle that matches the target.",
      how: [
        { action: "Tap each eagle", detail: "facing the target's way." },
        { action: "Press Submit", detail: "to lock the grid." },
        { action: "Three grids,", detail: "each bigger, in 30 seconds." },
        { action: "Grid 3 has two targets:", detail: "tap every eagle facing either one.", helpOnly: true },
      ],
      score: eagleEyeDepthHelp(),
    },
    spotdiff: {
      goal: "Find six differences in each of two pictures.",
      how: [
        { action: "Compare", detail: "the two panels." },
        { action: "Tap a difference", detail: "in either panel." },
        { action: "Sweet shop first,", detail: "then the rock pool; 60 seconds for both." },
        { action: "One picture hides a 7th:", detail: "a shape drawn smaller. Find it before the 6th for a bonus." },
        { action: "Next picture", detail: "moves on early; you can't go back.", helpOnly: true },
      ],
      score: doubleTakeDepthHelp(),
    },
    stopwatch: {
      goal: "Stop the marker in the gold zone, ten times.",
      how: [
        { action: "Tap", detail: "to stop the marker." },
        { action: "Black blind spots", detail: "hide the marker: keep its rhythm." },
        { action: "Each watch", detail: "is a little trickier." },
        { action: "Hit the bright centre line", detail: "for extra; zone stops in a row add more." },
        { action: "From Watch 2:", detail: "blind spots (wider on later watches), some slower sweeps, and two watches run corner to corner.", helpOnly: true },
        { action: "Some targets move:", detail: "stop when they line up. Some watches hide the last third, turn vertical or speed up.", helpOnly: true },
        { action: "The counter drops at the right edge", detail: "from 2 on Watch 1 to 11 on Watch 10.", helpOnly: true },
        { action: "Watches 8-10 wrap", detail: "from the right edge back to the left.", helpOnly: true },
      ],
      // Depth to 200 (tapRev 5): tapRev 4's curve plus the dead-centre line and the zone streak (depth/speedTexts.ts).
      score: bangOnDepthHelp(),
    },
    countup: {
      goal: "Count the shapes each question asks for.",
      how: [
        { action: "Read the question:", detail: "a shape and a colour." },
        { action: "Type the total;", detail: "ENTER goes to the next." },
        { action: "Tray 4 compares:", detail: "how many more of one colour than another?" },
        { action: "Four trays", detail: "share 60 seconds.", helpOnly: true },
        { action: "Colours", detail: "are red, blue, green, purple, pink, orange and white.", helpOnly: true },
      ],
      score: tallyDepthHelp(),
    },
    wordhunt: {
      goal: "Find as many words as you can.",
      how: [
        { action: "Drag or tap", detail: "through touching letters." },
        { action: "Words are 4+ letters;", detail: "plurals count." },
        { action: "6+ letters and the gold tile", detail: "multiply a word's points." },
        { action: "Let go or tap Submit", detail: "to enter a word.", helpOnly: true },
        { action: "Long words:", detail: "6 letters ×1.5, 7 or more ×2. A word through the glowing gold tile scores double (both can stack).", helpOnly: true },
        { action: "Diagonals count.", detail: "Don't reuse a tile in one word.", helpOnly: true },
        { action: "Tapping the last letter again", detail: "also submits the word.", helpOnly: true },
        { action: "Words are checked", detail: "against a standard British English dictionary.", helpOnly: true },
      ],
      // wordHuntRev 3 (word depth, 25 Oct 2026; wordHunt.ts): base points on their curve, the features' extras on theirs.
      score: `Word points: 4 letters 1, 5 → 2, 6 → 4, 7 → 7, 8+ → 11. Base points score up to ${WORDHUNT_DEPTH_BASE_MAX}: ${[18, 27, 44].map((u) => `${u} points ≈ ${bandOpen(WORDHUNT_V3_BASE_CURVE, u)}`).join(", ")}, ${WORDHUNT_DEPTH_BASE_MAX} at ${bandUnitsFor(WORDHUNT_V3_BASE_CURVE, WORDHUNT_DEPTH_BASE_MAX)}. What long words and the gold tile add (6 letters ×1.5, 7+ ×2, through the gold tile ×2) scores up to ${WORDHUNT_DEPTH_BONUS_MAX} more: ${[17, 48].map((u) => `${u} extra ≈ ${bandOpen(WORDHUNT_V3_BONUS_CURVE, u, WORDHUNT_DEPTH_BONUS_MAX)}`).join(", ")}, ${WORDHUNT_DEPTH_BONUS_MAX} at ${bandUnitsFor(WORDHUNT_V3_BONUS_CURVE, WORDHUNT_DEPTH_BONUS_MAX)}; {max} only with both. Tracing lots of non-words costs: ${WORDHUNT_FREE_MISSES} plus ${WORDHUNT_FREE_MISSES_PER_WORD} per word found are free, then ${WORDHUNT_MISS_COST_PCT} % off each. The counter shows word points with their multipliers.`,
    },
    unblock: {
      goal: "Slide the gold block out through the exit.",
      how: [
        { action: "Drag a block", detail: "along its own direction." },
        { action: "Clear a path", detail: "for the gold block." },
      ],
      score: bandsHelp("unblock"),
    },
    blockparty: {
      goal: "Fit all nine pieces into the free squares.",
      how: [
        { action: "Tap a piece", detail: "to rotate it." },
        { action: "Drag it", detail: "onto the board." },
        { action: "Fit every piece", detail: "around the fixed pegs." },
        { action: "Drag a piece's anchor", detail: "onto a free board square.", helpOnly: true },
      ],
      score: bandsHelp("blockparty"),
    },
    lightsout: {
      goal: "Turn every light off.",
      how: [
        { action: "Tap a light", detail: "to flip it and its neighbours." },
        { action: "Plan each press:", detail: "nearby lights change too." },
        { action: "Par:", detail: "all off in the fewest presses scores a bonus." },
        { action: "Neighbours", detail: "are the four lights above, below, left and right.", helpOnly: true },
      ],
      score: logicDepthHelp("lightsout"),
    },
    pipes: {
      goal: "Connect every pipe to the source.",
      how: [
        { action: "Tap a tile", detail: "to rotate its pipe." },
        { action: "Join every opening", detail: "to another pipe." },
        { action: "No leaks", detail: "at the edges." },
      ],
      score: bandsHelp("pipes"),
    },
    sudoku: {
      goal: "Fill the 6 × 6 sudoku grid.",
      how: [
        { action: "Tap a cell,", detail: "then a number." },
        { action: "Use 1-6 once", detail: "in each row, column and box." },
        { action: "Pencil marks", detail: "are for notes." },
        { action: "13 to 15 numbers", detail: "are given, and only one grid fits them.", helpOnly: true },
      ],
      score: logicDepthHelp("sudoku"),
    },
    flow: {
      goal: "Join every colour pair and fill every square.",
      how: [
        { action: "Drag from a dot", detail: "to its partner." },
        { action: "Paths can't cross", detail: "or enter dark walls." },
        { action: "Fill every square", detail: "with a path." },
        { action: "Drag from a loose end", detail: "to carry on; tap a dot to clear its path.", helpOnly: true },
      ],
      score: bandsHelp("flow"),
    },
    iceslide: {
      goal: "Slide the ball to the gold exit.",
      how: [
        { action: "Swipe", detail: "to slide until something stops you." },
        { action: "Arrows turn you;", detail: "avoid the holes." },
        { action: "Portals", detail: "carry you across." },
        { action: "Cracked ice", detail: "breaks after you cross it once.", helpOnly: true },
      ],
      score: bandsHelp("iceslide"),
    },
    push: {
      goal: "Push every crate onto a marked square.",
      how: [
        { action: "Swipe or use the arrows", detail: "to walk." },
        { action: "Walk into a crate", detail: "to push it." },
        { action: "Crates can't be pulled,", detail: "so plan ahead." },
        { action: "The worker", detail: "moves one square at a time and pushes one crate at a time.", helpOnly: true },
      ],
      score: bandsHelp("push"),
    },
    laser: {
      goal: "Light all six gems with one beam.",
      how: [
        { action: "Drag mirrors", detail: "and the splitter onto the grid." },
        { action: "Tap a piece", detail: "to turn it." },
        { action: "Tap FIRE:", detail: "three shots; avoid bombs." },
        { action: "The splitter", detail: "forks the beam across its input axis.", helpOnly: true },
        { action: "Gem arrows:", detail: "marked gems only light from that direction.", helpOnly: true },
      ],
      score: bandsHelp("laser"),
    },
    tower: {
      goal: "Move the whole tower onto the gold post.",
      how: [
        { action: "Tap a post", detail: "to lift its top ring." },
        { action: "Tap another post", detail: "to drop it there." },
        { action: "Never put a ring", detail: "on a smaller one." },
        { action: "Perfect solve:", detail: "the fewest moves (Par) scores a bonus." },
        { action: "Colour shows size.", detail: "Each puzzle has 3 or 4 posts.", helpOnly: true },
      ],
      score: logicDepthHelp("tower"),
    },
    maze: {
      goal: "Draw a path from the start to the exit.",
      how: [
        { action: "Drag", detail: "through the passages." },
        { action: "Walls", detail: "block your way." },
        { action: "Reach the exit", detail: "to finish." },
        { action: "Stars", detail: "on side paths add points if you finish fast." },
        { action: "The path", detail: "moves one neighbouring cell at a time.", helpOnly: true },
      ],
      // Depth to 200 (mazeRev 1): depth/labyrinth.ts.
      score: labyrinthDepthHelp(rev3UnfinishedScore("maze", 0.5)),
    },
    tubes: {
      goal: "Sort the potions so each flask is one colour.",
      how: [
        { action: "Tap a flask", detail: "to lift its top layers." },
        { action: "Tap another", detail: "to pour onto the same colour." },
        { action: "Undo or Reset", detail: "if you get stuck." },
        { action: "Par:", detail: "sort in the fewest pours for a bonus." },
        { action: "Pour", detail: "onto the same colour or an empty flask; as many layers move as fit (5 per flask).", helpOnly: true },
        { action: "A full one-colour flask", detail: "gets a cork.", helpOnly: true },
        { action: "Pours are limited", detail: "(the counter). Undo and Reset don't give a pour back; out of pours, the board ends.", helpOnly: true },
      ],
      score: logicDepthHelp("tubes"),
    },
    safe: {
      goal: "Find the four-digit code that fits every clue.",
      how: [
        { action: "Use the arrows", detail: "to set each dial." },
        { action: "Tap TRY", detail: "to test it: three tries." },
        { action: "Only one code", detail: "fits every clue." },
        { action: "Clean crack:", detail: "open it with tries to spare for a bonus." },
      ],
      score: logicDepthHelp("safe"),
    },
    bomb: {
      goal: "Defuse the bomb in six steps.",
      how: [
        { action: "Read every clue:", detail: "together they fix six steps in one order." },
        { action: "Do the six steps,", detail: "then tap DEFUSE." },
        { action: "One wrong step", detail: "and it explodes." },
        { action: "Clues say", detail: "which step an action is, what comes before or straight after what, and what not to do. \"Before\" means any time earlier.", helpOnly: true },
        { action: "Only one order fits", detail: "the clues together allow exactly one six-step sequence, and every clue is needed.", helpOnly: true },
        { action: "Wires", detail: "are numbered 1-7 from the left.", helpOnly: true },
      ],
      score: logicDepthHelp("bomb"),
    },
    gravity: {
      // gravityRev 3 (the remodel, topsy.ts); stored older rounds keep their own reveal.
      goal: "Tilt to roll every ball into its own hole, three boards in a row.",
      how: [
        { action: "Use the arrows", detail: "to tilt the board." },
        { action: "Every ball rolls", detail: "until it hits a block, the edge or a ball." },
        { action: "A ball drops home", detail: "as it rolls over its own colour's hole." },
        { action: "Roll through a star", detail: "for bonus points." },
        { action: "The rings", detail: "above the board fill as balls go home; a clear board brings the next.", helpOnly: true },
        { action: "Tilts are limited", detail: "on each board (the counter). Undo and Reset don't give a tilt back; out of tilts, the next board comes.", helpOnly: true },
      ],
      score: topsyHelpScore(),
    },
    chain: {
      goal: "Tap 40 charms, following the cycle.",
      how: [
        { action: "Tap the five charms", detail: "at the top in order: shape and colour." },
        { action: "Tap again", detail: "before the gold ring empties." },
        { action: "After link 20,", detail: "go backwards for 5 links." },
        { action: "The lit charm", detail: "in the preview is the one you need next. Each right tap adds a link; one wrong tap ends the chain.", helpOnly: true },
        { action: "Keep momentum", detail: "– 3 s for links 1-13, 2.5 s for 14-26, 2 s for 27-40. The first tap is untimed.", helpOnly: true },
        { action: "Every 5 links", detail: "the board reshuffles with five new charms.", helpOnly: true },
        { action: "Reverse:", detail: "a banner warns from link 17; links 21-25 run last to first (the arrows point back).", helpOnly: true },
        { action: "Watch for look-alikes:", detail: "right shape, wrong colour.", helpOnly: true },
        // Depth to 200 (chainDepthRev 1): the milestones, one short line.
        { action: "Milestones:", detail: "10, 20 and 30 links in a row score extra when quick." },
      ],
      score: chainDepthHelp(rev3UnfinishedScore("chain", 0.5)),
    },
    nonogram: {
      goal: "Fill cells so every line matches its numbers.",
      how: [
        { action: "Tap a cell", detail: "to fill it; again to mark it empty." },
        { action: "The numbers", detail: "are the filled runs, in order." },
        { action: "A line dims", detail: "once it matches." },
      ],
      score: logicDepthHelp("nonogram"),
    },
    pairmatch: {
      goal: "Find all fifteen pairs.",
      how: [
        { action: "Tap two cards", detail: "to turn them over." },
        { action: "A match stays up;", detail: "a miss flips back." },
        { action: "Remember", detail: "where each card was." },
        // Depth to 200 (pairRev 1): the streak and the gold pair, one short line.
        { action: "Bonus:", detail: "match in a row for a streak; find the gold pair early." },
      ],
      score: pairDepthHelp(bandsHelp("pairmatch"), roundMaxFor("pairmatch")),
    },
    flood: {
      goal: "Flood the whole board with one colour.",
      how: [
        { action: "Tap a colour", detail: "to repaint your region." },
        { action: "Your region grows", detail: "into touching cells of it." },
        { action: "You start", detail: "from the top-left corner." },
        { action: "Moves are limited:", detail: "par + 2 (the counter). Out of moves, the board ends and scores 0.", helpOnly: true },
      ],
      score: logicDepthHelp("flood"),
    },
    tiles: {
      // tilesRev 3 (the remodel, jumbled.ts).
      goal: "Slide rows and columns to rebuild the colour gradient.",
      how: [
        { action: "Swipe a row", detail: "left or right, or a column up or down." },
        { action: "Tiles wrap round", detail: "the line; there is no gap." },
        { action: "The four corners", detail: "(dotted) never move: their lines slide round them." },
        { action: "Tiles in place", detail: "glow softly.", helpOnly: true },
        { action: "Par", detail: "is shown with your moves; every slide counts, undone ones too.", helpOnly: true },
      ],
      score: jumbledHelpScore(),
    },
    rings: {
      goal: "Turn the rings until every spoke is one colour.",
      how: [
        { action: "Tap a ring,", detail: "then turn it with the arrows." },
        { action: "The legend", detail: "shows which rings turn together." },
        { action: "A strobe dot lights", detail: "for each finished spoke." },
        { action: "Linked rings", detail: "turn the same way or the opposite way.", helpOnly: true },
        { action: "The selected ring", detail: "glows and the needle touches its edge.", helpOnly: true },
      ],
      score: bandsHelp("rings"),
    },
    hover: {
      goal: "Fly through the barrier gaps.",
      how: [
        { action: "Tap to hover up;", detail: "let go to drop." },
        { action: "Touch gold stars", detail: "in tight gaps for a bonus." },
        { action: "Later barriers", detail: "have two gaps, or slide." },
        { action: "Hit anything", detail: "and the run ends. Gold stars sit near the edge of a gap, so they are risky.", helpOnly: true },
        { action: "Two-gap barriers:", detail: "fly through either gap. Sliding barriers move slowly and steadily up and down.", helpOnly: true },
        { action: "Taller sky:", detail: "the flight area fills your screen, and gaps sit anywhere from near the top to near the bottom. The faint stars behind are scenery only.", helpOnly: true },
        { action: "Everyone flies", detail: `the same course for sixty seconds: ${HOVER_REACHABLE_GATES} barriers in a clean run and ${HOVER_STARS} gold stars.`, helpOnly: true },
      ],
      score: liveBandHelp("hover", `Each of the ${HOVER_REACHABLE_GATES} barriers counts 3 and each gold star 2.`, { more: "More barriers and stars", good: (u) => `counts ${u} – about ${Math.round(u / 3)} barriers`, finish: "Lasting the minute adds 10." }),
    },
    swerve: {
      goal: "Collect coins while dodging the blocks.",
      how: [
        { action: "Tap left or right", detail: "to swerve one lane across five lanes." },
        { action: "Hit a block", detail: "and the run ends." },
        { action: "Every coin", detail: "speeds the course up a little." },
      ],
      score: "75 coins in the run; 2 per coin, so all 75 = 150.",
    },
    skyline: {
      goal: "Stack blocks as high as you can.",
      how: [
        { action: "Tap to drop", detail: "the sliding block on the tower." },
        { action: "Perfect drops in a row", detail: "earn a streak bonus." },
        { action: "From block 20", detail: "a waving flag warns of wind." },
        { action: "Overhang is cut", detail: "so the next block is narrower. Line it up exactly (a perfect drop) and the block grows back a little.", helpOnly: true },
        { action: "Streak:", detail: `from the ${SKYLINE_STREAK_FROM}rd perfect drop in a row, every perfect drop scores ${SKYLINE_STREAK_POINTS} bonus point. A drop that isn't perfect resets the streak.`, helpOnly: true },
        { action: "Wind:", detail: `once ${SKYLINE_WIND_FROM} blocks are placed, a flag flies from the top block. Still flag: no wind. It starts waving about a second before a gust and streams the way the gust blows. Every gust is the same strength and nudges the sliding block that way while it blows.`, helpOnly: true },
        { action: "Taller view:", detail: "you see more of the tower and sky before the camera pulls back.", helpOnly: true },
        { action: "Everyone", detail: "gets the same gusts at the same moments.", helpOnly: true },
      ],
      score: liveBandHelp("skyline", "Each block and each perfect drop counts 5, and each streak point 2 (a streak point for each perfect drop from the 3rd in a row).", { more: "More blocks and perfect drops", good: (u) => `counts ${u} – about ${Math.round(u / 5)} blocks` }),
    },
    bintoss: {
      goal: "Throw the ball into the bucket.",
      how: [
        { action: "Drag to aim,", detail: "then let go to throw." },
        { action: "Wind 1 = a quarter bucket.", detail: "Aim into the wind." },
        { action: "Through the hoop, then in:", detail: "+3 bonus." },
        {
          action: "Each wind point moves the ball a quarter of a bucket width.",
          detail: "Wind 2 to the left? Aim half a bucket width to the right.",
          helpOnly: true,
        },
        { action: "The bucket moves", detail: "further away every throw, and gets narrower from throw 4.", helpOnly: true },
        { action: "From throw 7 the bucket slides", detail: "side to side – time your release.", helpOnly: true },
        {
          action: "Hoops:",
          detail: "on three of throws 2-5 a hoop hangs above the bucket. Go down through it and into the bucket for 3 bonus points. Its gold ends bounce the ball away.",
          helpOnly: true,
        },
        {
          action: "Spinners:",
          detail: "on three of throws 6-10 a paddle turns in front of the bucket at a steady speed. Time your throw past it, or lob high over it.",
          helpOnly: true,
        },
        { action: "Drag down to the cancel strip", detail: "to put a throw back.", helpOnly: true },
      ],
      score: liveBandHelp("bintoss", "Each bucket counts 10 and each hoop bonus 3.", { more: "More buckets and hoops", good: (u) => `counts ${u} – about ${Math.round(u / 10)} buckets`, finish: "All ten in adds 10." }),
    },
    bullseye: {
      goal: "Hit the centre – ten darts.",
      how: [
        { action: "Drag to aim,", detail: "let go to throw." },
        { action: "Wind 2?", detail: "Aim two rings into the wind." },
        { action: "Inner bull 12.", detail: "Balloons add +1, +2 or +3." },
        {
          action: "Touch and drag to aim:",
          detail: "the dotted path shows where the dart will land.",
          helpOnly: true,
        },
        {
          action: "Your aim sways – watch the ring and release at the right moment.",
          detail: "The ring circles once every two seconds.",
          helpOnly: true,
        },
        {
          action: "The wind moves your dart by that many rings.",
          detail: "Wind 2 to the right? Aim two rings to the left.",
          helpOnly: true,
        },
        { action: "The target", detail: "gets further away each throw.", helpOnly: true },
        { action: "From the fourth dart the target moves – lead it.", detail: "It is scored where it is when the dart lands.", helpOnly: true },
        { action: "From the seventh dart the ring values swap places.", detail: "Read the numbers – each value keeps its colour.", helpOnly: true },
        {
          action: "Inner bull:",
          detail: "the small pale spot in the middle of the 10 ring scores 12 instead of 10. It shows whenever the 10 is the centre ring.",
          helpOnly: true,
        },
        {
          action: "Balloons:",
          detail: "on three of darts 3-10 a balloon flies back and forth across the board itself, moving with it: +1 green (slowest), +2 blue (a little faster), +3 purple (fastest). A dart that passes through a balloon pops it and scores its value, then carries on and also scores the ring it lands in.",
          helpOnly: true,
        },
      ],
      score: liveBandHelp("bullseye", `Your dart total: rings ${BULLSEYE_RING_VALUES.join(" / ")} from the centre out (the inner bull ${BULLSEYE_INNER_BULL_POINTS}), plus +1, +2 or +3 for each balloon popped on the way in.`, { more: "A higher dart total", good: (u) => `totals ${u}` }),
    },
    matchup: {
      goal: "Match gems to meet each goal.",
      how: [
        { action: "Swap neighbours;", detail: "collect the goal's colours." },
        { action: "Match on frozen gems", detail: "to break the ice." },
        { action: "Clear below treasure", detail: "to bring it down." },
        { action: "4, 5 or an L / T", detail: "makes a bomb or a star; 5 plus an L / T in one swap makes a jackpot.", helpOnly: true },
        { action: "Each level", detail: "asks for a count of two or three colours (shown under the board); meet it and the next level starts, with more ice.", helpOnly: true },
        { action: "A frozen gem", detail: "can't be swapped. Clear it in a line, a cascade or a blast and the ice breaks.", helpOnly: true },
        { action: "A treasure gem", detail: "can't be matched, swapped or blasted: it falls as the gems under it clear and is collected on the bottom row.", helpOnly: true },
        { action: "Cascades multiply:", detail: "each step after a swap's own clear counts ×2, ×3 and so on.", helpOnly: true },
        { action: "Drag one gem onto its neighbour", detail: "to swap them. Matched gems clear and new ones fall in; your next swap waits until the board has settled.", helpOnly: true },
        { action: "Line of 4: a bomb", detail: "(clears around it). Line of 5: a white four-point star (its row and column). An L or T: a six-point star (both diagonals).", helpOnly: true },
        { action: "A line of 5 and an L / T in one swap", detail: "makes a jackpot gem: it clears every gem of its colour plus its row and column.", helpOnly: true },
        { action: "Specials", detail: "go off when you swap them or match next to them, and set each other off.", helpOnly: true },
        { action: "Sixty seconds", detail: "on the same board for everyone; new gems drop from the same fixed queues.", helpOnly: true },
      ],
      score: liveBandHelp("matchup", `Match points: longer lines, cascades and special gems score more. Goals met, ice broken, treasure collected and the cascade multiplier add up to ${MATCHUP_V9_FEATURE_MAX} more.`, { more: "More match points", good: (u) => `scores ${u.toLocaleString("en-GB")} match points` }),
    },
    snake: {
      goal: "Eat the stars; don't crash.",
      how: [
        { action: "Swipe to turn.", detail: "Stars grow and speed you up." },
        { action: "Red shadow?", detail: "A rock lands there in 2 s." },
        { action: "At 20 stars,", detail: "a meteor shower drops 3 rocks!" },
        { action: "Rocks hit only your head.", detail: "A rock on your tail does nothing, and your tail passes through rocks.", helpOnly: true },
        { action: "Rocks start at length 9:", detail: "one more every 4 stars, up to 11. Stars never appear on a rock.", helpOnly: true },
        { action: "The meteor shower", detail: "comes once, when you reach 20 stars: three red shadows, then three rocks land together 2 s later. With the shower, at most 14 rocks.", helpOnly: true },
        { action: "Hit a wall, your tail or a rock with your head", detail: "and the run ends.", helpOnly: true },
        { action: "Taller grid:", detail: `${SNAKE_COLS} squares across and ${SNAKE_TALL_ROWS} down, so stars can be further away.`, helpOnly: true },
        { action: "Everyone gets", detail: "the same stars, and every rock lands on the same square at the same moment.", helpOnly: true },
      ],
      score: liveBandHelp("snake", "Each star eaten counts 1.", { more: "More stars", good: (u) => `eats ${u} stars` }),
    },
    cross: {
      goal: "Get across the traffic as many times as you can.",
      how: [
        { action: "Swipe to hop.", detail: "Up goes forward; down and sideways step." },
        { action: "Bikes from crossing 3,", detail: "cones from 4: find the gap." },
        { action: "Bikes race along the green lanes;", detail: "cones block part of the road.", helpOnly: true },
        { action: "Three lives.", detail: "A hit sends you back to the start of this crossing." },
        { action: "The first two crossings", detail: "always leave wide gaps in every lane. Later traffic is tighter and faster.", helpOnly: true },
        { action: "After each crossing", detail: "you get a second on the kerb before the next one.", helpOnly: true },
        { action: "Only the walker counts:", detail: "traffic has to touch the figure itself (its arms' reach), not the space around it.", helpOnly: true },
      ],
      score: liveBandHelp("cross", "Each lane crossed counts 1 and each full crossing 2 more.", { more: "More lanes and crossings" }),
    },
    dual: {
      goal: "Keep both runners alive.",
      how: [
        { action: "Left thumb jumps", detail: "the left runner." },
        {
          action: "Right thumb jumps",
          detail: "the right runner. Tap again in the air to double jump.",
        },
        { action: "Same course", detail: "for everyone." },
      ],
      score: "The longer both survive, the more you score: all 60 seconds = 150, 45 s ≈ 84, 30 s ≈ 37.",
    },
    breaker: {
      goal: "Clear the wall.",
      how: [
        { action: "Drag the paddle;", detail: "tap to fire a power-up." },
        { action: "Catch power-ups:", detail: "laser, ×3, ×2, Fireball." },
        { action: "From 30 s, two rows", detail: "slide side to side." },
        { action: "Keep the ball up", detail: "– it gets faster with bricks and with time. Losing the last ball costs 3 seconds.", helpOnly: true },
        { action: "Cracked bricks take 2 or 3 hits", detail: "– each hit cracks them further.", helpOnly: true },
        { action: "Four starred bricks drop a capsule.", detail: "Tap anywhere to fire a laser or ×3 you've caught; any longer touch moves the paddle.", helpOnly: true },
        { action: "Green L = laser:", detail: "one beam straight up from the paddle that hits the first 4 bricks above it.", helpOnly: true },
        { action: "Silver ×3 = three shots:", detail: "each tap fires an extra ball straight up; it vanishes at the first wall it hits.", helpOnly: true },
        { action: "Bronze ×2 = double balls", detail: "at once. There is one per board.", helpOnly: true },
        { action: "Orange flame = Fireball:", detail: "for 2.5 seconds your balls smash straight through bricks without bouncing.", helpOnly: true },
        { action: "Sliding rows:", detail: "one row starts at 30 s and another at 60 s, half a brick each way, slowly and always the same.", helpOnly: true },
      ],
      score: liveBandHelp("breaker", "Each brick destroyed counts 1.", { more: "More bricks", good: (u) => `clears ${u} bricks`, finish: "Clearing all 80 adds up to 10 for speed: the full 10 with at least half the time left, falling to 0 at the buzzer." }),
    },
    pinball: {
      goal: "Keep the ball in play and rack up table points.",
      how: [
        { action: "Hold left or right", detail: "to flip; both thumbs for both." },
        { action: "Hold the left or right half", detail: "of the screen to raise that flipper; two thumbs raise both.", helpOnly: true },
        { action: "Three balls, one minute:", detail: "a lost ball relaunches by itself." },
        { action: "Bumpers, targets, spinner", detail: "and lit lanes all score." },
        { action: "One table for everyone,", detail: "with no luck in it: each ball launches up the right-hand lane at its own fixed strength.", helpOnly: true },
        { action: "Pink pop bumpers:", detail: `${PIN_PTS_BUMPER} a hit, and they kick the ball away.`, helpOnly: true },
        { action: "Orange drop targets:", detail: `${PIN_PTS_TARGET} each. Knock all four down for ${PIN_PTS_BANK.toLocaleString("en-GB")} more and a lit spinner for 15 seconds.`, helpOnly: true },
        { action: "Spinner in the left lane:", detail: `${PIN_PTS_SPIN} a turn, ${PIN_PTS_SPIN_LIT} while lit. A faster ball spins it more.`, helpOnly: true },
        { action: "Three top lanes:", detail: `${PIN_PTS_LANE} for lighting each one. Light all three for ${PIN_PTS_LANE_SET.toLocaleString("en-GB")} and the next multiplier (up to ×${PIN_MULT_MAX}), which counts on everything after. Each flipper press shifts the lit lanes, so you can line a dark lane up under the ball.`, helpOnly: true },
        { action: "Yellow slingshots", detail: `kick the ball back across (${PIN_PTS_SLING} each).`, helpOnly: true },
        { action: "A ball between the flippers drains.", detail: "Hold a flipper up to catch the ball on it, then let go and flip again to aim.", helpOnly: true },
      ],
      score: liveBandHelp("pinball", "Your table points count, multiplier included.", { more: "More table points", good: (u) => `scores ${u.toLocaleString("en-GB")} table points` }),
    },
    rally: {
      goal: "Keep the rally going.",
      how: [
        { action: "Drag the paddle.", detail: "Miss the blue ball: over." },
        { action: "Only gold balls score:", detail: "5 a paddle hit." },
        { action: "Gold on a pink wall pad:", detail: "6 a hit." },
        { action: "Drag to move the paddle", detail: "along the bottom.", helpOnly: true },
        { action: "Every hit", detail: "makes the paddle smaller and the ball faster.", helpOnly: true },
        { action: "A gold ball drops in", detail: "every ten seconds – only gold balls score.", helpOnly: true },
        { action: "Two pink target pads", detail: "sit on the far wall, one in each half. A gold ball that hits one counts 6, and the pad moves somewhere new in its own half, so the two never overlap.", helpOnly: true },
        { action: "From 30 seconds a bumper", detail: "appears mid-court (it blinks a warning first). Balls bounce off it like a mirror, at the same speed.", helpOnly: true },
        { action: "For the last 15 seconds", detail: "a second bumper joins it (from 45 s, with the same blinking warning), always far enough away for a ball to pass between them.", helpOnly: true },
        { action: "Miss the blue ball", detail: "and the run is over.", helpOnly: true },
      ],
      score: liveBandHelp("rally", "Each gold-ball hit counts 5 and each pink target 6. The blue ball scores nothing; losing it ends the run.", { more: "More gold hits and pink targets", good: (u) => `counts ${u} – about ${Math.round(u / 5)} gold-ball hits` }),
    },

    steady: {
      goal: "Stay inside the track.",
      how: [
        {
          action: "Slide the ball left and right",
          detail: "to stay inside the track. It gets narrower and faster.",
        },
        { action: "Touching an edge", detail: "costs a touch every half second until you're back inside." },
        { action: "Keep your finger down", detail: "– lifting it for more than half a second costs touches too." },
      ],
      score: "150 − 5 per touch.",
    },
    slice: {
      goal: "Slice the flying food. Don't cut the chillies.",
      how: [
        { action: "Swipe through food.", detail: "3+ in one swipe: combo ×2, ×3." },
        { action: "Never cut a chilli:", detail: "it costs 10 points and ends your combo." },
        { action: "Cut a bottle:", detail: "ketchup, mustard or mayo power-up." },
        { action: "Bottles:", detail: "ketchup stops chillies, mustard slows time, mayo pulls food together.", helpOnly: true },
        { action: "Saucy (ketchup): 3 chilli-free seconds.", detail: "Simmer (mustard): 4 slow seconds. Squeeze (mayo): nearby food gathers where you cut it.", helpOnly: true },
        { action: "One finger-down-to-up path counts together", detail: "– curves too, up to the full height of the screen. Each combo resets a 10-second timer.", helpOnly: true },
      ],
      score: liveBandHelp("slice", "Combo-weighted slices out of the most the run offers (every food at ×3), in thousandths. Each chilli then costs 10 and ends the combo.", { more: "More combo slices", good: (u) => `reaches ${u}` }),
    },
    bubble: {
      goal: "Pop threes and free the treasure.",
      how: [
        { action: "Drag to aim,", detail: "let go to shoot." },
        { action: "Chests pay", detail: "only when they fall with a cluster." },
        { action: "Bank off walls;", detail: "pop back to back for combos." },
        { action: "Crown Joker", detail: "matches any colour. Mines blast; torpedoes drill where aimed.", helpOnly: true },
        { action: `${BUB_V8_CHESTS} treasure chests`, detail: "sit in the reef. Nothing matches a chest: cut what holds it up so it falls. A mine or torpedo that destroys one pays nothing.", helpOnly: true },
        { action: "A bank shot", detail: "comes off a wall before it pops anything; every popping shot straight after another is a combo.", helpOnly: true },
        { action: "Three of a colour pop", detail: "when they touch; bubbles left hanging fall. Bounce shots off the walls.", helpOnly: true },
        { action: "The Joker (a black bubble with a gold crown and a rainbow rim)", detail: "joins every colour it touches and pops each group that reaches three. A mine clears the bubbles around it.", helpOnly: true },
        { action: "A torpedo never sticks:", detail: `it flies where you aim it, bank shots included, and destroys up to ${BUB_TORPEDO_HITS} bubbles it runs into on the way up. Bubbles left hanging then fall.`, helpOnly: true },
        { action: "Specials come in the queue:", detail: `a Joker every ${BUB_V3_JOKER_BLOCK} shots or so, and one mine or torpedo somewhere in the first ${BUB_SPECIAL_BLOCK}.`, helpOnly: true },
        { action: "Ninety seconds", detail: "on the same field and queue for everyone.", helpOnly: true },
      ],
      score: liveBandHelp("bubble", "Each bubble cleared from the reef counts 1.", { more: "More bubbles cleared", good: (u) => `clears ${u} bubbles`, finish: `Clearing the reef adds up to 10 for speed. Chests that fall (${BUB_V8_CHEST_FP} each), bank shots and combos add up to ${BUB_V8_FEATURE_MAX} more.` }),
    },
    beat: {
      goal: "Tap the notes in time.",
      how: [
        { action: "Tap a lane", detail: "as its note reaches the line." },
        { action: "Tail notes:", detail: "hold, let go at the end." },
        { action: "Arrow notes:", detail: "swipe that way on the line." },
        { action: "Closer is better", detail: "– perfect, good, or just OK.", helpOnly: true },
        { action: "A tap with no note", detail: "costs nothing.", helpOnly: true },
        { action: "Notes with a tail are holds", detail: "– press as the head reaches the line, release as the tail reaches it. Both ends must be Perfect for Perfect, or within Good for Good; otherwise Miss.", helpOnly: true },
        { action: "Swipe notes (from 30 seconds)", detail: "show a left or right arrow. Flick your finger that way in the lane as the note reaches the line. A plain tap won't hit them, and the wrong way is a miss.", helpOnly: true },
        { action: "Keep a combo going", detail: "to light up the lanes at 10, 25 and 50 – a miss resets it.", helpOnly: true },
      ],
      score: liveBandHelp("beat", "Perfect counts 4, Good 3, OK 1 and a missed note −2, out of 4 a note, in thousandths of the chart.", { more: "More notes, closer to the beat", good: (u) => `reaches ${u}` }),
    },

    ricochet: {
      goal: "Climb the shaft by leaping wall to wall.",
      how: [
        { action: "Tap to jump across", detail: "to the opposite wall." },
        { action: "Don't land on the spikes", detail: "or the run ends." },
        { action: "Don't slide", detail: "all the way back to the bottom." },
      ],
      score: "2 points per metre climbed, up to {max}.",
    },
    wordfall: {
      goal: "Make words to clear the falling letters.",
      how: [
        { action: "Tap touching tiles", detail: "to spell a word." },
        { action: "Tap the last again or Enter;", detail: "3+ letters." },
        { action: "Don't let a column", detail: "overflow." },
        { action: "Touching", detail: "means any of 8 directions; each tile once.", helpOnly: true },
        { action: "A real word", detail: "clears its tiles; tiles above fall.", helpOnly: true },
        { action: "Not a word?", detail: "The tiles shake and the chain clears – no penalty.", helpOnly: true },
        { action: "Tiles drop faster", detail: "every 18 seconds; Qu counts as two letters.", helpOnly: true },
        { action: "If a new tile can't fit", detail: "into a full column, the run ends.", helpOnly: true },
      ],
      score: `Longer words score more. Overflow a column and the run ends. Word points: 3 letters 1, 4 = 2, 5 = 4, 6 = 7, 7+ = 11 (a Qu tile counts as two letters). More points, higher score: 21 points ≈ ${bandMapTotal(WORDFALL_BANDS_MAP, 21)}, 31 ≈ ${bandMapTotal(WORDFALL_BANDS_MAP, 31)}, 35 ≈ ${bandMapTotal(WORDFALL_BANDS_MAP, 35)}, 40 ≈ ${bandMapTotal(WORDFALL_BANDS_MAP, 40)}, 150 at 46.`,
    },
    tendrop: {
      goal: "Make the running total hit each target.",
      how: [
        { action: "Tap falling tiles", detail: "to apply them to the total." },
        { action: "×2, ÷2, ÷3 and −N", detail: "change the total." },
        { action: "Overshoot", detail: "and the total drops to 0." },
        { action: "Gold tiles:", detail: "hit a target with one for bonus points." },
        { action: "Tiles apply", detail: "in the order you tap them.", helpOnly: true },
        { action: "A ÷ that doesn't divide exactly", detail: "is refused.", helpOnly: true },
      ],
      // tenRev 4 (the dealt stamp): tenRev 3's unfinished score; a finish to the game's maximum.
      score: `Unfinished: targets hit, about ${tenDropScore(1, TD_RUN_TICKS, TEN_DROP_DEPTH_REV)} for the first and ${tenDropScore(9, TD_RUN_TICKS, TEN_DROP_DEPTH_REV)} for nine (−${TD_REV3_RESET_COST} per reset after the first ${TD_REV3_FREE_RESETS}). All ten: ${tenDropScore(10, TD_RUN_TICKS, TEN_DROP_DEPTH_REV)} if the last clears as time runs out, rising the earlier it clears: ${tenDropScore(10, TD_RUN_TICKS - TD_STRETCH_FROM, TEN_DROP_DEPTH_REV)} at ${Math.round((TD_RUN_TICKS - TD_STRETCH_FROM) / 60)} s, ${tenDropScore(10, TD_RUN_TICKS - TD_STRETCH_FROM - TD_STRETCH_SPAN, TEN_DROP_DEPTH_REV)} at ${Math.round((TD_RUN_TICKS - TD_STRETCH_FROM - TD_STRETCH_SPAN) / 60)} s, ${tenDropScore(10, TD_RUN_TICKS / 2, TEN_DROP_DEPTH_REV)} by ${TD_RUN_TICKS / 120} s. Each target hit exactly with a gold tile adds ${TD_GOLD_POINTS} on a finish (up to ${TD_GOLD_MAX}), so {max} takes all ten by ${TD_RUN_TICKS / 120} s and ${TD_GOLD_MAX / TD_GOLD_POINTS} gold targets.`,
    },
    clayshoot: {
      goal: "Shoot all 25 clays without hitting a bird.",
      how: [
        { action: "Tap a clay", detail: "to shoot exactly there." },
        { action: "Gold clays", detail: "are faster and worth double." },
        { action: "Don't shoot", detail: "the 14-16 white birds." },
        { action: "Unlimited shots,", detail: "no reload.", helpOnly: true },
        { action: "Later on, two fly at once", detail: "– keep watching both edges.", helpOnly: true },
        { action: "Each bird hit", detail: "costs 10.", helpOnly: true },
        { action: "Aim, don't spray:", detail: "30 shots that hit nothing are free, then every 20 more cost 1.", helpOnly: true },
        { action: "Doubles and streaks:", detail: "hit both clays of a pair, and clays in a row, for bonuses." },
        { action: "The hit streak", detail: "grows ×2 from the 5th clay in a row, ×3 from the 10th, ×4 from the 15th; a clay that gets away or a bird ends it.", helpOnly: true },
      ],
      score: `5 per orange, 10 per gold, −10 per bird, −1 per 20 shots that hit nothing after the first 30; all 25 with zero birds hit adds 10. That total gives up to ${bandMapTotal(CLAY_QUICK_HIT_MAP, 150)}: 88 gives ${bandMapTotal(CLAY_QUICK_HIT_MAP, 88)}, 125 gives ${bandMapTotal(CLAY_QUICK_HIT_MAP, 125)}. Quick hits add up to ${CLAY_QUICK_POINTS} more: a clay hit within a quarter of a second of its launch earns its full share, none after about 0.37 s; a perfect, quick run is 150. Past that: up to ${CLAY_DOUBLE_POINTS * CLAY_DOUBLES} for the ${CLAY_DOUBLES} doubles and ${CLAY_STREAK_POINTS} for one streak through all 25, both paid by how quick your hits were. {max} only for a perfect, quick run with every double and an unbroken streak.`,
    },
    whack: {
      goal: "Bonk gophers whose hats match the banner.",
      how: [
        { action: "Tap a gopher", detail: "in the banner's hat colour." },
        { action: "The rule flips", detail: "3-5 times: watch the banner." },
        { action: "Never tap", detail: "a hedgehog." },
        { action: "Gophers pop up briefly", detail: "– the window shrinks as the run goes on.", helpOnly: true },
        { action: "Hedgehogs cost 5;", detail: "a wrong-colour hat or an empty burrow costs 3.", helpOnly: true },
        { action: "Combo and diamonds:", detail: "right hits in a row multiply; tap the rare diamond fast." },
        { action: "The gold combo", detail: "grows ×2 from the 6th right hit in a row, ×3 from the 11th, ×4 from the 16th; a wrong hat, a hedgehog or an empty burrow ends it (a gopher left to sink does not).", helpOnly: true },
      ],
      score: `Up to 135 for the share of targets hit, −3 per wrong hat, −5 per hedgehog, −3 per empty tap, +15 for hitting every target; that total sets the first 150: 62 scores ${bandMapTotal(WHACK_BANDS_MAP, 62)}, 102 scores ${bandMapTotal(WHACK_BANDS_MAP, 102)}, 118 scores ${bandMapTotal(WHACK_BANDS_MAP, 118)}, 133 scores ${bandMapTotal(WHACK_BANDS_MAP, 133)}, a perfect run 150. The combo adds up to ${WHACK_COMBO_POINTS} for long unbroken runs of very quick hits (slower hits count less, none after about ${Math.round((WHACK_QUICK_ZERO_TICKS * 1000) / 60)} ms); each of the ${WHACK_DIAMONDS} diamonds adds ${WHACK_DIAMOND_POINTS}. {max} only for a perfect, very fast run with an unbroken combo and both diamonds.`,
    },
    wavefront: {
      goal: "Five waves and a boss in 90 s.",
      how: [
        { action: "Drag to move;", detail: "you fire on your own." },
        { action: "Dodge red bolts and divers:", detail: "3 lives." },
        { action: "After wave 5,", detail: "shoot down the boss fast." },
        { action: "The run lasts 90 seconds.", detail: "Each new wave flies in from the top 2 seconds after you clear one. Don't let a formation reach your line.", helpOnly: true },
        { action: "From wave 3, ships peel off and dive at you,", detail: "then fly back to their place. Shoot them on the way; one that rams you costs a life.", helpOnly: true },
        { action: "Each wave flies its own shape:", detail: "a grid, then a triangle, a circle, a pentagon and an octagon – always 30 ships. Waves 3 and 4 come down more slowly.", helpOnly: true },
        { action: "From wave 2, a grey armoured ship", detail: "sits in the middle of the shape and takes 6-12 hits – every hit counts.", helpOnly: true },
        { action: "Shoot the saucer", detail: "and catch its drop: 5 laser shots that pierce up to 3 enemies.", helpOnly: true },
        { action: "The boss slides side to side and fires in patterns.", detail: `Its bar shows the ${WAV_BOSS_HP} hits it can take; every hit counts, and destroying it ends the run – the sooner after it arrives, the more it scores.`, helpOnly: true },
      ],
      score: liveBandHelp("wavefront", "Ships, armour hits, boss hits and saucers count 1, and cleared waves 15.", { more: "More ships, hits and waves", finish: "Destroying the boss adds up to 10 for speed: the full 10 within 20 s of its arrival, falling to 0 at 40 s." }),
    },
    bastion: {
      goal: "Defend the base.",
      how: [
        { action: "Touch where you want to aim", detail: "– the turret follows and fires all the time." },
        { action: "Prefer buttons?", detail: "Turn on Arrows and hold ◀ ▶ to turn the barrel." },
        { action: "Squares take two hits;", detail: "triangles split." },
      ],
      score: "1 per shape; keep the base alive for the bonus.",
    },
    rooftop: {
      goal: "Survive the rooftops as long as you can.",
      how: [
        { action: "Swipe left or right", detail: "to change lane, up to jump, down to slide." },
        { action: "It keeps getting faster.", detail: "" },
      ],
      score: "The longer you last, the more you score – the full minute is {max}.",
    },
    flip: {
      goal: "Run the corridor – flip to the other side to dodge.",
      how: [
        { action: "Tap to flip sides;", detail: "run on the side without spikes." },
        { action: "Cracked tiles break;", detail: "flip off fast." },
        { action: "Grab the gold stars.", detail: "From 10 seconds the corridor bends." },
        { action: "Spikes or lava on one side?", detail: "Run on the other.", helpOnly: true },
        { action: "Hazards ride the bends with you,", detail: "so the gap between floor and ceiling never changes.", helpOnly: true },
        { action: "A tile starts cracking", detail: "the moment you touch it and is gone less than half a second later.", helpOnly: true },
      ],
      score: liveBandHelp("flip", "Each half second you last counts 1 and each gold star 3.", { more: "More time and stars", finish: "Lasting the full minute adds 10." }),
    },
    junction: {
      goal: "Keep traffic moving, no crashes.",
      how: [
        { action: "Tap a light", detail: "to switch its road red or green." },
        { action: "Every 12 s", detail: "a new diagonal road joins." },
        { action: "Cars from crossing roads", detail: "must not meet." },
        { action: "Each light", detail: "stands at its own road's stop line, ringed in that road's colour; the stop line and the arrow painted on the lane share it. Tap the light, or anywhere along its lane, and the lane flashes.", helpOnly: true },
        { action: "Sharing the middle:", detail: "straight-on traffic from opposite main roads can cross together. Turning cars, and cars from a diagonal road (they bear left onto the main road), need the middle to themselves.", helpOnly: true },
        { action: "Cars on red queue up", detail: "– and they don't wait forever.", helpOnly: true },
        { action: "Buses (long, yellow)", detail: "take longer to clear the middle and block it while they cross.", helpOnly: true },
        { action: "Later,", detail: "some main-road cars turn – they flash an indicator a second before the line.", helpOnly: true },
        { action: "Ambulances (flashing blue)", detail: "come fast from 20 s on the main roads – give them green before they reach the line.", helpOnly: true },
        { action: "Everyone", detail: "gets the same new roads in the same order, and the same traffic.", helpOnly: true },
      ],
      score: liveBandHelp("junction", "Each car counts 2 units and each bus 3; an ambulance through adds 4 units and one stopped takes 4 off; a driver who gives up takes 1 unit off (never below 0 units).", { more: "More traffic through", good: (u) => `counts ${u} units`, finish: "Lasting the minute adds 10." }),
    },
    inkbridge: {
      goal: "Roll the coin into the pot.",
      how: [
        { action: "Draw a line,", detail: "then tap RELEASE to drop." },
        { action: "Levels 9-10:", detail: "keep drawing as the coin falls." },
        { action: "Gold star:", detail: "roll through it for +2." },
        { action: "Levels 1-4", detail: "Draw lines around the white birds, then tap RELEASE to drop the coin into a still pot.", helpOnly: true },
        { action: "Levels 5-8", detail: "The pot moves! Time your release so the coin rolls into it.", helpOnly: true },
        { action: "Levels 9-10: LIVE", detail: "Draw one line, RELEASE, then keep drawing as the coin falls. Faded strokes commit when you lift your finger; you can't draw through birds or near the coin.", helpOnly: true },
        { action: "Gold stars:", detail: "four of levels 1-8 have one, on a harder route. Roll the coin through it and into the pot for 2 bonus points. You never need it to finish the level.", helpOnly: true },
        { action: "Ink is limited", detail: "Each level has a budget, with a larger shared supply for live levels.", helpOnly: true },
        { action: "Three failed drops", detail: "and you're out.", helpOnly: true },
      ],
      score: liveBandHelp("inkbridge", "Each level counts 10 and each gold star 2.", { more: "More levels and stars", good: (u) => `counts ${u} – about ${Math.round(u / 10)} levels`, finish: "All ten levels adds up to 10 for speed: the full 10 with at least half the time left, falling to 0 at the buzzer." }),
    },

    burst: {
      goal: "Split the atoms. Don't get hit.",
      how: [
        { action: "◀ ▶ to move,", detail: "tap the arena to shoot up." },
        { action: "Catch drops:", detail: "BURST, SHIELD and FREEZE." },
        { action: "An atom touching you", detail: "costs a life (3 lives)." },
        { action: "Hold ◀ or ▶ to walk; tap anywhere on the arena to fire straight up.", detail: "There is no FIRE button: every tap on the arena is a shot.", helpOnly: true },
        { action: "Big atoms split into smaller ones;", detail: "the smallest pop.", helpOnly: true },
        { action: "Purple atoms: 1 in 2 drop a gold BURST icon", detail: "– triple shots until you lose a life.", helpOnly: true },
        { action: "Blue atoms: 1 in 8 drop a teal SHIELD", detail: "– it takes the next hit for you.", helpOnly: true },
        { action: "Green atoms: 1 in 12 drop an ice-blue FREEZE", detail: "– every atom stops for 3 seconds. Frozen atoms still hurt if you walk into one.", helpOnly: true },
      ],
      score: liveBandHelp("burst", "Each atom hit counts 1 unit; each life lost takes 5 units off (never below 0 units).", { more: "More atoms, fewer lives lost", good: (u) => `counts ${u} units`, finish: "Lasting the 90 s adds 10." }),
    },
    orbit: {
      goal: "Fly planet to planet to the sun.",
      how: [
        { action: "Tap to let go;", detail: "the next orbit catches you." },
        { action: "Checkpoint:", detail: "a crash returns you there." },
        { action: "Black hole:", detail: "fly in, skip 5-6 planets." },
        { action: "You orbit automatically.", detail: "Tap to let go – you fly straight until the next orbit catches you. Miss both of the next two orbits and the run ends (or you go back to your checkpoint) as soon as nothing ahead can catch you.", helpOnly: true },
        { action: "Set Checkpoint once while orbiting.", detail: "Your next crash returns you there. Without it, or after using it, a crash ends the run. Orbits are belt-safe. On later planets, time arrival and departure through the opening in the outside asteroid ring – it turns once every 12 seconds.", helpOnly: true },
        { action: "Orbits change shape.", detail: "Ovals speed up near the planet. On a figure-eight, let go only on the outer loops – never at the crossing.", helpOnly: true },
        { action: "Black holes:", detail: "about every ten planets a small black hole sits beside one planet. Let go at just the right moment to fly into it and you come out beside a planet 5 or 6 further on and fly into its orbit over about a second; the planets you skip count as reached. A checkpoint you set before the jump still works.", helpOnly: true },
        { action: "Any black hole ahead counts:", detail: "touch one with any part of the rocket on any flight, even from the planet before, and it swallows you; one you have already passed fades out.", helpOnly: true },
      ],
      score: liveBandHelp("orbit", "Each planet reached counts 1.", { more: "More planets", good: (u) => `reaches ${u} planets`, finish: "Reaching the sun adds up to 10 for speed: the full 10 with at least half the time left, falling to 0 at the buzzer." }),
    },

    snip: {
      goal: "Drop the apple into the basket.",
      how: [
        { action: "Swipe across a rope", detail: "to cut it. Order matters." },
        { action: "Crooks catch falling apples:", detail: "cut the vine." },
        { action: "Avoid wasp nests;", detail: "use planks and springs.", helpOnly: true },
        { action: "Golden leaves:", detail: "the apple picks one up as it passes through; each counts 2.", helpOnly: true },
        { action: "10 levels,", detail: "up to 12 s each." },
        { action: "Picker's crooks:", detail: "a wooden pole with an iron hook open at the top. It snags the apple only when the apple falls freely down past its hook from above, then holds it on a green vine; swipe the vine to drop it again. Each crook catches once.", helpOnly: true },
        { action: "Time it with the swing.", detail: "Cut the last rope and the apple drops; the walls bounce it without losing speed, and the camera follows across the wider arena.", helpOnly: true },
        { action: "Orchard pieces:", detail: "the apple rolls along sloped planks and down tin gutters, bounces hard off springy green branches, and a touch on a wasp nest loses the level. Some baskets slide slowly side to side – drop it as one comes under.", helpOnly: true },
        { action: "Several ropes?", detail: "Which one you cut first decides which way the apple swings.", helpOnly: true },
        { action: "Don't let it settle", detail: "on a ledge or plank, or fly out the top or bottom.", helpOnly: true },
        { action: "Taller levels:", detail: "two easy levels, three medium and five hard ones, many with several steps: a cut, a catch, another cut.", helpOnly: true },
        { action: "Everyone", detail: "gets the same ten levels in the same order.", helpOnly: true },
      ],
      score: liveBandHelp("snip", "Each apple counts 10 and each leaf 2.", { more: "More apples and leaves", good: (u) => `counts ${u} – about ${Math.round(u / 10)} apples`, finish: "All ten apples adds up to 10 for speed: the full 10 with at least half the time left, falling to 0 at the buzzer." }),
    },
    swing: {
      goal: "Swing the ninja to the 500 m line.",
      how: [
        { action: "Hold to grab and swing,", detail: "let go to fly." },
        { action: "From 200 m a dragon chases you:", detail: "keep going." },
        { action: "Touch stars as you fly by", detail: "for bonus points." },
        { action: "Stuck? Keep swinging", detail: "– every pass gets you higher. Swipe up to shorten the rope for speed, down to let it out.", helpOnly: true },
        { action: "The dragon flies at a steady pace behind you.", detail: "Slow down or stall and it catches you, which ends the run. A marker at the left edge shows how far back it is.", helpOnly: true },
        { action: "Loose stalactites crumble, shedding grit,", detail: "for two seconds before they fall. Don't be under one.", helpOnly: true },
        { action: "Lava bubbles before it jets up.", detail: "Don't be over a jet when it erupts.", helpOnly: true },
        { action: "Ten stars float along the way,", detail: "spread evenly from start to finish: some high, some low, some on risky lines near the lava. Touch one to take it; they are optional.", helpOnly: true },
        { action: "Don't touch the spikes", detail: "or fall into the lava.", helpOnly: true },
      ],
      score: liveBandHelp("swing", "Each metre counts 1 (up to 500) and each star 5.", { more: "More metres and stars", finish: "Reaching 500 m adds 10." }),
    },
    tilt: {
      goal: "Roll each marble into its own cup.",
      how: [
        { action: "Drag left or right", detail: "to spin the maze." },
        { action: "Gold stars sit by black holes:", detail: "risky bonuses." },
        { action: `From maze ${TILT_TWO_FROM}, two marbles,`, detail: "each to its own cup." },
        { action: "Marbles always roll down.", detail: "Each finished maze brings a harder one; dark holes end the run.", helpOnly: true },
        { action: "Cups:", detail: "the blue marble goes in the blue cup, the amber marble in the amber cup, which always starts well away from it. Each marble can only leave through the gap by its own cup, and the maze is done when both are in. The marbles roll through each other.", helpOnly: true },
        { action: "Stars:", detail: `${TILT_STARS_PER_MAZE} per maze, at the mouth of a black hole beside the route where there is one, otherwise one step off the route. Roll either marble over one to collect it, without rolling on into the hole.`, helpOnly: true },
        { action: "Maze 2 only: the red ball waits behind a silver gate with a padlock.", detail: "Pass the brass padlock and it's free – it tilts with you. Touch the red ball and the run ends.", helpOnly: true },
      ],
      score: liveBandHelp("tilt", "Each finished maze counts 30, getting closer to the exit in the maze you are on up to 29 more, and each star 5.", { more: "Further through the mazes and more stars", good: (u) => `counts ${u} – about ${Math.round(u / 30)} mazes`, finish: "All four mazes adds up to 10 for speed: the full 10 by 75 s, falling to 0 at the buzzer." }),
    },
    hotfloor: {
      goal: "Plan a route to the exit before the floor falls.",
      how: [
        { action: "Each number is how many hops that tile lasts after you press GO.", detail: "" },
        { action: "Tap tiles to draw your route, then GO.", detail: "Stay within the hop budget. UNDO removes the last tile." },
        { action: "You have 120 seconds.", detail: "" },
      ],
      score: "15 per stage.",
    },
    shikaku: {
      goal: "Cut the grid into rectangles, one number each.",
      how: [
        { action: "Drag corner to corner", detail: "to draw a rectangle." },
        { action: "Each number", detail: "is its rectangle's size." },
        { action: "Cover", detail: "every square." },
      ],
      score: logicDepthHelp("shikaku"),
    },
    dig: {
      goal: "Dig a path so the water reaches the drain.",
      how: [
        { action: "Drag across sand", detail: "to dig; digs are limited." },
        { action: "Sand you dig under", detail: "falls and can't be dug." },
        { action: "Avoid", detail: "acid and lava." },
        { action: "Still water", detail: "evaporates.", helpOnly: true },
      ],
      score: "Fill the drain with clean water: 100 + time bonus (the full bonus if you finish with at least half the time left), +20 within the planned digs. Otherwise points for clean water drained.",
    },
    trail: {
      goal: "Draw one path from 1 to 36 through every square.",
      how: [
        { action: "Tap next to the path's end", detail: "to add a number." },
        { action: "Diagonals count;", detail: "dragging works too." },
        { action: "Pass each fixed number", detail: "at its own step." },
        { action: "Ten dark numbers are fixed", detail: "– the path must reach each one at exactly that step. You fill the other 26.", helpOnly: true },
        { action: "Undo removes your last square; Reset clears your path.", detail: "Tapping your last square or dragging back along the path also undoes.", helpOnly: true },
      ],
      score: depthHelp("trail"),
    },
    measure: {
      goal: "Measure out exactly the target amount.",
      how: [
        { action: "Tap a jug, then another", detail: "to pour." },
        { action: "Fill and Empty", detail: "use the tap and drain." },
        { action: "Every action", detail: "is a move." },
        { action: "Par pours:", detail: "solve a puzzle in its fewest moves for a bonus." },
        { action: "A pour", detail: "stops when the first jug is empty or the second is full.", helpOnly: true },
        { action: "Puzzle 4", detail: "has no tap or drain: make the split shown on the jugs.", helpOnly: true },
        { action: "Reset", detail: "starts the puzzle again; moves keep counting.", helpOnly: true },
        { action: "Moves are limited", detail: "to about 3× the fewest (the counter). Out of moves, the run ends there.", helpOnly: true },
      ],
      score: depthHelp("measure"),
    },
    checkout: {
      goal: "Score exactly the target with your darts.",
      how: [
        { action: "Tap a number,", detail: "then x1, x2 or x3." },
        { action: "Hit zero exactly", detail: "and finish in the ring shown." },
        { action: "Tap Throw", detail: "to check." },
        { action: "Big finish:", detail: "end on the Bull or a treble for a bonus." },
        { action: "Outer bull = 25,", detail: "inner bull = 50 (a double).", helpOnly: true },
        { action: "The ring shown", detail: "is a double or a treble.", helpOnly: true },
        { action: "Every board is different.", detail: "Solve the five in any order; a wrong throw only costs time. Undo takes a dart back.", helpOnly: true },
      ],
      score: depthHelp("checkout"),
    },
    numline: {
      goal: "Place each number on the line.",
      how: [
        { action: "Drag the marker,", detail: "then tap Place." },
        { action: "Only the ends", detail: "are labelled." },
        { action: "Estimate:", detail: "no calculator needed." },
        { action: "Bullseye streak:", detail: "land within a hair of exact, in a row, for a bonus." },
        { action: "A magnifier", detail: "shows where your finger is.", helpOnly: true },
        { action: "Placed numbers are locked.", detail: "Five numbers on each of three lines.", helpOnly: true },
        { action: "Numbers include", detail: "fractions, percentages, powers and roots.", helpOnly: true },
      ],
      score: depthHelp("numline"),
    },
    numpyramid: {
      goal: "Each cell is the sum of the two below it.",
      how: [
        { action: "Drag a tile", detail: "into an empty cell." },
        { action: "Two tiles", detail: "are decoys." },
        { action: "Skip", detail: "moves to the next pyramid." },
        { action: "Four pyramids", detail: "to complete, one after another.", helpOnly: true },
        { action: "Double-tap a placed tile", detail: "to return it to the tray; drag it onto another cell to swap.", helpOnly: true },
      ],
      score: depthHelp("numpyramid"),
    },
    balltrack: {
      goal: "Steer every marble into the cup of its colour.",
      how: [
        { action: "Tap a gold tube", detail: "to turn it." },
        { action: "Gold marbles", detail: "and home streaks score extra." },
        { action: "Chevrons boost;", detail: "marbles meeting on an X fall." },
        { action: "Tap a cup's drop", detail: "to close it; tap again to open.", helpOnly: true },
        { action: "Tubes turn with a marble inside;", detail: "it rolls out of the new end.", helpOnly: true },
        { action: "A gold marble", detail: "still goes to the cup of its colour; home, it's worth more. Every marble home from the third in a row is a combo.", helpOnly: true },
        { action: "A speed booster (orange chevrons)", detail: `sends a marble on at double speed for ${BT_V7_BOOST_STEPS} tiles: set the tubes ahead sooner.`, helpOnly: true },
        { action: "A crossover (X)", detail: "lets a marble from above drop straight through and one along the row roll straight on. If two meet in it from different ways, both are knocked out.", helpOnly: true },
        { action: "A marble rolling into an upright tube", detail: "drops a row.", helpOnly: true },
        { action: "A closed drop on the bottom row", detail: "sends marbles rolling past it (gold →).", helpOnly: true },
        { action: `${BT_V7_BALLS} marbles drop, one about every 1.4 seconds`, detail: "until 49 seconds; the run lasts a minute.", helpOnly: true },
        { action: "Mid-round the bottom row moves and the cups swap colours;", detail: "a countdown warns you.", helpOnly: true },
      ],
      score: liveBandHelp("balltrack", "Each marble home counts 1.", { more: "More marbles home", good: (u) => `gets ${u} marbles home`, finish: `All ${BT_V7_BALLS} home adds up to 10 for speed: the full 10 if the last marble lands by ${((BT_V7_LAST_LAND_MIN + (3600 - BT_V7_LAST_LAND_MIN) / 2) / 60).toFixed(1)} s, falling to 0 at the buzzer. Gold marbles, boosted marbles and combos add up to ${BT_V7_FEATURE_MAX} more.` }),
    },
    wordsearch: {
      goal: "Find the six hidden words in the category.",
      how: [
        { action: "Drag in a straight line", detail: "through the letters." },
        { action: "Words run", detail: "any way, backwards too." },
        { action: "A seventh theme word hides unlisted:", detail: "find it for a bonus." },
        { action: "A found word", detail: "is struck through.", helpOnly: true },
        { action: "Each chip shows", detail: "a hidden word's letter count until you find it; the word then fills it.", helpOnly: true },
        { action: "The bonus word", detail: "fills the gold star chip. Find it before the sixth word: the sixth ends the round.", helpOnly: true },
      ],
      score: wordSearchBonusHelp(),
    },
    letterwheel: {
      goal: "Fill the crossword from the letter wheel.",
      how: [
        { action: "Drag across the letters", detail: "and let go." },
        { action: "Crossword words", detail: "fill gold. 3+ letters." },
        { action: "Other real words", detail: "fill the bonus jar." },
        { action: "Lift off the wheel or ×", detail: "to drop a trace.", helpOnly: true },
        { action: "Or tap letters", detail: "then Submit.", helpOnly: true },
        { action: "The bonus jar", detail: "fills by word length; a full jar adds the top 50 points. Misses after the first 5 spill a drop each.", helpOnly: true },
        { action: "A trace that is not a word", detail: "is a miss: the first 5 are free, then each costs 3.", helpOnly: true },
        { action: "Shuffle", detail: "rearranges the wheel without changing the crossword.", helpOnly: true },
      ],
      score: letterWheelJarHelp(),
    },
    strikeout: {
      goal: "Reveal five long words, one at a time, before twelve strikes.",
      how: [
        { action: "Tap a letter", detail: "to fill every matching tile in the word." },
        { action: "Three vowel guesses", detail: "per word (the dots)." },
        { action: "Vowels are A E I O U;", detail: "the keypad resets for each word.", helpOnly: true },
        { action: "Tap Solve", detail: "to guess the word; early earns more, wrong is a strike." },
        { action: "Early solves:", detail: "the more letters still hidden when you Solve a word, the bigger its bonus.", helpOnly: true },
        { action: "Starting letters", detail: "show from the start (every copy; one more on words 1–3) and earn nothing.", helpOnly: true },
        { action: "Solve:", detail: "type the missing letters, then Solve. It must be a real word (others are refused for free).", helpOnly: true },
        { action: "A word is solved", detail: "once all its letters show; the next word starts.", helpOnly: true },
        { action: "Twelve strikes", detail: "in total (misses and wrong solves, over all five words) end the round.", helpOnly: true },
      ],
      score: strikeoutDepthHelp(),
    },
    codeword: {
      goal: "Crack the code: each number is one letter.",
      how: [
        { action: "Tap a square,", detail: "then a letter." },
        { action: "Every square", detail: "with that number fills." },
        { action: "Six numbers", detail: "start decoded." },
        { action: "Each letter has one number.", detail: "Using a letter again moves it from its old number; Clear empties the selected number.", helpOnly: true },
        { action: "The strip above the keys", detail: "shows what you have decoded.", helpOnly: true },
        { action: "The grid completes", detail: "the moment every number is right.", helpOnly: true },
      ],
      score: stretchHelp("codeword", CODEWORD_STRETCH),
    },
    swapword: {
      goal: "Swap tiles until all six words read correctly.",
      how: [
        { action: "Drag a tile onto another", detail: "to swap." },
        { action: "Gold", detail: "is in place; teal belongs elsewhere." },
        { action: "Finish in par swaps", detail: "for a bonus. Swaps are limited." },
        { action: "Par", detail: "is the fewest swaps that solve the board, shown beside your swaps (gold while you are within it).", helpOnly: true },
        { action: "The budget", detail: "is 8 more than par; running out ends the round.", helpOnly: true },
        { action: "Or tap one tile", detail: "then the other.", helpOnly: true },
        { action: "Teal tiles", detail: "belong elsewhere in a word through them; grey tiles fit neither word. A letter shows teal only as often as it is still needed.", helpOnly: true },
      ],
      score: parBonusHelp("swapword", SWAP_PAR_BONUS, "swaps", "par swaps (the fewest that solve the board)"),
    },
    lightup: {
      goal: "Place bulbs so every white square is lit.",
      how: [
        { action: "A bulb lights", detail: "its row and column to a wall." },
        { action: "Bulbs", detail: "must never light each other." },
        { action: "A wall's number", detail: "is how many bulbs touch it." },
        { action: "A number on a wall", detail: "says exactly how many bulbs touch that wall's four sides.", helpOnly: true },
      ],
      score: logicDepthHelp("lightup"),
    },
    tents: {
      goal: "Pitch one tent beside every tree.",
      how: [
        { action: "Tap a cell", detail: "for a tent; again for grass." },
        { action: "Tents never touch,", detail: "even diagonally." },
        { action: "Signposts", detail: "give each row's and column's tents." },
        { action: "Tap a third time", detail: "to clear the cell.", helpOnly: true },
      ],
      score: logicDepthHelp("tents"),
    },
  };
}

/**
 * The goal, how-to lines and score text for every game, `{max}` in the score text filled with the
 * game's round maximum (roundMax.ts), so the "?" help states a raised game's own top.
 */
export const PUZZLE_INSTRUCTIONS: Record<PuzzleType, PuzzleInstructions> = liveRecord(() => {
  const templates = instructionTemplates();
  for (const type of Object.keys(templates) as PuzzleType[]) templates[type].score = fillMax(templates[type].score, type);
  return templates;
});
