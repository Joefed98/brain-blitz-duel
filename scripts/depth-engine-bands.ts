/**
 * Bonk and Pull! old vs new score distributions (depth to 200, 25 Oct 2026; docs/depth/d3-speed-attention.md):
 * the puzzle-fairness kits' simulated players (average, good, great, near-perfect) plus an elite player, each on
 * `--seeds` room seeds, on the previous stamp (whackRev 2, clayRev 8) and the depth stamp (whackRev 3, clayRev 9),
 * graded by the server. Prints median, top 10 % and best per level. A tool (the checks import `engineBands`).
 *
 *   bun scripts/depth-engine-bands.ts [whack|clayshoot] [--seeds=40]
 */
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng, type Skill } from "./puzzle-fairness/kit";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import type { PuzzleData } from "../src/lib/duel/types";

/** Faster and cleaner than the near-perfect kit player: the top of the 200 scale. */
export const ELITE: Skill = { level: "near", pace: 0.4, err: 0.004, reactionMs: 140, reactionSd: 14 };
export const BAND_LEVELS: [string, Skill][] = [["average", SKILLS.average], ["good", SKILLS.good], ["great", SKILLS.great], ["near", SKILLS.near], ["elite", ELITE]];

export interface Dist { median: number; top10: number; best: number; scores: number[] }
function dist(scores: number[]): Dist {
  const s = [...scores].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
  return { median: at(0.5), top10: at(0.9), best: s[s.length - 1]!, scores: s };
}

export function engineBands(type: "whack" | "clayshoot", seeds: number, oldRev: number, newRev: number): { level: string; old: Dist; now: Dist }[] {
  const field = type === "whack" ? "whackRev" : "clayRev";
  const kit = KITS[type]!;
  return BAND_LEVELS.map(([level, skill]) => {
    const old: number[] = [];
    const now: number[] = [];
    for (let k = 0; k < seeds; k++) {
      const seed = 0x7a11 + k * 104729;
      for (const [rev, into] of [[oldRev, old], [newRev, now]] as const) {
        const puzzle = { type, seed, [field]: rev } as unknown as PuzzleData;
        const play = kit.play(puzzle, makeRng(hashText(`${type}:depth:${seed}:${level}`)), skill, 60_000);
        into.push(gradeAnswer(puzzle, play.steps.at(-1)!.answer, 0).score);
      }
    }
    return { level, old: dist(old), now: dist(now) };
  });
}

export function bandsTable(rows: ReturnType<typeof engineBands>, oldName: string, newName: string): string {
  const lines = [`| Level | ${oldName} median | top 10 % | best | ${newName} median | top 10 % | best |`, "| --- | --- | --- | --- | --- | --- | --- |"];
  for (const r of rows) lines.push(`| ${r.level} | ${r.old.median} | ${r.old.top10} | ${r.old.best} | ${r.now.median} | ${r.now.top10} | ${r.now.best} |`);
  return lines.join("\n");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const seeds = Number(args.find((a) => a.startsWith("--seeds="))?.slice(8) ?? 40);
  const types = args.filter((a) => !a.startsWith("--")) as ("whack" | "clayshoot")[];
  for (const type of types.length ? types : (["whack", "clayshoot"] as const)) {
    const rows = type === "whack" ? engineBands(type, seeds, 2, 3) : engineBands(type, seeds, 8, 9);
    console.log(`\n${type} (${seeds} seeds)\n` + bandsTable(rows, type === "whack" ? "whackRev 2" : "clayRev 8", type === "whack" ? "whackRev 3" : "clayRev 9"));
  }
}
