/**
 * Depth batch 4 tuning table (docs/depth/d4-pattern.md): old versus new score distributions for the eight games.
 * Each seeded room puzzle is dealt twice, on the old stamps (pinDepth4Off) and on the new, and played by the
 * simulated players (scripts/depth4/players.ts) at five levels; every answer is graded by gradeAnswer.
 *
 *   bun scripts/depth4-tune.ts [games…] [--seeds=40] [--elite=pipes:0.7,rings:0.9] [--md=out.md]
 *
 * Per level: the median, the 90th percentile (top 10 %) and the best. Not a check.
 */
import { writeFileSync } from "node:fs";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { pinDepth4Off } from "../src/lib/duel/depth4/deal.server";
import { withD4Elite } from "../src/lib/duel/depth4/score";
import { D4_TYPES, type D4Type } from "../src/lib/duel/depth4/stamps";
import type { PuzzleData } from "../src/lib/duel/types";
import { D4_LEVELS, runLevel, type D4Level } from "./depth4/players";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 40);
const ONLY = args.filter((a) => !a.startsWith("--")) as D4Type[];
const ELITE = Object.fromEntries((opt("elite") ?? "").split(",").filter(Boolean).map((kv) => [kv.split(":")[0], Number(kv.split(":")[1])]));

function puzzleFor(type: D4Type, seed: number, old: boolean): PuzzleData {
  pinDepth4Off(old);
  try {
    return withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed }));
  } finally {
    pinDepth4Off(false);
  }
}

const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]! : 0;
};

export interface TuneRow {
  type: D4Type;
  level: D4Level;
  old: { median: number; p90: number; best: number; solved: number };
  now: { median: number; p90: number; best: number; solved: number; share: number };
}

export function tune(types: D4Type[], seeds: number): TuneRow[] {
  const rows: TuneRow[] = [];
  for (const type of types) {
    const runs: Record<D4Level, { old: number[]; now: number[]; oldSolved: number; nowSolved: number; share: number[] }> = Object.fromEntries(
      D4_LEVELS.map((l) => [l, { old: [], now: [], oldSolved: 0, nowSolved: 0, share: [] }]),
    ) as never;
    for (let s = 1; s <= seeds; s++) {
      const seed = 7000 + s * 13;
      const oldP = puzzleFor(type, seed, true);
      const newP = puzzleFor(type, seed, false);
      for (const level of D4_LEVELS) {
        const a = runLevel(type, oldP, seed, level);
        const b = runLevel(type, newP, seed, level);
        const r = runs[level];
        r.old.push(a.score);
        r.now.push(b.score);
        if (a.solved) r.oldSolved++;
        if (b.solved) r.nowSolved++;
        if (b.share !== undefined) r.share.push(b.share);
      }
    }
    for (const level of D4_LEVELS) {
      const r = runs[level];
      rows.push({
        type,
        level,
        old: { median: q(r.old, 0.5), p90: q(r.old, 0.9), best: Math.max(...r.old), solved: r.oldSolved / seeds },
        now: { median: q(r.now, 0.5), p90: q(r.now, 0.9), best: Math.max(...r.now), solved: r.nowSolved / seeds, share: r.share.length ? r.share.reduce((x, y) => x + y, 0) / r.share.length : 0 },
      });
    }
  }
  return rows;
}

if (import.meta.main) {
  const types = ONLY.length ? ONLY : D4_TYPES;
  const rows = withD4Elite(Object.keys(ELITE).length ? ELITE : null, () => tune(types, SEEDS));
  const lines = [
    `| Game | Level | Old median | Old top 10 % | Old best | New median | New top 10 % | New best | Solved old → new |`,
    `| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |`,
    ...rows.map((r) => `| ${gameDisplayName(r.type)} | ${r.level} | ${r.old.median} | ${r.old.p90} | ${r.old.best} | ${r.now.median} | ${r.now.p90} | ${r.now.best} | ${Math.round(r.old.solved * 100)} % → ${Math.round(r.now.solved * 100)} % |`),
  ];
  console.log(lines.join("\n"));
  const md = opt("md");
  if (md) writeFileSync(md, lines.join("\n") + "\n");
}
