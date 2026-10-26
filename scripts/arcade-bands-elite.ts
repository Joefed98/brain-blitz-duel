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
export interface SetReport {
  rows: LevelRow[];
  /** Median of the per-seed difference between each level and the one below it (the same seeds). */
  steps: { from: SkillLevel; to: SkillLevel; paired: number }[];
  /** Per-seed ceiling: the best any level (the flawless bot included) scored on that seed. */
  ceiling: { seeds: number; belowMax: number; lowest: number; median: number };
  /** Median over seeds of near-perfect's score as a share of the seed's ceiling. */
  nearShare: number;
}
export interface GameReport {
  source: string;
  type: string;
  rev: number | null;
  max: number;
  tuning: SetReport;
  fresh: SetReport;
  flags: string[];
}

const HUMAN: SkillLevel[] = ALL_LEVELS.filter((l) => l !== "perfect");

function setReport(recs: RunRecord[], max: number): SetReport {
  const rows = ALL_LEVELS.filter((l) => recs.some((r) => r.level === l)).map((level) => {
    const xs = recs.filter((r) => r.level === level).map((r) => r.score);
    return { level, median: pct(xs, 0.5), top10: pct(xs, 0.9), zeros: xs.filter((x) => x === 0).length, n: xs.length };
  });
  const byN = new Map<number, Map<SkillLevel, number>>();
  for (const r of recs) {
    if (!byN.has(r.n)) byN.set(r.n, new Map());
    byN.get(r.n)!.set(r.level, r.score);
  }
  const human = HUMAN.filter((l) => rows.some((x) => x.level === l));
  const steps = human.slice(1).map((to, i) => {
    const from = human[i]!;
    const diffs = [...byN.values()].filter((m) => m.has(from) && m.has(to)).map((m) => m.get(to)! - m.get(from)!);
    return { from, to, paired: pct(diffs, 0.5) };
  });
  const ceilings = [...byN.values()].map((m) => Math.max(...m.values()));
  const shares = [...byN.values()].filter((m) => m.has("near")).map((m) => (1000 * m.get("near")!) / Math.max(1, Math.max(...m.values())));
  return {
    rows,
    steps,
    ceiling: { seeds: ceilings.length, belowMax: ceilings.filter((c) => c < max).length, lowest: ceilings.length ? Math.min(...ceilings) : NaN, median: pct(ceilings, 0.5) },
    nearShare: pct(shares, 0.5) / 1000,
  };
}

export const medianOf = (set: SetReport, level: SkillLevel) => set.rows.find((r) => r.level === level)?.median;
export const top10Of = (set: SetReport, level: SkillLevel) => set.rows.find((r) => r.level === level)?.top10;

export function reportGame(source: string, type: string, recs: RunRecord[], max: number): GameReport {
  const tuning = setReport(recs.filter((r) => r.n < FRESH_FROM), max);
  const fresh = setReport(recs.filter((r) => r.n >= FRESH_FROM), max);
  const flags: string[] = [];
  for (const [name, set] of [["tuning", tuning], ["fresh", fresh]] as const) {
    if (!set.rows.length) continue;
    for (let i = 1; i < HUMAN.length; i++) {
      const a = medianOf(set, HUMAN[i - 1]!);
      const b = medianOf(set, HUMAN[i]!);
      if (a !== undefined && b !== undefined && !(b > a)) flags.push(`${name}: ${LEVEL_LABEL[HUMAN[i]!]} median not above ${LEVEL_LABEL[HUMAN[i - 1]!]} (${a} → ${b})`);
    }
  }
  const good = medianOf(fresh, "good");
  const near = medianOf(fresh, "near");
  const elite = medianOf(fresh, "elite");
  if (good !== undefined && near !== undefined && near - good < 25) flags.push(`fresh: good → near-perfect only ${near - good} (under ~25)`);
  if (near !== undefined && elite !== undefined && elite - near < 10) flags.push(`fresh: near-perfect → elite only ${elite - near} (under ~10)`);
  return { source, type, rev: recs[0]?.rev ?? null, max, tuning, fresh, flags };
}

/** The 200-point merge gates (docs/scoring-200.md, the overnight queue's bar); `before` is the old revision's good median per set. */
export function gates(g: GameReport, before?: { tuning?: number; fresh?: number }): string[] {
  const out: string[] = [];
  for (const [name, set] of [["tuning", g.tuning], ["fresh", g.fresh]] as const) {
    const good = medianOf(set, "good");
    const old = before?.[name];
    if (good !== undefined && old) out.push(`${name} good ${good} vs ${old} before (${good >= old * 0.9 && good <= old * 1.1 ? "within" : "outside"} ±10 %)`);
    const near = medianOf(set, "near");
    const nearTop = top10Of(set, "near");
    if (near !== undefined) out.push(`${name} near-perfect ${near} / top 10 % ${nearTop} (${near >= 165 && near <= 175 && (nearTop ?? 999) <= 185 ? "meets" : "misses"} 165–175, ≤ 185)`);
    const elite = medianOf(set, "elite");
    const eliteTop = top10Of(set, "elite");
    if (elite !== undefined) out.push(`${name} elite ${elite} / top 10 % ${eliteTop} (${elite >= 175 && (eliteTop ?? 0) >= 190 ? "meets" : "misses"} median ≥ 175, top 10 % 190–200)`);
    const zeros = set.rows.filter((r) => (r.level === "weak" || r.level === "average") && r.zeros > 0).map((r) => `${LEVEL_LABEL[r.level]} ${r.zeros}`);
    if (set.rows.length) out.push(`${name} zeros (weak/average): ${zeros.length ? zeros.join(", ") : "none"}`);
  }
  return out;
}

/**
 * Whether any one rising payout (a nondecreasing remap of today's scores, the same on both seed sets)
 * could meet every score gate at once: good within ±10 % of before, near-perfect median 165–175 and top
 * 10 % ≤ 185, elite median ≥ 175 and top 10 % 190–200. If not, no retune of this revision's payout can
 * pass, whatever its shape (zero scores aside, which no payout lifts). A remap of the score is coarser
 * than a refit of the raw units (scores tied at a cap stay tied), so "feasible" is necessary, not
 * sufficient: it can need a steep stretch over a few points.
 */
export function remapFeasible(g: GameReport, before?: { tuning?: number; fresh?: number }): { feasible: boolean; why: string } {
  const pts: [number, number, number, string][] = [];
  for (const [name, set] of [["tuning", g.tuning], ["fresh", g.fresh]] as const) {
    const b = before?.[name];
    const good = medianOf(set, "good");
    if (b && good !== undefined) pts.push([good, 0.9 * b, 1.1 * b, `${name} good`]);
    const add = (x: number | undefined, lo: number, hi: number, what: string) => x !== undefined && pts.push([x, lo, hi, `${name} ${what}`]);
    add(medianOf(set, "near"), 165, 175, "near-perfect median");
    add(top10Of(set, "near"), 0, 185, "near-perfect top 10 %");
    add(medianOf(set, "elite"), 175, 200, "elite median");
    add(top10Of(set, "elite"), 190, 200, "elite top 10 %");
  }
  const xs = [...new Set(pts.map((p) => p[0]))].sort((a, b) => a - b);
  let floor = 0;
  for (const x of xs) {
    const here = pts.filter((p) => p[0] === x);
    floor = Math.max(floor, ...here.map((p) => p[1]));
    const ceil = Math.min(...here.map((p) => p[2]));
    if (floor > ceil) return { feasible: false, why: `a score of ${x} would have to pay at least ${Math.round(floor)} and at most ${ceil} (${here.map((p) => p[3]).join(", ")})` };
  }
  return { feasible: true, why: "" };
}

function stepsLine(set: SetReport): string {
  return set.steps.map((s) => `${LEVEL_LABEL[s.from]} → ${LEVEL_LABEL[s.to]} ${s.paired >= 0 ? "+" : ""}${s.paired}`).join(", ");
}

export function gameMarkdown(g: GameReport, before?: { tuning?: number; fresh?: number }): string {
  const name = gameDisplayName(g.type as never);
  const out = [`### ${name} (\`${g.type}\` rev ${g.rev}, max ${g.max}; ${g.source})`, ""];
  const t = g.tuning.rows[0]?.n ?? 0;
  const f = g.fresh.rows[0]?.n ?? 0;
  out.push(`| Level | Tuning (${t} seeds): median / top 10 % | zeros | Fresh (${f} seeds): median / top 10 % | zeros |`, "|---|---|---|---|---|");
  for (const level of ALL_LEVELS) {
    const a = g.tuning.rows.find((r) => r.level === level);
    const b = g.fresh.rows.find((r) => r.level === level);
    if (!a && !b) continue;
    out.push(`| ${LEVEL_LABEL[level]}${level === "perfect" ? " (ceiling bot)" : ""} | ${a ? `${a.median} / ${a.top10}` : "–"} | ${a?.zeros ?? "–"} | ${b ? `${b.median} / ${b.top10}` : "–"} | ${b?.zeros ?? "–"} |`);
  }
  out.push("");
  out.push(`- Paired steps (median of per-seed differences), tuning: ${stepsLine(g.tuning)}; fresh: ${stepsLine(g.fresh)}.`);
  for (const [nm, set] of [["tuning", g.tuning], ["fresh", g.fresh]] as const)
    if (set.ceiling.seeds) out.push(`- Ceiling, ${nm} seeds: median ${set.ceiling.median}, lowest ${set.ceiling.lowest}; ${set.ceiling.belowMax} of ${set.ceiling.seeds} seeds below ${g.max}. Near-perfect scores a median ${Math.round(set.nearShare * 100)} % of its seed's ceiling.`);
  if (g.max > 150) {
    out.push(`- Gates: ${gates(g, before).join("; ")}.`);
    const r = remapFeasible(g, before);
    out.push(`- Any one rising payout meeting every score gate on both seed sets: ${r.feasible ? "exists (it may need a steep stretch)" : `none: ${r.why}`}.`);
  }
  out.push(`- Flags: ${g.flags.length ? g.flags.join("; ") : "none (medians rise level by level; good → near-perfect ≥ 25, near-perfect → elite ≥ 10)"}.`);
  return out.join("\n");
}

export function summaryRow(g: GameReport): string {
  const m = (l: SkillLevel) => medianOf(g.fresh, l) ?? "–";
  return `| ${gameDisplayName(g.type as never)} | ${g.source} | ${g.max} | ${HUMAN.map(m).join(" / ")} | ${medianOf(g.fresh, "perfect") ?? "–"} | ${g.fresh.ceiling.belowMax} / ${g.fresh.ceiling.lowest} | ${g.flags.length ? g.flags.map((f) => f.replace(/^fresh: |^tuning: /, (x) => x)).join("; ") : "–"} |`;
}

if (import.meta.main) {
  const reports: GameReport[] = [];
  for (const src of sources) {
    const types = [...new Set(src.records.map((r) => r.type as string))];
    for (const type of types) reports.push(reportGame(src.name, type, src.records.filter((r) => r.type === type), src.maxes[type] ?? 150));
  }
  // "Before" for a parked game's good gate: main's run of the same game (main deals the score-band revision the expansion replaces).
  const beforeOf = (g: GameReport) => {
    const m = reports.find((x) => x.source === "main" && x.type === g.type);
    return g.source !== "main" && m ? { tuning: medianOf(m.tuning, "good"), fresh: medianOf(m.fresh, "good") } : undefined;
  };
  const md = [
    "| Game | Source | Max | Fresh medians: weak / average / good / great / near / elite | Flawless | Seeds below max / lowest ceiling | Flags |",
    "|---|---|---|---|---|---|---|",
    ...reports.map(summaryRow),
    "",
    ...reports.map((g) => gameMarkdown(g, beforeOf(g)) + "\n"),
  ].join("\n");
  if (OUT) writeFileSync(OUT, md);
  else console.log(md);
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(reports.map((g) => ({ ...g, gates: g.max > 150 ? gates(g, beforeOf(g)) : [], remap: g.max > 150 ? remapFeasible(g, beforeOf(g)) : null })), null, 1));
}
