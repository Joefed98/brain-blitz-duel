/**
 * The scoring standard's Speed and Attention texts (27 Oct 2026, docs/scoring-standard.md): the "?" help SCORE text and
 * the round intro SCORE line for each game, built from the numbers the graders use (attention.ts, and colourClash.ts for
 * Mixed Signals), so a changed number changes the text. "{max}" is the game's round maximum (roundMax.ts).
 */
import {
  CLASH_DEPTH_MAX_WRONG,
  CLASH_GOLDS,
  CLASH_QUEUE,
  CLASH_REV3_RUN_TICKS,
  CLASH_STD_FINISH,
  CLASH_STD_FULL_BY_TICK,
  CLASH_STD_GOLD,
  CLASH_STD_SPEED,
  CLASH_STD_STREAK,
  CLASH_STD_UNFINISHED_TOP,
  CLASH_STREAK_FROM,
} from "@/lib/arcade/colourClash";

import { puzzleScoreList, scoreList } from "../scoreList";
import { PAR_MOVES_STD, PAR_STRICT_FULL_BY_S, parStrictDealt } from "../parMoves";
import { ASCEND_STD, CHAIN_STD, COUNT_STD, MAZE_STD, PAIR_STD, SCAN_STD, SPOT_STD } from "./attention";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const TOTAL = "{max}" as unknown as number;

/* ------------------------------------------------------------------ help (one line a part, scoreList.ts) */

export const STANDARD_ATTENTION_HELP = {
  numhunt: () =>
    puzzleScoreList({
      finish: "tap all 24 numbers in order",
      speed: { max: ASCEND_STD.speed, fullByS: ASCEND_STD.fullByS, note: "each wrong tap takes a sixth of it" },
      bonuses: [{ label: "Flow", how: "your longest run of right taps with no wrong tap, finished or not", max: ASCEND_STD.flow }],
      unfinished: "the share of the numbers reached, more for reaching them early",
      penalties: [`When not finished, each wrong tap costs ${ASCEND_STD.wrongCost}`],
      total: TOTAL,
    }),
  chain: () =>
    puzzleScoreList({
      finish: "make all 40 links",
      speed: { max: CHAIN_STD.speed, fullByS: CHAIN_STD.fullByS },
      unfinished: "the share of the links made, more for making them early",
      total: TOTAL,
    }),
  stroop: () =>
    scoreList([
      { label: "Finish", how: `sort all ${CLASH_QUEUE} words with at most ${CLASH_DEPTH_MAX_WRONG} wrong`, fixed: CLASH_STD_FINISH },
      { label: "Speed", how: `the last word lands within ${CLASH_STD_FULL_BY_TICK / 60} s for all of it, nothing at ${CLASH_REV3_RUN_TICKS / 60} s; each wrong word takes a sixth of it`, max: CLASH_STD_SPEED },
      { label: "Streak", how: `your longest run of words right in a row (${CLASH_STREAK_FROM + 1} or more)`, max: CLASH_STD_STREAK },
      { label: "Gold words", how: `${CLASH_STD_GOLD} for each of the ${CLASH_GOLDS} gold words sorted right`, max: CLASH_STD_GOLD * CLASH_GOLDS },
      { label: "Not finished", how: "the words sorted right, less the words sorted wrong", max: CLASH_STD_UNFINISHED_TOP },
    ], { penalties: ["Touching a grey word counts as wrong"], total: TOTAL }),
  symscan: () =>
    puzzleScoreList({
      finish: `find every eagle in all three grids, with at most ${SCAN_STD.finishWrongPerGrid} wrong ones left marked in each`,
      speed: { max: SCAN_STD.speed, fullByS: SCAN_STD.fullByS },
      bonuses: [{ label: "Clean grids", how: `about ${fmt(SCAN_STD.clean / 3)} for each grid where you never mark a wrong eagle`, max: SCAN_STD.clean }],
      unfinished: `up to ${SCAN_STD.perGrid} a grid for the eagles you mark, more for finishing a grid early`,
      penalties: [`When not finished, each wrong eagle left marked costs ${SCAN_STD.wrongCost}`],
      total: TOTAL,
    }),
  spotdiff: () =>
    puzzleScoreList({
      finish: "find all 12 differences, with at most 5 wrong taps in each picture",
      speed: { max: SPOT_STD.speed, fullByS: SPOT_STD.fullByS },
      bonuses: [
        { label: "No wrong taps", how: "never tap a wrong spot", max: SPOT_STD.clean },
        { label: "Hidden difference", how: "find the subtle seventh one before that picture’s sixth, finished or not", max: SPOT_STD.hidden },
      ],
      unfinished: `${SPOT_STD.perDiff} for each difference found, more for finding it early`,
      penalties: [`When not finished, each wrong tap costs ${SPOT_STD.wrongCost}`],
      total: TOTAL,
    }),
  countup: () =>
    puzzleScoreList({
      finish: "count all four trays exactly",
      speed: { max: COUNT_STD.speed, fullByS: COUNT_STD.fullByS },
      unfinished: `${COUNT_STD.perTray} for each tray counted right (a little for one off), more for counting it early`,
      total: TOTAL,
    }),
  maze: () =>
    puzzleScoreList({
      finish: "reach the exit",
      speed: { max: MAZE_STD.speed, fullByS: MAZE_STD.fullByS },
      bonuses: [{ label: "Stars", how: `${MAZE_STD.stars / 3} for each star, finished or not`, max: MAZE_STD.stars }],
      unfinished: "how far along the route you got (wandering costs), more for getting there early",
      total: TOTAL,
    }),
  pairmatch: () =>
    puzzleScoreList({
      finish: "match all 15 pairs",
      speed: { max: PAIR_STD.speed, fullByS: PAIR_STD.fullByS },
      bonuses: [
        { label: "Streak", how: `1 for each match in your longest streak after the first ${PAIR_STD.streakFrom}, finished or not`, max: PAIR_STD.streak },
        { label: "Gold pair", how: `match the gold pair in the first ${PAIR_STD.goldWindowMs / 1000} s, finished or not`, max: PAIR_STD.gold },
      ],
      unfinished: `${PAIR_STD.perPair} for each pair, more for finding it early`,
      penalties: [`After ${PAIR_STD.freeMisses} missed tries, every ${PAIR_STD.missesPerPair} more cost a pair’s points`],
      total: TOTAL,
    }),
} as const;

/** Labyrinth on the puzzle batch's stamp (3 Nov 2026, parMoves.ts: mazeRev 4): no stars; 150 + speed + par moves. */
export const PAR_MOVES_MAZE_HELP = (strict = parStrictDealt()) => {
  // mazeRev 5 (puzzle polish, 3 Nov 2026): par shown on screen, speed full a little earlier, par points gone at 1.5× par.
  const fullBy = strict ? PAR_STRICT_FULL_BY_S.maze : MAZE_STD.fullByS;
  return puzzleScoreList({
    finish: "reach the exit",
    speed: { max: PAR_MOVES_STD.speed, fullByS: fullBy },
    bonuses: [{ label: "Moves", how: `take no more steps than the route’s length (par${strict ? ", shown" : ""}) for all of it, less for each one over, nothing at ${strict ? "one and a half times" : "twice"} par`, max: PAR_MOVES_STD.par }],
    unfinished: "how far along the route you got (wandering costs), more for getting there early",
    total: TOTAL,
  });
};

export const PAR_MOVES_MAZE_INTRO = "Reach the exit; bonuses for speed and no wasted steps. Up to {max}.";

/* ------------------------------------------------------------------ intro lines (at most 90 characters) */

export const STANDARD_ATTENTION_INTRO = {
  numhunt: "Tap the numbers in order; bonuses for speed and no wrong taps. Up to {max}.",
  chain: "Make every link; a bonus for speed. Up to {max}.",
  stroop: `Sort the words; bonuses for speed, streaks and gold words. Up to {max}.`,
  symscan: "Find every eagle; bonuses for speed and no wrong taps. Up to {max}.",
  spotdiff: "Find the differences; bonuses for speed, no wrong taps and the hidden one. Up to {max}.",
  countup: "Count every tray right; a bonus for speed. Up to {max}.",
  maze: "Reach the exit; bonuses for speed and every star. Up to {max}.",
  pairmatch: "Match every pair; bonuses for speed, streaks and the gold pair. Up to {max}.",
} as const;
