/**
 * Orbit's levels measured (docs/arcade-standard/orbit.md "Levels"; the Action overhaul, stage 3, 16 Nov 2026). A
 * tool, not a check: the skill-band bot (scripts/arcade-skill-bands/bots/orbit.ts) plays real deals at each level
 * (`generatePuzzle("orbit", { bankSeed, level })` under a seeded Math.random, as scripts/level-tune.ts deals them), each
 * run graded by the server's own replay on the dealt puzzle (`gradeAnswer`).
 *
 *   bun scripts/orbit-level-bands.ts [--levels=easy,normal,hard,expert] [--bots=average,good,great,near,elite]
 *                                    [--seeds=20] [--from=0] [--raw]
 *
 * Human limits (the default; `--raw` plays the shared elite profile as it is): the elite bot reacts in about 0.25 s
 * (reaction 250 ± 30 ms, PROFILES.elite's 145 ± 15) and takes about 0.15 s more to read the new orbit and move
 * (thinkScale 0.43: the bot's 350 ms read × 0.43 ≈ 150 ms; PROFILES.elite's 0.32), through ELITE_BY_GAME.orbit for
 * this run only. Its timing and aim stay elite's (9 ms, a trained player's tap on an anticipated moment). The other
 * levels are the shared profiles. Report: mean, median, p10–p90, finish rate (the sun reached) per level and bot.
 */
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { ELITE_BY_GAME, Human, type SkillLevel } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/orbit";
import { dealAt } from "./level-tune";
import { puzzleLevel, type Level } from "../src/lib/levels/levels";
import type { OrbitRev3State } from "../src/lib/arcade/orbitRev3";

/** The elite bot's human limits for the level tuning (see the header). */
export const ORBIT_HUMAN_LIMITS = { reactionMs: [250, 30] as const, thinkScale: 0.43 };

export interface OrbitBandRow {
  level: Level;
  bot: SkillLevel;
  scores: number[];
  finished: number;
}

/** One run of the bot at `skill` on deal n of `level`: the server's score and whether it reached the sun. */
export function playOrbitLevel(level: Level, skill: SkillLevel, n: number): { score: number; finished: boolean; level: Level } {
  const spec = GAME_BY_TYPE.get("orbit")!;
  const puzzle = dealAt("orbit", level, n) as unknown as { seed: number; orbitRev: number };
  const game = spec.gameForPuzzle!(puzzle);
  const seed = puzzle.seed;
  const out = bot({ game, seed, rev: puzzle.orbitRev, human: new Human("orbit", seed, skill), fixes: true });
  let state = game.init(seed) as OrbitRev3State;
  const byTick = new Map((out.events ?? []).map((e) => [e.t, e]));
  const checkpoints: unknown[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null) as OrbitRev3State;
    if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const claimed = game.score(state);
  const body = { seed, claimedScore: claimed, events: out.events ?? [], inputs: [], taps: [], endTick: state.tick, checkpoints };
  const raw = appendClientCounters(spec.encode(body, puzzle.orbitRev, seed), arcadeCounters("orbit", state, claimed));
  const graded = gradeAnswer(puzzle as never, raw, 0);
  return { score: graded.score, finished: state.finished === 1, level: puzzleLevel(puzzle) };
}

export function withHumanLimits<T>(on: boolean, fn: () => T): T {
  const before = ELITE_BY_GAME["orbit"];
  if (on) ELITE_BY_GAME["orbit"] = { reactionMs: ORBIT_HUMAN_LIMITS.reactionMs, thinkScale: ORBIT_HUMAN_LIMITS.thinkScale };
  try {
    return fn();
  } finally {
    if (before === undefined) delete ELITE_BY_GAME["orbit"];
    else ELITE_BY_GAME["orbit"] = before;
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const levels = (opt("levels") ?? "easy,normal,hard,expert").split(",") as Level[];
  const bots = (opt("bots") ?? "average,good,great,near,elite").split(",") as SkillLevel[];
  const seeds = Number(opt("seeds") ?? 20);
  const from = Number(opt("from") ?? 0);
  const raw = args.includes("--raw");
  const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((xs.length - 1) * p))]!;
  withHumanLimits(!raw, () => {
    for (const level of levels) {
      for (const b of bots) {
        const runs = Array.from({ length: seeds }, (_, i) => playOrbitLevel(level, b, from + i));
        const scores = runs.map((r) => r.score);
        const mean = scores.reduce((a, c) => a + c, 0) / scores.length;
        const fin = runs.filter((r) => r.finished).length / runs.length;
        console.log(`${level.padEnd(7)} ${b.padEnd(8)} mean ${mean.toFixed(1).padStart(5)}  median ${pct(scores, 0.5)}  (${pct(scores, 0.1)}–${pct(scores, 0.9)})  sun ${(fin * 100).toFixed(0)}%  [dealt ${runs[0]!.level}]`);
      }
    }
  });
}
