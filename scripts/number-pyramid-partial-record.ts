/**
 * Records number-pyramid-partial-check's legacy fixture (scripts/fixtures/number-pyramid-partial-legacy.json.gz): on main
 * (before Integer Pyramid's depthRev 3, D2, 22 Nov 2026), Integer Pyramid at every level deals today's stamp (depthRev 2,
 * the scoring standard's). For each of a few seeds a level it stores the dealt puzzle itself and the grades of every
 * prefix of a flawless line, every kit level's answer as the phone sends it (with its draft timeline), and the kit's
 * spam. number-pyramid-partial-check regrades those stored puzzles on the branch and fails on any difference, so
 * depthRev 2 rounds score exactly as before.
 *
 *   bun scripts/number-pyramid-partial-record.ts [--out=<path>]     (on a main checkout)
 *
 * It uses only modules that exist on main.
 */
import { gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { npEncodeRound, type NpPlacements } from "../src/lib/duel/numberPyramid";
import type { NumberPyramidPuzzleData, PuzzleData } from "../src/lib/duel/types";
import type { Level } from "../src/lib/levels/levels";
import { KITS } from "./puzzle-fairness/kits";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { sentAnswer } from "./standard-lib";

export const PYRAMID_LEGACY_LEVELS: readonly Level[] = ["normal", "easy", "hard", "expert"];
export const PYRAMID_LEGACY_SEEDS = [8100, 8107, 8114, 8121, 8128];

export interface PyramidLegacyCase {
  level: Level;
  seed: number;
  label: string;
  answer: string;
  msLeft: number;
  score: number;
  isCorrect: boolean;
  extra: unknown;
}

export interface PyramidLegacyFixture {
  puzzles: Record<string, PuzzleData>;
  cases: PyramidLegacyCase[];
}

export function pyramidDeal(level: Level, seed: number): PuzzleData {
  return withSeededRandom(seed, () => generatePuzzle("numpyramid", { bankSeed: seed, ...(level !== "normal" ? { level } : {}) }));
}

/** Every prefix of a flawless line (stones in board order, then the next board), each as the phone's draft. */
function flawlessDrafts(p: NumberPyramidPuzzleData): string[] {
  const boards: NpPlacements[] = p.pyramids.map(() => ({}));
  const out: string[] = [];
  p.pyramids.forEach((b, i) => {
    const used = new Set<number>();
    b.givens.forEach((g, cell) => {
      if (g != null) return;
      const t = b.tray.findIndex((v, k) => v === p.solutions?.[i]?.[cell] && !used.has(k));
      used.add(t);
      boards[i]![cell] = t;
      out.push(npEncodeRound(i, boards));
    });
    out.push(npEncodeRound(i + 1, boards));
  });
  return out;
}

/** The cases for one stored puzzle (answers built from the puzzle alone, so the check rebuilds the same). */
export function pyramidCases(level: Level, seed: number, p: PuzzleData): Omit<PyramidLegacyCase, "score" | "isCorrect" | "extra">[] {
  const out: Omit<PyramidLegacyCase, "score" | "isCorrect" | "extra">[] = [];
  const limit = puzzleTimeLimitMs(p);
  const drafts = flawlessDrafts(p as NumberPyramidPuzzleData);
  drafts.forEach((d, i) => {
    const timed = drafts.slice(0, i + 1).map((answer, k) => ({ answer, atMs: (k + 1) * 1500 }));
    out.push({ level, seed, label: `line ${i + 1}`, answer: sentAnswer(p, timed), msLeft: 0 });
    out.push({ level, seed, label: `line ${i + 1} bare`, answer: d, msLeft: 0 });
  });
  const last = drafts.map((answer, k) => ({ answer, atMs: (k + 1) * 1500 }));
  for (const ms of [0, 30_000, Math.max(0, limit - 40_000)]) out.push({ level, seed, label: `finish ${ms}`, answer: sentAnswer(p, last), msLeft: ms });
  const kit = KITS.numpyramid!;
  for (const lv of LEVELS) {
    const play = kit.play(p, makeRng(hashText(`npr:${level}:${seed}:${lv}`)), SKILLS[lv], limit);
    const inTime = play.steps.filter((s) => s.atMs <= limit);
    if (!inTime.length) continue;
    out.push({ level, seed, label: `kit ${lv}`, answer: sentAnswer(p, inTime), msLeft: 0 });
    out.push({ level, seed, label: `kit ${lv} half`, answer: sentAnswer(p, inTime.slice(0, Math.ceil(inTime.length / 2))), msLeft: 0 });
  }
  for (const s of kit.spam(p, makeRng(hashText(`npr:${level}:${seed}:spam`)), limit)) out.push({ level, seed, label: `spam ${s.label}`, answer: s.answer, msLeft: 0 });
  out.push({ level, seed, label: "nothing", answer: kit.nothing(p), msLeft: 0 });
  return out;
}

export const keyOf = (level: Level, seed: number) => `${level}:${seed}`;

if (import.meta.main) {
  const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "scripts/fixtures/number-pyramid-partial-legacy.json.gz";
  const fixture: PyramidLegacyFixture = { puzzles: {}, cases: [] };
  for (const level of PYRAMID_LEGACY_LEVELS)
    for (const seed of PYRAMID_LEGACY_SEEDS) {
      const p = pyramidDeal(level, seed);
      fixture.puzzles[keyOf(level, seed)] = p;
      for (const c of pyramidCases(level, seed, p)) {
        const g = gradeAnswer(p, c.answer, c.msLeft);
        fixture.cases.push({ ...c, score: g.score, isCorrect: g.isCorrect, extra: g.extra ?? null });
      }
    }
  writeFileSync(out, gzipSync(JSON.stringify(fixture)));
  const stamps = new Set(Object.values(fixture.puzzles).map((p) => (p as { depthRev?: number }).depthRev));
  console.log(`${fixture.cases.length} cases on ${Object.keys(fixture.puzzles).length} puzzles (depthRev ${[...stamps].join(", ")}) → ${out}`);
}
