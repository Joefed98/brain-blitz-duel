/**
 * economy-neutral-check (wave 2 A1, 10 Nov 2026; docs/economy/README.md "Nothing coins buy helps win"): no scoring,
 * grading, replay, matchmaking or timing code can read the catalogue, inventory, loadout or ledger.
 *
 * It walks the import graph (static imports, `export … from`, dynamic `import()`, `@/` and relative paths) from every
 * file of that code and fails if any file it reaches is an economy module (src/lib/economy/**, src/lib/data/economy*)
 * or names an economy table or function ("coin_ledger", "economy_spend" …). The roots: every file under
 * src/lib/arcade, src/lib/round, src/lib/replay and src/puzzles, and every src/lib/duel file whose name says it
 * grades, scores, deals, ranks, matches, replays or times (the patterns below), plus the room and practice server
 * functions' grading paths. A file added under those folders or with such a name is covered without editing this check.
 *
 * It also proves the walk works: from economy.functions.ts it must reach the economy modules. ~1 s, no browser.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}

const ROOT = resolve(".");
const SRC = join(ROOT, "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const EXTS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];
function resolveSpec(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null; // a package
  for (const ext of EXTS) {
    const path = base + ext;
    if (existsSync(path) && statSync(path).isFile()) return path;
  }
  return null;
}

const SPEC_RE = /(?:import|export)\s[^'"`;]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
const cache = new Map<string, string[]>();
function importsOf(file: string): string[] {
  const hit = cache.get(file);
  if (hit) return hit;
  const text = readFileSync(file, "utf8");
  const out: string[] = [];
  for (const m of text.matchAll(SPEC_RE)) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (!spec) continue;
    const path = resolveSpec(file, spec);
    if (path) out.push(path);
  }
  cache.set(file, out);
  return out;
}

/** Every file reachable from `roots`, with the path that first reached it. */
function reach(roots: readonly string[]): Map<string, string[]> {
  const seen = new Map<string, string[]>();
  const queue: [string, string[]][] = roots.map((r) => [r, [r]]);
  while (queue.length) {
    const [file, path] = queue.shift()!;
    if (seen.has(file)) continue;
    seen.set(file, path);
    for (const next of importsOf(file)) if (!seen.has(next)) queue.push([next, [...path, next]]);
  }
  return seen;
}

const rel = (p: string) => relative(ROOT, p);
const isEconomyModule = (p: string) => {
  const r = rel(p);
  return r.startsWith("src/lib/economy/") || /^src\/lib\/data\/economy[^/]*$/.test(r);
};
/** The economy's tables and functions (supabase/migrations/20261110160000_economy.sql). */
const ECONOMY_NAMES =
  /\b(catalogue_items|catalogue_shop|coin_ledger|coin_wallets|consumable_ledger|consumable_balances|inventory_items|loadout_slots|loadouts|gem_unlocks|avatar_options|economy_[a-z_]+)\b/;

const all = walk(SRC);
const DUEL_PATTERN =
  /(grade|scor|replay|rank|match|deal|generate|standard|taplog|speedpar|stagedrounds|clock|buzzer|roomclose|timing|window|receipt|trust|progress|partialcredit|roundmax|puzzlebands|arcade\.server|sports\.server|cards\.ts$|registry|catalogue\.data)/i;
const roots = all.filter((p) => {
  const r = rel(p);
  if (/^src\/(lib\/arcade|lib\/round|lib\/replay|puzzles)\//.test(r)) return true;
  if (/^src\/lib\/duel\//.test(r)) return DUEL_PATTERN.test(r.slice("src/lib/duel/".length));
  return false;
});
for (const must of [
  "src/lib/duel/grade.ts",
  "src/lib/duel/gradeAnswer.server.ts",
  "src/lib/duel/roomGrade.server.ts",
  "src/lib/duel/scoring.ts",
  "src/lib/duel/ranking.ts",
  "src/lib/duel/generate.server.ts",
  "src/lib/duel/clock.ts",
  "src/lib/duel/buzzer.ts",
  "src/lib/duel/tapLog.ts",
  "src/lib/round/trust.ts",
  "src/lib/arcade/engine.ts",
])
  check(roots.some((r) => rel(r) === must), `root: ${must}`);
check(roots.length > 300, `${roots.length} root files (scoring, grading, replay, matchmaking, timing)`);

const reached = reach(roots);
const leaks = [...reached.entries()].filter(([file]) => isEconomyModule(file));
check(
  leaks.length === 0,
  `no scoring, grading, replay, matchmaking or timing code imports an economy module${leaks.length ? `: ${leaks.slice(0, 3).map(([, p]) => p.map(rel).join(" → ")).join("; ")}` : ""}`,
);
// The generated Database type names every table (types only, no reads); it is the one file allowed to.
const TYPES_ONLY = "src/integrations/supabase/types.ts";
const named = [...reached.keys()].filter((file) => rel(file) !== TYPES_ONLY && ECONOMY_NAMES.test(readFileSync(file, "utf8")));
check(
  named.length === 0,
  `none of that code names an economy table or function${named.length ? `: ${named.slice(0, 5).map(rel).join(", ")}` : ""}`,
);
check(reached.size >= roots.length, `walked ${reached.size} files`);

// The walk itself works: the economy's own server functions reach the economy modules.
const control = reach([join(SRC, "lib/economy/economy.functions.ts")]);
check(
  [...control.keys()].some((p) => rel(p) === "src/lib/data/economy.server.ts") &&
    [...control.keys()].some((p) => rel(p) === "src/lib/economy/slots.ts"),
  "control: the walk follows dynamic and static imports into the economy modules",
);
// And the economy depends on nothing that scores: it imports no grading or scoring module either.
const economyFiles = all.filter(isEconomyModule);
const backwards = [...reach(economyFiles).keys()].filter((p) => /src\/lib\/duel\/(grade|scoring|ranking|generate)/.test(rel(p)));
check(backwards.length === 0, `the economy modules import no grading or scoring code${backwards.length ? ` (${backwards.map(rel).join(", ")})` : ""}`);

console.log(`economy-neutral-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: nothing coins buy is read by scoring, grading, replay, matchmaking or timing code.");
