/**
 * The Action overhaul's difficulty levels (15 Nov 2026): Grappler's and Moon Climb's skill-band bots on every level, on
 * real deals (scripts/level-tune.ts `dealAt`: `generatePuzzle(game, { bankSeed, level })` under a seeded Math.random),
 * graded by the server's own code (`gradeAnswer` on the dealt puzzle, the server replay). A tool, not a check.
 *
 *   bun scripts/action-levels-bands.ts <swing|ricochet> [--level=all|easy|normal|hard|expert] [--seeds=12] [--from=0]
 *     [--bots=weak,average,good,great,near,elite,perfect] [--limits=0] [--each]
 *
 * Human limits (on unless `--limits=0`; docs/arcade-standard/swing.md and ricochet.md "Levels"): every bot below
 * Flawless carries `human.limits`, which the two bots read: a reaction (something a player has to see first: Grappler's
 * look at a ledge section before the press) takes at least 0.25 s, and the second input of one move comes at least
 * 0.15 s after the first (Grappler's grab after the release, Moon Climb's double jump after the leap). Moments a player
 * times ahead (a release on the swing, the leap as the ninja lands) keep the level's own timing error, as before.
 * Flawless is the deal's proof, not a player: it plays the witness (Moon Climb) or the oracle (Grappler), no limits.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gradeAnswer } from "../src/lib/duel/generate.server";
import type { PuzzleType } from "../src/lib/duel/types";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { levelsOf } from "../src/lib/levels/gameLevels";
import { isLevel, puzzleLevel, type Level } from "../src/lib/levels/levels";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import type { SkillBot } from "./arcade-skill-bands/bot";
import { UNITS } from "./arcade-skill-bands/units";
import { dealAt } from "./level-tune";

/** A Human under the levels' limits (the bots read `limits`; Flawless never carries them). */
export function limitedHuman(type: string, seed: number, level: SkillLevel, limits = true): Human {
  const h = new Human(type, seed, level);
  if (limits && level !== "perfect") (h as any).limits = true;
  return h;
}

export interface LevelRun {
  score: number;
  finished: boolean;
  flagged: boolean;
}

/** One bot run on a dealt puzzle at a level, graded by the server. */
export async function playLevel(type: PuzzleType, level: Level, n: number, skill: SkillLevel, limits = true): Promise<LevelRun & { puzzle: any; state: any; events: any[]; game: any }> {
  const spec = GAME_BY_TYPE.get(type)!;
  const bot = ((await import(`./arcade-skill-bands/bots/${type}.ts`)) as { bot: SkillBot }).bot;
  const field = LIVE_BANDS[type as keyof typeof LIVE_BANDS]?.field;
  const puzzle = dealAt(type, level, n) as any;
  const seed = Number(puzzle.seed ?? 0);
  const rev = field && typeof puzzle[field] === "number" ? (puzzle[field] as number) : null;
  const game = spec.gameForPuzzle ? spec.gameForPuzzle(puzzle) : spec.gameFor(rev, seed);
  const out = bot({ game, seed, rev, human: limitedHuman(type, seed, skill, limits), fixes: true });
  const events = out.events ?? [];
  const byTick = new Map(events.map((e) => [e.t, e]));
  let state = game.init(seed);
  const checkpoints: unknown[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null);
    if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const claimed = game.score(state);
  const body = { seed, claimedScore: claimed, events, inputs: [], taps: [], endTick: state.tick, checkpoints };
  const raw = appendClientCounters(spec.encode(body, rev, seed), arcadeCounters(type, state, claimed));
  const graded = gradeAnswer(puzzle, raw, 0);
  const finished = UNITS[type]?.(state).finished ?? graded.isCorrect;
  return { score: graded.score, finished, flagged: Boolean((graded.extra as any)?.flagged), puzzle, state, events, game };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const type = args.find((a) => !a.startsWith("--")) as PuzzleType;
  const asked = opt("level") ?? "all";
  const levels: Level[] = asked === "all" ? levelsOf(type) : isLevel(asked) ? [asked] : [];
  const seeds = Number(opt("seeds") ?? 12);
  const from = Number(opt("from") ?? 0);
  const bots = (opt("bots") ?? "weak,average,good,great,near,elite,perfect").split(",") as SkillLevel[];
  const limits = opt("limits") !== "0";
  console.log(`${type}: levels ${levels.join(", ")}; seeds ${from}–${from + seeds - 1}; human limits ${limits ? "on" : "off"}`);
  for (const level of levels) {
    for (const skill of bots) {
      const runs: LevelRun[] = [];
      const each: string[] = [];
      let dealt: Level = "normal";
      for (let n = from; n < from + seeds; n++) {
        const r = await playLevel(type, level, n, skill, limits);
        dealt = puzzleLevel(r.puzzle);
        runs.push(r);
        each.push(`${r.puzzle.seed}:${r.score}`);
      }
      const xs = runs.map((r) => r.score).sort((a, b) => a - b);
      const avg = xs.reduce((a, b) => a + b, 0) / xs.length;
      const med = xs[Math.floor((xs.length - 1) / 2)]!;
      const fin = runs.filter((r) => r.finished).length;
      const star = runs.filter((r) => r.score >= 175).length;
      const flag = runs.filter((r) => r.flagged).length;
      console.log(`${level.padEnd(7)} ${skill.padEnd(8)} avg ${avg.toFixed(1).padStart(6)}  median ${String(med).padStart(3)}  min ${String(xs[0]).padStart(3)}  max ${String(xs[xs.length - 1]).padStart(3)}  finished ${fin}/${runs.length}  175+ ${star}/${runs.length}${flag ? `  FLAGGED ${flag}` : ""}${dealt !== level ? ` (dealt ${dealt})` : ""}`);
      // Each run's dealt seed and score (`--each`: the boards to play, e.g. Expert's).
      if (args.includes("--each")) console.log(`        ${each.join(" ")}`);
    }
  }
}
