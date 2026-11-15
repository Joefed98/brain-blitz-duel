/**
 * Records pattern-overhaul-gravity-check's legacy fixture (scripts/fixtures/pattern-overhaul-gravity-legacy.json.gz):
 * Topsy-Turvy puzzles dealt on the stamps before the Pattern overhaul (gravityRev 7 under `pinPrePatternNov15(true)`,
 * and gravityRev 6 with the stricter par pinned off too), each with hand-made answers built from the stored routes
 * alone (the routes, their prefixes, wrong tilts with Undo (X) and Reset (Y), tilts that move nothing, seeded random
 * tilting, out-of-tilts runs), graded before gravityRev 8's change. The check regrades them on the branch and fails on
 * any difference.
 *
 *   bun scripts/pattern-overhaul-gravity-record.ts [--out=<path>]
 *
 * Recorded before the grading change (15 Nov 2026); never re-record over it.
 */
import { gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { pinPrePatternNov15 } from "../src/lib/duel/patternNov15";
import { pinPreParStrict } from "../src/lib/duel/parMoves";
import { topsyStart, topsyTilt } from "../src/lib/duel/topsy";
import type { GravityDir, GravityPuzzleData } from "../src/lib/duel/types";
import { hashText, makeRng } from "./puzzle-fairness/kit";

export const GRAVITY_LEGACY_SEEDS = [8100, 8117, 8134, 8151, 8168, 8185];
export const GRAVITY_LEGACY_ERAS = ["rev7", "rev6"] as const;
export type LegacyEra = (typeof GRAVITY_LEGACY_ERAS)[number];

export interface LegacyCase {
  era: LegacyEra;
  seed: number;
  label: string;
  answer: string;
  msLeft: number;
  score: number;
  isCorrect: boolean;
  extra: unknown;
}

/** Deals a Topsy-Turvy puzzle on the era's stamps (the pins restored after). */
export function dealEra(era: LegacyEra, seed: number): GravityPuzzleData {
  const a = pinPrePatternNov15(true);
  const b = era === "rev6" ? pinPreParStrict(true) : null;
  try {
    return withSeededRandom(seed, () => generatePuzzle("gravity", { bankSeed: seed })) as GravityPuzzleData;
  } finally {
    pinPrePatternNov15(a);
    if (b !== null) pinPreParStrict(b);
  }
}

const DIRS: GravityDir[] = ["U", "D", "L", "R"];

/** A tilt that moves nothing on the board's start, if any. */
function deadTilt(p: GravityPuzzleData, board: number): GravityDir | null {
  const b = p.boards![board]!;
  for (const d of DIRS) if (!topsyTilt(b, new Set(b.walls), topsyStart(b), d).moved) return d;
  return null;
}

/** A tilt that moves something but is not the route's first. */
function wrongTilt(p: GravityPuzzleData, board: number): GravityDir | null {
  const b = p.boards![board]!;
  const first = (p.boardSolutions?.[board] ?? "")[0];
  for (const d of DIRS) if (d !== first && topsyTilt(b, new Set(b.walls), topsyStart(b), d).moved) return d;
  return null;
}

/** Every case for one era and seed (answers built from the dealt puzzle alone, so the check rebuilds the same). */
export function casesFor(era: LegacyEra, seed: number, p: GravityPuzzleData): Omit<LegacyCase, "score" | "isCorrect" | "extra">[] {
  const out: Omit<LegacyCase, "score" | "isCorrect" | "extra">[] = [];
  const add = (label: string, answer: string, msLeft: number) => out.push({ era, seed, label, answer, msLeft });
  const routes = p.boardSolutions ?? [];
  const line = routes.join("");
  add("routes fast", line, 100_000);
  add("routes steady", line, 60_000);
  add("routes late", line, 5_000);
  add("first board", routes[0] ?? "", 0);
  add("two boards", (routes[0] ?? "") + (routes[1] ?? ""), 0);
  add("half the first board", (routes[0] ?? "").slice(0, Math.ceil((routes[0] ?? "").length / 2)), 0);
  const w0 = wrongTilt(p, 0);
  if (w0) {
    add("wrong then undo", `${w0}X${line}`, 70_000);
    add("wrong twice then undo twice", `${w0}${w0 === "U" ? "D" : "U"}XX${line}`, 65_000);
    add("wrong then reset", `${w0}${w0 === "L" ? "R" : "L"}Y${line}`, 55_000);
    add("wrong then undo, unfinished", `${w0}X${routes[0] ?? ""}`, 0);
  }
  add("undo and reset on the start", `XY${line}`, 80_000);
  add("route, undo the last, redo it", `${line.slice(0, -1)}X${line.slice(-2, -1)}${line.slice(-1)}`, 40_000);
  const dead = deadTilt(p, 0);
  if (dead) add("dead tilts first", `${dead}${dead}${line}`, 75_000);
  // Seeded random tilting (no Undo), long enough to run out of tilts on some boards.
  for (const n of [6, 20, 60]) {
    const rng = makeRng(hashText(`pog:${era}:${seed}:${n}`));
    let s = "";
    for (let i = 0; i < n; i++) s += DIRS[Math.floor(rng.next() * 4)]!;
    add(`random ${n}`, s, 0);
  }
  // Random tilting with undos mixed in.
  {
    const rng = makeRng(hashText(`pog:${era}:${seed}:undo`));
    let s = "";
    for (let i = 0; i < 40; i++) s += rng.next() < 0.25 ? "X" : DIRS[Math.floor(rng.next() * 4)]!;
    add("random with undos", s, 0);
  }
  return out;
}

if (import.meta.main) {
  const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "scripts/fixtures/pattern-overhaul-gravity-legacy.json.gz";
  const cases: LegacyCase[] = [];
  const puzzles: { era: LegacyEra; seed: number; puzzle: GravityPuzzleData }[] = [];
  for (const era of GRAVITY_LEGACY_ERAS) {
    for (const seed of GRAVITY_LEGACY_SEEDS) {
      const p = dealEra(era, seed);
      puzzles.push({ era, seed, puzzle: p });
      for (const c of casesFor(era, seed, p)) {
        const g = gradeAnswer(p, c.answer, c.msLeft);
        cases.push({ ...c, score: g.score, isCorrect: g.isCorrect, extra: g.extra ?? null });
      }
    }
  }
  writeFileSync(out, gzipSync(JSON.stringify({ puzzles, cases })));
  const stamps = [...new Set(puzzles.map((x) => `${x.era}:${x.puzzle.gravityRev}`))].join(" ");
  console.log(`wrote ${out}: ${puzzles.length} puzzles (${stamps}), ${cases.length} cases`);
}
