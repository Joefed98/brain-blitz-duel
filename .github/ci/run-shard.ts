/**
 * CI only: runs one shard of the check suite through scripts/run-checks.ts
 * (same timeouts and FAIL detection as a local run) and writes a per-check
 * pass/fail table to the GitHub job summary.
 *
 *   bun .github/ci/run-shard.ts <shard>
 *
 * Shard lists live in shards.ts. Any check file that no shard lists (a newly
 * added check) runs in the catch-all shard, so nothing is ever silently skipped.
 */
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { CATCH_ALL, CI_SKIP, OPTIONAL, SHARDS } from "./shards";

type Result = { file: string; status: "pass" | "fail" | "timeout"; ms: number };

const shard = process.argv[2];
if (!shard || !(shard in SHARDS)) {
  console.error(`usage: bun .github/ci/run-shard.ts <${Object.keys(SHARDS).join("|")}>`);
  process.exit(2);
}

const allChecks = readdirSync("scripts")
  .filter((f) => /-check\.tsx?$/.test(f))
  .sort();
const listed = new Set(Object.values(SHARDS).flat());
const stale = [...listed, ...Object.keys(CI_SKIP)].filter((f) => !allChecks.includes(f));
const notYet = SHARDS[shard].filter((f) => !allChecks.includes(f));
const unassigned = allChecks.filter(
  (f) => !listed.has(f) && !OPTIONAL.includes(f) && !(f in CI_SKIP),
);
const files = [...SHARDS[shard], ...(shard === CATCH_ALL ? unassigned : [])].filter(
  (f) => allChecks.includes(f) && !(f in CI_SKIP),
);

mkdirSync("ci-results", { recursive: true });
const jsonPath = `ci-results/${shard}.json`;

const code: number =
  files.length === 0
    ? 0
    : await new Promise((resolve) => {
        const child = spawn("bun", ["scripts/run-checks.ts", `--json=${jsonPath}`, ...files], {
          stdio: "inherit",
        });
        child.on("close", (c) => resolve(c ?? 1));
      });

const results: Result[] = existsSync(jsonPath)
  ? JSON.parse(readFileSync(jsonPath, "utf8")).results
  : [];
const byFile = new Map(results.map((r) => [r.file, r]));
const icon = { pass: "✅ pass", fail: "❌ fail", timeout: "⏱️ timeout" } as const;

const lines = [`## Checks — ${shard}`, "", "| Check | Result | Time |", "| --- | --- | --- |"];
for (const f of files) {
  const r = byFile.get(f);
  lines.push(
    r
      ? `| ${f} | ${icon[r.status]} | ${(r.ms / 1000).toFixed(1)} s |`
      : `| ${f} | ❌ not run (runner stopped early) | — |`,
  );
}
for (const r of results)
  if (!files.includes(r.file))
    lines.push(`| ${r.file} | ${icon[r.status]} | ${(r.ms / 1000).toFixed(1)} s |`);
for (const f of notYet) lines.push(`| ${f} | ⏭️ skipped (not in this branch yet) | — |`);
const passed = results.filter((r) => r.status === "pass").length;
lines.push("", `**${passed} of ${files.length} passed.**`);
if (shard === CATCH_ALL && unassigned.length)
  lines.push("", `Not listed in .github/ci/shards.ts, ran here: ${unassigned.join(", ")}.`);
if (shard === CATCH_ALL && Object.keys(CI_SKIP).length) {
  lines.push("", "Skipped in CI:");
  for (const [f, why] of Object.entries(CI_SKIP)) lines.push(`- ${f}: ${why}`);
}
if (shard === CATCH_ALL && stale.length)
  lines.push(
    "",
    `Listed in shards.ts but not in this branch (not yet landed, or removed): ${stale.join(", ")}.`,
  );
lines.push("");

const summary = lines.join("\n");
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(`\n${summary}`);

const missing = files.filter((f) => !byFile.has(f));
process.exit(code !== 0 || missing.length ? 1 : 0);
