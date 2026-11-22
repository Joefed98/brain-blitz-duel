/**
 * The Number games' level table under the human limits (D2, 22 Nov 2026): every level a game offers, dealt as a room
 * deals it (scripts/level-tune.ts dealAt: `generatePuzzle(type, { bankSeed, level })` on a seeded Math.random), played by
 * the five people of scripts/number-human.ts (average, good, great, near-perfect, elite), each action held to
 * HUMAN_LIMITS, graded by the server. Not a check: no pass/fail, not run by run-checks or CI.
 *
 *   bun scripts/number-human-tune.ts <game|all> [--level=easy|normal|hard|expert|all] [--seeds=48] [--from=0] [--json=<path>]
 *
 * Each row: the person's mean score, median, finish rate and the share of runs at 200 ("reach 200"), the ladder Joe
 * judges the levels on (the average steps down clearly level by level; the elite reaches 200 less often each level up,
 * and on Expert on at least a fifth of boards).
 */
import { writeFileSync } from "node:fs";

import { dealAt } from "./level-tune";
import "./number-human-players";
import { NUMBER_GAMES, PERSON_LEVELS, personRun, type NumberGame, type PersonLevel } from "./number-human";
import { levelsOf } from "../src/lib/levels/gameLevels";
import { puzzleLevel, type Level } from "../src/lib/levels/levels";

export interface HumanRow {
  game: NumberGame;
  level: Level;
  dealt: Level;
  person: PersonLevel;
  runs: number;
  mean: number;
  median: number;
  finish: number;
  reach200: number;
}

const avg = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const med = (xs: readonly number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)]!;
};

/** Every person on `seeds` deals of one game at one level. */
export function humanRows(game: NumberGame, level: Level, seeds: number, from = 0): HumanRow[] {
  const runs: Record<PersonLevel, { score: number; done: boolean }[]> = { average: [], good: [], great: [], near: [], elite: [] };
  let dealt: Level = "normal";
  for (let n = from; n < from + seeds; n++) {
    const puzzle = dealAt(game, level, n);
    dealt = puzzleLevel(puzzle);
    for (const person of PERSON_LEVELS) {
      const r = personRun(puzzle, person, `${level}:${n}`);
      runs[person].push({ score: r.score, done: r.isCorrect });
    }
  }
  return PERSON_LEVELS.map((person) => {
    const xs = runs[person].map((r) => r.score);
    return {
      game,
      level,
      dealt,
      person,
      runs: xs.length,
      mean: Math.round(avg(xs) * 10) / 10,
      median: med(xs),
      finish: runs[person].filter((r) => r.done).length / Math.max(1, xs.length),
      reach200: xs.filter((x) => x >= 200).length / Math.max(1, xs.length),
    };
  });
}

export function rowLine(r: HumanRow): string {
  const fell = r.dealt !== r.level ? ` (no ${r.level}: dealt ${r.dealt})` : "";
  return `${r.game.padEnd(11)} ${r.level.padEnd(7)} ${r.person.padEnd(8)} mean ${r.mean.toFixed(1).padStart(6)}  median ${String(r.median).padStart(3)}  finish ${(r.finish * 100).toFixed(0).padStart(3)}%  reach 200 ${(r.reach200 * 100).toFixed(0).padStart(3)}%  (${r.runs})${fell}`;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const asked = args.find((a) => !a.startsWith("--")) ?? "all";
  const games: NumberGame[] = asked === "all" ? [...NUMBER_GAMES] : (asked.split(",") as NumberGame[]);
  const seeds = Number(opt("seeds") ?? 48);
  const from = Number(opt("from") ?? 0);
  const levelOpt = opt("level") ?? "all";
  const out: HumanRow[] = [];
  for (const game of games) {
    if (!NUMBER_GAMES.includes(game)) throw new Error(`${game}: not a Number game (${NUMBER_GAMES.join(", ")})`);
    const levels = levelOpt === "all" ? (["easy", "normal", "hard", "expert"] as Level[]).filter((l) => levelsOf(game).includes(l)) : [levelOpt as Level];
    for (const level of levels) {
      const rows = humanRows(game, level, seeds, from);
      out.push(...rows);
      for (const r of rows) console.log(rowLine(r));
    }
  }
  const json = opt("json");
  if (json) writeFileSync(json, JSON.stringify(out, null, 2) + "\n");
}
