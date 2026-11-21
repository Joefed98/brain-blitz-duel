/**
 * swapword-levels-proof-check (D1, 21 Nov 2026; difficulty-spec.md "Swapword"): Swapword's Hard and Expert on their
 * lattices, swapwordRev 8, and the proof that their 200 is reachable by the best humans.
 *
 *  1. The lattices: Hard's three loops (30 tiles, 8 words: four of 6 letters and four of 4, on 8 × 8), Expert's four-loop
 *     window (33 tiles, six 7-letter words on rows and columns 1, 4 and 7 of 7 × 7); every slot's squares are tiles and
 *     every tile sits in one or two words; today's figure eight is the default lattice, unchanged.
 *  2. The deals: Hard and Expert carry swapwordRev 8 and the level's lattice; each meets its level's rules (the proven
 *     fewest swaps, the witness replaying to the answer in exactly that many, tiles in place, budget, clock, one
 *     arrangement of answer words keeping the start's gold tiles, the mark-reading solver working it out without a guess);
 *     the same deal for every player; Easy and Normal stay on the 21-tile board with no lattice.
 *  3. The proof at the human limits: the person-like line (the solver's words, 0.25 s each, then the fewest swaps, every
 *     swap 0.25 s to react and two taps at 0.15 s, src/lib/duel/levels/humanLimits.ts) is graded 200 by the server on every Hard and
 *     Expert deal checked, as the phone sends it and as the deal's own filter computes it.
 *  4. The server reads the lattice: a swap of tiles past 21 counts, the live check's marks cover every tile, the solved
 *     board grades correct and an unfinished one earns credit for tiles placed.
 *
 *   bun scripts/swapword-levels-proof-check.ts
 */
import { gradeAnswer, generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import type { SwapwordPuzzleData } from "../src/lib/duel/types";
import {
  SW_EXPERT_LATTICE,
  SW_HARD_LATTICE,
  SW_NORMAL_LATTICE,
  SW_SLOT_TILES,
  SW_TILE_CELLS,
  SW_TILES,
  SWAPWORD_REV_LATTICE,
  decodeSwapwordFor,
  encodeSwapword,
  replaySwapword,
  swGeometry,
  swLatticeOf,
  type SwLattice,
} from "../src/lib/duel/swapword";
import { checkSwapwordMoves, minSwaps, swapwordWords, witnessSwaps } from "../src/lib/duel/swapword.server";
import { SWAPWORD_LEVEL_SETTINGS } from "../src/lib/levels/word/swapword";
import { swapwordLevelLattice, swapwordLevelRuleBreak, swapwordLineAtLimits } from "../src/lib/duel/levels/swapword.server";
import { swapwordDeduction, swapwordHumanSolves, swapwordOneArrangement } from "../src/lib/duel/levels/swapwordProof.server";
import { WORD_HUMAN_LIMITS, limitEntryMs } from "../src/lib/duel/levels/humanLimits";
import { HUMAN_LIMITS } from "./arcade-skill-bands/human";
import { swapwordLine } from "./word-human-solvers";

let passes = 0;
const failures: string[] = [];
const ok = (cond: unknown, label: string) => {
  if (cond) passes++;
  else {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
};
const t0 = Date.now();

/* ------------------------------------------------------------------------------------------------ 1. Lattices */
const cellsOf = (lat: SwLattice) => lat.cells.map((c) => [Math.floor(c / lat.cols), c % lat.cols] as const);
{
  const g = swGeometry(SW_HARD_LATTICE);
  ok(SW_HARD_LATTICE.cols === 8 && SW_HARD_LATTICE.rows === 8 && g.tiles === 30, `hard: 30 tiles on 8 × 8 (${g.tiles})`);
  const lens = SW_HARD_LATTICE.slots.map((s) => s.len).sort().join(",");
  ok(lens === "4,4,4,4,6,6,6,6", `hard: eight words, four of 6 letters and four of 4 (${lens})`);
  const e = swGeometry(SW_EXPERT_LATTICE);
  ok(SW_EXPERT_LATTICE.cols === 7 && SW_EXPERT_LATTICE.rows === 7 && e.tiles === 33, `expert: 33 tiles on 7 × 7 (${e.tiles})`);
  ok(
    SW_EXPERT_LATTICE.slots.length === 6 && SW_EXPERT_LATTICE.slots.every((s) => s.len === 7 && (s.across ? s.col === 0 && [0, 3, 6].includes(s.row) : s.row === 0 && [0, 3, 6].includes(s.col))),
    "expert: six 7-letter words on rows and columns 1, 4 and 7",
  );
  for (const [name, lat] of [["hard", SW_HARD_LATTICE], ["expert", SW_EXPERT_LATTICE]] as const) {
    const geo = swGeometry(lat);
    ok(geo.tileSlots.every((s) => s.length === 1 || s.length === 2), `${name}: every tile sits in one or two words`);
    ok(cellsOf(lat).every(([r, c]) => r >= 0 && r < lat.rows && c >= 0 && c < lat.cols), `${name}: every tile on the grid`);
    // Every maximal run of 2+ tiles across or down is exactly one slot (no stray words formed by adjacency).
    const isTile = (r: number, c: number) => r >= 0 && c >= 0 && r < lat.rows && c < lat.cols && geo.tileOfCell[r * lat.cols + c]! >= 0;
    let runs = 0;
    for (const across of [true, false])
      for (let a = 0; a < (across ? lat.rows : lat.cols); a++)
        for (let b = 0; b < (across ? lat.cols : lat.rows); b++) {
          const [r, c] = across ? [a, b] : [b, a];
          const [pr, pc] = across ? [r, c - 1] : [r - 1, c];
          const [nr, nc] = across ? [r, c + 1] : [r + 1, c];
          if (isTile(r, c) && !isTile(pr, pc) && isTile(nr, nc)) {
            runs++;
            let len = 0;
            while (isTile(across ? r : r + len, across ? c + len : c)) len++;
            ok(lat.slots.some((s) => s.across === across && s.row === r && s.col === c && s.len === len), `${name}: the run at ${r},${c} ${across ? "across" : "down"} is a slot`);
          }
        }
    ok(runs === lat.slots.length, `${name}: ${lat.slots.length} runs, one a slot (${runs})`);
  }
  const n = swGeometry(SW_NORMAL_LATTICE);
  ok(n.tiles === SW_TILES && SW_NORMAL_LATTICE.cells === SW_TILE_CELLS && JSON.stringify(n.slotTiles) === JSON.stringify(SW_SLOT_TILES), "normal: the default lattice is today's figure eight");
  ok(swLatticeOf({}) === SW_NORMAL_LATTICE, "a puzzle without a lattice is on today's figure eight");
}

/* ------------------------------------------------------------------------------------------------ 2–3. Deals and proof */
ok(WORD_HUMAN_LIMITS.reactMs === HUMAN_LIMITS.reactMs && WORD_HUMAN_LIMITS.moveMs === HUMAN_LIMITS.moveMs, "the level deals' human limits are the bots' HUMAN_LIMITS");
const deal = (seed: number, level?: "easy" | "hard" | "expert") =>
  withSeededRandom(seed, () => generatePuzzle("swapword", { bankSeed: seed, ...(level ? { level } : {}) })) as SwapwordPuzzleData;
const SEEDS = [11, 202, 3003, 40004, 500005, 6000006, 77, 912, 4321, 99_001, 123_456, 7_000_001];
for (const level of ["hard", "expert"] as const) {
  const s = SWAPWORD_LEVEL_SETTINGS[level];
  const lat = swapwordLevelLattice(s);
  const lineMs: number[] = [];
  for (const seed of SEEDS) {
    const d = deal(seed, level);
    const tag = `${level} ${seed}`;
    ok(d.swapwordRev === SWAPWORD_REV_LATTICE && JSON.stringify(d.lattice) === JSON.stringify(lat), `${tag}: swapwordRev 8 on the level's lattice`);
    ok(swapwordLevelRuleBreak(d, s) === null, `${tag}: meets its rules (${swapwordLevelRuleBreak(d, s)})`);
    const sol = d.solution ?? "";
    ok(minSwaps(d.start, sol) === d.minSwaps, `${tag}: the stored fewest swaps is the search's`);
    const w = witnessSwaps(d.start, sol);
    ok(w.length === d.minSwaps && replaySwapword(d.start, w, d.maxSwaps, sol).solved, `${tag}: the witness solves it in exactly the fewest swaps`);
    ok(swapwordOneArrangement(d.start, sol, lat), `${tag}: one arrangement of answer words keeps the gold tiles`);
    ok(swapwordHumanSolves(d.start, sol, lat) && swapwordDeduction(d.start, sol, lat).steps.every((step) => !step.guessed), `${tag}: the mark-reading solver works it out without a guess`);
    ok(new Set(swapwordWords(sol, lat)).size === lat.slots.length, `${tag}: different words in every slot`);
    const line = swapwordLine(d);
    const fromDeal = swapwordLineAtLimits(d);
    ok(line.score === 200 && line.finished && fromDeal?.score === 200, `${tag}: the person-like line at the human limits scores 200 (${line.score}; the deal's filter ${fromDeal?.score})`);
    ok(line.ms === lat.slots.length * limitEntryMs(0) + d.minSwaps * limitEntryMs(2) && fromDeal?.ms === line.ms, `${tag}: the line is 0.25 s a word worked out, then the fewest swaps at 0.55 s each`);
    lineMs.push(line.ms);
    ok(JSON.stringify(deal(seed, level)) === JSON.stringify(d), `${tag}: the same deal for every player`);
  }
  console.log(`  ${level}: person-like line ${Math.min(...lineMs) / 1000}–${Math.max(...lineMs) / 1000} s of swaps (clock ${s.timeLimitMs / 1000} s)`);
}
for (const seed of SEEDS.slice(0, 4)) {
  const n = deal(seed);
  const e = deal(seed, "easy");
  ok(!("lattice" in n) && n.start.length === SW_TILES && n.swapwordRev < SWAPWORD_REV_LATTICE, `normal ${seed}: today's 21-tile board, no lattice`);
  ok(!("lattice" in e) && e.start.length === SW_TILES, `easy ${seed}: today's 21-tile board, no lattice`);
}

/* ------------------------------------------------------------------------------------------------ 4. The server reads the lattice */
{
  const d = deal(SEEDS[0]!, "expert");
  const sol = d.solution ?? "";
  const far = [...d.start].findIndex((ch, t) => t >= 21 && ch !== sol[t]);
  const partner = [...d.start].findIndex((ch, t) => t !== far && ch === sol[far] && d.start[t] !== sol[t]);
  ok(far >= 21 && partner >= 0, "expert: a swap past tile 21 exists to test");
  const swap = encodeSwapword([[far, partner]]);
  ok(decodeSwapwordFor(d, swap).length === 1, "expert: a swap of tiles past 21 is read");
  const view = checkSwapwordMoves(d, swap);
  ok(view.marks.length === 33 && view.marks[far] === 2 && view.swaps === 1, "expert: the live check marks all 33 tiles and the swap placed its tile");
  const solved = gradeAnswer(d, encodeSwapword(witnessSwaps(d.start, sol)), 80_000);
  ok(solved.isCorrect && solved.score === 200, `expert: the fewest swaps with time to spare grade 200 (${solved.score})`);
  const partial = gradeAnswer(d, swap, 0);
  ok(!partial.isCorrect && partial.score > 0, `expert: one useful swap earns unfinished credit (${partial.score})`);
}

if (failures.length) {
  console.log(`FAIL swapword-levels-proof-check: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS swapword-levels-proof-check: ${passes} checks in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
