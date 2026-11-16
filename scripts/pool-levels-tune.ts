/**
 * Cue Ball's level tuning (the Sports overhaul's stage 3, 15 Nov 2026; a tool, not a check): plays the skill-band bot at
 * each player level on real deals at each game level (level-tune.ts's `dealAt`: the room path, `level` stamped) and
 * grades every run with the server's own gradeAnswer, reporting the mean, median, the clear rate (the black down
 * legally) and the share of runs at 175+ (a star). Joe's elite targets: about 198 on Normal, 160 on Hard, 140 on Expert;
 * Easy: an average player has a real shot at a star.
 *
 *   bun scripts/pool-levels-tune.ts [--seeds=30] [--from=0] [--levels=easy,normal,hard,expert] [--players=average,near,elite]
 */
import { poolCheckpoint, poolGameForPuzzle, type PoolState } from "../src/lib/arcade/pool";
import { encodePoolRun } from "../src/lib/duel/pool";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData } from "../src/lib/duel/types";
import { SPORTS_CHECKPOINT_INTERVAL } from "../src/lib/arcade/sportsKit";
import { bot, POOL_PERCEPTION } from "./arcade-skill-bands/bots/pool";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import { dealAt } from "./level-tune";
import type { Level } from "../src/lib/levels/levels";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const seeds = Number(arg("seeds") ?? 30);
const from = Number(arg("from") ?? 0);
const levels = (arg("levels") ?? "easy,normal,hard,expert").split(",") as Level[];
const players = (arg("players") ?? "average,near,elite").split(",") as SkillLevel[];
// Tuning only: try other perception values without editing the bot (--sight=short:judge=2.6,ghost:judge=3:leave=0.8).
for (const part of (arg("sight") ?? "").split(",").filter(Boolean)) {
  const [preview, ...kv] = part.split(":");
  const row = (POOL_PERCEPTION as Record<string, Record<string, number>>)[preview!];
  if (!row) throw new Error(`no preview ${preview}`);
  for (const pair of kv) {
    const [k, v] = pair.split("=");
    row[k!] = Number(v);
  }
}

export interface PoolRunResult {
  score: number;
  cleared: boolean;
  fouls: number;
  /** The run's end state (the server's replay of the log). */
  state: PoolState;
  events: readonly { t: number }[];
}

/** A run's log for `puzzle` (the bot's events, played through the stored puzzle's game), as the phone sends it. */
export function poolRunRaw(puzzle: PuzzleData, events: readonly { t: number }[]): { raw: string; state: PoolState } {
  const seed = Number((puzzle as unknown as { seed: number }).seed);
  const game = poolGameForPuzzle(puzzle as never);
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as PoolState;
  const checkpoints = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, (byTick.get(s.tick + 1) ?? null) as never);
    if (s.tick % SPORTS_CHECKPOINT_INTERVAL === 0) checkpoints.push(poolCheckpoint(s));
  }
  const raw = encodePoolRun({ seed, claimedScore: game.score(s), events: events as never, endTick: s.tick >= game.runTicks ? 0 : s.tick, checkpoints });
  return { raw, state: s };
}

/** One run: the bot at `player` on deal n at `level`, graded by the server. */
export function playPool(level: Level, player: SkillLevel, n: number): PoolRunResult {
  const puzzle = dealAt("pool", level, n);
  const seed = Number((puzzle as unknown as { seed: number }).seed);
  const game = poolGameForPuzzle(puzzle as never);
  const out = bot({ game, seed, rev: (puzzle as unknown as { poolRev: number }).poolRev, human: new Human("pool", seed, player), fixes: true });
  const events = out.events ?? [];
  const { raw, state } = poolRunRaw(puzzle, events);
  const graded = gradeAnswer(puzzle as PuzzleData, raw, 0);
  return { score: graded.score, cleared: state.black === 1, fouls: state.fouls, state: state as PoolState, events };
}

if (import.meta.main) {
  const ns = Array.from({ length: seeds }, (_, i) => from + i);
  console.log(`Cue Ball levels: ${seeds} deals from ${from}, graded by the server`);
  console.log("level    player    mean  median  cleared  175+");
  for (const level of levels) {
    for (const player of players) {
      const runs = ns.map((n) => playPool(level, player, n));
      const scores = runs.map((r) => r.score).sort((a, b) => a - b);
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const median = scores[Math.floor(scores.length / 2)]!;
      const cleared = runs.filter((r) => r.cleared).length / runs.length;
      const star = runs.filter((r) => r.score >= 175).length / runs.length;
      console.log(`${level.padEnd(8)} ${player.padEnd(8)} ${mean.toFixed(1).padStart(6)} ${String(median).padStart(6)} ${(cleared * 100).toFixed(0).padStart(6)} % ${(star * 100).toFixed(0).padStart(4)} %`);
    }
  }
}
