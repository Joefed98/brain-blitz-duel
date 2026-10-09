/**
 * Runs every scripts/*-check.ts(x) as its own `bun` subprocess and reports a
 * pass/fail summary. Each check gets a fixed 300s timeout; scripts/snip-check.ts
 * gets 1800s because its cut-time search over every template is much slower.
 *
 *   bun scripts/run-checks.ts            # run every check
 *   bun scripts/run-checks.ts foo bar    # run only checks whose filename includes "foo" or "bar"
 */
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";

const DEFAULT_TIMEOUT_MS = 300_000;
const TIMEOUT_OVERRIDES: Record<string, number> = {
  "snip-check.ts": 1_800_000,
  "orbit-outside-belt-deep.ts": 1_800_000,
};

const filters = process.argv.slice(2);
const files = readdirSync("scripts")
  .filter((f) => /-check\.tsx?$/.test(f))
  .filter((f) => filters.length === 0 || filters.some((s) => f.includes(s)))
  .sort();

function runOne(file: string): Promise<{ file: string; ok: boolean; ms: number; output: string }> {
  const timeoutMs = TIMEOUT_OVERRIDES[file] ?? DEFAULT_TIMEOUT_MS;
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn("bun", [`scripts/${file}`], { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      output += `\n[run-checks] killed after ${timeoutMs}ms timeout`;
    }, timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ file, ok: code === 0, ms: Date.now() - started, output });
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
    console.log(`${result.ok ? "ok" : "FAIL"} (${(result.ms / 1000).toFixed(1)}s)`);
    if (!result.ok) console.log(result.output.split("\n").slice(-40).join("\n"));
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log(`failed: ${failed.map((f) => f.file).join(", ")}`);
    process.exit(1);
  }
}

main();
