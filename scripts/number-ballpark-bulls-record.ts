/**
 * Records number-ballpark-bulls-check's legacy fixture (scripts/fixtures/number-ballpark-bulls-legacy.json.gz): on main
 * (before Ballpark's depthRev 3, D2, 22 Nov 2026), Ballpark at every level deals the scoring standard's stamp
 * (depthRev 2), where a bullseye is worth 2. For each of a few seeds a level it stores the dealt puzzle itself and the
 * grades of: every prefix of an exact line, finished lines placed a set share of the line off (inside and outside the
 * bullseye and full-points windows), every kit level's answer as the phone sends it (with its draft timeline), the
 * kit's spam and nothing. number-ballpark-bulls-check regrades those stored puzzles on the branch and fails on any
 * difference, so depthRev 2 rounds score exactly as before.
 *
 *   bun scripts/number-ballpark-bulls-record.ts [--out=<path>]     (on a main checkout)
 *
 * It uses only modules that exist on main.
 */
import { gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { encodeNumline, numlineShare, numlineValue, NUMLINE_SCALE } from "../src/lib/duel/numline";
import type { NumlinePuzzleData, PuzzleData } from "../src/lib/duel/types";
import type { Level } from "../src/lib/levels/levels";
import { KITS } from "./puzzle-fairness/kits";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { sentAnswer } from "./standard-lib";

export const BALLPARK_LEGACY_LEVELS: readonly Level[] = ["normal", "easy", "hard", "expert"];
export const BALLPARK_LEGACY_SEEDS = [8200, 8207, 8214, 8221, 8228];
/** Finished lines with every number this share of the line off (alternating sides), as the check rebuilds them. */
export const BALLPARK_LEGACY_OFFSETS = [0, 0.004, 0.009, 0.012, 0.019, 0.03, 0.08, 0.3];

export interface BallparkLegacyCase {
  level: Level;
  seed: number;
  label: string;
  answer: string;
  msLeft: number;
  score: number;
  isCorrect: boolean;
  extra: unknown;
}

export interface BallparkLegacyFixture {
  puzzles: Record<string, PuzzleData>;
  cases: BallparkLegacyCase[];
}

export function ballparkDeal(level: Level, seed: number): PuzzleData {
  return withSeededRandom(seed, () => generatePuzzle("numline", { bankSeed: seed, ...(level !== "normal" ? { level } : {}) }));
}

/** Every number's true place, 0–10,000, in play order. */
export function ballparkTruths(p: NumlinePuzzleData): number[] {
  const out: number[] = [];
  p.stages.forEach((stage, s) => {
    stage.items.forEach((_, i) => {
      const value = p.values?.[s]?.[i];
      out.push(value ? Math.round(numlineShare(stage, numlineValue(value)) * NUMLINE_SCALE) : NUMLINE_SCALE / 2);
    });
  });
  return out;
}

/** Each true place moved `share` of the line off, alternating sides, kept on the line. */
export function ballparkOff(truths: readonly number[], share: number): number[] {
  return truths.map((t, k) => {
    const d = Math.round(share * NUMLINE_SCALE) * (k % 2 ? -1 : 1);
    const moved = t + d;
    return Math.max(0, Math.min(NUMLINE_SCALE, moved < 0 || moved > NUMLINE_SCALE ? t - d : moved));
  });
}

/** The cases for one stored puzzle (answers built from the puzzle alone, so the check rebuilds the same). */
export function ballparkCases(level: Level, seed: number, p: PuzzleData): Omit<BallparkLegacyCase, "score" | "isCorrect" | "extra">[] {
  const out: Omit<BallparkLegacyCase, "score" | "isCorrect" | "extra">[] = [];
  const limit = puzzleTimeLimitMs(p);
  const truths = ballparkTruths(p as NumlinePuzzleData);
  const timed = (places: readonly number[]) => places.map((_, k) => ({ answer: encodeNumline(places.slice(0, k + 1)), atMs: (k + 1) * 1800 }));
  for (let n = 1; n < truths.length; n++) {
    out.push({ level, seed, label: `prefix ${n}`, answer: sentAnswer(p, timed(truths.slice(0, n))), msLeft: 0 });
    out.push({ level, seed, label: `prefix ${n} bare`, answer: encodeNumline(truths.slice(0, n)), msLeft: 0 });
  }
  for (const share of BALLPARK_LEGACY_OFFSETS) {
    const places = ballparkOff(truths, share);
    for (const ms of [0, 20_000, Math.max(0, limit - 40_000), limit - 10_000]) out.push({ level, seed, label: `off ${share} at ${ms}`, answer: sentAnswer(p, timed(places)), msLeft: ms });
  }
  const kit = KITS.numline!;
  for (const lv of LEVELS) {
    const play = kit.play(p, makeRng(hashText(`bpr:${level}:${seed}:${lv}`)), SKILLS[lv], limit);
    const inTime = play.steps.filter((s) => s.atMs <= limit);
    if (!inTime.length) continue;
    const left = Math.max(0, limit - inTime[inTime.length - 1]!.atMs);
    out.push({ level, seed, label: `kit ${lv}`, answer: sentAnswer(p, inTime), msLeft: left });
    out.push({ level, seed, label: `kit ${lv} half`, answer: sentAnswer(p, inTime.slice(0, Math.ceil(inTime.length / 2))), msLeft: 0 });
  }
  for (const s of kit.spam(p, makeRng(hashText(`bpr:${level}:${seed}:spam`)), limit)) out.push({ level, seed, label: `spam ${s.label}`, answer: s.answer, msLeft: 0 });
  out.push({ level, seed, label: "nothing", answer: kit.nothing(p), msLeft: 0 });
  return out;
}

export const keyOf = (level: Level, seed: number) => `${level}:${seed}`;

if (import.meta.main) {
  const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "scripts/fixtures/number-ballpark-bulls-legacy.json.gz";
  const fixture: BallparkLegacyFixture = { puzzles: {}, cases: [] };
  for (const level of BALLPARK_LEGACY_LEVELS)
    for (const seed of BALLPARK_LEGACY_SEEDS) {
      const p = ballparkDeal(level, seed);
      fixture.puzzles[keyOf(level, seed)] = p;
      for (const c of ballparkCases(level, seed, p)) {
        const g = gradeAnswer(p, c.answer, c.msLeft);
        fixture.cases.push({ ...c, score: g.score, isCorrect: g.isCorrect, extra: g.extra ?? null });
      }
    }
  writeFileSync(out, gzipSync(JSON.stringify(fixture)));
  const stamps = new Set(Object.values(fixture.puzzles).map((p) => (p as { depthRev?: number }).depthRev));
  console.log(`${fixture.cases.length} cases on ${Object.keys(fixture.puzzles).length} puzzles (depthRev ${[...stamps].join(", ")}) → ${out}`);
}
