/**
 * Records the legacy fixture for speed-pipes-nov7-check (7 Nov 2026, docs/speed-pipes-scoring-nov-2026.md): Flash and
 * Bang On on tapRev 4, 5 and 6, Ascend on tapRev 5 and 6, and Pipeline on pipesRev 1, 2 and 3, graded by unmodified
 * main. Run it in a checkout of main (it only uses APIs main has):
 *
 *   bun scripts/speed-pipes-nov7-record.ts --out=<path>/scripts/fixtures/speed-pipes-nov7-legacy.json.gz
 *
 * Each puzzle is a room deal (seeded) restamped to each older stamp (the boards and schedules are the same on all of
 * them); each case is a real answer (kit play at four levels cut at a quarter, half, three quarters and the end, plus
 * the kit's spam) graded at three times left. The whole grade is stored (score, verdict, stored ms, average, extra).
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { decodeSides, rotateMask, tileOpenings } from "../src/lib/duel/logic";
import { encodePipesTapAnswer, pipesAfterTaps } from "../src/lib/duel/depth4/pipesTaps";
import { TAP_LOG_PREFIX } from "../src/lib/duel/tapLog";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";

export const SPEED_PIPES_NOV7_FIXTURE = "scripts/fixtures/speed-pipes-nov7-legacy.json.gz";

export interface Nov7Case {
  p: number;
  answer: string;
  msLeft: number;
  score: number;
  correct: boolean;
  storedMs: number | null;
  avg: number | null;
  extra: unknown;
}
export interface Nov7Fixture {
  puzzles: PuzzleData[];
  cases: Nov7Case[];
}

type Of<T extends PuzzleType> = Extract<PuzzleData, { type: T }>;

/** Pipeline's kit sends side-sets; each change becomes the clockwise taps it takes (as standard-pattern-check). */
export function pipesTapAnswers(p: Of<"pipes">, answers: readonly string[]): string[] {
  let prev = p.tiles.map(tileOpenings);
  const taps: number[] = [];
  return answers.map((answer) => {
    const sides = decodeSides(p.tiles, answer).map(tileOpenings);
    sides.forEach((want, cell) => {
      for (let t = 0; t < 4; t++) if (rotateMask(prev[cell]!, t) === want) {
        for (let k = 0; k < t; k++) taps.push(cell);
        break;
      }
    });
    prev = sides;
    return encodePipesTapAnswer(pipesAfterTaps(p.tiles, taps), taps);
  });
}

/** A tap log cut to its first share of taps. */
function cutLog(answer: string, share: number): string {
  if (!answer.startsWith(TAP_LOG_PREFIX)) return answer;
  const items = answer.slice(TAP_LOG_PREFIX.length).split(",").filter(Boolean);
  return TAP_LOG_PREFIX + items.slice(0, Math.ceil(items.length * share)).join(",");
}

const LEVELS = ["average", "good", "great", "near"] as const;
const STAMPS: Partial<Record<PuzzleType, [string, number[]]>> = {
  reaction: ["tapRev", [4, 5, 6]],
  stopwatch: ["tapRev", [4, 5, 6]],
  numhunt: ["tapRev", [5, 6]],
  pipes: ["pipesRev", [1, 2, 3]],
};
export const NOV7_SEEDS = [70_011, 70_037, 70_061, 70_093, 70_127, 70_159];

if (import.meta.main) {
  const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? SPEED_PIPES_NOV7_FIXTURE;
  const puzzles: PuzzleData[] = [];
  const cases: Nov7Case[] = [];
  for (const [type, [key, revs]] of Object.entries(STAMPS) as [PuzzleType, [string, number[]]][]) {
    for (const seed of NOV7_SEEDS) {
      const dealt = withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed }));
      const limit = puzzleTimeLimitMs(dealt);
      const kit = KITS[type]!;
      let answers: string[] = [];
      for (const level of LEVELS) {
        const steps = kit.play(dealt, makeRng(hashText(`nov7:${type}:${seed}:${level}`)), SKILLS[level], limit).steps.map((s) => s.answer);
        if (type === "pipes") {
          const taps = pipesTapAnswers(dealt as Of<"pipes">, steps);
          answers.push(...[0.25, 0.5, 0.75, 1].map((c) => taps[Math.max(0, Math.ceil(taps.length * c) - 1)]!));
        } else {
          const last = steps[steps.length - 1] ?? "";
          answers.push(...[0.25, 0.5, 0.75, 1].map((c) => cutLog(last, c)));
        }
      }
      const spam = kit.spam(dealt, makeRng(hashText(`nov7:${type}:${seed}:spam`)), limit).map((s) => s.answer);
      answers.push(...(type === "pipes" ? spam.map((a) => pipesTapAnswers(dealt as Of<"pipes">, [a])[0]!) : spam));
      answers.push(kit.nothing(dealt), "");
      answers = [...new Set(answers)];
      for (const rev of revs) {
        const p = { ...(dealt as object), [key]: rev } as PuzzleData;
        const index = puzzles.length;
        puzzles.push(p);
        for (const answer of answers) {
          for (const msLeft of [0, Math.round(limit * 0.4), limit - 5_000]) {
            const g = gradeAnswer(p, answer, msLeft);
            cases.push({ p: index, answer, msLeft, score: g.score, correct: g.isCorrect, storedMs: g.storedMs ?? null, avg: g.reactionAvgMs ?? null, extra: g.extra ?? null });
          }
        }
      }
    }
  }
  writeFileSync(out, gzipSync(JSON.stringify({ puzzles, cases } satisfies Nov7Fixture)));
  console.log(`${puzzles.length} puzzles, ${cases.length} cases → ${out}`);
}
