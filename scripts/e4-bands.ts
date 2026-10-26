/**
 * Expansion E4 (25 Oct 2026, docs/expansions/e4.md): the skill-band bots (scripts/arcade-skill-bands/)
 * play High Rise and Pinball on the revision rooms dealt before the expansion ("old") and on the
 * expansion's ("new"), same human and same seed, through the server's own encode + replay path, and
 * print each level's median, top 10 % and best. `--units` also prints the new revision's unit
 * quantiles per level (what the curve fit reads); `--json=<path>` saves every run.
 *
 *   bun scripts/e4-bands.ts [skyline] [pinball] [--seeds=30] [--units] [--json=out.json]
 *
 * A tool, not a check (no pass/fail; not run by run-checks or CI).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { writeFileSync } from "node:fs";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, LEVELS, LEVEL_LABEL, type SkillLevel } from "./arcade-skill-bands/human";
import { UNITS } from "./arcade-skill-bands/units";
import { SKYLINE_REV_EXPAND, SKYLINE_REV_STRICT } from "../src/lib/arcade/skyline";
import { PIN_REV_EXPAND, PIN_REV_STRICT } from "../src/lib/arcade/pinball";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 30);
const JSON_PATH = opt("json");
const SHOW_UNITS = args.includes("--units");
const ONLY = args.filter((a) => !a.startsWith("--"));

/** [old revision, new revision] per game. */
export const E4_REVS: Record<string, [number, number]> = {
  skyline: [SKYLINE_REV_STRICT, SKYLINE_REV_EXPAND],
  pinball: [PIN_REV_STRICT, PIN_REV_EXPAND],
};

export interface E4Run {
  type: string;
  which: "old" | "new";
  rev: number;
  level: SkillLevel;
  seed: number;
  score: number;
  units: number;
  flagged: boolean;
  mismatch: boolean;
  counters: Record<string, number>;
  raw: string;
}

/** One bot run through the server's encode + replay path (as scripts/arcade-skill-bands.ts plays it). */
export async function e4Run(type: string, rev: number, level: SkillLevel, n: number, which: "old" | "new"): Promise<E4Run> {
  const spec = GAME_BY_TYPE.get(type as any)!;
  const bot = (await import(`./arcade-skill-bands/bots/${type}.ts`)).bot;
  const seed = spec.seedFor(n);
  const game = spec.gameFor(rev, seed);
  const human = new Human(spec.type, seed, level);
  const out = bot({ game, seed, rev, human });
  let state = game.init(seed);
  const checkpoints: unknown[] = [];
  const events = out.events ?? [];
  const taps = out.taps ?? [];
  const byTick = new Map(events.map((e: any) => [e.t, e]));
  const tapSet = new Set(taps);
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    state = game.step(state, spec.taps ? tapSet.has(t) : (byTick.get(t) ?? null));
    if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const score = game.score(state);
  const body = { seed, claimedScore: score, events, inputs: taps, taps: [], endTick: state.tick, checkpoints };
  const raw = appendClientCounters(spec.encode(body, rev, seed), arcadeCounters(spec.type, state, score));
  const result = spec.replay(seed, raw, rev);
  return {
    type,
    which,
    rev,
    level,
    seed,
    score: result.score,
    units: UNITS[type]?.(result.state).u ?? 0,
    flagged: Boolean(result.flagged),
    mismatch: result.score !== score,
    counters: arcadeCounters(spec.type, result.state, result.score) as Record<string, number>,
    raw,
  };
}

export function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return Math.round(sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo));
}

async function main() {
  const types = ONLY.length ? ONLY : Object.keys(E4_REVS);
  const runs: E4Run[] = [];
  for (const type of types) {
    const [oldRev, newRev] = E4_REVS[type]!;
    const t0 = performance.now();
    for (const [which, rev] of [["old", oldRev], ["new", newRev]] as const)
      for (const level of LEVELS) for (let n = 0; n < SEEDS; n++) runs.push(await e4Run(type, rev, level, n, which));
    console.error(`${type}: ${runs.filter((r) => r.type === type).length} runs in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }
  console.log(`\n${"game".padEnd(9)} ${"rev".padEnd(8)} ${LEVELS.map((l) => LEVEL_LABEL[l].padEnd(18)).join(" ")}`);
  console.log(`${"".padEnd(18)} ${LEVELS.map(() => "median / p90 / best".padEnd(18)).join(" ")}`);
  for (const type of types)
    for (const which of ["old", "new"] as const) {
      const rev = runs.find((r) => r.type === type && r.which === which)?.rev;
      const cells = LEVELS.map((level) => {
        const s = runs.filter((r) => r.type === type && r.which === which && r.level === level).map((r) => r.score);
        return `${quantile(s, 0.5)} / ${quantile(s, 0.9)} / ${Math.max(...s)}`.padEnd(18);
      });
      console.log(`${type.padEnd(9)} ${`${which} ${rev}`.padEnd(8)} ${cells.join(" ")}`);
    }
  if (SHOW_UNITS)
    for (const type of types) {
      console.log(`\n${type} new-revision units (p10 / median / p90 / best):`);
      for (const level of LEVELS) {
        const u = runs.filter((r) => r.type === type && r.which === "new" && r.level === level).map((r) => r.units);
        console.log(`  ${LEVEL_LABEL[level].padEnd(14)} ${quantile(u, 0.1)} / ${quantile(u, 0.5)} / ${quantile(u, 0.9)} / ${Math.max(...u)}`);
      }
    }
  const bad = runs.filter((r) => r.flagged || r.mismatch);
  if (bad.length) console.log(`\nWARNING: ${bad.length} run(s) flagged or disagreeing with the server replay (${bad[0]!.type} ${bad[0]!.which} ${bad[0]!.level})`);
  if (JSON_PATH) writeFileSync(JSON_PATH, JSON.stringify(runs.map(({ raw: _r, ...rest }) => rest)));
}

if (import.meta.main) await main();
