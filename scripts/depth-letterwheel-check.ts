/**
 * Roundabout depth check (25 Oct 2026, word depth d1; docs/depth/d1-word.md): the bonus jar under `wheelRev 2`.
 *
 *   1. legacy identity: wheelRev 1 room rounds recorded before the change (scripts/fixtures/depth-letterwheel-
 *      legacy.json.gz: 20 room seeds, the empty answer, three spam runs and the four kit players' answers at
 *      several moments and times left) grade exactly as they did (score, isCorrect, extra);
 *   2. new deals: rooms deal wheelRev 2 with a public jar size, pinPreDepth deals wheelRev 1, the jar size is
 *      what the board allows (at most LW_JAR_DROPS), the bonus words stay server-only;
 *   3. the jar: real non-crossword words fill it by length (3 → 1, 4 → 2, 5 → 3, 6+ → 4 drops), a repeat
 *      or a crossword word adds nothing, a non-word adds nothing and stays a miss, the bonus is
 *      50 × drops ÷ jar size, today's score plus the bonus, unfinished capped below every finish;
 *      without the jar no round passes 150; more drops never score less;
 *   4. the elite kit player reaches 190–200; random play stays near 0;
 *   5. the help and intro texts state the jar.
 *
 *   bun scripts/depth-letterwheel-check.ts            # check
 *   bun scripts/depth-letterwheel-check.ts --record   # re-record the legacy fixture (only before the change)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";

import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { pinPreDepth } from "../src/lib/duel/wordDepth";
import type { LetterWheelPuzzleData, PuzzleData } from "../src/lib/duel/types";
import { hashText, LEVELS, makeRng, SKILLS } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";

const FIXTURE = "scripts/fixtures/depth-letterwheel-legacy.json.gz";
const RECORD = process.argv.includes("--record");
const SEEDS = 20;

interface Case {
  seed: number;
  label: string;
  puzzle: PuzzleData;
  answer: string;
  ms: number;
  score: number;
  isCorrect: boolean;
  extra: unknown;
}

function legacyCases(): Omit<Case, "score" | "isCorrect" | "extra">[] {
  const kit = KITS.letterwheel!;
  const out: Omit<Case, "score" | "isCorrect" | "extra">[] = [];
  for (let s = 1; s <= SEEDS; s++) {
    const seed = 9300 + s;
    pinPreDepth(true);
    let puzzle: PuzzleData;
    try {
      puzzle = roomPuzzle("letterwheel", seed);
    } finally {
      pinPreDepth(false);
    }
    const limit = puzzleTimeLimitMs(puzzle);
    out.push({ seed, label: "nothing", puzzle, answer: "", ms: 0 });
    const spamRng = makeRng(hashText(`depth-lw:spam:${seed}`));
    for (const sp of kit.spam(puzzle, spamRng, limit)) out.push({ seed, label: `spam:${sp.label}`, puzzle, answer: sp.answer, ms: 0 });
    for (const level of LEVELS) {
      const rng = makeRng(hashText(`depth-lw:play:${seed}:${level}`));
      const play = kit.play(puzzle, rng, SKILLS[level], limit);
      const steps = play.steps;
      const picks = [Math.floor(steps.length / 3), Math.floor((2 * steps.length) / 3), steps.length - 1].filter((i) => i >= 0);
      for (const i of picks) {
        const st = steps[i]!;
        for (const ms of [0, Math.max(0, limit - st.atMs), Math.round(limit * 0.6)])
          out.push({ seed, label: `${level}:${i}:${ms}`, puzzle, answer: st.answer, ms });
      }
    }
  }
  return out;
}

const failures: string[] = [];
let passes = 0;
function ok(cond: boolean, message: string): void {
  if (cond) passes++;
  else if (failures.length < 40) failures.push(message);
}

if (RECORD) {
  const cases: Case[] = legacyCases().map((c) => {
    const g = gradeAnswer(c.puzzle, c.answer, c.ms);
    return { ...c, score: g.score, isCorrect: g.isCorrect, extra: g.extra };
  });
  writeFileSync(FIXTURE, gzipSync(JSON.stringify(cases)));
  console.log(`recorded ${cases.length} cases to ${FIXTURE}`);
  process.exit(0);
}

/* 1. Legacy identity. */
const stored = JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString()) as Case[];
ok(stored.length > 500, `the fixture holds the recorded cases (${stored.length})`);
for (const c of stored) {
  ok((c.puzzle as LetterWheelPuzzleData).wheelRev === 1, `${c.seed} ${c.label}: the fixture is wheelRev 1`);
  const g = gradeAnswer(c.puzzle, c.answer, c.ms);
  const same = g.score === c.score && g.isCorrect === c.isCorrect && JSON.stringify(g.extra) === JSON.stringify(c.extra);
  ok(same, `${c.seed} ${c.label}: legacy grade changed (${c.score} → ${g.score})`);
}

const extraChecks = await import("./depth-letterwheel-new");
extraChecks.run(ok);

if (failures.length) {
  console.log(failures.map((f) => `  - ${f}`).join("\n"));
  console.log(`FAIL depth-letterwheel-check: ${failures.length} failed, ${passes} passed`);
  process.exit(1);
}
console.log(`PASS depth-letterwheel-check: ${passes} checks — wheelRev 1 rounds grade as before (${stored.length} recorded cases); wheelRev 2's bonus jar adds up to 50, only through bonus words`);
