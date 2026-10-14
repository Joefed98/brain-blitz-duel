/**
 * Records the Attention rework fixtures (14 Oct 2026) for Eagle Eye, Double Take and Tally:
 *
 *   bun scripts/attention-rework-record.ts --legacy [seeds]
 *     Run on main BEFORE the change (in a git worktree): room puzzles exactly as main
 *     stamped them (speedPar 1, puzzleScoreRev 1, Tally countRev 1; no scanRev / spotRev,
 *     one picture, three trays, 30 s / 45 s), graded by main. Writes
 *     scripts/fixtures/attention-rework-legacy.json.gz.
 *
 *   bun scripts/attention-rework-record.ts [seeds]
 *     Run after the change: puzzles on the new stamps (scanRev 1, spotRev 1, countRev 2),
 *     graded by the new rules. Writes scripts/fixtures/attention-rework-rev1.json.gz, so a
 *     later change can never regrade a stored round on these stamps.
 *
 * scripts/attention-rework-check.ts proves every entry of both still grades identically.
 * Each puzzle: the empty draft (at the buzzer and on an instant submit), every spam
 * strategy, the four solver levels' final answers (at their own time, half and quarter
 * time) and a sample of their unfinished states.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";
import { stableExtra, type LegacyCase, type LegacyEntry } from "./puzzle-score-legacy-record";

export const ATTENTION_GAMES: PuzzleType[] = ["symscan", "spotdiff", "countup"];

function record(puzzle: PuzzleData, answer: string, ms: number): LegacyEntry {
  const g = gradeAnswer(puzzle, answer, ms);
  return {
    answer,
    ms,
    score: g.score,
    isCorrect: g.isCorrect,
    correctCount: g.correctCount,
    errors: g.errors,
    storedMs: g.storedMs,
    extra: stableExtra(g.extra),
  };
}

if (import.meta.main) {
  const legacy = process.argv.includes("--legacy");
  const seeds = Number(process.argv.slice(2).find((a) => !a.startsWith("--")) ?? 8);
  const cases: LegacyCase[] = [];
  for (const type of ATTENTION_GAMES) {
    const kit = KITS[type]!;
    for (let s = 0; s < seeds; s++) {
      const seed = 9401 + s;
      const puzzle = roomPuzzle(type, seed);
      const limit = puzzleTimeLimitMs(puzzle);
      const answers: [string, number][] = [
        [kit.nothing(puzzle), 0],
        [kit.nothing(puzzle), limit],
      ];
      for (const sp of kit.spam(puzzle, makeRng(hashText(`attention:spam:${type}:${seed}`)), limit))
        answers.push([sp.answer, 0]);
      for (const level of LEVELS) {
        const play = kit.play(
          puzzle,
          makeRng(hashText(`attention:play:${type}:${seed}:${level}`)),
          SKILLS[level],
          limit,
        );
        const steps = play.steps.filter((st) => st.atMs <= limit);
        const pickEvery = Math.max(1, Math.ceil(steps.length / 6));
        steps.forEach((st, i) => {
          const last = i === steps.length - 1;
          if (last || i % pickEvery === 0)
            answers.push([st.answer, last ? Math.max(0, limit - st.atMs) : 0]);
          if (last)
            answers.push([st.answer, Math.round(limit / 2)], [st.answer, Math.round(limit / 4)]);
        });
      }
      cases.push({
        type,
        label: `${seed}:${legacy ? "main" : "rework"}`,
        puzzle,
        entries: answers.map(([a, ms]) => record(puzzle, a, ms)),
      });
    }
    console.log(
      `${type}: ${cases.filter((c) => c.type === type).reduce((n, c) => n + c.entries.length, 0)} answers`,
    );
  }
  mkdirSync("scripts/fixtures", { recursive: true });
  const out = legacy
    ? "scripts/fixtures/attention-rework-legacy.json.gz"
    : "scripts/fixtures/attention-rework-rev1.json.gz";
  writeFileSync(
    out,
    gzipSync(
      JSON.stringify({
        recordedOn: process.env.RECORDED_ON ?? (legacy ? "main" : "branch"),
        cases,
      }),
    ),
  );
  console.log(
    `wrote ${out}: ${cases.length} cases, ${cases.reduce((n, c) => n + c.entries.length, 0)} answers`,
  );
}
