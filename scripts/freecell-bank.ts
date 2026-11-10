/**
 * Builds FreeCell's deal bank (src/lib/arcade/cards/freecellDeals.data.ts): deal seeds 1, 2, 3, … each solved by
 * scripts/cards/freecellSolver.ts (weighted A* over the sim's own rules); a deal the solver cannot finish is left
 * out. Par is the shortest solution found. The solutions (server and checks only, never shipped to the phone) go to
 * scripts/fixtures/freecell-solutions.json. Deterministic: `--check` rebuilds and compares without writing.
 *
 *   bun scripts/freecell-bank.ts [--count=300] [--check [--part=k/n]] [--rev=4]
 *
 * `--check --part=k/n` (10 Nov 2026, so cards-check's full depth fits CI's 300 s per check): re-solves only every n-th
 * deal seed from the k-th, up to the bank's last seed, and fails unless each is in the bank exactly as a rebuild would
 * put it (the same par and solution, or left out); every part also renders both files from the bank and compares them
 * byte for byte. The n parts together prove exactly what one whole `--check` does (each seed's solve is independent).
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

const PART = process.argv.find((a) => a.startsWith("--part="))?.slice(7);
const [PART_K, PART_N] = PART ? PART.split("/").map(Number) as [number, number] : [1, 1];
if (PART && !(CHECK && PART_N >= 1 && PART_K >= 1 && PART_K <= PART_N)) throw new Error(`bad --part=${PART} (needs --check and 1 <= k <= n)`);

/** One deal seed solved as the build solves it: its solution, or null when the build leaves it out. */
function solveSeed(dealSeed: number): FcMove[] | null {
  const start = fcInitFrom(dealSeed, 0, 0, SHORT ? 4 : 1);
  const sol = fcBestSolution(start);
  let s = start;
  if (sol) for (const m of sol) s = fcApply(s, m[0], m[1], m[2]) ?? s;
  return !sol || !fcAllHome(s) ? null : sol;
}

let deals: [number, number][] = [];
let solutions: FcMove[][] = [];
let dropped = 0;
let partMismatch = 0;
if (PART) {
  // The bank as stored; this part re-solves its seeds and the files are rendered from the stored bank below.
  const stored = (SHORT ? (await import("../src/lib/arcade/cards/freecellDealsV4.data")).FC_DEALS_V4 : (await import("../src/lib/arcade/cards/freecellDeals.data")).FC_DEALS).map(([a, b]) => [a, b] as [number, number]);
  const storedSols = (JSON.parse(readFileSync(SOLUTIONS, "utf8")) as string[]).map((line) => (line ? line.split(",").map((m) => m.split(":").map(Number) as FcMove) : []));
  deals = stored;
  solutions = storedSols;
  const last = stored.length ? stored[stored.length - 1]![0] : 0;
  dropped = last - stored.length;
  const at = new Map(stored.map(([seed], i) => [seed, i]));
  if (stored.length !== COUNT || storedSols.length !== stored.length) partMismatch++;
  let solved = 0;
  for (let dealSeed = 1 + (PART_K - 1); dealSeed <= last; dealSeed += PART_N) {
    const sol = solveSeed(dealSeed);
    const i = at.get(dealSeed);
    const same = i === undefined ? sol === null : sol !== null && stored[i]![1] === sol.length && JSON.stringify(storedSols[i]) === JSON.stringify(sol);
    if (!same) {
      partMismatch++;
      console.log(`deal ${dealSeed}: a rebuild ${sol ? `solves it in ${sol.length}` : "leaves it out"}, the bank ${i === undefined ? "leaves it out" : `has par ${stored[i]![1]}`}`);
    }
    solved++;
  }
  console.log(`part ${PART}: ${solved} deal seeds re-solved`);
} else {
  for (let dealSeed = 1; deals.length < COUNT; dealSeed++) {
    const sol = solveSeed(dealSeed);
    if (!sol) {
      dropped++;
      console.log(`deal ${dealSeed}: no solution found, left out`);
      continue;
    }
    deals.push([dealSeed, sol.length]);
    solutions.push(sol);
    if (deals.length % 25 === 0) console.log(`${deals.length} deals (seed ${dealSeed})`);
  }
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
  const same = readFileSync(DATA, "utf8") === data && readFileSync(SOLUTIONS, "utf8") === sols && partMismatch === 0;
  console.log(same ? `PASS freecell bank rebuilds byte for byte${PART ? ` (part ${PART})` : ""}` : `FAIL freecell bank differs from a rebuild${PART ? ` (part ${PART})` : ""}`);
  process.exit(same ? 0 : 1);
}
writeFileSync(DATA, data);
writeFileSync(SOLUTIONS, sols);
const pars = deals.map((d) => d[1]).sort((a, b) => a - b);
console.log(`wrote ${deals.length} deals (${dropped} left out); par ${pars[0]}–${pars[pars.length - 1]}, median ${pars[pars.length >> 1]}`);
