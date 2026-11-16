/**
 * Skid's levels report (difficulty levels, 16 Nov 2026): the person-like players (scripts/iceslide-human.ts) on real
 * deals at every level, graded by the server's own code, beside the shared tuning tool's kit numbers
 * (`bun scripts/level-tune.ts iceslide --level=all`). A tool, not a check.
 *
 *   bun scripts/iceslide-levels-report.ts [--seeds=40] [--from=0] [--level=easy,normal,hard,expert]
 */
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { Level } from "../src/lib/levels/levels";
import { dealAt } from "./level-tune";
import { SKID_ELITE_PERSON, SKID_GOOD_PERSON, playSkidLikeAPerson } from "./iceslide-human";
import { gradeSteps } from "./standard-lib";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const seeds = Number(arg("seeds") ?? 40);
const from = Number(arg("from") ?? 0);
const levels = (arg("level") ?? "easy,normal,hard,expert").split(",") as Level[];

// --boards: every Expert bank board with the elite person-like player's graded score (boards for Joe to play).
if (process.argv.includes("--boards")) {
  const { ICESLIDE_LEVEL_BANKS } = await import("../src/lib/duel/iceSlideLevelBank.server");
  const rows = ICESLIDE_LEVEL_BANKS.expert.map((p0, index) => {
    const p = { ...p0, timeLimitMs: 120_000, slideRev: 5, puzzleScoreRev: 3, speedPar: 1, par: p0.minMoves, level: "expert" } as typeof p0;
    const play = playSkidLikeAPerson(p, SKID_ELITE_PERSON, 120_000);
    const run = gradeSteps(p, play.steps);
    return { index, par: p0.minMoves, score: run.score, solved: run.isCorrect, seconds: Math.round(run.seconds) };
  });
  rows.sort((a, b) => b.score - a.score);
  for (const r of rows) console.log(`expert bank ${r.index}: par ${r.par}, person (elite) ${r.score}${r.solved ? ` in ${r.seconds} s` : " (unfinished)"}`);
  process.exit(0);
}

for (const level of levels) {
  const tryOut = arg("person");
  for (const who of tryOut ? [{ ...SKID_ELITE_PERSON, name: "person (try)", ...JSON.parse(tryOut) }] : [SKID_GOOD_PERSON, SKID_ELITE_PERSON]) {
    const scores: number[] = [];
    let finished = 0;
    let secs = 0;
    let extra = 0;
    let minSum = 0;
    for (let n = from; n < from + seeds; n++) {
      const p = dealAt("iceslide", level, n);
      const limit = puzzleTimeLimitMs(p);
      const play = playSkidLikeAPerson(p, who, limit);
      const run = gradeSteps(p, play.steps);
      scores.push(run.score);
      if (run.isCorrect) {
        finished++;
        secs += run.seconds;
        extra += play.slides - play.undos - ((p as { minMoves?: number }).minMoves ?? 0);
      }
      minSum += (p as { minMoves?: number }).minMoves ?? 0;
    }
    scores.sort((a, b) => a - b);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const med = scores[Math.floor(scores.length / 2)]!;
    console.log(
      `iceslide ${level.padEnd(7)} ${who.name.padEnd(15)} avg ${avg.toFixed(1).padStart(6)}  median ${String(med).padStart(3)}  finished ${((100 * finished) / seeds).toFixed(0).padStart(3)}%` +
        `  (avg minimum ${(minSum / seeds).toFixed(1)}; finishers: ${finished ? (secs / finished).toFixed(1) : "-"} s, ${finished ? (extra / finished).toFixed(1) : "-"} slides over par)`,
    );
  }
}
