/**
 * d3-attention-ladder-check (D3, 22 Nov 2026; docs/polish-plan-final/difficulty-spec.md "Speed and Attention"): the six
 * Attention games' D3 ladders (Eagle Eye, Double Take, Tally, Labyrinth, Bomb Defusal, Matchmaker). No browser.
 *
 *   1. Stored rounds keep their worlds: every case of the legacy fixture (scripts/fixtures/d3-attention-legacy.json.gz,
 *      recorded before D3: Normal deals and the first table's level deals, four answers each) regrades exactly.
 *   2. Normal is today's game: a Normal deal is byte for byte the deal without a level for all six; Labyrinth's Normal
 *      differs from its mazeRev 5 deal (pinPreD3Maze) only by the approved stamp (mazeRev 6, speed full by 34 s), and a
 *      mazeRev 5 Normal round still grades on 32 s.
 *   3. Every level deal carries levelRev 2 and reads D3's table; the first table is untouched for the deals without it.
 *   4. The mechanics: Labyrinth's keys (at dead-end tips, Expert one a quarter, the par the shortest walk through them,
 *      no finish without them, the exit counting only once they are all taken); Double Take's mirror (Expert only, the
 *      answer unchanged, the miss limit read from the row); Matchmaker's memory misses (a first look never counts, a
 *      forgotten card does) and the levels' gold windows and streak; Tally's Easy questions (a shape or a colour alone).
 *   5. 200 is reachable under the human limits on every Hard and Expert board: a person-like flawless run at a person's
 *      pace (d3-attention-proof.ts) scores 200 through the server's grader on every sampled deal of both levels and on
 *      every card of Bomb Defusal's Hard and Expert banks; Labyrinth's slowest possible tour and Eagle Eye's largest
 *      boards fit inside their full-by.
 *   6. The ladder (Joe, 22 Nov 2026), on 100 deals a level (d3-ladder-lib.ts players): the average player's average
 *      falls clearly from Easy to Normal to Hard to Expert (Bomb Defusal's Expert only no higher than Hard: the average
 *      kit scores 0 on every 8-step card); the realistic elite under the human limits reaches 200 strictly less often
 *      each level up, and on Expert on at least a fifth of the deals.
 *
 *   bun scripts/d3-attention-ladder-check.ts [--part=k/n]     (--part splits the six games, for CI shards)
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import * as D from "../src/lib/levels/attentionLevels.data";
import { ATTENTION_LEVEL_HELP, ATTENTION_LEVEL_REV, attentionLevelRevOf, bombLevel, mazeLevel, pairLevel, pairMemoryMisses, scanLevel, spotLevel, spotMirrored, tallyLevel } from "../src/lib/duel/attentionLevels";
import { MAZE_D3_FULL_BY_S, MAZE_REV_D3, pinPreD3Maze } from "../src/lib/duel/d3Attention";
import { PAR_STRICT_FULL_BY_S } from "../src/lib/duel/parMoves";
import { mazeColsOf, mazeCorridorNeighbours } from "../src/lib/duel/maze";
import { mazeKeysOf, mazePathBetween, mazeTourSteps } from "../src/lib/duel/mazeKeys";
import { mazeQuarterOf } from "../src/lib/duel/mazeKeys.server";
import { encodeMazeTrail } from "../src/lib/duel/depth/labyrinth";
import { encodePairFlips, sameCard } from "../src/lib/duel/pairmatch";
import { BOMB_EXPERT_BANK, BOMB_HARD_BANK } from "../src/lib/duel/bombLevelsBank.server";
import { bombStepClues } from "./bomb-levels-bank";
import { D3_ATTENTION_LEGACY, type LegacyCase, type LegacyDeal } from "./d3-attention-legacy-record";
import { limitsRun } from "./d3-attention-proof";
import { measure, type D3Game } from "./d3-ladder-lib";
import { asPhoneSends, gradeSteps } from "./standard-lib";
import type { BombPuzzleData, CountUpPuzzleData, MazePuzzleData, PairPuzzleData, PuzzleData, SpotPuzzleData } from "../src/lib/duel/types";

const GAMES = ["symscan", "spotdiff", "countup", "maze", "bomb", "pairmatch"] as const satisfies readonly D3Game[];
const OFF = ["easy", "hard", "expert"] as const;
const LEVELS = ["easy", "normal", "hard", "expert"] as const;
const LADDER_DEALS = 100;
/** "Clearly": each level's average at least this far below the one before. */
const AVERAGE_STEP = 5;
/** Where the average kit sits at its floor (0) on the level above as well: Bomb Defusal's Expert after Hard. */
const AVERAGE_FLOOR: Partial<Record<string, string>> = { bomb: "expert" };

const partArg = process.argv.find((a) => a.startsWith("--part="))?.slice(7);
const [partK, partN] = partArg ? (partArg.split("/").map(Number) as [number, number]) : [1, 1];
const mine = GAMES.filter((_, i) => i % partN === partK - 1);
const whole = partN === 1;

const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else failures.push(message);
};
const deal = (type: string, level: string | null, seed: number): PuzzleData =>
  withSeededRandom(seed, () => generatePuzzle(type as never, { bankSeed: seed, ...(level && level !== "normal" ? { level: level as never } : {}) }));
const SEEDS = Array.from({ length: 6 }, (_, i) => 31_000 + i * 17);

/* ------------------------------------------------------------------ 1. the legacy fixture */
if (whole || partK === 1) {
  const { deals, cases } = JSON.parse(gunzipSync(readFileSync(D3_ATTENTION_LEGACY)).toString()) as { deals: LegacyDeal[]; cases: LegacyCase[] };
  let same = 0;
  for (const c of cases) {
    const d = deals[c.deal]!;
    const g = gradeAnswer(d.puzzle, c.answer, c.msRemaining);
    const ok = g.score === c.score && g.isCorrect === c.isCorrect && JSON.stringify(g.extra ?? null) === c.extra;
    if (ok) same++;
    else check(false, `legacy ${d.game} ${d.level} #${d.n}: regrades ${g.score}/${g.isCorrect}, was ${c.score}/${c.isCorrect}`);
  }
  check(same === cases.length && cases.length === 1152, `legacy: ${same} of ${cases.length} cases regrade exactly`);
  console.log(`1. legacy fixture: ${same} of ${cases.length} cases regrade exactly`);
}

/* ------------------------------------------------------------------ 2. Normal is today's game */
for (const type of mine) {
  for (const seed of SEEDS) {
    const plain = deal(type, null, seed);
    const normal = deal(type, "normal", seed);
    check(JSON.stringify(plain) === JSON.stringify(normal), `${type} ${seed}: Normal is not the deal without a level`);
    check(!("level" in normal) && !("levelRev" in normal), `${type} ${seed}: Normal carries a level stamp`);
    if (type === "maze") {
      const was = pinPreD3Maze(true);
      const before = deal(type, null, seed) as MazePuzzleData;
      pinPreD3Maze(was);
      check((normal as MazePuzzleData).mazeRev === MAZE_REV_D3 && before.mazeRev === 5, `maze ${seed}: Normal deals mazeRev ${(normal as MazePuzzleData).mazeRev} (pinned ${before.mazeRev})`);
      check(JSON.stringify({ ...normal, mazeRev: 5 }) === JSON.stringify(before), `maze ${seed}: mazeRev 6 changes more than the stamp`);
      // The same flawless trace scores full speed at 34 s on mazeRev 6 and loses speed after 32 s on mazeRev 5.
      const route = before.solution!;
      const answer = encodeMazeTrail(route, mazeColsOf(before));
      const limit = puzzleTimeLimitMs(before);
      const at = (p: PuzzleData, s: number) => gradeAnswer(p, answer, limit - s * 1000).score;
      check(at(normal, MAZE_D3_FULL_BY_S) === 200 && at(normal, MAZE_D3_FULL_BY_S + 2) < 200, `maze ${seed}: mazeRev 6 isn't full speed by ${MAZE_D3_FULL_BY_S} s`);
      check(at(before, PAR_STRICT_FULL_BY_S.maze) === 200 && at(before, MAZE_D3_FULL_BY_S) < 200, `maze ${seed}: mazeRev 5 no longer grades on 32 s`);
    }
  }
}

/* ------------------------------------------------------------------ 3. levelRev 2 and the tables */
const ROWS = { symscan: [D.SCAN_LEVELS, D.SCAN_LEVELS_REV1, scanLevel], spotdiff: [D.SPOT_LEVELS, D.SPOT_LEVELS_REV1, spotLevel], countup: [D.TALLY_LEVELS, D.TALLY_LEVELS_REV1, tallyLevel], maze: [D.MAZE_LEVELS, D.MAZE_LEVELS_REV1, mazeLevel], bomb: [D.BOMB_LEVELS, D.BOMB_LEVELS_REV1, bombLevel], pairmatch: [D.PAIR_LEVELS, D.PAIR_LEVELS_REV1, pairLevel] } as const;
for (const type of mine) {
  const [d3, rev1, read] = ROWS[type] as unknown as [Record<string, unknown>, Record<string, unknown>, (p: unknown) => unknown];
  check(JSON.stringify(d3["normal"]) === JSON.stringify(rev1["normal"]), `${type}: Normal's row differs between the tables`);
  for (const level of OFF) {
    const p = deal(type, level, SEEDS[0]!);
    check(attentionLevelRevOf(p) === ATTENTION_LEVEL_REV, `${type} ${level}: dealt without levelRev 2`);
    check(read(p) === d3[level], `${type} ${level}: a levelRev 2 deal doesn't read D3's row`);
    const { levelRev: _rev, ...old } = p as unknown as Record<string, unknown>;
    check(read(old) === rev1[level], `${type} ${level}: a deal without levelRev doesn't read the first table`);
    check(puzzleTimeLimitMs(p) <= 120_000, `${type} ${level}: a clock over 120 s`);
  }
}
if (whole || partK === 1) {
  // The help's "Levels:" lines are the first table's until the game page's level text lands (P2).
  check(ATTENTION_LEVEL_HELP.maze.includes(`${D.MAZE_LEVELS_REV1.hard.cols}×${D.MAZE_LEVELS_REV1.hard.rows}`) && ATTENTION_LEVEL_HELP.bomb.includes(`Hard ${D.BOMB_LEVELS_REV1.hard.wires} wires`), "the help's Levels lines moved before P2");
}

/* ------------------------------------------------------------------ 4. the mechanics */
if (mine.includes("maze")) {
  for (const level of ["hard", "expert"] as const) {
    const row = D.MAZE_LEVELS[level];
    for (const seed of SEEDS) {
      const p = deal("maze", level, seed) as MazePuzzleData;
      const cols = mazeColsOf(p);
      const keys = mazeKeysOf(p);
      check(keys.length === row.keys, `maze ${level} ${seed}: ${keys.length} keys`);
      check(keys.every((k) => mazeCorridorNeighbours(p.cells, k, cols).length === 1 && !(p.solution ?? []).includes(k)), `maze ${level} ${seed}: a key isn't at a dead-end tip off the route`);
      if (row.keysByQuarter) check(new Set(keys.map((k) => mazeQuarterOf(k, cols, row.rows))).size === 4, `maze ${level} ${seed}: not one key a quarter`);
      const tour = mazeTourSteps(p.cells, cols, p.start, keys, p.exit);
      check(p.par === tour && tour >= row.tourMin && tour <= row.tourMax, `maze ${level} ${seed}: par ${p.par}, tour ${tour}`);
      // The plain route to the exit is no finish; the key tour is, and its walk is the par.
      const plain = gradeAnswer(p, encodeMazeTrail(p.solution!, cols), 30_000);
      check(!plain.isCorrect && plain.score <= 130, `maze ${level} ${seed}: the exit without the keys finishes (${plain.score})`);
      const trail = [p.start];
      for (const target of [...keys, p.exit]) trail.push(...mazePathBetween(p.cells, cols, trail[trail.length - 1]!, target).slice(1));
      const withKeys = gradeAnswer(p, encodeMazeTrail(trail, cols), 0);
      check(withKeys.isCorrect, `maze ${level} ${seed}: fetching every key then the exit doesn't finish`);
    }
  }
}
if (mine.includes("spotdiff")) {
  for (const level of OFF) {
    const p = deal("spotdiff", level, SEEDS[1]!) as SpotPuzzleData;
    check(spotMirrored(p) === (level === "expert"), `spotdiff ${level}: mirrored ${spotMirrored(p)}`);
    const row = D.SPOT_LEVELS[level];
    // At the level's miss limit a picture still finishes; one more wrong tap doesn't.
    const cells = (scene: number) => (p.differences ?? []).filter((d) => (d.scene ?? 0) === scene).map((d) => d.cells[0]!);
    const diffCells = new Set((p.differences ?? []).flatMap((d) => d.cells).concat(p.bonus?.cells ?? []));
    const wrong = p.top.map((s) => s.cell).filter((c) => !diffCells.has(c));
    const answer = (n: number) => `${[...wrong.slice(0, n), ...cells(0)].join(",")}|${cells(1).join(",")}`;
    check(gradeAnswer(p, answer(row.missLimit), 10_000).isCorrect && !gradeAnswer(p, answer(row.missLimit + 1), 10_000).isCorrect, `spotdiff ${level}: the miss limit isn't ${row.missLimit}`);
  }
}
if (mine.includes("pairmatch")) {
  const p = deal("pairmatch", "hard", SEEDS[2]!) as PairPuzzleData;
  const twin = (i: number) => p.cards.findIndex((c, j) => j !== i && sameCard(c, p.cards[i]));
  const fresh = (used: number[]) => p.cards.findIndex((_, j) => !used.includes(j) && !used.includes(twin(j)));
  const a = 0;
  const partner = twin(a);
  const b = fresh([a, partner]);
  const x = fresh([a, partner, b]);
  const y = fresh([a, partner, b, x]);
  // Two first looks (a with b, x with a's partner as the second card) are no memory miss; turning a over again with
  // another card once its partner has been seen is one.
  check(pairMemoryMisses(p.cards, [a, b, x, partner]) === 0, "pairmatch: a first look counted as a memory miss");
  check(pairMemoryMisses(p.cards, [a, b, x, partner, a, y]) === 1, "pairmatch: a forgotten partner isn't a memory miss");
  check(D.PAIR_LEVELS.easy.streakFrom === -1 && D.PAIR_LEVELS.expert.goldWindowMs === 45_000, "pairmatch: Easy's streak or Expert's gold window moved");
  void encodePairFlips;
}
if (mine.includes("countup")) {
  for (const seed of SEEDS) {
    const p = deal("countup", "easy", seed) as CountUpPuzzleData;
    check(p.stages.length === 3 && p.stages.every((s) => s.ask === "shape" || s.ask === "colour"), `countup easy ${seed}: a tray asks for more than a shape or a colour`);
  }
}

/* ------------------------------------------------------------------ 5. 200 under the human limits */
const PROOF_DEALS = 20;
for (const type of mine) {
  for (const level of ["hard", "expert"] as const) {
    let at200 = 0;
    for (let n = 0; n < PROOF_DEALS; n++) {
      const p = deal(type, level, 40_000 + n * 13);
      const run = gradeSteps(p, asPhoneSends(p, limitsRun(p)));
      if (run.score === 200) at200++;
      else check(false, `${type} ${level} #${n}: the person-like limits run scores ${run.score}`);
    }
    check(at200 === PROOF_DEALS, `${type} ${level}: the limits run scores 200 on ${at200} of ${PROOF_DEALS} deals`);
  }
}
if (mine.includes("bomb")) {
  for (const [level, bank] of [["hard", BOMB_HARD_BANK], ["expert", BOMB_EXPERT_BANK]] as const) {
    const row = D.BOMB_LEVELS[level];
    let ok = 0;
    for (const card of bank) {
      const p = { ...deal("bomb", level, SEEDS[0]!), ...card } as BombPuzzleData;
      const run = gradeSteps(p, asPhoneSends(p, limitsRun(p)));
      if (run.score === 200) ok++;
      else check(false, `bomb ${level}: a bank card's limits run scores ${run.score}`);
      if ("stepCluesMin" in row) check(bombStepClues(card) >= row.stepCluesMin, `bomb ${level}: a card with too few Step clues`);
      if ("stepCluesMax" in row) check(bombStepClues(card) <= row.stepCluesMax, `bomb ${level}: a card with too many Step clues`);
    }
    check(ok === bank.length, `bomb ${level}: ${ok} of ${bank.length} bank cards reach 200 under the limits`);
  }
}
if (mine.includes("maze")) {
  // The slowest tour a level can deal, at the proof's pace (3 s, 1 s a key, 0.2 s a square), inside its full-by.
  for (const level of ["hard", "expert"] as const) {
    const row = D.MAZE_LEVELS[level];
    check(3 + row.keys + 0.2 * row.tourMax <= row.fullByS, `maze ${level}: the longest tour's limits time is past the full-by`);
  }
}
if (mine.includes("symscan")) {
  // The biggest boards a level can deal, at the proof's pace, inside its full-by.
  for (const level of ["hard", "expert"] as const) {
    const row = D.SCAN_LEVELS[level];
    const most = row.grids.reduce((t, cols, i) => t + (i >= row.twoFrom ? 1.4 + 0.4 * 2 * row.twoEach[1] : 1 + 0.4 * row.targets[1]) + 0.03 * cols * cols + 0.4, 0);
    check(most <= row.fullByS, `symscan ${level}: the biggest boards' limits time ${most.toFixed(1)} s is past the full-by`);
  }
}

/* ------------------------------------------------------------------ 6. the ladder */
const table: string[] = [];
for (const type of mine) {
  const rows = LEVELS.map((level) => ({ level, average: measure(type, level, "average", LADDER_DEALS), elite: measure(type, level, "elite", LADDER_DEALS) }));
  table.push(`${type.padEnd(10)} average ${rows.map((r) => r.average.average.toFixed(1)).join(" / ")}   elite at 200 ${rows.map((r) => `${Math.round(r.elite.at200 * 100)}%`).join(" / ")}   elite avg ${rows.map((r) => r.elite.average.toFixed(1)).join(" / ")}`);
  for (let i = 1; i < rows.length; i++) {
    const [a, b] = [rows[i - 1]!, rows[i]!];
    // The one exception, reported to Joe: the average kit reads every clue before it acts, so it runs out of time on
    // every 8-step bomb (0 on Hard and Expert alike, as the spec recorded); there Expert may only not be above Hard.
    const floor = AVERAGE_FLOOR[type] === b.level && a.average.average === 0;
    if (floor) check(b.average.average <= a.average.average, `${type}: the average player's ${b.level} (${b.average.average}) is above ${a.level} (${a.average.average})`);
    else check(b.average.average <= a.average.average - AVERAGE_STEP, `${type}: the average player's ${b.level} (${b.average.average}) isn't clearly below ${a.level} (${a.average.average})`);
    check(b.elite.at200 < a.elite.at200, `${type}: the elite reaches 200 on ${b.level} (${b.elite.at200}) no less often than on ${a.level} (${a.elite.at200})`);
  }
  check(rows[3]!.elite.at200 >= 0.2, `${type}: the elite reaches 200 on ${Math.round(rows[3]!.elite.at200 * 100)} % of Expert deals (at least a fifth)`);
}
console.log(`6. the ladder (${LADDER_DEALS} deals a level; Easy / Normal / Hard / Expert):\n  ${table.join("\n  ")}`);

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`FAIL ${f}`);
  console.log(`FAIL d3-attention-ladder-check: ${failures.length} failed, ${passes} passed`);
  process.exit(1);
}
console.log(`PASS d3-attention-ladder-check${partArg ? ` (part ${partArg})` : ""}: ${passes} assertions`);
