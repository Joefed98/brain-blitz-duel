/**
 * The elite skill-band report (Oct 2026, docs/arcade-bands-elite.md) from scripts/arcade-skill-bands.ts
 * runs saved with --json. Each input is `<source>=<file>[,<file>…]`: a source (main, or a parked
 * branch) and its runs' files, tuning seeds (n < 10000) and fresh seeds (n ≥ 10000) together.
 *
 *   bun scripts/arcade-bands-elite.ts main=runs/main-tuning.json,runs/main-fresh.json \
 *     claude/e1-parked=runs/e1-tuning.json,runs/e1-fresh.json --out=docs/arcade-bands-elite.data.md
 *
 * Per game: every level's median / top 10 % (the 90th percentile) / zero scores on the tuning and
 * the fresh seeds; the paired steps (each fresh seed played by every level, the median of the per-seed
 * differences between neighbouring levels); the per-seed ceiling (the best any level, the flawless one
 * included, scored on that seed: a floor on what a perfect run could score there) with how many seeds
 * cannot reach the maximum and the lowest; and the merge gates. Script-only: no pass/fail.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { ALL_LEVELS, LEVEL_LABEL, type SkillLevel } from "./arcade-skill-bands/human";
import type { RunRecord } from "./arcade-skill-bands";

export const FRESH_FROM = 10000;

const args = process.argv.slice(2);
const OUT = args.find((a) => a.startsWith("--out="))?.slice(6);
const JSON_OUT = args.find((a) => a.startsWith("--json="))?.slice(7);
const sources = args.filter((a) => !a.startsWith("--")).map((a) => {
  const [name, files] = a.split("=") as [string, string];
  const records: RunRecord[] = [];
  const maxes: Record<string, number> = {};
  for (const f of files.split(",")) {
    const d = JSON.parse(readFileSync(f, "utf8")) as { records: RunRecord[]; maxes?: Record<string, number> };
    records.push(...d.records);
    Object.assign(maxes, d.maxes ?? {});
  }
  return { name, records, maxes };
});

const pct = (xs: number[], q: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  return Math.round(s[lo]! + (s[Math.ceil(pos)]! - s[lo]!) * (pos - lo));
};

export interface LevelRow { level: SkillLevel; median: number; top10: number; zeros: number; n: number }
export interface GameReport {
  source: string;
  type: string;
  rev: number | null;
  max: number;
  tuning: LevelRow[];
  fresh: LevelRow[];
  /** Fresh seeds: median of the per-seed difference between each level and the one below it. */
  steps: { from: SkillLevel; to: SkillLevel; pairedMedian: number; medianGap: number }[];
  ceiling: { seeds: number; belowMax: number; lowest: number; median: number; flawlessMedian: number };
  /** Near-perfect's fresh median as a share of the seeds' ceilings (median of per-seed shares). */
  nearShareOfCeiling: number;
  flags: string[];
}

function rows(recs: RunRecord[]): LevelRow[] {
  return ALL_LEVELS.filter((l) => recs.some((r) => r.level === l)).map((level) => {
    const xs = recs.filter((r) => r.level === level).map((r) => r.score);
    return { level, median: pct(xs, 0.5), top10: pct(xs, 0.9), zeros: xs.filter((x) => x === 0).length, n: xs.length };
  });
}

export function reportGame(source: string, type: string, recs: RunRecord[], max: number): GameReport {
  const tuning = recs.filter((r) => r.n < FRESH_FROM);
  const fresh = recs.filter((r) => r.n >= FRESH_FROM);
  const fr = rows(fresh);
  const byN = new Map<number, Map<SkillLevel, number>>();
  for (const r of recs) {
    if (!byN.has(r.n)) byN.set(r.n, new Map());
    byN.get(r.n)!.set(r.level, r.score);
  }
  const human = ALL_LEVELS.filter((l) => l !== "perfect" && fr.some((x) => x.level === l));
  const steps = human.slice(1).map((to, i) => {
    const from = human[i]!;
    const diffs = [...byN].filter(([n, m]) => n >= FRESH_FROM && m.has(from) && m.has(to)).map(([, m]) => m.get(to)! - m.get(from)!);
    return { from, to, pairedMedian: pct(diffs, 0.5), medianGap: fr.find((x) => x.level === to)!.median - fr.find((x) => x.level === from)!.median };
  });
  const ceilings = [...byN].filter(([n]) => n >= FRESH_FROM).map(([, m]) => Math.max(...m.values()));
  const allCeil = [...byN].map(([, m]) => Math.max(...m.values()));
  const nearShares = [...byN].filter(([n, m]) => n >= FRESH_FROM && m.has("near")).map(([, m]) => m.get("near")! / Math.max(1, Math.max(...m.values())));
  const flags: string[] = [];
  const med = (l: SkillLevel) => fr.find((x) => x.level === l)?.median;
  for (const s of steps) if (!(s.medianGap > 0)) flags.push(`${LEVEL_LABEL[s.to]} median not above ${LEVEL_LABEL[s.from]} (${med(s.from)} → ${med(s.to)})`);
  const good = med("good");
  const near = med("near");
  const elite = med("elite");
  if (good !== undefined && near !== undefined && near - good < 25) flags.push(`good → near-perfect only ${near - good} (under ~25)`);
  if (near !== undefined && elite !== undefined && elite - near < 10) flags.push(`near-perfect → elite only ${elite - near} (under ~10)`);
  return {
    source,
    type,
    rev: recs[0]?.rev ?? null,
    max,
    tuning: rows(tuning),
    fresh: fr,
    steps,
    ceiling: { seeds: ceilings.length, belowMax: ceilings.filter((c) => c < max).length, lowest: Math.min(...allCeil), median: pct(ceilings, 0.5), flawlessMedian: med("perfect") ?? NaN },
    nearShareOfCeiling: pct(nearShares.map((x) => x * 1000), 0.5) / 1000,
    flags,
  };
}

export function gameMarkdown(g: GameReport): string {
  const name = gameDisplayName(g.type as never);
  const out = [`### ${name} (\`${g.type}\`, rev ${g.rev}, max ${g.max}) — ${g.source}`, ""];
  const t = g.tuning[0]?.n ?? 0;
  const f = g.fresh[0]?.n ?? 0;
  out.push(`| Level | Tuning seeds (${t}): median / top 10 % | zeros | Fresh seeds (${f}): median / top 10 % | zeros |`, "|---|---|---|---|---|");
  for (const level of ALL_LEVELS) {
    const a = g.tuning.find((r) => r.level === level);
    const b = g.fresh.find((r) => r.level === level);
    if (!a && !b) continue;
    out.push(`| ${LEVEL_LABEL[level]}${level === "perfect" ? " (ceiling bot)" : ""} | ${a ? `${a.median} / ${a.top10}` : "–"} | ${a?.zeros ?? "–"} | ${b ? `${b.median} / ${b.top10}` : "–"} | ${b?.zeros ?? "–"} |`);
  }
  out.push("");
  out.push(`Paired steps on the fresh seeds (median of per-seed differences): ${g.steps.map((s) => `${LEVEL_LABEL[s.from]} → ${LEVEL_LABEL[s.to]} ${s.pairedMedian >= 0 ? "+" : ""}${s.pairedMedian}`).join(", ")}.`);
  out.push(`Per-seed ceiling (best of every level on the seed): median ${g.ceiling.median}, lowest ${g.ceiling.lowest}; ${g.ceiling.belowMax} of ${g.ceiling.seeds} fresh seeds below ${g.max}. Near-perfect scores a median ${Math.round(g.nearShareOfCeiling * 100)} % of its seed's ceiling.`);
  out.push(g.flags.length ? `Flags: ${g.flags.join("; ")}.` : "Flags: none (medians rise level by level, gaps clear).");
  return out.join("\n");
}

if (import.meta.main) {
  const reports: GameReport[] = [];
  for (const src of sources) {
    const types = [...new Set(src.records.map((r) => r.type as string))];
    for (const type of types) reports.push(reportGame(src.name, type, src.records.filter((r) => r.type === type), src.maxes[type] ?? 150));
  }
  const md = reports.map(gameMarkdown).join("\n\n") + "\n";
  if (OUT) writeFileSync(OUT, md);
  else console.log(md);
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(reports, null, 1));
}
