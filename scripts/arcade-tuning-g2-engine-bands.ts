/**
 * Score bands for the two engine games of taller worlds batch 2 (Oct 2026):
 * Mixed Signals (stroop) and Pull! (clayshoot). They are not arcade sims with a
 * band curve, so scripts/arcade-skill-bands.ts has no bot for them; their
 * simulated players are the puzzle-fairness kits (scripts/puzzle-fairness/
 * kits-engine.ts, the same ones that measured Mixed Signals' good level at 85 in
 * docs/puzzle-score-bands-oct-2026.md). Each of 30 room seeds (5001–5030) is
 * played at the four levels on the revision rooms dealt before the change
 * ("before": clashRev 4, clayRev 5) and on today's room puzzle ("after"), and
 * graded by the server's own gradeAnswer. Not a check: no pass/fail.
 *
 *   bun scripts/arcade-tuning-g2-engine-bands.ts [stroop|clayshoot] [--seeds=30] [--detail]
 */
import { LEVELS } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle, runPlay } from "./puzzle-fairness/run";
import { replayColourClashRun } from "../src/lib/duel/colourClash";
import { clashVariantOf } from "../src/lib/arcade/colourClash";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Array.from({ length: Number(opt("seeds") ?? 30) }, (_, i) => 5001 + i);
const TYPES = (args.filter((a) => !a.startsWith("--")) as ("stroop" | "clayshoot")[]);
const detail = args.includes("--detail");

/** The stamps rooms dealt before taller worlds batch 2. */
export function beforePuzzle(type: "stroop" | "clayshoot", seed: number): PuzzleData {
  const p = roomPuzzle(type, seed) as PuzzleData & Record<string, unknown>;
  return (type === "stroop" ? { ...p, clashRev: 4 } : { ...p, clayRev: 5 }) as PuzzleData;
}

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};

for (const type of TYPES.length ? TYPES : (["stroop", "clayshoot"] as const)) {
  const kit = KITS[type as PuzzleType]!;
  console.log(`\n${type}`);
  for (const level of LEVELS) {
    const out: Record<string, number[]> = { before: [], after: [] };
    const extra: Record<string, string[]> = { before: [], after: [] };
    for (const seed of SEEDS) {
      for (const [side, puzzle] of [["before", beforePuzzle(type, seed)], ["after", roomPuzzle(type as PuzzleType, seed)]] as const) {
        const run = runPlay(kit, puzzle, seed, level);
        out[side]!.push(run.score);
        if (detail && type === "stroop") {
          const r = replayColourClashRun((puzzle as { seed: number }).seed, run.answer, clashVariantOf(puzzle as never));
          extra[side]!.push(`${r.correct}/${r.wrong}${r.finished ? "f" : ""}@${r.state.finishTick || r.state.tick}`);
        }
      }
    }
    console.log(`  ${level.padEnd(8)} before median ${median(out.before!)} (${Math.min(...out.before!)}–${Math.max(...out.before!)})  after median ${median(out.after!)} (${Math.min(...out.after!)}–${Math.max(...out.after!)})`);
    if (detail) console.log(`    before ${extra.before!.join(" ")}\n    after  ${extra.after!.join(" ")}`);
  }
}
