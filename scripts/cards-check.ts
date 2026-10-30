/**
 * cards-check (30 Oct 2026; docs/arcade-standard/freecell.md, tripeaks.md, pokersquares.md): the Cards & Board games.
 *
 *  1. Every FreeCell bank deal (all 300) replays its stored par line through the server's replay to exactly 200, with
 *     par moves equal to the bank's par; every TriPeaks bank deal (all 300) replays its line to a full clear with a run
 *     of ten and exactly 200; Poker Squares' target grid scores exactly 200 on 200 seeds (any seed is dealt: the
 *     builder only returns a grid whose ten lines all hold a pair or better and whose total reaches PS_CORE_FULL, so
 *     200 is reachable by construction).
 *  2. Determinism: the same seed deals the same cards in the same order every time (and the server's replay agrees
 *     with the phone's sim tick for tick); rooms deal a bank index (FreeCell, TriPeaks) or any seed (Poker Squares).
 *  3. Rules: FreeCell's moves (alternating colours, home by suit, capacity, auto moves home not counted as moves),
 *     TriPeaks' (one up or down with Ace–King wrapping, covered cards locked, the stock resetting the run), Poker
 *     Squares' hands (each of the eight, partial lines, empty squares) and placement (a placed card stays).
 *  4. No input scores 0; a played run at least 1; refused taps change nothing but the refused count.
 *  5. `CHECKS_FULL=1`: both banks rebuild byte for byte (scripts/freecell-bank.ts --check, tripeaks-bank.ts --check).
 *
 *   bun scripts/cards-check.ts
 */
import { spawnSync } from "node:child_process";
import { cardOf, NO_CARD } from "../src/lib/arcade/cards/cards";
import {
  FC_DEALS,
} from "../src/lib/arcade/cards/freecellDeals.data";
import {
  FC_INPUT_TAP, FC_PILE_CELL, FC_PILE_HOME, fcApply, fcBestTarget, fcCapacity, fcHomeCount, fcInitFrom, freecellGame, type FcState,
} from "../src/lib/arcade/cards/freecell";
import { TP_DEALS } from "../src/lib/arcade/cards/tripeaksDeals.data";
import { TP_STOCK_PILE, tpApply, tpFree, tpNext, tpPlayable, tripeaksGame } from "../src/lib/arcade/cards/tripeaks";
import { PS_CORE_FULL, PS_HANDS, PS_INPUT_PLACE, psHand, psTargetGrid, psTotals, pokerSquaresGame } from "../src/lib/arcade/cards/pokerSquares";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { replayFreecellRun, replayPokerSquaresRun, replayTripeaksRun } from "../src/lib/duel/cards";
import { freecellFlawless, pokerSquaresFlawless, tripeaksFlawless } from "./cards/flawless";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";

console.error = () => {};
let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};

/* 1. Every dealt seed reaches 200. */
let fcAll = true;
for (let i = 0; i < FC_DEALS.length; i++) {
  const { raw } = freecellFlawless(i);
  const r = replayFreecellRun(i, raw);
  if (r.score !== 200 || r.moves !== FC_DEALS[i]![1] || !r.finished || r.flagged) {
    fcAll = false;
    failures.push(`freecell: bank deal ${i} replays to ${r.score} in ${r.moves} moves (par ${FC_DEALS[i]![1]})`);
  }
}
ok(fcAll, `freecell: all ${FC_DEALS.length} bank deals replay their par line to 200`);
let tpAll = true;
for (let i = 0; i < TP_DEALS.length; i++) {
  const { raw } = tripeaksFlawless(i);
  const r = replayTripeaksRun(i, raw);
  if (r.score !== 200 || r.cleared !== 28 || r.bestRun < 10 || r.flagged) {
    tpAll = false;
    failures.push(`tripeaks: bank deal ${i} replays to ${r.score} (${r.cleared} cleared, best run ${r.bestRun})`);
  }
}
ok(tpAll, `tripeaks: all ${TP_DEALS.length} bank deals replay their line to a full clear, a run of ten and 200`);
let psAll = true;
for (let n = 0; n < 200; n++) {
  const seed = (Math.imul(n + 1, 0x9e3779b1) >>> 1) + 1;
  const { raw } = pokerSquaresFlawless(seed);
  const r = replayPokerSquaresRun(seed, raw);
  if (r.score !== 200 || r.made !== 10 || r.total !== r.target || r.target < PS_CORE_FULL) {
    psAll = false;
    failures.push(`pokersquares: seed ${seed}'s target grid replays to ${r.score}`);
  }
}
ok(psAll, "pokersquares: 200 seeds' target grids replay to 200");

/* 2. Determinism and the deal. */
ok(JSON.stringify(freecellGame.init(17)) === JSON.stringify(freecellGame.init(17)), "freecell: a seed deals the same cards every time");
ok(JSON.stringify(tripeaksGame.init(17)) === JSON.stringify(tripeaksGame.init(17)), "tripeaks: a seed deals the same cards every time");
ok(JSON.stringify(pokerSquaresGame.init(17)) === JSON.stringify(pokerSquaresGame.init(17)) && JSON.stringify(psTargetGrid(17)) === JSON.stringify(psTargetGrid(17)), "pokersquares: a seed deals the same order and target every time");
ok(new Set(pokerSquaresGame.init(5).order).size === 25, "pokersquares: 25 different cards");
for (let k = 0; k < 20; k++) {
  const fc = generatePuzzle("freecell") as { seed: number; freecellRev: number };
  const tp = generatePuzzle("tripeaks") as { seed: number; tripeaksRev: number };
  const ps = generatePuzzle("pokersquares") as { seed: number; pokerSquaresRev: number };
  ok(fc.freecellRev === 1 && fc.seed >= 0 && fc.seed < FC_DEALS.length, "freecell: rooms deal a bank index on freecellRev 1");
  ok(tp.tripeaksRev === 1 && tp.seed >= 0 && tp.seed < TP_DEALS.length, "tripeaks: rooms deal a bank index on tripeaksRev 1");
  ok(ps.pokerSquaresRev === 1 && ps.seed > 0, "pokersquares: rooms deal a seed on pokerSquaresRev 1");
}
ok(new Set(FC_DEALS.map((d) => d[0])).size === FC_DEALS.length && new Set(TP_DEALS).size === TP_DEALS.length, "both banks: no deal twice");

/* 3. Rules. */
{
  // A bare state: K♠ alone in column 0, Q♥ in column 1, everything else home or out of play.
  const bare = (cols: number[][], cells = [NO_CARD, NO_CARD, NO_CARD, NO_CARD], home = [0, 0, 0, 0]): FcState => ({ ...fcInitFrom(3, 40), cols: [...cols, ...Array.from({ length: 8 - cols.length }, () => [] as number[])], cells, home });
  const kS = cardOf(0, 13), qH = cardOf(1, 12), qS = cardOf(0, 12), jC = cardOf(3, 11);
  const s = bare([[kS], [qH, jC], [qS]]);
  ok(fcApply(s, 1, 0, 0) !== null, "freecell: Q♥ J♣ goes onto K♠ (alternating colours, a run)");
  ok(fcApply(s, 2, 0, 0) === null, "freecell: Q♠ cannot go onto K♠ (same colour)");
  ok(fcApply(s, 1, 1, FC_PILE_HOME) === null, "freecell: J♣ cannot go home before the clubs below it");
  ok(fcCapacity([NO_CARD, NO_CARD, 1, 2], [[1], [], [3], [4], [5], [6], [7], [8]], false) === 6 && fcCapacity([NO_CARD, NO_CARD, 1, 2], [[1], [], [3], [4], [5], [6], [7], [8]], true) === 3, "freecell: capacity (free cells + 1) × 2^(empty columns), one fewer into an empty one");
  const t = bare([[kS], [cardOf(1, 1)]]);
  ok(fcBestTarget(t, 1, 0) === FC_PILE_HOME, "freecell: a tap sends an Ace home");
  const parked = bare([[kS, cardOf(2, 5)], [cardOf(3, 9)]]);
  ok(fcBestTarget(parked, 0, 1) === 2 || fcBestTarget(parked, 0, 1) === FC_PILE_CELL, "freecell: a tap with no home or build goes to an empty column or a free cell");
  const auto = fcApply(bare([[cardOf(0, 1), kS], [cardOf(1, 1)]]), 0, 1, 2)!;
  ok(fcHomeCount(auto) === 2 && auto.moves === 1, "freecell: aces under a moved card go home by themselves, not counted as moves");
  // A refused tap: counted, nothing else changes.
  const g0 = freecellGame.init(4);
  const tap: ArcadeInputEvent = { t: 1, k: FC_INPUT_TAP, a: 9, b: 0, c: 0, d: 0 };
  const g1 = freecellGame.step(g0, tap);
  ok(g1.rejects === 1 && g1.moves === 0 && JSON.stringify(g1.cols) === JSON.stringify(g0.cols), "freecell: a tap on an empty cell is refused and changes nothing");
}
{
  const s = tripeaksGame.init(0);
  ok(s.tab.length === 28 && s.stock.length === 24 && s.stockPos === 1 && s.top === s.stock[0], "tripeaks: 28 peak cards, a 24-card stock whose first card starts the discard");
  ok([18, 19, 20, 21, 22, 23, 24, 25, 26, 27].every((i) => tpFree(s, i)) && [0, 1, 2, 3, 8, 9, 17].every((i) => !tpFree(s, i)), "tripeaks: the bottom ten face up, the rest covered");
  ok(tpNext(cardOf(0, 1), cardOf(1, 13)) && tpNext(cardOf(0, 13), cardOf(2, 1)) && tpNext(cardOf(0, 5), cardOf(3, 6)) && !tpNext(cardOf(0, 5), cardOf(3, 7)), "tripeaks: one up or down, Ace and King wrap");
  ok(!tpPlayable(s, 0), "tripeaks: a covered card cannot be played");
  const turned = tpApply({ ...s, run: 4 }, TP_STOCK_PILE)!;
  ok(turned.run === 0 && turned.stockPos === 2 && turned.top === s.stock[1], "tripeaks: the stock turns a new discard and resets the run");
}
{
  const c = (s: number, r: number) => cardOf(s, r);
  const cases: [number[], number][] = [
    [[c(0, 9), c(0, 10), c(0, 11), c(0, 12), c(0, 13)], 16],
    [[c(0, 1), c(1, 1), c(2, 1), c(3, 1), c(0, 2)], 15],
    [[c(0, 3), c(1, 3), c(2, 3), c(3, 9), c(0, 9)], 13],
    [[c(1, 2), c(1, 5), c(1, 9), c(1, 11), c(1, 13)], 11],
    [[c(0, 1), c(1, 2), c(2, 3), c(3, 4), c(0, 5)], 10],
    [[c(0, 10), c(1, 11), c(2, 12), c(3, 13), c(0, 1)], 10],
    [[c(0, 7), c(1, 7), c(2, 7), c(3, 2), c(0, 4)], 8],
    [[c(0, 7), c(1, 7), c(2, 4), c(3, 4), c(0, 1)], 6],
    [[c(0, 7), c(1, 7), c(2, 4), c(3, 5), c(0, 1)], 3],
    [[c(0, 2), c(1, 7), c(2, 4), c(3, 5), c(0, 11)], 0],
    [[c(0, 7), c(1, 7), NO_CARD, c(2, 7), NO_CARD], 8],
    [[c(0, 12), c(0, 13), c(0, 1), c(0, 2), c(0, 3)], 11],
  ];
  for (const [cards, want] of cases) ok(psHand(cards).points === want, `pokersquares: ${cards.join(",")} scores ${want} (got ${psHand(cards).points})`);
  ok(PS_HANDS.map((h) => h[1]).join(",") === "16,15,13,11,10,8,6,3", "pokersquares: hand points 16, 15, 13, 11, 10, 8, 6, 3");
  const s0 = pokerSquaresGame.init(3);
  const s1 = pokerSquaresGame.step(s0, { t: 1, k: PS_INPUT_PLACE, a: 7, b: 0, c: 0, d: 0 });
  const s2 = pokerSquaresGame.step(s1, { t: 2, k: PS_INPUT_PLACE, a: 7, b: 0, c: 0, d: 0 });
  ok(s1.grid[7] === s0.order[0] && s2.grid[7] === s0.order[0] && s2.next === 1 && s2.rejects === 1, "pokersquares: a placed card stays; a tap on a taken square is refused");
  ok(psTotals(s1.grid).total === 0, "pokersquares: one card makes no hand");
}

/* 4. No input 0, played 1+. */
for (const [name, game] of [["freecell", freecellGame], ["tripeaks", tripeaksGame], ["pokersquares", pokerSquaresGame]] as const) {
  let s = (game as typeof freecellGame).init(11) as never as { tick: number };
  const g = game as unknown as { step: (s: unknown, i: null) => { tick: number }; isOver: (s: unknown) => boolean; score: (s: unknown) => number };
  while (!g.isOver(s)) s = g.step(s, null);
  ok(g.score(s) === 0, `${name}: a run with no input scores 0`);
}

/* 5. Full depth: the banks rebuild byte for byte. */
if (process.env.CHECKS_FULL === "1") {
  for (const bank of ["freecell-bank", "tripeaks-bank"]) {
    const r = spawnSync("bun", [`scripts/${bank}.ts`, "--check"], { encoding: "utf8" });
    ok(r.status === 0, `${bank}: rebuilds byte for byte`);
  }
}

if (failures.length) {
  console.log(`FAIL cards-check: ${failures.length} of ${checks} checks failed`);
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS cards-check: ${checks} checks — ${FC_DEALS.length} FreeCell and ${TP_DEALS.length} TriPeaks bank deals and 200 Poker Squares seeds reach 200 through the server replay; rules, determinism, idle 0`);
