/**
 * Runs every scripts/*-check.ts(x) as its own `bun` subprocess and reports a
 * pass/fail summary. Each check gets a fixed 300s timeout; scripts/snip-check.ts
 * gets 1800s because its full cut-time search over every template is much slower.
 *
 * Slow checks run at quick depth unless --full is given (it sets CHECKS_FULL=1
 * for every check; see scripts/check-depth.ts). A filter of the form
 * `<file>@<k>/<n>` runs just that check with --part=<k>/<n> (one of n disjoint
 * parts; arcade-play-check, bottom-clearance-check, puzzle-bank-check and
 * arcade-self-replay-check support it, CI shards use it).
 *
 *   bun scripts/run-checks.ts            # run every routine check
 *   bun scripts/run-checks.ts --include-optional # include deep Orbit (300s), the full puzzle-bank rebuild (3600s) and the 200-seed puzzle bands
 *   bun scripts/run-checks.ts --json=/tmp/check-results.json # save full results
 *   bun scripts/run-checks.ts foo bar    # run only checks whose filename includes "foo" or "bar"
 *   bun scripts/run-checks.ts replay-check.ts # an exact filename runs only that check
 *   bun scripts/run-checks.ts --full snip # full depth (what the manual full CI run does)
 *   bun scripts/run-checks.ts puzzle-bank-check.ts@1/4 # part 1 of 4
 */
import { spawn } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";

const DEFAULT_TIMEOUT_MS = 300_000;
const TIMEOUT_OVERRIDES: Record<string, number> = {
  "snip-check.ts": 1_800_000,
  // 22 games × ~25 s each in headless Chromium, plus starting a dev server.
  "arcade-play-check.ts": 1_500_000,
  // The computer layout (31 Oct 2026): every arcade game at two desktop sizes (a half ~6 min); the layout's
  // pages, rooms, phones and a third of every game's desktop mode (~4 min a part); the fairness gestures.
  "arcade-play-desktop-check.ts": 1_500_000,
  "desktop-layout-check.ts": 900_000,
  "desktop-fairness-check.ts": 600_000,
  // Five stored rounds in the replay player in headless Chromium, plus starting a dev server.
  "replay-play-check.ts": 900_000,
  // 74 active games × ~10 s each in headless Chromium (4 viewports each), plus starting a dev server.
  "bottom-clearance-check.ts": 1_200_000,
  // 14 screens at two sizes, then 36 room play-header cases (16 Oct 2026), ~3–4 min on a 2-core runner.
  "safe-area-screens-check.tsx": 600_000,
  // The page skin's 36 screens (Room settings' sheet and lobby summary joined 31 Oct 2026) plus the intro colours at
  // two sizes, one Chromium page each with a contrast screenshot: ~234 s on a 2-core runner before them, past 300 s after.
  "theme-check.tsx": 600_000,
  // Low-end performance (16 Oct 2026): five heavy arcade games at 4× CPU slowdown plus one unthrottled, ~4 min.
  "arcade-lowend-check.ts": 900_000,
  "puzzle-bank-rebuild-check.ts": 3_600_000,
  // A production build of the app, then nine real practice rounds in headless Chromium (29 Oct 2026).
  "standard-live-check.ts": 600_000,
  // Offline practice (31 Oct 2026): a production build, then offline play, the queue and a worker update, ~5 min.
  "offline-check.ts": 900_000,
};
const OPTIONAL_CHECKS = new Set(["orbit-outside-belt-deep-check.ts", "puzzle-bank-rebuild-check.ts", "puzzle-bands-depth-check.ts"]);

const args = process.argv.slice(2);
const includeOptional = args.includes("--include-optional");
const jsonPath = args.find((arg) => arg.startsWith("--json="))?.slice(7);
const full = args.includes("--full");
const filters = args.filter((arg) => !arg.startsWith("--"));
const parted = filters.filter((f) => f.includes("@"));
const plain = filters.filter((f) => !f.includes("@"));
const allFiles = readdirSync("scripts").filter((f) => /-check\.tsx?$/.test(f));
for (const entry of parted)
  if (!allFiles.includes(entry.split("@")[0]!) || !/^\d+\/\d+$/.test(entry.split("@")[1]!)) {
    console.error(`run-checks: bad part entry ${entry} (expected <file>@<k>/<n>)`);
    process.exit(2);
  }
const files = [
  ...allFiles
    .filter((f) => includeOptional || !OPTIONAL_CHECKS.has(f))
    // A filter naming a check file exactly selects only that file (CI shards pass exact
    // names: "replay-check.ts" must not also run orbit-rev3-replay-check.ts); any other
    // filter matches by substring.
    .filter((f) => filters.length === 0 || plain.some((s) => (allFiles.includes(s) ? f === s : f.includes(s))))
    .sort(),
  ...parted,
];

function runOne(entry: string): Promise<{
  file: string;
  ok: boolean;
  status: "pass" | "fail" | "timeout";
  timeoutMs: number;
  ms: number;
  output: string;
}> {
  const [script, part] = entry.split("@") as [string, string | undefined];
  const file = entry;
  const timeoutMs = TIMEOUT_OVERRIDES[script] ?? DEFAULT_TIMEOUT_MS;
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn("bun", [`scripts/${script}`, ...(part ? [`--part=${part}`] : [])], {
      stdio: ["ignore", "pipe", "pipe"],
      env: full ? { ...process.env, CHECKS_FULL: "1" } : process.env,
    });
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
  console.log(`running ${files.length} check(s) at ${full ? "full" : "quick"} depth...`);
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
