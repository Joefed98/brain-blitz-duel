/**
 * Fans the 200-seed orbit-rev3-stats run across 8 parallel workers (each a
 * `bun run orbit-rev3-stats.ts start end out.raw.json` child process), then
 * merges their raw per-seed samples back into one combined report at
 * /mnt/documents/orbit-rev3/stats.json. Run with:
 *   bun run scripts/orbit-rev3-stats-merge.ts
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { TICKS_PER_SECOND } from "../src/lib/arcade/engine";

const TOTAL = 200;
const WORKERS = 8;
mkdirSync("/mnt/documents/orbit-rev3", { recursive: true });
mkdirSync("/tmp/orbit-rev3-parts", { recursive: true });

const chunk = Math.ceil(TOTAL / WORKERS);
const ranges: [number, number, string][] = [];
for (let w = 0; w < WORKERS; w++) {
  const start = w * chunk;
  const end = Math.min(TOTAL, start + chunk);
  if (start >= end) continue;
  ranges.push([start, end, `/tmp/orbit-rev3-parts/part-${w}.raw.json`]);
}

console.log(`spawning ${ranges.length} workers over ${TOTAL} seeds...`);
const procs = ranges.map(([start, end, out]) =>
  Bun.spawn(["bun", "run", "scripts/orbit-rev3-stats.ts", String(start), String(end), out], {
    stdout: "inherit",
    stderr: "inherit",
  }),
);

const exitCodes = await Promise.all(procs.map((p) => p.exited));
exitCodes.forEach((code, i) => {
  if (code !== 0) throw new Error(`worker ${i} exited ${code}`);
});

const parts = ranges.map(([, , out]) => JSON.parse(readFileSync(out, "utf8")));

const proofMs: number[] = [];
const rev3Ticks: number[] = [];
const rev2Ticks: number[] = [];
const beltHopWaitsAll: number[] = [];
const failureReasons: string[] = [];
let totalHops = 0, totalFallbacks = 0, totalLateral = 0, lateralOver120 = 0;
let maxLateralOverall = 0, maxFlightSpeedOverall = 0;
let rev3Failures = 0, rev2Failures = 0, totalMsSum = 0;

for (const p of parts) {
  proofMs.push(...p.proofMs);
  rev3Ticks.push(...p.rev3Ticks);
  rev2Ticks.push(...p.rev2Ticks);
  beltHopWaitsAll.push(...p.beltHopWaitsAll);
  failureReasons.push(...p.failureReasons);
  totalHops += p.totalHops;
  totalFallbacks += p.totalFallbacks;
  totalLateral += p.totalLateral;
  lateralOver120 += p.lateralOver120;
  maxLateralOverall = Math.max(maxLateralOverall, p.maxLateralOverall);
  maxFlightSpeedOverall = Math.max(maxFlightSpeedOverall, p.maxFlightSpeedOverall);
  rev3Failures += p.rev3Failures;
  rev2Failures += p.rev2Failures;
  totalMsSum += p.totalMs;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const percentile = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)]!;
};

const saltCounts: Record<number, number> = {};
// salt distribution requires re-reading proveOrbitRev3Layout's salt per seed;
// recomputed cheaply here (proof already warm from worker runs, cost is tiny
// relative to the search since layouts are memoized by seed within process).
const { proveOrbitRev3Layout } = await import("../src/lib/arcade/orbitRev3");
const allSeeds = Array.from({ length: TOTAL }, (_, i) => i * 7919 + 1);
for (const seed of allSeeds) {
  const { salt } = proveOrbitRev3Layout(seed);
  saltCounts[salt] = (saltCounts[salt] ?? 0) + 1;
}

const result = {
  seeds: TOTAL,
  workers: ranges.length,
  wallClockMsMerge: totalMsSum, // sum of worker-local wall time (workers ran in parallel; see totalRunMsWallParallel below)
  proveOrbitRev3LayoutMs: {
    mean: mean(proofMs),
    p95: percentile(proofMs, 95),
    max: Math.max(...proofMs, 0),
  },
  saltDistribution: saltCounts,
  fallbackHops: {
    total: totalFallbacks,
    ofHops: totalHops,
    pct: (100 * totalFallbacks) / totalHops,
  },
  lateralOver120: {
    count: lateralOver120,
    ofHops: totalLateral,
    pct: (100 * lateralOver120) / totalLateral,
    maxLateralObserved: maxLateralOverall,
  },
  maxFlightSpeedUnitsPerTick: {
    observed: maxFlightSpeedOverall,
    cap: 6,
    withinCap: maxFlightSpeedOverall <= 6,
  },
  botCompletionSeconds: {
    rev3: {
      finished: rev3Ticks.length,
      failed: rev3Failures,
      mean: mean(rev3Ticks) / TICKS_PER_SECOND,
      p50: percentile(rev3Ticks, 50) / TICKS_PER_SECOND,
      p90: percentile(rev3Ticks, 90) / TICKS_PER_SECOND,
    },
    rev2: {
      finished: rev2Ticks.length,
      failed: rev2Failures,
      mean: mean(rev2Ticks) / TICKS_PER_SECOND,
      p50: percentile(rev2Ticks, 50) / TICKS_PER_SECOND,
      p90: percentile(rev2Ticks, 90) / TICKS_PER_SECOND,
    },
  },
  beltHopWaitTicks: {
    count: beltHopWaitsAll.length,
    mean: mean(beltHopWaitsAll),
  },
  failureReasons: failureReasons.slice(0, 20),
  tuning: {
    changed: false,
    note:
      totalFallbacks / totalHops > 0.1
        ? "Fallback rate exceeded 10%; buildCourse3Raw needs tuning (see note)."
        : "Fallback rate under the 10% threshold; buildCourse3Raw was not modified.",
  },
};

writeFileSync("/mnt/documents/orbit-rev3/stats.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
