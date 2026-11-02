/**
 * cards-solitaire-check (1 Nov 2026; docs/arcade-standard/pyramid.md, golfsol.md, muggins.md): Pyramid, Golf Solitaire
 * and Muggins, three Cards & Board games born on the arcade scoring standard.
 *
 *  1. Every dealt seed reaches 200: every Golf Solitaire bank deal (all 300) replays its solver's line through the
 *     server's replay to a full clear with five runs of four and exactly 200, and the strong human line (look-ahead over
 *     the visible columns, the stock unknown) clears every one; Pyramid and Muggins deal any seed, and
 *     every tuning (0–59), fresh (10000–10199) and 200 room-style seeds' witnesses replay to exactly 200. Pyramid's
 *     solver (scripts/cards/pyramidSolver.ts) independently re-proves 24 of those deals clearable with ten pyramid pairs.
 *  2. Determinism: the same seed deals the same cards or tiles (and the same witness) every time; the deals are whole
 *     (52 different cards; 28 different tiles); rooms deal a bank index (Golf) or any seed (Pyramid, Muggins).
 *  3. Rules: Pyramid's pairs to 13, Kings alone, covered cards refused, the waste pairing, one pass through the stock,
 *     and no deal cleared by a quick player with no plan; Golf's one up or down with no wrapping, a draw ending the
 *     run, a run counted at four; Muggins' matching ends, the ends' sum (a double counting both halves), 5/10/15/20
 *     scoring, Draw refused while a tile fits, the end of the round.
 *  4. Undo and Reset on all three: Undo takes back exactly one action (score parts too), Reset goes back to the deal
 *     and is itself undoable, both refused as no-ops when there is nothing to take back; the clock runs on. Muggins: a
 *     draw is final (Undo stops at the latest draw, Reset goes back only to just after it).
 *  5. No input scores 0; a played run at least 1.
 *  6. `CHECKS_FULL=1`: the Golf Solitaire bank rebuilds byte for byte (scripts/golfsol-bank.ts --check).
 *
 *   bun scripts/cards-solitaire-check.ts
 */
import { spawnSync } from "node:child_process";
import { cardOf } from "../src/lib/arcade/cards/cards";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  PY_CARDS, PY_INPUT_RESET, PY_INPUT_TAP, PY_INPUT_UNDO, PY_PAIR_FULL, PY_STOCK_PILE, PY_WASTE_PILE, pyDeal, pyFree, pyGreedyClears, pyramidGame, pyramidScore, type PyState,
} from "../src/lib/arcade/cards/pyramid";
import { GS_CARDS, GS_INPUT_RESET, GS_INPUT_TAP, GS_INPUT_UNDO, GS_STOCK_PILE, golfSolGame, gsNext, type GsState } from "../src/lib/arcade/cards/golfSol";
import { GS_DEALS } from "../src/lib/arcade/cards/golfSolDeals.data";
import {
  MG_BIG_FULL, MG_CORE_FULL, MG_INPUT_DRAW, MG_INPUT_PLAY, MG_INPUT_RESET, MG_INPUT_UNDO, MG_TILE_PIPS, MG_TILES, mgDeal, mgEndSum, mgPack, mgPlays, mgScoreOf, mugginsGame, type MgState,
} from "../src/lib/arcade/cards/muggins";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { replayGolfSolRun, replayMugginsRun, replayPyramidRun } from "../src/lib/duel/cards";
import { golfSolFlawless, mugginsFlawless, pyramidFlawless } from "./cards/flawless";
import { pySolve } from "./cards/pyramidSolver";
import { gsHumanLine } from "./cards/golfSolHuman";

console.error = () => {};
let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const ev = (t: number, k: number, a = 0, b = 0): ArcadeInputEvent => ({ t, k, a, b, c: 0, d: 0 });

/** Tuning, fresh and room-style seeds (large, as arcadeSeed deals them). */
const SEEDS: number[] = [];
for (let s = 0; s < 60; s++) SEEDS.push(s);
for (let s = 10000; s < 10200; s++) SEEDS.push(s);
for (let i = 0, x = 0x2545f491; i < 200; i++) {
  x = (Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) + 0x6b43a9b5) | 0;
  SEEDS.push(x >>> 1);
}

/* 1. Every dealt seed reaches 200. */
{
  let all = true;
  for (let i = 0; i < GS_DEALS.length; i++) {
    const { raw } = golfSolFlawless(i);
    const r = replayGolfSolRun(i, raw);
    if (r.score !== 200 || !r.finished || r.runs < 5 || r.flagged) {
      all = false;
      failures.push(`golfsol: bank deal ${i}'s line replays to ${r.score} (${r.cleared} cleared, ${r.runs} runs)`);
    }
  }
  ok(all, `golfsol: all ${GS_DEALS.length} bank deals' lines replay to 200 through the server replay`);
  let human = 0;
  for (let i = 0; i < GS_DEALS.length; i++) if (gsHumanLine(golfSolGame.init(i)).cleared) human++;
  ok(human === GS_DEALS.length, `golfsol: the strong human line clears every bank deal (${human} of ${GS_DEALS.length})`);
}
{
  let all = true;
  for (const seed of SEEDS) {
    const { raw } = pyramidFlawless(seed);
    const r = replayPyramidRun(seed, raw);
    if (r.score !== 200 || !r.finished || r.ppPairs < PY_PAIR_FULL || r.flagged) {
      all = false;
      failures.push(`pyramid: seed ${seed}'s witness replays to ${r.score} (${r.removed} removed, ${r.ppPairs} pyramid pairs)`);
    }
  }
  ok(all, `pyramid: ${SEEDS.length} seeds' witnesses replay to 200 through the server replay`);
  let solved = 0;
  const sample = SEEDS.filter((_, i) => i % 19 === 0).slice(0, 24);
  for (const seed of sample) if (pySolve(pyramidGame.init(seed), PY_PAIR_FULL, 600_000)) solved++;
  ok(solved === sample.length, `pyramid: the solver re-proves ${sample.length} sampled deals clearable with ten pyramid pairs (${solved})`);
}
{
  let all = true;
  for (const seed of SEEDS) {
    const d = mgDeal(seed);
    const { raw } = mugginsFlawless(seed);
    const r = replayMugginsRun(seed, raw);
    if (r.score !== 200 || !r.finished || r.points < MG_CORE_FULL || r.bigs < MG_BIG_FULL || r.points !== d.witnessPoints || r.flagged) {
      all = false;
      failures.push(`muggins: seed ${seed}'s witness replays to ${r.score} (${r.points} points, ${r.bigs} big plays)`);
    }
  }
  ok(all, `muggins: ${SEEDS.length} seeds' witnesses replay to 200 through the server replay`);
}

/* 2. Determinism and whole deals. */
{
  ok(JSON.stringify(pyDeal(21)) === JSON.stringify(pyDeal(21)) && JSON.stringify(pyramidGame.init(21)) === JSON.stringify(pyramidGame.init(21)), "pyramid: a seed deals the same cards and witness every time");
  const p = pyramidGame.init(33);
  ok(p.tab.length === 28 && p.pile.length === 24 && new Set([...p.tab, ...p.pile]).size === 52, "pyramid: 28 pyramid cards and 24 in the stock, all 52 different");
  const g = golfSolGame.init(7);
  ok(JSON.stringify(g) === JSON.stringify(golfSolGame.init(7)) && g.tab.length === 35 && g.stock.length === 16 && new Set([...g.tab, ...g.stock]).size === 51, "golfsol: a bank deal is the same every time; 35 tableau cards and 16 in the stock, all different");
  ok(g.top === g.stock[0] && g.stockPos === 1, "golfsol: the stock's first card starts the foundation");
  const m = mugginsGame.init(44);
  const d = mgDeal(44);
  ok(JSON.stringify(d) === JSON.stringify(mgDeal(44)) && JSON.stringify(m) === JSON.stringify(mugginsGame.init(44)), "muggins: a seed deals the same tiles and witness every time");
  ok(new Set([d.start, ...d.hand, ...d.pile]).size === MG_TILES && d.hand.length === 7 && d.pile.length === 20, "muggins: a starting tile, a hand of 7 and a pile of 20, all 28 tiles");
  const py = generatePuzzle("pyramid");
  const gs = generatePuzzle("golfsol");
  const mg = generatePuzzle("muggins");
  ok(py.type === "pyramid" && py.pyramidRev === 1 && gs.type === "golfsol" && gs.golfSolRev === 1 && gs.seed >= 0 && gs.seed < GS_DEALS.length && mg.type === "muggins" && mg.mugginsRev === 1, "rooms deal pyramidRev 1 (any seed), golfSolRev 1 (a bank index) and mugginsRev 1 (any seed)");
}

/* 3. Rules. */
{
  // Pyramid: a deal laid out by hand.
  const base = pyramidGame.init(3);
  const tab = base.tab.slice();
  // Bottom row (21–27): Q, A, K, 6, 7, 5, 2.
  [cardOf(0, 12), cardOf(1, 1), cardOf(2, 13), cardOf(3, 6), cardOf(0, 7), cardOf(1, 5), cardOf(2, 2)].forEach((c, i) => (tab[21 + i] = c));
  const pile = [cardOf(3, 8), cardOf(0, 11), cardOf(1, 9)];
  const used = new Set([...tab.slice(21), ...pile]);
  let filler = 0;
  for (let i = 0; i < 21; i++) {
    while (used.has(filler)) filler++;
    tab[i] = filler++;
  }
  let s: PyState = { ...base, tab, pile, pos: 0, pass: 1, start: [] };
  const step = (st: PyState, k: number, a = 0) => pyramidGame.step(st, ev(st.tick + 1, k, a));
  ok(!pyFree(s, 14) && pyFree(s, 21), "pyramid: the bottom row is free, the row above covered");
  let t = step(s, PY_INPUT_TAP, 23);
  ok(t.gone[23] === 1 && t.kings === 1 && t.removed === 1 && t.pairs === 0, "pyramid: a King goes alone with one tap");
  t = step(step(t, PY_INPUT_TAP, 21), PY_INPUT_TAP, 22);
  ok(t.gone[21] === 1 && t.gone[22] === 1 && t.ppPairs === 1 && t.removed === 3, "pyramid: Q + A (13) is removed as a pyramid pair");
  const bad = step(step(t, PY_INPUT_TAP, 24), PY_INPUT_TAP, 26);
  ok(bad.rejects === t.rejects + 1 && bad.removed === t.removed && bad.sel === 26, "pyramid: 6 + 5 is refused (not 13); the new card becomes the selection");
  const cov = step(t, PY_INPUT_TAP, 3);
  ok(cov.rejects === t.rejects + 1 && cov.sel === -1, "pyramid: a covered card is refused");
  const sum13 = step(step(t, PY_INPUT_TAP, 24), PY_INPUT_TAP, 25);
  ok(sum13.ppPairs === 2 && sum13.removed === 5, "pyramid: 6 + 7 is removed");
  let w = step(t, PY_INPUT_TAP, PY_STOCK_PILE);
  ok(w.pos === 1 && w.draws === 1, "pyramid: a stock tap turns a card onto the waste");
  w = step(step(w, PY_INPUT_TAP, 26), PY_INPUT_TAP, PY_WASTE_PILE);
  ok(w.gone[26] === 1 && w.pile.length === 2 && w.pos === 0 && w.ppPairs === t.ppPairs && w.pairs === t.pairs + 1, "pyramid: 5 + the waste's 8 is removed (a pair, not a pyramid pair)");
  // One pass: the stock runs out and is never turned back over.
  let q = s;
  for (let i = 0; i < 3; i++) q = step(q, PY_INPUT_TAP, PY_STOCK_PILE);
  ok(q.pos === 3 && q.pass === 1, "pyramid: the stock turns its three cards onto the waste");
  const r4 = step(q, PY_INPUT_TAP, PY_STOCK_PILE);
  ok(r4.rejects === q.rejects + 1 && r4.pass === 1 && r4.pos === 3, "pyramid: one pass: the empty stock can't be turned back over");
  // Every deal needs a plan: the quick players with no plan never clear it, and the witness clears it with ten pairs.
  let quick = 0;
  for (const seed of SEEDS.slice(0, 60)) if (pyGreedyClears(pyDeal(seed), 0) || pyGreedyClears(pyDeal(seed), 1) || pyGreedyClears(pyDeal(seed), 3)) quick++;
  ok(quick === 0, `pyramid: no dealt deal is cleared by a quick player with no plan (first pair, most uncovered, best two-removal line) (${quick} of 60)`);

  // Golf: one up or down, no wrapping.
  const K = cardOf(0, 13);
  const A = cardOf(1, 1);
  const Q = cardOf(2, 12);
  ok(gsNext(Q, K) && gsNext(K, Q) && !gsNext(A, K) && !gsNext(K, A) && !gsNext(Q, Q), "golfsol: one higher or lower, no wrapping between King and Ace");
  let g: GsState = golfSolGame.init(0);
  const gstep = (st: GsState, k: number, a = 0) => golfSolGame.step(st, ev(st.tick + 1, k, a));
  const plays: number[] = [];
  let probe = g;
  for (let c = 0; c < 7; c++) {
    const card = probe.tab[c * 5 + 4]!;
    if (gsNext(card, probe.top)) plays.push(c);
  }
  for (let c = 0; c < 7; c++) {
    if (plays.includes(c)) continue;
    const r = gstep(g, GS_INPUT_TAP, c);
    ok(r.rejects === g.rejects + 1 && r.cleared === 0, `golfsol: column ${c}'s card, not a step from the foundation, is refused`);
    break;
  }
  const d1 = gstep(g, GS_INPUT_TAP, GS_STOCK_PILE);
  ok(d1.stockPos === 2 && d1.top === g.stock[1] && d1.run === 0, "golfsol: a draw turns the next stock card onto the foundation and ends the run");
  // A run counted at five: replay bank deal 0's line and watch the counter.
  probe = golfSolFlawless(0).state;
  ok(probe.runs >= 5 && probe.cleared === GS_CARDS, "golfsol: the bank line makes five runs of four");
  g = { ...g, run: 3, runs: 0 };
  let fifth = g;
  for (let c = 0; c < 7; c++) {
    const r = gstep(g, GS_INPUT_TAP, c);
    if (r.cleared === 1) {
      fifth = r;
      break;
    }
  }
  ok(fifth !== g && fifth.run === 4 && fifth.runs === 1, "golfsol: the fourth card in a row without drawing counts a run");
  const fifthOn = fifth !== g ? (() => {
    for (let c = 0; c < 7; c++) {
      const r = gstep(fifth, GS_INPUT_TAP, c);
      if (r.cleared === fifth.cleared + 1) return r;
    }
    return null;
  })() : null;
  if (fifthOn) ok(fifthOn.run === 5 && fifthOn.runs === 1, "golfsol: a longer run still counts once");

  // Muggins: the ends' sum and scoring.
  const tileOf = (a: number, b: number) => MG_TILE_PIPS.findIndex((p) => p[0] === Math.min(a, b) && p[1] === Math.max(a, b));
  ok(mgEndSum({ line: [3 * 7 + 3] }) === 6 && mgEndSum({ line: [3 * 7 + 3, 3 * 7 + 2] }) === 8 && mgEndSum({ line: [1 * 7 + 4, 4 * 7 + 4] }) === 9, "muggins: the ends' sum; a lone tile its pips; a double at an end counts both halves");
  ok(mgScoreOf(5) === 5 && mgScoreOf(10) === 10 && mgScoreOf(15) === 15 && mgScoreOf(20) === 20 && mgScoreOf(12) === 0 && mgScoreOf(0) === 0, "muggins: 5, 10, 15 and 20 score; other sums don't");
  const m0: MgState = { ...mugginsGame.init(9), line: [5 * 7 + 3], hand: [tileOf(3, 5), tileOf(5, 5), tileOf(0, 1)], pile: [tileOf(6, 6), tileOf(2, 4)], pilePos: 0, start: [] };
  const mstep = (st: MgState, k: number, a = 0, b = 0) => mugginsGame.step(st, ev(st.tick + 1, k, a, b));
  const p1 = mstep(m0, MG_INPUT_PLAY, tileOf(5, 5), 0);
  ok(p1.line[0] === 5 * 7 + 5 && mgEndSum(p1) === 13 && p1.points === 0, "muggins: a double laid on the left end (5-5 then 5-3): ends 10 + 3, no score");
  const p2 = mstep(p1, MG_INPUT_PLAY, tileOf(3, 5), 1);
  ok(p2.line[p2.line.length - 1] === 3 * 7 + 5 && mgEndSum(p2) === 15 && p2.points === 15 && p2.bigs === 1, "muggins: 3-5 on the right makes 10 + 5 = 15: scored, a big play");
  const refusedDraw = mstep(m0, MG_INPUT_DRAW);
  ok(refusedDraw.rejects === m0.rejects + 1 && refusedDraw.pilePos === 0, "muggins: Draw is refused while a tile fits");
  const badPlay = mstep(m0, MG_INPUT_PLAY, tileOf(0, 1), 0);
  ok(badPlay.rejects === m0.rejects + 1 && badPlay.hand.length === 3, "muggins: a tile that matches neither end is refused");
  const stuck: MgState = { ...m0, hand: [tileOf(0, 1)] };
  const drew = mstep(stuck, MG_INPUT_DRAW);
  ok(drew.hand.length === 2 && drew.pilePos === 1 && drew.hand[1] === tileOf(6, 6), "muggins: with nothing to play, Draw takes the pile's next tile");
  const emptyPile = mstep({ ...stuck, pilePos: 2 }, MG_INPUT_DRAW);
  ok(emptyPile.ended === 3, "muggins: pile empty and nothing to play ends the round");
  const last = mstep({ ...m0, hand: [tileOf(3, 5)] }, MG_INPUT_PLAY, tileOf(3, 5), 1);
  ok(last.ended === 1 && last.finishTick === last.tick, "muggins: the hand emptied ends the round (cleared)");
  ok(mgPlays(m0).length >= 2, "muggins: plays are listed per tile and end");
}

/* 4. Undo and Reset. */
{
  const strip = (st: { tick: number }) => JSON.stringify({ ...st, tick: 0, hist: 0, undos: 0, resets: 0, lastTick: 0, lastA: 0, lastB: 0, lastPlay: 0, lastTile: 0, lastEnd: 0, lastScore: 0, acted: 0, sel: 0, rejects: 0, plays: 0, draws: 0 });
  const py0 = pyramidGame.init(5);
  const taps = pyDeal(5).witness;
  let p = py0;
  for (let i = 0; i < 6; i++) p = pyramidGame.step(p, ev(p.tick + 1, PY_INPUT_TAP, taps[i]!));
  let before = p;
  // Take one action that changes the board (skip selections).
  let i = 6;
  let after = p;
  while (strip(after) === strip(before)) after = pyramidGame.step(after, ev(after.tick + 1, PY_INPUT_TAP, taps[i++]!));
  before = (() => {
    let b = p;
    for (let j = 6; j < i - 1; j++) b = pyramidGame.step(b, ev(b.tick + 1, PY_INPUT_TAP, taps[j]!));
    return b;
  })();
  const undone = pyramidGame.step(after, ev(after.tick + 1, PY_INPUT_UNDO));
  ok(strip(undone) === strip(before) && undone.undos === 1 && undone.tick === after.tick + 1 && pyramidScore(undone) === pyramidScore({ ...before, acted: 1 }), "pyramid: Undo takes back exactly the last action, its parts too; the clock runs on");
  const reset = pyramidGame.step(after, ev(after.tick + 1, PY_INPUT_RESET));
  ok(strip(reset) === strip(py0) && reset.resets === 1, "pyramid: Reset goes back to the deal");
  const back = pyramidGame.step(reset, ev(reset.tick + 1, PY_INPUT_UNDO));
  ok(strip(back) === strip(after), "pyramid: a Reset can be undone");
  const nothing = pyramidGame.step(py0, ev(1, PY_INPUT_UNDO));
  ok(nothing.undos === 0 && pyramidGame.step(py0, ev(1, PY_INPUT_RESET)).resets === 0 && nothing.acted === 1, "pyramid: Undo and Reset with nothing to take back do nothing (but count as played)");

  const g0 = golfSolGame.init(4);
  let g = g0;
  const line = (() => {
    const out: number[] = [];
    let probe = g0;
    for (let k = 0; k < 6; k++) {
      for (let c = 0; c <= GS_STOCK_PILE; c++) {
        const r = golfSolGame.step(probe, ev(probe.tick + 1, GS_INPUT_TAP, c));
        if (r.rejects === probe.rejects) {
          out.push(c);
          probe = r;
          break;
        }
      }
    }
    return out;
  })();
  for (const c of line) g = golfSolGame.step(g, ev(g.tick + 1, GS_INPUT_TAP, c));
  const gPrev = (() => {
    let b = g0;
    for (const c of line.slice(0, -1)) b = golfSolGame.step(b, ev(b.tick + 1, GS_INPUT_TAP, c));
    return b;
  })();
  const gu = golfSolGame.step(g, ev(g.tick + 1, GS_INPUT_UNDO));
  ok(strip(gu) === strip(gPrev) && gu.undos === 1, "golfsol: Undo takes back exactly the last play or draw (run and runs too)");
  const gr = golfSolGame.step(g, ev(g.tick + 1, GS_INPUT_RESET));
  ok(strip(gr) === strip(g0) && strip(golfSolGame.step(gr, ev(gr.tick + 1, GS_INPUT_UNDO))) === strip(g), "golfsol: Reset goes back to the deal and can be undone");

  const tileOf = (a: number, b: number) => MG_TILE_PIPS.findIndex((p) => p[0] === Math.min(a, b) && p[1] === Math.max(a, b));
  const base: MgState = { ...mugginsGame.init(6), line: [5 * 7 + 3], hand: [tileOf(3, 5), tileOf(5, 5), tileOf(0, 1), tileOf(2, 6)], pile: [tileOf(3, 4), tileOf(6, 6)], pilePos: 0 };
  const m0: MgState = { ...base, start: mgPack(base) };
  const play = (st: MgState, a: number, b: number) => mugginsGame.step(st, ev(st.tick + 1, MG_INPUT_PLAY, a, b));
  const m1 = play(m0, tileOf(5, 5), 0);
  const m2 = play(m1, tileOf(3, 5), 1);
  const mu = mugginsGame.step(m2, ev(m2.tick + 1, MG_INPUT_UNDO));
  ok(strip(mu) === strip(m1) && mu.points === m1.points && mu.undos === 1, "muggins: Undo takes back exactly the last play, its points too");
  const mr = mugginsGame.step(m2, ev(m2.tick + 1, MG_INPUT_RESET));
  ok(strip(mr) === strip(m0) && mr.points === 0 && strip(mugginsGame.step(mr, ev(mr.tick + 1, MG_INPUT_UNDO))) === strip(m2), "muggins: before any draw, Reset goes back to the deal and can be undone");
  // A draw is final: stuck (ends 10 and 5 after 5-5 then 3-5 … here a hand that can't play), draw, then Undo and Reset.
  const stuck: MgState = { ...m0, hand: [tileOf(0, 1)], hist: [mgPack(m0)] };
  const drew = mugginsGame.step(stuck, ev(stuck.tick + 1, MG_INPUT_DRAW));
  ok(drew.pilePos === 1 && drew.hand.length === 2 && drew.hist.length === 0, "muggins: a draw clears the Undo history");
  const noUndo = mugginsGame.step(drew, ev(drew.tick + 1, MG_INPUT_UNDO));
  ok(noUndo.pilePos === 1 && noUndo.hand.length === 2 && noUndo.undos === 0, "muggins: Undo can't take back a draw");
  const played = play(drew, tileOf(3, 4), 1);
  ok(played.plays === drew.plays + 1 && played.hand.length === 1, "muggins: the drawn tile is played after the draw");
  const undoAfter = mugginsGame.step(played, ev(played.tick + 1, MG_INPUT_UNDO));
  ok(strip(undoAfter) === strip(drew), "muggins: a play after the draw can be undone, back to just after the draw");
  const undoTwice = mugginsGame.step(undoAfter, ev(undoAfter.tick + 1, MG_INPUT_UNDO));
  ok(strip(undoTwice) === strip(drew) && undoTwice.undos === undoAfter.undos, "muggins: Undo never goes back past the latest draw");
  const resetAfter = mugginsGame.step(played, ev(played.tick + 1, MG_INPUT_RESET));
  ok(strip(resetAfter) === strip(drew) && resetAfter.pilePos === 1, "muggins: after a draw, Reset goes back to just after it (the drawn tile stays drawn)");
}

/* 5. No input 0, played 1+. */
for (const [name, game, first] of [
  ["pyramid", pyramidGame, ev(1, PY_INPUT_TAP, 0)],
  ["golfsol", golfSolGame, ev(1, GS_INPUT_UNDO)],
  ["muggins", mugginsGame, ev(1, MG_INPUT_UNDO)],
] as const) {
  const g = game as unknown as { init: (s: number) => { tick: number }; step: (s: unknown, i: ArcadeInputEvent | null) => { tick: number }; isOver: (s: unknown) => boolean; score: (s: unknown) => number };
  let s = g.init(11);
  while (!g.isOver(s)) s = g.step(s, null);
  ok(g.score(s) === 0, `${name}: a run with no input scores 0`);
  let p = g.step(g.init(11), first);
  while (!g.isOver(p)) p = g.step(p, null);
  ok(g.score(p) >= 1, `${name}: a run that played scores at least 1`);
}

/* 6. Full depth: the Golf bank rebuilds byte for byte. */
if (process.env.CHECKS_FULL === "1") {
  const r = spawnSync("bun", ["scripts/golfsol-bank.ts", "--check"], { encoding: "utf8" });
  ok(r.status === 0, "golfsol-bank: rebuilds byte for byte");
}

if (failures.length) {
  console.log(`FAIL cards-solitaire-check: ${failures.length} of ${checks} checks failed`);
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS cards-solitaire-check: ${checks} checks — ${GS_DEALS.length} Golf Solitaire deals, ${SEEDS.length} Pyramid and ${SEEDS.length} Muggins seeds reach 200 through the server replay; Pyramid's solver re-proof; rules, undo, reset, determinism, idle 0`);
