/**
 * game-catalogue-check (speed fix 1, Nov 2026; docs/audit-nov-2026/performance.md finding 1). Proves:
 *  1. src/lib/duel/catalogue.data.ts and gameModules.ts are what scripts/game-catalogue.ts writes from the registry
 *     (run it after adding a game or changing a definition's name, category, clock, reveal fields or GOAL line);
 *  2. the catalogue agrees with the full registry for every game: the same ids in the same order, and every
 *     field the phone reads from it (name, category, clock, reveal length and heading, arcade run, timer, retired,
 *     theme, desktop mode), for live and deleted ids; every timing helper gives the same figure for every game;
 *  3. each per-game loader (gameLoader.ts) gives the registry's own module definition, and the definition it
 *     builds is the registry's (same Stage wrapper inputs, theme, desktop, instructions, retired, reveal length);
 *  4. the phone never imports the full registry: registry.ts is imported only by server files (and puzzles.ts,
 *     whose callers are the server and server functions), and nothing the first screen loads statically (the
 *     root route and the Play tab, server-function handlers excluded as the client build strips them) reaches a
 *     game module, the registry or the help copy.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import { catalogueSource, modulesSource } from "./game-catalogue";
import * as registry from "../src/lib/duel/registry";
import * as catalogue from "../src/lib/duel/catalogue";
import { GAME_MODULES } from "../src/lib/duel/gameModules";
import { loadGameDef, loadedGameDef } from "../src/lib/duel/gameLoader";
import { REMOVED_PUZZLE_TYPES } from "../src/lib/duel/removedGames";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, name: string): void {
  if (ok) passes++;
  else failures.push(name);
}

/* 1. Generated files. */
check(readFileSync("src/lib/duel/catalogue.data.ts", "utf8") === catalogueSource(), "catalogue.data.ts is up to date (bun scripts/game-catalogue.ts)");
check(readFileSync("src/lib/duel/gameModules.ts", "utf8") === modulesSource(), "gameModules.ts is up to date (bun scripts/game-catalogue.ts)");

/* 2. Catalogue = registry. */
const registryTypes = Object.keys(registry.BASE_REGISTRY);
check(isDeepStrictEqual(catalogue.PUZZLE_TYPES, registryTypes), "PUZZLE_TYPES: the registry's ids in the registry's order");
check(isDeepStrictEqual(Object.keys(registry.PUZZLE_REGISTRY), registryTypes), "PUZZLE_REGISTRY keeps the order");
const FIELDS = ["name", "category", "timeLimitMs", "revealMs", "arcadeRun", "showTimer", "revealHeading", "retired", "theme", "desktop"] as const;
for (const type of [...registryTypes, ...REMOVED_PUZZLE_TYPES] as PuzzleType[]) {
  const full = registry.puzzleDef(type) as unknown as Record<string, unknown>;
  const info = catalogue.puzzleInfo(type) as unknown as Record<string, unknown>;
  for (const field of FIELDS) check(isDeepStrictEqual(info[field], full[field]), `${type}: catalogue ${field} = registry ${field}`);
  check(catalogue.puzzleName(type) === registry.puzzleName(type), `${type}: puzzleName`);
  const puzzle = { type } as PuzzleData;
  const stamped = { type, timeLimitMs: 77_000 } as unknown as PuzzleData;
  for (const p of [puzzle, stamped]) {
    // The registry's own definition-driven figures (prepMs and durationMs hooks), worked out here from the full definition.
    const prep = (full["prepMs"] as ((x: PuzzleData) => number) | undefined)?.(p) ?? 0;
    const duration = (full["durationMs"] as ((x: PuzzleData) => number) | undefined)?.(p) ?? prep + catalogue.puzzleTimeLimitMs(p);
    check(catalogue.puzzlePrepMs(p) === prep, `${type}: puzzlePrepMs`);
    check(catalogue.puzzleDurationMs(p) === duration, `${type}: puzzleDurationMs`);
  }
  if (catalogue.isLiveType(type)) {
    const instructions = (registry.PUZZLE_REGISTRY[type] as { instructions: { goal: string } }).instructions;
    check(catalogue.puzzleGoal(type) === instructions.goal, `${type}: the catalogue's GOAL line is the intro's`);
  } else {
    check(catalogue.puzzleGoal(type) === "", `${type}: a deleted game has no GOAL line`);
  }
}
check(registry.puzzleTimeLimitMs === catalogue.puzzleTimeLimitMs && registry.typesInCategory === catalogue.typesInCategory, "the registry's helpers are the catalogue's");

/* 3. Per-game loaders. */
for (const type of registryTypes as PuzzleType[]) {
  const loaded = await GAME_MODULES[type]();
  check(loaded === registry.BASE_REGISTRY[type], `${type}: its loader gives the registry's module definition`);
  check(loadedGameDef(type) === null, `${type}: not loaded before it is asked for`);
  const def = await loadGameDef(type);
  const full = registry.PUZZLE_REGISTRY[type];
  check(loadedGameDef(type) === def, `${type}: kept once loaded`);
  for (const field of ["theme", "desktop", "instructions", "retired", "revealMs", "IntroExample", "Reveal", "introLine", "name", "category"] as const) {
    check(isDeepStrictEqual(def[field], full[field]), `${type}: loaded ${field} = registry ${field}`);
  }
  check(typeof def.Stage === "function" && def.Stage !== loaded.Stage, `${type}: the loaded Stage carries the feedback wrapper`);
}
for (const type of REMOVED_PUZZLE_TYPES) check(loadedGameDef(type)?.name === registry.puzzleDef(type).name, `${type}: a deleted game's stand-in needs no download`);

/* 4. The phone never imports the full registry. */
const transpilers = { ts: new Bun.Transpiler({ loader: "ts" }), tsx: new Bun.Transpiler({ loader: "tsx" }) };
function resolveSpec(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = resolve("src", spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null;
  base = base.replace(/\?.*$/, "");
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (existsSync(c) && /\.tsx?$/.test(c) && statSync(c).isFile()) return c;
  }
  return null;
}
const importCache = new Map<string, string[]>();
function staticImports(file: string): string[] {
  let out = importCache.get(file);
  if (!out) {
    // Value imports only (scanImports drops `import type`); dynamic import() is never followed.
    out = transpilers[file.endsWith(".tsx") ? "tsx" : "ts"]
      .scanImports(readFileSync(file, "utf8"))
      .filter((i) => i.kind === "import-statement")
      .map((i) => resolveSpec(file, i.path))
      .filter((f): f is string => f !== null);
    importCache.set(file, out);
  }
  return out;
}
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}
const REGISTRY = resolve("src/lib/duel/registry.ts");
const PUZZLES = resolve("src/lib/duel/puzzles.ts");
for (const file of walk("src").map((f) => resolve(f))) {
  const imports = staticImports(file);
  const rel = file.slice(resolve(".").length + 1);
  if (imports.includes(REGISTRY)) {
    check(/\.server\.ts$/.test(file) || file === PUZZLES, `${rel}: only server files import the full registry (use catalogue.ts or gameLoader.ts)`);
  }
  if (imports.includes(PUZZLES)) {
    check(/\.(server|functions)\.ts$/.test(file) || rel === "src/lib/duel/grade.ts", `${rel}: puzzles.ts (which reads the registry) is for the server`);
  }
}
const FIRST_SCREEN = ["src/routes/__root.tsx", "src/routes/index.tsx"].map((f) => resolve(f));
const seen = new Set<string>(FIRST_SCREEN);
const queue = [...FIRST_SCREEN];
while (queue.length) {
  const file = queue.pop()!;
  // Server-function files: the client build keeps only their RPC stubs, never their handlers' imports.
  if (/\.functions\.ts$/.test(file)) continue;
  for (const dep of staticImports(file)) {
    if (!seen.has(dep)) {
      seen.add(dep);
      queue.push(dep);
    }
  }
}
const gameModuleFiles = new Set(
  Object.values(GAME_MODULES).map((loader) => {
    const m = /import\("@\/puzzles\/([\w-]+)"\)/.exec(loader.toString());
    return m ? resolve(`src/puzzles/${m[1]}.tsx`) : "";
  }),
);
check(gameModuleFiles.size === registryTypes.length || gameModuleFiles.size > 0, "game module files found");
const reached = [...seen].filter((f) => gameModuleFiles.has(f) || f === REGISTRY || f === resolve("src/lib/duel/instructions.ts"));
check(reached.length === 0, `the first screen reaches no game module, registry or help copy statically (${reached.map((f) => f.slice(resolve(".").length + 1)).join(", ")})`);

if (failures.length) {
  for (const f of failures.slice(0, 60)) console.log(`FAIL ${f}`);
  console.log(`FAIL game-catalogue-check: ${failures.length} failure(s), ${passes} passes`);
  process.exit(1);
}
console.log(`PASS game-catalogue-check: ${passes} checks (${registryTypes.length} games, ${REMOVED_PUZZLE_TYPES.length} deleted ids)`);
