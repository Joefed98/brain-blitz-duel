/**
 * Records partial-credit-check's legacy fixture (scripts/fixtures/partial-credit-legacy.json.gz): on a main checkout
 * (before src/lib/duel/partialCredit.ts), the seven games' rooms deal the stamps before the fixes; for each of a few
 * seeds it stores the dealt puzzle and the grades of every prefix of a flawless line, every kit level's answer and the
 * kit's spam (Gradient: its own route players and random swaps). partial-credit-check regrades them on the branch and
 * fails on any difference, so those stamps score exactly as before.
 *
 *   bun scripts/partial-credit-record.ts [--out=<path>]     (run it in a main worktree, then copy the file over)
 *
 * It uses only modules that exist on main.
 */
import { gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { encodeGradient, gradientLocked, gradientSwap, jumbledSolved, type GradientSwap } from "../src/lib/duel/jumbled";
import { gradientRoute } from "../src/lib/duel/jumbled.server";
import type { PuzzleData, PuzzleType, TilesPuzzleData } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { sentAnswer } from "./standard-lib";

export const PARTIAL_CREDIT_TYPES: PuzzleType[] = ["lightsout", "tower", "tubes", "unblock", "rings", "target", "tiles"];
export const PARTIAL_CREDIT_SEEDS = [6100, 6107, 6114, 6121, 6128, 6135];

export interface LegacyCase {
  type: PuzzleType;
  seed: number;
  label: string;
  answer: string;
  msLeft: number;
  score: number;
  isCorrect: boolean;
}

export function dealFor(type: PuzzleType, seed: number): PuzzleData {
  // Gradient is dealt live (the kit's roomPuzzle deals the D5 remodels' older boards).
  if (type === "tiles") return withSeededRandom(seed, () => generatePuzzle("tiles", { bankSeed: seed }));
  return roomPuzzle(type, seed);
}

/** Gradient: the route with `err` random swaps mixed in (seeded), every draft. */
export function gradientDrafts(p: TilesPuzzleData, err: number, rngSeed: number, cap = 200): string[] {
  const rng = makeRng(rngSeed);
  let frame = [...p.frame];
  const swaps: GradientSwap[] = [];
  const out: string[] = [];
  while (!jumbledSolved(frame) && swaps.length < cap) {
    let swap: GradientSwap;
    const free = frame.map((_, c) => c).filter((c) => !gradientLocked(frame, c));
    if (rng.chance(err)) {
      const a = rng.pick(free);
      swap = { a, b: rng.pick(free.filter((c) => c !== a)) };
    } else {
      const n = gradientRoute(frame)[0]!;
      swap = { a: Math.floor(n / 100), b: n % 100 };
    }
    const next = gradientSwap(frame, swap);
    if (!next) continue;
    frame = next;
    swaps.push(swap);
    out.push(encodeGradient(swaps));
  }
  return out;
}

/** The cases for one game and seed (answers built from the dealt puzzle alone, so the branch rebuilds the same). */
export function casesFor(type: PuzzleType, seed: number, p: PuzzleData): Omit<LegacyCase, "score" | "isCorrect">[] {
  const out: Omit<LegacyCase, "score" | "isCorrect">[] = [];
  const limit = puzzleTimeLimitMs(p);
  if (type === "tiles") {
    const line = gradientDrafts(p as TilesPuzzleData, 0, hashText(`pcr:${seed}:line`));
    line.forEach((a, i) => out.push({ type, seed, label: `line ${i + 1}`, answer: a, msLeft: i === line.length - 1 ? 40_000 : 0 }));
    for (const err of [0.15, 0.4, 1]) {
      const d = gradientDrafts(p as TilesPuzzleData, err, hashText(`pcr:${seed}:${err}`));
      const last = d[d.length - 1] ?? "";
      out.push({ type, seed, label: `err ${err}`, answer: last, msLeft: 0 });
      out.push({ type, seed, label: `err ${err} half`, answer: d[Math.floor(d.length / 2)] ?? "", msLeft: 0 });
    }
    return out;
  }
  const kit = KITS[type]!;
  const flawless = kit.play(p, makeRng(hashText(`pcr:${type}:${seed}:line`)), { ...SKILLS.near, err: 0 }, limit).steps;
  flawless.forEach((s, i) => out.push({ type, seed, label: `line ${i + 1}`, answer: sentAnswer(p, flawless.slice(0, i + 1)), msLeft: i === flawless.length - 1 ? Math.max(0, limit - s.atMs) : 0 }));
  for (const level of LEVELS) {
    const play = kit.play(p, makeRng(hashText(`pcr:${type}:${seed}:${level}`)), SKILLS[level], limit);
    const steps = play.steps.filter((s) => s.atMs <= limit);
    if (steps.length) out.push({ type, seed, label: level, answer: sentAnswer(p, steps), msLeft: 0 });
  }
  for (const sp of kit.spam(p, makeRng(hashText(`pcr:${type}:spam:${seed}`)), limit)) out.push({ type, seed, label: `spam ${sp.label}`, answer: sp.answer, msLeft: 0 });
  return out;
}

if (import.meta.main) {
  const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "scripts/fixtures/partial-credit-legacy.json.gz";
  const cases: LegacyCase[] = [];
  const puzzles: { type: PuzzleType; seed: number; puzzle: PuzzleData }[] = [];
  for (const type of PARTIAL_CREDIT_TYPES) {
    for (const seed of PARTIAL_CREDIT_SEEDS) {
      const p = dealFor(type, seed);
      puzzles.push({ type, seed, puzzle: p });
      for (const c of casesFor(type, seed, p)) {
        const g = gradeAnswer(p, c.answer, c.msLeft);
        cases.push({ ...c, score: g.score, isCorrect: g.isCorrect });
      }
    }
  }
  writeFileSync(out, gzipSync(JSON.stringify({ puzzles, cases })));
  console.log(`wrote ${out}: ${puzzles.length} puzzles, ${cases.length} cases`);
}
