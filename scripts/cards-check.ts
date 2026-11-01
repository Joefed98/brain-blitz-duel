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
 *  6. Rev 2 (31 Oct 2026, docs/arcade-standard/freecell.md, pokersquares.md, fivehands.md): rooms deal Free Cell
 *     freecellRev 2 and Full House pokerSquaresRev 2; 48 rev-1 runs recorded on main (scripts/fixtures/
 *     cards-rev1-legacy.json, scripts/cards-legacy-record.ts) replay to the same score and final state; every bank
 *     deal's par line reaches 200 on freecellRev 2 too; Undo (unlimited, a move each, the clock running), Reset (the
 *     deal back, a move, undoable) and the refused move's note ("Need a free cell to move 2 cards"); rev 1 refuses
 *     Undo and Reset as input; Full House's core is full at the elite median on rev 2 only, every target grid reaches
 *     it, 200 seeds reach 200. Five Hands (fiveHandsRev 1): every tuning (0–59) and fresh (10000–10199) seed and 200
 *     room-style seeds' witnesses replay to 200 through the server replay; the deal (45 different cards, the same every
 *     time), even filling (greyed rows refused), the discards face up, the hands, idle 0 and played 1+.
 *
 *   bun scripts/cards-check.ts
 */
import { spawnSync } from "node:child_process";
import { cardOf, NO_CARD, rankOf as rankOfCard, suitOf as suitOfCard } from "../src/lib/arcade/cards/cards";
import {
  FC_DEALS,
} from "../src/lib/arcade/cards/freecellDeals.data";
import {
  FC_INPUT_TAP, FC_PILE_CELL, FC_PILE_HOME, fcApply, fcBestTarget, fcCapacity, fcHomeCount, fcInitFrom, freecellGame, type FcState,
} from "../src/lib/arcade/cards/freecell";
import { TP_DEALS } from "../src/lib/arcade/cards/tripeaksDeals.data";
import { TP_STOCK_PILE, tpApply, tpFree, tpNext, tpPlayable, tripeaksGame } from "../src/lib/arcade/cards/tripeaks";
import { PS_CORE_FULL, PS_CORE_FULL_V2, PS_HANDS, PS_INPUT_PLACE, psHand, psTargetGrid, psTotals, pokerSquaresGame, pokerSquaresGameFor, pokerSquaresStdParts } from "../src/lib/arcade/cards/pokerSquares";
import {
  FC_CORE_UNITS, FC_CORE_UNITS_V3, FC_INPUT_MOVE, FC_INPUT_RESET, FC_INPUT_UNDO, FC_REV, FC_STD_SPEC, fcCheckpoint, fcCoreUnits, fcNoteText, fcPack, freecellGameFor, freecellStdParts,
} from "../src/lib/arcade/cards/freecell";
import {
  FH_BEST_MIN, FH_CORE_FULL, FH_INPUT_PLACE, fhDeckBest, FH_REV, FH_ROWS, FH_SEEN, FH_STD_SPEC, FH_TURNS, fhCheckpoint, fhDeal, fhDiscard, fhDiscardsShown, fhOpenRows, fhRowHand, fhTotals, fhYours,
  fiveHandsGame, fiveHandsGameFor, fiveHandsStdParts, type FhState,
} from "../src/lib/arcade/cards/fiveHands";
import { psCheckpoint } from "../src/lib/arcade/cards/pokerSquares";
import { readFileSync } from "node:fs";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { decodeFreecellRun, encodeFreecellRun, replayFiveHandsRun, replayFreecellRun, replayPokerSquaresRun, replayTripeaksRun } from "../src/lib/duel/cards";
import { fiveHandsFlawless, freecellFlawless, pokerSquaresFlawless, tripeaksFlawless } from "./cards/flawless";
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
  const fh = generatePuzzle("fivehands") as { seed: number; fiveHandsRev: number };
  ok(fc.freecellRev === FC_REV && fc.seed >= 0 && fc.seed < FC_DEALS.length, `freecell: rooms deal a bank index on freecellRev ${FC_REV}`);
  ok(tp.tripeaksRev === 1 && tp.seed >= 0 && tp.seed < TP_DEALS.length, "tripeaks: rooms deal a bank index on tripeaksRev 1");
  ok(ps.pokerSquaresRev === 2 && ps.seed > 0, "pokersquares: rooms deal a seed on pokerSquaresRev 2");
  ok(fh.fiveHandsRev === FH_REV && fh.seed > 0, `fivehands: rooms deal a seed on fiveHandsRev ${FH_REV}`);
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

/* 6. Rev 2 and Five Hands. */
{
  // Rev 1 exactly as on main.
  const legacy = JSON.parse(readFileSync(new URL("./fixtures/cards-rev1-legacy.json", import.meta.url), "utf8")) as { runs: { type: string; seed: number; label: string; raw: string; score: number; checksum: number; tick: number }[] };
  let same = 0;
  for (const run of legacy.runs) {
    const r = run.type === "freecell" ? replayFreecellRun(run.seed, run.raw, 1) : replayPokerSquaresRun(run.seed, run.raw, 1);
    const cp = run.type === "freecell" ? fcCheckpoint(r.state as never) : psCheckpoint(r.state as never);
    if (r.score === run.score && cp.checksum === run.checksum && r.state.tick === run.tick) same++;
    else failures.push(`${run.type} rev 1: seed ${run.seed} ${run.label} replays to ${r.score} (main ${run.score})`);
  }
  ok(same === legacy.runs.length && legacy.runs.length === 48, `rev 1: all ${legacy.runs.length} runs recorded on main replay to the same score and final state`);

  // Free Cell rev 2: every bank deal's par line still reaches 200.
  let all2 = true;
  for (let i = 0; i < FC_DEALS.length; i++) {
    const { raw } = freecellFlawless(i, 20, 2);
    const r = replayFreecellRun(i, raw, 2);
    if (r.score !== 200 || r.moves !== FC_DEALS[i]![1] || !r.finished || r.flagged) {
      all2 = false;
      failures.push(`freecell rev 2: bank deal ${i} replays to ${r.score} in ${r.moves} moves`);
    }
  }
  ok(all2, `freecell rev 2: all ${FC_DEALS.length} bank deals replay their par line to 200`);

  const g2 = freecellGameFor(2);
  const g1 = freecellGameFor(1);
  const ev = (t: number, k: number, a = 0, b = 0, c = 0): ArcadeInputEvent => ({ t, k, a, b, c, d: 0 });
  // Undo: the position before the last move, a move counted, the clock running; unlimited.
  const s0 = g2.init(0);
  const line = freecellFlawless(0, 20, 2);
  const firstMoves = decodeFreecellRun(line.raw).events.slice(0, 3);
  let s = s0;
  const positions = [fcPack(s0)];
  for (const e of firstMoves) {
    s = g2.step(s, { ...e, t: s.tick + 1 });
    positions.push(fcPack(s));
  }
  ok(s.moves === 3 && s.hist!.length === 3, "freecell rev 2: three moves stack three positions to undo");
  const u1 = g2.step(s, ev(s.tick + 1, FC_INPUT_UNDO));
  ok(JSON.stringify(fcPack(u1)) === JSON.stringify(positions[2]) && u1.moves === 4 && u1.undos === 1 && u1.tick === s.tick + 1, "freecell rev 2: Undo restores the last position, counts a move, and the clock runs on");
  let u = u1;
  for (let k = 0; k < 2; k++) u = g2.step(u, ev(u.tick + 1, FC_INPUT_UNDO));
  ok(JSON.stringify(fcPack(u)) === JSON.stringify(positions[0]) && u.moves === 6 && u.hist!.length === 0, "freecell rev 2: Undo is unlimited, back to the deal (each a move)");
  const u4 = g2.step(u, ev(u.tick + 1, FC_INPUT_UNDO));
  ok(u4.moves === 6 && u4.rejects === u.rejects, "freecell rev 2: Undo with nothing to undo does nothing (not a move, not a refusal)");
  // Reset: the deal back, a move, undoable.
  const rs = g2.step(s, ev(s.tick + 1, FC_INPUT_RESET));
  ok(JSON.stringify(fcPack(rs)) === JSON.stringify(positions[0]) && rs.moves === 4 && rs.resets === 1 && rs.tick === s.tick + 1, "freecell rev 2: Reset restores the deal, counts a move, and the clock runs on");
  const rsU = g2.step(rs, ev(rs.tick + 1, FC_INPUT_UNDO));
  ok(JSON.stringify(fcPack(rsU)) === JSON.stringify(positions[3]) && rsU.moves === 5, "freecell rev 2: Undo after Reset brings back the position reset from");
  const rs2 = g2.step(rs, ev(rs.tick + 1, FC_INPUT_RESET));
  ok(rs2.moves === rs.moves && rs2.resets === 1, "freecell rev 2: Reset on the deal itself does nothing");
  // Par counts the undos: a par line with an undo and its move made again finishes on par + 2.
  {
    const evs = decodeFreecellRun(line.raw).events;
    const withUndo: ArcadeInputEvent[] = [];
    let t = 0;
    evs.forEach((e, i) => {
      withUndo.push({ ...e, t: (t += 20) });
      if (i === 5) {
        withUndo.push(ev((t += 20), FC_INPUT_UNDO));
        withUndo.push({ ...e, t: (t += 20) });
      }
    });
    let st = g2.init(0);
    while (!g2.isOver(st)) st = g2.step(st, withUndo.find((x) => x.t === st.tick + 1) ?? null);
    const raw = encodeFreecellRun({ seed: 0, claimedScore: g2.score(st), events: withUndo, endTick: st.tick, checkpoints: [] });
    const r = replayFreecellRun(0, raw, 2);
    ok(r.finished && r.moves === FC_DEALS[0]![1] + 2 && r.undos === 1 && r.score === g2.score(st) && r.score < 200, `freecell rev 2: an undo and the move again finish on par + 2 through the server replay (${r.moves} moves, ${r.score})`);
    const r1 = replayFreecellRun(0, raw, 1);
    ok(r1.state.undos === undefined && r1.moves !== r.moves, "freecell rev 1: the same log's Undo is not an input (rev 1 has none)");
  }
  // The refused move's note: a two-card run onto a column with no free cell or empty column to carry it.
  {
    const kS = cardOf(0, 13), qH = cardOf(1, 12), jC = cardOf(3, 11), x = cardOf(2, 5);
    const base = { ...g2.init(3), home: [0, 0, 0, 0] };
    const full = { ...base, cells: [cardOf(2, 2), cardOf(2, 3), cardOf(2, 4), cardOf(2, 6)], cols: [[kS], [x, qH, jC], [cardOf(3, 2)], [cardOf(3, 3)], [cardOf(3, 4)], [cardOf(3, 5)], [cardOf(3, 6)], [cardOf(3, 7)]] };
    const two = g2.step(full, ev(full.tick + 1, FC_INPUT_MOVE, 1, 1, 0));
    ok(two.rejects === 1 && two.note === 1 && fcNoteText(two) === "Need a free cell to move 2 cards" && JSON.stringify(two.cols) === JSON.stringify(full.cols), `freecell rev 2: Q♥ J♣ onto K♠ with every cell full and no empty column is refused: "${fcNoteText(two)}"`);
    const roomy = g2.step({ ...full, cells: [NO_CARD, cardOf(2, 3), cardOf(2, 4), cardOf(2, 6)] }, ev(full.tick + 1, FC_INPUT_MOVE, 1, 1, 0));
    ok(roomy.rejects === 0 && roomy.cols[0]!.length === 3 && roomy.moves === full.moves + 1, "freecell rev 2: with one free cell the same two cards move");
    const three = { ...full, cols: [[kS], [qH, jC, cardOf(1, 10)], [cardOf(3, 2)], [cardOf(3, 3)], [cardOf(3, 4)], [cardOf(3, 5)], [cardOf(3, 6)], [cardOf(3, 7)]] };
    const refused = g2.step(three, ev(three.tick + 1, FC_INPUT_MOVE, 1, 0, 0));
    ok(refused.rejects === 1 && refused.note === 1 && refused.noteNeed === 3 && fcNoteText(refused) === `Need ${refused.noteCells} free cells to move 3 cards`, `freecell rev 2: a 3-card run with no free cell is refused with its note ("${fcNoteText(refused)}")`);
    const oneCell = { ...three, cells: [NO_CARD, cardOf(2, 3), cardOf(2, 4), cardOf(2, 6)] };
    const refused1 = g2.step(oneCell, ev(oneCell.tick + 1, FC_INPUT_TAP, 1, 0));
    ok(refused1.rejects === 1 && fcNoteText(refused1) === "Need a free cell to move 3 cards", `freecell rev 2: a tap's refusal names the free cell it needed ("${fcNoteText(refused1)}")`);
    const plain = g2.step(three, ev(three.tick + 1, FC_INPUT_MOVE, 2, 0, 0));
    ok(plain.rejects === 1 && !plain.note, "freecell rev 2: a move refused for its colours has no capacity note");
    const r1 = g1.step({ ...three, rev: 1, hist: undefined, start: undefined, note: undefined } as FcState, ev(three.tick + 1, FC_INPUT_MOVE, 1, 0, 0));
    ok(r1.rejects === 1 && r1.note === undefined, "freecell rev 1: no note");
  }

  // Full House rev 2: the core full at the elite median; rev 1 at 68.
  ok(PS_CORE_FULL === 68 && PS_CORE_FULL_V2 === 73, "pokersquares: rev 1 full at 68 (near-perfect median), rev 2 at 73 (elite median)");
  const grid = psTargetGrid(9, 2).grid;
  const at = (rev: number, total: number) => {
    const g = grid.map(() => NO_CARD);
    for (let i = 0; i < 25 && psTotals(g).total < total; i++) g[i] = grid[i]!;
    return { ...pokerSquaresGameFor(rev).init(9), grid: g, acted: 1 };
  };
  const mid = at(2, 70);
  const tot = psTotals(mid.grid).total;
  ok(pokerSquaresStdParts(mid)![0]!.points === Math.floor((160 * Math.min(tot, 73)) / 73) && pokerSquaresStdParts({ ...mid, rev: 1 })![0]!.points === Math.floor((160 * Math.min(tot, 68)) / 68), `pokersquares: ${tot} hand points pay ${pokerSquaresStdParts(mid)![0]!.points} on rev 2, ${pokerSquaresStdParts({ ...mid, rev: 1 })![0]!.points} on rev 1`);
  let ps2 = true;
  for (let n = 0; n < 200; n++) {
    const seed = (Math.imul(n + 1, 0x9e3779b1) >>> 1) + 1;
    const { raw } = pokerSquaresFlawless(seed, 20, 2);
    const r = replayPokerSquaresRun(seed, raw, 2);
    if (r.score !== 200 || r.made !== 10 || r.target < PS_CORE_FULL_V2) {
      ps2 = false;
      failures.push(`pokersquares rev 2: seed ${seed} replays to ${r.score}`);
    }
    if (n < 40 && JSON.stringify(psTargetGrid(seed, 2)) !== JSON.stringify(psTargetGrid(seed, 1))) failures.push(`pokersquares: seed ${seed} deals differently on rev 2`);
  }
  ok(ps2, "pokersquares rev 2: 200 seeds' target grids reach the elite full figure and replay to 200");

  // Five Hands: every dealt seed's witness to 200.
  const fhSeeds = [...Array.from({ length: 60 }, (_, i) => i), ...Array.from({ length: 200 }, (_, i) => 10000 + i), ...Array.from({ length: 200 }, (_, n) => (Math.imul(n + 1, 0x9e3779b1) >>> 1) + 1)];
  let fhAll = true;
  for (const seed of fhSeeds) {
    const d = fhDeal(seed);
    const { raw } = fiveHandsFlawless(seed);
    const r = replayFiveHandsRun(seed, raw);
    if (r.score !== 200 || r.made !== FH_ROWS || r.total !== d.target || d.target < FH_CORE_FULL || !r.finished || r.flagged) {
      fhAll = false;
      failures.push(`fivehands: seed ${seed}'s witness replays to ${r.score} (${r.total} hand points, ${r.made} hands)`);
    }
  }
  ok(fhAll, `fivehands: ${fhSeeds.length} seeds' witnesses (tuning 0–59, fresh 10000–10199, 200 room-style) replay to 200`);
  const d = fhDeal(17);
  ok(JSON.stringify(d) === JSON.stringify(fhDeal(17)) && JSON.stringify(fiveHandsGame.init(17)) === JSON.stringify(fiveHandsGame.init(17)), "fivehands: a seed deals the same deck and witness every time");
  ok(d.deck.length === FH_SEEN && new Set(d.deck).size === 45 && d.deck.every((c) => c >= 0 && c < 52), "fivehands: 45 different cards seen (5 dealt, 20 yours, 20 discards)");
  ok(d.witness.every((row, r) => row[0] === d.deck[r] && row.length === 5) && d.witnessTaps.length === FH_TURNS, "fivehands: the witness keeps each row's dealt card and places all 20");
  for (let g = 0; g < 4; g++) ok(new Set(d.witnessTaps.slice(g * 5, g * 5 + 5)).size === 5, `fivehands: the witness's round ${g + 1} puts one card in each row`);
  const f0 = fiveHandsGame.init(5);
  ok(f0.rows.every((row, r) => row.length === 1 && row[0] === f0.deck[r]) && fhOpenRows(f0.rows).length === 5 && fhDiscardsShown(f0) === 1, "fivehands: one card dealt to each row; every row open; the first discard face up");
  const f1 = fiveHandsGame.step(f0, { t: 1, k: FH_INPUT_PLACE, a: 2, b: 0, c: 0, d: 0 });
  ok(f1.rows[2]!.length === 2 && f1.rows[2]![1] === fhYours(f0.deck, 0) && f1.turn === 1 && fhDiscardsShown(f1) === 2 && fhDiscard(f1.deck, 0) === f0.deck[6], "fivehands: a tap places your card in that row's next slot; the next turn's discard turns up");
  ok(JSON.stringify(fhOpenRows(f1.rows)) === "[0,1,3,4]", "fivehands: the row just filled is greyed out until every row matches it");
  const f2 = fiveHandsGame.step(f1, { t: 2, k: FH_INPUT_PLACE, a: 2, b: 0, c: 0, d: 0 });
  ok(f2.rejects === 1 && f2.turn === 1 && JSON.stringify(f2.rows) === JSON.stringify(f1.rows), "fivehands: a tap on a greyed row is refused and changes nothing");
  let f = f1;
  for (const r of [0, 1, 3, 4]) f = fiveHandsGame.step(f, { t: f.tick + 1, k: FH_INPUT_PLACE, a: r, b: 0, c: 0, d: 0 });
  ok(f.turn === 5 && f.rows.every((row) => row.length === 2) && fhOpenRows(f.rows).length === 5, "fivehands: after turn 5 every row has 2 cards and all are open again");
  let full: FhState = f;
  while (full.turn < FH_TURNS) full = fiveHandsGame.step(full, { t: full.tick + 1, k: FH_INPUT_PLACE, a: fhOpenRows(full.rows)[0]!, b: 0, c: 0, d: 0 });
  ok(full.ended === 1 && full.rows.every((row) => row.length === 5) && fhDiscardsShown(full) === 20 && fiveHandsGame.score(full) >= 1, "fivehands: 20 turns fill every row to five, all 20 discards face up, the run ends");
  const buzz = (() => {
    let st = fiveHandsGame.step(f0, { t: 1, k: FH_INPUT_PLACE, a: 0, b: 0, c: 0, d: 0 });
    while (!fiveHandsGame.isOver(st)) st = fiveHandsGame.step(st, null);
    return st;
  })();
  const bt = fhTotals(buzz.rows);
  ok(buzz.ended === 2 && buzz.turn === 1 && fiveHandsGame.score(buzz) === Math.max(1, Math.floor((160 * Math.min(bt.total, FH_CORE_FULL)) / FH_CORE_FULL) + 8 * bt.made), "fivehands: at the buzzer the rows score as they stand (a played run at least 1)");
}

/* 7. The 1 Nov 2026 tuning: older stamps exactly as on main; Five Hands fiveHandsRev 2. */
{
  type LegacyRun = { type: string; rev: number; seed: number; label: string; raw: string; score: number; checksum: number; tick: number };
  const tuning = JSON.parse(readFileSync(new URL("./fixtures/tuning-nov1-legacy.json", import.meta.url), "utf8")) as { runs: LegacyRun[] };
  const mine = tuning.runs.filter((r) => r.type === "freecell" || r.type === "fivehands");
  let same = 0;
  for (const run of mine) {
    const r = run.type === "freecell" ? replayFreecellRun(run.seed, run.raw, run.rev) : replayFiveHandsRun(run.seed, run.raw, run.rev);
    const cp = run.type === "freecell" ? fcCheckpoint(r.state as never) : fhCheckpoint(r.state as never);
    if (r.score === run.score && cp.checksum === run.checksum && r.state.tick === run.tick) same++;
    else failures.push(`${run.type} rev ${run.rev}: seed ${run.seed} ${run.label} replays to ${r.score} (main ${run.score})`);
  }
  ok(same === mine.length && mine.length === 41, `nov 1: all ${mine.length} Free Cell rev-2 and Five Hands rev-1 runs recorded on main replay to the same score and final state`);

  // Free Cell rev 3: rev 2's play, the core full at FC_CORE_UNITS_V3; every bank deal's par line at 200; the auto moves
  // kept for the art on rev 3 only, outside the checksum.
  ok(FC_REV === 3 && FC_CORE_UNITS === 104 && FC_CORE_UNITS_V3 === 54 && FC_STD_SPEC.rev === 3 && FC_STD_SPEC.parts[0]!.of === FC_CORE_UNITS_V3, "freecell: rooms deal freecellRev 3, the core full at 54 units (revs 1–2: 104)");
  let all3 = true;
  for (let i = 0; i < FC_DEALS.length; i++) {
    const { raw } = freecellFlawless(i, 20, 3);
    const r = replayFreecellRun(i, raw, 3);
    if (r.score !== 200 || !r.finished || r.moves !== FC_DEALS[i]![1] || r.flagged) {
      all3 = false;
      failures.push(`freecell rev 3: bank deal ${i} replays to ${r.score} in ${r.moves} moves`);
    }
    // The same line on rev 2 and rev 3 ends in the same position (the same play).
    if (i < 40) {
      const r2 = replayFreecellRun(i, freecellFlawless(i, 20, 2).raw, 2);
      if (fcCheckpoint(r2.state).checksum !== fcCheckpoint(r.state).checksum || r2.state.tick !== r.state.tick) failures.push(`freecell rev 3: bank deal ${i} plays differently from rev 2`);
    }
  }
  ok(all3, `freecell rev 3: all ${FC_DEALS.length} bank deals replay their par line to 200 (and play as rev 2)`);
  const g3 = freecellGameFor(3);
  {
    // Part-way through deal 5's par line: the core on rev 3 against rev 2.
    const line = freecellFlawless(5, 20, 3);
    const half = (rev: number) => {
      const g = freecellGameFor(rev);
      let st = g.init(5);
      const raw = JSON.parse(JSON.stringify(decodeFreecellRun(line.raw).events)) as ArcadeInputEvent[];
      const until = raw[Math.floor(raw.length / 3)]!.t;
      const at = new Map(raw.map((e) => [e.t, e]));
      while (st.tick < until) st = g.step(st, at.get(st.tick + 1) ?? null);
      return st;
    };
    const h3 = half(3);
    const h2 = half(2);
    const u = fcCoreUnits(h3);
    ok(fcCheckpoint(h3).checksum === fcCheckpoint(h2).checksum && u === fcCoreUnits(h2), "freecell rev 3: the same moves reach the same position as rev 2");
    ok(freecellStdParts(h3)![0]!.points === Math.floor((140 * Math.min(u, 54)) / 54) && freecellStdParts(h2)![0]!.points === Math.floor((140 * Math.min(u, 104)) / 104), `freecell rev 3: ${u} units pay ${freecellStdParts(h3)![0]!.points} (rev 2: ${freecellStdParts(h2)![0]!.points})`);
  }
  {
    // The auto moves fly home: deal 0's first auto moves are recorded (card, pile, index) with their tick on rev 3 only.
    const s3 = g3.init(0);
    const s2 = freecellGameFor(2).init(0);
    ok(s2.fly === undefined && (s3.fly === undefined || s3.fly.length % 3 === 0), "freecell: rev 2 keeps no auto-move record; rev 3's is card, pile, index triples");
    let st = g3.init(0);
    let seen = 0;
    let homeOk = true;
    const ev = decodeFreecellRun(freecellFlawless(0, 20, 3).raw).events;
    const at = new Map(ev.map((e) => [e.t, e]));
    let prevAutos = st.autos;
    while (!g3.isOver(st)) {
      const before = st;
      st = g3.step(st, at.get(st.tick + 1) ?? null);
      if (st.autos > prevAutos && st.fly && st.flyTick === st.tick) {
        seen++;
        const flown = st.fly.length / 3;
        if (flown !== st.autos - prevAutos) homeOk = false;
        for (let k = 0; k < flown; k++) {
          // Each flown card is home now, was not before the move, and left a column or free cell.
          const card = st.fly[k * 3]!;
          const pile = st.fly[k * 3 + 1]!;
          const suit = suitOfCard(card);
          if (rankOfCard(card) > st.home[suit]! || rankOfCard(card) <= before.home[suit]! || pile < 0 || pile >= 12) homeOk = false;
        }
      }
      prevAutos = st.autos;
    }
    ok(seen > 0 && homeOk, `freecell rev 3: every auto move home is recorded for the art (${seen} moves with auto moves on deal 0's line)`);
    const plain = { ...st, fly: undefined, flyTick: undefined };
    ok(fcCheckpoint(plain).checksum === fcCheckpoint(st).checksum, "freecell rev 3: the auto-move record is outside the checksum");
  }

  // Five Hands rev 2: the steep table, hand points alone to 200, every witness at 200.
  ok(FH_REV === 2 && (generatePuzzle("fivehands") as { fiveHandsRev: number }).fiveHandsRev === 2, "fivehands: rooms deal fiveHandsRev 2");
  const fhSeeds = [...Array.from({ length: 60 }, (_, i) => i), ...Array.from({ length: 200 }, (_, i) => 10000 + i), ...Array.from({ length: 200 }, (_, n) => (Math.imul(n + 1, 0x9e3779b1) >>> 1) + 1)];
  const table: [number[], number][] = [
    [[cardOf(0, 1), cardOf(1, 5), cardOf(2, 9), cardOf(3, 11), cardOf(0, 13)], 0],
    [[cardOf(0, 4), cardOf(1, 4), cardOf(2, 9), cardOf(3, 11), cardOf(0, 13)], 5],
    [[cardOf(0, 4), cardOf(1, 4), cardOf(2, 9), cardOf(3, 9), cardOf(0, 13)], 10],
    [[cardOf(0, 4), cardOf(1, 4), cardOf(2, 4), cardOf(3, 9), cardOf(0, 13)], 20],
    [[cardOf(0, 4), cardOf(1, 5), cardOf(2, 6), cardOf(3, 7), cardOf(0, 8)], 25],
    [[cardOf(2, 2), cardOf(2, 5), cardOf(2, 9), cardOf(2, 11), cardOf(2, 13)], 35],
    [[cardOf(0, 4), cardOf(1, 4), cardOf(2, 4), cardOf(3, 9), cardOf(0, 9)], 50],
    [[cardOf(0, 4), cardOf(1, 4), cardOf(2, 4), cardOf(3, 4), cardOf(0, 9)], 60],
    [[cardOf(1, 9), cardOf(1, 10), cardOf(1, 11), cardOf(1, 12), cardOf(1, 13)], 75],
    [[cardOf(0, 4), cardOf(1, 4)], 5],
    [[cardOf(0, 4), cardOf(1, 5), cardOf(2, 6), cardOf(3, 7)], 0],
  ];
  for (const [row, want] of table) ok(fhRowHand(row, 2).points === want, `fivehands rev 2: ${row.join(",")} scores ${want} (got ${fhRowHand(row, 2).points}); rev 1 ${fhRowHand(row, 1).points}`);
  ok(FH_STD_SPEC.parts.length === 1 && FH_STD_SPEC.parts[0]!.max === 200 && FH_STD_SPEC.rev === 2, "fivehands rev 2: one part, hand points to 200 (no made-hands or speed part)");
  // Each deck is scored against its own exact best (fhDeckBest), stored with the deal (`fiveHandsBest`).
  let fh2 = true;
  for (const seed of fhSeeds) {
    const dd = fhDeal(seed, 2);
    const { raw } = fiveHandsFlawless(seed, 20, 2);
    const r = replayFiveHandsRun(seed, raw, 2);
    const stored = replayFiveHandsRun(seed, raw, 2, dd.target);
    if (r.score !== 200 || stored.score !== 200 || r.total !== dd.target || r.best !== dd.target || stored.best !== dd.target || dd.target < FH_BEST_MIN || !r.finished || r.flagged || fhTotals(dd.witness, 2).total !== dd.target || fhDeckBest(dd.deck).best !== dd.target) {
      fh2 = false;
      failures.push(`fivehands rev 2: seed ${seed}'s best arrangement replays to ${r.score} (${r.total} hand points, best ${dd.target})`);
    }
  }
  ok(fh2, `fivehands rev 2: ${fhSeeds.length} seeds' best arrangements reach the deck's best and replay to 200 through the server replay, with and without the stored best`);
  {
    // The best is the maximum: no hill climb of 32 restarts finds more on 40 decks, and no bot run, at any level, beats it.
    let climbs = 0;
    for (let seed = 0; seed < 40; seed++) {
      const deck = fhDeal(seed, 2).deck;
      const best = fhDeckBest(deck).best;
      let rng = (seed * 7919 + 13) | 0;
      const rnd = (n: number) => { rng = (Math.imul(rng, 1103515245) + 12345) | 0; return ((rng >>> 8) % n); };
      let top = 0;
      for (let r = 0; r < 32; r++) {
        const perm = Array.from({ length: 4 }, () => [0, 1, 2, 3, 4]);
        for (const p of perm) for (let i = 4; i > 0; i--) { const j = rnd(i + 1); [p[i], p[j]] = [p[j]!, p[i]!]; }
        const row = (k: number) => [deck[k]!, ...perm.map((p, g) => deck[5 + 2 * (g * 5 + p[k]!)]!)];
        const val = Array.from({ length: 5 }, (_, k) => fhRowHand(row(k), 2).points);
        for (let st = 0; st < 1500; st++) {
          const g = rnd(4); const a = rnd(5); let b = rnd(4); if (b >= a) b++;
          const p = perm[g]!; const t = p[a]!; p[a] = p[b]!; p[b] = t;
          const va = fhRowHand(row(a), 2).points; const vb = fhRowHand(row(b), 2).points;
          if (va + vb < val[a]! + val[b]!) { p[b] = p[a]!; p[a] = t; } else { val[a] = va; val[b] = vb; }
        }
        top = Math.max(top, val.reduce((x, y) => x + y, 0));
      }
      if (top <= best) climbs++;
      else failures.push(`fivehands rev 2: a climb found ${top} on seed ${seed}, above the best ${best}`);
    }
    ok(climbs === 40, `fivehands rev 2: no 32-restart hill climb beats fhDeckBest on 40 decks (${climbs} of 40)`);
    const { bot } = (await import("./arcade-skill-bands/bots/fivehands")) as { bot: (ctx: unknown) => { events?: ArcadeInputEvent[] } };
    const { Human } = await import("./arcade-skill-bands/human");
    let beaten = 0;
    let runs = 0;
    const g2b = fiveHandsGameFor(2);
    for (let seed = 100; seed < 130; seed++) {
      for (const level of ["average", "great", "near", "elite"] as const) {
        const out = bot({ game: g2b, seed, rev: 2, human: new Human("fivehands", seed, level), fixes: true });
        const byT = new Map((out.events ?? []).map((e) => [e.t, e]));
        let st = g2b.init(seed);
        while (!g2b.isOver(st)) st = g2b.step(st, byT.get(st.tick + 1) ?? null);
        runs++;
        if (fhTotals(st.rows, 2).total > st.best!) beaten++;
      }
    }
    ok(beaten === 0, `fivehands rev 2: no bot run beats its deck's best (${beaten} of ${runs})`);
  }
  ok(JSON.stringify(fhDeal(23, 2)) === JSON.stringify(fhDeal(23, 2)) && JSON.stringify(fiveHandsGameFor(2).init(23)) === JSON.stringify(fiveHandsGameFor(2).init(23)), "fivehands rev 2: a seed deals the same deck and best every time");
  // The deck is rev 1's first shuffle (rev 1 reshuffles when its own witness falls short, so a few seeds differ).
  let sameDeck = 0;
  for (let seed = 0; seed < 60; seed++) if (JSON.stringify(fhDeal(seed, 2).deck) === JSON.stringify(fhDeal(seed, 1).deck)) sameDeck++;
  ok(sameDeck >= 55, `fivehands rev 2: the decks are rev 1's shuffles (${sameDeck} of 60 seeds deal rev 1's deck)`);
  {
    const p = generatePuzzle("fivehands") as { seed: number; fiveHandsBest: number };
    ok(p.fiveHandsBest === fhDeal(p.seed, 2).target && p.fiveHandsBest >= FH_BEST_MIN, `fivehands rev 2: rooms store the deck's best with the deal (${p.fiveHandsBest})`);
  }
  const g2 = fiveHandsGameFor(2);
  let mid: FhState = g2.init(31);
  for (let t = 0; t < 12; t++) mid = g2.step(mid, { t: mid.tick + 1, k: FH_INPUT_PLACE, a: fhOpenRows(mid.rows)[0]!, b: 0, c: 0, d: 0 });
  const mt = fhTotals(mid.rows, 2).total;
  const mb = mid.best!;
  const mp = fiveHandsStdParts(mid)!;
  ok(mp.length === 1 && mb === fhDeal(31, 2).target && mp[0]!.points === Math.floor((200 * Math.min(mt, mb)) / mb) && g2.score(mid) === Math.max(1, mp[0]!.points), `fivehands rev 2: ${mt} hand points on a deck whose best is ${mb} pay floor(200 × ${mt} ÷ ${mb}) = ${mp[0]!.points}`);
  // A total past the stored best (a lower stored figure stands in) scores 200; anyone who plays at least 1.
  const over = fiveHandsGameFor(2, Math.max(1, mt - 5)).init(31);
  ok(fiveHandsStdParts({ ...over, rows: mid.rows, acted: 1 })![0]!.points === 200, "fivehands rev 2: beating the stored best scores 200 (capped)");
  ok(g2.score({ ...g2.init(31), acted: 1 }) >= 1, "fivehands rev 2: a played run scores at least 1");
  const rev1Parts = fiveHandsStdParts({ ...mid, rev: 1 })!;
  ok(rev1Parts.length === 2 && rev1Parts[0]!.max === 160, "fivehands: a rev-1 state keeps its two parts (hand points 160, made hands 40)");
}

/* 4. No input 0, played 1+. */
for (const [name, game] of [["freecell", freecellGame], ["tripeaks", tripeaksGame], ["pokersquares", pokerSquaresGame], ["freecell rev 2", freecellGameFor(2)], ["pokersquares rev 2", pokerSquaresGameFor(2)], ["fivehands", fiveHandsGame], ["fivehands rev 2", fiveHandsGameFor(2)], ["freecell rev 3", freecellGameFor(3)]] as const) {
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
console.log(`PASS cards-check: ${checks} checks — ${FC_DEALS.length} Free Cell deals (rev 1 and 2), ${TP_DEALS.length} Summit deals, 200 Full House seeds (rev 1 and 2) and 460 Five Hands seeds reach 200 through the server replay; 48 rev-1 runs as on main; undo, reset, rules, determinism, idle 0`);
