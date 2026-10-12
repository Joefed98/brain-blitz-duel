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
import { BUB_SPECIAL_BLOCK, BUB_V3_JOKER_BLOCK } from "@/lib/arcade/bubble";
import { MATCHUP_V3_PAR_RAW } from "@/lib/arcade/matchup";
import { HOVER_REACHABLE_GATES, HOVER_STARS, HOVER_V2_GATES_SCORE, HOVER_V2_STARS_SCORE } from "@/lib/arcade/hover";
import { BT_BAND_CURVE } from "@/lib/arcade/ballTrack";
import { WAV_BAND_CURVE } from "@/lib/arcade/wavefront";
import { FLIP_BAND_CURVE } from "@/lib/arcade/flip";
import { INK_BAND_CURVE } from "@/lib/arcade/inkBridge";
import { MATCHUP_BAND_CURVE } from "@/lib/arcade/matchup";
import { BUB_BAND_CURVE } from "@/lib/arcade/bubble";
import { CROSS_BAND_CURVE } from "@/lib/arcade/cross";
import { RALLY_BAND_CURVE } from "@/lib/arcade/rally";
import { SNAKE_BAND_CURVE } from "@/lib/arcade/snake";
import { BINTOSS_BAND_CURVE } from "@/lib/arcade/binToss";
import { SNIP_BAND_CURVE } from "@/lib/arcade/snip";
import { HOVER_BAND_CURVE } from "@/lib/arcade/hover";
import { SKYLINE_BAND_CURVE } from "@/lib/arcade/skyline";
import { JUNC_BAND_CURVE } from "@/lib/arcade/junction";
import { BRK_BAND_CURVE } from "@/lib/arcade/breaker";
import { TILT_BAND_CURVE } from "@/lib/arcade/tilt";
import { ORBIT_BAND_CURVE } from "@/lib/arcade/orbitRev3";
import { BEAT_BAND_CURVE } from "@/lib/arcade/beat";
import { SLICE_BAND_CURVE } from "@/lib/arcade/slice";
import { BURST_BAND_CURVE } from "@/lib/arcade/burst";
import { SWING_BAND_CURVE } from "@/lib/arcade/swing";
import { BULLSEYE_BAND_CURVE } from "@/lib/arcade/bullseye";
import { bandHelp } from "@/lib/arcade/scoreBands";
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

export const PUZZLE_INSTRUCTIONS: Record<PuzzleType, PuzzleInstructions> = {
  wordsmith: {
    goal: "Make words from the 8-11 letters - the centre letter must be in every word.",
    how: [
      { action: "Words must be at least 4 letters. Use each letter once.", detail: "There's always a word using every tile." },
      { action: "No plurals", detail: "or -s verb forms (FINDS, BOXES); words like GLASS are fine." },
      { action: "Tap the round letter tiles in order", detail: "Include the glowing centre letter. Tap a selected letter again to remove it. Clear empties the word; Enter checks it." },
      { action: "Shuffle", detail: "rearranges the outer letters for free; the centre stays fixed." },
      { action: "Words are checked", detail: "against a standard British English dictionary." },
    ],
    score: "Longer words score more: 8 letters = 11 word points; 9-11 letters = 15. Round score = floor(2.5 × word points), up to 150.",
  },
  groups: {
    goal: "Sort all sixteen words into four groups of four.",
    how: [
      { action: "Tap four words", detail: "that share a hidden link." },
      { action: "Submit the group", detail: "to lock it in." },
      { action: "Choose carefully", detail: "because some words are red herrings." },
    ],
    score: "More groups = more points. All four = speed bonus (the full bonus if you finish with at least half the time left).",
  },
  tilegrid: {
    goal: "Build a mini crossword from your tiles.",
    how: [
      { action: "Tap a tile, then a cell.", detail: "Words must be at least 3 letters. Every run must be a real word, and all tiles must connect." },
      { action: "Double-tap a placed tile", detail: "to take it back. Clear empties the grid." },
      { action: "Tap Done", detail: "to check - red runs need fixing." },
      { action: "Words are checked", detail: "against a standard British English dictionary." },
    ],
    score: "All fifteen tiles in a valid grid = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 8 per tile inside a real word.",
  },
  sumhunt: {
    goal: "Clear paths of digits that add up to the target - it rises every time.",
    how: [
      { action: "Swipe or tap touching cells", detail: "Move up, down, left or right; matching the target submits automatically." },
      { action: "A new board slides in", detail: "after each of the first eight clears; finish by chaining the whole grid." },
    ],
    score: "10 per stage; clear the whole grid to finish for the time bonus (the full bonus if you finish with at least half the time left).",
  },
  balance: {
    goal: "Balance the scale.",
    how: [
      { action: "Tap a kettlebell, then a numbered beam notch.", detail: "Further from the middle counts more - a 2 on peg 3 equals a 3 on peg 2." },
      { action: "Double-tap a placed kettlebell", detail: "to return it to the tray." },
    ],
    score: "20, 40 and 60 for scales 1, 2 and 3. All three = 120 + up to 30 for speed: the full 30 if you finish with at least half the time left.",
  },
  wordslide: {
    goal: "Slide rows and columns until every row is a word.",
    how: [
      { action: "Swipe a row sideways or a column up and down", detail: "- letters wrap around the edge. Words must be 5 letters." },
      { action: "Tap Undo or Reset", detail: "to take shifts back; they still count as moves." },
      { action: "Lock a finished word with the padlock", detail: "so it stays put - column swipes go around it." },
      { action: "Words are checked", detail: "against a standard British English dictionary." },
    ],
    score: "All five rows words = 100 + up to 30 for speed: the full 30 if you finish with at least half the time left + up to 20 for moves (full at par, 0 at twice par). Otherwise 22 per word row.",
  },
  ladder: {
    goal: "Reach the final word by changing one letter at a time.",
    how: [
      { action: "Type a word", detail: "for each rung." },
      { action: "Change one letter", detail: "from the word above." },
      { action: "Press Enter", detail: "to add each valid word." },
      { action: "Words are checked", detail: "against a standard British English dictionary." },
    ],
    score: "Finish the ladder faster = more points. Getting close still scores.",
  },
  target: {
    goal: "Use the six numbers to reach the target.",
    how: [
      { action: "Tap two numbers", detail: "then choose an operation." },
      { action: "Use each number", detail: "at most once." },
      { action: "Keep every step", detail: "to a whole number." },
    ],
    score: "Exact = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Off by 1 = 120, falling faster the further off; 120+ away scores 0.",
  },
  numseq: {
    goal: "Work out the next number in each sequence.",
    how: [
      { action: "Five sequences", detail: "one after the other, getting harder." },
      { action: "Tap the answer", detail: "you can't go back." },
      { action: "Finish all five", detail: "inside forty-five seconds." },
    ],
    score: "Twenty a sequence. All five right for the speed bonus (the full bonus if you finish with at least half the time left).",
  },
  equation: {
    goal: "Make four increasingly difficult equations equal their targets.",
    how: [
      { action: "Tap each gap", detail: "to choose an operator, worked left to right." },
      { action: "A true equation", detail: "holds for 1 second, then moves on; the timer keeps running." },
      { action: "Press Next", detail: "to skip ahead - 90 seconds for all four; the last uses division in a harder operator mix." },
    ],
    score: "Solved stages: 25 / 30 / 35 / 40. All four: 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise sum solved stage points. Maximum 150.",
  },
  chaincalc: {
    goal: "Calculate the final number in the chain.",
    how: [
      { action: "Start at the top", detail: "with the first number." },
      { action: "Work downward", detail: "one operation at a time." },
      { action: "Type the result", detail: "and press Submit." },
    ],
    score: "Correct and faster = more points.",
  },
  sequence: {
    goal: "Repeat the full tile sequence in the same order.",
    how: [
      { action: "Watch the tiles", detail: "light up one by one." },
      { action: "Tap them back", detail: "in the same order." },
      { action: "Tap again", detail: "to undo your latest matching tap." },
    ],
    score: "Complete the sequence faster = more points.",
  },
  reverse: {
    goal: "Repeat the full tile sequence backwards.",
    how: [
      { action: "Watch the tiles", detail: "light up one by one." },
      { action: "Tap them back", detail: "last one first." },
      { action: "Tap again", detail: "to undo your latest matching tap." },
    ],
    score: "Complete the sequence faster = more points.",
  },
  spatial: {
    goal: "Find all eight tiles that lit up.",
    how: [
      { action: "Watch four pairs", detail: "appear on the grid." },
      { action: "Tap all eight tiles", detail: "after they vanish." },
      { action: "Choose any order", detail: "and tap again to undo." },
    ],
    score: "Find every tile faster = more points.",
  },
  reaction: {
    goal: "Tap the instant the screen turns gold - five to eight times.",
    how: [
      { action: "Wait.", detail: "" },
      { action: "Don't tap the other colours,", detail: "or you'll get a false start." },
    ],
    score: "150 at 200 ms average or faster, −16 per 100 ms slower; misses count 1,200 ms; −8 per false start.",
  },
  gonogo: {
    goal: "Tap every gold circle and ignore every other shape.",
    how: [
      { action: "Watch each shape", detail: "as it appears." },
      { action: "Tap gold circles", detail: "as quickly as you can." },
      { action: "Ignore everything else", detail: "without tapping." },
    ],
    score: "More correct choices = more points. Perfect = speed bonus (the full bonus if you finish with at least half the time left).",
  },
  numhunt: {
    goal: "Tap all 24 numbers from smallest to largest.",
    how: [
      { action: "Find the smallest", detail: "remaining number." },
      { action: "Tap in order", detail: "until every number is cleared." },
      { action: "Keep looking", detail: "- untapped numbers move every 15 seconds." },
    ],
    score: "5 per number in order; all 24 = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left; −5 per wrong tap. Maximum 150.",
  },
  stroop: {
    goal: `Steer all ${CLASH_QUEUE} falling words into the matching coloured gates.`,
    how: [
      { action: "Use ◀ ▶, the joystick, or tap a lane", detail: "to steer the word." },
      { action: "Swipe down or press ▼", detail: "to drop it quickly." },
      { action: "Watch the banner", detail: "- the rule swaps every 15 seconds." },
      { action: "Sort the last word", detail: `to finish - the run ends when all ${CLASH_QUEUE} are sorted, or at 75 seconds.` },
    ],
    score: `round(130 × correct ÷ ${CLASH_QUEUE}) − 2 per wrong gate; sort all ${CLASH_QUEUE} for + up to 20 for speed: the full 20 if you finish with at least half the time left. Minimum 0, maximum 150.`,
  },
  symscan: {
    goal: "Find every matching eagle in three growing grids.",
    how: [
      { action: "Tap every match", detail: "of each grid's target eagle direction." },
      { action: "Press Submit", detail: "to lock each grid and move on - 30 seconds for all three." },
    ],
    score: "Stages worth 30 / 45 / 55: share of eagles found, −3 per wrong tap. All three perfect adds up to 20 for speed: the full 20 if you finish with at least half the time left.",
  },
  spotdiff: {
    goal: "Find all six differences between the two sweet-shop pictures.",
    how: [
      { action: "Compare both panels", detail: "carefully." },
      { action: "Tap each difference", detail: "in either panel." },
    ],
    score: "Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 20 per difference found.",
  },
  patcomp: {
    goal: "Complete all three visual patterns.",
    how: [
      { action: "Study each pattern", detail: "to find its two changing features." },
      { action: "Build the missing piece", detail: "with the pickers." },
      { action: "Submit or skip", detail: "to move to the next pattern." },
    ],
    score: "Each correct pattern scores. All three = speed bonus (the full bonus if you finish with at least half the time left).",
  },
  spin: {
    goal: "Identify how each shape was turned or flipped.",
    how: [
      { action: "Compare the shapes", detail: "before and after." },
      { action: "Tap the rotation", detail: "shown by the arrows." },
      { action: "Choose FLIPPED", detail: "when the shape is mirrored." },
    ],
    score: "More correct = more points. Perfect = speed bonus (the full bonus if you finish with at least half the time left).",
  },
  wordmatch: {
    goal: "Decide whether each word pair matches the rule.",
    how: [
      { action: "Read the rule", detail: "SYNONYM or ANTONYM." },
      { action: "Compare the pair", detail: "for same or opposite meaning." },
      { action: "Tap your answer", detail: "for every pair." },
    ],
    score: "All eight = 100 plus speed. Otherwise 13 per correct pair, up to 90.",
  },
  pctsprint: {
    goal: "Solve all five percentage questions.",
    how: [
      { action: "Work out the percentage", detail: "shown in the question." },
      { action: "Tap the answer", detail: "from the choices." },
      { action: "Solve all five", detail: "in the 45 seconds." },
    ],
    score: "More correct = more points. All five = speed bonus (the full bonus if you finish with at least half the time left).",
  },
  numclimb: {
    goal: "Recall all twelve digits in the exact order.",
    how: [
      { action: "Memorise the digits", detail: "while they are visible." },
      { action: "Type them back", detail: "from the beginning." },
      { action: "Press Submit", detail: "when you are done." },
    ],
    score: "Each correct digit in a row increases your span.",
  },
  stopwatch: {
    goal: "Stop the marker in the gold zone - ten times, each one trickier.",
    how: [
      { action: "Tap to stop it.", detail: "" },
      { action: "Some targets move", detail: "- stop when the marker and the target line up." },
      { action: "The counter drops at the right edge", detail: "from 2 on Watch 1 to 11 on Watch 10." },
      { action: "Watches 8-10 wrap", detail: "from the right edge back to the left." },
    ],
    score: "150 at 20 ms average error or closer, −27 per 100 ms more; misses count 500 ms.",
  },
  countup: {
    goal: "Count the matching shapes in three crowded display trays.",
    how: [
      { action: "Read the question", detail: "- each tray asks for a new shape and colour (red, blue, green, purple, pink, orange or white)." },
      { action: "Type the total", detail: "on the keypad; ENTER moves to the next field." },
      { action: "Three scenes", detail: "share 45 seconds." },
    ],
    score: "Stages worth 30 / 45 / 55: exact = full, off by 1 = 60%, off by 2 = 30%. All three exact adds up to 20 for speed: the full 20 if you finish with at least half the time left.",
  },
  mirmatch: {
    goal: "Choose the exact mirror image of each shape.",
    how: [
      { action: "Flip the shape", detail: "across the dashed line in your head." },
      { action: "Match every colour", detail: "as well as the outline." },
      { action: "Tap the result", detail: "for all five shapes." },
    ],
    score: "More correct = more points. All five = speed bonus (the full bonus if you finish with at least half the time left).",
  },
  wordhunt: {
    goal: "Find as many valid words as you can.",
    how: [
      { action: "Drag or tap through letters", detail: "that touch, including diagonally." },
      { action: "Words must be at least 4 letters.", detail: "Don't reuse a tile. Plurals count." },
      { action: "Release, tap the last letter again, or tap Submit", detail: "to submit each word." },
      { action: "Words are checked", detail: "against a standard British English dictionary." },
    ],
    score: "Round score = 2 × word points, up to 150. The counter shows word points.",
  },
  unblock: {
    goal: "Slide the gold block through the exit.",
    how: [
      { action: "Drag each block", detail: "only along its own direction." },
      { action: "Clear a path", detail: "for the gold block." },
      { action: "Slide the gold block", detail: "out through the opening." },
    ],
    score: "Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed: the full 25 if you finish with at least half the time left. Unfinished: up to 70 for clearing the gold block's lane.",
  },
  blockparty: {
    goal: "Fill every free board square with all nine pieces.",
    how: [
      { action: "Tap a piece", detail: "to rotate it." },
      { action: "Drag its anchor", detail: "onto a free board square." },
      { action: "Fit every piece", detail: "around the fixed pegs." },
    ],
    score: "Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 12 per piece placed.",
  },
  lightsout: {
    goal: "Turn every light off.",
    how: [
      { action: "Tap a light", detail: "to flip it and its four neighbours." },
      { action: "Plan each press", detail: "because nearby lights also change." },
    ],
    score: "Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed: the full 25 if you finish with at least half the time left. Unfinished: 1-4 lights left = 85 / 75 / 60 / 50.",
  },
  pipes: {
    goal: "Connect every pipe to the source with no leaks.",
    how: [
      { action: "Tap a tile", detail: "to rotate its pipe." },
      { action: "Join every opening", detail: "to another pipe or the source." },
      { action: "Leave no leaks", detail: "at the grid edges." },
    ],
    score: "Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 48 = 90, 47-45 = 85, then 5 less per two tiles down to 40 at 27; fewer score 1.5 each.",
  },
  sudoku: {
    goal: "Fill the grid with every row, column, and box valid.",
    how: [
      { action: "Tap an empty cell", detail: "then choose a number." },
      { action: "Use 1 to 6 once", detail: "in each row, column, and box." },
      { action: "Use pencil marks", detail: "for optional notes." },
    ],
    score: "Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 110 × correct cells ÷ empty cells.",
  },
  flow: {
    goal: "Connect every colour pair and fill every square.",
    how: [
      { action: "Drag from a dot", detail: "to its matching partner." },
      { action: "Avoid dark walls", detail: "- no path can enter them." },
      { action: "Fill every square", detail: "with a coloured path." },
      { action: "Keep paths separate", detail: "because they cannot cross." },
    ],
    score: "Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 10 per pair joined.",
  },
  iceslide: {
    goal: "Slide the ball safely to the exit.",
    how: [
      { action: "Swipe a direction", detail: "to slide until something stops you." },
      { action: "Follow one-way arrows", detail: "that turn the ball; avoid holes or restart." },
      { action: "Portals carry you across the board.", detail: "Cracked ice breaks after you cross it once." },
    ],
    score: "Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed: the full 25 if you finish with at least half the time left. Unfinished: up to 90 for the distance closed.",
  },
  push: {
    goal: "Push every crate onto a hatched floor marking.",
    how: [
      { action: "Move the worker", detail: "one square at a time." },
      { action: "Push one crate", detail: "by walking into it." },
      { action: "Plan ahead", detail: "because crates cannot be pulled." },
    ],
    score: "Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed: the full 25 if you finish with at least half the time left. Unfinished: 110 × crates home ÷ crates.",
  },
  laser: {
    goal: "Place mirrors and a splitter to light all six gems with one shot.",
    how: [
      { action: "Place your pieces", detail: "- drag mirrors and the splitter onto empty squares." },
      { action: "Tap a piece", detail: "to turn it. The splitter forks the beam across its input axis." },
      { action: "Tap FIRE", detail: "to shoot - you get three shots and must avoid bombs." },
      { action: "Follow gem arrows", detail: "- marked gems only light from that direction." },
    ],
    score: "Every gem on fire 1 / 2 / 3 = 130 / 115 / 100, + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 15 per gem lit; never fired = 0.",
  },
  tower: {
    goal: "Move the full tower onto the gold-based post.",
    how: [
      { action: "Tap a post", detail: "to lift its top ring." },
      { action: "Tap another post", detail: "to place that ring." },
      { action: "Keep smaller rings above", detail: "larger rings at all times - colour shows size." },
      { action: "Count the posts", detail: "- each puzzle has 3 or 4." },
    ],
    score: "Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed: the full 25 if you finish with at least half the time left. Unfinished: 110 × rings home from the bottom ÷ rings.",
  },
  maze: {
    goal: "Draw a path from the start to the exit.",
    how: [
      { action: "Drag through passages", detail: "one neighbouring cell at a time." },
      { action: "Follow the corridors", detail: "without crossing walls." },
      { action: "Reach the exit", detail: "to finish." },
    ],
    score: "Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 110 × share of the route reached.",
  },
  tubes: {
    goal: "Sort the potions so every flask is one colour.",
    how: [
      { action: "Tap a flask", detail: "to lift its top layers." },
      {
        action: "Tap where to pour",
        detail: "- onto the same colour or an empty flask; as many layers move as fit (5 per flask). A full one-colour flask gets a cork.",
      },
      { action: "Undo or Reset", detail: "if a pour traps you." },
    ],
    score: "Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed: the full 25 if you finish with at least half the time left. Unfinished: 22 per corked flask.",
  },
  safe: {
    goal: "Find the four-digit combination that fits every clue.",
    how: [
      { action: "Use the arrows", detail: "to set each dial." },
      { action: "Tap TRY", detail: "to test - you get three tries." },
      { action: "Read every clue", detail: "because only one combination fits them all." },
    ],
    score: "Opened on try 1 / 2 / 3 = 130 / 115 / 100, + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 15 per dial right on the last try.",
  },
  bomb: {
    goal: "Read every rule, work out the six actions and their order, then do them.",
    how: [
      {
        action: "Only one plan fits",
        detail: "the rules together allow exactly one six-action sequence, and every rule is needed. Wires are numbered 1-7 from the left.",
      },
      { action: "Six steps exactly", detail: "tap wires and buttons, then tap DEFUSE." },
      { action: "One wrong step", detail: "and it explodes." },
    ],
    score: "Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 75 × correct steps before the strike ÷ 6, rounded (up to 75).",
  },
  gravity: {
    goal: "Tilt the board to park all four balls on their own targets.",
    how: [
      { action: "Every ball slides until it hits something.", detail: "" },
      { action: "A ball on its target locks and becomes a wall", detail: "- which can help or hurt the others." },
    ],
    score: "Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed: the full 25 if you finish with at least half the time left. Unfinished: 30 per locked ball.",
  },
  chain: {
    goal: "Tap 40 charms in order, following the repeating cycle - shape and colour must both match. Each right tap adds a link to the chain.",
    how: [
      { action: "Follow the cycle", detail: "at the top; the lit item is the one you need next." },
      { action: "Keep momentum", detail: "- tap again before the gold ring empties (3 s for links 1-13, 2.5 s for 14-26, 2 s for 27-40). The first tap is untimed." },
      { action: "One wrong tap or an empty ring", detail: "breaks the chain and ends the round." },
      { action: "Every 5 links", detail: "the board reshuffles with a new cycle and order. Watch for look-alikes: right shape, wrong colour." },
    ],
    score: "Unfinished: floor(3.5 × links). All 40: 140 + up to 10 for speed: the full 10 if you finish with at least half the time left. Maximum 150; round lasts 45 s.",
  },
  intruder: {
    goal: "Find every party guest who changed.",
    how: [
      { action: "Memorise the guests", detail: "before the lights dim - head shape and colour." },
      { action: "Tap every changed guest", detail: "- later boards contain two." },
      { action: "Five rounds", detail: "- 7 s to memorise, 5 s to pick; on the last two the guests swap places around the party." },
    ],
    score: "Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 24 per board right; one of two changes earns 12.",
  },
  nonogram: {
    goal: "Fill the grid so every row and column matches its numbers.",
    how: [
      { action: "Tap to fill", detail: "a cell, tap again to mark it empty." },
      { action: "Read the numbers", detail: "as the lengths of the filled runs, in order." },
      { action: "A line dims", detail: "once it matches its numbers." },
    ],
    score: "Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 110 × correct cells ÷ cells, −5 per wrong cell, up to 110.",
  },
  pairmatch: {
    goal: "Find all fifteen matching pairs.",
    how: [
      { action: "Tap two cards", detail: "to turn them over." },
      { action: "A match stays up", detail: "- a miss flips back." },
      { action: "Remember", detail: "where everything was." },
    ],
    score: "Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 8 per pair found.",
  },
  flood: {
    goal: "Flood the whole board with one colour of paint.",
    how: [
      { action: "Tap a colour", detail: "to repaint your wet region." },
      { action: "Your region grows", detail: "into every touching cell of that colour." },
      { action: "Start from the top-left", detail: "- that cell is always yours." },
    ],
    score: "Solved = 100 + up to 40 for moves (full at par, 0 at twice par) + up to 10 for speed: the full 10 if you finish with at least half the time left. Otherwise 110 × region ÷ 196.",
  },
  stroke: {
    goal: "Trace every line in one stroke without lifting your finger.",
    how: [
      { action: "Start on any dot", detail: "and drag along the lines." },
      { action: "No line twice", detail: "- you can't go back over one." },
      { action: "Lift your finger", detail: "to start the figure again." },
    ],
    score: "First try earns a bonus.",
  },
  tiles: {
    goal: "Slide the tiles into order, 1 to 8.",
    how: [
      { action: "Tap a tile", detail: "next to the gap to slide it in." },
      { action: "Finish left to right", detail: "with the gap bottom-right." },
      { action: "Tap Undo or Reset", detail: "to take slides back." },
    ],
    score: "Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed: the full 25 if you finish with at least half the time left. Unfinished: 14 per tile in place, up to 90.",
  },
  rings: {
    goal: "Turn the record's rings so every spoke is one colour.",
    how: [
      { action: "Tap a ring", detail: "- it glows and the needle touches its edge - then use the arrow buttons to turn it." },
      { action: "Check the legend", detail: "- some rings turn others with them, same way or opposite." },
      { action: "Watch the strobe dots", detail: "around the platter - one lights for each finished spoke." },
    ],
    score: "Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed: the full 25 if you finish with at least half the time left. Unfinished: 12 per aligned spoke.",
  },
  hover: {
    goal: "Fly through the barrier gaps.",
    how: [
      { action: "Tap to hover up;", detail: "let go to drop." },
      { action: "Touch gold stars", detail: "in tight gaps for a bonus." },
      { action: "Later barriers", detail: "have two gaps, or slide." },
      { action: "Hit anything", detail: "and the run ends. Gold stars sit near the edge of a gap, so they are risky.", helpOnly: true },
      { action: "Two-gap barriers:", detail: "fly through either gap. Sliding barriers move slowly and steadily up and down.", helpOnly: true },
      { action: "Everyone flies", detail: `the same course for sixty seconds: ${HOVER_REACHABLE_GATES} barriers in a clean run and ${HOVER_STARS} gold stars.`, helpOnly: true },
    ],
    score: bandHelp("Each barrier counts 3 and each gold star 2.", HOVER_BAND_CURVE, "Lasting the minute adds 10."),
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
      { action: "Everyone", detail: "gets the same gusts at the same moments.", helpOnly: true },
    ],
    score: bandHelp("Each block and each perfect drop counts 5, and each streak point 2 (a streak point for each perfect drop from the 3rd in a row).", SKYLINE_BAND_CURVE),
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
      { action: "From throw 7 the bucket slides", detail: "side to side - time your release.", helpOnly: true },
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
    score: bandHelp("Each bucket counts 10 and each hoop bonus 3.", BINTOSS_BAND_CURVE, "All ten in adds 10."),
  },
  bullseye: {
    goal: "Hit the centre - ten darts.",
    how: [
      { action: "Drag to aim,", detail: "let go to throw." },
      { action: "Wind 2?", detail: "Aim two rings into the wind." },
      { action: "Inner bull 12. Balloons 12,", detail: "but use the dart." },
      {
        action: "Touch and drag to aim:",
        detail: "the dotted path shows where the dart will land.",
        helpOnly: true,
      },
      {
        action: "Your aim sways - watch the ring and release at the right moment.",
        detail: "The ring circles once every two seconds.",
        helpOnly: true,
      },
      {
        action: "The wind moves your dart by that many rings.",
        detail: "Wind 2 to the right? Aim two rings to the left.",
        helpOnly: true,
      },
      { action: "The target", detail: "gets further away each throw.", helpOnly: true },
      { action: "From the fourth dart the target moves - lead it.", detail: "It is scored where it is when the dart lands.", helpOnly: true },
      { action: "From the seventh dart the ring values swap places.", detail: "Read the numbers - each value keeps its colour.", helpOnly: true },
      {
        action: "Inner bull:",
        detail: "the small pale spot in the middle of the 10 ring scores 12 instead of 10. It shows whenever the 10 is the centre ring.",
        helpOnly: true,
      },
      {
        action: "Balloons:",
        detail: "on three of darts 3-10 a balloon drifts across the range. Pop it for 12 - that dart then scores nothing on the board.",
        helpOnly: true,
      },
    ],
    score: bandHelp("Your dart total: rings 10 in the centre down to 1, an inner bull or a balloon 12.", BULLSEYE_BAND_CURVE),
  },
  matchup: {
    goal: "Line up three or more gems.",
    how: [
      { action: "Swap neighbours;", detail: "keep going as gems fall." },
      { action: "4, 5 or an L / T", detail: "makes a bomb or a star." },
      { action: "5 plus an L / T in one swap:", detail: "a jackpot!" },
      { action: "Drag one gem onto its neighbour", detail: "to swap them. You can keep swapping while matched gems clear and new ones fall.", helpOnly: true },
      { action: "Line of 4: a bomb", detail: "(clears around it). Line of 5: a white four-point star (its row and column). An L or T: a six-point star (both diagonals).", helpOnly: true },
      { action: "A line of 5 and an L / T in one swap", detail: "makes a jackpot gem: it clears every gem of its colour plus its row and column.", helpOnly: true },
      { action: "Specials", detail: "go off when you swap them or match next to them, and set each other off.", helpOnly: true },
      { action: "Sixty seconds", detail: "on the same board for everyone; new gems drop from the same fixed queues.", helpOnly: true },
    ],
    score: bandHelp("Match points: longer lines, cascades and special gems score more.", MATCHUP_BAND_CURVE),
  },
  snake: {
    goal: "Eat the stars; don't crash.",
    how: [
      { action: "Swipe to turn.", detail: "Stars grow and speed you up." },
      { action: "Red shadow?", detail: "A rock lands there in 2 s." },
      { action: "At 20 stars,", detail: "a meteor shower drops 3 rocks!" },
      { action: "Rocks hit only your head.", detail: "A rock on your tail does nothing, and your tail passes through rocks.", helpOnly: true },
      { action: "Rocks start at length 10:", detail: "one more every 5 stars, up to 8. Stars never appear on a rock.", helpOnly: true },
      { action: "The meteor shower", detail: "comes once, when you reach 20 stars: three red shadows, then three rocks land together 2 s later. With the shower, at most 11 rocks.", helpOnly: true },
      { action: "Hit a wall, your tail or a rock with your head", detail: "and the run ends.", helpOnly: true },
      { action: "Everyone gets", detail: "the same stars, and every rock lands on the same square at the same moment.", helpOnly: true },
    ],
    score: bandHelp("Each star eaten counts 1.", SNAKE_BAND_CURVE),
  },
  cross: {
    goal: "Get across the traffic as many times as you can.",
    how: [
      { action: "Swipe up to hop forward.", detail: "Swipe down to step back, left or right to step sideways." },
      { action: "Bikes race along green lanes", detail: "from crossing 3. Cones block the road from crossing 4: find the gap." },
      { action: "Three lives.", detail: "A hit sends you back to the start of this crossing." },
      { action: "The first two crossings", detail: "always leave wide gaps in every lane. Later traffic is tighter and faster.", helpOnly: true },
      { action: "After each crossing", detail: "you get a second on the kerb before the next one.", helpOnly: true },
    ],
    score: bandHelp("Each lane crossed counts 1 and each full crossing 2 more.", CROSS_BAND_CURVE),
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
      { action: "Keep the ball up", detail: "- it gets faster with bricks and with time. Losing the last ball costs 3 seconds.", helpOnly: true },
      { action: "Cracked bricks take 2 or 3 hits", detail: "- each hit cracks them further.", helpOnly: true },
      { action: "Four starred bricks drop a capsule.", detail: "Tap anywhere to fire a laser or ×3 you've caught; any longer touch moves the paddle.", helpOnly: true },
      { action: "Green L = laser:", detail: "one beam straight up from the paddle that hits the first 4 bricks above it.", helpOnly: true },
      { action: "Silver ×3 = three shots:", detail: "each tap fires an extra ball straight up; it vanishes at the first wall it hits.", helpOnly: true },
      { action: "Bronze ×2 = double balls", detail: "at once. There is one per board.", helpOnly: true },
      { action: "Orange flame = Fireball:", detail: "for 5 seconds your balls smash straight through bricks without bouncing.", helpOnly: true },
      { action: "Sliding rows:", detail: "one row starts at 30 s and another at 60 s, half a brick each way, slowly and always the same.", helpOnly: true },
    ],
    score: bandHelp("Each brick destroyed counts 1.", BRK_BAND_CURVE, "Clearing all 80 adds up to 10 for speed: the full 10 with at least half the time left, falling to 0 at the buzzer."),
  },
  rally: {
    goal: "Keep the rally going.",
    how: [
      { action: "Drag the paddle.", detail: "Miss the blue ball: over." },
      { action: "Only gold balls score:", detail: "each paddle hit." },
      { action: "Gold on a pink wall pad:", detail: "+3." },
      { action: "Drag to move the paddle", detail: "along the bottom.", helpOnly: true },
      { action: "Every hit", detail: "makes the paddle smaller and the ball faster.", helpOnly: true },
      { action: "A gold ball drops in", detail: "every ten seconds - only gold balls score.", helpOnly: true },
      { action: "Two pink target pads", detail: "sit on the far wall. A gold ball that hits one scores 3, and the pad moves somewhere new.", helpOnly: true },
      { action: "From 30 seconds a bumper", detail: "appears mid-court (it blinks a warning first). Balls bounce off it like a mirror, at the same speed.", helpOnly: true },
      { action: "Miss the blue ball", detail: "and the run is over.", helpOnly: true },
    ],
    score: bandHelp("Each gold-ball hit counts 5 and each pink target 6. The blue ball scores nothing; losing it ends the run.", RALLY_BAND_CURVE),
  },

  steady: {
    goal: "Stay inside the track.",
    how: [
      {
        action: "Slide the ball left and right",
        detail: "to stay inside the track. It gets narrower and faster.",
      },
      { action: "Touching an edge", detail: "costs a touch every half second until you're back inside." },
      { action: "Keep your finger down", detail: "- lifting it for more than half a second costs touches too." },
    ],
    score: "150 − 5 per touch.",
  },
  slice: {
    goal: "Slice the flying food. Don't cut the chillies.",
    how: [
      { action: "Swipe through the food", detail: "to slice it. Cut 3 or more in one swipe for a combo: ×2, then ×3." },
      { action: "Never cut a chilli:", detail: "it costs 10 points and ends your combo." },
      { action: "Cut a bottle:", detail: "ketchup stops chillies, mustard slows time, mayo pulls food together." },
      { action: "Saucy (ketchup): 3 chilli-free seconds.", detail: "Simmer (mustard): 4 slow seconds. Squeeze (mayo): nearby food gathers where you cut it.", helpOnly: true },
      { action: "One finger-down-to-up path counts together", detail: "- curves too, up to about three-quarters of the screen. Each combo resets a 10-second timer.", helpOnly: true },
    ],
    score: bandHelp("Combo-weighted slices out of the most the run offers (every food at ×3), in thousandths. Each chilli then costs 10 and ends the combo.", SLICE_BAND_CURVE),
  },
  bubble: {
    goal: "Pop bubbles in threes.",
    how: [
      { action: "Drag to aim,", detail: "let go to shoot." },
      { action: "Rainbow Joker", detail: "matches any colour." },
      { action: "Mines blast;", detail: "torpedoes clear a whole row." },
      { action: "Three of a colour pop", detail: "when they touch; bubbles left hanging fall. Bounce shots off the walls.", helpOnly: true },
      { action: "The rainbow Joker", detail: "joins every colour it touches and pops each group that reaches three. A mine clears the bubbles around it.", helpOnly: true },
      { action: "Specials come in the queue:", detail: `a Joker every ${BUB_V3_JOKER_BLOCK} shots or so, and one mine or torpedo somewhere in the first ${BUB_SPECIAL_BLOCK}.`, helpOnly: true },
      { action: "Ninety seconds", detail: "on the same field and queue for everyone.", helpOnly: true },
    ],
    score: bandHelp("Each bubble cleared from the field counts 1.", BUB_BAND_CURVE, "Clearing the field adds up to 10 for speed: the full 10 with at least half the time left, falling to 0 at the buzzer."),
  },
  beat: {
    goal: "Tap the notes in time.",
    how: [
      { action: "Tap a lane", detail: "as its note reaches the line." },
      { action: "Tail notes:", detail: "hold, let go at the end." },
      { action: "Arrow notes:", detail: "swipe that way on the line." },
      { action: "Closer is better", detail: "- perfect, good, or just OK.", helpOnly: true },
      { action: "A tap with no note", detail: "costs nothing.", helpOnly: true },
      { action: "Notes with a tail are holds", detail: "- press as the head reaches the line, release as the tail reaches it. Both ends must be Perfect for Perfect, or within Good for Good; otherwise Miss.", helpOnly: true },
      { action: "Swipe notes (from 30 seconds)", detail: "show a left or right arrow. Flick your finger that way in the lane as the note reaches the line. A plain tap won't hit them, and the wrong way is a miss.", helpOnly: true },
      { action: "Keep a combo going", detail: "to light up the lanes at 10, 25 and 50 - a miss resets it.", helpOnly: true },
    ],
    score: bandHelp("Perfect counts 4, Good 3, OK 1 and a missed note −2, out of 4 a note, in thousandths of the chart.", BEAT_BAND_CURVE),
  },

  ricochet: {
    goal: "Climb the shaft by leaping wall to wall.",
    how: [
      { action: "Tap to jump across", detail: "to the opposite wall." },
      { action: "Don't land on the spikes", detail: "or the run ends." },
      { action: "Don't slide", detail: "all the way back to the bottom." },
    ],
    score: "2 points per metre climbed, up to 150.",
  },
  tendrop: {
    goal: "Make the running total hit the target exactly.",
    how: [
      { action: "Tap falling tiles", detail: "- each one applies to the total in tap order." },
      { action: "×2, ÷2, ÷3 and −N", detail: "work on the total; a ÷ that doesn't divide exactly is refused." },
      { action: "Go past the target", detail: "and the total drops back to 0." },
    ],
    score: "13 per target cleared. All ten adds up to 20 for clearing them early.",
  },
  clayshoot: {
    goal: "Shoot all 25 clays out of the sky without hitting a bird.",
    how: [
      { action: "Tap a clay", detail: "to fire - the shot lands exactly where you tap." },
      { action: "Unlimited shots,", detail: "no reload." },
      { action: "Gold clays are faster and harder", detail: "and worth twice as much." },
      { action: "Later on, two fly at once", detail: "- keep watching both edges." },
      { action: "Don't shoot the birds", detail: "- each one costs 10." },
    ],
    score: "5 per orange, 10 per gold, −10 per bird. Hit all 25 with zero birds hit for +10. Maximum 150; minimum 0.",
  },
  whack: {
    goal: "Tap gophers whose hard hats match the banner.",
    how: [
      { action: "Gophers pop up briefly", detail: "- the window shrinks as the run goes on." },
      { action: "The rule flips 3-5 times", detail: "at unpredictable moments - watch the banner." },
      { action: "Never tap a hedgehog", detail: "- hedgehogs cost 5; a wrong-colour hat or an empty burrow costs 3." },
    ],
    score: "Up to 135 for the share of targets hit, −3 per wrong hat, −5 per hedgehog, −3 per empty tap, +15 for hitting every target. Maximum 150.",
  },
  wavefront: {
    goal: "Five waves and a boss in 90 s.",
    how: [
      { action: "Drag to move;", detail: "you fire on your own." },
      { action: "Dodge red bolts and divers:", detail: "3 lives." },
      { action: "After wave 5,", detail: "shoot down the boss." },
      { action: "The run lasts 90 seconds.", detail: "Each new wave flies in from the top 2 seconds after you clear one. Don't let a formation reach your line.", helpOnly: true },
      { action: "From wave 3, ships peel off and dive at you,", detail: "then fly back to their place. Shoot them on the way; one that rams you costs a life.", helpOnly: true },
      { action: "From wave 2, a grey armoured ship", detail: "takes 6-12 hits - every hit counts.", helpOnly: true },
      { action: "Shoot the saucer", detail: "and catch its drop: 5 laser shots that pierce up to 3 enemies.", helpOnly: true },
      { action: "The boss slides side to side and fires in patterns.", detail: "Its bar shows the 36 hits it can take; every hit counts, and destroying it ends the run.", helpOnly: true },
    ],
    score: bandHelp("Ships, armour hits and boss hits count 1, saucers 5 and cleared waves 15.", WAV_BAND_CURVE, "Destroying the boss adds 10."),
  },
  bastion: {
    goal: "Defend the base.",
    how: [
      { action: "Touch where you want to aim", detail: "- the turret follows and fires all the time." },
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
    score: "The longer you last, the more you score - the full minute is 150.",
  },
  sortrush: {
    goal: "Sort every shape into the gate of its colour.",
    how: [
      { action: "Swipe left or right", detail: "- from 20 seconds there's a middle gate too (swipe down)." },
      { action: "The gate colours swap;", detail: "watch for the flash." },
    ],
    score: "Points for the share you sort; wrong gates cost 2.",
  },
  flip: {
    goal: "Run the corridor - flip to the other side to dodge.",
    how: [
      { action: "Tap to flip", detail: "to the other side. Spikes or lava on one side? Run on the other." },
      { action: "Cracked stone tiles break", detail: "soon after you land on them, so flip off quickly." },
      { action: "Grab the gold stars.", detail: "From 15 seconds the corridor bends." },
      { action: "Hazards ride the bends with you,", detail: "so the gap between floor and ceiling never changes.", helpOnly: true },
      { action: "A tile starts cracking", detail: "the moment you touch it and is gone less than half a second later.", helpOnly: true },
    ],
    score: bandHelp("Each half second you last counts 1 and each gold star 3.", FLIP_BAND_CURVE, "Lasting the full minute adds 10."),
  },
  parry: {
    goal: "Block every arrow with the gong shield.",
    how: [
      { action: "Swipe in any of eight directions", detail: "or use ⟲ ⟳ to move one position." },
      { action: "A diagonal blocks both neighbours", detail: "- at 1:30 it covers the top and the right." },
      { action: "Later they come in pairs", detail: "and some swerve at the last moment. Three hits and you're out." },
    ],
    score: "2 per arrow deflected, −10 per life lost.",
  },
  junction: {
    goal: "Keep traffic moving, no crashes.",
    how: [
      { action: "Tap a light", detail: "to switch its road red or green." },
      { action: "Every 12 s", detail: "a new diagonal road joins." },
      { action: "Cars from crossing roads", detail: "must not meet." },
      { action: "Each light", detail: "stands at its own road's stop line, ringed in that road's colour; the stop line and the arrow painted on the lane share it. Tap the light, or anywhere along its lane, and the lane flashes.", helpOnly: true },
      { action: "Sharing the middle:", detail: "straight-on traffic from opposite main roads can cross together. Turning cars, and cars from a diagonal road (they bear left onto the main road), need the middle to themselves.", helpOnly: true },
      { action: "Cars on red queue up", detail: "- and they don't wait forever.", helpOnly: true },
      { action: "Buses (long, yellow)", detail: "take longer to clear the middle and block it while they cross.", helpOnly: true },
      { action: "Later,", detail: "some main-road cars turn - they flash an indicator a second before the line.", helpOnly: true },
      { action: "Ambulances (flashing blue)", detail: "come fast from 20 s on the main roads - give them green before they reach the line.", helpOnly: true },
      { action: "Everyone", detail: "gets the same new roads in the same order, and the same traffic.", helpOnly: true },
    ],
    score: bandHelp("Each car counts 2 and each bus 3; an ambulance through +4, one stopped −4; a driver who gives up −1.", JUNC_BAND_CURVE, "Lasting the minute adds 10."),
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
    score: bandHelp("Each level counts 10 and each gold star 2.", INK_BAND_CURVE, "All ten levels adds up to 10 for speed: the full 10 with at least half the time left, falling to 0 at the buzzer."),
  },

  burst: {
    goal: "Split the atoms. Don't get hit.",
    how: [
      { action: "◀ ▶ to move,", detail: "FIRE or tap to shoot up." },
      { action: "Catch drops:", detail: "BURST, SHIELD and FREEZE." },
      { action: "An atom touching you", detail: "costs a life (3 lives)." },
      { action: "Big atoms split into smaller ones;", detail: "the smallest pop.", helpOnly: true },
      { action: "Purple atoms: 1 in 2 drop a gold BURST icon", detail: "- triple shots until you lose a life.", helpOnly: true },
      { action: "Blue atoms: 1 in 8 drop a teal SHIELD", detail: "- it takes the next hit for you.", helpOnly: true },
      { action: "Green atoms: 1 in 12 drop an ice-blue FREEZE", detail: "- every atom stops for 3 seconds. Frozen atoms still hurt if you walk into one.", helpOnly: true },
    ],
    score: bandHelp("Each atom hit counts 1; each life lost takes 5 off.", BURST_BAND_CURVE, "Lasting the 90 s adds 10."),
  },
  orbit: {
    goal: "Fly planet to planet to the sun.",
    how: [
      { action: "Tap to let go;", detail: "the next orbit catches you." },
      { action: "Checkpoint:", detail: "a crash returns you there." },
      { action: "Black hole:", detail: "fly in, skip 5-6 planets." },
      { action: "You orbit automatically.", detail: "Tap to let go - you fly straight until the next orbit catches you.", helpOnly: true },
      { action: "Set Checkpoint once while orbiting.", detail: "Your next crash returns you there. Without it, or after using it, a crash ends the run. Orbits are belt-safe. On later planets, time arrival and departure through the opening in the outside asteroid ring - it turns once every 12 seconds.", helpOnly: true },
      { action: "Orbits change shape.", detail: "Ovals speed up near the planet. On a figure-eight, let go only on the outer loops - never at the crossing.", helpOnly: true },
      { action: "Black holes:", detail: "about every ten planets a small black hole sits beside one planet. Let go at just the right moment to fly into it and you come out orbiting a planet 5 or 6 further on; the planets you skip count as reached. A checkpoint you set before the jump still works.", helpOnly: true },
    ],
    score: bandHelp("Each planet reached counts 1.", ORBIT_BAND_CURVE, "Reaching the sun adds up to 10 for speed: the full 10 with at least half the time left, falling to 0 at the buzzer."),
  },

  snip: {
    goal: "Drop the apple into the basket.",
    how: [
      { action: "Swipe across a rope", detail: "to cut it. Order matters." },
      { action: "Avoid wasp nests;", detail: "use planks and springs." },
      { action: "10 levels,", detail: "up to 12 s each." },
      { action: "Time it with the swing.", detail: "Cut the last rope and the apple drops; the walls bounce it without losing speed, and the camera follows across the wider arena.", helpOnly: true },
      { action: "Orchard pieces:", detail: "the apple rolls along sloped planks and down tin gutters, bounces hard off springy green branches, and a touch on a wasp nest loses the level. Some baskets slide slowly side to side - drop it as one comes under.", helpOnly: true },
      { action: "Several ropes?", detail: "Which one you cut first decides which way the apple swings.", helpOnly: true },
      { action: "Don't let it settle", detail: "on a ledge or plank, or fly out the top or bottom.", helpOnly: true },
      { action: "Everyone", detail: "gets the same ten levels in the same order.", helpOnly: true },
    ],
    score: bandHelp("Each apple counts 10 and each leaf 2.", SNIP_BAND_CURVE, "All ten apples adds up to 10 for speed: the full 10 with at least half the time left, falling to 0 at the buzzer."),
  },
  swing: {
    goal: "Swing the ninja to the 500 m line.",
    how: [
      { action: "Hold to grab and swing,", detail: "let go to fly." },
      { action: "From 200 m a dragon chases you:", detail: "keep going." },
      { action: "Grab star anchors", detail: "for bonus stars." },
      { action: "Stuck? Keep swinging", detail: "- every pass gets you higher. Swipe up to shorten the rope for speed, down to let it out.", helpOnly: true },
      { action: "The dragon flies at a steady pace behind you.", detail: "Slow down or stall and it catches you, which ends the run. A marker at the left edge shows how far back it is.", helpOnly: true },
      { action: "Loose stalactites shake and cast a shadow on the lava", detail: "about a second before they fall. Don't be under one.", helpOnly: true },
      { action: "Lava bubbles before it jets up.", detail: "Don't be over a jet when it erupts.", helpOnly: true },
      { action: "Ten star anchors hang high in the gaps.", detail: "Grab one to take its star; they are optional.", helpOnly: true },
      { action: "Don't touch the spikes", detail: "or fall into the lava.", helpOnly: true },
    ],
    score: bandHelp("Each metre counts 1 (up to 500) and each star 5.", SWING_BAND_CURVE, "Reaching 500 m adds 10."),
  },
  tilt: {
    goal: "Roll each marble into its own cup.",
    how: [
      { action: "Drag left or right", detail: "to spin the maze." },
      { action: "Gold stars sit off the route:", detail: "bonus detours." },
      { action: `From maze ${TILT_TWO_FROM}, two marbles,`, detail: "each to its own cup." },
      { action: "Marbles always roll down.", detail: "Each finished maze brings a harder one; dark holes end the run.", helpOnly: true },
      { action: "Cups:", detail: "the blue marble goes in the blue cup, the amber marble in the amber cup. Each marble can only leave through the gap by its own cup, and the maze is done when both are in. The marbles roll through each other.", helpOnly: true },
      { action: "Stars:", detail: `${TILT_STARS_PER_MAZE} per maze, at the end of side passages. Roll either marble over one to collect it.`, helpOnly: true },
      { action: "Maze 2 only: the red ball waits behind a silver gate with a padlock.", detail: "Pass the brass padlock and it's free - it tilts with you. Touch the red ball and the run ends.", helpOnly: true },
    ],
    score: bandHelp("Each finished maze counts 30, getting closer to the exit in the maze you are on up to 29 more, and each star 5.", TILT_BAND_CURVE, "All four mazes adds up to 10 for speed: the full 10 with at least half the time left, falling to 0 at the buzzer."),
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
      { action: "Drag from corner to corner", detail: "to draw a rectangle." },
      { action: "Each rectangle must hold exactly one number,", detail: "and that number is its size in squares." },
      { action: "Cover every square.", detail: "" },
    ],
    score: "Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 110 × cells covered ÷ 100.",
  },
  dig: {
    goal: "Dig a path for the water to the drain.",
    how: [
      { action: "Limited digs.", detail: "Drag across gold sand to dig it." },
      { action: "Sand falls when you dig under it.", detail: "Fallen sand packs and can't be dug." },
      { action: "Avoid acid and lava.", detail: "Still water evaporates." },
    ],
    score: "Fill the drain with clean water: 100 + time bonus (the full bonus if you finish with at least half the time left), +20 within the planned digs. Otherwise points for clean water drained.",
  },
  trail: {
    goal: "Draw one path from 1 to 36 through every square.",
    how: [
      { action: "Tap an empty square touching the path end to place the next number.", detail: "Or drag from the end, including diagonals. Tap your last square to undo." },
      { action: "Ten dark numbers are fixed", detail: "- the path must reach each one at exactly that step. You fill the other 26." },
      { action: "Undo removes your last square; Reset clears your path.", detail: "Dragging back along the path also undoes. Fixed numbers stay." },
    ],
    score: "Complete path = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 5 per player tile in its correct cell; wrong tiles = 0, no penalty.",
  },
  numpyramid: {
    goal: "Complete four pyramids: every cell is the sum of the two below it.",
    how: [
      { action: "Drag a tile", detail: "from the tray into an empty cell." },
      { action: "Double-tap a placed tile", detail: "to return it to the tray; drag it onto another cell to swap." },
      { action: "Two tiles are decoys", detail: "- nothing fills itself in." },
      { action: "Skip", detail: "moves to the next pyramid without completing this one." },
    ],
    score: "30 per completed pyramid, plus up to 30 for finishing all four early. The current pyramid earns proportional partial points.",
  },
  balltrack: {
    goal: "Steer every marble into the cup of its colour.",
    how: [
      { action: "Tap a gold tube to turn it.", detail: "A marble rolling into an upright tube drops a row." },
      { action: "Tubes turn with a marble inside;", detail: "it rolls out of the new end." },
      { action: "Tap a cup's drop on the bottom row", detail: "to send marbles rolling past it (gold →); tap again to reopen it." },
      { action: "A marble drops about every two seconds", detail: "until 50 seconds; the run lasts a minute.", helpOnly: true },
      { action: "Mid-round the bottom row moves and the cups swap colours;", detail: "a countdown warns you.", helpOnly: true },
    ],
    score: bandHelp("Each marble home counts 1.", BT_BAND_CURVE, "All 30 home adds up to 10 for speed: the full 10 if the last marble lands by 56.5 s, falling to 0 at the buzzer."),
  },
  wordsearch: {
    goal: "Find the six hidden words from the category.",
    how: [
      { action: "Drag in a straight line", detail: "through the letters in any direction, backwards too." },
      { action: "A found word gets a line through it and a filled chip.", detail: "Only the count shows until you find them." },
    ],
    score: "20 per word. Find all six for 130 plus up to 20 speed points.",
  },
  letterwheel: {
    goal: "Fill the crossword using the letters on the wheel.",
    how: [
      { action: "Drag through the letters and let go,", detail: "or tap letters then Submit or the word." },
      { action: "Crossword words fill gold.", detail: "Words must be at least 3 letters. Other real words are not in this puzzle." },
      { action: "Shuffle", detail: "rearranges the wheel for free without changing the crossword." },
    ],
    score: "15 per word on eight-word puzzles, 13 on nine-word puzzles. Find them all for 130 plus up to 20 for speed: the full 20 if you finish with at least half the time left.",
  },
  lightup: {
    goal: "Place bulbs so every white square is lit.",
    how: [
      { action: "A bulb lights everything in its row and column", detail: "until it hits a black wall." },
      { action: "Bulbs must never shine on each other.", detail: "" },
      { action: "A number on a wall", detail: "says exactly how many bulbs touch that wall's sides." },
    ],
    score: "Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 110 × lit cells ÷ white cells, −5 per clashing bulb.",
  },
  tents: {
    goal: "Pitch one tent beside every tree.",
    how: [
      { action: "Tap a cell", detail: "for a tent, again for a grass tuft, again to clear." },
      { action: "Tents can't touch,", detail: "even diagonally." },
      { action: "The signposts", detail: "say how many tents are in each row and column." },
    ],
    score: "Complete = 130 + up to 20 for speed: the full 20 if you finish with at least half the time left. Otherwise 10 per correct tent; wrong tents cost nothing.",
  },
};
