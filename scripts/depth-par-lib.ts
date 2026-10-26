/**
 * Shared by depth-wordslide-check and depth-swapword-check (word depth d1, 25 Oct 2026; docs/depth/d1-word.md):
 * legacy replay fixtures of the stamps rooms dealt before the par features, recorded from the puzzle-fairness kit
 * players through the real server grader, and regraded by the checks. Script-only.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { gradeAnswer, gradeAnswer as grade } from "../src/lib/duel/generate.server";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { storedScoreParts } from "../src/lib/duel/puzzleScoreRev";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { pinPreDepth } from "../src/lib/duel/wordDepth";
import { measureGame } from "./depth-word-bands";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
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
  extra: Record<string, unknown> | null;
}

export interface LegacyFixture {
  type: PuzzleType;
  puzzles: Record<string, PuzzleData>;
  cases: LegacyCase[];
}

/** Kit answers on room seeds: nothing, every spam, every level's steps (sampled) at their own time and at 0. */
export function recordLegacy(type: PuzzleType, seeds: number[]): LegacyFixture {
  const kit = KITS[type]!;
  const puzzles: Record<string, PuzzleData> = {};
  const cases: LegacyCase[] = [];
  const add = (seed: number, p: PuzzleData, label: string, answer: string, ms: number) => {
    const g = gradeAnswer(p, answer, ms);
    cases.push({ seed, label, answer, ms, score: g.score, isCorrect: g.isCorrect, extra: g.extra });
  };
  for (const seed of seeds) {
    const p = roomPuzzle(type, seed);
    puzzles[seed] = p;
    const limit = puzzleTimeLimitMs(p);
    add(seed, p, "nothing", kit.nothing(p), 0);
    const spamRng = makeRng(hashText(`${type}:legacy-spam:${seed}`));
    for (const s of kit.spam(p, spamRng, limit)) add(seed, p, `spam:${s.label}`, s.answer, 0);
    for (const level of LEVELS) {
      const rng = makeRng(hashText(`${type}:legacy-play:${seed}:${level}`));
      const steps = kit.play(p, rng, SKILLS[level], limit).steps;
      steps.forEach((s, i) => {
        if (i % 3 !== 2 && i !== steps.length - 1) return;
        add(seed, p, `${level}:${i}`, s.answer, Math.max(0, limit - s.atMs));
        add(seed, p, `${level}:${i}@0`, s.answer, 0);
      });
      const last = steps[steps.length - 1];
      if (last) for (const share of [0.9, 0.6, 0.3]) add(seed, p, `${level}:last@${share}`, last.answer, Math.round(limit * share));
    }
  }
  return { type, puzzles, cases };
}

export function writeFixture(path: string, f: LegacyFixture): void {
  writeFileSync(path, gzipSync(JSON.stringify(f)));
}

export function readFixture(path: string): LegacyFixture {
  return JSON.parse(gunzipSync(readFileSync(path)).toString()) as LegacyFixture;
}

/** Regrade every stored case; returns the differences. */
export function regradeLegacy(f: LegacyFixture): string[] {
  const out: string[] = [];
  for (const c of f.cases) {
    const g = gradeAnswer(f.puzzles[c.seed]!, c.answer, c.ms);
    if (g.score !== c.score || g.isCorrect !== c.isCorrect || JSON.stringify(g.extra) !== JSON.stringify(c.extra))
      out.push(`seed ${c.seed} ${c.label} @${c.ms}: stored ${c.score}/${c.isCorrect}, now ${g.score}/${g.isCorrect}`);
  }
  return out;
}

/* ------------------------------------------------------------------ the par check (both games) */

export interface ParCheckSpec {
  type: PuzzleType;
  fixture: string;
  /** The depth stamp a new puzzle carries, and the one a pinned (pre-depth) deal carries (undefined = no field). */
  stampOf: (p: PuzzleData) => number | undefined;
  depthStamp: number;
  preStamp: number | undefined;
  /** The pre-depth puzzle of a depth puzzle (the stamp put back). */
  toPre: (p: PuzzleData) => PuzzleData;
  /** Used and par from a grade's extra. */
  usedPar: (extra: Record<string, unknown>) => { used: number; par: number };
}

export function runParCheck(spec: ParCheckSpec): void {
  const record = process.argv.includes("--record");
  const failures: string[] = [];
  let checks = 0;
  const ok = (cond: boolean, msg: string) => {
    checks++;
    if (!cond && failures.length < 40) failures.push(msg);
  };
  const seeds = Array.from({ length: 20 }, (_, i) => 9101 + i);
  const t0 = Date.now();

  // 1. Old rounds (the pre-depth stamp, recorded before the change) grade exactly as before.
  if (record) {
    pinPreDepth(true);
    try {
      writeFixture(spec.fixture, recordLegacy(spec.type, seeds));
    } finally {
      pinPreDepth(false);
    }
    console.log(`recorded ${spec.fixture}`);
  }
  const fixture = readFixture(spec.fixture);
  ok(Object.values(fixture.puzzles).every((p) => spec.stampOf(p) === spec.preStamp), "the legacy fixture is on the pre-depth stamp");
  const diffs = regradeLegacy(fixture);
  ok(diffs.length === 0, `legacy rounds regrade differently (${diffs.length}): ${diffs.slice(0, 3).join("; ")}`);
  ok(fixture.cases.length > 300, `legacy fixture too small (${fixture.cases.length})`);

  // 2. New rounds deal the depth stamp on the same board; a pinned deal is exactly the pre-depth puzzle.
  const kit = KITS[spec.type]!;
  for (const seed of seeds) {
    const now = roomPuzzle(spec.type, seed);
    ok(spec.stampOf(now) === spec.depthStamp, `seed ${seed}: dealt the depth stamp (${spec.stampOf(now)})`);
    ok(JSON.stringify(spec.toPre(now)) === JSON.stringify(fixture.puzzles[seed]), `seed ${seed}: the depth board differs from the pre-depth one beyond its stamp`);
    pinPreDepth(true);
    try {
      ok(JSON.stringify(roomPuzzle(spec.type, seed)) === JSON.stringify(fixture.puzzles[seed]), `seed ${seed}: a pinned deal is not the pre-depth puzzle`);
    } finally {
      pinPreDepth(false);
    }
    // 3. The rules on every kit answer: unfinished and over-par finishes score as today; a finish at par adds the
    //    bonus; scores 0–200; above 150 only at par; the breakdown adds up; more time left never scores less.
    const pre = spec.toPre(now);
    const limit = puzzleTimeLimitMs(now);
    const answers = [kit.nothing(now), ...kit.spam(now, makeRng(hashText(`par:${seed}`)), limit).map((s) => s.answer)];
    for (const level of LEVELS) for (const s of kit.play(now, makeRng(hashText(`par:${seed}:${level}`)), SKILLS[level], limit).steps) answers.push(s.answer);
    for (const answer of answers) {
      let prev = -1;
      for (const share of [0, 0.2, 0.5, 0.75, 0.8, 0.85, 0.9, 0.95, 1]) {
        const ms = Math.round(limit * share);
        const g = grade(now, answer, ms);
        const t = grade(pre, answer, ms);
        const { used, par } = spec.usedPar(g.extra ?? {});
        const atPar = g.isCorrect && used <= par;
        ok(g.isCorrect === t.isCorrect, `seed ${seed}: verdict differs from today's`);
        ok(g.score >= 0 && g.score <= 200 && Number.isInteger(g.score), `seed ${seed}: score ${g.score} outside 0–200`);
        if (!atPar) ok(g.score === t.score, `seed ${seed}: off par ${g.score} is not today's ${t.score}`);
        else ok(g.score > t.score && g.score - t.score <= 50, `seed ${seed}: at par ${g.score} adds no bonus (or more than 50) to today's ${t.score}`);
        if (g.score > 150) ok(atPar, `seed ${seed}: above 150 without par`);
        ok(g.score >= prev, `seed ${seed}: more time left scored less (${prev} → ${g.score})`);
        prev = g.score;
        const parts = storedScoreParts(g.extra);
        if (parts) ok(parts.kind === "partial" ? parts.base === g.score : parts.base + (parts.efficiency ?? 0) + (parts.speed ?? 0) === g.score, `seed ${seed}: breakdown does not add up to ${g.score}`);
        if (g.isCorrect) ok(g.score >= 120, `seed ${seed}: a finish under 120`);
        else ok(g.score <= 110, `seed ${seed}: unfinished above 110`);
      }
    }
  }

  // 4. Bands: a solid (good) player within 10 % of today, elite play reaching 190–200.
  const bands = measureGame(spec.type, 30);
  const lvl = (id: string) => bands.levels.find((l) => l.id === id)!;
  const good = lvl("good");
  ok(Math.abs(good.now.median - good.old.median) <= 0.1 * good.old.median, `good median ${good.old.median} → ${good.now.median}: more than 10 %`);
  ok(lvl("elite").now.best >= 190 && lvl("elite").now.best <= 200, `elite best ${lvl("elite").now.best} not 190–200`);
  ok(lvl("near").now.median >= 150 && lvl("near").now.median <= 170, `near-perfect median ${lvl("near").now.median} not about 150–165`);
  ok(lvl("average").now.median <= lvl("average").old.median * 1.1, "the average player rose more than 10 %");

  // 5. Texts: the maximum through {max}, the par bonus stated, the intro short.
  ok(roundMaxFor(spec.type) === 200, "the round maximum is 200");
  const intro = INTRO_SCORE[spec.type], help = PUZZLE_INSTRUCTIONS[spec.type].score;
  ok(/\b200\b/.test(intro) && intro.length <= 90 && !/\bpar\b/i.test(intro), `intro: "${intro}"`);
  ok(/Par bonus/.test(help) && /200 only with it/.test(help), `help: "${help}"`);
  ok(PUZZLE_INSTRUCTIONS[spec.type].how.some((l) => !l.helpOnly && /par/i.test(l.action)), "the how lines explain par");

  if (failures.length) {
    console.log(failures.join("\n"));
    console.log(`FAIL depth-${spec.type}-check: ${failures.length} of ${checks}`);
    process.exit(1);
  }
  console.log(`PASS depth-${spec.type}-check: ${checks} checks (${fixture.cases.length} legacy rounds regraded; good ${good.old.median} → ${good.now.median}, near ${lvl("near").old.median} → ${lvl("near").now.median}, elite best ${lvl("elite").now.best}) in ${Math.round((Date.now() - t0) / 1000)} s`);
}
