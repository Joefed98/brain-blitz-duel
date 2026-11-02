/**
 * Which checks start a browser (1 Nov 2026, CI cost cut). A check is a browser check when its file, or a script
 * under scripts/ that it imports or spawns, launches Chromium through Playwright. Browser checks run only in the
 * full-suite workflow (.github/workflows/full-suite.yml: a PR labelled `ready-to-merge`, a PR leaving draft, a
 * manual run and the weekly run on main); every other check runs on every push (.github/workflows/checks.yml).
 * The split is worked out from the source, never kept by hand, so a new check lands on the right side by itself;
 * ci-shards-check proves every check runs on exactly one side.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

/** Launching a browser: Playwright or Puppeteer imported, or Chromium launched. */
const LAUNCHES = /chromium\.launch|from\s+["'](?:@playwright\/test|playwright(?:-core)?)["']|import\(\s*["'](?:@playwright\/test|playwright(?:-core)?)["']\s*\)|puppeteer/;
/** A check that starts another script as a process. */
const SPAWNS = /\bspawn(?:Sync)?\(|Bun\.spawn|execSync\(|execFileSync\(/;

const memo = new Map<string, boolean>();

function localImport(from: string, spec: string): string | null {
  const base = normalize(join(dirname(from), spec));
  for (const file of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")])
    if (existsSync(file) && /\.tsx?$/.test(file)) return file;
  return null;
}

function launchesBrowser(file: string, seen: Set<string>): boolean {
  const known = memo.get(file);
  if (known !== undefined) return known;
  if (seen.has(file)) return false;
  seen.add(file);
  const src = readFileSync(file, "utf8");
  let hit = LAUNCHES.test(src);
  if (!hit) {
    const next: string[] = [];
    for (const m of src.matchAll(/(?:from\s+|import\(\s*)["'](\.{1,2}\/[^"']+)["']/g)) {
      const resolved = localImport(file, m[1]!);
      if (resolved?.startsWith("scripts/")) next.push(resolved);
    }
    if (SPAWNS.test(src))
      for (const m of src.matchAll(/["'`](scripts\/[\w./-]+\.tsx?)["'`]/g)) if (existsSync(m[1]!)) next.push(m[1]!);
    hit = next.some((f) => launchesBrowser(f, seen));
  }
  memo.set(file, hit);
  return hit;
}

/** True when `scripts/<check>` (a `*-check.ts(x)` file name, optionally `@k/n`) starts a browser. */
export function isBrowserCheck(check: string): boolean {
  return launchesBrowser(`scripts/${check.split("@")[0]!}`, new Set());
}

/** Every routine check file under scripts/. */
export function allCheckFiles(): string[] {
  return readdirSync("scripts")
    .filter((f) => /-check\.tsx?$/.test(f))
    .sort();
}
