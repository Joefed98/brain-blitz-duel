/**
 * Score text for the scoring standard's second half of Pattern and Logic (logicRules.ts, docs/scoring-standard.md):
 * the "?" help SCORE text and the round intro's SCORE line, from the numbers the server grades with, written with the
 * game's maximum (roundMax.ts). The intro stays within two phone lines with no scoring terms (intro-score-text-check).
 * Shared and pure.
 */
import { roundMaxFor } from "../roundMax";
import { STANDARD_FINISH, STANDARD_UNFINISHED_CAP } from "./shape";
import { FLOOD_STANDARD_SPARE_MOVES, LOGIC_EARLY_POINTS, LOGIC_SHARE_POINTS, LOGIC_STANDARD, type LogicStandardType } from "./logicRules";

const fmt = (n: number) => String(Math.round(n * 10) / 10);

/** What the unfinished share counts, and today's points off that stay. */
const E = LOGIC_EARLY_POINTS;
const UNFINISHED: Record<LogicStandardType, string> = {
  lightsout: `by the share of the lights you turn off, plus up to ${E} for turning them off early; presses past par shrink it, to nothing at twice par`,
  sudoku: `by the share of cells right, plus up to ${E} for filling them early, less ${LOGIC_STANDARD.sudoku.wrongOff} for each wrong digit left in the grid`,
  tower: `by the share of rings home on the gold post (from the bottom), plus up to ${E} for getting them home early`,
  tubes: `by the share of flasks corked, plus up to ${E} for corking them early; pours past par shrink it, to nothing at the pour limit`,
  safe: `by the share of dials right on your best try (one right is a guess and counts nothing), plus up to ${E} for getting them early`,
  bomb: `by the share of steps done right before a wrong one, plus up to ${E} for doing them early`,
  nonogram: `by the share of the picture's cells filled, plus up to ${E} for filling them early, less ${LOGIC_STANDARD.nonogram.wrongOff} for each wrong cell left filled`,
  flood: `by the share of the board flooded, plus up to ${E} for flooding it early; moves past par shrink it, to nothing at the move limit, so a board out of moves scores 0`,
  tents: `by the share of tents right, plus up to ${E} for pitching them early, less ${LOGIC_STANDARD.tents.wrongOff} for each wrong tent left standing`,
  shikaku: `by the share of the grid covered by correct rectangles, plus up to ${E} for drawing them early, less the share any wrong rectangles cover`,
  lightup: `by the share of bulbs on their solution squares, plus up to ${E} for placing them early, less ${LOGIC_STANDARD.lightup.wrongOff} for each other bulb`,
};

/** The bonus, in words. */
function bonusText(type: LogicStandardType): string {
  const r = LOGIC_STANDARD[type];
  switch (type) {
    case "lightsout":
      return `up to ${r.bonus} for par (the fewest presses, shown; every press counts, undone ones too), shrinking evenly to none at twice par`;
    case "tower":
      return `up to ${r.bonus} for par (the fewest moves, shown), shrinking evenly to none at twice par`;
    case "tubes":
      return `up to ${r.bonus} for par (the fewest pours, shown; every pour counts), shrinking evenly to none at twice par`;
    case "flood":
      return `up to ${r.bonus} for par (the fewest moves, shown), ${fmt(r.bonus / FLOOD_STANDARD_SPARE_MOVES)} less for each move over, none at par + ${FLOOD_STANDARD_SPARE_MOVES} (the move limit)`;
    case "safe":
      return `a clean crack ${r.bonus}, ${fmt(r.per ?? 0)} less for each wrong try`;
    case "sudoku":
      return `a clean grid ${r.bonus}, ${fmt(r.per ?? 0)} less for each wrong digit ever entered (erased ones too)`;
    case "nonogram":
      return `a clean picture ${r.bonus}, ${fmt(r.per ?? 0)} less for each wrong cell ever filled`;
    case "tents":
      return `a clean camp ${r.bonus}, ${fmt(r.per ?? 0)} less for each wrong tent ever pitched`;
    case "shikaku":
      return `clean cuts ${r.bonus}, ${fmt(r.per ?? 0)} less for each wrong rectangle drawn and removed`;
    case "lightup":
      return `a clean board ${r.bonus}, ${fmt(r.per ?? 0)} less for each wrong bulb ever placed`;
    case "bomb":
      return "";
  }
}

/** How a perfect round reads. */
const TOP: Record<LogicStandardType, string> = {
  lightsout: "par",
  sudoku: "a clean grid",
  tower: "par",
  tubes: "par",
  safe: "the first try",
  bomb: "a defuse",
  nonogram: "a clean picture",
  flood: "par",
  tents: "a clean camp",
  shikaku: "clean cuts",
  lightup: "a clean board",
};

/** The "?" help SCORE text. */
export function logicStandardHelp(type: LogicStandardType): string {
  const r = LOGIC_STANDARD[type];
  const max = roundMaxFor(type);
  const unfinished = `Unfinished: up to ${LOGIC_SHARE_POINTS} ${UNFINISHED[type]}; at most ${STANDARD_UNFINISHED_CAP}, so any finish beats it.`;
  const speed = type === "safe"
    ? `up to ${r.speed} for speed (all of it within ${r.fullByS} s, shrinking evenly to none at the buzzer; about half of it on the second try, none on the third)`
    : `up to ${r.speed} for speed (all of it within ${r.fullByS} s, shrinking evenly to none at the buzzer)`;
  const bonus = bonusText(type);
  const finish = `${type === "safe" ? "Open it" : type === "bomb" ? "Defuse it" : "Finish"}: ${STANDARD_FINISH}, plus ${speed}${bonus ? ` and ${bonus}` : ""}, so ${max} is ${TOP[type]} within ${r.fullByS} s.`;
  return `${unfinished} ${finish}`;
}

/** What the intro counts unfinished, and what a perfect finish needs (no scoring terms). */
const INTRO: Record<LogicStandardType, [string, string]> = {
  lightsout: ["Lights off", "in the fewest presses"],
  sudoku: ["Cells right", "with no wrong digit"],
  tower: ["Rings home", "in the fewest moves"],
  tubes: ["Flasks corked", "in the fewest pours"],
  safe: ["Dials right", "on the first try"],
  bomb: ["Steps right", ""],
  nonogram: ["Cells right", "with no wrong cell"],
  flood: ["Board flooded", "in the fewest moves"],
  tents: ["Tents right", "with no wrong tent"],
  shikaku: ["Area right", "with no wrong box"],
  lightup: ["Bulbs right", "with no wrong bulb"],
};

/** The round intro SCORE line (at most two phone lines, no scoring terms). */
export function logicStandardIntro(type: LogicStandardType): string {
  const [lead, top] = INTRO[type];
  const verb = type === "safe" ? "Open it" : type === "bomb" ? "Defuse it" : "Finish";
  return `${lead}: up to ${STANDARD_UNFINISHED_CAP}. ${verb}: ${STANDARD_FINISH}+, ${roundMaxFor(type)}${top ? ` ${top}` : ""} within ${LOGIC_STANDARD[type].fullByS} s.`;
}
