/**
 * Builds Free Cell's level deal banks (the difficulty levels, 15 Nov 2026; src/lib/arcade/cards/freecellDealsLevels.data.ts):
 * [deal seed, par] for each level, every deal solved by the bank solver (src/lib/arcade/cards/freecellSolver.ts, weighted
 * A* over the sim's own rules) with the level's cards and free cells, par the fewest moves it found. The solutions go to
 * scripts/fixtures/freecell-solutions-levels.json (server and checks only, never shipped). Deterministic: `--check`
 * rebuilds and compares without writing.
 *
 *   Easy    deal seeds 1, 2, 3 … on 32 cards (Ace to 8) and 5 free cells: the first FC_LEVEL_BANK_SIZE solved.
 *   Hard    the 52-card deal seeds of the Normal-era bank (freecellDeals.data.ts, 4 free cells) re-solved here, the
 *           FC_LEVEL_BANK_SIZE with the shortest solutions ("deals with short solutions").
 *   Expert  the same seeds solved with 3 free cells, the FC_LEVEL_BANK_SIZE shortest ("only the shortest proven deals").
 *
 *   bun scripts/freecell-level-bank.ts [--check] [--level=easy|hard|expert]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fcAllHome, fcApply, fcLevelInitFrom, type FcLevelName } from "../src/lib/arcade/cards/freecell";
import { FC_DEALS } from "../src/lib/arcade/cards/freecellDeals.data";
import { fcBestSolution, type FcMove } from "../src/lib/arcade/cards/freecellSolver";

export const FC_LEVEL_BANK_SIZE = 120;
const DATA = "src/lib/arcade/cards/freecellDealsLevels.data.ts";
const SOLUTIONS = "scripts/fixtures/freecell-solutions-levels.json";
const CHECK = process.argv.includes("--check");
const ONLY = process.argv.find((a) => a.startsWith("--level="))?.slice(8) as FcLevelName | undefined;

function solve(level: FcLevelName, dealSeed: number): FcMove[] | null {
  const start = fcLevelInitFrom(level, dealSeed, 0);
  const sol = fcBestSolution(start, 60_000);
  if (!sol) return null;
  let s = start;
  for (const m of sol) s = fcApply(s, m[0], m[1], m[2]) ?? s;
  return fcAllHome(s) ? sol : null;
}

type Entry = { seed: number; sol: FcMove[] };
function build(level: FcLevelName): Entry[] {
  const out: Entry[] = [];
  if (level === "easy") {
    for (let seed = 1; out.length < FC_LEVEL_BANK_SIZE; seed++) {
      const sol = solve(level, seed);
      if (sol) out.push({ seed, sol });
    }
    return out;
  }
  const solved: Entry[] = [];
  for (const [seed] of FC_DEALS) {
    const sol = solve(level, seed);
    if (sol) solved.push({ seed, sol });
    if (solved.length % 50 === 0) console.log(`${level}: ${solved.length} solved (seed ${seed})`);
  }
  // The shortest solutions (ties: the lower seed), then in seed order.
  const kept = [...solved].sort((a, b) => a.sol.length - b.sol.length || a.seed - b.seed).slice(0, FC_LEVEL_BANK_SIZE);
  return kept.sort((a, b) => a.seed - b.seed);
}

const LEVELS: FcLevelName[] = ["easy", "hard", "expert"];
const stored = (() => {
  try {
    return JSON.parse(readFileSync(SOLUTIONS, "utf8")) as Record<string, string[]>;
  } catch {
    return {} as Record<string, string[]>;
  }
})();
const banks: Record<string, Entry[]> = {};
for (const level of LEVELS) {
  if (ONLY && level !== ONLY) {
    const mod = await import("../src/lib/arcade/cards/freecellDealsLevels.data");
    const bank = level === "easy" ? mod.FC_DEALS_EASY : level === "hard" ? mod.FC_DEALS_HARD : mod.FC_DEALS_EXPERT;
    banks[level] = bank.map(([seed], i) => ({ seed, sol: (stored[level]?.[i] ?? "").split(",").filter(Boolean).map((m) => m.split(":").map(Number) as unknown as FcMove) }));
    continue;
  }
  banks[level] = build(level);
  const pars = banks[level]!.map((e) => e.sol.length).sort((a, b) => a - b);
  console.log(`${level}: ${banks[level]!.length} deals, par ${pars[0]}–${pars[pars.length - 1]}, median ${pars[pars.length >> 1]}`);
}

const name = (l: string) => `FC_DEALS_${l.toUpperCase()}`;
const data = `/**
 * Free Cell's level deal banks (the difficulty levels, 15 Nov 2026), written by scripts/freecell-level-bank.ts (do not
 * edit by hand): [deal seed, par] for each deal, solved by the bank solver with the level's cards and free cells; par is
 * the fewest moves it found (auto moves home not counted). A level puzzle's seed is its index in its level's bank.
 * Easy: 32 cards (Ace to 8), 5 free cells. Hard: 52 cards, 4 free cells, the shortest solutions of the Normal-era
 * bank's seeds. Expert: the same seeds with 3 free cells, the shortest.
 */
${LEVELS.map((l) => `export const ${name(l)}: readonly (readonly [number, number])[] = [\n${banks[l]!.map((e) => `  [${e.seed}, ${e.sol.length}],`).join("\n")}\n];`).join("\n\n")}
`;
const sols = JSON.stringify(Object.fromEntries(LEVELS.map((l) => [l, banks[l]!.map((e) => e.sol.map((m) => m.join(":")).join(","))])));
if (CHECK) {
  const same = readFileSync(DATA, "utf8") === data && readFileSync(SOLUTIONS, "utf8") === sols;
  console.log(same ? "PASS freecell level banks rebuild byte for byte" : "FAIL freecell level banks differ from a rebuild");
  process.exit(same ? 0 : 1);
}
writeFileSync(DATA, data);
writeFileSync(SOLUTIONS, sols);
console.log("wrote", DATA, SOLUTIONS);
