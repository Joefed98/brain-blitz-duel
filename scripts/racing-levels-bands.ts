/**
 * Apex's levels measured (stage 3, 16 Nov 2026; a tool, not a check): deals each level through generatePuzzle (the
 * room path, seeded), plays the skill-band bots on the dealt puzzle's own sim (racingGameFor with its stored
 * racingLevel) and grades every run through gradeAnswer (the server replay). Prints, per level and bot level: mean,
 * median, finish rate, the share at 175 or more (a star), and the average ticks on the gravel and tyre-wall hits.
 *
 *   bun scripts/racing-levels-bands.ts [--seeds=40] [--from=0] [--bots=average,good,great,near,elite] [--levels=…]
 *   bun scripts/racing-levels-bands.ts --expert-seeds=12    (the Expert seeds and the elite bot's score, for Joe)
 */
import { racingCheckpoint, racingCircuitOf, racingGameFor, racingLevelOf, RACING_CHECKPOINT_INTERVAL, RACING_CIRCUITS, type RacingState } from "../src/lib/arcade/racing";
import { encodeRacingRun } from "../src/lib/duel/racing";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import type { RacingPuzzleData } from "../src/lib/duel/types";
import { LEVELS, type Level } from "../src/lib/levels/levels";
import { bot } from "./arcade-skill-bands/bots/racing";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import { dealAt } from "./level-tune";

export interface LevelRun {
  score: number;
  finished: boolean;
  offTicks: number;
  wallHits: number;
}

/** One bot run on a dealt puzzle, graded by the server. */
export function playLevelRun(puzzle: RacingPuzzleData, skill: SkillLevel): LevelRun {
  const game = racingGameFor(puzzle.racingRev, racingLevelOf(puzzle.racingLevel));
  const seed = puzzle.seed;
  const events = bot({ game, seed, rev: puzzle.racingRev ?? null, human: new Human("racing", seed, skill), fixes: true }).events ?? [];
  const byTick = new Map(events.map((e) => [e.t, e]));
  let st = game.init(seed) as RacingState;
  const cps = [];
  while (!game.isOver(st)) {
    st = game.step(st, byTick.get(st.tick + 1) ?? null);
    if (st.tick % RACING_CHECKPOINT_INTERVAL === 0) cps.push(racingCheckpoint(st));
  }
  const raw = encodeRacingRun({ seed, claimedScore: game.score(st), events, endTick: st.tick, checkpoints: cps });
  const graded = gradeAnswer(puzzle, raw, 0);
  return { score: graded.score, finished: st.finishTick > 0, offTicks: st.offTicks, wallHits: st.wallHits };
}

export interface LevelRow {
  level: Level;
  bot: SkillLevel;
  runs: number;
  mean: number;
  median: number;
  finish: number;
  star: number;
  off: number;
  walls: number;
}

const avg = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function measureLevel(level: Level, skill: SkillLevel, ns: readonly number[]): LevelRow {
  const runs = ns.map((n) => playLevelRun(dealAt("racing", level, n) as RacingPuzzleData, skill));
  const scores = runs.map((r) => r.score).sort((a, b) => a - b);
  return {
    level,
    bot: skill,
    runs: runs.length,
    mean: Math.round(avg(scores) * 10) / 10,
    median: scores[Math.floor((scores.length - 1) / 2)] ?? 0,
    finish: runs.filter((r) => r.finished).length / Math.max(1, runs.length),
    star: runs.filter((r) => r.score >= 175).length / Math.max(1, runs.length),
    off: Math.round(avg(runs.map((r) => r.offTicks)) * 10) / 10,
    walls: Math.round(avg(runs.map((r) => r.wallHits)) * 100) / 100,
  };
}

export function rowLine(r: LevelRow): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(4);
  return `${r.level.padEnd(7)} ${r.bot.padEnd(8)} mean ${r.mean.toFixed(1).padStart(6)}  median ${String(r.median).padStart(3)}  finish ${pct(r.finish)}  175+ ${pct(r.star)}  gravel ${String(r.off).padStart(6)} ticks  walls ${r.walls.toFixed(2)}  (${r.runs} runs)`;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const seeds = Number(opt("seeds") ?? 40);
  const from = Number(opt("from") ?? 0);
  const ns = Array.from({ length: seeds }, (_, i) => from + i);
  const expertSeeds = opt("expert-seeds");
  if (expertSeeds) {
    for (let n = 0; n < Number(expertSeeds); n++) {
      const p = dealAt("racing", "expert", n) as RacingPuzzleData;
      const r = playLevelRun(p, "elite");
      console.log(`seed ${p.seed} (${RACING_CIRCUITS[racingCircuitOf(p.seed)]!.name}): elite ${r.score}${r.finished ? "" : " (no finish)"}`);
    }
    process.exit(0);
  }
  const bots = (opt("bots") ?? "average,good,great,near,elite").split(",") as SkillLevel[];
  const levels = (opt("levels")?.split(",") ?? [...LEVELS]) as Level[];
  for (const level of levels) for (const b of bots) console.log(rowLine(measureLevel(level, b, ns)));
}
