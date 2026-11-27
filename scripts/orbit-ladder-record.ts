/**
 * Records Orbit's D5 ladder (D5, 23 Nov 2026): the same fixture as `bun scripts/d5-ladder-record.ts orbit --deals=96`
 * (scripts/fixtures/d5-ladder-orbit.json.gz: the average player and the realistic elite under the human limits on deals
 * 0–95 at every level, each run's server score), in two steps, because Orbit's elite player takes seconds a run:
 *
 *   bun scripts/orbit-ladder-record.ts play [--levels=…] [--out=<runs.jsonl>]   plays each run once (scripts/d5-ladder-lib.ts
 *                                                                              playDealt) and keeps its log and counts
 *   bun scripts/orbit-ladder-record.ts write [--in=<runs.jsonl>]               regrades every kept log through the server
 *                                                                              (gradeAnswer on the dealt puzzle) and writes
 *                                                                              the fixture
 *
 * The players never read the score's lines (their plans weigh what they see: planets, stardust, moons, fields), so a
 * kept log is the run d5-ladder-record would play; `write` regrades it on today's code, and orbit-ladder-check's live
 * re-play sample (replaySample) proves the fixture is today's game.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import type { PuzzleType } from "../src/lib/duel/types";
import type { Level } from "../src/lib/levels/levels";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { ALL_LEVELS, d5LadderFixture, playDealt, type LadderFixture } from "./d5-ladder-lib";
import { dealAt } from "./level-tune";

const DEALS = 96;
const args = process.argv.slice(2);
const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const runsFile = opt("out") ?? opt("in") ?? ".shots/d5/orbit-runs.jsonl";
type Kept = { level: Level; bot: "average" | "elite"; n: number; score: number; raw: string };

if (args[0] === "play") {
  const levels = (opt("levels")?.split(",") ?? ALL_LEVELS) as Level[];
  const have = new Set<string>();
  if (existsSync(runsFile)) for (const l of readFileSync(runsFile, "utf8").split("\n")) if (l) { const r = JSON.parse(l) as Kept; have.add(`${r.level}/${r.bot}/${r.n}`); }
  for (const level of levels) for (const bot of ["average", "elite"] as const) for (let n = 0; n < DEALS; n++) {
    if (have.has(`${level}/${bot}/${n}`)) continue;
    const r = await playDealt("orbit" as PuzzleType, dealAt("orbit", level, n), bot);
    const e = r.extra as Record<string, number | boolean>;
    appendFileSync(runsFile, JSON.stringify({ level, bot, n, score: r.score, finished: e["finished"], left: Math.round(Number(e["secondsLeft"] ?? 0) * 60), dust: e["dust"], slings: e["slings"], threads: e["threads"], perfect: e["perfect"], passed: e["passed"], raw: r.raw }) + "\n");
  }
} else if (args[0] === "write") {
  const kept = readFileSync(runsFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Kept);
  const fixture: LadderFixture = { game: "orbit", deals: DEALS, from: 0, rows: [] };
  for (const bot of ["average", "elite"] as const) {
    for (const level of ALL_LEVELS) {
      const scores: number[] = [];
      for (let n = 0; n < DEALS; n++) {
        const r = kept.find((k) => k.level === level && k.bot === bot && k.n === n);
        if (!r) throw new Error(`no kept run for ${level} ${bot} deal ${n}`);
        scores.push(gradeAnswer(dealAt("orbit", level, n), r.raw, 0).score);
      }
      fixture.rows.push({ level, bot, scores });
      const avg = scores.reduce((a, b) => a + b, 0) / DEALS;
      console.log(`orbit ${level.padEnd(7)} ${bot.padEnd(8)} avg ${avg.toFixed(1)}  at200 ${((scores.filter((s) => s >= 200).length / DEALS) * 100).toFixed(0)}%`);
    }
  }
  writeFileSync(d5LadderFixture("orbit"), gzipSync(JSON.stringify(fixture)));
  console.log(`→ ${d5LadderFixture("orbit")}`);
} else {
  console.log("usage: bun scripts/orbit-ladder-record.ts play|write [--levels=…] [--out=|--in=<runs.jsonl>]");
  process.exit(1);
}
