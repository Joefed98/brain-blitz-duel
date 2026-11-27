/**
 * Records Grappler's D5 ladder (scripts/fixtures/d5-ladder-swing.json.gz) exactly as `bun scripts/d5-ladder-record.ts
 * swing` does, in less time (D5, 23 Nov 2026): the same 96 deals a level (level-tune's dealAt), the same players
 * (scripts/d5-ladder-lib.ts: the average and elite skill-band bots under Joe's human limits), the same server grade, the
 * same file. Two things make it quicker, neither changing a score: a deal's run depends only on its puzzle (each player's
 * Human is seeded by the course seed), so a course dealt twice is played once; and a run already played on today's rules
 * by scripts/swing-ladder-bands.ts (`--reuse`) is regraded from its stored log rather than played again. The ladder check
 * re-plays a sample of the table live (d5-ladder-lib's replaySample), so a stale table fails it.
 *
 *   bun scripts/swing-ladder-record.ts [--deals=96] [--from=0] [--workers=2] [--reuse=<bands.jsonl,…>] [--scores=<runs.jsonl,…>]
 *       (`--scores`: lines this script's own workers wrote earlier, {key, score}: the same runs, played already)
 */
import { appendFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { spawn } from "node:child_process";
import { SWING_REV_LADDER } from "../src/lib/arcade/swing";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData } from "../src/lib/duel/types";
import type { Level } from "../src/lib/levels/levels";
import { ALL_LEVELS, d5LadderFixture, ladderLine, playDealt, summarise, type D5Bot, type LadderFixture } from "./d5-ladder-lib";
import { dealAt } from "./level-tune";
import { swingSlideSubmission } from "./swing-slide-deal";

const SKILL: Record<"average" | "elite", "average" | "elite"> = { average: "average", elite: "elite" };
const keyOf = (seed: number, level: Level, bot: string) => `${seed}|${level}|${bot}`;
const unpack = (packed: readonly number[][]) => packed.map(([t, k, a]) => ({ t: t!, k: k!, a: a!, b: 0, c: 0, d: 0 }));

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const worker = opt("worker");
  if (worker !== undefined) {
    // A worker: the listed runs ("seed|level|bot"), one JSON line each to `--out`.
    for (const key of worker.split(",")) {
      const [seed, level, bot] = key.split("|") as [string, Level, "average" | "elite"];
      const puzzle = { type: "swing", seed: Number(seed), swingRev: SWING_REV_LADDER, ...(level !== "normal" ? { level } : {}) } as unknown as PuzzleData;
      const r = await playDealt("swing", puzzle, SKILL[bot]);
      appendFileSync(opt("out")!, `${JSON.stringify({ key, score: r.score })}\n`);
    }
    process.exit(0);
  }
  const deals = Number(opt("deals") ?? 96);
  const from = Number(opt("from") ?? 0);
  const workers = Number(opt("workers") ?? 2);
  // The runs each row needs, by key; what's reused is regraded on today's code.
  const puzzles = new Map<string, PuzzleData>();
  const rowsKeys: { level: Level; bot: D5Bot; keys: string[] }[] = [];
  for (const bot of ["average", "elite"] as const) {
    for (const level of ALL_LEVELS) {
      const keys: string[] = [];
      for (let n = from; n < from + deals; n++) {
        const puzzle = dealAt("swing", level, n);
        const p = puzzle as unknown as { seed: number; swingRev: number };
        if (p.swingRev !== SWING_REV_LADDER) throw new Error(`deal ${n} at ${level} is not swingRev 19`);
        const key = keyOf(p.seed, level, bot);
        puzzles.set(key, puzzle);
        keys.push(key);
      }
      rowsKeys.push({ level, bot, keys });
    }
  }
  const scores = new Map<string, number>();
  let reused = 0;
  for (const f of (opt("reuse") ?? "").split(",").filter(Boolean)) {
    for (const line of readFileSync(f, "utf8").trim().split("\n").filter(Boolean)) {
      const r = JSON.parse(line) as { seed: number; level: Level; player: string; score: number | null; events?: number[][] };
      const key = keyOf(r.seed, r.level, r.player);
      if (!puzzles.has(key) || scores.has(key) || !r.events || r.score === null) continue;
      const puzzle = puzzles.get(key)!;
      const raw = swingSlideSubmission(r.seed, unpack(r.events) as never, SWING_REV_LADDER, r.level === "normal" ? null : (r.level as never));
      scores.set(key, gradeAnswer(puzzle, raw, 0).score);
      reused++;
    }
  }
  for (const f of (opt("scores") ?? "").split(",").filter(Boolean)) {
    for (const line of readFileSync(f, "utf8").trim().split("\n").filter(Boolean)) {
      const r = JSON.parse(line) as { key: string; score: number };
      if (puzzles.has(r.key) && !scores.has(r.key)) {
        scores.set(r.key, r.score);
        reused++;
      }
    }
  }
  const todo = [...puzzles.keys()].filter((k) => !scores.has(k));
  console.log(`${puzzles.size} distinct runs: ${reused} reused (regraded from stored logs, or scores played before), ${todo.length} to play on ${workers} workers`);
  const tmp = `/tmp/swing-ladder-record-${process.pid}`;
  await Promise.all(
    Array.from({ length: workers }, (_, k) => new Promise<void>((resolve, reject) => {
      const mine = todo.filter((_, i) => i % workers === k);
      if (!mine.length) return resolve();
      const child = spawn("bun", [new URL(import.meta.url).pathname, `--worker=${mine.join(",")}`, `--out=${tmp}.${k}`], { stdio: "inherit" });
      child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`worker ${k} exited ${code}`))));
    })),
  );
  for (let k = 0; k < workers; k++) {
    if (!existsSync(`${tmp}.${k}`)) continue;
    for (const line of readFileSync(`${tmp}.${k}`, "utf8").trim().split("\n").filter(Boolean)) {
      const r = JSON.parse(line) as { key: string; score: number };
      scores.set(r.key, r.score);
    }
    unlinkSync(`${tmp}.${k}`);
  }
  const fixture: LadderFixture = { game: "swing", deals, from, rows: [] };
  for (const { level, bot, keys } of rowsKeys) {
    const runs = keys.map((key, i) => {
      if (!scores.has(key)) throw new Error(`no score for ${key}`);
      return { n: from + i, seed: Number(key.split("|")[0]), score: scores.get(key)!, finished: false };
    });
    console.log(ladderLine(summarise("swing", level, level, bot, runs)));
    fixture.rows.push({ level, bot, scores: runs.map((r) => r.score) });
  }
  writeFileSync(d5LadderFixture("swing"), gzipSync(JSON.stringify(fixture)));
  console.log(`→ ${d5LadderFixture("swing")}`);
}
