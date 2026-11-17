/**
 * Roofbound flipRev 13's tuning report (15 Nov 2026, the Action overhaul; docs/arcade-standard/flip.md "flipRev 13"; a
 * tool, not a check): the skill-band bots (scripts/arcade-skill-bands/bots/flip.ts, weak → flawless) play flipRev 12 and
 * flipRev 13 on the same dealt courses (paired; src/lib/duel/flipDeal.server.ts), each run replayed through the server
 * path, and the report gives per level the median score (p10–p90) on each stamp, the crashes and the parts' measures.
 * `--try=cost:full,…` also prints flipRev 13's medians re-scored with another crash cost and core-full figure (half
 * seconds), from the same runs (the play is the same: only the core's line moves).
 *
 *   bun scripts/flip-rev13-bands.ts [--seeds=40] [--from=0] [--levels=weak,average,...] [--try=40:120,20:110]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { stdLine } from "../src/lib/arcade/arcadeStandard";
import { Human, ALL_LEVELS } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/flip";
import { encodeFlipLog } from "./flip-x200-record";
import { replayFlipRun } from "../src/lib/duel/flip";
import { FLIP_DEAL } from "../src/lib/duel/flipDeal.server";
import { flipGameFor, flipGraceScore, flipSweetsTaken, FLIP_REV_DEAL, FLIP_REV_GRACE, FLIP_RUN_TICKS, type FlipState } from "../src/lib/arcade/flip";

const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 40);
const FROM = Number(opt("from") ?? 0);
const LEVELS = (opt("levels")?.split(",") ?? [...ALL_LEVELS]) as (typeof ALL_LEVELS)[number][];
const TRIES = (opt("try")?.split(",") ?? []).map((t) => t.split(":").map(Number));
export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[s.length >> 1]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : 0;
};
const mean = (xs: number[]) => Math.round((10 * xs.reduce((a, b) => a + b, 0)) / Math.max(1, xs.length)) / 10;
const spread = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return `${median(s)} (${s[Math.floor(s.length / 10)]}–${s[Math.floor((9 * s.length) / 10)]}), mean ${mean(s)}`;
};

/** One bot run on a stamp, replayed through the server path (its local score must match). */
export function flipBotRun(rev: number, seed: number, level: string): FlipState {
  const out = bot({ game: flipGameFor(rev), seed, rev, human: new Human("flip", seed, level as never), fixes: true } as any);
  const { raw, local } = encodeFlipLog(rev, seed, out.events ?? []);
  const r = replayFlipRun(seed, raw, rev);
  if (r.flagged || r.score !== local) throw new Error(`flipRev ${rev} ${level} seed ${seed}: replay ${r.score} (local ${local}) flagged ${r.flagged}`);
  return r.state;
}

/** flipRev 13's score with another crash cost, core-full figure and perfect-landing and double-flip full counts. */
function rescore(s: FlipState, t: number[]): number {
  const [cost, full, sweetsFull = 8, doublesFull = 8] = t as [number, number, number?, number?];
  const b = flipGraceScore(s);
  const alive = s.ended === 1 ? FLIP_RUN_TICKS : s.tick;
  const units = Math.max(0, Math.floor(alive / 30) - cost * (s.saves ?? 0));
  const core = stdLine(100, units, full);
  const total = core + stdLine(60, flipSweetsTaken(s), sweetsFull) + stdLine(20, s.combos ?? 0, doublesFull) + b.features.flow!;
  return Math.max(s.acted ? 1 : 0, Math.min(200, total));
}

if (import.meta.main) {
  console.log(`Roofbound flipRev 12 → 13, dealt courses ${FROM}–${FROM + SEEDS - 1} (paired, server replay)`);
  console.log(`| Level | flipRev 12 median (p10–p90) | flipRev 13 median (p10–p90) | Crashes (13) | Seconds lived (12) | Perfect landings | Double flips | Best streak |${TRIES.map((t) => ` ${t.join(":")} |`).join("")}`);
  console.log(`|---|---|---|---|---|---|---|---|${TRIES.map(() => "---|").join("")}`);
  for (const level of LEVELS) {
    const c: Record<string, number[]> = { v12: [], v13: [], crashes: [], secs: [], sweets: [], doubles: [], streak: [] };
    const tries = TRIES.map(() => [] as number[]);
    for (let n = FROM; n < FROM + SEEDS; n++) {
      const seed = FLIP_DEAL[n % FLIP_DEAL.length]!;
      const a = flipBotRun(FLIP_REV_DEAL, seed, level);
      c.v12!.push(flipGameFor(FLIP_REV_DEAL).score(a));
      c.secs!.push(Math.round((a.ended === 1 ? 3600 : a.tick) / 6) / 10);
      const s = flipBotRun(FLIP_REV_GRACE, seed, level);
      c.v13!.push(flipGameFor(FLIP_REV_GRACE).score(s));
      c.crashes!.push(s.saves ?? 0);
      c.sweets!.push(flipSweetsTaken(s));
      c.doubles!.push(s.combos ?? 0);
      c.streak!.push(s.bestStreak ?? 0);
      TRIES.forEach((t, i) => tries[i]!.push(rescore(s, t)));
    }
    console.log(`| ${level} | ${spread(c.v12!)} | ${spread(c.v13!)} | ${median(c.crashes!)} | ${median(c.secs!)} | ${median(c.sweets!)} | ${median(c.doubles!)} | ${median(c.streak!)} |${tries.map((t) => ` ${median(t)} / ${mean(t)} |`).join("")}`);
  }
}
