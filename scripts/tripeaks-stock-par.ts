/**
 * Builds Summit's stock pars (tripeaksRev 2, 3 Nov 2026; docs/arcade-standard/tripeaks.md): for each deal in the bank
 * (src/lib/arcade/cards/tripeaksDeals.data.ts) the fewest stock cards turned by any line that clears all 28 cards with
 * a run of ten (scripts/cards/tripeaksSolver.ts `tpFewestTurns`: the bank's search with the stock capped, the cap raised
 * a turn at a time), written to src/lib/arcade/cards/tripeaksStockPar.data.ts, and that line (checks and bots only,
 * never shipped) to scripts/fixtures/tripeaks-par-solutions.json. So a flawless run clears at par with a run of ten:
 * every part full. About 5 s a deal (some deals far longer; about 25 minutes for the bank on one core, so run it in
 * parts). Deterministic: `--check` rebuilds and compares without writing (`--count=<n>`
 * rebuilds only the first n and compares them).
 *
 *   bun scripts/tripeaks-stock-par.ts [--check] [--count=300]
 *
 * In parts (each its own process): `--from=a --to=b --part=<file.json>` writes deals a…b−1's pars and lines to a JSON
 * file; `--merge=<file.json>,<file.json>,…` writes the data and the lines from the parts, in order.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { tpInitFrom } from "../src/lib/arcade/cards/tripeaks";
import { TP_DEALS } from "../src/lib/arcade/cards/tripeaksDeals.data";
import { tpFewestTurns } from "./cards/tripeaksSolver";

const CHECK = process.argv.includes("--check");
const COUNT = Number(process.argv.find((a) => a.startsWith("--count="))?.slice(8) ?? TP_DEALS.length);
const DATA = "src/lib/arcade/cards/tripeaksStockPar.data.ts";
const SOLUTIONS = "scripts/fixtures/tripeaks-par-solutions.json";

const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const pars: number[] = [];
const lines: number[][] = [];
const MERGE = opt("merge");
const FROM = Number(opt("from") ?? 0);
const TO = Number(opt("to") ?? COUNT);
if (MERGE) {
  for (const f of MERGE.split(",")) {
    const part = JSON.parse(readFileSync(f, "utf8")) as { pars: number[]; lines: number[][] };
    pars.push(...part.pars);
    lines.push(...part.lines);
  }
  if (pars.length !== TP_DEALS.length) throw new Error(`merged ${pars.length} pars, the bank has ${TP_DEALS.length}`);
}
for (let i = MERGE ? COUNT : FROM; i < (MERGE ? COUNT : TO); i++) {
  const r = tpFewestTurns(tpInitFrom(TP_DEALS[i]!, i));
  if (!r) throw new Error(`deal ${i}: no clearing line with a run of ten (the bank says there is one)`);
  pars.push(r.turns);
  lines.push(r.line);
  if (!CHECK && (i + 1) % 25 === 0) console.log(`${i + 1} deals`);
}
if (opt("part")) {
  writeFileSync(opt("part")!, JSON.stringify({ pars, lines }));
  console.log(`part ${FROM}–${TO - 1}: ${pars.join(",")}`);
  process.exit(0);
}
const data = `/**
 * Summit's stock pars (tripeaksRev 2), written by scripts/tripeaks-stock-par.ts (do not edit by hand): for each bank
 * deal (TP_DEALS, same index), the fewest stock cards turned by any line that clears all 28 cards with a run of ten
 * (the fewest the search found: each stock cap searched to 2 million positions).
 */
export const TP_STOCK_PARS: readonly number[] = [${pars.join(", ")}];
`;
const sols = JSON.stringify(lines.map((l) => l.join(",")));
if (CHECK) {
  const full = COUNT === TP_DEALS.length;
  const storedPars = (readFileSync(DATA, "utf8").match(/= \[([\d, ]*)\]/)?.[1] ?? "").split(",").map((x) => Number(x.trim()));
  const storedLines = JSON.parse(readFileSync(SOLUTIONS, "utf8")) as string[];
  const same = full
    ? readFileSync(DATA, "utf8") === data && readFileSync(SOLUTIONS, "utf8") === sols
    : pars.every((p, i) => storedPars[i] === p) && lines.every((l, i) => storedLines[i] === l.join(","));
  console.log(same ? `PASS tripeaks stock pars rebuild byte for byte (${COUNT} deals)` : "FAIL tripeaks stock pars differ from a rebuild");
  process.exit(same ? 0 : 1);
}
writeFileSync(DATA, data);
writeFileSync(SOLUTIONS, sols);
const sorted = [...pars].sort((a, b) => a - b);
console.log(`wrote ${pars.length} stock pars: ${sorted[0]}–${sorted[sorted.length - 1]}, median ${sorted[sorted.length >> 1]}`);
