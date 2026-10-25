/**
 * Shared pieces of the word depth STRETCH checks (25 Oct 2026, docs/depth/d1-word.md): depth-tilegrid-check,
 * depth-codeword-check and depth-strikeout-check.
 *
 *   - legacy replay: room puzzles dealt on the pre-depth stamps, kit answers (nothing, spam, every level's final
 *     answer and a few drafts) and their graded score / isCorrect / extra, recorded on the code before the depth
 *     change (`--record`); the check regrades every stored case and fails on any difference;
 *   - the new stamp's distributions through scripts/depth-word-bands.ts.
 *
 * Script-only: floats are fine.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { pinPreDepth } from "../src/lib/duel/wordDepth";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";

export interface LegacyCase {
  seed: number;
  label: string;
  answer: string;
  ms: number;
  score: number;
  isCorrect: boolean;
  extra: unknown;
}

export interface LegacyFixture {
  type: PuzzleType;
  puzzles: Record<string, PuzzleData>;
  cases: LegacyCase[];
}

/** Room puzzles on the pre-depth stamps (pinned) for each seed. */
export function preDepthPuzzle(type: PuzzleType, seed: number): PuzzleData {
  pinPreDepth(true);
  try {
    return roomPuzzle(type, seed);
  } finally {
    pinPreDepth(false);
  }
}

export function recordLegacy(type: PuzzleType, seeds: number): LegacyFixture {
  const kit = KITS[type];
  if (!kit) throw new Error(`no kit for ${type}`);
  const puzzles: Record<string, PuzzleData> = {};
  const cases: LegacyCase[] = [];
  const push = (seed: number, label: string, puzzle: PuzzleData, answer: string, ms: number) => {
    const g = gradeAnswer(puzzle, answer, ms);
    cases.push({ seed, label, answer, ms, score: g.score, isCorrect: g.isCorrect, extra: JSON.parse(JSON.stringify(g.extra)) });
  };
  for (let s = 1; s <= seeds; s++) {
    const seed = 5200 + s;
    const puzzle = preDepthPuzzle(type, seed);
    puzzles[seed] = puzzle;
    const limit = puzzleTimeLimitMs(puzzle);
    push(seed, "nothing", puzzle, kit.nothing(puzzle), 0);
    const rng = makeRng(hashText(`${type}:depth-legacy:${seed}`));
    for (const sp of kit.spam(puzzle, rng, limit)) push(seed, `spam:${sp.label}`, puzzle, sp.answer, 0);
    for (const level of LEVELS) {
      const play = kit.play(puzzle, makeRng(hashText(`${type}:play:${seed}:${level}`)), SKILLS[level], limit);
      const steps = play.steps.filter((x) => x.atMs <= limit);
      if (!steps.length) continue;
      // A draft at a third and two thirds of the way, graded at the buzzer, and every step's time-left grade until it solves.
      for (const k of [Math.floor(steps.length / 3), Math.floor((2 * steps.length) / 3)]) push(seed, `${level}:draft${k}`, puzzle, steps[k]!.answer, 0);
      let done = false;
      for (const [i, step] of steps.entries()) {
        const ms = Math.max(0, limit - step.atMs);
        if (gradeAnswer(puzzle, step.answer, ms).isCorrect) {
          push(seed, `${level}:finish${i}`, puzzle, step.answer, ms);
          done = true;
          break;
        }
      }
      if (!done) push(seed, `${level}:buzzer`, puzzle, steps[steps.length - 1]!.answer, 0);
    }
  }
  return { type, puzzles, cases };
}

export function writeFixture(path: string, fixture: LegacyFixture): void {
  writeFileSync(path, gzipSync(JSON.stringify(fixture)));
}

export function readFixture(path: string): LegacyFixture {
  if (!existsSync(path)) throw new Error(`missing fixture ${path} (record with --record)`);
  return JSON.parse(gunzipSync(readFileSync(path)).toString("utf8")) as LegacyFixture;
}

/** Regrades every stored case; returns the differences. */
export function replayLegacy(fixture: LegacyFixture): { cases: number; diffs: string[] } {
  const diffs: string[] = [];
  for (const c of fixture.cases) {
    const g = gradeAnswer(fixture.puzzles[c.seed]!, c.answer, c.ms);
    const same = g.score === c.score && g.isCorrect === c.isCorrect && JSON.stringify(g.extra) === JSON.stringify(c.extra);
    if (!same && diffs.length < 10) diffs.push(`seed ${c.seed} ${c.label}: ${c.score}/${c.isCorrect} → ${g.score}/${g.isCorrect}`);
  }
  return { cases: fixture.cases.length, diffs };
}

/* ------------------------------------------------------------------ the new stamp */

export interface StretchCheckSpec {
  type: PuzzleType;
  fixture: string;
  /** The stamp field and its depth / pre-depth values (undefined = absent). */
  stamp: { field: string; depth: number; pre: number | undefined };
  /** The fraction of the clock left at today's 150 pace and at the depth's elite pace (clean finish). */
  fast: number;
  elite: number;
}

/**
 * Runs the shared part of a stretch check: legacy replay, the dealt stamp, and the new stamp's rules against the
 * same board on the pre-depth stamp (same unfinished score; a finish never below today's, at most 50 above, 150 at
 * today's pace and 200 at the elite pace with a clean answer; never less with more time left), plus the bands.
 * `ok` collects pass / fail lines.
 */
export async function runStretchCheck(spec: StretchCheckSpec, ok: (cond: boolean, msg: string) => void, extra?: (p: PuzzleData, pre: PuzzleData) => void): Promise<void> {
  const { type } = spec;
  if (process.argv.includes("--record")) {
    writeFixture(spec.fixture, recordLegacy(type, 20));
    console.log(`recorded ${spec.fixture}`);
  }
  // 1. Legacy replay.
  const legacy = replayLegacy(readFixture(spec.fixture));
  ok(legacy.diffs.length === 0 && legacy.cases > 100, `legacy: ${legacy.cases} pre-depth cases regrade exactly (${legacy.diffs.join("; ")})`);
  for (const p of Object.values(readFixture(spec.fixture).puzzles))
    ok((p as unknown as Record<string, unknown>)[spec.stamp.field] === spec.stamp.pre, `legacy fixture carries the pre-depth stamp`);
  const kit = KITS[type]!;
  for (let s = 1; s <= 15; s++) {
    const seed = 9300 + s;
    const p = roomPuzzle(type, seed);
    const stampOf = (x: PuzzleData) => (x as unknown as Record<string, unknown>)[spec.stamp.field];
    ok(stampOf(p) === spec.stamp.depth, `seed ${seed}: new rounds deal ${spec.stamp.field} ${spec.stamp.depth} (${String(stampOf(p))})`);
    const pinned = preDepthPuzzle(type, seed);
    ok(stampOf(pinned) === spec.stamp.pre, `seed ${seed}: pinned deals the pre-depth stamp`);
    // The same board under the old stamp.
    const pre = { ...(p as object) } as Record<string, unknown>;
    if (spec.stamp.pre === undefined) delete pre[spec.stamp.field];
    else pre[spec.stamp.field] = spec.stamp.pre;
    const old = pre as unknown as PuzzleData;
    ok(JSON.stringify({ ...pinned, [spec.stamp.field]: 0 }) === JSON.stringify({ ...old, [spec.stamp.field]: 0 }), `seed ${seed}: the depth board is the pre-depth board`);
    const limit = puzzleTimeLimitMs(p);
    const rng = makeRng(hashText(`${type}:depth-check:${seed}`));
    const answers = [kit.nothing(p), ...kit.spam(p, rng, limit).map((x) => x.answer)];
    let solved: string | null = null;
    for (const level of LEVELS) {
      const play = kit.play(p, makeRng(hashText(`${type}:play:${seed}:${level}`)), SKILLS[level], limit);
      for (const st of play.steps) answers.push(st.answer);
      const last = play.steps.at(-1)?.answer;
      if (last && gradeAnswer(p, last, limit / 2).isCorrect) solved = last;
    }
    for (const a of answers.filter((_, i) => i % 3 === 0 || i < 4)) {
      for (const ms of [0, Math.round(limit * 0.4), Math.round(limit * spec.fast), limit]) {
        const now = gradeAnswer(p, a, ms);
        const then = gradeAnswer(old, a, ms);
        ok(Number.isInteger(now.score) && now.score >= 0 && now.score <= 200, `seed ${seed}: score in 0–200 (${now.score})`);
        ok(now.isCorrect === then.isCorrect, `seed ${seed}: the same answers finish`);
        if (!now.isCorrect) ok(now.score === then.score && now.score <= 110, `seed ${seed}: unfinished scores as before (${then.score} → ${now.score})`);
        else ok(now.score >= then.score && now.score - then.score <= 50 && now.score >= 120, `seed ${seed}: a finish keeps today's score and adds at most 50 (${then.score} → ${now.score})`);
        const parts = (now.extra as { parts?: { base: number; efficiency?: number; speed?: number } } | null)?.parts;
        if (parts) ok(parts.base + (parts.efficiency ?? 0) + (parts.speed ?? 0) === now.score, `seed ${seed}: the breakdown adds up (${JSON.stringify(parts)} = ${now.score})`);
      }
    }
    if (solved) {
      let prev = -1;
      for (let k = 0; k <= 40; k++) {
        const ms = Math.round((limit * k) / 40);
        const g = gradeAnswer(p, solved, ms);
        ok(g.score >= prev, `seed ${seed}: more time left never scores less (${prev} → ${g.score} at ${ms} ms)`);
        prev = g.score;
      }
      extra?.(p, old);
    }
  }
  // 3. Bands.
  const { measureGame } = await import("./depth-word-bands");
  const g = measureGame(type, 30);
  const level = (id: string) => g.levels.find((l) => l.id === id)!;
  const good = level("good");
  ok(Math.abs(good.now.median - good.old.median) <= Math.max(3, good.old.median * 0.1), `bands: a solid (good) player stays within 10 % (${good.old.median} → ${good.now.median})`);
  const near = level("near");
  ok(near.now.median >= 145 && near.now.median <= 168, `bands: near-perfect median about 150–165 (${near.now.median})`);
  const elite = level("elite");
  ok(elite.now.best >= 190 && elite.now.best <= 200, `bands: the elite best reaches 190–200 (${elite.now.best})`);
  for (const id of ["average", "good", "great"]) ok(level(id).now.top10 <= 175, `bands: ${id} top 10 % stays at most 175 (${level(id).now.top10})`);
  console.log(g.levels.map((l) => `${l.id} ${l.old.median}/${l.old.top10}/${l.old.best} → ${l.now.median}/${l.now.top10}/${l.now.best}`).join(" · "));
}
