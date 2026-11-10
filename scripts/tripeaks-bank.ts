/**
 * Builds TriPeaks' deal bank (src/lib/arcade/cards/tripeaksDeals.data.ts): deal seeds 1, 2, 3, … kept only when
 * scripts/cards/tripeaksSolver.ts finds a line that clears all 28 cards with a run of ten (so perfect play can reach
 * 200); the rest are left out. The lines (checks and bots only, never shipped) go to
 * scripts/fixtures/tripeaks-solutions.json. Deterministic: `--check` rebuilds and compares without writing.
 *
 *   bun scripts/tripeaks-bank.ts [--count=300] [--check [--part=k/n]]
 *
 * `--check --part=k/n` (10 Nov 2026, so cards-check's full depth fits CI's 300 s per check): re-solves only every n-th
 * deal seed from the k-th, up to the bank's last seed, and fails unless each is in the bank exactly as a rebuild would
 * put it (the same line, or left out); every part also renders both files from the bank and compares them byte for
 * byte. The n parts together prove exactly what one whole `--check` does (each seed's solve is independent).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { tpInitFrom } from "../src/lib/arcade/cards/tripeaks";
import { tpSolve } from "./cards/tripeaksSolver";

const COUNT = Number(process.argv.find((a) => a.startsWith("--count="))?.slice(8) ?? 300);
const CHECK = process.argv.includes("--check");
const DATA = "src/lib/arcade/cards/tripeaksDeals.data.ts";
const SOLUTIONS = "scripts/fixtures/tripeaks-solutions.json";

const PART = process.argv.find((a) => a.startsWith("--part="))?.slice(7);
const [PART_K, PART_N] = PART ? PART.split("/").map(Number) as [number, number] : [1, 1];
if (PART && !(CHECK && PART_N >= 1 && PART_K >= 1 && PART_K <= PART_N)) throw new Error(`bad --part=${PART} (needs --check and 1 <= k <= n)`);

let deals: number[] = [];
let lines: number[][] = [];
let dropped = 0;
let partMismatch = 0;
if (PART) {
  // The bank as stored; this part re-solves its seeds and the files are rendered from the stored bank below.
  const stored = [...(await import("../src/lib/arcade/cards/tripeaksDeals.data")).TP_DEALS];
  const storedLines = (JSON.parse(readFileSync(SOLUTIONS, "utf8")) as string[]).map((l) => (l ? l.split(",").map(Number) : []));
  deals = stored;
  lines = storedLines;
  const last = stored.length ? stored[stored.length - 1]! : 0;
  dropped = last - stored.length;
  const at = new Map(stored.map((seed, i) => [seed, i]));
  if (stored.length !== COUNT || storedLines.length !== stored.length) partMismatch++;
  let solved = 0;
  for (let dealSeed = 1 + (PART_K - 1); dealSeed <= last; dealSeed += PART_N) {
    const line = tpSolve(tpInitFrom(dealSeed));
    const i = at.get(dealSeed);
    const same = i === undefined ? line === null : line !== null && JSON.stringify(storedLines[i]) === JSON.stringify(line);
    if (!same) {
      partMismatch++;
      console.log(`deal ${dealSeed}: a rebuild ${line ? "keeps it" : "leaves it out"}, the bank ${i === undefined ? "leaves it out" : "keeps it"}${line && i !== undefined ? " with another line" : ""}`);
    }
    solved++;
  }
  console.log(`part ${PART}: ${solved} deal seeds re-solved`);
} else {
  for (let dealSeed = 1; deals.length < COUNT; dealSeed++) {
    const line = tpSolve(tpInitFrom(dealSeed));
    if (!line) {
      dropped++;
      continue;
    }
    deals.push(dealSeed);
    lines.push(line);
  }
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
  const same = readFileSync(DATA, "utf8") === data && readFileSync(SOLUTIONS, "utf8") === sols && partMismatch === 0;
  console.log(same ? `PASS tripeaks bank rebuilds byte for byte${PART ? ` (part ${PART})` : ""}` : `FAIL tripeaks bank differs from a rebuild${PART ? ` (part ${PART})` : ""}`);
  process.exit(same ? 0 : 1);
}
writeFileSync(DATA, data);
writeFileSync(SOLUTIONS, sols);
console.log(`wrote ${deals.length} deals (${dropped} left out)`);
