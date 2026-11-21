/**
 * Records the legacy fixture for word-star-check (D1, 21 Nov 2026, the Normal refit of plan section 8.2 I4): Nucleus on
 * wordsmithRev 5, Forage on wordHuntRev 4 and Roundabout on wheelRev 5, the stamps rooms dealt before the refit, at
 * Normal and at every level dealt then, graded by unmodified main. Run it in a checkout of main (it uses only APIs main
 * has, plus this branch's script-only players):
 *
 *   bun scripts/word-star-record.ts [--out=scripts/fixtures/word-star-legacy.json.gz]
 *
 * Each case is a real answer as a phone sends it (every prefix of kit play at three levels, the length-aware people's
 * runs, the typed witness and the kit's spam) graded at three times left.
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import type { Level } from "../src/lib/levels/levels";
import { dealAt } from "./level-tune";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { sentAnswer } from "./standard-lib";
import { PERSON_LEVELS, personRng } from "./word-human";
import { playOpen, witnessOf } from "./word-human-games";

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "scripts/fixtures/word-star-legacy.json.gz";
const puzzles: PuzzleData[] = [];
const cases: { p: number; answer: string; msLeft: number; score: number; correct: boolean; extra: string }[] = [];
/** A short digest of a grade's stored extra (the parts, words and facts), so the fixture proves them without storing them. */
export const extraDigest = (extra: unknown) => createHash("sha256").update(JSON.stringify(extra ?? null)).digest("hex").slice(0, 16);

function add(p: PuzzleData, answers: string[]): void {
  const index = puzzles.length;
  puzzles.push(p);
  const limit = puzzleTimeLimitMs(p);
  for (const answer of new Set(answers)) {
    for (const msLeft of [0, Math.round(limit * 0.4), limit - 8_000]) {
      const g = gradeAnswer(p, answer, msLeft);
      cases.push({ p: index, answer, msLeft, score: g.score, correct: g.isCorrect, extra: extraDigest(g.extra) });
    }
  }
}

function record(type: PuzzleType, level: Level, ns: readonly number[]): void {
  const kit = KITS[type]!;
  for (const n of ns) {
    const p = dealAt(type, level, n);
    const limit = puzzleTimeLimitMs(p);
    const answers: string[] = [];
    for (const k of ["average", "good", "near"] as const) {
      const steps = kit.play(p, makeRng(hashText(`star:${type}:${level}:${n}:${k}`)), SKILLS[k], limit).steps;
      // At most 12 prefixes a play, evenly spread, the whole play always among them.
      const every = Math.max(1, Math.ceil(steps.length / 12));
      for (let i = steps.length; i >= 1; i -= every) answers.push(sentAnswer(p, steps.slice(0, i)));
    }
    for (const person of PERSON_LEVELS) {
      const steps = playOpen(p, person, personRng(`star:${type}`, level, n, person, 0));
      if (steps.length) answers.push(sentAnswer(p, steps), steps[Math.floor(steps.length / 2)]!.answer);
    }
    answers.push(witnessOf(p).answer);
    answers.push(...kit.spam(p, makeRng(hashText(`star:${type}:${level}:${n}:spam`)), limit).map((s) => s.answer));
    add(p, answers);
  }
}

const TYPES: PuzzleType[] = ["wordsmith", "wordhunt", "letterwheel"];
for (const type of TYPES) {
  record(type, "normal", [0, 1, 2, 3, 4, 5, 6, 7]);
  for (const level of ["easy", "hard", "expert"] as const) record(type, level, [0, 1, 2]);
}
const stamp = (p: PuzzleData) => {
  const r = p as unknown as Record<string, unknown>;
  return `${p.type}:${r["wordsmithRev"] ?? r["wordHuntRev"] ?? r["wheelRev"]}${r["level"] ? `:${r["level"]}` : ""}`;
};
writeFileSync(out, gzipSync(JSON.stringify({ puzzles, cases })));
console.log(`${puzzles.length} puzzles (${[...new Set(puzzles.map(stamp))].join(", ")}), ${cases.length} cases → ${out}`);
