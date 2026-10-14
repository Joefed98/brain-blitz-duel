/**
 * Records the stored-round fixture for the 14 Oct 2026 Pattern / Logic batch
 * (scripts/fixtures/pattern-logic-oct14-legacy.json.gz) ON UNMODIFIED MAIN,
 * before the batch: room puzzles exactly as main stamped them (Jumbled's 3×3
 * frame with no `tilesRev`, Colour Flood `floodRev 1` with par + 2, Box Six with
 * no `sudokuRev`, Bomb Defusal `bombVersion 2`), plus the same puzzles with the
 * score and limit stamps removed (the oldest stored shape), each with answers
 * graded by main. scripts/pattern-logic-oct14-check.ts proves every entry still
 * grades identically on the batch's code.
 *
 *   (in a worktree of main, with this file copied in)
 *   RECORDED_ON=<commit> bun scripts/pattern-logic-oct14-legacy-record.ts [seedsPerGame]
 *
 * Each puzzle: the empty draft, every spam strategy, the four solver levels'
 * final answers (at their own time, half and quarter time) and a sample of their
 * unfinished states. Only a main checkout should ever write this file.
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

export const OCT14_LEGACY_GAMES: PuzzleType[] = ["tiles", "flood", "sudoku", "bomb"];
export const OCT14_LEGACY_FIXTURE = "scripts/fixtures/pattern-logic-oct14-legacy.json.gz";

function record(puzzle: PuzzleData, answer: string, ms: number): LegacyEntry {
  const g = gradeAnswer(puzzle, answer, ms);
  return { answer, ms, score: g.score, isCorrect: g.isCorrect, correctCount: g.correctCount, errors: g.errors, storedMs: g.storedMs, extra: stableExtra(g.extra) };
}

/** The oldest stored shape: no score shape, speed par or limit stamps. */
function unstamped(puzzle: PuzzleData): PuzzleData {
  const copy = { ...(puzzle as object) } as Record<string, unknown>;
  for (const key of ["puzzleScoreRev", "speedPar", "floodRev", "moveLimit"]) delete copy[key];
  return copy as unknown as PuzzleData;
}

if (import.meta.main) {
  const seeds = Number(process.argv[2] ?? 5);
  const cases: LegacyCase[] = [];
  for (const type of OCT14_LEGACY_GAMES) {
    const kit = KITS[type]!;
    for (let s = 0; s < seeds; s++) {
      const seed = 14_201 + s;
      const stamped = roomPuzzle(type, seed);
      for (const [shape, puzzle] of [["main", stamped], ["unstamped", unstamped(stamped)]] as const) {
        const limit = puzzleTimeLimitMs(puzzle);
        const answers: [string, number][] = [[kit.nothing(puzzle), 0], [kit.nothing(puzzle), limit]];
        for (const sp of kit.spam(puzzle, makeRng(hashText(`oct14legacy:spam:${type}:${seed}`)), limit)) answers.push([sp.answer, 0]);
        for (const level of LEVELS) {
          const play = kit.play(puzzle, makeRng(hashText(`oct14legacy:play:${type}:${seed}:${level}`)), SKILLS[level], limit);
          const steps = play.steps.filter((st) => st.atMs <= limit);
          const pickEvery = Math.max(1, Math.ceil(steps.length / 6));
          steps.forEach((st, i) => {
            const last = i === steps.length - 1;
            if (last || i % pickEvery === 0) answers.push([st.answer, last ? Math.max(0, limit - st.atMs) : 0]);
            if (last) answers.push([st.answer, Math.round(limit / 2)], [st.answer, Math.round(limit / 4)]);
          });
        }
        cases.push({ type, label: `${seed}:${shape}`, puzzle, entries: answers.map(([a, ms]) => record(puzzle, a, ms)) });
      }
    }
    console.log(`${type}: ${cases.filter((c) => c.type === type).reduce((n, c) => n + c.entries.length, 0)} answers`);
  }
  mkdirSync("scripts/fixtures", { recursive: true });
  writeFileSync(OCT14_LEGACY_FIXTURE, gzipSync(JSON.stringify({ recordedOn: process.env.RECORDED_ON ?? "main", cases })));
  console.log(`wrote ${cases.length} cases, ${cases.reduce((n, c) => n + c.entries.length, 0)} answers`);
}
