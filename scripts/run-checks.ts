/**
 * Runs every scripts/*-check.ts(x) as its own `bun` subprocess and reports a
 * pass/fail summary. Each check gets a fixed 300s timeout; scripts/snip-check.ts
 * gets 1800s because its cut-time search over every template is much slower.
 *
 *   bun scripts/run-checks.ts            # run every routine check
 *   bun scripts/run-checks.ts --include-optional # include deep Orbit (300s) and the full puzzle-bank rebuild (3600s)
 *   bun scripts/run-checks.ts --json=/tmp/check-results.json # save full results
 *   bun scripts/run-checks.ts foo bar    # run only checks whose filename includes "foo" or "bar"
 */
import { spawn } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";

const DEFAULT_TIMEOUT_MS = 300_000;
const TIMEOUT_OVERRIDES: Record<string, number> = {
  "snip-check.ts": 1_800_000,
  // 22 games × ~25 s each in headless Chromium, plus starting a dev server.
  "arcade-play-check.ts": 1_500_000,
  "puzzle-bank-rebuild-check.ts": 3_600_000,
};
const OPTIONAL_CHECKS = new Set(["orbit-outside-belt-deep-check.ts", "puzzle-bank-rebuild-check.ts"]);

const args = process.argv.slice(2);
const includeOptional = args.includes("--include-optional");
const jsonPath = args.find((arg) => arg.startsWith("--json="))?.slice(7);
const filters = args.filter((arg) => !arg.startsWith("--"));
const files = readdirSync("scripts")
  .filter((f) => /-check\.tsx?$/.test(f))
  .filter((f) => includeOptional || !OPTIONAL_CHECKS.has(f))
  .filter((f) => filters.length === 0 || filters.some((s) => f.includes(s)))
  .sort();

function runOne(file: string): Promise<{
  file: string;
  ok: boolean;
  status: "pass" | "fail" | "timeout";
  timeoutMs: number;
  ms: number;
  output: string;
}> {
  const timeoutMs = TIMEOUT_OVERRIDES[file] ?? DEFAULT_TIMEOUT_MS;
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn("bun", [`scripts/${file}`], { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let timedOut = false;
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
      output += `\n[run-checks] killed after ${timeoutMs}ms timeout`;
    }, timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      // Older proof scripts print failed assertions but still exit zero.
      // Match only unambiguous nonzero failure summaries, not expected negative
      // test diagnostics such as "desync" or "input payload out of range".
      const assertionFailed =
        /^FAIL(?:\s|:)|^[1-9]\d* CHECK\(S\) FAILED|^[1-9]\d* failures;|^[1-9]\d* failed\s*$/m.test(
          output,
        );
      const ok = !timedOut && code === 0 && !assertionFailed;
      resolve({
        file,
        ok,
        status: timedOut ? "timeout" : ok ? "pass" : "fail",
        timeoutMs,
        ms: Date.now() - started,
        output,
      });
    });
  });
}

async function main() {
  console.log(`running ${files.length} check(s)...`);
  const results: Awaited<ReturnType<typeof runOne>>[] = [];
  for (const file of files) {
    process.stdout.write(`  ${file} ... `);
    const result = await runOne(file);
    results.push(result);
    console.log(`${result.status.toUpperCase()} (${(result.ms / 1000).toFixed(1)}s)`);
    if (jsonPath)
      writeFileSync(
        jsonPath,
        JSON.stringify(
          { results, optionalSkipped: includeOptional ? [] : [...OPTIONAL_CHECKS] },
          null,
          2,
        ),
      );
    if (!result.ok) console.log(result.output.split("\n").slice(-40).join("\n"));
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log(
      `failed: ${failed
        .filter((f) => f.status === "fail")
        .map((f) => f.file)
        .join(", ")}`,
    );
    console.log(
      `timed out: ${failed
        .filter((f) => f.status === "timeout")
        .map((f) => f.file)
        .join(", ")}`,
    );
    process.exit(1);
  }
}

main();
