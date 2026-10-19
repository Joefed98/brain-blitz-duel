/**
 * Records scripts/fixtures/progress-figures-grades.json.gz for room-figures-check (19 Oct 2026): the
 * grade of many answers to Chroma Lines, Shikaku, Lamplighter, Tessellate, Jumbled, Swapword and
 * Slider on every score revision (unstamped, puzzleScoreRev 1 and 2), finished and not, early and at
 * the buzzer. Run it on the tree whose grading is the reference (unmodified main before #117 moved
 * these graders' counts into progressFigures.ts); room-figures-check regrades every entry and fails
 * on any difference. Self-contained: it uses only the games' own encoders.
 *
 *   bun scripts/progress-figures-record.ts [--out=<file>]
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { encodePlacements } from "../src/lib/duel/blockParty";
import { encodeFlowPaths } from "../src/lib/duel/flow";
import { gradeAnswer, generatePuzzle } from "../src/lib/duel/generate.server";
import { encodeBulbs } from "../src/lib/duel/lightUp";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { encodeShikaku } from "../src/lib/duel/shikaku";
import { encodeSwapword } from "../src/lib/duel/swapword";
import { encodeTileMoves, tilesLayout } from "../src/lib/duel/tiles";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";

export const PROGRESS_GAMES: PuzzleType[] = ["flow", "shikaku", "lightup", "blockparty", "tiles", "swapword", "wordslide"];

let state = 4242;
const rand = () => {
  state = (state * 1103515245 + 12345) & 0x7fffffff;
  return state / 0x80000000;
};
const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)]!;
const subset = <T>(items: readonly T[], share: number) => items.filter(() => rand() < share);

function answersFor(puzzle: PuzzleData): string[] {
  const shares = [0, 0.25, 0.5, 0.75, 1];
  switch (puzzle.type) {
    case "flow": {
      const sol = puzzle.solution ?? [];
      return [
        ...shares.map((s) => encodeFlowPaths(sol.map((p, i) => (i < Math.round(sol.length * s) ? [...p] : [])))),
        ...Array.from({ length: 8 }, () => encodeFlowPaths(sol.map((p) => (rand() < 0.5 ? [...p] : rand() < 0.4 ? [p[0]!, p[p.length - 1]!] : [])))),
      ];
    }
    case "shikaku": {
      const sol = puzzle.solution ?? [];
      return [
        ...shares.map((s) => encodeShikaku(sol.slice(0, Math.round(sol.length * s)))),
        ...Array.from({ length: 8 }, () =>
          encodeShikaku(subset(sol, 0.5).concat(rand() < 0.6 ? [{ r0: Math.floor(rand() * 4), c0: Math.floor(rand() * 4), r1: 4 + Math.floor(rand() * 4), c1: 4 + Math.floor(rand() * 4) }] : [])),
        ),
      ];
    }
    case "lightup": {
      const sol = puzzle.solution ?? [];
      const cells = puzzle.size * puzzle.size;
      return [
        ...shares.map((s) => encodeBulbs(sol.slice(0, Math.round(sol.length * s)))),
        ...Array.from({ length: 8 }, () => encodeBulbs([...new Set(subset(sol, 0.6).concat(Array.from({ length: Math.floor(rand() * 4) }, () => Math.floor(rand() * cells))))])),
      ];
    }
    case "blockparty": {
      const sol = puzzle.solution ?? [];
      return [...shares.map((s) => encodePlacements(sol.slice(0, Math.round(sol.length * s)))), ...Array.from({ length: 8 }, () => encodePlacements(subset(sol, 0.5)))];
    }
    case "tiles": {
      const count = tilesLayout(puzzle).count;
      return ["", ...Array.from({ length: 14 }, () => encodeTileMoves(Array.from({ length: 2 + Math.floor(rand() * 30) }, () => 1 + Math.floor(rand() * count))))];
    }
    case "swapword": {
      const tiles = puzzle.start.length;
      const sol = puzzle.solution ?? "";
      const board = [...puzzle.start];
      const swaps: [number, number][] = [];
      for (let t = 0; t < tiles; t++) {
        if (board[t] === sol[t]) continue;
        const from = board.findIndex((ch, u) => u > t && ch === sol[t] && board[u] !== sol[u]);
        if (from < 0) continue;
        [board[t], board[from]] = [board[from]!, board[t]!];
        swaps.push([t, from]);
      }
      return [
        ...shares.map((s) => encodeSwapword(swaps.slice(0, Math.round(swaps.length * s)))),
        ...Array.from({ length: 8 }, () =>
          encodeSwapword(Array.from({ length: 1 + Math.floor(rand() * 5) }, () => [Math.floor(rand() * tiles), Math.floor(rand() * tiles)] as [number, number]).filter(([a, b]) => a !== b)),
        ),
      ];
    }
    case "wordslide":
      return ["", ...Array.from({ length: 14 }, () => Array.from({ length: 1 + Math.floor(rand() * 16) }, () => `${pick(["r", "c"])}${Math.floor(rand() * 5)}${pick(["+", "-"])}`).join(","))];
    default:
      return [];
  }
}

export interface ProgressGradeEntry {
  puzzle: PuzzleData;
  answer: string;
  ms: number;
  graded: unknown;
}

if (import.meta.main) {
  const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "scripts/fixtures/progress-figures-grades.json.gz";
  const entries: ProgressGradeEntry[] = [];
  for (const type of PROGRESS_GAMES) {
    for (const seed of [2, 9, 17, 23, 31, 44]) {
      const dealt = withSeededRandom(seed, () => generatePuzzle(type)) as PuzzleData & { puzzleScoreRev?: number };
      const limit = puzzleTimeLimitMs(dealt);
      for (const rev of [undefined, 1, 2]) {
        const puzzle = { ...dealt } as PuzzleData & { puzzleScoreRev?: number };
        if (rev === undefined) delete puzzle.puzzleScoreRev;
        else puzzle.puzzleScoreRev = rev;
        for (const answer of answersFor(puzzle))
          for (const ms of [0, Math.round(limit * 0.6)]) entries.push({ puzzle, answer, ms, graded: gradeAnswer(puzzle, answer, ms) });
      }
    }
  }
  writeFileSync(out, gzipSync(JSON.stringify({ recordedOn: process.env.RECORDED_ON ?? "", entries })));
  console.log(`progress-figures-record: ${entries.length} grades written to ${out}`);
}
