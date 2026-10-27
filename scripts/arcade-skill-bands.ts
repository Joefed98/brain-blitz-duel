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
 * --rev=c measures Tuning C (a game's `tunec`) against the revision rooms
 * stamped before it (its `tuned`, `current` or `next`): "live" is the old
 * revision, "next" the Tuning C one.
 * --rev=e measures Tuning E (a game's `tunee`: the taller worlds of High Rise,
 * Meteor, Scrumper and Hover) against the revision rooms stamped before it
 * (its `tunec`, `tuned`, `current` or `next`): "live" is the old revision,
 * "next" the Tuning E one.
 * --rev=bank measures a bank-only revision (a game's `bank`: Scrumper snipRev 6)
 * against its Tuning E one: "live" is the Tuning E revision, "next" the new bank.
 * --rev=f measures Tuning F (a game's `tunef`: Breaker, Rally, Tempo, Meteor and
 * Orbit; Jaywalk, Slice, Coral Pop, Grappler, Gemstone and Scrumper) against the
 * revision rooms stamped before it (liveBefore: its `bank`, `tunee`, `tunec`,
 * `tuned`, `current` or `next`): "live" is the old revision, "next" the Tuning F one.
 * --rev=g1 measures taller worlds batch 1 (a game's `tuneg`: Breaker, Rally,
 * Wavefront and Fission) against the revision rooms stamped before it
 * (liveBeforeG1: its `tunef`, else liveBefore): "live" is the old revision,
 * "next" the taller one. --rev=g2 does the same for batch 2 (a game's `tuneg2`:
 * Tempo, Slice and Coral Pop; Mixed Signals and Pull! are engine games, measured
 * by scripts/arcade-tuning-g2-engine-bands.ts with the puzzle-fairness kits).
 * --rev=g3 does the same for batch 3 (a game's `tuneg3`: Grappler, Orbit and Ball Tracker).
 * --rev=x measures a world expansion (LIVE_BANDS' `rev` once it has a `strictRev`, docs/scoring-200.md) against the
 * band-3 revision before it (its `strictRev`): "live" is the band-3 revision, "next" the expansion.
 * --rev=now measures the revision rooms deal today (LIVE_BANDS in src/lib/arcade/liveBands.ts), reported as
 * "live": the scoring-targets audit (18 Oct 2026, docs/scoring-targets.md) ran it before and after.
 * --levels=average,near limits the levels (default the four core levels; --levels=all adds weak, elite
 * and perfect, scripts/arcade-skill-bands/human.ts). --from=N starts the seed samples at n = N (fresh
 * seeds: --from=10000). Each level plays the same seeds (paired runs). --bots=v1 plays the bots as the
 * checks pin them (BotCtx.fixes off: no Oct 2026 competence fixes, docs/arcade-bands-elite.md).
 * --jobs splits the work by game and level. scripts/arcade-bands-elite.ts turns --json files into the
 * elite report. --save=<dir> writes each run's
 * encoded log (for fixtures). Not a check: it has no pass/fail and is not run
 * by run-checks or CI. One game at 30 seeds × 4 levels takes ~10 s to a few
 * minutes depending on the bot.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { GAMES, liveBefore, liveBeforeG1, type GameSpec } from "./arcade-skill-bands/games";
import { ALL_LEVELS, Human, LEVELS, LEVEL_LABEL, type SkillLevel } from "./arcade-skill-bands/human";
import type { SkillBot } from "./arcade-skill-bands/bot";
import { UNITS } from "./arcade-skill-bands/units";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { roundMaxFor } from "../src/lib/duel/roundMax";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 30);
const REV_MODE = (opt("rev") ?? "live") as "live" | "next" | "both" | "current" | "tuned" | "c" | "e" | "bank" | "f" | "g1" | "g2" | "g3" | "now" | "x";
const JOBS = Number(opt("jobs") ?? 1);
const JSON_PATH = opt("json");
const SAVE_DIR = opt("save");
/** A level, or "random" (the bot module's `randomBot`: inputs at random, no aim; measured only when named). */
type RunLevel = SkillLevel | "random";
const LEVEL_LIST = (opt("levels") === "all" ? [...ALL_LEVELS] : (opt("levels")?.split(",") ?? [...LEVELS])) as RunLevel[];
const levelLabel = (l: RunLevel) => (l === "random" ? "Random" : LEVEL_LABEL[l]);
const FROM = Number(opt("from") ?? 0);
const FIXES = opt("bots") !== "v1";
const CHILD = args.includes("--child");
const ONLY = args.filter((a) => !a.startsWith("--"));

export interface RunRecord {
  type: string;
  rev: number | null;
  which: "live" | "next" | "tuned";
  level: RunLevel;
  /** The sample index (roomSeed(n) and the like): every level plays the same n. */
  n: number;
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

async function loadBot(type: string): Promise<{ bot: SkillBot; random?: SkillBot } | null> {
  const path = new URL(`./arcade-skill-bands/bots/${type}.ts`, import.meta.url);
  if (!existsSync(path)) return null;
  const mod = await import(path.href);
  return { bot: mod.bot as SkillBot, random: mod.randomBot as SkillBot | undefined };
}

const CHECKPOINT_EVERY = 300;

function playOne(spec: GameSpec, bot: SkillBot, rev: number | null, which: "live" | "next" | "tuned", level: RunLevel, n: number, seed: number): RunRecord & { raw: string } {
  const started = performance.now();
  const game = spec.gameFor(rev, seed);
  // A random player gets the weak level's Human for its dice; the random bot ignores its profile.
  const human = new Human(spec.type, seed, level === "random" ? "weak" : level);
  const out = bot({ game, seed, rev, human, fixes: FIXES });
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
    n,
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
  const bots = await loadBot(spec.type);
  if (!bots) {
    console.error(`${spec.type}: no bot yet`);
    return [];
  }
  if (LEVEL_LIST.includes("random") && !bots.random) console.error(`${spec.type}: no randomBot, random play skipped`);
  const revs: ["live" | "next" | "tuned", number | null][] = [];
  if (REV_MODE === "x") {
    // World expansions (docs/scoring-200.md): the band-3 revision ("live") against the stamp rooms deal now ("next").
    const live = (LIVE_BANDS as Record<string, { rev: number; strictRev?: number }>)[spec.type];
    if (live?.strictRev === undefined) console.error(`${spec.type}: no expansion revision`);
    else revs.push(["live", live.strictRev], ["next", live.rev]);
  } else if (REV_MODE === "now") {
    // The revision rooms deal today (LIVE_BANDS), as "live": the scoring-targets audit (Oct 2026).
    // (A branch whose entry names the revision rooms deal separately, `dealt`, measures that one.)
    const entry = (LIVE_BANDS as Record<string, { rev: number; dealt?: number }>)[spec.type];
    const now = entry?.dealt ?? entry?.rev;
    if (now === undefined) console.error(`${spec.type}: no live band`);
    else revs.push(["live", now]);
  } else if (REV_MODE === "x") {
    // The 200-point expansions (Oct 2026, docs/scoring-200.md): the revision rooms dealt before it ("live")
    // against the expansion's ("next").
    const live = (LIVE_BANDS as Record<string, { rev: number; strictRev?: number }>)[spec.type];
    if (live?.strictRev === undefined) console.error(`${spec.type}: no expansion revision`);
    else revs.push(["live", live.strictRev], ["next", live.rev]);
  } else if (REV_MODE === "g3") {
    // Taller worlds batch 3: the revision rooms stamped before it ("live") against the taller one ("next").
    const before = liveBeforeG1(spec);
    if (before === undefined) console.error(`${spec.type}: no revision to measure`);
    else revs.push(["live", before]);
    if (spec.tuneg3 !== undefined) revs.push(["next", spec.tuneg3]);
  } else if (REV_MODE === "g2") {
    // Taller worlds batch 2: the revision rooms stamped before it ("live") against the taller one ("next").
    const before = liveBeforeG1(spec);
    if (before === undefined) console.error(`${spec.type}: no revision to measure`);
    else revs.push(["live", before]);
    if (spec.tuneg2 !== undefined) revs.push(["next", spec.tuneg2]);
  } else if (REV_MODE === "g1") {
    // Taller worlds batch 1: the revision rooms stamped before it ("live") against the taller one ("next").
    const before = liveBeforeG1(spec);
    if (before === undefined) console.error(`${spec.type}: no revision to measure`);
    else revs.push(["live", before]);
    if (spec.tuneg !== undefined) revs.push(["next", spec.tuneg]);
  } else if (REV_MODE === "f") {
    // Tuning F: the revision rooms stamped before it ("live") against the Tuning F one ("next").
    // (liveBefore: a bank-only revision first, so Scrumper measures snipRev 6 → 7). A game with no
    // `tunef` plays only "live" (how the pre-change fixtures were saved).
    const before = liveBefore(spec);
    if (before === undefined) console.error(`${spec.type}: no revision to measure`);
    else revs.push(["live", before]);
    if (spec.tunef !== undefined) revs.push(["next", spec.tunef]);
  } else if (REV_MODE === "bank") {
    // A bank-only revision ("next") against the Tuning E one rooms stamped before it ("live").
    if (spec.bank === undefined || spec.tunee === undefined) console.error(`${spec.type}: no bank revision`);
    else revs.push(["live", spec.tunee], ["next", spec.bank]);
  } else if (REV_MODE === "e") {
    // Tuning E: the revision rooms stamped before it ("live") against the Tuning E one ("next").
    const before = spec.tunec ?? spec.tuned ?? spec.current ?? spec.next;
    if (spec.tunee === undefined || before === undefined) console.error(`${spec.type}: no Tuning E revision`);
    else revs.push(["live", before], ["next", spec.tunee]);
  } else if (REV_MODE === "c") {
    // Tuning C: the revision rooms stamped before it ("live") against the Tuning C one ("next").
    const before = spec.tuned ?? spec.current ?? spec.next;
    if (spec.tunec === undefined || before === undefined) console.error(`${spec.type}: no Tuning C revision`);
    else revs.push(["live", before], ["next", spec.tunec]);
  } else if (REV_MODE === "tuned") {
    // The revision rooms stamp today when a later tuning pass changed play on the band curve (Tuning A).
    if (spec.tuned === undefined) console.error(`${spec.type}: no tuned revision`);
    else revs.push(["tuned", spec.tuned]);
  } else if (REV_MODE === "current") {
    if (spec.current === undefined || spec.next === undefined) console.error(`${spec.type}: no current revision past the band revision`);
    else revs.push(["live", spec.next], ["next", spec.current]);
  } else if (REV_MODE !== "next") revs.push(["live", spec.live]);
  if (REV_MODE !== "live" && REV_MODE !== "current" && REV_MODE !== "tuned" && REV_MODE !== "c" && REV_MODE !== "e" && REV_MODE !== "bank" && REV_MODE !== "f" && REV_MODE !== "g1" && REV_MODE !== "g2" && REV_MODE !== "g3" && REV_MODE !== "now" && REV_MODE !== "x") {
    if (spec.next === undefined) console.error(`${spec.type}: no next revision`);
    else revs.push(["next", spec.next]);
  }
  const records: RunRecord[] = [];
  for (const [which, rev] of revs)
    for (const level of LEVEL_LIST) {
      const bot = level === "random" ? bots.random : bots.bot;
      if (!bot) continue;
      for (let n = FROM; n < FROM + SEEDS; n++) {
        // A game whose expansion deals from its own bank maps n to a course per revision (Grappler, games.ts).
        const seed = spec.seedForRev?.(n, rev) ?? spec.seedFor(n);
        const rec = playOne(spec, bot, rev, which, level, n, seed);
        if (SAVE_DIR) {
          mkdirSync(`${SAVE_DIR}/${spec.type}`, { recursive: true });
          writeFileSync(`${SAVE_DIR}/${spec.type}/${which}-${level}-${n}.txt`, rec.raw);
        }
        const { raw: _raw, ...plain } = rec;
        records.push(plain);
      }
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
  const rows: { type: string; which: string; level: RunLevel; median: number; p10: number; p90: number; min: number; max: number; n: number }[] = [];
  const keys = new Set(records.map((r) => `${r.type}|${r.which}|${r.level}`));
  for (const key of keys) {
    const [type, which, level] = key.split("|") as [string, string, RunLevel];
    const scores = records.filter((r) => r.type === type && r.which === which && r.level === level).map((r) => r.score).sort((a, b) => a - b);
    rows.push({ type, which, level, median: quantile(scores, 0.5), p10: quantile(scores, 0.1), p90: quantile(scores, 0.9), min: scores[0]!, max: scores.at(-1)!, n: scores.length });
  }
  return rows;
}

function printTable(records: RunRecord[]) {
  const rows = summarise(records);
  const types = [...new Set(rows.map((r) => r.type))];
  const whichs = [...new Set(rows.map((r) => r.which))];
  console.log(`\n${"game".padEnd(10)} ${"rev".padEnd(5)} ${LEVEL_LIST.map((l) => levelLabel(l).padEnd(20)).join(" ")}`);
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
    // One job per game and level (the slow bots' levels run side by side).
    const queue = specs.flatMap((spec) => LEVEL_LIST.map((level) => ({ spec, level })));
    const passArgs = args.filter((a) => a.startsWith("--") && !a.startsWith("--jobs=") && !a.startsWith("--json=") && !a.startsWith("--levels="));
    const worker = async () => {
      while (queue.length) {
        const { spec, level } = queue.shift()!;
        const t0 = performance.now();
        const recs = await new Promise<RunRecord[]>((resolve) => {
          const child = spawn("bun", [process.argv[1]!, spec.type, "--child", `--levels=${level}`, ...passArgs], { stdio: ["ignore", "pipe", "inherit"] });
          let out = "";
          child.stdout.on("data", (d) => (out += d));
          child.on("close", () => {
            const line = out.split("\n").find((l) => l.startsWith("@@RESULT"));
            resolve(line ? (JSON.parse(line.slice(8)) as RunRecord[]) : []);
          });
        });
        records.push(...recs);
        console.error(`${spec.type} ${level}: ${recs.length} runs in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(JOBS, cpus().length) }, worker));
    records = specs.flatMap((s) => LEVEL_LIST.flatMap((l) => records.filter((r) => r.type === s.type && r.level === l)));
  }
  printTable(records);
  if (JSON_PATH) writeFileSync(JSON_PATH, JSON.stringify({ seeds: SEEDS, from: FROM, rev: REV_MODE, bots: FIXES ? "v2" : "v1", maxes: Object.fromEntries(specs.map((sp) => [sp.type, roundMaxFor(sp.type)])), records, summary: summarise(records) }, null, 1));
}

await main();
