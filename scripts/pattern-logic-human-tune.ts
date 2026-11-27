/**
 * The Pattern and Logic games' level table under the human limits (D4, 22 Nov 2026): every level a game offers, dealt
 * as a room deals it (scripts/level-tune.ts dealAt: `generatePuzzle(type, { bankSeed, level })` on a seeded
 * Math.random), played by the people of scripts/pattern-logic-human.ts (average, good, great, near-perfect, elite), each
 * action held to HUMAN_LIMITS, graded by the server. Not a check: no pass/fail, not run by run-checks or CI.
 *
 *   bun scripts/pattern-logic-human-tune.ts <game[,game…]|all|pattern|logic> [--level=all] [--seeds=48] [--from=0]
 *       [--people=average,elite] [--json=<path>]
 *
 * With PL_SCAN=1 the elite's rows also carry each finish's smallest speed line reaching 200, regraded by the real grader
 * (`needs`; scripts/pattern-logic-human.ts lineNeeded), so a level's line can be set to an exact share at 200.
 *
 * Each row: the person's mean score, median, finish rate, the share of runs at 200 ("reach 200") and the finish-time
 * quartiles, the ladder Joe judges the levels on (the average steps down clearly level by level; the elite reaches 200
 * less often each level up, and on Expert on at least a fifth of boards).
 */
import { writeFileSync } from "node:fs";

import { dealAt as dealLive } from "./level-tune";
import { logicLevelBankOff } from "../src/lib/duel/logicLevelDeal.server";
import { LOGIC_GAMES, PATTERN_GAMES, PERSON_LEVELS, PL_GAMES, personRun, type PersonLevel, type PlGame } from "./pattern-logic-human";
import { levelsOf } from "../src/lib/levels/gameLevels";
import { puzzleLevel, type Level } from "../src/lib/levels/levels";

export interface PlRow {
  game: PlGame;
  level: Level;
  dealt: Level;
  person: PersonLevel;
  runs: number;
  mean: number;
  median: number;
  best: number;
  finish: number;
  reach200: number;
  /** Finish times of the finished runs, in seconds: the quartiles (each level's speed line is set from the elite's). */
  times: [number, number, number] | null;
  /** The finish seconds of every run that lost only speed (ceiling 200), sorted: a speed line at t reaches 200 on those ≤ t. */
  clean: number[];
  /** With PL_SCAN=1: each run's smallest speed line reaching 200 (lineNeeded), sorted; runs that can't, left out. */
  needs?: number[];
}

/** The speed line (whole seconds) at which `share` of the runs reach 200, from a row's clean finishes. */
export function lineForShare(row: PlRow, share: number): number | null {
  const need = Math.ceil(share * row.runs);
  if (need <= 0) return 0;
  if (need > row.clean.length) return null;
  return Math.ceil(row.clean[need - 1]!);
}

const avg = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const med = (xs: readonly number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)]!;
};

/** A deal as a room deals it; with PL_BANK_OFF=1 the Logic levels' banks are built live (measuring before a rebuild). */
const dealAt: typeof dealLive = (type, level, n) => (process.env["PL_BANK_OFF"] === "1" ? logicLevelBankOff(() => dealLive(type, level, n)) : dealLive(type, level, n));

/** The chosen people on `seeds` deals of one game at one level. */
export function plRows(game: PlGame, level: Level, seeds: number, from = 0, people: readonly PersonLevel[] = PERSON_LEVELS): PlRow[] {
  type R = { score: number; done: boolean; seconds: number; ceiling: number | null; need?: number | null };
  const runs = Object.fromEntries(people.map((p) => [p, [] as R[]])) as Record<PersonLevel, R[]>;
  let dealt: Level = "normal";
  for (let n = from; n < from + seeds; n++) {
    const puzzle = dealAt(game, level, n);
    dealt = puzzleLevel(puzzle);
    for (const person of people) {
      const r = personRun(puzzle, person, `${level}:${n}`);
      runs[person].push({ score: r.score, done: r.isCorrect, seconds: r.seconds, ceiling: r.ceiling, need: r.need ?? null });
    }
  }
  return people.map((person) => {
    const xs = runs[person].map((r) => r.score);
    const t = runs[person].filter((r) => r.done).map((r) => r.seconds).sort((a, b) => a - b);
    const q = (f: number) => Math.round(t[Math.min(t.length - 1, Math.floor(f * t.length))]! * 10) / 10;
    return {
      game,
      level,
      dealt,
      person,
      runs: xs.length,
      mean: Math.round(avg(xs) * 10) / 10,
      median: med(xs),
      best: xs.length ? Math.max(...xs) : 0,
      finish: runs[person].filter((r) => r.done).length / Math.max(1, xs.length),
      reach200: xs.filter((x) => x >= 200).length / Math.max(1, xs.length),
      times: t.length ? [q(0.25), q(0.5), q(0.75)] : null,
      clean: runs[person].filter((r) => r.done && r.ceiling === 200).map((r) => Math.round(r.seconds * 10) / 10).sort((a, b) => a - b),
      ...(process.env["PL_SCAN"] === "1" ? { needs: runs[person].map((r) => r.need).filter((x): x is number => typeof x === "number").sort((a, b) => a - b) } : {}),
    };
  });
}

export function rowLine(r: PlRow): string {
  const fell = r.dealt !== r.level ? ` (no ${r.level}: dealt ${r.dealt})` : "";
  const times = r.times ? `  finish s ${r.times.join(" / ")}` : "";
  const lines = r.person === "elite" && r.clean.length ? `  line for 25/50/75 %: ${[0.25, 0.5, 0.75].map((f) => lineForShare(r, f) ?? "-").join(" / ")} s (clean ${r.clean.length})` : "";
  return `${r.game.padEnd(11)} ${r.level.padEnd(7)} ${r.person.padEnd(8)} mean ${r.mean.toFixed(1).padStart(6)}  median ${String(r.median).padStart(3)}  best ${String(r.best).padStart(3)}  finish ${(r.finish * 100).toFixed(0).padStart(3)}%  reach 200 ${(r.reach200 * 100).toFixed(0).padStart(3)}%${times}${lines}  (${r.runs})${fell}`;
}

if (import.meta.main) {
  const origError = console.error;
  console.error = (...a: unknown[]) => {
    if (typeof a[0] === "string" && a[0].includes("desync")) return;
    origError(...a);
  };
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const asked = args.find((a) => !a.startsWith("--")) ?? "all";
  const games: PlGame[] =
    asked === "all" ? [...PL_GAMES] : asked === "pattern" ? [...PATTERN_GAMES] : asked === "logic" ? [...LOGIC_GAMES] : (asked.split(",") as PlGame[]);
  const seeds = Number(opt("seeds") ?? 48);
  const from = Number(opt("from") ?? 0);
  const levelOpt = opt("level") ?? "all";
  const people = (opt("people")?.split(",") as PersonLevel[] | undefined) ?? PERSON_LEVELS;
  const out: PlRow[] = [];
  for (const game of games) {
    if (!(PL_GAMES as readonly string[]).includes(game)) throw new Error(`${game}: not a Pattern or Logic game (${PL_GAMES.join(", ")})`);
    const levels = levelOpt === "all" ? (["easy", "normal", "hard", "expert"] as Level[]).filter((l) => levelsOf(game).includes(l)) : (levelOpt.split(",") as Level[]);
    for (const level of levels) {
      const rows = plRows(game, level, seeds, from, people);
      out.push(...rows);
      for (const r of rows) console.log(rowLine(r));
    }
  }
  const json = opt("json");
  if (json) writeFileSync(json, JSON.stringify(out, null, 2) + "\n");
}
