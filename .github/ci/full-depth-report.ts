/**
 * CI only (checks-full-weekly.yml's report job): reads every fast shard's run-checks results (ci-results/<shard>.json,
 * downloaded from the shard jobs' artifacts into the directory given) and writes one table of what failed at full
 * depth to the job summary, with an error annotation per failing check so the run's page lists them at the top.
 * Exits non-zero when any check failed or timed out, or a shard left no results (its job failed before writing them).
 *
 *   bun .github/ci/full-depth-report.ts <results dir>
 */
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { isBrowserShard, SHARDS } from "./shards";

type Result = { file: string; status: "pass" | "fail" | "timeout"; ms: number };

const dir = process.argv[2] ?? "ci-results";
const fast = Object.keys(SHARDS).filter((s) => !isBrowserShard(s));

/** Every <shard>.json under the directory (artifacts download into one folder each). */
const found = new Map<string, string>();
const walk = (d: string) => {
  if (!existsSync(d)) return;
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith(".json")) found.set(name.slice(0, -5), p);
  }
};
walk(dir);

const bad: { shard: string; file: string; status: string; ms: number }[] = [];
const missing: string[] = [];
let total = 0;
for (const shard of fast) {
  const p = found.get(shard);
  if (!p) {
    missing.push(shard);
    continue;
  }
  const results = (JSON.parse(readFileSync(p, "utf8")) as { results: Result[] }).results;
  total += results.length;
  for (const r of results) if (r.status !== "pass") bad.push({ shard, file: r.file, status: r.status, ms: r.ms });
}

const lines = ["## Full-depth checks on main (weekly)", ""];
if (!bad.length && !missing.length) lines.push(`**All ${total} checks passed at full depth** (shards ${fast.join(", ")}).`);
else {
  lines.push(`**${bad.length} check${bad.length === 1 ? "" : "s"} failed at full depth${missing.length ? `; ${missing.length} shard${missing.length === 1 ? "" : "s"} left no results` : ""}.**`, "");
  if (bad.length) {
    lines.push("| Check | Result | Shard | Time |", "| --- | --- | --- | --- |");
    for (const b of bad) lines.push(`| ${b.file} | ${b.status === "timeout" ? "⏱️ timeout" : "❌ fail"} | ${b.shard} | ${(b.ms / 1000).toFixed(1)} s |`);
    lines.push("", "Each shard's own summary has its full table, and its log artifact (check-logs-<shard>) the output.");
  }
  if (missing.length) lines.push("", `No results from shard${missing.length === 1 ? "" : "s"} ${missing.join(", ")}: the job stopped before run-checks wrote them (see its log).`);
}
lines.push("");
const summary = lines.join("\n");
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(summary);
for (const b of bad) console.log(`::error title=Full-depth check ${b.status === "timeout" ? "timed out" : "failed"}::${b.file} (shard ${b.shard}, ${(b.ms / 1000).toFixed(0)} s)`);
for (const s of missing) console.log(`::error title=Full-depth shard left no results::shard ${s}`);
process.exit(bad.length || missing.length ? 1 : 0);
