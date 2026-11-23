/**
 * Writes the Cards & Board levels' help and intro text (the overhaul's stage 3, 15 Nov 2026) to
 * src/lib/levels/cardLevelText.data.ts: for each game and level, what changes (one plain line each, shown under HOW),
 * the intro's short SCORE line and the "?" help's SCORE text built from the level's own spec (stdHelp), so the words
 * always match the scoring. The phone reads the data file alone (no game code). `--check` compares without writing
 * (cards-levels-check runs it).
 *
 *   bun scripts/cards-level-text.ts [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { stdHelp } from "../src/lib/arcade/arcadeStandard";
import { FC_LEVEL_RULES_V6, FC_REV_PAR98, fcLevelSpec } from "../src/lib/arcade/cards/freecell";
import { MAHJONG_LEVEL_RULES_V3, MAHJONG_REV_LEVELS, mahjongLevelSpec } from "../src/lib/arcade/mahjong";
import { TP_LEVEL_RULES_V4, TP_REV_EASE, TP_STOCK_TURNS, tpLevelSpec } from "../src/lib/arcade/cards/tripeaks";
import { FH_LEVEL_RULES_V4, FH_REV_128, FH_REV_FLAT, FH_TURNS, FH_V3_TABLE_TEXT, fhLevelSpec, fhTableText } from "../src/lib/arcade/cards/fiveHands";
import { PY_LEVEL_RULES, pyLevelSpec } from "../src/lib/arcade/cards/pyramid";

const OUT = "src/lib/levels/cardLevelText.data.ts";
type L = "easy" | "hard" | "expert";
const LV: L[] = ["easy", "hard", "expert"];
interface Text { goal: string; how: string[]; intro: string; score: string }

const hintLine = (cost: number, limit: number, idle: boolean) =>
  limit === 1 ? "One hint this round: the Hint button lights one good move." : cost ? `Hints: the Hint button lights one good move, ${cost} points each.` : `Hints are free: the Hint button lights one good move${idle ? ", and it lights by itself after 8 s without a move" : ""}.`;

const text: Record<string, Record<L, Text>> = { freecell: {} as Record<L, Text>, mahjong: {} as Record<L, Text>, tripeaks: {} as Record<L, Text>, fivehands: {} as Record<L, Text>, pyramid: {} as Record<L, Text> };
for (const l of LV) {
  // D6 (23 Nov 2026): the levels dealt today are freecellRev 6's (FC_LEVEL_RULES_V6).
  const fc = FC_LEVEL_RULES_V6[l];
  const cards = 4 * fc.topRank;
  text.freecell[l] = {
    goal: `Get all ${cards} cards home, fast, in two minutes.`,
    how: [
      `${cards} cards (Ace to ${fc.topRank === 13 ? "King" : fc.topRank}), ${fc.cells} free cells${l === "expert" ? ", only the deals solved in 50 moves or fewer" : ""}.`,
      fc.undoFree ? "Undo is free and unlimited." : fc.undoLimit > 0 ? `${fc.undoLimit} undos, each a move.` : "Undo counts as a move.",
      ...(fc.hintLimit === 0 ? [] : [hintLine(fc.hintCost, fc.hintLimit, l === "easy")]),
    ],
    intro: `Move all ${cards} cards home; bonuses for few moves and speed. Up to 200.`,
    score: stdHelp(fcLevelSpec(l, FC_REV_PAR98)),
  };
  // D6 (23 Nov 2026): the levels dealt today are mahjongRev 3's (MAHJONG_LEVEL_RULES_V3: tiles in the stack).
  const mj = MAHJONG_LEVEL_RULES_V3[l];
  text.mahjong[l] = {
    goal: `Clear all ${mj.layout.tiles} tiles in pairs${mj.seconds ? ` in ${mj.seconds} seconds` : ""}.`,
    how: [
      `${mj.layout.tiles} tiles in ${mj.layout.layers} layers; ${mj.quads === 34 ? "every face appears" : `${mj.quads} faces appear`} four times, so pick which pair to take carefully.`,
      `A shuffle costs ${mj.shuffleCost}.`,
      ...(mj.hintLimit === 0 ? [] : [hintLine(mj.hintCost, mj.hintLimit, l === "easy")]),
    ],
    intro: `Clear pairs of the ${mj.layout.tiles} tiles; bonuses for no shuffles and speed. Up to 200.`,
    score: stdHelp(mahjongLevelSpec(l, MAHJONG_REV_LEVELS)),
  };
  // D6 (23 Nov 2026): the levels dealt today are tripeaksRev 4's (TP_LEVEL_RULES_V4: the clock is the lever).
  const tp = TP_LEVEL_RULES_V4[l];
  text.tripeaks[l] = {
    goal: `Clear the three peaks, one up or down from the discard, in ${tp.seconds} seconds.`,
    how: [
      `${tp.seconds} seconds; ${tp.stockTurns === TP_STOCK_TURNS ? "the whole stock" : `the stock cut to ${tp.stockTurns} cards`}${l === "easy" ? "; the easiest deals" : ""}.`,
      `${tp.glow ? "Playable cards glow" : "No glow: find the playable cards yourself"}; ${tp.wrap ? "Ace and King wrap" : "no wrap: an Ace never goes on a King or a King on an Ace"}.`,
      tp.hintLimit === 0 ? (tp.undoLimit ? `${tp.undoLimit} undos; no hints.` : "No undo and no hints.") : `${tp.undoLimit ? `${tp.undoLimit} undos, back one play or stock card each. ` : ""}${hintLine(tp.hintCost, tp.hintLimit, l === "easy")}`,
    ],
    intro: `Clear the peaks in long runs; speed full by ${tp.speedFullS} s. Up to 200.`,
    score: stdHelp(tpLevelSpec(l, TP_REV_EASE)),
  };
  // D6 (23 Nov 2026): the levels dealt today are fiveHandsRev 4's (FH_LEVEL_RULES_V4: 200 at the level's own hand points).
  const fh = FH_LEVEL_RULES_V4[l];
  const secs = (fh.seconds / (FH_TURNS + 1)).toFixed(1).replace(/\.0$/, "");
  text.fivehands[l] = {
    goal: `Build five poker hands, then pick a column. ${fh.seconds} s, about ${secs} s a card.`,
    how: [
      `${fh.seconds} seconds for your ${FH_TURNS} cards; 200 at ${fh.full} hand points${fh.tableRev === FH_REV_FLAT ? "" : `; ${fhTableText(fh.tableRev).split(", ").slice(0, 2).join(", ")} (bigger hands pay as Normal)`}.`,
      ...(fh.preview ? [`The next ${fh.preview} cards show beside yours, and each column's value shows while you pick.`] : ["No preview of the next cards, no column values and no hints."]),
      ...(fh.hintLimit === 0 ? [] : [hintLine(fh.hintCost, fh.hintLimit, l === "easy")]),
    ],
    intro: `Make poker hands in five rows, then pick a column; 200 at ${fh.full} hand points. Up to 200.`,
    score: stdHelp(fhLevelSpec(l, FH_REV_128)),
  };
  const py = PY_LEVEL_RULES[l];
  text.pyramid[l] = {
    goal: "Clear the pyramid in pairs that add to 13.",
    how: [
      `${py.passes === 1 ? "One pass" : `${py.passes} passes`} through the stock; ${py.kingsMin === py.kingsMin + py.kingsSpan - 1 ? py.kingsMin : `${py.kingsMin}–${py.kingsMin + py.kingsSpan - 1}`} Kings in the pyramid${l === "expert" ? "; the hardest deals" : l === "hard" ? "; harder deals" : ""}.`,
      py.glow ? "A picked card's partners glow." : "No glow: find each card's partner yourself.",
      hintLine(py.hintCost, py.hintLimit, l === "easy"),
    ],
    intro: "Clear the pyramid in pairs to 13; bonuses for a clear and speed. Up to 200.",
    score: stdHelp(pyLevelSpec(l)),
  };
}
void FH_V3_TABLE_TEXT;

const body = `/**
 * The Cards & Board levels' words (the overhaul's stage 3, 15 Nov 2026), written by scripts/cards-level-text.ts (do not
 * edit by hand): for each game and level, its goal, what changes (shown under HOW), the intro's SCORE line and the "?"
 * help's SCORE text (from the level's own spec). Plain data, so the phone loads no game code for it.
 */
export interface CardLevelText {
  goal: string;
  how: readonly string[];
  intro: string;
  score: string;
}

export const CARD_LEVEL_TEXT: Readonly<Record<string, Readonly<Record<"easy" | "hard" | "expert", CardLevelText>>>> = ${JSON.stringify(text, null, 2)};
`;
if (process.argv.includes("--check")) {
  const same = readFileSync(OUT, "utf8") === body;
  console.log(same ? "PASS card level text matches the levels' rules" : "FAIL card level text is out of date: run bun scripts/cards-level-text.ts");
  process.exit(same ? 0 : 1);
}
writeFileSync(OUT, body);
console.log(`wrote ${OUT}`);
