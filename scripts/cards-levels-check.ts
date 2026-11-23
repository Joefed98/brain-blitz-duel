/**
 * The Cards & Board levels (the overhaul's stage 3, 15 Nov 2026; docs/design/difficulty/README.md and each game's page in
 * docs/arcade-standard/, "Levels"): Free Cell, Mahjong Solitaire, Summit, Five Hands and Thirteen at Easy, Hard and
 * Expert. Normal is today's game and is proved elsewhere (deal-identity-check, cards-check, cards-board-check,
 * cards-solitaire-check, cards-nov7-check); here only that a Normal deal never reaches the level code.
 *
 *  1. The registry mirrors each sim's rules; every level's clock is at most 120 s.
 *  2. Every deal at every level is proved: Free Cell's level banks replay their stored solutions to all home in par
 *     moves; Summit's Easy deals are the bank's par ≤ 12 deals and Expert's bank replays its stored no-wrap lines to a
 *     clear with a run of ten at its stock par; Mahjong's and Thirteen's built deals clear by their own witnesses (on
 *     the level's layout, Kings and filters); Five Hands' decks are today's.
 *  3. 200 is reachable at every level: each game's proved line, played at a human pace and encoded as the phone sends
 *     it, scores 200 through the server's grade (Five Hands: its best arrangement on decks that allow it).
 *  4. Hints: counted by the sim, free on Easy, costing on Hard, one on Expert; the hint's move is legal; Normal's games
 *     take no hint input. Undo: Free Cell's Easy undo is free, Expert's stops at 3; Summit's Easy has 3 and a dead end
 *     waits while one is left.
 *  5. Dead ends are explained at every level (the games' own words).
 *
 *   bun scripts/cards-levels-check.ts [--seeds=n]   (Mahjong and Thirteen built deals per level; 60 by default)
 */
import { inputAt, recordInput, type ArcadeGame, type ArcadeInputEvent, type InputRange } from "../src/lib/arcade/engine";
import { GAME_LEVELS, levelsOf } from "../src/lib/levels/gameLevels";
import { MAX_ROUND_CLOCK_MS, type Level } from "../src/lib/levels/levels";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleRunMs, puzzleTimeLimitMs } from "../src/lib/duel/catalogue";
import { withSeededRandom } from "../src/lib/duel/random";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import * as FC from "../src/lib/arcade/cards/freecell";
import { FC_DEALS_EASY, FC_DEALS_EXPERT, FC_DEALS_HARD } from "../src/lib/arcade/cards/freecellDealsLevels.data";
import { fcHintMove } from "../src/lib/arcade/cards/freecellSolver";
import * as TP from "../src/lib/arcade/cards/tripeaks";
import { TP_DEALS } from "../src/lib/arcade/cards/tripeaksDeals.data";
import { TP_STOCK_PARS } from "../src/lib/arcade/cards/tripeaksStockPar.data";
import { TP_EXPERT_DEALS, TP_HARD_NOWRAP_DEALS } from "../src/lib/arcade/cards/tripeaksExpert.data";
import { tpHintMove } from "../src/lib/arcade/cards/tripeaksSolver";
import * as PY from "../src/lib/arcade/cards/pyramid";
import * as FH from "../src/lib/arcade/cards/fiveHands";
import * as MJ from "../src/lib/arcade/mahjong";
import { encodeFiveHandsRun, encodeFreecellRun, encodePyramidRun, encodeTripeaksRun } from "../src/lib/duel/cards";
import { encodeMahjongRun } from "../src/lib/duel/mahjong";
import { tripeaksParSolution } from "./cards/solutions";
import { fhBest } from "./cards/fiveHandsBest";
import { readFileSync } from "node:fs";
import { pinPreD6Levels, pinPreFiveHands128, pinPreFreecellPar98, pinPreTripeaksEase } from "../src/lib/duel/d6Normal";

const SEEDS = Number(process.argv.find((a) => a.startsWith("--seeds="))?.slice(8) ?? (process.env.CHECKS_FULL ? 300 : 60));
const LEVELS = ["easy", "hard", "expert"] as const;
type L = (typeof LEVELS)[number];
const GAMES: PuzzleType[] = ["freecell", "mahjong", "tripeaks", "fivehands", "pyramid"];

// Changed with Joe's approval, 23 Nov 2026 (D6's levels): this check was written for the levels before D6, so it deals them (d6PreLevels, and the Normal stamps before D6's); d6-cards-levels-check proves D6's levels.
pinPreD6Levels(true);
pinPreFreecellPar98(true);
pinPreTripeaksEase(true);
pinPreFiveHands128(true);

let passed = 0;
const failures: string[] = [];
function check(ok: boolean, what: string): void {
  if (ok) passed++;
  else {
    failures.push(what);
    console.log(`  FAIL ${what}`);
  }
}

type Ev = Omit<ArcadeInputEvent, "t">;
type AnyGame = ArcadeGame<any, ArcadeInputEvent | null>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Plays inputs one every `gap` ticks to the run's end and encodes the run as the phone sends it. */
function play(game: AnyGame, seed: number, inputs: readonly Ev[], gap: number, checkpoint: (s: never) => unknown, encode: (run: never) => string): { raw: string; state: any } { // eslint-disable-line @typescript-eslint/no-explicit-any
  let state = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: unknown[] = [];
  let k = 0;
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    if (k < inputs.length && t >= gap * (k + 1)) recordInput(events, { ...inputs[k++]!, t }, (game.inputRanges ?? []) as readonly InputRange[]);
    state = game.step(state, inputAt(events, t));
    if (state.tick % 300 === 0) checkpoints.push(checkpoint(state as never));
  }
  return { raw: encode({ seed, claimedScore: game.score(state), events, endTick: state.tick, checkpoints } as never), state };
}

/** Steps a game through inputs on consecutive ticks (no clock pressure): the final state. */
function run(game: AnyGame, seed: number, inputs: readonly Ev[]): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  let s = game.init(seed);
  let t = 0;
  for (const e of inputs) s = game.step(s, { ...e, t: ++t });
  return s;
}

function dealAt(type: PuzzleType, level: Level, n: number): PuzzleData {
  return withSeededRandom(n * 7919 + 13, () => generatePuzzle(type, { bankSeed: n, level }));
}

const mv = (k: number, a = 0, b = 0, c = 0): Ev => ({ k, a, b, c, d: 0 });
const fcLines = JSON.parse(readFileSync(new URL("./fixtures/freecell-solutions-levels.json", import.meta.url), "utf8")) as Record<L, string[]>;
const fcLine = (level: L, i: number) => fcLines[level][i]!.split(",").filter(Boolean).map((m) => m.split(":").map(Number) as [number, number, number]);
const tpxAll = JSON.parse(readFileSync(new URL("./fixtures/tripeaks-expert-lines.json", import.meta.url), "utf8")) as { expert: string[]; hard: string[] };
const toTaps = (s: string) => s.split(",").filter(Boolean).map(Number);
const tpxLines = tpxAll.expert.map(toTaps);
const tphLines = tpxAll.hard.map(toTaps);

/* ---------------------------------------------------------------- 1. Registry and clocks */
console.log("1. The registry mirrors the sims; every level's clock is at most 120 s");
{
  for (const g of GAMES) check(levelsOf(g).join(",") === "easy,normal,hard,expert", `${g}: offers Easy, Normal, Hard and Expert`);
  const reg = GAME_LEVELS as Record<string, { levels: Record<string, { settings: Record<string, unknown> }> }>;
  for (const l of LEVELS) {
    // Changed with Joe's approval, 23 Nov 2026 (D6's levels): the registry mirrors the levels dealt today (D6's tables).
    const fc = FC.FC_LEVEL_RULES_V6[l];
    const fs = reg.freecell!.levels[l]!.settings;
    check(fs.cards === 4 * fc.topRank && fs.cells === fc.cells, `freecell ${l}: registry cards and cells match the sim (${fs.cards}, ${fs.cells})`);
    const mj = MJ.MAHJONG_LEVEL_RULES_V3[l];
    const ms = reg.mahjong!.levels[l]!.settings;
    check(ms.tiles === mj.layout.tiles && ms.layers === mj.layout.layers && ms.quads === mj.quads && ms.shuffleCost === mj.shuffleCost, `mahjong ${l}: registry tiles, layers, faces dealt four times and shuffle cost match the sim`);
    const tp = TP.TP_LEVEL_RULES_V4[l];
    const ts = reg.tripeaks!.levels[l]!.settings;
    const fhTable = reg.fivehands!.levels[l]!.settings;
    if (l !== "easy") check(fhTable.pair === FH.fhRowHand([0, 13, 1, 2, 3], FH.FH_LEVEL_RULES[l].tableRev).points, `fivehands ${l}: registry pair value matches the level's table`);
    check(ts.glow === tp.glow && ts.wrap === tp.wrap && ts.undos === tp.undoLimit && ts.speedFullS === tp.speedFullS, `tripeaks ${l}: registry glow, wrap, undos and speed match the sim`);
    const fh = FH.FH_LEVEL_RULES_V4[l];
    const hs = reg.fivehands!.levels[l]!.settings;
    check(hs.fullAt === fh.full && hs.seconds === fh.seconds && hs.preview === fh.preview, `fivehands ${l}: registry figure, clock and preview match the sim`);
    const py = PY.PY_LEVEL_RULES[l];
    const ps = reg.pyramid!.levels[l]!.settings;
    check(ps.passes === py.passes && ps.glow === py.glow, `pyramid ${l}: registry passes and glow match the sim`);
  }
  // Joe's numbers (the brief).
  check(MJ.MAHJONG_LEVEL_RULES.easy.layout.tiles === 56 && MJ.MAHJONG_LEVEL_RULES.easy.layout.layers === 3 && MJ.MAHJONG_LEVEL_RULES.hard.layout.tiles === 72 && MJ.MAHJONG_LEVEL_RULES.expert.layout.tiles === 88 && MJ.MAHJONG_LEVEL_RULES.expert.layout.layers === 5, "mahjong: 56 tiles in 3 layers, 72, 88 in 5 layers");
  check([MJ.MAHJONG_LEVEL_RULES.easy, MJ.MAHJONG_LEVEL_RULES.hard, MJ.MAHJONG_LEVEL_RULES.expert].map((r) => `${r.quads}/${r.shuffleCost}`).join(" ") === "2/2 10/8 12/10", "mahjong: look-alike faces and shuffle costs 2/2, 10/8, 12/10");
  check([FH.FH_LEVEL_RULES.easy, FH.FH_LEVEL_RULES.hard, FH.FH_LEVEL_RULES.expert].map((r) => `${r.num / r.den}×${r.seconds}`).join(" ") === "1.6×75 1.4×50 1.3×45", "fivehands: ×1.6 75 s, ×1.4 50 s, ×1.3 45 s");
  check(TP.TP_LEVEL_RULES.easy.speedFullS === 25 && TP.TP_LEVEL_RULES.hard.speedFullS === 20 && TP.TP_LEVEL_RULES.expert.speedFullS === 16 && !TP.TP_LEVEL_RULES.expert.wrap && !TP.TP_LEVEL_RULES.hard.wrap && TP.TP_LEVEL_RULES.easy.undoLimit === 3, "tripeaks: speed by 25 / 20 / 16 s, no wrap on Hard and Expert, Easy 3 undos");
  check(FH.fhRowHand([0, 13, 1, 2, 3], FH.FH_TABLE_HARD).points === 10 && FH.fhRowHand([0, 13, 1, 14, 3], FH.FH_TABLE_EXPERT).points === 15 && FH.fhRowHand([0, 13, 1, 2, 3], FH.FH_REV).points === 15, "fivehands: a pair is 10 on Hard and Expert (15 on Normal), two pair 15 on Expert");
  check(PY.PY_LEVEL_RULES.easy.passes === 3 && PY.PY_LEVEL_RULES.hard.passes === 1 && PY.PY_LEVEL_RULES.expert.passes === 1 && PY.PY_LEVEL_RULES.expert.kingsSpan === 1 && PY.PY_LEVEL_RULES.expert.kingsMin === 3, "pyramid: 3 / 1 / 1 passes, Expert exactly 3 Kings");
  check(PY.PY_LEVEL_RULES.hard.filters.includes(4) && PY.PY_LEVEL_RULES.expert.filters.includes(5) && PY.PY_LEVEL_RULES.easy.filters.length === 0, "pyramid: Hard's deals beat a three-removal look-ahead, Expert's a four-removal one, Easy any proved deal");
  check(FC.FC_LEVEL_RULES.easy.cells === 5 && FC.FC_LEVEL_RULES.easy.topRank === 8 && FC.FC_LEVEL_RULES.expert.cells === 3 && FC.FC_LEVEL_RULES.expert.undoLimit === 3, "freecell: Easy 32 cards 5 cells, Expert 3 cells 3 undos");
  for (const g of GAMES) {
    for (const l of [...LEVELS, "normal" as const]) {
      const p = dealAt(g, l, 1);
      const clock = puzzleTimeLimitMs(p);
      const runMs = puzzleRunMs(p) ?? clock;
      check(runMs <= MAX_ROUND_CLOCK_MS, `${g} ${l}: the run is ${runMs / 1000} s, at most 120 s`);
      check((l === "normal") === !("level" in (p as object)), `${g} ${l}: ${l === "normal" ? "a Normal deal carries no level" : "the deal stamps its level"}`);
    }
  }
  for (const l of LEVELS) {
    const p = dealAt("fivehands", l, 2);
    check(puzzleRunMs(p) === FH.FH_LEVEL_RULES[l].seconds * 1000 && FH.fiveHandsLevelGame(l).runTicks === FH.FH_LEVEL_RULES[l].seconds * 60, `fivehands ${l}: the run and the round clock are ${FH.FH_LEVEL_RULES[l].seconds} s`);
  }
  check(puzzleRunMs(dealAt("fivehands", "normal", 2)) === 60_000, "fivehands normal: the run stays 60 s");
}

/* ---------------------------------------------------------------- 1b. The words */
console.log("1b. Each level's help and intro words match its rules");
{
  const r = Bun.spawnSync(["bun", "scripts/cards-level-text.ts", "--check"], { stdout: "pipe", stderr: "pipe" });
  check(r.exitCode === 0, `the levels' words are up to date with their rules (${new TextDecoder().decode(r.stdout).trim()})`);
  const { CARD_LEVEL_TEXT } = await import("../src/lib/levels/cardLevelText.data");
  for (const g of GAMES) for (const l of LEVELS) {
    const t = CARD_LEVEL_TEXT[g]![l]!;
    check(t.intro.length <= 90 && /Up to 200\.$/.test(t.intro) && !/core|full at|units|features/i.test(t.intro), `${g} ${l}: the intro's score line is plain and short (${t.intro.length} characters)`);
    check(t.how.length >= 2 && t.how.length <= 3 && /Total 200\.$/.test(t.score), `${g} ${l}: two or three level lines, the help's score totals 200`);
  }
}

/* ---------------------------------------------------------------- 2–3. Every deal proved; 200 reachable */
console.log("2–3. Every deal at every level proved; 200 reachable through the server's grade");
{
  // Free Cell: every bank entry's stored solution, through the level's game.
  const banks: Record<L, readonly (readonly [number, number])[]> = { easy: FC_DEALS_EASY, hard: FC_DEALS_HARD, expert: FC_DEALS_EXPERT };
  for (const l of LEVELS) {
    let ok = 0;
    for (let i = 0; i < banks[l].length; i++) {
      const line = fcLine(l, i);
      const s = run(FC.freecellLevelGame(l), i, line.map((m) => mv(FC.FC_INPUT_MOVE, m[0], m[1], m[2])));
      if (FC.fcAllHome(s) && s.moves === banks[l][i]![1] && line.length === banks[l][i]![1]) ok++;
    }
    check(banks[l].length >= 100 && ok === banks[l].length, `freecell ${l}: all ${banks[l].length} bank deals replay their solution to all home in par moves (${ok})`);
    const flawless = play(FC.freecellLevelGame(l), 0, fcLine(l, 0).map((m) => mv(FC.FC_INPUT_MOVE, m[0], m[1], m[2])), 12, FC.fcCheckpoint as never, encodeFreecellRun as never);
    // Changed with Joe's approval, 23 Nov 2026 (D6): the level puzzle on the stamp the level was built for (before D6's Normal stamps).
    const p = { type: "freecell", seed: 0, freecellRev: FC.FC_REV_SHARE, level: l } as unknown as PuzzleData;
    const g = gradeAnswer(p, flawless.raw, 0);
    check(g.score === 200 && !(g.extra as { flagged?: boolean }).flagged, `freecell ${l}: the par line at a human pace scores 200 through the grade (${g.score})`);
  }
  check(FC_DEALS_EASY.every(([, par]) => par > 0) && FC_DEALS_HARD.every(([seed]) => seed > 0), "freecell: bank pars and seeds are whole");

  // Summit: Easy's par ≤ 12 deals, Hard the bank, Expert its own no-wrap bank.
  check(TP.TP_EASY_DEALS.length >= 60 && TP.TP_EASY_DEALS.every((i) => TP_STOCK_PARS[i]! <= TP.TP_EASY_MAX_PAR), `tripeaks easy: ${TP.TP_EASY_DEALS.length} deals, every one at a stock par of 12 or less`);
  {
    let ok = 0;
    for (let i = 0; i < TP_EXPERT_DEALS.length; i++) {
      const s = run(TP.tripeaksLevelGame("expert"), i, tpxLines[i]!.map((a) => mv(TP.TP_INPUT_TAP, a)));
      if (s.clearedCount === 28 && s.bestRun >= 10 && s.turns === TP_EXPERT_DEALS[i]![1] && s.noWrap === 1) ok++;
    }
    check(TP_EXPERT_DEALS.length >= 100 && ok === TP_EXPERT_DEALS.length, `tripeaks expert: all ${TP_EXPERT_DEALS.length} deals clear without the wrap with a run of ten at their stock par (${ok})`);
    let okHard = 0;
    for (let i = 0; i < TP_HARD_NOWRAP_DEALS.length; i++) {
      const s = run(TP.tripeaksLevelGame("hard"), i, tphLines[i]!.map((a) => mv(TP.TP_INPUT_TAP, a)));
      if (s.clearedCount === 28 && s.bestRun >= 10 && s.turns === TP_HARD_NOWRAP_DEALS[i]![1] && s.noWrap === 1) okHard++;
    }
    check(TP_HARD_NOWRAP_DEALS.length >= 100 && okHard === TP_HARD_NOWRAP_DEALS.length, `tripeaks hard: all ${TP_HARD_NOWRAP_DEALS.length} deals clear without the wrap with a run of ten at their stock par (${okHard})`);
    check(Math.min(...TP_EXPERT_DEALS.map(([, p]) => p)) >= Math.max(...TP_HARD_NOWRAP_DEALS.map(([, p]) => p)), "tripeaks: Expert's deals need at least as many stock cards as any of Hard's");
  }
  for (const l of LEVELS) {
    const seed = 0;
    const d = TP.tpLevelDealOf(seed, l);
    const line = l === "expert" ? tpxLines[0]! : l === "hard" ? tphLines[0]! : tripeaksParSolution(d.index);
    const flawless = play(TP.tripeaksLevelGame(l), seed, line.map((a) => mv(TP.TP_INPUT_TAP, a)), 15, TP.tpCheckpoint as never, encodeTripeaksRun as never);
    // Changed with Joe's approval, 23 Nov 2026 (D6): the level puzzle on the stamp the level was built for (before D6's Normal stamps).
    const p = { type: "tripeaks", seed, tripeaksRev: TP.TP_REV_SHARE, level: l } as unknown as PuzzleData;
    const g = gradeAnswer(p, flawless.raw, 0);
    check(g.score === 200, `tripeaks ${l}: the stock-par line at a human pace scores 200 through the grade (${g.score})`);
  }
  check(TP_DEALS.length === TP_STOCK_PARS.length, "tripeaks: the bank and its pars line up");

  // Mahjong: built deals clear by their own build order on the level's layout.
  for (const l of LEVELS) {
    let ok = 0;
    const lay = MJ.MAHJONG_LEVEL_RULES[l].layout;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const d = MJ.mahjongBuild(seed, l);
      const counts = new Map<number, number>();
      for (const f of d.face) counts.set(f, (counts.get(f) ?? 0) + 1);
      const quads = [...counts.values()].filter((n) => n === 4).length;
      if (MJ.mahjongBuildClears(seed, l) && d.face.length === lay.tiles && quads === MJ.MAHJONG_LEVEL_RULES[l].quads) ok++;
    }
    check(ok === SEEDS, `mahjong ${l}: ${SEEDS} built deals clear by their own order, ${lay.tiles} tiles with ${MJ.MAHJONG_LEVEL_RULES[l].quads} faces dealt four times (${ok})`);
    const seed = 7;
    const order = MJ.mahjongBuild(seed, l).order;
    const taps = order.flatMap(([a, b]) => [mv(MJ.MAHJONG_INPUT_TAP, a), mv(MJ.MAHJONG_INPUT_TAP, b)]);
    const flawless = play(MJ.mahjongLevelGame(l), seed, taps, 8, MJ.mahjongCheckpoint as never, encodeMahjongRun as never);
    const p = { type: "mahjong", seed, mahjongRev: MJ.MAHJONG_REV_DEALT, level: l } as unknown as PuzzleData;
    const g = gradeAnswer(p, flawless.raw, 0);
    check(g.score === 200, `mahjong ${l}: the build order at a human pace scores 200 through the grade (${g.score})`);
    check(MJ.mahjongLevelGame(l).init(seed).face.length === lay.tiles, `mahjong ${l}: the board has ${lay.tiles} places`);
  }
  check(MJ.mahjongLayoutOf(new Array(72).fill(0)) === MJ.MAHJONG_LAYOUT && MJ.mahjongGameFor(2).init(5).face.length === 72, "mahjong normal: the 72-tile layout, untouched");

  // Thirteen: built deals clear by their witness with the level's Kings, and the filters hold.
  for (const l of LEVELS) {
    const r = PY.PY_LEVEL_RULES[l];
    let ok = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const deal = PY.pyLevelDeal(seed * 101, l);
      const kings = deal.tab.filter((c) => (c % 13) + 1 === 13).length;
      const s = run(PY.pyramidLevelGame(l), seed * 101, deal.witness.map((a) => mv(PY.PY_INPUT_TAP, a)));
      const filtered = r.filters.every((mode) => !PY.pyGreedyClears(deal, mode));
      if (s.removed === 28 && s.ppPairs >= PY.PY_PAIR_FULL && kings >= r.kingsMin && kings < r.kingsMin + r.kingsSpan && filtered) ok++;
    }
    check(ok === SEEDS, `pyramid ${l}: ${SEEDS} built deals clear by their witness, ${r.kingsMin}–${r.kingsMin + r.kingsSpan - 1} Kings, no quick player clears them (${ok})`);
    const seed = 404;
    const flawless = play(PY.pyramidLevelGame(l), seed, PY.pyLevelDeal(seed, l).witness.map((a) => mv(PY.PY_INPUT_TAP, a)), 15, PY.pyCheckpoint as never, encodePyramidRun as never);
    const p = { type: "pyramid", seed, pyramidRev: PY.PY_REV, level: l } as unknown as PuzzleData;
    const g = gradeAnswer(p, flawless.raw, 0);
    check(g.score === 200, `pyramid ${l}: the witness at a human pace scores 200 through the grade (${g.score})`);
    check(PY.pyramidLevelGame(l).init(seed).passes === r.passes, `pyramid ${l}: ${r.passes} pass${r.passes === 1 ? "" : "es"} through the stock`);
  }

  // Five Hands: today's deck; the best arrangement × the level's multiplier reaches 200 on decks that allow it.
  for (const l of LEVELS) {
    const r = FH.FH_LEVEL_RULES[l];
    let reach = 0;
    let checked = 0;
    for (let seed = 1; seed <= Math.min(SEEDS, 40); seed++) {
      checked++;
      const best = fhBest(seed, r.tableRev);
      if (Math.floor((best.total * r.num) / r.den) >= 200) reach++;
      if (seed <= 3) {
        check(FH.fiveHandsLevelGame(l).init(seed).deck.join(",") === FH.fiveHandsGameFor(FH.FH_REV).init(seed).deck.join(","), `fivehands ${l}: seed ${seed} deals today's deck`);
      }
    }
    check(reach > 0, `fivehands ${l}: 200 reachable (the best arrangement reaches it on ${reach} of ${checked} decks)`);
    // A deck that allows it, played through the grade.
    let seed = 1;
    while (Math.floor((fhBest(seed, r.tableRev).total * r.num) / r.den) < 200) seed++;
    const best = fhBest(seed, r.tableRev);
    const taps = [...best.taps.map((row) => mv(FH.FH_INPUT_PLACE, row)), mv(FH.FH_INPUT_PICK, best.column)];
    const flawless = play(FH.fiveHandsLevelGame(l), seed, taps, 20, FH.fhCheckpoint as never, encodeFiveHandsRun as never);
    // Changed with Joe's approval, 23 Nov 2026 (D6): the level puzzle on the stamp the level was built for (before D6's Normal stamps).
    const p = { type: "fivehands", seed, fiveHandsRev: FH.FH_REV_FLAT, level: l, timeLimitMs: r.seconds * 1000 + 3000 } as unknown as PuzzleData;
    const g = gradeAnswer(p, flawless.raw, 0);
    check(g.score === 200, `fivehands ${l}: the best arrangement on deck ${seed} scores 200 through the grade (${g.score})`);
  }
}

/* ---------------------------------------------------------------- 4. Hints and undo */
console.log("4. Hints and undo");
{
  // Free Cell.
  {
    const start = FC.freecellLevelGame("hard").init(0);
    const h1 = run(FC.freecellLevelGame("hard"), 0, [mv(FC.FC_INPUT_HINT), mv(FC.FC_INPUT_HINT)]);
    const base = FC.freecellStdParts({ ...h1, hints: 0 })![0]!.points;
    check(h1.hints === 2 && FC.freecellStdParts(h1)![0]!.points === Math.max(0, base - 2 * FC.FC_HINT_COST), "freecell hard: two hints counted, 5 each off the cards part");
    const e = run(FC.freecellLevelGame("expert"), 0, [mv(FC.FC_INPUT_HINT), mv(FC.FC_INPUT_HINT)]);
    check(e.hints === 1 && FC.fcHintsLeft(e) === 0, "freecell expert: one hint, the second refused");
    const ez = run(FC.freecellLevelGame("easy"), 0, [mv(FC.FC_INPUT_HINT)]);
    const ezBase = FC.freecellStdParts({ ...ez, hints: 0 })![0]!.points;
    check(ez.hints === 1 && FC.freecellStdParts(ez)![0]!.points === ezBase, "freecell easy: hints are free");
    const hint = fcHintMove(start);
    check(hint !== null && FC.fcApply(start, hint[0], hint[1], hint[2]) !== null, "freecell: the hint's move is legal");
    // Undo.
    const line = fcLine("easy", 0);
    const m0 = line[0]!;
    const u = run(FC.freecellLevelGame("easy"), 0, [mv(FC.FC_INPUT_MOVE, m0[0], m0[1], m0[2]), mv(FC.FC_INPUT_UNDO)]);
    const uh = run(FC.freecellLevelGame("hard"), FC_DEALS_HARD.length, [mv(FC.FC_INPUT_UNDO)]);
    check(u.moves === 1 && u.undos === 1 && uh.undos === 0, "freecell easy: an undo is free (the move counts, the undo does not)");
    const hardLine = fcLine("hard", 0)[0]!;
    const uh2 = run(FC.freecellLevelGame("hard"), 0, [mv(FC.FC_INPUT_MOVE, hardLine[0], hardLine[1], hardLine[2]), mv(FC.FC_INPUT_UNDO)]);
    check(uh2.moves === 2 && uh2.undos === 1, "freecell hard: an undo counts as a move (Normal's rule)");
    const ex = FC.freecellLevelGame("expert");
    const exLine = fcLine("expert", 0);
    const seq: Ev[] = [];
    for (let k = 0; k < 4; k++) seq.push(mv(FC.FC_INPUT_MOVE, exLine[0]![0], exLine[0]![1], exLine[0]![2]), mv(FC.FC_INPUT_UNDO));
    const ux = run(ex, 0, seq);
    check(ux.undos === 3 && FC.fcUndosLeft(ux) === 0, "freecell expert: undos stop at 3");
    const n = run(FC.freecellGameFor(FC.FC_REV), 0, [mv(FC.FC_INPUT_HINT)]);
    check((n.hints ?? 0) === 0 && n.lv === undefined, "freecell normal: no level, no hints");
    const easy = FC.freecellLevelGame("easy").init(0);
    check(easy.cells.length === 5 && FC.fcCardsOf(easy) === 32 && FC.fcCellPile(4) === FC.FC_PILE_CELL_5, "freecell easy: five free cells (the fifth pile 13) and 32 cards");
  }
  // Mahjong.
  {
    const g = MJ.mahjongLevelGame("hard");
    const s = run(g, 3, [mv(MJ.MAHJONG_INPUT_BUTTON, MJ.MAHJONG_BUTTON_HINT), mv(MJ.MAHJONG_INPUT_BUTTON, MJ.MAHJONG_BUTTON_HINT)]);
    const p = MJ.mahjongParts(s);
    check(s.hints === 2 && p.penalty === 10, "mahjong hard: two hints counted, 5 each off the total");
    const e = run(MJ.mahjongLevelGame("expert"), 3, [mv(MJ.MAHJONG_INPUT_BUTTON, MJ.MAHJONG_BUTTON_HINT), mv(MJ.MAHJONG_INPUT_BUTTON, MJ.MAHJONG_BUTTON_HINT)]);
    check(e.hints === 1, "mahjong expert: one hint");
    const sh = run(g, 3, [mv(MJ.MAHJONG_INPUT_SHUFFLE, MJ.MAHJONG_BUTTON_SHUFFLE)]);
    check(MJ.mahjongParts(sh).penalty === 8 && MJ.mahjongParts(run(MJ.mahjongLevelGame("easy"), 3, [mv(MJ.MAHJONG_INPUT_SHUFFLE, 0)])).penalty === 2, "mahjong: a shuffle costs 8 on Hard, 2 on Easy");
    const pair = MJ.mahjongHintPair(g.init(3).face);
    check(pair !== null && MJ.mahjongFree(g.init(3).face, pair[0]) && MJ.mahjongFree(g.init(3).face, pair[1]) && g.init(3).face[pair[0]] === g.init(3).face[pair[1]], "mahjong: the hint's pair is free and matching");
    const n = run(MJ.mahjongGameFor(2), 3, [mv(MJ.MAHJONG_INPUT_BUTTON, MJ.MAHJONG_BUTTON_HINT)]);
    check(n.hints === undefined && n.lv === undefined, "mahjong normal: no level, no hints");
  }
  // Summit.
  {
    const g = TP.tripeaksLevelGame("hard");
    const s = run(g, 0, [mv(TP.TP_INPUT_HINT)]);
    const base = TP.tripeaksStdParts({ ...s, hints: 0 })![0]!.points;
    check(s.hints === 1 && TP.tripeaksStdParts(s)![0]!.points === Math.max(0, base - TP.TP_HINT_COST), "tripeaks hard: a hint costs 5 from the cards part");
    const e = run(TP.tripeaksLevelGame("expert"), 0, [mv(TP.TP_INPUT_HINT), mv(TP.TP_INPUT_HINT)]);
    check(e.hints === 1, "tripeaks expert: one hint");
    const ez = TP.tripeaksLevelGame("easy");
    const u = run(ez, 0, [mv(TP.TP_INPUT_TAP, TP.TP_STOCK_PILE), mv(TP.TP_INPUT_UNDO), mv(TP.TP_INPUT_TAP, TP.TP_STOCK_PILE), mv(TP.TP_INPUT_UNDO), mv(TP.TP_INPUT_TAP, TP.TP_STOCK_PILE), mv(TP.TP_INPUT_UNDO), mv(TP.TP_INPUT_TAP, TP.TP_STOCK_PILE), mv(TP.TP_INPUT_UNDO)]);
    check(u.undos === 3 && u.turns === 1, "tripeaks easy: three undos, the fourth refused");
    check(run(g, 0, [mv(TP.TP_INPUT_TAP, TP.TP_STOCK_PILE), mv(TP.TP_INPUT_UNDO)]).turns === 1, "tripeaks hard: no undo");
    const ex = TP.tripeaksLevelGame("expert").init(0);
    const kingAce = { ...ex, tab: ex.tab.map((c, i) => (i === 18 ? 12 : c)), top: 13 }; // King of the first suit on an Ace.
    check(!TP.tpPlayable(kingAce, 18) && TP.tpPlayable({ ...kingAce, noWrap: undefined }, 18), "tripeaks expert: a King on an Ace is refused (Normal's wrap allows it)");
    const hint = tpHintMove(ez.init(0));
    check(hint === TP.TP_STOCK_PILE || TP.tpPlayable(ez.init(0), hint), "tripeaks: the hint's move is a legal play or the stock");
    check(TP.tpGlows(ez.init(0)) && !TP.tpGlows(g.init(0)) && TP.tpGlows(TP.tripeaksGameFor(TP.TP_REV).init(0)), "tripeaks: the glow on Normal and Easy only");
  }
  // Five Hands.
  {
    const g = FH.fiveHandsLevelGame("hard");
    const s = run(g, 5, [mv(FH.FH_INPUT_HINT), mv(FH.FH_INPUT_HINT)]);
    check(s.hints === 2, "fivehands hard: two hints counted");
    const placed = run(g, 5, [mv(FH.FH_INPUT_PLACE, 0), mv(FH.FH_INPUT_HINT)]);
    check(FH.fhLevelScore(placed, 50) === Math.floor((50 * 7) / 5) - 5, "fivehands hard: 50 hand points × 1.4 less 5 for the hint");
    check(FH.fhLevelScore({ ...FH.fiveHandsLevelGame("easy").init(5), hints: 3 }, 50) === 80 && FH.fhLevelScore({ ...FH.fiveHandsLevelGame("expert").init(5), hints: 0 }, 50) === 65, "fivehands: ×1.6 on Easy (free hints), ×1.3 on Expert");
    check(run(FH.fiveHandsLevelGame("expert"), 5, [mv(FH.FH_INPUT_HINT), mv(FH.FH_INPUT_HINT)]).hints === 1, "fivehands expert: one hint");
    const st = g.init(5);
    const h = FH.fhHintRow(st);
    check(h !== null && h.kind === "row" && FH.fhOpenRows(st.rows).includes(h.index), "fivehands: the hint names an open row");
  }
  // Thirteen.
  {
    const g = PY.pyramidLevelGame("hard");
    const s = run(g, 9, [mv(PY.PY_INPUT_HINT)]);
    const base = PY.pyramidStdParts({ ...s, hints: 0 })![0]!.points;
    check(s.hints === 1 && PY.pyramidStdParts(s)![0]!.points === Math.max(0, base - PY.PY_HINT_COST), "pyramid hard: a hint costs 5 from the cards part");
    check(run(PY.pyramidLevelGame("expert"), 9, [mv(PY.PY_INPUT_HINT), mv(PY.PY_INPUT_HINT)]).hints === 1, "pyramid expert: one hint");
    const st = PY.pyramidLevelGame("easy").init(9);
    const hint = PY.pyHintMove(st);
    check(hint !== null && (hint[0] === PY.PY_STOCK_PILE || PY.pyMoves(st).some((m) => m.join(",") === hint.join(","))), "pyramid: the hint is an open removal or a draw");
    check(PY.pyGlows(st) && !PY.pyGlows(g.init(9)) && PY.pyGlows(PY.pyramidGameFor(PY.PY_REV).init(9)), "pyramid: the partner glow on Normal and Easy only");
  }
}

/* ---------------------------------------------------------------- 5. Dead ends */
console.log("5. Dead ends are explained at every level");
{
  for (const l of LEVELS) {
    const g = FC.freecellLevelGame(l);
    // Four Kings and four Jacks alone in the columns, nines and a seven in the free cells, nothing home: no move at all.
    const card = (suit: number, rank: number) => suit * 13 + rank - 1;
    const cols = [0, 1, 2, 3].flatMap((su) => [[card(su, 13)], [card(su, 11)]]);
    const cellCards = [card(0, 9), card(1, 9), card(2, 9), card(3, 9), card(0, 7)].slice(0, g.init(0).cells.length);
    const stuck = { ...g.init(0), cols, cells: cellCards, home: [0, 0, 0, 0] };
    check(!FC.fcNoMoves(g.init(0)) && FC.fcNoMoves(stuck) && FC.fcNoMovesText(stuck) === "No moves: Undo or Reset", `freecell ${l}: a dead end says "No moves: Undo or Reset"`);
    const pz = PY.pyramidLevelGame(l).init(9);
    check(PY.pyDeadEnd(pz) === null, `pyramid ${l}: a fresh deal is no dead end`);
  }
  // Summit: a dead end on Easy waits while an undo can leave it.
  const ez = TP.tripeaksLevelGame("easy");
  let s = ez.init(0);
  for (let t = 0; t < 23; t++) s = ez.step(s, { ...mv(TP.TP_INPUT_TAP, TP.TP_STOCK_PILE), t: t + 1 });
  const stuck = { ...s, cleared: s.cleared.map(() => 0), tab: s.tab.map(() => s.top + (s.top % 13 < 6 ? 6 : -6)) };
  const next = ez.step({ ...stuck, stockPos: 24 }, { ...mv(TP.TP_INPUT_TAP, TP.TP_STOCK_PILE), t: stuck.tick + 1 });
  check(next.ended === 0 && (next.hist?.length ?? 0) > 0, "tripeaks easy: a dead end waits while an undo can leave it");
}

console.log(failures.length ? `FAIL cards-levels-check: ${failures.length} failed, ${passed} passed` : `PASS cards-levels-check: ${passed} checks`);
process.exit(failures.length ? 1 : 0);
