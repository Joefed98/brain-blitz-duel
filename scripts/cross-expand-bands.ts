/**
 * Jaywalk expansion bands (crossRev 8, 25 Oct 2026; a tool, not a check). The skill-band bot
 * (scripts/arcade-skill-bands/bots/cross.ts) plays the same room seeds on crossRev 7 (rooms'
 * revision before) and crossRev 8, every run through the server's replay, and prints per level
 * the median / top 10 % / best of: the old score, the new score, the new play part alone (the
 * curve, ≤ 150) and the new bonus (coins and streak, ≤ 50).
 *
 *   bun scripts/cross-expand-bands.ts [--seeds=60] [--fit]
 *
 * --fit prints CROSS_V8_BAND_CURVE knots that put each quantile of the new play units on the old
 * score at the same quantile (all levels pooled), so the same skill scores what it did before
 * any bonus.
 */
import { crossBandParts, crossBonusOf, CROSS_REV_EXPAND, CROSS_REV_STRICT, type CrossState } from "../src/lib/arcade/cross";
import { replayCrossRun } from "../src/lib/duel/cross";
import { LEVELS } from "./arcade-skill-bands/human";
import { roomSeed } from "./arcade-skill-bands/games";
import { playCrossRun } from "./cross-expand-record";
import { setCoinChase } from "./arcade-skill-bands/bots/cross";

const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 60);
const FIT = process.argv.includes("--fit");

interface Row {
  level: string;
  old: number;
  score: number;
  base: number;
  bonus: number;
  units: number;
  coins: number;
  streakPts: number;
  /** The same player never going for a coin. */
  noChase: number;
}

const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1) + 0.5)))] ?? 0;
};
const stat = (xs: number[]) => `${String(q(xs, 0.5)).padStart(3)} / ${String(q(xs, 0.9)).padStart(3)} / ${String(Math.max(...xs)).padStart(3)}`;

const rows: Row[] = [];
for (const level of LEVELS) {
  for (let n = 0; n < SEEDS; n++) {
    const seed = roomSeed(n);
    const old = playCrossRun(CROSS_REV_STRICT, seed, level);
    const run = playCrossRun(CROSS_REV_EXPAND, seed, level);
    const out = replayCrossRun(seed, run.raw, CROSS_REV_EXPAND);
    if (out.flagged || out.score !== run.score) throw new Error(`replay disagreed: ${level} seed ${seed}`);
    const s = out.state as CrossState;
    setCoinChase(0);
    const plain = playCrossRun(CROSS_REV_EXPAND, seed, level).score;
    setCoinChase(1);
    const parts = crossBandParts(s);
    rows.push({ level, old: old.score, score: out.score, base: parts.points, bonus: crossBonusOf(s), units: parts.units, coins: s.coinTotal ?? 0, streakPts: s.streakPts ?? 0, noChase: plain });
  }
}

console.log(`Jaywalk, ${SEEDS} seeds a level: median / top 10 % / best`);
console.log("level     crossRev 7      crossRev 8      play part       bonus           coins           streak pts      8, no coin chase");
for (const level of LEVELS) {
  const r = rows.filter((x) => x.level === level);
  console.log(
    `${level.padEnd(9)} ${stat(r.map((x) => x.old))}   ${stat(r.map((x) => x.score))}   ${stat(r.map((x) => x.base))}   ${stat(r.map((x) => x.bonus))}   ${stat(r.map((x) => x.coins))}   ${stat(r.map((x) => x.streakPts))}   ${stat(r.map((x) => x.noChase))}`,
  );
}

if (FIT) {
  const units = rows.map((r) => r.units);
  const olds = rows.map((r) => r.old);
  const knots: [number, number][] = [[0, 0]];
  for (const p of [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.95]) {
    const u = q(units, p);
    const s = q(olds, p);
    const last = knots[knots.length - 1]!;
    if (u > last[0] && s > last[1]) knots.push([u, s]);
  }
  console.log(`fit units: [${knots.map((k) => k[0]).join(", ")}]  points: [${knots.map((k) => k[1]).join(", ")}]`);
}
