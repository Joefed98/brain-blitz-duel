/**
 * D6's ladder report (a tool, not a check): the average player and the realistic elite under HUMAN_LIMITS on every
 * level of D6's games (scripts/d6-ladder-lib.ts), with Joe's ladder test per game.
 *
 *   bun scripts/d6-ladder.ts [games…] [--seeds=24] [--from=0] [--levels=easy,normal,hard,expert] [--parts] [--json=<path>]
 *
 * --parts prints each part's average and how often it was full (the server's stored reveal lines).
 */
import { writeFileSync } from "node:fs";

import type { Level } from "../src/lib/levels/levels";
import { D6_GAMES, LADDER_LEVELS, cellLine, ladderCells, ladderVerdict, partsLine, type LadderCell } from "./d6-ladder-lib";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const games = args.filter((a) => !a.startsWith("--"));
const list = games.length ? games : [...D6_GAMES];
const seeds = Number(opt("seeds") ?? 24);
const from = Number(opt("from") ?? 0);
const levels = (opt("levels")?.split(",") as Level[] | undefined) ?? [...LADDER_LEVELS];
const all: LadderCell[] = [];
for (const game of list) {
  const cells: LadderCell[] = [];
  for (const level of levels) {
    const t0 = Date.now();
    const out = await ladderCells(game, level, seeds, from);
    for (const c of out) console.log(`${cellLine(c)}  ${((Date.now() - t0) / 1000).toFixed(0)} s${args.includes("--parts") ? `\n    ${partsLine(c)}` : ""}`);
    cells.push(...out);
  }
  if (levels.length === LADDER_LEVELS.length) {
    const v = ladderVerdict(cells);
    console.log(`${game}: ladder ${v.ok ? "PASS" : "FAIL"}${v.problems.map((p) => `\n  - ${p}`).join("")}`);
  }
  all.push(...cells);
}
const json = opt("json");
if (json) writeFileSync(json, JSON.stringify(all.map((c) => ({ ...c, runs: c.runs.map((r) => [r.n, r.seed, r.score, r.parts.map((p) => [p.label, p.points, p.max, p.raw])]) }))));
