import { openBandsLine } from "./puzzleBandsText";
import { logicStandardHelp } from "./standard/logicText";
import { FLOOD_STANDARD_SPARE_MOVES } from "./standard/logicRules";
import { wordSearchBonusHelp } from "./wordSearchText";
import { letterWheelJarHelp } from "./letterWheelText";
import { CODEWORD_STRETCH, TILEGRID_STRETCH_TOPUP, stretchHelp, strikeoutDepthHelp } from "./depth/stretchShapes";
import { parBonusHelp } from "./parBonusText";
import { SLIDE_PAR_BONUS_TOPUP } from "./wordSlide";
import { SW6_SPARE_SWAPS, SWAP_PAR_BONUS_TOPUP } from "./swapword";
import { STD_ROUNDABOUT, STD_STRIKEOUT, WORD_STANDARD_HELP } from "./standard/word";
import { preStandardPinned } from "./standard/stamps";
import { MINES_COUNT, MINES_HIT_COST } from "@/lib/arcade/minesweeper";
import { MAHJONG_SHUFFLE_COST } from "@/lib/arcade/mahjong";
import { puzzleNotesDealt } from "./puzzleNotes";
import { STANDARD_ATTENTION_HELP } from "./standard/attentionTexts";
import { PATTERN_STD_HELP } from "./standard/patternText";
import { standardNumberHelp } from "./standard/numberText";
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
import { bangOnDepthHelp, flashDepthHelp } from "./depth/speedTexts";
import { BAND_GOOD_POINTS, bandMapTotal, bandOpen, bandPoints, bandTop, bandUnitsFor } from "@/lib/arcade/scoreBands";
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
  TILT_S_CORE_MAX,
  TILT_S_FINISH_POINTS,
  TILT_S_MAZE_POINTS,
  TILT_S_MAZES,
  TILT_S_PROGRESS_POINTS,
  TILT_S_SPEED_FULL,
  TILT_S_SPEED_POINTS,
  TILT_S_STAR_POINTS,
  TILT_X_STARS,
  TILT_X_TWO_FROM,
} from "@/lib/arcade/tilt";
import { BUB_SPECIAL_BLOCK, BUB_TORPEDO_HITS, BUB_V3_JOKER_BLOCK, BUB_V8_CHESTS, BUB_V8_CHEST_FP, BUB_V8_FEATURE_MAX, BUB_V11_MINE_POPS } from "@/lib/arcade/bubble";
import {
  MATCHUP_V3_PAR_RAW,
  MATCHUP_V9_FEATURE_MAX,
  MATCHUP_V11_BIG_MAX,
  MATCHUP_V11_BIG_PTS,
  MATCHUP_V11_CORE_MAX,
  MATCHUP_V11_GOAL_PTS,
  MATCHUP_V11_GOALS,
  MATCHUP_V11_GOALS_MAX,
  MATCHUP_V11_ICE_MAX,
  MATCHUP_V11_ICE_PTS,
  MATCHUP_V11_TREASURE_MAX,
  MATCHUP_V11_TREASURE_PTS,
  MATCHUP_V11_TREASURES,
} from "@/lib/arcade/matchup";
import { BT_STD, BT_V7_BALLS, BT_V7_BOOST_STEPS, BT_V7_FEATURE_MAX, BT_V7_LAST_LAND_MIN } from "@/lib/arcade/ballTrack";
import { stdCore, stdFeatures, stdFeaturesHelp } from "@/lib/arcade/arcadeStandard";
import {
  HOVER_CENTRE_POINTS,
  HOVER_CENTRE_TOP,
  HOVER_CENTRE_TOL,
  HOVER_SKILL_SLACK,
  HOVER_CHAIN_POINTS,
  HOVER_CHAINS,
  HOVER_PICKUPS,
  HOVER_REACHABLE_GATES,
  HOVER_SKILL_MAX,
  HOVER_SKILL_PAY,
  HOVER_STARS,
  HOVER_TIGHT_GATES,
  HOVER_TIGHT_POINTS,
  HOVER_V2_GATES_SCORE,
  HOVER_V2_STARS_SCORE,
  HOVER_STD_CENTRE,
  HOVER_STD_CENTRE_FULL,
  HOVER_STD_CENTRE_ZERO,
  HOVER_STD_CHAIN_SHARE,
  HOVER_STD_CHAIN_WHOLE,
  HOVER_STD_CHAINS,
  HOVER_STD_CORE,
  HOVER_STD_GOLD,
  HOVER_STD_MAX,
  HOVER_STD_TIGHT,
} from "@/lib/arcade/hover";
import {
  WAV_BOSS_HP,
  WAV_X_CANNON_HP,
  WAV_X_CORE_DAMAGE,
  WAV_X_CORE_PERIOD,
  WAV_X_SAUCERS,
  WAV_X_SHAPES,
  WAV_X_SHIELD_TICKS,
  WAV_X_SPREAD_VOLLEYS,
  WAV_R11_CARRIERS,
  WAV_STD_CORE_FULL,
  WAV_STD_LIFE_COST,
  WAVEFRONT_STD,
} from "@/lib/arcade/wavefront";
import {
  INK_CLOUD_LEVELS,
  INK_STD,
  INK_V11_SILVER_PER_LEVEL,
  INK_V12_CORE_MAX,
  INK_LEVELS,
  INK_FEATURE_MAX,
  INK_RAW_SHAMROCK,
  INK_RAW_SILVER,
  INK_RAW_STAR,
  INK_RAW_TRICK,
  INK_V11_SKILL_PAY,
} from "@/lib/arcade/inkBridge";
import {
  SNAKE_V9_CAPS,
  SNAKE_V9_COLS,
  SNAKE_V9_ROWS,
  SNAKE_STD_CAPS,
  SNAKE_STD_COMBO_TICKS,
  SNAKE_STD_CORE_MAX,
  SNAKE_STD_GOLDS,
  SNAKE_STD_LANE_POINTS,
  SNAKE_STD_LANE_RIDE,
  SNAKE_STD_WARP_TICKS,
  SNAKE_STD_WARP_POINTS,
} from "@/lib/arcade/snake";
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
import {
  SLICE_V9_BAND_CURVE,
  SLICE_V9_BONUS_CAP,
  SLICE_V9_DODGE_POINTS,
  SLICE_V9_GOLD_POINTS,
  SLICE_V9_TICKET_POINTS,
  SLICE_V9_VALUE,
  SLICE_V9_GOLDS,
  SLICE_V9_MAX,
  SLICE_V11_BAND_CURVE,
  SLICE_V11_CHILLI,
  SLICE_V11_CLOSE,
  SLICE_V11_COMBO_CAP,
  SLICE_V11_COMBO_FOODS,
  SLICE_V11_COMBO_POINTS,
  SLICE_V11_CORE,
  SLICE_V11_DODGE_CAP,
  SLICE_V11_DODGE_POINTS,
  SLICE_V11_GOLD_CAP,
  SLICE_V11_TICKET_BREADS,
  SLICE_V11_TICKET_CAP,
} from "@/lib/arcade/slice";
import { BINTOSS_FAR_THROWS, BINTOSS_V9_FAR, BINTOSS_V9_FAR_MAX, BINTOSS_V9_HOOP, BINTOSS_FAR_CAP, BINTOSS_FAR_POINTS, BINTOSS_V7_BAND_CURVE } from "@/lib/arcade/binToss";
import { P4_PTS_COMBO, P4_PTS_JACKPOT, P4_PTS_JOULZ, P4_PTS_RAMP, P4_PTS_SKILL } from "@/lib/arcade/pinball4";
import {
  BULLSEYE_INNER_BULL_POINTS,
  BULLSEYE_RING_VALUES,
  BULLSEYE_V8_DEAD_CAP,
  BULLSEYE_V8_DEAD_PTS,
  BULLSEYE_V8_STREAK_CAP,
  BULLSEYE_V8_STREAK_STEP,
  BULLSEYE_V9_DEAD_CAP,
} from "@/lib/arcade/bullseye";
import { RALLY_V10_BONUS_COUNT, RALLY_V10_BONUS_PTS, RALLY_V11_BONUS_LIFE, RALLY_V12_PAD_PTS, RALLY_V12_TARGET_PTS } from "@/lib/arcade/rally";
import {
  BURST_V9_CAPS,
  BURST_V9_CLEAR_MAX,
  BURST_V8_GOLDEN_PTS,
  BURST_V8_GOLDENS,
  BURST_V10_ATOMS,
  BURST_V10_CLEAR_MAX,
  BURST_V10_CLEAR_PER_WAVE,
  BURST_V10_CORE_MAX,
  BURST_V10_GOLDEN_MAX,
  BURST_V10_GOLDEN_PTS,
  BURST_V10_GOLDENS,
  BURST_V10_LIFE_COST,
  BURST_V10_WAVES,
} from "@/lib/arcade/burst";
import { liveBandHelp, liveStdHelp as bullseyeStdHelp, liveStdHelp } from "@/lib/arcade/liveBands";
import {
  ORBIT_V12_PACE_FROM,
  ORBIT_V12_PACE_FULL,
  ORBIT_V12_SKILL_MAX,
  ORBIT_V12_SKILL_PACED_FROM,
  ORBIT_V12_SKILL_PAY,
  ORBIT_XP_DUST_CAP,
  ORBIT_XP_DUST_FULL,
  ORBIT_XP_FIELDS,
  ORBIT_XP_MOONS,
  ORBIT_XP_MOTES,
  ORBIT_XP_PERFECT_CAP,
  ORBIT_XP_PERFECT_PER,
  ORBIT_XP_SLING_CAP,
  ORBIT_XP_SLING_PTS,
  ORBIT_XP_THREAD_CAP,
  ORBIT_XP_THREAD_PTS,
  ORBIT_XP_TRAILS,
  ORBIT_STD,
  ORBIT_STD_PERFECT_OF,
} from "@/lib/arcade/orbitRev3";
import {
  CROSS_V9_SKILL_PAY,
  CROSS_X_BONUS_MAX,
  CROSS_X_CLOSE_MAX,
  CROSS_X_CLOSE_POINTS,
  CROSS_X_COIN_CROSSINGS,
  CROSS_X_COIN_POINTS,
  CROSS_X_COINS_PER_RUN,
  CROSS_STD,
  CROSS_STD_STREAK_EACH,
  CROSS_STD_STREAK_MAX,
} from "@/lib/arcade/cross";
import {
  SWING_V15_CORE,
  SWING_V15_GATES,
  SWING_V15_GEMS,
  SWING_V15_MAX,
  SWING_V15_PAR_POINTS,
  SWING_V15_PICKUP_POINTS,
  SWING_V15_RUNS,
  SWING_V15_STARS,
  SWING_V14_GATES,
  SWING_V14_GEMS,
  SWING_V14_PAR_POINTS,
  SWING_V14_PICKUP_POINTS,
  SWING_V14_SECTIONS,
  SWING_V14_STARS,
} from "@/lib/arcade/swing";
import {
  BRK_V10_GOLD_HITS,
  BRK_V9_COLS,
  BRK_V9_COMBO_MAX,
  BRK_V9_COMBO_X2,
  BRK_V9_COMBO_X3,
  BRK_V9_GOLD,
  BRK_V9_GOLD_POINTS,
  BRK_V9_ROWS,
  BRK_V9_SKILL_MAX,
  BRK_V9_SKILL_PAY,
  BRK_V11_BRICKS,
  BRK_V11_CLEAR_POINTS,
  BRK_V11_CORE_MAX,
  BRK_V11_GOLD_MAX,
  BRK_V11_MAX,
  BRK_V11_SPEED_MAX,
} from "@/lib/arcade/breaker";
import {
  FLIP_V8_COMBO_CAP,
  FLIP_V8_CP_POINTS,
  FLIP_V8_FEATURE_CAP,
  FLIP_V9_SKILL_PAY,
  FLIP_V8_SWEETS,
  FLIP_V8_SWEET_POINTS,
  FLIP_V8_TRAILS,
  FLIP_V8_TRAIL_POINTS,
  FLIP_V8_TRAIL_STARS,
  FLIP_V8_ZONE_POINTS,
  FLIP_STD,
} from "@/lib/arcade/flip";
import { bandCurve, type BandCurve } from "@/lib/arcade/scoreBands";
import { SNIP_X_FEATURE_MAX, SNIP_X_FEED_UNITS, SNIP_X_GOLD_RAW, SNIP_X_LEVELS, SNIP_X_PAR_MARGIN, SNIP_X_PAR_RAW, SNIP_X_PERFECT_RAW, SNIP_X_QUICK_RAW, SNIP_X_RAW_TOP, SNIP_X_SKILL_PAY, SNIP_X_STAR2_RAW, SNIP_X_STAR_UNITS } from "@/lib/arcade/snip";
import { fillMax, liveRecord } from "./roundMax";
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
      score: preStandardPinned() ? stretchHelp("tilegrid", TILEGRID_STRETCH_TOPUP) : WORD_STANDARD_HELP.tilegrid,
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
      score: standardNumberHelp("balance"),
    },
    wordslide: {
      goal: "Slide rows and columns until every row is a word.",
      how: [
        { action: "Swipe a row or column;", detail: "letters wrap round." },
        { action: "Lock a finished word", detail: "with its padlock." },
        // Joe's puzzle notes (28 Oct 2026, wordSlideRev 4): the last row's tiles swap once four words are locked.
        ...(puzzleNotesDealt()
          ? [{ action: "Four words locked?", detail: "Tap two tiles in the last row to swap them; each swap is a move." }]
          : []),
        { action: "Finish within par", detail: "moves for a bonus; Undo and Reset count." },
        { action: "Par", detail: "is the number of slides that scrambled the board, shown beside your moves (gold while you are within it).", helpOnly: true },
        { action: "Words are 5 letters.", detail: "Column swipes go around a locked row.", helpOnly: true },
        { action: "Words are checked", detail: "against a standard British English dictionary.", helpOnly: true },
      ],
      score: preStandardPinned() ? parBonusHelp("wordslide", SLIDE_PAR_BONUS_TOPUP, "moves", "the par moves") : WORD_STANDARD_HELP.wordslide,
    },
    target: {
      goal: "Use the six numbers to make the target.",
      how: [
        { action: "Tap two numbers,", detail: "then + − × or ÷." },
        { action: "Use each number", detail: "once at most." },
        { action: "Every step", detail: "must be a whole number." },
        { action: "Elegance bonus:", detail: "hit the target with 5 numbers, not all 6." },
      ],
      score: standardNumberHelp("target"),
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
      score: standardNumberHelp("equation"),
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
        { action: "Flow:", detail: "right taps in a row, with no wrong tap, build a bonus." },
        { action: "The timer above the board", detail: "counts up to 15 s, then the numbers move and it starts again from 0.", helpOnly: true },
      ],
      // The scoring standard (tapRev 6): standard/attentionTexts.ts.
      score: STANDARD_ATTENTION_HELP.numhunt(),
    },
    stroop: {
      goal: "Steer each falling word into the right gate.",
      how: [
        { action: "◀ ▶, joystick or tap a lane", detail: "to steer." },
        { action: "Swipe down or ▼", detail: "to drop it fast." },
        { action: "Watch the banner:", detail: "the rule swaps every 15 s." },
        { action: "The rule", detail: "is either the ink colour or what the word says.", helpOnly: true },
        { action: "Grey word in a dashed frame:", detail: "don't touch it – let it fall." },
        { action: "Gold-bordered word:", detail: "sort it right for a bonus." },
        { action: "Streak:", detail: "words right in a row; the lanes glow brighter as it grows.", helpOnly: true },
        { action: "Sort the last word", detail: `to finish – the run ends when all ${CLASH_QUEUE} are sorted, or at 75 seconds.`, helpOnly: true },
      ],
      // The scoring standard (clashRev 10): standard/attentionTexts.ts.
      score: STANDARD_ATTENTION_HELP.stroop(),
    },
    symscan: {
      goal: "Find every eagle that matches the target.",
      how: [
        { action: "Tap each eagle", detail: "facing the target's way." },
        { action: "Press Submit", detail: "to lock the grid." },
        { action: "Three grids,", detail: "each bigger, in 30 seconds." },
        { action: "Grid 3 has two targets:", detail: "tap every eagle facing either one.", helpOnly: true },
      ],
      score: STANDARD_ATTENTION_HELP.symscan(),
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
      score: STANDARD_ATTENTION_HELP.spotdiff(),
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
        // Joe's puzzle notes (28 Oct 2026, countRev 6): the second tray may ask for a shape alone or a colour alone.
        { action: "Read the question:", detail: puzzleNotesDealt() ? "a shape, a colour, or both." : "a shape and a colour." },
        { action: "Type the total;", detail: "ENTER goes to the next." },
        { action: "Tray 4 compares:", detail: "how many more of one colour than another?" },
        { action: "Four trays", detail: "share 60 seconds.", helpOnly: true },
        { action: "Colours", detail: "are red, blue, green, purple, pink, orange and white.", helpOnly: true },
      ],
      score: STANDARD_ATTENTION_HELP.countup(),
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
      score: PATTERN_STD_HELP.unblock,
    },
    blockparty: {
      goal: "Fit every piece into the free squares.",
      how: [
        { action: "Tap a piece", detail: "to rotate it." },
        { action: "Drag it", detail: "onto the board." },
        { action: "Fit every piece", detail: "around the fixed pegs." },
        { action: "Drag a piece's anchor", detail: "onto a free board square.", helpOnly: true },
      ],
      score: PATTERN_STD_HELP.blockparty,
    },
    lightsout: {
      goal: "Turn every light off.",
      how: [
        { action: "Tap a light", detail: "to flip it and its neighbours." },
        { action: "Plan each press:", detail: "nearby lights change too." },
        { action: "Par:", detail: "all off in the fewest presses scores a bonus." },
        { action: "Neighbours", detail: "are the four lights above, below, left and right.", helpOnly: true },
      ],
      score: logicStandardHelp("lightsout"),
    },
    pipes: {
      goal: "Connect every pipe to the source.",
      how: [
        { action: "Tap a tile", detail: "to rotate its pipe." },
        { action: "Join every opening", detail: "to another pipe." },
        { action: "No leaks", detail: "at the edges." },
        { action: "Par", detail: "is the fewest taps; the bar's gold mark shows it." },
      ],
      score: PATTERN_STD_HELP.pipes,
    },
    sudoku: {
      goal: "Fill the 6 × 6 sudoku grid.",
      how: [
        { action: "Tap a cell,", detail: "then a number." },
        { action: "Use 1-6 once", detail: "in each row, column and box." },
        { action: "Pencil marks", detail: "are for notes." },
        { action: "13 to 15 numbers", detail: "are given, and only one grid fits them.", helpOnly: true },
      ],
      score: logicStandardHelp("sudoku"),
    },
    flow: {
      goal: "Join every colour pair and fill every square.",
      how: [
        { action: "Drag from a dot", detail: "to its partner." },
        { action: "Paths can't cross", detail: "or enter dark walls." },
        { action: "Fill every square", detail: "with a path." },
        { action: "Drag from a loose end", detail: "to carry on; tap a dot to clear its path.", helpOnly: true },
      ],
      score: PATTERN_STD_HELP.flow,
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
      score: PATTERN_STD_HELP.iceslide,
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
      score: PATTERN_STD_HELP.push,
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
      score: PATTERN_STD_HELP.laser,
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
      score: logicStandardHelp("tower"),
    },
    maze: {
      goal: "Draw a path from the start to the exit.",
      how: [
        { action: "Drag", detail: "through the passages." },
        { action: "Walls", detail: "block your way." },
        { action: "Reach the exit", detail: "to finish." },
        { action: "Stars", detail: "anywhere in the maze add points, finished or not." },
        { action: "The path", detail: "moves one neighbouring cell at a time.", helpOnly: true },
      ],
      // The scoring standard (mazeRev 3): standard/attentionTexts.ts.
      score: STANDARD_ATTENTION_HELP.maze(),
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
      score: logicStandardHelp("tubes"),
    },
    safe: {
      goal: "Find the four-digit code that fits every clue.",
      how: [
        { action: "Use the arrows", detail: "to set each dial." },
        { action: "Tap TRY", detail: "to test it: three tries." },
        { action: "Only one code", detail: "fits every clue." },
        { action: "Clean crack:", detail: "open it on the first try for the full bonus." },
      ],
      score: logicStandardHelp("safe"),
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
      score: logicStandardHelp("bomb"),
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
      score: PATTERN_STD_HELP.gravity,
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
      ],
      // The scoring standard (chainDepthRev 3): no milestones; standard/attentionTexts.ts.
      score: STANDARD_ATTENTION_HELP.chain(),
    },
    nonogram: {
      goal: "Fill cells so every line matches its numbers.",
      how: [
        { action: "Tap a cell", detail: "to fill it; again to mark it empty." },
        { action: "The numbers", detail: "are the filled runs, in order." },
        { action: "A line dims", detail: "once it matches." },
      ],
      score: logicStandardHelp("nonogram"),
    },
    pairmatch: {
      goal: "Find all fifteen pairs.",
      how: [
        { action: "Tap two cards", detail: "to turn them over." },
        { action: "A match stays up;", detail: "a miss flips back." },
        { action: "Remember", detail: "where each card was." },
        // The streak and the gold pair, one short line.
        { action: "Bonus:", detail: "match in a row for a streak; find the gold pair in 30 s." },
      ],
      score: STANDARD_ATTENTION_HELP.pairmatch(),
    },
    flood: {
      goal: "Flood the whole board with one colour.",
      how: [
        { action: "Tap a colour", detail: "to repaint your region." },
        { action: "Your region grows", detail: "into touching cells of it." },
        { action: "You start", detail: "from the top-left corner." },
        { action: "Moves are limited:", detail: `par + ${FLOOD_STANDARD_SPARE_MOVES} (the counter). Out of moves, the board ends and scores 0.`, helpOnly: true },
      ],
      score: logicStandardHelp("flood"),
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
      score: PATTERN_STD_HELP.tiles,
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
      score: PATTERN_STD_HELP.rings,
    },
    hover: {
      goal: "Fly through the barrier gaps.",
      how: [
        { action: "Tap to hover up;", detail: "let go to drop." },
        { action: "Gold gates:", detail: "thread them, dead centre for more." },
        { action: "Star chains:", detail: "sweep them; shields take a crash." },
        { action: "Touch gold stars", detail: "in tight gaps for a bonus. Later barriers have two gaps, or slide.", helpOnly: true },
        { action: "Hit anything", detail: "and the run ends. Gold stars sit near the edge of a gap, so they are risky.", helpOnly: true },
        { action: `${HOVER_TIGHT_GATES} tight gates:`, detail: `a narrow gold-rimmed second gap on a barrier. Fly through it without touching anything for ${HOVER_STD_TIGHT / HOVER_TIGHT_GATES} points.`, helpOnly: true },
        { action: "The centre line:", detail: `a faint line through each tight gate lights up as you fly along it. Stay within ${HOVER_STD_CENTRE_FULL / 256} px of it across the barrier for ${HOVER_STD_CENTRE / HOVER_TIGHT_GATES} more, less the further you stray, none from ${HOVER_STD_CENTRE_ZERO / 256} px.`, helpOnly: true },
        { action: `${HOVER_CHAINS} star chains:`, detail: `5 to 7 stars on one flap's arc between two barriers. Each chain pays up to ${HOVER_STD_CHAINS / HOVER_CHAINS}: ${HOVER_STD_CHAIN_SHARE} shared by its stars, ${HOVER_STD_CHAIN_WHOLE} more for every one of them.`, helpOnly: true },
        { action: `${HOVER_PICKUPS} shield bubbles`, detail: "sit at the same places for everyone. Touch one for a shield: your next crash breaks it instead and you fly on, untouchable for a moment.", helpOnly: true },
        { action: "Two-gap barriers:", detail: "fly through either gap. Sliding barriers move slowly and steadily up and down.", helpOnly: true },
        { action: "Taller sky:", detail: "the flight area fills your screen, and gaps sit anywhere from near the top to near the bottom. The faint stars behind are scenery only.", helpOnly: true },
        { action: "Everyone flies", detail: `the same course for sixty seconds: ${HOVER_REACHABLE_GATES} barriers in a clean run (the first a wide warm-up gap) and ${HOVER_STARS} gold stars.`, helpOnly: true },
      ],
      // hoverRev 10 (the arcade scoring standard): five parts, each with its maximum, adding up to 200.
      score: liveBandHelp("hover", `Barriers passed: ${HOVER_STD_CORE} for all ${HOVER_REACHABLE_GATES} barriers, each one worth the same.`, { more: "More barriers", good: (u) => `passes ${u} barriers`, finish: `Star chains add up to ${HOVER_STD_CHAINS} (${HOVER_STD_CHAINS / HOVER_CHAINS} a chain: ${HOVER_STD_CHAIN_SHARE} by the share of its stars you touch, ${HOVER_STD_CHAIN_WHOLE} for the whole chain), gold stars up to ${HOVER_STD_GOLD} (${HOVER_STD_GOLD / HOVER_STARS} each), tight gates up to ${HOVER_STD_TIGHT} (${HOVER_STD_TIGHT / HOVER_TIGHT_GATES} each) and centre lines up to ${HOVER_STD_CENTRE} (${HOVER_STD_CENTRE / HOVER_TIGHT_GATES} a gate). Barriers ${HOVER_STD_CORE} + chains ${HOVER_STD_CHAINS} + gold stars ${HOVER_STD_GOLD} + tight gates ${HOVER_STD_TIGHT} + centre lines ${HOVER_STD_CENTRE} = ${HOVER_STD_MAX}; lasting the minute adds nothing. Any run you play scores at least 1.` }),
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
        { action: "Perfect drops", detail: "in a row build a streak." },
        { action: "Next block:", detail: "gold, narrow or wide." },
        { action: "Next-block preview:", detail: "five gold blocks come in every run, at the same places for everyone; land one perfectly to score it. Narrow is harder and wide easier; both count as a floor like any other.", helpOnly: true },
        { action: "Every 10 floors", detail: "the camera pulls back to show the city.", helpOnly: true },
        { action: "From block 20", detail: "a waving flag warns of wind.", helpOnly: true },
        { action: "Overhang is cut", detail: "so the next block is narrower. Line it up exactly (a perfect drop) and the block grows back a little.", helpOnly: true },
        { action: "Perfect streak:", detail: "your longest run of perfect drops in a row counts, up to 10. A drop that isn't perfect resets it.", helpOnly: true },
        { action: "Narrow and wide blocks", detail: "are perfect when centred on the top. A centred wide block stays whole, so the tower widens; off-centre, the overhang is cut as usual.", helpOnly: true },
        { action: "Wind:", detail: `once ${SKYLINE_WIND_FROM} blocks are placed, a flag flies from the top block. Still flag: no wind. It starts waving about a second before a gust and streams the way the gust blows. Every gust is the same strength and nudges the sliding block that way while it blows.`, helpOnly: true },
        { action: "Taller view, more sky:", detail: "the tower climbs higher before the camera pulls back.", helpOnly: true },
        { action: "Everyone", detail: "gets the same gusts at the same moments.", helpOnly: true },
      ],
      score: liveStdHelp("skyline", "Every floor you build counts the same."),
    },
    bintoss: {
      goal: "Throw the ball into the bucket.",
      how: [
        { action: "Drag to aim,", detail: "then let go to throw." },
        { action: "Wind 1 = a quarter bucket.", detail: "Aim into the flag." },
        { action: "Small far bucket:", detail: `+${BINTOSS_V9_FAR}, and its hoop +${BINTOSS_V9_HOOP}.` },
        { action: "Through the hoop, then in:", detail: `+${BINTOSS_V9_HOOP} bonus.`, helpOnly: true },
        {
          action: "Far buckets:",
          detail: `on throws 1-${BINTOSS_FAR_THROWS} a small bucket (about half the main one's width) stands still further back. Either bucket counts; the far one adds ${BINTOSS_V9_FAR} more (up to ${BINTOSS_V9_FAR_MAX} in all). The hoops hang over it.`,
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
          detail: `on three of throws 2-5 a hoop hangs over the far bucket. Go down through it and into a bucket for ${BINTOSS_V9_HOOP} bonus points. Its gold ends bounce the ball away.`,
          helpOnly: true,
        },
        {
          action: "Spinners:",
          detail: "on three of throws 6-10 a paddle turns in front of the bucket at a steady speed. Time your throw past it, or lob high over it.",
          helpOnly: true,
        },
        { action: "Drag down to the cancel strip", detail: "to put a throw back.", helpOnly: true },
      ],
      // binRev 9 (the arcade scoring standard, docs/arcade-standard/bintoss.md): fixed amounts, no curve.
      score: liveStdHelp("bintoss", "Ten throws, the same for everyone."),
    },
    bullseye: {
      goal: "Hit the gold 10, near and far.",
      how: [
        { action: "Drag to aim,", detail: "let go to throw." },
        { action: "Bulls in a row:", detail: `from the 3rd, +${BULLSEYE_V8_STREAK_STEP}, +${2 * BULLSEYE_V8_STREAK_STEP}, +${3 * BULLSEYE_V8_STREAK_STEP}…` },
        { action: "White dead-centre ring:", detail: "about +2 or +3 more." },
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
          detail: "The flag flies the way the wind blows, with its strength on it. Flag flying right with a 2? Aim two rings to the left.",
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
          detail: `the thin white ring in the middle of the bull (a quarter of its width, shown whenever the 10 is the centre ring). ${BULLSEYE_V9_DEAD_CAP} points are shared between the darts that have one (6 to 9 of the 10, the same for everyone), about 2 or 3 a dart, so hitting every one gives all ${BULLSEYE_V9_DEAD_CAP}. A dart inside it scores its share on top of the streak and keeps the streak going like any bull.`,
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
      // bullRev 9 (the arcade scoring standard, docs/arcade-standard/bullseye.md): the dart total on a straight line, plus
      // the bull streak and dead-centre darts.
      score: bullseyeStdHelp("bullseye", "Every dart point counts the same."),
    },
    matchup: {
      goal: "Match gems to meet each goal.",
      how: [
        { action: "Swap neighbours;", detail: "collect the goal's colours." },
        { action: "Match on frozen gems", detail: "to break the ice." },
        { action: "Clear below treasure", detail: "or swap it down." },
        { action: "4, 5 or an L / T", detail: "makes a bomb or a star; 5 plus an L / T in one swap makes a jackpot.", helpOnly: true },
        { action: "Four levels", detail: "each ask for a count of two or three colours (shown under the board); meet one and the next starts.", helpOnly: true },
        { action: "A frozen gem", detail: "can be swapped into or out of the ice only when the swap makes a line of three. Clear the gem in the ice (in a line, a cascade or a blast) and the ice breaks; it never comes back.", helpOnly: true },
        { action: "A treasure gem", detail: `can't be matched or blasted. It falls as the gems under it clear, and it swaps with a gem that then makes a line of three. It is collected on the bottom row; ${MATCHUP_V11_TREASURES} come a round.`, helpOnly: true },
        { action: "Drag one gem onto its neighbour", detail: "to swap them. Matched gems clear and new ones fall in; your next swap waits until the board has settled.", helpOnly: true },
        { action: "Line of 4: a bomb", detail: "(clears around it). Line of 5: a white four-point star (its row and column). An L or T: a six-point star (both diagonals).", helpOnly: true },
        { action: "A line of 5 and an L / T in one swap", detail: "makes a jackpot gem: it clears every gem of its colour plus its row and column.", helpOnly: true },
        { action: "Specials", detail: "go off when you swap them or match next to them, and set each other off.", helpOnly: true },
        { action: "Ninety seconds", detail: "on the same board for everyone; new gems drop from the same fixed queues.", helpOnly: true },
      ],
      // matchupRev 11 (the arcade scoring standard): the core on its straight line, then fixed amounts, to 200.
      score: liveBandHelp("matchup", "Every gem cleared counts, in a line, a cascade or a blast.", {
        more: "More gems cleared",
        good: (u) => `clears ${u.toLocaleString("en-GB")} gems`,
        finish: `Then treasure: ${MATCHUP_V11_TREASURE_PTS} for each brought down (up to ${MATCHUP_V11_TREASURE_MAX}); goals: ${MATCHUP_V11_GOAL_PTS} for each of the ${MATCHUP_V11_GOALS} colour goals met (up to ${MATCHUP_V11_GOALS_MAX}); ice: ${MATCHUP_V11_ICE_PTS} for each frozen cell broken (up to ${MATCHUP_V11_ICE_MAX}); big lines: ${MATCHUP_V11_BIG_PTS} for each line of 4 or 5 you match (up to ${MATCHUP_V11_BIG_MAX}). Gems ${MATCHUP_V11_CORE_MAX} + ${MATCHUP_V11_TREASURE_MAX} + ${MATCHUP_V11_GOALS_MAX} + ${MATCHUP_V11_ICE_MAX} + ${MATCHUP_V11_BIG_MAX} make 200.`,
      }),
    },
    snake: {
      goal: "Eat the stars; don't crash.",
      how: [
        { action: "Swipe to turn.", detail: "Stars grow and speed you up." },
        { action: "Red shadow?", detail: "A rock lands there in 2 s." },
        { action: "Gold stars, lanes, wormholes:", detail: "bonus points." },
        { action: "Quick stars build a combo;", detail: "wormholes and violet lanes are quick, risky shortcuts.", helpOnly: true },
        { action: "At 20 stars,", detail: "a meteor shower drops 3 rocks!", helpOnly: true },
        { action: "Wormholes:", detail: `three pairs of swirling mouths. Go into one and you come straight out of its twin, still heading the same way, so look before you leap. A star eaten within ${SNAKE_STD_WARP_TICKS / 60} s of a trip is a warp star (+${SNAKE_STD_WARP_POINTS}).`, helpOnly: true },
        { action: "Gold comet stars:", detail: `about every 7 s a gold star appears for 5 s and fades. The ${SNAKE_STD_GOLDS} gold stars share ${SNAKE_STD_CAPS.gold} points: each is worth about ${(SNAKE_STD_CAPS.gold / SNAKE_STD_GOLDS).toFixed(1)} the moment it appears, falling evenly to 0 as it fades. It doesn't make you longer.`, helpOnly: true },
        { action: "Violet speed lanes:", detail: `one row and two columns. Travelling along one you move faster; every ride of ${SNAKE_STD_LANE_RIDE} squares in a row along a lane scores ${SNAKE_STD_LANE_POINTS}.`, helpOnly: true },
        { action: "Combo:", detail: `eat stars within ${SNAKE_STD_COMBO_TICKS / 60} s of each other; from the third in a row each star adds 1 bonus point.`, helpOnly: true },
        { action: "Rocks hit only your head.", detail: "A rock on your tail does nothing, and your tail passes through rocks. A big rock fills a 2 × 2 block: keep your head off all four squares.", helpOnly: true },
        { action: "Rocks start at length 9:", detail: "one more every 4 stars, up to 11. Stars never appear on a rock.", helpOnly: true },
        { action: "The meteor shower", detail: "comes once, when you reach 20 stars: three red shadows, then three rocks land together 2 s later. With the shower, at most 14 rocks.", helpOnly: true },
        { action: "Hit a wall, your tail or a rock with your head", detail: "and the run ends.", helpOnly: true },
        { action: "Taller and wider field:", detail: `${SNAKE_V9_COLS} squares across and ${SNAKE_V9_ROWS} down, so stars can be further away.`, helpOnly: true },
        { action: "Everyone gets", detail: "the same stars, and every rock lands on the same square at the same moment.", helpOnly: true },
      ],
      // snakeRev 11 (the arcade scoring standard): stars on a straight line to 120, then four fixed feature parts, 200 in all.
      score: liveBandHelp("snake", "Each star eaten counts the same.", {
        more: "More stars",
        good: (u) => `eats ${u} stars`,
        finish: `Gold stars add up to ${SNAKE_STD_CAPS.gold}, combos up to ${SNAKE_STD_CAPS.combo}, lane rides up to ${SNAKE_STD_CAPS.lane} and warp stars up to ${SNAKE_STD_CAPS.warp}: ${SNAKE_STD_CORE_MAX} + ${SNAKE_STD_CAPS.gold + SNAKE_STD_CAPS.combo + SNAKE_STD_CAPS.lane + SNAKE_STD_CAPS.warp} = ${SNAKE_STD_CORE_MAX + SNAKE_STD_CAPS.gold + SNAKE_STD_CAPS.combo + SNAKE_STD_CAPS.lane + SNAKE_STD_CAPS.warp}. A crash ends the run.`,
      }),
    },
    cross: {
      goal: "Get across the traffic as many times as you can.",
      how: [
        { action: "Swipe to hop.", detail: "Up goes forward; down and sideways step." },
        { action: "Grab gold coins;", detail: "cross again and again without a hit for a streak." },
        { action: "Reach the grass island:", detail: "after a hit you restart there." },
        { action: "Buses from crossing 2,", detail: "bikes and motorbikes from 3, cones from 4.", helpOnly: true },
        { action: "Buses are long and slow with small gaps:", detail: "time the gap or walk along to it. Motorbikes are narrow and very fast.", helpOnly: true },
        { action: "Bikes race along the green lanes;", detail: "cones block part of the road.", helpOnly: true },
        { action: "Three lives.", detail: "A hit sends you back to the start of this crossing, or to the island once you've reached it in that crossing.", helpOnly: true },
        { action: "Coins:", detail: `${CROSS_X_COINS_PER_RUN} a run, four on each of the first ${CROSS_X_COIN_CROSSINGS} crossings, in the riskiest lanes (two each side of the island, out near the edges); step onto one to grab it. Everyone meets the same coins in the same places.`, helpOnly: true },
        { action: "Streak:", detail: `each crossing without a hit straight after another one adds ${CROSS_STD_STREAK_EACH} (up to ${CROSS_STD_STREAK_MAX}); a hit ends the run of them.`, helpOnly: true },
        { action: "Close calls:", detail: `hop into a lane just as a vehicle has passed your spot (within a tenth of a second) for 1 point, once a lane each crossing, up to 10 a run.`, helpOnly: true },
        { action: "Busier each crossing:", detail: "the first has half the traffic, the next ones more, full traffic by crossing 4 and busier still after it. The first two always leave wide gaps; later traffic is tighter and faster.", helpOnly: true },
        { action: "After each crossing", detail: "you get a second on the kerb before the next one.", helpOnly: true },
        { action: "Only the walker counts:", detail: "traffic has to touch the figure itself (its arms' reach), not the space around it.", helpOnly: true },
      ],
      score: `Rows and crossings: ${liveBandHelp("cross", "Each row crossed counts 1 and each full crossing 2 more.", { more: "More rows and crossings" })} ${stdFeaturesHelp(CROSS_STD, { streak: `${CROSS_STD_STREAK_EACH} for each clean crossing straight after a clean one, five of them` })}`,
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
        { action: "Every brick scores;", detail: `gold bricks add ${BRK_V11_GOLD_MAX / BRK_V9_GOLD} each.` },
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
      ],
      // brkRev 11 (the arcade scoring standard): four fixed parts that total 200.
      score: liveBandHelp("breaker", `Every brick destroyed counts 1, the ${BRK_V9_GOLD} gold bricks included.`, { more: "More bricks", good: (u) => `breaks ${u} of the ${BRK_V11_BRICKS}`, finish: `Breaking the other ${BRK_V11_BRICKS - BRK_V9_GOLD} clears the wall and ends the run: clearing adds ${BRK_V11_CLEAR_POINTS}, plus up to ${BRK_V11_SPEED_MAX} for speed, the full ${BRK_V11_SPEED_MAX} with at least half the time left, falling evenly to 0 at the buzzer. Gold bricks add up to ${BRK_V11_GOLD_MAX}, ${BRK_V11_GOLD_MAX / BRK_V9_GOLD} each. Power-ups and combos add nothing extra, and a lost ball costs only time. Bricks ${BRK_V11_CORE_MAX} + clear ${BRK_V11_CLEAR_POINTS} + speed ${BRK_V11_SPEED_MAX} + gold ${BRK_V11_GOLD_MAX} = ${BRK_V11_MAX}.` }),
    },
    // Cards & Board (30 Oct 2026; docs/arcade-standard/minesweeper.md and mahjong.md).
    minesweeper: {
      goal: "Reveal every safe square without hitting a mine.",
      how: [
        { action: "Tap a square", detail: "to reveal it; the number counts the mines around it." },
        { action: "Flag a mine", detail: "with the Reveal / Flag switch, or a long press." },
        { action: "Tap a number", detail: "whose flags are all placed to reveal the rest round it." },
        { action: "The opening is revealed for you:", detail: "every board can be solved by logic alone, no guessing.", helpOnly: true },
        { action: "A mine costs 5", detail: "and stays marked; play goes on.", helpOnly: true },
        { action: "One board for everyone,", detail: `${MINES_COUNT} mines on 10 × 16, 90 seconds.`, helpOnly: true },
      ],
      score: liveStdHelp("minesweeper", `A mine hit costs ${MINES_HIT_COST}.`),
    },
    mahjong: {
      goal: "Clear the stack in matching pairs.",
      how: [
        { action: "Tap two matching tiles", detail: "to take them away." },
        { action: "Only free tiles:", detail: "nothing on top, and open on the left or right." },
        { action: "Stuck? Shuffle", detail: `re-deals the tiles that are left (−${MAHJONG_SHUFFLE_COST}).` },
        { action: "Undo", detail: "takes back the last pair or Shuffle, free and as often as you like; the clock keeps running." },
        { action: "Reset", detail: "puts back the original stack; the clock keeps running and Shuffles already used still count.", helpOnly: true },
        { action: "Every stack can be cleared:", detail: "it is built backwards from an empty board, and a Shuffle keeps it clearable.", helpOnly: true },
        { action: "Faces:", detail: "dots, bamboo and characters 1–9, the four winds and three dragons; a face matches only itself.", helpOnly: true },
        { action: "One stack for everyone,", detail: "72 tiles in four layers, 2 minutes.", helpOnly: true },
      ],
      score: liveStdHelp("mahjong", `A Shuffle costs ${MAHJONG_SHUFFLE_COST}.`),
    },
    // The Sports group (30 Oct 2026; docs/arcade-standard/homerun.md, freekick.md, racing.md).
    homerun: {
      goal: "Hit ten pitches as far as you can.",
      how: [
        { action: "Swipe through the ball", detail: "as it reaches the plate." },
        { action: "Swipe height", detail: "meets the pitch; the angle aims it." },
        { action: "Signs beyond the fence:", detail: "hit each one once." },
        { action: "The swing starts", detail: "the moment your finger starts moving, not when it lifts. Start just before the ball reaches the plate.", helpOnly: true },
        { action: "Height:", detail: "start your swipe level with where the ball will cross the faint box. Too high or too low hits it weakly.", helpOnly: true },
        { action: "Angle:", detail: "a level swipe hits it to centre field, a rising swipe pulls it to left field, a falling swipe sends it to right; the steeper, the further round. Past about 80° goes foul.", helpOnly: true },
        { action: "Ten pitches, one about every 6 seconds:", detail: "fastballs, curves, drops and changeups at different speeds and heights. Read each one from the pitcher's hand: the radar board shows what it was and how fast only after it is thrown.", helpOnly: true },
        { action: "After each swing", detail: "you see Early, Perfect or Late and where your bat met the ball against where it crossed.", helpOnly: true },
        { action: "The four signs", detail: "stand beyond the fence, so a ball that hits one is always a home run.", helpOnly: true },
        { action: "Everyone", detail: "faces the same pitches in the same order.", helpOnly: true },
      ],
      score: liveStdHelp("homerun", "Every pitch counts the same."),
    },
    freekick: {
      goal: "Score ten free kicks past the wall and the keeper.",
      how: [
        { action: "Draw a stroke through the ball:", detail: "its direction aims, its speed is power." },
        { action: "Bend the stroke", detail: "to curl the shot round the wall." },
        { action: "Gold targets:", detail: "top corners or the bar." },
        { action: "No aim line:", detail: "a short trail shows each shot's flight afterwards.", helpOnly: true },
        { action: "Each kick", detail: "has its own spot, 18 to 32 yards out and up to 35° either side (the chip at the top gives the distance), with a wall of 3 to 5 and the keeper set for it. No wind.", helpOnly: true },
        { action: "Placement:", detail: "a goal further from the keeper is worth a little more.", helpOnly: true },
        { action: "A bar target", detail: "counts only if the ball goes in off the bar.", helpOnly: true },
        { action: "The keeper", detail: "reacts the same way to the same shot every time, for everyone.", helpOnly: true },
      ],
      score: liveStdHelp("freekick", "Every kick counts the same."),
    },
    racing: {
      goal: "Drive two laps as fast and as cleanly as you can.",
      how: [
        { action: "Five red lights:", detail: "go when they go out." },
        { action: "Joystick:", detail: "left and right steer, push up to go, pull down to brake." },
        { action: "Stay on the tarmac:", detail: "grass and walls cost time." },
        { action: "The start:", detail: "the car waits on its grid spot while five red lights come on, one a second. When they all go out, the race clock starts.", helpOnly: true },
        { action: "Steering", detail: "is gentle near the middle of the stick and turns the wheels smoothly; push it right out for full lock. Let go to coast.", helpOnly: true },
        { action: "Clean sectors:", detail: "the bars on the right light for each sector with no wall or grass contact.", helpOnly: true },
        { action: "Braking boards", detail: "(150, 100, 50) count down to the tightest corners.", helpOnly: true },
        { action: "Ghost cars", detail: "show the other players in the room. They can't touch you and passing them scores nothing.", helpOnly: true },
        { action: "Everyone", detail: "races the same track.", helpOnly: true },
      ],
      score: liveStdHelp("racing", "Every metre of the track counts the same."),
    },
    // The Sports group (30 Oct 2026; docs/arcade-standard/minigolf.md, pool.md, curling.md): on the arcade scoring
    // standard from their first stamps.
    minigolf: {
      goal: "Hole all five holes in as few putts as you can.",
      how: [
        { action: "Pull back from the ball", detail: "to aim and set the power; let go to putt." },
        { action: "Par for each hole", detail: "is shown at the top; beat it for a bonus." },
        { action: "The dotted line", detail: "points where the ball will start; the pill shows the power.", helpOnly: true },
        { action: "Par + 3 strokes a hole:", detail: "after the last you move on, with points for how close you finished.", helpOnly: true },
        { action: "Windmills:", detail: "the sails turn across the doorway. Wait for the gap, then putt through; a sail knocks the ball back.", helpOnly: true },
        { action: "Tunnels:", detail: "roll over a dark hole and the ball pops out of the outlet ringed in the same colour, heading the way its arrows point. Some holes have two, to different places.", helpOnly: true },
        { action: "Sand traps", detail: "stop the ball fast; hills push it off their top; the striped curved walls carry it round a corner; castle gates have one archway.", helpOnly: true },
        { action: "Water:", detail: "one stroke added, and the ball goes back where you played it from.", helpOnly: true },
        { action: "Ramps:", detail: "raised slopes with side rails, lit at the crest, the arrows point uphill. The ball slows going up and speeds up coming down.", helpOnly: true },
        { action: "Logs, boulders and planters", detail: "bounce the ball; use the timber rails and logs as banks.", helpOnly: true },
        { action: "Par is the best route we found plus one,", detail: "so a birdie is always possible. The same five holes for everyone.", helpOnly: true },
      ],
      score: liveStdHelp("minigolf", "120 seconds for five holes."),
    },
    pool: {
      goal: "Pot all seven spots, then the black, without a miss.",
      how: [
        { action: "Drag anywhere on the table", detail: "to turn the cue round the cue ball; drag further from the ball for finer aim." },
        { action: "Pull the cue back", detail: "in the power meter at the bottom and let go to shoot." },
        { action: "Spot balls first:", detail: "hitting a stripe first, potting a stripe or touching no ball at all is a foul (−10)." },
        { action: "Tap the table", detail: "to point the cue straight at that spot.", helpOnly: true },
        { action: "The dotted line", detail: "runs to a ghost ball; the short line shows where the object ball goes, the faint one the cue ball's path.", helpOnly: true },
        { action: "Power:", detail: "the further you pull the cue, the harder the shot; green is soft, red full power.", helpOnly: true },
        { action: "Spin:", detail: "tap the cue ball, bottom right, and place the red dot anywhere on it: high for top spin (follow), low for back spin (draw, which pulls the cue ball back), left or right for side, which bends the bounce off a cushion.", helpOnly: true },
        { action: "Cue ball potted:", detail: "it comes back to its spot and costs you time.", helpOnly: true },
        { action: "The black too early", detail: "ends your run with no black or speed points.", helpOnly: true },
        { action: "Every layout is proved clearable", detail: "without a miss. The same table for everyone.", helpOnly: true },
      ],
      score: liveStdHelp("pool", "120 seconds. Fouls cost 10 each."),
    },
    curling: {
      goal: "Draw your eight stones onto the button.",
      how: [
        { action: "Slide the stone", detail: "along the start line, then drag the gold target to aim." },
        { action: "Tap In or Out,", detail: "then swipe up to release: the faster, the heavier." },
        { action: "Brush its left or right side", detail: "as it travels to bend it that way." },
        { action: "The dashed line", detail: "runs from the stone to the target: where you release it towards, not the curl.", helpOnly: true },
        { action: "Brushing", detail: "also carries the stone a little further. Brush anywhere on the screen: left of the stone bends it left, right of it bends it right.", helpOnly: true },
        { action: "The stone curls", detail: "towards the side its turn takes it, more as it slows. No line shows the curl.", helpOnly: true },
        { action: "Red-handled stones", detail: "are the opponent's: knock them out of the house. Every one can be hit with your stone staying in the 4-foot.", helpOnly: true },
        { action: "The inset, top right,", detail: "shows exactly where every stone sits.", helpOnly: true },
        { action: "A stone short of the far hog line,", detail: "or through the back or the sides, is out of play.", helpOnly: true },
      ],
      score: liveStdHelp("curling", "120 seconds, eight stones; each stone counts where it stops when you throw it."),
    },
    pinball: {
      goal: "Keep the ball in play and rack up table points.",
      how: [
        { action: "Hold left or right", detail: "to flip; tap to plunge." },
        { action: "Ramps, J-O-U-L-Z and jackpots", detail: "score bonuses." },
        { action: "Lock 3 balls", detail: "for multiball and a jackpot." },
        { action: "Hold the left or right half", detail: "of the screen to raise that flipper; two thumbs raise both.", helpOnly: true },
        { action: "Three balls, 90 seconds:", detail: "a lost ball comes back on the plunger.", helpOnly: true },
        { action: "Skill shot:", detail: `the power meter in the right-hand lane rises and falls; tap to plunge. Soft drops the ball into Z, full power into J. Plunge into the flashing letter for ${P4_PTS_SKILL.toLocaleString("en-GB")}.`, helpOnly: true },
        { action: "J-O-U-L-Z lanes:", detail: `a ball through a lane lights its letter (lit letters stay lit from ball to ball). Each flipper press shifts the lit letters, so line a dark one up under the ball. All five: ${P4_PTS_JOULZ.toLocaleString("en-GB")} table points and a J-O-U-L-Z bonus.`, helpOnly: true },
        { action: "Two ramps:", detail: `roll the ball up a ramp fast enough for ${P4_PTS_RAMP.toLocaleString("en-GB")}. The left ramp drops the ball onto the U lane; the right one brings it back through the spinner. A ramp shot within 4 seconds of the last one is a combo: ${P4_PTS_COMBO.toLocaleString("en-GB")} more and a combo bonus.`, helpOnly: true },
        { action: "Multiball:", detail: `a ramp shot lights the lock; with it lit, each ramp shot sinks the ball in the lock hole and a new one comes up. The third releases all three for 20 seconds with the jackpot lit: the target behind the drop targets, ${P4_PTS_JACKPOT.toLocaleString("en-GB")} a hit from below. A ball lost while another is in play costs nothing.`, helpOnly: true },
        { action: "One table for everyone,", detail: "with no luck in it.", helpOnly: true },
        { action: "Pink pop bumpers:", detail: `${PIN_PTS_BUMPER} a hit, and they kick the ball away.`, helpOnly: true },
        { action: "Orange drop targets:", detail: `${PIN_PTS_TARGET} each. Knock all four down for ${PIN_PTS_BANK.toLocaleString("en-GB")} more and a lit spinner for 15 seconds.`, helpOnly: true },
        { action: "Spinner in the left lane:", detail: `${PIN_PTS_SPIN} a turn, ${PIN_PTS_SPIN_LIT} while lit. A faster ball spins it more.`, helpOnly: true },
        { action: "Yellow slingshots", detail: `kick the ball back across (${PIN_PTS_SLING} each).`, helpOnly: true },
        { action: "A ball between the flippers drains.", detail: "Hold a flipper up to catch the ball on it, then let go and flip again to aim.", helpOnly: true },
      ],
      score: liveStdHelp("pinball", "Every switch, ramp, lock, jackpot and skill shot scores table points (no multiplier)."),
    },
    // Cards & Board (30 Oct 2026): born on the arcade scoring standard; the SCORE text comes from each game's spec.
    freecell: {
      goal: "Get as many cards home as you can in two minutes.",
      how: [
        { action: "Tap a card", detail: "to move it (and the run on it) to its best spot." },
        { action: "Drag a card", detail: "to put it on a particular pile." },
        { action: "Build down", detail: "in alternating colours; home piles build up by suit from the Ace." },
        { action: "Undo and Reset", detail: "are the small buttons at the top: Undo takes back the last move (as often as you like), Reset deals the cards back out. Each counts as a move; the clock runs on." },
        { action: "Four free cells", detail: "each hold one card. Empty cells and columns let you move longer runs at once.", helpOnly: true },
        { action: "Safe cards fly home by themselves:", detail: "aces and twos, and a card whose lower cards of the other colour are home. They are not counted as moves.", helpOnly: true },
        { action: "Par", detail: "is the fewest moves our solver found for this deal.", helpOnly: true },
        { action: "One deal for everyone,", detail: "always solvable.", helpOnly: true },
      ],
      score: liveStdHelp("freecell", "Three parts, which total 200:"),
    },
    tripeaks: {
      goal: "Clear the three peaks.",
      how: [
        { action: "Tap a glowing card", detail: "one higher or lower than the discard; Ace and King wrap." },
        { action: "Tap the stock", detail: "when you are stuck: it turns a new discard and ends the run." },
        { action: "Uncover the tops", detail: "of all three peaks for the bonus." },
        { action: "Face-down cards", detail: "turn up when both cards over them are cleared.", helpOnly: true },
        { action: "Drag works too:", detail: "drop a card on the discard.", helpOnly: true },
        { action: "One deal for everyone,", detail: "always clearable.", helpOnly: true },
      ],
      score: liveStdHelp("tripeaks", "Five parts, which total 200:"),
    },
    pokersquares: {
      goal: "Build poker hands in every row and column.",
      how: [
        { action: "Tap an empty square", detail: "to place the next card. Placed cards stay." },
        { action: "Rows and columns", detail: "each score as a poker hand." },
        { action: "25 cards,", detail: "one at a time; the next card is at the bottom." },
        { action: "Hands:", detail: "pair 5, two pair 10, three of a kind 20, straight 25, flush 35, full house 50, four of a kind 60, straight flush 75. The big points are straights and better.", helpOnly: true },
        { action: "Every deal", detail: "has a grid of these same 25 cards that makes a hand in all ten lines and fills the points.", helpOnly: true },
        { action: "Empty squares at the buzzer", detail: "score whatever their lines already hold.", helpOnly: true },
        { action: "Same cards, same order,", detail: "for everyone.", helpOnly: true },
      ],
      score: liveStdHelp("pokersquares", "Two parts, which total 200:"),
    },
    fivehands: {
      goal: "Build five poker hands, one row each.",
      how: [
        { action: "Tap a row", detail: "to place your card in its next slot. Placed cards stay." },
        { action: "Rows fill evenly:", detail: "every row takes a card before any row takes the next. Rows already filled for the round are greyed out." },
        { action: "Each turn", detail: "also turns up a card taken by an opponent: it goes face up on the discard row at the bottom." },
        { action: "Hands:", detail: "pair 3, two pair 6, three of a kind 8, straight 10, flush 11, full house 13, four of a kind 15, straight flush 16.", helpOnly: true },
        { action: "20 turns", detail: "after five cards dealt one to each row: 45 of the 52 cards are seen by the end.", helpOnly: true },
        { action: "Rows at the buzzer", detail: "score as they stand.", helpOnly: true },
        { action: "Every deck", detail: "can be placed to fill the points.", helpOnly: true },
        { action: "Same deck, same order,", detail: "for everyone.", helpOnly: true },
      ],
      score: liveStdHelp("fivehands", "One part, hand points alone, which total 200:"),
    },
    rally: {
      goal: "Keep the rally going.",
      how: [
        { action: "Drag the paddle.", detail: "Miss the blue ball: over." },
        { action: "Gold balls score:", detail: `each hit, +${RALLY_V12_PAD_PTS} a pink pad.` },
        { action: "Gold target:", detail: `+${RALLY_V12_TARGET_PTS} before its ring runs out.` },
        { action: "Drag to move the paddle", detail: "along the bottom.", helpOnly: true },
        { action: "Every hit", detail: "makes the paddle smaller and the ball faster.", helpOnly: true },
        { action: "A gold ball drops in", detail: "every ten seconds – only gold balls score.", helpOnly: true },
        { action: "Two pink target pads", detail: `sit on the far wall, one in each half. A gold ball that hits one scores ${RALLY_V12_PAD_PTS}, and the pad moves to a new spot in its own half, so the two never overlap. The spots are the same for everyone in the room.`, helpOnly: true },
        { action: `${RALLY_V10_BONUS_COUNT} gold targets a round:`, detail: `each appears at its own moment and spot in the upper court (the same for everyone in the room) and stays about ${RALLY_V11_BONUS_LIFE / 60} seconds, its ring counting down. Any ball that touches it scores ${RALLY_V12_TARGET_PTS}; a miss costs nothing.`, helpOnly: true },
        { action: "Aim with the paddle:", detail: "where the ball meets it sets the angle; swipe the paddle as you hit to spin the return: the ball sets off the way you swiped, then curves back round the other way (swipe left: it goes left, then bends right). The faster the swipe, the bigger the curve. Spin scores nothing itself.", helpOnly: true },
        { action: "From 30 seconds a bumper", detail: "appears mid-court (it blinks a warning first). Balls bounce off it like a mirror, at the same speed.", helpOnly: true },
        { action: "For the last 15 seconds", detail: "a second bumper joins it (from 45 s, with the same blinking warning), always far enough away for a ball to pass between them.", helpOnly: true },
        { action: "Miss the blue ball", detail: "and the run is over: you keep what you have scored. Blue returns and lasting the minute score nothing themselves.", helpOnly: true },
      ],
      // rallyRev 12 (the arcade scoring standard, docs/arcade-standard/rally.md): gold-ball hits on a straight line, pads and gold targets fixed.
      score: liveStdHelp("rally", "Only gold balls and gold targets score; losing the blue ball ends the run."),
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
        { action: "Swipe through food.", detail: "3+ in one swipe is a combo." },
        { action: "Golden fruit and 3 breads in a row", detail: "score more." },
        { action: "Cut food near a chilli;", detail: "never cut one." },
        { action: "Never cut a chilli:", detail: `it costs ${SLICE_V11_CHILLI} points and ends your combo.`, helpOnly: true },
        { action: "Cut a bottle:", detail: "ketchup, mustard or mayo power-up.", helpOnly: true },
        { action: "Combo:", detail: `three foods in one swipe start it and each one renews its 10 seconds. Every ${SLICE_V11_COMBO_FOODS} foods cut while it is live add ${SLICE_V11_COMBO_POINTS} (up to ${SLICE_V11_COMBO_CAP}).`, helpOnly: true },
        { action: "Golden fruit:", detail: `the tiny gold apples, ${SLICE_V9_GOLDS} a run, share ${SLICE_V11_GOLD_CAP} points.`, helpOnly: true },
        { action: "Bread tickets:", detail: `${SLICE_V11_TICKET_BREADS} breads cut in a row fill a ticket (other food in between is fine; a bread you miss starts the count again). Tickets share ${SLICE_V11_TICKET_CAP} points.`, helpOnly: true },
        { action: "Dodges:", detail: `cut a food while it is within ${SLICE_V11_CLOSE} px of a chilli (and don't cut the chilli): ${SLICE_V11_DODGE_POINTS} each, up to ${SLICE_V11_DODGE_CAP}.`, helpOnly: true },
        { action: "Bottles:", detail: "ketchup stops chillies, mustard slows time, mayo pulls food together. They score nothing themselves.", helpOnly: true },
        { action: "Saucy (ketchup): 3 chilli-free seconds.", detail: "Simmer (mustard): 4 slow seconds. Squeeze (mayo): nearby food gathers where you cut it.", helpOnly: true },
        { action: "One finger-down-to-up path counts together", detail: "– curves too, up to the full height of the screen.", helpOnly: true },
      ],
      // sliceRev 11 (the arcade scoring standard, docs/arcade-standard/slice.md): the share of food cut on a
      // straight line to 120, then the four parts.
      score: `Each food cut counts, out of every food thrown (bottles and chillies don't count), in thousandths. More food sliced, higher score – up to ${SLICE_V11_CORE}. A good run (${BAND_GOOD_POINTS} points) slices ${bandUnitsFor(SLICE_V11_BAND_CURVE, BAND_GOOD_POINTS)}. Combos add up to ${SLICE_V11_COMBO_CAP}, golden fruit ${SLICE_V11_GOLD_CAP}, bread tickets ${SLICE_V11_TICKET_CAP} and dodges ${SLICE_V11_DODGE_CAP}: ${SLICE_V11_CORE + SLICE_V11_COMBO_CAP + SLICE_V11_GOLD_CAP + SLICE_V11_TICKET_CAP + SLICE_V11_DODGE_CAP} in all. Each chilli costs ${SLICE_V11_CHILLI} and ends the combo. Up to ${SLICE_V9_MAX}.`,
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
        { action: "The Joker (a black bubble with a gold crown and a rainbow rim)", detail: `joins every colour it touches and pops each group that reaches three. A mine pops the ${BUB_V11_MINE_POPS} bubbles nearest where it lands; bubbles left hanging then fall.`, helpOnly: true },
        { action: "A torpedo never sticks:", detail: `it flies where you aim it, bank shots included, and destroys up to ${BUB_TORPEDO_HITS} bubbles it runs into on the way up. Bubbles left hanging then fall.`, helpOnly: true },
        { action: "Specials come in the queue:", detail: `a Joker every ${BUB_V3_JOKER_BLOCK} shots or so, and one mine or torpedo somewhere in the first ${BUB_SPECIAL_BLOCK}.`, helpOnly: true },
        { action: "Ninety seconds", detail: "on the same field and queue for everyone.", helpOnly: true },
      ],
      // bubbleRev 11 (the arcade scoring standard): every part, its maximum and how it pays, 200 in all.
      score: liveStdHelp("bubble", "Clear the reef's bubbles; falling chests, bank shots and combos add more."),
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
        { action: "Fever:", detail: "Perfects (and Goods, half as much) fill the meter at the top; a miss empties it. When it flashes TAP FEVER!, tap it to start 8 seconds of fever. Each fever you start earns a fixed bonus.", helpOnly: true },
        { action: "Golden notes:", detail: "hit one dead on – on the very moment it meets the line – for a bonus.", helpOnly: true },
        { action: "Double taps:", detail: "two notes with white dots, close together in one lane. Tap both; both Perfect earns a bonus.", helpOnly: true },
        { action: "Perfect streak:", detail: "the longer your longest run of Perfects, the bigger the bonus (all of it for every note Perfect).", helpOnly: true },
        { action: "Closer is better", detail: "– perfect, good, or just OK.", helpOnly: true },
        { action: "A tap with no note", detail: "costs nothing.", helpOnly: true },
        { action: "Notes with a tail are holds", detail: "– press as the head reaches the line, release as the tail reaches it. Both ends must be Perfect for Perfect, or within Good for Good; otherwise Miss.", helpOnly: true },
        { action: "Swipe notes (from 30 seconds)", detail: "show a left or right arrow. Flick your finger that way in the lane as the note reaches the line. A plain tap won't hit them, and the wrong way is a miss.", helpOnly: true },
        { action: "Keep a combo going", detail: "to light up the lanes at 10, 25 and 50 – a miss resets it.", helpOnly: true },
      ],
      score: liveStdHelp("beat", "Notes hit closer to the beat score more."),
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
      // tenRev 5 (the scoring standard, the dealt stamp): standard/numberText.ts.
      score: standardNumberHelp("tendrop"),
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
        { action: "Shoot glowing carriers;", detail: "catch what they drop." },
        { action: "Bosses:", detail: "hit weak points dead centre." },
        { action: "Red bolts and divers cost a life:", detail: "you have 3.", helpOnly: true },
        { action: "The run lasts 90 seconds.", detail: "Each new wave flies in from the top 2 seconds after you clear one. Don't let a formation reach your line.", helpOnly: true },
        { action: "From wave 3, ships peel off and dive at you,", detail: "then fly back to their place. Shoot them on the way; one that rams you costs a life.", helpOnly: true },
        { action: "Each wave flies its own shape:", detail: `a grid, then a triangle, a circle, a pentagon and an octagon – ${WAV_X_SHAPES} ships each, with six escorts under the shapes. Waves 3 and 4 come down more slowly.`, helpOnly: true },
        { action: "From wave 2, a grey armoured ship", detail: "sits in the middle of the shape and takes 6-12 hits – every hit counts.", helpOnly: true },
        { action: "Power-ups:", detail: `in every wave ${WAV_R11_CARRIERS} ships carry one (they glow green or cyan), the same ships for everyone in a room; shoot one down and its power-up falls from where it was. Spread (green): ${WAV_X_SPREAD_VOLLEYS} volleys with two extra bolts angled out. Shield (cyan): absorbs the next hit (${WAV_X_SHIELD_TICKS / 60} s).`, helpOnly: true },
        { action: "A saucer flies over every 15 seconds:", detail: "shoot it down for points; it drops the purple laser (5 shots that pierce up to 3 enemies).", helpOnly: true },
        { action: "After wave 3 a gunship flies in; after wave 5, the boss.", detail: `The boss comes only once wave 5 is destroyed. Each has two cannons (${WAV_X_CANNON_HP} hits each; a destroyed one stops firing) and a core that opens for half of every ${WAV_X_CORE_PERIOD / 60} s: a hit on the open core counts ${WAV_X_CORE_DAMAGE}. The boss's bar shows its ${WAV_BOSS_HP} hit points; destroying it ends the run – the sooner after it arrives, the more it scores.`, helpOnly: true },
        { action: "Weak points score:", detail: "each cannon you destroy and each boss whose open core you hit (once is enough) – six in a run.", helpOnly: true },
      ],
      // wavRev 12 (the arcade scoring standard, docs/arcade-standard/wavefront.md): the core and fixed parts, 200 in all.
      score: `${liveBandHelp("wavefront", `Ships, hits and waves: ships shot, armour hits and the gunship's hit points count 1, and cleared waves (the gunship too) 15; everything before the boss counts ${WAV_STD_CORE_FULL}.`, {
        more: "More ships, hits and waves",
      })} ${stdFeaturesHelp(WAVEFRONT_STD, {
        speed: "only with the boss destroyed: the full 10 within 20 s of its arrival, falling to 0 at 40 s",
        saucers: `${20 / WAV_X_SAUCERS} a saucer of the ${WAV_X_SAUCERS} a run flies; destroying the boss counts those still to come`,
        weak: "each cannon destroyed and each boss's open core hit, six in all",
      })} Power-ups score nothing; each life lost costs ${WAV_STD_LIFE_COST} (anyone who plays scores at least 1).`,
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
        { action: "Double flips:", detail: "flip again within about an eighth of a second of landing with a hazard close by. Each one counts, chained or not.", helpOnly: true },
        { action: "Star trails:", detail: `${FLIP_V8_TRAILS} arcs of ${FLIP_V8_TRAIL_STARS} small stars, taken in the air. Leave the surface at the chevron and your flip sweeps through them.`, helpOnly: true },
        { action: "Sweet spots:", detail: `${FLIP_V8_SWEETS} roofs carry a short, faint pale strip. Time a flip so you touch down with your feet inside it for a sweet landing; it glints. Each counts once.`, helpOnly: true },
        { action: "Checkpoints (15, 30 and 45 s):", detail: "pass one and your next crash is saved – a second of shield, and you run on.", helpOnly: true },
      ],
      // flipRev 10 (the arcade scoring standard): time survived on a straight line, then the features' fixed shares.
      score: `${liveBandHelp("flip", "Time survived: each half second you last counts 1.25.", {
        more: "More time survived",
        good: (u) => `lasts ${u} half seconds (${u / 2} s)`,
      })} ${stdFeaturesHelp(FLIP_STD)}`,
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
        { action: "Bonus routes:", detail: `every one of levels 1-8 has an ink star and ${INK_V11_SILVER_PER_LEVEL} silver coins spread out along a harder route, well away from the easy one; one level in the run also has the shamrock. Roll the coin through them and into the pot: they count only once the coin is potted. You never need them to finish a level.`, helpOnly: true },
        { action: "Bounce clouds:", detail: `${INK_CLOUD_LEVELS} levels have a springy cloud that throws the coin back up. On them the bonus route bounces off it: pot the coin after a bounce for a trick shot.`, helpOnly: true },
        { action: "Ink is limited", detail: "Each level has a budget, with a larger shared supply for live levels.", helpOnly: true },
        { action: "Three failed drops", detail: "and you're out.", helpOnly: true },
      ],
      // inkRev 12 (the arcade scoring standard, 29 Oct 2026): levels on a straight line, fixed shares for the rest.
      score: liveBandHelp("inkbridge", `Each level potted counts ${INK_V12_CORE_MAX / INK_LEVELS}.`, { more: "More levels", good: (u) => `pots ${u} levels`, finish: stdFeaturesHelp(INK_STD, { speed: "only with all ten levels: the full 10 with at least 45 s left, falling evenly to 0 at the buzzer" }) }),
    },

    burst: {
      goal: "Split the atoms. Don't get hit.",
      how: [
        { action: "◀ ▶ to move,", detail: "tap the arena to shoot up." },
        { action: `${BURST_V10_WAVES} waves:`, detail: `clear each fast for up to +${BURST_V10_CLEAR_PER_WAVE}.` },
        { action: "Golden atom:", detail: `+${BURST_V10_GOLDEN_PTS}, but it hurts like any atom.` },
        { action: "An atom touching you (golden ones too)", detail: `costs a life and ${BURST_V10_LIFE_COST} points (3 lives).`, helpOnly: true },
        { action: "Hold ◀ or ▶ to walk; tap anywhere on the arena to fire straight up.", detail: "There is no FIRE button: every tap on the arena is a shot.", helpOnly: true },
        { action: "Big atoms split into smaller ones;", detail: "the smallest pop.", helpOnly: true },
        { action: `${BURST_V10_WAVES} waves, ${BURST_V10_ATOMS} atoms:`, detail: `counting every piece the splits make. Clear all ${BURST_V10_WAVES} waves and the run is complete.`, helpOnly: true },
        { action: "Wave-clear bonus:", detail: `each wave you clear pays up to ${BURST_V10_CLEAR_PER_WAVE}: the full ${BURST_V10_CLEAR_PER_WAVE} within its quick time (1 s plus 0.6 s for every atom it holds, splits included), then evenly less, down to 0 at twice that. The counter (CLEAR +${BURST_V10_CLEAR_PER_WAVE}) shows what the wave on screen still pays.`, helpOnly: true },
        { action: `${BURST_V10_GOLDENS} golden atoms:`, detail: `one with each wave, a second or two after it appears, at its own spot (the same for everyone in the room). It bounces like the other atoms and fades after about 5 seconds. A shot that reaches one scores ${BURST_V10_GOLDEN_PTS}. It hurts like any atom: touching it costs a life.`, helpOnly: true },
        { action: "Power-ups ride on atoms:", detail: "an atom showing a small icon drops that power-up when you split it (the same atoms for everyone). Walk under it to catch it. DOUBLE fires two beams a shot for 8 s; BURST fires three quick short shots a tap for 8 s; FREEZE stops every atom for 3 s. Frozen atoms still hurt if you walk into one. They score nothing themselves.", helpOnly: true },
      ],
      // burstRev 10 (the arcade scoring standard, docs/arcade-standard/burst.md): the atoms on a straight line, wave clears, golden atoms, lives.
      score: liveBandHelp("burst", `Every atom you pop counts, each split piece too: ${BURST_V10_ATOMS} in the ${BURST_V10_WAVES} waves.`, { more: "More atoms", good: (u) => `pops ${u} atoms`, finish: `Wave clears add up to ${BURST_V10_CLEAR_MAX} (${BURST_V10_CLEAR_PER_WAVE} a wave) and golden atoms up to ${BURST_V10_GOLDEN_MAX} (${BURST_V10_GOLDEN_PTS} each): ${BURST_V10_CORE_MAX} + ${BURST_V10_CLEAR_MAX} + ${BURST_V10_GOLDEN_MAX} = 200. Each life lost costs ${BURST_V10_LIFE_COST}; power-ups score nothing.` }),
    },
    orbit: {
      goal: "Fly planet to planet to the sun.",
      how: [
        { action: "Tap to let go;", detail: "the next orbit catches you." },
        { action: "Grab stardust;", detail: "sling through moon halos." },
        { action: "Thread rock gaps;", detail: "let go on the first lap." },
        { action: "Checkpoint:", detail: "a crash returns you there.", helpOnly: true },
        { action: "Black hole:", detail: "fly in, skip 5-6 planets.", helpOnly: true },
        { action: "You orbit automatically.", detail: "Tap to let go – you fly straight until the next orbit catches you. Miss both of the next two orbits and the run ends (or you go back to your checkpoint) as soon as nothing ahead can catch you.", helpOnly: true },
        { action: "Set Checkpoint once while orbiting.", detail: "Your next crash returns you there. Without it, or after using it, a crash ends the run. Orbits are belt-safe. On later planets, time arrival and departure through the opening in the outside asteroid ring – it turns once every 12 seconds.", helpOnly: true },
        { action: "Orbits change shape.", detail: "Ovals speed up near the planet. On a figure-eight, let go only on the outer loops – never at the crossing.", helpOnly: true },
        { action: "Black holes:", detail: "about every ten planets a small black hole sits beside one planet. Let go at just the right moment to fly into it and you come out beside a planet 5 or 6 further on and fly into its orbit over about a second; the planets you skip count as reached. A checkpoint you set before the jump still works.", helpOnly: true },
        { action: "Any black hole ahead counts:", detail: "touch one with any part of the rocket on any flight, even from the planet before, and it swallows you; one you have already passed fades out.", helpOnly: true },
        { action: "Stardust:", detail: `${ORBIT_XP_TRAILS} trails of gold motes lie on the best line between some planets. Fly through them to collect them.`, helpOnly: true },
        { action: "Slingshot moons:", detail: `fly through one of the ${ORBIT_XP_MOONS} small moons' soft halos without touching the moon and it flings you on at one and a half times the speed. Touching the moon is a crash.`, helpOnly: true },
        { action: "Asteroid fields:", detail: `${ORBIT_XP_FIELDS} lines of rocks across some hops. Thread the gap in the middle of the line for a bonus; hitting a rock is a crash.`, helpOnly: true },
        { action: "Perfect orbits:", detail: "let go while the gold arc still shows – during your first lap round the planet – and land in the next orbit.", helpOnly: true },
      ],
      // orbitRev 13 (the arcade scoring standard): planets on a straight line to 130, then speed and the features, 200 in all.
      score: liveBandHelp("orbit", "Each planet reached counts 1, and a crash still counts the part of the way to the next planet you flew.", { more: "More planets", good: (u) => `reaches ${u} planets`, finish: `Planets pay on a straight line, all ${stdCore(ORBIT_STD).max} at the sun. ${stdFeaturesHelp(ORBIT_STD, { speed: "only for reaching the sun: all 20 with half the time left, falling evenly to 0 at the buzzer", perfect: `an equal share for each perfect orbit, all ${stdFeatures(ORBIT_STD).find((f) => f.key === "perfect")!.max} at ${ORBIT_STD_PERFECT_OF}` })}` }),
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
      goal: "Swing hook to hook to the end.",
      how: [
        { action: "Hold to grab the nearest hook,", detail: "let go to fly." },
        { action: "Ledge runs:", detail: "kick off, land the next." },
        { action: "Squeezes:", detail: "fly the gap, catch the far hook." },
        { action: "Most of the course is swinging, with fewer hooks than before:", detail: "each grab is a choice. Hold grabs the nearest hook in reach; swing back and forth for more height, swipe up to shorten the rope.", helpOnly: true },
        { action: `${SWING_V15_RUNS.length} short ledge runs`, detail: "are a start ledge, one or two hooks and a landing ledge at a time, two of them with a squeeze (roof and floor close to a gap).", helpOnly: true },
        { action: "Miss (the lava, or a squeeze's rock)", detail: "and you are back hanging from the last hook you held (on a ledge run, back on its start ledge). The clock keeps running; what you picked up since then is put back.", helpOnly: true },
        { action: "Par times:", detail: "each stretch has one, shown under the stretch count. Finish it under par for points: the further under, the more.", helpOnly: true },
        { action: "Speed gates", detail: `(${SWING_V15_GATES}) sit on the natural line between hooks: a well-timed release flies through and lights them.`, helpOnly: true },
        { action: "Gems", detail: `(${SWING_V15_GEMS}) sit on harder lines: an earlier or later release that still reaches the next hook.`, helpOnly: true },
        { action: "Touch stars on a tighter swing:", detail: `the ${SWING_V15_STARS} stars, spread evenly along the course, sit where a shortened rope runs. Swipe up as you swing to shorten it.`, helpOnly: true },
        { action: "Over the last quarter a dragon chases you.", detail: "If it catches you, it is a miss. A marker at the left edge shows how far back it is.", helpOnly: true },
        { action: "Everyone", detail: "gets the same course, hooks, gates, gems, stars and par times.", helpOnly: true },
      ],
      score: liveBandHelp("swing", "The course counts 1,000 in all, shared by its stretches by length: every one cleared, and most of the one you are on.", { more: "Further along", good: (u) => `counts ${u} – about ${Math.round(u / 10)} % of the course`, finish: `Up to ${SWING_V15_PAR_POINTS} more for stretches under par (the further under, the more) and ${SWING_V15_PICKUP_POINTS} for each gate, gem and star kept (${SWING_V15_PICKUP_POINTS * (SWING_V15_GATES + SWING_V15_GEMS + SWING_V15_STARS)} in all). Clearing the course adds nothing more. The parts: course ${SWING_V15_CORE} + par ${SWING_V15_PAR_POINTS} + gates, gems and stars ${SWING_V15_PICKUP_POINTS * (SWING_V15_GATES + SWING_V15_GEMS + SWING_V15_STARS)} = ${SWING_V15_MAX}.` }),
    },
    tilt: {
      goal: "Roll each marble into its own cup.",
      how: [
        { action: "Drag left or right", detail: "to spin the maze." },
        { action: "Keys open gates;", detail: `maze ${TILT_S_MAZES}: small and tight.` },
        { action: `From maze ${TILT_X_TWO_FROM}, two marbles,`, detail: "each to its own cup." },
        { action: "Marbles always roll down.", detail: `${TILT_S_MAZES} mazes, always all on screen: three big ones, then a smaller, tighter one with the blue marble alone and no holes or stars. A marble that falls into a black hole goes back to its start (it costs time, not points).`, helpOnly: true },
        { action: "Keys and gates:", detail: "a gate across the way to the cup stays shut until either marble rolls over its key, which waits in a side passage before the gate. A gate and its key share a colour.", helpOnly: true },
        { action: "Ice:", detail: "on the faintly frosted cells the marble keeps its speed and slides further, so ease off before a turn or a hole.", helpOnly: true },
        { action: "Cups:", detail: "the blue marble goes in the blue cup, the amber marble in the amber cup, which always starts well away from it. Each marble can only leave through the gap by its own cup, and the maze is done when both are in. The marbles roll through each other.", helpOnly: true },
        { action: "Gold stars:", detail: `${TILT_X_STARS === 1 ? "one" : TILT_X_STARS} in each of mazes 1–${TILT_S_MAZES - 1}, a step or two off the route. Roll either marble over ${TILT_X_STARS === 1 ? "it" : "one"} to collect it.`, helpOnly: true },
      ],
      score: liveBandHelp("tilt", `Each finished maze counts ${TILT_S_MAZE_POINTS + TILT_S_PROGRESS_POINTS}, and getting closer to the exit in the maze you are on up to ${TILT_S_PROGRESS_POINTS} more (an even share of the way), so the core is up to ${TILT_S_CORE_MAX}.`, { more: "Further through the mazes", good: (u) => `has about ${Math.round(u / (TILT_S_MAZE_POINTS + TILT_S_PROGRESS_POINTS))} mazes done, or fewer with stars`, finish: `All ${TILT_S_MAZES} mazes adds ${TILT_S_FINISH_POINTS}, and up to ${TILT_S_SPEED_POINTS} for speed: all of it if all ${TILT_S_MAZES} are done by ${TILT_S_SPEED_FULL / 60} s, then evenly less to none at the buzzer. Gold stars add up to ${TILT_S_STAR_POINTS}, shared evenly by the stars of mazes 1–${TILT_S_MAZES - 1} (${TILT_S_STAR_POINTS / (TILT_X_STARS * (TILT_S_MAZES - 1))} each). ${TILT_S_CORE_MAX} + ${TILT_S_FINISH_POINTS} + ${TILT_S_SPEED_POINTS} + ${TILT_S_STAR_POINTS} = 200; any play scores at least 1.` }),
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
      score: logicStandardHelp("shikaku"),
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
      score: standardNumberHelp("trail"),
    },
    measure: {
      goal: "Measure out exactly the target amount.",
      how: [
        { action: "Tap a jug, then another", detail: "to pour." },
        { action: "Fill and Empty", detail: "use the tap and drain." },
        { action: "Every action", detail: "is a move." },
        { action: "Par pours:", detail: "solve the puzzles in their fewest moves for a bonus." },
        { action: "A pour", detail: "stops when the first jug is empty or the second is full.", helpOnly: true },
        { action: "Puzzle 4", detail: "has no tap or drain: make the split shown on the jugs.", helpOnly: true },
        { action: "Reset", detail: "starts the puzzle again; moves keep counting.", helpOnly: true },
        { action: "Moves are limited", detail: "to about 4½× the fewest (the counter). Out of moves, the run ends there.", helpOnly: true },
      ],
      score: standardNumberHelp("measure"),
    },
    checkout: {
      goal: "Score exactly the target with your darts.",
      how: [
        { action: "Tap a number,", detail: "then x1, x2 or x3." },
        { action: "Hit zero exactly", detail: "and finish in the ring shown." },
        { action: "Tap Throw", detail: "to check." },
        { action: "Big finish:", detail: "end a board of 100+ on the Bull or a treble for a bonus." },
        { action: "Outer bull = 25,", detail: "inner bull = 50 (a double).", helpOnly: true },
        { action: "The ring shown", detail: "is a double or a treble.", helpOnly: true },
        { action: "Every board is different.", detail: "Solve the five in any order; a wrong throw only costs time. Undo takes a dart back.", helpOnly: true },
      ],
      score: standardNumberHelp("checkout"),
    },
    numline: {
      goal: "Place each number on the line.",
      how: [
        { action: "Drag the marker,", detail: "then tap Place." },
        { action: "Only the ends", detail: "are labelled." },
        { action: "Estimate:", detail: "no calculator needed." },
        { action: "Bullseyes:", detail: "land within 1% of exact for a bonus." },
        { action: "A magnifier", detail: "shows where your finger is.", helpOnly: true },
        { action: "Placed numbers are locked.", detail: "Five numbers on each of three lines.", helpOnly: true },
        { action: "Numbers include", detail: "fractions, percentages, powers and roots.", helpOnly: true },
      ],
      score: standardNumberHelp("numline"),
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
      score: standardNumberHelp("numpyramid"),
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
        { action: "Mid-round the bottom row moves and the cups swap colours;", detail: "the count under the board (\"20 to switch up\") gives the seconds to the next switch-up.", helpOnly: true },
      ],
      // btRev 8 (the arcade scoring standard, docs/arcade-standard/balltrack.md): marbles home on one even line, then the
      // features' fixed shares; no speed part.
      score: liveBandHelp("balltrack", "Each marble home counts 1.", {
        more: "More marbles home",
        good: (u) => `gets ${u} marbles home`,
        finish: `Marbles home pay the same for every marble (all ${BT_V7_BALLS}: ${stdCore(BT_STD).max}). ${stdFeaturesHelp(BT_STD, {
          gold: `an equal share for each of the ${stdFeatures(BT_STD)[0]!.of} gold marbles home`,
          combo: "1 a marble home from the third in a row",
          boost: `an equal share for each of the ${BT_V7_BALLS} marbles home after a speed booster`,
        })}`,
      }),
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
      score: preStandardPinned() ? wordSearchBonusHelp() : WORD_STANDARD_HELP.wordsearch,
    },
    letterwheel: {
      goal: "Fill the crossword from the letter wheel.",
      how: [
        { action: "Drag across the letters", detail: "and let go." },
        { action: "Crossword words", detail: "fill gold. 3+ letters." },
        { action: "Other real words", detail: "fill the bonus jar." },
        { action: "Lift off the wheel or ×", detail: "to drop a trace.", helpOnly: true },
        { action: "Or tap letters", detail: "then Submit.", helpOnly: true },
        { action: "The bonus jar", detail: preStandardPinned() ? "fills by word length; a full jar adds the top 50 points. Misses after the first 5 spill a drop each." : `fills by word length; the fuller it is, the more it adds (up to ${STD_ROUNDABOUT.jar}). Misses after the first 5 spill a drop each.`, helpOnly: true },
        { action: "A trace that is not a word", detail: "is a miss: the first 5 are free, then each costs 3.", helpOnly: true },
        { action: "Shuffle", detail: "rearranges the wheel without changing the crossword.", helpOnly: true },
      ],
      score: preStandardPinned() ? letterWheelJarHelp() : WORD_STANDARD_HELP.letterwheel,
    },
    strikeout: {
      goal: "Reveal five long words, one at a time, before twelve strikes.",
      how: [
        { action: "Tap a letter", detail: "to fill every matching tile in the word." },
        { action: "Three vowel guesses", detail: "per word (the dots)." },
        { action: "Vowels are A E I O U;", detail: "the keypad resets for each word.", helpOnly: true },
        { action: "Tap Solve", detail: "to guess the word; early earns more, wrong is a strike." },
        { action: "Early solves:", detail: preStandardPinned() ? "the more letters still hidden when you Solve a word, the bigger its bonus." : `Solve a word with ${STD_STRIKEOUT.earlyHidden}+ letters still hidden for ${STD_STRIKEOUT.earlySolve} more points (up to ${STD_STRIKEOUT.earlySolveMax}).`, helpOnly: true },
        { action: "Starting letters", detail: "show from the start (every copy; one more on words 1–3) and earn nothing.", helpOnly: true },
        { action: "Solve:", detail: "type the missing letters, then Solve. It must be a real word (others are refused for free).", helpOnly: true },
        { action: "A word is solved", detail: "once all its letters show; the next word starts.", helpOnly: true },
        { action: "Twelve strikes", detail: "in total (misses and wrong solves, over all five words) end the round.", helpOnly: true },
      ],
      score: preStandardPinned() ? strikeoutDepthHelp() : WORD_STANDARD_HELP.strikeout,
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
      score: preStandardPinned() ? stretchHelp("codeword", CODEWORD_STRETCH) : WORD_STANDARD_HELP.codeword,
    },
    swapword: {
      goal: "Swap tiles until all six words read correctly.",
      how: [
        { action: "Drag a tile onto another", detail: "to swap." },
        { action: "Gold", detail: "is in place; teal belongs elsewhere." },
        { action: "Finish in par swaps", detail: "for a bonus. Swaps are limited." },
        { action: "Par", detail: "is the fewest swaps that solve the board, shown beside your swaps (gold while you are within it).", helpOnly: true },
        { action: "The budget", detail: `is ${SW6_SPARE_SWAPS} more than par; running out ends the round.`, helpOnly: true },
        { action: "Or tap one tile", detail: "then the other.", helpOnly: true },
        { action: "Teal tiles", detail: "belong elsewhere in a word through them; grey tiles fit neither word. A letter shows teal only as often as it is still needed.", helpOnly: true },
      ],
      score: preStandardPinned() ? parBonusHelp("swapword", SWAP_PAR_BONUS_TOPUP, "swaps", "par swaps (the fewest that solve the board)") : WORD_STANDARD_HELP.swapword,
    },
    lightup: {
      goal: "Place bulbs so every white square is lit.",
      how: [
        { action: "A bulb lights", detail: "its row and column to a wall." },
        { action: "Bulbs", detail: "must never light each other." },
        { action: "A wall's number", detail: "is how many bulbs touch it." },
        { action: "A number on a wall", detail: "says exactly how many bulbs touch that wall's four sides.", helpOnly: true },
      ],
      score: logicStandardHelp("lightup"),
    },
    tents: {
      goal: "Pitch one tent beside every tree.",
      how: [
        { action: "Tap a cell", detail: "for a tent; again for grass." },
        { action: "Tents never touch,", detail: "even diagonally." },
        { action: "Signposts", detail: "give each row's and column's tents." },
        { action: "Tap a third time", detail: "to clear the cell.", helpOnly: true },
      ],
      score: logicStandardHelp("tents"),
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
