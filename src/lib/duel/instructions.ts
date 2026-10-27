import { bandsHelp, openBandsLine } from "./puzzleBandsText";
import { depthHelp as logicDepthHelp } from "./logicDepthText";
import { wordSearchBonusHelp } from "./wordSearchText";
import { letterWheelJarHelp } from "./letterWheelText";
import { CODEWORD_STRETCH, TILEGRID_STRETCH_TOPUP, stretchHelp, strikeoutDepthHelp } from "./depth/stretchShapes";
import { parBonusHelp } from "./parBonusText";
import { SLIDE_PAR_BONUS_TOPUP } from "./wordSlide";
import { SWAP_PAR_BONUS_TOPUP } from "./swapword";
import { doubleTakeDepthHelp, eagleEyeDepthHelp, tallyDepthHelp } from "./depth/attentionTexts";
import { depthHelp } from "./numberDepthText";
import { d4Help } from "./depth4/text";
import {
  scoreWordHunt,
  WORDHUNT_FREE_MISSES,
  WORDHUNT_FREE_MISSES_PER_WORD,
  WORDHUNT_MISS_COST_PCT,
  WORDHUNT_REV_TARGET,
  WORDSMITH_V3_CAP,
  WORDSMITH_REV_TOPUP,
  WORDSMITH_V3_PANGRAM_BONUS,
  wordsmithV3Words,
} from "./scoring";
import { withPuzzleScoreRev } from "./puzzleScoreRev";
import { WORDHUNT_DEPTH_BASE_MAX, WORDHUNT_DEPTH_BONUS_MAX, WORDHUNT_V4_BASE_CURVE, WORDHUNT_V4_BONUS_CURVE } from "./wordHunt";
import { ascendDepthHelp, bangOnDepthHelp, flashDepthHelp } from "./depth/speedTexts";
import { BAND_GOOD_POINTS, bandMapTotal, bandOpen, bandPoints, bandTop, bandUnitsFor } from "@/lib/arcade/scoreBands";
import { TD_GOLD_MAX, TD_GOLD_POINTS, TD_REV3_FREE_RESETS, TD_REV3_RESET_COST, TD_RUN_TICKS, TD_STRETCH_FROM, TD_STRETCH_SPAN, TEN_DROP_DEPTH_REV, TEN_DROP_RAW_REV, tenDropScore } from "@/lib/arcade/tenDrop";
import { CLASH_DEPTH_MAX_WRONG, CLASH_GOLD_POINTS, CLASH_GOLD_STREAK, CLASH_GOLDS, CLASH_GREAT_MAP, CLASH_TOPUP_PACE_FLOOR, CLASH_TOPUP_PACE_ZERO_TICK, CLASH_REV3_RUN_TICKS, CLASH_STREAK_POINTS, CLASH_STRETCH_POINTS } from "@/lib/arcade/colourClash";
import { WHACK_BANDS_MAP, WHACK_COMBO_POINTS, WHACK_DIAMOND_POINTS, WHACK_DIAMONDS, WHACK_QUICK_ZERO_TICKS } from "@/lib/arcade/whack";
import { CLAY_DOUBLE_POINTS, CLAY_DOUBLES, CLAY_QUICK_HIT_MAP, CLAY_QUICK_POINTS, CLAY_STREAK_POINTS } from "@/lib/arcade/clayShoot";
import { WORDFALL_BANDS_MAP } from "@/lib/arcade/wordfall";

/** Nucleus wordsmithRev 3's help numbers: the word points that first reach each score, then the curve's top. */
function wordsmithV3Line(): string {
  const words = (x: number) => wordsmithV3Words(x, WORDSMITH_REV_TOPUP);
  const first = (p: number) => RANGE_0_200.find((x) => words(x) >= p) ?? null;
  const parts = [70, 100, 130, 150, 165].map((p) => {
    const x = first(p);
    return x === null ? null : `${x} points ≈ ${words(x)}`;
  }).filter(Boolean);
  return `${parts.join(", ")}, up to ${WORDSMITH_V3_CAP} at ${first(WORDSMITH_V3_CAP)} points`;
}
const RANGE_0_200 = Array.from({ length: 201 }, (_, i) => i);

/** Search range for the open games' help numbers (word points rising). */
const RANGE_0_80 = Array.from({ length: 81 }, (_, i) => i);
import { CLASH_QUEUE } from "@/lib/arcade/colourClash";
import {
  SKYLINE_V2_BLOCK_POINTS,
  SKYLINE_V2_PERFECT_POINTS,
  SKYLINE_WIND_FROM,
} from "@/lib/arcade/skyline";
import { JUNC_V2_BUS_POINTS, JUNC_V2_CAR_POINTS, JUNC_V2_SURVIVE_BONUS } from "@/lib/arcade/junction";
import {
  TILT_V2_FINISH_BONUS,
  TILT_V2_MAZE_POINTS,
  TILT_V2_PARTIAL_MAX,
  TILT_V2_STAR_POINTS,
  TILT_X_MAZES,
  TILT_X_MAZE_UNITS,
  TILT_X_PACE_POINTS,
  TILT_X_PACE_SLOW,
  TILT_X_PROGRESS,
  TILT_X_QUICK,
  TILT_X_QUICK_POINTS,
  TILT_X_QUICK_TAIL,
  TILT_X_SKILL_PAY,
  TILT_X_STARS,
  TILT_X_STAR_UNITS,
  TILT_X_TWO_FROM,
} from "@/lib/arcade/tilt";
import { BUB_SPECIAL_BLOCK, BUB_TORPEDO_HITS, BUB_V3_JOKER_BLOCK, BUB_V8_CHESTS, BUB_V8_CHEST_FP, BUB_V8_FEATURE_MAX } from "@/lib/arcade/bubble";
import { MATCHUP_V3_PAR_RAW, MATCHUP_V9_FEATURE_MAX } from "@/lib/arcade/matchup";
import { BT_V7_BALLS, BT_V7_BOOST_STEPS, BT_V7_FEATURE_MAX, BT_V7_LAST_LAND_MIN } from "@/lib/arcade/ballTrack";
import { HOVER_CENTRE_POINTS, HOVER_CENTRE_TOP, HOVER_CENTRE_TOL, HOVER_SKILL_SLACK, HOVER_CHAIN_POINTS, HOVER_CHAINS, HOVER_PICKUPS, HOVER_REACHABLE_GATES, HOVER_SKILL_MAX, HOVER_SKILL_PAY, HOVER_STARS, HOVER_TIGHT_GATES, HOVER_TIGHT_POINTS, HOVER_V2_GATES_SCORE, HOVER_V2_STARS_SCORE } from "@/lib/arcade/hover";
import {
  WAV_BOSS_HP,
  wavPrecision,
  WAV_X_BOSS_BY,
  WAV_X_SKILL_PRECISE,
  WAV_X_CANNON_HP,
  WAV_X_CORE_DAMAGE,
  WAV_X_CORE_PERIOD,
  WAV_X_DROPS,
  WAV_X_EDGE_MAX,
  WAV_X_SHAPES,
  WAV_X_SHIELD_TICKS,
  WAV_X_SKILL_CANNON,
  WAV_X_SKILL_CORE,
  WAV_X_SKILL_DROP,
  WAV_X_SKILL_PAY,
  WAV_X_SKILL_SAUCER,
  WAV_X_SPREAD_VOLLEYS,
  WAV_X_STREAK_CAP,
  WAV_X_STREAK_STEP,
} from "@/lib/arcade/wavefront";
import { INK_CLOUD_LEVELS, INK_FEATURE_MAX, INK_RAW_SHAMROCK, INK_RAW_SILVER, INK_RAW_STAR, INK_RAW_TRICK, INK_SILVER_PER_LEVEL, INK_V10_SKILL_PAY, INK_WIND_LEVELS } from "@/lib/arcade/inkBridge";
import { SNAKE_V9_CAPS, SNAKE_V9_COLS, SNAKE_V9_ROWS } from "@/lib/arcade/snake";
import { BEAT_V9_CAPS, BEAT_V9_SKILL_PAY } from "@/lib/arcade/beat";
import {
  PIN_MULT_MAX,
  PIN_PTS_BANK,
  PIN_PTS_BUMPER,
  PIN_PTS_SLING,
  PIN_PTS_SPIN,
  PIN_PTS_SPIN_LIT,
  PIN_PTS_TARGET,
} from "@/lib/arcade/pinball";
import { SLICE_V9_BAND_CURVE, SLICE_V9_BONUS_CAP, SLICE_V9_DODGE_POINTS, SLICE_V9_GOLD_POINTS, SLICE_V9_TICKET_POINTS, SLICE_V9_VALUE } from "@/lib/arcade/slice";
import { BINTOSS_FAR_CAP, BINTOSS_FAR_POINTS, BINTOSS_FAR_THROWS, BINTOSS_V7_BAND_CURVE } from "@/lib/arcade/binToss";
import { P4_PTS_COMBO, P4_PTS_JACKPOT, P4_PTS_JOULZ, P4_PTS_RAMP, P4_PTS_SKILL } from "@/lib/arcade/pinball4";
import { BULLSEYE_INNER_BULL_POINTS, BULLSEYE_RING_VALUES, BULLSEYE_V8_DEAD_CAP, BULLSEYE_V8_DEAD_PTS, BULLSEYE_V8_STREAK_CAP, BULLSEYE_V8_STREAK_STEP } from "@/lib/arcade/bullseye";
import { RALLY_V10_BONUS_COUNT, RALLY_V10_BONUS_PTS, RALLY_V11_BONUS_LIFE } from "@/lib/arcade/rally";
import { BURST_V8_CAPS, BURST_V8_CLEAN_PTS, BURST_V8_GOLDEN_PTS, BURST_V8_GOLDENS } from "@/lib/arcade/burst";
import { liveBandHelp } from "@/lib/arcade/liveBands";
import { ORBIT_V12_PACE_FROM, ORBIT_V12_PACE_FULL, ORBIT_V12_SKILL_MAX, ORBIT_V12_SKILL_PACED_FROM, ORBIT_V12_SKILL_PAY, ORBIT_XP_DUST_CAP, ORBIT_XP_DUST_FULL, ORBIT_XP_FIELDS, ORBIT_XP_MOONS, ORBIT_XP_MOTES, ORBIT_XP_PERFECT_CAP, ORBIT_XP_PERFECT_PER, ORBIT_XP_SLING_CAP, ORBIT_XP_SLING_PTS, ORBIT_XP_THREAD_CAP, ORBIT_XP_THREAD_PTS, ORBIT_XP_TRAILS } from "@/lib/arcade/orbitRev3";
import { CROSS_V9_SKILL_PAY, CROSS_X_BONUS_MAX, CROSS_X_CLOSE_MAX, CROSS_X_CLOSE_POINTS, CROSS_X_COIN_CROSSINGS, CROSS_X_COIN_POINTS, CROSS_X_COINS_PER_RUN } from "@/lib/arcade/cross";
import { SWING_COMBO_CAP, SWING_FEATURE_CAP, SWING_GATES, SWING_GEMS, SWING_LEDGE_POINTS, SWING_PAR_POINTS, SWING_SKILL_PAY } from "@/lib/arcade/swing";
import { BRK_V10_GOLD_HITS, BRK_V9_COLS, BRK_V9_COMBO_MAX, BRK_V9_COMBO_X2, BRK_V9_COMBO_X3, BRK_V9_GOLD, BRK_V9_GOLD_POINTS, BRK_V9_ROWS, BRK_V9_SKILL_MAX, BRK_V9_SKILL_PAY } from "@/lib/arcade/breaker";
import { FLIP_V8_COMBO_CAP, FLIP_V8_CP_POINTS, FLIP_V8_FEATURE_CAP, FLIP_V8_SKILL_PAY, FLIP_V8_SWEETS, FLIP_V8_SWEET_POINTS, FLIP_V8_TRAILS, FLIP_V8_TRAIL_POINTS, FLIP_V8_TRAIL_STARS, FLIP_V8_ZONE_POINTS } from "@/lib/arcade/flip";
import { bandCurve, type BandCurve } from "@/lib/arcade/scoreBands";
import { SNIP_X_FEATURE_MAX, SNIP_X_FEED_UNITS, SNIP_X_GOLD_RAW, SNIP_X_LEVELS, SNIP_X_PAR_MARGIN, SNIP_X_PAR_RAW, SNIP_X_PERFECT_RAW, SNIP_X_QUICK_RAW, SNIP_X_RAW_TOP, SNIP_X_SKILL_PAY, SNIP_X_STAR2_RAW, SNIP_X_STAR_UNITS } from "@/lib/arcade/snip";
import { fillMax, liveRecord, roundMaxFor } from "./roundMax";
import { chainDepthHelp } from "./depth/chain";
import { pairDepthHelp } from "./depth/matchmaker";
import { labyrinthDepthHelp } from "./depth/labyrinth";
import { rev3UnfinishedScore } from "./puzzleScoreRev3";
import { topsyHelpScore } from "./topsy";
import { jumbledHelpScore } from "./jumbled";
import type { PuzzleType } from "./types";

/** A skill pay curve in words (E3): "Skill points pay on a rising scale: 15 pay 6, 30 pay 35, …, and the full 50 needs 85." Repeated values are skipped. */
function skillPayLine(curve: BandCurve): string {
  const knots = curve.units.map((u, i) => [u, curve.points[i]!] as const).filter(([, p], i, all) => p > 0 && (i === 0 || all[i - 1]![1] !== p));
  const [topUnits, top] = knots[knots.length - 1]!;
  return `Skill points pay on a rising scale: ${knots.slice(0, -1).map(([u, p]) => `${u} pay ${p}`).join(", ")}, and the full ${top} needs ${topUnits}.`;
}

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
      score: stretchHelp("tilegrid", TILEGRID_STRETCH_TOPUP),
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
        { action: "Hangs are limited:", detail: "9 / 12 / 15 / 18 hangs on the four scales (the counter). Out of hangs, the scale ends unbalanced and the next one starts.", helpOnly: true },
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
      score: parBonusHelp("wordslide", SLIDE_PAR_BONUS_TOPUP, "moves", "the par moves"),
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
        { action: "Traps:", detail: "teal, red or blue; light orange; a gold border only; the word GOLD on a dark screen; half the screen gold.", helpOnly: true },
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
      score: `All ${CLASH_QUEUE} sorted (or let fall) with at most ${CLASH_DEPTH_MAX_WRONG} wrong is a finish: ${bandMapTotal(CLASH_GREAT_MAP, 120)} as time runs out, rising with the time left (5 off the speed part per wrong word; touching a grey word counts as wrong) to 150 for a quick finish with none wrong. A finish adds up to ${CLASH_GOLDS * CLASH_GOLD_POINTS * 2} for gold words (${CLASH_GOLD_POINTS} each, ${CLASH_GOLD_POINTS * 2} on a streak of ${CLASH_GOLD_STREAK}+), up to ${CLASH_STREAK_POINTS} for your longest streak (all ${CLASH_QUEUE} in a row for the lot) and up to ${CLASH_STRETCH_POINTS} for a clean finish quicker than ${CLASH_REV3_RUN_TICKS / 120} s; the gold and streak points count in full by ${CLASH_REV3_RUN_TICKS / 120} s and fade to ${Math.round(CLASH_TOPUP_PACE_FLOOR * 100)} % at ${CLASH_TOPUP_PACE_ZERO_TICK / 60} s. {max} only for a quick, clean run with every gold word on a streak. Otherwise words right less words wrong, ${bandMapTotal(CLASH_GREAT_MAP, 110)} at most: 20 scores ${bandMapTotal(CLASH_GREAT_MAP, 70)}, 40 scores ${bandMapTotal(CLASH_GREAT_MAP, 100)}, 46 or more ${bandMapTotal(CLASH_GREAT_MAP, 110)}.`,
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
      score: `Word points: 4 letters 1, 5 → 2, 6 → 4, 7 → 7, 8+ → 11. Base points score up to ${WORDHUNT_DEPTH_BASE_MAX}: ${[18, 27, 44].map((u) => `${u} points ≈ ${bandOpen(WORDHUNT_V4_BASE_CURVE, u)}`).join(", ")}, ${WORDHUNT_DEPTH_BASE_MAX} at ${bandUnitsFor(WORDHUNT_V4_BASE_CURVE, WORDHUNT_DEPTH_BASE_MAX)}. What long words and the gold tile add (6 letters ×1.5, 7+ ×2, through the gold tile ×2) scores up to ${WORDHUNT_DEPTH_BONUS_MAX} more: ${[17, 48].map((u) => `${u} extra ≈ ${bandOpen(WORDHUNT_V4_BONUS_CURVE, u, WORDHUNT_DEPTH_BONUS_MAX)}`).join(", ")}, ${WORDHUNT_DEPTH_BONUS_MAX} at ${bandUnitsFor(WORDHUNT_V4_BONUS_CURVE, WORDHUNT_DEPTH_BONUS_MAX)}; {max} only with both. Tracing lots of non-words costs: ${WORDHUNT_FREE_MISSES} plus ${WORDHUNT_FREE_MISSES_PER_WORD} per word found are free, then ${WORDHUNT_MISS_COST_PCT} % off each. The counter shows word points with their multipliers.`,
    },
    unblock: {
      goal: "Slide the gold block out through the exit.",
      how: [
        { action: "Drag a block", detail: "along its own direction." },
        { action: "Clear a path", detail: "for the gold block." },
        { action: "Par", detail: "is the fewest moves; the bar's gold mark shows it." },
      ],
      score: d4Help("unblock"),
    },
    blockparty: {
      goal: "Fit every piece into the free squares.",
      how: [
        { action: "Tap a piece", detail: "to rotate it." },
        { action: "Drag it", detail: "onto the board." },
        { action: "Fit every piece", detail: "around the fixed pegs." },
        { action: "Drag a piece's anchor", detail: "onto a free board square.", helpOnly: true },
      ],
      score: d4Help("blockparty"),
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
        { action: "Par", detail: "is the fewest taps; the bar's gold mark shows it." },
      ],
      score: d4Help("pipes"),
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
      score: d4Help("flow"),
    },
    iceslide: {
      goal: "Slide the ball to the gold exit.",
      how: [
        { action: "Swipe", detail: "to slide until something stops you." },
        { action: "Arrows turn you;", detail: "avoid the holes." },
        { action: "Portals", detail: "carry you across." },
        { action: "Ice gems", detail: "off the direct route score a bonus." },
        { action: "Cracked ice", detail: "breaks after you cross it once.", helpOnly: true },
      ],
      score: d4Help("iceslide"),
    },
    push: {
      goal: "Push every crate onto a marked square.",
      how: [
        { action: "Swipe or use the arrows", detail: "to walk." },
        { action: "Walk into a crate", detail: "to push it." },
        { action: "Crates can't be pulled,", detail: "so plan ahead." },
        { action: "The gold crate", detail: "on the gold mark scores a bonus." },
        { action: "The worker", detail: "moves one square at a time and pushes one crate at a time.", helpOnly: true },
      ],
      score: d4Help("push"),
    },
    laser: {
      goal: "Light all six gems with one beam.",
      how: [
        { action: "Drag mirrors", detail: "and the splitter onto the grid." },
        { action: "Tap a piece", detail: "to turn it." },
        { action: "Tap FIRE:", detail: "three shots; avoid bombs." },
        { action: "Two spare mirrors:", detail: "use fewer for an elegant beam." },
        { action: "The splitter", detail: "forks the beam across its input axis.", helpOnly: true },
        { action: "Gem arrows:", detail: "marked gems only light from that direction.", helpOnly: true },
      ],
      score: d4Help("laser"),
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
        { action: "Stars", detail: "anywhere in the maze add points if you finish fast." },
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
        { action: "A ball home fills its hole:", detail: "other balls stop against it, as they do against a ball.", helpOnly: true },
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
      // Gradient, tilesRev 4 (Joe's phone notes, 27 Oct 2026; jumbled.ts): swaps, locked tiles, a scheme a round.
      goal: "Swap tiles to rebuild the colour gradient.",
      how: [
        { action: "Tap a tile, then another,", detail: "to swap them (or drag one onto the other)." },
        { action: "Read the colours:", detail: "they get lighter or darker, and shift hue, across the board." },
        { action: "A tile in its right place", detail: "locks (dotted), as the four corners are." },
        { action: "Every round", detail: "has its own colours, so the board never looks the same twice.", helpOnly: true },
        { action: "Par", detail: "is shown with your swaps; every swap counts.", helpOnly: true },
      ],
      score: jumbledHelpScore(),
    },
    rings: {
      goal: "Turn the rings until every spoke is one colour.",
      how: [
        { action: "Tap a ring,", detail: "then turn it with the arrows." },
        { action: "The legend", detail: "shows which rings turn together." },
        { action: "A strobe dot lights", detail: "for each finished spoke." },
        { action: "Par", detail: "is the fewest turns; the bar's gold mark shows it." },
        { action: "Linked rings", detail: "turn the same way or the opposite way.", helpOnly: true },
        { action: "The selected ring", detail: "glows and the needle touches its edge.", helpOnly: true },
      ],
      score: d4Help("rings"),
    },
    hover: {
      goal: "Fly through the barrier gaps.",
      how: [
        { action: "Tap to hover up;", detail: "let go to drop." },
        { action: "Gold gates:", detail: "thread them, dead centre for more." },
        { action: "Star chains:", detail: "sweep them; shields take a crash." },
        { action: "Touch gold stars", detail: "in tight gaps for a bonus. Later barriers have two gaps, or slide.", helpOnly: true },
        { action: "Hit anything", detail: "and the run ends. Gold stars sit near the edge of a gap, so they are risky.", helpOnly: true },
        { action: `${HOVER_TIGHT_GATES} tight gates:`, detail: `a narrow gold-rimmed second gap on a barrier. Fly through it without touching anything for ${HOVER_TIGHT_POINTS} skill points.`, helpOnly: true },
        { action: "The centre line:", detail: `a faint line through each tight gate lights up as you fly along it. Stay within ${HOVER_CENTRE_TOL[0] / 256} px of it across the barrier for ${HOVER_CENTRE_POINTS[3]} more, within ${HOVER_CENTRE_TOL[1] / 256} px for ${HOVER_CENTRE_POINTS[2]}, within ${HOVER_CENTRE_TOL[2] / 256} px for ${HOVER_CENTRE_POINTS[1]}.`, helpOnly: true },
        { action: `${HOVER_CHAINS} star chains:`, detail: `5 to 7 stars on one flap's arc between two barriers. Touch every star of a chain for ${HOVER_CHAIN_POINTS} skill points.`, helpOnly: true },
        { action: `${HOVER_PICKUPS} shield bubbles`, detail: "sit at the same places for everyone. Touch one for a shield: your next crash breaks it instead and you fly on, untouchable for a moment.", helpOnly: true },
        { action: "Two-gap barriers:", detail: "fly through either gap. Sliding barriers move slowly and steadily up and down.", helpOnly: true },
        { action: "Taller sky:", detail: "the flight area fills your screen, and gaps sit anywhere from near the top to near the bottom. The faint stars behind are scenery only.", helpOnly: true },
        { action: "Everyone flies", detail: `the same course for sixty seconds: ${HOVER_REACHABLE_GATES} barriers in a clean run (the first a wide warm-up gap) and ${HOVER_STARS} gold stars.`, helpOnly: true },
      ],
      score: liveBandHelp("hover", `Each of the ${HOVER_REACHABLE_GATES} barriers counts 3 and each gold star 2; staying up half a second (or reaching the first barrier) counts 1.`, { more: "More barriers and stars", good: (u) => `counts ${u} – about ${Math.round(u / 3)} barriers`, finish: `Lasting the minute adds 10. Skill adds up to ${HOVER_SKILL_MAX} more: ${HOVER_TIGHT_POINTS} a tight gate, ${HOVER_CHAIN_POINTS} a whole star chain and up to ${HOVER_CENTRE_TOP} a centre line. ${skillPayLine(HOVER_SKILL_PAY)} That is ${HOVER_SKILL_SLACK} short of everything, so one slip is forgiven.` }),
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
        { action: "Perfects in a row", detail: "multiply, up to ×4." },
        { action: "Next block:", detail: "gold, narrow or wide." },
        { action: "Next-block preview:", detail: "gold scores a bonus if you land it perfectly; narrow is harder and worth more; wide is easier and worth less.", helpOnly: true },
        { action: "Every 10 floors", detail: "scores a height bonus and the camera pulls back to show the city.", helpOnly: true },
        { action: "From block 20", detail: "a waving flag warns of wind.", helpOnly: true },
        { action: "Overhang is cut", detail: "so the next block is narrower. Line it up exactly (a perfect drop) and the block grows back a little.", helpOnly: true },
        { action: "Streak multiplier:", detail: "from the 3rd perfect drop in a row a perfect drop counts double, from the 6th triple and from the 10th four times. A drop that isn't perfect resets it.", helpOnly: true },
        { action: "Narrow and wide blocks", detail: "are perfect when centred on the top. A centred wide block stays whole, so the tower widens; off-centre, the overhang is cut as usual.", helpOnly: true },
        { action: "Wind:", detail: `once ${SKYLINE_WIND_FROM} blocks are placed, a flag flies from the top block. Still flag: no wind. It starts waving about a second before a gust and streams the way the gust blows. Every gust is the same strength and nudges the sliding block that way while it blows.`, helpOnly: true },
        { action: "Taller view, more sky:", detail: "the tower climbs higher before the camera pulls back.", helpOnly: true },
        { action: "Everyone", detail: "gets the same gusts at the same moments.", helpOnly: true },
      ],
      score: liveBandHelp("skyline", "Each block counts 5 (narrow 8, wide 3), each perfect drop counts 5 times its streak multiplier, a gold block landed perfectly 15 more and every 10 floors 20.", { more: "More blocks and perfect streaks", good: (u) => `counts ${u}` }),
    },
    bintoss: {
      goal: "Throw the ball into the bucket.",
      how: [
        { action: "Drag to aim,", detail: "then let go to throw." },
        { action: "Wind 1 = a quarter bucket.", detail: "Aim into the flag." },
        { action: "Small far bucket:", detail: `+${BINTOSS_FAR_POINTS}, and its hoop +3.` },
        { action: "Through the hoop, then in:", detail: "+3 bonus.", helpOnly: true },
        {
          action: "Far buckets:",
          detail: `on throws 1-${BINTOSS_FAR_THROWS} a small bucket (about half the main one's width) stands still further back. Either bucket counts; the far one adds ${BINTOSS_FAR_POINTS} more (up to ${BINTOSS_FAR_CAP} in all). The hoops hang over it.`,
          helpOnly: true,
        },
        {
          action: "The flag at the top shows the wind: it points the way the wind blows, with its strength on it. Each wind point moves the ball a quarter of a bucket width.",
          detail: "Wind 2 to the left? Aim half a bucket width to the right.",
          helpOnly: true,
        },
        { action: "The bucket moves", detail: "further away every throw, and gets narrower from throw 4.", helpOnly: true },
        { action: "From throw 7 the bucket slides", detail: "side to side – time your release.", helpOnly: true },
        {
          action: "Hoops:",
          detail: "on three of throws 2-5 a hoop hangs over the far bucket. Go down through it and into a bucket for 3 bonus points. Its gold ends bounce the ball away.",
          helpOnly: true,
        },
        {
          action: "Spinners:",
          detail: "on three of throws 6-10 a paddle turns in front of the bucket at a steady speed. Time your throw past it, or lob high over it.",
          helpOnly: true,
        },
        { action: "Drag down to the cancel strip", detail: "to put a throw back.", helpOnly: true },
      ],
      // binRev 7 (docs/expansions/e5.md): binRev 6's units on their own curve, plus the far points; binRev 8 (phone notes) adds a unit a close miss.
      score: `Each bucket counts 10, each hoop bonus 3 and each throw that only just misses a bucket 1. More buckets and hoops, higher score – up to ${BINTOSS_V7_BAND_CURVE.points.at(-1)}. A good run (${BAND_GOOD_POINTS} points) counts ${bandUnitsFor(BINTOSS_V7_BAND_CURVE, BAND_GOOD_POINTS)} – about ${Math.round(bandUnitsFor(BINTOSS_V7_BAND_CURVE, BAND_GOOD_POINTS) / 10)} buckets. All ten in adds 10, and each far bucket ${BINTOSS_FAR_POINTS} (up to ${BINTOSS_FAR_CAP}). Up to {max}.`,
    },
    bullseye: {
      goal: "Hit the gold 10, near and far.",
      how: [
        { action: "Drag to aim,", detail: "let go to throw." },
        { action: "Bulls in a row:", detail: `from the 3rd, +${BULLSEYE_V8_STREAK_STEP}, +${2 * BULLSEYE_V8_STREAK_STEP}, +${3 * BULLSEYE_V8_STREAK_STEP}…` },
        { action: "White dead-centre ring:", detail: `+${BULLSEYE_V8_DEAD_PTS} more.` },
        { action: "Wind 2?", detail: "Aim two rings into the wind.", helpOnly: true },
        { action: "Inner bull 12.", detail: "Balloons add +1, +2 or +3.", helpOnly: true },
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
        { action: "Every dart's board stands at its own distance:", detail: "near boards low and big, far ones high and small. The same boards for everyone in the room.", helpOnly: true },
        {
          action: "Bull streak:",
          detail: `a dart in the gold 10 (wherever it sits) right after another is a streak ×2, then ×3… From ×3 each bull adds ${BULLSEYE_V8_STREAK_STEP} more than the last (+${BULLSEYE_V8_STREAK_STEP}, +${2 * BULLSEYE_V8_STREAK_STEP}, +${3 * BULLSEYE_V8_STREAK_STEP}…), up to ${BULLSEYE_V8_STREAK_CAP} in all. Any other dart ends the streak.`,
          helpOnly: true,
        },
        {
          action: "Dead-centre:",
          detail: `the thin white ring in the middle of the bull (a quarter of its width, shown whenever the 10 is the centre ring). A dart inside it adds ${BULLSEYE_V8_DEAD_PTS} on top of the streak, up to ${BULLSEYE_V8_DEAD_CAP} in all, and keeps the streak going like any bull.`,
          helpOnly: true,
        },
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
      // bullRev 8 (docs/expansions/e9.md): the dart total on its curve, plus the streak and dead-centre points.
      score: `${liveBandHelp("bullseye", `Your dart total: rings ${BULLSEYE_RING_VALUES.join(" / ")} from the centre out (the inner bull ${BULLSEYE_INNER_BULL_POINTS}), plus +1, +2 or +3 for each balloon popped on the way in.`, { more: "A higher dart total", good: (u) => `totals ${u}` })} Bull streaks add up to ${BULLSEYE_V8_STREAK_CAP} more and dead-centre darts ${BULLSEYE_V8_DEAD_PTS} each, up to ${BULLSEYE_V8_DEAD_CAP}. Up to {max}.`,
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
        { action: "Gold stars, lanes, wormholes:", detail: "bonus points." },
        { action: "Quick stars build a combo;", detail: "wormholes and violet lanes are quick, risky shortcuts.", helpOnly: true },
        { action: "At 20 stars,", detail: "a meteor shower drops 3 rocks!", helpOnly: true },
        { action: "Wormholes:", detail: "three pairs of swirling mouths. Go into one and you come straight out of its twin, still heading the same way, so look before you leap. A star eaten within a second of a trip is a warp star (+2).", helpOnly: true },
        { action: "Gold comet stars:", detail: "about every 7 s a gold star appears for 5 s and fades. Eat it for 1 to 5 bonus points, more the sooner you get there. It doesn't make you longer.", helpOnly: true },
        { action: "Violet speed lanes:", detail: "one row and two columns. Travelling along one you move faster; from a ride's sixth square, every 4 squares score 1.", helpOnly: true },
        { action: "Combo:", detail: "eat stars within 1.25 s of each other; from the third in a row each star adds 1 to 3 bonus points.", helpOnly: true },
        { action: "Rocks hit only your head.", detail: "A rock on your tail does nothing, and your tail passes through rocks. A big rock fills a 2 × 2 block: keep your head off all four squares.", helpOnly: true },
        { action: "Rocks start at length 9:", detail: "one more every 4 stars, up to 11. Stars never appear on a rock.", helpOnly: true },
        { action: "The meteor shower", detail: "comes once, when you reach 20 stars: three red shadows, then three rocks land together 2 s later. With the shower, at most 14 rocks.", helpOnly: true },
        { action: "Hit a wall, your tail or a rock with your head", detail: "and the run ends.", helpOnly: true },
        { action: "Taller and wider field:", detail: `${SNAKE_V9_COLS} squares across and ${SNAKE_V9_ROWS} down, so stars can be further away.`, helpOnly: true },
        { action: "Everyone gets", detail: "the same stars, and every rock lands on the same square at the same moment.", helpOnly: true },
      ],
      score: `${liveBandHelp("snake", "Each star eaten counts 1.", { more: "More stars", good: (u) => `eats ${u} stars` })} Gold stars (up to ${SNAKE_V9_CAPS.gold}), combos (up to ${SNAKE_V9_CAPS.combo}), lane rides (up to ${SNAKE_V9_CAPS.lane}) and warp stars (up to ${SNAKE_V9_CAPS.warp}) add up to 50 more, to {max}.`,
    },
    cross: {
      goal: "Get across the traffic as many times as you can.",
      how: [
        { action: "Swipe to hop.", detail: "Up goes forward; down and sideways step." },
        { action: "Grab gold coins;", detail: "cross without a hit for a ×2–×4 streak." },
        { action: "Reach the grass island:", detail: "after a hit you restart there." },
        { action: "Buses from crossing 2,", detail: "bikes and motorbikes from 3, cones from 4.", helpOnly: true },
        { action: "Buses are long and slow with small gaps:", detail: "time the gap or walk along to it. Motorbikes are narrow and very fast.", helpOnly: true },
        { action: "Bikes race along the green lanes;", detail: "cones block part of the road.", helpOnly: true },
        { action: "Three lives.", detail: "A hit sends you back to the start of this crossing, or to the island once you've reached it in that crossing.", helpOnly: true },
        { action: "Coins:", detail: `${CROSS_X_COINS_PER_RUN} a run, four on each of the first ${CROSS_X_COIN_CROSSINGS} crossings, in the riskiest lanes (two each side of the island, out near the edges); step onto one to grab it. Everyone meets the same coins in the same places.`, helpOnly: true },
        { action: "Streak:", detail: `each crossing without a hit raises it (×2, ×3, then ×4) and adds its multiplier less 1 in streak points; a hit ends it.`, helpOnly: true },
        { action: "Close calls:", detail: `hop into a lane just as a vehicle has passed your spot (within a tenth of a second) for ${CROSS_X_CLOSE_POINTS} skill point, once a lane each crossing, up to ${CROSS_X_CLOSE_MAX} a run.`, helpOnly: true },
        { action: "The first two crossings", detail: "always leave wide gaps in every lane. Later traffic is tighter and faster.", helpOnly: true },
        { action: "After each crossing", detail: "you get a second on the kerb before the next one.", helpOnly: true },
        { action: "Only the walker counts:", detail: "traffic has to touch the figure itself (its arms' reach), not the space around it.", helpOnly: true },
      ],
      score: `${liveBandHelp("cross", "Each row crossed counts 1 and each full crossing 2 more.", { more: "More rows and crossings" })} Skill adds up to ${CROSS_X_BONUS_MAX} more: ${CROSS_X_COIN_POINTS} a coin, the streak points and close calls. ${skillPayLine(CROSS_V9_SKILL_PAY)} The total stops at {max}.`,
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
      goal: "Clear the wall; break the gold.",
      how: [
        { action: "Drag the paddle;", detail: "tap to fire a power-up." },
        { action: "Gold bricks:", detail: `break after ${BRK_V10_GOLD_HITS} hits.` },
        { action: "Combo ×2, ×3:", detail: "bricks with no paddle touch." },
        { action: "Catch power-ups:", detail: "laser, ×3, ×2, Fireball.", helpOnly: true },
        { action: "Keep the ball up", detail: "– it gets faster with bricks and with time. Losing the last ball costs 3 seconds.", helpOnly: true },
        { action: "Cracked bricks take 2 or 3 hits", detail: "– each hit cracks them further.", helpOnly: true },
        { action: "Five power-up bricks drop a capsule; each brick shows its power.", detail: "Tap anywhere to fire a laser or ×3 you've caught; any longer touch moves the paddle.", helpOnly: true },
        { action: "Green beam = laser:", detail: "one beam straight up from the paddle that hits the first 4 bricks above it.", helpOnly: true },
        { action: "Silver three arrows = three shots:", detail: "each tap fires an extra ball straight up; it vanishes at the first wall it hits.", helpOnly: true },
        { action: "Bronze two balls = double balls", detail: "at once. There are two per board, in the lower rows.", helpOnly: true },
        { action: "Orange flame = Fireball:", detail: "for 2.5 seconds your balls smash straight through bricks without bouncing.", helpOnly: true },
        { action: "Sliding rows:", detail: "one row starts at 30 s and another at 60 s, half a brick each way, slowly and always the same.", helpOnly: true },
        { action: `${BRK_V9_GOLD} gold bricks`, detail: `sit near the top, each behind an armoured brick. Any ${BRK_V10_GOLD_HITS} hits break one: balls, Fireball balls, ×3 shots and the laser all count, and each hit cracks it further.`, helpOnly: true },
        { action: "Combo:", detail: `a ball that breaks bricks without touching the paddle goes ×2 from its ${BRK_V9_COMBO_X2}th brick and ×3 from its ${BRK_V9_COMBO_X3}th. A paddle touch or a lost ball ends it; Fireball, laser and ×3 bricks don't count.`, helpOnly: true },
      ],
      score: liveBandHelp("breaker", "Each brick destroyed counts 1.", { more: "More bricks", good: (u) => `clears ${u} bricks`, finish: `Clearing all ${BRK_V9_COLS * BRK_V9_ROWS - BRK_V9_GOLD} adds up to 10 for speed: the full 10 with at least half the time left, falling to 0 at the buzzer. Skill adds up to ${BRK_V9_SKILL_MAX} more: ${BRK_V9_GOLD_POINTS} a gold brick, and 1 for each ×2 combo brick and 3 for each ×3 (up to ${BRK_V9_COMBO_MAX}). ${skillPayLine(BRK_V9_SKILL_PAY)}` }),
    },
    pinball: {
      goal: "Keep the ball in play and rack up table points.",
      how: [
        { action: "Hold left or right", detail: "to flip; tap to plunge." },
        { action: "Ramps and J-O-U-L-Z", detail: "raise the multiplier." },
        { action: "Lock 3 balls", detail: "for multiball and a jackpot." },
        { action: "Hold the left or right half", detail: "of the screen to raise that flipper; two thumbs raise both.", helpOnly: true },
        { action: "Three balls, one minute:", detail: "a lost ball comes back on the plunger.", helpOnly: true },
        { action: "Skill shot:", detail: `the power meter in the right-hand lane rises and falls; tap to plunge. Soft drops the ball into Z, full power into J. Plunge into the flashing letter for ${P4_PTS_SKILL.toLocaleString("en-GB")}.`, helpOnly: true },
        { action: "J-O-U-L-Z lanes:", detail: `a ball through a lane lights its letter (lit letters stay lit from ball to ball). Each flipper press shifts the lit letters, so line a dark one up under the ball. All five: ${P4_PTS_JOULZ.toLocaleString("en-GB")} and the next multiplier (up to ×${PIN_MULT_MAX}), which counts on bumpers, targets, the spinner and letters.`, helpOnly: true },
        { action: "Two ramps:", detail: `roll the ball up a ramp fast enough for ${P4_PTS_RAMP.toLocaleString("en-GB")} and the next multiplier. The left ramp drops the ball onto the U lane; the right one brings it back through the spinner. Ramps back to back build a combo (${P4_PTS_COMBO.toLocaleString("en-GB")} more each).`, helpOnly: true },
        { action: "Multiball:", detail: `a ramp shot lights the lock; with it lit, each ramp shot sinks the ball in the lock hole and a new one comes up. The third releases all three for 20 seconds with the jackpot lit: the target behind the drop targets, ${P4_PTS_JACKPOT.toLocaleString("en-GB")} a hit from below. A ball lost while another is in play costs nothing.`, helpOnly: true },
        { action: "One table for everyone,", detail: "with no luck in it.", helpOnly: true },
        { action: "Pink pop bumpers:", detail: `${PIN_PTS_BUMPER} a hit, and they kick the ball away.`, helpOnly: true },
        { action: "Orange drop targets:", detail: `${PIN_PTS_TARGET} each. Knock all four down for ${PIN_PTS_BANK.toLocaleString("en-GB")} more and a lit spinner for 15 seconds.`, helpOnly: true },
        { action: "Spinner in the left lane:", detail: `${PIN_PTS_SPIN} a turn, ${PIN_PTS_SPIN_LIT} while lit. A faster ball spins it more.`, helpOnly: true },
        { action: "Yellow slingshots", detail: `kick the ball back across (${PIN_PTS_SLING} each).`, helpOnly: true },
        { action: "A ball between the flippers drains.", detail: "Hold a flipper up to catch the ball on it, then let go and flip again to aim.", helpOnly: true },
      ],
      score: liveBandHelp("pinball", "Your table points count, multiplier, ramps, jackpots and skill shots included.", { more: "More table points", good: (u) => `scores ${u.toLocaleString("en-GB")} table points` }),
    },
    rally: {
      goal: "Keep the rally going.",
      how: [
        { action: "Drag the paddle.", detail: "Miss the blue ball: over." },
        { action: "Gold balls score:", detail: "5 a hit, 6 a pink pad." },
        { action: "Gold target:", detail: `+${RALLY_V10_BONUS_PTS} before its ring runs out.` },
        { action: "Drag to move the paddle", detail: "along the bottom.", helpOnly: true },
        { action: "Every hit", detail: "makes the paddle smaller and the ball faster.", helpOnly: true },
        { action: "A gold ball drops in", detail: "every ten seconds – only gold balls score.", helpOnly: true },
        { action: "Two pink target pads", detail: "sit on the far wall, one in each half. A gold ball that hits one counts 6, and the pad moves to a new spot in its own half, so the two never overlap. The spots are the same for everyone in the room.", helpOnly: true },
        { action: `${RALLY_V10_BONUS_COUNT} gold targets a round:`, detail: `each appears at its own moment and spot in the upper court (the same for everyone in the room) and stays about ${RALLY_V11_BONUS_LIFE / 60} seconds, its ring counting down. Any ball that touches it scores ${RALLY_V10_BONUS_PTS}; a miss costs nothing.`, helpOnly: true },
        { action: "Aim with the paddle:", detail: "where the ball meets it sets the angle; move the paddle as you hit to spin the return: the faster the paddle, the more the ball swerves the way it moved. Spin scores nothing itself.", helpOnly: true },
        { action: "From 30 seconds a bumper", detail: "appears mid-court (it blinks a warning first). Balls bounce off it like a mirror, at the same speed.", helpOnly: true },
        { action: "For the last 15 seconds", detail: "a second bumper joins it (from 45 s, with the same blinking warning), always far enough away for a ball to pass between them.", helpOnly: true },
        { action: "Miss the blue ball", detail: "and the run is over.", helpOnly: true },
      ],
      // rallyRev 10 (docs/expansions/e9.md): the gold hits and pads on their curve, plus the gold targets.
      score: liveBandHelp("rally", "Each gold-ball hit counts 5, each pink target 6 and each blue-ball return 1; losing the blue ball ends the run.", { more: "More gold hits and pink targets", good: (u) => `counts ${u} – about ${Math.round(u / 5)} gold-ball hits`, finish: `Each gold target struck adds ${RALLY_V10_BONUS_PTS} (${RALLY_V10_BONUS_COUNT} a round).` }),
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
        { action: "Small is worth more:", detail: "onion 3, golden fruit 5." },
        { action: "Fill the ticket; skim chillies,", detail: "never cut one." },
        { action: "Never cut a chilli:", detail: "it costs 10 points and ends your combo.", helpOnly: true },
        { action: "Cut a bottle:", detail: "ketchup, mustard or mayo power-up.", helpOnly: true },
        { action: "Food sizes:", detail: `bread is big and worth ${SLICE_V9_VALUE[0]}, cabbage and meat ${SLICE_V9_VALUE[1]}, onions small and worth ${SLICE_V9_VALUE[2]}, golden fruit tiny and worth ${SLICE_V9_VALUE[4]}.`, helpOnly: true },
        { action: "Golden fruit:", detail: `cut one while a combo is live for +${SLICE_V9_GOLD_POINTS} at ×2 or +${2 * SLICE_V9_GOLD_POINTS} at ×3.`, helpOnly: true },
        { action: "Order tickets:", detail: `the ticket at the top right asks for one food, 1–3 in a row, before its time runs out (cutting another food starts the count again). Filling it adds ${SLICE_V9_TICKET_POINTS}.`, helpOnly: true },
        { action: "Dodge streak:", detail: `slice food close past a chilli (it shows DODGE) and let the chilli fall: ${SLICE_V9_DODGE_POINTS}, ${2 * SLICE_V9_DODGE_POINTS}, then ${3 * SLICE_V9_DODGE_POINTS} for each dodge in a row. Cutting a chilli ends the streak.`, helpOnly: true },
        { action: "Bottles:", detail: "ketchup stops chillies, mustard slows time, mayo pulls food together.", helpOnly: true },
        { action: "Saucy (ketchup): 3 chilli-free seconds.", detail: "Simmer (mustard): 4 slow seconds. Squeeze (mayo): nearby food gathers where you cut it.", helpOnly: true },
        { action: "One finger-down-to-up path counts together", detail: "– curves too, up to the full height of the screen. Each combo resets a 10-second timer.", helpOnly: true },
      ],
      // sliceRev 9 (docs/expansions/e5.md): the value-weighted share on its curve, plus the bonus points.
      score: `Combo-weighted food values (bread ${SLICE_V9_VALUE[0]}, cabbage and meat ${SLICE_V9_VALUE[1]}, onion ${SLICE_V9_VALUE[2]}, golden fruit ${SLICE_V9_VALUE[4]}) out of the most the run offers (every food at ×3), in thousandths. More combo slices, higher score – 150 at ${bandTop(SLICE_V9_BAND_CURVE)}. A good run (${BAND_GOOD_POINTS} points) reaches ${bandUnitsFor(SLICE_V9_BAND_CURVE, BAND_GOOD_POINTS)}. Golden fruit in a combo, filled tickets and dodges add up to ${SLICE_V9_BONUS_CAP} more. Each chilli costs 10 and ends the combo. Up to {max}.`,
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
        { action: "The Joker (a black bubble with a gold crown and a rainbow rim)", detail: "joins every colour it touches and pops each group that reaches three. A mine clears every bubble within two rings of where it lands.", helpOnly: true },
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
        { action: "Hold tails, swipe arrows,", detail: "tap twin dots twice." },
        { action: "Full meter? Tap it:", detail: "FEVER doubles notes!" },
        { action: "Gold notes and Perfect streaks", detail: "score a bonus; five lanes from 40 s.", helpOnly: true },
        { action: "Tail notes:", detail: "hold, let go at the end.", helpOnly: true },
        { action: "Arrow notes:", detail: "swipe that way on the line.", helpOnly: true },
        { action: "A 75-second song:", detail: "from 40 s, after a short break, the lanes become five (a pink fifth lane), easing in with a few seconds of single notes, and the last section is the busiest.", helpOnly: true },
        { action: "Fever:", detail: "Perfects (and Goods, half as much) fill the meter at the top; a miss empties it. When it flashes TAP FEVER!, tap it: for 8 seconds every note you hit counts twice.", helpOnly: true },
        { action: "Golden notes:", detail: "hit one dead on – on the very moment it meets the line – for a bonus point.", helpOnly: true },
        { action: "Double taps:", detail: "two notes with white dots, close together in one lane. Tap both; both Perfect earns a bonus point.", helpOnly: true },
        { action: "Perfect streak:", detail: "a bonus point for every 10 Perfects in your longest run of Perfects.", helpOnly: true },
        { action: "Closer is better", detail: "– perfect, good, or just OK.", helpOnly: true },
        { action: "A tap with no note", detail: "costs nothing.", helpOnly: true },
        { action: "Notes with a tail are holds", detail: "– press as the head reaches the line, release as the tail reaches it. Both ends must be Perfect for Perfect, or within Good for Good; otherwise Miss.", helpOnly: true },
        { action: "Swipe notes (from 30 seconds)", detail: "show a left or right arrow. Flick your finger that way in the lane as the note reaches the line. A plain tap won't hit them, and the wrong way is a miss.", helpOnly: true },
        { action: "Keep a combo going", detail: "to light up the lanes at 10, 25 and 50 – a miss resets it.", helpOnly: true },
      ],
      score: `${liveBandHelp("beat", "Perfect counts 4, Good 3, OK 1 and a missed note −2, out of 4 a note, in thousandths of the chart.", { more: "More notes, closer to the beat", good: (u) => `reaches ${u}` })} Fever (up to ${BEAT_V9_CAPS.fever}), golden notes (up to ${BEAT_V9_CAPS.gold}), double taps (up to ${BEAT_V9_CAPS.double}) and the Perfect streak (up to ${BEAT_V9_CAPS.streak}) earn up to 50 skill points, paid on a rising scale (20 pay ${bandPoints(BEAT_V9_SKILL_PAY, 20)}, 40 pay ${bandPoints(BEAT_V9_SKILL_PAY, 40)}, all 50 pay 50), to {max}.`,
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
      goal: "Five waves and two bosses in 90 s.",
      how: [
        { action: "Drag to move;", detail: "you fire on your own." },
        { action: "Catch power-ups;", detail: "keep a hit streak going." },
        { action: "Bosses:", detail: "hit weak points dead centre." },
        { action: "Red bolts and divers cost a life:", detail: "you have 3.", helpOnly: true },
        { action: "The run lasts 90 seconds.", detail: "Each new wave flies in from the top 2 seconds after you clear one. Don't let a formation reach your line.", helpOnly: true },
        { action: "From wave 3, ships peel off and dive at you,", detail: "then fly back to their place. Shoot them on the way; one that rams you costs a life.", helpOnly: true },
        { action: "Each wave flies its own shape:", detail: `a grid, then a triangle, a circle, a pentagon and an octagon – ${WAV_X_SHAPES} ships each, with six escorts under the shapes. Waves 3 and 4 come down more slowly.`, helpOnly: true },
        { action: "From wave 2, a grey armoured ship", detail: "sits in the middle of the shape and takes 6-12 hits – every hit counts.", helpOnly: true },
        { action: "Power-ups:", detail: `${WAV_X_DROPS} fall from the top at set moments in every run, the same for everyone in a room, ${WAV_X_DROPS / 3} of each. Laser: 5 shots that pierce up to 3 enemies. Spread: ${WAV_X_SPREAD_VOLLEYS} volleys with two extra bolts angled out. Shield: absorbs the next hit (${WAV_X_SHIELD_TICKS / 60} s).`, helpOnly: true },
        { action: "A saucer flies over every 15 seconds:", detail: "shoot it down for skill points.", helpOnly: true },
        { action: "Streak:", detail: `every hit in a row counts; ×2 from ${WAV_X_STREAK_STEP} in a row, ×3 from ${2 * WAV_X_STREAK_STEP} (the most). A shot that flies off without hitting, or a lost life, ends it; spread bolts, shots fired while a wave flies in and hits on a boss's hull don't.`, helpOnly: true },
        { action: "After wave 3 a gunship flies in; after wave 5, the boss.", detail: `The boss comes ${WAV_X_BOSS_BY / 60} s into the run at the latest (whatever is still flying leaves). Each has two cannons (${WAV_X_CANNON_HP} hits each; a destroyed one stops firing) and a core that opens for half of every ${WAV_X_CORE_PERIOD / 60} s: a hit on the open core counts ${WAV_X_CORE_DAMAGE}. The boss's bar shows its ${WAV_BOSS_HP} hit points; destroying it ends the run – the sooner after it arrives, the more it scores.`, helpOnly: true },
        { action: "Weak points pay for precision:", detail: "a hit on a cannon or the open core scores more skill points the nearer its centre it lands – most within a pixel or so.", helpOnly: true },
      ],
      score: liveBandHelp("wavefront", "Ships, armour hits and boss hit points count 1, and cleared waves (the gunship too) 15.", {
        more: "More ships, hits and waves",
        finish: `Destroying the boss adds up to 10 for speed: the full 10 within 20 s of its arrival, falling to 0 at 40 s. Skill adds up to ${WAV_X_EDGE_MAX} more: the streak's points (1 a hit at ×2, 2 at ×3, up to ${WAV_X_STREAK_CAP}), ${WAV_X_SKILL_DROP} a power-up caught, ${WAV_X_SKILL_SAUCER} a saucer, ${WAV_X_SKILL_CANNON} a cannon destroyed, ${WAV_X_SKILL_CORE} an open-core hit, and ${WAV_X_SKILL_PRECISE * wavPrecision(1)} / ${WAV_X_SKILL_PRECISE * wavPrecision(3)} / ${WAV_X_SKILL_PRECISE * wavPrecision(5)} for a weak-point hit within 1 / 3 / 5 px of its centre. ${skillPayLine(WAV_X_SKILL_PAY)}`,
      }),
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
      goal: "Run the cave – flip to the other side to dodge, and chain flips for more.",
      how: [
        { action: "Tap to flip sides;", detail: "dodge the spikes (some slide). Flip again right after landing for a double flip." },
        { action: "Grab gold stars and star trails;", detail: "land a flip on a roof's faint sweet spot for a bonus." },
        { action: "Checkpoints save one crash.", detail: "Speed zones rush you on; tall caves mean longer flips." },
        { action: "Spikes or lava on one side?", detail: "Run on the other. Cracked tiles break less than half a second after you touch them: flip off fast.", helpOnly: true },
        { action: "Moving spikes", detail: "slide to and fro along the groove under them; time your flip to their slide.", helpOnly: true },
        { action: "The cave changes height:", detail: "in a tall stretch a flip takes longer to cross, in a tight one it is quicker. From 10 seconds the cave bends too, and hazards ride the bends with you.", helpOnly: true },
        { action: "Double flips:", detail: "flip again within about an eighth of a second of landing with a hazard close by. A triple and longer chains count more, and twice as much in a speed zone.", helpOnly: true },
        { action: "Star trails:", detail: `${FLIP_V8_TRAILS} arcs of ${FLIP_V8_TRAIL_STARS} small stars, taken in the air. Leave the surface at the chevron and your flip sweeps through them.`, helpOnly: true },
        { action: "Sweet spots:", detail: `${FLIP_V8_SWEETS} roofs carry a short, faint pale strip. Time a flip so you touch down with your feet inside it for a sweet landing; it glints. Each counts once.`, helpOnly: true },
        { action: "Checkpoints (15, 30 and 45 s):", detail: "pass one and your next crash is saved – a second of shield, but your survival time pauses for 10 seconds.", helpOnly: true },
      ],
      score: liveBandHelp("flip", "Each half second you last counts 1 and each gold star 3.", {
        more: "More time and stars",
        finish: `Lasting the full minute adds 10. Skill adds up to ${FLIP_V8_FEATURE_CAP} more: ${FLIP_V8_TRAIL_POINTS} a full star trail, ${FLIP_V8_SWEET_POINTS} a sweet landing, ${FLIP_V8_ZONE_POINTS} a speed zone run through without a save, ${FLIP_V8_CP_POINTS} a checkpoint reached without a crash, and double-flip combo points (up to ${FLIP_V8_COMBO_CAP}). ${skillPayLine(FLIP_V8_SKILL_PAY)}`,
      }),
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
        { action: "Bonus routes:", detail: "stars, silver, shamrock, clouds." },
        { action: "Levels 1-4", detail: "Draw lines around the white birds, then tap RELEASE to drop the coin into a still pot.", helpOnly: true },
        { action: "Levels 5-8", detail: "The pot moves! Time your release so the coin rolls into it.", helpOnly: true },
        { action: "Levels 9-10: LIVE", detail: "Draw one line, RELEASE, then keep drawing as the coin falls. Faded strokes commit when you lift your finger; you can't draw through birds or near the coin.", helpOnly: true },
        { action: "Bonus routes:", detail: `every one of levels 1-8 has an ink star and ${INK_SILVER_PER_LEVEL} silver coins on a harder route than the easy one; one level in the run also has the shamrock. Roll the coin through them and into the pot: they count only once the coin is potted. You never need them to finish a level.`, helpOnly: true },
        { action: "Bounce clouds:", detail: `${INK_CLOUD_LEVELS} levels have a springy cloud that throws the coin back up. On them the bonus route bounces off it: pot the coin after a bounce for a trick shot.`, helpOnly: true },
        { action: "Wind:", detail: `${INK_WIND_LEVELS} levels have a wind zone (streaks show which way it blows). A coin in the air inside it is pushed sideways; a coin rolling on a line is not.`, helpOnly: true },
        { action: "Ink is limited", detail: "Each level has a budget, with a larger shared supply for live levels.", helpOnly: true },
        { action: "Three failed drops", detail: "and you're out.", helpOnly: true },
      ],
      score: liveBandHelp("inkbridge", "Each level counts 10.", { more: "More levels", good: (u) => `counts ${u} – about ${Math.round(u / 10)} levels`, finish: `All ten levels adds up to 10 for speed: the full 10 with at least 45 s left, falling to 0 at the buzzer. Bonuses add up to ${INK_FEATURE_MAX} more: ${INK_RAW_STAR} an ink star, ${INK_RAW_TRICK} a trick shot, ${INK_RAW_SILVER} a silver coin and ${INK_RAW_SHAMROCK} the shamrock. ${skillPayLine(INK_V10_SKILL_PAY)}` }),
    },

    burst: {
      goal: "Split the atoms. Don't get hit.",
      how: [
        { action: "◀ ▶ to move,", detail: "tap the arena to shoot up." },
        { action: "Clear a wave with no miss:", detail: `+${BURST_V8_CLEAN_PTS}.` },
        { action: "Golden atom:", detail: `+${BURST_V8_GOLDEN_PTS} before it fades.` },
        { action: "An atom touching you", detail: "costs a life (3 lives).", helpOnly: true },
        { action: "Hold ◀ or ▶ to walk; tap anywhere on the arena to fire straight up.", detail: "There is no FIRE button: every tap on the arena is a shot.", helpOnly: true },
        { action: "Big atoms split into smaller ones;", detail: "the smallest pop.", helpOnly: true },
        { action: "Clean wave:", detail: `clear a wave without a single miss for ${BURST_V8_CLEAN_PTS} more. A miss is a shot that hits nothing (both beams of a double shot); one miss ends the bonus for that wave. The counter (CLEAN 7/7) shows shots that hit / shots fired.`, helpOnly: true },
        { action: "Fast wave:", detail: "3 more for clearing a wave within 5 s of it appearing, 2 within 8 s, 1 within 12 s.", helpOnly: true },
        { action: `${BURST_V8_GOLDENS} golden atoms:`, detail: `each appears at its own moment and spot (the same for everyone in the room) and fades after about 4 seconds. A beam that reaches one scores ${BURST_V8_GOLDEN_PTS}.`, helpOnly: true },
        { action: "Power-ups fall on a fixed schedule", detail: "(the same for everyone): DOUBLE fires two beams a shot for 8 s; FREEZE stops every atom for 3 s. Frozen atoms still hurt if you walk into one. They score nothing themselves.", helpOnly: true },
      ],
      // burstRev 8 (docs/expansions/e9.md): the atoms on their curve, lasting, plus clean waves, fast waves and golden atoms.
      score: liveBandHelp("burst", "Each atom hit counts 1 unit; each life lost takes 5 units off (never below a quarter of the atoms hit).", { more: "More atoms, fewer lives lost", good: (u) => `counts ${u} units`, finish: `Lasting the 90 s adds 10. Clean waves add up to ${BURST_V8_CAPS.clean}, fast waves up to ${BURST_V8_CAPS.clear} and golden atoms up to ${BURST_V8_CAPS.gold}.` }),
    },
    orbit: {
      goal: "Fly planet to planet to the sun.",
      how: [
        { action: "Tap to let go;", detail: "the next orbit catches you." },
        { action: "Grab stardust;", detail: "sling through moon rings." },
        { action: "Thread rock gaps;", detail: "let go on the first lap." },
        { action: "Checkpoint:", detail: "a crash returns you there.", helpOnly: true },
        { action: "Black hole:", detail: "fly in, skip 5-6 planets.", helpOnly: true },
        { action: "You orbit automatically.", detail: "Tap to let go – you fly straight until the next orbit catches you. Miss both of the next two orbits and the run ends (or you go back to your checkpoint) as soon as nothing ahead can catch you.", helpOnly: true },
        { action: "Set Checkpoint once while orbiting.", detail: "Your next crash returns you there. Without it, or after using it, a crash ends the run. Orbits are belt-safe. On later planets, time arrival and departure through the opening in the outside asteroid ring – it turns once every 12 seconds.", helpOnly: true },
        { action: "Orbits change shape.", detail: "Ovals speed up near the planet. On a figure-eight, let go only on the outer loops – never at the crossing.", helpOnly: true },
        { action: "Black holes:", detail: "about every ten planets a small black hole sits beside one planet. Let go at just the right moment to fly into it and you come out beside a planet 5 or 6 further on and fly into its orbit over about a second; the planets you skip count as reached. A checkpoint you set before the jump still works.", helpOnly: true },
        { action: "Any black hole ahead counts:", detail: "touch one with any part of the rocket on any flight, even from the planet before, and it swallows you; one you have already passed fades out.", helpOnly: true },
        { action: "Stardust:", detail: `${ORBIT_XP_TRAILS} trails of gold motes lie on the best line between some planets. Fly through them to collect them.`, helpOnly: true },
        { action: "Slingshot moons:", detail: `fly through one of the ${ORBIT_XP_MOONS} small moons' dashed rings without touching the moon and it flings you on at one and a half times the speed. Touching the moon is a crash.`, helpOnly: true },
        { action: "Asteroid fields:", detail: `${ORBIT_XP_FIELDS} lines of rocks across some hops. Thread the gap in the middle (the dotted line) for a bonus; hitting a rock is a crash.`, helpOnly: true },
        { action: "Perfect orbits:", detail: "let go while the gold arc still shows – during your first lap round the planet – and land in the next orbit.", helpOnly: true },
      ],
      score: liveBandHelp("orbit", "Each planet reached counts 1, and a crash still counts the part of the way to the next planet you flew.", { more: "More planets", good: (u) => `reaches ${u} planets`, finish: `Reaching the sun adds up to 10 for speed: the full 10 with at least half the time left, falling to 0 at the buzzer. Skill adds up to ${ORBIT_V12_SKILL_MAX} more: stardust up to ${ORBIT_XP_DUST_CAP} (all of it for ${ORBIT_XP_DUST_FULL} of the ${ORBIT_XP_TRAILS * ORBIT_XP_MOTES} motes), ${ORBIT_XP_SLING_PTS} for each slingshot (up to ${ORBIT_XP_SLING_CAP}), ${ORBIT_XP_THREAD_PTS} for each field threaded (up to ${ORBIT_XP_THREAD_CAP}) and 1 for every ${ORBIT_XP_PERFECT_PER} perfect orbits (up to ${ORBIT_XP_PERFECT_CAP}). ${skillPayLine(ORBIT_V12_SKILL_PAY)} Without the sun, skill pays at most ${ORBIT_V12_SKILL_PACED_FROM}; the last ${ORBIT_V12_SKILL_MAX - ORBIT_V12_SKILL_PACED_FROM} come for reaching it fast: a share from ${ORBIT_V12_PACE_FROM / 60} s left, all of them with about ${Math.round(ORBIT_V12_PACE_FULL / 60)} s left.` }),
    },

    snip: {
      goal: "Feed every fruit into the basket.",
      how: [
        { action: "Swipe a rope", detail: "to cut it; crooks catch fruit." },
        { action: "Feed every fruit;", detail: "golden ones within 7 s." },
        { action: "Par:", detail: "fewest cuts, under the par time." },
        { action: `${SNIP_X_LEVELS} levels,`, detail: "up to 14 s each; 1–3 fruits a level. Pegs and rings catch falling fruit: cut the vine to drop it on.", helpOnly: true },
        { action: "Taller courses:", detail: "each level opens with a look down the course from the basket up to the fruit; then the camera follows the fruit. The map at the side shows the whole course with your view boxed.", helpOnly: true },
        { action: "Pegs:", detail: "a wooden pole with an iron hook open at the top. It snags a fruit only when it falls freely down past the hook from above. Rings snag a free fruit that passes through their middle from any side. Each catches once and holds the fruit on a green vine.", helpOnly: true },
        { action: "Orchard pieces:", detail: "fruit rolls along sloped planks and down tin gutters and chutes, bounces hard off springy green branches, and a touch on a wasp nest loses it. Some baskets slide slowly side to side.", helpOnly: true },
        { action: "Wind:", detail: "the windsock and the drifting leaves show it. It swings the ropes and the fruit they hold back and forth; a falling fruit is not blown.", helpOnly: true },
        { action: "Fewest cuts:", detail: "every swipe counts as a cut, a miss too; one swipe across several ropes is one cut. Feed every fruit in no more cuts than the level's par (shown at the top left).", helpOnly: true },
        { action: "Par time:", detail: `each course has its own, shown beside the cuts and on the small dial under the windsock, which runs down with the level's clock. Feed every fruit at par cuts before it and the level is quick: up to ${SNIP_X_QUICK_RAW / 10} skill points, the full amount ${SNIP_X_PAR_MARGIN / 60} s or more inside it.`, helpOnly: true },
        { action: "Golden apples:", detail: "on levels 2, 4 and 6 one fruit is golden for the level's first 7 s (the gold ring round it runs down). Fed in time it scores extra; after that it ripens into an ordinary apple.", helpOnly: true },
        { action: "Golden leaves:", detail: "two along each course; the first counts 2, the second is a bonus.", helpOnly: true },
        { action: "Don't let fruit settle", detail: "on a ledge or plank, or fly out the top or bottom.", helpOnly: true },
        { action: "Everyone", detail: "gets the same six courses, wind, golden apples and par times in the same order.", helpOnly: true },
      ],
      score: liveBandHelp("snip", `Each level's fruit count ${SNIP_X_FEED_UNITS} between them and a leaf ${SNIP_X_STAR_UNITS}.`, { more: "More fruit and leaves", good: (u) => `counts ${u} – about ${Math.round(u / 20)} levels fed`, finish: `Feeding every fruit adds up to 10 for speed: the full 10 by 48 s. Skill adds up to ${SNIP_X_FEATURE_MAX} more: ${SNIP_X_GOLD_RAW / 10} a golden apple fed while golden, ${SNIP_X_PAR_RAW / 10} a level at par cuts, ${SNIP_X_STAR2_RAW / 10} a second leaf, up to ${SNIP_X_QUICK_RAW / 10} a level under its par time and ${SNIP_X_PERFECT_RAW / 10} for a perfect run (${SNIP_X_RAW_TOP / 10} in all). ${skillPayLine(bandCurve(SNIP_X_SKILL_PAY.units.map((u) => u / 10), SNIP_X_SKILL_PAY.points))}` }),
    },
    swing: {
      goal: "Swing to 500 m via gems and gates.",
      how: [
        { action: "Hold to grab and swing,", detail: "let go to fly." },
        { action: "Fly high for gems,", detail: "swoop fast through gates." },
        { action: "Land each ledge route", detail: "under its par time." },
        { action: "From 200 m a dragon chases you:", detail: "keep going.", helpOnly: true },
        { action: "Touch stars as you fly by", detail: "for bonus points.", helpOnly: true },
        { action: "Swing combos:", detail: "fly into each grab fast (a strong release) and grab the next anchor ahead within a second of your last grab, and the chain grows; a chain of 5, 10 and 15 in a row pays 2, 3 and 5 combo points as it gets there. A slow grab, hanging on too long or landing on a ledge ends the chain.", helpOnly: true },
        { action: "High route:", detail: `${SWING_GEMS} cyan gems sit at the tops of strong flights, close under the ceiling. Touch one to take it.`, helpOnly: true },
        { action: "Low route:", detail: `${SWING_GATES} speed gates hang under anchors. Grab early for a long rope and swoop through the glowing gap fast; it lights gold.`, helpOnly: true },
        { action: "Set routes:", detail: "before the dragon, two or three runs of ledges hang from the roof: a start ledge, landing ledges and a finish flag. Drop on to a ledge from above to land, then hold to kick off and swing to the next one. A cracked ledge collapses soon after you land on it.", helpOnly: true },
        { action: "Par times:", detail: "each route's start ledge shows its par, the time from landing on the start ledge to landing on the flag along the route's quickest swings, plus a little. Land every ledge of the route and reach the flag under par for skill points: the further under, the more. The clock under the distance shows a route's time while it runs.", helpOnly: true },
        { action: "Stuck? Keep swinging", detail: "– every pass gets you higher. Swipe up to shorten the rope for speed, down to let it out.", helpOnly: true },
        { action: "The dragon flies at a steady pace behind you.", detail: "Slow down or stall and it catches you, which ends the run. A marker at the left edge shows how far back it is.", helpOnly: true },
        { action: "Loose stalactites crumble, shedding grit,", detail: "for two seconds before they fall. Don't be under one.", helpOnly: true },
        { action: "Lava bubbles before it jets up.", detail: "Don't be over a jet when it erupts.", helpOnly: true },
        { action: "Ten stars float along the way,", detail: "spread evenly from start to finish: some high, some low, some on risky lines near the lava. Touch one to take it; they are optional.", helpOnly: true },
        { action: "Don't touch the spikes", detail: "or fall into the lava.", helpOnly: true },
      ],
      score: liveBandHelp("swing", "Each metre counts 1 (up to 500) and each star 5.", { more: "More metres and stars", finish: `Reaching 500 m adds 10. Skill adds up to ${SWING_FEATURE_CAP} more: a skill point for each gem (${SWING_GEMS}) and lit speed gate (${SWING_GATES}), each combo point (up to ${SWING_COMBO_CAP}: 2, 3 and 5 for a chain reaching 5, 10 and 15), ${SWING_LEDGE_POINTS} shared by the ledges you land and ${SWING_PAR_POINTS} shared by the routes you finish under par. ${skillPayLine(SWING_SKILL_PAY)}` }),
    },
    tilt: {
      goal: "Roll each marble into its own cup.",
      how: [
        { action: "Drag left or right", detail: "to spin the maze." },
        { action: "Keys open gates;", detail: "quick stars pay early." },
        { action: `From maze ${TILT_X_TWO_FROM}, two marbles,`, detail: "each to its own cup." },
        { action: "Marbles always roll down.", detail: `${TILT_X_MAZES} big mazes, each bigger than the screen: the view follows the marbles. A marble that falls into a black hole goes back to its start.`, helpOnly: true },
        { action: "Keys and gates:", detail: "a gate across the way to the cup stays shut until either marble rolls over its key, which waits in a side passage before the gate. A gate and its key share a colour.", helpOnly: true },
        { action: "Quick stars:", detail: `${TILT_X_QUICK} per maze, a few cells into an icy side passage before the gate. Each is worth ${TILT_X_QUICK_POINTS} while its ring is pale gold (until a run at the maze's par pace would reach it), then less as the ring turns amber, and it is gone ${TILT_X_QUICK_TAIL / 60} s later.`, helpOnly: true },
        { action: "Ice:", detail: "on the frosted cells the marble keeps its speed and slides further, so ease off before a turn or a hole.", helpOnly: true },
        { action: "Cups:", detail: "the blue marble goes in the blue cup, the amber marble in the amber cup, which always starts well away from it. Each marble can only leave through the gap by its own cup, and the maze is done when both are in. The marbles roll through each other.", helpOnly: true },
        { action: "Gold stars:", detail: `${TILT_X_STARS === 1 ? "one" : TILT_X_STARS} per maze, a step or two off the route. Roll either marble over ${TILT_X_STARS === 1 ? "it" : "one"} to collect it.`, helpOnly: true },
      ],
      score: liveBandHelp("tilt", `Each finished maze counts ${TILT_X_MAZE_UNITS}, getting closer to the exit in the maze you are on up to ${TILT_X_PROGRESS} more, and each gold star ${TILT_X_STAR_UNITS}.`, { more: "Further through the mazes and more stars", good: (u) => `counts ${u} – about ${Math.round(u / TILT_X_MAZE_UNITS)} mazes`, finish: `All ${TILT_X_MAZES} mazes adds 10. Skill adds up to 50 more: ${TILT_X_QUICK_POINTS} for each quick star in time, and up to ${TILT_X_PACE_POINTS} for each maze finished at its par (the time its shortest tour of stars and key to the cup takes, so long and short mazes pay alike), none at ${TILT_X_PACE_SLOW / 100}× par. ${skillPayLine(TILT_X_SKILL_PAY)}` }),
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
        { action: "Moves are limited", detail: "to about 4½× the fewest (the counter). Out of moves, the run ends there.", helpOnly: true },
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
      score: parBonusHelp("swapword", SWAP_PAR_BONUS_TOPUP, "swaps", "par swaps (the fewest that solve the board)"),
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
