/**
 * Score text for the scoring standard's second half of Pattern and Logic (logicRules.ts, docs/scoring-standard.md):
 * the "?" help SCORE text and the round intro's SCORE line, from the numbers the server grades with, written with the
 * game's maximum (roundMax.ts). The intro stays within two phone lines with no scoring terms (intro-score-text-check).
 * Shared and pure.
 */
import { roundMaxFor } from "../roundMax";
import { puzzleScoreList, type ScoreLine } from "../scoreList";
import { FLOOD_STANDARD_SPARE_MOVES, LOGIC_STANDARD, type LogicStandardType } from "./logicRules";

const fmt = (n: number) => String(Math.round(n * 10) / 10);

/** What counts unfinished (plain words; the share is up to LOGIC_SHARE_POINTS, early play adds up to LOGIC_EARLY_POINTS). */
const UNFINISHED: Record<LogicStandardType, string> = {
  lightsout: "the share of the lights you turn off, more for doing it early; presses past par take it down",
  sudoku: "the share of cells right, more for filling them early",
  tower: "the rings home on the gold post (from the bottom), more for getting them there early",
  tubes: "the share of flasks corked, more for corking them early; pours past par take it down",
  safe: "the dials right on your best try (one right is a guess and counts nothing), more for getting them early",
  bomb: "the steps done right before a wrong one, more for doing them early",
  nonogram: "the share of the picture's cells filled, more for filling them early",
  flood: "the share of the board flooded, more for flooding it early; moves past par take it down, and a board out of moves scores 0",
  tents: "the share of tents right, more for pitching them early",
  shikaku: "the share of the grid covered by correct rectangles, more for drawing them early, less what wrong ones cover",
  lightup: "the share of bulbs on their solution squares, more for placing them early",
};

/** Points off for a wrong item left on the board, unfinished. */
const LEFT: Partial<Record<LogicStandardType, string>> = {
  sudoku: "wrong digit left in the grid",
  nonogram: "wrong cell left filled",
  tents: "wrong tent left standing",
  lightup: "bulb off its solution square",
};

/** The bonus line, in words. */
function bonusLine(type: LogicStandardType): ScoreLine | null {
  const r = LOGIC_STANDARD[type];
  switch (type) {
    case "lightsout":
      return { label: "Par", how: "solve it in the fewest presses (shown; undone presses count) for all of it, nothing at twice that", max: r.bonus };
    case "tower":
      return { label: "Par", how: "solve it in the fewest moves (shown) for all of it, nothing at twice that", max: r.bonus };
    case "tubes":
      return { label: "Par", how: "solve it in the fewest pours (shown) for all of it, nothing at twice that", max: r.bonus };
    case "flood":
      return { label: "Par", how: `solve it in the fewest moves (shown) for all of it, ${fmt(r.bonus / FLOOD_STANDARD_SPARE_MOVES)} less for each move over`, max: r.bonus };
    case "safe":
      return { label: "First try", how: `open it on your first try, ${fmt(r.per ?? 0)} less for each wrong try`, max: r.bonus };
    case "sudoku":
      return { label: "Clean grid", how: `no wrong digit ever entered, ${fmt(r.per ?? 0)} less for each (erased ones too)`, max: r.bonus };
    case "nonogram":
      return { label: "Clean picture", how: `no wrong cell ever filled, ${fmt(r.per ?? 0)} less for each`, max: r.bonus };
    case "tents":
      return { label: "Clean camp", how: `no wrong tent ever pitched, ${fmt(r.per ?? 0)} less for each`, max: r.bonus };
    case "shikaku":
      return { label: "Clean cuts", how: `no wrong rectangle ever drawn, ${fmt(r.per ?? 0)} less for each`, max: r.bonus };
    case "lightup":
      return { label: "Clean board", how: `no wrong bulb ever placed, ${fmt(r.per ?? 0)} less for each`, max: r.bonus };
    case "bomb":
      return null;
  }
}

/** What a finish is. */
const FINISH: Record<LogicStandardType, [string, string]> = {
  lightsout: ["Finish", "turn every light off"],
  sudoku: ["Finish", "fill the grid correctly"],
  tower: ["Finish", "move every ring to the gold post"],
  tubes: ["Finish", "sort and cork every flask"],
  safe: ["Open it", "find the code"],
  bomb: ["Defuse it", "do every step right"],
  nonogram: ["Finish", "complete the picture"],
  flood: ["Finish", "flood the whole board one colour"],
  tents: ["Finish", "pitch every tent correctly"],
  shikaku: ["Finish", "cut the grid into the right rectangles"],
  lightup: ["Finish", "light every square with the right bulbs"],
};

/** The "?" help SCORE text: one line a part (scoreList.ts). */
export function logicStandardHelp(type: LogicStandardType): string {
  const r = LOGIC_STANDARD[type];
  const bonus = bonusLine(type);
  const left = LEFT[type];
  return puzzleScoreList({
    finishLabel: FINISH[type][0],
    finish: FINISH[type][1],
    speed: { max: r.speed, fullByS: r.fullByS, what: type === "safe" ? "open it" : type === "bomb" ? "defuse it" : "finish", note: type === "safe" ? "about half on the second try, none on the third" : undefined },
    bonuses: bonus ? [bonus] : [],
    unfinished: UNFINISHED[type],
    penalties: left && r.wrongOff ? [`When not finished, each ${left} costs ${r.wrongOff}`] : [],
    total: roundMaxFor(type),
  });
}

/** The round intro SCORE line (at most 90 characters, no scoring terms): what scores, then the bonuses. */
const INTRO: Record<LogicStandardType, string> = {
  lightsout: "Turn every light off; bonuses for speed and the fewest presses.",
  sudoku: "Fill the grid; bonuses for speed and no wrong digits.",
  tower: "Move every ring home; bonuses for speed and the fewest moves.",
  tubes: "Sort every flask; bonuses for speed and the fewest pours.",
  safe: "Crack the code; bonuses for speed and opening it first try.",
  bomb: "Do every step right; a bonus for speed.",
  nonogram: "Complete the picture; bonuses for speed and no wrong cells.",
  flood: "Flood the board one colour; bonuses for speed and the fewest moves.",
  tents: "Pitch every tent; bonuses for speed and no wrong tents.",
  shikaku: "Cut the grid into rectangles; bonuses for speed and no wrong boxes.",
  lightup: "Light every square; bonuses for speed and no wrong bulbs.",
};

export function logicStandardIntro(type: LogicStandardType): string {
  return `${INTRO[type]} Up to ${roundMaxFor(type)}.`;
}
