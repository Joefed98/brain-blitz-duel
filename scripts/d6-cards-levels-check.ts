/**
 * D6's Cards & Board levels (23 Nov 2026; the polish plan's difficulty spec and Joe's ladder test), proved on the real
 * sims and the server's own grade:
 *
 *  1. The rules as data: each level's lever and figures, the registry (gameLevels.ts) mirroring the sims, Hard and
 *     Expert with no hints (the button gone and a hint input counting nothing).
 *  2. The deals: a level deal stamps the new revision (Five Hands fiveHandsRev 4, Free Cell freecellRev 6, Summit
 *     tripeaksRev 4), its clock and a deal from the level's proved list; under the d6PreLevels pin, the levels before.
 *  3. 200 reachable at a human pace (HUMAN_LIMITS' 0.25 s to react and 0.15 s to move: an input every 24 ticks) on EVERY
 *     level deal through gradeAnswer: Five Hands' witnesses (the deck file rebuilds byte for byte from them), Free Cell's
 *     stored solutions on every bank deal, Summit's par line on every deal a level deals.
 *  4. The level rules in play: Summit's shorter stock and its clock, Free Cell's cells and cards.
 *
 *   bun scripts/d6-cards-levels-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { inputAt, recordInput, type ArcadeGame, type ArcadeInputEvent, type InputRange } from "../src/lib/arcade/engine";
import { GAME_LEVELS } from "../src/lib/levels/gameLevels";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleRunMs } from "../src/lib/duel/catalogue";
import { withSeededRandom } from "../src/lib/duel/random";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import * as FC from "../src/lib/arcade/cards/freecell";
import { FC_DEALS_EASY } from "../src/lib/arcade/cards/freecellDealsLevels.data";
import { FC_DEALS_EXPERT_V6, FC_DEALS_HARD_V6 } from "../src/lib/arcade/cards/freecellDealsLevelsV6.data";
import * as TP from "../src/lib/arcade/cards/tripeaks";
import { TP_STOCK_PARS } from "../src/lib/arcade/cards/tripeaksStockPar.data";
import * as FH from "../src/lib/arcade/cards/fiveHands";
import { encodeFiveHandsRun, encodeFreecellRun, encodeTripeaksRun } from "../src/lib/duel/cards";
import { FH_LEVEL_DECKS } from "../src/lib/duel/fiveHandsLevelDecks.server";
import { pinPreD6Levels } from "../src/lib/duel/d6Normal";
import * as MJ from "../src/lib/arcade/mahjong";
import { encodeMahjongRun } from "../src/lib/duel/mahjong";
import { MAHJONG_EXPERT_DEALS } from "../src/lib/duel/mahjongExpertDeals.server";
import { tripeaksParSolution } from "./cards/solutions";

console.error = () => {};
let failed = 0;
let passed = 0;
function check(ok: boolean, label: string): void {
  if (ok) passed++;
  else {
    failed++;
    console.log(`  FAIL ${label}`);
  }
}

type L = "easy" | "hard" | "expert";
const LEVELS: L[] = ["easy", "hard", "expert"];
type Ev = { k: number; a: number; b: number; c: number; d: number };
const mv = (k: number, a = 0, b = 0, c = 0): Ev => ({ k, a, b, c, d: 0 });
/** HUMAN_LIMITS' 0.25 s to react and 0.15 s to move, in ticks: a witness's gap between inputs. */
const GAP = 24;

/** Plays inputs one every `gap` ticks from tick `gap`, recording them as the phone does; the raw run and final state. */
function play(game: ArcadeGame<any, any>, seed: number, inputs: readonly Ev[], gap: number, checkpoint: (s: any) => unknown, encode: (run: any) => string): { raw: string; state: any } {
  let state = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: unknown[] = [];
  let k = 0;
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    if (k < inputs.length && t >= gap * (k + 1)) recordInput(events, { ...inputs[k++]!, t }, (game.inputRanges ?? []) as readonly InputRange[]);
    state = game.step(state, inputAt(events, t));
    if (state.tick % 300 === 0) checkpoints.push(checkpoint(state));
  }
  return { raw: encode({ seed, claimedScore: game.score(state), events, endTick: state.tick, checkpoints }), state };
}
function run(game: ArcadeGame<any, any>, seed: number, inputs: readonly Ev[]): any {
  let s = game.init(seed);
  let t = 0;
  for (const e of inputs) s = game.step(s, { ...e, t: ++t });
  return s;
}
const dealAt = (type: PuzzleType, level: L | "normal", n: number): any => withSeededRandom(n * 7919 + 13, () => generatePuzzle(type, { bankSeed: n, level }));
const reg = GAME_LEVELS as unknown as Record<string, { levels: Record<string, { settings: Record<string, unknown> }> }>;

/* ---------------------------------------------------------------- 1. Rules */
console.log("1. The rules: the lever and figures, the registry, no hints on Hard and Expert");
{
  // Five Hands: seconds a card, 200 at the level's hand points.
  check(LEVELS.map((l) => `${FH.FH_LEVEL_RULES_V4[l].seconds}/${FH.FH_LEVEL_RULES_V4[l].full}`).join(" ") === "90/94 42/100 30/104", "fivehands: 90 s / 94, 42 s / 100, 30 s / 104 hand points");
  check(FH.FH_LEVEL_RULES_V4.easy.tableRev === FH.FH_REV_FLAT && FH.FH_LEVEL_RULES_V4.hard.tableRev === FH.FH_TABLE_HARD && FH.FH_LEVEL_RULES_V4.expert.tableRev === FH.FH_TABLE_EXPERT, "fivehands: today's table on Easy, the Hard and Expert tables above it");
  // Free Cell: free cells 5 / 4 (Normal) / 3 / 2.
  check(LEVELS.map((l) => `${FC.FC_LEVEL_RULES_V6[l].cells}x${4 * FC.FC_LEVEL_RULES_V6[l].topRank}`).join(" ") === "5x32 3x40 2x52", "freecell: 5 cells on 32 cards, 3 on 40, 2 on 52");
  check(LEVELS.map((l) => `${FC.FC_LEVEL_RULES_V6[l].parFullEighths}/${FC.FC_LEVEL_RULES_V6[l].parZeroQuarters}/${FC.FC_LEVEL_RULES_V6[l].speedFullS}`).join(" ") === "9/8/60 9/6/33 10/6/52", "freecell: par and speed figures per level");
  check(FC.FC_LEVEL_RULES_V6.expert.undoLimit === 3 && !FC.FC_LEVEL_RULES_V6.hard.undoFree && FC.FC_LEVEL_RULES_V6.easy.undoFree, "freecell: Easy's undo free, Hard's a move, Expert 3");
  // Summit: seconds on the clock.
  check(LEVELS.map((l) => `${TP.TP_LEVEL_RULES_V4[l].seconds}/${TP.TP_LEVEL_RULES_V4[l].stockTurns}/${TP.TP_LEVEL_RULES_V4[l].maxPar}`).join(" ") === "90/23/12 45/18/13 32/14/11", "tripeaks: 90 s whole stock par ≤ 12, 45 s 18 turns par ≤ 13, 32 s 14 turns par ≤ 11");
  check(LEVELS.map((l) => `${TP.TP_LEVEL_RULES_V4[l].runFull}/${TP.TP_LEVEL_RULES_V4[l].parSlack}/${TP.TP_LEVEL_RULES_V4[l].speedFullS}`).join(" ") === "5/10/30 6/8/31 6/5/27", "tripeaks: run, stock par and speed figures per level");
  check(TP.TP_LEVEL_RULES_V4.easy.glow && !TP.TP_LEVEL_RULES_V4.hard.glow && !TP.TP_LEVEL_RULES_V4.expert.glow && LEVELS.every((l) => TP.TP_LEVEL_RULES_V4[l].wrap), "tripeaks: the glow on Easy only, the wrap kept everywhere");
  // No hints on Hard and Expert; Easy's free.
  for (const l of LEVELS) {
    const none = l !== "easy";
    check((FH.FH_LEVEL_RULES_V4[l].hintLimit === 0) === none && (FC.FC_LEVEL_RULES_V6[l].hintLimit === 0) === none && (TP.TP_LEVEL_RULES_V4[l].hintLimit === 0) === none, `${l}: ${none ? "no hints" : "free hints"} in all three`);
    const fh = FH.fiveHandsLevelGame(l, FH.FH_REV_128).init(5);
    const fc = FC.freecellLevelGame(l, FC.FC_REV_PAR98).init(0);
    const tp = TP.tripeaksLevelGame(l, TP.TP_REV_EASE).init(0);
    check(FH.fhHintButtonOn(fh) !== none && FC.fcHintButtonOn(fc) !== none && TP.tpHintButtonOn(tp) !== none, `${l}: the Hint button ${none ? "gone" : "shown"} in all three`);
    if (none) {
      check(run(FH.fiveHandsLevelGame(l, FH.FH_REV_128), 5, [mv(FH.FH_INPUT_HINT)]).hints === 0, `fivehands ${l}: a hint input counts nothing`);
      check(run(FC.freecellLevelGame(l, FC.FC_REV_PAR98), 0, [mv(FC.FC_INPUT_HINT)]).hints === 0, `freecell ${l}: a hint input counts nothing`);
      check(run(TP.tripeaksLevelGame(l, TP.TP_REV_EASE), 0, [mv(TP.TP_INPUT_HINT)]).hints === 0, `tripeaks ${l}: a hint input counts nothing`);
    }
    // The registry mirrors the sims.
    const fhS = reg.fivehands!.levels[l]!.settings;
    check(fhS.fullAt === FH.FH_LEVEL_RULES_V4[l].full && fhS.seconds === FH.FH_LEVEL_RULES_V4[l].seconds, `fivehands ${l}: the registry's figure and clock match the sim`);
    const fcS = reg.freecell!.levels[l]!.settings;
    check(fcS.cells === FC.FC_LEVEL_RULES_V6[l].cells && fcS.cards === 4 * FC.FC_LEVEL_RULES_V6[l].topRank && fcS.speedFullS === FC.FC_LEVEL_RULES_V6[l].speedFullS, `freecell ${l}: the registry's cells, cards and speed match the sim`);
    const tpS = reg.tripeaks!.levels[l]!.settings;
    check(tpS.seconds === TP.TP_LEVEL_RULES_V4[l].seconds && tpS.stockTurns === TP.TP_LEVEL_RULES_V4[l].stockTurns && tpS.speedFullS === TP.TP_LEVEL_RULES_V4[l].speedFullS && tpS.glow === TP.TP_LEVEL_RULES_V4[l].glow, `tripeaks ${l}: the registry's clock, stock, speed and glow match the sim`);
  }
}

/* ---------------------------------------------------------------- 2. Deals */
console.log("2. The deals: the new stamps, the clocks, the proved lists; d6PreLevels deals the levels before");
{
  for (const l of LEVELS) {
    for (let n = 0; n < 6; n++) {
      const fh = dealAt("fivehands", l, n);
      check(fh.fiveHandsRev === FH.FH_REV_128 && fh.level === l && FH_LEVEL_DECKS[l].includes(fh.seed) && puzzleRunMs(fh) === FH.FH_LEVEL_RULES_V4[l].seconds * 1000, `fivehands ${l} ${n}: fiveHandsRev 4, a proved deck, ${FH.FH_LEVEL_RULES_V4[l].seconds} s`);
      const fc = dealAt("freecell", l, n);
      check(fc.freecellRev === FC.FC_REV_PAR98 && fc.level === l && fc.seed >= 0 && fc.seed < FC.fcLevelBank(l, FC.FC_REV_PAR98).length, `freecell ${l} ${n}: freecellRev 6, an index into the level's D6 bank`);
      const tp = dealAt("tripeaks", l, n);
      check(tp.tripeaksRev === TP.TP_REV_EASE && tp.level === l && tp.seed >= 0 && tp.seed < TP.tpV4Deals(l).length && puzzleRunMs(tp) === TP.TP_LEVEL_RULES_V4[l].seconds! * 1000, `tripeaks ${l} ${n}: tripeaksRev 4, a deal within par ${TP.TP_LEVEL_RULES_V4[l].maxPar}, ${TP.TP_LEVEL_RULES_V4[l].seconds} s`);
    }
  }
  for (const n of [0, 1, 2]) {
    check(!("level" in dealAt("fivehands", "normal", n)) && dealAt("fivehands", "normal", n).fiveHandsRev === FH.FH_REV, `fivehands normal ${n}: no level, fiveHandsRev ${FH.FH_REV}`);
    check(!("level" in dealAt("freecell", "normal", n)) && dealAt("freecell", "normal", n).freecellRev === FC.FC_REV, `freecell normal ${n}: no level, freecellRev ${FC.FC_REV}`);
    check(!("level" in dealAt("tripeaks", "normal", n)) && dealAt("tripeaks", "normal", n).tripeaksRev === TP.TP_REV, `tripeaks normal ${n}: no level, tripeaksRev ${TP.TP_REV}`);
  }
  const was = pinPreD6Levels(true);
  try {
    for (const l of LEVELS) {
      check(dealAt("fivehands", l, 0).fiveHandsRev === FH.FH_REV_FLAT && dealAt("freecell", l, 0).freecellRev === FC.FC_REV_SHARE && dealAt("tripeaks", l, 0).tripeaksRev === TP.TP_REV_SHARE, `d6PreLevels ${l}: the levels before (fiveHandsRev 3, freecellRev 5, tripeaksRev 3)`);
    }
  } finally {
    pinPreD6Levels(was);
  }
}

/* ---------------------------------------------------------------- 3. 200 at a human pace on every deal */
console.log("3. 200 at a human pace on every level deal, through the grade");
{
  // Five Hands: the deck builder's own check replays every witness and rebuilds the deck file.
  const r = Bun.spawnSync(["bun", "scripts/fivehands-level-decks.ts", "--check"], { stdout: "pipe", stderr: "pipe" });
  const out = r.stdout.toString().trim().split("\n").pop() ?? "";
  check(r.exitCode === 0 && out.startsWith("PASS"), `fivehands: every level deck's best line scores 200 at a human pace and the deck file rebuilds (${out})`);
  // Free Cell: every bank deal's stored solution.
  const easyLines = (JSON.parse(readFileSync(new URL("./fixtures/freecell-solutions-levels.json", import.meta.url), "utf8")) as Record<L, string[]>).easy;
  const v6 = JSON.parse(readFileSync(new URL("./fixtures/freecell-solutions-levels-v6.json", import.meta.url), "utf8")) as Record<"hard" | "expert", string[]>;
  const lines: Record<L, string[]> = { easy: easyLines, hard: v6.hard, expert: v6.expert };
  const banks: Record<L, readonly (readonly [number, number])[]> = { easy: FC_DEALS_EASY, hard: FC_DEALS_HARD_V6, expert: FC_DEALS_EXPERT_V6 };
  for (const l of LEVELS) {
    const bank = banks[l];
    check(bank.length === 120 && lines[l].length === bank.length, `freecell ${l}: 120 deals, a stored solution each`);
    let at200 = 0;
    let parsOk = 0;
    for (let i = 0; i < bank.length; i++) {
      const line = lines[l][i]!.split(",").filter(Boolean).map((m) => m.split(":").map(Number) as [number, number, number]);
      if (line.length === bank[i]![1] && (l !== "expert" || line.length <= 50)) parsOk++;
      const p = { type: "freecell", seed: i, freecellRev: FC.FC_REV_PAR98, level: l } as unknown as PuzzleData;
      const w = play(FC.freecellLevelGame(l, FC.FC_REV_PAR98), i, line.map((m) => mv(FC.FC_INPUT_MOVE, m[0], m[1], m[2])), GAP, FC.fcCheckpoint, encodeFreecellRun);
      if (gradeAnswer(p, w.raw, 0).score === 200) at200++;
    }
    check(parsOk === bank.length, `freecell ${l}: every deal's par is its stored solution's length${l === "expert" ? " (50 or fewer)" : ""}`);
    check(at200 === bank.length, `freecell ${l}: every deal's solution at a human pace scores 200 through the grade (${at200} of ${bank.length})`);
  }
  // Summit: every deal a level deals, its par line.
  for (const l of LEVELS) {
    const list = TP.tpV4Deals(l);
    check(list.length > 0 && list.every((i) => TP_STOCK_PARS[i]! <= TP.TP_LEVEL_RULES_V4[l].maxPar!), `tripeaks ${l}: ${list.length} deals, every stock par ${TP.TP_LEVEL_RULES_V4[l].maxPar} or less`);
    let at200 = 0;
    for (let n = 0; n < list.length; n++) {
      const line = tripeaksParSolution(list[n]!);
      const p = { type: "tripeaks", seed: n, tripeaksRev: TP.TP_REV_EASE, level: l, timeLimitMs: TP.TP_LEVEL_RULES_V4[l].seconds! * 1000 + 3000 } as unknown as PuzzleData;
      const w = play(TP.tripeaksLevelGame(l, TP.TP_REV_EASE), n, line.map((t) => mv(TP.TP_INPUT_TAP, t)), GAP, TP.tpCheckpoint, encodeTripeaksRun);
      if (gradeAnswer(p, w.raw, 0).score === 200) at200++;
    }
    check(at200 === list.length, `tripeaks ${l}: every deal's par line at a human pace scores 200 through the grade (${at200} of ${list.length})`);
  }
}

/* ---------------------------------------------------------------- 4. The rules in play */
console.log("4. The rules in play: Summit's stock and clock, Free Cell's cells");
{
  for (const l of LEVELS) {
    const r = TP.TP_LEVEL_RULES_V4[l];
    const g = TP.tripeaksLevelGame(l, TP.TP_REV_EASE);
    const s0 = g.init(3);
    check(TP.TP_STOCK - s0.stockPos === r.stockTurns, `tripeaks ${l}: ${r.stockTurns} stock turns to start`);
    const turned = run(g, 3, Array.from({ length: 30 }, () => mv(TP.TP_INPUT_TAP, TP.TP_STOCK_PILE)));
    check(turned.turns === r.stockTurns, `tripeaks ${l}: the stock turns ${r.stockTurns} times and no more (${turned.turns})`);
    check(g.runTicks === r.seconds! * 60, `tripeaks ${l}: the run is ${r.seconds} s`);
    const idle = run(g, 3, Array.from({ length: r.seconds! * 60 + 5 }, () => mv(0)));
    check(idle.ended === 2 && idle.tick === r.seconds! * 60, `tripeaks ${l}: the clock ends the run at ${r.seconds} s (tick ${idle.tick})`);
    const fcs = FC.freecellLevelGame(l, FC.FC_REV_PAR98).init(0);
    check(fcs.cells.length === FC.FC_LEVEL_RULES_V6[l].cells && FC.fcCardsOf(fcs) === 4 * FC.FC_LEVEL_RULES_V6[l].topRank, `freecell ${l}: ${FC.FC_LEVEL_RULES_V6[l].cells} free cells, ${4 * FC.FC_LEVEL_RULES_V6[l].topRank} cards`);
  }
  // The stock cut keeps the order: Hard's turned cards are the whole stock's first 18.
  {
    const list = TP.tpV4Deals("hard");
    const i = list[0]!;
    const cut = TP.tripeaksLevelGame("hard", TP.TP_REV_EASE).init(0);
    const whole = TP.tripeaksGameFor(TP.TP_REV).init(i);
    const seenCut: number[] = [cut.top];
    let s = cut;
    for (let k = 0; k < 18; k++) {
      s = TP.tpApply(s, TP.TP_STOCK_PILE)!;
      seenCut.push(s.top);
    }
    const seenWhole: number[] = [whole.top];
    let w = whole;
    for (let k = 0; k < 18; k++) {
      w = TP.tpApply(w, TP.TP_STOCK_PILE)!;
      seenWhole.push(w.top);
    }
    check(seenCut.join(",") === seenWhole.join(",") && cut.tab.join(",") === whole.tab.join(","), "tripeaks hard: the cut stock turns the same cards in the same order as the whole stock");
  }
}

/* ---------------------------------------------------------------- 5. Mahjong */
console.log("5. Mahjong mahjongRev 3: tiles in the stack, the layouts on the same world, 200 at a human pace");
{
  check(LEVELS.map((l) => `${MJ.MAHJONG_LEVEL_RULES_V3[l].layout.tiles}/${MJ.MAHJONG_LEVEL_RULES_V3[l].layout.layers}/${MJ.MAHJONG_LEVEL_RULES_V3[l].quads}`).join(" ") === "48/2/2 104/4/18 136/4/34", "mahjong: 48 tiles in 2 layers, 104 in 4, 136 in 4 (all 34 faces four times)");
  check(LEVELS.map((l) => `${MJ.MAHJONG_LEVEL_RULES_V3[l].shuffleCost}/${MJ.MAHJONG_LEVEL_RULES_V3[l].speedFullS}/${MJ.MAHJONG_LEVEL_RULES_V3[l].seconds ?? 120}`).join(" ") === "2/70/120 10/80/120 15/98/110", "mahjong: shuffle 2 / 10 / 15, speed by 70 / 80 / 98 s, Expert's clock 110 s");
  for (const l of LEVELS) {
    const r = MJ.MAHJONG_LEVEL_RULES_V3[l];
    const lay = r.layout;
    check(lay.pairs === 2 * r.quads + (lay.pairs - 2 * r.quads) && lay.pairs - 2 * r.quads >= 0 && r.quads + (lay.pairs - 2 * r.quads) <= MJ.MAHJONG_KINDS, `mahjong ${l}: the faces fit (${r.quads} four times, ${lay.pairs - 2 * r.quads} twice, of ${MJ.MAHJONG_KINDS})`);
    check(MJ.mahjongLayoutOf(new Array(lay.tiles).fill(0)) === lay, `mahjong ${l}: the layout is told by its length (${lay.tiles})`);
    let inside = true;
    let minW = Infinity;
    for (let i = 0; i < lay.tiles; i++) {
      const b = MJ.mahjongSlotRect(i, lay);
      if (b.x < 0 || b.y < 0 || b.x + b.w > MJ.MAHJONG_WORLD_W || b.y + b.h > MJ.MAHJONG_WORLD_H) inside = false;
      minW = Math.min(minW, b.w);
    }
    check(inside, `mahjong ${l}: every tile inside the ${MJ.MAHJONG_WORLD_W} × ${MJ.MAHJONG_WORLD_H} world`);
    // The world fills a 375 px phone's width (the play screen, edge to edge): a tile's width there.
    check((minW * 375) / MJ.MAHJONG_WORLD_W >= 36, `mahjong ${l}: tiles at least 36 px wide on a 375 px phone (${((minW * 375) / MJ.MAHJONG_WORLD_W).toFixed(1)} px)`);
    const reg2 = reg.mahjong!.levels[l]!.settings;
    check(reg2.tiles === lay.tiles && reg2.quads === r.quads && reg2.shuffleCost === r.shuffleCost && reg2.speedFullS === r.speedFullS, `mahjong ${l}: the registry mirrors the sim`);
    check((r.hintLimit === 0) === (l !== "easy") && MJ.mahjongLevelGame(l, MJ.MAHJONG_REV_LEVELS).init(5).face.length === lay.tiles, `mahjong ${l}: ${l === "easy" ? "free hints" : "no hints"}, the board dealt on its layout`);
    if (l !== "easy") check(run(MJ.mahjongLevelGame(l, MJ.MAHJONG_REV_LEVELS), 5, [mv(MJ.MAHJONG_INPUT_BUTTON, MJ.MAHJONG_BUTTON_HINT)]).hints === 0, `mahjong ${l}: a hint input counts nothing`);
    for (let n = 0; n < 6; n++) {
      const p = dealAt("mahjong", l, n);
      check(p.mahjongRev === MJ.MAHJONG_REV_LEVELS && p.level === l && (l !== "expert" || (MAHJONG_EXPERT_DEALS.includes(p.seed) && puzzleRunMs(p) === 110_000)), `mahjong ${l} ${n}: mahjongRev 3${l === "expert" ? ", a listed deal, 110 s" : ""}`);
    }
  }
  check(dealAt("mahjong", "normal", 0).mahjongRev === MJ.MAHJONG_REV_DEALT && !("level" in dealAt("mahjong", "normal", 0)), "mahjong normal: mahjongRev 2, no level");
  const was = pinPreD6Levels(true);
  try {
    check(dealAt("mahjong", "hard", 0).mahjongRev === MJ.MAHJONG_REV_DEALT, "d6PreLevels: mahjong's levels before (mahjongRev 2)");
  } finally {
    pinPreD6Levels(was);
  }
  // 200 at a human pace: Expert's list re-proved by its builder; Easy and Hard deals' build orders through the grade.
  const r = Bun.spawnSync(["bun", "scripts/mahjong-expert-deals.ts", "--check"], { stdout: "pipe", stderr: "pipe" });
  const out = r.stdout.toString().trim().split("\n").pop() ?? "";
  check(r.exitCode === 0 && out.startsWith("PASS"), `mahjong expert: every listed deal re-proved at 200 and the list rebuilds (${out})`);
  for (const l of ["easy", "hard"] as const) {
    let at200 = 0;
    for (let n = 0; n < 24; n++) {
      const p = dealAt("mahjong", l, n);
      const order = MJ.mahjongBuild(p.seed, l, MJ.MAHJONG_REV_LEVELS).order.flatMap(([a, b]) => [mv(MJ.MAHJONG_INPUT_TAP, a), mv(MJ.MAHJONG_INPUT_TAP, b)]);
      const w = play(MJ.mahjongLevelGame(l, MJ.MAHJONG_REV_LEVELS), p.seed, order, GAP, MJ.mahjongCheckpoint, encodeMahjongRun);
      if (gradeAnswer(p, w.raw, 0).score === 200) at200++;
    }
    check(at200 === 24, `mahjong ${l}: 24 dealt boards' build orders at a human pace score 200 through the grade (${at200})`);
  }
}

console.log(failed ? `FAIL d6-cards-levels-check: ${failed} failed, ${passed} passed` : `PASS d6-cards-levels-check: ${passed} checks`);
process.exit(failed ? 1 : 0);
