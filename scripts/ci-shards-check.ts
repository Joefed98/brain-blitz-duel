/**
 * ci-shards-check (1 Nov 2026, CI cost cut): proves the CI split runs every check, once, on the right side.
 *
 *  - Every routine check (scripts/*-check.ts(x), less OPTIONAL and CI_SKIP) runs in exactly one shard, and a check
 *    split into parts (`file@k/n`) has every part 1..n exactly once.
 *  - No check that starts a browser (.github/ci/browser.ts) runs in a fast shard (checks.yml, every push), and every
 *    play* shard (full-suite.yml) runs only browser checks.
 *  - checks.yml's matrix names exactly the fast shards and full-suite.yml's exactly the browser shards; checks.yml
 *    installs no browser; full-suite.yml's "full-suite-passed" needs the shards and passes only on their success
 *    (skipped never counts), and the workflow runs on the ready-to-merge label, on leaving draft, by hand and weekly.
 *
 *   bun scripts/ci-shards-check.ts
 */
import { readFileSync } from "node:fs";

import { allCheckFiles, isBrowserCheck } from "../.github/ci/browser";
import { base, shardPlan } from "../.github/ci/plan";
import { BROWSER_CATCH_ALL, CATCH_ALL, CI_SKIP, OPTIONAL, SHARDS, isBrowserShard } from "../.github/ci/shards";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, label: string) {
  if (ok) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}

const checks = allCheckFiles();
const routine = checks.filter((f) => !OPTIONAL.includes(f) && !(f in CI_SKIP));
const shards = Object.keys(SHARDS);
const fast = shards.filter((s) => !isBrowserShard(s));
const browser = shards.filter(isBrowserShard);

/* 1. Every check once (every part once). */
const runs = new Map<string, string[]>();
for (const s of shards) for (const f of shardPlan(s, checks).files) runs.set(f, [...(runs.get(f) ?? []), s]);
for (const f of routine) {
  const entries = [...runs.keys()].filter((e) => base(e) === f);
  check(entries.length > 0, `${f} runs in some shard`);
  const parts = entries.map((e) => /@(\d+)\/(\d+)$/.exec(e)).filter((m): m is RegExpExecArray => !!m);
  if (parts.length) {
    const n = Number(parts[0]![2]);
    check(parts.every((m) => Number(m[2]) === n) && parts.length === entries.length, `${f}: one part count (${entries.join(", ")})`);
    for (let k = 1; k <= n; k++) check(entries.includes(`${f}@${k}/${n}`), `${f}: part ${k}/${n} runs`);
  }
}
for (const [entry, where] of runs) check(where.length === 1, `${entry} runs in one shard, not ${where.join(", ")}`);

/* 2. Browser checks only in the full suite, and only browser checks there. */
for (const s of fast)
  for (const f of shardPlan(s, checks).files) check(!isBrowserCheck(f), `fast shard ${s} starts no browser (${f})`);
for (const s of browser)
  for (const f of shardPlan(s, checks).files) check(isBrowserCheck(f), `browser shard ${s} runs only browser checks (${f})`);
check(fast.includes(CATCH_ALL) && browser.includes(BROWSER_CATCH_ALL), "the catch-alls are a fast and a browser shard");
check(checks.some((f) => isBrowserCheck(f)) && checks.some((f) => !isBrowserCheck(f)), "the classifier finds both kinds");
check(isBrowserCheck("arcade-play-check.ts") && isBrowserCheck("theme-check.tsx") && isBrowserCheck("offline-check.ts"), "known browser checks are classed as browser");
check(!isBrowserCheck("replay-check.ts") && !isBrowserCheck("link-preview-check.ts"), "known non-browser checks are classed as fast");

/* 3. The workflows. */
const fastYml = readFileSync(".github/workflows/checks.yml", "utf8");
const fullYml = readFileSync(".github/workflows/full-suite.yml", "utf8");
const matrixOf = (yml: string, name: string) => {
  const m = /shard:\s*\[([^\]]*)\]/.exec(yml);
  check(!!m, `${name} has a shard matrix`);
  return (m?.[1] ?? "").split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
};
const same = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
check(same(matrixOf(fastYml, "checks.yml"), fast), `checks.yml's matrix is the fast shards (${fast.join(", ")})`);
check(same(matrixOf(fullYml, "full-suite.yml"), browser), `full-suite.yml's matrix is the browser shards (${browser.join(", ")})`);
check(!/playwright install/.test(fastYml), "checks.yml installs no browser");
check(/cancel-in-progress:\s*true/.test(fastYml) && /cancel-in-progress:\s*true/.test(fullYml), "both workflows cancel superseded runs");
check(/full-suite-passed/.test(fullYml) && /needs:\s*\[[^\]]*\bshards\b[^\]]*\]/.test(fullYml.split("full-suite-passed:")[1] ?? ""), "full-suite-passed needs the shards");
check(/needs\.shards\.result\s*}}"?\s*=\s*"?success/.test(fullYml) || /needs\.shards\.result == 'success'/.test(fullYml), "full-suite-passed passes only on the shards' success");
check(/ready-to-merge/.test(fullYml) && /ready_for_review/.test(fullYml) && /workflow_dispatch/.test(fullYml) && /schedule:/.test(fullYml), "full-suite.yml runs on the label, leaving draft, by hand and weekly");
check(/labeled/.test(fullYml) && /synchronize/.test(fullYml), "full-suite.yml re-runs on new pushes while labelled");

if (failures.length) {
  console.log(`FAIL: ${failures.length} of ${passes + failures.length} checks`);
  process.exit(1);
}
console.log(
  `PASS ci-shards-check: ${passes} checks — ${routine.length} routine checks each run once (${checks.filter((f) => isBrowserCheck(f)).length} browser checks in ${browser.length} full-suite shards, the rest in ${fast.length} fast shards on every push)`,
);
