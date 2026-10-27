/**
 * Hover hoverRev 9 (the 200 expansion) bands: the skill-band bot at each level on hoverRev 7 (what rooms
 * dealt before) and hoverRev 9, on the same room seeds, every run scored by the server replay.
 * Prints median, top 10 % (90th percentile) and best per level, and how often the features were used.
 * Not a check: a measuring tool for tuning (docs/scoring-200.md step 5).
 *
 *   bun scripts/hover-x200-bands.ts [--seeds=40] [--levels=average,good,great,near,perfect]
 */
import { HOVER_REV_EXPAND, HOVER_REV_STRICT, hoverFeatureBonus } from "../src/lib/arcade/hover";
import { replayHoverRun } from "../src/lib/duel/hover";
import { roomSeed } from "./arcade-skill-bands/games";
import { botRun } from "./hover-x200-record";

const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 40);
const LEVELS = (opt("levels") ?? "average,good,great,near,perfect").split(",") as ("average" | "good" | "great" | "near" | "perfect")[];

const q = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))]!;
console.log(`level     rev  median  top10%  best   | survived  tight  chains  shields(taken/broke)  base-median`);
for (const level of LEVELS)
  for (const rev of [HOVER_REV_STRICT, HOVER_REV_EXPAND]) {
    const scores: number[] = [];
    const base: number[] = [];
    let survived = 0;
    let tight = 0;
    let chains = 0;
    let taken = 0;
    let broke = 0;
    for (let n = 0; n < SEEDS; n++) {
      const seed = roomSeed(n);
      const r = replayHoverRun(seed, botRun(rev, level, seed), rev);
      if (r.flagged) console.log(`FLAGGED ${level} ${rev} ${seed} ${r.reason}`);
      scores.push(r.score);
      base.push(r.score - (rev === HOVER_REV_EXPAND ? hoverFeatureBonus(r.state) : 0));
      survived += r.survived ? 1 : 0;
      tight += r.state.tight ?? 0;
      chains += r.state.chainsDone ?? 0;
      taken += r.state.pickupsTaken?.length ?? 0;
      broke += r.state.shieldBreaks ?? 0;
    }
    scores.sort((a, b) => a - b);
    base.sort((a, b) => a - b);
    const per = (x: number) => (x / SEEDS).toFixed(2);
    console.log(
      `${level.padEnd(9)} ${String(rev).padEnd(4)} ${String(q(scores, 0.5)).padEnd(7)} ${String(q(scores, 0.9)).padEnd(7)} ${String(scores.at(-1)).padEnd(6)} | ${per(survived).padEnd(9)} ${per(tight).padEnd(6)} ${per(chains).padEnd(7)} ${per(taken)}/${per(broke)}`.padEnd(98) + `${q(base, 0.5)}`,
    );
  }
