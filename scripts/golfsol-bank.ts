/**
 * Builds Golf Solitaire's deal bank (src/lib/arcade/cards/golfSolDeals.data.ts): deal seeds 1, 2, 3, … kept only when
 * a strong human line (scripts/cards/golfSolHuman.ts: look-ahead over the visible columns, the stock unknown) clears
 * all 35 tableau cards, and scripts/cards/golfSolSolver.ts finds a line clearing them with five runs of four (so perfect
 * play reaches 200); the rest are left out. The lines (checks and bots only, never shipped) go to
 * scripts/fixtures/golfsol-solutions.json. Deterministic: `--check` rebuilds and compares without writing (a few minutes).
 *
 *   bun scripts/golfsol-bank.ts [--count=300] [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gsInitFrom } from "../src/lib/arcade/cards/golfSol";
import { gsSolve } from "./cards/golfSolSolver";
import { gsHumanLine } from "./cards/golfSolHuman";

const COUNT = Number(process.argv.find((a) => a.startsWith("--count="))?.slice(8) ?? 300);
const CHECK = process.argv.includes("--check");
const DATA = "src/lib/arcade/cards/golfSolDeals.data.ts";
const SOLUTIONS = "scripts/fixtures/golfsol-solutions.json";

const deals: number[] = [];
const lines: number[][] = [];
let dropped = 0;
for (let dealSeed = 1; deals.length < COUNT; dealSeed++) {
  const start = gsInitFrom(dealSeed);
  const line = gsHumanLine(start).cleared ? gsSolve(start, 5, 200_000) : null;
  if (!line) {
    dropped++;
    continue;
  }
  deals.push(dealSeed);
  lines.push(line);
}
const data = `/**
 * Golf Solitaire's deal bank, written by scripts/golfsol-bank.ts (do not edit by hand): deal seeds proved to clear all
 * 35 tableau cards (a strong human line clears each) with five runs of four. A puzzle's seed is its index here. ${deals.length} deals; ${dropped} seeds left out.
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
