/**
 * Arcade skill bands: simulated human players at four levels (average, good,
 * great, near-perfect; scripts/arcade-skill-bands/human.ts) play every active
 * arcade game on fixed room seeds. Each run's input log goes through the
 * server's own encode + replay path, and only the replayed score counts.
 *
 *   bun scripts/arcade-skill-bands.ts                    # all 22 games, 30 seeds, live revisions
 *   bun scripts/arcade-skill-bands.ts bintoss tilt       # only these games
 *   bun scripts/arcade-skill-bands.ts --seeds=40 --rev=both --jobs=4 --json=out.json
 *
 * --rev=live (default) uses the revision rooms stamped before the Oct 2026
 * score-band pass, --rev=next the one stamped after it, --rev=both both (same
 * human, same seed: score-only revisions replay the identical log), --rev=tuned
 * the later revision a tuning pass stamps on the same band curve (Tuning A:
 * Wavefront, Orbit, Grappler, Tilt).
 * --rev=current measures a later gameplay revision (a game's `current`, Tuning B)
 * against its band revision: the band revision is reported as "live", today's
 * revision as "next".
 * --levels=average,near limits the levels. --save=<dir> writes each run's
 * encoded log (for fixtures). Not a check: it has no pass/fail and is not run
 * by run-checks or CI. One game at 30 seeds × 4 levels takes ~10 s to a few
 * minutes depending on the bot.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { GAMES, type GameSpec } from "./arcade-skill-bands/games";
import { Human, LEVELS, LEVEL_LABEL, type SkillLevel } from "./arcade-skill-bands/human";
import type { SkillBot } from "./arcade-skill-bands/bot";
import { UNITS } from "./arcade-skill-bands/units";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 30);
const REV_MODE = (opt("rev") ?? "live") as "live" | "next" | "both" | "current" | "tuned";
const JOBS = Number(opt("jobs") ?? 1);
const JSON_PATH = opt("json");
const SAVE_DIR = opt("save");
const LEVEL_LIST = (opt("levels")?.split(",") ?? [...LEVELS]) as SkillLevel[];
const CHILD = args.includes("--child");
const ONLY = args.filter((a) => !a.startsWith("--"));

export interface RunRecord {
  type: string;
  rev: number | null;
  which: "live" | "next" | "tuned";
  level: SkillLevel;
  seed: number;
  score: number;
  counters: Record<string, number>;
  /** Achievement units of the final state (scripts/arcade-skill-bands/units.ts). */
  units: number;
  finished: boolean;
  flagged: boolean;
  /** Bot sim score disagreed with the server replay (should never happen). */
  mismatch: boolean;
  ms: number;
}

async function loadBot(type: string): Promise<SkillBot | null> {
  const path = new URL(`./arcade-skill-bands/bots/${type}.ts`, import.meta.url);
  if (!existsSync(path)) return null;
  const mod = await import(path.href);
  return mod.bot as SkillBot;
}

const CHECKPOINT_EVERY = 300;

function playOne(spec: GameSpec, bot: SkillBot, rev: number | null, which: "live" | "next" | "tuned", level: SkillLevel, seed: number): RunRecord & { raw: string } {
  const started = performance.now();
  const game = spec.gameFor(rev, seed);
  const human = new Human(spec.type, seed, level);
  const out = bot({ game, seed, rev, human });
  // Re-drive the sim from the bot's log alone, exactly as the phone records it.
  let state = game.init(seed);
  const checkpoints: unknown[] = [];
  const events = out.events ?? [];
  const taps = out.taps ?? [];
  const byTick = new Map(events.map((e) => [e.t, e]));
  const tapSet = new Set(taps);
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    state = game.step(state, spec.taps ? tapSet.has(t) : (byTick.get(t) ?? null));
    if (state.tick % CHECKPOINT_EVERY === 0) checkpoints.push(spec.checkpoint(state));
  }
  const score = game.score(state);
  const body = { seed, claimedScore: score, events, inputs: taps, taps: [], endTick: state.tick, checkpoints };
  const raw = appendClientCounters(spec.encode(body, rev, seed), arcadeCounters(spec.type, state, score));
  const result = spec.replay(seed, raw, rev);
  const counters = arcadeCounters(spec.type, result.state, result.score);
  return {
    type: spec.type,
    rev,
    which,
    level,
    seed,
    score: result.score,
    counters,
    units: UNITS[spec.type]?.(result.state).u ?? 0,
    finished: UNITS[spec.type]?.(result.state).finished ?? false,
    flagged: Boolean(result.flagged),
    mismatch: result.score !== score,
    ms: performance.now() - started,
    raw,
  };
}

async function runGame(spec: GameSpec): Promise<RunRecord[]> {
  const bot = await loadBot(spec.type);
  if (!bot) {
    console.error(`${spec.type}: no bot yet`);
    return [];
  }
  const revs: ["live" | "next" | "tuned", number | null][] = [];
  if (REV_MODE === "tuned") {
    // The revision rooms stamp today when a later tuning pass changed play on the band curve (Tuning A).
    if (spec.tuned === undefined) console.error(`${spec.type}: no tuned revision`);
    else revs.push(["tuned", spec.tuned]);
  } else if (REV_MODE === "current") {
    if (spec.current === undefined || spec.next === undefined) console.error(`${spec.type}: no current revision past the band revision`);
    else revs.push(["live", spec.next], ["next", spec.current]);
  } else if (REV_MODE !== "next") revs.push(["live", spec.live]);
  if (REV_MODE !== "live" && REV_MODE !== "current" && REV_MODE !== "tuned") {
    if (spec.next === undefined) console.error(`${spec.type}: no next revision`);
    else revs.push(["next", spec.next]);
  }
  const records: RunRecord[] = [];
  for (const [which, rev] of revs)
    for (const level of LEVEL_LIST)
      for (let n = 0; n < SEEDS; n++) {
        const seed = spec.seedFor(n);
        const rec = playOne(spec, bot, rev, which, level, seed);
        if (SAVE_DIR) {
          mkdirSync(`${SAVE_DIR}/${spec.type}`, { recursive: true });
          writeFileSync(`${SAVE_DIR}/${spec.type}/${which}-${level}-${n}.txt`, rec.raw);
        }
        const { raw: _raw, ...plain } = rec;
        records.push(plain);
      }
  return records;
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return Math.round(sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo));
}

export function summarise(records: RunRecord[]) {
  const rows: { type: string; which: string; level: SkillLevel; median: number; p10: number; p90: number; min: number; max: number; n: number }[] = [];
  const keys = new Set(records.map((r) => `${r.type}|${r.which}|${r.level}`));
  for (const key of keys) {
    const [type, which, level] = key.split("|") as [string, string, SkillLevel];
    const scores = records.filter((r) => r.type === type && r.which === which && r.level === level).map((r) => r.score).sort((a, b) => a - b);
    rows.push({ type, which, level, median: quantile(scores, 0.5), p10: quantile(scores, 0.1), p90: quantile(scores, 0.9), min: scores[0]!, max: scores.at(-1)!, n: scores.length });
  }
  return rows;
}

function printTable(records: RunRecord[]) {
  const rows = summarise(records);
  const types = [...new Set(rows.map((r) => r.type))];
  const whichs = [...new Set(rows.map((r) => r.which))];
  console.log(`\n${"game".padEnd(10)} ${"rev".padEnd(5)} ${LEVEL_LIST.map((l) => LEVEL_LABEL[l].padEnd(20)).join(" ")}`);
  console.log(`${"".padEnd(16)} ${LEVEL_LIST.map(() => "median (p10–p90)".padEnd(20)).join(" ")}`);
  for (const type of types)
    for (const which of whichs) {
      const cells = LEVEL_LIST.map((level) => {
        const r = rows.find((x) => x.type === type && x.which === which && x.level === level);
        return (r ? `${r.median} (${r.p10}–${r.p90})` : "-").padEnd(20);
      });
      if (cells.every((c) => c.trim() === "-")) continue;
      console.log(`${type.padEnd(10)} ${which.padEnd(5)} ${cells.join(" ")}`);
    }
  const bad = records.filter((r) => r.mismatch || r.flagged);
  if (bad.length) console.log(`\nWARNING: ${bad.length} run(s) flagged or disagreeing with the server replay, e.g. ${JSON.stringify(bad[0])}`);
}

async function main() {
  const specs = GAMES.filter((g) => ONLY.length === 0 || ONLY.includes(g.type));
  if (CHILD) {
    const records: RunRecord[] = [];
    for (const spec of specs) records.push(...(await runGame(spec)));
    process.stdout.write(`@@RESULT${JSON.stringify(records)}\n`);
    return;
  }
  let records: RunRecord[] = [];
  if (JOBS <= 1) {
    for (const spec of specs) {
      const t0 = performance.now();
      const recs = await runGame(spec);
      records.push(...recs);
      console.error(`${spec.type}: ${recs.length} runs in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
    }
  } else {
    const queue = [...specs];
    const passArgs = args.filter((a) => a.startsWith("--") && !a.startsWith("--jobs=") && !a.startsWith("--json="));
    const worker = async () => {
      while (queue.length) {
        const spec = queue.shift()!;
        const t0 = performance.now();
        const recs = await new Promise<RunRecord[]>((resolve) => {
          const child = spawn("bun", [process.argv[1]!, spec.type, "--child", ...passArgs], { stdio: ["ignore", "pipe", "inherit"] });
          let out = "";
          child.stdout.on("data", (d) => (out += d));
          child.on("close", () => {
            const line = out.split("\n").find((l) => l.startsWith("@@RESULT"));
            resolve(line ? (JSON.parse(line.slice(8)) as RunRecord[]) : []);
          });
        });
        records.push(...recs);
        console.error(`${spec.type}: ${recs.length} runs in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(JOBS, cpus().length) }, worker));
    records = specs.flatMap((s) => records.filter((r) => r.type === s.type));
  }
  printTable(records);
  if (JSON_PATH) writeFileSync(JSON_PATH, JSON.stringify({ seeds: SEEDS, rev: REV_MODE, records, summary: summarise(records) }, null, 1));
}

await main();
