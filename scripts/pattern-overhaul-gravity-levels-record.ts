/**
 * Records Topsy-Turvy's Normal deals and grades before the difficulty levels (the Pattern overhaul, stage 3, 16 Nov
 * 2026), for pattern-overhaul-gravity-levels-check's "Normal is today's game" section. Run once on the tree before the
 * levels (it was: claude/elegant-planck-2iq51e at beb4ccf05, from a `git archive` copy of that commit):
 *
 *   bun scripts/pattern-overhaul-gravity-levels-record.ts [out]
 *
 * Writes scripts/fixtures/pattern-overhaul-gravity-levels-normal.json.gz (or [out]): rooms' and practice's Normal deals
 * on 8 seeds (with and without a bank seed) and 8 answers each graded by the server (gravityRev 8).
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { topsyStart, topsyTilt } from "../src/lib/duel/topsy";
import type { GravityDir, GravityPuzzleData } from "../src/lib/duel/types";

export const NORMAL_SEEDS = [3, 17, 404, 2026, 9001, 31337, 65537, 777777] as const;
const DIRS: GravityDir[] = ["U", "D", "L", "R"];

/** The answers graded on each deal (built from the stored routes only, so they rebuild the same on any tree). */
export function normalCases(p: GravityPuzzleData): { label: string; answer: string; msLeft: number }[] {
  const routes = p.boardSolutions ?? [];
  const b0 = p.boards![0]!;
  const wrong = DIRS.find((d) => d !== routes[0]![0] && topsyTilt(b0, new Set(b0.walls), topsyStart(b0), d).moved)!;
  const line = routes.join("");
  return [
    { label: "flawless-fast", answer: line, msLeft: 100_000 },
    { label: "flawless-slow", answer: line, msLeft: 40_000 },
    { label: "wasted-kept", answer: `${wrong}${line}`, msLeft: 70_000 },
    { label: "undone", answer: `${wrong}X${line}`, msLeft: 70_000 },
    { label: "reset", answer: `${wrong}${wrong === "U" ? "D" : "U"}Y${line}`, msLeft: 60_000 },
    { label: "half", answer: routes.slice(0, 2).join("") + routes[2]!.slice(0, 1), msLeft: 0 },
    { label: "empty", answer: "", msLeft: 0 },
    { label: "random", answer: Array.from({ length: 30 }, (_, i) => DIRS[(i * 7 + 3) % 4]!).join(""), msLeft: 0 },
  ];
}

export function dealNormal(seed: number, banked: boolean): GravityPuzzleData {
  return withSeededRandom(seed, () => generatePuzzle("gravity", banked ? { bankSeed: seed } : {})) as GravityPuzzleData;
}

if (import.meta.main) {
  const out = process.argv[2] ?? new URL("./fixtures/pattern-overhaul-gravity-levels-normal.json.gz", import.meta.url).pathname;
  const puzzles: { seed: number; banked: boolean; puzzle: GravityPuzzleData }[] = [];
  const cases: { seed: number; banked: boolean; label: string; answer: string; msLeft: number; score: number; isCorrect: boolean; extra: unknown }[] = [];
  for (const seed of NORMAL_SEEDS) {
    for (const banked of [true, false]) {
      const puzzle = dealNormal(seed, banked);
      puzzles.push({ seed, banked, puzzle });
      for (const c of normalCases(puzzle)) {
        const g = gradeAnswer(puzzle, c.answer, c.msLeft);
        cases.push({ seed, banked, ...c, score: g.score, isCorrect: g.isCorrect, extra: g.extra ?? null });
      }
    }
  }
  writeFileSync(out, gzipSync(JSON.stringify({ puzzles, cases })));
  console.log(`wrote ${out}: ${puzzles.length} deals, ${cases.length} graded answers`);
}
