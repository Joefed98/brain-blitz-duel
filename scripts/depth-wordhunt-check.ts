/**
 * depth-wordhunt-check (25 Oct 2026, word depth d1; docs/depth/d1-word.md "Forage").
 *
 *   1. Legacy: every Forage round recorded before the depth change (wordHuntRev 2 room puzzles on 20 seeds, and the
 *      same boards stamped wordHuntRev 1 and unstamped; kit players at every level, nothing and spam) regrades to
 *      exactly the stored score, isCorrect and extra (scripts/fixtures/depth-wordhunt-legacy.json.gz).
 *   2. wordHuntRev 3: new rounds deal the 6×6 board with a public golden tile on the stamp; the 5×5 path rules are
 *      untouched for older boards; long words and the golden tile score as stated; base points alone stop at 150 and
 *      only feature points reach above it; scores 0–200; more words never score less; misses still cut; the elite
 *      kit player reaches 190–200; the help and intro state the features.
 *
 *   bun scripts/depth-wordhunt-check.ts            # check
 *   bun scripts/depth-wordhunt-check.ts --record   # re-record the legacy fixture (only on the pre-depth code)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { pinPreDepth } from "../src/lib/duel/wordDepth";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleData, WordHuntPuzzleData } from "../src/lib/duel/types";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";
import { pinPreTopup } from "../src/lib/duel/depthTopup";

// The puzzle top-up (26 Oct 2026, docs/depth/topup-oct-2026.md) deals newer stamps; this check proves the stamps it was
// written for, so new deals are pinned to them (depth-topup-check proves the top-up's).
pinPreTopup(true);

const FIXTURE = "scripts/fixtures/depth-wordhunt-legacy.json.gz";
const RECORD = process.argv.includes("--record");

interface Run {
  puzzle: PuzzleData;
  answer: string;
  ms: number;
  score: number;
  isCorrect: boolean;
  extra: unknown;
}

const failures: string[] = [];
let passes = 0;
function ok(cond: boolean, message: string): void {
  if (cond) passes++;
  else if (failures.length < 40) failures.push(message);
}

function legacyRuns(): Run[] {
  const kit = KITS.wordhunt!;
  const runs: Run[] = [];
  const add = (puzzle: PuzzleData, answer: string, ms: number) => {
    const g = gradeAnswer(puzzle, answer, ms);
    runs.push({ puzzle, answer, ms, score: g.score, isCorrect: g.isCorrect, extra: g.extra });
  };
  pinPreDepth(true);
  try {
    for (let s = 1; s <= 20; s++) {
      const seed = 9300 + s;
      const rev2 = roomPuzzle("wordhunt", seed) as WordHuntPuzzleData;
      const variants: PuzzleData[] = [rev2];
      if (s <= 6) {
        variants.push({ ...rev2, wordHuntRev: 1 } as PuzzleData);
        const { wordHuntRev: _drop, ...plain } = rev2;
        variants.push(plain as PuzzleData);
      }
      const limit = puzzleTimeLimitMs(rev2);
      for (const puzzle of variants) {
        add(puzzle, kit.nothing(puzzle), 0);
        for (const sp of kit.spam(puzzle, makeRng(hashText(`dw:spam:${seed}`)), limit)) add(puzzle, sp.answer, 0);
        for (const level of LEVELS) {
          const play = kit.play(puzzle, makeRng(hashText(`dw:${seed}:${level}`)), SKILLS[level], limit);
          const inTime = play.steps.filter((st) => st.atMs <= limit);
          const last = inTime[inTime.length - 1];
          if (!last) continue;
          add(puzzle, last.answer, 0);
          const mid = inTime[Math.floor(inTime.length / 2)];
          if (mid) add(puzzle, mid.answer, Math.max(0, limit - mid.atMs));
        }
      }
    }
  } finally {
    pinPreDepth(false);
  }
  return runs;
}

if (RECORD) {
  const runs = legacyRuns();
  writeFileSync(FIXTURE, gzipSync(JSON.stringify({ recordedOn: "pre-depth main code, 25 Oct 2026", runs })));
  console.log(`recorded ${runs.length} legacy Forage runs to ${FIXTURE}`);
  process.exit(0);
}

/* 1. Legacy. */
const fixture = JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString()) as { runs: Run[] };
for (const [i, r] of fixture.runs.entries()) {
  const g = gradeAnswer(r.puzzle, r.answer, r.ms);
  const same = g.score === r.score && g.isCorrect === r.isCorrect && JSON.stringify(g.extra) === JSON.stringify(r.extra);
  ok(same, `legacy run ${i} (wordHuntRev ${(r.puzzle as WordHuntPuzzleData).wordHuntRev ?? "none"}): ${r.score} → ${g.score}`);
}
ok(fixture.runs.length >= 300, `the legacy fixture holds ${fixture.runs.length} runs`);

/* 2. wordHuntRev 3. */
const NEW_CHECKS = (await import("./depth-wordhunt-new")).newStampChecks;
NEW_CHECKS(ok);

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL depth-wordhunt-check: ${failures.length} failures, ${passes} passed`);
  process.exit(1);
}
console.log(`PASS depth-wordhunt-check: ${passes} checks — ${fixture.runs.length} legacy Forage runs regrade exactly; wordHuntRev 3's 6×6 board, long words and golden tile score as stated`);
