/**
 * The level tuning tool (difficulty framework, 15 Nov 2026; docs/design/difficulty/README.md): plays a game's existing
 * bots on a level and reports the average score and the finish rate, so a family session can tune each level to Joe's
 * elite targets (about 198 on Normal, 160 on Hard, 140 on Expert, mostly finishing). Not a check: no pass/fail, not run
 * by run-checks or CI.
 *
 *   bun scripts/level-tune.ts <game> [--level=normal|easy|hard|expert|all] [--seeds=20] [--from=0] [--human-limits]
 *
 * --human-limits plays the arcade bots under human limits (about 0.25 s to react, 0.15 s to move; human.ts
 * HUMAN_LIMITS), the measure Joe tunes levels by (16 Nov 2026).
 *
 * Each sample is a real deal: `generatePuzzle(game, { bankSeed, level })` under a seeded Math.random (the room path, so
 * a level the game doesn't offer is dealt as Normal and said so). Only the server's own grade counts: puzzles grade the
 * kit's play as a phone sends it (scripts/standard-lib.ts gradeSteps), arcade runs grade the bot's encoded log through
 * `gradeAnswer` on the dealt puzzle (the server replay), the score and correctness the stored ones would be.
 *
 * Bots: puzzles play the puzzle-fairness kits (scripts/puzzle-fairness/kits) at Great and Near-perfect, the kits'
 * best; arcade games play their skill-band bots (scripts/arcade-skill-bands/bots) at Near-perfect and Elite. An arcade
 * game whose levels change its sim gives its GameSpec a `gameForPuzzle(puzzle)` (games.ts) so the bot plays the
 * level's world; without one the bot plays the stamp's world (Normal).
 *
 * "finish" is the server's isCorrect for puzzles; for arcade games the run's own finish (units.ts) where the game has
 * one, else isCorrect.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync } from "node:fs";

import { gradeAnswer, generatePuzzle } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { usesArcadeClock } from "../src/lib/duel/catalogue";
import { withSeededRandom } from "../src/lib/duel/random";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { levelsOf } from "../src/lib/levels/gameLevels";
import { LEVELS, isLevel, puzzleLevel, type Level } from "../src/lib/levels/levels";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { GAME_BY_TYPE, roomSeed, type GameSpec } from "./arcade-skill-bands/games";
import { Human, HUMAN_LIMITS, type HumanLimits, type SkillLevel } from "./arcade-skill-bands/human";
import type { SkillBot } from "./arcade-skill-bands/bot";
import { UNITS } from "./arcade-skill-bands/units";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng, type Level as KitLevel } from "./puzzle-fairness/kit";
import { asPhoneSends, gradeSteps } from "./standard-lib";

export interface TuneRow {
  game: string;
  /** The level asked for, and the level the deal actually carried. */
  level: Level;
  dealt: Level;
  bot: string;
  runs: number;
  average: number;
  median: number;
  finishRate: number;
}

/** One deal of a game at a level on sample n (deterministic). */
export function dealAt(type: PuzzleType, level: Level, n: number): PuzzleData {
  const seed = roomSeed(n);
  return withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed, ...(level !== "normal" ? { level } : {}) }));
}

const avg = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const med = (xs: readonly number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)]!;
};

function row(game: string, level: Level, dealt: Level, bot: string, runs: { score: number; finished: boolean }[]): TuneRow {
  const scores = runs.map((r) => r.score);
  return {
    game,
    level,
    dealt,
    bot,
    runs: runs.length,
    average: Math.round(avg(scores) * 10) / 10,
    median: med(scores),
    finishRate: runs.length ? runs.filter((r) => r.finished).length / runs.length : 0,
  };
}

/** Puzzles: the kit at Great and Near-perfect, graded as the phone sends it. */
function tunePuzzle(type: PuzzleType, level: Level, ns: readonly number[]): TuneRow[] {
  const kit = KITS[type];
  if (!kit) throw new Error(`${type}: no puzzle kit (scripts/puzzle-fairness/kits)`);
  const bots: KitLevel[] = ["great", "near"];
  const runs: Record<string, { score: number; finished: boolean }[]> = { great: [], near: [] };
  let dealt: Level = "normal";
  for (const n of ns) {
    const puzzle = dealAt(type, level, n);
    dealt = puzzleLevel(puzzle);
    const limit = puzzleTimeLimitMs(puzzle);
    for (const b of bots) {
      const play = kit.play(puzzle, makeRng(hashText(`level-tune:${type}:${level}:${n}:${b}`)), SKILLS[b], limit);
      const run = gradeSteps(puzzle, asPhoneSends(puzzle, play.steps), play.timed);
      runs[b]!.push({ score: run.score, finished: run.isCorrect });
    }
  }
  return bots.map((b) => row(type, level, dealt, b === "near" ? "near-perfect" : b, runs[b]!));
}

async function loadBot(type: string): Promise<SkillBot> {
  const path = new URL(`./arcade-skill-bands/bots/${type}.ts`, import.meta.url);
  if (!existsSync(path)) throw new Error(`${type}: no skill-band bot (scripts/arcade-skill-bands/bots/${type}.ts)`);
  return ((await import(path.href)) as { bot: SkillBot }).bot;
}

/** The game a bot plays for a dealt puzzle: the spec's level-aware game when it has one, else the stamp's. */
function gameOf(spec: GameSpec, puzzle: PuzzleData, rev: number | null, seed: number) {
  return spec.gameForPuzzle ? spec.gameForPuzzle(puzzle) : spec.gameFor(rev, seed);
}

/** Arcade: the skill-band bot at Near-perfect and Elite, graded by the server on the dealt puzzle. */
async function tuneArcade(type: PuzzleType, level: Level, ns: readonly number[], limits: HumanLimits | null = null): Promise<TuneRow[]> {
  const spec = GAME_BY_TYPE.get(type);
  if (!spec) throw new Error(`${type}: no skill-band spec (scripts/arcade-skill-bands/games.ts)`);
  const bot = await loadBot(type);
  const field = LIVE_BANDS[type as keyof typeof LIVE_BANDS]?.field;
  const levels: SkillLevel[] = ["near", "elite"];
  const runs: Record<string, { score: number; finished: boolean }[]> = { near: [], elite: [] };
  let dealt: Level = "normal";
  for (const n of ns) {
    const puzzle = dealAt(type, level, n);
    dealt = puzzleLevel(puzzle);
    const loose = puzzle as unknown as Record<string, unknown>;
    const seed = Number(loose["seed"] ?? 0);
    const rev = field && typeof loose[field] === "number" ? (loose[field] as number) : null;
    for (const lv of levels) {
      const game = gameOf(spec, puzzle, rev, seed);
      const out = bot({ game, seed, rev, human: new Human(type, seed, lv, limits), fixes: true });
      let state = game.init(seed);
      const events = out.events ?? [];
      const taps = out.taps ?? [];
      const byTick = new Map(events.map((e) => [e.t, e]));
      const tapSet = new Set(taps);
      const checkpoints: unknown[] = [];
      while (!game.isOver(state) && state.tick < game.runTicks) {
        const t = state.tick + 1;
        state = game.step(state, spec.taps ? tapSet.has(t) : (byTick.get(t) ?? null));
        // At the game's own checkpoint interval (the spec's checkpointEvery: Home Run and Top Bins every 60 ticks, Apex
        // 120, the rest 300), as the phone records them: a longer spacing made those replays log a desync on every run,
        // hiding a real one, and a shorter one overruns the games whose run format caps its checkpoints.
        if (state.tick % (spec.checkpointEvery ?? 300) === 0) checkpoints.push(spec.checkpoint(state));
      }
      const claimed = game.score(state);
      const body = { seed, claimedScore: claimed, events, inputs: taps, taps: [], endTick: state.tick, checkpoints };
      const raw = appendClientCounters(spec.encode(body, rev, seed), arcadeCounters(type, state, claimed));
      const graded = gradeAnswer(puzzle, raw, 0);
      const finished = UNITS[type]?.(state).finished ?? graded.isCorrect;
      runs[lv]!.push({ score: graded.score, finished });
    }
  }
  const tag = limits ? "+limits" : "";
  return levels.map((lv) => row(type, level, dealt, (lv === "near" ? "near-perfect" : lv) + tag, runs[lv]!));
}

/** Plays one game at one level on `seeds` samples from `from`. */
export async function tune(type: PuzzleType, level: Level, seeds = 20, from = 0, limits: HumanLimits | null = null): Promise<TuneRow[]> {
  const ns = Array.from({ length: seeds }, (_, i) => from + i);
  // An arcade-engine game in a puzzle category (Minefield, Logic) plays its skill-band bot, like the arcade games.
  return usesArcadeClock(type) ? tuneArcade(type, level, ns, limits) : tunePuzzle(type, level, ns);
}

export function tuneLine(r: TuneRow): string {
  const fell = r.dealt !== r.level ? ` (no ${r.level} level: dealt ${r.dealt})` : "";
  return `${r.game.padEnd(12)} ${r.level.padEnd(7)} ${r.bot.padEnd(19)} avg ${r.average.toFixed(1).padStart(6)}  median ${String(r.median).padStart(3)}  finished ${(r.finishRate * 100).toFixed(0).padStart(3)}%  (${r.runs} runs)${fell}`;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const game = args.find((a) => !a.startsWith("--")) as PuzzleType | undefined;
  if (!game) {
    console.log("usage: bun scripts/level-tune.ts <game> [--level=normal|easy|hard|expert|all] [--seeds=20] [--from=0] [--human-limits]");
    process.exit(2);
  }
  const asked = opt("level") ?? "all";
  const levels: Level[] = asked === "all" ? levelsOf(game) : isLevel(asked) ? [asked] : [];
  if (!levels.length) {
    console.log(`unknown level ${asked} (${LEVELS.join(", ")} or all)`);
    process.exit(2);
  }
  const seeds = Number(opt("seeds") ?? 20);
  const from = Number(opt("from") ?? 0);
  console.log(`${game}: levels ${levelsOf(game).join(", ")}`);
  // --human-limits: the arcade bots play under Joe's human limits (about 0.25 s to react, 0.15 s to move; human.ts
  // HUMAN_LIMITS), the rows tagged "+limits".
  const limits = args.includes("--human-limits") ? HUMAN_LIMITS : null;
  for (const level of levels) for (const r of await tune(game, level, seeds, from, limits)) console.log(tuneLine(r));
}
