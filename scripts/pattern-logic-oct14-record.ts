/**
 * Records the stored-round fixture for the 14 Oct 2026 Pattern / Logic stamps
 * (scripts/fixtures/pattern-logic-oct14.json.gz): room puzzles carrying the new
 * stamps — Jumbled `tilesRev 1` (the extra-cell board), Colour Flood
 * `floodRev 2` (a flat 15-move limit), Box Six `sudokuRev 1` (13–15 givens) and
 * Bomb Defusal `bombVersion 3` (plain clues) — with answers graded as they were
 * when the stamps shipped. scripts/pattern-logic-oct14-check.ts proves every
 * entry still grades identically, so a later change cannot regrade these rounds.
 *
 *   bun scripts/pattern-logic-oct14-record.ts [seedsPerGame]
 *
 * Each puzzle: the empty draft, every spam strategy, the four solver levels'
 * final answers (at their own time, half and quarter time) and a sample of their
 * unfinished states. Re-record only on purpose (a new stamp, never to make a
 * failing check pass).
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

export const OCT14_GAMES: PuzzleType[] = ["tiles", "flood", "sudoku", "bomb"];
export const OCT14_FIXTURE = "scripts/fixtures/pattern-logic-oct14.json.gz";

function record(puzzle: LegacyCase["puzzle"], answer: string, ms: number): LegacyEntry {
  const g = gradeAnswer(puzzle, answer, ms);
  return { answer, ms, score: g.score, isCorrect: g.isCorrect, correctCount: g.correctCount, errors: g.errors, storedMs: g.storedMs, extra: stableExtra(g.extra) };
}

if (import.meta.main) {
  const seeds = Number(process.argv[2] ?? 6);
  const cases: LegacyCase[] = [];
  for (const type of OCT14_GAMES) {
    const kit = KITS[type]!;
    for (let s = 0; s < seeds; s++) {
      const seed = 14_101 + s;
      const puzzle = roomPuzzle(type, seed);
      const limit = puzzleTimeLimitMs(puzzle);
      const answers: [string, number][] = [[kit.nothing(puzzle), 0], [kit.nothing(puzzle), limit]];
      for (const sp of kit.spam(puzzle, makeRng(hashText(`oct14:spam:${type}:${seed}`)), limit)) answers.push([sp.answer, 0]);
      for (const level of LEVELS) {
        const play = kit.play(puzzle, makeRng(hashText(`oct14:play:${type}:${seed}:${level}`)), SKILLS[level], limit);
        const steps = play.steps.filter((st) => st.atMs <= limit);
        const pickEvery = Math.max(1, Math.ceil(steps.length / 6));
        steps.forEach((st, i) => {
          const last = i === steps.length - 1;
          if (last || i % pickEvery === 0) answers.push([st.answer, last ? Math.max(0, limit - st.atMs) : 0]);
          if (last) answers.push([st.answer, Math.round(limit / 2)], [st.answer, Math.round(limit / 4)]);
        });
      }
      cases.push({ type, label: `${seed}:oct14`, puzzle, entries: answers.map(([a, ms]) => record(puzzle, a, ms)) });
    }
    console.log(`${type}: ${cases.filter((c) => c.type === type).reduce((n, c) => n + c.entries.length, 0)} answers`);
  }
  mkdirSync("scripts/fixtures", { recursive: true });
  writeFileSync(OCT14_FIXTURE, gzipSync(JSON.stringify({ recordedOn: process.env.RECORDED_ON ?? "claude/laughing-brown-239rhw", cases })));
  console.log(`wrote ${cases.length} cases, ${cases.reduce((n, c) => n + c.entries.length, 0)} answers`);
}
