/**
 * Records the stored-round fixture for the D5 remodels (Topsy-Turvy gravityRev 3, Jumbled tilesRev 3;
 * docs/depth/d5-remodels.md) ON UNMODIFIED MAIN, before the remodels: room puzzles exactly as main dealt
 * them (Topsy-Turvy gravityRev 2 on puzzleScoreRev 3, Jumbled tilesRev 2 on puzzleScoreRev 3) plus the
 * same puzzles under every older stamp shape (score revs 0–2, the older limit and board stamps), each with
 * answers graded by main. scripts/d5-remodels-legacy-check.ts proves every entry still grades identically.
 *
 *   RECORDED_ON=<commit> bun scripts/d5-remodels-legacy-record.ts [seedsPerGame]
 *
 * Only a main checkout should ever write this file.
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

export const D5_LEGACY_GAMES: PuzzleType[] = ["gravity", "tiles"];
export const D5_LEGACY_FIXTURE = "scripts/fixtures/d5-remodels-legacy.json.gz";

function record(puzzle: PuzzleData, answer: string, ms: number): LegacyEntry {
  const g = gradeAnswer(puzzle, answer, ms);
  return { answer, ms, score: g.score, isCorrect: g.isCorrect, correctCount: g.correctCount, errors: g.errors, storedMs: g.storedMs, extra: stableExtra(g.extra) };
}

function variant(puzzle: PuzzleData, set: Record<string, unknown>, drop: string[]): PuzzleData {
  const copy = { ...(puzzle as object) } as Record<string, unknown>;
  for (const key of drop) delete copy[key];
  return { ...copy, ...set } as unknown as PuzzleData;
}

/** Every stored shape a round of the game can carry today. */
function shapes(type: PuzzleType, dealt: PuzzleData): [string, PuzzleData][] {
  const out: [string, PuzzleData][] = [["dealt", dealt]];
  for (const rev of [2, 1]) out.push([`score${rev}`, variant(dealt, { puzzleScoreRev: rev }, [])]);
  out.push(["unstamped", variant(dealt, {}, ["puzzleScoreRev", "speedPar"])]);
  if (type === "gravity") {
    out.push(["grav1", variant(dealt, { gravityRev: 1 }, [])]);
    out.push(["grav1-score1", variant(dealt, { gravityRev: 1, puzzleScoreRev: 1 }, [])]);
    out.push(["grav0", variant(dealt, {}, ["gravityRev", "tiltLimit", "puzzleScoreRev", "speedPar"])]);
  } else {
    out.push(["tiles1", variant(dealt, { tilesRev: 1 }, ["timeLimitMs"])]);
    out.push(["tiles1-score1", variant(dealt, { tilesRev: 1, puzzleScoreRev: 1 }, ["timeLimitMs"])]);
  }
  return out;
}

if (import.meta.main) {
  const seeds = Number(process.argv[2] ?? 4);
  const cases: LegacyCase[] = [];
  for (const type of D5_LEGACY_GAMES) {
    const kit = KITS[type]!;
    for (let s = 0; s < seeds; s++) {
      const seed = 25_501 + s;
      const dealt = roomPuzzle(type, seed);
      for (const [shape, puzzle] of shapes(type, dealt)) {
        const limit = puzzleTimeLimitMs(puzzle);
        const answers: [string, number][] = [[kit.nothing(puzzle), 0], [kit.nothing(puzzle), limit]];
        for (const sp of kit.spam(puzzle, makeRng(hashText(`d5legacy:spam:${type}:${seed}`)), limit)) answers.push([sp.answer, 0]);
        for (const level of LEVELS) {
          const play = kit.play(puzzle, makeRng(hashText(`d5legacy:play:${type}:${seed}:${level}`)), SKILLS[level], limit);
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
  writeFileSync(D5_LEGACY_FIXTURE, gzipSync(JSON.stringify({ recordedOn: process.env.RECORDED_ON ?? "main", cases })));
  console.log(`wrote ${cases.length} cases, ${cases.reduce((n, c) => n + c.entries.length, 0)} answers`);
}
