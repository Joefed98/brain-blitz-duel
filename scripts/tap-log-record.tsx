/**
 * Records the honest-run fixture for the tap-log change (Flash, Bang On,
 * Ascend). Run on main, before the change: it plays each puzzle's real phone
 * Stage with the scripted honest players, keeps what the phone submitted and
 * what main's server stored for it, and writes
 * scripts/fixtures/tap-log-honest-runs.json. tap-log-check.tsx then proves the
 * new server grading gives every recorded run the same score and tie-break time.
 *
 *   bun scripts/tap-log-record.tsx        (only when the fixture must be rebuilt on main)
 */
import { writeFileSync } from "node:fs";

import { drive, type ScriptedTap } from "./tap-log-driver";
import {
  FLASH_SELECTOR,
  WATCH_SELECTOR,
  circleSelector,
  planAscend,
  planFlash,
  planWatch,
  planWatchLeadIn,
} from "./tap-log-players";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { reactionPuzzle } from "../src/puzzles/reaction";
import { stopWatchPuzzle } from "../src/puzzles/stopWatch";
import { numberHuntPuzzle } from "../src/puzzles/numberHunt";
import type { NumberHuntPuzzleData, PuzzleData, ReactionPuzzleData, StopWatchPuzzleData } from "../src/lib/duel/types";

const RUNS = 12;
const runs: unknown[] = [];

function stored(puzzle: PuzzleData, answer: string, msRemaining: number, meta: Record<string, unknown> | null) {
  // Exactly what the room sends: onSubmit's meta as `extra`, none at the buzzer.
  const extra = meta
    ? { reactionAvgMs: meta["reactionAvgMs"] as number | undefined, correctCount: meta["correctCount"] as number | undefined, errors: meta["errors"] as number | undefined }
    : undefined;
  const g = gradeAnswer(puzzle, answer, msRemaining, extra);
  return { score: g.score, reactionAvgMs: g.reactionAvgMs, storedMs: g.storedMs, errors: g.errors, correctCount: g.correctCount, isCorrect: g.isCorrect };
}

for (let seed = 1; seed <= RUNS; seed++) {
  const puzzle = withSeededRandom(40_000 + seed, () => generatePuzzle("reaction")) as ReactionPuzzleData;
  const plan = planFlash(puzzle, seed);
  const result = await drive(reactionPuzzle.Stage, puzzle, puzzleTimeLimitMs(puzzle), {
    initial: plan.map((t): ScriptedTap => ({ t, selector: FLASH_SELECTOR, event: "pointerdown" })),
  });
  runs.push({ game: "reaction", seed, puzzle, ...result, taps: result.taps.map((tap) => tap.t), stored: stored(puzzle, result.answer, result.msRemaining, result.meta as Record<string, unknown> | null) });
}

for (let seed = 1; seed <= RUNS; seed++) {
  const puzzle = withSeededRandom(50_000 + seed, () => generatePuzzle("stopwatch")) as StopWatchPuzzleData;
  const watches: { start: number; e: number | null; gap: number | null }[] = [];
  let seen = 0;
  const lead = planWatchLeadIn(seed);
  const result = await drive(stopWatchPuzzle.Stage, puzzle, puzzleTimeLimitMs(puzzle), {
    initial: lead === null ? [] : [{ t: lead, selector: WATCH_SELECTOR, event: "pointerdown" }],
    onFrame: (rel, container, schedule) => {
      const label = [...container.querySelectorAll("p")].map((p) => /^Watch (\d+) \/ \d+$/.exec(p.textContent ?? "")).find(Boolean);
      const index = label ? Number(label[1]) - 1 : -1;
      if (index < seen) return;
      // The legacy phone starts watch 1 after the lead-in, later ones on the frame after the gap.
      const start = index === 0 ? 800 : rel;
      const plan = planWatch(puzzle.watches[index]!, index, seed);
      watches.push({ start, ...plan });
      if (plan.e !== null) {
        schedule({ t: start + plan.e, selector: WATCH_SELECTOR, event: "pointerdown" });
        if (plan.gap !== null) schedule({ t: start + plan.e + plan.gap, selector: WATCH_SELECTOR, event: "pointerdown" });
      }
      seen = index + 1;
    },
  });
  runs.push({ game: "stopwatch", seed, puzzle, watches, ...result, taps: result.taps.map((tap) => tap.t), stored: stored(puzzle, result.answer, result.msRemaining, result.meta as Record<string, unknown> | null) });
}

for (let seed = 1; seed <= RUNS; seed++) {
  const puzzle = withSeededRandom(60_000 + seed, () => generatePuzzle("numhunt")) as NumberHuntPuzzleData;
  const slow = seed % 4 === 0;
  const plan = planAscend(puzzle, seed, slow);
  const result = await drive(numberHuntPuzzle.Stage, puzzle, puzzleTimeLimitMs(puzzle), {
    initial: plan.map((tap): ScriptedTap => ({ t: tap.t, selector: circleSelector(tap.n), event: "click" })),
  });
  const byTime = new Map(plan.map((tap) => [tap.t, tap.n]));
  runs.push({
    game: "numhunt", seed, slow, puzzle,
    ...result,
    taps: result.taps.map((tap) => ({ n: byTime.get(tap.t)!, t: tap.t })),
    stored: stored(puzzle, result.answer, result.msRemaining, result.meta as Record<string, unknown> | null),
  });
}

const fixture = {
  note: "Honest runs recorded on main (commit before the tap-log change) by scripts/tap-log-record.tsx: the real phone Stage played by the scripted players in scripts/tap-log-players.ts. `answer`/`meta`/`msRemaining` are what the phone sent; `stored` is what main's server stored. Bang On `watches` holds each watch's start on the round clock and the tap's ms after it (the legacy phone started each watch on the first frame after the gap).",
  runs,
};
writeFileSync("scripts/fixtures/tap-log-honest-runs.json", JSON.stringify(fixture, null, 1) + "\n");
for (const run of runs as { game: string; seed: number; submitted: boolean; answer: string; stored: { score: number; reactionAvgMs: number | null; storedMs: number; errors: number | null } }[]) {
  console.log(`${run.game.padEnd(9)} seed ${String(run.seed).padStart(2)} ${run.submitted ? "submit " : "buzzer "} score ${String(run.stored.score).padStart(3)} avg ${run.stored.reactionAvgMs ?? "-"} ms ${run.stored.storedMs} errors ${run.stored.errors ?? "-"}  ${run.answer.slice(0, 70)}`);
}
console.log(`recorded ${runs.length} honest runs`);
