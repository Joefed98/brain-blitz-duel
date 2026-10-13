/**
 * Records the puzzle-score legacy fixture (scripts/fixtures/puzzle-score-legacy.json):
 * stored-round answers for every game the Oct 2026 puzzle score shape touches,
 * graded by the server on main BEFORE the change. Run once on main (a worktree
 * at the pre-change commit, with scripts/puzzle-fairness/ copied in); the
 * fixture is then committed and scripts/puzzle-score-rev-check.ts proves every
 * entry still grades identically.
 *
 *   bun scripts/puzzle-score-legacy-record.ts [seedsPerGame]
 *
 * Each game: room puzzles as main stamped them (speedPar 1, no score stamp; the
 * engine games on their current revisions), plus the same puzzles with speedPar
 * removed (the oldest rounds), each with the empty draft, every spam strategy,
 * the four solver levels' final answers and a sample of their unfinished states.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";

export const LEGACY_GAMES: PuzzleType[] = [
  "tilegrid", "wordslide", "wordsearch", "letterwheel", "strikeout", "codeword", "swapword",
  "target", "equation", "balance", "numpyramid", "trail", "measure", "checkout", "numline", "tendrop",
  "numhunt", "chain", "stopwatch", "reaction",
  "stroop", "symscan", "spotdiff", "countup", "maze", "pairmatch",
  "unblock", "blockparty", "iceslide", "gravity", "tiles", "rings", "laser",
  "pipes", "lightsout", "sudoku", "flow", "push", "tower", "tubes", "safe", "bomb", "nonogram", "flood", "tents", "shikaku", "lightup",
];

export interface LegacyEntry {
  answer: string;
  ms: number;
  score: number;
  isCorrect: boolean;
  correctCount: number | null;
  errors: number | null;
  storedMs: number;
  /** JSON of the stored extra (arcade diagnostics' replay time removed). */
  extra: string;
}

export interface LegacyCase {
  type: PuzzleType;
  label: string;
  puzzle: PuzzleData;
  entries: LegacyEntry[];
}

/** The stored extra, minus timings that differ run to run. */
export function stableExtra(extra: Record<string, unknown> | null): string {
  return JSON.stringify(extra, (key, value) => (key === "replayMs" ? undefined : value));
}

function record(puzzle: PuzzleData, answer: string, ms: number): LegacyEntry {
  const g = gradeAnswer(puzzle, answer, ms);
  return { answer, ms, score: g.score, isCorrect: g.isCorrect, correctCount: g.correctCount, errors: g.errors, storedMs: g.storedMs, extra: stableExtra(g.extra) };
}

if (import.meta.main) {
  const seeds = Number(process.argv[2] ?? 3);
  const cases: LegacyCase[] = [];
  for (const type of LEGACY_GAMES) {
    const kit = KITS[type];
    if (!kit) throw new Error(`no kit for ${type}`);
    for (let s = 0; s < seeds; s++) {
      const seed = 9001 + s;
      const stamped = roomPuzzle(type, seed);
      const unstamped = { ...(stamped as object) } as Record<string, unknown>;
      delete unstamped["speedPar"];
      for (const [label, puzzle] of [["speedPar", stamped], ["unstamped", unstamped as unknown as PuzzleData]] as const) {
        const limit = puzzleTimeLimitMs(puzzle);
        const answers: [string, number][] = [[kit.nothing(puzzle), 0], [kit.nothing(puzzle), limit]];
        for (const sp of kit.spam(puzzle, makeRng(hashText(`legacy:spam:${type}:${seed}`)), limit)) answers.push([sp.answer, 0]);
        for (const level of LEVELS) {
          const play = kit.play(puzzle, makeRng(hashText(`legacy:play:${type}:${seed}:${level}`)), SKILLS[level], limit);
          const steps = play.steps.filter((st) => st.atMs <= limit);
          const pickEvery = Math.max(1, Math.ceil(steps.length / 4));
          steps.forEach((st, i) => {
            const last = i === steps.length - 1;
            if (last || i % pickEvery === 0) answers.push([st.answer, last ? Math.max(0, limit - st.atMs) : 0]);
            // A mid-round answer at half time and on a quarter left, for the speed terms.
            if (last) answers.push([st.answer, Math.round(limit / 2)], [st.answer, Math.round(limit / 4)]);
          });
        }
        cases.push({ type, label: `${seed}:${label}`, puzzle, entries: answers.map(([a, ms]) => record(puzzle, a, ms)) });
      }
    }
    console.log(`${type}: ${cases.filter((c) => c.type === type).reduce((n, c) => n + c.entries.length, 0)} answers`);
  }
  mkdirSync("scripts/fixtures", { recursive: true });
  writeFileSync("scripts/fixtures/puzzle-score-legacy.json", JSON.stringify({ recordedOn: process.env.RECORDED_ON ?? "main", cases }));
  console.log(`wrote ${cases.length} cases, ${cases.reduce((n, c) => n + c.entries.length, 0)} answers`);
}
