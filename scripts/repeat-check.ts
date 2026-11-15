/**
 * repeat-check (check plumbing, 14 Nov 2026, approved by Joe): runs one check N times in a row and reports how many
 * runs passed, failed and timed out, to prove a new or changed check isn't flaky before its PR is opened.
 *
 *   bun scripts/repeat-check.ts <check> [times=10]
 *
 * <check> is a check's file name, with or without its extension and a leading scripts/ (theme-check,
 * theme-check.tsx), optionally with one part (theme-check.tsx@3/24). Each run goes through
 * scripts/run-checks.ts, so it gets the same timeout and the same FAIL detection as CI. Exits non-zero unless every
 * run passed. A failed run's last output lines are printed under it.
 *
 * With no arguments it tests itself (the CI run): its argument rules, its tally, and two real repeats of a fast check
 * (one passing, run twice), so the runner itself is proved in the routine suite.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type RunStatus = "pass" | "fail" | "timeout";

/** The check entry (`file` or `file@k/n`) named by `name`, or an error message. */
export function resolveCheck(name: string, files: string[] = readdirSync("scripts")): string | { error: string } {
  const [raw, part, ...rest] = name.replace(/^\.?\/?scripts\//, "").split("@");
  if (rest.length || (part !== undefined && !/^\d+\/\d+$/.test(part))) return { error: `bad part in ${name} (use file@k/n)` };
  if (part) {
    const [k, n] = part.split("/").map(Number) as [number, number];
    if (k < 1 || k > n) return { error: `bad part in ${name}: k must be 1..n` };
  }
  const candidates = [raw!, `${raw}.ts`, `${raw}.tsx`].filter((f) => /-check\.tsx?$/.test(f) && files.includes(f));
  if (!candidates.length) return { error: `no check scripts/${raw}(.ts|.tsx)` };
  return part ? `${candidates[0]}@${part}` : candidates[0]!;
}

/** The repeat count: a whole number from 1 to 100 (10 when not given). */
export function parseTimes(arg: string | undefined): number | { error: string } {
  if (arg === undefined) return 10;
  const n = Number(arg);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : { error: `times must be a whole number from 1 to 100 (${arg})` };
}

export function tally(statuses: RunStatus[]) {
  const count = (s: RunStatus) => statuses.filter((x) => x === s).length;
  return { runs: statuses.length, pass: count("pass"), fail: count("fail"), timeout: count("timeout"), steady: statuses.length > 0 && statuses.every((s) => s === "pass") };
}

/** One run of the entry through run-checks (its timeout and FAIL rules). */
async function runOnce(entry: string, dir: string, i: number): Promise<{ status: RunStatus; ms: number; output: string }> {
  const json = join(dir, `run-${i}.json`);
  const code: number = await new Promise((resolve) => {
    const child = spawn("bun", [join("scripts", "run-checks.ts"), `--json=${json}`, entry], { stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", () => undefined);
    child.stderr.on("data", () => undefined);
    child.on("close", (c) => resolve(c ?? 1));
  });
  if (!existsSync(json)) return { status: "fail", ms: 0, output: `run-checks wrote no results (exit ${code})` };
  const r = (JSON.parse(readFileSync(json, "utf8")) as { results: { status: RunStatus; ms: number; output: string }[] }).results[0];
  if (!r) return { status: "fail", ms: 0, output: `run-checks ran nothing for ${entry} (exit ${code})` };
  return { status: r.status, ms: r.ms, output: r.output };
}

export async function repeat(entry: string, times: number, log: (line: string) => void = console.log) {
  const dir = mkdtempSync(join(tmpdir(), "repeat-check-"));
  const statuses: RunStatus[] = [];
  const ms: number[] = [];
  try {
    for (let i = 1; i <= times; i++) {
      const r = await runOnce(entry, dir, i);
      statuses.push(r.status);
      ms.push(r.ms);
      log(`  run ${i}/${times}: ${r.status.toUpperCase()} (${(r.ms / 1000).toFixed(1)} s)`);
      if (r.status !== "pass") log(r.output.split("\n").slice(-25).map((l) => `    | ${l}`).join("\n"));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return { ...tally(statuses), slowestMs: Math.max(0, ...ms) };
}

async function selfTest(): Promise<void> {
  const failures: string[] = [];
  const check = (ok: boolean, label: string) => (ok ? undefined : failures.push(label));
  const files = ["theme-check.tsx", "sample-check.ts", "no-wrap-check.tsx", "theme-screens.ts"];
  check(resolveCheck("theme-check", files) === "theme-check.tsx", "a bare name finds its .tsx");
  check(resolveCheck("scripts/sample-check.ts", files) === "sample-check.ts", "a scripts/ path is accepted");
  check(resolveCheck("no-wrap-check.tsx@3/24", files) === "no-wrap-check.tsx@3/24", "a part is kept");
  check(typeof resolveCheck("theme-screens", files) === "object", "a file that isn't a check is refused");
  check(typeof resolveCheck("theme-check@0/3", files) === "object" && typeof resolveCheck("theme-check@4/3", files) === "object", "a part outside 1..n is refused");
  check(typeof resolveCheck("theme-check@x", files) === "object", "a malformed part is refused");
  check(parseTimes(undefined) === 10 && parseTimes("3") === 3, "times defaults to 10 and reads a number");
  check([parseTimes("0"), parseTimes("1.5"), parseTimes("101"), parseTimes("x")].every((t) => typeof t === "object"), "times outside 1..100 is refused");
  const t = tally(["pass", "fail", "pass", "timeout"]);
  check(t.runs === 4 && t.pass === 2 && t.fail === 1 && t.timeout === 1 && !t.steady, "the tally counts each status");
  check(tally(["pass", "pass"]).steady && !tally([]).steady, "steady only when every run passed");
  // Two real repeats through run-checks (a fast, steady check), so the plumbing is proved end to end.
  const real = await repeat("no-side-effect-imports-check.ts", 2, () => undefined);
  check(real.runs === 2 && real.pass === 2 && real.steady, `two real runs of a steady check both pass (${JSON.stringify(real)})`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  if (failures.length) {
    console.log(`FAIL: repeat-check self-test, ${failures.length} failed`);
    process.exit(1);
  }
  console.log("PASS repeat-check self-test: argument rules, tally and two real repeats through run-checks");
}

if (import.meta.main) {
  const [name, timesArg, ...extra] = process.argv.slice(2);
  if (!name) await selfTest();
  else {
    const entry = resolveCheck(name);
    const times = parseTimes(timesArg);
    if (typeof entry === "object" || typeof times === "object" || extra.length) {
      console.log(`usage: bun scripts/repeat-check.ts <check>[@k/n] [times=10]`);
      if (typeof entry === "object") console.log(`  ${entry.error}`);
      if (typeof times === "object") console.log(`  ${times.error}`);
      process.exit(2);
    }
    console.log(`repeat-check: ${entry} × ${times}`);
    const r = await repeat(entry, times);
    console.log(
      `${r.steady ? "PASS" : "FAIL:"} repeat-check ${entry}: ${r.pass} of ${r.runs} passed, ${r.fail} failed, ${r.timeout} timed out (slowest ${(r.slowestMs / 1000).toFixed(1)} s)`,
    );
    process.exit(r.steady ? 0 : 1);
  }
}
