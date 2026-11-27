/**
 * Records Topsy-Turvy's Normal grades on today's stamp (gravityRev 8), before the D4 Normal scoring stamp gravityRev 9
 * (22 Nov 2026, Joe's option A: Normal's full-speed time 32 s → 40 s; src/lib/duel/topsyLine.ts), into
 * scripts/fixtures/topsy-line-legacy.json.gz. topsy-line-check regrades every case and fails on any difference, so a
 * stored gravityRev 8 round scores exactly as it did.
 *
 *   bun scripts/topsy-line-legacy-record.ts            (run on the tree before gravityRev 9; refuses to overwrite)
 *   bun scripts/topsy-line-legacy-record.ts --overwrite
 *
 * Each case: a Normal deal (rooms' bank seed), an answer (the stored solution, the first board only, nothing, the
 * solution with a wasted tilt on each board) and a time left; the stored grade's score, correctness and extra.
 */
import { existsSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import type { GravityPuzzleData } from "../src/lib/duel/types";

const OUT = "scripts/fixtures/topsy-line-legacy.json.gz";
if (existsSync(OUT) && !process.argv.includes("--overwrite")) {
  console.error(`${OUT} exists: it is the record of today's stamp; pass --overwrite only to re-record on the tree before gravityRev 9`);
  process.exit(2);
}

const SEEDS = 40;
const MS_LEFT = [120_000, 92_000, 88_000, 80_000, 75_000, 60_000, 30_000, 1_000, 0];
const cases: { seed: number; answer: string; msLeft: number; score: number; isCorrect: boolean; extra: unknown }[] = [];
const puzzles: Record<number, GravityPuzzleData> = {};
for (let seed = 0; seed < SEEDS; seed++) {
  const p = withSeededRandom(0x70b5 + seed, () => generatePuzzle("gravity", { bankSeed: (seed * 7919 + 13) >>> 0 })) as GravityPuzzleData;
  if (p.gravityRev !== 8) throw new Error(`seed ${seed}: dealt gravityRev ${p.gravityRev}, not 8: record on the tree before gravityRev 9`);
  puzzles[seed] = p;
  const sols = p.boardSolutions ?? [];
  const answers = [sols.join(""), sols[0] ?? "", "", sols.map((s) => (s.length ? `${s[0]}${s}` : s)).join("")];
  for (const answer of answers) {
    for (const msLeft of MS_LEFT) {
      const g = gradeAnswer(p, answer, msLeft);
      cases.push({ seed, answer, msLeft, score: g.score, isCorrect: g.isCorrect, extra: g.extra ?? null });
    }
  }
}
writeFileSync(OUT, gzipSync(JSON.stringify({ recorded: "22 Nov 2026, gravityRev 8 (before the D4 Normal stamp)", puzzles, cases })));
console.log(`wrote ${OUT}: ${SEEDS} deals, ${cases.length} grades`);
