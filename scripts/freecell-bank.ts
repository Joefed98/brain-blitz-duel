/**
 * Builds FreeCell's deal bank (src/lib/arcade/cards/freecellDeals.data.ts): deal seeds 1, 2, 3, … each solved by
 * scripts/cards/freecellSolver.ts (weighted A* over the sim's own rules); a deal the solver cannot finish is left
 * out. Par is the shortest solution found. The solutions (server and checks only, never shipped to the phone) go to
 * scripts/fixtures/freecell-solutions.json. Deterministic: `--check` rebuilds and compares without writing.
 *
 *   bun scripts/freecell-bank.ts [--count=300] [--check] [--rev=4]
 *
 * `--rev=4` (freecellRev 4, 3 Nov 2026) builds the 40-card bank (Ace to 10, eight columns of five) into
 * src/lib/arcade/cards/freecellDealsV4.data.ts and scripts/fixtures/freecell-solutions-v4.json the same way.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fcAllHome, fcApply, fcInitFrom } from "../src/lib/arcade/cards/freecell";
import { fcBestSolution, type FcMove } from "./cards/freecellSolver";

const COUNT = Number(process.argv.find((a) => a.startsWith("--count="))?.slice(8) ?? 300);
const CHECK = process.argv.includes("--check");
const REV = Number(process.argv.find((a) => a.startsWith("--rev="))?.slice(6) ?? 1);
const SHORT = REV >= 4;
const DATA = SHORT ? "src/lib/arcade/cards/freecellDealsV4.data.ts" : "src/lib/arcade/cards/freecellDeals.data.ts";
const SOLUTIONS = SHORT ? "scripts/fixtures/freecell-solutions-v4.json" : "scripts/fixtures/freecell-solutions.json";

const deals: [number, number][] = [];
const solutions: FcMove[][] = [];
let dropped = 0;
for (let dealSeed = 1; deals.length < COUNT; dealSeed++) {
  const start = fcInitFrom(dealSeed, 0, 0, SHORT ? 4 : 1);
  const sol = fcBestSolution(start);
  let s = start;
  if (sol) for (const m of sol) s = fcApply(s, m[0], m[1], m[2]) ?? s;
  if (!sol || !fcAllHome(s)) {
    dropped++;
    console.log(`deal ${dealSeed}: no solution found, left out`);
    continue;
  }
  deals.push([dealSeed, sol.length]);
  solutions.push(sol);
  if (deals.length % 25 === 0) console.log(`${deals.length} deals (seed ${dealSeed})`);
}

const data = SHORT
  ? `/**
 * Free Cell's 40-card deal bank (freecellRev 4: Ace to 10 in each suit, eight columns of five), written by
 * scripts/freecell-bank.ts --rev=4 (do not edit by hand): [deal seed, par] for each deal the solver finished; par is the
 * fewest moves it found (auto moves home not counted). A puzzle's seed is its index here. ${deals.length} deals; ${dropped}
 * seeds left out.
 */
export const FC_DEALS_V4: readonly (readonly [number, number])[] = [
${deals.map(([a, b]) => `  [${a}, ${b}],`).join("\n")}
];
`
  : `/**
 * FreeCell's deal bank, written by scripts/freecell-bank.ts (do not edit by hand): [deal seed, par] for each deal the
 * solver finished; par is the fewest moves it found (auto moves home not counted). A puzzle's seed is its index here.
 * ${deals.length} deals; ${dropped} seeds left out.
 */
export const FC_DEALS: readonly (readonly [number, number])[] = [
${deals.map(([a, b]) => `  [${a}, ${b}],`).join("\n")}
];
`;
const sols = JSON.stringify(solutions.map((s) => s.map((m) => m.join(":")).join(",")));
if (CHECK) {
  const same = readFileSync(DATA, "utf8") === data && readFileSync(SOLUTIONS, "utf8") === sols;
  console.log(same ? "PASS freecell bank rebuilds byte for byte" : "FAIL freecell bank differs from a rebuild");
  process.exit(same ? 0 : 1);
}
writeFileSync(DATA, data);
writeFileSync(SOLUTIONS, sols);
const pars = deals.map((d) => d[1]).sort((a, b) => a - b);
console.log(`wrote ${deals.length} deals (${dropped} left out); par ${pars[0]}–${pars[pars.length - 1]}, median ${pars[pars.length >> 1]}`);
