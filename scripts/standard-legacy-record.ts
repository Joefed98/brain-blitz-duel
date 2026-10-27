/**
 * Records the legacy fixture for the scoring standard (docs/scoring-standard.md): the 46 games' puzzles as rooms dealt
 * them before the standard, kit answers on them (nothing, spam, four skill levels, sampled unfinished steps) and the
 * grade each got. Run on main before the standard (a checkout without it); standard-legacy-check regrades every case.
 *
 *   bun scripts/standard-legacy-record.ts [seeds=4] [out=scripts/fixtures/standard-legacy.json.gz]
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";

export const STANDARD_TYPES: PuzzleType[] = [
  "tilegrid", "wordslide", "wordsearch", "letterwheel", "strikeout", "codeword", "swapword",
  "target", "equation", "balance", "numpyramid", "trail", "measure", "checkout", "numline", "tendrop",
  "numhunt", "chain", "stroop", "symscan", "spotdiff", "countup", "maze", "pairmatch",
  "unblock", "blockparty", "iceslide", "gravity", "tiles", "rings", "laser", "flow", "pipes", "push", "lightsout",
  "sudoku", "tower", "tubes", "safe", "bomb", "nonogram", "flood", "tents", "shikaku", "lightup",
] as PuzzleType[];

export interface LegacyCase {
  type: PuzzleType;
  puzzle: PuzzleData;
  answer: string;
  ms: number;
  score: number;
  isCorrect: boolean;
  extra: unknown;
}

if (import.meta.main) {
  const seeds = Number(process.argv[2] ?? 4);
  const out = process.argv[3] ?? "scripts/fixtures/standard-legacy.json.gz";
  const cases: LegacyCase[] = [];
  const add = (type: PuzzleType, puzzle: PuzzleData, answer: string, ms: number) => {
    const g = gradeAnswer(puzzle, answer, ms);
    cases.push({ type, puzzle, answer, ms, score: g.score, isCorrect: g.isCorrect, extra: g.extra });
  };
  for (const type of STANDARD_TYPES) {
    const kit = KITS[type];
    for (let s = 0; s < seeds; s++) {
      const seed = 4100 + s * 37;
      // The kit's world (roomPuzzle) and today's live deal (Topsy-Turvy and Gradient deal past the kits' boards).
      const live = withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed }));
      const worlds = kit ? [roomPuzzle(type, seed), live] : [live];
      for (const puzzle of worlds) {
        const limit = puzzleTimeLimitMs(puzzle);
        if (!kit) continue;
        add(type, puzzle, kit.nothing(puzzle), 0);
        const rng = makeRng(hashText(`std-legacy:${type}:${seed}`));
        for (const sp of kit.spam(puzzle, rng, limit).slice(0, 2)) add(type, puzzle, sp.answer, 0);
        for (const level of LEVELS) {
          let play;
          try {
            play = kit.play(puzzle, makeRng(hashText(`std-legacy:${type}:${seed}:${level}`)), SKILLS[level], limit);
          } catch {
            continue;
          }
          const steps = play.steps.filter((st) => st.atMs <= limit);
          if (steps.length === 0) continue;
          const last = steps[steps.length - 1]!;
          add(type, puzzle, last.answer, Math.max(0, limit - last.atMs));
          add(type, puzzle, last.answer, 0);
          const mid = steps[Math.floor(steps.length / 2)]!;
          add(type, puzzle, mid.answer, 0);
        }
      }
    }
    console.log(type, cases.filter((c) => c.type === type).length);
  }
  writeFileSync(out, gzipSync(JSON.stringify(cases)));
  console.log(`${cases.length} cases → ${out}`);
}
