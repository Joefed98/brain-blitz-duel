/**
 * Builds TriPeaks' deal bank (src/lib/arcade/cards/tripeaksDeals.data.ts): deal seeds 1, 2, 3, … kept only when
 * scripts/cards/tripeaksSolver.ts finds a line that clears all 28 cards with a run of ten (so perfect play can reach
 * 200); the rest are left out. The lines (checks and bots only, never shipped) go to
 * scripts/fixtures/tripeaks-solutions.json. Deterministic: `--check` rebuilds and compares without writing.
 *
 *   bun scripts/tripeaks-bank.ts [--count=300] [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { tpInitFrom } from "../src/lib/arcade/cards/tripeaks";
import { tpSolve } from "./cards/tripeaksSolver";

const COUNT = Number(process.argv.find((a) => a.startsWith("--count="))?.slice(8) ?? 300);
const CHECK = process.argv.includes("--check");
const DATA = "src/lib/arcade/cards/tripeaksDeals.data.ts";
const SOLUTIONS = "scripts/fixtures/tripeaks-solutions.json";

const deals: number[] = [];
const lines: number[][] = [];
let dropped = 0;
for (let dealSeed = 1; deals.length < COUNT; dealSeed++) {
  const line = tpSolve(tpInitFrom(dealSeed));
  if (!line) {
    dropped++;
    continue;
  }
  deals.push(dealSeed);
  lines.push(line);
}
const data = `/**
 * TriPeaks' deal bank, written by scripts/tripeaks-bank.ts (do not edit by hand): deal seeds proved to clear all 28
 * cards with a run of ten. A puzzle's seed is its index here. ${deals.length} deals; ${dropped} seeds left out.
 */
export const TP_DEALS: readonly number[] = [
${deals.map((d) => `  ${d},`).join("\n")}
];
`;
const sols = JSON.stringify(lines.map((l) => l.join(",")));
if (CHECK) {
  const same = readFileSync(DATA, "utf8") === data && readFileSync(SOLUTIONS, "utf8") === sols;
  console.log(same ? "PASS tripeaks bank rebuilds byte for byte" : "FAIL tripeaks bank differs from a rebuild");
  process.exit(same ? 0 : 1);
}
writeFileSync(DATA, data);
writeFileSync(SOLUTIONS, sols);
console.log(`wrote ${deals.length} deals (${dropped} left out)`);
