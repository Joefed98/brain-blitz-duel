/**
 * The D5 remodels' tuning table: every bot level (and random spam) on N room-dealt rounds of each game,
 * graded by the server. Prints the table as Markdown and returns it for the checks.
 *
 *   bun scripts/d5-remodels/tuning.ts [rounds]
 */
import { generatePuzzle } from "../../src/lib/duel/generate.server";
import { withSeededRandom } from "../../src/lib/duel/random";
import type { PuzzleData } from "../../src/lib/duel/types";
import { BOT_LABEL, BOT_LEVELS, makeRng, playJumbled, playTopsy, spamJumbled, spamTopsy, type BotLevel, type BotRun } from "./bots";

export interface Row {
  label: string;
  median: number;
  p10: number;
  p90: number;
  mean: number;
  solvedPct: number;
  actions: number;
  extra: string;
}

function pct(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]!;
}

function row(label: string, runs: BotRun[], extra: (r: BotRun[]) => string): Row {
  const scores = runs.map((r) => r.score);
  return {
    label,
    median: pct(scores, 0.5),
    p10: pct(scores, 0.1),
    p90: pct(scores, 0.9),
    mean: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    solvedPct: Math.round((100 * runs.filter((r) => r.solved).length) / runs.length),
    actions: Math.round((10 * runs.reduce((a, r) => a + r.actions, 0)) / runs.length) / 10,
    extra: extra(runs),
  };
}

export function rounds(type: "gravity" | "tiles", count: number, salt = 0): PuzzleData[] {
  return Array.from({ length: count }, (_, i) => withSeededRandom(25_100 + i * 7 + salt, () => generatePuzzle(type, { bankSeed: 25_100 + i })));
}

export function tuning(count: number): { topsy: Row[]; jumbled: Row[] } {
  const tp = rounds("gravity", count);
  const jp = rounds("tiles", count);
  const topsy: Row[] = [];
  const jumbled: Row[] = [];
  const mean = (xs: number[]) => Math.round((10 * xs.reduce((a, b) => a + b, 0)) / Math.max(1, xs.length)) / 10;
  const left = (rs: BotRun[]) => `${Math.round(mean(rs.filter((r) => r.solved).map((r) => r.msRemaining / 1000)))} s left`;
  topsy.push(row("Random spam", tp.map((p, i) => spamTopsy(p, makeRng(9_000 + i))), (rs) => `${mean(rs.map((r) => r.home ?? 0))} home, ${mean(rs.map((r) => r.stars ?? 0))} stars`));
  jumbled.push(row("Random spam", jp.map((p, i) => spamJumbled(p, makeRng(9_000 + i))), () => ""));
  for (const level of BOT_LEVELS as readonly BotLevel[]) {
    const reps = [0, 1, 2];
    const tr = tp.flatMap((p, i) => reps.map((k) => playTopsy(p, level, makeRng(1_000 * k + i + level.length * 31))));
    topsy.push(row(BOT_LABEL[level], tr, (rs) => `${mean(rs.map((r) => r.home ?? 0))} home, ${mean(rs.map((r) => r.stars ?? 0))} stars, ${left(rs)}`));
    const jr = jp.flatMap((p, i) => reps.map((k) => playJumbled(p, level, makeRng(1_000 * k + i + level.length * 31))));
    const par = jp.map((p) => (p as { par: number }).par);
    jumbled.push(row(BOT_LABEL[level], jr, (rs) => `${left(rs)}, at/under par ${Math.round((100 * rs.filter((r, j) => r.solved && r.actions <= par[Math.floor(j / reps.length)]!).length) / rs.length)} %`));
  }
  return { topsy, jumbled };
}

export function table(title: string, rows: Row[]): string {
  const head = `| ${title} | median | p10–p90 | mean | finished | actions | notes |\n| --- | --- | --- | --- | --- | --- | --- |`;
  return [head, ...rows.map((r) => `| ${r.label} | ${r.median} | ${r.p10}–${r.p90} | ${r.mean} | ${r.solvedPct} % | ${r.actions} | ${r.extra} |`)].join("\n");
}

if (import.meta.main) {
  const count = Number(process.argv[2] ?? 30);
  const t0 = performance.now();
  const { topsy, jumbled } = tuning(count);
  console.log(table("Topsy-Turvy (tilts)", topsy));
  console.log();
  console.log(table("Jumbled (slides)", jumbled));
  console.log(`\n${count} rounds each, 3 runs per level per round, ${Math.round((performance.now() - t0) / 1000)} s`);
}
