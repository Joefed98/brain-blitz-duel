/**
 * Records the history fixture for the nine games retired on 13 Nov 2026 (scripts/fixtures/retired-history.json.gz)
 * from a checkout of main before the retirement: for each game, stored rounds (Gradient, Turntable, Blackout and Bang On
 * from scripts/fixtures/puzzle-score-legacy.json.gz; Mixed Signals, Slice, Ringer, Swish and Flightpath from
 * scripts/fixtures/replay-runs.json) with the grade main's server gives them (score, verdict, the stored extra's
 * digest). retirement-check grades every one on today's tree and fails on any difference: history stays true.
 *
 *   git worktree add ../main-ret <main commit> && ln -s "$PWD/node_modules" ../main-ret/node_modules
 *   bun scripts/retired-history-record.ts ../main-ret
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";

const root = resolve(process.argv[2] ?? ".");
const imp = (p: string) => import(`${root}/${p}`) as Promise<any>;
console.error = () => {};
console.warn = () => {};

await imp("src/lib/duel/wordfallDict.server.ts");
const { gradeAnswer } = await imp("src/lib/duel/generate.server.ts");
export const NINE = ["stroop", "tiles", "rings", "lightsout", "stopwatch", "slice", "alleyroll", "bintoss", "bullseye"];
const PUZZLES = ["tiles", "rings", "lightsout", "stopwatch"];
const PER_GAME = 12;

const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v ?? null).replace(/"replayMs":[\d.]+,?/g, "")).digest("hex").slice(0, 20);
type Round = { type: string; label: string; puzzle: unknown; answer: string; ms: number; score: number; isCorrect: boolean; extra: string };
const rounds: Round[] = [];
const legacy = JSON.parse(gunzipSync(readFileSync(`${root}/scripts/fixtures/puzzle-score-legacy.json.gz`)).toString("utf8")) as {
  cases: { type: string; label: string; puzzle: any; entries: { answer: string; ms: number }[] }[];
};
for (const type of PUZZLES) {
  const entries = legacy.cases.filter((c) => c.type === type).flatMap((c) => c.entries.map((e) => ({ c, e })));
  const step = Math.max(1, Math.floor(entries.length / PER_GAME));
  for (let i = 0; i < entries.length && rounds.filter((r) => r.type === type).length < PER_GAME; i += step) {
    const { c, e } = entries[i]!;
    const g = gradeAnswer(c.puzzle, e.answer, e.ms);
    rounds.push({ type, label: `${c.label} #${i}`, puzzle: c.puzzle, answer: e.answer, ms: e.ms, score: g.score, isCorrect: g.isCorrect, extra: digest(g.extra) });
  }
}
const runs = JSON.parse(readFileSync(`${root}/scripts/fixtures/replay-runs.json`, "utf8")).runs as { type: string; label: string; puzzle: any; answer: string; score: number }[];
for (const run of runs.filter((r) => NINE.includes(r.type) && !PUZZLES.includes(r.type))) {
  const g = gradeAnswer(run.puzzle, run.answer, 0);
  rounds.push({ type: run.type, label: run.label, puzzle: run.puzzle, answer: run.answer, ms: 0, score: g.score, isCorrect: g.isCorrect, extra: digest(g.extra) });
}
const commit = execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim();
writeFileSync("scripts/fixtures/retired-history.json.gz", gzipSync(JSON.stringify({ recordedOn: commit, rounds })));
console.log(`recorded ${rounds.length} stored rounds of the nine games on ${commit}`);
