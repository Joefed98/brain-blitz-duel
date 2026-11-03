/**
 * Roofbound flipRev 11's tuning report (3 Nov 2026, docs/arcade-standard/flip.md "flipRev 11"; a tool, not a check):
 * the skill-band bots (scripts/arcade-skill-bands/bots/flip.ts, weak → flawless) play flipRev 10 and flipRev 11 on the
 * same room seeds (paired), each run replayed through the server path, and the report gives per level the median score
 * (p10–p90) on each stamp and, for flipRev 11, the median of each part's measure: seconds lived, crashes saved, the
 * runs lasting the minute, clean half seconds, perfect landings, double flips and the longest flow streak.
 *
 *   bun scripts/flip-rev11-bands.ts [--seeds=60] [--from=10000] [--levels=weak,average,...]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, ALL_LEVELS } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/flip";
import { encodeFlipLog } from "./flip-x200-record";
import { replayFlipRun } from "../src/lib/duel/flip";
import { flipFlowUnits, flipGameFor, flipSweetsTaken, FLIP_REV_FLOW, FLIP_REV_STD, type FlipState } from "../src/lib/arcade/flip";

const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 60);
const FROM = Number(opt("from") ?? 10000);
const LEVELS = (opt("levels")?.split(",") ?? [...ALL_LEVELS]) as (typeof ALL_LEVELS)[number][];
const spec = GAME_BY_TYPE.get("flip" as never)!;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[s.length >> 1]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : 0;
};
const spread = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return `${median(s)} (${s[Math.floor(s.length / 10)]}–${s[Math.floor((9 * s.length) / 10)]})`;
};
const run = (rev: number, seed: number, level: string): FlipState => {
  const out = bot({ game: flipGameFor(rev), seed, rev, human: new Human("flip", seed, level as never), fixes: true } as any);
  const { raw, local } = encodeFlipLog(rev, seed, out.events ?? []);
  const r = replayFlipRun(seed, raw, rev);
  if (r.flagged || r.score !== local) throw new Error(`flipRev ${rev} ${level} seed ${seed}: replay ${r.score} (local ${local}) flagged ${r.flagged}`);
  return r.state;
};

const rows: string[] = [];
for (const level of LEVELS) {
  const c: Record<string, number[]> = { v10: [], v11: [], secs: [], saves: [], minute: [], clean: [], sweets: [], doubles: [], streak: [] };
  for (let n = FROM; n < FROM + SEEDS; n++) {
    const seed = spec.seedFor(n);
    c.v10!.push(flipGameFor(FLIP_REV_STD).score(run(FLIP_REV_STD, seed, level)));
    const s = run(FLIP_REV_FLOW, seed, level);
    c.v11!.push(flipGameFor(FLIP_REV_FLOW).score(s));
    c.secs!.push(Math.round((s.ended === 1 ? 3600 : s.tick) / 6) / 10);
    c.saves!.push(s.saves ?? 0);
    c.minute!.push(s.ended === 1 ? 1 : 0);
    c.clean!.push(flipFlowUnits(s));
    c.sweets!.push(flipSweetsTaken(s));
    c.doubles!.push(s.combos ?? 0);
    c.streak!.push(s.bestStreak ?? 0);
  }
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  rows.push(`| ${level} | ${spread(c.v10!)} | ${spread(c.v11!)} | ${median(c.secs!)} | ${median(c.saves!)} | ${sum(c.minute!)} / ${SEEDS} | ${median(c.clean!)} | ${median(c.sweets!)} | ${median(c.doubles!)} | ${median(c.streak!)} |`);
  console.error(`${level} done`);
}
console.log(`Roofbound flipRev 10 → 11, seeds n = ${FROM}–${FROM + SEEDS - 1} (paired, server replay)`);
console.log("| Level | flipRev 10 median (p10–p90) | flipRev 11 median (p10–p90) | Seconds lived | Saves | Lasted the minute | Clean half seconds | Perfect landings | Double flips | Best streak |");
console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const r of rows) console.log(r);
