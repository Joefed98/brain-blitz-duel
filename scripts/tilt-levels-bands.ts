/**
 * Tilt's level report (the Strategy overhaul, stage 3, 15 Nov 2026; docs/arcade-standard/tilt.md "Levels (stage 3)"):
 * the skill-band bots (scripts/arcade-skill-bands/bots/tilt.ts, weak → flawless) play each level's dealt seeds (Normal:
 * TILT_DEAL_V12; easy, hard and expert: TILT_DEAL_LEVELS), every run replayed through the server path
 * (replayTiltRun at the level), and the report gives per level and skill the average and median score, how many runs
 * finish every maze, reach 200 and reach a star (175+), with the median falls and pars met. Not a check.
 *
 *   bun scripts/tilt-levels-bands.ts [--level=all|normal|easy|hard|expert] [--seeds=40] [--from=0]
 *                                    [--skills=weak,average,...] [--json=<file>]
 *
 * TILT_HUMAN_LIMITS=1 plays the bots under human limits (at least 0.25 s from what the eye saw to the hand acting, at
 * most a new decision every 0.15 s; the bot's own opt-in, never set by a check).
 */
import { writeFileSync } from "node:fs";
import { Human, ALL_LEVELS, type SkillLevel } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/tilt";
import { tiltCheckpoint, tiltGameForLevel, tiltParParts, TILT_CHECKPOINT_INTERVAL, TILT_LEVEL_NAMES, TILT_REV_BIG, type TiltLevel, type TiltState } from "../src/lib/arcade/tilt";
import { encodeTiltRun, replayTiltRun } from "../src/lib/duel/tilt";
import { TILT_DEAL_V12 } from "../src/lib/duel/tiltDealV12.server";
import { TILT_DEAL_LEVELS } from "../src/lib/duel/tiltDealLevels.server";

export type LevelName = "normal" | TiltLevel;
export interface LevelRun {
  level: LevelName;
  skill: SkillLevel;
  seed: number;
  score: number;
  finished: boolean;
  falls: number;
  parsMet: number;
}

/** The n-th seed a level deals (its proved list, n mod its length). */
export function levelSeed(level: LevelName, n: number): number {
  const list = level === "normal" ? TILT_DEAL_V12 : TILT_DEAL_LEVELS[level];
  return list[n % list.length]!;
}

/** One bot run at a level, replayed by the server. */
export function playLevel(level: LevelName, seed: number, skill: SkillLevel): LevelRun {
  const lv = level === "normal" ? undefined : level;
  const game = tiltGameForLevel(TILT_REV_BIG, lv);
  const events = bot({ game, seed, rev: TILT_REV_BIG, human: new Human("tilt", seed, skill), fixes: true }).events ?? [];
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s: TiltState = game.init(seed);
  const checkpoints: unknown[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.tick % TILT_CHECKPOINT_INTERVAL === 0) checkpoints.push(tiltCheckpoint(s));
  }
  const raw = encodeTiltRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints: checkpoints as never });
  const r = replayTiltRun(seed, raw, TILT_REV_BIG, lv);
  const p = tiltParParts(r.state);
  return { level, skill, seed, score: r.flagged ? -1 : r.score, finished: p.mazes >= r.state.list.length, falls: r.state.falls ?? 0, parsMet: p.parsMet };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[s.length >> 1]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : 0;
};

export function summary(runs: LevelRun[]): string {
  const sc = runs.map((r) => r.score);
  const avg = sc.reduce((a, b) => a + b, 0) / Math.max(1, sc.length);
  const n = runs.length;
  const pct = (k: number) => `${Math.round((100 * k) / Math.max(1, n))}%`;
  return `avg ${avg.toFixed(1).padStart(5)}  median ${String(median(sc)).padStart(5)}  finished ${pct(runs.filter((r) => r.finished).length).padStart(4)}  200 ${String(runs.filter((r) => r.score === 200).length).padStart(2)}/${n}  175+ ${pct(runs.filter((r) => r.score >= 175).length).padStart(4)}  falls ${median(runs.map((r) => r.falls))}  pars ${median(runs.map((r) => r.parsMet))}`;
}

if (import.meta.main) {
  const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const asked = opt("level") ?? "all";
  const levels: LevelName[] = asked === "all" ? ["easy", "normal", ...TILT_LEVEL_NAMES.filter((l) => l !== "easy")] : [asked as LevelName];
  const seeds = Number(opt("seeds") ?? 40);
  const from = Number(opt("from") ?? 0);
  const skills = (opt("skills")?.split(",") ?? [...ALL_LEVELS]) as SkillLevel[];
  const all: LevelRun[] = [];
  console.log(`tilt levels${process.env.TILT_HUMAN_LIMITS === "1" ? " (human limits)" : ""}: seeds ${from}–${from + seeds - 1}`);
  for (const level of levels)
    for (const skill of skills) {
      const runs: LevelRun[] = [];
      for (let n = from; n < from + seeds; n++) runs.push(playLevel(level, levelSeed(level, n), skill));
      all.push(...runs);
      console.log(`${level.padEnd(7)} ${skill.padEnd(8)} ${summary(runs)}`);
    }
  const json = opt("json");
  if (json) writeFileSync(json, JSON.stringify(all));
}
