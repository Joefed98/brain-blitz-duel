/**
 * swapword-levels-check (the Word overhaul, stage 3, 15 Nov 2026; src/lib/levels/word/swapword.ts): Swapword's Easy,
 * Hard and Expert.
 *
 *  1. The registry, the level lines, the clocks (at most 120 s), Normal byte for byte the plain deal, every level the
 *     same deal for every player (word-levels-shared.ts).
 *  2. Every level board meets its rules: the proven fewest swaps, tiles in place, the budget and clock as set.
 *  3. One answer: no other arrangement of the tiles makes six common answer words while keeping the start board's
 *     green tiles (the board's mirror across its diagonal always makes six words, so the green tiles are what the
 *     player has to tell them apart; a board with no green tiles off the diagonal is refused). The search itself is
 *     proved on a mirror: with no tiles fixed it finds two arrangements.
 *  4. Expert: the human-like solver (it reads only the start board's marks and fixes a word only when one fits) works
 *     out every Expert board, and refuses to guess on a board it can't.
 *  5. The tuning numbers: the kit's near-perfect and great play, graded by the server, on fixed seeds per level.
 *
 *   bun scripts/swapword-levels-check.ts
 */
import type { SwapwordPuzzleData } from "../src/lib/duel/types";
import { SWAPWORD_LEVEL_SETTINGS } from "../src/lib/levels/word/swapword";
import { swapwordLevelRuleBreak } from "../src/lib/duel/levels/swapword.server";
import { swapwordArrangements, swapwordDeduction, swapwordHumanSolves, swapwordOneArrangement } from "../src/lib/duel/levels/swapwordProof.server";
import { BEYOND, checkCount, commonLevelChecks, kitScore, ok, roomDeal } from "./word-levels-shared";

const t0 = Date.now();
const SEEDS = [11, 202, 3003, 40004, 500005, 6000006];
const deals = commonLevelChecks("swapword", "scripts/swapword-levels-check.ts", SEEDS, (level) => SWAPWORD_LEVEL_SETTINGS[level].timeLimitMs);

// 2–4. Rules, the one answer, Expert's solver.
for (const level of BEYOND) {
  const s = SWAPWORD_LEVEL_SETTINGS[level];
  for (const d of deals.get(level)! as SwapwordPuzzleData[]) {
    ok(swapwordLevelRuleBreak(d, s) === null, `swapword ${level}: board meets its rules (${swapwordLevelRuleBreak(d, s)})`);
    const greens = [...d.start].map((ch, t) => (ch === d.solution![t] ? ch : undefined));
    ok(swapwordArrangements(d.solution!, 3, greens) === 1, `swapword ${level}: one arrangement of six answer words keeps the green tiles`);
    ok(swapwordOneArrangement(d.start, d.solution!), `swapword ${level}: the one-answer test agrees`);
    if (s.humanSolvable) {
      ok(swapwordHumanSolves(d.start, d.solution!), `swapword ${level}: the human-like solver works the board out`);
      ok(swapwordDeduction(d.start, d.solution!).steps.every((step) => !step.guessed), `swapword ${level}: without a guess`);
    }
  }
}
// The search sees the mirror: with nothing fixed, a board's letters make at least its two mirrored arrangements.
const sample = deals.get("hard")![0] as SwapwordPuzzleData;
ok(swapwordArrangements(sample.solution!, 3) >= 2, "swapword: with no tile fixed the search finds the board's mirror too");
// A start whose only green tiles lie on the diagonal (cells 0, 21 and 35: tiles 0, 12 and 20) can't tell the mirror apart.
const onlyDiagonal = [...sample.solution!].map((ch, t) => ([0, 12, 20].includes(t) ? ch : "?"));
ok(swapwordArrangements(sample.solution!, 3, onlyDiagonal.map((c) => (c === "?" ? undefined : c))) >= 2, "swapword: diagonal greens alone leave the mirror open");
// The solver's line: six different words, one at a time, ending on the stored solution.
for (const d of deals.get("expert")! as SwapwordPuzzleData[]) {
  const line = swapwordDeduction(d.start, d.solution!);
  ok(line.steps.length === 6 && new Set(line.steps.map((step) => step.slot)).size === 6, "swapword expert: the reader fixes the six words one at a time");
  ok(line.known === d.solution, "swapword expert: the reader's words are the board's answer");
}

// 5. The tuning numbers (Joe's tool's bots and grading, on six fixed seeds).
const TUNE = [0, 1, 2, 3, 4, 5].map((n) => 9000 + n * 37);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const bands: Record<string, { near: number; great: number }> = {};
for (const level of ["easy", "normal", "hard", "expert"] as const) {
  const near: number[] = [];
  const great: number[] = [];
  for (const seed of TUNE) {
    const d = roomDeal("swapword", seed, level === "normal" ? undefined : level);
    near.push(kitScore("swapword", d, "near", `${level}:${seed}`).score);
    great.push(kitScore("swapword", d, "great", `${level}:${seed}`).score);
  }
  bands[level] = { near: avg(near), great: avg(great) };
}
// Tuned 16 Nov 2026 (Joe: a clear step up, Expert still scoring well for the near-perfect player): the near-perfect
// player scores well on every level, the great player steps down on Hard and Expert, whose clocks bite.
for (const level of ["easy", "normal", "hard", "expert"] as const) {
  ok(bands[level]!.near >= 190, `swapword ${level}: near-perfect averages ${bands[level]!.near.toFixed(1)} (at least 190)`);
}
ok(bands["easy"]!.great >= 185 && bands["normal"]!.great >= 185, "swapword: Easy and Normal are comfortable for the great player (185+)");
ok(bands["expert"]!.great < bands["normal"]!.great - 10, `swapword: Expert is a clear step up for the great player (${bands["expert"]!.great.toFixed(1)} against Normal's ${bands["normal"]!.great.toFixed(1)})`);
ok(bands["expert"]!.great >= 100, "swapword: the great player still scores on Expert (100+)");

console.log(`PASS: swapword levels — ${checkCount()} checks in ${((Date.now() - t0) / 1000).toFixed(1)} s (near-perfect ${["easy", "normal", "hard", "expert"].map((l) => `${l} ${bands[l]!.near.toFixed(0)}`).join(", ")})`);
