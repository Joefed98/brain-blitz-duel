/**
 * D5's scoring what-if (a tool, not a check): reads ladder rows with parts (scripts/d5-ladder.ts --json) and re-scores the
 * recorded runs as if each part's full line moved down to a share `f` of today's (play unchanged: a scoring-only stamp).
 * A part of today's points p of max m is full on the new line when p / m ≥ f (a straight line scales; speed and "each"
 * parts are read the same way, an approximation). For each game it finds the smallest common f at which the realistic
 * elite reaches 200 on at least `target` of Normal runs, and prints every level's average and elite under it.
 *
 *   bun scripts/d5-whatif.ts <rows.jsonl…> [--target=0.5]
 */
import { readFileSync } from "node:fs";

interface Part { label: string; points: number; max: number }
interface Row { game: string; level: string; bot: string; scores: number[]; parts: (Part[] | null)[] }

const args = process.argv.slice(2);
const target = Number(args.find((a) => a.startsWith("--target="))?.slice(9) ?? 0.5);
const files = args.filter((a) => !a.startsWith("--"));
const rows: Row[] = files.flatMap((f) => readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as Row));

/** Each part's new full line as a share of today's (by label; 1 = unchanged). */
type Lines = Record<string, number>;
/** A run re-scored with each part's full line at its share of today's (the penalty, today's sum less the score, kept). */
function rescore(score: number, parts: Part[] | null, f: number | Lines): number {
  if (!parts) return score;
  const sum = parts.reduce((a, p) => a + p.points, 0);
  const penalty = Math.max(0, sum - score);
  const now = parts.reduce((a, p) => {
    const k = typeof f === "number" ? f : (f[p.label] ?? 1);
    return a + (p.max ? Math.min(p.max, Math.floor(p.points / Math.max(0.05, k))) : 0);
  }, 0);
  return Math.max(score > 0 ? 1 : 0, Math.min(200, now - penalty));
}
/** The q-quantile of each part's share (points ÷ max) over a row's runs. */
function quantileLines(row: Row, q: number): Lines {
  const by = new Map<string, number[]>();
  row.parts.forEach((ps) => ps?.forEach((p) => by.set(p.label, [...(by.get(p.label) ?? []), p.max ? p.points / p.max : 1])));
  const out: Lines = {};
  for (const [l, xs] of by) {
    const s = [...xs].sort((a, b) => a - b);
    out[l] = Math.min(1, Math.max(0.05, s[Math.min(s.length - 1, Math.floor(q * s.length))]!));
  }
  return out;
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const at200 = (xs: number[]) => (xs.length ? xs.filter((x) => x >= 200).length / xs.length : 0);

const games = [...new Set(rows.map((r) => r.game))];
const LV = ["easy", "normal", "hard", "expert"];
for (const game of games) {
  const of = (level: string, bot: string) => rows.find((r) => r.game === game && r.level === level && r.bot === bot);
  const n = of("normal", "elite");
  if (!n) continue;
  // Each part's line at the elite's q-quantile share on Normal: the highest q (the least change) that puts the elite at
  // 200 on `target` of Normal runs.
  let q = 1;
  let pick: Lines = {};
  for (let qq = 0.95; qq >= 0.05; qq -= 0.05) {
    q = qq;
    pick = quantileLines(n, qq);
    if (at200(n.scores.map((s, i) => rescore(s, n.parts[i] ?? null, pick))) >= target) break;
  }
  // The same with the core's line (the first part) kept where it is: only the features move.
  const coreLabel = n.parts.find((p) => p)?.[0]?.label;
  let qf = 1;
  let pickF: Lines = {};
  for (let qq = 0.95; qq >= 0.05; qq -= 0.05) {
    qf = qq;
    pickF = { ...quantileLines(n, qq), ...(coreLabel ? { [coreLabel]: 1 } : {}) };
    if (at200(n.scores.map((s, i) => rescore(s, n.parts[i] ?? null, pickF))) >= target) break;
  }
  const line = (f: number | Lines) =>
    LV.map((lv) => {
      const a = of(lv, "average");
      const e = of(lv, "elite");
      const am = a ? mean(a.scores.map((s, i) => rescore(s, a.parts[i] ?? null, f))) : NaN;
      const es = e ? e.scores.map((s, i) => rescore(s, e.parts[i] ?? null, f)) : [];
      return `${lv[0]!.toUpperCase()} ${am.toFixed(0).padStart(3)}/${mean(es).toFixed(0).padStart(3)}/${(at200(es) * 100).toFixed(0).padStart(3)}%`;
    }).join("  ");
  // Which part stops the elite most often on Normal (today).
  const short = new Map<string, number>();
  n.parts.forEach((ps) => ps?.forEach((p) => p.points < p.max && short.set(p.label, (short.get(p.label) ?? 0) + 1)));
  const stops = [...short].sort((a, b) => b[1] - a[1]).map(([l, c]) => `${l} ${Math.round((100 * c) / n.scores.length)}%`).join(", ");
  console.log(`${game.padEnd(10)} today   ${line(1)}`);
  console.log(`${"".padEnd(10)} q=${q.toFixed(2)}  ${line(pick)}   (avg/elite/elite at 200)`);
  console.log(`${"".padEnd(10)} lines at: ${Object.entries(pick).filter(([, v]) => v < 0.999).map(([l, v]) => `${l} ${(v * 100).toFixed(0)}%`).join(", ") || "unchanged"}`);
  console.log(`${"".padEnd(10)} q=${qf.toFixed(2)}  ${line(pickF)}   (core kept)`);
  console.log(`${"".padEnd(10)} lines at: ${Object.entries(pickF).filter(([, v]) => v < 0.999).map(([l, v]) => `${l} ${(v * 100).toFixed(0)}%`).join(", ") || "unchanged"}`);
  console.log(`${"".padEnd(10)} short on Normal (elite): ${stops}`);
}
