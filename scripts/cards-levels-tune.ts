/**
 * The Cards & Board levels' tuning report (the overhaul's stage 3, 15 Nov 2026; a tool, not a check): each game's
 * skill-band bots on real deals at every level (scripts/level-tune.ts's deals and grading), with each part's average and
 * the finish time, so a level's parts can be set against Joe's targets (elite about 198 / 160 / 140 on Normal / Hard /
 * Expert; Easy a star, 175+, within an average player's reach).
 *
 *   bun scripts/cards-levels-tune.ts [games…] [--seeds=16] [--from=0] [--bots=average,near,elite,human]
 *
 * `human` is the player held to human limits (scripts/cards-human-limits.ts). Each line gives the average and the best
 * tenth's average.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gradeAnswer } from "../src/lib/duel/generate.server";
import type { PuzzleType } from "../src/lib/duel/types";
import { levelsOf } from "../src/lib/levels/gameLevels";
import type { Level } from "../src/lib/levels/levels";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import type { SkillBot } from "./arcade-skill-bands/bot";
import { dealAt } from "./level-tune";
import { humanLimitsPlay } from "./cards-human-limits";
import { fiveHandsStdParts } from "../src/lib/arcade/cards/fiveHands";
import { freecellStdParts } from "../src/lib/arcade/cards/freecell";
import { tripeaksStdParts } from "../src/lib/arcade/cards/tripeaks";
import { pyramidStdParts } from "../src/lib/arcade/cards/pyramid";
import { mahjongStdParts } from "../src/lib/arcade/mahjong";

const PARTS: Record<string, (s: any) => { key: string; points: number }[] | null> = {
  freecell: freecellStdParts, tripeaks: tripeaksStdParts, pyramid: pyramidStdParts, fivehands: fiveHandsStdParts, mahjong: mahjongStdParts,
};

export interface LevelReport {
  game: string;
  level: Level;
  bot: SkillLevel | "human";
  average: number;
  /** The best tenth of the runs' scores, averaged. */
  bestTenth: number;
  finished: number;
  finishS: number;
  parts: Record<string, number>;
}

export async function reportLevel(type: PuzzleType, level: Level, bot: SkillLevel | "human", seeds: number, from = 0): Promise<LevelReport> {
  const spec = GAME_BY_TYPE.get(type)!;
  const play = ((await import(new URL(`./arcade-skill-bands/bots/${type}.ts`, import.meta.url).href)) as { bot: SkillBot }).bot;
  const field = LIVE_BANDS[type as keyof typeof LIVE_BANDS]?.field;
  let total = 0;
  const scores: number[] = [];
  let done = 0;
  let finishT = 0;
  const parts: Record<string, number> = {};
  for (let n = from; n < from + seeds; n++) {
    const puzzle = dealAt(type, level, n) as any;
    const seed = Number(puzzle.seed ?? 0);
    const rev = field && typeof puzzle[field] === "number" ? puzzle[field] : null;
    const game = spec.gameForPuzzle ? spec.gameForPuzzle(puzzle) : spec.gameFor(rev, seed);
    const out = bot === "human" ? humanLimitsPlay(type, game, seed) : play({ game, seed, rev, human: new Human(type, seed, bot), fixes: true });
    const events = out.events ?? [];
    const byTick = new Map(events.map((e) => [e.t, e]));
    let state = game.init(seed);
    const checkpoints: unknown[] = [];
    while (!game.isOver(state) && state.tick < game.runTicks) {
      state = game.step(state, byTick.get(state.tick + 1) ?? null);
      if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
    }
    const claimed = game.score(state);
    const raw = appendClientCounters(spec.encode({ seed, claimedScore: claimed, events, inputs: [], taps: [], endTick: state.tick, checkpoints }, rev, seed), arcadeCounters(type, state, claimed));
    const graded = gradeAnswer(puzzle, raw, 0);
    total += graded.score;
    scores.push(graded.score);
    if (state.ended === 1 || (type === "mahjong" && state.clearedTick > 0)) {
      done++;
      finishT += (state.finishTick ?? state.clearedTick) / 60;
    }
    for (const p of PARTS[type]!(state) ?? []) parts[p.key] = (parts[p.key] ?? 0) + p.points;
  }
  for (const k of Object.keys(parts)) parts[k] = Math.round((parts[k]! / seeds) * 10) / 10;
  const top = [...scores].sort((a, b) => b - a).slice(0, Math.max(1, Math.round(seeds / 10)));
  const bestTenth = Math.round((top.reduce((a, b) => a + b, 0) / top.length) * 10) / 10;
  return { game: type, level, bot, average: Math.round((total / seeds) * 10) / 10, bestTenth, finished: done / seeds, finishS: done ? Math.round((finishT / done) * 10) / 10 : 0, parts };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  const games = (args.filter((a) => !a.startsWith("--")) as PuzzleType[]).length ? (args.filter((a) => !a.startsWith("--")) as PuzzleType[]) : (["freecell", "mahjong", "tripeaks", "fivehands", "pyramid"] as PuzzleType[]);
  const seeds = Number(opt("seeds") ?? 16);
  const from = Number(opt("from") ?? 0);
  const bots = (opt("bots") ?? "average,elite").split(",") as (SkillLevel | "human")[];
  for (const g of games) {
    for (const level of levelsOf(g)) {
      for (const b of bots) {
        const r = await reportLevel(g, level, b, seeds, from);
        console.log(`${g.padEnd(9)} ${level.padEnd(7)} ${b.padEnd(8)} avg ${r.average.toFixed(1).padStart(6)}  best tenth ${r.bestTenth.toFixed(1).padStart(6)}  finished ${(r.finished * 100).toFixed(0).padStart(3)}% in ${r.finishS.toFixed(1).padStart(5)} s  ${Object.entries(r.parts).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
      }
    }
  }
}
