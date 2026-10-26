/**
 * Jaywalk crossRev 9 bands (x200, 26 Oct 2026; a tool, not a check). The skill-band bot plays room seeds on
 * crossRev 7 (rooms' revision before, LIVE_BANDS' strictRev) and crossRev 9 at the six band levels, every
 * crossRev 9 run through the server's replay, and prints per level the score (median / p90 / best), the old
 * score's median, and what the run did: crossings, clean crossings, lives lost, coins taken of those offered on
 * the crossings reached, the streak points, the play part and the skill pay.
 *
 *   bun scripts/cross-x200-bands.ts [--from=0] [--seeds=60] [--levels=weak,average,good,great,near,elite] [--json=<file>] [--no-old]
 */
import { writeFileSync } from "node:fs";
import { crossBandParts, crossBonusOf, crossCourse, crossGameFor, CROSS_REV_EXPAND, CROSS_REV_STRICT, type CrossState } from "../src/lib/arcade/cross";
import { decodeCrossRun, replayCrossRun } from "../src/lib/duel/cross";
import { BAND_LEVELS, type BandLevel } from "./arcade-skill-bands/human";
import { roomSeed } from "./arcade-skill-bands/games";
import { playCrossRun } from "./cross-expand-record";

const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const FROM = Number(opt("from") ?? 0);
const SEEDS = Number(opt("seeds") ?? 60);
const LEVEL_LIST = (opt("levels")?.split(",") ?? [...BAND_LEVELS]) as BandLevel[];
const NO_OLD = process.argv.includes("--no-old");

export interface XRow {
  level: string;
  seed: number;
  old: number;
  score: number;
  base: number;
  bonus: number;
  units: number;
  crossings: number;
  clean: number;
  livesLost: number;
  coins: number;
  offered: number;
  streakPts: number;
  closeCalls: number;
  /** Per crossing started: coins taken in it and whether it ended clean (finished without a hit). */
  perCrossing: { coins: number; offered: number; clean: boolean; finished: boolean }[];
}

const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1) + 0.5)))] ?? 0;
};
const med = (xs: number[]) => q(xs, 0.5);

const game = crossGameFor(CROSS_REV_EXPAND);
const rows: XRow[] = [];
const t0 = Date.now();
for (const level of LEVEL_LIST) {
  for (let n = FROM; n < FROM + SEEDS; n++) {
    const seed = roomSeed(n);
    const old = NO_OLD ? 0 : playCrossRun(CROSS_REV_STRICT, seed, level as never).score;
    const run = playCrossRun(CROSS_REV_EXPAND, seed, level as never);
    const out = replayCrossRun(seed, run.raw, CROSS_REV_EXPAND);
    if (out.flagged || out.score !== run.score) throw new Error(`replay disagreed: ${level} seed ${seed}`);
    // Walk the run again for per-crossing figures.
    const events = new Map(decodeCrossRun(run.raw).events.map((e) => [e.t, e]));
    let s = game.init(seed) as CrossState;
    const per: XRow["perCrossing"] = [{ coins: 0, offered: crossCourse(s).coins?.length ?? 0, clean: true, finished: false }];
    while (!game.isOver(s)) {
      const prev = s;
      s = game.step(s, events.get(s.tick + 1) ?? null);
      const cur = per[per.length - 1]!;
      if ((s.coinTotal ?? 0) > (prev.coinTotal ?? 0)) cur.coins += 1;
      if (s.lives < prev.lives) cur.clean = false;
      if (s.crossings > prev.crossings) {
        cur.finished = true;
        per.push({ coins: 0, offered: crossCourse(s).coins?.length ?? 0, clean: true, finished: false });
      }
    }
    const parts = crossBandParts(s);
    rows.push({
      level,
      seed,
      old: old,
      score: out.score,
      base: parts.points,
      bonus: crossBonusOf(s),
      units: parts.units,
      crossings: s.crossings,
      clean: s.clean,
      livesLost: 3 - s.lives,
      coins: s.coinTotal ?? 0,
      offered: per.reduce((a, c) => a + c.offered, 0),
      streakPts: s.streakPts ?? 0,
      closeCalls: s.closeCalls ?? 0,
      perCrossing: per,
    });
  }
}
console.log(`Jaywalk crossRev 9, seeds ${FROM}–${FROM + SEEDS - 1}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.log("level     score med/p90/best  old  zero  cross  clean  lost  coins/offered  streak  close  base  bonus");
for (const level of LEVEL_LIST) {
  const r = rows.filter((x) => x.level === level);
  const sc = r.map((x) => x.score);
  console.log(
    `${level.padEnd(9)} ${String(med(sc)).padStart(3)} / ${String(q(sc, 0.9)).padStart(3)} / ${String(Math.max(...sc)).padStart(3)}    ${String(med(r.map((x) => x.old))).padStart(3)}  ${String(sc.filter((v) => v === 0).length).padStart(4)}  ${med(r.map((x) => x.crossings)).toString().padStart(5)}  ${med(r.map((x) => x.clean)).toString().padStart(5)}  ${med(r.map((x) => x.livesLost)).toString().padStart(4)}  ${String(med(r.map((x) => x.coins))).padStart(5)} / ${String(med(r.map((x) => x.offered))).padEnd(6)}  ${String(med(r.map((x) => x.streakPts))).padStart(6)}  ${String(med(r.map((x) => x.closeCalls))).padStart(5)}  ${String(med(r.map((x) => x.base))).padStart(4)}  ${String(med(r.map((x) => x.bonus))).padStart(5)}`,
  );
}
const json = opt("json");
if (json) writeFileSync(json, JSON.stringify(rows));
