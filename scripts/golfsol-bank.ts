/**
 * Builds Golf Solitaire's deal bank (src/lib/arcade/cards/golfSolDeals.data.ts): deal seeds 1, 2, 3, … kept only when
 * scripts/cards/golfSolSolver.ts finds a line that clears all 35 tableau cards with five runs of five (so perfect play
 * can reach 200); the rest are left out. The lines (checks and bots only, never shipped) go to
 * scripts/fixtures/golfsol-solutions.json. Deterministic: `--check` rebuilds and compares without writing (~10 min).
 *
 *   bun scripts/golfsol-bank.ts [--count=300] [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gsInitFrom } from "../src/lib/arcade/cards/golfSol";
import { gsSolve } from "./cards/golfSolSolver";

const COUNT = Number(process.argv.find((a) => a.startsWith("--count="))?.slice(8) ?? 300);
const CHECK = process.argv.includes("--check");
const DATA = "src/lib/arcade/cards/golfSolDeals.data.ts";
const SOLUTIONS = "scripts/fixtures/golfsol-solutions.json";

const deals: number[] = [];
const lines: number[][] = [];
let dropped = 0;
for (let dealSeed = 1; deals.length < COUNT; dealSeed++) {
  const line = gsSolve(gsInitFrom(dealSeed), 5, 200_000);
  if (!line) {
    dropped++;
    continue;
  }
  deals.push(dealSeed);
  lines.push(line);
}
const data = `/**
 * Golf Solitaire's deal bank, written by scripts/golfsol-bank.ts (do not edit by hand): deal seeds proved to clear all
 * 35 tableau cards with five runs of five. A puzzle's seed is its index here. ${deals.length} deals; ${dropped} seeds left out.
 */
export const GS_DEALS: readonly number[] = [
${deals.map((d) => `  ${d},`).join("\n")}
];
`;
const sols = JSON.stringify(lines.map((l) => l.join(",")));
if (CHECK) {
  const same = readFileSync(DATA, "utf8") === data && readFileSync(SOLUTIONS, "utf8") === sols;
  console.log(same ? "PASS golfsol bank rebuilds byte for byte" : "FAIL golfsol bank differs from a rebuild");
  process.exit(same ? 0 : 1);
}
writeFileSync(DATA, data);
writeFileSync(SOLUTIONS, sols);
console.log(`wrote ${deals.length} deals (${dropped} left out)`);
