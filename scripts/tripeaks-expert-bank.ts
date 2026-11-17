/**
 * Builds Summit's Expert bank (the difficulty levels, 15 Nov 2026; src/lib/arcade/cards/tripeaksExpert.data.ts): deal
 * seeds 1, 2, 3 … (fresh shuffles: without the wrap only about one deal in six clears with a run of ten) that the bank solver (src/lib/arcade/cards/tripeaksSolver.ts) clears with a
 * run of ten under Expert's rule (no Ace–King wrap), each with its stock par under that rule (tpFewestTurns: the fewest
 * stock cards turned on such a line). From deal seeds 1–700 (208 clear), the TP_EXPERT_SIZE with the highest stock par
 * are Expert's (ties: the lower seed; 16 Nov 2026, Joe: Expert's deals must be harder, not just glow-free), the rest
 * Hard's (both without the wrap), each in seed order. Lines to scripts/fixtures/tripeaks-expert-lines.json
 * (checks only). Deterministic: `--check` rebuilds and compares without writing.
 *
 *   bun scripts/tripeaks-expert-bank.ts [--check] [--from=a --to=b --part=<file.json>] [--merge=<f1>,<f2>,…]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { tpLevelInitFrom } from "../src/lib/arcade/cards/tripeaks";
import { tpFewestTurns, tpSolve } from "../src/lib/arcade/cards/tripeaksSolver";

export const TP_EXPERT_SIZE = 100;
/** The deal seeds searched (1 to this). */
export const TP_EXPERT_SEEDS = 700;
const DATA = "src/lib/arcade/cards/tripeaksExpert.data.ts";
const LINES = "scripts/fixtures/tripeaks-expert-lines.json";
const CHECK = process.argv.includes("--check");
const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const LIMIT = 400_000;

type Row = { index: number; dealSeed: number; par: number; line: number[] } | { index: number; dealSeed: number; par: -1; line: [] };
function judge(dealSeed: number): Row {
  const index = dealSeed;
  const start = tpLevelInitFrom("expert", dealSeed, 0, 0);
  if (!tpSolve(start, 10, LIMIT)) return { index, dealSeed, par: -1, line: [] };
  const r = tpFewestTurns(start, 10, LIMIT);
  return r ? { index, dealSeed, par: r.turns, line: r.line } : { index, dealSeed, par: -1, line: [] };
}

let rows: Row[] = [];
if (opt("merge")) {
  for (const f of opt("merge")!.split(",")) rows.push(...(JSON.parse(readFileSync(f, "utf8")) as Row[]));
} else {
  const from = Number(opt("from") ?? 1);
  const to = Number(opt("to") ?? TP_EXPERT_SEEDS + 1);
  for (let i = from; i < to; i++) {
    rows.push(judge(i));
    if (opt("part") && (i - from + 1) % 10 === 0) console.log(`${i + 1}: ${rows.filter((r) => r.par >= 0).length} kept`);
  }
  if (opt("part")) {
    writeFileSync(opt("part")!, JSON.stringify(rows));
    console.log(`part ${from}–${to - 1}: ${rows.filter((r) => r.par >= 0).length} kept`);
    process.exit(0);
  }
}
const clear = rows.filter((r) => r.par >= 0).sort((a, b) => b.par - a.par || a.index - b.index);
const kept = clear.slice(0, TP_EXPERT_SIZE).sort((a, b) => a.index - b.index);
// Hard (16 Nov 2026): the rest of the deals that clear without the wrap, the easier ones.
const hard = clear.slice(TP_EXPERT_SIZE).sort((a, b) => a.index - b.index);
const data = `/**
 * Summit's Expert deals (the difficulty levels, 15 Nov 2026), written by scripts/tripeaks-expert-bank.ts (do not edit by
 * hand): [deal seed, stock par] for the deal seeds (1–700) the solver clears with a run of ten without the Ace–King wrap
 * that need the most stock cards (the 100 highest stock pars); the stock par is the fewest stock cards such a line turns. An Expert puzzle's seed is its index here. ${kept.length} deals.
 */
export const TP_EXPERT_DEALS: readonly (readonly [number, number])[] = [
${kept.map((r) => `  [${r.dealSeed}, ${r.par}],`).join("\n")}
];

/** Hard's deals: the other ${hard.length} that clear without the wrap (the easier ones), [deal seed, stock par]. */
export const TP_HARD_NOWRAP_DEALS: readonly (readonly [number, number])[] = [
${hard.map((r) => `  [${r.dealSeed}, ${r.par}],`).join("\n")}
];
`;
const lines = JSON.stringify({ expert: kept.map((r) => r.line.join(",")), hard: hard.map((r) => r.line.join(",")) });
if (CHECK) {
  const same = readFileSync(DATA, "utf8") === data && readFileSync(LINES, "utf8") === lines;
  console.log(same ? "PASS summit expert bank rebuilds byte for byte" : "FAIL summit expert bank differs from a rebuild");
  process.exit(same ? 0 : 1);
}
writeFileSync(DATA, data);
writeFileSync(LINES, lines);
console.log(`wrote ${kept.length} Expert deals, pars ${kept.map((r) => r.par).join(",")}`);
