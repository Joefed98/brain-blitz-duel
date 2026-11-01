/**
 * CI only: runs one shard of the check suite through scripts/run-checks.ts
 * (same timeouts and FAIL detection as a local run) and writes a per-check
 * pass/fail table to the GitHub job summary.
 *
 *   bun .github/ci/run-shard.ts <shard>
 *
 * Shard lists live in shards.ts; which files a shard runs is plan.ts. Any check file
 * that no shard lists (a newly added check) runs in a catch-all: g if it starts no
 * browser, play21 if it does (1 Nov 2026: fast shards run on every push in checks.yml,
 * play* shards at ready-to-merge in full-suite.yml), so nothing is ever silently skipped.
 * An entry `<file>@<k>/<n>` runs that check's part k of n (run-checks passes
 * --part). CHECKS_FULL=1 in the environment (the manual "full" run) reaches every
 * check through run-checks.
 */
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { shardPlan } from "./plan";
import { BROWSER_CATCH_ALL, CATCH_ALL, CI_SKIP, SHARDS } from "./shards";

type Result = { file: string; status: "pass" | "fail" | "timeout"; ms: number };

const shard = process.argv[2];
if (!shard || !(shard in SHARDS)) {
  console.error(`usage: bun .github/ci/run-shard.ts <${Object.keys(SHARDS).join("|")}>`);
  process.exit(2);
}

// Fast shards run only checks that start no browser; browser checks run in the play* shards (full-suite.yml).
const { files, notYet, unassigned, movedToBrowser, stale } = shardPlan(shard);

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

const depth = process.env.CHECKS_FULL === "1" ? "full depth" : "quick depth";
const lines = [`## Checks — ${shard} (${depth})`, "", "| Check | Result | Time |", "| --- | --- | --- |"];
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
if ((shard === CATCH_ALL || shard === BROWSER_CATCH_ALL) && unassigned.length)
  lines.push("", `Not listed in this shard in .github/ci/shards.ts, ran here: ${unassigned.join(", ")}.`);
if (movedToBrowser.length)
  lines.push(
    "",
    `Browser checks listed here, run in ${BROWSER_CATCH_ALL} (full suite, at ready-to-merge) instead: ${movedToBrowser.join(", ")}.`,
  );
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
