/**
 * Tenfall depth tuning table (report only, not a check): kit players on 30 room seeds, graded by the server's
 * gradeAnswer under tenRev 3 and tenRev 4 (the same run: tenRev 4's plan and play are tenRev 3's).
 *
 *   bun scripts/tendrop-depth-bands.ts [seeds]
 *
 * Rows: the shared SKILLS levels with the puzzle-fairness kit as is (gold-blind, today's players), the same
 * levels playing for gold (tenRev 4 player, a gold ten worth 4 tiles of time), an elite level (pace 0.35, no mis-adds,
 * 140 ms reactions; scripts/tendrop-depth-player.ts) and the scripted best run.
 */
import { gradeAnswer } from "@/lib/duel/generate.server";
import { TEN_DROP_DEPTH_REV, TEN_DROP_RAW_REV } from "@/lib/arcade/tenDrop";
import type { PuzzleData } from "@/lib/duel/types";
import { roomPuzzle } from "./puzzle-fairness/run";
import { KITS_ENGINE } from "./puzzle-fairness/kits-engine";
import { hashText, makeRng, SKILLS, type Skill } from "./puzzle-fairness/kit";
import { ELITE, playTenDrop, playTenDropPerfect } from "./tendrop-depth-player";

const N = Number(process.argv[2] ?? 30);
const SEEDS = Array.from({ length: N }, (_, n) => 4401 + n * 13);
const kit = KITS_ENGINE.find((k) => k.type === "tendrop")!;
const quiet = <T>(fn: () => T): T => {
  const e = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = e;
  }
};
const grade = (p: PuzzleData, rev: number, raw: string) => quiet(() => gradeAnswer({ ...(p as object), tenRev: rev } as PuzzleData, raw, 0)).score;

const rows: { label: string; play: (p: PuzzleData & { seed: number }, seed: number) => string }[] = [];
for (const [lv, skill] of Object.entries(SKILLS)) {
  rows.push({ label: `${lv} (kit)`, play: (p, seed) => kit.play(p, makeRng(hashText(`td-depth:${seed}:${lv}`)), skill, 90_000).steps.at(-1)!.answer });
}
const golden = (lv: string, skill: Skill, w: number) =>
  rows.push({ label: `${lv} + gold`, play: (p, seed) => playTenDrop(p.seed, TEN_DROP_DEPTH_REV, makeRng(hashText(`td-depth:g:${seed}:${lv}`)), skill, w).raw });
golden("good", SKILLS.good, 4);
golden("great", SKILLS.great, 4);
golden("near", SKILLS.near, 4);
rows.push({ label: "elite (no gold)", play: (p, seed) => playTenDrop(p.seed, TEN_DROP_DEPTH_REV, makeRng(hashText(`td-depth:e:${seed}`)), ELITE, 0).raw });
golden("elite", ELITE, 4);
rows.push({ label: "scripted best", play: (p) => playTenDropPerfect(p.seed, TEN_DROP_DEPTH_REV).raw });

const stat = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const q = (f: number) => s[Math.min(s.length - 1, Math.floor(f * s.length))]!;
  return { median: q(0.5), top10: q(0.9), best: s[s.length - 1]! };
};

console.log(`Tenfall tenRev ${TEN_DROP_RAW_REV} → tenRev ${TEN_DROP_DEPTH_REV}, ${SEEDS.length} room seeds (median / top 10 % / best)`);
console.log("| Player | tenRev 3 | tenRev 4 |");
console.log("|---|---|---|");
for (const row of rows) {
  const old: number[] = [];
  const now: number[] = [];
  for (const seed of SEEDS) {
    const p = roomPuzzle("tendrop", seed) as PuzzleData & { seed: number };
    const raw = row.play(p, seed);
    old.push(grade(p, TEN_DROP_RAW_REV, raw));
    now.push(grade(p, TEN_DROP_DEPTH_REV, raw));
  }
  const a = stat(old);
  const b = stat(now);
  console.log(`| ${row.label} | ${a.median} / ${a.top10} / ${a.best} | ${b.median} / ${b.top10} / ${b.best} |`);
}
