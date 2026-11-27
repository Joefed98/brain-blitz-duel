/**
 * Spacewalk's D5 tuning tool (23 Nov 2026; a tool, not a check): plays the ladder players on crossRev 14 level games and
 * keeps each run's raw counts (rows and crossings, the no-stop crossings in a row, close calls, lives lost) and whether
 * every crossing of the seed is proved passable at the level's density, so the level's full lines can be set offline
 * (scoring does not change how a player walks).
 *
 *   bun scripts/cross-level-tune.ts record <level> [--from=0] [--n=40] [--bots=average,elite,proof] [--lv=<json>] [--out=<file>]
 *   bun scripts/cross-level-tune.ts score <file…> [--lines=<level>:<json> …]
 */
import { appendFileSync, readFileSync } from "node:fs";
import {
  CROSS_REV_DENSE,
  CROSS_REV_LIGHT,
  crossDenseCrossingsProved,
  crossDenseGameOf,
  crossGameFor,
  crossLivesOf,
  crossTotalLanes,
  type CrossState,
} from "../src/lib/arcade/cross";
import { CROSS_LEVELS_V14, type CrossLvV14 } from "../src/lib/arcade/retroLevels";
import type { ArcadeGame, ArcadeInputEvent } from "../src/lib/arcade/engine";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human, HUMAN_LIMITS, type SkillLevel } from "./arcade-skill-bands/human";
import { loadBot } from "./d5-ladder-lib";

export interface CrossRaw {
  level: string;
  bot: string;
  n: number;
  seed: number;
  proved: boolean;
  units: number;
  streakN: number;
  close: number;
  lost: number;
  out: boolean;
  acted: number;
  score: number;
}
export interface CrossLines {
  fullAt: number;
  streakAt: number;
  closeAt: number;
  hitCost: number;
}

export function rawOf(level: string, bot: string, n: number, seed: number, proved: boolean, s: CrossState): CrossRaw {
  const lives = crossLivesOf(s);
  return {
    level,
    bot,
    n,
    seed,
    proved,
    units: crossTotalLanes(s) + 2 * s.crossings,
    streakN: Math.trunc((s.streakPts ?? 0) / 10),
    close: s.closeCalls ?? 0,
    lost: Math.max(0, Math.min(lives, lives - s.lives)),
    out: s.lives <= 0,
    acted: s.acted ? 1 : 0,
    score: 0,
  };
}

/** A run's score on candidate lines (crossRev 12+'s rule, crossFlowScore with the level's lines). */
export function scoreOn(r: CrossRaw, l: CrossLines): number {
  const line = (max: number, got: number, of: number) => (of <= 0 ? 0 : Math.floor((max * Math.max(0, Math.min(Math.trunc(got), of))) / of));
  const core = line(150, r.units, l.fullAt);
  const charged = Math.max(0, r.lost - (r.out && r.lost > 0 ? 1 : 0));
  const penalty = Math.max(0, Math.min(l.hitCost * charged, Math.floor(core / 2)));
  const sum = core + line(40, r.streakN, l.streakAt) + line(10, r.close, l.closeAt) - penalty;
  return r.acted ? Math.max(1, Math.min(200, sum)) : 0;
}

export async function playCross(game: ArcadeGame<CrossState, ArcadeInputEvent | null>, seed: number, bot: string, rev: number): Promise<{ state: CrossState; events: ArcadeInputEvent[] }> {
  const skill = (bot === "proof" ? "perfect" : bot) as SkillLevel;
  const fn = await loadBot("cross");
  const out = fn({ game, seed, rev, human: new Human("cross", seed, skill, HUMAN_LIMITS), fixes: true } as never);
  const events = (out.events ?? []) as ArcadeInputEvent[];
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as CrossState;
  while (!game.isOver(s) && s.tick < game.runTicks) s = game.step(s, byTick.get(s.tick + 1) ?? null) as CrossState;
  return { state: s, events };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (args[0] === "record") {
    const level = args[1] ?? "normal";
    const from = Number(opt("from") ?? 0);
    const count = Number(opt("n") ?? 40);
    const bots = (opt("bots") ?? "average,elite,proof").split(",");
    const lv = opt("lv") ? (JSON.parse(opt("lv")!) as CrossLvV14) : level === "normal" ? null : CROSS_LEVELS_V14[level as "easy"];
    const game = lv ? crossDenseGameOf(lv, `tune:${opt("lv") ?? level}`) : crossGameFor(CROSS_REV_LIGHT, null);
    const out = opt("out") ?? `.shots/cross-tune-${level}.jsonl`;
    for (let n = from; n < from + count; n++) {
      const seed = roomSeed(n);
      const proved = lv ? crossDenseCrossingsProved(seed, lv) : true;
      for (const bot of bots) {
        const { state } = await playCross(game, seed, bot, lv ? CROSS_REV_DENSE : CROSS_REV_LIGHT);
        const raw = rawOf(level, bot, n, seed, proved, state);
        raw.score = scoreOn(raw, lv ?? { fullAt: 76, streakAt: 4, closeAt: 10, hitCost: 15 });
        appendFileSync(out, JSON.stringify(raw) + "\n");
      }
      if ((n - from) % 10 === 9) console.log(`${level}: ${n - from + 1} seeds`);
    }
    console.log(`→ ${out}`);
  } else if (args[0] === "score") {
    const files = args.slice(1).filter((a) => !a.startsWith("--"));
    const runs = files.flatMap((f) => readFileSync(f, "utf8").trim().split("\n").map((l) => JSON.parse(l) as CrossRaw));
    const lines = new Map<string, Partial<CrossLines>>();
    for (const a of args.filter((x) => x.startsWith("--lines="))) lines.set(a.slice(8, a.indexOf(":")), JSON.parse(a.slice(a.indexOf(":") + 1)));
    for (const level of ["easy", "normal", "hard", "expert"]) {
      const at = runs.filter((r) => r.level === level);
      if (!at.length) continue;
      const base: CrossLines = level === "normal" ? { fullAt: 76, streakAt: 4, closeAt: 10, hitCost: 15 } : CROSS_LEVELS_V14[level as "easy"];
      const l = { ...base, ...(lines.get(level) ?? {}) };
      const ok = new Set(at.filter((r) => r.bot === "proof" && r.proved && scoreOn(r, l) === 200).map((r) => r.seed));
      const seeds = new Set(at.map((r) => r.seed));
      const proved = new Set(at.filter((r) => r.proved).map((r) => r.seed));
      const stat = (bot: string, only: Set<number> | null) => {
        const xs = at.filter((r) => r.bot === bot && (!only || only.has(r.seed))).map((r) => scoreOn(r, l));
        const avg = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
        return `${bot} ${avg.toFixed(1)} at200 ${((100 * xs.filter((x) => x >= 200).length) / Math.max(1, xs.length)).toFixed(0)}% (${xs.length})`;
      };
      console.log(`${level.padEnd(7)} ${JSON.stringify({ fullAt: l.fullAt, streakAt: l.streakAt, closeAt: l.closeAt, hitCost: l.hitCost })}  crossings proved ${proved.size}/${seeds.size}, proof 200 on ${ok.size}`);
      console.log(`   all seeds:    ${stat("average", null)}   ${stat("elite", null)}`);
      console.log(`   dealt seeds:  ${stat("average", ok)}   ${stat("elite", ok)}`);
    }
  }
}
