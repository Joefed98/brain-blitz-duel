/**
 * Records the move-limits legacy fixture (scripts/fixtures/move-limits-legacy.json.gz):
 * answers for the seven games the 13 Oct 2026 move limits touch (Colour Flood,
 * Polypotions, Topsy-Turvy, Counterweight, Operator, Brimful, Tally), on room
 * puzzles exactly as main stamped them before the change (speedPar 1,
 * puzzleScoreRev 1, no per-game limit stamp), graded by the server BEFORE the
 * change. Run once on main before the change; scripts/move-limits-check.ts then
 * proves every entry still grades identically.
 *
 *   bun scripts/move-limits-legacy-record.ts [seedsPerGame]
 *
 * Each puzzle: the empty draft, every spam strategy, the four solver levels'
 * final answers (at their own time, half and quarter time) and a sample of their
 * unfinished states.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleType } from "../src/lib/duel/types";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";
import { stableExtra, type LegacyCase, type LegacyEntry } from "./puzzle-score-legacy-record";

export const MOVE_LIMIT_GAMES: PuzzleType[] = [
  "flood",
  "tubes",
  "gravity",
  "balance",
  "equation",
  "measure",
  "countup",
];

function record(puzzle: LegacyCase["puzzle"], answer: string, ms: number): LegacyEntry {
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
  const seeds = Number(process.argv[2] ?? 8);
  const cases: LegacyCase[] = [];
  for (const type of MOVE_LIMIT_GAMES) {
    const kit = KITS[type]!;
    for (let s = 0; s < seeds; s++) {
      const seed = 9101 + s;
      const puzzle = roomPuzzle(type, seed);
      const limit = puzzleTimeLimitMs(puzzle);
      const answers: [string, number][] = [
        [kit.nothing(puzzle), 0],
        [kit.nothing(puzzle), limit],
      ];
      for (const sp of kit.spam(puzzle, makeRng(hashText(`limits:spam:${type}:${seed}`)), limit))
        answers.push([sp.answer, 0]);
      for (const level of LEVELS) {
        const play = kit.play(
          puzzle,
          makeRng(hashText(`limits:play:${type}:${seed}:${level}`)),
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
        label: `${seed}:rev1`,
        puzzle,
        entries: answers.map(([a, ms]) => record(puzzle, a, ms)),
      });
    }
    console.log(
      `${type}: ${cases.filter((c) => c.type === type).reduce((n, c) => n + c.entries.length, 0)} answers`,
    );
  }
  mkdirSync("scripts/fixtures", { recursive: true });
  const body = JSON.stringify({ recordedOn: process.env.RECORDED_ON ?? "main", cases });
  writeFileSync("scripts/fixtures/move-limits-legacy.json.gz", gzipSync(body));
  console.log(
    `wrote ${cases.length} cases, ${cases.reduce((n, c) => n + c.entries.length, 0)} answers`,
  );
}
