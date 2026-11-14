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
 *  - checks.yml runs tsc --noEmit over src/ in its own typecheck job (7 Nov 2026).
 *  - checks.yml runs the production build (`bun run build`, as the Cloudflare deploy) in its own build job, beside
 *    the shards (needs nothing), on placeholder public Supabase values and no secrets (9 Nov 2026).
 *  - The checks split for full depth (FULL_DEPTH_SPLITS in shards.ts, 10 Nov 2026) are listed as exactly their parts.
 *  - checks-full-weekly.yml (10 Nov 2026) runs the fast shards at full depth (CHECKS_FULL=1) on a schedule, never on a
 *    pull request and with no browser, and its report job (full-depth-report.ts) runs whatever the shards did.
 *  - theme-check and no-wrap-check (PAGE_CHECK_SPLITS, 14 Nov 2026) run only on their own jobs, as exactly their parts;
 *    the parts of today's draws together are exactly the whole run, none twice; no part passes its draw ceiling; and
 *    every area screen file in scripts/screens/ loads in the agreed shape.
 *
 *   bun scripts/ci-shards-check.ts
 */
import { readFileSync } from "node:fs";

import { allCheckFiles, isBrowserCheck } from "../.github/ci/browser";
import { base, shardPlan } from "../.github/ci/plan";
import { BROWSER_CATCH_ALL, CATCH_ALL, CI_SKIP, FULL_DEPTH_SPLITS, OPTIONAL, PAGE_CHECK_SPLITS, SHARDS, isBrowserShard, pageCheckJobs } from "../.github/ci/shards";
import { allNoWrapDraws, allThemeCheckDraws, areaFiles, areaScreens } from "./area-screens";
import { THEME_SCREENS, partOf } from "./theme-screens";
import { readFileSync as readSource } from "node:fs";

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

/* 1b. The checks split for full depth (FULL_DEPTH_SPLITS): listed in SHARDS as exactly their n parts, never whole. */
const listed = Object.values(SHARDS).flat();
for (const [f, n] of Object.entries(FULL_DEPTH_SPLITS)) {
  check(routine.includes(f), `full-depth split ${f} is a routine check`);
  const mine = listed.filter((e) => base(e) === f);
  check(mine.length === n && Array.from({ length: n }, (_, i) => `${f}@${i + 1}/${n}`).every((e) => mine.includes(e)), `full-depth split ${f}: listed as its ${n} parts (${mine.join(", ") || "not listed"})`);
  check(/--part=/.test(readSource(`scripts/${f}`, "utf8")), `full-depth split ${f} takes --part`);
}

/* 1c. theme-check and no-wrap-check on their own jobs, split by draw count at run time.
 * Changed with Joe's approval, 14 Nov 2026 (check plumbing): these proofs moved with the two checks onto their own jobs
 * (PAGE_CHECK_SPLITS in shards.ts); the guarantees above (every part once, nothing skipped, nothing twice) still hold. */
const jobs = pageCheckJobs();
for (const [f, { parts, jobs: jobCount, prefix }] of Object.entries(PAGE_CHECK_SPLITS)) {
  check(routine.includes(f) && isBrowserCheck(f), `page check ${f} is a routine browser check`);
  const mine = Object.entries(SHARDS).flatMap(([shard, list]) => list.filter((e) => base(e) === f).map((e) => [shard, e] as const));
  check(mine.length === parts && Array.from({ length: parts }, (_, i) => `${f}@${i + 1}/${parts}`).every((e) => mine.some(([, x]) => x === e)), `${f}: listed as exactly its ${parts} parts`);
  check(mine.every(([shard]) => shard.startsWith(`${prefix}-`) && shard in jobs), `${f}: every part on its own ${prefix}-* jobs, never on a shared play job (${mine.filter(([sh]) => !sh.startsWith(`${prefix}-`)).map(([sh, e]) => `${e} on ${sh}`).join(", ") || "ok"})`);
  check(Object.keys(jobs).filter((j) => j.startsWith(`${prefix}-`)).length === jobCount, `${f}: ${jobCount} jobs`);
  check(Object.keys(SHARDS).filter((sh) => sh.startsWith(`${prefix}-`)).every((sh) => SHARDS[sh]!.every((e) => base(e) === f)), `${prefix}-* jobs run only ${f}`);
}
// The draws as the checks work them out (core list, then every area file): the parts cover the whole run exactly once,
// and none is near its time limit.
const areas = await areaScreens();
check(areas.length === areaFiles().length && areas.every((a) => a.screens.length > 0), `every scripts/screens/ area file loads in the agreed shape (${areas.map((a) => `${a.file} ${a.screens.length}`).join(", ")})`);
const names = [...THEME_SCREENS, ...areas.flatMap((a) => a.screens)].map((sc) => sc.name);
const dupes = names.filter((n, i) => names.indexOf(n) !== i);
check(dupes.length === 0, `screen names are unique across the core list and the area files (${[...new Set(dupes)].join(", ") || "none"})`);
const drawsOf: Record<string, Awaited<ReturnType<typeof allThemeCheckDraws>>> = {
  "theme-check.tsx": await allThemeCheckDraws(),
  "no-wrap-check.tsx": await allNoWrapDraws(),
};
for (const [f, { parts, ceiling }] of Object.entries(PAGE_CHECK_SPLITS)) {
  const all = drawsOf[f]!;
  check(all.length > 0, `${f} has draws`);
  const index = all.map((_, i) => i);
  const seen = Array.from({ length: parts }, (_, k) => partOf(index, [`--part=${k + 1}/${parts}`])).flat();
  check(seen.length === all.length && new Set(seen).size === all.length, `${f}: its ${parts} parts draw every one of its ${all.length} draws exactly once`);
  const sizes = Array.from({ length: parts }, (_, k) => partOf(all, [`--part=${k + 1}/${parts}`]).length);
  const over = sizes.map((n, k) => [k + 1, n] as const).filter(([, n]) => n > ceiling);
  check(
    over.length === 0,
    `${f}: every part at most ${ceiling} draws (today ${Math.min(...sizes)}–${Math.max(...sizes)} of ${all.length}). ` +
      (over.length
        ? `Over: ${over.map(([k, n]) => `part ${k}/${parts} ${n}`).join(", ")}. The screens have grown near the parts' time limit: raise ` +
          `PAGE_CHECK_SPLITS["${f}"].parts (and jobs if needed) in .github/ci/shards.ts. Pre-approved routine consequence (any ` +
          `session or the captain): mark it "Changed with Joe's approval, 14 Nov 2026 (routine: page-check growth)".`
        : "ok"),
  );
  console.log(`  ${f}: ${all.length} draws in ${parts} parts of ${Math.min(...sizes)}–${Math.max(...sizes)} (ceiling ${ceiling})`);
}

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
const weeklyYml = readFileSync(".github/workflows/checks-full-weekly.yml", "utf8");
const matrixOf = (yml: string, name: string) => {
  const m = /shard:\s*\[([^\]]*)\]/.exec(yml);
  check(!!m, `${name} has a shard matrix`);
  return (m?.[1] ?? "").split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
};
const same = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
check(same(matrixOf(fastYml, "checks.yml"), fast), `checks.yml's matrix is the fast shards (${fast.join(", ")})`);
check(same(matrixOf(fullYml, "full-suite.yml"), browser), `full-suite.yml's matrix is the browser shards (${browser.join(", ")})`);
check(!/playwright install/.test(fastYml), "checks.yml installs no browser");
check(/^\s*typecheck:/m.test(fastYml) && /tsc --noEmit -p tsconfig\.json/.test(fastYml), "checks.yml type-checks src/ (tsc --noEmit, its own job)");
const buildJob = /^  build:\n([\s\S]*?)(?=^  [\w-]+:\n|(?![\s\S]))/m.exec(fastYml)?.[1] ?? "";
check(/^\s+- name: bun run build\n[\s\S]*?^\s+bun run build$/m.test(buildJob), "checks.yml runs the production build (bun run build, its own job)");
check(!/^\s+needs:/m.test(buildJob), "the build job runs in parallel with the shards (needs nothing)");
check(/VITE_SUPABASE_URL:\s*https:\/\/\S+\.supabase\.co/.test(buildJob) && /VITE_SUPABASE_PUBLISHABLE_KEY:\s*\S/.test(buildJob) && !/secrets\./.test(buildJob), "the build job uses placeholder public Supabase values, no secrets");
check(/cancel-in-progress:\s*true/.test(fastYml) && /cancel-in-progress:\s*true/.test(fullYml), "both workflows cancel superseded runs");
check(/full-suite-passed/.test(fullYml) && /needs:\s*\[[^\]]*\bshards\b[^\]]*\]/.test(fullYml.split("full-suite-passed:")[1] ?? ""), "full-suite-passed needs the shards");
check(/needs\.shards\.result\s*}}"?\s*=\s*"?success/.test(fullYml) || /needs\.shards\.result == 'success'/.test(fullYml), "full-suite-passed passes only on the shards' success");
check(/ready-to-merge/.test(fullYml) && /ready_for_review/.test(fullYml) && /workflow_dispatch/.test(fullYml) && /schedule:/.test(fullYml), "full-suite.yml runs on the label, leaving draft, by hand and weekly");
check(/labeled/.test(fullYml) && /synchronize/.test(fullYml), "full-suite.yml re-runs on new pushes while labelled");
// The weekly full-depth run on main (10 Nov 2026): the fast shards at CHECKS_FULL=1, never on a PR, one report job.
check(same(matrixOf(weeklyYml, "checks-full-weekly.yml"), fast), `checks-full-weekly.yml's matrix is the fast shards (${fast.join(", ")})`);
check(/schedule:/.test(weeklyYml) && /CHECKS_FULL:\s*"1"/.test(weeklyYml) && !/pull_request/.test(weeklyYml) && !/playwright install/.test(weeklyYml), "checks-full-weekly.yml runs the fast shards at full depth on a schedule, never on a pull request, installing no browser");
check(/full-depth-report\.ts/.test(weeklyYml) && /if: always\(\) && needs\.weekly/.test(weeklyYml), "checks-full-weekly.yml's report job lists every full-depth failure whatever the shards did");

if (failures.length) {
  console.log(`FAIL: ${failures.length} of ${passes + failures.length} checks`);
  process.exit(1);
}
console.log(
  `PASS ci-shards-check: ${passes} checks — ${routine.length} routine checks each run once (${checks.filter((f) => isBrowserCheck(f)).length} browser checks in ${browser.length} full-suite shards, the rest in ${fast.length} fast shards on every push)`,
);
