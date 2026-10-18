/**
 * Nucleus and Forage word points per simulated level (scoring targets, Oct 2026).
 *
 *   bun scripts/word-open-bands.ts [--seeds=30]
 *
 * Plays the puzzle-fairness kits on room puzzles 5001… and prints, per level,
 * the median (p10–p90) of the board share found (points ÷ the board's total, in
 * per mille), the raw points and the graded score. A tool, not a check.
 */
import { LEVELS, type Level } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle, runPlay } from "./puzzle-fairness/run";

const args = process.argv.slice(2);
const SEEDS = Number(args.find((a) => a.startsWith("--seeds="))?.slice(8) ?? 30);
const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.round((s.length - 1) * p))]!;
};
for (const type of ["wordsmith", "wordhunt"] as const) {
  const kit = KITS[type]!;
  for (const level of LEVELS as readonly Level[]) {
    const share: number[] = [];
    const pts: number[] = [];
    const score: number[] = [];
    for (let n = 0; n < SEEDS; n++) {
      const seed = 5001 + n;
      const puzzle = roomPuzzle(type, seed) as unknown as { words?: { points: number }[] };
      const total = (puzzle.words ?? []).reduce((s, w) => s + w.points, 0);
      const r = runPlay(kit, puzzle as never, seed, level);
      const points = Number((r.extra as Record<string, unknown> | undefined)?.points ?? 0);
      pts.push(points);
      share.push(Math.round((1000 * points) / Math.max(1, total)));
      score.push(r.score);
    }
    const f = (xs: number[]) => `${q(xs, 0.5)} (${q(xs, 0.1)}–${q(xs, 0.9)})`;
    console.log(`${type.padEnd(10)} ${level.padEnd(8)} share‰ ${f(share).padEnd(16)} points ${f(pts).padEnd(14)} score ${f(score)}`);
  }
}
