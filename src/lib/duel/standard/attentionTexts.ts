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
  CLASH_STD_SHARE,
  CLASH_STD_SPEED,
  CLASH_STD_STREAK,
  CLASH_STD_UNFINISHED_TOP,
  CLASH_STREAK_FROM,
} from "@/lib/arcade/colourClash";
import { STANDARD_FINISH, STANDARD_UNFINISHED_CAP } from "./shape";
import { ASCEND_STD, CHAIN_STD, COUNT_STD, MAZE_STD, PAIR_STD, SCAN_STD, SPOT_STD } from "./attention";

const CAP = STANDARD_UNFINISHED_CAP;
const FIN = STANDARD_FINISH;
const pct = (share: number) => `${Math.round(share * 100)} %`;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
/** "up to N for speed (all of it within F s, none at the buzzer)". */
const speedLine = (max: number, fullByS: number, extra = "") =>
  `up to ${max} for speed (all of it if you finish within ${fullByS} s, falling evenly to none at the buzzer${extra})`;
const capLine = `Unfinished scores at most ${CAP}, so any finish scores more.`;

/* ------------------------------------------------------------------ help */

export const STANDARD_ATTENTION_HELP = {
  numhunt: () =>
    `Unfinished: up to ${ASCEND_STD.share} for the share of the 24 numbers reached, plus up to ${ASCEND_STD.early} for reaching them early; each wrong tap costs ${ASCEND_STD.wrongCost}. ` +
    `A finish scores ${FIN}, plus ${speedLine(ASCEND_STD.speed, ASCEND_STD.fullByS, `; each wrong tap takes a sixth of it`)} and up to ${ASCEND_STD.flow} for flow: your longest run of right taps with no wrong tap (all 24 in one run for the lot; it counts unfinished too). ${capLine} {max} is a finish within ${ASCEND_STD.fullByS} s with no wrong tap.`,
  chain: () =>
    `Unfinished: up to ${CHAIN_STD.share} for the share of the ${40} links made, plus up to ${CHAIN_STD.early} for making them early. ` +
    `A full chain scores ${FIN}, plus ${speedLine(CHAIN_STD.speed, CHAIN_STD.fullByS)}, so {max} is a full chain within ${CHAIN_STD.fullByS} s. ${capLine}`,
  stroop: () => {
    const fullBy = CLASH_STD_FULL_BY_TICK / 60;
    const run = CLASH_REV3_RUN_TICKS / 60;
    return (
      `Unfinished: up to ${CLASH_STD_SHARE} for the words sorted right less the words sorted wrong (all ${CLASH_QUEUE} right for the lot). ` +
      `All ${CLASH_QUEUE} sorted (or let fall) with at most ${CLASH_DEPTH_MAX_WRONG} wrong is a finish: ${CLASH_STD_FINISH}, plus up to ${CLASH_STD_SPEED} for speed (all of it if the last word lands within ${fullBy} s, falling evenly to none at ${run} s; each wrong word takes a sixth of it; touching a grey word counts as wrong). ` +
      `Your longest streak of words right in a row adds up to ${CLASH_STD_STREAK} (from ${CLASH_STREAK_FROM + 1} in a row, all ${CLASH_QUEUE} for the lot) and each of the ${CLASH_GOLDS} gold words sorted right adds ${CLASH_STD_GOLD}, finished or not (unfinished, only once more words are right than wrong). Unfinished scores at most ${CLASH_STD_UNFINISHED_TOP}, so any finish scores more. {max} is a quick finish with all ${CLASH_QUEUE} right in a row and every gold word.`
    );
  },
  symscan: () =>
    `Unfinished: up to ${SCAN_STD.perGrid} a grid for the share of its eagles marked, plus up to ${SCAN_STD.early} for each grid completed early; each wrong eagle left marked costs ${SCAN_STD.wrongCost}. ` +
    `Every eagle found in all three grids, with at most ${SCAN_STD.finishWrongPerGrid} wrong eagles left marked in each, is a finish: ${FIN}, plus ${speedLine(SCAN_STD.speed, SCAN_STD.fullByS)} and up to ${SCAN_STD.clean} for clean grids (about ${fmt(SCAN_STD.clean / 3)} for each grid where you never marked a wrong eagle). ${capLine} {max} is a finish within ${SCAN_STD.fullByS} s with no wrong eagle ever marked.`,
  spotdiff: () =>
    `Unfinished: ${SPOT_STD.perDiff} a difference, plus up to ${fmt(SPOT_STD.early)} each for finding it early; each wrong tap costs ${SPOT_STD.wrongCost}. ` +
    `All 12 found, with at most 5 wrong taps in each picture, is a finish: ${FIN}, plus ${speedLine(SPOT_STD.speed, SPOT_STD.fullByS)} and ${SPOT_STD.clean} for no wrong taps at all. ` +
    `One picture also hides a seventh, subtler difference, not in the count: find it before that picture's sixth for ${SPOT_STD.hidden}, finished or not. ${capLine} {max} is all 12 and the hidden one within ${SPOT_STD.fullByS} s with no wrong tap.`,
  countup: () =>
    `Unfinished: ${COUNT_STD.perTray} a tray counted right (one off still earns ${pct(COUNT_STD.near)} of it), plus up to ${fmt(COUNT_STD.early)} each for counting it early. ` +
    `All four exact is a finish: ${FIN}, plus ${speedLine(COUNT_STD.speed, COUNT_STD.fullByS)}, so {max} is all four within ${COUNT_STD.fullByS} s. ${capLine}`,
  maze: () =>
    `Unfinished: up to ${MAZE_STD.share} for how far along the route you got (wandering costs), plus up to ${MAZE_STD.early} for getting there early. ` +
    `Reaching the exit is a finish: ${FIN}, plus ${speedLine(MAZE_STD.speed, MAZE_STD.fullByS)}. Stars add ${MAZE_STD.stars} shared across the maze's stars (${MAZE_STD.stars / 3} each), finished or not. ${capLine} {max} is every star and the exit within ${MAZE_STD.fullByS} s.`,
  pairmatch: () =>
    `Unfinished: ${PAIR_STD.perPair} a pair, plus up to ${fmt(PAIR_STD.early)} each for finding it early; after ${PAIR_STD.freeMisses} missed tries, every ${PAIR_STD.missesPerPair} more cost a pair's points. ` +
    `All 15 is a finish: ${FIN}, plus ${speedLine(PAIR_STD.speed, PAIR_STD.fullByS)}. ` +
    `Matches in a row build a streak: 1 for each match in your longest streak beyond the first ${PAIR_STD.streakFrom}, up to ${PAIR_STD.streak}; the gold pair adds ${PAIR_STD.gold} if you match it in the first ${PAIR_STD.goldWindowMs / 1000} s. Both count finished or not. ${capLine} {max} needs a finish within ${PAIR_STD.fullByS} s, a long streak and the gold pair.`,
} as const;

/* ------------------------------------------------------------------ intro lines (at most 90 characters) */

export const STANDARD_ATTENTION_INTRO = {
  numhunt: `Numbers reached: up to ${CAP}. Finish: ${FIN}+, {max} fast with no wrong taps.`,
  chain: `Links: up to ${CAP}. A full chain: ${FIN}+, {max} if you finish within ${CHAIN_STD.fullByS} s.`,
  stroop: `Sort all ${CLASH_QUEUE}, ${CLASH_DEPTH_MAX_WRONG} wrong at most: ${FIN}+. Streaks and gold words add up to {max}.`,
  symscan: `Eagles found: up to ${CAP}. All found: ${FIN}+, {max} fast with no wrong taps.`,
  spotdiff: `Differences: up to ${CAP}. All 12: ${FIN}+; the hidden 7th and no wrong taps add up to {max}.`,
  countup: `Trays counted: up to ${CAP}. All four right: ${FIN}+, {max} within ${COUNT_STD.fullByS} s.`,
  maze: `Route: up to ${CAP}; stars add. Exit: ${FIN}+, {max} fast with every star.`,
  pairmatch: `Pairs: up to ${CAP}. All 15: ${FIN}+; streaks and the gold pair in 30 s add up to {max}.`,
} as const;
