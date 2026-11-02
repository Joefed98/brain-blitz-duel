/**
 * The measuring tool for Blockfall and Alley Roll (1 Nov 2026; docs/arcade-standard/blockfall.md, alleyroll.md): plays
 * the skill-band bots (scripts/arcade-skill-bands/bots/) weak to flawless on the seeds rooms deal, through the server's
 * replay, and prints each level's median score with p10–p90, its median core units (lines; ring points) and each
 * part's median. Each core is full at the elite median of its units (the brief's "near-flawless").
 *
 *   bun scripts/new-arcade-bands.ts [blockfall alleyroll] [--seeds=60] [--from=0] [--json]
 */
import { ALL_LEVELS, Human, LEVEL_LABEL } from "./arcade-skill-bands/human";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import type { SkillBot } from "./arcade-skill-bands/bot";
import { UNITS } from "./arcade-skill-bands/units";

console.error = () => {};
const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 60);
const FROM = Number(opt("from") ?? 0);
const TYPES = args.filter((a) => !a.startsWith("--"));
const pct = (xs: number[], p: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]! : NaN);

export interface LevelRow {
  level: string;
  median: number;
  p10: number;
  p90: number;
  units: number;
  parts: Record<string, number>;
}

export async function measure(type: string, seeds = SEEDS, from = FROM): Promise<LevelRow[]> {
  const spec = GAME_BY_TYPE.get(type as never)!;
  const { bot } = (await import(`./arcade-skill-bands/bots/${type}.ts`)) as { bot: SkillBot };
  const rows: LevelRow[] = [];
  for (const level of ALL_LEVELS) {
    const scores: number[] = [];
    const units: number[] = [];
    const parts: Record<string, number[]> = {};
    for (let n = from; n < from + seeds; n++) {
      const seed = spec.seedFor(n);
      const game = spec.gameFor(spec.live, seed);
      const out = bot({ game, seed, rev: spec.live, human: new Human(type, seed, level), fixes: true });
      const events = out.events ?? [];
      const raw = spec.encode({ seed, claimedScore: 0, events, endTick: 0, checkpoints: [] }, spec.live, seed);
      const r = spec.replay(seed, raw, spec.live) as { score: number; state: unknown; parts?: { key: string; points: number }[] };
      scores.push(r.score);
      units.push(UNITS[type]!(r.state).u);
      for (const p of r.parts ?? []) (parts[p.key] ??= []).push(p.points);
    }
    rows.push({
      level,
      median: pct(scores, 0.5),
      p10: pct(scores, 0.1),
      p90: pct(scores, 0.9),
      units: pct(units, 0.5),
      parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, pct(v, 0.5)])),
    });
  }
  return rows;
}

if (import.meta.main) {
  for (const type of TYPES.length ? TYPES : ["blockfall", "alleyroll"]) {
    const rows = await measure(type);
    if (args.includes("--json")) {
      console.log(JSON.stringify({ type, seeds: SEEDS, from: FROM, rows }));
      continue;
    }
    console.log(`\n${type}: ${SEEDS} seeds from ${FROM}`);
    console.log("level          median  p10–p90    units  parts (medians)");
    for (const r of rows) {
      const parts = Object.entries(r.parts).map(([k, v]) => `${k} ${v}`).join(" · ");
      console.log(`${LEVEL_LABEL[r.level as keyof typeof LEVEL_LABEL].padEnd(14)} ${String(r.median).padStart(6)}  ${`${r.p10}–${r.p90}`.padEnd(9)}  ${String(r.units).padStart(5)}  ${parts}`);
    }
  }
}
