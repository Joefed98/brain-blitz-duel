/**
 * Puzzle top-up (26 Oct 2026, docs/depth/topup-oct-2026.md): records the legacy fixture
 * scripts/fixtures/depth-topup-legacy.json.gz on the code before the top-up. For every retuned game, room puzzles
 * dealt on the live stamps of the day (12 seeds), and graded answers: nothing, each spam answer, and every kit
 * level's play (average, good, great, near-perfect, elite): two drafts at the buzzer, its first finish at its own
 * time left (or its last answer at the buzzer). depth-topup-check regrades every case and fails on any difference.
 *
 *   bun scripts/depth-topup-record.ts            # writes the fixture (run on the code before the top-up only)
 *
 * Script-only.
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { SKILLS, hashText, makeRng, type Skill } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";
import { kitFor, type D4Level } from "./depth4/players";
import { TOPUP_GAMES } from "./depth-topup-bands";

export const TOPUP_FIXTURE = "scripts/fixtures/depth-topup-legacy.json.gz";

/** The games the record covers: every measured game but those that passed the bar unchanged (Pull!, Cryptogrid, Chroma Lines). */
export const RECORDED: PuzzleType[] = (Object.keys(TOPUP_GAMES) as PuzzleType[]).filter((t) => !["clayshoot", "codeword", "flow"].includes(t));

export interface TopupCase {
  type: PuzzleType;
  seed: number;
  label: string;
  answer: string;
  ms: number;
  score: number;
  isCorrect: boolean;
  storedMs: number;
  extra: unknown;
}

export interface TopupFixture {
  puzzles: Record<string, PuzzleData>;
  cases: TopupCase[];
}

const ELITE: Skill = { level: "near", pace: 0.33, err: 0.003, reactionMs: 132, reactionSd: 12 };
const LEVELS: [string, Skill][] = [["average", SKILLS.average], ["good", SKILLS.good], ["great", SKILLS.great], ["near", SKILLS.near], ["elite", ELITE]];

export function recordPuzzle(type: PuzzleType, seed: number): PuzzleData {
  const group = TOPUP_GAMES[type];
  return group === "logic" || group === "d4" ? withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed })) : roomPuzzle(type, seed);
}

function quiet<T>(f: () => T): T {
  const e = console.error;
  console.error = () => {};
  try {
    return f();
  } finally {
    console.error = e;
  }
}

if (import.meta.main) {
  const puzzles: Record<string, PuzzleData> = {};
  const cases: TopupCase[] = [];
  for (const type of RECORDED) {
    for (let s = 0; s < 12; s++) {
      const seed = 640_001 + s * 977;
      const puzzle = recordPuzzle(type, seed);
      puzzles[`${type}:${seed}`] = puzzle;
      const limit = puzzleTimeLimitMs(puzzle);
      const push = (label: string, answer: string, ms: number) => {
        const g = quiet(() => gradeAnswer(puzzle, answer, ms));
        cases.push({ type, seed, label, answer, ms, score: g.score, isCorrect: g.isCorrect, storedMs: g.storedMs, extra: JSON.parse(JSON.stringify(g.extra ?? null)) });
      };
      const base = KITS[type]!;
      push("nothing", base.nothing(puzzle), 0);
      for (const sp of base.spam(puzzle, makeRng(hashText(`${type}:topup-legacy-spam:${seed}`)), limit)) push(`spam:${sp.label}`, sp.answer, 0);
      for (const [level, skill] of LEVELS) {
        const kit = TOPUP_GAMES[type] === "d4" ? kitFor(type, puzzle, level as D4Level) : base;
        const steps = kit.play(puzzle, makeRng(hashText(`${type}:topup-legacy:${seed}:${level}`)), skill, limit).steps.filter((x) => x.atMs <= limit);
        if (!steps.length) continue;
        for (const k of [Math.floor(steps.length / 3), Math.floor((2 * steps.length) / 3)]) push(`${level}:draft${k}`, steps[k]!.answer, 0);
        const finish = steps.find((st) => quiet(() => gradeAnswer(puzzle, st.answer, Math.max(0, limit - st.atMs))).isCorrect);
        if (finish) push(`${level}:finish`, finish.answer, Math.max(0, limit - finish.atMs));
        else push(`${level}:buzzer`, steps.at(-1)!.answer, 0);
      }
    }
    console.log(`${type}: ${cases.filter((c) => c.type === type).length} cases`);
  }
  writeFileSync(TOPUP_FIXTURE, gzipSync(JSON.stringify({ puzzles, cases } satisfies TopupFixture)));
  console.log(`wrote ${TOPUP_FIXTURE}: ${cases.length} cases`);
}
