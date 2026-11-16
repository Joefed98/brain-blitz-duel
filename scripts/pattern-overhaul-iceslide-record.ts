/**
 * Records pattern-overhaul-iceslide-check's legacy fixture (scripts/fixtures/pattern-overhaul-iceslide-legacy.json.gz):
 * Skid puzzles dealt on the stamps before the Pattern overhaul (slideRev 4 under `pinPrePatternNov15(true)`, and
 * slideRev 3 with the stricter par pinned off too), each with every kit level's answer (the kit's own undos included),
 * the flawless line's prefixes, its spam and hand-made answers holding Undo (X) and Reset (Y) markers, graded before
 * slideRev 5's change. The check regrades them on the branch and fails on any difference.
 *
 *   bun scripts/pattern-overhaul-iceslide-record.ts [--out=<path>]
 *
 * Recorded before the grading change (15 Nov 2026); never re-record over it.
 */
import { gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { pinPrePatternNov15 } from "../src/lib/duel/patternNov15";
import { pinPreParStrict } from "../src/lib/duel/parMoves";
import { SLIDE_DIRS, slideBoard, slideOutcome, type SlideState } from "../src/lib/duel/slide";
import type { PuzzleData, SlideDir, SlidePuzzleData } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { sentAnswer } from "./standard-lib";

export const ICESLIDE_LEGACY_SEEDS = [7200, 7213, 7226, 7239, 7252, 7265];
export const ICESLIDE_LEGACY_ERAS = ["rev4", "rev3"] as const;
export type LegacyEra = (typeof ICESLIDE_LEGACY_ERAS)[number];

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

/** Deals a Skid puzzle on the era's stamps (the pins restored after). */
export function dealEra(era: LegacyEra, seed: number): SlidePuzzleData {
  const a = pinPrePatternNov15(true);
  const b = era === "rev3" ? pinPreParStrict(true) : null;
  try {
    return withSeededRandom(seed, () => generatePuzzle("iceslide", { bankSeed: seed })) as SlidePuzzleData;
  } finally {
    pinPrePatternNov15(a);
    if (b !== null) pinPreParStrict(b);
  }
}

/** A slide that moves the ball other than `avoid` (the first found, deterministic). */
function otherSlide(p: SlidePuzzleData, state: SlideState, avoid: SlideDir | undefined): SlideDir | null {
  const board = slideBoard(p);
  for (const d of SLIDE_DIRS) {
    if (d === avoid) continue;
    if (slideOutcome(board, state.cell, state.mask, d).path.length) return d;
  }
  return null;
}

/** Hand-made answers with Undo and Reset markers, built from the stored solution alone. */
export function markerAnswers(p: SlidePuzzleData): { label: string; answer: string; msLeft: number }[] {
  const line = (p.solution ?? "").split("") as SlideDir[];
  const out: { label: string; answer: string; msLeft: number }[] = [];
  if (!line.length) return out;
  const board = slideBoard(p);
  const stateAt = (k: number): SlideState => {
    let s: SlideState = { cell: p.start, mask: 0 };
    for (const d of line.slice(0, k)) {
      const o = slideOutcome(board, s.cell, s.mask, d);
      if (o.path.length) s = { cell: o.cell, mask: o.mask };
    }
    return s;
  };
  for (const at of [0, Math.floor(line.length / 2), line.length - 1]) {
    const wrong = otherSlide(p, stateAt(at), line[at]);
    if (!wrong) continue;
    out.push({ label: `undo at ${at}`, answer: [...line.slice(0, at), wrong, "X", ...line.slice(at)].join(""), msLeft: 30_000 });
  }
  {
    const w1 = otherSlide(p, stateAt(0), line[0]);
    if (w1) {
      const o = slideOutcome(board, p.start, 0, w1);
      const w2 = otherSlide(p, { cell: o.cell, mask: o.mask }, undefined);
      const moves = w2 ? [w1, w2, "X", "X", ...line] : [w1, "X", ...line];
      out.push({ label: "double undo", answer: moves.join(""), msLeft: 25_000 });
    }
  }
  const half = line.slice(0, Math.ceil(line.length / 2));
  out.push({ label: "reset then line", answer: [...half, "Y", ...line].join(""), msLeft: 20_000 });
  out.push({ label: "half then undo", answer: [...half, "X"].join(""), msLeft: 0 });
  out.push({ label: "half then reset", answer: [...half, "Y"].join(""), msLeft: 0 });
  out.push({ label: "undo on start", answer: ["X", "Y", ...line].join(""), msLeft: 35_000 });
  // Every direction once from the start, each undone, then the line (wall bumps included: no slide, no marker needed).
  out.push({ label: "probe then line", answer: [...SLIDE_DIRS.flatMap((d) => [d, "X"]), ...line].join(""), msLeft: 28_000 });
  return out;
}

/** Every case for one era and seed (answers built from the dealt puzzle alone, so the check rebuilds the same). */
export function casesFor(era: LegacyEra, seed: number, p: SlidePuzzleData): Omit<LegacyCase, "score" | "isCorrect" | "extra">[] {
  const out: Omit<LegacyCase, "score" | "isCorrect" | "extra">[] = [];
  const limit = puzzleTimeLimitMs(p as PuzzleData);
  const kit = KITS.iceslide!;
  const flawless = kit.play(p, makeRng(hashText(`poi:${era}:${seed}:line`)), { ...SKILLS.near, err: 0 }, limit).steps;
  for (const i of [0, Math.floor(flawless.length / 2), flawless.length - 1]) {
    if (i < 0 || !flawless[i]) continue;
    out.push({ era, seed, label: `line ${i + 1}`, answer: sentAnswer(p, flawless.slice(0, i + 1)), msLeft: i === flawless.length - 1 ? Math.max(0, limit - flawless[i]!.atMs) : 0 });
  }
  for (const level of LEVELS) {
    const play = kit.play(p, makeRng(hashText(`poi:${era}:${seed}:${level}`)), SKILLS[level], limit);
    const steps = play.steps.filter((s) => s.atMs <= limit);
    const last = steps[steps.length - 1];
    if (last) out.push({ era, seed, label: level, answer: sentAnswer(p, steps), msLeft: play.solved ? Math.max(0, limit - last.atMs) : 0 });
  }
  for (const sp of kit.spam(p, makeRng(hashText(`poi:${era}:spam:${seed}`)), limit)) out.push({ era, seed, label: `spam ${sp.label}`, answer: sp.answer, msLeft: 0 });
  for (const m of markerAnswers(p)) out.push({ era, seed, ...m });
  return out;
}

if (import.meta.main) {
  const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "scripts/fixtures/pattern-overhaul-iceslide-legacy.json.gz";
  const cases: LegacyCase[] = [];
  const puzzles: { era: LegacyEra; seed: number; puzzle: SlidePuzzleData }[] = [];
  for (const era of ICESLIDE_LEGACY_ERAS) {
    for (const seed of ICESLIDE_LEGACY_SEEDS) {
      const p = dealEra(era, seed);
      puzzles.push({ era, seed, puzzle: p });
      for (const c of casesFor(era, seed, p)) {
        const g = gradeAnswer(p, c.answer, c.msLeft);
        cases.push({ ...c, score: g.score, isCorrect: g.isCorrect, extra: g.extra ?? null });
      }
    }
  }
  writeFileSync(out, gzipSync(JSON.stringify({ puzzles, cases })));
  const stamps = [...new Set(puzzles.map((x) => `${x.era}:${x.puzzle.slideRev}`))].join(" ");
  console.log(`wrote ${out}: ${puzzles.length} puzzles (${stamps}), ${cases.length} cases`);
}
